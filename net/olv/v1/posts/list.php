<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 30;
if ($limit < 1) {
    $limit = 1;
}
if ($limit > 50) {
    $limit = 50;
}

$reconciled = wut_accounts_reconcile_current_identity();
$identity = $reconciled['identity'];
$currentAccount = $reconciled['account'];
$currentFallbackId = wut_posts_text($_GET['viewer_id'] ?? '', 32);
$currentKey = wut_posts_author_key($identity, $currentFallbackId);
$currentWutId = $currentAccount !== null ? (string) ($currentAccount['wut_id'] ?? '') : '';
$posts = wut_posts_read();
$communityId = wut_posts_text($_GET['community_id'] ?? '', 64);
$communityTitle = wut_posts_text($_GET['community'] ?? '', 64);

/* Activity Feed: no community_id => aggregate every Community post.
   Community View: community_id => only that Community's posts. */
$posts = array_values(array_filter($posts, static function (array $post) use ($communityId, $communityTitle): bool {
    if ((string) ($post['source'] ?? '') !== 'community') {
        return false;
    }
    if ($communityId === '') {
        return true;
    }
    $postCommunityId = (string) ($post['community_id'] ?? '');
    if ($postCommunityId !== '') {
        return $postCommunityId === $communityId;
    }

    /* Compatibility with posts created by the previous WUT build, before
       community_id was persisted. Their community title is still enough to
       place them back in the correct Community View. */
    return $communityTitle !== '' && strcasecmp((string) ($post['community'] ?? ''), $communityTitle) === 0;
}));

usort($posts, static function (array $a, array $b): int {
    return ((int) ($b['created_at'] ?? 0)) <=> ((int) ($a['created_at'] ?? 0));
});

$out = array();
foreach (array_slice($posts, 0, $limit) as $post) {
    $authorAccount = wut_posts_author_account($post);
    $authorWutId = $authorAccount !== null ? (string) ($authorAccount['wut_id'] ?? '') : (string) ($post['author_wut_id'] ?? '');

    $post['current_user'] = ($currentWutId !== '' && $authorWutId !== '')
        ? hash_equals($currentWutId, $authorWutId)
        : (isset($post['author_key']) && (string) $post['author_key'] === $currentKey);

    $post['mii_url'] = wut_posts_mii_url($post, $authorAccount);

    /* Internal account identifiers and raw persistence metadata never leave
     * the post API. The browser only receives the same-origin PNG endpoint. */
    unset($post['author_key'], $post['author_wut_id'], $post['author_mii_sha256']);
    $out[] = $post;
}

wut_json(array('ok' => true, 'posts' => $out));
