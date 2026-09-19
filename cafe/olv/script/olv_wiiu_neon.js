/*
 * WUT-Miiverse — Wii U-only Plaza neon pulse.
 * ES5 / old WebKit safe.
 *
 * The Wii U browser can be unreliable with CSS keyframe animation on
 * pseudo-elements. Instead, detect Wii U APIs and toggle one root class.
 */
(function () {
    "use strict";

    var root = document.documentElement;
    var neonOn = false;
    var timer = null;

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

    function isWiiU() {
        return !!(
            (window.wiiu && window.wiiu.gamepad) ||
            window.wiiuBrowser ||
            window.wiiuSound
        );
    }

    function pulse() {
        neonOn = !neonOn;
        if (neonOn) {
            addClass(root, "wut-wiiu-neon-on");
        }
        else {
            removeClass(root, "wut-wiiu-neon-on");
        }
    }

    function start() {
        if (!isWiiU()) {
            return;
        }

        addClass(root, "wut-wiiu");
        removeClass(root, "wut-wiiu-neon-on");

        /* Stronger visible pulse; only opacity changes. */
        timer = window.setInterval(pulse, 560);
    }

    start();
}());
