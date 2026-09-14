/*
 * WUT-Miiverse — Communities prototype controller.
 * ES5 and DOM APIs compatible with the Cafe/old-WebKit client layer.
 */

(function () {
    "use strict";

    var started = false;
    var active = false;
    var selected = 0;
    var currentFilter = "all";

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

    function allItems() {
        var grid = document.getElementById("wut-community-grid");

        return grid ? grid.getElementsByTagName("li") : [];
    }

    function linkFor(item) {
        var links = item ? item.getElementsByTagName("a") : [];

        return links.length ? links[0] : null;
    }

    function useImageFallback() {
        var fallback = this.getAttribute("data-wut-fallback") ||
            "res/olv/default-image.png";
        var source = this.getAttribute("src") || "";

        if (source === fallback) {
            this.onerror = null;
            return;
        }

        this.onerror = null;
        this.src = fallback;

        if (this.setAttribute) {
            this.setAttribute("src", fallback);
        }
    }

    function loadImages() {
        var grid = document.getElementById("wut-community-grid");
        var images = grid ? grid.getElementsByTagName("img") : [];
        var image;
        var source;
        var i;

        for (i = 0; i < images.length; i += 1) {
            image = images[i];
            source = image.getAttribute("src");
            image.onerror = useImageFallback;

            if (!source) {
                useImageFallback.call(image);
            }
            else if (
                image.complete &&
                typeof image.naturalWidth === "number" &&
                image.naturalWidth === 0
            ) {
                useImageFallback.call(image);
            }
        }
    }

    function visibleItems() {
        var all = allItems();
        var visible = [];
        var i;

        for (i = 0; i < all.length; i += 1) {
            if (!hasClass(all[i], "wut-community-hidden")) {
                visible.push(all[i]);
            }
        }

        return visible;
    }

    function normalizeColumns() {
        var all = allItems();
        var visible = visibleItems();
        var i;

        for (i = 0; i < all.length; i += 1) {
            removeClass(all[i], "wut-column-right");
        }

        for (i = 0; i < visible.length; i += 1) {
            if (i % 2 === 1) {
                addClass(visible[i], "wut-column-right");
            }
        }
    }

    function ensureVisible(item) {
        var scroller = document.getElementById("wut-community-scroll");
        var top;
        var bottom;

        if (!scroller || !item) {
            return;
        }

        top = item.offsetTop || 0;
        bottom = top + (item.offsetHeight || 126);

        if (top < scroller.scrollTop) {
            scroller.scrollTop = top;
        }
        else if (bottom > scroller.scrollTop + scroller.clientHeight) {
            scroller.scrollTop = bottom - scroller.clientHeight;
        }
    }

    function focus(index) {
        var visible = visibleItems();
        var link;
        var i;

        if (!visible.length) {
            selected = -1;
            return;
        }

        if (index < 0) {
            index = 0;
        }

        if (index >= visible.length) {
            index = visible.length - 1;
        }

        selected = index;
        active = true;

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.blurMenu === "function"
        ) {
            window.WUTPortalNav.blurMenu();
        }

        for (i = 0; i < visible.length; i += 1) {
            removeClass(visible[i], "wut-community-focused");

            if (i === selected) {
                addClass(visible[i], "wut-community-focused");
                link = linkFor(visible[i]);

                try {
                    if (link) {
                        link.focus();
                    }
                }
                catch (ignore) {}

                ensureVisible(visible[i]);
            }
        }
    }

    function leave() {
        var visible = visibleItems();
        var i;

        active = false;

        for (i = 0; i < visible.length; i += 1) {
            removeClass(visible[i], "wut-community-focused");
        }

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.focusMenu === "function"
        ) {
            window.WUTPortalNav.focusMenu(2);
        }
    }

    function moveHorizontal(direction) {
        if (!active) {
            return false;
        }

        if (direction < 0) {
            leave();
            return true;
        }

        /* The compact directory is a single vertical list. */
        return true;
    }

    function moveVertical(direction) {
        var visible = visibleItems();
        var next = selected + direction;

        if (!active) {
            return false;
        }

        if (next < 0) {
            next = 0;
        }

        if (next >= visible.length) {
            next = selected;
        }

        focus(next);
        return true;
    }

    function openSelected() {
        var visible = visibleItems();
        var item = visible[selected];
        var link = linkFor(item);
        var status = document.getElementById("wut-community-status");
        var all = allItems();
        var title;
        var i;

        if (!item || !link) {
            return false;
        }

        for (i = 0; i < all.length; i += 1) {
            removeClass(all[i], "wut-community-opened");
        }

        addClass(item, "wut-community-opened");
        title = link.getAttribute("data-community-title") || "Community";

        if (status) {
            status.innerHTML = title + " selected — community page connects here next.";
        }
        return true;
    }

    function setFilter(filter) {
        var tabs = document.getElementById("wut-community-tabs");
        var tabItems = tabs ? tabs.getElementsByTagName("li") : [];
        var all = allItems();
        var count = document.getElementById("wut-community-count");
        var button;
        var show;
        var i;

        if (
            filter !== "featured" &&
            filter !== "favorites" &&
            filter !== "all"
        ) {
            filter = "all";
        }

        currentFilter = filter;

        for (i = 0; i < tabItems.length; i += 1) {
            button = tabItems[i].getElementsByTagName("button")[0];
            removeClass(tabItems[i], "selected");

            if (
                button &&
                button.getAttribute("data-wut-community-filter") === filter
            ) {
                addClass(tabItems[i], "selected");
            }
        }

        for (i = 0; i < all.length; i += 1) {
            show = filter === "all";

            if (filter === "featured") {
                show = all[i].getAttribute("data-featured") === "1";
            }
            else if (filter === "favorites") {
                show = all[i].getAttribute("data-favorite") === "1";
            }

            if (show) {
                removeClass(all[i], "wut-community-hidden");
            }
            else {
                addClass(all[i], "wut-community-hidden");
            }
        }

        normalizeColumns();

        if (count) {
            count.innerHTML = String(visibleItems().length);
        }
        if (active) {
            focus(0);
        }
    }

    function bindCard(item) {
        var link = linkFor(item);

        if (!link || link._wutCommunityBound) {
            return;
        }

        link._wutCommunityBound = true;

        link.addEventListener(
            "focus",
            function () {
                var visible = visibleItems();
                var i;

                for (i = 0; i < visible.length; i += 1) {
                    if (visible[i] === item) {
                        focus(i);
                        return;
                    }
                }
            },
            false
        );

        link.addEventListener(
            "touchstart",
            function () {
                link.focus();
            },
            false
        );

        link.addEventListener(
            "click",
            function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }

                link.focus();
                openSelected();
                return false;
            },
            false
        );
    }

    function bindFilter(button) {
        if (!button || button._wutCommunityFilterBound) {
            return;
        }

        button._wutCommunityFilterBound = true;
        button.addEventListener(
            "click",
            function (event) {
                if (event && event.preventDefault) {
                    event.preventDefault();
                }

                setFilter(button.getAttribute("data-wut-community-filter"));
                return false;
            },
            false
        );
    }

    function start() {
        var all;
        var tabs;
        var buttons;
        var i;

        if (started) {
            return;
        }

        started = true;
        all = allItems();
        tabs = document.getElementById("wut-community-tabs");
        buttons = tabs ? tabs.getElementsByTagName("button") : [];

        for (i = 0; i < all.length; i += 1) {
            bindCard(all[i]);
        }

        for (i = 0; i < buttons.length; i += 1) {
            bindFilter(buttons[i]);
        }

        loadImages();
        setFilter("all");
    }

    window.WUTCommunities = {
        start: start,
        enter: function () {
            focus(0);
        },
        leave: leave,
        isActive: function () {
            return active;
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
        setFilter: setFilter,
        getState: function () {
            return {
                active: active,
                selected: selected,
                filter: currentFilter,
                visible: visibleItems().length
            };
        }
    };
}());
