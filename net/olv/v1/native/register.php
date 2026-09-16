<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

$config = wut_config();

function native_fail(string $error, int $status): never
{
    wut_json(array('ok' => false, 'error' => $error), $status);
}

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    header('Allow: POST');
    native_fail('method_not_allowed', 405);
}

if (empty($config['native_identity_enabled'])) {
    native_fail('native_identity_disabled', 403);
}

if (!empty($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 4096) {
    native_fail('request_too_large', 413);
}

$raw = file_get_contents('php://input');
$data = is_string($raw) ? json_decode($raw, true) : null;

if (!is_array($data)) {
    native_fail('invalid_json', 400);
}

$expectedSecret = (string) ($config['native_identity_secret'] ?? '');
$providedSecret = (string) ($data['secret'] ?? '');

if (
    $expectedSecret === '' ||
    $providedSecret === '' ||
    !hash_equals($expectedSecret, $providedSecret)
) {
    native_fail('bridge_auth_failed', 403);
}

$accountId = trim((string) ($data['account_id'] ?? ''));
$slot = isset($data['slot']) ? (int) $data['slot'] : -1;
$pid = (string) ($data['pid'] ?? '');
$persistentId = (string) ($data['persistent_id'] ?? '');
$miiData = wut_normalize_mii_data($data['mii_data'] ?? null);

if (!preg_match('/^[A-Za-z0-9._-]{1,32}\z/', $accountId)) {
    native_fail('invalid_account_id', 400);
}
if ($slot < 0 || $slot > 15) {
    native_fail('invalid_slot', 400);
}
if (!ctype_digit($pid) || (int) $pid <= 0) {
    native_fail('invalid_pid', 400);
}
if (!ctype_digit($persistentId)) {
    native_fail('invalid_persistent_id', 400);
}
if ($miiData === null) {
    native_fail('invalid_mii_data', 400);
}

$state = array(
    'version' => 2,
    'source' => 'wiiu-native-act',
    'slot' => $slot,
    'account_id' => $accountId,
    'pid' => $pid,
    'persistent_id' => $persistentId,
    'mii_data' => $miiData,
    'received_at' => time(),
);

$path = wut_native_identity_state_path($config);
$dir = dirname($path);

if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
    native_fail('state_directory_failed', 500);
}

$json = json_encode($state, JSON_UNESCAPED_SLASHES);
if (!is_string($json)) {
    native_fail('state_encode_failed', 500);
}

$tmp = $path . '.tmp';
if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
    native_fail('state_write_failed', 500);
}

if (!@rename($tmp, $path)) {
    @unlink($path);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        native_fail('state_publish_failed', 500);
    }
}

wut_json(array(
    'ok' => true,
    'slot' => $slot,
    'account_id' => $accountId,
    'pid' => $pid,
    'persistent_id' => $persistentId,
    'mii_bytes' => 96,
    'received_at' => $state['received_at'],
));
