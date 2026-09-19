<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$source = wut_posts_text($_POST['source'] ?? '', 24);
$kind = wut_posts_text($_POST['kind'] ?? 'text', 16);
$text = wut_posts_text($_POST['text'] ?? '', 280);
$drawingPath = wut_posts_text($_POST['drawing_path'] ?? '', 255);
$communityId = wut_posts_text($_POST['community_id'] ?? '', 64);
$community = wut_posts_text($_POST['community'] ?? '', 64);
$communityIcon = wut_posts_text($_POST['community_icon'] ?? 'res/olv/default-image.png', 255);
$fallbackName = wut_posts_text($_POST['author_name'] ?? 'Cafe User', 32);
$fallbackId = wut_posts_text($_POST['author_id'] ?? 'WUT_USER', 32);

/* WUT posts belong to a Community. Activity Feed is deliberately read-only. */
if ($source !== 'community' || $community === '' || $communityId === '') {
    wut_json(array('ok' => false, 'error' => 'community_required'), 400);
}

if ($kind !== 'drawing') {
    $kind = 'text';
}

if ($kind === 'text' && $text === '') {
    wut_json(array('ok' => false, 'error' => 'empty_post'), 400);
}

/* Only project-relative assets are accepted for icons/drawings. */
$validRelativePath = static function (string $value): bool {
    return $value !== '' &&
        strpos($value, '..') === false &&
        strpos($value, ':') === false &&
        substr($value, 0, 1) !== '/' &&
        preg_match('#^[A-Za-z0-9_./-]+$#', $value) === 1;
};

if (!$validRelativePath($communityIcon)) {
    $communityIcon = 'res/olv/default-image.png';
}

if ($kind === 'drawing') {
    if (!$validRelativePath($drawingPath)) {
        wut_json(array('ok' => false, 'error' => 'invalid_drawing'), 400);
    }
    $text = '';
}
else {
    $drawingPath = '';
}

$reconciled = wut_accounts_reconcile_current_identity();
$identity = $reconciled['identity'];
$account = $reconciled['account'];

/* A real Community post must belong to a completed WUT account. The post
 * stores only the internal account reference; raw Mii StoreData stays in the
 * account backend and never gets copied into browser-visible JSON. */
if ($account === null || empty($account['setup_complete'])) {
    wut_json(array('ok' => false, 'error' => 'wut_account_required'), 401);
}
if (empty($account['mii_data'])) {
    wut_json(array('ok' => false, 'error' => 'persistent_mii_required'), 409);
}

$authorName = wut_posts_text($account['display_name'] ?? ($identity['mii_name'] ?? ''), 32);
$authorId = wut_posts_text($identity['pnid'] ?? ($identity['account_id'] ?? ''), 32);

if ($authorName === '') {
    $authorName = $fallbackName !== '' ? $fallbackName : 'Cafe User';
}
if ($authorId === '') {
    $authorId = $fallbackId !== '' ? $fallbackId : 'WUT_USER';
}

$now = time();
$post = array(
    'id' => 'p' . $now . '-' . substr(bin2hex(random_bytes(5)), 0, 10),
    'author_key' => (string) ($account['identity_key'] ?? wut_posts_author_key($identity, $authorId)),
    'author_wut_id' => (string) ($account['wut_id'] ?? ''),
    'author_mii_sha256' => (string) ($account['mii_sha256'] ?? ''),
    'author_name' => $authorName,
    'author_id' => $authorId,
    'source' => 'community',
    'kind' => $kind,
    'community_id' => $communityId,
    'community' => $community,
    'community_icon' => $communityIcon,
    'text' => $text,
    'drawing_path' => $drawingPath,
    'created_at' => $now,
    'yeahs' => 0,
    'comments' => 0,
    'platform' => 'WII U',
);

$posts = wut_posts_read();
array_unshift($posts, $post);
if (count($posts) > 200) {
    $posts = array_slice($posts, 0, 200);
}

if (!wut_posts_write($posts)) {
    wut_json(array('ok' => false, 'error' => 'write_failed'), 500);
}

unset($post['author_key'], $post['author_wut_id'], $post['author_mii_sha256']);
$post['mii_url'] = '../../net/olv/v1/posts/mii.php?post_id=' . rawurlencode((string) $post['id']) . '&width=96&type=face&expression=normal';
$post['current_user'] = true;

wut_json(array('ok' => true, 'post' => $post));
