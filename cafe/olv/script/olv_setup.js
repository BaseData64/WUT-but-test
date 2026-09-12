/*
 * WUT-Miiverse V7.0
 * Local First Run controller for Makii's adapted welcome sequence.
 *
 * First Run now persists profile setup through WUTSession. Identity and Mii
 * data are provided by separate adapters so this controller stays UI-focused.
 */

(function () {
    "use strict";

    var steps = [
        {
            id: "welcome-start",
            name: "welcome",
            focus: "right",
            left: { label: "Close", icon: "x", action: "close" },
            right: { label: "Next", icon: "R", action: "next" }
        },
        {
            id: "welcome-about",
            name: "about",
            focus: "right",
            left: { label: "Back", icon: "I", action: "back" },
            right: { label: "Next", icon: "R", action: "next" }
        },
        {
            id: "welcome-manners",
            name: "manners",
            focus: "right",
            left: { label: "Back", icon: "I", action: "back" },
            right: { label: "Accept", icon: "v", action: "accept" }
        },
        {
            id: "welcome-game-experience",
            name: "game-experience",
            focus: "wut-skill-beginner",
            left: { label: "Back", icon: "I", action: "back" },
            right: { label: "Next", icon: "R", action: "next" }
        },
        {
            id: "welcome-ready",
            name: "ready",
            focus: "right",
            left: { label: "Back", icon: "I", action: "back" },
            right: { label: "Next", icon: "R", action: "next" }
        },
        {
            id: "welcome-finish",
            name: "finish",
            focus: "right",
            left: null,
            right: { label: "Start", icon: "R", action: "start" }
        }
    ];

    var skillButtons = {
        beginner: "wut-skill-beginner",
        intermediate: "wut-skill-intermediate",
        expert: "wut-skill-expert"
    };

    var current = 0;
    var selectedSkill = null;
    var complete = false;

    function addClass(element, name) {
        if (!element) {
            return;
        }

        if ((" " + element.className + " ").indexOf(" " + name + " ") < 0) {
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

    function setControl(id, config) {
        var button = document.getElementById(id);
        var icon;
        var label;

        if (!button) {
            return;
        }

        if (!config) {
            addClass(button, "wut-control-hidden");
            button.disabled = true;
            button.setAttribute("aria-hidden", "true");
            return;
        }

        removeClass(button, "wut-control-hidden");
        button.disabled = false;
        button.setAttribute("aria-hidden", "false");
        button.setAttribute("aria-disabled", "false");
        button.setAttribute("data-wut-action", config.action);

        icon = button.getElementsByTagName("span")[0];
        label = button.getElementsByTagName("span")[1];

        if (icon) {
            /* Portal image symbols are selected by data-wut-action in olv_symbols.css. */
            icon.innerHTML = "";
        }

        if (label) {
            label.innerHTML = config.label;
        }
    }

    function showSkillControls(visible) {
        var name;
        var button;

        for (name in skillButtons) {
            if (skillButtons.hasOwnProperty(name)) {
                button = document.getElementById(skillButtons[name]);

                if (!button) {
                    continue;
                }

                if (visible) {
                    removeClass(button, "wut-control-hidden");
                    button.disabled = false;
                    button.setAttribute("aria-hidden", "false");
                }
                else {
                    addClass(button, "wut-control-hidden");
                    button.disabled = true;
                    button.setAttribute("aria-hidden", "true");
                }
            }
        }
    }

    function applySkillSelection() {
        var stage = document.getElementById("wut-cafe-stage");
        var hint = document.getElementById("wut-skill-hint");
        var nextButton = document.getElementById("wut-setup-next");
        var name;
        var button;

        for (name in skillButtons) {
            if (skillButtons.hasOwnProperty(name)) {
                button = document.getElementById(skillButtons[name]);

                if (!button) {
                    continue;
                }

                removeClass(button, "wut-selected");
                button.setAttribute("aria-pressed", "false");

                if (name === selectedSkill) {
                    addClass(button, "wut-selected");
                    button.setAttribute("aria-pressed", "true");
                }
            }
        }

        if (stage) {
            if (selectedSkill) {
                stage.setAttribute("data-wut-game-experience", selectedSkill);
            }
            else {
                stage.removeAttribute("data-wut-game-experience");
            }
        }

        if (hint) {
            removeClass(hint, "wut-skill-ready");

            if (selectedSkill) {
                hint.innerHTML = "Selected: " +
                    selectedSkill.charAt(0).toUpperCase() +
                    selectedSkill.substring(1) + ".";
                addClass(hint, "wut-skill-ready");
            }
            else {
                hint.innerHTML = "Choose one option before continuing.";
            }
        }

        if (nextButton && steps[current].name === "game-experience") {
            nextButton.disabled = !selectedSkill;
            nextButton.setAttribute(
                "aria-disabled",
                selectedSkill ? "false" : "true"
            );
        }
    }

    function selectSkill(name) {
        if (
            complete ||
            steps[current].name !== "game-experience" ||
            !skillButtons[name]
        ) {
            return;
        }

        selectedSkill = name;

        if (
            window.WUTSession &&
            typeof window.WUTSession.setGameExperience === "function"
        ) {
            window.WUTSession.setGameExperience(name, true);
        }

        applySkillSelection();

        if (window.console && console.log) {
            console.log("[WUT:FIRSTRUN] Game experience: " + name);
        }
    }

    function showStep(index) {
        var stage = document.getElementById("wut-cafe-stage");
        var manners = document.getElementById("wut-manners-scroll");
        var panel;
        var gameStep;
        var i;

        if (index < 0 || index >= steps.length || complete) {
            return;
        }

        current = index;
        gameStep = steps[current].name === "game-experience";

        for (i = 0; i < steps.length; i += 1) {
            panel = document.getElementById(steps[i].id);

            if (!panel) {
                continue;
            }

            if (i === current) {
                removeClass(panel, "wut-step-hidden");
                panel.setAttribute("aria-hidden", "false");
            }
            else {
                addClass(panel, "wut-step-hidden");
                panel.setAttribute("aria-hidden", "true");
            }
        }

        if (stage) {
            stage.setAttribute("data-wut-firstrun-state", steps[current].name);
        }

        if (manners && steps[current].name === "manners") {
            manners.scrollTop = 0;
        }

        setControl("wut-setup-close", steps[current].left);
        setControl("wut-setup-next", steps[current].right);
        showSkillControls(gameStep);
        applySkillSelection();

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.refresh === "function"
        ) {
            window.WUTPortalNav.refresh(steps[current].focus);
        }

        if (window.console && console.log) {
            console.log("[WUT:FIRSTRUN] State: " + steps[current].name);
        }
    }

    function next() {
        if (
            steps[current].name === "game-experience" &&
            !selectedSkill
        ) {
            if (
                window.WUTPortalNav &&
                typeof window.WUTPortalNav.refresh === "function"
            ) {
                window.WUTPortalNav.refresh("wut-skill-beginner");
            }
            return;
        }

        if (current < steps.length - 1) {
            showStep(current + 1);
        }
    }

    function closePortal(source) {
        emit("wut:firstrun-close", {
            source: source || "unknown",
            step: steps[current].name
        });

        try {
            if (
                window.wiiuBrowser &&
                typeof window.wiiuBrowser.closeApplication === "function"
            ) {
                window.wiiuBrowser.closeApplication();
                return;
            }
        }
        catch (ignore) {}

        if (window.console && console.log) {
            console.log("[WUT:FIRSTRUN] Close requested; no host close API found");
        }
    }

    function back(source) {
        if (complete) {
            return;
        }

        if (current > 0) {
            showStep(current - 1);
        }
        else {
            closePortal(source);
        }
    }

    function finish(source) {
        var stage = document.getElementById("wut-cafe-stage");
        var copy = document.getElementById("wut-finish-copy");
        var persisted = false;

        if (complete) {
            return;
        }

        complete = true;

        if (
            window.WUTSession &&
            typeof window.WUTSession.completeSetup === "function"
        ) {
            persisted = window.WUTSession.completeSetup(true);
        }

        if (stage) {
            stage.setAttribute("data-wut-firstrun-complete", "true");
        }

        if (copy) {
            copy.innerHTML =
                "Setup saved. WUT can now reuse your Game Experience " +
                "when the Portal Home is connected.";
        }

        setControl("wut-setup-close", null);
        setControl("wut-setup-next", null);
        showSkillControls(false);

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.refresh === "function"
        ) {
            window.WUTPortalNav.refresh("right");
        }

        emit("wut:firstrun-complete", {
            source: source || "unknown",
            persistent: persisted,
            gameExperience: selectedSkill,
            gameSkill: (
                window.WUTSession ?
                window.WUTSession.getState().gameSkill :
                null
            )
        });

        if (window.console && console.log) {
            console.log("[WUT:FIRSTRUN] Setup complete; profile state persisted");
        }
    }

    function activate(action, source) {
        if (!action) {
            return;
        }

        if (action.indexOf("select-skill-") === 0) {
            selectSkill(action.substring(13));
            return;
        }

        if (action === "close") {
            closePortal(source);
            return;
        }

        if (action === "back") {
            back(source);
            return;
        }

        if (action === "next" || action === "accept") {
            next();
            return;
        }

        if (action === "start") {
            finish(source);
        }
    }

    function scrollManners(direction) {
        var box;

        if (complete || steps[current].name !== "manners") {
            return false;
        }

        box = document.getElementById("wut-manners-scroll");

        if (!box) {
            return false;
        }

        box.scrollTop += direction * 82;
        return true;
    }

    function start() {
        var stage = document.getElementById("wut-cafe-stage");
        var copy = document.getElementById("wut-finish-copy");

        complete = false;
        selectedSkill = null;

        if (window.WUTSession) {
            selectedSkill = window.WUTSession.getState().gameExperience || null;
        }

        if (stage) {
            stage.removeAttribute("data-wut-firstrun-complete");
            stage.removeAttribute("data-wut-game-experience");
        }

        if (copy) {
            copy.innerHTML =
                "Select Start to save this setup for WUT-Miiverse.";
        }

        showStep(0);
    }

    if (window.addEventListener) {
        window.addEventListener(
            "wut:session-ready",
            function () {
                var sessionState;

                if (complete || !window.WUTSession) {
                    return;
                }

                sessionState = window.WUTSession.getState();
                if (sessionState.gameExperience) {
                    selectedSkill = sessionState.gameExperience;
                    applySkillSelection();
                }
            },
            false
        );
    }

    window.WUTFirstRun = {
        start: start,
        activate: activate,
        back: back,
        scroll: scrollManners,
        showStep: showStep,
        selectSkill: selectSkill,

        getState: function () {
            return steps[current].name;
        },

        getGameExperience: function () {
            return selectedSkill;
        },

        isComplete: function () {
            return complete;
        }
    };

    function boot() {
        start();

        if (
            window.WUTPortalNav &&
            typeof window.WUTPortalNav.start === "function"
        ) {
            window.WUTPortalNav.start();
        }

        if (
            window.WUTCafeInput &&
            typeof window.WUTCafeInput.start === "function"
        ) {
            window.WUTCafeInput.start();
        }

        if (window.console && console.log) {
            console.log("[WUT:BOOT] Cafe Portal Prototype V6.1");
            console.log("[WUT:PORTAL] Makiiverse welcome port ready");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, false);
    }
    else {
        boot();
    }

}());
