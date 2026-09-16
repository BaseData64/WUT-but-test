<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

$path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR . 'wut-native-diagnostic.json';

if (!is_file($path)) {
    wut_json(array(
        'ok' => true,
        'seen' => false,
    ));
}

$raw = @file_get_contents($path);
$data = is_string($raw) ? json_decode($raw, true) : null;

if (!is_array($data)) {
    wut_json(array(
        'ok' => false,
        'seen' => false,
        'error' => 'invalid_diagnostic_state',
    ), 500);
}

$history = isset($data['history']) && is_array($data['history'])
    ? array_slice($data['history'], -12)
    : array();

wut_json(array(
    'ok' => true,
    'seen' => true,
    'last' => $data['last'] ?? null,
    'history' => $history,
));
