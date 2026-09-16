<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

function fail_image(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo $message;
    exit;
}

$miiFile = (string)$config['mii_file'];

if (!is_file($miiFile) || filesize($miiFile) !== 96) {
    fail_image(404, 'No native Mii registered.');
}

$miiBytes = file_get_contents($miiFile);
if (!is_string($miiBytes) || strlen($miiBytes) !== 96) {
    fail_image(500, 'Invalid native Mii data.');
}

$requestedWidth = isset($_GET['width']) ? (int)$_GET['width'] : 128;
$allowedWidths = [96, 128, 270, 512];
if (!in_array($requestedWidth, $allowedWidths, true)) {
    $requestedWidth = 128;
}

$miiHash = hash('sha256', $miiBytes);
$cacheDir = (string)$config['cache_dir'];

if (!is_dir($cacheDir) && !mkdir($cacheDir, 0775, true) && !is_dir($cacheDir)) {
    fail_image(500, 'Could not create Mii cache.');
}

$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $miiHash . '-' . $requestedWidth . '.png';

if (is_file($cacheFile) && filesize($cacheFile) > 8) {
    $cached = file_get_contents($cacheFile);
    if (is_string($cached) && strncmp($cached, "\x89PNG\r\n\x1a\n", 8) === 0) {
        header('Content-Type: image/png');
        header('Content-Length: ' . strlen($cached));
        header('Cache-Control: private, max-age=60');
        echo $cached;
        exit;
    }
}

$rendererBase = (string)$config['renderer_base'];
$url = $rendererBase
    . '?data=' . rawurlencode(bin2hex($miiBytes))
    . '&width=' . $requestedWidth;

$body = false;
$status = 0;

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    if ($ch !== false) {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    }
} elseif ((bool)ini_get('allow_url_fopen')) {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    $status = is_string($body) ? 200 : 0;
}

if (
    $status < 200 ||
    $status >= 300 ||
    !is_string($body) ||
    strlen($body) <= 8 ||
    strncmp($body, "\x89PNG\r\n\x1a\n", 8) !== 0
) {
    fail_image(
        502,
        'Native Mii was captured, but the configured FFL renderer did not return a PNG.'
    );
}

@file_put_contents($cacheFile, $body, LOCK_EX);

header('Content-Type: image/png');
header('Content-Length: ' . strlen($body));
header('Cache-Control: private, max-age=60');
echo $body;
