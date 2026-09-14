<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require __DIR__ . '/_renderer.php';

wut_start_session();
$config = wut_config();
$settings = wut_mii_renderer_settings($config);
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Method not allowed.\n";
    exit;
}

if (empty($settings['configured'])) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "WUT Mii renderer is not configured.\n";
    exit;
}

$identity = wut_identity_from_session();

if (empty($identity['resolved']) || empty($identity['authenticated'])) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "WUT identity is not resolved yet.\n";
    exit;
}

$width = isset($_GET['width']) ? (int) $_GET['width'] : 96;
$type = wut_mii_allowed_type($_GET['type'] ?? 'face');
$expression = wut_mii_allowed_expression($_GET['expression'] ?? 'normal');
$query = wut_mii_render_query(
    $identity,
    $settings,
    $width,
    $type,
    $expression
);

if ($query === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Resolved WUT identity has no valid Mii render source.\n";
    exit;
}

/* The renderer can take seconds; do not hold the user's PHP session lock. */
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

$render = wut_mii_fetch_render($settings, $query);

if (empty($render['ok'])) {
    $upstreamStatus = (int) ($render['upstream_status'] ?? 0);
    http_response_code($upstreamStatus === 404 ? 404 : 502);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-WUT-Mii-Cache: ERROR');
    echo "WUT Mii renderer request failed.\n";
    exit;
}

$body = (string) $render['body'];
$modified = (int) $render['modified'];
$etag = '"' . hash('sha256', $body) . '"';

header('Content-Type: image/png');
header('Cache-Control: private, max-age=300');
header('Vary: Cookie');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $modified) . ' GMT');
header('X-Content-Type-Options: nosniff');
header('X-WUT-Mii-Cache: ' . (string) $render['cache']);

if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . strlen($body));
http_response_code(200);
if ($method !== 'HEAD') {
    echo $body;
}
