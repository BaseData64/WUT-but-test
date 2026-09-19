<?php

declare(strict_types=1);

require __DIR__ . '/_common.php';

wut_start_session();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    wut_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$user = wut_messages_require_user();
$recipientId = wut_messages_text($_POST['recipient_id'] ?? '', 32);
$text = wut_messages_text($_POST['text'] ?? '', 200);

if (!preg_match('/^\d{9}$/', $recipientId)) {
    wut_json(array('ok' => false, 'error' => 'invalid_recipient'), 400);
}

$recipientAccount = wut_accounts_find_by_wut_id($recipientId);
if ($recipientAccount === null || empty($recipientAccount['setup_complete'])) {
    wut_json(array('ok' => false, 'error' => 'recipient_not_found'), 404);
}
$recipientName = wut_messages_clean_account_name($recipientAccount);

if ($text === '') {
    wut_json(array('ok' => false, 'error' => 'empty_message'), 400);
}

$recipientKey = wut_messages_user_key($recipientId);
if ($recipientKey === $user['key']) {
    wut_json(array('ok' => false, 'error' => 'cannot_message_self'), 400);
}

$now = time();
$message = array(
    'id' => 'm' . $now . '-' . substr(bin2hex(random_bytes(5)), 0, 10),
    'conversation_id' => wut_messages_conversation_id($user['key'], $recipientKey),
    'sender_key' => $user['key'],
    'sender_id' => $user['id'],
    'sender_name' => $user['name'],
    'recipient_key' => $recipientKey,
    'recipient_id' => $recipientId,
    'recipient_name' => $recipientName !== '' ? $recipientName : $recipientId,
    'text' => $text,
    'created_at' => $now,
    'read_at' => 0,
);

$messages = wut_messages_read();
$messages[] = $message;
if (count($messages) > 1000) {
    $messages = array_slice($messages, -1000);
}

if (!wut_messages_write($messages)) {
    wut_json(array('ok' => false, 'error' => 'write_failed'), 500);
}

wut_json(array('ok' => true, 'message' => array(
    'id' => $message['id'],
    'conversation_id' => $message['conversation_id'],
    'recipient_id' => $recipientId,
    'text' => $text,
    'created_at' => $now,
)));
