<?php

declare(strict_types=1);

function wut_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $path = dirname(__DIR__, 2) . '/cfg/wut.php';
    $config = array(
        'mii_renderer_base' => '',
        'mii_renderer_connect_timeout' => 4,
        'mii_renderer_timeout' => 15,
        'mii_renderer_max_bytes' => 4194304,
        'mii_renderer_cache_dir' => '',
        'mii_renderer_cache_ttl' => 3600,
        'mii_renderer_stale_ttl' => 604800,
        'mii_renderer_verify_tls' => true,
        'mii_renderer_scale' => 1,
        'allow_local_dev_identity' => false,
        'allow_browser_mii_link' => false,
        'native_identity_enabled' => false,
        'native_identity_secret' => '',
        'native_identity_max_age' => 300,
        'native_identity_state_file' => '',
        /*
         * WUT Local ServiceToken Resolver V1.
         * Development-only bridge: binds the SHA-256 of the real Miiverse
         * ServiceToken to PID + FFLStoreData captured on the same Wii U.
         */
        'local_servicetoken_resolver_enabled' => true,
        'local_servicetoken_binding_dir' => '',
        'local_servicetoken_max_age' => 21600,
    );

    if (is_file($path)) {
        $loaded = require $path;
        if (is_array($loaded)) {
            $config = array_merge($config, $loaded);
        }
    }

    return $config;
}

function wut_start_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('WUTSESSID');
        session_start();
    }
}

function wut_header(string $serverKey): string
{
    return isset($_SERVER[$serverKey]) ? trim((string) $_SERVER[$serverKey]) : '';
}

function wut_is_local_request(): bool
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    return $remote === '127.0.0.1' || $remote === '::1';
}

function wut_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function wut_identity_from_session(): array
{
    $identity = $_SESSION['wut_identity'] ?? array();

    return array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'network' => $identity['network'] ?? null,
        'account_id' => $identity['account_id'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'user_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data' => $identity['mii_data'] ?? null,
        'mii_image_url' => $identity['mii_image_url'] ?? null,
        'service_token_sha256' => $identity['service_token_sha256'] ?? null,
        'auth_assurance' => $identity['auth_assurance'] ?? null,
    );
}

function wut_public_identity(array $identity): array
{
    /*
     * Mii StoreData stays on the server. The old WebKit client only needs to
     * know that a lookup source exists; render.php consumes the real value.
     */
    return array(
        'resolved' => !empty($identity['resolved']),
        'authenticated' => !empty($identity['authenticated']),
        'source' => $identity['source'] ?? 'none',
        'network' => $identity['network'] ?? null,
        'account_id' => $identity['account_id'] ?? null,
        'pid' => $identity['pid'] ?? null,
        'user_id' => $identity['user_id'] ?? null,
        'pnid' => $identity['pnid'] ?? null,
        'mii_name' => $identity['mii_name'] ?? null,
        'mii_data_present' => !empty($identity['mii_data']),
        'mii_image_url' => $identity['mii_image_url'] ?? null,
        'auth_assurance' => $identity['auth_assurance'] ?? null,
        'service_token_bound' => !empty($identity['service_token_sha256']),
    );
}

function wut_identity_can_render(array $identity, array $config): bool
{
    if (empty($identity['resolved'])) {
        return false;
    }

    if (!empty($identity['authenticated'])) {
        return true;
    }

    return !empty($config['allow_browser_mii_link'])
        && (($identity['source'] ?? '') === 'browser-mii-link');
}

function wut_mii_lookup_source(array $identity): string
{
    if (!empty($identity['mii_data'])) {
        return 'data';
    }

    if (!empty($identity['pid'])) {
        return 'pid';
    }

    if (!empty($identity['pnid'])) {
        return 'pnid';
    }

    if (!empty($identity['mii_image_url'])) {
        return 'image_url';
    }

    return 'none';
}

function wut_mii_identity_cache_key(array $identity): ?string
{
    $source = wut_mii_lookup_source($identity);

    if ($source === 'none') {
        return null;
    }

    if ($source === 'data') {
        $value = (string) $identity['mii_data'];
    } elseif ($source === 'pid') {
        $value = (string) $identity['pid'];
    } elseif ($source === 'pnid') {
        $value = (string) $identity['pnid'];
    } else {
        $value = (string) $identity['mii_image_url'];
    }

    return substr(hash(
        'sha256',
        $source . '|' . (string) ($identity['network'] ?? '') . '|' . $value
    ), 0, 20);
}

