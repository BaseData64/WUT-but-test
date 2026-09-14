<?php

declare(strict_types=1);

function wut_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $path = dirname(__DIR__, 2) . '/cfg/wut.php';
    $config = array(
        'mii_renderer_base' => '',
        'mii_renderer_connect_timeout' => 4,
        'mii_renderer_timeout' => 15,
        'mii_renderer_max_bytes' => 4194304,
        'mii_renderer_cache_dir' => '',
        'mii_renderer_cache_ttl' => 3600,
        'mii_renderer_stale_ttl' => 604800,
        'mii_renderer_verify_tls' => true,
        'mii_renderer_scale' => 1,
        'allow_local_dev_identity' => false,
        'allow_browser_mii_link' => false,

        /*
         * Local native-identity bridge.
         *
         * Inkay appends a compact WUT identity capsule to the real Miiverse
         * service token. The local mitmproxy strips that suffix before any
         * Pretendo request and forwards only the capsule to Apache with a
         * shared bridge key. Keep this disabled on public deployments unless
         * an equivalent trusted edge is in front of PHP.
         */
        'allow_native_identity_bridge' => false,
        'native_identity_bridge_key' => '',
    );

    if (is_file($path)) {
        $loaded = require $path;
        if (is_array($loaded)) {
            $config = array_merge($config, $loaded);
        }
    }

    return $config;
}

function wut_start_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('WUTSESSID');
        session_start();
    }
}

function wut_header(string $serverKey): string
{
    return isset($_SERVER[$serverKey]) ? trim((string) $_SERVER[$serverKey]) : '';
}

function wut_is_local_request(): bool
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    return $remote === '127.0.0.1' || $remote === '::1';
}

function wut_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function wut_identity_from_session(): array
{
    $identity = $_SESSION['wut_identity'] ?? array();

    return array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'network' => $identity['network'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'persistent_id' => $identity['persistent_id'] ?? null,
        'user_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data' => $identity['mii_data'] ?? null,
        'mii_image_url' => $identity['mii_image_url'] ?? null,
    );
}

function wut_public_identity(array $identity): array
{
    /*
     * Mii StoreData stays on the server. The old WebKit client only needs to
     * know that a lookup source exists; render.php consumes the real value.
     */
    return array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'network' => $identity['network'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'persistent_id' => $identity['persistent_id'] ?? null,
        'user_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data_present' => !empty($identity['mii_data']),
        'mii_image_url' => $identity['mii_image_url'] ?? null,
    );
}

function wut_mii_lookup_source(array $identity): string
{
    if (!empty($identity['mii_data'])) {
        return 'data';
    }

    if (!empty($identity['pid'])) {
        return 'pid';
    }

    if (!empty($identity['pnid'])) {
        return 'pnid';
    }

    if (!empty($identity['mii_image_url'])) {
        return 'image_url';
    }

    return 'none';
}

function wut_mii_identity_cache_key(array $identity): ?string
{
    $source = wut_mii_lookup_source($identity);

    if ($source === 'none') {
        return null;
    }

    if ($source === 'data') {
        $value = (string) $identity['mii_data'];
    } elseif ($source === 'pid') {
        $value = (string) $identity['pid'];
    } elseif ($source === 'pnid') {
        $value = (string) $identity['pnid'];
    } else {
        $value = (string) $identity['mii_image_url'];
    }

    return substr(hash(
        'sha256',
        $source . '|' . (string) ($identity['network'] ?? '') . '|' . $value
    ), 0, 20);
}

function wut_normalize_mii_data($value): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $value = preg_replace('/\s+/', '', trim($value));
    if (!is_string($value) || $value === '' || strlen($value) > 512) {
        return null;
    }

    $decoded = false;

    if ((strlen($value) % 2) === 0 && ctype_xdigit($value)) {
        $decoded = hex2bin($value);
    } elseif (preg_match('/^[A-Za-z0-9+\/_=-]+$/', $value)) {
        $base64 = strtr($value, '-_', '+/');
        $padding = strlen($base64) % 4;
        if ($padding !== 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($base64, true);
    }

    if (!is_string($decoded)) {
        return null;
    }

    $length = strlen($decoded);
    if ($length < 46 || $length > 96) {
        return null;
    }

    return $value;
}

