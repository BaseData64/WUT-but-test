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
$account = $reconciledIdentity['account'];
$identity = wut_accounts_render_identity($reconciledIdentity['identity'], $account);

$settings = wut_mii_renderer_settings($config);
$source = wut_mii_lookup_source($identity);

wut_json(array(
    'ok' => true,
    'gateway' => array(
        'contract' => 'ariankordi-nwf-mii-cemu-toy',
        'endpoint' => '/miis/image.png',
        'configured' => !empty($settings['configured']),
        'wii_u_preset' => array(
            'shader_type' => 'wiiu',
            'resource_type' => 'middle',
            'view_type' => 'face',
            'scale' => $settings['scale'],
        ),
    ),
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
        'render_source' => $source,
        'renderable' => wut_identity_can_render($identity, $config),
        'persistent_account_mii' => !empty($identity['mii_account_bound']),
        'cache_key' => wut_mii_identity_cache_key($identity),
    ),
    'cache' => array(
        'enabled' => $settings['cache_ttl'] > 0,
        'ttl_seconds' => $settings['cache_ttl'],
        'stale_if_error_seconds' => $settings['stale_ttl'],
    ),
));