function wut_normalize_mii_data($value): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $value = preg_replace('/\s+/', '', trim($value));
    if (!is_string($value) || $value === '' || strlen($value) > 512) {
        return null;
    }

    $decoded = false;

    if ((strlen($value) % 2) === 0 && ctype_xdigit($value)) {
        $decoded = hex2bin($value);
    } elseif (preg_match('/^[A-Za-z0-9+\/_=-]+$/', $value)) {
        $base64 = strtr($value, '-_', '+/');
        $padding = strlen($base64) % 4;
        if ($padding !== 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($base64, true);
    }

    if (!is_string($decoded)) {
        return null;
    }

    $length = strlen($decoded);
    if ($length < 46 || $length > 96) {
        return null;
    }

    return $value;
}

function wut_store_linked_identity(array $input, string $source = 'wut-account-link', bool $authenticated = true): bool
{
    $network = strtolower(trim((string) ($input['network'] ?? 'pretendo')));
    if (!in_array($network, array('pretendo', 'nintendo', 'wut'), true)) {
        $network = 'wut';
    }

    $accountId = isset($input['account_id'])
        ? substr(trim((string) $input['account_id']), 0, 32)
        : null;

    $pid = null;
    if (isset($input['pid']) && ctype_digit((string) $input['pid']) && (int) $input['pid'] > 0) {
        $pid = (string) $input['pid'];
    }

    $slot = null;
    if (isset($input['slot']) && ctype_digit((string) $input['slot'])) {
        $slotValue = (int) $input['slot'];
        if ($slotValue >= 0 && $slotValue <= 255) {
            $slot = $slotValue;
        }
    }

    $pnidWasProvided = array_key_exists('pnid', $input);

    $userId = isset($input['user_id'])
        ? substr(trim((string) $input['user_id']), 0, 32)
        : null;
    $pnid = isset($input['pnid'])
        ? substr(trim((string) $input['pnid']), 0, 32)
        : null;
    $miiName = isset($input['mii_name'])
        ? substr(trim((string) $input['mii_name']), 0, 32)
        : null;
    $miiData = wut_normalize_mii_data($input['mii_data'] ?? null);
    $miiImageUrl = null;

    if (!empty($input['mii_image_url'])) {
        $candidate = substr(trim((string) $input['mii_image_url']), 0, 2048);
        $scheme = strtolower((string) parse_url($candidate, PHP_URL_SCHEME));
        if (($scheme === 'http' || $scheme === 'https') && filter_var($candidate, FILTER_VALIDATE_URL)) {
            $miiImageUrl = $candidate;
        }
    }

    if (!$pid && !$userId && !$pnid && !$miiData && !$miiImageUrl) {
        return false;
    }

    $_SESSION['wut_identity'] = array(
        'resolved' => true,
        'authenticated' => $authenticated,
        'source' => substr($source, 0, 64),
        'network' => $network,
        'account_id' => $accountId,
        'slot' => $slot,
        'pid' => $pid,
        'user_id' => $userId ?: ($pnid ?: $accountId),
        /*
         * Important: ACT AccountId is not automatically a Pretendo PNID.
         * If a caller explicitly provides pnid=null, preserve null instead
         * of silently relabelling user_id/account_id as PNID.
         */
        'pnid' => $pnidWasProvided ? $pnid : ($pnid ?: $userId),
        'mii_name' => $miiName,
        'mii_data' => $miiData,
        'mii_image_url' => $miiImageUrl,
    );

    return true;
}

function wut_apply_local_dev_identity(array $config): void
{
    if (empty($config['allow_local_dev_identity']) || !wut_is_local_request()) {
        return;
    }

    if (($_GET['wutdev'] ?? '') !== '1') {
        return;
    }

    wut_store_linked_identity(array(
        'network' => $_GET['network'] ?? 'pretendo',
        'pid' => $_GET['pid'] ?? null,
        'user_id' => $_GET['user_id'] ?? null,
        'pnid' => $_GET['pnid'] ?? null,
        'mii_name' => $_GET['mii_name'] ?? null,
        'mii_data' => $_GET['mii_data'] ?? null,
        'mii_image_url' => $_GET['mii_image_url'] ?? null,
    ), 'local-dev-injection');
}


function wut_native_identity_state_path(array $config): string
{
    $configured = trim((string) ($config['native_identity_state_file'] ?? ''));

    if ($configured !== '') {
        return $configured;
    }

    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'wut-native-identity.json';
}

