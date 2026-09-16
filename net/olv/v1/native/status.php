<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

$config = wut_config();
$state = wut_native_identity_read($config);

if ($state === null) {
    wut_json(array(
        'ok' => true,
        'registered' => false,
    ));
}

wut_json(array(
    'ok' => true,
    'registered' => true,
    'source' => 'wiiu-native-act',
    'slot' => $state['slot'] ?? null,
    'account_id' => $state['account_id'],
    'pid' => $state['pid'],
    'persistent_id' => $state['persistent_id'],
    'mii_data_present' => true,
    'received_at' => $state['received_at'],
));
