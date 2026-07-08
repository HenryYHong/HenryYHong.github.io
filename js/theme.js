(function () {
  "use strict";

  var STORAGE_KEY = "theme-preference";
  var CYCLE = ["system", "light", "dark"];
  var LABELS = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };
  var ICONS = {
    system: "fa-adjust",
    light: "fa-sun",
    dark: "fa-moon",
  };

  function getPreference() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return CYCLE.indexOf(stored) !== -1 ? stored : "system";
    } catch (e) {
      return "system";
    }
  }

  function resolveTheme(preference) {
    if (preference === "dark") return "dark";
    if (preference === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(preference) {
    var resolved = resolveTheme(preference);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-preference", preference);
    document.documentElement.style.colorScheme = resolved;
    updateToggle(preference);
  }

  function updateToggle(preference) {
    var button = document.getElementById("themeToggle");
    if (!button) return;

    var icon = button.querySelector(".theme-toggle-icon");
    if (icon) {
      icon.classList.remove("fa-adjust", "fa-sun", "fa-moon");
      icon.classList.add(ICONS[preference]);
    }

    var label = "Color theme: " + LABELS[preference];
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label + " (click to change)");
    button.setAttribute("aria-pressed", preference === "system" ? "false" : "true");
  }

  function cyclePreference() {
    var current = getPreference();
    var next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }

    applyTheme(next);
  }

  applyTheme(getPreference());

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", cyclePreference);
  }

  var media = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", function () {
      if (getPreference() === "system") {
        applyTheme("system");
      }
    });
  } else if (typeof media.addListener === "function") {
    media.addListener(function () {
      if (getPreference() === "system") {
        applyTheme("system");
      }
    });
  }
})();
