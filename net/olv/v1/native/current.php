<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/config.php';

$stateFile = (string)$config['state_file'];
$miiFile = (string)$config['mii_file'];

if (!is_file($stateFile) || !is_file($miiFile)) {
    echo json_encode([
        'ok' => false,
        'reason' => 'no_native_identity',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$raw = file_get_contents($stateFile);
$state = is_string($raw) ? json_decode($raw, true) : null;

if (!is_array($state)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'reason' => 'invalid_native_state',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$miiSize = filesize($miiFile);
if ($miiSize !== 96) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'reason' => 'invalid_native_mii',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$receivedAt = (int)($state['received_at'] ?? 0);
$age = max(0, time() - $receivedAt);
$fresh = $receivedAt > 0 && $age <= (int)$config['max_age_seconds'];

// Use the WUT project absolute path. This works both directly through XAMPP
// and through wut_portal_proxy.py, which already allows /WUT-miiverse/*.
$miiUrl = '/WUT-miiverse/net/olv/v1/native/mii.php?width=128&v=' . $receivedAt;

echo json_encode([
    'ok' => true,
    'source' => 'wiiu-native',
    'account_id' => (string)($state['account_id'] ?? ''),
    'pid' => (int)($state['pid'] ?? 0),
    'persistent_id' => (int)($state['persistent_id'] ?? 0),
    'mii_bytes' => 96,
    'mii_sha256' => (string)($state['mii_sha256'] ?? ''),
    'received_at' => $receivedAt,
    'age_seconds' => $age,
    'fresh' => $fresh,
    'mii_url' => $miiUrl,
], JSON_UNESCAPED_SLASHES);
