<?php

declare(strict_types=1);

/*
 * WUT-Miiverse server-side entry gate.
 *
 * First Run is genuinely one-time per persistent WUT account:
 * - Existing setup_complete account -> Portal immediately.
 * - Resolved identity with no account -> serve the untouched index.html.
 * - Wii U identity still resolving -> wait/retry instead of flashing First Run.
 *
 * index.html is intentionally NEVER modified by this gate.
 */

require_once dirname(__DIR__, 2) . '/net/olv/v1/_common.php';
require_once dirname(__DIR__, 2) . '/net/olv/v1/account/_common.php';

wut_start_session();
$config = wut_config();

function wut_entry_is_wiiu_request(): bool
{
    $ua = strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if (strpos($ua, 'nintendo wiiu') !== false || strpos($ua, 'miiverse') !== false) {
        return true;
    }

    /* Safe proxy headers mean this request came through the Miiverse path. */
    if (wut_header('HTTP_X_WUT_AUTH_SERVICE_TOKEN_SHA256') !== '') {
        return true;
    }
    if (wut_header('HTTP_X_NINTENDO_SERVICETOKEN') !== '') {
        return true;
    }

    return false;
}

function wut_entry_try_resolve(array $config): array
{
    /* Use ONLY the credential carried by this request. Do not import a stale
     * global auth-probe record from a previous request/account. */
    $authProbe = wut_auth_probe_capture_from_request();

    wut_auth_cutover_enforce($authProbe);
    wut_apply_local_servicetoken_resolver($authProbe, $config);

    $identity = wut_identity_from_session();
    $source = (string) ($identity['source'] ?? 'none');

    /* Local Wii U development fallback. The WUPS bridge continuously tracks
     * the current ACT account before Miiverse opens. */
    if (
        empty($identity['resolved']) ||
        $source === 'wiiu-native-act' ||
        $source === 'native-act'
    ) {
        wut_apply_native_identity($config);
    }

    wut_apply_local_dev_identity($config);

    $reconciled = wut_accounts_reconcile_current_identity();
    $identity = is_array($reconciled['identity'] ?? null)
        ? $reconciled['identity']
        : array();
    $account = is_array($reconciled['account'] ?? null)
        ? $reconciled['account']
        : null;

    return array(
        'identity' => $identity,
        'account' => $account,
        'resolved' => !empty($identity['resolved'])
            && wut_accounts_identity_key($identity) !== '',
    );
}

function wut_entry_portal_location(): string
{
    $query = (string) ($_SERVER['QUERY_STRING'] ?? '');
    return 'cafe-olv-portal.html'
        . ($query !== '' ? '?' . $query : '')
        . '#communities';
}

function wut_entry_send_no_cache(): void
{
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

function wut_entry_wait_page(): void
{
    wut_entry_send_no_cache();
    header('Content-Type: text/html; charset=UTF-8');
    header('Refresh: 1; url=entry.php');

    /* Deliberately tiny and neutral. This is NOT First Run; it exists only to
     * avoid exposing index.html while the Wii U identity is still arriving. */
    echo '<!doctype html><html><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,height=device-height,user-scalable=no">'
        . '<title>WUT-Miiverse</title>'
        . '<style>html,body{margin:0;width:100%;height:100%;background:#999;font-family:sans-serif;color:#fff}'
        . '#w{position:absolute;top:45%;left:0;width:100%;text-align:center;font-size:20px;text-shadow:0 1px 1px #555}</style>'
        . '</head><body><div id="w">Opening WUT-Miiverse...</div></body></html>';
}

$isWiiU = wut_entry_is_wiiu_request();
$result = array('identity' => array(), 'account' => null, 'resolved' => false);

/* Small server-side race guard. The bridge/proxy normally resolves before
 * this request, but opening Miiverse immediately after an account switch can
 * race its 3-second watcher. Existing users must not see First Run meanwhile. */
$attempts = $isWiiU ? 6 : 1;
for ($i = 0; $i < $attempts; ++$i) {
    $result = wut_entry_try_resolve($config);

    if (!empty($result['resolved'])) {
        break;
    }

    if ($i + 1 < $attempts) {
        usleep(200000); // 200 ms; max ~1 second total.
    }
}

$account = $result['account'];
if ($account !== null && !empty($account['setup_complete'])) {
    /* This response happens before a single byte of index.html is sent. */
    wut_entry_send_no_cache();
    header('Location: ' . wut_entry_portal_location(), true, 302);
    exit;
}

if ($isWiiU && empty($result['resolved'])) {
    /* Never guess "new user" from a temporarily unresolved console. */
    wut_entry_wait_page();
    exit;
}

/* New resolved WUT user (or desktop dev preview): serve the ORIGINAL file.
 * Do not duplicate or mutate its markup. */
$firstRun = __DIR__ . '/index.html';
if (!is_file($firstRun)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'WUT First Run document is missing.';
    exit;
}

wut_entry_send_no_cache();
header('Content-Type: text/html; charset=UTF-8');
readfile($firstRun);
