(function () {
  "use strict";

  // The far side of the koi pond behind the contact section: the sky the pond
  // reflects, soft layers of misty hills, and a weeping willow at the edge
  // swaying in the breeze. Fireflies and a few stars at night; by day, a
  // dragonfly now and then and a little pollen in the light.

  var TAU = Math.PI * 2;
  var NARROW = 760; // below this width the garden uses its phone layout

  // Colors by day and in moonlight: [r, g, b] or [r, g, b, alpha].
  var DAY = {
    hillFar: [66, 106, 146, 0.3],
    hillMid: [50, 88, 126, 0.48],
    hillNear: [34, 64, 94, 1],
    trunk: [52, 50, 46],
    willow: [120, 170, 88],
  };
  var NIGHT = {
    hillFar: [16, 34, 66, 0.5],
    hillMid: [11, 26, 54, 0.72],
    hillNear: [7, 16, 34, 1],
    trunk: [20, 22, 26],
    willow: [46, 80, 58],
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

  function isNight() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function ContactShore(section, canvas) {
    this.section = section;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fireGlow = makeGlow("214, 255, 120");
    this.sunGlow = makeGlow("255, 246, 214");
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
  // and buttons; the willow stands on the right.
  ContactShore.prototype.layout = function () {
    var w = this.w;
    var h = this.h;
    var u = h / 254;
    var narrow = w < NARROW;
    var rnd = seeded(1013);
    var i;
    this.u = u;
    this.narrow = narrow;
    // Three rows of hills, lower in the middle under the heading and buttons:
    // two misty ones in the distance and a darker one near the water.
    this.hills = [
      { base: h - 62 * u, amp: 64 * u, f: [0.006, 0.017, 0.041], p: [0.3, 2.1, 4.4], color: "hillFar", mist: true },
      { base: h - 36 * u, amp: 42 * u, f: [0.009, 0.023, 0.053], p: [1.7, 0.4, 3.2], color: "hillMid", mist: true },
      { base: h - 12 * u, amp: 26 * u, f: [0.011, 0.029, 0.067], p: [2.6, 1.1, 0.7], color: "hillNear", mist: false },
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

  // The hills and the willow's trunk never move, so they're painted once for
  // day and once for night. The trunk stands behind the nearest hills.
  ContactShore.prototype.paintLayers = function () {
    var self = this;
    ["day", "night"].forEach(function (when) {
      var P = when === "day" ? DAY : NIGHT;
      var c = self.layers[when] || (self.layers[when] = document.createElement("canvas"));
      c.width = self.canvas.width;
      c.height = self.canvas.height;
      var ctx = c.getContext("2d");
      ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
      self.paintHills(ctx, P, self.hills.slice(0, 2));
      self.paintTrunk(ctx, P);
      self.paintHills(ctx, P, self.hills.slice(2));
    });
  };

  ContactShore.prototype.paintHills = function (ctx, P, hills) {
    var w = this.w;
    var h = this.h;
    hills.forEach(function (hill) {
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

  ContactShore.prototype.paintTrunk = function (ctx, P) {
    var u = this.u;
    var t = this.trunk;
    var base = this.h;
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

  ContactShore.prototype.drawLayer = function (ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.night < 1) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.layers.day, 0, 0);
    }
    if (this.night > 0) {
      ctx.globalAlpha = this.night;
      ctx.drawImage(this.layers.night, 0, 0);
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
    var P = { willow: mix(DAY.willow, NIGHT.willow, n) };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (n > 0) this.drawStars(ctx);
    this.drawLayer(ctx);
    if (n < 1) this.drawMotes(ctx);
    this.drawWillow(ctx, P);
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
