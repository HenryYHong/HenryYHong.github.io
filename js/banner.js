(function () {
  "use strict";

  var koiInstance = null;

  function initKoiPond() {
    if (typeof window.KoiPond !== "function") return;
    var canvas = document.getElementById("koi-pond");
    if (!canvas) return;
    // The stylesheet hides the pond for reduced motion; don't animate it unseen.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (koiInstance) {
      koiInstance.destroy();
      koiInstance = null;
    }

    koiInstance = new window.KoiPond(canvas);
    koiInstance.init(function () {
      koiInstance.paintInitialFrame();
      koiInstance.start();
    });
  }

  document.documentElement.setAttribute("data-banner", "koi");
  initKoiPond();
})();
