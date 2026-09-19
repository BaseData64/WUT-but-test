<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();
$reconciledIdentity = wut_accounts_reconcile_current_identity();
$account = $reconciledIdentity['account'];
wut_json(array('ok' => true, 'account' => $account !== null ? wut_accounts_public($account) : null));
