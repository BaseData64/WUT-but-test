#!/usr/bin/env node

"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var portal = path.join(root, "cafe", "olv");
var html = fs.readFileSync(path.join(portal, "cafe-olv-portal.html"), "utf8");
var css = fs.readFileSync(path.join(portal, "style", "olv_portal.css"), "utf8");
var js = fs.readFileSync(path.join(portal, "script", "olv_portal.js"), "utf8");
var communitiesJs = fs.readFileSync(
    path.join(portal, "script", "olv_communities.js"),
    "utf8"
);
var communitiesCss = fs.readFileSync(
    path.join(portal, "style", "olv_communities.css"),
    "utf8"
);
var sectionsJs = fs.readFileSync(
    path.join(portal, "script", "olv_sections.js"),
    "utf8"
);
var sectionsCss = fs.readFileSync(
    path.join(portal, "style", "olv_sections.css"),
    "utf8"
);
var setup = fs.readFileSync(path.join(portal, "script", "olv_setup.js"), "utf8");

function ok(value, message) {
    if (!value) {
        throw new Error(message);
    }
}

function iconData(selector) {
    var start = css.indexOf(selector);
    var end;
    var match;

    ok(start >= 0, "Missing selector: " + selector);
    end = css.indexOf("}", start);
    match = css.slice(start, end).match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    ok(match, "Missing Portal PNG in: " + selector);
    return Buffer.from(match[1], "base64");
}

function sha(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

[
    "global-menu-mymenu",
    "global-menu-feed",
    "global-menu-community",
    "global-menu-message",
    "global-menu-news",
    "global-menu-exit"
].forEach(function (id) {
    ok(html.indexOf('id="' + id + '"') >= 0, "Missing global menu item: " + id);
});

ok(html.indexOf('class="selected wut-focused"') >= 0, "Activity Feed must boot selected");
ok(html.indexOf('res/olv/mii/img_unknown_MiiIcon.png') >= 0, "Missing local Mii fallback");
ok(html.indexOf('style/olv_communities.css') >= 0, "Communities CSS is not loaded");
ok(html.indexOf('script/olv_communities.js') >= 0, "Communities controller is not loaded");
ok(html.indexOf('style/olv_sections.css') >= 0, "Portal sections CSS is not loaded");
ok(html.indexOf('script/olv_sections.js') >= 0, "Portal sections controller is not loaded");
["wut-user-page-view", "wut-activity-feed-view", "wut-communities-view", "wut-messages-view", "wut-notifications-view"].forEach(function (id) {
    ok(html.indexOf('id="' + id + '"') >= 0, "Missing Portal view: " + id);
});
ok((html.match(/data-wut-focus-item="1"/g) || []).length >= 16, "Portal demo views are not navigable");
ok((html.match(/data-community-index=/g) || []).length === 10, "Expected ten community slots");
ok(html.indexOf("data-wut-image=") < 0, "Legacy image URL override is still present");
ok((html.match(/class="wut-community-icon">\s*<img[^>]*onerror=/g) || []).length === 10, "Every community image needs a direct fallback");
ok(html.indexOf('src="res/olv/commu/MarioParty10.png"') >= 0, "Mario Party demo URL was not preserved");
ok(html.indexOf('class="wut-community-dev-panel"') < 0, "Discarded demo panel is still present");
ok(html.indexOf('class="wut-community-toolbar"') < 0, "Discarded toolbar card is still present");
ok(html.indexOf('class="wut-community-demo-strip"') >= 0, "Flat Cafe OLV demo strip is missing");
ok(setup.indexOf('"cafe-olv-portal.html" + search') >= 0, "First Run Start is not connected to Portal");
ok(!/\b(?:let|const)\b|=>|\?\.|\basync\b|\bawait\b/.test(js), "Modern JS token in olv_portal.js");
ok(!/\b(?:let|const)\b|=>|\?\.|\basync\b|\bawait\b/.test(communitiesJs), "Modern JS token in olv_communities.js");
ok(!/\b(?:let|const)\b|=>|\?\.|\basync\b|\bawait\b/.test(sectionsJs), "Modern JS token in olv_sections.js");
ok(communitiesJs.indexOf('getAttribute("data-wut-image")') < 0, "Controller still overrides image src");
ok(communitiesCss.indexOf("display: grid") < 0, "CSS Grid must not be required by Communities");
ok(communitiesCss.indexOf("display: flex") < 0, "Flexbox must not be required by Communities");
ok(sectionsCss.indexOf("display: grid") < 0, "CSS Grid must not be required by Portal sections");
ok(sectionsCss.indexOf("display: flex") < 0, "Flexbox must not be required by Portal sections");
ok(sectionsJs.indexOf("XMLHttpRequest") < 0, "Demo sections must not impersonate the clone backend");
ok(communitiesCss.indexOf("width: 112px") >= 0, "Square artwork slots are missing");
ok(communitiesCss.indexOf("width: 1102px") >= 0, "Full-width single-column directory is missing");
ok(communitiesCss.indexOf("background: transparent") >= 0, "Community view must expose the Portal background");
ok(css.indexOf("__PORTAL_") < 0, "Unresolved Portal CSS placeholder");

ok(
    sha(iconData("#global-menu-feed a")) ===
        "8095b9837127d2856e80ebb7c410c1dc7714737bbbd76af49f3f4c99f7ef625d",
    "Activity Feed icon does not match the supplied Portal source"
);

console.log("Cafe OLV Portal shell checks passed.");
