const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const common = read('net/olv/v1/_common.php');
const gateway = read('net/olv/v1/mii/_renderer.php');
const render = read('net/olv/v1/mii/render.php');
const bootstrap = read('net/olv/v1/bootstrap.php');
const config = read('net/cfg/wut.php.example');
const identityClient = read('cafe/olv/script/olv_identity.js');

assert(common.includes('function wut_store_linked_identity'), 'trusted link-session helper missing');
assert(common.includes('function wut_public_identity'), 'public identity projection missing');
assert(common.includes("'mii_data_present'"), 'browser needs safe StoreData presence metadata');
assert(!bootstrap.includes("'mii_data' =>"), 'bootstrap must not serialize raw StoreData');
assert(gateway.includes('CURLOPT_FOLLOWLOCATION, false'), 'renderer requests must not follow redirects');
assert(gateway.includes("'max_bytes'"), 'renderer response size limit missing');
assert(gateway.includes('response-too-large'), 'oversized renderer response handling missing');
assert(gateway.includes('substr($body, 0, 8)'), 'PNG signature validation missing');
assert(gateway.includes("'cache' => 'STALE'"), 'stale renderer cache fallback missing');
assert(render.includes("header('X-WUT-Mii-Cache: '"), 'cache diagnostic response header missing');
assert(render.includes('HTTP_IF_NONE_MATCH'), 'ETag revalidation missing');
assert(config.includes('mii_renderer_verify_tls'), 'TLS verification configuration missing');
assert(config.includes('mii_renderer_cache_ttl'), 'renderer cache configuration missing');
assert(identityClient.includes('wut:account-linked'), 'account-link refresh event missing');
assert(identityClient.includes('refresh: refresh'), 'identity refresh API missing');

console.log('WUT real Mii renderer gateway checks passed.');
