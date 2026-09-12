const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const store = {};
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
  setItem(k, v) { store[k] = String(v); },
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  removeItem(k) { delete store[k]; }
};
context.window.XMLHttpRequest = function () {
  this.open = function () {};
  this.setRequestHeader = function () {};
  this.send = function () {};
};

function run(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInNewContext(code, context, { filename: rel });
}

run('cafe/olv/script/olv_store.js');
run('cafe/olv/script/olv_session.js');

let s = context.window.WUTSession;
if (!s.setGameExperience('intermediate', false)) throw new Error('failed to set intermediate');
if (s.getState().gameSkill !== 1) throw new Error('intermediate should be 1');
if (store['wut.profile.game_skill'] !== '1') throw new Error('game skill not persisted');
s.completeSetup(false);
if (store['wut.profile.setup_complete'] !== '1') throw new Error('setup completion not persisted');

// Simulate a new page load using the same localStorage.
const context2 = {
  window: {},
  document: context.document,
  console,
  encodeURIComponent,
  parseInt,
  String,
  JSON
};
context2.window.window = context2.window;
context2.window.document = context2.document;
context2.window.console = console;
context2.window.dispatchEvent = function () {};
context2.window.localStorage = context.window.localStorage;
context2.window.XMLHttpRequest = context.window.XMLHttpRequest;
function run2(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInNewContext(code, context2, { filename: rel });
}
run2('cafe/olv/script/olv_store.js');
run2('cafe/olv/script/olv_session.js');
const restored = context2.window.WUTSession.getState();
if (restored.gameSkill !== 1 || restored.gameExperience !== 'intermediate') throw new Error('game skill did not restore');
if (restored.setupComplete !== true) throw new Error('setup completion did not restore');

console.log('WUT session runtime persistence checks passed.');
