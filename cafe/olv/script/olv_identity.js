/*
 * WUT identity bootstrap.
 *
 * Source ideas:
 * - Grape renders session/profile identity into the Portal shell before the
 *   page starts, then the JS consumes the resulting DOM.
 * - The Wii U Miiverse applet sends X-Nintendo-ServiceToken and
 *   X-Nintendo-ParamPack headers to the portal. Those headers must be handled
 *   server-side; raw values are never copied into browser JavaScript.
 */
(function () {
    "use strict";

    var bootstrapUrl = "../../net/olv/v1/bootstrap.php";

    function emit(name, detail) {
        var event;

        try {
            event = document.createEvent("Event");
            event.initEvent(name, true, true);
            event.wutDetail = detail || {};
            window.dispatchEvent(event);
        }
        catch (ignore) {}
    }

    function parseJSON(text) {
        try {
            return JSON.parse(text);
        }
        catch (ignore) {
            return null;
        }
    }

    function bodyFallback() {
        var body = document.body;
        var payload = {
            identity: {},
            console: {},
            profile: {},
            mii: {}
        };
        var value;

        if (!body) {
            return payload;
        }

        value = body.getAttribute("data-user-id");
        if (value) {
            payload.identity.user_id = value;
            payload.identity.resolved = true;
            payload.identity.authenticated = true;
            payload.identity.source = "portal-body-data";
        }

        value = body.getAttribute("data-pid");
        if (value) {
            payload.identity.pid = value;
            payload.identity.resolved = true;
        }

        value = body.getAttribute("data-pnid");
        if (value) {
            payload.identity.pnid = value;
            payload.identity.resolved = true;
        }

        value = body.getAttribute("data-mii-name");
        if (value) {
            payload.identity.mii_name = value;
        }

        value = body.getAttribute("data-mii-image-url");
        if (value) {
            payload.identity.mii_image_url = value;
        }

        value = body.getAttribute("data-game-skill");
        if (value !== null && value !== "") {
            payload.profile.game_skill = value;
        }

        value = body.getAttribute("data-setup-complete");
        if (value === "1" || value === "true") {
            payload.profile.setup_complete = true;
        }

        payload.console.detected =
            navigator.userAgent.indexOf("Nintendo WiiU") !== -1 ||
            navigator.userAgent.toLowerCase().indexOf("miiverse") !== -1;

        return payload;
    }

    function apply(payload, source) {
        if (window.WUTSession && typeof window.WUTSession.mergeIdentity === "function") {
            window.WUTSession.mergeIdentity(payload);
        }

        emit("wut:identity-ready", {
            source: source,
            payload: payload
        });
    }

    function fetchBootstrap(callback) {
        var xhr;
        var url = bootstrapUrl;
        var search = window.location && window.location.search ? window.location.search : "";
        var host = window.location && window.location.hostname ? window.location.hostname : "";

        /* Forward development identity parameters only on localhost. */
        if (
            (host === "127.0.0.1" || host === "localhost" || host === "::1") &&
            search.indexOf("wutdev=1") !== -1
        ) {
            url += search;
        }

        if (!window.XMLHttpRequest) {
            callback(false);
            return;
        }

        try {
            xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.setRequestHeader("Accept", "application/json");
            xhr.onreadystatechange = function () {
                var payload;

                if (xhr.readyState !== 4) {
                    return;
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    payload = parseJSON(xhr.responseText);
                    if (payload) {
                        apply(payload, "server-bootstrap");
                        callback(true);
                        return;
                    }
                }

                callback(false);
            };
            xhr.send(null);
        }
        catch (ignore) {
            callback(false);
        }
    }

    function start() {
        /*
         * Apply body data immediately so a future PHP-rendered portal can boot
         * without waiting on a second request, mirroring Grape's shell model.
         */
        apply(bodyFallback(), "body-fallback");

        fetchBootstrap(function (worked) {
            var state;

            if (window.console && console.log) {
                state = window.WUTSession ? window.WUTSession.getState() : {};

                if (worked && state.serviceTokenPresent && state.paramPackPresent) {
                    console.log("[WUT:IDENTITY] Miiverse applet headers detected by server.");
                }
                else if (worked) {
                    console.log("[WUT:IDENTITY] Bootstrap ready; no resolved console identity yet.");
                }
                else {
                    console.log("[WUT:IDENTITY] PHP bootstrap unavailable; local setup mode active.");
                }
            }
        });
    }

    window.WUTIdentity = {
        start: start,
        bootstrapUrl: bootstrapUrl
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
