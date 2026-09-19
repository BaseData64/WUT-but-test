/*
 * WUT-Miiverse — Plaza / Community beta controller.
 * ES5 / old-WebKit-safe.
 *
 * Directory cards stay in native document flow. Activating a community swaps
 * to a WUT-original "General Plaza" post view inspired by early Wii U social
 * UI concepts. No inner scroller, no translated list/grid.
 */
(function () {
    "use strict";

    var started = false;
    var active = false;
    var selected = -1;
    var items = [];
    var detailActive = false;
    var detailSelected = 0;
    var detailItems = [];

    var postCopy = [
        [
            "This Plaza feels really different on the GamePad.",
            "I finally cleared the part that kept getting me. That was close!",
            "Anyone else trying a different route? I think there is a better way through here."
        ],
        [
            "I checked in again today. The Plaza is getting busy!",
            "I changed a few things and it already feels completely different.",
            "What is everyone working on right now?"
        ],
        [
            "That minigame was way closer than I expected.",
            "I need a rematch after that one.",
            "There has to be another trick to this board."
        ],
        [
            "I found a route I had never noticed before.",
            "That last section almost got me again.",
            "Has anyone tried a different setup for this part?"
        ],
        [
            "This stage looks amazing on the GamePad.",
            "I finally found the thing I was looking for.",
            "The little details in this area are really nice."
        ],
        [
            "Finished today's session!",
            "That was more tiring than I expected.",
            "Trying to beat my previous result next time."
        ],
        [
            "I keep finding little secrets I missed the first time.",
            "That jump was much harder than it looked.",
            "Anyone else going for everything in this game?"
        ],
        [
            "S.O.S. I think I took the wrong route again.",
            "That encounter was way too close.",
            "I might try a completely different strategy next time."
        ],
        [
            "I wandered off the path and found something interesting.",
            "This area is much bigger than I expected.",
            "I am definitely coming back here later."
        ],
        [
            "WUT-Miiverse visual test online.",
            "The Community Plaza layout is now being tested on real hardware.",
            "Next stop: more beta-style social UI."
        ]
    ];

    function hasClass(element, name) {
        return !!(
            element &&
            (" " + element.className + " ").indexOf(" " + name + " ") >= 0
        );
    }

    function addClass(element, name) {
        if (element && !hasClass(element, name)) {
            element.className += " " + name;
        }
    }

    function removeClass(element, name) {
        if (!element) {
            return;
        }
        element.className = element.className.replace(
            new RegExp("\\s*" + name, "g"),
            ""
        );
    }

    function linkFor(item) {
        var links = item ? item.getElementsByTagName("a") : [];
        return links.length ? links[0] : null;
    }

    function revealElement(element) {
        var rect;
        var viewport;
        var delta = 0;

        if (!element || !element.getBoundingClientRect) {
            return;
        }

        rect = element.getBoundingClientRect();
        viewport = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 720;

        if (rect.top < 18) {
            delta = rect.top - 18;
        }
        else if (rect.bottom > viewport - 18) {
            delta = rect.bottom - (viewport - 18);
        }

        if (delta && window.scrollBy) {
            window.scrollBy(0, delta);
        }
    }

    function reveal(index) {
        revealElement(items[index]);
    }

    function select(index, bringIntoView) {
        var previous;

        if (!items.length) {
            selected = -1;
            return false;
        }

        if (index < 0) {
            index = 0;
        }
        if (index >= items.length) {
            index = items.length - 1;
        }

        previous = selected;
        selected = index;
        active = true;

        if (window.WUTPortalNav && typeof window.WUTPortalNav.blurMenu === "function") {
            window.WUTPortalNav.blurMenu();
        }

        if (previous >= 0 && previous < items.length && previous !== selected) {
            removeClass(items[previous], "wut-community-focused");
        }

        addClass(items[selected], "wut-community-focused");

        if (bringIntoView !== false) {
            reveal(selected);
        }

        return true;
    }

    function currentCard() {
        return selected >= 0 && selected < items.length ? linkFor(items[selected]) : null;
    }

    function communityIcon(card) {
        var images = card ? card.getElementsByTagName("img") : [];
        return images.length ? images[0].src : "res/olv/commu/thumb/default.png";
    }

    function communityIconPath(card) {
        var images = card ? card.getElementsByTagName("img") : [];
        var value = images.length ? images[0].getAttribute("src") : null;
        return value || "res/olv/default-image.png";
    }

    function currentCommunityInfo() {
        var card = currentCard();
        var href = card ? String(card.getAttribute("href") || "") : "";
        var id = href.indexOf("#community-") === 0 ? href.substr(11) : "";
        var title = cleanTitle(card ? card.getAttribute("data-community-title") : "WUT Plaza");
        if (!id) {
            id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "wut-plaza";
        }
        return {
            id: id,
            title: title,
            icon: communityIconPath(card)
        };
    }

    function cleanTitle(title) {
        title = String(title || "Community");
        title = title.replace(/\s+Community$/i, "");
        return title || "Community";
    }

    function setText(id, value) {
        var element = document.getElementById(id);
        if (element) {
            element.innerHTML = String(value || "");
        }
    }

    function setImage(id, src) {
        var image = document.getElementById(id);
        if (image) {
            image.src = src;
        }
    }

    function bindCurrentMii() {
        var image = document.getElementById("wut-community-current-mii");
        var state;
        var name = "Cafe User";

        if (window.WUTSession && typeof window.WUTSession.getState === "function") {
            state = window.WUTSession.getState();
            name = state.miiName || state.pnid || state.userId || name;
        }

        setText("wut-community-current-name", name);

        if (image && window.WUTMii && typeof window.WUTMii.bindImage === "function") {
            window.WUTMii.bindImage(
                image,
                "res/olv/mii/img_unknown_MiiIcon.png",
                96,
                "face"
            );
        }
    }

    function updateDetail() {
        var card = currentCard();
        var icon;
        var title;
        var copy;
        var i;

        if (!card) {
            return;
        }

        icon = communityIcon(card);
        title = cleanTitle(card.getAttribute("data-community-title"));
        copy = postCopy[selected] || postCopy[0];

        setText("wut-community-detail-title", title);
        setImage("wut-community-detail-icon", icon);

        if (window.WUTPosts && typeof window.WUTPosts.loadCommunity === "function") {
            window.WUTPosts.loadCommunity(currentCommunityInfo());
        }

        bindCurrentMii();
    }

    function collectDetailItems() {
        var root = document.getElementById("wut-community-detail");
        var links = root ? root.getElementsByTagName("a") : [];
        var i;
        detailItems = [];

        for (i = 0; i < links.length; i += 1) {
            if (links[i].getAttribute("data-wut-community-post-link") === "1") {
                detailItems.push(links[i]);
            }
        }
    }

    function clearDetailFocus() {
        var i;
        for (i = 0; i < detailItems.length; i += 1) {
            removeClass(detailItems[i], "wut-community-detail-focused");
        }
    }

    function selectDetail(index, bringIntoView) {
        if (!detailItems.length) {
            collectDetailItems();
        }
        if (!detailItems.length) {
            return false;
        }

        if (index < 0) {
            index = 0;
        }
        if (index >= detailItems.length) {
            index = detailItems.length - 1;
        }

        detailSelected = index;
        active = true;
        clearDetailFocus();
        addClass(detailItems[detailSelected], "wut-community-detail-focused");

        if (window.WUTPortalNav && typeof window.WUTPortalNav.blurMenu === "function") {
            window.WUTPortalNav.blurMenu();
        }

        if (bringIntoView !== false) {
            revealElement(detailItems[detailSelected]);
        }

        return true;
    }

    function openDetail() {
        var directory = document.getElementById("wut-community-directory");
        var detail = document.getElementById("wut-community-detail");
        var i;

        if (!currentCard()) {
            return false;
        }

        for (i = 0; i < items.length; i += 1) {
            removeClass(items[i], "wut-community-opened");
        }
        addClass(items[selected], "wut-community-opened");

        /* Older runtime tests / fallback shells may not include the detail DOM.
           Keep activation valid even there. */
        if (!detail) {
            return true;
        }

        updateDetail();
        collectDetailItems();
        detailActive = true;
        detailSelected = 0;
        active = true;

        if (directory) {
            addClass(directory, "none");
            directory.setAttribute("aria-hidden", "true");
        }

        removeClass(detail, "none");
        detail.setAttribute("aria-hidden", "false");

        if (window.scrollTo) {
            window.scrollTo(0, 0);
        }

        selectDetail(0, false);
        return true;
    }

    function closeDetail() {
        var directory = document.getElementById("wut-community-directory");
        var detail = document.getElementById("wut-community-detail");

        if (!detailActive) {
            return false;
        }

        detailActive = false;
        clearDetailFocus();

        if (detail) {
            addClass(detail, "none");
            detail.setAttribute("aria-hidden", "true");
        }
        if (directory) {
            removeClass(directory, "none");
            directory.setAttribute("aria-hidden", "false");
        }

        if (window.scrollTo) {
            window.scrollTo(0, 0);
        }

        select(selected >= 0 ? selected : 0, false);
        return true;
    }

    function leave() {
        var detail = document.getElementById("wut-community-detail");
        var directory = document.getElementById("wut-community-directory");

        detailActive = false;
        clearDetailFocus();

        if (detail) {
            addClass(detail, "none");
            detail.setAttribute("aria-hidden", "true");
        }
        if (directory) {
            removeClass(directory, "none");
            directory.setAttribute("aria-hidden", "false");
        }

        active = false;
        if (selected >= 0 && selected < items.length) {
            removeClass(items[selected], "wut-community-focused");
        }
        if (window.WUTPortalNav && typeof window.WUTPortalNav.focusMenu === "function") {
            window.WUTPortalNav.focusMenu(2);
        }
    }

    function moveHorizontal(direction) {
        if (!active) {
            return false;
        }
        if (direction < 0) {
            leave();
        }
        return true;
    }

    function moveVertical(direction) {
        if (!active) {
            return false;
        }

        if (detailActive) {
            return selectDetail(detailSelected + direction, true);
        }

        if (!items.length) {
            return false;
        }
        return select(selected + direction, true);
    }

    function openSelected() {
        var link;

        if (detailActive) {
            if (!detailItems.length) {
                collectDetailItems();
            }
            link = detailItems[detailSelected];

            if (link && link.id === "wut-community-post-button") {
                if (window.WUTPosts && typeof window.WUTPosts.openComposer === "function") {
                    window.WUTPosts.openComposer(currentCommunityInfo());
                }
                return true;
            }

            /* Existing post bubbles remain detail-preview targets for now. */
            return true;
        }
        return openDetail();
    }

    function bindCard(item, index) {
        var link = linkFor(item);
        if (!link || link._wutCommunityBound) {
            return;
        }
        link._wutCommunityBound = true;

        link.addEventListener("touchstart", function () {
            select(index, false);
        }, false);

        link.addEventListener("mousedown", function () {
            select(index, false);
        }, false);

        link.addEventListener("click", function (event) {
            if (event && event.preventDefault) {
                event.preventDefault();
            }
            select(index, false);
            openSelected();
            return false;
        }, false);
    }

    function start() {
        var plaza;
        var found;
        var i;

        if (started) {
            return;
        }
        started = true;

        plaza = document.getElementById("wut-community-directory") ||
            document.getElementById("wut-communities-view");
        found = plaza ? plaza.getElementsByTagName("div") : [];
        items = [];

        for (i = 0; i < found.length; i += 1) {
            if (hasClass(found[i], "wut-community-entry")) {
                items.push(found[i]);
                bindCard(found[i], items.length - 1);
            }
        }

        collectDetailItems();

        (function () {
            var postButton = document.getElementById("wut-community-post-button");
            if (postButton && !postButton._wutPostComposerBound) {
                postButton._wutPostComposerBound = true;
                postButton.addEventListener("click", function (event) {
                    if (event && event.preventDefault) {
                        event.preventDefault();
                    }
                    if (window.WUTPosts && typeof window.WUTPosts.openComposer === "function") {
                        window.WUTPosts.openComposer(currentCommunityInfo());
                    }
                    return false;
                }, false);
            }
        }());
    }

    window.WUTCommunities = {
        start: start,
        enter: function () {
            if (detailActive) {
                return selectDetail(detailSelected, true);
            }
            return select(selected >= 0 ? selected : 0, true);
        },
        leave: leave,
        back: function () {
            if (detailActive) {
                return closeDetail();
            }
            leave();
            return true;
        },
        isActive: function () {
            return active;
        },
        isDetailActive: function () {
            return detailActive;
        },
        left: function () {
            return moveHorizontal(-1);
        },
        right: function () {
            return moveHorizontal(1);
        },
        up: function () {
            return moveVertical(-1);
        },
        down: function () {
            return moveVertical(1);
        },
        activate: openSelected,
        refreshDetailItems: function () {
            collectDetailItems();
            if (detailActive && detailItems.length) {
                if (detailSelected >= detailItems.length) {
                    detailSelected = detailItems.length - 1;
                }
                selectDetail(detailSelected, false);
            }
        },
        getCurrentCommunity: currentCommunityInfo,
        getState: function () {
            return {
                active: active,
                selected: selected,
                visible: items.length,
                detailActive: detailActive,
                detailSelected: detailSelected
            };
        }
    };
}());
