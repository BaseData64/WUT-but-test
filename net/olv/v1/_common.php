<?php

declare(strict_types=1);

function wut_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $path = dirname(__DIR__, 2) . '/cfg/wut.php';
    $config = array(
        'mii_renderer_base' => '',
        'allow_local_dev_identity' => false,
    );

    if (is_file($path)) {
        $loaded = require $path;
        if (is_array($loaded)) {
            $config = array_merge($config, $loaded);
        }
    }

    return $config;
}

function wut_start_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('WUTSESSID');
        session_start();
    }
}

function wut_header(string $serverKey): string
{
    return isset($_SERVER[$serverKey]) ? trim((string) $_SERVER[$serverKey]) : '';
}

function wut_is_local_request(): bool
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    return $remote === '127.0.0.1' || $remote === '::1';
}

function wut_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function wut_identity_from_session(): array
{
    $identity = $_SESSION['wut_identity'] ?? array();

    return array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'network' => $identity['network'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'user_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data' => $identity['mii_data'] ?? null,
        'mii_image_url' => $identity['mii_image_url'] ?? null,
    );
}

function wut_apply_local_dev_identity(array $config): void
{
    if (empty($config['allow_local_dev_identity']) || !wut_is_local_request()) {
        return;
    }

    if (($_GET['wutdev'] ?? '') !== '1') {
        return;
    }

    $pid = isset($_GET['pid']) && ctype_digit((string) $_GET['pid'])
        ? (string) $_GET['pid']
        : null;
    $userId = isset($_GET['user_id']) ? substr((string) $_GET['user_id'], 0, 32) : null;
    $pnid = isset($_GET['pnid']) ? substr((string) $_GET['pnid'], 0, 32) : null;
    $miiName = isset($_GET['mii_name']) ? substr((string) $_GET['mii_name'], 0, 32) : null;
    $miiData = isset($_GET['mii_data']) ? (string) $_GET['mii_data'] : null;
    $miiImageUrl = isset($_GET['mii_image_url']) ? (string) $_GET['mii_image_url'] : null;

    if (!$pid && !$userId && !$pnid && !$miiData && !$miiImageUrl) {
        return;
    }

    $_SESSION['wut_identity'] = array(
        'resolved' => true,
        'authenticated' => true,
        'source' => 'local-dev-injection',
        'network' => isset($_GET['network']) ? (string) $_GET['network'] : 'pretendo',
        'pid' => $pid,
        'user_id' => $userId ?: $pnid,
        'pnid' => $pnid ?: $userId,
        'mii_name' => $miiName,
        'mii_data' => $miiData,
        'mii_image_url' => $miiImageUrl,
    );
}
