<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require __DIR__ . '/_renderer.php';

wut_start_session();
$config = wut_config();

/*
 * Auth Cutover V2:
 * Never hydrate Mii identity from the retired native ACT bridge.
 * A ServiceToken fingerprint is not identity; only a future verified
 * pretendo-servicetoken session may render automatically.
 */
$authProbe = wut_auth_probe_read();
wut_auth_cutover_enforce($authProbe);
wut_apply_local_servicetoken_resolver($authProbe, $config);

/* Local Wii U development fallback: use fresh nn::act identity when
 * no ServiceToken binding has resolved this request yet. */
$nativeSessionIdentity = wut_identity_from_session();
$nativeSessionSource = (string) ($nativeSessionIdentity['source'] ?? 'none');

/*
 * Keep a native ACT-backed session synchronized with the account that is
 * currently active on the Wii U. The bridge continuously updates the native
 * state file when slot/PID/Mii changes; without this refresh PHP would keep
 * the first resolved identity in WUTSESSID indefinitely.
 *
 * Do not overwrite stronger identities resolved by the ServiceToken path.
 */
if (
    empty($nativeSessionIdentity['resolved']) ||
    $nativeSessionSource === 'wiiu-native-act' ||
    $nativeSessionSource === 'native-act'
) {
    wut_apply_native_identity($config);
}
wut_apply_local_dev_identity($config);

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

if (!wut_identity_can_render($identity, $config)) {
    http_response_code(401);
    header('X-WUT-Auth-Phase: ' . wut_auth_phase($authProbe, $identity));
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
    header('X-WUT-Mii-Upstream-Status: ' . (string) $upstreamStatus);
    if (!empty($render['upstream_error'])) {
        header('X-WUT-Mii-Upstream-Error: ' . preg_replace('/[^A-Za-z0-9._-]/', '-', (string) $render['upstream_error']));
    }
    echo "WUT Mii renderer request failed.
";
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
header('X-WUT-Mii-Source: ' . wut_mii_lookup_source($identity));
header('X-WUT-Identity-Source: ' . (string) ($identity['source'] ?? 'none'));

if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . strlen($body));
http_response_code(200);
if ($method !== 'HEAD') {
    echo $body;
}
