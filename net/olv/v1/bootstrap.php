<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

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

wut_apply_local_dev_identity($config);

$identity = wut_identity_from_session();
$profile = $_SESSION['wut_profile'] ?? array();

wut_json(array(
    'ok' => true,
    'console' => array(
        'detected' => $miiverseUA || $serviceToken !== '' || $paramPack !== '',
        'miiverse_user_agent' => $miiverseUA,
        'service_token_present' => $serviceToken !== '',
        'param_pack_present' => $paramPack !== '',
        'service_token_fingerprint' => isset($_SESSION['wut_console_token_fingerprint'])
            ? substr((string) $_SESSION['wut_console_token_fingerprint'], 0, 16)
            : null,
    ),
    'identity' => $identity,
    'profile' => array(
        'game_skill' => isset($profile['game_skill']) ? (int) $profile['game_skill'] : null,
        'setup_complete' => !empty($profile['setup_complete']),
    ),
    'mii' => array(
        'renderer_configured' => trim((string) ($config['mii_renderer_base'] ?? '')) !== '',
        'proxy_url' => '../../net/olv/v1/mii/render.php',
    ),
));
