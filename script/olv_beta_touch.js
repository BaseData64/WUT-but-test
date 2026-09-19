/*
 * WUT-Miiverse — early beta touch behavior.
 * Only a real touch drag hides the global menu.
 * Taps, clicks, D-pad and native applet cursor navigation are untouched.
 */
(function () {
    "use strict";

    var startX = 0;
    var startY = 0;
    var tracking = false;
    var dragging = false;
    var ignoreGesture = false;
    var THRESHOLD = 11;

    function stage() {
        return document.getElementById("wut-portal-stage");
    }

    function menu() {
        return document.getElementById("global-menu");
    }

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

    function insideMenu(target) {
        var root = menu();

        while (target) {
            if (target === root) {
                return true;
            }
            target = target.parentNode;
        }

        return false;
    }

    function firstTouch(event) {
        if (!event || !event.touches || !event.touches.length) {
            return null;
        }

        return event.touches[0];
    }

    function onStart(event) {
        var touch = firstTouch(event);

        if (!touch) {
            return;
        }

        tracking = true;
        dragging = false;
        ignoreGesture = insideMenu(event.target);
        startX = touch.pageX;
        startY = touch.pageY;
    }

    function onMove(event) {
        var touch;
        var dx;
        var dy;
        if (!tracking || ignoreGesture) {
            return;
        }

        touch = firstTouch(event);
        if (!touch) {
            return;
        }

        dx = touch.pageX - startX;
        dy = touch.pageY - startY;

        if (
            !dragging &&
            (Math.abs(dx) >= THRESHOLD || Math.abs(dy) >= THRESHOLD)
        ) {
            dragging = true;
            addClass(stage(), "wut-beta-touch-drag");
        }
    }

    function onEnd() {
        tracking = false;
        ignoreGesture = false;

        if (dragging) {
            dragging = false;
            removeClass(stage(), "wut-beta-touch-drag");
        }
    }

    function start() {
        if (!document.addEventListener) {
            return;
        }

        document.addEventListener("touchstart", onStart, false);
        document.addEventListener("touchmove", onMove, false);
        document.addEventListener("touchend", onEnd, false);
        document.addEventListener("touchcancel", onEnd, false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
