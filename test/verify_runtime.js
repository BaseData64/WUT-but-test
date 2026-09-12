const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function ok(v, m) { if (!v) { throw new Error(m); } }
const html = read("cafe/olv/index.html");
const scripts = ["olv_store.js", "olv_session.js", "olv_identity.js", "olv_mii.js", "cafe_input.js", "olv_nav.js", "olv_setup.js"];
const styles = ["cafe.css", "olv_symbols.css", "olv_setup.css"];
scripts.forEach(function (n) { ok(html.indexOf("script/" + n) >= 0, "missing script " + n); });
styles.forEach(function (n) { ok(html.indexOf("style/" + n) >= 0, "missing style " + n); });
scripts.forEach(function (n) {
    const s = read("cafe/olv/script/" + n);
    ok(!/\b(?:let|const)\b|=>|\?\.|\basync\b|\bawait\b/.test(s), "modern JS token in " + n);
});
ok(html.indexOf("res/olv/welcome/welcome1.png") >= 0, "asset path not migrated");
console.log("Cafe OLV runtime checks passed.");
