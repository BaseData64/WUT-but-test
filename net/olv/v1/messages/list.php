<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();
$user = wut_messages_require_user();
$messages = wut_messages_read();
$groups = array();
$newestInboundId = '';
$newestInboundAt = 0;
$unreadTotal = 0;

foreach ($messages as $message) {
    $senderKey = (string)($message['sender_key'] ?? '');
    $recipientKey = (string)($message['recipient_key'] ?? '');

    if ($senderKey !== $user['key'] && $recipientKey !== $user['key']) {
        continue;
    }

    $incoming = $recipientKey === $user['key'];
    $peerKey = $incoming ? $senderKey : $recipientKey;
    $peerId = $incoming
        ? (string)($message['sender_id'] ?? '')
        : (string)($message['recipient_id'] ?? '');
    $peerName = $incoming
        ? (string)($message['sender_name'] ?? $peerId)
        : (string)($message['recipient_name'] ?? $peerId);
    $conversationId = (string)($message['conversation_id'] ?? wut_messages_conversation_id($user['key'], $peerKey));
    $createdAt = (int)($message['created_at'] ?? 0);

    if (!isset($groups[$conversationId])) {
        $groups[$conversationId] = array(
            'conversation_id' => $conversationId,
            'peer_id' => $peerId,
            'peer_name' => $peerName !== '' ? $peerName : $peerId,
            'last_text' => '',
            'last_at' => 0,
            'last_message_id' => '',
            'unread' => 0,
        );
    }

    if ($createdAt >= (int)$groups[$conversationId]['last_at']) {
        $groups[$conversationId]['last_at'] = $createdAt;
        $groups[$conversationId]['last_text'] = (string)($message['text'] ?? '');
        $groups[$conversationId]['last_message_id'] = (string)($message['id'] ?? '');
        if ($peerName !== '') {
            $groups[$conversationId]['peer_name'] = $peerName;
        }
        if ($peerId !== '') {
            $groups[$conversationId]['peer_id'] = $peerId;
        }
    }

    if ($incoming && empty($message['read_at'])) {
        $groups[$conversationId]['unread'] += 1;
        $unreadTotal += 1;
    }

    if ($incoming && $createdAt >= $newestInboundAt) {
        $newestInboundAt = $createdAt;
        $newestInboundId = (string)($message['id'] ?? '');
    }
}

$conversations = array_values($groups);
usort($conversations, static function (array $a, array $b): int {
    return ((int)$b['last_at']) <=> ((int)$a['last_at']);
});

wut_json(array(
    'ok' => true,
    'self' => array('id' => $user['id'], 'name' => $user['name']),
    'conversations' => $conversations,
    'unread_total' => $unreadTotal,
    'newest_inbound_id' => $newestInboundId,
    'server_time' => time(),
));
