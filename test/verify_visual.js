const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function ok(v, m) { if (!v) { throw new Error(m); } }
const html = read("cafe/olv/index.html");
const css = read("cafe/olv/style/olv_setup.css");
const symbols = read("cafe/olv/style/olv_symbols.css");
ok(html.indexOf("WUT Cafe OLV") >= 0, "dev title missing");
ok(css.indexOf("#58bf00") >= 0, "Miiverse green title treatment missing");
ok(css.indexOf("rgba(92, 199, 240") >= 0 || css.indexOf("rgba(89, 199, 240") >= 0 || css.indexOf("rgba(90, 199, 240") >= 0 || css.indexOf("rgba(78,190,233") >= 0, "sky-blue selected treatment missing");
ok(symbols.indexOf("data:image/png;base64,") >= 0, "Base64 Portal symbols missing");
ok(symbols.indexOf("data-wut-action=\"close\"") >= 0, "Close symbol selector missing");
console.log("Cafe OLV visual checks passed.");
