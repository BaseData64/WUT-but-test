<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require_once dirname(__DIR__) . '/account/_common.php';

function wut_posts_data_file(): string
{
    return __DIR__ . '/data/posts.json';
}

function wut_posts_read(): array
{
    $path = wut_posts_data_file();

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

function wut_posts_write(array $posts): bool
{
    $path = wut_posts_data_file();
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
        $json = json_encode(array_values($posts), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

function wut_posts_text($value, int $max): string
{
    $value = trim((string) $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }

    return substr($value, 0, $max);
}

function wut_posts_author_key(array $identity, string $fallbackId): string
{
    foreach (array('pid', 'pnid', 'user_id', 'account_id') as $key) {
        if (!empty($identity[$key])) {
            return $key . ':' . (string) $identity[$key];
        }
    }

    return 'local:' . strtolower($fallbackId !== '' ? $fallbackId : 'wut_user');
}

function wut_posts_find_by_id(string $postId): ?array
{
    $postId = trim($postId);
    if ($postId === '') {
        return null;
    }
    foreach (wut_posts_read() as $post) {
        if ((string) ($post['id'] ?? '') === $postId) {
            return $post;
        }
    }
    return null;
}

function wut_posts_author_account(array $post): ?array
{
    $wutId = trim((string) ($post['author_wut_id'] ?? ''));
    if ($wutId !== '') {
        $account = wut_accounts_find_by_wut_id($wutId);
        if ($account !== null) {
            return $account;
        }
    }

    /* Migration path for posts written before author_wut_id existed. */
    $identityKey = trim((string) ($post['author_key'] ?? ''));
    if ($identityKey !== '') {
        return wut_accounts_find_by_identity_key($identityKey);
    }

    return null;
}

function wut_posts_mii_url(array $post, ?array $account = null): ?string
{
    $postId = trim((string) ($post['id'] ?? ''));
    if ($postId === '') {
        return null;
    }
    if ($account === null) {
        $account = wut_posts_author_account($post);
    }
    if ($account === null || empty($account['setup_complete']) || empty($account['mii_data'])) {
        return null;
    }

    $hash = trim((string) ($account['mii_sha256'] ?? ''));
    $url = '../../net/olv/v1/posts/mii.php?post_id=' . rawurlencode($postId) . '&width=96&type=face&expression=normal';
    if ($hash !== '') {
        $url .= '&v=' . rawurlencode(substr($hash, 0, 20));
    }
    return $url;
}