function wut_native_identity_read(array $config): ?array
{
    if (empty($config['native_identity_enabled'])) {
        return null;
    }

    $path = wut_native_identity_state_path($config);
    if (!is_file($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '' || strlen($raw) > 4096) {
        return null;
    }

    $state = json_decode($raw, true);
    if (!is_array($state)) {
        return null;
    }

    $receivedAt = isset($state['received_at']) ? (int) $state['received_at'] : 0;
    $maxAge = max(10, min(3600, (int) ($config['native_identity_max_age'] ?? 300)));

    if ($receivedAt <= 0 || abs(time() - $receivedAt) > $maxAge) {
        return null;
    }

    $accountId = trim((string) ($state['account_id'] ?? ''));
    $slot = isset($state['slot']) ? (int) $state['slot'] : -1;
    $pid = (string) ($state['pid'] ?? '');
    $persistentId = (string) ($state['persistent_id'] ?? '');
    $miiData = wut_normalize_mii_data($state['mii_data'] ?? null);

    if (
        !preg_match('/^[A-Za-z0-9._-]{1,32}\z/', $accountId) ||
        $slot < 0 || $slot > 255 ||
        !ctype_digit($pid) ||
        (int) $pid <= 0 ||
        !ctype_digit($persistentId) ||
        $miiData === null
    ) {
        return null;
    }

    return array(
        'account_id' => $accountId,
        'slot' => $slot,
        'pid' => $pid,
        'persistent_id' => $persistentId,
        'mii_data' => $miiData,
        'received_at' => $receivedAt,
    );
}

function wut_apply_native_identity(array $config): bool
{
    $native = wut_native_identity_read($config);
    if ($native === null) {
        return false;
    }

    return wut_store_linked_identity(array(
        'network' => 'pretendo',
        'account_id' => $native['account_id'],
        'slot' => $native['slot'],
        'pid' => $native['pid'],
        'user_id' => $native['account_id'],
        /*
         * Do not lie about PNID. nn::act::GetAccountId() is the ACT AccountId
         * for the active console account. Resolving the actual Pretendo PNID
         * belongs to the Miiverse ServiceToken/account-service path.
         */
        'pnid' => null,
        'mii_name' => null,
        'mii_data' => $native['mii_data'],
    ), 'wiiu-native-act');
}

/*
 * ================================================================
 * WUT Auth Probe V1
 *
 * IMPORTANT:
 * - This is a fingerprint probe, NOT token validation.
 * - Raw X-Nintendo-ServiceToken values are never written to disk,
 *   returned to JavaScript, or logged by these helpers.
 * - A SHA-256 fingerprint is useful only to prove that the applet is
 *   presenting a stable/account-specific credential.
 * ================================================================
 */

function wut_auth_probe_state_path(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'wut-service-token-probe.json';
}

function wut_auth_probe_capture_from_request(): ?array
{
    $safeTokenSha = strtolower(wut_header('HTTP_X_WUT_AUTH_SERVICE_TOKEN_SHA256'));
    $safeTokenLength = wut_header('HTTP_X_WUT_AUTH_SERVICE_TOKEN_LENGTH');
    $safeParamSha = strtolower(wut_header('HTTP_X_WUT_AUTH_PARAM_PACK_SHA256'));
    $safeParamLength = wut_header('HTTP_X_WUT_AUTH_PARAM_PACK_LENGTH');
    $safeCapturedAt = wut_header('HTTP_X_WUT_AUTH_CAPTURED_AT');
    $safeSource = wut_header('HTTP_X_WUT_AUTH_SOURCE');

    $tokenSha = '';
    $tokenLength = 0;
    $paramSha = '';
    $paramLength = 0;
    $capturedAt = time();
    $source = 'none';

    if (
        preg_match('/^[0-9a-f]{64}\z/', $safeTokenSha) &&
        ctype_digit($safeTokenLength)
    ) {
        $tokenSha = $safeTokenSha;
        $tokenLength = (int) $safeTokenLength;

        if (
            preg_match('/^[0-9a-f]{64}\z/', $safeParamSha) &&
            ctype_digit($safeParamLength)
        ) {
            $paramSha = $safeParamSha;
            $paramLength = (int) $safeParamLength;
        }

        if (ctype_digit($safeCapturedAt) && (int) $safeCapturedAt > 0) {
            $capturedAt = (int) $safeCapturedAt;
        }

        $source = $safeSource !== ''
            ? substr($safeSource, 0, 48)
            : 'proxy-safe-headers';
    } else {
        /*
         * Compatibility fallback for the old proxy.
         * We hash in memory and persist ONLY the digest/length.
         * The raw credential is never stored or returned.
         */
        $rawToken = wut_header('HTTP_X_NINTENDO_SERVICETOKEN');
        $rawParamPack = wut_header('HTTP_X_NINTENDO_PARAMPACK');

        if ($rawToken === '') {
            return null;
        }

        $tokenSha = hash('sha256', $rawToken);
        $tokenLength = strlen($rawToken);

        if ($rawParamPack !== '') {
            $paramSha = hash('sha256', $rawParamPack);
            $paramLength = strlen($rawParamPack);
        }

        $source = 'php-raw-header-fallback';
    }

    if ($tokenLength <= 0 || $tokenLength > 16384) {
        return null;
    }

    if ($paramLength < 0 || $paramLength > 32768) {
        return null;
    }

    $state = array(
        'version' => 1,
        'captured_at' => $capturedAt,
        'stored_at' => time(),
        'source' => $source,
        'service_token_present' => true,
        'service_token_sha256' => $tokenSha,
        'service_token_length' => $tokenLength,
        'param_pack_present' => $paramSha !== '',
        'param_pack_sha256' => $paramSha !== '' ? $paramSha : null,
        'param_pack_length' => $paramLength,
        /*
         * Deliberately false. A fingerprint is not authentication.
         * WUT must validate/resolve the actual service token in a later
         * trusted server-side auth step before treating it as a user.
         */
        'verified' => false,
    );

    $json = json_encode($state, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return null;
    }

    @file_put_contents(wut_auth_probe_state_path(), $json, LOCK_EX);

    return $state;
}

function wut_auth_probe_read(): ?array
{
    $path = wut_auth_probe_state_path();
    if (!is_file($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }

    $state = json_decode($raw, true);
    if (!is_array($state)) {
        return null;
    }

    $sha = strtolower((string) ($state['service_token_sha256'] ?? ''));
    if (!preg_match('/^[0-9a-f]{64}\z/', $sha)) {
        return null;
    }

    return $state;
}

function wut_auth_probe_public(?array $state): array
{
    if ($state === null) {
        return array(
            'captured' => false,
            'verified' => false,
            'service_token_present' => false,
            'param_pack_present' => false,
        );
    }

    $capturedAt = (int) ($state['captured_at'] ?? 0);

    return array(
        'captured' => true,
        'verified' => false,
        'source' => (string) ($state['source'] ?? 'unknown'),
        'captured_at' => $capturedAt > 0 ? $capturedAt : null,
        'age_seconds' => $capturedAt > 0 ? max(0, time() - $capturedAt) : null,
        'service_token_present' => true,
        'service_token_length' => (int) ($state['service_token_length'] ?? 0),
        'service_token_sha256_prefix' => substr(
            (string) ($state['service_token_sha256'] ?? ''),
            0,
            16
        ),
        'param_pack_present' => !empty($state['param_pack_present']),
        'param_pack_length' => (int) ($state['param_pack_length'] ?? 0),
        'param_pack_sha256_prefix' => !empty($state['param_pack_sha256'])
            ? substr((string) $state['param_pack_sha256'], 0, 16)
            : null,
    );
}

/*
 * ================================================================
 * WUT Auth Cutover V3 + Local ServiceToken Resolver V1
 * ================================================================
 *
 * Production intent:
 *   X-Nintendo-ServiceToken -> authorized Pretendo Account exchange
 *   -> stable PID/PNID/Mii.
 *
 * Development adapter used here:
 *   1. Inkay calls Pretendo's REAL AcquireIndependentServiceToken().
 *   2. Inkay hashes the returned token locally (SHA-256).
 *   3. Inkay binds that digest to the current ACT PID + FFLStoreData.
 *   4. The Miiverse proxy independently observes the same token and sends
 *      only its SHA-256 digest to this backend.
 *   5. WUT resolves the identity only when the two digests match.
 *
 * The raw ServiceToken is never stored by WUT and the local adapter never
 * replaces/fabricates Pretendo's credential.
 *
 * IMPORTANT: this is a LOCAL DEVELOPMENT resolver. It is not the same as
 * Pretendo server-side token validation and must not be presented as such.
 */

function wut_auth_cutover_clear_legacy_identity(): bool
{
    $identity = $_SESSION['wut_identity'] ?? null;
    if (!is_array($identity)) {
        return false;
    }

    $source = (string) ($identity['source'] ?? '');

    $legacySources = array(
        'wiiu-native-act',
        'native-act',
        'browser-mii-link',
    );

    if (!in_array($source, $legacySources, true)) {
        return false;
    }

    unset($_SESSION['wut_identity']);
    return true;
}

function wut_local_resolver_binding_dir(array $config): string
{
    $configured = trim((string) ($config['local_servicetoken_binding_dir'] ?? ''));

    if ($configured !== '') {
        return $configured;
    }

    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'wut-servicetoken-bindings';
}

function wut_local_resolver_binding_path(array $config, string $tokenSha256): ?string
{
    $tokenSha256 = strtolower(trim($tokenSha256));

    if (!preg_match('/^[0-9a-f]{64}\z/', $tokenSha256)) {
        return null;
    }

    return rtrim(
        wut_local_resolver_binding_dir($config),
        DIRECTORY_SEPARATOR
    ) . DIRECTORY_SEPARATOR . $tokenSha256 . '.json';
}

function wut_is_private_lan_request(): bool
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));

    if ($remote === '127.0.0.1' || $remote === '::1') {
        return true;
    }

    if (filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) {
        return false;
    }

    /*
     * Public IPv4 addresses survive both NO_PRIV_RANGE and NO_RES_RANGE.
     * Private/reserved LAN addresses do not.
     */
    $public = filter_var(
        $remote,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    );

    return $public === false;
}

