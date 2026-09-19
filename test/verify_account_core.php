<?php

declare(strict_types=1);

require dirname(__DIR__) . '/net/olv/v1/account/_common.php';
require dirname(__DIR__) . '/net/olv/v1/messages/_common.php';
require dirname(__DIR__) . '/net/olv/v1/mii/_renderer.php';

$accountFile = wut_accounts_data_file();
$messageFile = wut_messages_data_file();
$accountBackup = is_file($accountFile) ? file_get_contents($accountFile) : null;
$messageBackup = is_file($messageFile) ? file_get_contents($messageFile) : null;

function check(bool $value, string $message): void {
    if (!$value) {
        throw new RuntimeException($message);
    }
}

function fake_mii_data(string $name, int $marker): string {
    $raw = str_repeat("\0", 96);
    $raw[0] = chr($marker & 0xFF);

    $utf16 = '';
    $name = substr($name, 0, 10);
    for ($i = 0; $i < strlen($name); $i++) {
        $utf16 .= $name[$i] . "\0";
    }
    $utf16 = str_pad(substr($utf16, 0, 20), 20, "\0");
    $raw = substr_replace($raw, $utf16, 0x1A, 20);

    return base64_encode($raw);
}

try {
    file_put_contents($accountFile, "[]\n");
    file_put_contents($messageFile, "[]\n");

    $alphaMii = fake_mii_data('Alpha', 1);
    $betaMii = fake_mii_data('Beta', 2);

    $aIdentity = array(
        'resolved' => true,
        'authenticated' => true,
        'source' => 'test',
        'network' => 'pretendo',
        'account_id' => 'UserAlpha',
        'pid' => '111111111',
        'user_id' => 'UserAlpha',
        'pnid' => null,
        'mii_name' => null,
        'mii_data' => $alphaMii,
    );
    $bIdentity = array(
        'resolved' => true,
        'authenticated' => true,
        'source' => 'test',
        'network' => 'pretendo',
        'account_id' => 'UserBeta',
        'pid' => '222222222',
        'user_id' => 'UserBeta',
        'pnid' => null,
        'mii_name' => null,
        'mii_data' => $betaMii,
    );

    $a = wut_accounts_ensure($aIdentity, 2, true);
    $b = wut_accounts_ensure($bIdentity, 1, true);
    $aAgain = wut_accounts_ensure($aIdentity, 0, true);

    check(is_array($a) && $a['wut_id'] === '000000001', 'First WUT ID should be 000000001');
    check(is_array($b) && $b['wut_id'] === '000000002', 'Second WUT ID should be 000000002');
    check(is_array($aAgain) && $aAgain['wut_id'] === '000000001', 'Same PID must recover same WUT ID');
    check(count(wut_accounts_read()) === 2, 'Same user was duplicated');
    check((int)$aAgain['game_skill'] === 0, 'Existing account profile did not update');
    check(wut_accounts_find_by_wut_id('000000002')['display_name'] === 'Beta', 'WUT ID lookup failed');

    /* Account Core V2: setup snapshot must persist raw Mii StoreData server-side. */
    check(!empty($a['mii_data']), 'Mii StoreData was not persisted');
    check(!empty($a['mii_sha256']) && strlen($a['mii_sha256']) === 64, 'Mii SHA-256 missing');
    check(($a['mii_name'] ?? '') === 'Alpha', 'Mii name was not decoded/persisted');
    check((int)($a['mii_updated_at'] ?? 0) > 0, 'Mii updated timestamp missing');

    $publicA = wut_accounts_public($a);
    check(!array_key_exists('mii_data', $publicA), 'Public account leaked raw Mii StoreData');
    check(!empty($publicA['mii_data_present']), 'Public account did not report stored Mii');

    /* Simulate the user editing their Mii later. Same WUT account, new snapshot. */
    $alphaChanged = fake_mii_data('AlphaTwo', 3);
    $changedIdentity = $aIdentity;
    $changedIdentity['mii_data'] = $alphaChanged;
    $changed = wut_accounts_sync_existing_identity($changedIdentity);
    check(is_array($changed), 'Existing account Mii sync failed');
    check($changed['wut_id'] === '000000001', 'Mii sync changed WUT ID');
    check(($changed['mii_name'] ?? '') === 'AlphaTwo', 'Changed Mii name did not sync');
    check(($changed['mii_data'] ?? '') === $alphaChanged, 'Changed Mii StoreData did not sync');
    check(($changed['mii_sha256'] ?? '') !== ($a['mii_sha256'] ?? ''), 'Changed Mii hash did not update');

    /* Simulate a fresh PHP session that knows the same PID but has no Mii data. */
    $_SESSION = array();
    $_SESSION['wut_identity'] = array(
        'resolved' => true,
        'authenticated' => true,
        'source' => 'test-fresh-session',
        'network' => 'pretendo',
        'account_id' => 'UserAlpha',
        'pid' => '111111111',
        'user_id' => 'UserAlpha',
        'pnid' => null,
        'mii_name' => null,
        'mii_data' => null,
    );

    $reconciled = wut_accounts_reconcile_current_identity();
    check(($reconciled['identity']['mii_data'] ?? '') === $alphaChanged, 'Persistent Mii was not restored into fresh session');
    check(($reconciled['identity']['mii_name'] ?? '') === 'AlphaTwo', 'Persistent Mii name was not restored');
    check(($_SESSION['wut_identity']['mii_data'] ?? '') === $alphaChanged, 'Session was not hydrated with persistent Mii');

    $renderQuery = wut_mii_render_query(
        $reconciled['identity'],
        array('scale' => 1.0),
        96,
        'face',
        'normal'
    );
    check(is_array($renderQuery) && ($renderQuery['data'] ?? '') === $alphaChanged, 'Renderer did not consume persistent Mii StoreData');

    $messageUser = wut_messages_current_user();
    check(!empty($messageUser['ok']), 'Messages did not resolve current WUT account');
    check($messageUser['id'] === '000000001', 'Messages did not use WUT ID');

    echo "RESULTADO: WUT Account Core V2 identity, persistent Mii, sync, hydration, IDs and Messages binding passed.\n";
} finally {
    if ($accountBackup === null) { @unlink($accountFile); }
    else { file_put_contents($accountFile, $accountBackup); }
    if ($messageBackup === null) { @unlink($messageFile); }
    else { file_put_contents($messageFile, $messageBackup); }
}
