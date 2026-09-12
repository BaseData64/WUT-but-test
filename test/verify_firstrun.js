#!/usr/bin/env node

/*
 * Lightweight First Run regression check.
 * Uses only Node built-ins; the emulated DOM covers the APIs used by WUT.
 */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const portal = path.join(root, "cafe", "olv");
const html = fs.readFileSync(path.join(portal, "index.html"), "utf8");
const firstRunCss = fs.readFileSync(
    path.join(portal, "style", "cafe.css"),
    "utf8"
);
const allCss = [
    "cafe.css",
    "olv_symbols.css",
    "olv_setup.css"
]
    .map(function (file) {
        return fs.readFileSync(path.join(portal, "style", file), "utf8");
    })
    .join("\n");

function FakeElement(id, className) {
    this.id = id;
    this.className = className || "";
    this.attributes = {};
    this.listeners = {};
    this.tags = {};
    this.disabled = false;
    this.innerHTML = "";
    this.scrollTop = 0;
}

FakeElement.prototype.setAttribute = function (name, value) {
    this.attributes[name] = String(value);
};

FakeElement.prototype.getAttribute = function (name) {
    return this.attributes[name];
};

FakeElement.prototype.removeAttribute = function (name) {
    delete this.attributes[name];
};

FakeElement.prototype.getElementsByTagName = function (name) {
    return this.tags[name] || [];
};

FakeElement.prototype.addEventListener = function (name, listener) {
    this.listeners[name] = this.listeners[name] || [];
    this.listeners[name].push(listener);
};

FakeElement.prototype.emit = function (name, event) {
    const list = this.listeners[name] || [];
    list.forEach(function (listener) {
        listener(event || {});
    });
};

const elements = {};
let activeElement = null;

function add(id, className) {
    const element = new FakeElement(id, className);
    elements[id] = element;
    return element;
}

function makeFocusable(element) {
    element.focus = function () {
        if (activeElement === element) {
            return;
        }

        activeElement = element;
        element.emit("focus", {});
    };
}

function addCornerButton(id, className, action, label) {
    const button = add(id, className);
    const icon = new FakeElement(id + "-icon", "wut-action-icon");
    const text = new FakeElement(id + "-label", "wut-action-label");

    button.setAttribute("data-wut-action", action);
    text.innerHTML = label;
    button.tags.span = [icon, text];
    makeFocusable(button);

    return button;
}

function addSkillButton(id, action) {
    const button = add(id, "wut-skill-option wut-control-hidden");
    const text = new FakeElement(id + "-label", "");

    button.setAttribute("data-wut-action", action);
    button.setAttribute("aria-pressed", "false");
    button.tags.span = [text];
    makeFocusable(button);

    return button;
}

[
    ["welcome-start", "wut-view wut-step"],
    ["welcome-about", "wut-view wut-step wut-step-hidden"],
    ["welcome-manners", "wut-view wut-step wut-step-hidden"],
    ["welcome-game-experience", "wut-view wut-step wut-step-hidden"],
    ["welcome-ready", "wut-view wut-step wut-step-hidden"],
    ["welcome-finish", "wut-view wut-step wut-step-hidden"]
].forEach(function (item) {
    add(item[0], item[1]);
});

add("wut-cafe-stage", "");
add("wut-manners-scroll", "wut-manners-scroll");
add("wut-skill-hint", "wut-skill-hint");
add("wut-finish-copy", "wut-finish-copy");

addSkillButton("wut-skill-beginner", "select-skill-beginner");
addSkillButton("wut-skill-intermediate", "select-skill-intermediate");
addSkillButton("wut-skill-expert", "select-skill-expert");

addCornerButton(
    "wut-setup-close",
    "wut-corner-button wut-corner-button-left",
    "close",
    "Close"
);
addCornerButton(
    "wut-setup-next",
    "wut-corner-button wut-corner-button-right wut-focused",
    "next",
    "Next"
);

const documentListeners = {};
const emittedEvents = [];

const document = {
    readyState: "complete",

    getElementById: function (id) {
        return elements[id] || null;
    },

    addEventListener: function (name, listener) {
        documentListeners[name] = documentListeners[name] || [];
        documentListeners[name].push(listener);
    },

    createEvent: function () {
        return {
            type: "",
            initEvent: function (name) {
                this.type = name;
            }
        };
    }
};

const browser = {
    document: document,
    console: { log: function () {} },
    setInterval: function () { return 1; },
    clearInterval: function () {},
    dispatchEvent: function (event) {
        emittedEvents.push(event);
    }
};

browser.window = browser;

function runScript(file) {
    const fullPath = path.join(portal, "script", file);
    const source = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(source, browser, { filename: fullPath });
}

function hasClass(id, name) {
    return (" " + elements[id].className + " ").indexOf(" " + name + " ") >= 0;
}

function label(id) {
    return elements[id].tags.span[1].innerHTML;
}

/* Static document contract. */
const ids = [];
let match;
const idPattern = /\sid="([^"]+)"/g;

while ((match = idPattern.exec(html))) {
    ids.push(match[1]);
}

assert.strictEqual(new Set(ids).size, ids.length, "index.html contains duplicate IDs");
[
    "welcome-start",
    "welcome-about",
    "welcome-manners",
    "welcome-game-experience",
    "welcome-ready",
    "welcome-finish"
].forEach(function (id) {
    assert(ids.indexOf(id) >= 0, "Missing First Run panel: " + id);
});

