<?php

declare(strict_types=1);

require dirname(__DIR__) . '/_common.php';
require __DIR__ . '/_renderer.php';

wut_start_session();
$identity = wut_identity_from_session();
$settings = wut_mii_renderer_settings(wut_config());
$source = wut_mii_lookup_source($identity);

wut_json(array(
    'ok' => true,
    'gateway' => array(
        'contract' => 'ariankordi-nwf-mii-cemu-toy',
        'endpoint' => '/miis/image.png',
        'configured' => !empty($settings['configured']),
        'wii_u_preset' => array(
            'shader_type' => 'wiiu',
            'resource_type' => 'middle',
            'view_type' => 'face',
            'scale' => $settings['scale'],
        ),
    ),
    'identity' => array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'render_source' => $source,
        'renderable' => in_array($source, array('data', 'pid', 'pnid'), true),
        'cache_key' => wut_mii_identity_cache_key($identity),
    ),
    'cache' => array(
        'enabled' => $settings['cache_ttl'] > 0,
        'ttl_seconds' => $settings['cache_ttl'],
        'stale_if_error_seconds' => $settings['stale_ttl'],
    ),
));
