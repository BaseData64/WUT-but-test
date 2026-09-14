const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const session = read('cafe/olv/script/olv_session.js');
const identity = read('cafe/olv/script/olv_identity.js');
const mii = read('cafe/olv/script/olv_mii.js');
const firstRun = read('cafe/olv/script/olv_setup.js');
const html = read('cafe/olv/index.html');
const bootstrap = read('net/olv/v1/bootstrap.php');
const setup = read('net/olv/v1/profile/setup.php');
const render = read('net/olv/v1/mii/render.php');
const renderer = read('net/olv/v1/mii/_renderer.php');
const rendererStatus = read('net/olv/v1/mii/status.php');

assert(session.includes('beginner: 0'), 'Beginner must map to 0');
assert(session.includes('intermediate: 1'), 'Intermediate must map to 1');
assert(session.includes('expert: 2'), 'Expert must map to 2');
assert(firstRun.includes('WUTSession.setGameExperience'), 'First Run must persist game skill');
assert(firstRun.includes('WUTSession.completeSetup'), 'First Run must persist completion');
assert(html.includes('script/olv_store.js'), 'storage JS must load');
assert(html.includes('script/olv_session.js'), 'session JS must load');
assert(html.includes('script/olv_identity.js'), 'identity JS must load');
assert(html.includes('script/olv_mii.js'), 'mii JS must load');
assert(bootstrap.includes('HTTP_X_NINTENDO_SERVICETOKEN'), 'bootstrap must detect ServiceToken');
assert(bootstrap.includes('HTTP_X_NINTENDO_PARAMPACK'), 'bootstrap must detect ParamPack');
assert(!bootstrap.includes("'service_token' => $serviceToken"), 'raw ServiceToken must not be returned');
assert(bootstrap.includes('wut_public_identity($identity)'), 'bootstrap must use the public identity projection');
assert(!bootstrap.includes("'identity' => $identity"), 'raw server identity must not be returned');
assert(setup.includes("array('0', '1', '2')"), 'server must validate game skill 0..2');
assert(renderer.includes("'/miis/image.png?'"), 'Mii gateway must target renderer image endpoint');
assert(renderer.includes("$query['api_id'] = 1"), 'Pretendo Mii lookup must use api_id=1');
assert(renderer.includes("'shaderType' => 'wiiu'"), 'Mii gateway must select the Wii U shader');
assert(renderer.includes("'resourceType' => 'middle'"), 'Mii gateway must select Wii U-era resources');
assert(renderer.includes('wut_mii_is_png'), 'Mii gateway must validate PNG output');
assert(rendererStatus.includes("'contract' => 'ariankordi-nwf-mii-cemu-toy'"), 'Mii status must expose the adapter contract');
assert(mii.includes('miiProxyUrl'), 'client Mii adapter must use same-origin proxy');
assert(mii.includes('miiCacheKey'), 'client Mii adapter must version linked icons');

console.log('WUT session/Mii bootstrap checks passed.');
