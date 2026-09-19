/*
 * WUT-Miiverse — local WUT post service client.
 * ES5 / old Wii U WebKit safe.
 *
 * Posts are persisted by net/olv/v1/posts/*.php so PC and Wii U clients using
 * the same WUT/XAMPP server see the same Activity Feed. This is intentionally
 * a development post service; comments/Yeah moderation come later.
 */
(function () {
    "use strict";

    var listEndpoint = "../../net/olv/v1/posts/list.php";
    var createEndpoint = "../../net/olv/v1/posts/create.php";
    var started = false;
    var loading = false;
    var composerOpen = false;
    var composerCommunity = null;

    function escapeHTML(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function encodeForm(data) {
        var out = [];
        var key;
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(data[key])));
            }
        }
        return out.join("&");
    }

    function request(method, url, data, callback) {
        var xhr = new XMLHttpRequest();
        var body = null;

        if (method === "GET" && data) {
            url += (url.indexOf("?") >= 0 ? "&" : "?") + encodeForm(data);
        }
        else if (data) {
            body = encodeForm(data);
        }

        xhr.onreadystatechange = function () {
            var payload = null;
            if (xhr.readyState !== 4) {
                return;
            }
            try {
                payload = JSON.parse(xhr.responseText || "{}");
            }
            catch (ignore) {}
            callback(xhr.status >= 200 && xhr.status < 300 && payload && payload.ok, payload || {});
        };

        xhr.open(method, url, true);
        if (method !== "GET") {
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
        }
        xhr.send(body);
    }

    function sessionData() {
        var state = {};
        if (window.WUTSession && typeof window.WUTSession.getState === "function") {
            state = window.WUTSession.getState() || {};
        }
        return {
            name: state.miiName || "Cafe User",
            id: state.pnid || state.userId || "WUT_USER"
        };
    }

    function relativeTime(epochSeconds) {
        var now = Math.floor(new Date().getTime() / 1000);
        var delta = now - parseInt(epochSeconds, 10);
        var value;

        if (!delta || delta < 45) {
            return "Just now";
        }
        if (delta < 3600) {
            value = Math.floor(delta / 60);
            return value + " min. ago";
        }
        if (delta < 86400) {
            value = Math.floor(delta / 3600);
            return value + (value === 1 ? " hour ago" : " hours ago");
        }
        value = Math.floor(delta / 86400);
        return value + (value === 1 ? " day ago" : " days ago");
    }

    function safeIcon(src) {
        src = String(src || "res/olv/default-image.png");
        if (src.indexOf("://") >= 0 || src.indexOf("javascript:") === 0) {
            return "res/olv/default-image.png";
        }
        return src;
    }

    function postMiiURL(post) {
        var url = String((post && post.mii_url) || "");
        if (!url || url.indexOf("javascript:") === 0 || url.indexOf("://") >= 0) {
            return "res/olv/mii/img_unknown_MiiIcon.png";
        }
        return url;
    }

    function communityId(value) {
        value = String(value || "wut-plaza").toLowerCase();
        value = value.replace(/\s+community$/i, "");
        value = value.replace(/[^a-z0-9]+/g, "-");
        value = value.replace(/^-+|-+$/g, "");
        return value || "wut-plaza";
    }

    function bindCurrentMiiImages(ids) {
        var i;
        var image;
        for (i = 0; i < ids.length; i += 1) {
            image = document.getElementById(ids[i]);
            if (image && window.WUTMii && typeof window.WUTMii.bindImage === "function") {
                window.WUTMii.bindImage(image, "res/olv/mii/img_unknown_MiiIcon.png", 96, "face");
            }
        }
    }

    function render(posts) {
        var list = document.getElementById("wut-feed-list");
        var html = "";
        var i;
        var post;

        if (!list) {
            return;
        }

        if (!posts || !posts.length) {
            list.innerHTML = '<li class="wut-feed-empty"><strong>No posts yet.</strong><span>Open a Community and be the first to post.</span></li>';
            return;
        }

        for (i = 0; i < posts.length; i += 1) {
            post = posts[i] || {};
            html += '<li class="wut-live-post">';
            html += '<a href="#post-' + escapeHTML(post.id || i) + '" data-wut-focus-item="1" data-wut-demo-action="feed-post" data-wut-label="Post by ' + escapeHTML(post.author_name || "Cafe User") + '">';
            html += '<span class="wut-post-user-icon"><img src="' + escapeHTML(postMiiURL(post)) + '" onerror="this.onerror=null;this.src=\'res/olv/mii/img_unknown_MiiIcon.png\';" alt=""></span>';
            html += '<span class="wut-post-body">';
            html += '<span class="wut-post-head"><strong>' + escapeHTML(post.author_name || "Cafe User") + '</strong><small>' + escapeHTML(post.author_id || "WUT_USER") + '</small><em>' + escapeHTML(relativeTime(post.created_at)) + '</em></span>';
            html += '<span class="wut-post-community"><img src="' + escapeHTML(safeIcon(post.community_icon)) + '" onerror="this.onerror=null;this.src=\'res/olv/default-image.png\';" alt="">' + escapeHTML(post.community || "WUT Plaza") + '</span>';
            if (String(post.kind || "text") === "drawing" && post.drawing_path) {
                html += '<span class="wut-post-drawing"><img src="' + escapeHTML(safeIcon(post.drawing_path)) + '" onerror="this.onerror=null;this.parentNode.innerHTML=\'<em>Drawing unavailable.</em>\';" alt="Community drawing"></span>';
            }
            else {
                html += '<span class="wut-post-copy">' + escapeHTML(post.text || "") + '</span>';
            }
            html += '<span class="wut-post-meta"><b class="wut-yeah-control">Yeah!</b><span>' + parseInt(post.yeahs || 0, 10) + ' Yeahs</span><span>' + parseInt(post.comments || 0, 10) + ' Comments</span><i>' + escapeHTML(post.platform || "WII U") + '</i></span>';
            html += '</span></a></li>';
        }

        list.innerHTML = html;


        if (window.WUTPortalSections && typeof window.WUTPortalSections.refreshBindings === "function") {
            window.WUTPortalSections.refreshBindings();
        }
    }

    function renderCommunity(posts, info) {
        var list = document.getElementById("wut-community-post-list");
        var html = "";
        var i;
        var post;
        var icon = safeIcon(info && info.icon);

        if (!list) {
            return;
        }

        if (!posts || !posts.length) {
            list.innerHTML = '<div class="wut-community-post-empty"><strong>No posts in this community yet.</strong><span>Be the first to share something.</span></div>';
            if (window.WUTCommunities && typeof window.WUTCommunities.refreshDetailItems === "function") {
                window.WUTCommunities.refreshDetailItems();
            }
            return;
        }

        for (i = 0; i < posts.length; i += 1) {
            post = posts[i] || {};
            html += '<article class="wut-beta-post wut-live-community-post" data-wut-community-post="' + i + '">';
            html += '<span class="wut-beta-post-mii"><img src="' + escapeHTML(postMiiURL(post)) + '" onerror="this.onerror=null;this.src=\'res/olv/mii/img_unknown_MiiIcon.png\';" alt=""></span>';
            html += '<span class="wut-beta-post-name">' + escapeHTML(post.author_name || "Cafe User") + '</span>';
            html += '<span class="wut-beta-post-time">' + escapeHTML(relativeTime(post.created_at)) + '</span>';
            html += '<a href="#post-' + escapeHTML(post.id || i) + '" class="wut-beta-post-bubble" data-wut-community-post-link="1">';
            html += '<span class="wut-beta-post-game"><img src="' + escapeHTML(safeIcon(post.community_icon || icon)) + '" onerror="this.onerror=null;this.src=\'res/olv/default-image.png\';" alt=""></span>';
            if (String(post.kind || "text") === "drawing" && post.drawing_path) {
                html += '<span class="wut-beta-post-drawing"><img src="' + escapeHTML(safeIcon(post.drawing_path)) + '" alt="Community drawing"></span>';
            }
            else {
                html += '<span class="wut-beta-post-text">' + escapeHTML(post.text || "") + '</span>';
            }
            html += '<span class="wut-beta-post-meta"><b>Yeah!</b><i>' + parseInt(post.yeahs || 0, 10) + '</i><b>Comments</b><i>' + parseInt(post.comments || 0, 10) + '</i></span>';
            html += '</a></article>';
        }

        list.innerHTML = html;

        if (window.WUTCommunities && typeof window.WUTCommunities.refreshDetailItems === "function") {
            window.WUTCommunities.refreshDetailItems();
        }
    }

    function loadCommunity(info) {
        var identity = sessionData();
        info = normalizeCommunity(info);
        request("GET", listEndpoint, {
            limit: 30,
            viewer_id: identity.id,
            community_id: info.id,
            community: info.title,
            t: new Date().getTime()
        }, function (ok, payload) {
            if (!ok) {
                renderCommunity([], info);
                return;
            }
            renderCommunity(payload.posts || [], info);
        });
    }

    function showLoadError() {
        var list = document.getElementById("wut-feed-list");
        if (list) {
            list.innerHTML = '<li class="wut-feed-empty wut-feed-error"><strong>Feed unavailable.</strong><span>WUT could not reach the local post service.</span></li>';
        }
    }

    function load() {
        var identity = sessionData();
        if (loading) {
            return;
        }
        loading = true;
        request("GET", listEndpoint, {
            limit: 30,
            viewer_id: identity.id,
            t: new Date().getTime()
        }, function (ok, payload) {
            loading = false;
            if (!ok) {
                showLoadError();
                return;
            }
            render(payload.posts || []);
        });
    }

    function normalizeCommunity(info) {
        var title;
        info = info || {};
        title = String(info.title || info.community || "WUT Plaza");
        return {
            id: String(info.id || info.communityId || communityId(title)),
            title: title,
            icon: safeIcon(info.icon || info.communityIcon || "res/olv/default-image.png")
        };
    }

    function setComposerCommunity(info) {
        var label = document.getElementById("wut-post-composer-community");
        composerCommunity = normalizeCommunity(info);
        if (label) {
            label.innerHTML = escapeHTML(composerCommunity.title);
        }
    }

    function openComposer(info) {
        var modal = document.getElementById("wut-post-composer");
        var input = document.getElementById("wut-post-composer-text");
        if (!info || !(info.title || info.community)) {
            return false;
        }
        if (!modal) {
            return false;
        }
        setComposerCommunity(info);
        modal.className = modal.className.replace(/\s*none/g, "");
        modal.setAttribute("aria-hidden", "false");
        composerOpen = true;
        if (input) {
            input.value = "";
            try { input.focus(); } catch (ignore) {}
        }
        return true;
    }

    function closeComposer() {
        var modal = document.getElementById("wut-post-composer");
        if (!modal || !composerOpen) {
            return false;
        }
        if ((" " + modal.className + " ").indexOf(" none ") < 0) {
            modal.className += " none";
        }
        modal.setAttribute("aria-hidden", "true");
        composerOpen = false;
        return true;
    }

    function submitComposer() {
        var input = document.getElementById("wut-post-composer-text");
        var status = document.getElementById("wut-post-composer-status");
        var submit = document.getElementById("wut-post-composer-submit");
        var identity = sessionData();
        var text = input ? String(input.value || "").replace(/^\s+|\s+$/g, "") : "";
        var community = composerCommunity || normalizeCommunity(null);

        if (!text) {
            if (status) { status.innerHTML = "Write something first."; }
            return false;
        }
        if (text.length > 280) {
            text = text.substr(0, 280);
        }

        if (status) { status.innerHTML = "Posting..."; }
        if (submit) { submit.setAttribute("data-wut-busy", "1"); }

        request("POST", createEndpoint, {
            text: text,
            kind: "text",
            source: "community",
            community_id: community.id,
            community: community.title,
            community_icon: community.icon,
            author_name: identity.name,
            author_id: identity.id
        }, function (ok, payload) {
            if (submit) { submit.setAttribute("data-wut-busy", "0"); }
            if (!ok) {
                if (status) { status.innerHTML = "Post failed. Check the local WUT service."; }
                return;
            }
            if (status) { status.innerHTML = "Posted!"; }
            closeComposer();
            load();
            loadCommunity(community);

            if (window.WUTPortalNav && typeof window.WUTPortalNav.showView === "function") {
                /* Optional future hook. Current Portal keeps the user where they posted. */
            }
        });
        return true;
    }

    function bindButton(id, handler) {
        var button = document.getElementById(id);
        if (!button || button._wutPostsBound) {
            return;
        }
        button._wutPostsBound = true;
        button.addEventListener("click", function (event) {
            if (event && event.preventDefault) { event.preventDefault(); }
            handler();
            return false;
        }, false);
    }

    function start() {
        if (started) {
            return;
        }
        started = true;

        bindButton("wut-post-composer-cancel", closeComposer);
        bindButton("wut-post-composer-submit", submitComposer);

        load();
    }

    window.WUTPosts = {
        start: start,
        load: load,
        loadCommunity: loadCommunity,
        render: render,
        renderCommunity: renderCommunity,
        openComposer: openComposer,
        closeComposer: closeComposer,
        submit: submitComposer,
        isComposerOpen: function () { return composerOpen; }
    };

    if (window.addEventListener) {
        window.addEventListener("wut:session-ready", load, false);
        window.addEventListener("wut:identity-ready", load, false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    }
    else {
        start();
    }
}());
