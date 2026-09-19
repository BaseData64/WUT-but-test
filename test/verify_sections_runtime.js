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
    this.parentNode = null;
    this.offsetTop = 0;
    this.offsetHeight = 120;
    this.clientHeight = 500;
    this.scrollTop = 0;
    this.src = "";
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
    var listeners;
    var i;

    if (activeElement === this) {
        return;
    }

    activeElement = this;
    listeners = this.listeners.focus || [];

    for (i = 0; i < listeners.length; i += 1) {
        listeners[i]({});
    }
};

function add(id, className) {
    var element = new FakeElement(id, className);
    elements[id] = element;
    return element;
}

function attachLink(panel, id, action, label, disabled, parent) {
    var link = new FakeElement(id, "");

    link.setAttribute("data-wut-focus-item", "1");
    link.setAttribute("data-wut-demo-action", action);
    link.setAttribute("data-wut-label", label);
    if (disabled) {
        link.setAttribute("data-wut-focus-disabled", "1");
    }

    link.parentNode = parent || panel;
    panel.childrenByTag.a = panel.childrenByTag.a || [];
    panel.childrenByTag.a.push(link);
    return link;
}

function attachTab(panel, list, id, action, label) {
    var row = new FakeElement(id + "-row", "");
    var link = attachLink(panel, id, action, label, false, row);

    row.parentNode = list;
    row.childrenByTag.a = [link];
    list.childrenByTag.li = list.childrenByTag.li || [];
    list.childrenByTag.li.push(row);
    return { row: row, link: link };
}

function attachDirectoryLink(panel, list, scroller, id, action, label, disabled, top) {
    var row = new FakeElement(id + "-row", "");
    var link = attachLink(panel, id, action, label, disabled, row);

    row.parentNode = scroller;
    row.offsetTop = top || 0;
    row.childrenByTag.a = [link];
    list.childrenByTag.a = list.childrenByTag.a || [];
    list.childrenByTag.a.push(link);
    return { row: row, link: link };
}

var feedPanel = add("wut-activity-feed-view", "wut-portal-panel");
var userPanel = add("wut-user-page-view", "wut-portal-panel none");
var messagesPanel = add("wut-messages-view", "wut-portal-panel none");
var newsPanel = add("wut-notifications-view", "wut-portal-panel none");

var feedScroller = new FakeElement("feed-scroller", "wut-section-scroll");
feedScroller.parentNode = feedPanel;
attachDirectoryLink(feedPanel, new FakeElement(), feedScroller, "feed-1", "feed-post", "First post", false, 0);
attachDirectoryLink(feedPanel, new FakeElement(), feedScroller, "feed-2", "feed-post", "Second post", false, 120);
attachDirectoryLink(feedPanel, new FakeElement(), feedScroller, "feed-3", "feed-post", "Third post", false, 240);

var profileTabs = add("wut-profile-tabs", "wut-demo-tabs");
var profilePosts = attachTab(userPanel, profileTabs, "profile-posts", "profile-posts", "Posts tab");
var profileYeahs = attachTab(userPanel, profileTabs, "profile-yeahs", "profile-yeahs", "Yeahs tab");
attachTab(userPanel, profileTabs, "profile-friends", "profile-friends", "Friends tab");
attachLink(userPanel, "profile-entry", "profile-post", "Profile post", false, userPanel);

var messageScroller = new FakeElement("message-scroller", "wut-section-scroll");
messageScroller.parentNode = messagesPanel;
var messageList = new FakeElement("message-list", "");
attachDirectoryLink(messagesPanel, messageList, messageScroller, "message-1", "message-thread", "First conversation", false, 0);
attachDirectoryLink(messagesPanel, messageList, messageScroller, "message-2", "message-thread", "Second conversation", false, 120);

var newsTabs = add("wut-notification-tabs", "wut-demo-tabs");
var updatesTab = attachTab(newsPanel, newsTabs, "updates-tab", "notification-updates", "Updates tab");
var requestsTab = attachTab(newsPanel, newsTabs, "requests-tab", "notification-requests", "Friend Requests tab");
var newsScroller = new FakeElement("news-scroller", "wut-section-scroll");
newsScroller.parentNode = newsPanel;
var updates = add("wut-notification-updates", "wut-directory-list");
var requests = add("wut-notification-requests", "wut-directory-list none");
var updateOne = attachDirectoryLink(newsPanel, updates, newsScroller, "news-1", "notification-item", "Yeah notification", false, 0);
var updateTwo = attachDirectoryLink(newsPanel, updates, newsScroller, "news-2", "notification-item", "Comment notification", false, 120);
var requestOne = attachDirectoryLink(newsPanel, requests, newsScroller, "request-1", "friend-request", "Friend request", true, 0);
updates.childrenByTag.li = [updateOne.row, updateTwo.row];
requests.childrenByTag.li = [requestOne.row];

