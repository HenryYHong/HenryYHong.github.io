/*!
 * Start Bootstrap - Agency v6.0.0 (https://startbootstrap.com/template-overviews/agency)
 * Copyright 2013-2020 Start Bootstrap
 * Licensed under MIT (https://github.com/BlackrockDigital/startbootstrap-agency/blob/master/LICENSE)
 */
(function ($) {
  "use strict"; // Start of use strict

  //REPLACED WITH CSS ATTRIBUTE
  // Smooth scrolling using jQuery easing
  // $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function () {
  //     if (
  //         location.pathname.replace(/^\//, "") ==
  //             this.pathname.replace(/^\//, "") &&
  //         location.hostname == this.hostname
  //     ) {
  //         var target = $(this.hash);
  //         target = target.length
  //             ? target
  //             : $("[name=" + this.hash.slice(1) + "]");
  //         if (target.length) {
  //             $("html, body").animate(
  //                 {
  //                     scrollTop: target.offset().top - 72,
  //                 },
  //                 1000,
  //                 "easeInOutExpo"
  //             );
  //             return false;
  //         }
  //     }
  // });

  // Closes responsive menu when a scroll trigger link is clicked
  $(".js-scroll-trigger").click(function () {
    $(".navbar-collapse").collapse("hide");
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $("body").scrollspy({
    target: "#mainNav",
    offset: 74,
  });

  // Collapse Navbar
  var navbarCollapse = function () {
    if ($("#mainNav").offset().top > 100) {
      $("#mainNav").addClass("navbar-shrink");
    } else {
      $("#mainNav").removeClass("navbar-shrink");
    }
  };
  // Collapse now if page is not at top
  navbarCollapse();
  // Collapse the navbar when page is scrolled
  $(window).scroll(navbarCollapse);
})(jQuery); // End of use strict

// Secret DevTools easter egg: show a unique banner with Henry's name
(function () {
  var hasLoggedEasterEgg = false;
  var DEVTOOLS_THRESHOLD_PX = 170;

  function isDevToolsOpen() {
    var widthGap = window.outerWidth - window.innerWidth;
    var heightGap = window.outerHeight - window.innerHeight;
    return (
      widthGap > DEVTOOLS_THRESHOLD_PX || heightGap > DEVTOOLS_THRESHOLD_PX
    );
  }

  function logHenryBanner(force) {
    if (hasLoggedEasterEgg && !force) return;
    hasLoggedEasterEgg = true;

    var aaStyle = [
      "color:#fed136",
      "background:#111",
      "padding:6px 8px",
      "border:1px solid #333",
      "border-radius:6px",
      "box-shadow: 0 8px 24px rgba(254,209,54,.12) inset, 0 0 24px rgba(254,209,54,.15)",
      "font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      "line-height:1.2",
    ].join(";");

    // Neon gold headline (no rainbow)
    var nameStyle = [
      "color:#fed136",
      "font-weight:900",
      "font-size:40px",
      "letter-spacing:2px",
      "padding:4px 6px 2px",
      "text-shadow: 0 2px 4px rgba(0,0,0,.55), 0 0 12px rgba(254,209,54,.55), 0 0 28px rgba(254,209,54,.35)",
      "-webkit-text-stroke:1px rgba(0,0,0,.35)",
      "font-family: Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    ].join(";");

    var sparkleStyle = [
      "color:#ffd166",
      "font-size:14px",
      "letter-spacing:3px",
    ].join(";");

    // Use %c to apply styles to the output
    try {
      console.log("%chenry hong", nameStyle);
    } catch (e) {
      // Fallback with plain logs
      console.log("henry hong");
    }
  }

  // Poll periodically and also on resize to detect DevTools
  var checkIntervalId = setInterval(function () {
    if (isDevToolsOpen()) {
      logHenryBanner();
      clearInterval(checkIntervalId);
    }
  }, 600);

  window.addEventListener("resize", function () {
    if (isDevToolsOpen()) {
      logHenryBanner();
    }
  });

  // Manual trigger for the console: type showHenry() to display the banner
  try {
    window.showHenry = function () {
      logHenryBanner(true);
    };
  } catch (e) {}
})();

// Animations disabled for masthead (no-op)

// (Removed) Timeline enhancements: keyboard navigation + deep-link modals
// Removed block
