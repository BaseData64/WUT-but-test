/*
 * WUT-Miiverse — beta global-menu state helper (ES5 / Wii U WebKit).
 *
 * - Root state: dark bottom control says Close and uses the Portal X.
 * - After changing Portal views: it says Back and points to the previous view.
 * - Does not replace olv_portal.js; it only changes the exit link attributes
 *   that olv_portal.js already understands.
 * - Finger-drag menu hiding remains entirely in olv_beta_touch.js.
 */
(function () {
    "use strict";

    var history = [];
    var currentView = null;
    var backNavigationPending = false;
    var lastPreparedTarget = null;
    var timer = null;
    var originalActivate = null;
    var originalBack = null;

    function addClass(element, name) {
        if (!element) {
            return;
        }
        if ((" " + element.className + " ").indexOf(" " + name + " ") < 0) {
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

    function portalView() {
        var root = document.getElementById("wut-portal-view");
        return root ? root.getAttribute("data-wut-current-view") : null;
    }

    function exitItem() {
        return document.getElementById("global-menu-exit");
    }

    function exitLink() {
        var item = exitItem();
        var links;
        if (!item) {
            return null;
        }
        links = item.getElementsByTagName("a");
        return links && links.length ? links[0] : null;
    }

    function updateCornerAction() {
        var action = document.getElementById("wut-beta-corner-action");
        var view = portalView();

        if (!action) {
            return;
        }

        if (view === "activity-feed" || view === "communities") {
            action.style.display = "block";
        }
        else {
            action.style.display = "none";
        }
    }

    function setCloseMode() {
        var item = exitItem();
        var link = exitLink();
        if (!item || !link) {
            return;
        }

        /* Early 2012 Portal frames used a Back control even at the root.
           Keep the root semantic as close/exit, but render the beta Back arrow. */
        removeClass(item, "wut-beta-close-mode");
        addClass(item, "wut-beta-back-mode");
        link.innerHTML = "Back";
        link.setAttribute("data-wut-action", "close");
        link.removeAttribute("data-wut-view");
        link.setAttribute("data-sound", "SE_WAVE_EXIT");
        lastPreparedTarget = null;
    }

    function setBackMode(target) {
        var item = exitItem();
        var link = exitLink();
        if (!item || !link || !target) {
            return;
        }

        removeClass(item, "wut-beta-close-mode");
        addClass(item, "wut-beta-back-mode");
        link.innerHTML = "Back";
        link.removeAttribute("data-wut-action");
        link.setAttribute("data-wut-view", target);
        link.setAttribute("data-sound", "SE_WAVE_MENU");
        lastPreparedTarget = target;
    }

    function updateExit() {
        if (history.length) {
            setBackMode(history[history.length - 1]);
        }
        else {
            setCloseMode();
        }
    }

    function prepareBackNavigation() {
        if (!history.length) {
            return false;
        }

        lastPreparedTarget = history[history.length - 1];
        history.pop();
        backNavigationPending = true;
        return true;
    }

    function observeView() {
        var next = portalView();

        if (!next) {
            return;
        }

        if (currentView === null) {
            currentView = next;
            updateExit();
            return;
        }

        if (next === currentView) {
            return;
        }

        if (backNavigationPending) {
            backNavigationPending = false;
        }
        else {
            history.push(currentView);
        }

        currentView = next;
        updateExit();
        updateCornerAction();
    }

    function wrapPortalNavigation() {
        if (!window.WUTPortalNav) {
            return;
        }

        if (!originalActivate && typeof window.WUTPortalNav.activate === "function") {
            originalActivate = window.WUTPortalNav.activate;
            window.WUTPortalNav.activate = function (source) {
                var state = window.WUTPortalNav.getState ?
                    window.WUTPortalNav.getState() : null;

                if (state && state.focusedIndex === 5 && history.length) {
                    prepareBackNavigation();
                }

                return originalActivate(source);
            };
        }

        if (!originalBack && typeof window.WUTPortalNav.back === "function") {
            originalBack = window.WUTPortalNav.back;
            window.WUTPortalNav.back = function (source) {
                var state = window.WUTPortalNav.getState ?
                    window.WUTPortalNav.getState() : null;
                var link;

                /* Let native section/community sub-navigation consume Back first. */
                if (state && (state.communityFocus || state.sectionFocus)) {
                    return originalBack(source);
                }

                if (history.length && prepareBackNavigation()) {
                    link = exitLink();
                    if (link) {
                        link.setAttribute("data-wut-view", lastPreparedTarget);
                        link.removeAttribute("data-wut-action");
                    }
                    /* Focus the bottom item and use the Portal's own activate path. */
                    if (window.WUTPortalNav.focus) {
                        window.WUTPortalNav.focus(5);
                    }
                    return originalActivate(source || "back");
                }

                return originalBack(source);
            };
        }
    }

    function bindExitCapture() {
        var link = exitLink();
        if (!link || link._wutBetaHistoryCapture) {
            return;
        }

        link._wutBetaHistoryCapture = true;
        link.addEventListener(
            "click",
            function () {
                if (history.length) {
                    prepareBackNavigation();
                }
            },
            true
        );
    }

    function start() {
        var item = exitItem();
        if (item) {
            addClass(item, "wut-beta-close-mode");
        }

        currentView = portalView();
        updateExit();
        updateCornerAction();
        bindExitCapture();
        wrapPortalNavigation();

        timer = window.setInterval(function () {
            observeView();
            wrapPortalNavigation();
        }, 100);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
