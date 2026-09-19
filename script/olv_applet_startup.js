/*
 * WUT-Miiverse — Miiverse applet startup + Portal BGM handoff
 * -----------------------------------------------------------
 * Existing users can enter the Portal directly through entry.php, so the
 * First Run document is intentionally bypassed.
 *
 * The original Miiverse Portal does two separate native jobs:
 *   1) endStartUp() finishes the applet startup overlay.
 *   2) wiiuSound.playSoundByName("BGM_OLV_MAIN", 3) selects the normal
 *      Portal BGM. Welcome uses BGM_OLV_INIT on the same BGM channel.
 *
 * Therefore direct Portal entry must perform BOTH jobs. Merely calling
 * endStartUp() leaves the init/loading BGM playing.
 *
 * ES5 / Wii U WebKit safe. Harmless in desktop browser mode.
 */
(function () {
    var startupFinished = false;
    var mainBgmStarted = false;
    var browserRetries = 0;
    var soundRetries = 0;
    var maxBrowserRetries = 24;
    var maxSoundRetries = 40;

    function getBrowser() {
        try {
            if (typeof window !== "undefined" && window.wiiuBrowser) {
                return window.wiiuBrowser;
            }
            if (typeof wiiuBrowser !== "undefined") {
                return wiiuBrowser;
            }
        } catch (e) {
        }
        return null;
    }

    function getSound() {
        try {
            if (typeof window !== "undefined" && window.wiiuSound) {
                return window.wiiuSound;
            }
            if (typeof wiiuSound !== "undefined") {
                return wiiuSound;
            }
        } catch (e) {
        }
        return null;
    }

    function finishStartup() {
        var browser = getBrowser();

        if (!browser) {
            return false;
        }

        try {
            if (typeof browser.showLoadingIcon === "function") {
                browser.showLoadingIcon(false);
            }
        } catch (e1) {
        }

        if (!startupFinished) {
            try {
                if (typeof browser.endStartUp === "function") {
                    browser.endStartUp();
                    startupFinished = true;
                }
            } catch (e2) {
            }
        }

        return startupFinished;
    }

    /*
     * Original Miiverse behavior recovered from portal/complete.js:
     * normal Portal routes use BGM_OLV_MAIN through mode/channel 3.
     * Playing the main BGM on that channel replaces the init/loading BGM.
     */
    function startPortalBGM() {
        var sound;

        if (mainBgmStarted) {
            return true;
        }

        sound = getSound();
        if (!sound || typeof sound.playSoundByName !== "function") {
            return false;
        }

        try {
            sound.playSoundByName("BGM_OLV_MAIN", 3);
            mainBgmStarted = true;
            return true;
        } catch (e) {
        }

        return false;
    }

    function retryBrowserStartup() {
        if (finishStartup()) {
            /* Sound may become available a little later than wiiuBrowser. */
            window.setTimeout(retryPortalBGM, 0);
            return;
        }

        browserRetries += 1;
        if (browserRetries < maxBrowserRetries) {
            window.setTimeout(retryBrowserStartup, 250);
        }
    }

    function retryPortalBGM() {
        if (startPortalBGM()) {
            return;
        }

        soundRetries += 1;
        if (soundRetries < maxSoundRetries) {
            window.setTimeout(retryPortalBGM, 250);
        }
    }

    /* Keep helpers available to the rest of WUT without touching First Run. */
    window.wutFinishMiiverseStartup = finishStartup;
    window.wutStartPortalBGM = startPortalBGM;

    /* Probe immediately. */
    window.setTimeout(retryBrowserStartup, 0);
    window.setTimeout(retryPortalBGM, 0);

    /* Probe again after normal page load in case native globals arrived late. */
    function onLoad() {
        finishStartup();
        retryPortalBGM();
    }

    if (window.addEventListener) {
        window.addEventListener("load", onLoad, false);
    } else if (window.attachEvent) {
        window.attachEvent("onload", onLoad);
    }
}());
