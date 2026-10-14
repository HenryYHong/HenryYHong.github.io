(function () {
  "use strict";

  var TAU = Math.PI * 2;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  var KOI_PALETTES = [
    {
      id: "kohaku",
      bodyStops: ["#ded8cc", "#fff9ee", "#f4eadb", "#d0c5b5"],
      scaleColor: "rgba(126, 114, 98, 0.075)",
      dorsalColor: "rgba(230, 224, 214, 0.7)",
      finStops: [
        "rgba(248, 244, 235, 0.86)",
        "rgba(224, 216, 204, 0.68)",
        "rgba(188, 176, 160, 0.42)",
      ],
      patchRange: [1, 3],
      patchColors: [
        { fill: "#d63f28", shade: "rgba(150, 36, 22, 0.18)" },
        { fill: "#e15c2c", shade: "rgba(154, 54, 22, 0.16)" },
        { fill: "#ef7a2d", shade: "rgba(160, 70, 20, 0.16)" },
      ],
    },
    {
      id: "kohaku-deep",
      colorGroup: "kohaku",
      bodyStops: ["#ddd8cf", "#fffaf0", "#f2eadf", "#cbc1b3"],
      scaleColor: "rgba(120, 112, 102, 0.075)",
      dorsalColor: "rgba(228, 224, 216, 0.7)",
      finStops: [
        "rgba(246, 243, 236, 0.86)",
        "rgba(222, 216, 206, 0.68)",
        "rgba(186, 178, 166, 0.42)",
      ],
      patchRange: [2, 3],
      patchColors: [
        { fill: "#d33b29", shade: "rgba(148, 32, 20, 0.18)" },
        { fill: "#e1532b", shade: "rgba(150, 46, 20, 0.16)" },
        { fill: "#ee762e", shade: "rgba(156, 66, 20, 0.16)" },
      ],
    },
    {
      id: "yamabuki",
      bodyStops: ["#d7ac43", "#ffe8a1", "#e0a534", "#a96f1b"],
      scaleColor: "rgba(92, 58, 20, 0.09)",
      dorsalColor: "rgba(235, 182, 68, 0.66)",
      finStops: [
        "rgba(255, 224, 134, 0.82)",
        "rgba(230, 170, 72, 0.62)",
        "rgba(170, 106, 34, 0.34)",
      ],
      patchRange: [0, 0],
      patchColors: [],
    },
    {
      id: "orange",
      bodyStops: ["#bd612b", "#e88a3b", "#c86c2d", "#88421f"],
      scaleColor: "rgba(70, 34, 14, 0.08)",
      dorsalColor: "rgba(184, 82, 32, 0.58)",
      finStops: [
        "rgba(218, 118, 48, 0.66)",
        "rgba(166, 72, 28, 0.48)",
        "rgba(100, 42, 20, 0.28)",
      ],
      patchRange: [0, 0],
      patchColors: [],
    },
    {
      id: "platinum",
      bodyStops: ["#ddd8cf", "#fffaf2", "#f2eadf", "#cfc5b7"],
      scaleColor: "rgba(120, 112, 102, 0.065)",
      dorsalColor: "rgba(232, 226, 216, 0.66)",
      finStops: [
        "rgba(246, 242, 234, 0.82)",
        "rgba(220, 212, 200, 0.6)",
        "rgba(184, 174, 160, 0.34)",
      ],
      patchRange: [0, 0],
      patchColors: [],
    },
    {
      id: "kin",
      bodyStops: ["#c8891f", "#ffd36a", "#d99a28", "#965f16"],
      scaleColor: "rgba(78, 45, 12, 0.085)",
      dorsalColor: "rgba(218, 146, 36, 0.62)",
      finStops: [
        "rgba(252, 207, 98, 0.78)",
        "rgba(216, 139, 42, 0.56)",
        "rgba(148, 82, 22, 0.32)",
      ],
      patchRange: [0, 0],
      patchColors: [],
    },
  ];

  var MAX_FISH_PER_PALETTE = 3;
  // 60 Hz reference (iPad Air and most desktops); movement is delta-time scaled.
  var REF_FPS = 60;
  var SPEED_MIN = 0.25 * REF_FPS;
  var SPEED_MAX = 0.45 * REF_FPS;
  var MAX_FRAME_DT = 0.05;

  function getColorGroup(palette) {
    return palette.colorGroup || palette.id;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function rgba(c, alpha) {
    return (
      "rgba(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ", " +
      (alpha == null ? c[3] : alpha) + ")"
    );
  }

  // Sunlight comes from the upper left of the screen, matching the water's shadows.
  var LIGHT_X = -0.6;
  var LIGHT_Y = -0.8;

  function KoiPond(canvas) {
    this.canvas = canvas;
    this.ctx = null;
    this.water = null;
    this.layer = null;
    this.padLayer = null;
    this.padCtx = null;
    this.foodLayer = null;
    this.foodCtx = null;
    this.foodShown = false;
    this.foodDirty = false;
    this.top = 0;
    this.fishes = [];
    this.foodPellets = [];
    this.lilyPads = [];
    this.ripples = [];
    this.rafId = null;
    this.running = false;
    this.time = 0;
    this.w = 0;
    this.h = 0;
    this.resizeObserver = null;
    this._lastFeedDropAt = 0;
    this._lastFeedX = -9999;
    this._lastFeedY = -9999;
    this._boundFrame = this.frame.bind(this);
    this._boundFeedClick = this.handleFeedClick.bind(this);
    this._lastFrameTs = 0;
    this.dt = 1 / REF_FPS;
    this.visible = true;
  }

  // WebGL water when the browser has it; the original flat 2D pond otherwise.
  // With water on, fish and pads are drawn into offscreen canvases that the
  // shader composites, so this.ctx is the fish layer rather than the page canvas.
  KoiPond.prototype.setupRenderer = function () {
    if (window.KoiWater) {
      this.water = window.KoiWater.create(this.canvas);
    }
    if (this.water) {
      this.layer = document.createElement("canvas");
      this.padLayer = document.createElement("canvas");
      this.ctx = this.layer.getContext("2d");
      this.padCtx = this.padLayer.getContext("2d");
      this.foodLayer = document.createElement("canvas");
      this.foodCtx = this.foodLayer.getContext("2d");
      var self = this;
      this.water.onRestore = function () {
        self.paintPads();
      };
      return;
    }
    // Pads don't move, so the flat pond paints them once and copies them each frame.
    this.padLayer = document.createElement("canvas");
    this.padCtx = this.padLayer.getContext("2d");
    var ctx = this.canvas.getContext("2d");
    if (!ctx && this.canvas.parentNode) {
      // WebGL started but failed to compile; a canvas keeps its first context, so swap it.
      var fresh = this.canvas.cloneNode(false);
      this.canvas.parentNode.replaceChild(fresh, this.canvas);
      this.canvas = fresh;
      ctx = fresh.getContext("2d");
    }
    this.ctx = ctx;
  };

  KoiPond.prototype.getBodyWidth = function (t) {
    var peakT = 0.20;
    var neckW = 1.14 * 0.95;

    if (t <= peakT) {
      var ht = t / peakT;
      return neckW * (0.58 + 0.42 * Math.pow(ht, 0.9));
    }

    var cone = (t - peakT) / (1 - peakT);
    return neckW * Math.max(0.025, 1 - cone);
  };

  KoiPond.prototype.traceIceCreamBody = function (ctx, left, right, cx0, cy0, headAng, hw, n) {
    var i;

    ctx.moveTo(left[0].x, left[0].y);
    for (i = 1; i < n - 1; i++) {
      ctx.quadraticCurveTo(
        left[i].x,
        left[i].y,
        (left[i].x + left[i + 1].x) * 0.5,
        (left[i].y + left[i + 1].y) * 0.5
      );
    }
    ctx.quadraticCurveTo(left[n - 1].x, left[n - 1].y, right[n - 1].x, right[n - 1].y);
    for (i = n - 1; i > 0; i--) {
      ctx.quadraticCurveTo(
        right[i].x,
        right[i].y,
        (right[i].x + right[i - 1].x) * 0.5,
        (right[i].y + right[i - 1].y) * 0.5
      );
    }
    ctx.lineTo(right[0].x, right[0].y);
    var noseTipX = cx0 + Math.cos(headAng) * hw * 0.38;
    var noseTipY = cy0 + Math.sin(headAng) * hw * 0.38;
    ctx.quadraticCurveTo(noseTipX, noseTipY, left[0].x, left[0].y);
    ctx.closePath();
  };

  KoiPond.prototype.drawBodyScales = function (ctx, cx, cy, nx, ny, widths, n, hw, scaleColor) {
    ctx.fillStyle = scaleColor || "rgba(150, 145, 140, 0.07)";
    for (var i = 2; i < n - 4; i++) {
      if (i % 2 !== 0) continue;
      var cols = Math.max(2, Math.floor(widths[i] / 2.8));
      for (var c = 0; c < cols; c++) {
        var lateral = ((c + 0.5) / cols - 0.5) * 1.5;
        var sx = cx[i] + nx[i] * widths[i] * lateral;
        var sy = cy[i] + ny[i] * widths[i] * lateral;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.9 + hw * 0.018, 0, TAU);
        ctx.fill();
      }
    }
  };

  KoiPond.prototype.resize = function () {
    var parent = this.canvas.parentElement;
    if (!parent) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = parent.clientWidth || parent.offsetWidth || window.innerWidth;
    var h = parent.clientHeight || parent.offsetHeight || 320;

    if (w <= 0) w = window.innerWidth;
    if (h <= 0) h = 320;

    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.w = w;
    this.h = h;
    this.dpr = dpr;

    // The fixed nav covers the top of the masthead; keep the pond's life below it.
    var padTop = parseFloat(window.getComputedStyle(parent).paddingTop) || 0;
    this.top = Math.min(padTop, h * 0.5);

    if (this.lilyPads.length === 0) {
      this.seedLilyPads();
    } else {
      this.repositionLilyPads();
    }

    if (this.water) {
      this.water.resize(w, h, dpr, this.top);
      this.layer.width = this.canvas.width;
      this.layer.height = this.canvas.height;
      this.padLayer.width = this.canvas.width;
      this.padLayer.height = this.canvas.height;
      this.foodLayer.width = this.canvas.width;
      this.foodLayer.height = this.canvas.height;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.padCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.foodCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.foodShown = true;
      this.water.buildMask(this.lilyPads);
      this.paintPads();
    } else {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.padCtx) {
        this.padLayer.width = this.canvas.width;
        this.padLayer.height = this.canvas.height;
        this.padCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.paintPads();
      }
    }
  };

  KoiPond.prototype.paintPads = function () {
    var ctx = this.padCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    this.lilyPads.forEach(function (pad) {
      this.drawLilyPad(pad, ctx);
    }, this);
    if (this.water) this.water.setPads(this.padLayer);
  };

  // y is measured within the water below the nav, not the whole masthead.
  // Young leaves come up against an older one: `parent` and `at` (an angle) place them.
  // lotusSide is the direction from the pad to its flower.
  var PAD_SPOTS = [
    { x: 0.07, y: 0.72, scale: 0.95, lotus: true, lotusColor: "pink", lotusSide: -Math.PI * 0.42 },
    { x: 0.2, y: 0.14, scale: 1.05, flipped: true },
    { x: 0.84, y: 0.16, scale: 0.9, lotus: true, lotusColor: "white", lotusSide: Math.PI * 0.92 },
    { x: 0.92, y: 0.72, scale: 1.0, flipped: true },
    { x: 0.1, y: 0.36, scale: 0.72, flipped: true },
    { x: 0.9, y: 0.44, scale: 0.78, lotus: true, lotusColor: "pink", lotusSide: Math.PI * 0.08 },
    { x: 0.58, y: 0.86, scale: 0.68, flipped: true },
    { x: 0.35, y: 0.1, scale: 0.62, lotus: true, lotusColor: "white", lotusSide: -Math.PI * 0.18 },
    { parent: 0, at: Math.PI * 0.3, scale: 0.42, kind: "young" },
    { parent: 1, at: Math.PI * 0.2, scale: 0.44, kind: "young" },
    { parent: 3, at: -Math.PI * 0.7, scale: 0.46, kind: "young" },
    { parent: 2, at: -Math.PI * 0.15, scale: 0.4, kind: "young" },
  ];

  KoiPond.prototype.placePad = function (pad, spot) {
    // Seen from straight above, pads are close to round. Phones get smaller pads
    // so they don't crowd the water. Sizes go in steps so dragging the window
    // narrower doesn't redraw the pad textures on every pixel.
    var fit = Math.round(Math.max(0.7, Math.min(1, this.w / 900)) * 20) / 20;
    var size = spot.scale * fit;
    pad.rx = 28 * size;
    pad.ry = 26.5 * size;
    var parent = spot.parent != null ? this.lilyPads[spot.parent] : null;
    if (parent) {
      var reach = (parent.rx + pad.rx) * 0.92;
      pad.x = parent.x + Math.cos(spot.at) * reach;
      pad.y = parent.y + Math.sin(spot.at) * reach;
    } else {
      pad.x = spot.x * this.w;
      pad.y = this.top + spot.y * (this.h - this.top);
    }
    this.updateLotusOffset(pad);
  };

  KoiPond.prototype.seedLilyPads = function () {
    this.lilyPads = [];
    PAD_SPOTS.forEach(function (s) {
      var kind = s.kind || "mature";
      var pad = {
        rot: rand(0, TAU),
        flipped: !!s.flipped,
        hasLotus: !!s.lotus,
        lotusColor: s.lotusColor || "pink",
        lotusSide: s.lotusSide != null ? s.lotusSide : rand(-Math.PI * 0.85, -Math.PI * 0.15),
        phase: rand(0, TAU),
        kind: kind,
        seed: randInt(1, 1000000),
        notch: rand(0.025, 0.06),
        wobA: rand(0.012, 0.03),
        wobB: rand(0.006, 0.016),
        wobP: rand(0, TAU),
        veins: randInt(18, 24),
        redRim: kind === "young" ? 0.5 : rand(0.15, 0.5),
        drops: [],
      };
      var k;
      var ang;
      var dist;
      // Beads of water stay clear of the slit, which runs along angle 0.
      if (kind !== "young") {
        for (k = randInt(0, 3); k > 0; k--) {
          ang = rand(0.6, TAU - 0.6);
          dist = rand(0.2, 0.75);
          pad.drops.push({ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, r: rand(0.7, 1.4) });
        }
      }
      if (pad.hasLotus) pad.bloom = makeBloom();
      this.lilyPads.push(pad);
      this.placePad(pad, s);
    }, this);
  };

  KoiPond.prototype.updateLotusOffset = function (pad) {
    if (!pad.hasLotus) return;
    pad.lotusOffsetX = Math.cos(pad.lotusSide) * pad.rx * 1.12;
    pad.lotusOffsetY = Math.sin(pad.lotusSide) * pad.ry * 1.12;
  };

  KoiPond.prototype.repositionLilyPads = function () {
    this.lilyPads.forEach(function (pad, i) {
      if (PAD_SPOTS[i]) this.placePad(pad, PAD_SPOTS[i]);
    }, this);
  };

  KoiPond.prototype.createKoiPalette = function (paletteCounts) {
    paletteCounts = paletteCounts || this.paletteCounts || {};

    var eligible = KOI_PALETTES.filter(function (palette) {
      return (paletteCounts[getColorGroup(palette)] || 0) < MAX_FISH_PER_PALETTE;
    });

    if (!eligible.length) {
      var minCount = Infinity;
      KOI_PALETTES.forEach(function (palette) {
        var used = paletteCounts[getColorGroup(palette)] || 0;
        if (used < minCount) minCount = used;
      });
      eligible = KOI_PALETTES.filter(function (palette) {
        return (paletteCounts[getColorGroup(palette)] || 0) === minCount;
      });
    }

    return pick(eligible);
  };

  KoiPond.prototype.createKoiPatches = function (palette) {
    if (!palette.patchColors.length || palette.patchRange[1] === 0) {
      return [];
    }

    var slots = [
      {
        t: rand(0.04, 0.12),
        offset: rand(-0.03, 0.03),
        rx: rand(0.5, 0.72),
        ry: rand(0.34, 0.52),
        rot: rand(-0.12, 0.12),
      },
      {
        t: rand(0.22, 0.36),
        offset: rand(-0.04, 0.04),
        rx: rand(0.64, 0.9),
        ry: rand(0.36, 0.56),
        rot: rand(-0.18, 0.18),
      },
      {
        t: rand(0.46, 0.64),
        offset: rand(-0.04, 0.05),
        rx: rand(0.52, 0.78),
        ry: rand(0.3, 0.48),
        rot: rand(-0.16, 0.18),
      },
      {
        t: rand(0.68, 0.78),
        offset: rand(-0.03, 0.04),
        rx: rand(0.34, 0.5),
        ry: rand(0.22, 0.34),
        rot: rand(-0.18, 0.2),
      },
    ];
    var count = randInt(palette.patchRange[0], palette.patchRange[1]);

    return slots.slice(0, count).map(function (slot, i) {
      var color = pick(palette.patchColors);
      var points = [];
      var pointCount = randInt(9, 13);
      var phase = rand(0, TAU);

      for (var p = 0; p < pointCount; p++) {
        var a = phase + (TAU * p) / pointCount;
        var ripple = 1 + Math.sin(a * 2 + phase) * rand(0.04, 0.1);
        var radius = rand(0.78, 1.16) * ripple;
        points.push({
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius,
        });
      }

      return {
        t: slot.t,
        offset: slot.offset,
        rx: slot.rx,
        ry: slot.ry,
        rot: slot.rot,
        color: color,
        deep: i === 0,
        points: points,
      };
    });
  };

  KoiPond.prototype.createFish = function (preset) {
    var scale = rand(0.85, 1.08);
    var segCount = 24;
    var segLen = 5.1 * scale;
    var heading = preset.angle;
    var segments = [];
    var palette = preset.palette || this.createKoiPalette();

    for (var i = 0; i < segCount; i++) {
      segments.push({
        x: preset.x - Math.cos(heading) * segLen * i,
        y: preset.y - Math.sin(heading) * segLen * i,
      });
    }

    return {
      x: preset.x,
      y: preset.y,
      heading: heading,
      segments: segments,
      segLen: segLen,
      headWidth: 14.5 * scale,
      speed: rand(SPEED_MIN, SPEED_MAX),
      scale: scale,
      phase: rand(0, TAU),
      swimPhase: rand(0, TAU),
      wanderT: rand(0, TAU),
      wanderSpeed: rand(0.004, 0.008),
      turnTarget: heading,
      nextTurnAt: rand(1200, 3600),
      depth: rand(0, 1),
      palette: palette,
      patches: this.createKoiPatches(palette),
    };
  };

  KoiPond.prototype.seedFish = function () {
    this.fishes = [];
    var count = Math.max(4, Math.min(5, Math.floor(this.w / 220)));
    var inset = Math.min(90, (this.h - this.top) * 0.3);
    this.paletteCounts = {};

    for (var i = 0; i < count; i++) {
      var palette = this.createKoiPalette(this.paletteCounts);
      var group = getColorGroup(palette);
      this.paletteCounts[group] = (this.paletteCounts[group] || 0) + 1;

      this.fishes.push(
        this.createFish({
          x: rand(inset, this.w - inset),
          y: rand(this.top + inset, this.h - inset),
          angle: rand(0, TAU),
          palette: palette,
        })
      );
    }
  };

  KoiPond.prototype.handleFeedClick = function (event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest("a, button, input, textarea, select")) {
      return;
    }

    var rect = this.canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    var now = window.performance && window.performance.now ? window.performance.now() : Date.now();
    var repeatDx = x - this._lastFeedX;
    var repeatDy = y - this._lastFeedY;
    if (now - this._lastFeedDropAt < 350 && repeatDx * repeatDx + repeatDy * repeatDy < 64) {
      return;
    }

    this._lastFeedDropAt = now;
    this._lastFeedX = x;
    this._lastFeedY = y;
    this.dropFood(x, y);
    if (event.cancelable) event.preventDefault();
  };

  KoiPond.prototype.dropFood = function (x, y) {
    var count = randInt(7, 10);
    var now = this.time || (window.performance && window.performance.now ? window.performance.now() : Date.now());

    for (var i = 0; i < count; i++) {
      this.foodPellets.push({
        x: x + rand(-12, 12),
        y: y + rand(-8, 8),
        r: rand(2.0, 3.3),
        age: 0,
        life: rand(12000, 18000),
        createdAt: now,
        phase: rand(0, TAU),
      });
    }

    while (this.foodPellets.length > 32) {
      this.foodPellets.shift();
    }

    if (this.water) {
      // Pellets barely break the surface: a few small rings, landing a beat apart.
      for (var s = this.foodPellets.length - count; s < this.foodPellets.length; s += 2) {
        var landed = this.foodPellets[s];
        this.water.drop(landed.x, landed.y, rand(2, 3), rand(0, 0.15));
      }
      return;
    }

    this.ripples.push({
      x: x,
      y: y,
      r: 1,
      maxR: rand(16, 28),
      alpha: 0.22,
    });
  };

  KoiPond.prototype.updateFood = function () {
    var now = this.time || 0;

    this.foodPellets = this.foodPellets.filter(function (pellet) {
      pellet.age = Math.max(0, now - pellet.createdAt);
      return pellet.age < pellet.life;
    });
  };

  KoiPond.prototype.drawFood = function () {
    var ctx = this.ctx;
    var now = this.time || 0;

    // With the water on, food floats on the surface over the moon and clouds
    // reflected in it, so it gets its own layer. That layer is only redrawn and
    // sent to the shader while there is food, plus once more to clear it.
    this.foodDirty = false;
    if (this.foodCtx) {
      if (!this.foodPellets.length && !this.foodShown) return;
      ctx = this.foodCtx;
      ctx.clearRect(0, 0, this.w, this.h);
      this.foodShown = this.foodPellets.length > 0;
      this.foodDirty = true;
    }

    ctx.save();
    this.foodPellets.forEach(function (pellet) {
      var fade = Math.max(0, Math.min(1, 1 - pellet.age / pellet.life));
      var bob = Math.sin(now * 0.004 + pellet.phase) * 0.35;
      var x = pellet.x;
      var y = pellet.y + bob;
      var r = pellet.r;

      // Floating pellets: small lit spheres with a bright ring of water around them.
      ctx.globalAlpha = 0.25 + fade * 0.25;
      ctx.strokeStyle = "rgba(214, 244, 238, 0.7)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r + 0.7, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = 0.6 + fade * 0.4;
      var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      // Golden-orange, like color-enhancing koi pellets.
      g.addColorStop(0, "#ffe39a");
      g.addColorStop(0.5, "#f8a93f");
      g.addColorStop(1, "#e07a2c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 246, 222, 0.75)";
      ctx.beginPath();
      ctx.arc(x - r * 0.38, y - r * 0.42, r * 0.26, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  };

  KoiPond.prototype.init = function (callback) {
    this.setupRenderer();
    if (!this.ctx) return;
    this.resize();
    this.seedFish();

    if (this.canvas.parentElement) {
      this.canvas.parentElement.addEventListener("pointerdown", this._boundFeedClick);
      this.canvas.parentElement.addEventListener("click", this._boundFeedClick);
    }

    if (window.ResizeObserver) {
      var self = this;
      this.resizeObserver = new ResizeObserver(function () {
        self.resize();
      });
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    this._onResize = this.resize.bind(this);
    window.addEventListener("resize", this._onResize);

    // Follow the site's light and dark themes.
    var pond = this;
    if (this.water) this.water.setNight(this.isNight(), true);
    if (window.MutationObserver) {
      this.themeObserver = new MutationObserver(function () {
        // Fade while it's on screen; a paused pond just switches.
        if (pond.water) pond.water.setNight(pond.isNight(), !pond.running);
      });
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    // No point animating a pond nobody can see.
    if (window.IntersectionObserver) {
      this.visibilityObserver = new IntersectionObserver(function (entries) {
        var seen = entries[entries.length - 1].isIntersecting;
        if (seen === pond.visible) return;
        pond.visible = seen;
        if (seen && pond.wantsRunning) pond.start();
        else if (!seen) pond.pause();
      });
      this.visibilityObserver.observe(this.canvas.parentElement);
    }

    if (callback) callback();
  };

  KoiPond.prototype.isNight = function () {
    return document.documentElement.getAttribute("data-theme") === "dark";
  };

  KoiPond.prototype.paintInitialFrame = function () {
    var now =
      window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
    this.time = now;
    if (this.water) {
      this.water.render(now / 1000, this.layer);
    } else {
      this.drawWater();
    }
  };

  function lerpAngle(a, b, t) {
    return a + angleDelta(a, b) * t;
  }

  function angleDelta(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }

  function clampTurnFrom(a, b, maxTurn) {
    var diff = angleDelta(a, b);
    return a + Math.max(-maxTurn, Math.min(maxTurn, diff));
  }

  KoiPond.prototype.steerFish = function (fish) {
    var dt = this.dt || 1 / REF_FPS;
    var frameScale = dt * REF_FPS;
    var maxTurn = Math.PI * (30 / 180);
    fish.wanderT += fish.wanderSpeed * frameScale;
    var gentleTurn =
      Math.sin(fish.wanderT) * 0.008 +
      Math.sin(fish.wanderT * 1.5 + 0.8) * 0.004;

    if (this.time >= fish.nextTurnAt) {
      fish.turnTarget = fish.heading + rand(-maxTurn, maxTurn);
      fish.nextTurnAt = this.time + rand(1800, 5200);
    }

    var offscreenLimit = Math.max(44, fish.headWidth * 3.2);
    var edgeBuffer = Math.max(32, fish.headWidth * 2.4);
    var headingX = Math.cos(fish.heading);
    var headingY = Math.sin(fish.heading);
    var avoidX = 0;
    var avoidY = 0;
    var avoidWeight = 0;
    var edgeT;

    if (fish.x < edgeBuffer && headingX < 0) {
      edgeT = (edgeBuffer - fish.x) / edgeBuffer;
      avoidX += edgeT;
      avoidY += headingY * edgeT * 0.65;
      avoidWeight = Math.max(avoidWeight, edgeT);
    } else if (fish.x > this.w - edgeBuffer && headingX > 0) {
      edgeT = (fish.x - (this.w - edgeBuffer)) / edgeBuffer;
      avoidX -= edgeT;
      avoidY += headingY * edgeT * 0.65;
      avoidWeight = Math.max(avoidWeight, edgeT);
    }

    var topEdge = this.top + edgeBuffer;
    if (fish.y < topEdge && headingY < 0) {
      edgeT = Math.min(1.5, (topEdge - fish.y) / edgeBuffer);
      avoidY += edgeT;
      avoidX += (headingX * 0.7 + Math.cos(fish.wanderT) * 0.35) * edgeT;
      avoidWeight = Math.max(avoidWeight, edgeT);
    } else if (fish.y > this.h - edgeBuffer && headingY > 0) {
      edgeT = (fish.y - (this.h - edgeBuffer)) / edgeBuffer;
      avoidY -= edgeT;
      avoidX += (headingX * 0.75 + Math.cos(fish.wanderT + 0.6) * 0.35) * edgeT;
      avoidWeight = Math.max(avoidWeight, edgeT);
    }

    var foodTarget = null;
    var foodTargetIndex = -1;
    var foodDistSq = Infinity;
    var foodAttractRadius = Math.max(180, fish.headWidth * 13);

    for (var f = 0; f < this.foodPellets.length; f++) {
      var pellet = this.foodPellets[f];
      var foodDx = pellet.x - fish.x;
      var foodDy = pellet.y - fish.y;
      var distSq = foodDx * foodDx + foodDy * foodDy;
      var forwardDot = headingX * foodDx + headingY * foodDy;

      if (
        forwardDot > 0 &&
        distSq < foodDistSq &&
        distSq < foodAttractRadius * foodAttractRadius
      ) {
        foodDistSq = distSq;
        foodTarget = pellet;
        foodTargetIndex = f;
      }
    }

    var target = fish.turnTarget + gentleTurn;
    var turnEase = 0.018;
    var offscreen =
      fish.x < -offscreenLimit ||
      fish.x > this.w + offscreenLimit ||
      fish.y < -offscreenLimit ||
      fish.y > this.h + offscreenLimit;

    if (offscreen) {
      target = Math.atan2((this.top + this.h) * 0.5 - fish.y, this.w * 0.5 - fish.x);
      fish.turnTarget = target;
      fish.nextTurnAt = this.time + rand(1400, 2800);
      turnEase = 0.04;
    } else if (avoidWeight > 0) {
      var avoidAngle = Math.atan2(avoidY, avoidX);
      var blend = Math.min(0.48, 0.18 + avoidWeight * 0.38);
      target = lerpAngle(target, avoidAngle, blend);
      turnEase = Math.max(turnEase, 0.022 + avoidWeight * 0.018);
    } else if (foodTarget) {
      target = Math.atan2(foodTarget.y - fish.y, foodTarget.x - fish.x);
      fish.turnTarget = target;
      fish.nextTurnAt = this.time + rand(700, 1600);
      turnEase = 0.052;
    }

    target = clampTurnFrom(fish.heading, target, maxTurn * frameScale);
    fish.heading = lerpAngle(
      fish.heading,
      target,
      Math.min(1, turnEase * frameScale)
    );
    fish.x += Math.cos(fish.heading) * fish.speed * dt;
    fish.y += Math.sin(fish.heading) * fish.speed * dt;
    fish.swimPhase += fish.speed * 0.08 * dt;

    if (foodTarget && foodDistSq < Math.pow(Math.max(8, fish.headWidth * 0.9), 2)) {
      this.foodPellets.splice(foodTargetIndex, 1);
      if (this.water) {
        this.water.drop(foodTarget.x, foodTarget.y, 2);
      } else {
        this.ripples.push({
          x: foodTarget.x,
          y: foodTarget.y,
          r: 1,
          maxR: rand(7, 13),
          alpha: 0.16,
        });
      }
    }

    // Fish near the surface (depth toward 1) push a faint bow wave ahead of them.
    if (this.water && fish.depth > 0.3) {
      this.water.disturb(
        fish.x + Math.cos(fish.heading) * fish.headWidth * 0.3,
        fish.y + Math.sin(fish.heading) * fish.headWidth * 0.3,
        fish.headWidth * 0.55,
        0.02 * fish.depth * frameScale
      );
    }

    fish.segments[0].x = fish.x;
    fish.segments[0].y = fish.y;

    var segs = fish.segments;
    var len = fish.segLen;
    for (var i = 1; i < segs.length; i++) {
      var prev = segs[i - 1];
      var curr = segs[i];
      var sdx = prev.x - curr.x;
      var sdy = prev.y - curr.y;
      var d = Math.sqrt(sdx * sdx + sdy * sdy) || 0.001;
      curr.x = prev.x - (sdx / d) * len;
      curr.y = prev.y - (sdy / d) * len;
    }

    if (Math.random() < 0.001 * frameScale) {
      if (this.water) {
        this.water.drop(fish.x, fish.y, 1.4);
        return;
      }
      this.ripples.push({
        x: fish.x + rand(-4, 4),
        y: fish.y + rand(-3, 3),
        r: 1,
        maxR: rand(8, 16),
        alpha: 0.18,
      });
    }
  };

  KoiPond.prototype.buildFishGeometry = function (fish) {
    var segs = fish.segments;
    var n = segs.length;
    var hw = fish.headWidth;
    var swim = fish.swimPhase;
    var cx = [];
    var cy = [];
    var nx = [];
    var ny = [];
    var widths = [];

    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var ang;
      if (i < n - 1) {
        ang = Math.atan2(segs[i + 1].y - segs[i].y, segs[i + 1].x - segs[i].x);
      } else {
        ang = Math.atan2(segs[i].y - segs[i - 1].y, segs[i].x - segs[i - 1].x);
      }

      var wave = Math.sin(swim * 0.45 - t * 2.3) * t * t * hw * 0.21;
      var px = -Math.sin(ang);
      var py = Math.cos(ang);

      cx.push(segs[i].x + px * wave);
      cy.push(segs[i].y + py * wave);
      nx.push(px);
      ny.push(py);
      widths.push(hw * this.getBodyWidth(t));
    }

    return { cx: cx, cy: cy, nx: nx, ny: ny, widths: widths, n: n };
  };

  KoiPond.prototype.drawKoi = function (fish) {
    var ctx = this.ctx;
    ctx.save();
    try {
    var geom = this.buildFishGeometry(fish);
    var cx = geom.cx;
    var cy = geom.cy;
    var nx = geom.nx;
    var ny = geom.ny;
    var widths = geom.widths;
    var n = geom.n;
    var hw = fish.headWidth;
    var swim = fish.swimPhase;
    var depth = fish.depth == null ? 0.5 : fish.depth;
    var palette = fish.palette || {};
    var bodyStops = palette.bodyStops || ["#ede8e0", "#fffefb", "#faf7f2", "#e8e2d8"];
    var finStops = palette.finStops || [
      "rgba(248, 249, 252, 0.92)",
      "rgba(225, 232, 240, 0.78)",
      "rgba(200, 210, 220, 0.4)",
    ];
    var idx;
    var headAng = Math.atan2(cy[0] - cy[1], cx[0] - cx[1]);

    var left = [];
    var right = [];
    for (idx = 0; idx < n; idx++) {
      left.push({ x: cx[idx] - nx[idx] * widths[idx], y: cy[idx] - ny[idx] * widths[idx] });
      right.push({ x: cx[idx] + nx[idx] * widths[idx], y: cy[idx] + ny[idx] * widths[idx] });
    }

    // The water shader casts a soft shadow on the pond floor instead.
    if (!this.water) {
      ctx.fillStyle = "rgba(8, 28, 36, " + (0.08 + depth * 0.08) + ")";
      ctx.save();
      ctx.translate(1.4 + depth * 1.2, 2.2 + depth * 1.3);
      ctx.beginPath();
      this.traceIceCreamBody(ctx, left, right, cx[0], cy[0], headAng, hw, n);
      ctx.fill();
      ctx.restore();
    }

    var tailAng = Math.atan2(cy[n - 1] - cy[n - 2], cx[n - 1] - cx[n - 2]);
    var tailSway = Math.sin(swim * 0.28) * 0.22;
    var speedNorm = Math.max(
      0,
      Math.min(1, (fish.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN))
    );
    var finFlutter = Math.sin(swim * 0.5) * 0.08 * (1 - speedNorm * 0.5);
    var spreadAngle = 0.1 + 0.62 * (1 - speedNorm);
    var tailSpread = Math.sin(swim * 0.28) * 0.1 * (1 - speedNorm * 0.7);
    var pecSpread = 0.14 * (1 - speedNorm * 0.85) + 0.02;
    var pecSpanScale = 1 - speedNorm * 0.55;
    var pecLenScale = 1 - speedNorm * 0.18;
    var tx = cx[n - 1];
    var ty = cy[n - 1];
    var peakT = 0.2;
    var peakIdx = Math.max(2, Math.floor(n * peakT));
    var widthRatio = widths[n - 1] / Math.max(widths[peakIdx], 0.001);
    var tailScale = Math.max(0.65, 0.5 + widthRatio * 0.5);
    var lobeLen = hw * 2.75 * tailScale;
    var lobeW = hw * 0.68 * tailScale;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(tailAng + tailSway);
    for (var side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.rotate(side * (spreadAngle + tailSpread));
      var tg = ctx.createLinearGradient(0, 0, lobeLen, side * lobeW * 0.35);
      tg.addColorStop(0, finStops[0]);
      tg.addColorStop(0.45, finStops[1]);
      tg.addColorStop(1, finStops[2]);
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        lobeLen * 0.2,
        side * lobeW * 0.1,
        lobeLen * 0.62,
        side * lobeW * 0.98,
        lobeLen,
        side * lobeW * 0.14
      );
      ctx.bezierCurveTo(
        lobeLen * 0.76,
        side * lobeW * 0.03,
        lobeLen * 0.2,
        0,
        0,
        0
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    var pelIdx = Math.floor(n * 0.56);
    var pelLen = hw * 0.42;
    ctx.fillStyle = palette.dorsalColor || "rgba(235, 240, 245, 0.62)";
    for (var f = -1; f <= 1; f += 2) {
      ctx.save();
      ctx.translate(cx[pelIdx], cy[pelIdx]);
      ctx.rotate(
        Math.atan2(cy[pelIdx + 1] - cy[pelIdx], cx[pelIdx + 1] - cx[pelIdx]) +
          f * (1.05 + finFlutter * 0.5)
      );
      ctx.beginPath();
      ctx.ellipse(0, f * pelLen * 0.35, pelLen * 0.48, pelLen * 0.16, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    var bodyGrad = ctx.createLinearGradient(
      cx[0] - nx[0] * hw * 0.5,
      cy[0] - ny[0] * hw * 0.5,
      cx[0] + nx[0] * hw * 0.5,
      cy[0] + ny[0] * hw * 0.5
    );
    bodyGrad.addColorStop(0, bodyStops[0]);
    bodyGrad.addColorStop(0.35, bodyStops[1]);
    bodyGrad.addColorStop(0.65, bodyStops[2]);
    bodyGrad.addColorStop(1, bodyStops[3]);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    this.traceIceCreamBody(ctx, left, right, cx[0], cy[0], headAng, hw, n);
    ctx.fill();

    ctx.save();
    try {
      ctx.beginPath();
      this.traceIceCreamBody(ctx, left, right, cx[0], cy[0], headAng, hw, n);
      ctx.clip();
      this.drawBodyScales(ctx, cx, cy, nx, ny, widths, n, hw, palette.scaleColor);

      (fish.patches || []).forEach(function (patch) {
      var pIdx = Math.min(n - 2, Math.max(1, Math.round(patch.t * (n - 1))));
      var dorsalShift = -0.32;
      var px = cx[pIdx] + nx[pIdx] * hw * (dorsalShift + patch.offset);
      var py = cy[pIdx] + ny[pIdx] * hw * (dorsalShift + patch.offset);
      var prx = hw * patch.rx;
      var pry = hw * patch.ry;
      var patchAng = Math.atan2(cy[pIdx] - cy[pIdx + 1], cx[pIdx] - cx[pIdx + 1]);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(patchAng);
      var patchColor = patch.color || {
        fill: "#b9462f",
        shade: "rgba(120, 34, 24, 0.16)",
      };
      ctx.globalAlpha = patch.deep ? 0.94 : 0.88;
      ctx.fillStyle = patchColor.fill;
      ctx.beginPath();
      if (patch.points && patch.points.length > 2) {
        ctx.save();
        ctx.rotate(patch.rot || 0);
        var first = patch.points[0];
        ctx.moveTo(first.x * prx, first.y * pry);
        for (var p = 1; p <= patch.points.length; p++) {
          var curr = patch.points[p % patch.points.length];
          var prev = patch.points[(p - 1) % patch.points.length];
          ctx.quadraticCurveTo(
            prev.x * prx,
            prev.y * pry,
            ((prev.x + curr.x) * 0.5) * prx,
            ((prev.y + curr.y) * 0.5) * pry
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.ellipse(0, 0, prx, pry, patch.rot || 0, 0, TAU);
        ctx.fill();
      }

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = patchColor.shade;
      ctx.beginPath();
      ctx.ellipse(prx * -0.08, pry * 0.08, prx * 0.58, pry * 0.46, patch.rot || 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    });
    } finally {
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(50, 60, 68, 0.1)";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    this.traceIceCreamBody(ctx, left, right, cx[0], cy[0], headAng, hw, n);
    ctx.stroke();

    var pecIdx = peakIdx;
    var bodyAng = Math.atan2(cy[pecIdx + 1] - cy[pecIdx], cx[pecIdx + 1] - cx[pecIdx]);
    var pecSides = [
      { x: left[pecIdx].x, y: left[pecIdx].y, lateral: -1 },
      { x: right[pecIdx].x, y: right[pecIdx].y, lateral: 1 },
    ];

    pecSides.forEach(function (side) {
      var finAng = bodyAng + side.lateral * pecSpread + finFlutter * 0.12 * (1 - speedNorm * 0.65);
      var finLen = hw * 1.02 * pecLenScale;
      var finSpan = hw * 1.02 * pecSpanScale;
      ctx.save();
      ctx.translate(side.x, side.y);
      ctx.rotate(finAng);
      var pg = ctx.createLinearGradient(0, 0, finLen, 0);
      pg.addColorStop(0, finStops[0]);
      pg.addColorStop(0.6, finStops[1]);
      pg.addColorStop(1, finStops[2]);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        finLen * 0.22,
        side.lateral * finSpan * 0.55,
        finLen * 0.58,
        side.lateral * finSpan,
        finLen * 0.88,
        side.lateral * finSpan * 0.35
      );
      ctx.bezierCurveTo(
        finLen * 0.5,
        side.lateral * finSpan * 0.15,
        finLen * 0.12,
        side.lateral * finSpan * 0.04,
        0,
        0
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    ctx.strokeStyle = palette.dorsalColor || "rgba(230, 236, 242, 0.72)";
    ctx.lineWidth = Math.max(0.9, hw * 0.08);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx[4], cy[4]);
    for (idx = 5; idx < n - 6; idx++) {
      ctx.lineTo(cx[idx], cy[idx]);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(55, 48, 38, 0.16)";
    ctx.lineWidth = Math.max(0.45, hw * 0.028);
    ctx.beginPath();
    ctx.moveTo(cx[5], cy[5]);
    for (idx = 6; idx < n - 8; idx++) {
      ctx.lineTo(cx[idx], cy[idx]);
    }
    ctx.stroke();

    var snoutEyeT = peakT * 0.32;
    var cheekEyeT = Math.max(1, peakIdx - 1) / (n - 1);
    var eyeT = (snoutEyeT + cheekEyeT) * 0.5;
    var eyeIdx = Math.max(1, Math.round(eyeT * (n - 1)));
    var eyeAng = Math.atan2(cy[eyeIdx] - cy[eyeIdx + 1], cx[eyeIdx] - cx[eyeIdx + 1]);
    var eyeFwd = hw * 0.195;
    var fwdX = Math.cos(eyeAng) * eyeFwd;
    var fwdY = Math.sin(eyeAng) * eyeFwd;
    var eyeR = hw * 0.122;
    var eyeHighlightR = hw * 0.024;
    var hlDx = Math.cos(eyeAng) * hw * 0.025;
    var hlDy = Math.sin(eyeAng) * hw * 0.025;
    var eyeInset = widths[eyeIdx] * 0.14;
    var eyePositions = [
      {
        x: left[eyeIdx].x + fwdX + nx[eyeIdx] * eyeInset,
        y: left[eyeIdx].y + fwdY + ny[eyeIdx] * eyeInset,
      },
      {
        x: right[eyeIdx].x + fwdX - nx[eyeIdx] * eyeInset,
        y: right[eyeIdx].y + fwdY - ny[eyeIdx] * eyeInset,
      },
    ];

    ctx.fillStyle = "#1c2226";
    eyePositions.forEach(function (eye) {
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eyeR, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    eyePositions.forEach(function (eye, i) {
      var dorsalX = -ny[eyeIdx] * hw * 0.012 * (i === 0 ? 1 : -1);
      var dorsalY = nx[eyeIdx] * hw * 0.012 * (i === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.arc(eye.x + hlDx + dorsalX, eye.y + hlDy + dorsalY, eyeHighlightR, 0, TAU);
      ctx.fill();
    });

    var whiskerFwdX = Math.cos(headAng);
    var whiskerFwdY = Math.sin(headAng);
    var snoutTipX = cx[0] + whiskerFwdX * hw * 0.38;
    var snoutTipY = cy[0] + whiskerFwdY * hw * 0.38;
    var whiskerLen = hw * 0.2;
    var whiskerBases = [
      {
        t: 0.9,
        lateral: -1,
      },
      {
        t: 0.1,
        lateral: 1,
      },
    ];

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    whiskerBases.forEach(function (base) {
      var u = 1 - base.t;
      var baseX =
        u * u * right[0].x + 2 * u * base.t * snoutTipX + base.t * base.t * left[0].x;
      var baseY =
        u * u * right[0].y + 2 * u * base.t * snoutTipY + base.t * base.t * left[0].y;
      var dirX = nx[0] * base.lateral * 0.5 + whiskerFwdX * 0.866;
      var dirY = ny[0] * base.lateral * 0.5 + whiskerFwdY * 0.866;
      var dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      dirX /= dirLen;
      dirY /= dirLen;

      ctx.beginPath();
      ctx.moveTo(baseX - dirX * hw * 0.035, baseY - dirY * hw * 0.035);
      ctx.quadraticCurveTo(
        baseX + dirX * whiskerLen * 0.55 + whiskerFwdX * hw * 0.035,
        baseY + dirY * whiskerLen * 0.55 + whiskerFwdY * hw * 0.035,
        baseX + dirX * whiskerLen,
        baseY + dirY * whiskerLen
      );
      ctx.stroke();
    });
    } catch (err) {
      console.error("drawKoi error", err);
    } finally {
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  };

  KoiPond.prototype.drawWater = function () {
    var ctx = this.ctx;
    var t = this.time * 0.0004;
    var g = ctx.createLinearGradient(0, 0, 0, this.h);
    var stops = this.isNight()
      ? ["#2a5585", "#224a76", "#1a3863", "#0f2244"]
      : ["#6a9fc6", "#5f97c2", "#4e88b6", "#2f5e86"];
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.36, stops[1]);
    g.addColorStop(0.72, stops[2]);
    g.addColorStop(1, stops[3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.globalAlpha = 0.1 + Math.sin(t) * 0.025;
    var cg = ctx.createRadialGradient(
      this.w * 0.42,
      this.h * 0.08,
      0,
      this.w * 0.5,
      this.h * 0.28,
      this.w * 0.62
    );
    cg.addColorStop(0, "#cfe0f4");
    cg.addColorStop(0.45, "rgba(110, 150, 210, 0.35)");
    cg.addColorStop(1, "transparent");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.globalAlpha = 1;
  };

  KoiPond.prototype.drawRipples = function () {
    var ctx = this.ctx;
    var dt = this.dt || 1 / REF_FPS;
    var frameScale = dt * REF_FPS;
    this.ripples = this.ripples.filter(function (r) {
      r.r += 0.4 * frameScale;
      r.alpha *= Math.pow(0.962, frameScale);
      if (r.alpha < 0.02 || r.r > r.maxR) return false;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.strokeStyle = "rgba(200, 240, 248, " + r.alpha + ")";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      return true;
    });
  };

  // Seeded value noise for the lily pad textures, so a pad keeps its look across resizes.
  function hash2(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function vnoise(x, y, seed) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy, seed);
    var b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed);
    var d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm2(x, y, seed) {
    return (
      vnoise(x, y, seed) * 0.5 +
      vnoise(x * 2.03 + 7.1, y * 2.03 + 3.3, seed) * 0.3 +
      vnoise(x * 4.1 + 1.7, y * 4.1 + 9.2, seed) * 0.2
    );
  }

  // Leaf colors, 0 to 1. Young leaves are a lighter, brighter green.
  var PAD_TONES = {
    mature: { dark: [0.15, 0.3, 0.11], mid: [0.3, 0.5, 0.17], vein: [0.5, 0.66, 0.3], rim: [0.36, 0.2, 0.15] },
    young: { dark: [0.22, 0.4, 0.13], mid: [0.4, 0.6, 0.2], vein: [0.58, 0.74, 0.34], rim: [0.42, 0.22, 0.15] },
  };

  function unit3(x, y, z) {
    var m = Math.sqrt(x * x + y * y + z * z);
    return [x / m, y / m, z / m];
  }

  var PAD_SUN = unit3(LIGHT_X, LIGHT_Y, 1.9);
  var PAD_HALF = unit3(PAD_SUN[0], PAD_SUN[1], PAD_SUN[2] + 1);

  // A lily pad drawn pixel by pixel: a round leaf with a narrow slit to the stem,
  // a slightly wavy rim that curls up, branching veins, a waxy surface that
  // catches the sun on every bump, and now and then a bead of water.
  function renderPadSprite(pad, dpr) {
    var rx = pad.rx;
    var ry = pad.ry;
    var Rn = (rx + ry) * 0.5;
    var reach = Math.max(rx, ry) * (1.06 + pad.wobA + pad.wobB);
    var S = Math.ceil(reach * 2 * dpr) + 4;
    var canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    var cctx = canvas.getContext("2d");
    if (!cctx) return canvas;
    var img = cctx.createImageData(S, S);
    var data = img.data;
    var height = new Float32Array(S * S);
    var cover = new Float32Array(S * S);
    var color = new Float32Array(S * S * 3);
    var tone = PAD_TONES[pad.kind] || PAD_TONES.mature;
    var seed = pad.seed;
    var cos = Math.cos(pad.rot);
    var sin = Math.sin(pad.rot);
    var flip = pad.flipped ? -1 : 1;
    var half = S / 2;
    var span = TAU - 2 * pad.notch;
    var veins = pad.veins;
    var slitTan = Math.tan(pad.notch);
    // The sun's direction in the pad's own frame, for the water beads.
    var sunX = (LIGHT_X * cos + LIGHT_Y * sin) * flip;
    var sunY = -LIGHT_X * sin + LIGHT_Y * cos;
    var x;
    var y;
    var i;
    var k;

    for (y = 0; y < S; y++) {
      for (x = 0; x < S; x++) {
        i = y * S + x;
        // Screen offset to the pad's own frame: undo the rotation, then the flip.
        var sx = (x + 0.5 - half) / dpr;
        var sy = (y + 0.5 - half) / dpr;
        var lx = (sx * cos + sy * sin) * flip;
        var ly = -sx * sin + sy * cos;
        var u = lx / rx;
        var v = ly / ry;
        var r = Math.sqrt(u * u + v * v);
        if (r > 1.14) continue;
        var a = Math.atan2(v, u);
        var ca = r > 0 ? u / r : 1;
        var sa = r > 0 ? v / r : 0;

        var e =
          1 +
          pad.wobA * Math.sin(3 * a + pad.wobP) +
          pad.wobB * Math.sin(7 * a + pad.wobP * 1.7) +
          0.03 * (vnoise(ca * 3 + 7, sa * 3 + 3, seed) - 0.5);
        var c = Math.max(0, Math.min(1, (e - r) * Rn * dpr + 0.5));
        var edgeT = r / e;
        var lift = 1.3 * smoothstep(0.84, 1, edgeT);
        if (lx > 0) {
          // The slit: narrow at the stem, opening a little at the rim.
          var gap = lx * slitTan + 0.7 * smoothstep(0.8, 1, r);
          var out = Math.abs(ly) - gap;
          c *= Math.max(0, Math.min(1, out * dpr + 0.5));
          lift = Math.max(lift, (1 - smoothstep(0, 2.5, out)) * smoothstep(0.1, 0.35, r));
        }
        cover[i] = c;

        // Veins fan out from the stem and fork about halfway to the rim.
        var t = a < 0 ? a + TAU : a;
        var aw = t + 0.07 * (vnoise(u * 2.5 + 3, v * 2.5 + 5, seed) - 0.5);
        var ph = ((aw - pad.notch) / span) * (veins - 1);
        var dph = ph - Math.round(ph);
        var fork = 0.25 * smoothstep(0.42, 0.85, r);
        var dd = Math.min(Math.abs(dph - fork), Math.abs(dph + fork));
        var dist = ((dd * span) / (veins - 1)) * r * Rn;
        var vw = 0.36 + 0.45 * (1 - r);
        var vein =
          Math.exp(-(dist * dist) / (vw * vw)) *
          smoothstep(0.05, 0.18, r) *
          (1 - 0.6 * smoothstep(0.88, 0.99, edgeT));

        var h =
          lift -
          0.16 * vein +
          1.1 * (fbm2(u * 1.5 + 11, v * 1.5 + 4, seed) - 0.5) +
          0.1 * (vnoise(u * 9 + 2, v * 9 + 6, seed + 7) - 0.5) +
          0.4 * Math.exp(-(r * Rn) * (r * Rn) / 3);

        var m = fbm2(u * 2.2 + 1, v * 2.2 + 8, seed + 3);
        m = Math.max(0, Math.min(1, (m - 0.25) * 1.7));
        var cr = lerp(tone.dark[0], tone.mid[0], m);
        var cg = lerp(tone.dark[1], tone.mid[1], m);
        var cb = lerp(tone.dark[2], tone.mid[2], m);
        var vm = vein * 0.28;
        cr = lerp(cr, tone.vein[0], vm);
        cg = lerp(cg, tone.vein[1], vm);
        cb = lerp(cb, tone.vein[2], vm);
        var band = smoothstep(0.935, 0.99, edgeT) * pad.redRim;
        cr = lerp(cr, tone.rim[0], band);
        cg = lerp(cg, tone.rim[1], band);
        cb = lerp(cb, tone.rim[2], band);

        for (k = 0; k < pad.drops.length; k++) {
          var drop = pad.drops[k];
          var ox = (lx - drop.x * rx) / drop.r;
          var oy = (ly - drop.y * ry) / drop.r;
          var d2 = ox * ox + oy * oy;
          if (d2 >= 1.6) continue;
          if (d2 >= 1) {
            // The bead's shadow, on the side away from the sun.
            var bx = ox + sunX * 0.35;
            var by = oy + sunY * 0.35;
            var shadow = 0.25 * (1 - smoothstep(0.8, 1.5, bx * bx + by * by));
            cr *= 1 - shadow;
            cg *= 1 - shadow;
            cb *= 1 - shadow;
            continue;
          }
          // A bead of water: the leaf shows through its middle a little brighter,
          // a thin dark rim, and a hard spark of sun near the top.
          var lens = 1.12 - 0.5 * smoothstep(0.55, 1, d2);
          cr *= lens;
          cg *= lens;
          cb *= lens;
          var sparkX = ox - sunX * 0.42;
          var sparkY = oy - sunY * 0.42;
          var spark = 1 - smoothstep(0.02, 0.09, sparkX * sparkX + sparkY * sparkY);
          cr += spark * 0.8;
          cg += spark * 0.8;
          cb += spark * 0.8;
        }

        if (edgeT > 0.975) {
          cr *= 0.82;
          cg *= 0.82;
          cb *= 0.82;
        }

        height[i] = h;
        color[i * 3] = cr;
        color[i * 3 + 1] = cg;
        color[i * 3 + 2] = cb;
      }
    }

    // Light the leaf from its bumps: diffuse for shape, a sharp waxy highlight for gloss.
    for (y = 1; y < S - 1; y++) {
      for (x = 1; x < S - 1; x++) {
        i = y * S + x;
        if (cover[i] <= 0) continue;
        var gx = (height[i + 1] - height[i - 1]) * dpr * 0.5;
        var gy = (height[i + S] - height[i - S]) * dpr * 0.5;
        var inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        var nx = -gx * inv;
        var ny = -gy * inv;
        var nz = inv;
        var diff = Math.max(0, nx * PAD_SUN[0] + ny * PAD_SUN[1] + nz * PAD_SUN[2]) / PAD_SUN[2];
        var nh = Math.max(0, nx * PAD_HALF[0] + ny * PAD_HALF[1] + nz * PAD_HALF[2]);
        var spec = 0.06 * Math.pow(nh, 20) + 0.22 * Math.pow(nh, 120);
        var lit = 0.4 + 0.6 * diff;
        var o = i * 4;
        data[o] = Math.min(255, (color[i * 3] * lit + spec * 0.86 + 0.02) * 255);
        data[o + 1] = Math.min(255, (color[i * 3 + 1] * lit + spec * 0.93 + 0.025) * 255);
        data[o + 2] = Math.min(255, (color[i * 3 + 2] * lit + spec * 0.95 + 0.025) * 255);
        data[o + 3] = cover[i] * 255;
      }
    }
    cctx.putImageData(img, 0, 0);
    return canvas;
  }

  KoiPond.prototype.padSprite = function (pad) {
    var dpr = this.dpr || 1;
    var key = pad.rx.toFixed(2) + ":" + dpr;
    if (!pad.sprite || pad.spriteKey !== key) {
      pad.sprite = renderPadSprite(pad, dpr);
      pad.spriteKey = key;
    }
    return pad.sprite;
  };

  // Petal outline: widest a third of the way out, coming to a soft point.
  function tracePetal(ctx, len, wid) {
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid * 0.95, -len * 0.14, wid * 1.08, -len * 0.62, 0, -len);
    ctx.bezierCurveTo(-wid * 1.08, -len * 0.62, -wid * 0.95, -len * 0.14, 0, 0);
  }

  var BLOOM_COLORS = {
    pink: {
      base: "#fff3f3",
      body: "#f8c3d0",
      tip: "#e57c9d",
      inner: "#ec93ae",
      edge: "rgba(168, 54, 96, 0.3)",
      shade: [128, 34, 74],
      lit: [255, 246, 249],
    },
    white: {
      base: "#eef0d4",
      body: "#fffef9",
      tip: "#fcf5ec",
      inner: "#f9f1de",
      edge: "rgba(132, 126, 100, 0.32)",
      shade: [92, 96, 74],
      lit: [255, 255, 255],
    },
  };

  // A water lily: four green sepals, four rings of cupped petals that get
  // shorter and more upright toward the middle, then a crown of stamens.
  function makeBloom() {
    var rings = [
      { count: 8, len: 1.0, wid: 0.27, turn: 0 },
      { count: 8, len: 0.86, wid: 0.27, turn: Math.PI / 8 },
      { count: 8, len: 0.68, wid: 0.25, turn: 0.2 },
      { count: 6, len: 0.48, wid: 0.23, turn: 0.55 },
    ];
    var petals = rings.map(function (ring) {
      var list = [];
      for (var i = 0; i < ring.count; i++) {
        list.push({
          a: ring.turn + (TAU * i) / ring.count + rand(-0.09, 0.09),
          len: ring.len * rand(0.9, 1.06),
          wid: ring.wid * rand(0.88, 1.12),
        });
      }
      return list;
    });
    var sepals = [];
    for (var s = 0; s < 4; s++) {
      sepals.push({ a: Math.PI / 8 + (s * Math.PI) / 2 + rand(-0.12, 0.12), len: rand(0.88, 0.98) });
    }
    var stamens = [];
    for (var k = 0; k < 34; k++) {
      stamens.push({
        a: (TAU * k) / 34 + rand(-0.05, 0.05),
        r0: rand(0.27, 0.33),
        r1: rand(0.11, 0.15),
        bend: rand(-0.3, 0.3),
      });
    }
    return { petals: petals, sepals: sepals, stamens: stamens };
  }

  // lx, ly: direction to the sun.
  KoiPond.prototype.drawLotus = function (pad, ctx, lx, ly) {
    var bloom = pad.bloom || (pad.bloom = makeBloom());
    var col = BLOOM_COLORS[pad.lotusColor] || BLOOM_COLORS.pink;
    var R = pad.rx * 0.62;
    var dpr = this.dpr || 1;
    var spin = pad.phase;

    bloom.sepals.forEach(function (sp) {
      var len = R * sp.len;
      ctx.save();
      ctx.rotate(sp.a + spin);
      var sg = ctx.createLinearGradient(0, 0, 0, -len);
      sg.addColorStop(0, "#4b7433");
      sg.addColorStop(0.6, "#6f9748");
      sg.addColorStop(1, "#9dbb6c");
      ctx.fillStyle = sg;
      ctx.beginPath();
      tracePetal(ctx, len, R * 0.24);
      ctx.fill();
      ctx.strokeStyle = "rgba(28, 56, 20, 0.35)";
      ctx.lineWidth = 0.45;
      ctx.stroke();
      ctx.restore();
    });

    bloom.petals.forEach(function (ring, ri) {
      // Petals stand above the water, so each ring shades the one beneath it.
      ctx.save();
      ctx.shadowColor = "rgba(8, 36, 28, " + (ri === 0 ? 0.4 : 0.24) + ")";
      ctx.shadowBlur = (ri === 0 ? 5 : 3) * dpr;
      ctx.shadowOffsetX = (ri === 0 ? 2.4 : 1.2) * dpr;
      ctx.shadowOffsetY = (ri === 0 ? 3.2 : 1.6) * dpr;
      ctx.fillStyle = col.base;
      ctx.beginPath();
      ring.forEach(function (p) {
        ctx.save();
        ctx.rotate(p.a + spin);
        tracePetal(ctx, R * p.len, R * p.wid);
        ctx.restore();
      });
      ctx.fill();
      ctx.restore();

      ring.forEach(function (p) {
        var ang = p.a + spin;
        var len = R * p.len;
        var wid = R * p.wid;
        ctx.save();
        ctx.rotate(ang);
        var g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, col.base);
        g.addColorStop(0.45, col.body);
        g.addColorStop(1, ri >= 2 ? col.inner : col.tip);
        ctx.fillStyle = g;
        ctx.beginPath();
        tracePetal(ctx, len, wid);
        ctx.fill();

        // Petals are cupped like a spoon: the wall facing the sun is the far one.
        var plx = lx * Math.cos(ang) + ly * Math.sin(ang);
        var amt = 0.12 + 0.3 * Math.min(1, Math.abs(plx) * 1.3);
        var lit = rgba(col.lit, amt * 0.9);
        var dim = rgba(col.shade, amt);
        var clear = rgba(col.lit, 0);
        var cg = ctx.createLinearGradient(-wid, 0, wid, 0);
        cg.addColorStop(0, plx < 0 ? dim : lit);
        cg.addColorStop(0.5, clear);
        cg.addColorStop(1, plx < 0 ? lit : dim);
        ctx.fillStyle = cg;
        ctx.fill();

        ctx.strokeStyle = col.edge;
        ctx.lineWidth = 0.45;
        ctx.stroke();
        ctx.strokeStyle = rgba(col.lit, 0.35);
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.1);
        ctx.lineTo(0, -len * 0.82);
        ctx.stroke();
        ctx.restore();
      });
    });

    // Stamens curl in over the middle: dark outline first, then the gold.
    var stamenW = Math.max(0.8, R * 0.075);
    ctx.lineCap = "round";
    [
      ["#a86d1c", stamenW],
      ["#f3bf3f", stamenW * 0.62],
    ].forEach(function (pass) {
      ctx.strokeStyle = pass[0];
      ctx.lineWidth = pass[1];
      ctx.beginPath();
      bloom.stamens.forEach(function (st) {
        var a0 = st.a + spin;
        var a1 = a0 + st.bend * 0.4;
        ctx.moveTo(Math.cos(a0) * R * st.r0, Math.sin(a0) * R * st.r0);
        ctx.quadraticCurveTo(
          Math.cos(a0 + st.bend * 0.2) * R * (st.r0 + st.r1) * 0.5,
          Math.sin(a0 + st.bend * 0.2) * R * (st.r0 + st.r1) * 0.5,
          Math.cos(a1) * R * st.r1,
          Math.sin(a1) * R * st.r1
        );
      });
      ctx.stroke();
    });
    ctx.fillStyle = "#ffe17e";
    bloom.stamens.forEach(function (st, i) {
      if (i % 2) return;
      var a1 = st.a + spin + st.bend * 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a1) * R * st.r1, Math.sin(a1) * R * st.r1, stamenW * 0.32, 0, TAU);
      ctx.fill();
    });

    var disc = ctx.createRadialGradient(-R * 0.03, -R * 0.04, 0, 0, 0, R * 0.12);
    disc.addColorStop(0, "#f6e9a4");
    disc.addColorStop(1, "#c3a23c");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(128, 98, 26, 0.5)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (var j = 0; j < 12; j++) {
      var ra = (TAU * j) / 12 + spin;
      ctx.moveTo(Math.cos(ra) * R * 0.025, Math.sin(ra) * R * 0.025);
      ctx.lineTo(Math.cos(ra) * R * 0.1, Math.sin(ra) * R * 0.1);
    }
    ctx.stroke();
  };

  KoiPond.prototype.drawLilyPad = function (pad, ctx) {
    ctx = ctx || this.ctx;
    var dpr = this.dpr || 1;

    if (!this.water) {
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.rot);
      ctx.fillStyle = "rgba(9, 42, 36, 0.22)";
      ctx.beginPath();
      ctx.ellipse(4, 5, pad.rx + 3, pad.ry + 3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Line the texture up with device pixels so it stays sharp.
    var sprite = this.padSprite(pad);
    var S = sprite.width;
    var ix = Math.round(pad.x * dpr - S / 2);
    var iy = Math.round(pad.y * dpr - S / 2);
    ctx.drawImage(sprite, ix / dpr, iy / dpr, S / dpr, S / dpr);

    if (pad.hasLotus) {
      ctx.save();
      ctx.translate(pad.x + pad.lotusOffsetX, pad.y + pad.lotusOffsetY);
      this.drawLotus(pad, ctx, LIGHT_X, LIGHT_Y);
      ctx.restore();
    }
  };

  KoiPond.prototype.frame = function (timestamp) {
    if (!this.running) return;

    if (!this.w || !this.h) {
      this.resize();
      if (!this.fishes.length) this.seedFish();
    }

    if (!this._lastFrameTs) {
      this.dt = 1 / REF_FPS;
    } else {
      this.dt = Math.min(MAX_FRAME_DT, (timestamp - this._lastFrameTs) / 1000);
    }
    this._lastFrameTs = timestamp;
    this.time = timestamp;

    if (this.water) {
      this.ctx.clearRect(0, 0, this.w, this.h);
    } else {
      this.drawWater();
    }
    this.updateFood();

    var self = this;

    this.fishes.forEach(function (fish) {
      self.steerFish(fish);
    });

    this.fishes.slice().sort(function (a, b) {
      return a.depth - b.depth;
    }).forEach(function (fish) {
      self.drawKoi(fish);
    });

    this.drawFood();

    if (this.water) {
      this.water.step(this.dt);
      this.water.render(timestamp / 1000, this.layer, this.foodDirty ? this.foodLayer : null);
    } else {
      this.ctx.drawImage(this.padLayer, 0, 0, this.w, this.h);
      this.drawRipples();
    }

    this.rafId = requestAnimationFrame(this._boundFrame);
  };

  KoiPond.prototype.start = function () {
    this.wantsRunning = true;
    if (this.running || !this.visible) return;
    this.running = true;
    this._lastFrameTs = 0;
    this.dt = 1 / REF_FPS;
    if (!this.fishes.length) this.seedFish();
    this.frame(
      window.performance && window.performance.now
        ? window.performance.now()
        : Date.now()
    );
  };

  KoiPond.prototype.stop = function () {
    this.wantsRunning = false;
    this.pause();
  };

  KoiPond.prototype.pause = function () {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  KoiPond.prototype.destroy = function () {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeEventListener("pointerdown", this._boundFeedClick);
      this.canvas.parentElement.removeEventListener("click", this._boundFeedClick);
    }
    this.foodPellets = [];
    if (this.water) {
      this.water.destroy();
    } else if (this.ctx && this.w && this.h) {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  };

  window.KoiPond = KoiPond;
})();
