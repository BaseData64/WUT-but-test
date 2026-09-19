<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';
require dirname(__DIR__) . '/mii/_renderer.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Method not allowed.\n";
    exit;
}

$postId = wut_posts_text($_GET['post_id'] ?? '', 80);
$post = $postId !== '' ? wut_posts_find_by_id($postId) : null;
if ($post === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Post not found.\n";
    exit;
}

$account = wut_posts_author_account($post);
if ($account === null || empty($account['setup_complete']) || empty($account['mii_data'])) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Post author has no persistent Mii.\n";
    exit;
}

$config = wut_config();
$settings = wut_mii_renderer_settings($config);
if (empty($settings['configured'])) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "WUT Mii renderer is not configured.\n";
    exit;
}

/* IMPORTANT: this identity is built from the POST AUTHOR'S persistent WUT
 * account, never from the viewer/current Wii U session. Switching users on
 * the console therefore cannot change or erase old post avatars. */
$identity = array(
    'resolved' => true,
    'authenticated' => true,
    'source' => 'wut-post-account',
    'network' => (string) ($account['network'] ?? 'wut'),
    'account_id' => $account['account_id'] ?? null,
    'pid' => $account['pid'] ?? null,
    'pnid' => $account['pnid'] ?? null,
    'mii_name' => $account['mii_name'] ?? ($account['display_name'] ?? null),
    'mii_data' => (string) $account['mii_data'],
);

$width = isset($_GET['width']) ? (int) $_GET['width'] : 96;
$type = wut_mii_allowed_type($_GET['type'] ?? 'face');
$expression = wut_mii_allowed_expression($_GET['expression'] ?? 'normal');
$query = wut_mii_render_query($identity, $settings, $width, $type, $expression);
if ($query === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Persistent post Mii is invalid.\n";
    exit;
}

$render = wut_mii_fetch_render($settings, $query);
if (empty($render['ok'])) {
    $upstreamStatus = (int) ($render['upstream_status'] ?? 0);
    http_response_code($upstreamStatus === 404 ? 404 : 502);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-WUT-Mii-Cache: ERROR');
    echo "WUT post Mii render failed.\n";
    exit;
}

$body = (string) $render['body'];
$modified = (int) $render['modified'];
$etag = '"' . hash('sha256', $body) . '"';

header('Content-Type: image/png');
header('Cache-Control: public, max-age=300');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $modified) . ' GMT');
header('X-Content-Type-Options: nosniff');
header('X-WUT-Mii-Cache: ' . (string) $render['cache']);
header('X-WUT-Mii-Source: post-author-account');
header('X-WUT-Post-Author-Persistence: wut-account');

if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . strlen($body));
http_response_code(200);
if ($method !== 'HEAD') {
    echo $body;
}
