/*
 * WUT-Miiverse — Cafe OLV Portal shell controller.
 * ES5 syntax only for the Wii U's older WebKit runtime.
 */

(function () {
    "use strict";

    var BASE_WIDTH = 1280;
    var BASE_HEIGHT = 720;
    var menuIds = [
        "global-menu-mymenu",
        "global-menu-feed",
        "global-menu-community",
        "global-menu-message",
        "global-menu-news",
        "global-menu-exit"
    ];
    var selected = 1;
    var activeView = "activity-feed";
    var started = false;
    var lastActivate = 0;
    var panelIds = {
        "user-page": "wut-user-page-view",
        "activity-feed": "wut-activity-feed-view",
        "communities": "wut-communities-view",
        "messages": "wut-messages-view",
        "notifications": "wut-notifications-view"
    };

    var views = {
        "user-page": {
            title: "User Page",
            message: "Loading user page..."
        },
        "activity-feed": {
            title: "Activity Feed",
            message: "Loading activity feed..."
        },
        "communities": {
            title: "Communities",
            message: "Loading communities..."
        },
        "messages": {
            title: "Messages",
            message: "Loading messages..."
        },
        "notifications": {
            title: "Notifications",
            message: "Loading notifications..."
        }
    };

    function addClass(element, name) {
        if (
            element &&
            (" " + element.className + " ").indexOf(" " + name + " ") < 0
        ) {
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

    function item(index) {
        return document.getElementById(menuIds[index]);
    }

    function anchorFor(element) {
        var links;

        if (!element) {
            return null;
        }

        links = element.getElementsByTagName("a");
        return links.length ? links[0] : null;
    }

    function fitStage() {
        var stage = document.getElementById("wut-portal-stage");
        var doc = document.documentElement || {};
        var width = window.innerWidth || doc.clientWidth || BASE_WIDTH;
        var height = window.innerHeight || doc.clientHeight || BASE_HEIGHT;
        var scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);

        if (!stage) {
            return;
        }

        if (scale > 1) {
            scale = 1;
        }

        if (!scale || scale < .1) {
            scale = 1;
        }

        stage.style.webkitTransform = "scale(" + scale + ")";
        stage.style.transform = "scale(" + scale + ")";
    }

    function blurMenu() {
        var i;

        for (i = 0; i < menuIds.length; i += 1) {
            removeClass(item(i), "wut-focused");
        }
    }

    function focus(index) {
        var element;
        var link;
        var i;

        if (index < 0) {
            index = menuIds.length - 1;
        }

        if (index >= menuIds.length) {
            index = 0;
        }

        selected = index;

        blurMenu();

        for (i = 0; i < menuIds.length; i += 1) {
            element = item(i);

            if (i === selected) {
                addClass(element, "wut-focused");
                link = anchorFor(element);

                try {
                    if (link) {
                        link.focus();
                    }
                }
                catch (ignore) {}
            }
        }
    }

    function activeIndex(viewName) {
        var i;
        var link;

        for (i = 0; i < menuIds.length; i += 1) {
            link = anchorFor(item(i));

            if (link && link.getAttribute("data-wut-view") === viewName) {
                return i;
            }
        }

        return 1;
    }

    function showView(viewName) {
        var config = views[viewName];
        var title = document.getElementById("page-title");
        var container = document.getElementById("wut-portal-view");
        var viewPanel;
        var name;
        var index;
        var i;

        if (!config) {
            return;
        }

        if (
            communitiesActive() &&
            window.WUTCommunities &&
            typeof window.WUTCommunities.leave === "function"
        ) {
            window.WUTCommunities.leave();
        }

        if (
            viewName !== activeView &&
            sectionsActive() &&
            window.WUTPortalSections &&
            typeof window.WUTPortalSections.leave === "function"
        ) {
            window.WUTPortalSections.leave();
        }

        activeView = viewName;
        index = activeIndex(viewName);

        for (i = 0; i < menuIds.length; i += 1) {
            removeClass(item(i), "selected");
        }

        addClass(item(index), "selected");

        if (title) {
            title.innerHTML = config.title;
        }

        for (name in panelIds) {
            if (panelIds.hasOwnProperty(name)) {
                viewPanel = document.getElementById(panelIds[name]);

                if (name === viewName) {
                    removeClass(viewPanel, "none");
                    if (viewPanel) {
                        viewPanel.setAttribute("aria-hidden", "false");
                    }
                }
                else {
                    addClass(viewPanel, "none");
                    if (viewPanel) {
                        viewPanel.setAttribute("aria-hidden", "true");
                    }
                }
            }
        }

        if (
            window.WUTPortalSections &&
            typeof window.WUTPortalSections.show === "function"
        ) {
            window.WUTPortalSections.show(viewName);
        }

        if (container) {
            container.setAttribute("data-wut-current-view", viewName);
        }

        document.title = "Cafe OLV Portal - " + config.title;
        focus(index);
    }

    function communitiesActive() {
        return !!(
            window.WUTCommunities &&
            typeof window.WUTCommunities.isActive === "function" &&
            window.WUTCommunities.isActive()
        );
    }

    function sectionsActive() {
        return !!(
            window.WUTPortalSections &&
            typeof window.WUTPortalSections.isActive === "function" &&
            window.WUTPortalSections.isActive()
        );
    }

    function menuFocused() {
        return !!(
            item(selected) &&
            (" " + item(selected).className + " ").indexOf(" wut-focused ") >= 0
        );
    }

    function playSound(name) {
        if (!name) {
            return;
        }

        try {
            if (
                window.wiiuSound &&
                typeof window.wiiuSound.playSoundByName === "function"
            ) {
                window.wiiuSound.playSoundByName(name, 1);
            }
        }
        catch (ignore) {}
    }

    function closePortal(source) {
        var stage = document.getElementById("wut-portal-stage");

        if (stage) {
            stage.setAttribute("data-wut-close-requested", source || "unknown");
        }

        try {
            if (
                window.wiiuBrowser &&
                typeof window.wiiuBrowser.closeApplication === "function"
            ) {
                window.wiiuBrowser.closeApplication();
                return;
            }
        }
        catch (ignore) {}

        if (window.console && console.log) {
            console.log("[WUT:PORTAL] Close requested; no host close API found");
        }
    }

    function activate(source) {
        var now = new Date().getTime();
        var link;
        var viewName;

        if (now - lastActivate < 180) {
            return;
        }

        lastActivate = now;

        if (
            communitiesActive() &&
            !menuFocused() &&
            typeof window.WUTCommunities.activate === "function"
        ) {
            window.WUTCommunities.activate(source || "unknown");
            return;
        }

        if (
            sectionsActive() &&
            !menuFocused() &&
            typeof window.WUTPortalSections.activate === "function"
        ) {
            window.WUTPortalSections.activate(source || "unknown");
            return;
        }

        link = anchorFor(item(selected));

        if (!link) {
            return;
        }

        playSound(link.getAttribute("data-sound"));

        if (link.getAttribute("data-wut-action") === "close") {
            closePortal(source);
            return;
        }

        viewName = link.getAttribute("data-wut-view");
        showView(viewName);
    }

    function bind(index) {
        var element = item(index);
        var link = anchorFor(element);

        if (!link || link._wutPortalBound) {
            return;
        }

        link._wutPortalBound = true;

        link.addEventListener(
            "focus",
            function () {
                focus(index);
            },
            false
        );

        link.addEventListener(
            "touchstart",
            function () {
                focus(index);
            },
            false
        );

        link.addEventListener(
            "mousedown",
            function () {
                focus(index);
            },
            false
        );

        link.addEventListener(
            "click",
            function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }

                focus(index);
                activate("touch");
                return false;
            },
            false
        );
    }

    function bindMii() {
        var image = document.getElementById("wut-global-menu-mii");

        if (
            image &&
            window.WUTMii &&
            typeof window.WUTMii.bindImage === "function"
        ) {
            window.WUTMii.bindImage(
                image,
                "res/olv/mii/img_unknown_MiiIcon.png",
                96,
                "face"
            );
        }
    }

    function start() {
        var i;

        if (started) {
            return;
        }

        started = true;

        for (i = 0; i < menuIds.length; i += 1) {
            bind(i);
        }

        fitStage();

        if (
            window.WUTCommunities &&
            typeof window.WUTCommunities.start === "function"
        ) {
            window.WUTCommunities.start();
        }

        if (
            window.WUTPortalSections &&
            typeof window.WUTPortalSections.start === "function"
        ) {
            window.WUTPortalSections.start();
        }

        showView(activeView);
        bindMii();

        if (
            window.WUTCafeInput &&
            typeof window.WUTCafeInput.start === "function"
        ) {
            window.WUTCafeInput.start();
        }

        if (window.console && console.log) {
            console.log("[WUT:PORTAL] Cafe OLV global menu ready");
        }
    }

    window.WUTPortalNav = {
        start: start,
        refresh: function () {
            focus(selected);
        },
        select: focus,
        focusMenu: focus,
        blurMenu: blurMenu,
        left: function () {
            if (
                sectionsActive() &&
                window.WUTPortalSections.left()
            ) {
                return;
            }

            if (
                communitiesActive() &&
                window.WUTCommunities.left()
            ) {
                return;
            }

            focus(selected - 1);
        },
        right: function () {
            if (
                sectionsActive() &&
                window.WUTPortalSections.right()
            ) {
                return;
            }

            if (
                communitiesActive() &&
                window.WUTCommunities.right()
            ) {
                return;
            }

            if (
                activeView === "communities" &&
                selected === 2 &&
                window.WUTCommunities &&
                typeof window.WUTCommunities.enter === "function"
            ) {
                window.WUTCommunities.enter();
                return;
            }

            if (
                activeView !== "communities" &&
                selected === activeIndex(activeView) &&
                window.WUTPortalSections &&
                typeof window.WUTPortalSections.enter === "function"
            ) {
                window.WUTPortalSections.enter(activeView);
                return;
            }

            focus(selected + 1);
        },
        up: function () {
            if (
                sectionsActive() &&
                window.WUTPortalSections.up()
            ) {
                return;
            }

            if (
                communitiesActive() &&
                window.WUTCommunities.up()
            ) {
                return;
            }

            focus(selected - 1);
        },
        down: function () {
            if (
                sectionsActive() &&
                window.WUTPortalSections.down()
            ) {
                return;
            }

            if (
                communitiesActive() &&
                window.WUTCommunities.down()
            ) {
                return;
            }

            focus(selected + 1);
        },
        activate: activate,
        back: function (source) {
            if (
                sectionsActive() &&
                window.WUTPortalSections &&
                typeof window.WUTPortalSections.leave === "function"
            ) {
                window.WUTPortalSections.leave();
                return;
            }

            if (
                communitiesActive() &&
                window.WUTCommunities &&
                typeof window.WUTCommunities.leave === "function"
            ) {
                window.WUTCommunities.leave();
                return;
            }

            closePortal(source || "unknown");
        },
        close: closePortal,
        getState: function () {
            return {
                focusedIndex: selected,
                activeView: activeView,
                communityFocus: communitiesActive(),
                sectionFocus: sectionsActive()
            };
        }
    };

    if (window.addEventListener) {
        window.addEventListener("resize", fitStage, false);
        window.addEventListener("orientationchange", fitStage, false);
        window.addEventListener("wut:session-ready", bindMii, false);
        window.addEventListener("wut:identity-ready", bindMii, false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
