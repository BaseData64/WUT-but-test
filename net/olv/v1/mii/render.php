<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

wut_start_session();
$config = wut_config();
$rendererBase = rtrim(trim((string) ($config['mii_renderer_base'] ?? '')), '/');

if ($rendererBase === '') {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "WUT Mii renderer is not configured.\n";
    exit;
}

$identity = wut_identity_from_session();

if (empty($identity['resolved'])) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo "WUT identity is not resolved yet.\n";
    exit;
}

$width = isset($_GET['width']) ? (int) $_GET['width'] : 96;
if ($width < 48) {
    $width = 48;
}
if ($width > 512) {
    $width = 512;
}

$allowedTypes = array(
    'face',
    'face_only',
    'all_body',
    'fflmakeicon',
    'ffliconwithbody',
    'variableiconbody',
    'all_body_sugar',
);
$type = isset($_GET['type']) && in_array((string) $_GET['type'], $allowedTypes, true)
    ? (string) $_GET['type']
    : 'face';

$query = array(
    'width' => $width,
    'type' => $type,
);

if (!empty($identity['mii_data'])) {
    $query['data'] = (string) $identity['mii_data'];
} elseif (!empty($identity['pid'])) {
    $query['pid'] = (string) $identity['pid'];
    if (($identity['network'] ?? '') === 'pretendo') {
        $query['api_id'] = 1;
    }
} elseif (!empty($identity['pnid'])) {
    $query['nnid'] = (string) $identity['pnid'];
    $query['api_id'] = (($identity['network'] ?? '') === 'pretendo') ? 1 : 0;
} else {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Resolved WUT identity has no Mii lookup key.\n";
    exit;
}

$upstream = $rendererBase . '/miis/image.png?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
$body = false;
$contentType = 'image/png';
$status = 502;

if (function_exists('curl_init')) {
    $ch = curl_init($upstream);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $reportedType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    if (is_string($reportedType) && $reportedType !== '') {
        $contentType = $reportedType;
    }
    curl_close($ch);
} else {
    $context = stream_context_create(array(
        'http' => array(
            'timeout' => 12,
            'ignore_errors' => true,
            'protocol_version' => 1.1,
        ),
    ));
    $body = @file_get_contents($upstream, false, $context);
    $status = $body === false ? 502 : 200;
}

if ($body === false || $status < 200 || $status >= 300) {
    http_response_code($status >= 400 ? $status : 502);
    header('Content-Type: text/plain; charset=utf-8');
    echo "WUT Mii renderer request failed.\n";
    exit;
}

http_response_code(200);
header('Content-Type: ' . $contentType);
header('Cache-Control: private, max-age=300');
echo $body;
