<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$user = wut_messages_require_user();
$peerId = wut_messages_text($_POST['peer_id'] ?? '', 32);
if ($peerId === '') {
    wut_json(array('ok' => false, 'error' => 'peer_required'), 400);
}

$peerKey = wut_messages_user_key($peerId);
$messages = wut_messages_read();
$changed = 0;
$now = time();

foreach ($messages as &$message) {
    if (
        (string)($message['sender_key'] ?? '') === $peerKey &&
        (string)($message['recipient_key'] ?? '') === $user['key'] &&
        empty($message['read_at'])
    ) {
        $message['read_at'] = $now;
        $changed += 1;
    }
}
unset($message);

if ($changed > 0 && !wut_messages_write($messages)) {
    wut_json(array('ok' => false, 'error' => 'write_failed'), 500);
}

wut_json(array('ok' => true, 'marked' => $changed));
