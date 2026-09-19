<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();
$current = wut_accounts_current();
if ($current === null) {
    wut_json(array('ok' => false, 'error' => 'wut_account_required'), 401);
}

$id = trim((string) ($_GET['id'] ?? ''));
$account = wut_accounts_find_by_wut_id($id);
if ($account === null || empty($account['setup_complete'])) {
    wut_json(array('ok' => false, 'error' => 'account_not_found'), 404);
}

wut_json(array('ok' => true, 'account' => array(
    'wut_id' => (string) $account['wut_id'],
    'display_name' => (string) ($account['display_name'] ?? 'WUT User'),
)));
