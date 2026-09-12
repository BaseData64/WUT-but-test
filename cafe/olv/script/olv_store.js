/*
 * WUT local setup storage.
 * ES5 only for the Wii U browser.
 *
 * Only setup/preferences are persisted here. Authentication tokens and
 * Nintendo/Pretendo service headers are intentionally never written to
 * localStorage.
 */
(function () {
    "use strict";

    var prefix = "wut.";
    var memory = {};

    function set(key, value) {
        var text = String(value);

        try {
            if (window.localStorage) {
                window.localStorage.setItem(prefix + key, text);
                return true;
            }
        }
        catch (ignore) {}

        memory[key] = text;
        return false;
    }

    function get(key) {
        try {
            if (window.localStorage) {
                return window.localStorage.getItem(prefix + key);
            }
        }
        catch (ignore) {}

        return memory.hasOwnProperty(key) ? memory[key] : null;
    }

    function remove(key) {
        try {
            if (window.localStorage) {
                window.localStorage.removeItem(prefix + key);
            }
        }
        catch (ignore) {}

        if (memory.hasOwnProperty(key)) {
            delete memory[key];
        }
    }

    window.WUTStorage = {
        set: set,
        get: get,
        remove: remove
    };
}());
