(function () {
  "use strict";

  var koiInstance = null;

  function initKoiPond() {
    if (typeof window.KoiPond !== "function") return;
    var canvas = document.getElementById("koi-pond");
    if (!canvas) return;

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
