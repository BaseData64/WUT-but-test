<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';

$state = wut_auth_probe_read();

wut_json(array(
    'ok' => true,
    'probe' => wut_auth_probe_public($state),
    'meaning' => array(
        'fingerprint_only' => true,
        'authenticated_identity' => false,
        'note' => 'A changing ServiceToken fingerprint proves account-bound applet credentials are reaching WUT. It does not yet resolve or verify a PNID/PID.',
    ),
));
