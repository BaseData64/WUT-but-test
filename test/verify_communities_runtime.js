#!/usr/bin/env node

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.resolve(__dirname, "..");
var elements = {};
var activeElement = null;

function FakeElement(id, className) {
    this.id = id || "";
    this.className = className || "";
    this.attributes = {};
    this.listeners = {};
    this.childrenByTag = {};
    this.innerHTML = "";
    this.offsetTop = 0;
    this.offsetHeight = 126;
    this.clientHeight = 488;
    this.scrollTop = 0;
}

FakeElement.prototype.setAttribute = function (name, value) {
    this.attributes[name] = String(value);
};

FakeElement.prototype.getAttribute = function (name) {
    return this.attributes[name];
};

FakeElement.prototype.getElementsByTagName = function (name) {
    return this.childrenByTag[name] || [];
};

FakeElement.prototype.addEventListener = function (name, listener) {
    this.listeners[name] = this.listeners[name] || [];
    this.listeners[name].push(listener);
};

FakeElement.prototype.focus = function () {
    var list;
    var i;

    if (activeElement === this) {
        return;
    }

    activeElement = this;
    list = this.listeners.focus || [];

    for (i = 0; i < list.length; i += 1) {
        list[i]({});
    }
};

function add(id, className) {
    var element = new FakeElement(id, className);
    elements[id] = element;
    return element;
}

var grid = add("wut-community-grid", "wut-community-grid");
var scroller = add("wut-community-scroll", "wut-community-scroll");
scroller.clientHeight = 610;
var count = add("wut-community-count", "");
var status = add("wut-community-status", "");
var items = [];
var links = [];
var goodImage = new FakeElement("good-community-image", "");
var brokenImage = new FakeElement("broken-community-image", "");
var i;

goodImage.setAttribute("src", "res/olv/commu/MarioParty10.png");
goodImage.complete = true;
goodImage.naturalWidth = 112;
brokenImage.setAttribute("src", "res/olv/community/missing.png");
brokenImage.complete = true;
brokenImage.naturalWidth = 0;
grid.childrenByTag.img = [goodImage, brokenImage];

for (i = 0; i < 10; i += 1) {
    var item = new FakeElement("community-item-" + i, "");
    var link = new FakeElement("community-link-" + i, "wut-community-card");

    item.offsetTop = i * 160;
    item.offsetHeight = 160;
    item.setAttribute("data-featured", i < 6 ? "1" : "0");
    item.setAttribute("data-favorite", i === 0 || i === 2 || i === 4 || i === 9 ? "1" : "0");
    link.setAttribute("data-community-title", i === 3 ? "Metroid Community" : "Community " + i);
    item.childrenByTag.a = [link];
    items.push(item);
    links.push(link);
}

grid.childrenByTag.li = items;

var tabs = add("wut-community-tabs", "wut-community-tabs");
var tabItems = [];
var tabButtons = [];

["featured", "all", "favorites"].forEach(function (filter) {
    var item = new FakeElement("tab-" + filter, "");
    var button = new FakeElement("button-" + filter, "");

    button.setAttribute("data-wut-community-filter", filter);
    item.childrenByTag.button = [button];
    tabItems.push(item);
    tabButtons.push(button);
});

tabs.childrenByTag.li = tabItems;
tabs.childrenByTag.button = tabButtons;

var menuBlur = 0;
var menuFocus = 0;
var document = {
    getElementById: function (id) {
        return elements[id] || null;
    }
};

var browser = {
    document: document,
    console: { log: function () {} },
    WUTPortalNav: {
        blurMenu: function () {
            menuBlur += 1;
        },
        focusMenu: function (index) {
            if (index === 2) {
                menuFocus += 1;
            }
        }
    }
};

browser.window = browser;

vm.runInNewContext(
    fs.readFileSync(
        path.join(root, "cafe", "olv", "script", "olv_communities.js"),
        "utf8"
    ),
    browser,
    { filename: "olv_communities.js" }
);

browser.WUTCommunities.start();

if (goodImage.getAttribute("src") !== "res/olv/commu/MarioParty10.png") {
    throw new Error("A valid img src was replaced by the Communities controller");
}

if (brokenImage.getAttribute("src") !== "res/olv/default-image.png") {
    throw new Error("A failed community image did not receive the local fallback");
}

if (browser.WUTCommunities.getState().visible !== 10 || count.innerHTML !== "10") {
    throw new Error("All Titles filter did not expose ten communities");
}

browser.WUTCommunities.enter();
browser.WUTCommunities.right();
browser.WUTCommunities.down();
browser.WUTCommunities.down();
browser.WUTCommunities.down();

if (browser.WUTCommunities.getState().selected !== 3 || menuBlur < 1) {
    throw new Error("Compact list GamePad movement failed");
}

browser.WUTCommunities.activate();

if (status.innerHTML.indexOf("Metroid Community selected") < 0) {
    throw new Error("Community activation did not update the view status");
}

browser.WUTCommunities.left();

if (browser.WUTCommunities.isActive() || menuFocus !== 1) {
    throw new Error("D-Pad Left did not return focus to the global menu");
}

browser.WUTCommunities.setFilter("favorites");

if (
    browser.WUTCommunities.getState().visible !== 4 ||
    count.innerHTML !== "4"
) {
    throw new Error("Favorites filter did not expose four communities");
}

console.log("Cafe OLV Communities runtime checks passed.");
