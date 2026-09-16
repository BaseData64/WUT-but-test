<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/_common.php';

$config = wut_config();

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    header('Allow: POST');
    wut_json(array(
        'ok' => false,
        'error' => 'method_not_allowed',
    ), 405);
}

if (!wut_is_private_lan_request()) {
    wut_json(array(
        'ok' => false,
        'error' => 'lan_only',
    ), 403);
}

if (wut_header('HTTP_X_WUT_LOCAL_RESOLVER') !== 'inkay-aist-v1') {
    wut_json(array(
        'ok' => false,
        'error' => 'resolver_marker_missing',
    ), 403);
}

$tokenSha = strtolower(trim((string) ($_POST['token_sha256'] ?? '')));
$pid = trim((string) ($_POST['pid'] ?? ''));
$persistentId = trim((string) ($_POST['persistent_id'] ?? ''));
$slotRaw = trim((string) ($_POST['slot'] ?? ''));
$miiData = trim((string) ($_POST['mii_data'] ?? ''));

if (!ctype_digit($slotRaw)) {
    wut_json(array(
        'ok' => false,
        'error' => 'invalid_slot',
    ), 400);
}

$slot = (int) $slotRaw;

if (!wut_local_resolver_store_binding(
    $config,
    $tokenSha,
    $pid,
    $persistentId,
    $slot,
    $miiData
)) {
    wut_json(array(
        'ok' => false,
        'error' => 'invalid_or_unstorable_binding',
    ), 400);
}

wut_json(array(
    'ok' => true,
    'bound' => true,
    'source' => 'wut-inkay-aist-v1',
    'token_sha256_prefix' => substr($tokenSha, 0, 16),
    'pid' => $pid,
    'slot' => $slot,
    'mii_data_present' => true,
    /*
     * Deliberately false: this is console correlation, not Pretendo's
     * server-side independent-service-token exchange.
     */
    'pretendo_verified' => false,
));
