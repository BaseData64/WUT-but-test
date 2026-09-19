#!/usr/bin/env node

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.resolve(__dirname, "..");
var elements = {};

function FakeElement(id, className) {
    this.id = id || "";
    this.className = className || "";
    this.attributes = {};
    this.listeners = {};
    this.childrenByTag = {};
    this.scrollTop = 0;
    this.clientHeight = 574;
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

function add(id, className) {
    var element = new FakeElement(id, className);
    elements[id] = element;
    return element;
}

var plaza = add("wut-communities-view", "wut-portal-panel");
var items = [];
var links = [];
var menuBlur = 0;
var menuFocus = 0;
var i;

for (i = 0; i < 10; i += 1) {
    var item = new FakeElement("community-item-" + i, "wut-community-entry");
    var link = new FakeElement("community-link-" + i, "wut-community-card");

    link.setAttribute("data-community-title", "Community " + i);
    item.childrenByTag.a = [link];
    items.push(item);
    links.push(link);
}

plaza.childrenByTag.div = items;

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

if (browser.WUTCommunities.getState().visible !== 10) {
    throw new Error("Plaza did not expose all ten standalone communities");
}

browser.WUTCommunities.enter();
browser.WUTCommunities.down();
browser.WUTCommunities.down();
browser.WUTCommunities.down();
browser.WUTCommunities.down();

if (browser.WUTCommunities.getState().selected !== 4 || menuBlur < 1) {
    throw new Error("Plaza D-Pad movement failed");
}

if ((" " + items[4].className + " ").indexOf(" wut-community-focused ") < 0) {
    throw new Error("Selected community did not receive the focus class");
}

browser.WUTCommunities.activate();
if ((" " + items[4].className + " ").indexOf(" wut-community-opened ") < 0) {
    throw new Error("Community activation did not mark the selected community");
}

browser.WUTCommunities.left();
if (browser.WUTCommunities.isActive() || menuFocus !== 1) {
    throw new Error("D-Pad Left did not return to the global menu");
}

console.log("Cafe OLV standalone Plaza runtime checks passed.");
