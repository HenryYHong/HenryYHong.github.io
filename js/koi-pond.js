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

  function KoiPond(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
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
  }

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

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;

    if (this.lilyPads.length === 0) {
      this.seedLilyPads();
    } else {
      this.repositionLilyPads();
    }
  };

  KoiPond.prototype.seedLilyPads = function () {
    var spots = [
      { x: 0.07, y: 0.74, scale: 0.95, flipped: false, lotus: true, lotusColor: "pink", lotusSide: -Math.PI * 0.42 },
      { x: 0.2, y: 0.16, scale: 1.05, flipped: true, lotus: false },
      { x: 0.84, y: 0.2, scale: 0.9, flipped: false, lotus: true, lotusColor: "white", lotusSide: Math.PI * 0.92 },
      { x: 0.92, y: 0.7, scale: 1.0, flipped: true, lotus: false },
      { x: 0.1, y: 0.44, scale: 0.72, flipped: true, lotus: false },
      { x: 0.9, y: 0.46, scale: 0.78, flipped: false, lotus: true, lotusColor: "pink", lotusSide: Math.PI * 0.08 },
      { x: 0.58, y: 0.84, scale: 0.68, flipped: true, lotus: false },
      { x: 0.35, y: 0.12, scale: 0.62, flipped: false, lotus: true, lotusColor: "white", lotusSide: -Math.PI * 0.18 },
    ];

    this.lilyPads = spots.map(function (s) {
      var pad = {
        x: s.x * this.w,
        y: s.y * this.h,
        rx: 30 * s.scale,
        ry: 24 * s.scale,
        rot: rand(-0.35, 0.35),
        flipped: !!s.flipped,
        hasLotus: !!s.lotus,
        lotusColor: s.lotusColor || "pink",
        lotusSide: s.lotusSide != null ? s.lotusSide : rand(-Math.PI * 0.85, -Math.PI * 0.15),
        phase: rand(0, TAU),
      };
      this.updateLotusOffset(pad);
      return pad;
    }, this);
  };

  KoiPond.prototype.updateLotusOffset = function (pad) {
    if (!pad.hasLotus) return;
    var angle = pad.lotusSide;
    var dist = 1.22;
    pad.lotusOffsetX = Math.cos(angle) * pad.rx * dist;
    pad.lotusOffsetY = Math.sin(angle) * pad.ry * dist;
  };

  KoiPond.prototype.repositionLilyPads = function () {
    var spots = [
      { x: 0.07, y: 0.74, scale: 0.95 },
      { x: 0.2, y: 0.16, scale: 1.05 },
      { x: 0.84, y: 0.2, scale: 0.9 },
      { x: 0.92, y: 0.7, scale: 1.0 },
      { x: 0.1, y: 0.44, scale: 0.72 },
      { x: 0.9, y: 0.46, scale: 0.78 },
      { x: 0.58, y: 0.84, scale: 0.68 },
      { x: 0.35, y: 0.12, scale: 0.62 },
    ];

    this.lilyPads.forEach(function (pad, i) {
      if (!spots[i]) return;
      pad.x = spots[i].x * this.w;
      pad.y = spots[i].y * this.h;
      pad.rx = 30 * spots[i].scale;
      pad.ry = 24 * spots[i].scale;
      this.updateLotusOffset(pad);
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
    var inset = 90;
    this.paletteCounts = {};

    for (var i = 0; i < count; i++) {
      var palette = this.createKoiPalette(this.paletteCounts);
      var group = getColorGroup(palette);
      this.paletteCounts[group] = (this.paletteCounts[group] || 0) + 1;

      this.fishes.push(
        this.createFish({
          x: rand(inset, this.w - inset),
          y: rand(inset, this.h - inset),
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

    ctx.save();
    this.foodPellets.forEach(function (pellet) {
      var fade = Math.max(0, Math.min(1, 1 - pellet.age / pellet.life));
      var bob = Math.sin(now * 0.004 + pellet.phase) * 0.35;

      ctx.globalAlpha = 0.5 + fade * 0.45;
      ctx.fillStyle = "#efbd62";
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y + bob, pellet.r, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.25 + fade * 0.2;
      ctx.strokeStyle = "rgba(94, 58, 18, 0.48)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y + bob, pellet.r + 0.8, 0, TAU);
      ctx.stroke();
    });
    ctx.restore();
  };

  KoiPond.prototype.init = function (callback) {
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

    if (callback) callback();
  };

  KoiPond.prototype.paintInitialFrame = function () {
    var now =
      window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
    this.time = now;
    this.drawWater();
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

    if (fish.y < edgeBuffer && headingY < 0) {
      edgeT = (edgeBuffer - fish.y) / edgeBuffer;
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
      target = Math.atan2(this.h * 0.48 - fish.y, this.w * 0.5 - fish.x);
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
      this.ripples.push({
        x: foodTarget.x,
        y: foodTarget.y,
        r: 1,
        maxR: rand(7, 13),
        alpha: 0.16,
      });
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

    ctx.fillStyle = "rgba(8, 28, 36, " + (0.08 + depth * 0.08) + ")";
    ctx.save();
    ctx.translate(1.4 + depth * 1.2, 2.2 + depth * 1.3);
    ctx.beginPath();
    this.traceIceCreamBody(ctx, left, right, cx[0], cy[0], headAng, hw, n);
    ctx.fill();
    ctx.restore();

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
    g.addColorStop(0, "#3aa2a0");
    g.addColorStop(0.36, "#207982");
    g.addColorStop(0.72, "#155866");
    g.addColorStop(1, "#0b3544");
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
    cg.addColorStop(0, "#a8e0d8");
    cg.addColorStop(0.45, "rgba(92, 174, 172, 0.35)");
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

  KoiPond.prototype.drawLotus = function (pad) {
    if (!pad.hasLotus) return;

    var ctx = this.ctx;
    var isWhite = pad.lotusColor === "white";
    var petalColors = isWhite
      ? ["#fffef8", "#f5efe5", "#e8dfd0"]
      : ["#f7a7bd", "#ee829f", "#d96f91"];
    var centerColor = isWhite ? "#eed88e" : "#f5c64e";

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(9, 46, 42, 0.45)";
    ctx.beginPath();
    ctx.ellipse(2, 3, pad.rx * 0.36, pad.ry * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (var layer = 0; layer < 2; layer++) {
      var count = layer === 0 ? 12 : 8;
      var petalW = pad.rx * (layer === 0 ? 0.13 : 0.11);
      var petalH = pad.ry * (layer === 0 ? 0.42 : 0.32);

      for (var i = 0; i < count; i++) {
        var a = (TAU / count) * i + pad.phase * 0.045 + layer * 0.22;
        var color = petalColors[(i + layer) % petalColors.length];

        ctx.save();
        ctx.rotate(a);
        var pg = ctx.createLinearGradient(0, -petalH * 0.55, 0, petalH * 0.42);
        pg.addColorStop(0, color);
        pg.addColorStop(0.7, petalColors[0]);
        pg.addColorStop(1, isWhite ? "#ddd2c4" : "#c65f82");
        ctx.fillStyle = pg;
        ctx.globalAlpha = layer === 0 ? 0.88 : 0.96;
        ctx.beginPath();
        ctx.ellipse(0, -pad.ry * 0.14, petalW, petalH, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
    var centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pad.rx * 0.17);
    centerGrad.addColorStop(0, "#fff2a7");
    centerGrad.addColorStop(0.75, centerColor);
    centerGrad.addColorStop(1, isWhite ? "#d5b956" : "#d79b32");
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, pad.rx * 0.13, 0, TAU);
    ctx.fill();

    ctx.fillStyle = isWhite ? "#caa83d" : "#b97827";
    for (var j = 0; j < 7; j++) {
      var ba = (TAU / 7) * j;
      ctx.beginPath();
      ctx.arc(
        Math.cos(ba) * pad.rx * 0.065,
        Math.sin(ba) * pad.rx * 0.065,
        pad.rx * 0.025,
        0,
        TAU
      );
      ctx.fill();
    }
  };

  KoiPond.prototype.drawLilyPad = function (pad) {
    var ctx = this.ctx;
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.rot);
    if (pad.flipped) {
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = "rgba(9, 42, 36, 0.22)";
    ctx.beginPath();
    ctx.ellipse(4, 5, pad.rx + 3, pad.ry + 3, 0, 0, TAU);
    ctx.fill();

    var lg = ctx.createRadialGradient(-pad.rx * 0.28, -pad.ry * 0.32, 0, 0, 0, pad.rx * 1.08);
    lg.addColorStop(0, "#7fcb82");
    lg.addColorStop(0.45, "#4fa762");
    lg.addColorStop(0.78, "#2f7f50");
    lg.addColorStop(1, "#1f5f42");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(0, 0, pad.rx, pad.ry, 0, 0.18, TAU - 0.18);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(177, 225, 155, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, pad.rx * 0.95, pad.ry * 0.92, 0, 0.24, TAU - 0.24);
    ctx.stroke();

    ctx.strokeStyle = "rgba(25, 88, 54, 0.52)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -pad.ry * 0.44);
    ctx.stroke();

    ctx.strokeStyle = "rgba(24, 92, 56, 0.28)";
    ctx.lineWidth = 0.8;
    for (var v = -3; v <= 3; v++) {
      if (v === 0) continue;
      var veinAngle = -Math.PI * 0.5 + v * 0.34;
      var veinLen = pad.rx * (0.36 + (3 - Math.abs(v)) * 0.09);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(veinAngle) * veinLen * 0.55,
        Math.sin(veinAngle) * pad.ry * 0.36,
        Math.cos(veinAngle) * veinLen,
        Math.sin(veinAngle) * pad.ry * 0.58
      );
      ctx.stroke();
    }

    if (pad.hasLotus) {
      ctx.save();
      ctx.translate(pad.lotusOffsetX, pad.lotusOffsetY);

      ctx.strokeStyle = "rgba(28, 82, 52, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-pad.lotusOffsetX * 0.5, -pad.lotusOffsetY * 0.5);
      ctx.quadraticCurveTo(
        -pad.lotusOffsetX * 0.22,
        -pad.lotusOffsetY * 0.22,
        0,
        0
      );
      ctx.stroke();

      this.drawLotus(pad);
      ctx.restore();
    }

    ctx.restore();
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

    this.drawWater();
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

    this.lilyPads.forEach(function (pad) {
      self.drawLilyPad(pad);
    });

    this.drawRipples();

    this.rafId = requestAnimationFrame(this._boundFrame);
  };

  KoiPond.prototype.start = function () {
    if (this.running) return;
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
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeEventListener("pointerdown", this._boundFeedClick);
      this.canvas.parentElement.removeEventListener("click", this._boundFeedClick);
    }
    this.foodPellets = [];
    if (this.w && this.h) {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  };

  window.KoiPond = KoiPond;
})();
