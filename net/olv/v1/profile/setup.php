<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require dirname(__DIR__) . '/account/_common.php';

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
$skill = (int) $skillRaw;
$account = null;

/* Completing First Run is the account-creation boundary. No login/register UI:
 * the already-resolved Wii U identity becomes one persistent WUT account. */
if ($complete) {
    $identity = wut_identity_from_session();
    if (wut_accounts_identity_key($identity) === '') {
        wut_json(array('ok' => false, 'error' => 'stable_identity_required'), 401);
    }
    if (wut_accounts_mii_snapshot($identity) === null) {
        wut_json(array('ok' => false, 'error' => 'mii_data_required'), 409);
    }

    $account = wut_accounts_ensure($identity, $skill, true);
    if ($account === null) {
        wut_json(array('ok' => false, 'error' => 'account_write_failed'), 500);
    }

    wut_accounts_bind_session($account);
}

$_SESSION['wut_profile'] = array(
    'game_skill' => $skill,
    'setup_complete' => $complete,
    'updated_at' => time(),
);

wut_json(array(
    'ok' => true,
    'profile' => array(
        'game_skill' => $skill,
        'setup_complete' => $complete,
    ),
    'account' => $account !== null ? wut_accounts_public($account) : null,
));
