<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';
require __DIR__ . '/mii/_renderer.php';

wut_start_session();
$config = wut_config();

/*
 * These are the two headers sent by the Wii U Miiverse applet to its portal.
 * We only detect them here. WUT does NOT claim to decrypt/verify the service
 * token yet, and the raw token is never returned to browser JavaScript.
 */
$serviceToken = wut_header('HTTP_X_NINTENDO_SERVICETOKEN');
$paramPack = wut_header('HTTP_X_NINTENDO_PARAMPACK');
$userAgent = wut_header('HTTP_USER_AGENT');
$miiverseUA = stripos($userAgent, 'Nintendo WiiU') !== false || stripos($userAgent, 'miiverse') !== false;

if ($serviceToken !== '') {
    $_SESSION['wut_console_token_fingerprint'] = hash('sha256', $serviceToken);
}

/*
 * If the local proxy received WUT's native identity suffix from Inkay, this
 * resolves PID/PNID/Mii StoreData into the PHP session before the browser sees
 * the bootstrap response. The raw capsule is never returned to JavaScript.
 */
$nativeBridge = wut_apply_native_identity_bridge($config);

wut_apply_local_dev_identity($config);

$identity = wut_identity_from_session();
$publicIdentity = wut_public_identity($identity);
$rendererSettings = wut_mii_renderer_settings($config);
$miiSource = wut_mii_lookup_source($identity);
$miiCanRender = wut_identity_can_render($identity, $config)
    && in_array($miiSource, array('data', 'pid', 'pnid'), true);
$profile = $_SESSION['wut_profile'] ?? array();

wut_json(array(
    'ok' => true,
    'console' => array(
        'detected' => $miiverseUA || $serviceToken !== '' || $paramPack !== '',
        'miiverse_user_agent' => $miiverseUA,
        'service_token_present' => $serviceToken !== '',
        'param_pack_present' => $paramPack !== '',
        'native_identity_present' => !empty($nativeBridge['present']),
        'native_identity_accepted' => !empty($nativeBridge['accepted']),
        'native_identity_version' => $nativeBridge['version'] ?? null,
        'native_mii_present' => !empty($nativeBridge['mii_present']),
        'service_token_fingerprint' => isset($_SESSION['wut_console_token_fingerprint'])
            ? substr((string) $_SESSION['wut_console_token_fingerprint'], 0, 16)
            : null,
    ),
    'identity' => $publicIdentity,
    'profile' => array(
        'game_skill' => isset($profile['game_skill']) ? (int) $profile['game_skill'] : null,
        'setup_complete' => !empty($profile['setup_complete']),
    ),
    'mii' => array(
        'renderer_configured' => !empty($rendererSettings['configured']),
        'render_source' => $miiSource,
        'renderable' => $miiCanRender,
        'cache_key' => wut_mii_identity_cache_key($identity),
        'proxy_url' => '../../net/olv/v1/mii/render.php',
        'status_url' => '../../net/olv/v1/mii/status.php',
        'link_url' => 'mii-link.html',
    ),
));
