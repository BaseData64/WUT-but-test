/*
 * ============================================================
 * WUT-MIIVERSE
 * CAFE INPUT ADAPTER
 * ============================================================
 *
 * Old-WebKit-safe ES5 only.
 *
 * Supported paths:
 * - Wii U browser / desktop key events:
 *     D-Pad = keyCode 37/38/39/40
 *     A     = keyCode 13
 *     B/Back= keyCode 66/8/27
 *
 * - window.wiiu.gamepad.update() polling:
 *     A     = 0x00008000
 *     B     = 0x00004000
 *     D-Pad = 0x00000200 / 0x00000100 /
 *             0x00000800 / 0x00000400
 *
 * - Touch/click continues to work normally.
 */

(function () {
    "use strict";

    var BUTTON = {
        A:     0x00008000,
        B:     0x00004000,

        UP:    0x00000200,
        DOWN:  0x00000100,
        LEFT:  0x00000800,
        RIGHT: 0x00000400
    };

    var lastHold = 0;
    var timer = null;

    function hasWiiUGamePad() {
        return !!(
            window.wiiu &&
            window.wiiu.gamepad &&
            typeof window.wiiu.gamepad.update === "function"
        );
    }

    function pressedNow(hold, mask) {
        return (
            (hold & mask) !== 0 &&
            (lastHold & mask) === 0
        );
    }

    function callNav(method) {
        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav[method] === "function"
        ) {
            window.WUTPortalNav[method]("gamepad");
        }
    }

    function poll() {
        var state;
        var hold;

        if (!hasWiiUGamePad()) {
            return;
        }

        try {
            state = window.wiiu.gamepad.update();

            if (
                !state ||
                state.isEnabled !== 1 ||
                state.isDataValid !== 1
            ) {
                return;
            }

            hold = state.hold || 0;

            if (pressedNow(hold, BUTTON.LEFT)) {
                callNav("left");
            }

            if (pressedNow(hold, BUTTON.RIGHT)) {
                callNav("right");
            }

            if (pressedNow(hold, BUTTON.UP)) {
                callNav("up");
            }

            if (pressedNow(hold, BUTTON.DOWN)) {
                callNav("down");
            }

            if (pressedNow(hold, BUTTON.A)) {
                callNav("activate");
            }

            /* B is contextual: previous step, or Close on step one. */
            if (pressedNow(hold, BUTTON.B)) {
                callNav("back");
            }

            lastHold = hold;
        }

        catch (error) {
            /* Keep the portal alive even if the browser API is absent/busy. */
        }
    }

    function onKeyDown(event) {
        event = event || window.event;

        var code = event.keyCode || event.which;

        if (code === 37) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.left("key");
            }
            return false;
        }

        if (code === 39) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.right("key");
            }
            return false;
        }

        if (code === 38) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.up("key");
            }
            return false;
        }

        if (code === 40) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.down("key");
            }
            return false;
        }

        if (code === 13) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.activate("key");
            }
            return false;
        }

        if (code === 8 || code === 27 || code === 66) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            if (window.WUTPortalNav) {
                window.WUTPortalNav.back("key");
            }
            return false;
        }
    }

    function start() {
        var device = document.getElementById("wut-input-device");

        document.addEventListener(
            "keydown",
            onKeyDown,
            false
        );

        if (hasWiiUGamePad()) {
            if (device) {
                device.innerHTML = "INPUT: WII U GAMEPAD";
            }

            timer = window.setInterval(
                poll,
                33
            );
        }

        else {
            if (device) {
                device.innerHTML = "INPUT: WEB / KEYBOARD";
            }
        }
    }

    window.WUTCafeInput = {
        start: start,
        available: hasWiiUGamePad,
        buttons: BUTTON
    };

}());