function wut_local_resolver_store_binding(
    array $config,
    string $tokenSha256,
    string $pid,
    string $persistentId,
    int $slot,
    string $miiData
): bool {
    if (empty($config['local_servicetoken_resolver_enabled'])) {
        return false;
    }

    $tokenSha256 = strtolower(trim($tokenSha256));
    $miiData = wut_normalize_mii_data($miiData);

    if (
        !preg_match('/^[0-9a-f]{64}\z/', $tokenSha256) ||
        !ctype_digit($pid) ||
        (int) $pid <= 0 ||
        !ctype_digit($persistentId) ||
        $slot <= 0 ||
        $slot > 255 ||
        $miiData === null
    ) {
        return false;
    }

    $dir = wut_local_resolver_binding_dir($config);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false;
    }

    $path = wut_local_resolver_binding_path($config, $tokenSha256);
    if ($path === null) {
        return false;
    }

    $state = array(
        'version' => 1,
        'source' => 'wut-inkay-aist-v1',
        'token_sha256' => $tokenSha256,
        'pid' => $pid,
        'persistent_id' => $persistentId,
        'slot' => $slot,
        'mii_data' => $miiData,
        'received_at' => time(),
    );

    $json = json_encode($state, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return false;
    }

    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));

    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }

    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }

    return true;
}

