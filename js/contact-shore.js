(function () {
  "use strict";

  // The far side of the koi pond behind the contact section: the sky the pond
  // reflects over soft rows of misty hills, with a sea of clouds drifting
  // between them as on Huang Shan. On the right a waterfall pours from a
  // mountain with the Dragon Gate at the top. Now and then a koi leaps
  // at the falls, and when one clears the gate it turns into a dragon and
  // glides off across the sky, as in the old story. At night, stars with the
  // Big Dipper among them, and fireflies; by day, a little pollen in the light
  // and now and then a dragonfly, which sometimes lands on one of the buttons.

  var TAU = Math.PI * 2;

  // Colors by day and in moonlight: [r, g, b] or [r, g, b, alpha].
  var DAY = {
    hillFar: [66, 106, 146, 0.3],
    hillMid: [50, 88, 126, 0.48],
    hillNear: [34, 64, 94, 1],
    gate: [36, 66, 98, 0.66],
    falls: [236, 246, 255, 0.6],
  };
  var NIGHT = {
    hillFar: [16, 34, 66, 0.5],
    hillMid: [11, 26, 54, 0.72],
    hillNear: [7, 16, 34, 1],
    gate: [7, 17, 37, 0.85],
    falls: [176, 200, 232, 0.34],
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  // Koi that try the falls: [body, patch], like the ones in the pond.
  var KOI = [
    ["#f07a32", null],
    ["#f4efe6", "#d9472b"],
    ["#e8b23c", null],
    ["#f4efe6", "#f07a32"],
  ];

  // The mountain the falls pour from, as height above the lip against
  // distance from the falls, in units: one of the far hills rising into two
  // rounded peaks, the right one taller, with a ledge between them where the
  // gate stands and the water tips over.
  var PEAK = [
    [-112, -76], [-80, -50], [-56, -26], [-40, -8], [-30, 4], [-24, 10], [-20, 11],
    [-17.6, 5], [-16, 0], [16, 0], [17.6, 7], [21, 15], [27, 21], [33, 20], [41, 11],
    [52, -4], [68, -26], [90, -52], [118, -80],
  ];

  // A smooth curve through those points that never overshoots them, so the
  // ledge stays flat and the peaks stay round.
  var PEAK_SLOPES = PEAK.map(function (q, i) {
    if (i === 0 || i === PEAK.length - 1) return 0;
    var a = (q[1] - PEAK[i - 1][1]) / (q[0] - PEAK[i - 1][0]);
    var b = (PEAK[i + 1][1] - q[1]) / (PEAK[i + 1][0] - q[0]);
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });

  function peakHeight(dx) {
    if (dx <= PEAK[0][0] || dx >= PEAK[PEAK.length - 1][0]) return -Infinity;
    var i = 0;
    while (PEAK[i + 1][0] < dx) i++;
    var x0 = PEAK[i][0];
    var span = PEAK[i + 1][0] - x0;
    var t = (dx - x0) / span;
    var t2 = t * t;
    var t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * PEAK[i][1] + (t3 - 2 * t2 + t) * span * PEAK_SLOPES[i] + (-2 * t3 + 3 * t2) * PEAK[i + 1][1] + (t3 - t2) * span * PEAK_SLOPES[i + 1];
  }

  // The Big Dipper's stars, [right ascension in hours, declination in degrees,
  // magnitude]: Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid.
  var DIPPER_STARS = [
    [11.062, 61.75, 1.8],
    [11.031, 56.38, 2.4],
    [11.897, 53.69, 2.4],
    [12.257, 57.03, 3.3],
    [12.9, 55.96, 1.8],
    [13.399, 54.93, 2.2],
    [13.792, 49.31, 1.9],
  ];
  // Flattened around its middle as it looks in the sky, east to the left,
  // longest side 1: [x, y, brightness].
  var DIPPER = (function () {
    var ra0 = 0;
    var dec0 = 0;
    DIPPER_STARS.forEach(function (s) {
      ra0 += s[0] / 7;
      dec0 += s[1] / 7;
    });
    var k = Math.cos((dec0 * Math.PI) / 180) * 15;
    var pts = DIPPER_STARS.map(function (s) {
      return [-(s[0] - ra0) * k, -(s[1] - dec0), 0.75 + (2.6 - s[2]) * 0.22];
    });
    var xs = pts.map(function (q) { return q[0]; });
    var ys = pts.map(function (q) { return q[1]; });
    var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    var cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    var span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys));
    return pts.map(function (q) {
      return [(q[0] - cx) / span, (q[1] - cy) / span, q[2]];
    });
  })();

  function mix(a, b, k) {
    return a.map(function (v, i) {
      return v + (b[i] - v) * k;
    });
  }

  function css(c, alpha) {
    var a = (c.length > 3 ? c[3] : 1) * (alpha == null ? 1 : alpha);
    return "rgba(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ", " + a.toFixed(3) + ")";
  }

  // Seeded random numbers, so the garden looks the same every visit.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A soft round glow for fireflies and pollen.
  function makeGlow(rgb) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(" + rgb + ", 1)");
    grad.addColorStop(0.2, "rgba(" + rgb + ", 0.5)");
    grad.addColorStop(0.55, "rgba(" + rgb + ", 0.12)");
    grad.addColorStop(1, "rgba(" + rgb + ", 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  // A soft patch of mist, stretched into wisps when drawn.
  function makeMist() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.45, "rgba(255, 255, 255, 0.6)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  function isNight() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  // Both layers sit behind and above the section's content without taking up
  // space, even if the stylesheet fails to load. In the page's flow, a canvas
  // sized to its section would make the section taller on every resize.
  function pin(canvas, z) {
    var s = canvas.style;
    s.position = "absolute";
    s.left = s.top = "0";
    s.width = s.height = "100%";
    s.display = "block";
    s.pointerEvents = "none";
    s.zIndex = z;
  }

  // Cracks and ledges in the rock, roughening the granite.
  function crag(x, seed) {
    return Math.sin(x * 0.23 + seed) * 1.5 + Math.sin(x * 0.61 + seed * 2) * 0.9 + Math.sin(x * 1.37 + seed * 3) * 0.45;
  }

  // How high one of Huang Shan's granite columns stands at x: sheer walls and
  // a broad, rounded top tipped a little to one side, with a little fallen
  // rock at its foot. A lower power makes a rounder mass of rock, the kind
  // the columns rise out of.
  function columnHeight(c, x) {
    var d = (x - c.x) / c.w;
    var r = Math.abs(d);
    if (r >= 1.7) return 0;
    var core = r < 1 ? c.h * Math.pow(1 - Math.pow(r, c.p), 0.4) * (1 + c.tilt * d) : 0;
    var q = 1 - r / 1.7;
    return Math.max(core, c.h * 0.22 * q * q);
  }

  // The height of a row of hills at x: low in the middle, under the heading
  // and buttons. Where the row has granite columns they rise out of it,
  // their tops knobbed and cracked.
  function ridge(hill, x, w) {
    var f = hill.f;
    var n = 0.55 * Math.sin(x * f[0] + hill.p[0]) + 0.3 * Math.sin(x * f[1] + hill.p[1]) + 0.15 * Math.sin(x * f[2] + hill.p[2]);
    var side = Math.abs(x / w - 0.5) * 2;
    var y = hill.base - hill.amp * (0.5 + 0.5 * n) * (0.45 + 0.55 * side);
    if (!hill.columns) return y;
    var tallest = 0;
    for (var i = 0; i < hill.columns.length; i++) {
      var ch = columnHeight(hill.columns[i], x);
      if (ch <= 0) continue;
      y = Math.min(y, hill.base - ch);
      tallest = Math.max(tallest, ch);
    }
    return y + crag(x, hill.seed) * 0.6 * clamp(tallest / 30, 0, 1);
  }

  // The higher of two ridges, rounded off where they meet.
  function smoothTop(a, b, k) {
    var m = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
    return b + (a - b) * m - k * m * (1 - m);
  }

  function ContactShore(section, canvas, front) {
    pin(canvas, "0");
    pin(front, "3");
    this.section = section;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    // The dragonfly flies on its own layer above the heading and buttons.
    this.front = front;
    this.fctx = front.getContext("2d");
    this.buttons = Array.prototype.slice.call(section.querySelectorAll(".contact-socials .btn-social"));
    this.starGlow = makeGlow("235, 242, 255");
    this.mistBlob = makeMist();
    this.fireGlow = makeGlow("214, 255, 120");
    this.sunGlow = makeGlow("255, 246, 214");
    this.foam = makeGlow("255, 255, 255");
    this.shade = makeGlow("112, 150, 190");
    this.layers = {};
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.last = 0;
    this.night = isNight() ? 1 : 0;
    this.fireflies = [];
    this.motes = [];
    this.stars = [];
    this.dragonfly = null;
    this.nextDragonfly = rand(6, 12);
    this.dragon = null;
    // A koi tries the falls a few seconds after the section comes into view,
    // and each dragon starts as one.
    this.leap = null;
    this.nextLeap = rand(3, 5);
    this.drops = [];
    this.puff = null;
    // The dragon is drawn solid here first, then faded onto the sky in one
    // piece, so where its parts overlap doesn't show darker.
    this.dragonLayer = document.createElement("canvas");
    this.visible = false;
    this.running = false;
    this.raf = 0;
    this.scrolledAt = -1e9;
    this.still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    this._frame = this.frame.bind(this);
  }

  ContactShore.prototype.resize = function () {
    var w = this.section.clientWidth;
    var h = this.section.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!w || !h || (w === this.w && h === this.h && dpr === this.dpr)) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = this.front.width = this.dragonLayer.width = Math.round(w * dpr);
    this.canvas.height = this.front.height = this.dragonLayer.height = Math.round(h * dpr);
    this.layout();
    this.paintLayers();
    if (!this.running) this.draw();
  };

  // Where everything goes. The hills stay low in the middle, under the
  // heading and buttons.
  ContactShore.prototype.layout = function () {
    var w = this.w;
    var h = this.h;
    var u = h / 254;
    var rnd = seeded(1013);
    var i;
    // The falls on the right, from the lip under the gate down to where the
    // middle row of peaks hides its foot in cloud and spray. Smaller on
    // phones, and closer to the edge, clear of the heading.
    var wide = w >= 700;
    var fu = wide ? u : u * 0.85;
    var fx = Math.round(w * (wide ? 0.86 : 0.9));
    var lip = h * 0.41;

    // Three rows of hills, lower in the middle under the heading and buttons:
    // two misty ones in the distance and a darker one near the water. As on
    // Huang Shan, a cluster of granite columns rises out of them on the left,
    // pressed together at different heights, with a nearer pair below it,
    // and a small one past the falls. The middle stays open. On phones the
    // columns huddle closer to the edge.
    var px = w >= 700 ? u : u * 0.6;
    function columns(at, list) {
      return list.map(function (c) {
        return { x: at + c[0] * fu, h: c[1] * fu, w: c[2] * fu, tilt: c[3], p: c[4] || 3 };
      });
    }
    this.hills = [
      {
        base: h - 62 * u, amp: 44 * u, f: [0.006, 0.017, 0.041], p: [0.3, 2.1, 4.4], color: "hillFar", mist: true, seed: 0.7,
        columns: columns(78 * px, [[-2, 46, 58, 0.05, 1.6], [-40, 54, 12, 0.12], [-21, 82, 11, -0.1], [-3, 106, 13, 0.07], [16, 72, 9, -0.12], [33, 52, 12, 0.08]])
          .concat(columns(fx + 104 * fu, [[0, 34, 30, 0, 1.6], [-7, 62, 10, 0.1], [9, 46, 9, -0.08]])),
      },
      {
        base: h - 36 * u, amp: 36 * u, f: [0.009, 0.023, 0.053], p: [1.7, 0.4, 3.2], color: "hillMid", mist: true, seed: 2.3,
        columns: columns(14 * px, [[4, 30, 30, 0, 1.6], [-6, 56, 12, 0.1], [15, 42, 9, -0.1]]),
      },
      { base: h - 12 * u, amp: 26 * u, f: [0.011, 0.029, 0.067], p: [2.6, 1.1, 0.7], color: "hillNear", mist: false },
    ];
    this.falls = {
      x: fx,
      lip: lip,
      base: 0,
      u: fu,
      // Where a koi that clears the gate turns into a dragon.
      top: lip - 30 * fu,
    };
    this.falls.base = clamp(ridge(this.hills[1], fx, w) + 2 * u, h * 0.6, h * 0.84);
    var prnd = seeded(2077);
    // Threads of water running down the falls, each at its own place across
    // the sheet and its own pace.
    this.streaks = [];
    for (i = 0; i < 26; i++) {
      this.streaks.push({
        across: prnd() * 2 - 1,
        phase: prnd(),
        rate: 0.55 + prnd() * 0.25,
        len: 0.7 + prnd() * 0.6,
        sway: prnd() * TAU,
        dark: i % 3 === 2,
      });
    }

    // A pine leaning out from the top of the nearer pair of columns, one on
    // the tallest column, and one on the shoulder of the mountain beside the
    // gate.
    this.pines = [
      { row: 1, x: 14 * px + 19 * fu, size: 10 * fu, lean: 1 },
      { row: 0, x: 78 * px - 1 * fu, size: 7 * fu, lean: -1 },
      { row: 0, x: fx - 21 * fu, size: 7 * fu, lean: -1 },
    ];

    // The sea of clouds: banks of mist drifting slowly through the valleys,
    // one at the foot of the far peaks and one at the foot of the middle row.
    this.seas = [h - 74 * u, h - 44 * u].map(function (y, k) {
      var banks = [];
      for (var x = -100 * u; x < w + 100 * u; x += (50 + prnd() * 80) * u) {
        if (prnd() < 0.35) continue;
        banks.push({ x: x, dy: (prnd() - 0.5) * 12 * u, len: (70 + prnd() * 120) * u, thick: (k ? 14 : 18) * u * (0.7 + prnd() * 0.7), alpha: 0.4 + prnd() * 0.6 });
      }
      return { y: y, banks: banks, speed: (k ? 4 : 2.5) * u, span: w + 200 * u };
    });

    var count = Math.round(clamp(w / 75, 6, 18));
    this.fireflies = [];
    for (i = 0; i < count; i++) {
      this.fireflies.push({
        x: rand(0, w),
        y: rand(h * 0.25, h * 0.95),
        vx: rand(-8, 8),
        vy: rand(-5, 5),
        period: rand(2.6, 5.5),
        phase: rand(0, 6),
        on: rand(0.8, 1.4),
      });
    }
    // The Big Dipper sits in open sky: left of the heading on wide screens,
    // in the top corner on phones.
    var size = wide ? Math.min(170, w * 0.12) : w * 0.24;
    var dx = w * (wide ? 0.2 : 0.15);
    var dy = h * (wide ? 0.3 : 0.13);
    this.dipper = DIPPER.map(function (q, k) {
      return { x: dx + q[0] * size, y: dy + q[1] * size, b: q[2], phase: k * 1.7 };
    });
    this.stars = [];
    for (i = 0; i < Math.round(w / 14); i++) {
      this.stars.push({ x: rnd() * w, y: rnd() * h * 0.6, r: 0.4 + rnd() * 0.7, a: 0.25 + rnd() * 0.5, phase: rnd() * TAU });
    }
    this.motes = [];
    for (i = 0; i < Math.round(clamp(w / 120, 4, 12)); i++) {
      this.motes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-4, 4), vy: rand(-6, -2), phase: rand(0, TAU), r: rand(0.8, 1.6) });
    }
    // Faint wisps of mist drifting across the sky, where the dragon flies.
    this.wisps = [];
    for (i = 0; i < Math.max(2, Math.round(w / 260)); i++) {
      this.wisps.push({
        x: rnd() * w,
        y: h * (0.1 + rnd() * 0.3),
        len: (110 + rnd() * 120) * u,
        thick: (28 + rnd() * 18) * u,
        speed: (3 + rnd() * 4) * u,
        alpha: 0.6 + rnd() * 0.4,
      });
    }
  };

  ContactShore.prototype.drawMist = function (ctx, alpha) {
    var blob = this.mistBlob;
    ctx.save();
    this.wisps.forEach(function (m) {
      ctx.globalAlpha = alpha * m.alpha;
      ctx.drawImage(blob, m.x - m.len / 2, m.y - m.thick * 0.35, m.len, m.thick * 0.7);
      ctx.drawImage(blob, m.x - m.len * 0.42, m.y - m.thick * 0.55, m.len * 0.45, m.thick * 0.85);
      ctx.drawImage(blob, m.x - m.len * 0.08, m.y - m.thick * 0.5, m.len * 0.4, m.thick);
      ctx.drawImage(blob, m.x + m.len * 0.12, m.y - m.thick * 0.3, m.len * 0.32, m.thick * 0.6);
    });
    ctx.restore();
  };

  // Where a row of hills meets the sky. The far row rises into the mountain
  // with the falls.
  ContactShore.prototype.ridgeAt = function (hill, x) {
    var y = ridge(hill, x, this.w);
    if (hill !== this.hills[0]) return y;
    var F = this.falls;
    var up = peakHeight((x - F.x) / F.u);
    return up === -Infinity ? y : smoothTop(y, F.lip - up * F.u, 24 * F.u);
  };

  // The mountains never move, so each row is painted once for day and once
  // for night, on its own layer so the clouds can drift between them: the far
  // row with the gate behind the falls, then the middle row, then the ridge
  // by the water.
  ContactShore.prototype.paintLayers = function () {
    var self = this;
    ["day", "night"].forEach(function (when) {
      var P = when === "day" ? DAY : NIGHT;
      self.hills.forEach(function (hill, row) {
        var key = when + "-" + row;
        var c = self.layers[key] || (self.layers[key] = document.createElement("canvas"));
        c.width = self.canvas.width;
        c.height = self.canvas.height;
        var ctx = c.getContext("2d");
        ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
        self.paintHills(ctx, P, [hill]);
        self.pines.forEach(function (pine) {
          if (pine.row === row) self.paintPine(ctx, P, pine);
        });
        if (row === 0) self.paintGate(ctx, P);
      });
    });
  };

  // A Huang Shan pine on a peak: a short bent trunk and flat, layered pads of
  // needles reaching out to one side.
  ContactShore.prototype.paintPine = function (ctx, P, pine) {
    var hill = this.hills[pine.row];
    var s = pine.size;
    var d = pine.lean;
    var x = pine.x;
    var y = this.ridgeAt(hill, x) + 0.1 * s;
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = css(P[hill.color]);
    ctx.lineCap = "round";
    ctx.lineWidth = 0.13 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - d * 0.12 * s, y - 0.4 * s, x + d * 0.22 * s, y - 0.62 * s);
    ctx.moveTo(x - d * 0.02 * s, y - 0.32 * s);
    ctx.quadraticCurveTo(x + d * 0.3 * s, y - 0.36 * s, x + d * 0.62 * s, y - 0.44 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + d * 0.18 * s, y - 0.7 * s, 0.42 * s, 0.1 * s, 0, 0, TAU);
    ctx.ellipse(x + d * 0.62 * s, y - 0.5 * s, 0.32 * s, 0.08 * s, 0, 0, TAU);
    ctx.ellipse(x - d * 0.12 * s, y - 0.5 * s, 0.22 * s, 0.07 * s, 0, 0, TAU);
    ctx.ellipse(x + d * 0.28 * s, y - 0.84 * s, 0.24 * s, 0.07 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  // A bank of the sea of clouds.
  ContactShore.prototype.drawSea = function (ctx, sea) {
    var blob = this.mistBlob;
    var a = 0.26 - 0.11 * this.night;
    sea.banks.forEach(function (b) {
      ctx.globalAlpha = a * b.alpha;
      var y = sea.y + b.dy;
      ctx.drawImage(blob, b.x - b.len / 2, y - b.thick / 2, b.len, b.thick);
      ctx.drawImage(blob, b.x - b.len * 0.3, y - b.thick * 0.8, b.len * 0.5, b.thick * 0.9);
    });
    ctx.globalAlpha = 1;
  };

  // The Dragon Gate standing on the ledge over the falls: a three-bay archway
  // with the middle bay over the water, each bay under its own tiled roof
  // with upturned eaves, the middle one highest, and a plaque under it.
  ContactShore.prototype.paintGate = function (ctx, P) {
    var F = this.falls;
    var u = F.u;
    ctx.save();
    ctx.translate(F.x, F.lip);
    ctx.scale(u, u);
    ctx.fillStyle = css(P.gate);
    ctx.beginPath();
    // Posts, the beams between them, and the plaque.
    ctx.rect(-7.6, -13, 1.5, 13);
    ctx.rect(6.1, -13, 1.5, 13);
    ctx.rect(-13.6, -9, 1.2, 9);
    ctx.rect(12.4, -9, 1.2, 9);
    ctx.rect(-7.6, -10.6, 15.2, 1.1);
    ctx.rect(-13, -7.6, 6, 1);
    ctx.rect(7, -7.6, 6, 1);
    ctx.rect(-2.6, -13.6, 5.2, 2.8);
    ctx.fill();
    // A roof: eaves from x0 to x1 at height y, sweeping up at both ends, and
    // a ridge on top with its ends curled up.
    function roof(x0, x1, y, tall) {
      var span = x1 - x0;
      var lift = tall * 0.45;
      ctx.beginPath();
      ctx.moveTo(x0, y - lift);
      ctx.quadraticCurveTo(x0 + span * 0.14, y + 0.2, x0 + span * 0.3, y);
      ctx.lineTo(x1 - span * 0.3, y);
      ctx.quadraticCurveTo(x1 - span * 0.14, y + 0.2, x1, y - lift);
      ctx.quadraticCurveTo(x1 - span * 0.12, y - tall * 0.45, x1 - span * 0.2, y - tall * 0.8);
      ctx.lineTo(x1 - span * 0.17, y - tall * 1.15);
      ctx.lineTo(x1 - span * 0.24, y - tall);
      ctx.lineTo(x0 + span * 0.24, y - tall);
      ctx.lineTo(x0 + span * 0.17, y - tall * 1.15);
      ctx.lineTo(x0 + span * 0.2, y - tall * 0.8);
      ctx.quadraticCurveTo(x0 + span * 0.12, y - tall * 0.45, x0, y - lift);
      ctx.fill();
    }
    roof(-17, -6, -8.6, 3);
    roof(6, 17, -8.6, 3);
    roof(-11.5, 11.5, -13.4, 4.4);
    ctx.restore();
  };

  ContactShore.prototype.paintHills = function (ctx, P, hills) {
    var w = this.w;
    var h = this.h;
    var self = this;
    hills.forEach(function (hill) {
      var top = h;
      var pts = [];
      for (var x = -8; x <= w + 8; x += 2) {
        pts.push([x, self.ridgeAt(hill, x)]);
        top = Math.min(top, ridge(hill, x, w));
      }
      // Distant hills are darkest along the ridge and fade into mist below.
      if (hill.mist) {
        var g = ctx.createLinearGradient(0, top, 0, hill.base + 20);
        g.addColorStop(0, css(P[hill.color]));
        g.addColorStop(1, css(P[hill.color], 0.25));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = css(P[hill.color]);
      }
      ctx.beginPath();
      ctx.moveTo(-8, h);
      pts.forEach(function (p) {
        ctx.lineTo(p[0], p[1]);
      });
      ctx.lineTo(w + 8, h);
      ctx.closePath();
      ctx.fill();
    });
  };

  ContactShore.prototype.drawLayer = function (ctx, part) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.night < 1) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.layers["day-" + part], 0, 0);
    }
    if (this.night > 0) {
      ctx.globalAlpha = this.night;
      ctx.drawImage(this.layers["night-" + part], 0, 0);
    }
    ctx.restore();
  };

  ContactShore.prototype.drawDipper = function (ctx) {
    var t = this.time;
    this.dipper.forEach(function (s) {
      var a = this.night * s.b * (this.still ? 0.9 : 0.85 + 0.15 * Math.sin(t * 1.3 + s.phase));
      ctx.globalAlpha = a * 0.6;
      ctx.drawImage(this.starGlow, s.x - 9, s.y - 9, 18, 18);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#f6f9ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.5, 0, TAU);
      ctx.fill();
    }, this);
    ctx.globalAlpha = 1;
  };

  ContactShore.prototype.drawStars = function (ctx) {
    var t = this.time;
    ctx.fillStyle = "#f2f6ff";
    this.stars.forEach(function (s) {
      ctx.globalAlpha = this.night * s.a * (this.still ? 0.8 : 0.65 + 0.35 * Math.sin(t * 1.1 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }, this);
    ctx.globalAlpha = 1;
  };


  ContactShore.prototype.drawFireflies = function (ctx) {
    var t = this.time;
    var glow = this.fireGlow;
    var still = this.still;
    this.fireflies.forEach(function (f) {
      // Each one lights up for about a second, then rests a few seconds.
      var k = (t + f.phase) % f.period;
      var lit = still ? 0.6 : k < f.on ? Math.sin((Math.PI * k) / f.on) : 0;
      if (lit <= 0.01) return;
      ctx.globalAlpha = lit * this.night;
      ctx.drawImage(glow, f.x - 11, f.y - 11, 22, 22);
      ctx.fillStyle = "#f4ffc4";
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.3, 0, TAU);
      ctx.fill();
    }, this);
    ctx.globalAlpha = 1;
  };

  ContactShore.prototype.drawMotes = function (ctx) {
    var t = this.time;
    var day = 1 - this.night;
    this.motes.forEach(function (m) {
      ctx.globalAlpha = day * (0.25 + 0.15 * Math.sin(t * 0.8 + m.phase));
      var r = m.r * 5;
      ctx.drawImage(this.sunGlow, m.x - r, m.y - r, r * 2, r * 2);
    }, this);
    ctx.globalAlpha = 1;
  };

  // A dragonfly darts in, hovers by a few spots in the reeds, and darts off.
  ContactShore.prototype.spawnDragonfly = function () {
    var w = this.w;
    var h = this.h;
    var fromLeft = Math.random() < 0.5;
    var stops = [];
    var n = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var side = Math.random() < 0.5 ? rand(0.05, 0.3) : rand(0.7, 0.95);
      stops.push({ x: w * side, y: h * rand(0.35, 0.75) });
    }
    // Often it stops to rest on one of the buttons.
    if (this.buttons.length && Math.random() < 0.6) {
      stops.splice(1, 0, { perch: Math.floor(Math.random() * this.buttons.length) });
    }
    stops.push({ x: fromLeft ? w + 40 : -40, y: h * rand(0.2, 0.6) });
    this.dragonfly = { x: fromLeft ? -40 : w + 40, y: h * rand(0.3, 0.6), stops: stops, wait: 0, perched: null, face: fromLeft ? 1 : -1 };
  };

  // A koi leaps at the falls from the spray at their foot. Most tries fall
  // short and it drops back with a splash; the last one carries it up past
  // the gate.
  var LEAP_G = 240; // gravity, in units per second squared

  ContactShore.prototype.startLeap = function () {
    var F = this.falls;
    var u = F.u;
    var H = F.base - F.top;
    var tries = [];
    var t = 0;
    // It falls short two or three times, each leap a little higher.
    var fails = Math.random() < 0.5 ? 2 : 3;
    for (var k = 0; k <= fails; k++) {
      var last = k === fails;
      var height = H * (last ? 1 : (0.2 + (0.42 * k) / (fails - 1)) * rand(0.9, 1.1));
      var dur = 2 * Math.sqrt((2 * height) / (LEAP_G * u));
      tries.push({ t0: t, height: height, dur: dur, drift: (last ? -10 : rand(-4, 4)) * u, last: last });
      t += dur + rand(0.7, 1.3);
    }
    this.leap = { born: this.time, tries: tries, koi: KOI[Math.floor(Math.random() * KOI.length)], fish: null };
  };

  ContactShore.prototype.updateLeap = function () {
    var L = this.leap;
    if (!L) {
      if (!this.dragon && this.time >= this.nextLeap) this.startLeap();
      return;
    }
    var F = this.falls;
    var a = this.time - L.born;
    L.fish = null;
    for (var k = 0; k < L.tries.length; k++) {
      var tr = L.tries[k];
      if (a < tr.t0) break;
      var s = (a - tr.t0) / tr.dur;
      if (!tr.out) {
        tr.out = true;
        this.splash(F.x, F.base, 4);
      }
      // Over the gate: it becomes a dragon in a flash and a puff of cloud.
      if (tr.last && s >= 0.5) {
        var x = F.x + tr.drift * 0.5;
        this.puff = { x: x, y: F.top, born: this.time };
        this.spawnDragon(x, F.top);
        this.leap = null;
        return;
      }
      if (s >= 1) {
        if (!tr.in) {
          tr.in = true;
          this.splash(F.x + tr.drift, F.base, 6);
        }
        continue;
      }
      var vx = tr.drift / tr.dur;
      var vy = (-tr.height * 4 * (1 - 2 * s)) / tr.dur;
      L.fish = { x: F.x + tr.drift * s, y: F.base - tr.height * 4 * s * (1 - s), ang: Math.atan2(vy, vx) };
    }
    if (a > L.tries[L.tries.length - 1].t0 + 10) this.leap = null;
  };

  ContactShore.prototype.splash = function (x, y, count) {
    var u = this.falls.u;
    for (var i = 0; i < count; i++) {
      this.drops.push({ x: x + rand(-2, 2) * u, y: y - 2 * u, vx: rand(-22, 22) * u, vy: rand(-62, -30) * u, age: 0, life: rand(0.45, 0.7) });
    }
  };

  ContactShore.prototype.updateDrops = function (dt) {
    var g = LEAP_G * this.falls.u;
    this.drops = this.drops.filter(function (d) {
      d.age += dt;
      d.vy += g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      return d.age < d.life;
    });
    if (this.puff && this.time - this.puff.born > 6) this.puff = null;
  };

  // The dragon glides across the sky, small and far off behind the hills. It
  // rises and dips slowly as it goes, its head rolling gently up and down,
  // and the long body follows the same path, so it ripples like a ribbon. It
  // swims out of the cloud over the gate, climbing away from the falls.
  ContactShore.prototype.spawnDragon = function (x, y) {
    var w = this.w;
    var h = this.h;
    var u = h / 254;
    var g = {
      dir: x > w / 2 ? -1 : 1,
      len: Math.min(120, w * 0.24) * u,
      speed: (w < 700 ? 24 : 32) * u,
      x0: x,
      y: h * rand(0.19, 0.25),
      amp: rand(6, 9) * u,
      wave: rand(1.9, 2.3),
      phase: rand(0, TAU),
      rise: h * rand(0.06, 0.08),
      climb: TAU / rand(28, 40),
      tilt: Math.PI,
      off: 0,
      born: this.time,
    };
    g.off = y - dragonAt(g, 0).y;
    this.dragon = g;
  };

  // Where the head was t seconds after it appeared. Before that, the body is
  // still gathered in the cloud.
  function dragonAt(g, t) {
    t = Math.max(t, 0);
    return {
      x: g.x0 + g.dir * g.speed * t,
      y: g.y + g.rise * Math.sin(g.climb * t + g.tilt) + g.amp * Math.sin(g.wave * t + g.phase) + g.amp * 0.35 * Math.sin(g.wave * 0.37 * t + 1.3) + g.off * Math.exp(-t / 2.5),
    };
  }

  ContactShore.prototype.updateDragon = function () {
    var g = this.dragon;
    if (!g) return;
    var head = dragonAt(g, this.time - g.born);
    if ((g.dir > 0 && head.x > this.w + g.len + 60) || (g.dir < 0 && head.x < -g.len - 60)) {
      this.dragon = null;
      this.nextLeap = this.time + rand(25, 45);
    }
  };

  // The dragon as one soft silhouette: a long body with a flame-like frill
  // along its back, four legs with tufted elbows and spread talons, a horned
  // head with a streaming mane, beard and long whiskers, and a fan of flame at
  // the tail.
  ContactShore.prototype.drawDragon = function (ctx) {
    var g = this.dragon;
    var age = this.time - g.born;
    var n = 64;
    var step = g.len / n;
    var T = g.len * 0.045; // body thickness at the neck
    var pts = [];
    var i;
    for (i = 0; i <= n; i++) pts.push(dragonAt(g, age - (i * step) / g.speed));
    for (i = 0; i <= n; i++) {
      var a = pts[Math.max(i - 1, 0)];
      var b = pts[Math.min(i + 1, n)];
      var tx = a.x - b.x;
      var ty = a.y - b.y;
      var tl = Math.hypot(tx, ty) || 1;
      var p = pts[i];
      p.tx = tx / tl; // toward the head
      p.ty = ty / tl;
      p.nx = g.dir * p.ty; // toward its back
      p.ny = -g.dir * p.tx;
      var f = i / n;
      // Fullest through the chest, tapering to a thin tail.
      p.th = f < 0.25 ? T * (0.95 + 0.25 * Math.sin((f / 0.25) * Math.PI * 0.5)) : T * 1.2 * (1 - 0.8 * Math.pow((f - 0.25) / 0.75, 1.15));
    }

    var lc = this.dragonLayer.getContext("2d");
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, this.dragonLayer.width, this.dragonLayer.height);
    lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var night = this.night;
    lc.fillStyle = lc.strokeStyle = "rgb(" + Math.round(22 - 16 * night) + ", " + Math.round(42 - 30 * night) + ", " + Math.round(64 - 36 * night) + ")";
    lc.lineCap = "round";
    lc.lineJoin = "round";

    // Body, then the fins along its back, big and small in turn as in Qing
    // dynasty paintings.
    lc.beginPath();
    for (i = 0; i <= n; i++) lc[i ? "lineTo" : "moveTo"](pts[i].x + (pts[i].nx * pts[i].th) / 2, pts[i].y + (pts[i].ny * pts[i].th) / 2);
    for (i = n; i >= 0; i--) lc.lineTo(pts[i].x - (pts[i].nx * pts[i].th) / 2, pts[i].y - (pts[i].ny * pts[i].th) / 2);
    lc.closePath();
    lc.fill();
    lc.beginPath();
    for (i = 3; i < n - 2; i += 2) {
      var q = pts[i];
      var top = q.th / 2 - 0.5;
      var tall = Math.max(1.2, q.th * ((i - 3) % 4 ? 0.22 : 0.42));
      var bx = q.x + q.nx * top;
      var by = q.y + q.ny * top;
      lc.moveTo(bx + q.tx * step * 0.8, by + q.ty * step * 0.8);
      lc.quadraticCurveTo(bx + q.nx * tall * 0.9 + q.tx * step * 0.3, by + q.ny * tall * 0.9 + q.ty * step * 0.3, bx + q.nx * tall - q.tx * step * 1.5, by + q.ny * tall - q.ty * step * 1.5);
      lc.quadraticCurveTo(bx + q.nx * tall * 0.3 - q.tx * step * 0.6, by + q.ny * tall * 0.3 - q.ty * step * 0.6, bx - q.tx * step * 0.9, by - q.ty * step * 0.9);
    }
    lc.fill();

    // Legs, in each one's own frame on the body: forward toward the head and
    // down toward the belly. As in Chinese art they're short and sturdy next
    // to the long body, held out with the claws spread as if gripping cloud:
    // front legs reach forward, back legs push back.
    function leg(p, front, phase, scale) {
      var dn = -1;
      function at(fx, dy) {
        return [p.x + p.tx * fx + p.nx * dn * dy, p.y + p.ty * fx + p.ny * dn * dy];
      }
      function turn(v, ang) {
        var c = Math.cos(ang);
        var sn = Math.sin(ang);
        return [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c];
      }
      var u = T * scale;
      var swing = 0.08 * Math.sin(age * 1.1 + phase);
      var e = turn(front ? [0.6 * u, 0.75 * u] : [-0.55 * u, 0.75 * u], swing);
      var w2 = turn(front ? [0.55 * u, 0.3 * u] : [-0.55 * u, 0.35 * u], swing * 1.4);
      var root = at(0, 0.2 * u);
      var elbow = at(e[0], e[1]);
      var wrist = at(e[0] + w2[0], e[1] + w2[1]);
      lc.lineWidth = 0.7 * u;
      lc.beginPath();
      lc.moveTo(root[0], root[1]);
      lc.lineTo(elbow[0], elbow[1]);
      lc.stroke();
      lc.lineWidth = 0.5 * u;
      lc.beginPath();
      lc.moveTo(elbow[0], elbow[1]);
      lc.lineTo(wrist[0], wrist[1]);
      lc.stroke();
      // A flame-like tuft of hair at the elbow or knee, streaming back.
      lc.beginPath();
      [[-1.0, -0.15], [-0.85, 0.3]].forEach(function (tip) {
        var tp = at(e[0] + tip[0] * u, e[1] + tip[1] * u);
        var s1 = at(e[0] + 0.15 * u, e[1] - 0.2 * u);
        var s2 = at(e[0] + 0.1 * u, e[1] + 0.25 * u);
        lc.moveTo(s1[0], s1[1]);
        lc.quadraticCurveTo((s1[0] + tp[0]) / 2, (s1[1] + tp[1]) / 2 - 0.2 * u, tp[0], tp[1]);
        lc.lineTo(s2[0], s2[1]);
      });
      lc.fill();
      // Four talons, spread and curling down.
      lc.lineWidth = Math.max(0.9, 0.17 * u);
      lc.beginPath();
      for (var c = 0; c < 4; c++) {
        var spread = (c - 1.5) * 0.55;
        var dir = turn(front ? [0.6 * u, 0.15 * u] : [-0.6 * u, 0.2 * u], spread + swing);
        var mid = at(e[0] + w2[0] + dir[0] * 0.6, e[1] + w2[1] + dir[1] * 0.6);
        var tip2 = at(e[0] + w2[0] + dir[0], e[1] + w2[1] + dir[1] + 0.3 * u);
        lc.moveTo(wrist[0], wrist[1]);
        lc.quadraticCurveTo(mid[0], mid[1], tip2[0], tip2[1]);
      }
      lc.stroke();
    }
    [[0.17, true], [0.62, false]].forEach(function (pair, k) {
      var near = pts[Math.round(pair[0] * n)];
      var far = pts[Math.round(pair[0] * n) + 2];
      leg(far, pair[1], k * 1.7 + 1.6, 0.85);
      leg(near, pair[1], k * 1.7, 1);
    });

    // The tail ends in a fan of flame.
    var e0 = pts[n];
    var fan = T * 2.3;
    lc.beginPath();
    for (var lobe = -2; lobe <= 2; lobe++) {
      var sway = Math.sin(age * 2.6 + lobe * 0.8) * T * 0.25;
      var reach = fan * (1 - Math.abs(lobe) * 0.18);
      var side = lobe * T * 0.5 + sway;
      var tipx = e0.x - e0.tx * reach + e0.nx * side;
      var tipy = e0.y - e0.ty * reach + e0.ny * side;
      lc.moveTo(e0.x + e0.nx * T * 0.2, e0.y + e0.ny * T * 0.2);
      lc.quadraticCurveTo(e0.x - e0.tx * reach * 0.45 + e0.nx * (side + T * 0.35), e0.y - e0.ty * reach * 0.45 + e0.ny * (side + T * 0.35), tipx, tipy);
      lc.quadraticCurveTo(e0.x - e0.tx * reach * 0.4 + e0.nx * (side - T * 0.2), e0.y - e0.ty * reach * 0.4 + e0.ny * (side - T * 0.2), e0.x - e0.nx * T * 0.2, e0.y - e0.ny * T * 0.2);
    }
    lc.fill();

    // The head, in its own frame: facing along the flight, top up. One unit
    // is a tenth of the neck's thickness.
    var hd = pts[0];
    var k = T / 10;
    lc.save();
    lc.translate(hd.x, hd.y);
    lc.rotate(Math.atan2(hd.ty, hd.tx));
    if (g.dir < 0) lc.scale(1, -1);
    lc.scale(k, k);
    // A mane streaming back from the head along the neck.
    lc.beginPath();
    for (var m = 0; m < 6; m++) {
      var fl = Math.sin(age * 3.2 + m * 0.9) * 1.6;
      var x0 = 8 - m * 5;
      lc.moveTo(x0, -5);
      lc.quadraticCurveTo(x0 - 6, -11 - m * 0.3 + fl, x0 - 14, -10 + m * 0.6 + fl);
      lc.quadraticCurveTo(x0 - 7, -6, x0 - 5, -3);
    }
    lc.fill();
    // Skull, brow, upturned nose, open mouth with fangs, and a tufted beard.
    lc.beginPath();
    lc.moveTo(-3, -5);
    lc.quadraticCurveTo(2, -8, 9, -9.5);
    lc.quadraticCurveTo(12, -9.5, 14, -7.5);
    lc.quadraticCurveTo(19, -6.5, 24, -6.5);
    lc.quadraticCurveTo(27, -8.5, 30, -6);
    lc.quadraticCurveTo(31, -4, 29.5, -2.6);
    lc.lineTo(27.5, -1.6);
    lc.lineTo(26.6, 0.4);
    lc.lineTo(25.6, -1.2);
    lc.lineTo(17, -0.4);
    lc.lineTo(24.5, 1.6);
    lc.lineTo(25.4, 0.8);
    lc.lineTo(26.6, 2.4);
    lc.quadraticCurveTo(26, 4.6, 22.5, 5.4);
    lc.lineTo(21, 10.5 + Math.sin(age * 2.5) * 0.8);
    lc.lineTo(18.5, 6.4);
    lc.lineTo(15.5, 11.5 + Math.sin(age * 2.5 + 0.7) * 0.8);
    lc.lineTo(13, 6.6);
    lc.lineTo(9.5, 10 + Math.sin(age * 2.5 + 1.4) * 0.8);
    lc.lineTo(7, 6);
    lc.lineTo(-3, 5);
    lc.closePath();
    lc.fill();
    // Branching horns like a stag's, swept back.
    lc.lineWidth = 1.9;
    lc.beginPath();
    lc.moveTo(7, -8);
    lc.quadraticCurveTo(-2, -15, -15, -19);
    lc.moveTo(-3, -14.5);
    lc.quadraticCurveTo(-3, -19, -6, -23);
    lc.moveTo(-9, -17.5);
    lc.quadraticCurveTo(-10, -21, -13, -24);
    lc.stroke();
    lc.lineWidth = 1.4;
    lc.beginPath();
    lc.moveTo(10, -8.5);
    lc.quadraticCurveTo(3, -13, -6, -14);
    lc.moveTo(0, -13);
    lc.lineTo(-1.5, -17);
    lc.stroke();
    // Two long whiskers growing from the side of the snout by the upper lip,
    // sweeping back and down along the face and streaming out behind under
    // the jaw, waving as it flies.
    var w1 = Math.sin(age * 2) * 2.5;
    var w3 = Math.sin(age * 2 - 1.2) * 3.5;
    lc.lineWidth = 1.1;
    lc.beginPath();
    lc.moveTo(25, -3);
    lc.bezierCurveTo(23, 3 + w1 * 0.2, 18, 8 + w1 * 0.5, 8, 10 + w1);
    lc.quadraticCurveTo(-8, 12 + w3, -20, 10 + w3);
    lc.quadraticCurveTo(-28, 9 + w3, -33, 12 + w3);
    lc.moveTo(26.5, -2);
    lc.bezierCurveTo(26, 6 + w1 * 0.3, 21, 13 + w1 * 0.6, 11, 15 + w1);
    lc.quadraticCurveTo(-4, 18 + w3, -18, 18 + w3);
    lc.quadraticCurveTo(-27, 18 + w3, -32, 21 + w3);
    lc.stroke();
    // The eye, cut out so the sky shows through, and a faint line where the
    // near whisker runs down the side of the face.
    lc.globalCompositeOperation = "destination-out";
    lc.beginPath();
    lc.ellipse(15.5, -5.6, 1.7, 1, -0.15, 0, TAU);
    lc.fill();
    lc.globalAlpha = 0.5;
    lc.lineWidth = 0.8;
    lc.beginPath();
    lc.moveTo(25, -3);
    lc.quadraticCurveTo(23.6, 1.5 + w1 * 0.1, 21.6, 5);
    lc.stroke();
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = "source-over";
    lc.restore();

    // It fades where it passes through mist, and its tail always trails off
    // into haze: the divine dragon shows its head but not its tail.
    lc.save();
    lc.globalCompositeOperation = "destination-out";
    this.drawMist(lc, 0.9);
    // Until the tail is clear of the cloud over the gate, the cloud hides
    // where the body is still gathered.
    if (this.puff) {
      var hide = clamp(g.len / g.speed + 1 - (this.time - this.puff.born), 0, 1);
      var r = 26 * this.falls.u;
      lc.globalAlpha = hide;
      lc.drawImage(this.mistBlob, this.puff.x - r, this.puff.y - r, r * 2, r * 2);
      lc.globalAlpha = 1;
    }
    var fade = lc.createLinearGradient(pts[0].x, pts[0].y, pts[n].x, pts[n].y);
    fade.addColorStop(0, "rgba(0, 0, 0, 0)");
    fade.addColorStop(0.45, "rgba(0, 0, 0, 0.15)");
    fade.addColorStop(1, "rgba(0, 0, 0, 0.85)");
    lc.fillStyle = fade;
    lc.fillRect(0, 0, this.w, this.h);
    lc.restore();

    // Fade the whole silhouette onto the sky, hazy with distance: blue-grey by
    // day, dark at night.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.32 + 0.28 * this.night;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.dragonLayer, 0, 0);
    ctx.restore();
  };

  // The falls: a pale sheet whose edges ripple downward, with soft threads of
  // water that start slow at the lip and speed up as they fall, a bright
  // curl where the water tips over, and spray billowing up at the foot.
  ContactShore.prototype.drawFalls = function (ctx) {
    var F = this.falls;
    var u = F.u;
    var n = this.night;
    var t = this.still ? 0 : this.time;
    var c = mix(DAY.falls, NIGHT.falls, n);
    var top = F.lip - 0.3 * u;
    var bot = F.base;
    var fall = bot - top;
    // Half the sheet's width at depth s (0 at the lip, 1 at the foot): it
    // bulges a little as it leaves the ledge, then spreads as it falls.
    function half(s) {
      return (6 + 0.9 * Math.sin(Math.min(s * 9, Math.PI)) + 2.2 * s) * u;
    }
    function ripple(y, side) {
      return Math.sin(y * 0.19 - t * 7 + side) * 0.45 * u + Math.sin(y * 0.07 - t * 3.1 + side * 2) * 0.35 * u;
    }
    var g = ctx.createLinearGradient(F.x - 9 * u, 0, F.x + 9 * u, 0);
    g.addColorStop(0, css(c, 0));
    g.addColorStop(0.2, css(c, 0.5));
    g.addColorStop(0.5, css(c, 0.9));
    g.addColorStop(0.8, css(c, 0.5));
    g.addColorStop(1, css(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    var steps = 18;
    var k;
    var s;
    var y;
    for (k = 0; k <= steps; k++) {
      s = k / steps;
      y = top + s * fall;
      ctx.lineTo(F.x - half(s) + (k ? ripple(y, 0) : 0), y);
    }
    for (k = steps; k >= 0; k--) {
      s = k / steps;
      y = top + s * fall;
      ctx.lineTo(F.x + half(s) + (k ? ripple(y, 2.1) : 0), y);
    }
    ctx.closePath();
    ctx.fill();

    // The threads: each one fades in below the lip, stretches as it speeds
    // up, and fades into the spray.
    var foam = this.foam;
    var shade = this.shade;
    var light = 0.55 - 0.25 * n;
    this.streaks.forEach(function (st) {
      var p = (st.phase + t * st.rate * 0.42) % 1;
      var d = p * p;
      var y0 = top + d * fall;
      var len = (5 + 22 * p) * st.len * u;
      var x0 = F.x + st.across * (half(d) - 1.6 * u) + Math.sin(y0 * 0.12 - t * 4 + st.sway) * 0.4 * u;
      var a = Math.min(1, p * 6) * Math.min(1, (1 - p) * 4);
      ctx.globalAlpha = a * (st.dark ? 0.5 : light) * (1 - 0.4 * Math.abs(st.across));
      ctx.drawImage(st.dark ? shade : foam, x0 - 0.9 * u, y0 - len / 2, 1.8 * u, len);
    });
    ctx.globalAlpha = 1;

    // The curl of water over the ledge.
    ctx.globalAlpha = 0.6 - 0.3 * n;
    ctx.drawImage(foam, F.x - 7.5 * u, top - 1.2 * u, 15 * u, 4 * u);
    ctx.globalAlpha = 1;
  };

  ContactShore.prototype.drawSpray = function (ctx) {
    var F = this.falls;
    var u = F.u;
    var t = this.still ? 0.4 : this.time;
    var n = this.night;
    var a = 0.45 - 0.22 * n;
    ctx.globalAlpha = a;
    ctx.drawImage(this.mistBlob, F.x - 26 * u, F.base - 8 * u, 52 * u, 14 * u);
    // Puffs of spray that billow up from the foot and thin out.
    for (var k = 0; k < 5; k++) {
      var age = (t * 0.35 + k / 5) % 1;
      var r = (5 + 11 * age) * u;
      var x = F.x + (k - 2) * 3.5 * u + Math.sin(k * 2.3 + age * 3) * 3 * u;
      var y = F.base - 3 * u - age * 13 * u;
      ctx.globalAlpha = a * 0.9 * Math.sin(Math.PI * age);
      ctx.drawImage(this.mistBlob, x - r, y - r * 0.6, r * 2, r * 1.2);
    }
    ctx.fillStyle = "rgba(240, 248, 255, " + (0.85 - 0.4 * n) + ")";
    this.drops.forEach(function (d) {
      ctx.globalAlpha = 1 - d.age / d.life;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 0.8 * u, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  // The koi in mid-leap, seen from the side, its tail flicking.
  ContactShore.prototype.drawKoi = function (ctx) {
    var f = this.leap.fish;
    var koi = this.leap.koi;
    var L = 8 * this.falls.u;
    var flick = Math.sin(this.time * 18) * L * 0.06;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    if (Math.cos(f.ang) < 0) ctx.scale(1, -1);
    ctx.globalAlpha = 0.92 - 0.4 * this.night;
    ctx.fillStyle = koi[0];
    ctx.beginPath();
    ctx.moveTo(-L * 0.26, 0);
    ctx.lineTo(-L * 0.56, -L * 0.17 + flick);
    ctx.quadraticCurveTo(-L * 0.46, flick * 0.5, -L * 0.56, L * 0.17 + flick);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.32, L * 0.12, 0, 0, TAU);
    ctx.fill();
    if (koi[1]) {
      ctx.fillStyle = koi[1];
      ctx.beginPath();
      ctx.ellipse(L * 0.04, -L * 0.03, L * 0.14, L * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  // As the koi clears the gate: a flash of light, then a cloud the dragon
  // swims out of, which drifts apart.
  ContactShore.prototype.drawPuff = function (ctx) {
    var P = this.puff;
    var a = this.time - P.born;
    var u = this.falls.u;
    if (a < 1) {
      ctx.globalAlpha = (1 - a) * (1 - a) * (0.9 - 0.3 * this.night);
      ctx.drawImage(this.sunGlow, P.x - 24 * u, P.y - 24 * u, 48 * u, 48 * u);
    }
    var r = (10 + 22 * (1 - Math.exp(-a * 1.2))) * u;
    var drift = a * 3 * u;
    ctx.globalAlpha = Math.min(1, a / 0.3) * clamp((6 - a) / 3, 0, 1) * (0.42 - 0.2 * this.night);
    ctx.drawImage(this.mistBlob, P.x - r, P.y - r * 0.4, r * 2, r * 0.8);
    ctx.drawImage(this.mistBlob, P.x - r * 1.2 - drift, P.y - r * 0.15, r * 1.2, r * 0.5);
    ctx.drawImage(this.mistBlob, P.x + drift, P.y - r * 0.35, r * 1.1, r * 0.55);
    ctx.globalAlpha = 1;
  };

  // Where the dragonfly sits on button k: on top of the circle, legs touching it.
  ContactShore.prototype.perchAt = function (k) {
    var b = this.buttons[k].getBoundingClientRect();
    var s = this.section.getBoundingClientRect();
    return { x: b.left - s.left + b.width / 2 + 2, y: b.top - s.top - 3.4 };
  };


  ContactShore.prototype.updateDragonfly = function (dt) {
    var d = this.dragonfly;
    if (!d) {
      if (this.night < 0.5 && this.time >= this.nextDragonfly) this.spawnDragonfly();
      return;
    }
    if (d.wait > 0) {
      d.wait -= dt;
      if (d.perched !== null) {
        var seat = this.perchAt(d.perched);
        d.x = seat.x;
        d.y = seat.y;
      }
      if (d.perched === null || d.wait > 0) return;
    }
    if (d.perched !== null) {
      d.perched = null;
      d.stops.shift();
    }
    var target = d.stops[0];
    if (target.perch != null) target = this.perchAt(target.perch);
    var dx = target.x - d.x;
    var dy = target.y - d.y;
    var dist = Math.hypot(dx, dy);
    var step = 260 * dt;
    if (dx) d.face = dx > 0 ? 1 : -1;
    if (dist <= step) {
      d.x = target.x;
      d.y = target.y;
      if (d.stops[0].perch != null) {
        // Landed: it stays on the stop until it takes off again.
        d.perched = d.stops[0].perch;
        d.wait = rand(2.5, 5);
        return;
      }
      d.stops.shift();
      if (!d.stops.length) {
        this.dragonfly = null;
        this.nextDragonfly = this.time + rand(14, 28);
        return;
      }
      d.wait = rand(0.6, 1.5);
    } else {
      d.x += (dx / dist) * step;
      d.y += (dy / dist) * step;
    }
  };

  // A blue dasher seen from the side: big round eyes, a stout thorax, a long
  // segmented abdomen, and four glassy wings with a dark spot near each tip,
  // beating too fast to see clearly.
  ContactShore.prototype.drawDragonfly = function (ctx) {
    var d = this.dragonfly;
    var t = this.time;
    var perched = d.perched !== null;
    var hovering = d.wait > 0 && !perched;
    var x = d.x + (hovering ? Math.sin(t * 5) * 1.2 : 0);
    var y = d.y + (hovering ? Math.sin(t * 7.3) * 1.5 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d.face * 0.85, 0.85);
    ctx.rotate(hovering || perched ? 0 : -0.08);
    ctx.globalAlpha = 1 - this.night;

    function wing(angle, length, alpha) {
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(232, 244, 255, " + alpha + ")";
      ctx.beginPath();
      ctx.ellipse(0, -length / 2, 1.5, length / 2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(40, 48, 58, " + Math.min(0.7, alpha * 2.2) + ")";
      ctx.fillRect(-0.7, -length + 2, 1.4, 1.8);
      ctx.restore();
    }
    // Fore and hind wings beat out of step; faint copies make the blur.
    // Resting, the wings are still, held back and a little raised.
    if (perched) {
      ctx.save();
      ctx.translate(1.2, -2.2);
      wing(-1.2, 15, 0.4);
      ctx.restore();
      ctx.save();
      ctx.translate(-1.4, -2.2);
      wing(-1.4, 14, 0.4);
      ctx.restore();
    } else {
      var beat = Math.sin(t * 48);
      for (var k = -1; k <= 1; k++) {
        var b = beat + k * 0.6;
        var alpha = k === 0 ? 0.42 : 0.16;
        ctx.save();
        ctx.translate(1.2, -2.2);
        wing(-0.35 + 0.5 * b, 15, alpha);
        ctx.restore();
        ctx.save();
        ctx.translate(-1.4, -2.2);
        wing(-0.75 - 0.5 * b, 14, alpha);
        ctx.restore();
      }
    }

    // Abdomen: long and thin, a little curved, darker toward the tip.
    var abd = ctx.createLinearGradient(-3, 0, -27, 0);
    abd.addColorStop(0, "#5aa9cc");
    abd.addColorStop(0.75, "#3f8bb0");
    abd.addColorStop(1, "#1b3b4c");
    ctx.fillStyle = abd;
    ctx.beginPath();
    ctx.moveTo(-2.5, -1.3);
    ctx.quadraticCurveTo(-15, -1.2, -27, 0.9);
    ctx.lineTo(-27, 2.0);
    ctx.quadraticCurveTo(-15, 1.6, -2.5, 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 35, 48, 0.35)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (var seg = -6; seg > -26; seg -= 2.6) {
      var off = (seg + 2.5) * (seg + 2.5) * 0.0016;
      ctx.moveTo(seg, -1.2 + off);
      ctx.lineTo(seg, 1.4 + off);
    }
    ctx.stroke();

    // Legs tucked under the thorax.
    ctx.strokeStyle = "rgba(20, 30, 36, 0.8)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (var l = 0; l < 3; l++) {
      ctx.moveTo(-1 + l * 1.4, 2);
      ctx.lineTo(-2 + l * 1.6, 4.4);
    }
    ctx.stroke();

    // Thorax, then the head with its big eyes.
    var tho = ctx.createLinearGradient(0, -3, 0, 3);
    tho.addColorStop(0, "#4f9a8a");
    tho.addColorStop(1, "#24524b");
    ctx.fillStyle = tho;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 3, -0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2d7f95";
    ctx.beginPath();
    ctx.arc(4.6, -0.6, 2.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(5.3, -1.6, 0.8, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  ContactShore.prototype.update = function (dt) {
    var w = this.w;
    var h = this.h;
    var target = isNight() ? 1 : 0;
    this.night += clamp(target - this.night, -dt * 2, dt * 2);
    this.fireflies.forEach(function (f) {
      f.vx = clamp(f.vx + rand(-12, 12) * dt, -12, 12);
      f.vy = clamp(f.vy + rand(-10, 10) * dt, -8, 8);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 0 || f.x > w) f.vx = -f.vx;
      if (f.y < h * 0.2 || f.y > h * 0.97) f.vy = -f.vy;
      f.x = clamp(f.x, 0, w);
      f.y = clamp(f.y, h * 0.2, h * 0.97);
    });
    this.motes.forEach(function (m) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -10) {
        m.y = h + 10;
        m.x = rand(0, w);
      }
      if (m.x < -10) m.x = w + 10;
      if (m.x > w + 10) m.x = -10;
    });
    this.wisps.forEach(function (m) {
      m.x += m.speed * dt;
      if (m.x - m.len / 2 > w) m.x = -m.len / 2;
    });
    this.seas.forEach(function (sea) {
      sea.banks.forEach(function (b) {
        b.x += sea.speed * dt;
        if (b.x - b.len / 2 > w) b.x -= sea.span + b.len;
      });
    });
    this.updateDragonfly(dt);
    this.updateLeap();
    this.updateDrops(dt);
    this.updateDragon();
  };

  ContactShore.prototype.draw = function () {
    var ctx = this.ctx;
    var n = this.night;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (n > 0) {
      this.drawStars(ctx);
      this.drawDipper(ctx);
    }
    if (this.dragon) this.drawDragon(ctx);
    this.drawMist(ctx, 0.13 - 0.07 * n);
    this.drawLayer(ctx, 0);
    this.drawFalls(ctx);
    if (this.leap && this.leap.fish) this.drawKoi(ctx);
    this.drawSpray(ctx);
    if (this.puff) this.drawPuff(ctx);
    this.drawSea(ctx, this.seas[0]);
    this.drawLayer(ctx, 1);
    this.drawSea(ctx, this.seas[1]);
    this.drawLayer(ctx, 2);
    if (n < 1) this.drawMotes(ctx);
    if (n > 0) this.drawFireflies(ctx);

    var fctx = this.fctx;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, this.front.width, this.front.height);
    if (this.dragonfly) {
      fctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawDragonfly(fctx);
    }
  };

  ContactShore.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.running) return;
    // At most 60 frames a second, and 30 while the page is scrolling, to
    // leave the GPU free to scroll.
    var gap = (now - this.scrolledAt < 200 ? 1000 / 30 : 1000 / 60) - 4;
    if (this.last && now - this.last < gap) {
      this.raf = requestAnimationFrame(this._frame);
      return;
    }
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this._frame);
  };

  // Animate only while the section is on screen and the tab is showing.
  ContactShore.prototype.refresh = function () {
    var run = this.visible && !document.hidden && !this.still;
    if (run === this.running) return;
    this.running = run;
    if (run) {
      this.last = 0;
      this.raf = requestAnimationFrame(this._frame);
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  ContactShore.prototype.start = function () {
    var self = this;
    var section = this.section;
    this.resize();
    this.draw();
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.resize(); }).observe(section);
    } else {
      window.addEventListener("resize", function () { self.resize(); });
    }
    window.addEventListener("load", function () { self.resize(); });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        self.visible = entries[entries.length - 1].isIntersecting;
        self.refresh();
      }).observe(section);
    } else {
      this.visible = true;
    }
    document.addEventListener("visibilitychange", function () { self.refresh(); });
    window.addEventListener("scroll", function () { self.scrolledAt = window.performance.now(); }, { passive: true });
    // A still page redraws when the theme changes.
    new MutationObserver(function () {
      if (self.running) return;
      self.night = isNight() ? 1 : 0;
      self.draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.refresh();
  };

  var section = document.getElementById("contact");
  var canvas = document.getElementById("contact-shore");
  var front = document.getElementById("contact-shore-front");
  if (!section || !canvas || !front || !canvas.getContext) return;
  new ContactShore(section, canvas, front).start();
})();
