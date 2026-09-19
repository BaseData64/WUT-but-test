<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/_common.php';
require_once dirname(__DIR__) . '/account/_common.php';

function wut_messages_data_file(): string
{
    return __DIR__ . '/data/messages.json';
}

function wut_messages_read(): array
{
    $path = wut_messages_data_file();
    if (!is_file($path)) {
        return array();
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return array();
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

function wut_messages_write(array $messages): bool
{
    $path = wut_messages_data_file();
    $dir = dirname($path);

    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $fp = @fopen($path, 'c+');
    if (!$fp) {
        return false;
    }

    $ok = false;
    if (@flock($fp, LOCK_EX)) {
        $json = json_encode(array_values($messages), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (is_string($json)) {
            @ftruncate($fp, 0);
            @rewind($fp);
            $ok = @fwrite($fp, $json . "\n") !== false;
            @fflush($fp);
        }
        @flock($fp, LOCK_UN);
    }

    @fclose($fp);
    return $ok;
}

function wut_messages_text($value, int $max): string
{
    $value = trim((string) $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }

    return substr($value, 0, $max);
}

function wut_messages_current_user(): array
{
    $account = wut_accounts_current();
    if ($account === null || empty($account['setup_complete'])) {
        return array(
            'ok' => false,
            'id' => '',
            'key' => '',
            'name' => '',
        );
    }

    $id = (string) ($account['wut_id'] ?? '');
    if (!preg_match('/^\d{9}$/', $id)) {
        return array('ok' => false, 'id' => '', 'key' => '', 'name' => '');
    }

    return array(
        'ok' => true,
        'id' => $id,
        'key' => wut_messages_user_key($id),
        'name' => wut_messages_clean_account_name($account),
    );
}

function wut_messages_clean_account_name(array $account): string
{
    $name = wut_messages_text($account['display_name'] ?? '', 32);
    return $name !== '' ? $name : (string) ($account['wut_id'] ?? 'WUT User');
}

function wut_messages_user_key(string $publicId): string
{
    return 'wut:' . trim($publicId);
}

function wut_messages_conversation_id(string $keyA, string $keyB): string
{
    $keys = array($keyA, $keyB);
    sort($keys, SORT_STRING);
    return 'c-' . substr(hash('sha256', $keys[0] . '|' . $keys[1]), 0, 20);
}

function wut_messages_require_user(): array
{
    $user = wut_messages_current_user();
    if (empty($user['ok'])) {
        wut_json(array('ok' => false, 'error' => 'identity_required'), 401);
    }
    return $user;
}