function wut_local_resolver_read_binding(
    array $config,
    string $tokenSha256
): ?array {
    if (empty($config['local_servicetoken_resolver_enabled'])) {
        return null;
    }

    $path = wut_local_resolver_binding_path($config, $tokenSha256);
    if ($path === null || !is_file($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '' || strlen($raw) > 4096) {
        return null;
    }

    $state = json_decode($raw, true);
    if (!is_array($state)) {
        return null;
    }

    $storedHash = strtolower((string) ($state['token_sha256'] ?? ''));
    if (
        !preg_match('/^[0-9a-f]{64}\z/', $storedHash) ||
        !hash_equals(strtolower($tokenSha256), $storedHash)
    ) {
        return null;
    }

    $receivedAt = (int) ($state['received_at'] ?? 0);
    $maxAge = max(
        60,
        min(86400, (int) ($config['local_servicetoken_max_age'] ?? 21600))
    );

    if ($receivedAt <= 0 || abs(time() - $receivedAt) > $maxAge) {
        @unlink($path);
        return null;
    }

    $pid = (string) ($state['pid'] ?? '');
    $persistentId = (string) ($state['persistent_id'] ?? '');
    $slot = (int) ($state['slot'] ?? 0);
    $miiData = wut_normalize_mii_data($state['mii_data'] ?? null);

    if (
        !ctype_digit($pid) ||
        (int) $pid <= 0 ||
        !ctype_digit($persistentId) ||
        $slot <= 0 ||
        $slot > 255 ||
        $miiData === null
    ) {
        return null;
    }

    return array(
        'token_sha256' => $storedHash,
        'pid' => $pid,
        'persistent_id' => $persistentId,
        'slot' => $slot,
        'mii_data' => $miiData,
        'received_at' => $receivedAt,
        'source' => (string) ($state['source'] ?? 'wut-inkay-aist-v1'),
    );
}

function wut_auth_probe_sha(?array $authProbe): ?string
{
    if ($authProbe === null || empty($authProbe['service_token_present'])) {
        return null;
    }

    $sha = strtolower(trim((string) ($authProbe['service_token_sha256'] ?? '')));

    return preg_match('/^[0-9a-f]{64}\z/', $sha)
        ? $sha
        : null;
}

function wut_identity_is_local_token_bound(array $identity): bool
{
    return !empty($identity['resolved'])
        && !empty($identity['authenticated'])
        && (($identity['source'] ?? '') === 'wut-local-servicetoken')
        && (($identity['auth_assurance'] ?? '') === 'local-console-correlation');
}

function wut_identity_is_pretendo_token_verified(array $identity): bool
{
    return !empty($identity['resolved'])
        && !empty($identity['authenticated'])
        && (($identity['source'] ?? '') === 'pretendo-servicetoken');
}

function wut_auth_cutover_enforce(?array $authProbe): void
{
    wut_auth_cutover_clear_legacy_identity();

    $identity = $_SESSION['wut_identity'] ?? null;
    if (!is_array($identity)) {
        return;
    }

    $source = (string) ($identity['source'] ?? '');

    if ($source === 'local-dev-injection' && wut_is_local_request()) {
        return;
    }

    $tokenSources = array(
        'wut-local-servicetoken',
        'pretendo-servicetoken',
    );

    if (in_array($source, $tokenSources, true)) {
        $probeSha = wut_auth_probe_sha($authProbe);
        $identitySha = strtolower(trim(
            (string) ($identity['service_token_sha256'] ?? '')
        ));

        if (
            $probeSha !== null &&
            preg_match('/^[0-9a-f]{64}\z/', $identitySha) &&
            hash_equals($probeSha, $identitySha)
        ) {
            return;
        }

        /*
         * Account/token changed, token expired from probe state, or the
         * session came from a different applet credential.
         */
        unset($_SESSION['wut_identity']);
        return;
    }

    if ($authProbe !== null && !empty($authProbe['service_token_present'])) {
        /*
         * A real applet credential is present. Do not let any unrelated
         * linked identity impersonate it.
         */
        unset($_SESSION['wut_identity']);
    }
}

function wut_apply_local_servicetoken_resolver(
    ?array $authProbe,
    array $config
): bool {
    if (empty($config['local_servicetoken_resolver_enabled'])) {
        return false;
    }

    $probeSha = wut_auth_probe_sha($authProbe);
    if ($probeSha === null) {
        return false;
    }

    $binding = wut_local_resolver_read_binding($config, $probeSha);
    if ($binding === null) {
        return false;
    }

    $stored = wut_store_linked_identity(array(
        'network' => 'pretendo',
        'account_id' => null,
        'slot' => $binding['slot'],
        'pid' => $binding['pid'],
        'user_id' => 'pid:' . $binding['pid'],
        /*
         * Still do not lie about PNID. We know the PID from ACT and have an
         * exact ServiceToken correlation, but the Pretendo Account service
         * has not resolved a username/PNID for us yet.
         */
        'pnid' => null,
        'mii_name' => null,
        'mii_data' => $binding['mii_data'],
    ), 'wut-local-servicetoken', true);

    if (!$stored) {
        return false;
    }

    $_SESSION['wut_identity']['service_token_sha256'] = $probeSha;
    $_SESSION['wut_identity']['auth_assurance'] = 'local-console-correlation';
    $_SESSION['wut_identity']['persistent_id'] = $binding['persistent_id'];
    $_SESSION['wut_identity']['resolver_received_at'] = $binding['received_at'];

    return true;
}

function wut_auth_phase(?array $authProbe, array $identity): string
{
    if (wut_identity_is_pretendo_token_verified($identity)) {
        return 'resolved';
    }

    if (wut_identity_is_local_token_bound($identity)) {
        return 'local-resolver-bound';
    }

    if ($authProbe !== null && !empty($authProbe['service_token_present'])) {
        return 'servicetoken-unresolved';
    }

    return 'no-servicetoken';
}