[
    "wut-profile-status",
    "wut-feed-status",
    "wut-message-status",
    "wut-notification-status",
    "wut-profile-session-state",
    "wut-profile-name",
    "wut-profile-id",
    "wut-profile-network",
    "wut-profile-game-skill",
    "wut-feed-user-name",
    "wut-feed-user-id",
    "wut-my-menu-topbar-name",
    "wut-profile-mii",
    "wut-feed-current-mii",
    "wut-my-menu-topbar-mii"
].forEach(function (id) {
    add(id, "");
});

var menuBlur = 0;
var menuFocus = -1;
var miiBindings = 0;
var windowListeners = {};
var documentListeners = {};

var document = {
    readyState: "complete",
    getElementById: function (id) {
        return elements[id] || null;
    },
    addEventListener: function (name, listener) {
        documentListeners[name] = listener;
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
            menuFocus = index;
        }
    },
    WUTSession: {
        getState: function () {
            return {
                miiName: "Maki",
                pnid: "MAKI_DEV",
                userId: null,
                network: "pretendo",
                gameExperience: "expert",
                identityResolved: true
            };
        }
    },
    WUTMii: {
        bindImage: function () {
            miiBindings += 1;
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
        path.join(root, "cafe", "olv", "script", "olv_sections.js"),
        "utf8"
    ),
    browser,
    { filename: "olv_sections.js" }
);

if (
    elements["wut-profile-name"].innerHTML !== "Maki" ||
    elements["wut-profile-id"].innerHTML !== "MAKI_DEV" ||
    elements["wut-profile-game-skill"].innerHTML !== "Expert" ||
    elements["wut-my-menu-topbar-name"].innerHTML !== "Maki"
) {
    throw new Error("Session data did not reach the User Page demo");
}

if (miiBindings !== 3) {
    throw new Error("Profile, feed and My Menu topbar Mii images were not bound");
}

browser.WUTPortalSections.enter("activity-feed");
browser.WUTPortalSections.down();
browser.WUTPortalSections.activate();

if (
    browser.WUTPortalSections.getState().selected !== 1 ||
    elements["wut-feed-status"].innerHTML.indexOf("Second post selected") < 0 ||
    menuBlur < 1
) {
    throw new Error("Activity Feed GamePad focus/activation failed");
}

browser.WUTPortalSections.left();
if (browser.WUTPortalSections.isActive() || menuFocus !== 1) {
    throw new Error("Activity Feed did not return focus to its menu button");
}

browser.WUTPortalSections.show("messages");
browser.WUTPortalSections.enter();
browser.WUTPortalSections.down();
browser.WUTPortalSections.activate();

if (elements["wut-message-status"].innerHTML.indexOf("Second conversation selected") < 0) {
    throw new Error("Messages preview did not activate its selected row");
}

browser.WUTPortalSections.leave();
browser.WUTPortalSections.show("notifications");
browser.WUTPortalSections.enter();
browser.WUTPortalSections.down();
browser.WUTPortalSections.activate();

if (
    (" " + requests.className + " ").indexOf(" none ") >= 0 ||
    (" " + updates.className + " ").indexOf(" none ") < 0 ||
    (" " + requestsTab.row.className + " ").indexOf(" selected ") < 0 ||
    browser.WUTPortalSections.getState().items !== 3
) {
    throw new Error("Notification tab switch did not expose Friend Requests");
}

browser.WUTPortalSections.down();
browser.WUTPortalSections.activate();
if (elements["wut-notification-status"].innerHTML.indexOf("relationship actions") < 0) {
    throw new Error("Friend Request preview did not stay explicitly non-functional");
}

browser.WUTPortalSections.leave();
browser.WUTPortalSections.show("user-page");
browser.WUTPortalSections.enter();
browser.WUTPortalSections.down();
browser.WUTPortalSections.activate();

if (
    (" " + profileYeahs.row.className + " ").indexOf(" selected ") < 0 ||
    (" " + profilePosts.row.className + " ").indexOf(" selected ") >= 0
) {
    throw new Error("User Page tabs did not switch selection");
}

console.log("Cafe OLV demo section runtime checks passed.");
