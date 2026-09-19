<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$identity = wut_identity_from_session();
if (wut_accounts_identity_key($identity) === '') {
    wut_json(array('ok' => false, 'error' => 'stable_identity_required'), 401);
}
if (wut_accounts_mii_snapshot($identity) === null) {
    wut_json(array('ok' => false, 'error' => 'mii_data_required'), 409);
}

$skill = null;
if (isset($_POST['game_skill']) && in_array((string) $_POST['game_skill'], array('0','1','2'), true)) {
    $skill = (int) $_POST['game_skill'];
}

$account = wut_accounts_ensure($identity, $skill, true);
if ($account === null) {
    wut_json(array('ok' => false, 'error' => 'account_write_failed'), 500);
}

$_SESSION['wut_profile'] = array(
    'game_skill' => isset($account['game_skill']) ? (int) $account['game_skill'] : $skill,
    'setup_complete' => true,
    'updated_at' => time(),
);

wut_json(array('ok' => true, 'account' => wut_accounts_public($account)));
