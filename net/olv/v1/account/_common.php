<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/_common.php';

function wut_accounts_data_file(): string
{
    return __DIR__ . '/data/accounts.json';
}

function wut_accounts_clean_text($value, int $max): string
{
    $value = trim((string) $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

function wut_accounts_read_unlocked($fp): array
{
    @rewind($fp);
    $raw = stream_get_contents($fp);
    if (!is_string($raw) || trim($raw) === '') {
        return array();
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? array_values($decoded) : array();
}

function wut_accounts_read(): array
{
    $path = wut_accounts_data_file();
    if (!is_file($path)) {
        return array();
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return array();
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? array_values($decoded) : array();
}

function wut_accounts_identity_key(array $identity): string
{
    $pid = trim((string) ($identity['pid'] ?? ''));
    if ($pid !== '' && ctype_digit($pid) && (int) $pid > 0) {
        return 'pid:' . $pid;
    }

    $network = strtolower(trim((string) ($identity['network'] ?? 'wut')));
    $accountId = strtolower(trim((string) ($identity['account_id'] ?? '')));
    if ($accountId !== '') {
        return 'account:' . $network . ':' . $accountId;
    }

    $pnid = strtolower(trim((string) ($identity['pnid'] ?? '')));
    if ($pnid !== '') {
        return 'pnid:' . $network . ':' . $pnid;
    }

    return '';
}

function wut_accounts_decode_mii_name(array $identity): string
{
    $existing = wut_accounts_clean_text($identity['mii_name'] ?? '', 32);
    if ($existing !== '') {
        return $existing;
    }

    $value = preg_replace('/\s+/', '', trim((string) ($identity['mii_data'] ?? '')));
    if (!is_string($value) || $value === '') {
        return '';
    }

    $raw = false;
    if ((strlen($value) % 2) === 0 && ctype_xdigit($value)) {
        $raw = hex2bin($value);
    } elseif (preg_match('/^[A-Za-z0-9+\/_=-]+$/', $value)) {
        $b64 = strtr($value, '-_', '+/');
        $pad = strlen($b64) % 4;
        if ($pad !== 0) {
            $b64 .= str_repeat('=', 4 - $pad);
        }
        $raw = base64_decode($b64, true);
    }

    if (!is_string($raw) || strlen($raw) < 0x1A + 20) {
        return '';
    }

    $field = substr($raw, 0x1A, 20);
    $bytes = '';
    for ($i = 0; $i < 20; $i += 2) {
        $pair = substr($field, $i, 2);
        if (strlen($pair) < 2 || $pair === "\x00\x00") {
            break;
        }
        $bytes .= $pair;
    }

    if ($bytes === '') {
        return '';
    }

    $name = '';
    if (function_exists('mb_convert_encoding')) {
        $name = (string) @mb_convert_encoding($bytes, 'UTF-8', 'UTF-16LE');
    } elseif (function_exists('iconv')) {
        $converted = @iconv('UTF-16LE', 'UTF-8//IGNORE', $bytes);
        if (is_string($converted)) {
            $name = $converted;
        }
    }

    return wut_accounts_clean_text($name, 32);
}

function wut_accounts_display_name(array $identity): string
{
    $name = wut_accounts_decode_mii_name($identity);
    if ($name !== '') {
        return $name;
    }

    foreach (array('account_id', 'pnid', 'user_id') as $field) {
        $value = wut_accounts_clean_text($identity[$field] ?? '', 32);
        if ($value !== '') {
            return $value;
        }
    }

    return 'WUT User';
}

function wut_accounts_mii_raw($value): ?string
{
    $normalized = wut_normalize_mii_data($value);
    if ($normalized === null) {
        return null;
    }

    $normalized = preg_replace('/\\s+/', '', trim((string) $normalized));
    if (!is_string($normalized) || $normalized === '') {
        return null;
    }

    $raw = false;
    if ((strlen($normalized) % 2) === 0 && ctype_xdigit($normalized)) {
        $raw = hex2bin($normalized);
    } else {
        $base64 = strtr($normalized, '-_', '+/');
        $padding = strlen($base64) % 4;
        if ($padding !== 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }
        $raw = base64_decode($base64, true);
    }

    if (!is_string($raw)) {
        return null;
    }

    $length = strlen($raw);
    if ($length < 46 || $length > 96) {
        return null;
    }

    return $raw;
}

function wut_accounts_mii_snapshot(array $identity): ?array
{
    $raw = wut_accounts_mii_raw($identity['mii_data'] ?? null);
    if ($raw === null) {
        return null;
    }

    /* Store one canonical representation regardless of whether the bridge
     * supplied hexadecimal or Base64. The renderer accepts Base64 directly. */
    $canonical = base64_encode($raw);
    $name = wut_accounts_decode_mii_name(array(
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data' => $canonical,
    ));

    return array(
        'mii_data' => $canonical,
        'mii_sha256' => hash('sha256', $raw),
        'mii_name' => $name !== '' ? $name : null,
    );
}

function wut_accounts_apply_mii_snapshot(array $account, array $identity, int $now): array
{
    $snapshot = wut_accounts_mii_snapshot($identity);
    if ($snapshot === null) {
        return $account;
    }

    $oldHash = strtolower(trim((string) ($account['mii_sha256'] ?? '')));
    $newHash = (string) $snapshot['mii_sha256'];

    $account['mii_data'] = $snapshot['mii_data'];
    $account['mii_sha256'] = $newHash;
    if (!empty($snapshot['mii_name'])) {
        $account['mii_name'] = $snapshot['mii_name'];
        $account['display_name'] = $snapshot['mii_name'];
    }

    /* Preserve the original setup timestamp unless the actual StoreData
     * changes. Old V1 accounts receive it on their first V2 migration. */
    if ($oldHash === '' || !hash_equals($oldHash, $newHash)) {
        $account['mii_updated_at'] = $now;
    } elseif (!isset($account['mii_updated_at'])) {
        $account['mii_updated_at'] = $now;
    }

    return $account;
}


function wut_accounts_bind_session(array $account): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION['wut_account_internal'] = array(
        'wut_id' => (string) ($account['wut_id'] ?? ''),
        'identity_key' => (string) ($account['identity_key'] ?? ''),
        'bound_at' => time(),
    );
}

/*
 * Account Core V2.1 — persistent Auto-Mii render source.
 *
 * The native bridge is the freshest source when it is available. Reconcile
 * syncs that StoreData into the WUT account first. After that, the account
 * snapshot becomes the canonical renderer input. This means rendering keeps
 * working even when the bridge is temporarily unavailable on a later request.
 */
function wut_accounts_render_identity(array $identity, ?array $account): array
{
    if (
        $account !== null &&
        !empty($account['setup_complete']) &&
        !empty($account['mii_data'])
    ) {
        $identity['mii_data'] = (string) $account['mii_data'];
        if (!empty($account['mii_name'])) {
            $identity['mii_name'] = (string) $account['mii_name'];
        }
        $identity['mii_persistence'] = 'wut-account';
        $identity['mii_account_bound'] = true;
    }

    return $identity;
}

function wut_accounts_public(array $account): array
{
    return array(
        'wut_id' => (string) ($account['wut_id'] ?? ''),
        'display_name' => (string) ($account['display_name'] ?? 'WUT User'),
        'network' => (string) ($account['network'] ?? 'wut'),
        'game_skill' => isset($account['game_skill']) ? (int) $account['game_skill'] : null,
        'setup_complete' => !empty($account['setup_complete']),
        'mii_name' => !empty($account['mii_name']) ? (string) $account['mii_name'] : null,
        'mii_data_present' => !empty($account['mii_data']),
        'mii_sha256' => !empty($account['mii_sha256']) ? (string) $account['mii_sha256'] : null,
        'mii_updated_at' => isset($account['mii_updated_at']) ? (int) $account['mii_updated_at'] : null,
        'created_at' => (int) ($account['created_at'] ?? 0),
        'updated_at' => (int) ($account['updated_at'] ?? 0),
    );
}

function wut_accounts_find_by_identity(array $identity): ?array
{
    $key = wut_accounts_identity_key($identity);
    if ($key === '') {
        return null;
    }

    foreach (wut_accounts_read() as $account) {
        if ((string) ($account['identity_key'] ?? '') === $key) {
            return $account;
        }
    }
    return null;
}

function wut_accounts_find_by_identity_key(string $identityKey): ?array
{
    $identityKey = trim($identityKey);
    if ($identityKey === '') {
        return null;
    }
    foreach (wut_accounts_read() as $account) {
        if ((string) ($account['identity_key'] ?? '') === $identityKey) {
            return $account;
        }
    }
    return null;
}

function wut_accounts_find_by_wut_id(string $wutId): ?array
{
    $wutId = trim($wutId);
    if (!preg_match('/^\d{9}$/', $wutId)) {
        return null;
    }
    foreach (wut_accounts_read() as $account) {
        if ((string) ($account['wut_id'] ?? '') === $wutId) {
            return $account;
        }
    }
    return null;
}

function wut_accounts_next_id(array $accounts): string
{
    $max = 0;
    foreach ($accounts as $account) {
        $id = (string) ($account['wut_id'] ?? '');
        if (preg_match('/^\d{9}$/', $id)) {
            $max = max($max, (int) $id);
        }
    }
    $next = $max + 1;
    if ($next > 999999999) {
        throw new RuntimeException('account_id_exhausted');
    }
    return str_pad((string) $next, 9, '0', STR_PAD_LEFT);
}

function wut_accounts_ensure(array $identity, ?int $gameSkill = null, bool $setupComplete = true): ?array
{
    $identityKey = wut_accounts_identity_key($identity);
    if ($identityKey === '') {
        return null;
    }

    if ($gameSkill !== null && ($gameSkill < 0 || $gameSkill > 2)) {
        $gameSkill = null;
    }

    $path = wut_accounts_data_file();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return null;
    }

    $fp = @fopen($path, 'c+');
    if (!$fp) {
        return null;
    }

    $result = null;
    if (@flock($fp, LOCK_EX)) {
        $accounts = wut_accounts_read_unlocked($fp);
        $found = -1;
        foreach ($accounts as $i => $account) {
            if ((string) ($account['identity_key'] ?? '') === $identityKey) {
                $found = $i;
                break;
            }
        }

        $now = time();
        $displayName = wut_accounts_display_name($identity);
        if ($found < 0) {
            $account = array(
                'version' => 2,
                'wut_id' => wut_accounts_next_id($accounts),
                'identity_key' => $identityKey,
                'network' => (string) ($identity['network'] ?? 'wut'),
                'account_id' => $identity['account_id'] ?? null,
                'pid' => $identity['pid'] ?? null,
                'pnid' => $identity['pnid'] ?? null,
                'display_name' => $displayName,
                'game_skill' => $gameSkill,
                'setup_complete' => $setupComplete,
                'created_at' => $now,
                'updated_at' => $now,
            );
            $account = wut_accounts_apply_mii_snapshot($account, $identity, $now);
            $accounts[] = $account;
            $found = count($accounts) - 1;
        } else {
            $account = $accounts[$found];
            $account['version'] = 2;
            $account['network'] = (string) ($identity['network'] ?? ($account['network'] ?? 'wut'));
            $account['account_id'] = $identity['account_id'] ?? ($account['account_id'] ?? null);
            $account['pid'] = $identity['pid'] ?? ($account['pid'] ?? null);
            $account['pnid'] = $identity['pnid'] ?? ($account['pnid'] ?? null);
            if ($displayName !== '' && $displayName !== 'WUT User') {
                $account['display_name'] = $displayName;
            }
            if ($gameSkill !== null) {
                $account['game_skill'] = $gameSkill;
            }
            if ($setupComplete) {
                $account['setup_complete'] = true;
            }
            $account = wut_accounts_apply_mii_snapshot($account, $identity, $now);
            $account['updated_at'] = $now;
            $accounts[$found] = $account;
        }

        $json = json_encode(array_values($accounts), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if (is_string($json)) {
            @ftruncate($fp, 0);
            @rewind($fp);
            if (@fwrite($fp, $json . "\n") !== false) {
                @fflush($fp);
                $result = $accounts[$found];
            }
        }
        @flock($fp, LOCK_UN);
    }
    @fclose($fp);

    return $result;
}

function wut_accounts_hydrate_identity(array $identity, array $account): array
{
    return wut_accounts_render_identity($identity, $account);
}

function wut_accounts_sync_existing_identity(array $identity): ?array
{
    $identityKey = wut_accounts_identity_key($identity);
    if ($identityKey === '') {
        return null;
    }

    $path = wut_accounts_data_file();
    if (!is_file($path)) {
        return null;
    }

    $fp = @fopen($path, 'c+');
    if (!$fp) {
        return null;
    }

    $result = null;
    if (@flock($fp, LOCK_EX)) {
        $accounts = wut_accounts_read_unlocked($fp);
        $found = -1;
        foreach ($accounts as $i => $account) {
            if ((string) ($account['identity_key'] ?? '') === $identityKey) {
                $found = $i;
                break;
            }
        }

        if ($found >= 0) {
            $account = $accounts[$found];
            $before = $account;
            $now = time();
            $displayName = wut_accounts_display_name($identity);

            $account['version'] = 2;
            $account['network'] = (string) ($identity['network'] ?? ($account['network'] ?? 'wut'));
            $account['account_id'] = $identity['account_id'] ?? ($account['account_id'] ?? null);
            $account['pid'] = $identity['pid'] ?? ($account['pid'] ?? null);
            $account['pnid'] = $identity['pnid'] ?? ($account['pnid'] ?? null);
            if ($displayName !== '' && $displayName !== 'WUT User') {
                $account['display_name'] = $displayName;
            }
            $account = wut_accounts_apply_mii_snapshot($account, $identity, $now);

            if ($account != $before) {
                $account['updated_at'] = $now;
                $accounts[$found] = $account;
                $json = json_encode(array_values($accounts), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                if (is_string($json)) {
                    @ftruncate($fp, 0);
                    @rewind($fp);
                    if (@fwrite($fp, $json . "\n") !== false) {
                        @fflush($fp);
                        $result = $account;
                    }
                }
            } else {
                $result = $account;
            }
        }
        @flock($fp, LOCK_UN);
    }
    @fclose($fp);

    return $result;
}

function wut_accounts_reconcile_current_identity(): array
{
    $identity = wut_identity_from_session();
    $account = wut_accounts_find_by_identity($identity);

    if ($account === null) {
        return array('identity' => $identity, 'account' => null);
    }

    /* If the trusted/native identity currently carries StoreData, treat it as
     * the freshest copy and synchronize the account. Otherwise restore the
     * setup-time snapshot from the account into this PHP session. */
    if (!empty($identity['mii_data'])) {
        $synced = wut_accounts_sync_existing_identity($identity);
        if ($synced !== null) {
            $account = $synced;
        }
    }

    $identity = wut_accounts_hydrate_identity($identity, $account);

    if (isset($_SESSION['wut_identity']) && is_array($_SESSION['wut_identity'])) {
        if (!empty($identity['mii_data'])) {
            $_SESSION['wut_identity']['mii_data'] = $identity['mii_data'];
        }
        if (!empty($identity['mii_name'])) {
            $_SESSION['wut_identity']['mii_name'] = $identity['mii_name'];
        }
        $_SESSION['wut_identity']['mii_persistence'] = $identity['mii_persistence'] ?? null;
    }

    wut_accounts_bind_session($account);

    return array('identity' => $identity, 'account' => $account);
}

function wut_accounts_current(): ?array
{
    return wut_accounts_find_by_identity(wut_identity_from_session());
}
