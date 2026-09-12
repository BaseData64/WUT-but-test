/* Verify that WUT uses the exact Portal Base64 action symbols. */
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var root = path.join(__dirname, "..");
var css = fs.readFileSync(path.join(root, "cafe/olv/style/olv_symbols.css"), "utf8");
var index = fs.readFileSync(path.join(root, "cafe/olv/index.html"), "utf8");
var classic = fs.readFileSync(path.join(root, "cafe/olv/style/cafe.css"), "utf8");

function fail(msg) {
    console.error("FAIL: " + msg);
    process.exit(1);
}
function ok(cond, msg) {
    if (!cond) fail(msg);
}
function dataFor(selectorText) {
    var start = css.indexOf(selectorText);
    if (start < 0) fail("missing selector " + selectorText);
    var blockEnd = css.indexOf("}", start);
    var block = css.slice(start, blockEnd + 1);
    var m = block.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    if (!m) fail("missing PNG Base64 in " + selectorText);
    return Buffer.from(m[1], "base64");
}
function sha(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

ok(index.indexOf('style/olv_symbols.css') >= 0, "index must load portal_symbols.css");
ok(classic.indexOf("WII U ACTION ICONS") < 0, "generic V7 action icon block must be removed");
ok(css.indexOf('data-wut-action="close"') >= 0, "close mapping missing");
ok(css.indexOf('data-wut-action="back"') >= 0, "back mapping missing");
ok(css.indexOf('data-wut-action="next"') >= 0, "next mapping missing");
ok(css.indexOf('data-wut-action="accept"') >= 0, "accept mapping missing");
ok(css.indexOf('data-wut-action="start"') >= 0, "start mapping missing");

var close = dataFor('#wut-setup-close[data-wut-action="close"] .wut-action-icon');
var back = dataFor('#wut-setup-close[data-wut-action="back"] .wut-action-icon');
var next = dataFor('#wut-setup-next[data-wut-action="next"] .wut-action-icon');

ok(sha(close) === "423b58dd0f896a6be73ddce35e91779e66f12db7fca3c1facfb8f2af2c2f55fa", "Close X PNG is not the exact Portal fixed-bottom exit asset");
ok(sha(back) === "b2635ca7a798a3e5e3a9fbd14aa639ed6471a0178dff23f9976990cd2ae373a1", "Back PNG is not the exact Portal asset");
ok(sha(next) === "a00fb514068d70b2964db7da76e34e9096294ba8f415119bd4811f87d1afe065", "Next PNG is not the exact Portal asset");

console.log("Portal symbol source checks passed.");
