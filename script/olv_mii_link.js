/* WUT browser-session Mii link controller — ES5 / Wii U old WebKit. */
(function () {
    "use strict";

    var endpoint = "../../net/olv/v1/mii/link.php";
    var renderEndpoint = "../../net/olv/v1/mii/render.php";
    var fallbackImage = "res/olv/mii/img_unknown_MiiIcon.png";
    var csrfToken = "";
    var linked = false;
    var busy = false;
    var controls = [];
    var selected = 4;

    function byId(id) {
        return document.getElementById(id);
    }

    function parseJSON(text) {
        try {
            return JSON.parse(text);
        }
        catch (ignore) {
            return null;
        }
    }

    function encodeForm(values) {
        var pairs = [];
        var key;

        for (key in values) {
            if (values.hasOwnProperty(key)) {
                pairs.push(
                    encodeURIComponent(key) + "=" +
                    encodeURIComponent(String(values[key] || ""))
                );
            }
        }

        return pairs.join("&");
    }

    function setStatus(message, kind) {
        var status = byId("wut-link-status");

        if (!status) {
            return;
        }

        status.className = "wut-link-status";
        if (kind === "ok") {
            status.className += " wut-link-ok";
        }
        else if (kind === "error") {
            status.className += " wut-link-error";
        }

        status.innerHTML = message;
    }

    function showLoading(show) {
        try {
            if (
                window.wiiuBrowser &&
                typeof window.wiiuBrowser.showLoadingIcon === "function"
            ) {
                window.wiiuBrowser.showLoadingIcon(!!show);
            }
        }
        catch (ignore) {}
    }

    function setBusy(value) {
        var button = byId("wut-link-connect");

        busy = !!value;
        if (button) {
            button.disabled = busy;
        }
        showLoading(busy);
    }

    function portalURL() {
        return "cafe-olv-portal.html";
    }

    function openPortal() {
        if (!busy && window.location) {
            window.location.href = portalURL();
        }
    }

    function setActionLabel(value) {
        var label = byId("wut-link-action-label");
        if (label) {
            label.innerHTML = value;
        }
    }

    function setPreview(link) {
        var image = byId("wut-link-mii");
        var name = byId("wut-link-preview-name");
        var network = byId("wut-link-preview-network");
        var version = link && link.cache_key ? link.cache_key : String(new Date().getTime());

        if (!link || !link.renderable) {
            linked = false;
            setActionLabel("Connect Mii");
            if (image) {
                image.onerror = null;
                image.src = fallbackImage;
            }
            return;
        }

        linked = true;
        setActionLabel("Open Portal");

        if (name) {
            name.innerHTML = link.mii_name || link.pnid || "Connected Mii";
        }
        if (network) {
            network.innerHTML = String(link.network || "WUT").toUpperCase() + " // CONNECTED";
        }
        if (byId("wut-link-network") && link.network) {
            byId("wut-link-network").value = link.network;
        }
        if (byId("wut-link-pnid") && link.pnid) {
            byId("wut-link-pnid").value = link.pnid;
        }
        if (byId("wut-link-name") && link.mii_name && link.mii_name !== link.pnid) {
            byId("wut-link-name").value = link.mii_name;
        }

        if (image) {
            image.onload = function () {
                setStatus("Mii connected. Press Open Portal to continue.", "ok");
            };
            image.onerror = function () {
                image.onerror = null;
                image.src = fallbackImage;
                linked = false;
                setActionLabel("Try Again");
                setStatus("The session linked, but its PNG could not be loaded.", "error");
            };
            image.src = renderEndpoint + "?width=160&type=face&v=" + encodeURIComponent(version);
        }
    }

    function errorMessage(code) {
        if (code === "invalid_pnid") {
            return "Use only letters, numbers, periods, underscores or hyphens.";
        }
        if (code === "mii_not_found") {
            return "No Mii was found for that ID and network.";
        }
        if (code === "renderer_not_configured") {
            return "The WUT server has no Mii renderer configured.";
        }
        if (code === "invalid_session_token") {
            return "The link session expired. Reload this page and try again.";
        }
        if (code === "browser_link_disabled") {
            return "Browser Mii linking is disabled on this WUT server.";
        }
        return "The renderer did not respond. Check the PC internet connection and try again.";
    }

    function requestState() {
        var xhr = new XMLHttpRequest();

        xhr.open("GET", endpoint + "?t=" + new Date().getTime(), true);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onreadystatechange = function () {
            var response;

            if (xhr.readyState !== 4) {
                return;
            }

            response = parseJSON(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && response && response.ok) {
                csrfToken = response.csrf_token || "";

                if (!response.link.enabled) {
                    setStatus("Browser Mii linking is disabled in net/cfg/wut.php.", "error");
                }
                else if (!response.link.renderer_configured) {
                    setStatus("The renderer is not configured in net/cfg/wut.php.", "error");
                }
                else if (response.link.renderable) {
                    setPreview(response.link);
                }
                else {
                    setStatus("Renderer ready. Enter your PNID or NNID.", "");
                }
                return;
            }

            setStatus("PHP is unavailable. Open WUT through XAMPP/Apache, not Live Server.", "error");
        };
        xhr.send(null);
    }

    function submitLink() {
        var pnid = byId("wut-link-pnid").value.replace(/^\s+|\s+$/g, "");
        var network = byId("wut-link-network").value;
        var miiName = byId("wut-link-name").value.replace(/^\s+|\s+$/g, "");
        var xhr;
        var body;

        if (busy) {
            return false;
        }

        if (linked) {
            openPortal();
            return true;
        }

        if (!/^[A-Za-z0-9._-]{1,32}$/.test(pnid)) {
            setStatus(errorMessage("invalid_pnid"), "error");
            byId("wut-link-pnid").focus();
            return false;
        }

        if (!csrfToken) {
            setStatus("The link session is not ready. Reload this page.", "error");
            return false;
        }

        setBusy(true);
        setStatus("Finding and rendering your Mii...", "");

        body = encodeForm({
            csrf_token: csrfToken,
            network: network,
            pnid: pnid,
            mii_name: miiName
        });

        xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onreadystatechange = function () {
            var response;

            if (xhr.readyState !== 4) {
                return;
            }

            setBusy(false);
            response = parseJSON(xhr.responseText);

            if (xhr.status >= 200 && xhr.status < 300 && response && response.ok) {
                csrfToken = response.csrf_token || csrfToken;
                setPreview(response.link);
                return;
            }

            setStatus(errorMessage(response && response.error), "error");
        };
        xhr.send(body);
        return true;
    }

    function focus(index) {
        var i;
        var node;

        if (!controls.length || busy) {
            return false;
        }

        if (index < 0) {
            index = controls.length - 1;
        }
        if (index >= controls.length) {
            index = 0;
        }

        for (i = 0; i < controls.length; i += 1) {
            node = controls[i];
            node.className = node.className
                .replace(/\s*wut-focused/g, "")
                .replace(/\s*wut-link-field-focus/g, "");
        }

        selected = index;
        node = controls[selected];
        if (node.tagName && (node.tagName.toLowerCase() === "input" || node.tagName.toLowerCase() === "select")) {
            node.className += " wut-link-field-focus";
        }
        else {
            node.className += " wut-focused";
        }

        try {
            node.focus();
        }
        catch (ignore) {}

        return true;
    }

    function activate() {
        var node = controls[selected];
        var tag;

        if (!node || busy) {
            return false;
        }

        if (node.id === "wut-link-connect") {
            return submitLink();
        }
        if (node.id === "wut-link-back") {
            openPortal();
            return true;
        }

        tag = node.tagName ? node.tagName.toLowerCase() : "";
        try {
            node.focus();
            if (tag === "select") {
                node.click();
            }
        }
        catch (ignore) {}
        return true;
    }

    function bindControls() {
        var nodes = document.querySelectorAll("[data-wut-link-control='1']");
        var i;

        controls = [];
        for (i = 0; i < nodes.length; i += 1) {
            controls.push(nodes[i]);
            (function (index, node) {
                node.addEventListener("focus", function () {
                    if (!busy) {
                        focus(index);
                    }
                }, false);
                node.addEventListener("touchstart", function () {
                    if (!busy) {
                        focus(index);
                    }
                }, false);
            }(i, nodes[i]));
        }
    }

    window.WUTPortalNav = {
        up: function () { return focus(selected - 1); },
        down: function () { return focus(selected + 1); },
        left: function () { return focus(selected - 1); },
        right: function () { return focus(selected + 1); },
        activate: activate,
        back: function () { openPortal(); return true; },
        refresh: function () { return focus(selected); }
    };

    function boot() {
        var form = byId("wut-mii-link-form");
        var back = byId("wut-link-back");
        var connect = byId("wut-link-connect");

        bindControls();

        if (form) {
            form.addEventListener("submit", function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
                submitLink();
                return false;
            }, false);
        }

        if (back) {
            back.addEventListener("click", function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
                openPortal();
            }, false);
        }

        if (connect) {
            connect.addEventListener("click", function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }
                submitLink();
                return false;
            }, false);
        }

        focus(4);
        requestState();

        if (window.WUTCafeInput && typeof window.WUTCafeInput.start === "function") {
            window.WUTCafeInput.start();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, false);
    }
    else {
        boot();
    }
}());
