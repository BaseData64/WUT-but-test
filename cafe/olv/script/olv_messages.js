/* WUT-Miiverse — live private Messages controller. ES5 / Wii U WebKit safe. */
(function () {
    "use strict";

    var API_BASE = "../../net/olv/v1/messages/";
    var threads = {};
    var openKey = null;
    var replyOpen = false;
    var newOpen = false;
    var pollTimer = null;
    var pollingStarted = false;
    var lastInboundId = null;
    var inboxSignature = "";
    var signalTimer = null;

    function byId(id) { return document.getElementById(id); }
    function addClass(el, name) { if (el && (" " + el.className + " ").indexOf(" " + name + " ") < 0) { el.className += " " + name; } }
    function removeClass(el, name) { if (el) { el.className = el.className.replace(new RegExp("\\s*" + name, "g"), ""); } }
    function escapeHTML(v) { return String(v === null || v === undefined ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }
    function encodeForm(data) {
        var out = [], key;
        for (key in data) {
            if (data.hasOwnProperty(key) && data[key] !== null && data[key] !== undefined) {
                out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(data[key])));
            }
        }
        return out.join("&");
    }
    function parseJSON(text) { try { return JSON.parse(text); } catch (ignore) { return null; } }

    function xhrJSON(method, url, data, callback) {
        var xhr;
        try {
            xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            xhr.setRequestHeader("Accept", "application/json");
            if (method === "POST") {
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
            }
            xhr.onreadystatechange = function () {
                var payload;
                if (xhr.readyState !== 4) { return; }
                payload = parseJSON(xhr.responseText || "");
                callback(xhr.status >= 200 && xhr.status < 300 && payload && payload.ok, payload || {}, xhr.status);
            };
            xhr.send(method === "POST" ? encodeForm(data || {}) : null);
        } catch (ignore) {
            callback(false, { error: "request_failed" }, 0);
        }
    }

    function currentMii() {
        var menu = byId("wut-global-menu-mii");
        return menu && menu.src ? menu.src : "res/olv/mii/img_unknown_MiiIcon.png";
    }

    function unknownMii() { return "res/olv/mii/img_unknown_MiiIcon.png"; }

    function formatTime(timestamp) {
        var now = Math.floor((new Date()).getTime() / 1000);
        var diff = Math.max(0, now - parseInt(timestamp || 0, 10));
        var date;
        if (diff < 60) { return "Just now"; }
        if (diff < 3600) { return Math.floor(diff / 60) + " min. ago"; }
        if (diff < 86400) { return Math.floor(diff / 3600) + " hr. ago"; }
        if (diff < 172800) { return "Yesterday"; }
        try {
            date = new Date(parseInt(timestamp, 10) * 1000);
            return (date.getMonth() + 1) + "/" + date.getDate();
        } catch (ignore) { return "Earlier"; }
    }

    function setStatus(text) {
        var el = byId("wut-message-status");
        if (el) { el.innerHTML = escapeHTML(text); }
    }

    function triggerNewMessageSignal() {
        var icon = null;
        var menu = byId("global-menu-message");
        var view = byId("wut-messages-view");
        if (view) {
            try { icon = view.querySelector(".wut-beta-topbar-message .wut-beta-topbar-icon"); } catch (ignore) {}
        }

        if (signalTimer) {
            window.clearTimeout(signalTimer);
            signalTimer = null;
        }

        removeClass(icon, "wut-message-new-signal");
        removeClass(menu, "wut-message-new-signal");
        try { if (icon) { icon.offsetWidth; } if (menu) { menu.offsetWidth; } } catch (ignore2) {}
        addClass(icon, "wut-message-new-signal");
        addClass(menu, "wut-message-new-signal");

        signalTimer = window.setTimeout(function () {
            removeClass(icon, "wut-message-new-signal");
            removeClass(menu, "wut-message-new-signal");
            signalTimer = null;
        }, 3400);
    }

    function conversationSignature(items) {
        var parts = [], i, item;
        for (i = 0; i < items.length; i += 1) {
            item = items[i];
            parts.push([item.conversation_id, item.last_message_id, item.unread, item.last_at].join(":"));
        }
        return parts.join("|");
    }

    function renderInbox(items) {
        var tray = byId("wut-message-tray");
        var empty = byId("wut-message-empty");
        var count = byId("wut-message-conversation-count");
        var html = "";
        var i, item, cls;

        if (!tray) { return; }
        threads = {};

        for (i = 0; i < items.length; i += 1) {
            item = items[i];
            threads[item.conversation_id] = item;
            cls = "wut-message-card" + (parseInt(item.unread || 0, 10) > 0 ? " wut-message-card-unread" : "");
            html += '<a href="#message-' + escapeHTML(item.conversation_id) + '" class="' + cls + '" data-wut-focus-item="1" data-wut-demo-action="message-thread" data-wut-thread="' + escapeHTML(item.conversation_id) + '" data-wut-label="' + escapeHTML(item.peer_name) + '">';
            html += '<span class="wut-message-card-mii"><img src="' + unknownMii() + '" alt=""></span>';
            html += '<span class="wut-message-card-copy">';
            html += '<strong>' + escapeHTML(item.peer_name || item.peer_id) + '</strong>';
            html += '<small>' + escapeHTML(item.peer_id) + '</small>';
            html += '<em>' + escapeHTML(formatTime(item.last_at)) + '</em>';
            html += '<span>' + escapeHTML(item.last_text) + '</span>';
            html += '</span>';
            if (parseInt(item.unread || 0, 10) > 0) {
                html += '<i class="wut-message-unread-dot">' + escapeHTML(item.unread) + '</i>';
            }
            html += '<b class="wut-message-card-arrow">›</b></a>';
        }

        tray.innerHTML = html;
        if (count) { count.innerHTML = String(items.length); }
        if (empty) {
            if (items.length) { addClass(empty, "none"); }
            else { removeClass(empty, "none"); }
        }
        if (window.WUTPortalSections && typeof window.WUTPortalSections.refreshBindings === "function") {
            window.WUTPortalSections.refreshBindings();
        }
    }

    function loadInbox(silent) {
        xhrJSON("GET", API_BASE + "list.php?_=" + String((new Date()).getTime()), null, function (ok, data, status) {
            var items, sig, incomingChanged;
            if (!ok) {
                if (status === 401) {
                    renderInbox([]);
                    if (!silent) { setStatus("WUT identity is required to receive private messages."); }
                } else if (!silent) {
                    setStatus("Messages service unavailable.");
                }
                return;
            }

            items = data.conversations || [];
            if (data.self && data.self.id) {
                if (byId("wut-message-new-note") && !newOpen) {
                    byId("wut-message-new-note").innerHTML = "Your WUT ID: " + escapeHTML(data.self.id);
                }
            }
            sig = conversationSignature(items);
            if (sig !== inboxSignature) {
                renderInbox(items);
                inboxSignature = sig;
            }

            incomingChanged = !!data.newest_inbound_id && data.newest_inbound_id !== lastInboundId;
            if (lastInboundId === null) {
                if (parseInt(data.unread_total || 0, 10) > 0) { triggerNewMessageSignal(); }
            } else if (incomingChanged) {
                triggerNewMessageSignal();
                if (openKey && threads[openKey] && threads[openKey].peer_id) {
                    loadThread(threads[openKey].peer_id, true);
                }
            }
            lastInboundId = data.newest_inbound_id || "";

            if (!silent && !items.length) { setStatus("No messages yet."); }
            else if (!silent) { setStatus("Choose a conversation."); }
        });
    }

    function setFocusState(threadMode) {
        var inbox = byId("wut-message-inbox");
        var links = inbox ? inbox.getElementsByTagName("a") : [];
        var i;
        for (i = 0; i < links.length; i += 1) { links[i].setAttribute("data-wut-focus-disabled", threadMode ? "1" : "0"); }
        if (byId("wut-message-thread-back")) { byId("wut-message-thread-back").setAttribute("data-wut-focus-disabled", threadMode ? "0" : "1"); }
        if (byId("wut-message-reply-button")) { byId("wut-message-reply-button").setAttribute("data-wut-focus-disabled", threadMode ? "0" : "1"); }
        if (byId("wut-message-reply-cancel")) { byId("wut-message-reply-cancel").setAttribute("data-wut-focus-disabled", replyOpen ? "0" : "1"); }
        if (byId("wut-message-reply-send")) { byId("wut-message-reply-send").setAttribute("data-wut-focus-disabled", replyOpen ? "0" : "1"); }
        if (byId("wut-message-new-button")) { byId("wut-message-new-button").setAttribute("data-wut-focus-disabled", (threadMode || newOpen) ? "1" : "0"); }
        if (byId("wut-message-new-cancel")) { byId("wut-message-new-cancel").setAttribute("data-wut-focus-disabled", newOpen ? "0" : "1"); }
        if (byId("wut-message-new-send")) { byId("wut-message-new-send").setAttribute("data-wut-focus-disabled", newOpen ? "0" : "1"); }
    }

    function renderThread(messages) {
        var body = byId("wut-message-thread-body");
        var html = "", i, msg, mii;
        if (!body) { return; }
        for (i = 0; i < messages.length; i += 1) {
            msg = messages[i];
            mii = msg.side === "out" ? currentMii() : unknownMii();
            html += '<div class="wut-message-bubble wut-message-bubble-' + (msg.side === "out" ? "out" : "in") + '">';
            html += '<span class="wut-message-bubble-mii"><img src="' + escapeHTML(mii) + '" alt=""></span>';
            html += '<span class="wut-message-bubble-text">' + escapeHTML(msg.text) + '<small>' + escapeHTML(formatTime(msg.created_at)) + '</small></span>';
            html += '</div>';
        }
        if (!messages.length) {
            html = '<div class="wut-message-thread-empty">No messages in this conversation.</div>';
        }
        body.innerHTML = html;
    }

    function markRead(peerId) {
        xhrJSON("POST", API_BASE + "read.php", { peer_id: peerId }, function () {
            loadInbox(true);
        });
    }

    function loadThread(peerId, markAsRead) {
        xhrJSON("GET", API_BASE + "thread.php?peer_id=" + encodeURIComponent(peerId) + "&_=" + String((new Date()).getTime()), null, function (ok, data) {
            if (!ok) {
                renderThread([]);
                setStatus("Could not load this conversation.");
                return;
            }
            renderThread(data.messages || []);
            if (markAsRead !== false) { markRead(peerId); }
        });
    }

    function openThread(key) {
        var data = threads[key];
        var inbox = byId("wut-message-inbox");
        var thread = byId("wut-message-thread");
        if (!data || !inbox || !thread) { return false; }
        openKey = key;
        replyOpen = false;
        addClass(inbox, "none");
        removeClass(thread, "none");
        thread.setAttribute("aria-hidden", "false");
        byId("wut-message-thread-name").innerHTML = escapeHTML(data.peer_name || data.peer_id);
        byId("wut-message-thread-id").innerHTML = escapeHTML(data.peer_id);
        byId("wut-message-thread-mii").src = unknownMii();
        if (byId("wut-message-topbar-subtitle")) { byId("wut-message-topbar-subtitle").innerHTML = escapeHTML(data.peer_name || data.peer_id); }
        renderThread([]);
        hideReply();
        setFocusState(true);
        loadThread(data.peer_id, true);
        return true;
    }

    function backToInbox() {
        var inbox = byId("wut-message-inbox");
        var thread = byId("wut-message-thread");
        if (!inbox || !thread) { return false; }
        openKey = null;
        replyOpen = false;
        removeClass(inbox, "none");
        addClass(thread, "none");
        thread.setAttribute("aria-hidden", "true");
        if (byId("wut-message-topbar-subtitle")) { byId("wut-message-topbar-subtitle").innerHTML = "Conversations"; }
        hideReply();
        setFocusState(false);
        loadInbox(true);
        return true;
    }

    function showReply() {
        var box = byId("wut-message-reply-demo");
        var text = byId("wut-message-reply-text");
        if (!openKey || !box) { return false; }
        replyOpen = true;
        removeClass(box, "none");
        box.setAttribute("aria-hidden", "false");
        if (byId("wut-message-reply-button")) { byId("wut-message-reply-button").setAttribute("data-wut-focus-disabled", "1"); }
        if (byId("wut-message-reply-note")) { byId("wut-message-reply-note").innerHTML = "Send a private WUT message."; }
        setFocusState(true);
        try { if (text) { text.focus(); } } catch (ignore) {}
        return true;
    }

    function hideReply() {
        var box = byId("wut-message-reply-demo");
        replyOpen = false;
        if (box) { addClass(box, "none"); box.setAttribute("aria-hidden", "true"); }
        if (byId("wut-message-reply-button") && openKey) { byId("wut-message-reply-button").setAttribute("data-wut-focus-disabled", "0"); }
        setFocusState(!!openKey);
        return true;
    }

    function demoSend() {
        var data = openKey ? threads[openKey] : null;
        var textEl = byId("wut-message-reply-text");
        var note = byId("wut-message-reply-note");
        var text = textEl ? String(textEl.value || "").replace(/^\s+|\s+$/g, "") : "";
        if (!data || !text) {
            if (note) { note.innerHTML = "Write a message first."; }
            return false;
        }
        if (note) { note.innerHTML = "Sending..."; }
        xhrJSON("POST", API_BASE + "send.php", {
            recipient_id: data.peer_id,
            recipient_name: data.peer_name || data.peer_id,
            text: text
        }, function (ok, payload) {
            if (!ok) {
                if (note) { note.innerHTML = payload && payload.error === "identity_required" ? "WUT identity is required." : "Message could not be sent."; }
                return;
            }
            if (textEl) { textEl.value = ""; }
            hideReply();
            loadThread(data.peer_id, false);
            loadInbox(true);
            setStatus("Message sent.");
        });
        return true;
    }

    function showNewMessage() {
        var box = byId("wut-message-new");
        var id = byId("wut-message-new-id");
        if (!box || openKey) { return false; }
        newOpen = true;
        removeClass(box, "none");
        box.setAttribute("aria-hidden", "false");
        if (byId("wut-message-new-button")) { byId("wut-message-new-button").setAttribute("data-wut-focus-disabled", "1"); }
        if (byId("wut-message-new-note")) { byId("wut-message-new-note").innerHTML = "Enter another user's 9-digit WUT ID."; }
        setFocusState(false);
        try { if (id) { id.focus(); } } catch (ignore) {}
        return true;
    }

    function hideNewMessage() {
        var box = byId("wut-message-new");
        newOpen = false;
        if (box) { addClass(box, "none"); box.setAttribute("aria-hidden", "true"); }
        setFocusState(false);
        return true;
    }

    function sendNewMessage() {
        var idEl = byId("wut-message-new-id");
        var textEl = byId("wut-message-new-text");
        var note = byId("wut-message-new-note");
        var recipient = idEl ? String(idEl.value || "").replace(/\D/g, "") : "";
        var text = textEl ? String(textEl.value || "").replace(/^\s+|\s+$/g, "") : "";

        if (!/^\d{9}$/.test(recipient)) {
            if (note) { note.innerHTML = "Enter a valid 9-digit WUT ID."; }
            return false;
        }
        if (!text) {
            if (note) { note.innerHTML = "Write a message first."; }
            return false;
        }

        if (note) { note.innerHTML = "Sending..."; }
        xhrJSON("POST", API_BASE + "send.php", { recipient_id: recipient, text: text }, function (ok, payload) {
            if (!ok) {
                if (note) {
                    if (payload && payload.error === "recipient_not_found") { note.innerHTML = "That WUT ID does not exist."; }
                    else if (payload && payload.error === "cannot_message_self") { note.innerHTML = "You cannot message your own WUT ID."; }
                    else if (payload && payload.error === "identity_required") { note.innerHTML = "Complete WUT setup first."; }
                    else { note.innerHTML = "Message could not be sent."; }
                }
                return;
            }
            if (idEl) { idEl.value = ""; }
            if (textEl) { textEl.value = ""; }
            hideNewMessage();
            loadInbox(false);
            setStatus("Message sent to WUT ID " + recipient + ".");
        });
        return true;
    }

    function isThreadOpen() { return !!openKey; }

    function reset() {
        hideNewMessage();
        backToInbox();
        loadInbox(false);
    }

    function startPolling() {
        if (pollingStarted) { return; }
        pollingStarted = true;
        loadInbox(true);
        pollTimer = window.setInterval(function () { loadInbox(true); }, 6000);
    }

    function start() {
        startPolling();
    }

    window.WUTMessages = {
        openThread: openThread,
        backToInbox: backToInbox,
        showReply: showReply,
        hideReply: hideReply,
        demoSend: demoSend,
        showNewMessage: showNewMessage,
        hideNewMessage: hideNewMessage,
        sendNewMessage: sendNewMessage,
        isThreadOpen: isThreadOpen,
        reset: reset,
        loadInbox: loadInbox,
        triggerNewMessageSignal: triggerNewMessageSignal
    };

    if (window.addEventListener) {
        window.addEventListener("wut:session-ready", startPolling, false);
        window.addEventListener("wut:identity-ready", startPolling, false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, false);
    } else {
        start();
    }
}());
