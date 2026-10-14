(function () {
  "use strict";

  // The far side of the koi pond behind the contact section: a Chinese garden
  // against the sky the pond reflects. Misty hills, a whitewashed wall with a
  // moon gate, a pavilion hung with red lanterns, a Taihu rock, bamboo, and a
  // weeping willow in the breeze. Fireflies and a few stars at night; by day,
  // a dragonfly now and then and a little pollen in the light.

  var TAU = Math.PI * 2;
  var NARROW = 760; // below this width the garden uses its phone layout

  // Colors by day and in moonlight: [r, g, b] or [r, g, b, alpha].
  var DAY = {
    hillFar: [52, 92, 130, 0.26],
    hillNear: [44, 82, 118, 0.34],
    plaster: [238, 234, 225],
    plasterShade: [212, 205, 191],
    tile: [58, 64, 71],
    tileLight: [96, 103, 112],
    stone: [122, 128, 135],
    lattice: [74, 80, 88],
    roof: [47, 53, 60],
    roofUnder: [30, 34, 39],
    column: [163, 58, 44],
    beam: [122, 40, 32],
    trim: [201, 162, 74],
    rail: [110, 74, 58],
    lantern: [210, 62, 44],
    rock: [138, 147, 160],
    rockDark: [88, 97, 110],
    trunk: [66, 60, 52],
    willow: [120, 170, 88],
    bamboo: [98, 146, 76],
    bambooLeaf: [80, 128, 62],
  };
  var NIGHT = {
    hillFar: [12, 28, 58, 0.45],
    hillNear: [9, 22, 48, 0.6],
    plaster: [150, 162, 182],
    plasterShade: [116, 128, 150],
    tile: [20, 25, 33],
    tileLight: [40, 47, 58],
    stone: [58, 64, 74],
    lattice: [34, 40, 50],
    roof: [17, 21, 27],
    roofUnder: [10, 13, 17],
    column: [88, 36, 32],
    beam: [66, 28, 26],
    trim: [112, 94, 54],
    rail: [54, 38, 32],
    lantern: [200, 74, 44],
    rock: [64, 74, 88],
    rockDark: [38, 45, 57],
    trunk: [26, 26, 28],
    willow: [46, 80, 58],
    bamboo: [38, 68, 46],
    bambooLeaf: [32, 60, 40],
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function css(c, alpha) {
    var a = (c.length > 3 ? c[3] : 1) * (alpha == null ? 1 : alpha);
    return "rgba(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ", " + a.toFixed(3) + ")";
  }

  function mix(a, b, t) {
    return a.map(function (v, i) {
      return v + ((b[i] == null ? v : b[i]) - v) * t;
    });
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

  // A soft round glow for fireflies, pollen and lanterns.
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

  function isNight() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function ContactShore(section, canvas) {
    this.section = section;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fireGlow = makeGlow("214, 255, 120");
    this.sunGlow = makeGlow("255, 246, 214");
    this.lampGlow = makeGlow("255, 176, 96");
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
    this.visible = false;
    this.running = false;
    this.raf = 0;
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
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layout();
    this.paintLayers();
    if (!this.running) this.draw();
  };

  // Where everything goes. The middle stays low and open under the heading
  // and buttons; the pavilion stands on the left and the willow on the right.
  ContactShore.prototype.layout = function () {
    var w = this.w;
    var h = this.h;
    var u = h / 254;
    var narrow = w < NARROW;
    var rnd = seeded(1013);
    var i;
    this.u = u;
    this.narrow = narrow;
    this.wallTop = h - clamp(h * 0.18, 34, 52);
    // The wall rises in a gentle wave around the moon gate, like the cloud
    // walls of Suzhou gardens.
    var gx = w * (narrow ? 0.82 : 0.77);
    this.rise = { x: gx, half: (narrow ? 62 : 96) * u, height: (narrow ? 24 : 34) * u };
    var gr = (h - 8 - (this.wallTop - this.rise.height + 2)) * 0.4;
    this.gate = { x: gx, y: h - 8 - gr - 3 * u, r: gr };
    this.windows = narrow ? [w * 0.5] : [w * 0.2, w * 0.6];
    this.pavilion = { x: w * (narrow ? 0.13 : 0.1), s: u * (narrow ? 0.58 : 1) };

    // Two rows of distant hills, lower in the middle.
    this.hills = [
      { base: h - 58 * u, amp: 58 * u, f: [0.006, 0.017, 0.041], p: [0.3, 2.1, 4.4], color: "hillFar" },
      { base: h - 42 * u, amp: 34 * u, f: [0.009, 0.023, 0.053], p: [1.7, 0.4, 3.2], color: "hillNear" },
    ];

    // The willow stands at the right edge; its branches hang in from above.
    var x0 = w * (narrow ? 0.8 : 0.79);
    this.trunk = { x: w - 22 * u, top: -10 };
    this.strands = [];
    for (i = 0; i < (narrow ? 20 : 48); i++) {
      var ax = x0 + (w + 12 - x0) * Math.pow(rnd(), 0.8);
      var edge = (ax - x0) / (w - x0);
      this.strands.push({
        x: ax,
        y: (-16 + (1 - edge) * 20 + rnd() * 10) * u,
        len: (50 + rnd() * 150) * u * (0.45 + 0.55 * edge) * (narrow ? 0.8 : 1),
        phase: rnd() * TAU,
        curl: -0.35 + rnd() * 0.45,
        dark: rnd() < 0.45,
      });
    }

    // A Taihu rock and a clump of bamboo, left of the middle, on wide screens.
    this.rock = narrow ? null : { x: w * 0.29, rx: 19 * u, ry: 40 * u, bumps: [] };
    if (this.rock) {
      for (i = 0; i < 18; i++) this.rock.bumps.push(0.7 + rnd() * 0.42);
    }
    this.bamboo = [];
    if (!narrow) {
      for (i = 0; i < 5; i++) {
        var leaves = [];
        for (var k = 0; k < 9; k++) {
          leaves.push({ at: 0.62 + rnd() * 0.38, side: rnd() < 0.5 ? -1 : 1, ang: 0.35 + rnd() * 0.7, len: (11 + rnd() * 6) * u });
        }
        this.bamboo.push({ x: w * 0.335 + (i * 7 + rnd() * 4) * u, height: (88 + rnd() * 46) * u, lean: (rnd() - 0.4) * 0.12, phase: rnd() * TAU, leaves: leaves });
      }
    }

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
    this.stars = [];
    for (i = 0; i < Math.round(w / 14); i++) {
      this.stars.push({ x: rnd() * w, y: rnd() * h * 0.6, r: 0.4 + rnd() * 0.7, a: 0.25 + rnd() * 0.5, phase: rnd() * TAU });
    }
    this.motes = [];
    for (i = 0; i < Math.round(clamp(w / 120, 4, 12)); i++) {
      this.motes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-4, 4), vy: rand(-6, -2), phase: rand(0, TAU), r: rand(0.8, 1.6) });
    }
  };

  // The parts that never move are painted once for day and once for night:
  // behind the bamboo (hills, willow trunk, wall) and in front of it (rock, pavilion).
  ContactShore.prototype.paintLayers = function () {
    var self = this;
    ["day", "night"].forEach(function (when) {
      var P = when === "day" ? DAY : NIGHT;
      ["back", "front"].forEach(function (part) {
        var key = when + part;
        var c = self.layers[key] || (self.layers[key] = document.createElement("canvas"));
        c.width = self.canvas.width;
        c.height = self.canvas.height;
        var ctx = c.getContext("2d");
        ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
        if (part === "back") {
          self.paintHills(ctx, P);
          self.paintTrunk(ctx, P);
          self.paintWall(ctx, P);
        } else {
          if (self.rock) self.paintRock(ctx, P);
          self.paintPavilion(ctx, P);
        }
      });
    });
  };

  ContactShore.prototype.paintHills = function (ctx, P) {
    var w = this.w;
    var h = this.h;
    this.hills.forEach(function (hill) {
      var top = h;
      var pts = [];
      for (var x = -8; x <= w + 8; x += 6) {
        var f = hill.f;
        var n = 0.55 * Math.sin(x * f[0] + hill.p[0]) + 0.3 * Math.sin(x * f[1] + hill.p[1]) + 0.15 * Math.sin(x * f[2] + hill.p[2]);
        var side = Math.abs(x / w - 0.5) * 2;
        var y = hill.base - hill.amp * (0.5 + 0.5 * n) * (0.45 + 0.55 * side);
        pts.push([x, y]);
        top = Math.min(top, y);
      }
      // Ink-wash hills: darkest along the ridge, fading into mist below.
      var g = ctx.createLinearGradient(0, top, 0, hill.base + 20);
      g.addColorStop(0, css(P[hill.color]));
      g.addColorStop(1, css(P[hill.color], 0.25));
      ctx.fillStyle = g;
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

  ContactShore.prototype.paintTrunk = function (ctx, P) {
    var u = this.u;
    var t = this.trunk;
    var base = this.wallTop + 4;
    ctx.fillStyle = css(P.trunk);
    ctx.beginPath();
    ctx.moveTo(t.x - 7 * u, base);
    ctx.quadraticCurveTo(t.x - 12 * u, base * 0.5, t.x - 2 * u, t.top);
    ctx.lineTo(t.x + 9 * u, t.top);
    ctx.quadraticCurveTo(t.x + 2 * u, base * 0.5, t.x + 7 * u, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(P.trunk);
    ctx.lineCap = "round";
    ctx.lineWidth = 3.5 * u;
    // On phones the limbs stay short, clear of the heading.
    var reach = this.narrow ? 0.45 : 1;
    ctx.beginPath();
    ctx.moveTo(t.x - 6 * u, base * 0.42);
    ctx.quadraticCurveTo(t.x - 40 * u * reach, base * 0.2, t.x - 80 * u * reach, 8 * u);
    ctx.moveTo(t.x - 4 * u, base * 0.22);
    ctx.quadraticCurveTo(t.x - 24 * u * reach, 6 * u, t.x - 46 * u * reach, -4 * u);
    ctx.stroke();
  };

  // Height of the wall's top edge at x.
  ContactShore.prototype.wallAt = function (x) {
    var r = this.rise;
    var d = clamp((x - r.x) / r.half, -1, 1);
    return this.wallTop - r.height * (0.5 + 0.5 * Math.cos(Math.PI * d));
  };

  // A whitewashed wall with a dark tile coping, a moon gate and lattice windows.
  ContactShore.prototype.paintWall = function (ctx, P) {
    var w = this.w;
    var h = this.h;
    var u = this.u;
    var g = this.gate;
    var x;
    var top = [];
    for (x = 0; x <= w + 4; x += 4) top.push([x, this.wallAt(x)]);
    var body = ctx.createLinearGradient(0, this.wallTop - this.rise.height, 0, h - 6);
    body.addColorStop(0, css(P.plaster));
    body.addColorStop(1, css(P.plasterShade));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, h - 6);
    top.forEach(function (p) {
      ctx.lineTo(p[0], p[1] + 2);
    });
    ctx.lineTo(w + 4, h - 6);
    ctx.closePath();
    ctx.moveTo(g.x + g.r, g.y);
    ctx.arc(g.x, g.y, g.r, 0, TAU, true);
    ctx.fill("evenodd");
    ctx.strokeStyle = css(P.stone);
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r + 1.4 * u, 0, TAU);
    ctx.stroke();

    var wallTop = this.wallTop;
    this.windows.forEach(function (wx) {
      var ww = 30 * u;
      var wh = 18 * u;
      var wy = wallTop + 2 + (h - 8 - wallTop - wh) / 2;
      ctx.save();
      ctx.fillStyle = css(P.lattice);
      ctx.fillRect(wx - ww / 2, wy, ww, wh);
      ctx.fillStyle = css(P.plasterShade);
      ctx.fillRect(wx - ww / 2 + 2 * u, wy + 2 * u, ww - 4 * u, wh - 4 * u);
      ctx.beginPath();
      ctx.rect(wx - ww / 2 + 2 * u, wy + 2 * u, ww - 4 * u, wh - 4 * u);
      ctx.clip();
      ctx.strokeStyle = css(P.lattice);
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      for (var d = -wh; d < ww + wh; d += 5 * u) {
        ctx.moveTo(wx - ww / 2 + d, wy);
        ctx.lineTo(wx - ww / 2 + d - wh, wy + wh);
        ctx.moveTo(wx - ww / 2 + d - wh, wy);
        ctx.lineTo(wx - ww / 2 + d, wy + wh);
      }
      ctx.stroke();
      ctx.restore();
    });

    // The coping: a little roof of dark tiles following the top of the wall.
    function band(above, below, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      top.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p[0], p[1] - above);
        else ctx.lineTo(p[0], p[1] - above);
      });
      for (var i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + below);
      ctx.closePath();
      ctx.fill();
    }
    band(-2, 5 * u, "rgba(0, 0, 0, 0.12)");
    band(5 * u, 2, css(P.tile));
    band(6.5 * u, -4.5 * u, css(P.tileLight));
    ctx.strokeStyle = css(P.tileLight, 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (x = 2; x < w; x += 5 * u) {
      var y = this.wallAt(x);
      ctx.moveTo(x, y - 4 * u);
      ctx.lineTo(x, y + 2);
    }
    ctx.stroke();

    ctx.fillStyle = css(P.stone);
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, h - 6, w, 1);
  };

  // A Taihu rock: weathered limestone full of hollows.
  ContactShore.prototype.paintRock = function (ctx, P) {
    var r = this.rock;
    var u = this.u;
    var cx = r.x;
    var cy = this.h - r.ry * 0.95;
    var n = r.bumps.length;
    var pts = r.bumps.map(function (b, i) {
      var a = (i / n) * TAU;
      return [cx + Math.cos(a) * r.rx * b, cy + Math.sin(a) * r.ry * b];
    });
    var g = ctx.createLinearGradient(cx - r.rx, cy - r.ry, cx + r.rx, cy + r.ry);
    g.addColorStop(0, css(P.rock));
    g.addColorStop(1, css(P.rockDark));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var p = pts[i];
      var q = pts[(i + 1) % n];
      var mx = (p[0] + q[0]) / 2;
      var my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(P.rockDark, 0.9);
    [[-5, -20, 4, 6], [6, -6, 3.5, 5], [-4, 6, 3, 4.5], [5, 18, 2.6, 3.5]].forEach(function (hole) {
      ctx.beginPath();
      ctx.ellipse(cx + hole[0] * u, cy + hole[1] * u, hole[2] * u, hole[3] * u, 0.3, 0, TAU);
      ctx.fill();
    });
    ctx.fillRect(cx - r.rx * 1.1, this.h - 6, r.rx * 2.2, 6);
  };

  // A pavilion (亭) with sweeping, upturned eaves, red columns and two lanterns.
  ContactShore.prototype.paintPavilion = function (ctx, P) {
    var p = this.pavilion;
    var x = p.x;
    var s = p.s;
    var h = this.h;
    var floor = h - 12 * s;
    var colTop = floor - 70 * s;
    var eave = colTop - 9 * s;

    ctx.fillStyle = css(P.stone);
    ctx.fillRect(x - 64 * s, floor, 128 * s, h - floor);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x - 64 * s, floor, 128 * s, 1.5 * s);

    ctx.fillStyle = css(P.column, 0.85);
    [-16, 16].forEach(function (dx) {
      ctx.fillRect(x + dx * s - 2 * s, colTop, 4 * s, floor - colTop);
    });
    ctx.fillStyle = css(P.rail);
    ctx.fillRect(x - 44 * s, floor - 19 * s, 88 * s, 3 * s);
    ctx.fillRect(x - 44 * s, floor - 5 * s, 88 * s, 2.5 * s);
    for (var b = -40; b <= 40; b += 6) ctx.fillRect(x + b * s - 0.7 * s, floor - 17 * s, 1.4 * s, 12 * s);
    ctx.fillStyle = css(P.column);
    [-44, 44].forEach(function (dx) {
      ctx.fillRect(x + dx * s - 2.8 * s, colTop, 5.6 * s, floor - colTop);
    });

    // Beam with a gold line, and the carved lattice frieze hanging beneath it.
    ctx.fillStyle = css(P.beam);
    ctx.fillRect(x - 52 * s, colTop - 7 * s, 104 * s, 7 * s);
    ctx.fillStyle = css(P.trim);
    ctx.fillRect(x - 52 * s, colTop - 4.5 * s, 104 * s, 1.2 * s);
    ctx.strokeStyle = css(P.rail);
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.rect(x - 41 * s, colTop, 82 * s, 5 * s);
    for (var f = -41; f < 41; f += 5) {
      ctx.moveTo(x + f * s, colTop);
      ctx.lineTo(x + (f + 2.5) * s, colTop + 5 * s);
      ctx.lineTo(x + (f + 5) * s, colTop);
    }
    ctx.stroke();

    // The roof: concave slopes sweeping up to curled tips, tiles running down it.
    ctx.beginPath();
    ctx.moveTo(x - 88 * s, eave - 17 * s);
    ctx.quadraticCurveTo(x - 68 * s, eave + 2 * s, x - 46 * s, eave + 2 * s);
    ctx.lineTo(x + 46 * s, eave + 2 * s);
    ctx.quadraticCurveTo(x + 68 * s, eave + 2 * s, x + 88 * s, eave - 17 * s);
    ctx.quadraticCurveTo(x + 40 * s, eave - 12 * s, x + 9 * s, eave - 58 * s);
    ctx.lineTo(x - 9 * s, eave - 58 * s);
    ctx.quadraticCurveTo(x - 40 * s, eave - 12 * s, x - 88 * s, eave - 17 * s);
    ctx.closePath();
    ctx.fillStyle = css(P.roof);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = css(P.roofUnder, 0.45);
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (var k = -12; k <= 12; k++) {
      ctx.moveTo(x + k * 1.2 * s, eave - 58 * s);
      ctx.lineTo(x + k * 7.2 * s, eave + 2 * s);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = css(P.roofUnder);
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 86 * s, eave - 15 * s);
    ctx.quadraticCurveTo(x - 68 * s, eave + 1 * s, x - 46 * s, eave + 1 * s);
    ctx.lineTo(x + 46 * s, eave + 1 * s);
    ctx.quadraticCurveTo(x + 68 * s, eave + 1 * s, x + 86 * s, eave - 15 * s);
    ctx.stroke();
    ctx.strokeStyle = css(P.roof);
    ctx.lineWidth = 2 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 88 * s, eave - 17 * s);
    ctx.quadraticCurveTo(x - 92 * s, eave - 21 * s, x - 90 * s, eave - 25 * s);
    ctx.moveTo(x + 88 * s, eave - 17 * s);
    ctx.quadraticCurveTo(x + 92 * s, eave - 21 * s, x + 90 * s, eave - 25 * s);
    ctx.stroke();

    // Ridge and a gold finial on top.
    ctx.fillStyle = css(P.roofUnder);
    ctx.fillRect(x - 11 * s, eave - 61 * s, 22 * s, 4 * s);
    ctx.fillStyle = css(P.trim);
    ctx.beginPath();
    ctx.arc(x, eave - 65 * s, 3.2 * s, 0, TAU);
    ctx.arc(x, eave - 70.5 * s, 2.1 * s, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - 0.6 * s, eave - 78 * s, 1.2 * s, 6 * s);

    // Red lanterns under the front corners.
    p.lanterns = [];
    [-44, 44].forEach(function (dx) {
      var lx = x + dx * s;
      var ly = eave + 17 * s;
      ctx.strokeStyle = css(P.roofUnder);
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(lx, eave + 3 * s);
      ctx.lineTo(lx, ly - 7 * s);
      ctx.moveTo(lx, ly + 8 * s);
      ctx.lineTo(lx, ly + 14 * s);
      ctx.stroke();
      ctx.fillStyle = css(P.lantern);
      ctx.beginPath();
      ctx.ellipse(lx, ly, 6 * s, 7.5 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = css(P.trim);
      ctx.fillRect(lx - 2.5 * s, ly - 8.5 * s, 5 * s, 2 * s);
      ctx.fillRect(lx - 2.5 * s, ly + 6.5 * s, 5 * s, 2 * s);
      p.lanterns.push({ x: lx, y: ly });
    });
  };

  // Bamboo sways a little, its leaves in sprigs near the top.
  ContactShore.prototype.drawBamboo = function (ctx, P) {
    var h = this.h;
    var u = this.u;
    var t = this.time;
    var still = this.still;
    this.bamboo.forEach(function (c) {
      var sway = still ? 0 : (Math.sin(t * 0.8 + c.phase) * 3 + Math.sin(t * 1.9 + c.phase) * 0.8) * (c.height / 120);
      var bx = c.x;
      var by = h - 6;
      var tx = bx + c.lean * c.height + sway;
      var ty = by - c.height;
      ctx.strokeStyle = css(P.bamboo);
      ctx.lineWidth = 2.6 * u;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + (tx - bx) * 0.3, by - c.height * 0.5, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = css(P.bambooLeaf);
      ctx.lineWidth = 3.4 * u;
      ctx.beginPath();
      for (var k = 14 * u; k < c.height - 6 * u; k += 15 * u) {
        var f = k / c.height;
        var nx = bx + (tx - bx) * f * f;
        var ny = by - k;
        ctx.moveTo(nx - 1.7 * u, ny);
        ctx.lineTo(nx + 1.7 * u, ny);
      }
      ctx.lineWidth = 0.9 * u;
      ctx.stroke();
      ctx.fillStyle = css(P.bambooLeaf);
      c.leaves.forEach(function (l) {
        var lx = bx + (tx - bx) * l.at * l.at;
        var ly = by - c.height * l.at;
        var a = l.side > 0 ? l.ang : Math.PI - l.ang;
        var ex = lx + Math.cos(a) * l.len;
        var ey = ly + Math.sin(a) * l.len * 0.6;
        var nx = -Math.sin(a) * 1.4 * u;
        var ny = Math.cos(a) * 1.4 * u;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo((lx + ex) / 2 + nx, (ly + ey) / 2 + ny, ex, ey);
        ctx.quadraticCurveTo((lx + ex) / 2 - nx, (ly + ey) / 2 - ny, lx, ly);
        ctx.fill();
      });
    });
  };

  // The willow's long branches hang and sway, little leaves along each one,
  // in two shades so some branches seem nearer than others.
  ContactShore.prototype.drawWillow = function (ctx, P) {
    var u = this.u;
    var t = this.time;
    var still = this.still;
    var gust = 0.7 + 0.3 * Math.sin(t * 0.33);
    var near = new Path2D();
    var far = new Path2D();
    this.strands.forEach(function (s) {
      var sway = still ? 0 : (Math.sin(t * 0.7 + s.phase) * 6 + Math.sin(t * 1.7 + s.phase * 1.3) * 2) * (s.len / 150) * gust;
      var tipX = s.x + sway + s.curl * s.len * 0.35;
      var tipY = s.y + s.len;
      var path = s.dark ? far : near;
      path.moveTo(s.x, s.y);
      path.bezierCurveTo(s.x + sway * 0.05, s.y + s.len * 0.35, s.x + sway * 0.5 + s.curl * s.len * 0.05, s.y + s.len * 0.75, tipX, tipY);
    });
    ctx.lineCap = "round";
    [[far, 0.55], [near, 0.95]].forEach(function (pair) {
      ctx.strokeStyle = css(pair[1] < 0.9 ? mix(P.willow, [30, 60, 40], 0.35) : P.willow, pair[1]);
      ctx.lineWidth = 0.7 * u;
      ctx.stroke(pair[0]);
      ctx.setLineDash([2.2 * u, 2.6 * u]);
      ctx.lineWidth = 2.3 * u;
      ctx.stroke(pair[0]);
      ctx.setLineDash([]);
    });
  };

  ContactShore.prototype.drawLanternGlow = function (ctx) {
    var lanterns = this.pavilion.lanterns || [];
    var s = this.pavilion.s;
    var t = this.time;
    lanterns.forEach(function (l, i) {
      var flicker = this.still ? 1 : 0.9 + 0.1 * Math.sin(t * 3.1 + i * 2.3) + 0.05 * Math.sin(t * 7.7 + i);
      ctx.globalAlpha = this.night * 0.7 * flicker;
      var r = 30 * s;
      ctx.drawImage(this.lampGlow, l.x - r, l.y - r, r * 2, r * 2);
      ctx.globalAlpha = this.night * 0.55;
      ctx.fillStyle = "rgb(255, 196, 120)";
      ctx.beginPath();
      ctx.ellipse(l.x, l.y, 4 * s, 5.5 * s, 0, 0, TAU);
      ctx.fill();
    }, this);
    ctx.globalAlpha = 1;
  };

  ContactShore.prototype.drawLayer = function (ctx, part) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.night < 1) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.layers["day" + part], 0, 0);
    }
    if (this.night > 0) {
      ctx.globalAlpha = this.night;
      ctx.drawImage(this.layers["night" + part], 0, 0);
    }
    ctx.restore();
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
    stops.push({ x: fromLeft ? w + 40 : -40, y: h * rand(0.2, 0.6) });
    this.dragonfly = { x: fromLeft ? -40 : w + 40, y: h * rand(0.3, 0.6), stops: stops, wait: 0, face: fromLeft ? 1 : -1 };
  };

  ContactShore.prototype.updateDragonfly = function (dt) {
    var d = this.dragonfly;
    if (!d) {
      if (this.night < 0.5 && this.time >= this.nextDragonfly) this.spawnDragonfly();
      return;
    }
    if (d.wait > 0) {
      d.wait -= dt;
      return;
    }
    var target = d.stops[0];
    var dx = target.x - d.x;
    var dy = target.y - d.y;
    var dist = Math.hypot(dx, dy);
    var step = 260 * dt;
    if (dx) d.face = dx > 0 ? 1 : -1;
    if (dist <= step) {
      d.x = target.x;
      d.y = target.y;
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
    var hovering = d.wait > 0;
    var x = d.x + (hovering ? Math.sin(t * 5) * 1.2 : 0);
    var y = d.y + (hovering ? Math.sin(t * 7.3) * 1.5 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d.face * 1.25, 1.25);
    ctx.rotate(hovering ? 0 : -0.08);
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
    this.updateDragonfly(dt);
  };

  ContactShore.prototype.draw = function () {
    var ctx = this.ctx;
    var n = this.night;
    var P = {
      willow: mix(DAY.willow, NIGHT.willow, n),
      bamboo: mix(DAY.bamboo, NIGHT.bamboo, n),
      bambooLeaf: mix(DAY.bambooLeaf, NIGHT.bambooLeaf, n),
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (n > 0) this.drawStars(ctx);
    this.drawLayer(ctx, "back");
    if (n < 1) this.drawMotes(ctx);
    this.drawBamboo(ctx, P);
    this.drawLayer(ctx, "front");
    this.drawWillow(ctx, P);
    if (n > 0) this.drawLanternGlow(ctx);
    if (this.dragonfly) this.drawDragonfly(ctx);
    if (n > 0) this.drawFireflies(ctx);
  };

  ContactShore.prototype.frame = function (now) {
    this.raf = 0;
    if (!this.running) return;
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
  if (!section || !canvas || !canvas.getContext) return;
  new ContactShore(section, canvas).start();
})();
