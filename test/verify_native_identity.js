const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(ok, message) { if (!ok) throw new Error(message); }

const config = read('net/cfg/wut.php');
const common = read('net/olv/v1/_common.php');
const bootstrap = read('net/olv/v1/bootstrap.php');
const register = read('net/olv/v1/native/register.php');
const status = read('net/olv/v1/native/status.php');
const plugin = read('native/WUTIdentityBridge/src/main.cpp');
const setup = read('cafe/olv/script/olv_setup.js');

assert(config.includes("'native_identity_enabled' => true"), 'native identity is not enabled');
assert(config.includes('https://mii-unsecure.ariankordi.net'), 'automatic renderer fallback missing');
assert(common.includes('function wut_apply_native_identity'), 'native session importer missing');
assert(bootstrap.includes('wut_apply_native_identity($config);'), 'bootstrap does not import native identity');
assert(register.includes('hash_equals'), 'native bridge secret is not checked');
assert(register.includes('wut_normalize_mii_data'), 'native Mii data is not validated');
assert(status.includes("'mii_data_present' => true"), 'native status does not report Mii data');
assert(plugin.includes('nn::act::GetAccountId'), 'plugin does not read account ID');
assert(plugin.includes('nn::act::GetPrincipalId'), 'plugin does not read PID');
assert(plugin.includes('nn::act::GetPersistentId'), 'plugin does not read persistent ID');
assert(plugin.includes('nn::act::GetMii'), 'plugin does not read FFLStoreData');
assert(plugin.includes('static_assert(sizeof(FFLStoreData) == 96'), 'plugin does not enforce 96-byte FFLStoreData');
assert(!setup.includes('portalUrl = "mii-link.html"'), 'First Run still forces manual Mii linking');
console.log('WUT native Auto-Mii static checks passed.');