assert(
    firstRunCss.indexOf("width: 628px") >= 0,
    "The researched 628px card width is missing"
);
assert(
    html.indexOf('href="style/cafe.css"') >= 0,
    "The Classic Nintendo / Miiverse visual pass is not linked"
);
assert(
    html.indexOf('class="wut-dev-strip"') < 0,
    "The V6.2 demo build strip must stay removed in V6.3"
);
assert(
    !/(?:animation|transition)\s*:/.test(allCss),
    "The First Run must keep static interaction feedback"
);
assert.strictEqual(
    (allCss.match(/{/g) || []).length,
    (allCss.match(/}/g) || []).length,
    "The active CSS has unbalanced braces"
);
assert(!/https?:\/\//.test(html), "First Run must not load a remote resource");

const localReferences = [];
const referencePattern = /(?:href|src)="([^"]+)"/g;

while ((match = referencePattern.exec(html))) {
    if (match[1].indexOf("://") < 0) {
        localReferences.push(match[1]);
    }
}

localReferences.forEach(function (reference) {
    assert(
        fs.existsSync(path.join(portal, reference)),
        "Missing local document resource: " + reference
    );
});

const cssUrlPattern = /url\(["']?([^"')]+)["']?\)/g;

while ((match = cssUrlPattern.exec(allCss))) {
    if (match[1].indexOf("data:") === 0 || match[1].indexOf("://") >= 0) {
        continue;
    }

    assert(
        fs.existsSync(path.resolve(portal, "style", match[1])),
        "Missing local CSS resource: " + match[1]
    );
}

/* Script order matches index.html. */
runScript("cafe_input.js");
runScript("olv_nav.js");
runScript("olv_setup.js");

assert.strictEqual(browser.WUTFirstRun.getState(), "welcome");
assert.strictEqual(label("wut-setup-close"), "Close");
assert.strictEqual(label("wut-setup-next"), "Next");
assert(hasClass("wut-setup-next", "wut-focused"));
assert(hasClass("wut-skill-beginner", "wut-control-hidden"));

browser.WUTPortalNav.left();
assert(hasClass("wut-setup-close", "wut-focused"));
browser.WUTPortalNav.right();
assert(hasClass("wut-setup-next", "wut-focused"));
browser.WUTPortalNav.activate("test");
assert.strictEqual(browser.WUTFirstRun.getState(), "about");

let prevented = false;
(documentListeners.keydown || [])[0]({
    keyCode: 66,
    preventDefault: function () { prevented = true; }
});
assert(prevented, "Keyboard B did not prevent browser Back");
assert.strictEqual(browser.WUTFirstRun.getState(), "welcome");

browser.WUTFirstRun.activate("next", "test");
browser.WUTFirstRun.activate("next", "test");
assert.strictEqual(browser.WUTFirstRun.getState(), "manners");
assert.strictEqual(label("wut-setup-next"), "Accept");
assert(browser.WUTFirstRun.scroll(1));
assert.strictEqual(elements["wut-manners-scroll"].scrollTop, 82);

browser.WUTFirstRun.activate("accept", "test");
assert.strictEqual(browser.WUTFirstRun.getState(), "game-experience");
assert(elements["wut-setup-next"].disabled, "Next must wait for a skill choice");
assert(hasClass("wut-skill-beginner", "wut-focused"));

browser.WUTFirstRun.activate("next", "test");
assert.strictEqual(browser.WUTFirstRun.getState(), "game-experience");

browser.WUTFirstRun.activate("select-skill-intermediate", "test");
assert.strictEqual(browser.WUTFirstRun.getGameExperience(), "intermediate");
assert(hasClass("wut-skill-intermediate", "wut-selected"));
assert.strictEqual(elements["wut-skill-intermediate"].getAttribute("aria-pressed"), "true");
assert(!elements["wut-setup-next"].disabled, "Next did not unlock after selection");

browser.WUTFirstRun.activate("next", "test");
assert.strictEqual(browser.WUTFirstRun.getState(), "ready");
assert(hasClass("wut-skill-intermediate", "wut-control-hidden"));

browser.WUTFirstRun.back("test");
assert.strictEqual(browser.WUTFirstRun.getState(), "game-experience");
assert.strictEqual(browser.WUTFirstRun.getGameExperience(), "intermediate");
browser.WUTFirstRun.activate("next", "test");
browser.WUTFirstRun.activate("next", "test");
assert.strictEqual(browser.WUTFirstRun.getState(), "finish");
assert(hasClass("wut-setup-close", "wut-control-hidden"));
assert.strictEqual(label("wut-setup-next"), "Start");

browser.WUTFirstRun.activate("start", "test");
assert(browser.WUTFirstRun.isComplete());
assert(hasClass("wut-setup-next", "wut-control-hidden"));

const completion = emittedEvents.filter(function (event) {
    return event.type === "wut:firstrun-complete";
})[0];

assert(completion, "Completion event was not emitted");
assert.strictEqual(completion.wutDetail.gameExperience, "intermediate");
assert.strictEqual(completion.wutDetail.persistent, false);

console.log("RESULTADO: Cafe OLV First Run static and state-flow checks passed.");
