<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/_common.php';

$config = wut_config();
$probe = wut_auth_probe_read();
$probeSha = wut_auth_probe_sha($probe);
$binding = $probeSha !== null
    ? wut_local_resolver_read_binding($config, $probeSha)
    : null;

wut_json(array(
    'ok' => true,
    'enabled' => !empty($config['local_servicetoken_resolver_enabled']),
    'current_probe_present' => $probeSha !== null,
    'current_probe_sha256_prefix' => $probeSha !== null
        ? substr($probeSha, 0, 16)
        : null,
    'binding_match' => $binding !== null,
    'binding' => $binding !== null ? array(
        'source' => $binding['source'],
        'pid' => $binding['pid'],
        'slot' => $binding['slot'],
        'mii_data_present' => !empty($binding['mii_data']),
        'age_seconds' => max(0, time() - (int) $binding['received_at']),
        'pretendo_verified' => false,
    ) : null,
));
