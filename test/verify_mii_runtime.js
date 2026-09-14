const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const context = {
  window: {},
  document: { createEvent() { return { initEvent() {} }; } },
  console,
  encodeURIComponent,
  parseInt,
  String,
  JSON
};

context.window.window = context.window;
context.window.document = context.document;
context.window.console = console;
context.window.dispatchEvent = function () {};
context.window.localStorage = {
  setItem() {},
  getItem() { return null; },
  removeItem() {}
};
context.window.XMLHttpRequest = function () {
  this.open = function () {};
  this.setRequestHeader = function () {};
  this.send = function () {};
};

function run(rel) {
  vm.runInNewContext(
    fs.readFileSync(path.join(root, rel), 'utf8'),
    context,
    { filename: rel }
  );
}

run('cafe/olv/script/olv_store.js');
run('cafe/olv/script/olv_session.js');
run('cafe/olv/script/olv_mii.js');

context.window.WUTSession.mergeIdentity({
  identity: {
    resolved: true,
    authenticated: true,
    source: 'wut-account-link',
    network: 'pretendo',
    pid: '1234567890',
    pnid: 'CafeTester',
    mii_name: 'Cafe Mii',
    mii_data_present: true,
    mii_image_url: 'https://example.invalid/fallback.png'
  },
  mii: {
    renderer_configured: true,
    renderable: true,
    render_source: 'data',
    cache_key: '0123456789abcdefabcd',
    proxy_url: '../../net/olv/v1/mii/render.php',
    status_url: '../../net/olv/v1/mii/status.php'
  }
});

const state = context.window.WUTSession.getState();
if (Object.prototype.hasOwnProperty.call(state, 'miiData')) {
  throw new Error('public session must not expose raw Mii data');
}
if (!state.miiDataPresent || !state.miiRenderable) {
  throw new Error('safe Mii render metadata was not merged');
}

const url = context.window.WUTMii.currentUserImageURL(128, 'face', 'normal');
if (!url || !url.includes('mii/render.php?')) throw new Error('same-origin Mii proxy was not selected');
if (!url.includes('width=128')) throw new Error('Mii width missing');
if (!url.includes('type=face')) throw new Error('Mii type missing');
if (!url.includes('expression=normal')) throw new Error('Mii expression missing');
if (!url.includes('v=0123456789abcdefabcd')) throw new Error('Mii cache version missing');
if (url.includes('CafeTester') || url.includes('1234567890')) {
  throw new Error('client Mii URL must not expose linked identifiers');
}

const image = {
  src: '',
  attrs: {},
  setAttribute(name, value) { this.attrs[name] = value; }
};
if (!context.window.WUTMii.bindImage(image, 'unknown.png', 96, 'face')) {
  throw new Error('linked Mii did not bind');
}
image.onerror();
if (image.src !== 'https://example.invalid/fallback.png') {
  throw new Error('direct linked image was not used as secondary fallback');
}
image.onerror();
if (image.src !== 'unknown.png') throw new Error('local placeholder fallback missing');

console.log('WUT Mii client runtime checks passed.');
