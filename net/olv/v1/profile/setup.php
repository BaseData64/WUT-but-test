<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

wut_start_session();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$skillRaw = $_POST['game_skill'] ?? null;
$completeRaw = $_POST['setup_complete'] ?? '0';

if ($skillRaw === null || !in_array((string) $skillRaw, array('0', '1', '2'), true)) {
    wut_json(array('ok' => false, 'error' => 'invalid_game_skill'), 400);
}

$complete = in_array((string) $completeRaw, array('1', 'true'), true);

$_SESSION['wut_profile'] = array(
    'game_skill' => (int) $skillRaw,
    'setup_complete' => $complete,
    'updated_at' => time(),
);

wut_json(array(
    'ok' => true,
    'profile' => array(
        'game_skill' => (int) $skillRaw,
        'setup_complete' => $complete,
    ),
));
