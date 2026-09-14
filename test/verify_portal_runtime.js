#!/usr/bin/env node

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.resolve(__dirname, "..");
var elements = {};
var activeElement = null;

function FakeElement(id, className) {
    this.id = id;
    this.className = className || "";
    this.attributes = {};
    this.listeners = {};
    this.childrenByTag = {};
    this.innerHTML = "";
    this.style = {};
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

function addMenu(id, view, action) {
    var element = add(id, "");
    var link = new FakeElement(id + "-link", "");

    if (view) {
        link.setAttribute("data-wut-view", view);
    }

    if (action) {
        link.setAttribute("data-wut-action", action);
    }

    element.childrenByTag.a = [link];
    return element;
}

add("wut-portal-stage", "");
add("page-title", "");
add("wut-portal-view-message", "");
add("wut-portal-view", "");
add("wut-global-menu-mii", "");
add("wut-user-page-view", "wut-portal-panel none");
add("wut-activity-feed-view", "wut-portal-panel");
add("wut-communities-view", "wut-portal-panel none");
add("wut-messages-view", "wut-portal-panel none");
add("wut-notifications-view", "wut-portal-panel none");
addMenu("global-menu-mymenu", "user-page", null);
addMenu("global-menu-feed", "activity-feed", null);
addMenu("global-menu-community", "communities", null);
addMenu("global-menu-message", "messages", null);
addMenu("global-menu-news", "notifications", null);
addMenu("global-menu-exit", null, "close");

var documentListeners = {};
var windowListeners = {};
var inputStarts = 0;
var miiBindings = 0;
var sectionStarts = 0;
var sectionShown = [];
var sectionActive = false;
var sectionMoves = 0;
var sectionLeaves = 0;
var fakeClock = 0;

function FakeDate() {}

FakeDate.prototype.getTime = function () {
    fakeClock += 250;
    return fakeClock;
};

var document = {
    readyState: "complete",
    title: "",
    documentElement: {
        clientWidth: 854,
        clientHeight: 480
    },
    getElementById: function (id) {
        return elements[id] || null;
    },
    addEventListener: function (name, listener) {
        documentListeners[name] = listener;
    }
};

var browser = {
    document: document,
    innerWidth: 854,
    innerHeight: 480,
    Date: FakeDate,
    console: { log: function () {} },
    WUTCafeInput: {
        start: function () {
            inputStarts += 1;
        }
    },
    WUTMii: {
        bindImage: function () {
            miiBindings += 1;
            return true;
        }
    },
    WUTPortalSections: {
        start: function () {
            sectionStarts += 1;
        },
        show: function (viewName) {
            sectionShown.push(viewName);
            sectionActive = false;
            return viewName !== "communities";
        },
        enter: function () {
            sectionActive = true;
            return true;
        },
        leave: function () {
            sectionActive = false;
            sectionLeaves += 1;
            return true;
        },
        isActive: function () {
            return sectionActive;
        },
        left: function () {
            sectionActive = false;
            sectionLeaves += 1;
            return true;
        },
        right: function () {
            return sectionActive;
        },
        up: function () {
            sectionMoves += 1;
            return true;
        },
        down: function () {
            sectionMoves += 1;
            return true;
        },
        activate: function () {
            return true;
        }
    },
    addEventListener: function (name, listener) {
        windowListeners[name] = listener;
    }
};

browser.window = browser;

vm.runInNewContext(
    fs.readFileSync(
        path.join(root, "cafe", "olv", "script", "olv_portal.js"),
        "utf8"
    ),
    browser,
    { filename: "olv_portal.js" }
);

if (browser.WUTPortalNav.getState().activeView !== "activity-feed") {
    throw new Error("Portal did not boot into Activity Feed");
}

if (browser.WUTPortalNav.getState().focusedIndex !== 1) {
    throw new Error("Activity Feed did not receive initial focus");
}

if (inputStarts !== 1 || miiBindings !== 1 || sectionStarts !== 1) {
    throw new Error("Portal adapters did not start exactly once");
}

if (
    sectionShown[0] !== "activity-feed" ||
    (" " + elements["wut-activity-feed-view"].className + " ").indexOf(" none ") >= 0
) {
    throw new Error("Activity Feed panel did not boot visibly");
}

var scaleMatch = elements["wut-portal-stage"].style.webkitTransform.match(
    /^scale\(([^)]+)\)$/
);

if (!scaleMatch || Math.abs(parseFloat(scaleMatch[1]) - (2 / 3)) > .0001) {
    throw new Error("854 x 480 Wii U viewport was not scaled from 1280 x 720");
}

browser.WUTPortalNav.down("test");

if (browser.WUTPortalNav.getState().focusedIndex !== 2) {
    throw new Error("D-Pad Down did not focus Communities");
}

browser.WUTPortalNav.activate("test");

if (
    browser.WUTPortalNav.getState().activeView !== "communities" ||
    elements["page-title"].innerHTML !== "Communities"
) {
    throw new Error("A did not activate the focused Portal view");
}

browser.WUTPortalNav.back("test");

if (elements["wut-portal-stage"].getAttribute("data-wut-close-requested") !== "test") {
    throw new Error("B did not request Portal close");
}

browser.WUTPortalNav.select(0);
browser.WUTPortalNav.activate("test");

if (
    browser.WUTPortalNav.getState().activeView !== "user-page" ||
    elements["page-title"].innerHTML !== "User Page" ||
    (" " + elements["wut-user-page-view"].className + " ").indexOf(" none ") >= 0 ||
    elements["wut-user-page-view"].getAttribute("aria-hidden") !== "false"
) {
    throw new Error("User Page button did not expose its Portal panel");
}

browser.WUTPortalNav.right("test");
browser.WUTPortalNav.down("test");

if (!browser.WUTPortalNav.getState().sectionFocus || sectionMoves !== 1) {
    throw new Error("D-Pad Right did not enter the active demo section");
}

browser.WUTPortalNav.back("test");
if (browser.WUTPortalNav.getState().sectionFocus || sectionLeaves < 1) {
    throw new Error("B did not return from demo content to the global menu");
}

browser.WUTPortalNav.select(3);
browser.WUTPortalNav.activate("test");
if (
    browser.WUTPortalNav.getState().activeView !== "messages" ||
    (" " + elements["wut-messages-view"].className + " ").indexOf(" none ") >= 0
) {
    throw new Error("Messages button did not expose its Portal panel");
}

browser.WUTPortalNav.select(4);
browser.WUTPortalNav.activate("test");
if (
    browser.WUTPortalNav.getState().activeView !== "notifications" ||
    (" " + elements["wut-notifications-view"].className + " ").indexOf(" none ") >= 0
) {
    throw new Error("Notifications button did not expose its Portal panel");
}

console.log("Cafe OLV Portal navigation runtime checks passed.");
