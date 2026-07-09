(function () {
  "use strict";

  var STORAGE_KEY = "banner-mode";
  var MODES = ["particles", "koi"];
  var PARTICLE_SPEED = 1.8;

  var koiInstance = null;
  var mastheadPJS = null;
  var mastheadParticlesMoving = !prefersReducedMotion();

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getPreference() {
    if (prefersReducedMotion()) {
      return "particles";
    }
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return MODES.indexOf(stored) !== -1 ? stored : "particles";
    } catch (e) {
      return "particles";
    }
  }

  function makeParticlesConfig(options) {
    options = options || {};
    return {
      particles: {
        number: {
          value: 32,
          density: { enable: true, value_area: 900 },
        },
        color: { value: "#ffffff" },
        shape: { type: "circle" },
        opacity: { value: 0.7 },
        size: { value: 2.5 },
        line_linked: {
          enable: true,
          distance: 130,
          color: "#ffffff",
          opacity: 0.32,
          width: 1,
        },
        move: {
          enable: true,
          speed: options.speed != null ? options.speed : 0,
        },
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: { enable: !!options.interactive, mode: "repulse" },
          onclick: { enable: !!options.interactive, mode: "push" },
        },
        modes: {
          repulse: {
            distance:
              options.repulseDistance != null ? options.repulseDistance : 95,
            duration:
              options.repulseDuration != null ? options.repulseDuration : 0.3,
          },
          push: {
            particles_nb:
              options.pushParticles != null ? options.pushParticles : 3,
          },
        },
      },
      retina_detect: true,
    };
  }

  function clearMastheadParticles() {
    var el = document.getElementById("particles-js");
    if (el) {
      el.innerHTML = "";
      el.classList.remove("is-interactive");
    }
    if (window.pJSDom) {
      window.pJSDom = window.pJSDom.filter(function (entry) {
        var canvas = entry.pJS && entry.pJS.canvas && entry.pJS.canvas.el;
        return !canvas || !canvas.closest || !canvas.closest("#particles-js");
      });
    }
    mastheadPJS = null;
    mastheadParticlesMoving = false;
  }

  function findMastheadPJS() {
    if (!window.pJSDom) return null;
    for (var i = 0; i < window.pJSDom.length; i++) {
      var canvas = window.pJSDom[i].pJS && window.pJSDom[i].pJS.canvas && window.pJSDom[i].pJS.canvas.el;
      if (canvas && canvas.closest && canvas.closest("#particles-js")) {
        return window.pJSDom[i].pJS;
      }
    }
    return null;
  }

  function initMastheadParticles() {
    if (typeof particlesJS !== "function") return;
    var el = document.getElementById("particles-js");
    if (!el) return;

    clearMastheadParticles();
    mastheadParticlesMoving = !prefersReducedMotion();
    particlesJS(
      "particles-js",
      makeParticlesConfig({
        speed: mastheadParticlesMoving ? PARTICLE_SPEED : 0,
        interactive: mastheadParticlesMoving,
      })
    );

    mastheadPJS = findMastheadPJS();
    if (mastheadPJS) {
      mastheadPJS.interactivity.events.onhover.enable = mastheadParticlesMoving;
      mastheadPJS.interactivity.events.onclick.enable = mastheadParticlesMoving;
    }

    syncParticlesToggle();
  }

  function syncParticlesToggle() {
    var particlesToggle = document.getElementById("particlesToggle");
    var particlesJsEl = document.getElementById("particles-js");
    var mastheadEl = document.querySelector("header.masthead");
    if (!particlesToggle) return;

    particlesToggle.classList.toggle("is-active", mastheadParticlesMoving);
    particlesToggle.setAttribute("aria-pressed", mastheadParticlesMoving);
    particlesToggle.innerHTML =
      '<i class="fas fa-wind"></i> Motion ' +
      (mastheadParticlesMoving ? "on" : "off");

    if (particlesJsEl) {
      particlesJsEl.classList.toggle("is-interactive", mastheadParticlesMoving);
    }
    if (mastheadEl) {
      mastheadEl.classList.toggle("is-particles-interactive", mastheadParticlesMoving);
    }
  }

  function setupParticlesToggle() {
    var particlesToggle = document.getElementById("particlesToggle");
    if (!particlesToggle || particlesToggle.dataset.bound) return;
    particlesToggle.dataset.bound = "true";

    particlesToggle.addEventListener("click", function () {
      if (getPreference() !== "particles") return;
      mastheadParticlesMoving = !mastheadParticlesMoving;
      if (mastheadPJS) {
        mastheadPJS.particles.move.speed = mastheadParticlesMoving ? PARTICLE_SPEED : 0;
        mastheadPJS.interactivity.events.onhover.enable = mastheadParticlesMoving;
        mastheadPJS.interactivity.events.onclick.enable = mastheadParticlesMoving;
      }
      syncParticlesToggle();
    });
  }

  function destroyKoiPond() {
    if (koiInstance) {
      koiInstance.destroy();
      koiInstance = null;
    }
  }

  function initKoiPond() {
    if (typeof window.KoiPond !== "function") return;
    var canvas = document.getElementById("koi-pond");
    if (!canvas) return;

    destroyKoiPond();
    clearMastheadParticles();

    function boot() {
      koiInstance = new window.KoiPond(canvas);
      koiInstance.init(function () {
        koiInstance.start();
      });
    }

    boot();
  }

  function updateToggle(mode) {
    var button = document.getElementById("bannerToggle");
    if (!button) return;

    var icon = button.querySelector(".banner-toggle-icon");
    if (icon) {
      icon.classList.remove("fa-fish", "fa-circle", "fa-tint");
      if (mode === "koi") {
        icon.classList.add("fa-circle");
      } else {
        icon.classList.add("fa-tint");
      }
    }

    if (mode === "koi") {
      button.setAttribute("aria-label", "Banner: Koi pond (click for particles)");
      button.setAttribute("title", "Banner: Koi pond — click to switch back to particles");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.setAttribute("aria-label", "Banner: Particles (click for koi pond)");
      button.setAttribute("title", "Banner: Particles — click to switch to koi pond");
      button.setAttribute("aria-pressed", "false");
    }
  }

  function applyBanner(mode) {
    document.documentElement.setAttribute("data-banner", mode);
    updateToggle(mode);

    if (mode === "koi") {
      initKoiPond();
    } else {
      destroyKoiPond();
      initMastheadParticles();
    }
  }

  function cycleBanner() {
    var current = getPreference();
    var next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
    applyBanner(next);
  }

  setupParticlesToggle();
  applyBanner(getPreference());

  var toggle = document.getElementById("bannerToggle");
  if (toggle) {
    toggle.addEventListener("click", cycleBanner);
  }

  window.BannerMode = {
    get: getPreference,
    set: function (mode) {
      if (MODES.indexOf(mode) === -1) return;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (e) {
        /* ignore */
      }
      applyBanner(mode);
    },
  };
})();
