<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

wut_start_session();
$config = wut_config();

$probe = wut_auth_probe_read();
wut_auth_cutover_enforce($probe);
wut_apply_local_servicetoken_resolver($probe, $config);

$identity = wut_identity_from_session();
$phase = wut_auth_phase($probe, $identity);

$localBound = wut_identity_is_local_token_bound($identity);
$pretendoVerified = wut_identity_is_pretendo_token_verified($identity);

wut_json(array(
    'ok' => true,
    'auth' => array(
        'phase' => $phase,
        'service_token_observed' => $probe !== null
            && !empty($probe['service_token_present']),
        'service_token_verified' => $pretendoVerified,
        'local_resolver_bound' => $localBound,
        'resolver' => $localBound
            ? 'wut-local-servicetoken'
            : 'pretendo-independent-service-token',
        'identity_source' => $identity['source'] ?? 'none',
        'identity_resolved' => !empty($identity['resolved']),
        'identity_authenticated' => !empty($identity['authenticated']),
        'auth_assurance' => $identity['auth_assurance'] ?? null,
        'legacy_native_identity_allowed' => false,
        'production_ready' => $pretendoVerified,
    ),
    'identity' => array(
        'pid' => $identity['pid'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_data_present' => !empty($identity['mii_data']),
    ),
    'probe' => wut_auth_probe_public($probe),
    'next' => $localBound
        ? 'Local token-to-console binding matched. Auto-Mii is enabled for development. Replace this adapter with authorized Pretendo token exchange before production.'
        : ($phase === 'servicetoken-unresolved'
            ? 'Open Miiverse with WUT-Inkay V1 installed so the on-console token hash can be bound to PID/Mii.'
            : ($pretendoVerified
                ? 'Production identity ready.'
                : 'Open Miiverse from the real Wii U icon to present a ServiceToken.')),
));
