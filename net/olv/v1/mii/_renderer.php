<?php

declare(strict_types=1);

function wut_mii_renderer_settings(array $config): array
{
    $base = rtrim(trim((string) ($config['mii_renderer_base'] ?? '')), '/');
    $parts = $base !== '' ? parse_url($base) : false;
    $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
    $configured = is_array($parts)
        && in_array($scheme, array('http', 'https'), true)
        && !empty($parts['host']);

    $connectTimeout = (int) ($config['mii_renderer_connect_timeout'] ?? 4);
    $timeout = (int) ($config['mii_renderer_timeout'] ?? 15);
    $maxBytes = (int) ($config['mii_renderer_max_bytes'] ?? 4194304);
    $cacheTtl = (int) ($config['mii_renderer_cache_ttl'] ?? 3600);
    $staleTtl = (int) ($config['mii_renderer_stale_ttl'] ?? 604800);
    $scale = (int) ($config['mii_renderer_scale'] ?? 1);
    $cacheDir = trim((string) ($config['mii_renderer_cache_dir'] ?? ''));

    if ($cacheDir === '') {
        $cacheDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'wut-mii-cache';
    }

    return array(
        'configured' => $configured,
        'base' => $configured ? $base : '',
        'connect_timeout' => max(1, min(15, $connectTimeout)),
        'timeout' => max(2, min(60, $timeout)),
        'max_bytes' => max(65536, min(16777216, $maxBytes)),
        'cache_dir' => $cacheDir,
        'cache_ttl' => max(0, min(2592000, $cacheTtl)),
        'stale_ttl' => max(0, min(7776000, $staleTtl)),
        'verify_tls' => !isset($config['mii_renderer_verify_tls'])
            || $config['mii_renderer_verify_tls'] !== false,
        'scale' => $scale === 2 ? 2 : 1,
    );
}

function wut_mii_allowed_type($value): string
{
    $allowed = array(
        'face',
        'face_only',
        'all_body',
        'fflmakeicon',
        'ffliconwithbody',
        'variableiconbody',
        'all_body_sugar',
    );

    return is_string($value) && in_array($value, $allowed, true)
        ? $value
        : 'face';
}

function wut_mii_allowed_expression($value): string
{
    $allowed = array(
        'normal',
        'smile',
        'anger',
        'sorrow',
        'surprise',
        'blink',
        'open_mouth',
        'happy',
        'like',
        'frustrated',
        'puzzled',
        'surprised',
    );

    return is_string($value) && in_array($value, $allowed, true)
        ? $value
        : 'normal';
}

function wut_mii_render_query(
    array $identity,
    array $settings,
    int $width,
    string $type,
    string $expression
): ?array {
    $query = array(
        'width' => max(48, min(512, $width)),
        'type' => wut_mii_allowed_type($type),
        'expression' => wut_mii_allowed_expression($expression),

        /* Matches the Wii U/NNID/Miiverse-era look exposed by the backend. */
        'shaderType' => 'wiiu',
        'resourceType' => 'middle',
        'scale' => $settings['scale'],
    );

    if (!empty($identity['mii_data'])) {
        $data = wut_normalize_mii_data($identity['mii_data']);
        if ($data === null) {
            return null;
        }
        $query['data'] = $data;
        return $query;
    }

    if (!empty($identity['pid']) && ctype_digit((string) $identity['pid'])) {
        $query['pid'] = (string) $identity['pid'];
        if (($identity['network'] ?? '') === 'pretendo') {
            $query['api_id'] = 1;
        }
        return $query;
    }

    if (!empty($identity['pnid'])) {
        $query['nnid'] = (string) $identity['pnid'];
        $query['api_id'] = (($identity['network'] ?? '') === 'pretendo') ? 1 : 0;
        return $query;
    }

    return null;
}

function wut_mii_is_png($body): bool
{
    return is_string($body)
        && strlen($body) >= 8
        && substr($body, 0, 8) === "\x89PNG\r\n\x1a\n";
}

function wut_mii_cache_path(array $settings, array $query): string
{
    $key = hash(
        'sha256',
        (string) $settings['base'] . '|' . http_build_query($query, '', '&', PHP_QUERY_RFC3986)
    );

    return rtrim((string) $settings['cache_dir'], DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . $key . '.png';
}

function wut_mii_read_cache(array $settings, array $query): ?array
{
    $path = wut_mii_cache_path($settings, $query);

    if (!is_file($path)) {
        return null;
    }

    $size = @filesize($path);
    $modified = @filemtime($path);
    if (!is_int($size) || $size < 8 || $size > $settings['max_bytes'] || !is_int($modified)) {
        return null;
    }

    $body = @file_get_contents($path);
    if (!wut_mii_is_png($body)) {
        return null;
    }

    $age = max(0, time() - $modified);

    return array(
        'body' => $body,
        'modified' => $modified,
        'age' => $age,
        'fresh' => $settings['cache_ttl'] > 0 && $age <= $settings['cache_ttl'],
        'stale_allowed' => $settings['stale_ttl'] > 0 && $age <= $settings['stale_ttl'],
    );
}

function wut_mii_write_cache(array $settings, array $query, string $body): bool
{
    if ($settings['cache_ttl'] <= 0 || !wut_mii_is_png($body)) {
        return false;
    }

    $dir = (string) $settings['cache_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    return @file_put_contents(
        wut_mii_cache_path($settings, $query),
        $body,
        LOCK_EX
    ) !== false;
}

function wut_mii_response_status(array $headers): int
{
    $status = 0;
    foreach ($headers as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/i', (string) $header, $match)) {
            $status = (int) $match[1];
        }
    }
    return $status;
}

