<?php
declare(strict_types=1);

// Keep native identity state OUTSIDE Apache's public htdocs tree.
$stateDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
    . DIRECTORY_SEPARATOR
    . 'wut-native-identity';

return [
    // Local bridge secret. NOT a Nintendo/Pretendo password.
    'bridge_secret' => '95d09738537caa097224e6fe6ceee3954ad0ac2c1ced51d3bf39a547fc53ebdc',

    'state_dir' => $stateDir,
    'state_file' => $stateDir . DIRECTORY_SEPARATOR . 'current.json',
    'mii_file' => $stateDir . DIRECTORY_SEPARATOR . 'current.ffsd',

    // Native registration is considered "fresh" for this many seconds.
    'max_age_seconds' => 300,

    // Local FFL-Testing compatible renderer.
    // Keep this server-side; Wii U WebKit only receives the PNG.
    'renderer_base' => 'http://127.0.0.1:5000/miis/image.png',

    'cache_dir' => $stateDir . DIRECTORY_SEPARATOR . 'cache',
];
