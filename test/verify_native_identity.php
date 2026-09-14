<?php

declare(strict_types=1);

require dirname(__DIR__) . '/net/olv/v1/_common.php';

function fail_native_test(string $message): void
{
    fwrite(STDERR, "Native identity test failed: {$message}\n");
    exit(1);
}

function b64url_no_pad(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

$pid = 123456789;
$persistentId = 0x12345678;
$accountId = "TestPNID";
$name = "Makii";

$raw = "WUT1";
$raw .= chr(0x01 | 0x02 | 0x04);
$raw .= "\x00";
$raw .= pack('N', $pid);
$raw .= pack('N', $persistentId);
$raw .= str_pad($accountId, 17, "\0");

$nameBytes = '';
for ($i = 0; $i < 11; ++$i) {
    $code = $i < strlen($name) ? ord($name[$i]) : 0;
    $nameBytes .= pack('n', $code);
}
$raw .= $nameBytes;

$miiRaw = '';
for ($i = 0; $i < 96; ++$i) {
    $miiRaw .= chr(($i * 7 + 3) & 0xFF);
}
$raw .= $miiRaw;

if (strlen($raw) !== 149) {
    fail_native_test('fixture must be exactly 149 bytes');
}

$encoded = b64url_no_pad($raw);
$identity = wut_parse_native_identity_capsule($encoded);

if (!is_array($identity)) {
    fail_native_test('valid capsule was rejected');
}

if (($identity['pid'] ?? null) !== (string) $pid) {
    fail_native_test('PID mismatch');
}

if (($identity['persistent_id'] ?? null) !== (string) $persistentId) {
    fail_native_test('Persistent ID mismatch');
}

if (($identity['pnid'] ?? null) !== $accountId) {
    fail_native_test('Account ID / PNID mismatch');
}

if (($identity['mii_name'] ?? null) !== $name) {
    fail_native_test('Mii name mismatch');
}

$decodedMii = base64_decode((string) ($identity['mii_data'] ?? ''), true);
if (!is_string($decodedMii) || $decodedMii !== $miiRaw) {
    fail_native_test('FFLStoreData mismatch');
}

if (wut_parse_native_identity_capsule(substr($encoded, 0, -1)) !== null) {
    fail_native_test('truncated capsule should be rejected');
}

$badMagic = $raw;
$badMagic[0] = 'X';
if (wut_parse_native_identity_capsule(b64url_no_pad($badMagic)) !== null) {
    fail_native_test('bad magic should be rejected');
}

echo "WUT native identity capsule checks passed.\n";
