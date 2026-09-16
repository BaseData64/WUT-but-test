const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const config = read('net/cfg/wut.php');
const common = read('net/olv/v1/_common.php');
const endpoint = read('net/olv/v1/mii/link.php');
const render = read('net/olv/v1/mii/render.php');
const page = read('cafe/olv/mii-link.html');
const client = read('cafe/olv/script/olv_mii_link.js');
const css = read('cafe/olv/style/olv_mii_link.css');
const setup = read('cafe/olv/script/olv_setup.js');
const portal = read('cafe/olv/cafe-olv-portal.html');

assert(config.includes('https://mii-unsecure.ariankordi.net'), 'prototype renderer default missing');
assert(config.includes("'allow_browser_mii_link' => true"), 'browser Mii link is not enabled');
assert(common.includes('function wut_identity_can_render'), 'visual-link render gate missing');
assert(common.includes("'authenticated' => $authenticated"), 'visual link cannot stay unauthenticated');
assert(endpoint.includes('hash_equals'), 'Mii link CSRF validation missing');
assert(endpoint.includes("'browser-mii-link', false"), 'browser link must not claim authentication');
assert(endpoint.indexOf('wut_mii_fetch_render') < endpoint.indexOf('wut_store_linked_identity'), 'Mii must be tested before session commit');
assert(endpoint.includes("'mii_not_found'"), 'not-found feedback missing');
assert(render.includes('wut_identity_can_render'), 'PNG gateway rejects browser-linked sessions');
assert(page.includes('id="wut-mii-link-form"'), 'Mii link form missing');
assert(page.includes('script/olv_mii_link.js'), 'Mii link client missing');
assert(!setup.includes('portalUrl = "mii-link.html"'), 'First Run still forces the manual Mii-link page');
assert(setup.includes('cafe-olv-portal.html'), 'First Run no longer opens the Portal');
assert(!/\b(?:let|const)\b|=>|\?\.|\basync\b|\bawait\b/.test(client), 'modern JS token in Mii linker');
assert(!/display\s*:\s*(?:flex|grid)/i.test(css), 'modern layout in Mii link CSS');

function FakeElement(id, tagName) {
  this.id = id;
  this.tagName = String(tagName || 'div').toUpperCase();
  this.className = '';
  this.value = '';
  this.innerHTML = '';
  this.disabled = false;
  this.listeners = {};
  this.src = '';
  this.onload = null;
  this.onerror = null;
}
FakeElement.prototype.addEventListener = function (name, handler) {
  this.listeners[name] = handler;
};

const elements = {};
function element(id, tagName) {
  const item = new FakeElement(id, tagName);
  elements[id] = item;
  return item;
}

const network = element('wut-link-network', 'select');
const pnid = element('wut-link-pnid', 'input');
const name = element('wut-link-name', 'input');
const form = element('wut-mii-link-form', 'form');
const back = element('wut-link-back', 'button');
const connect = element('wut-link-connect', 'button');
const action = element('wut-link-action-label', 'span');
const status = element('wut-link-status', 'p');
const image = element('wut-link-mii', 'img');
const previewName = element('wut-link-preview-name', 'strong');
const previewNetwork = element('wut-link-preview-network', 'small');
const controls = [network, pnid, name, back, connect];

network.value = 'pretendo';

const document = {
  readyState: 'complete',
  activeElement: null,
  getElementById: function (id) { return elements[id] || null; },
  querySelectorAll: function () { return controls; },
  addEventListener: function () {}
};

FakeElement.prototype.focus = function () {
  if (document.activeElement === this) return;
  document.activeElement = this;
  if (this.listeners.focus) this.listeners.focus({ target: this });
};

let postBody = '';
function FakeXHR() {
  this.readyState = 0;
  this.status = 0;
  this.responseText = '';
  this.onreadystatechange = null;
  this.method = '';
}
FakeXHR.prototype.open = function (method) {
  this.method = method;
};
FakeXHR.prototype.setRequestHeader = function () {};
FakeXHR.prototype.send = function (body) {
  this.readyState = 4;
  this.status = 200;

  if (this.method === 'GET') {
    this.responseText = JSON.stringify({
      ok: true,
      csrf_token: 'csrf-test-token',
      link: { enabled: true, renderer_configured: true, renderable: false }
    });
  } else {
    postBody = body;
    this.responseText = JSON.stringify({
      ok: true,
      csrf_token: 'rotated-token',
      link: {
        enabled: true,
        renderer_configured: true,
        renderable: true,
        network: 'pretendo',
        pnid: 'CafeTester',
        mii_name: 'Cafe Mii',
        cache_key: 'safe-cache-key'
      }
    });
  }

  if (this.onreadystatechange) this.onreadystatechange();
};

const window = {
  location: { href: 'mii-link.html' },
  XMLHttpRequest: FakeXHR,
  addEventListener: function () {}
};

const context = {
  window,
  document,
  XMLHttpRequest: FakeXHR,
  JSON,
  Date,
  String,
  encodeURIComponent,
  console
};
vm.runInNewContext(client, context, { filename: 'olv_mii_link.js' });

assert(status.innerHTML.includes('Renderer ready'), 'initial renderer state was not shown');
assert(document.activeElement === connect, 'Connect button was not initially focused');

pnid.value = 'CafeTester';
name.value = 'Cafe Mii';
window.WUTPortalNav.activate();

assert(postBody.includes('csrf_token=csrf-test-token'), 'CSRF token was not posted');
assert(postBody.includes('pnid=CafeTester'), 'PNID was not posted');
assert(image.src.includes('../../net/olv/v1/mii/render.php'), 'same-origin PNG gateway was not used');
assert(!image.src.includes('CafeTester'), 'Mii image URL exposes the PNID');
assert(action.innerHTML === 'Open Portal', 'successful link did not change the primary action');

image.onload();
assert(status.innerHTML.includes('Mii connected'), 'successful PNG load was not reported');

window.WUTPortalNav.activate();
assert(window.location.href === 'cafe-olv-portal.html', 'linked flow did not open the Portal');

console.log('WUT Wii U browser Mii-link checks passed.');
