/*
 * WUT-Miiverse — Native Identity bridge adapter
 *
 * Old Wii U WebKit compatible: ES5 syntax + XMLHttpRequest.
 * No ServiceToken, password, PNID form, fetch(), Promise, or modules.
 */
(function (global) {
    "use strict";

    var API_DIRECT =
        "/WUT-miiverse/net/olv/v1/native/current.php";

    var API_PORTAL =
        "/net/olv/v1/native/current.php";

    function isPortalHost() {
        var host = "";
        try {
            host = String(global.location.hostname || "").toLowerCase();
        } catch (e) {
        }
        return host === "portal.olv.pretendo.cc";
    }

    function endpoint() {
        return isPortalHost() ? API_PORTAL : API_DIRECT;
    }

    function parseJSON(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    function refresh(callback) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function () {
            var data;

            if (xhr.readyState !== 4) {
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                callback(new Error("native_identity_http_" + xhr.status), null);
                return;
            }

            data = parseJSON(xhr.responseText);

            if (!data || !data.ok) {
                callback(
                    new Error(
                        data && data.reason ?
                            String(data.reason) :
                            "native_identity_unavailable"
                    ),
                    data
                );
                return;
            }

            global.WUTNativeIdentity.current = data;
            callback(null, data);
        };

        xhr.open(
            "GET",
            endpoint() + "?_=" + String(new Date().getTime()),
            true
        );

        try {
            xhr.setRequestHeader("Cache-Control", "no-cache");
        } catch (e) {
        }

        xhr.send(null);
    }

    function setText(selector, value) {
        var nodes;
        var i;

        try {
            nodes = document.querySelectorAll(selector);
        } catch (e) {
            return;
        }

        for (i = 0; i < nodes.length; i++) {
            if ("textContent" in nodes[i]) {
                nodes[i].textContent = value;
            } else {
                nodes[i].innerText = value;
            }
        }
    }

    function setMiiImages(url, version) {
        var nodes;
        var i;
        var finalUrl = url;

        if (!url) {
            return;
        }

        if (url.indexOf("?") >= 0) {
            finalUrl += "&native_v=" + encodeURIComponent(String(version || 0));
        } else {
            finalUrl += "?native_v=" + encodeURIComponent(String(version || 0));
        }

        try {
            nodes = document.querySelectorAll("[data-wut-native-mii]");
        } catch (e) {
            return;
        }

        for (i = 0; i < nodes.length; i++) {
            nodes[i].src = finalUrl;
        }
    }

    function applyData(data) {
        if (!data || !data.ok) {
            return;
        }

        setText(
            "[data-wut-native-account]",
            data.account_id || ""
        );

        setText(
            "[data-wut-native-pid]",
            String(data.pid || "")
        );

        setText(
            "[data-wut-native-persistent-id]",
            String(data.persistent_id || "")
        );

        setMiiImages(
            data.mii_url || "",
            data.received_at || 0
        );

        try {
            document.documentElement.setAttribute(
                "data-wut-native-identity",
                "ready"
            );
        } catch (e) {
        }
    }

    function apply(callback) {
        refresh(function (error, data) {
            if (!error && data) {
                applyData(data);
            }

            if (callback) {
                callback(error, data);
            }
        });
    }

    function boot() {
        apply();
    }

    global.WUTNativeIdentity = {
        current: null,
        refresh: refresh,
        apply: apply,
        applyData: applyData
    };

    if (document.readyState === "complete") {
        global.setTimeout(boot, 0);
    } else if (global.addEventListener) {
        global.addEventListener("load", boot, false);
    } else if (global.attachEvent) {
        global.attachEvent("onload", boot);
    }
}(window));