function wut_store_linked_identity(
    array $input,
    string $source = 'wut-account-link',
    bool $authenticated = true
): bool
{
    $network = strtolower(trim((string) ($input['network'] ?? 'pretendo')));
    if (!in_array($network, array('pretendo', 'nintendo', 'wut'), true)) {
        $network = 'wut';
    }

    $pid = null;
    if (isset($input['pid']) && ctype_digit((string) $input['pid']) && (int) $input['pid'] > 0) {
        $pid = (string) $input['pid'];
    }

    $persistentId = null;
    if (
        isset($input['persistent_id'])
        && ctype_digit((string) $input['persistent_id'])
        && (int) $input['persistent_id'] > 0
    ) {
        $persistentId = (string) $input['persistent_id'];
    }

    $userId = isset($input['user_id'])
        ? substr(trim((string) $input['user_id']), 0, 32)
        : null;
    $pnid = isset($input['pnid'])
        ? substr(trim((string) $input['pnid']), 0, 32)
        : null;
    $miiName = isset($input['mii_name'])
        ? substr(trim((string) $input['mii_name']), 0, 32)
        : null;
    $miiData = wut_normalize_mii_data($input['mii_data'] ?? null);
    $miiImageUrl = null;

    if (!empty($input['mii_image_url'])) {
        $candidate = substr(trim((string) $input['mii_image_url']), 0, 2048);
        $scheme = strtolower((string) parse_url($candidate, PHP_URL_SCHEME));
        if (($scheme === 'http' || $scheme === 'https') && filter_var($candidate, FILTER_VALIDATE_URL)) {
            $miiImageUrl = $candidate;
        }
    }

    if (!$pid && !$userId && !$pnid && !$miiData && !$miiImageUrl) {
        return false;
    }

    $_SESSION['wut_identity'] = array(
        'resolved' => true,
        'authenticated' => $authenticated,
        'source' => substr($source, 0, 64),
        'network' => $network,
        'pid' => $pid,
        'persistent_id' => $persistentId,
        'user_id' => $userId ?: $pnid,
        'pnid' => $pnid ?: $userId,
        'mii_name' => $miiName,
        'mii_data' => $miiData,
        'mii_image_url' => $miiImageUrl,
    );

    return true;
}

function wut_identity_can_render(array $identity, array $config): bool
{
    if (empty($identity['resolved'])) {
        return false;
    }

    if (!empty($identity['authenticated'])) {
        return true;
    }

    return !empty($config['allow_browser_mii_link'])
        && ($identity['source'] ?? '') === 'browser-mii-link';
}


/*
 * WUT native identity capsule v1
 * --------------------------------
 * The capsule itself is never exposed to browser JavaScript.
 *
 * Binary layout before Base64URL encoding:
 *   0x00  4  magic "WUT1"
 *   0x04  1  flags
 *   0x05  1  reserved
 *   0x06  4  Principal ID, big-endian
 *   0x0A  4  Persistent ID, big-endian
 *   0x0E 17  Account ID, NUL padded
 *   0x1F 22  Mii name, 11 UTF-16BE code units
 *   0x35 96  FFLStoreData
 *
 * Total: 149 bytes.
 *
 * This bridge is intentionally a LOCAL-development trust boundary. The
 * mitmproxy edge removes the capsule from Nintendo/Pretendo-facing traffic and
 * adds X-WUT-Bridge-Key before forwarding it to Apache. A future public WUT
 * server should verify account ownership with a proper account-server flow
 * rather than trusting this local capsule as internet authentication.
 */
function wut_base64url_decode(string $value)
{
    $value = trim($value);
    if ($value === '' || strlen($value) > 256 || !preg_match('/^[A-Za-z0-9_-]+$/', $value)) {
        return false;
    }

    $base64 = strtr($value, '-_', '+/');
    $padding = strlen($base64) % 4;
    if ($padding !== 0) {
        $base64 .= str_repeat('=', 4 - $padding);
    }

    return base64_decode($base64, true);
}

function wut_utf16be_to_utf8(string $bytes): string
{
    if ($bytes === '') {
        return '';
    }

    /*
     * Trim trailing UTF-16 NUL code units without touching embedded data.
     */
    while (strlen($bytes) >= 2 && substr($bytes, -2) === "\x00\x00") {
        $bytes = substr($bytes, 0, -2);
    }

    if ($bytes === '') {
        return '';
    }

    $converted = false;

    if (function_exists('mb_convert_encoding')) {
        $converted = @mb_convert_encoding($bytes, 'UTF-8', 'UTF-16BE');
    } elseif (function_exists('iconv')) {
        $converted = @iconv('UTF-16BE', 'UTF-8//IGNORE', $bytes);
    }

    if (!is_string($converted)) {
        /*
         * Last-resort ASCII-compatible decoder. Mii names containing
         * non-ASCII characters simply fall back to an empty display name;
         * their raw FFLStoreData remains intact for rendering.
         */
        $converted = '';
        $length = strlen($bytes);
        for ($i = 0; $i + 1 < $length; $i += 2) {
            $code = (ord($bytes[$i]) << 8) | ord($bytes[$i + 1]);
            if ($code === 0) {
                break;
            }
            if ($code >= 0x20 && $code <= 0x7E) {
                $converted .= chr($code);
            }
        }
    }

    /*
     * Strip control characters and cap the UI-facing value.
     */
    $converted = preg_replace('/[\x00-\x1F\x7F]/u', '', $converted);
    return is_string($converted) ? substr(trim($converted), 0, 64) : '';
}