function wut_mii_http_get(string $url, array $settings): array
{
    $body = '';
    $status = 0;
    $contentType = '';
    $tooLarge = false;
    $error = '';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $settings['connect_timeout']);
        curl_setopt($ch, CURLOPT_TIMEOUT, $settings['timeout']);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Accept: image/png'));
        curl_setopt($ch, CURLOPT_USERAGENT, 'WUT-Mii-Gateway/1.0');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $settings['verify_tls']);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, $settings['verify_tls'] ? 2 : 0);

        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
        }

        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($handle, $chunk) use (&$body, &$tooLarge, $settings) {
            $length = strlen($chunk);
            if (strlen($body) + $length > $settings['max_bytes']) {
                $tooLarge = true;
                return 0;
            }
            $body .= $chunk;
            return $length;
        });

        $worked = curl_exec($ch);
        $statusInfo = defined('CURLINFO_RESPONSE_CODE')
            ? CURLINFO_RESPONSE_CODE
            : CURLINFO_HTTP_CODE;
        $status = (int) curl_getinfo($ch, $statusInfo);
        $reportedType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        if (is_string($reportedType)) {
            $contentType = $reportedType;
        }
        if ($worked === false) {
            $error = $tooLarge ? 'response-too-large' : 'transport-failed';
        }
        curl_close($ch);
    } else {
        $context = stream_context_create(array(
            'http' => array(
                'timeout' => $settings['timeout'],
                'ignore_errors' => true,
                'protocol_version' => 1.1,
                'follow_location' => 0,
                'max_redirects' => 0,
                'header' => "Accept: image/png\r\nUser-Agent: WUT-Mii-Gateway/1.0\r\n",
            ),
            'ssl' => array(
                'verify_peer' => $settings['verify_tls'],
                'verify_peer_name' => $settings['verify_tls'],
            ),
        ));

        $stream = @fopen($url, 'rb', false, $context);
        if ($stream === false) {
            $error = 'transport-failed';
        } else {
            $meta = stream_get_meta_data($stream);
            $headers = isset($meta['wrapper_data']) && is_array($meta['wrapper_data'])
                ? $meta['wrapper_data']
                : array();
            $status = wut_mii_response_status($headers);

            foreach ($headers as $header) {
                if (stripos((string) $header, 'Content-Type:') === 0) {
                    $contentType = trim(substr((string) $header, 13));
                }
            }

            while (!feof($stream)) {
                $chunk = fread($stream, 8192);
                if ($chunk === false) {
                    $error = 'transport-failed';
                    break;
                }
                if (strlen($body) + strlen($chunk) > $settings['max_bytes']) {
                    $tooLarge = true;
                    $error = 'response-too-large';
                    break;
                }
                $body .= $chunk;
            }
            fclose($stream);
        }
    }

    $mime = strtolower(trim(explode(';', $contentType)[0] ?? ''));
    $validPng = wut_mii_is_png($body);
    $ok = $error === ''
        && $status >= 200
        && $status < 300
        && $validPng
        && ($mime === '' || $mime === 'image/png' || $mime === 'application/octet-stream');

    if (!$ok && $error === '') {
        $error = !$validPng ? 'invalid-png' : 'upstream-status';
    }

    return array(
        'ok' => $ok,
        'status' => $status,
        'body' => $body,
        'error' => $error,
        'too_large' => $tooLarge,
    );
}

function wut_mii_fetch_render(array $settings, array $query): array
{
    $cached = wut_mii_read_cache($settings, $query);

    if (is_array($cached) && !empty($cached['fresh'])) {
        return array(
            'ok' => true,
            'body' => $cached['body'],
            'modified' => $cached['modified'],
            'cache' => 'HIT',
            'upstream_status' => 0,
        );
    }

    $url = $settings['base'] . '/miis/image.png?'
        . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    $response = wut_mii_http_get($url, $settings);

    if (!empty($response['ok'])) {
        wut_mii_write_cache($settings, $query, $response['body']);
        return array(
            'ok' => true,
            'body' => $response['body'],
            'modified' => time(),
            'cache' => 'MISS',
            'upstream_status' => $response['status'],
        );
    }

    if (is_array($cached) && !empty($cached['stale_allowed'])) {
        return array(
            'ok' => true,
            'body' => $cached['body'],
            'modified' => $cached['modified'],
            'cache' => 'STALE',
            'upstream_status' => $response['status'],
        );
    }

    return array(
        'ok' => false,
        'body' => '',
        'modified' => time(),
        'cache' => 'ERROR',
        'upstream_status' => $response['status'],
        'error' => $response['error'],
    );
}
