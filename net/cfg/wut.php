<?php
/*
 * WUT local runtime configuration.
 *
 * This prototype falls back to Arian Kordi's public FFL renderer so the Wii U
 * browser link works after copying WUT into XAMPP. Set WUT_MII_RENDERER_BASE
 * in Apache/PHP, or edit the value below, to use a self-hosted renderer.
 * Example: http://127.0.0.1:8080
 */
return array(
    /*
     * Ready-to-test default for the WUT prototype. A production server should
     * override this with its own FFL renderer through the environment.
     */
    'mii_renderer_base' => getenv('WUT_MII_RENDERER_BASE')
        ?: 'https://mii-unsecure.ariankordi.net',

    /* Network and cache limits for the server-side renderer gateway. */
    'mii_renderer_connect_timeout' => 4,
    'mii_renderer_timeout' => 15,
    'mii_renderer_max_bytes' => 4 * 1024 * 1024,
    'mii_renderer_cache_dir' => '', // Empty = system temp/wut-mii-cache.
    'mii_renderer_cache_ttl' => 3600,
    'mii_renderer_stale_ttl' => 7 * 24 * 3600,
    'mii_renderer_verify_tls' => true,

    /* 1 matches the Wii U-era no-supersampling presentation. */
    'mii_renderer_scale' => 1,

    'allow_local_dev_identity' => true,

    /* Visual Mii selection remains available only as an off-device debug fallback. */
    'allow_browser_mii_link' => true,

    /*
     * Native Wii U identity bridge (LOCAL REVIVAL).
     * This key must exactly match BRIDGE_KEY in wut_portal_proxy.py.
     */
    'allow_native_identity_bridge' => true,
    'native_identity_bridge_key' => '__WUT_BRIDGE_KEY__',
);
