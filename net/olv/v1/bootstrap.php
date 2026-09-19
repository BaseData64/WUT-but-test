<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';
require __DIR__ . '/mii/_renderer.php';
require __DIR__ . '/account/_common.php';

wut_start_session();
$config = wut_config();

/*
 * ServiceToken/ParamPack probe.
 *
 * The upgraded proxy captures the credential on the real applet request,
 * stores only SHA-256 + length in memory, strips the raw Nintendo auth
 * headers before forwarding to Apache, and injects safe derived headers.
 *
 * The fallback in _common.php still supports the previous proxy, but it
 * also stores only the digest/length.
 */
$authProbe = wut_auth_probe_capture_from_request();
if ($authProbe === null) {
    $authProbe = wut_auth_probe_read();
}

$userAgent = wut_header('HTTP_USER_AGENT');
$miiverseUA = stripos($userAgent, 'Nintendo WiiU') !== false
    || stripos($userAgent, 'miiverse') !== false;

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
$publicIdentity = wut_public_identity($identity);

/*
 * First Run presentation helper only.
 * Decode the Mii display name from the current account's FFLStoreData without
 * changing/storing identity state. The multi-user session logic above remains
 * exactly the known-good Backup 9 flow.
 */
if (empty($publicIdentity['mii_name']) && !empty($identity['mii_data'])) {
    $wutRawMii = null;
    $wutMiiValue = preg_replace('/\s+/', '', trim((string) $identity['mii_data']));

    if (is_string($wutMiiValue) && $wutMiiValue !== '') {
        if ((strlen($wutMiiValue) % 2) === 0 && ctype_xdigit($wutMiiValue)) {
            $wutDecoded = hex2bin($wutMiiValue);
            if (is_string($wutDecoded)) {
                $wutRawMii = $wutDecoded;
            }
        } elseif (preg_match('/^[A-Za-z0-9+\/_=-]+$/', $wutMiiValue)) {
            $wutB64 = strtr($wutMiiValue, '-_', '+/');
            $wutPad = strlen($wutB64) % 4;
            if ($wutPad !== 0) {
                $wutB64 .= str_repeat('=', 4 - $wutPad);
            }
            $wutDecoded = base64_decode($wutB64, true);
            if (is_string($wutDecoded)) {
                $wutRawMii = $wutDecoded;
            }
        }
    }

    if (is_string($wutRawMii) && strlen($wutRawMii) >= 0x1A + 20) {
        /* Wii U/3DS FFLStoreData: Mii name = 10 UTF-16LE code units at 0x1A. */
        $wutNameField = substr($wutRawMii, 0x1A, 20);
        $wutNameBytes = '';

        for ($wutI = 0; $wutI < 20; $wutI += 2) {
            $wutPair = substr($wutNameField, $wutI, 2);
            if (strlen($wutPair) < 2 || $wutPair === "\x00\x00") {
                break;
            }
            $wutNameBytes .= $wutPair;
        }

        $wutMiiName = '';
        if ($wutNameBytes !== '') {
            if (function_exists('mb_convert_encoding')) {
                $wutMiiName = (string) @mb_convert_encoding(
                    $wutNameBytes,
                    'UTF-8',
                    'UTF-16LE'
                );
            } elseif (function_exists('iconv')) {
                $wutConverted = @iconv('UTF-16LE', 'UTF-8//IGNORE', $wutNameBytes);
                if (is_string($wutConverted)) {
                    $wutMiiName = $wutConverted;
                }
            }
        }

        $wutMiiName = trim($wutMiiName);
        if ($wutMiiName !== '') {
            $publicIdentity['mii_name'] = substr($wutMiiName, 0, 32);
        }
    }
}
$rendererSettings = wut_mii_renderer_settings($config);
$miiSource = wut_mii_lookup_source($identity);
$profile = $_SESSION['wut_profile'] ?? array();

/* A WUT account is the persistent source of First Run completion. This makes
 * setup one-time per resolved Wii U identity instead of one-time per browser
 * localStorage/PHP session. */
if ($account !== null) {
    $profile = array(
        'game_skill' => isset($account['game_skill']) ? (int) $account['game_skill'] : null,
        'setup_complete' => !empty($account['setup_complete']),
        'updated_at' => (int) ($account['updated_at'] ?? time()),
    );
    $_SESSION['wut_profile'] = $profile;
}

$authPhase = wut_auth_phase($authProbe, $identity);

wut_json(array(
    'ok' => true,
    'console' => array(
        'detected' => $miiverseUA || $authProbe !== null,
        'miiverse_user_agent' => $miiverseUA,
        'service_token_present' => $authProbe !== null
            && !empty($authProbe['service_token_present']),
        'param_pack_present' => $authProbe !== null
            && !empty($authProbe['param_pack_present']),
        'native_identity_present' => false,
        'legacy_native_identity_allowed' => false,
        'service_token_fingerprint' => $authProbe !== null
            ? substr((string) ($authProbe['service_token_sha256'] ?? ''), 0, 16)
            : null,
        'service_token_verified' => false,
        'auth_probe_source' => $authProbe !== null
            ? (string) ($authProbe['source'] ?? 'unknown')
            : null,
    ),
    'auth' => array(
        'phase' => $authPhase,
        'service_token_observed' => $authProbe !== null
            && !empty($authProbe['service_token_present']),
        'service_token_verified' => wut_identity_is_pretendo_token_verified($identity),
        'local_resolver_bound' => wut_identity_is_local_token_bound($identity),
        'resolver' => wut_identity_is_local_token_bound($identity)
            ? 'wut-local-servicetoken'
            : 'pretendo-independent-service-token',
        'resolver_ready' => !empty($identity['resolved']),
        'production_ready' => wut_identity_is_pretendo_token_verified($identity),
        'note' => $authPhase === 'local-resolver-bound'
            ? 'Local console correlation active. Mii can render; Pretendo server-side token verification is still pending for production.'
            : ($authPhase === 'servicetoken-unresolved'
                ? 'Native Miiverse credential observed. Waiting for a matching resolver binding.'
                : null),
    ),
    'identity' => $publicIdentity,
    'account' => $account !== null ? wut_accounts_public($account) : null,
    'profile' => array(
        'game_skill' => isset($profile['game_skill']) ? (int) $profile['game_skill'] : null,
        'setup_complete' => !empty($profile['setup_complete']),
    ),
    'mii' => array(
        'renderer_configured' => !empty($rendererSettings['configured']),
        'render_source' => $miiSource,
        'renderable' => wut_identity_can_render($identity, $config),
        'persistent_account_mii' => !empty($identity['mii_account_bound']),
        'cache_key' => wut_mii_identity_cache_key($identity),
        'proxy_url' => '../../net/olv/v1/mii/render.php',
        'status_url' => '../../net/olv/v1/mii/status.php',
    ),
));
