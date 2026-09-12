/*
 * WUT Mii adapter.
 *
 * The API shape follows ariankordi/nwf-mii-cemu-toy:
 *   /mii_data/{nnid}?api_id=1
 *   /miis/image.png?data=...|nnid=...|pid=...
 *
 * WUT normally uses the same-origin PHP proxy so the Wii U never needs to
 * know where the renderer process is running.
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

    function currentUserImageURL(width, type) {
        var state;
        var separator;
        var url;

        if (!window.WUTSession) {
            return null;
        }

        state = window.WUTSession.getState();
        width = clampWidth(width);
        type = type || "face";

        if (state.miiImageUrl) {
            return state.miiImageUrl;
        }

        if (!state.miiProxyUrl) {
            return null;
        }

        if (!state.identityResolved && !state.miiData && !state.pid && !state.pnid) {
            return null;
        }

        url = state.miiProxyUrl;
        separator = url.indexOf("?") === -1 ? "?" : "&";

        return url + separator +
            "width=" + encodeURIComponent(String(width)) +
            "&type=" + encodeURIComponent(type);
    }

    function bindImage(image, fallbackUrl, width, type) {
        var url;

        if (!image) {
            return false;
        }

        url = currentUserImageURL(width, type);

        if (!url) {
            if (fallbackUrl) {
                image.src = fallbackUrl;
            }
            return false;
        }

        image.onerror = function () {
            image.onerror = null;
            if (fallbackUrl) {
                image.src = fallbackUrl;
            }
        };
        image.src = url;
        return true;
    }

    window.WUTMii = {
        currentUserImageURL: currentUserImageURL,
        bindImage: bindImage
    };
}());
