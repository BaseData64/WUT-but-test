<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require __DIR__ . '/_renderer.php';
require dirname(__DIR__) . '/account/_common.php';

wut_start_session();
$config = wut_config();
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

$reconciledIdentity = wut_accounts_reconcile_current_identity();
$identity = $reconciledIdentity['identity'];

$settings = wut_mii_renderer_settings($config);
$source = wut_mii_lookup_source($identity);
$query = null;
$render = null;

if (!empty($settings['configured']) && wut_identity_can_render($identity, $config)) {
    $query = wut_mii_render_query($identity, $settings, 128, 'face', 'normal');
    if (is_array($query)) {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $render = wut_mii_fetch_render($settings, $query);
    }
}

wut_json(array(
    'ok' => true,
    'auth' => array(
        'phase' => wut_auth_phase($authProbe, $identity),
        'service_token_observed' => $authProbe !== null
            && !empty($authProbe['service_token_present']),
        'service_token_verified' => wut_identity_is_pretendo_token_verified($identity),
        'local_resolver_bound' => wut_identity_is_local_token_bound($identity),
        'auth_assurance' => $identity['auth_assurance'] ?? null,
        'legacy_native_identity_allowed' => false,
        'production_ready' => wut_identity_is_pretendo_token_verified($identity),
    ),
    'identity' => array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'account_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'mii_data_present' => !empty($identity['mii_data']),
        'render_source' => $source,
    ),
    'renderer' => array(
        'configured' => !empty($settings['configured']),
        'base' => $settings['base'],
        'query_ready' => is_array($query),
        'uses_mii_data' => is_array($query) && isset($query['data']),
        'width' => is_array($query) ? ($query['width'] ?? null) : null,
        'type' => is_array($query) ? ($query['type'] ?? null) : null,
        'shader_type' => is_array($query) ? ($query['shaderType'] ?? null) : null,
        'resource_type' => is_array($query) ? ($query['resourceType'] ?? null) : null,
    ),
    'render_test' => is_array($render) ? array(
        'ok' => !empty($render['ok']),
        'cache' => $render['cache'] ?? null,
        'upstream_status' => $render['upstream_status'] ?? 0,
        'upstream_error' => $render['upstream_error'] ?? '',
    ) : null,
));
