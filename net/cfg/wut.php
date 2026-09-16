<?php
/*
 * WUT local runtime configuration.
 *
 * Set WUT_MII_RENDERER_BASE in Apache/PHP environment, or edit the value
 * below, after running ariankordi/nwf-mii-cemu-toy + FFL-Testing locally.
 * Example: http://127.0.0.1:8080
 */
return array(
    'mii_renderer_base' => getenv('WUT_MII_RENDERER_BASE') ?: 'https://mii-unsecure.ariankordi.net',

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
    'allow_browser_mii_link' => true, // Optional manual fallback; Auto-Mii is preferred.

    /* Native Wii U account/Mii bridge (local development). */
    'native_identity_enabled' => true,
    'native_identity_secret' => '1a1298059f613adddb70bce21b75abc5b6c42dba29fa5f53fe9a0a20c717cc68',
    'native_identity_max_age' => 21600,
    'native_identity_state_file' => '', // Empty = system temp/wut-native-identity.json
);
