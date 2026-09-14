/*
 * WUT Mii image adapter (ES5 / Wii U old WebKit).
 *
 * The browser never receives raw StoreData and never contacts FFL directly.
 * It requests a same-origin PNG from WUT's PHP gateway. The gateway then uses
 * the linked server session to call ariankordi/nwf-mii-cemu-toy.
 */
(function () {
    "use strict";

    function clampWidth(width) {
        width = parseInt(width, 10);

        if (!width || width < 48) {
            width = 96;
        }

        if (width > 512) {
            width = 512;
        }

        return width;
    }

    function appendParameter(url, name, value) {
        var separator = url.indexOf("?") === -1 ? "?" : "&";
        return url + separator + encodeURIComponent(name) + "=" +
            encodeURIComponent(String(value));
    }

    function canUseProxy(state) {
        var inferredSource;

        if (!state || !state.miiRendererConfigured || !state.miiProxyUrl) {
            return false;
        }

        inferredSource = !!(
            state.miiDataPresent ||
            state.pid ||
            state.pnid
        );

        return !!(
            state.miiRenderable ||
            inferredSource
        );
    }

    function proxyImageURL(state, width, type, expression) {
        var url = state.miiProxyUrl;

        url = appendParameter(url, "width", clampWidth(width));
        url = appendParameter(url, "type", type || "face");
        url = appendParameter(url, "expression", expression || "normal");

        /*
         * This short server-generated hash changes when a linked identity or
         * StoreData changes. It prevents old WebKit from showing the previous
         * user's cached icon after an account link/switch.
         */
        if (state.miiCacheKey) {
            url = appendParameter(url, "v", state.miiCacheKey);
        }

        return url;
    }

    function currentUserImageURL(width, type, expression) {
        var state;

        if (!window.WUTSession) {
            return null;
        }

        state = window.WUTSession.getState();

        if (canUseProxy(state)) {
            return proxyImageURL(state, width, type, expression);
        }

        if (state.miiImageUrl) {
            return state.miiImageUrl;
        }

        return null;
    }

    function bindImage(image, fallbackUrl, width, type, expression) {
        var state;
        var primaryUrl;
        var secondaryUrl = null;
        var triedSecondary = false;

        if (!image || !window.WUTSession) {
            return false;
        }

        state = window.WUTSession.getState();
        primaryUrl = currentUserImageURL(width, type, expression);
        image.onerror = null;
        image.onload = null;

        if (!primaryUrl) {
            image.setAttribute("data-wut-mii-state", "unlinked");
            if (fallbackUrl) {
                image.src = fallbackUrl;
            }
            return false;
        }

        if (canUseProxy(state) && state.miiImageUrl && state.miiImageUrl !== primaryUrl) {
            secondaryUrl = state.miiImageUrl;
        }

        image.onload = function () {
            image.setAttribute("data-wut-mii-state", "ready");
        };

        image.onerror = function () {
            if (!triedSecondary && secondaryUrl) {
                triedSecondary = true;
                image.setAttribute("data-wut-mii-state", "remote-fallback");
                image.src = secondaryUrl;
                return;
            }

            image.onerror = null;
            image.onload = null;
            image.setAttribute("data-wut-mii-state", "fallback");
            if (fallbackUrl) {
                image.src = fallbackUrl;
            }
        };

        image.setAttribute("data-wut-mii-state", "loading");
        image.src = primaryUrl;
        return true;
    }

    window.WUTMii = {
        currentUserImageURL: currentUserImageURL,
        bindImage: bindImage,
        canUseProxy: canUseProxy
    };
}());
