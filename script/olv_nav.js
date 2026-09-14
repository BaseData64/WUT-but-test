/*
 * WUT-Miiverse V6.1
 * Static GamePad/touch focus for First Run actions and skill choices.
 *
 * Old-WebKit-safe ES5 only. JavaScript changes classes and DOM state;
 * it does not perform visual animation.
 */

(function () {
    "use strict";

    var ids = [
        "wut-setup-close",
        "wut-skill-beginner",
        "wut-skill-intermediate",
        "wut-skill-expert",
        "wut-setup-next"
    ];

    var selected = 4;
    var lastActivate = 0;

    function getButton(index) {
        return document.getElementById(ids[index]);
    }

    function hasClass(element, name) {
        return !!(
            element &&
            (" " + element.className + " ").indexOf(" " + name + " ") !== -1
        );
    }

    function isAvailable(index) {
        var button = getButton(index);

        return !!(
            button &&
            !button.disabled &&
            !hasClass(button, "wut-control-hidden")
        );
    }

    function availableIndexes() {
        var list = [];
        var i;

        for (i = 0; i < ids.length; i += 1) {
            if (isAvailable(i)) {
                list.push(i);
            }
        }

        return list;
    }

    function clearFocus(button) {
        if (!button) {
            return;
        }

        button.className = button.className.replace(/\s*wut-focused/g, "");
    }

    function resolveIndex(target) {
        var i;

        if (typeof target === "number") {
            return target;
        }

        if (target === "left") {
            target = "wut-setup-close";
        }
        else if (target === "right") {
            target = "wut-setup-next";
        }

        for (i = 0; i < ids.length; i += 1) {
            if (ids[i] === target) {
                return i;
            }
        }

        return -1;
    }

    function select(target) {
        var index = resolveIndex(target);
        var available = availableIndexes();
        var button;
        var i;
        var valid = false;

        for (i = 0; i < available.length; i += 1) {
            if (available[i] === index) {
                valid = true;
                break;
            }
        }

        if (!valid) {
            index = available.length ? available[0] : -1;
        }

        selected = index;

        for (i = 0; i < ids.length; i += 1) {
            button = getButton(i);

            if (!button) {
                continue;
            }

            clearFocus(button);

            if (i === selected) {
                button.className += " wut-focused";

                try {
                    button.focus();
                }
                catch (ignore) {}
            }
        }
    }

    function move(direction) {
        var available = availableIndexes();
        var position = -1;
        var i;

        if (!available.length) {
            select(-1);
            return;
        }

        for (i = 0; i < available.length; i += 1) {
            if (available[i] === selected) {
                position = i;
                break;
            }
        }

        if (position < 0) {
            position = 0;
        }
        else {
            position += direction;
        }

        if (position < 0) {
            position = available.length - 1;
        }

        if (position >= available.length) {
            position = 0;
        }

        select(available[position]);
    }

    function refresh(preferredTarget) {
        var preferred = resolveIndex(preferredTarget);

        if (!isAvailable(preferred)) {
            preferred = isAvailable(selected) ? selected : -1;
        }

        select(preferred);
    }

    function activate(source) {
        var now = new Date().getTime();
        var button;
        var action;

        if (now - lastActivate < 180) {
            return;
        }

        lastActivate = now;
        button = getButton(selected);

        if (!button || button.disabled) {
            return;
        }

        action = button.getAttribute("data-wut-action");

        if (
            window.WUTFirstRun &&
            typeof window.WUTFirstRun.activate === "function"
        ) {
            window.WUTFirstRun.activate(action, source || "unknown");
        }
    }

    function back(source) {
        if (
            window.WUTFirstRun &&
            typeof window.WUTFirstRun.back === "function"
        ) {
            window.WUTFirstRun.back(source || "unknown");
        }
    }

    function vertical(direction) {
        if (
            window.WUTFirstRun &&
            typeof window.WUTFirstRun.scroll === "function" &&
            window.WUTFirstRun.scroll(direction)
        ) {
            return;
        }

        move(direction);
    }

    function bindButton(index) {
        var button = getButton(index);

        if (!button || button._wutBound) {
            return;
        }

        button._wutBound = true;

        button.addEventListener(
            "touchstart",
            function () {
                if (isAvailable(index)) {
                    select(index);
                }
            },
            false
        );

        button.addEventListener(
            "mousedown",
            function () {
                if (isAvailable(index)) {
                    select(index);
                }
            },
            false
        );

        button.addEventListener(
            "focus",
            function () {
                if (isAvailable(index)) {
                    select(index);
                }
            },
            false
        );

        button.addEventListener(
            "click",
            function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }

                if (!isAvailable(index)) {
                    return;
                }

                select(index);
                activate("touch");
            },
            false
        );
    }

    function start() {
        var i;

        for (i = 0; i < ids.length; i += 1) {
            bindButton(i);
        }

        refresh("right");
    }

    window.WUTPortalNav = {
        start: start,
        refresh: refresh,
        select: select,

        left: function () {
            move(-1);
        },

        right: function () {
            move(1);
        },

        up: function () {
            vertical(-1);
        },

        down: function () {
            vertical(1);
        },

        activate: activate,
        back: back,

        /* Compatibility alias for the earlier input adapter. */
        close: back
    };

}());
