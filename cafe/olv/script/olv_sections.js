/*
 * WUT-Miiverse — static Portal section controller.
 *
 * Cf_Miiverse supplied the view vocabulary and hierarchy. This controller is
 * a WUT-native ES5 preview layer: it does not call the clone's MySQL backend,
 * send messages, mutate relationships or claim that demo data is live.
 */

(function () {
    "use strict";

    var panelIds = {
        "user-page": "wut-user-page-view",
        "activity-feed": "wut-activity-feed-view",
        "messages": "wut-messages-view",
        "notifications": "wut-notifications-view"
    };
    var menuIndexes = {
        "user-page": 0,
        "activity-feed": 1,
        "messages": 3,
        "notifications": 4
    };
    var statusIds = {
        "user-page": "wut-profile-status",
        "activity-feed": "wut-feed-status",
        "messages": "wut-message-status",
        "notifications": "wut-notification-status"
    };
    var selectedByView = {
        "user-page": 0,
        "activity-feed": 0,
        "messages": 0,
        "notifications": 0
    };
    var started = false;
    var active = false;
    var currentView = "activity-feed";

    function hasClass(element, name) {
        return !!(
            element &&
            (" " + element.className + " ").indexOf(" " + name + " ") >= 0
        );
    }

    function addClass(element, name) {
        if (element && !hasClass(element, name)) {
            element.className += " " + name;
        }
    }

    function removeClass(element, name) {
        if (!element) {
            return;
        }

        element.className = element.className.replace(
            new RegExp("\\s*" + name, "g"),
            ""
        );
    }

    function escapeHTML(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setText(id, value) {
        var element = document.getElementById(id);

        if (element) {
            element.innerHTML = escapeHTML(value);
        }
    }

    function panel(viewName) {
        return document.getElementById(panelIds[viewName]);
    }

    function focusItems(viewName) {
        var root = panel(viewName || currentView);
        var links = root ? root.getElementsByTagName("a") : [];
        var items = [];
        var i;

        for (i = 0; i < links.length; i += 1) {
            if (
                links[i].getAttribute("data-wut-focus-item") === "1" &&
                links[i].getAttribute("data-wut-focus-disabled") !== "1"
            ) {
                items.push(links[i]);
            }
        }

        return items;
    }

    function allSectionLinks() {
        var links = [];
        var viewName;
        var root;
        var found;
        var i;

        for (viewName in panelIds) {
            if (panelIds.hasOwnProperty(viewName)) {
                root = panel(viewName);
                found = root ? root.getElementsByTagName("a") : [];

                for (i = 0; i < found.length; i += 1) {
                    links.push(found[i]);
                }
            }
        }

        return links;
    }

    function clearFocus() {
        var links = allSectionLinks();
        var i;

        for (i = 0; i < links.length; i += 1) {
            removeClass(links[i], "wut-section-focused");
        }
    }

    function findScroller(element) {
        var node = element;

        while (node && node !== panel(currentView)) {
            if (hasClass(node, "wut-section-scroll")) {
                return node;
            }
            node = node.parentNode;
        }

        return null;
    }

    function ensureVisible(link) {
        var scroller = findScroller(link);
        var row = link ? link.parentNode : null;
        var top;
        var bottom;

        if (!scroller || !row) {
            return;
        }

        top = row.offsetTop || 0;
        bottom = top + (row.offsetHeight || link.offsetHeight || 120);

        if (top < scroller.scrollTop) {
            scroller.scrollTop = top;
        }
        else if (bottom > scroller.scrollTop + scroller.clientHeight) {
            scroller.scrollTop = bottom - scroller.clientHeight;
        }
    }

    function focus(index) {
        var items = focusItems();
        var i;

        if (!items.length) {
            active = false;
            return false;
        }

        if (index < 0) {
            index = 0;
        }

        if (index >= items.length) {
            index = items.length - 1;
        }

        selectedByView[currentView] = index;
        active = true;
        clearFocus();

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.blurMenu === "function"
        ) {
            window.WUTPortalNav.blurMenu();
        }

        for (i = 0; i < items.length; i += 1) {
            if (i === index) {
                addClass(items[i], "wut-section-focused");

                try {
                    items[i].focus();
                }
                catch (ignore) {}

                ensureVisible(items[i]);
            }
        }

        return true;
    }

    function setStatus(message) {
        var status = document.getElementById(statusIds[currentView]);

        if (status) {
            status.innerHTML = escapeHTML(message);
        }
    }

    function selectTab(listId, action) {
        var list = document.getElementById(listId);
        var rows = list ? list.getElementsByTagName("li") : [];
        var anchors;
        var i;

        for (i = 0; i < rows.length; i += 1) {
            anchors = rows[i].getElementsByTagName("a");
            removeClass(rows[i], "selected");

            if (
                anchors.length &&
                anchors[0].getAttribute("data-wut-demo-action") === action
            ) {
                addClass(rows[i], "selected");
            }
        }
    }

    function enableList(list, enabled) {
        var links = list ? list.getElementsByTagName("a") : [];
        var i;

        for (i = 0; i < links.length; i += 1) {
            links[i].setAttribute(
                "data-wut-focus-disabled",
                enabled ? "0" : "1"
            );
        }
    }

    function showNotificationPage(name) {
        var updates = document.getElementById("wut-notification-updates");
        var requests = document.getElementById("wut-notification-requests");
        var useRequests = name === "requests";

        selectTab(
            "wut-notification-tabs",
            useRequests ? "notification-requests" : "notification-updates"
        );

        if (useRequests) {
            addClass(updates, "none");
            removeClass(requests, "none");
            if (updates) {
                updates.setAttribute("aria-hidden", "true");
            }
            if (requests) {
                requests.setAttribute("aria-hidden", "false");
            }
        }
        else {
            removeClass(updates, "none");
            addClass(requests, "none");
            if (updates) {
                updates.setAttribute("aria-hidden", "false");
            }
            if (requests) {
                requests.setAttribute("aria-hidden", "true");
            }
        }

        enableList(updates, !useRequests);
        enableList(requests, useRequests);
        setStatus(useRequests ? "Friend Requests preview selected." : "Updates preview selected.");
    }

    function titleCase(value) {
        value = String(value || "");

        if (!value) {
            return "Not set";
        }

        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function bindSession() {
        var state;
        var name;
        var userId;
        var network;
        var profileState = document.getElementById("wut-profile-session-state");
        var image;

        if (!window.WUTSession || typeof window.WUTSession.getState !== "function") {
            return;
        }

        state = window.WUTSession.getState();
        name = state.miiName || "Cafe User";
        userId = state.pnid || state.userId || "WUT_USER";
        network = state.network ? String(state.network).toUpperCase() : "LOCAL SESSION";

        setText("wut-profile-name", name);
        setText("wut-profile-id", userId);
        setText("wut-profile-network", network);
        setText("wut-profile-game-skill", titleCase(state.gameExperience));
        setText("wut-feed-user-name", name);
        setText("wut-feed-user-id", userId);

        if (profileState) {
            profileState.innerHTML = state.identityResolved ?
                "<b>RESOLVED</b> IDENTITY" :
                "<b>LOCAL</b> MODE";
        }

        if (window.WUTMii && typeof window.WUTMii.bindImage === "function") {
            image = document.getElementById("wut-profile-mii");
            window.WUTMii.bindImage(
                image,
                "res/olv/mii/img_unknown_MiiIcon.png",
                160,
                "face"
            );

            image = document.getElementById("wut-feed-current-mii");
            window.WUTMii.bindImage(
                image,
                "res/olv/mii/img_unknown_MiiIcon.png",
                96,
                "face"
            );
        }
    }

    function activate() {
        var items = focusItems();
        var index = selectedByView[currentView] || 0;
        var link = items[index];
        var action;
        var label;

        if (!active || !link) {
            return false;
        }

        action = link.getAttribute("data-wut-demo-action") || "preview";
        label = link.getAttribute("data-wut-label") || "Item";

        if (action === "notification-updates") {
            showNotificationPage("updates");
            focus(0);
            return true;
        }

        if (action === "notification-requests") {
            showNotificationPage("requests");
            focus(1);
            return true;
        }

        if (
            action === "profile-posts" ||
            action === "profile-yeahs" ||
            action === "profile-friends"
        ) {
            selectTab("wut-profile-tabs", action);
            setStatus(label + " selected — live profile data connects here later.");
            return true;
        }

        if (action === "feed-post") {
            setStatus(label + " selected — post detail/API is not connected yet.");
        }
        else if (action === "message-thread") {
            setStatus(label + " selected — sending messages is not connected yet.");
        }
        else if (action === "friend-request") {
            setStatus(label + " selected — relationship actions are not connected yet.");
        }
        else if (action === "notification-item") {
            setStatus(label + " selected — event detail/API is not connected yet.");
        }
        else {
            setStatus(label + " selected — demo preview only.");
        }

        return true;
    }

    function leave() {
        var index = menuIndexes[currentView];

        active = false;
        clearFocus();

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.focusMenu === "function"
        ) {
            window.WUTPortalNav.focusMenu(index);
        }

        return true;
    }

    function bindLink(link, viewName) {
        if (!link || link._wutSectionBound) {
            return;
        }

        link._wutSectionBound = true;

        link.addEventListener(
            "focus",
            function () {
                var items;
                var i;

                if (currentView !== viewName) {
                    currentView = viewName;
                }

                items = focusItems(viewName);
                for (i = 0; i < items.length; i += 1) {
                    if (items[i] === link) {
                        focus(i);
                        return;
                    }
                }
            },
            false
        );

        link.addEventListener(
            "touchstart",
            function () {
                try {
                    link.focus();
                }
                catch (ignore) {}
            },
            false
        );

        link.addEventListener(
            "click",
            function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }

                try {
                    link.focus();
                }
                catch (ignore) {}

                activate();
                return false;
            },
            false
        );
    }

    function bindAll() {
        var viewName;
        var root;
        var links;
        var i;

        for (viewName in panelIds) {
            if (panelIds.hasOwnProperty(viewName)) {
                root = panel(viewName);
                links = root ? root.getElementsByTagName("a") : [];

                for (i = 0; i < links.length; i += 1) {
                    if (links[i].getAttribute("data-wut-focus-item") === "1") {
                        bindLink(links[i], viewName);
                    }
                }
            }
        }
    }

    function show(viewName) {
        if (!panelIds[viewName]) {
            active = false;
            clearFocus();
            return false;
        }

        currentView = viewName;
        active = false;
        clearFocus();
        bindSession();
        return true;
    }

    function start() {
        var bootView;

        if (started) {
            return;
        }

        started = true;
        bindAll();
        bootView = currentView;
        currentView = "notifications";
        showNotificationPage("updates");
        currentView = bootView;
        bindSession();
    }

    window.WUTPortalSections = {
        start: start,
        show: show,
        enter: function (viewName) {
            if (viewName && panelIds[viewName]) {
                currentView = viewName;
            }
            return focus(selectedByView[currentView] || 0);
        },
        leave: leave,
        isActive: function () {
            return active;
        },
        left: function () {
            return active ? leave() : false;
        },
        right: function () {
            return active;
        },
        up: function () {
            return active ? focus((selectedByView[currentView] || 0) - 1) : false;
        },
        down: function () {
            return active ? focus((selectedByView[currentView] || 0) + 1) : false;
        },
        activate: activate,
        bindSession: bindSession,
        getState: function () {
            return {
                active: active,
                view: currentView,
                selected: selectedByView[currentView] || 0,
                items: focusItems().length
            };
        }
    };

    if (window.addEventListener) {
        window.addEventListener("wut:session-ready", bindSession, false);
        window.addEventListener("wut:identity-ready", bindSession, false);
        window.addEventListener("wut:profile-change", bindSession, false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
