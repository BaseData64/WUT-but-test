<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$htaccess = file_get_contents($root . '/cafe/olv/.htaccess');
$entry = file_get_contents($root . '/cafe/olv/entry.php');
$index = file_get_contents($root . '/cafe/olv/index.html');

function gate_check(bool $ok, string $message): void {
    if (!$ok) {
        throw new RuntimeException($message);
    }
}

gate_check(is_string($htaccess), '.htaccess missing');
gate_check(strpos($htaccess, 'DirectoryIndex entry.php') !== false, 'Directory entry does not use entry.php');
gate_check(strpos($htaccess, 'RewriteRule ^index\\.html$ entry.php') !== false, 'Direct index.html is not intercepted');
gate_check(is_string($entry), 'entry.php missing');
gate_check(strpos($entry, "['setup_complete']") !== false, 'Gate does not check persistent setup_complete');
gate_check(strpos($entry, "header('Location: '") !== false, 'Gate does not server-redirect existing accounts');
gate_check(strpos($entry, "readfile(\$firstRun)") !== false, 'New users are not served the original First Run');
gate_check(strpos($index, '<div id="wut-cafe-stage"') !== false, 'First Run index fixture changed unexpectedly');

echo "RESULTADO: server-side one-time First Run gate structure passed.\n";
