<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();
$user = wut_messages_require_user();
$peerId = wut_messages_text($_GET['peer_id'] ?? '', 32);

if ($peerId === '') {
    wut_json(array('ok' => false, 'error' => 'peer_required'), 400);
}

$peerKey = wut_messages_user_key($peerId);
$messages = wut_messages_read();
$out = array();
$peerName = $peerId;

foreach ($messages as $message) {
    $senderKey = (string)($message['sender_key'] ?? '');
    $recipientKey = (string)($message['recipient_key'] ?? '');
    $between = ($senderKey === $user['key'] && $recipientKey === $peerKey)
        || ($senderKey === $peerKey && $recipientKey === $user['key']);

    if (!$between) {
        continue;
    }

    $incoming = $recipientKey === $user['key'];
    if ($incoming) {
        $candidate = (string)($message['sender_name'] ?? '');
        if ($candidate !== '') {
            $peerName = $candidate;
        }
    } else {
        $candidate = (string)($message['recipient_name'] ?? '');
        if ($candidate !== '') {
            $peerName = $candidate;
        }
    }

    $out[] = array(
        'id' => (string)($message['id'] ?? ''),
        'side' => $incoming ? 'in' : 'out',
        'text' => (string)($message['text'] ?? ''),
        'created_at' => (int)($message['created_at'] ?? 0),
        'read' => !empty($message['read_at']),
    );
}

usort($out, static function (array $a, array $b): int {
    return ((int)$a['created_at']) <=> ((int)$b['created_at']);
});

wut_json(array(
    'ok' => true,
    'peer' => array('id' => $peerId, 'name' => $peerName),
    'messages' => $out,
));