function wut_parse_native_identity_capsule(string $encoded): ?array
{
    $raw = wut_base64url_decode($encoded);
    if (!is_string($raw) || strlen($raw) !== 149) {
        return null;
    }

    if (substr($raw, 0, 4) !== 'WUT1') {
        return null;
    }

    $flags = ord($raw[4]);

    $pidPart = unpack('Nvalue', substr($raw, 6, 4));
    $persistentPart = unpack('Nvalue', substr($raw, 10, 4));
    $pid = is_array($pidPart) ? (int) ($pidPart['value'] ?? 0) : 0;
    $persistentId = is_array($persistentPart)
        ? (int) ($persistentPart['value'] ?? 0)
        : 0;

    if ($pid <= 0) {
        return null;
    }

    $accountId = '';
    if (($flags & 0x01) !== 0) {
        $accountId = rtrim(substr($raw, 14, 17), "\0");
        if (
            $accountId === ''
            || strlen($accountId) > 16
            || !preg_match('/^[A-Za-z0-9._-]+$/', $accountId)
        ) {
            return null;
        }
    }

    $miiName = '';
    if (($flags & 0x02) !== 0) {
        $miiName = wut_utf16be_to_utf8(substr($raw, 31, 22));
    }

    $miiData = null;
    if (($flags & 0x04) !== 0) {
        $miiRaw = substr($raw, 53, 96);
        if (strlen($miiRaw) !== 96 || $miiRaw === str_repeat("\0", 96)) {
            return null;
        }
        $miiData = base64_encode($miiRaw);
    }

    return array(
        'network' => 'pretendo',
        'pid' => (string) $pid,
        'persistent_id' => $persistentId > 0 ? (string) $persistentId : null,
        'user_id' => $accountId !== '' ? $accountId : null,
        'pnid' => $accountId !== '' ? $accountId : null,
        'mii_name' => $miiName !== '' ? $miiName : null,
        'mii_data' => $miiData,
    );
}

function wut_apply_native_identity_bridge(array $config): array
{
    $status = array(
        'present' => false,
        'accepted' => false,
        'version' => null,
        'mii_present' => false,
        'reason' => 'absent',
    );

    $capsule = wut_header('HTTP_X_WUT_NATIVEIDENTITY');
    if ($capsule === '') {
        return $status;
    }

    $status['present'] = true;

    if (empty($config['allow_native_identity_bridge'])) {
        $status['reason'] = 'disabled';
        return $status;
    }

    $configuredKey = trim((string) ($config['native_identity_bridge_key'] ?? ''));
    $receivedKey = wut_header('HTTP_X_WUT_BRIDGE_KEY');

    if (
        $configuredKey === ''
        || $receivedKey === ''
        || !hash_equals($configuredKey, $receivedKey)
    ) {
        $status['reason'] = 'bridge-key';
        return $status;
    }

    $identity = wut_parse_native_identity_capsule($capsule);
    if (!is_array($identity)) {
        $status['reason'] = 'invalid-capsule';
        return $status;
    }

    if (!wut_store_linked_identity($identity, 'wut-native-inkay', true)) {
        $status['reason'] = 'empty-identity';
        return $status;
    }

    $_SESSION['wut_native_identity_fingerprint'] = substr(hash('sha256', $capsule), 0, 20);

    $status['accepted'] = true;
    $status['version'] = 1;
    $status['mii_present'] = !empty($identity['mii_data']);
    $status['reason'] = 'ok';

    return $status;
}

function wut_apply_local_dev_identity(array $config): void
{
    if (empty($config['allow_local_dev_identity']) || !wut_is_local_request()) {
        return;
    }

    if (($_GET['wutdev'] ?? '') !== '1') {
        return;
    }

    wut_store_linked_identity(array(
        'network' => $_GET['network'] ?? 'pretendo',
        'pid' => $_GET['pid'] ?? null,
        'persistent_id' => $_GET['persistent_id'] ?? null,
        'user_id' => $_GET['user_id'] ?? null,
        'pnid' => $_GET['pnid'] ?? null,
        'mii_name' => $_GET['mii_name'] ?? null,
        'mii_data' => $_GET['mii_data'] ?? null,
        'mii_image_url' => $_GET['mii_image_url'] ?? null,
    ), 'local-dev-injection');
}
