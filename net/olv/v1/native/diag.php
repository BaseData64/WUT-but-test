<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

$config = wut_config();

function diag_fail(string $error, int $status): never
{
    wut_json(array('ok' => false, 'error' => $error), $status);
}

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    header('Allow: POST');
    diag_fail('method_not_allowed', 405);
}

if (empty($config['native_identity_enabled'])) {
    diag_fail('native_identity_disabled', 403);
}

$raw = file_get_contents('php://input');
$data = is_string($raw) ? json_decode($raw, true) : null;

if (!is_array($data)) {
    diag_fail('invalid_json', 400);
}

$expectedSecret = (string) ($config['native_identity_secret'] ?? '');
$providedSecret = (string) ($data['secret'] ?? '');

if (
    $expectedSecret === '' ||
    $providedSecret === '' ||
    !hash_equals($expectedSecret, $providedSecret)
) {
    diag_fail('bridge_auth_failed', 403);
}

$stage = trim((string) ($data['stage'] ?? ''));
if (!preg_match('/^[a-z0-9_-]{1,64}\z/', $stage)) {
    diag_fail('invalid_stage', 400);
}

$attempt = isset($data['attempt']) ? (int) $data['attempt'] : 0;
$titleId = substr(trim((string) ($data['title_id'] ?? '')), 0, 32);
$bridgeVersion = substr(trim((string) ($data['bridge_version'] ?? '')), 0, 64);

$dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR);
$path = $dir . DIRECTORY_SEPARATOR . 'wut-native-diagnostic.json';

$history = array();
if (is_file($path)) {
    $existing = @file_get_contents($path);
    $decoded = is_string($existing) ? json_decode($existing, true) : null;
    if (is_array($decoded) && isset($decoded['history']) && is_array($decoded['history'])) {
        $history = $decoded['history'];
    }
}

$entry = array(
    'stage' => $stage,
    'attempt' => $attempt,
    'title_id' => $titleId,
    'bridge_version' => $bridgeVersion,
    'received_at' => time(),
    'remote_addr' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
);

$history[] = $entry;
if (count($history) > 50) {
    $history = array_slice($history, -50);
}

$state = array(
    'ok' => true,
    'last' => $entry,
    'history' => $history,
);

$json = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if (!is_string($json) || @file_put_contents($path, $json, LOCK_EX) === false) {
    diag_fail('diag_write_failed', 500);
}

wut_json(array(
    'ok' => true,
    'stage' => $stage,
    'attempt' => $attempt,
    'received_at' => $entry['received_at'],
));
