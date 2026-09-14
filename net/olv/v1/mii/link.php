<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require __DIR__ . '/_renderer.php';

function wut_mii_link_new_token(): string
{
    try {
        return bin2hex(random_bytes(24));
    } catch (Throwable $error) {
        return hash(
            'sha256',
            session_id() . '|' . microtime(true) . '|' . mt_rand()
        );
    }
}

function wut_mii_link_token(): string
{
    if (empty($_SESSION['wut_mii_link_csrf'])) {
        $_SESSION['wut_mii_link_csrf'] = wut_mii_link_new_token();
    }

    return (string) $_SESSION['wut_mii_link_csrf'];
}

function wut_mii_link_state(array $config, array $settings): array
{
    $identity = wut_identity_from_session();
    $source = wut_mii_lookup_source($identity);
    $renderable = wut_identity_can_render($identity, $config)
        && in_array($source, array('data', 'pid', 'pnid'), true);

    return array(
        'enabled' => !empty($config['allow_browser_mii_link']),
        'renderer_configured' => !empty($settings['configured']),
        'renderer_mode' => strpos((string) $settings['base'], 'mii-unsecure.ariankordi.net') !== false
            ? 'public-demo'
            : 'self-hosted',
        'linked' => !empty($identity['resolved']),
        'renderable' => $renderable,
        'authenticated' => !empty($identity['authenticated']),
        'network' => $identity['network'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'source' => $identity['source'] ?? 'none',
        'cache_key' => wut_mii_identity_cache_key($identity),
    );
}

wut_start_session();

$config = wut_config();
$settings = wut_mii_renderer_settings($config);
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    wut_json(array(
        'ok' => true,
        'csrf_token' => wut_mii_link_token(),
        'link' => wut_mii_link_state($config, $settings),
    ));
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

if (!empty($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 4096) {
    wut_json(array('ok' => false, 'error' => 'request_too_large'), 413);
}

if (empty($config['allow_browser_mii_link'])) {
    wut_json(array('ok' => false, 'error' => 'browser_link_disabled'), 403);
}

$postedToken = isset($_POST['csrf_token']) ? (string) $_POST['csrf_token'] : '';
$sessionToken = wut_mii_link_token();

if ($postedToken === '' || !hash_equals($sessionToken, $postedToken)) {
    wut_json(array('ok' => false, 'error' => 'invalid_session_token'), 403);
}

if (empty($settings['configured'])) {
    wut_json(array('ok' => false, 'error' => 'renderer_not_configured'), 503);
}

$network = strtolower(trim((string) ($_POST['network'] ?? 'pretendo')));
if (!in_array($network, array('pretendo', 'nintendo'), true)) {
    wut_json(array('ok' => false, 'error' => 'invalid_network'), 400);
}

$pnid = trim((string) ($_POST['pnid'] ?? ''));
if (!preg_match('/^[A-Za-z0-9._-]{1,32}\z/', $pnid)) {
    wut_json(array('ok' => false, 'error' => 'invalid_pnid'), 400);
}

$miiName = trim((string) ($_POST['mii_name'] ?? ''));
if ($miiName === '') {
    $miiName = $pnid;
}
$miiName = substr($miiName, 0, 32);

$candidate = array(
    'resolved' => true,
    'authenticated' => false,
    'source' => 'browser-mii-link',
    'network' => $network,
    'pid' => null,
    'user_id' => $pnid,
    'pnid' => $pnid,
    'mii_name' => $miiName,
    'mii_data' => null,
    'mii_image_url' => null,
);

$query = wut_mii_render_query($candidate, $settings, 160, 'face', 'normal');
if ($query === null) {
    wut_json(array('ok' => false, 'error' => 'invalid_mii_source'), 400);
}

/*
 * Test and cache the exact Mii before committing the browser session. This
 * keeps a typo from replacing an already working Mii with a broken identity.
 */
$render = wut_mii_fetch_render($settings, $query);
if (empty($render['ok'])) {
    $upstreamStatus = (int) ($render['upstream_status'] ?? 0);
    wut_json(array(
        'ok' => false,
        'error' => $upstreamStatus === 404 ? 'mii_not_found' : 'renderer_unavailable',
        'upstream_status' => $upstreamStatus,
    ), $upstreamStatus === 404 ? 404 : 502);
}

$stored = wut_store_linked_identity(array(
    'network' => $network,
    'user_id' => $pnid,
    'pnid' => $pnid,
    'mii_name' => $miiName,
), 'browser-mii-link', false);

if (!$stored) {
    wut_json(array('ok' => false, 'error' => 'link_store_failed'), 500);
}

$_SESSION['wut_mii_link_csrf'] = wut_mii_link_new_token();

wut_json(array(
    'ok' => true,
    'csrf_token' => (string) $_SESSION['wut_mii_link_csrf'],
    'link' => wut_mii_link_state($config, $settings),
    'image_url' => 'render.php?width=160&type=face&v='
        . rawurlencode((string) wut_mii_identity_cache_key(wut_identity_from_session())),
));
