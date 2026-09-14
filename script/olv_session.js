/*
 * WUT session/profile state.
 *
 * The game-skill numbering follows Grape's Wii U portal profile logic:
 *   0 = Beginner, 1 = Intermediate, 2 = Expert.
 *
 * Identity is populated by olv_identity.js. Sensitive service tokens are
 * never exposed to this object.
 */
(function () {
    "use strict";

    var skillNameToValue = {
        beginner: 0,
        intermediate: 1,
        expert: 2
    };

    var skillValueToName = [
        "beginner",
        "intermediate",
        "expert"
    ];

    var state = {
        version: 1,
        authenticated: false,
        consoleContext: false,
        identityResolved: false,
        identitySource: "none",
        network: null,
        pid: null,
        persistentId: null,
        userId: null,
        pnid: null,
        miiName: null,
        miiDataPresent: false,
        miiImageUrl: null,
        serviceTokenPresent: false,
        paramPackPresent: false,
        nativeIdentityPresent: false,
        nativeIdentityAccepted: false,
        nativeMiiPresent: false,
        serviceTokenFingerprint: null,
        gameSkill: null,
        gameExperience: null,
        setupComplete: false,
        serverProfileAvailable: false,
        miiRendererConfigured: false,
        miiRenderable: false,
        miiSource: "none",
        miiCacheKey: null,
        miiProxyUrl: "../../net/olv/v1/mii/render.php",
        miiStatusUrl: "../../net/olv/v1/mii/status.php"
    };

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

    function normalizeSkill(value) {
        var numeric;

        if (typeof value === "string" && skillNameToValue.hasOwnProperty(value)) {
            return skillNameToValue[value];
        }

        numeric = parseInt(value, 10);

        if (numeric >= 0 && numeric <= 2) {
            return numeric;
        }

        return null;
    }

    function loadLocalSetup() {
        var storedSkill;
        var storedComplete;
        var skill;

        if (!window.WUTStorage) {
            return state;
        }

        storedSkill = window.WUTStorage.get("profile.game_skill");
        storedComplete = window.WUTStorage.get("profile.setup_complete");
        skill = normalizeSkill(storedSkill);

        if (skill !== null) {
            state.gameSkill = skill;
            state.gameExperience = skillValueToName[skill];
        }

        state.setupComplete = storedComplete === "1";
        return state;
    }

    function setGameExperience(value, syncServer) {
        var skill = normalizeSkill(value);
        var persisted = false;

        if (skill === null) {
            return false;
        }

        state.gameSkill = skill;
        state.gameExperience = skillValueToName[skill];

        if (window.WUTStorage) {
            persisted = window.WUTStorage.set(
                "profile.game_skill",
                String(skill)
            );
        }

        if (syncServer !== false) {
            syncProfile(false);
        }

        emit("wut:profile-change", {
            field: "game_skill",
            value: skill,
            name: state.gameExperience,
            localStorage: persisted
        });

        return true;
    }

    function completeSetup(syncServer) {
        var persisted = false;

        state.setupComplete = true;

        if (window.WUTStorage) {
            persisted = window.WUTStorage.set(
                "profile.setup_complete",
                "1"
            );
        }

        if (syncServer !== false) {
            syncProfile(true);
        }

        emit("wut:setup-complete", {
            gameSkill: state.gameSkill,
            gameExperience: state.gameExperience,
            localStorage: persisted
        });

        return persisted;
    }

    function resetSetup() {
        state.gameSkill = null;
        state.gameExperience = null;
        state.setupComplete = false;

        if (window.WUTStorage) {
            window.WUTStorage.remove("profile.game_skill");
            window.WUTStorage.remove("profile.setup_complete");
        }
    }

    function mergeIdentity(payload) {
        var identity;
        var consoleInfo;
        var profile;
        var mii;
        var skill;

        if (!payload) {
            return state;
        }

        identity = payload.identity || {};
        consoleInfo = payload.console || {};
        profile = payload.profile || {};
        mii = payload.mii || {};

        state.consoleContext = !!consoleInfo.detected;
        state.serviceTokenPresent = !!consoleInfo.service_token_present;
        state.paramPackPresent = !!consoleInfo.param_pack_present;
        state.nativeIdentityPresent = !!consoleInfo.native_identity_present;
        state.nativeIdentityAccepted = !!consoleInfo.native_identity_accepted;
        state.nativeMiiPresent = !!consoleInfo.native_mii_present;
        state.serviceTokenFingerprint = consoleInfo.service_token_fingerprint || null;

        if (identity.hasOwnProperty("resolved")) {
            state.identityResolved = !!identity.resolved;
        }
        if (identity.hasOwnProperty("authenticated")) {
            state.authenticated = !!identity.authenticated;
        }
        if (identity.hasOwnProperty("source")) {
            state.identitySource = identity.source || "none";
        }
        if (identity.hasOwnProperty("network")) {
            state.network = identity.network || null;
        }
        if (identity.hasOwnProperty("pid")) {
            state.pid = identity.pid !== undefined && identity.pid !== null ? identity.pid : null;
        }
        if (identity.hasOwnProperty("persistent_id")) {
            state.persistentId = identity.persistent_id !== undefined && identity.persistent_id !== null ?
                identity.persistent_id :
                null;
        }
        if (identity.hasOwnProperty("user_id")) {
            state.userId = identity.user_id || null;
        }
        if (identity.hasOwnProperty("pnid")) {
            state.pnid = identity.pnid || null;
        }
        if (identity.hasOwnProperty("mii_name")) {
            state.miiName = identity.mii_name || null;
        }
        if (identity.hasOwnProperty("mii_data_present")) {
            state.miiDataPresent = !!identity.mii_data_present;
        }
        if (identity.hasOwnProperty("mii_image_url")) {
            state.miiImageUrl = identity.mii_image_url || null;
        }

        if (mii.hasOwnProperty("renderer_configured")) {
            state.miiRendererConfigured = !!mii.renderer_configured;
        }
        if (mii.hasOwnProperty("renderable")) {
            state.miiRenderable = !!mii.renderable;
        }
        if (mii.hasOwnProperty("render_source")) {
            state.miiSource = mii.render_source || "none";
        }
        if (mii.hasOwnProperty("cache_key")) {
            state.miiCacheKey = mii.cache_key || null;
        }
        state.miiProxyUrl = mii.proxy_url || state.miiProxyUrl;
        state.miiStatusUrl = mii.status_url || state.miiStatusUrl;

        skill = normalizeSkill(profile.game_skill);
        if (skill !== null) {
            state.gameSkill = skill;
            state.gameExperience = skillValueToName[skill];
            state.serverProfileAvailable = true;

            if (window.WUTStorage) {
                window.WUTStorage.set("profile.game_skill", String(skill));
            }
        }

        if (profile.setup_complete === true || profile.setup_complete === 1 || profile.setup_complete === "1") {
            state.setupComplete = true;
            state.serverProfileAvailable = true;

            if (window.WUTStorage) {
                window.WUTStorage.set("profile.setup_complete", "1");
            }
        }

        emit("wut:session-ready", getPublicState());
        return state;
    }

    function encodeForm(data) {
        var pairs = [];
        var key;

        for (key in data) {
            if (data.hasOwnProperty(key) && data[key] !== null && data[key] !== undefined) {
                pairs.push(
                    encodeURIComponent(key) + "=" + encodeURIComponent(String(data[key]))
                );
            }
        }

        return pairs.join("&");
    }

    function syncProfile(markComplete) {
        var xhr;
        var body;

        if (!window.XMLHttpRequest || state.gameSkill === null) {
            return false;
        }

        body = encodeForm({
            game_skill: state.gameSkill,
            setup_complete: markComplete || state.setupComplete ? 1 : 0
        });

        try {
            xhr = new XMLHttpRequest();
            xhr.open("POST", "../../net/olv/v1/profile/setup.php", true);
            xhr.setRequestHeader(
                "Content-Type",
                "application/x-www-form-urlencoded; charset=UTF-8"
            );
            xhr.send(body);
            return true;
        }
        catch (ignore) {
            return false;
        }
    }

    function getPublicState() {
        return {
            version: state.version,
            authenticated: state.authenticated,
            consoleContext: state.consoleContext,
            identityResolved: state.identityResolved,
            identitySource: state.identitySource,
            network: state.network,
            pid: state.pid,
            persistentId: state.persistentId,
            userId: state.userId,
            pnid: state.pnid,
            miiName: state.miiName,
            miiDataPresent: state.miiDataPresent,
            miiImageUrl: state.miiImageUrl,
            serviceTokenPresent: state.serviceTokenPresent,
            paramPackPresent: state.paramPackPresent,
            nativeIdentityPresent: state.nativeIdentityPresent,
            nativeIdentityAccepted: state.nativeIdentityAccepted,
            nativeMiiPresent: state.nativeMiiPresent,
            serviceTokenFingerprint: state.serviceTokenFingerprint,
            gameSkill: state.gameSkill,
            gameExperience: state.gameExperience,
            setupComplete: state.setupComplete,
            miiRendererConfigured: state.miiRendererConfigured,
            miiRenderable: state.miiRenderable,
            miiSource: state.miiSource,
            miiCacheKey: state.miiCacheKey,
            miiProxyUrl: state.miiProxyUrl,
            miiStatusUrl: state.miiStatusUrl
        };
    }

    loadLocalSetup();

    window.WUTSession = {
        state: state,
        loadLocalSetup: loadLocalSetup,
        mergeIdentity: mergeIdentity,
        setGameExperience: setGameExperience,
        completeSetup: completeSetup,
        resetSetup: resetSetup,
        syncProfile: syncProfile,
        getState: getPublicState,
        skillNameToValue: skillNameToValue,
        skillValueToName: skillValueToName
    };
}());
