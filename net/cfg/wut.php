<?php
/*
 * WUT local runtime configuration.
 *
 * Set WUT_MII_RENDERER_BASE in Apache/PHP environment, or edit the value
 * below, after running ariankordi/nwf-mii-cemu-toy + FFL-Testing locally.
 * Example: http://127.0.0.1:8080
 */
return array(
    'mii_renderer_base' => getenv('WUT_MII_RENDERER_BASE') ?: '',
    'allow_local_dev_identity' => true,
);
