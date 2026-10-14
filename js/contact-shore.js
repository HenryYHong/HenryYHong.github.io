(function () {
  "use strict";

  // The pond's shore behind the contact section: reeds and cattails swaying in
  // the breeze, fireflies at night and, by day, a dragonfly now and then and a
  // little pollen drifting in the light.

  var TAU = Math.PI * 2;

  // Day and night colors for the back and front rows of reeds and the cattail heads.
  var DAY = { back: [47, 104, 72], front: [14, 42, 27], head: [58, 40, 24] };
  var NIGHT = { back: [24, 56, 38], front: [6, 18, 11], head: [30, 22, 14] };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function mixColor(a, b, t) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + ", " + Math.round(a[1] + (b[1] - a[1]) * t) + ", " + Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }

  // Seeded random numbers, so the reeds grow the same way every visit.
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
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.last = 0;
    this.night = isNight() ? 1 : 0;
    this.blades = [];
    this.cattails = [];
    this.fireflies = [];
    this.motes = [];
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
    this.grow();
    if (!this.running) this.draw();
  };

  // Reeds are tall at the sides and low in the middle, under the heading and
  // buttons. Cattails stand among the tall reeds at the sides.
  ContactShore.prototype.grow = function () {
    var w = this.w;
    var h = this.h;
    var rnd = seeded(1013);
    function tall(x) {
      var f = x / w;
      return Math.max(smoothstep(0.34, 0.04, f), smoothstep(0.66, 0.96, f));
    }
    this.blades = [];
    [
      { layer: 0, step: 5, lo: 0.14, hi: 0.62, width: 2.4 },
      { layer: 1, step: 7, lo: 0.1, hi: 0.5, width: 3.2 },
    ].forEach(function (row) {
      for (var x = -10; x < w + 10; x += row.step * (0.6 + rnd() * 0.8)) {
        var height = h * (row.lo + (row.hi - row.lo) * tall(x)) * (0.55 + rnd() * 0.6);
        this.blades.push({
          layer: row.layer,
          x: x,
          height: height,
          width: row.width * (0.7 + rnd() * 0.6),
          lean: (rnd() - 0.5) * 0.5,
          phase: rnd() * TAU,
          sway: 0.6 + rnd() * 0.8,
        });
      }
    }, this);
    this.cattails = [];
    for (var x = 8; x < w; x += 26 + rnd() * 50) {
      if (tall(x) < 0.55) continue;
      this.cattails.push({
        x: x,
        height: h * (0.45 + rnd() * 0.3) * (0.7 + 0.3 * tall(x)),
        head: 13 + rnd() * 7,
        lean: (rnd() - 0.5) * 0.25,
        phase: rnd() * TAU,
      });
    }
    var count = Math.round(clamp(w / 75, 6, 18));
    this.fireflies = [];
    for (var i = 0; i < count; i++) {
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
    this.motes = [];
    for (var j = 0; j < Math.round(clamp(w / 120, 4, 12)); j++) {
      this.motes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-4, 4), vy: rand(-6, -2), phase: rand(0, TAU), r: rand(0.8, 1.6) });
    }
  };

  // How far the breeze bends a stem of the given height at this moment.
  ContactShore.prototype.bend = function (x, height, phase, sway) {
    if (this.still) return 0;
    var t = this.time;
    var gust = 0.65 + 0.35 * Math.sin(t * 0.37 + x * 0.004);
    return (Math.sin(t * 0.9 * sway + x * 0.012 + phase) * 4 + Math.sin(t * 2.1 + phase * 2) * 1.2) * gust * (height / 100);
  };

  ContactShore.prototype.drawReeds = function (ctx) {
    var h = this.h;
    [0, 1].forEach(function (layer) {
      ctx.fillStyle = mixColor(DAY[layer ? "front" : "back"], NIGHT[layer ? "front" : "back"], this.night);
      ctx.beginPath();
      this.blades.forEach(function (b) {
        if (b.layer !== layer) return;
        var tipX = b.x + b.lean * b.height + this.bend(b.x, b.height, b.phase, b.sway);
        var tipY = h - b.height;
        var midX = b.x + (tipX - b.x) * 0.35;
        var midY = h - b.height * 0.55;
        ctx.moveTo(b.x - b.width / 2, h + 2);
        ctx.quadraticCurveTo(midX - b.width * 0.3, midY, tipX, tipY);
        ctx.quadraticCurveTo(midX + b.width * 0.3, midY, b.x + b.width / 2, h + 2);
        ctx.closePath();
      }, this);
      ctx.fill();
      if (layer === 1) this.drawCattails(ctx);
    }, this);
  };

  ContactShore.prototype.drawCattails = function (ctx) {
    var h = this.h;
    var stem = mixColor(DAY.front, NIGHT.front, this.night);
    var head = mixColor(DAY.head, NIGHT.head, this.night);
    this.cattails.forEach(function (c) {
      var topX = c.x + c.lean * c.height + this.bend(c.x, c.height, c.phase, 0.8);
      var topY = h - c.height;
      var dx = topX - c.x;
      var len = Math.hypot(dx, c.height);
      var ux = dx / len;
      var uy = -c.height / len;
      ctx.strokeStyle = stem;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c.x, h + 2);
      ctx.quadraticCurveTo(c.x + dx * 0.3, h - c.height * 0.5, topX + ux * 10, topY + uy * 10);
      ctx.stroke();
      // The brown head sits a little below the tip, with the thin spike above it.
      ctx.save();
      ctx.translate(topX, topY);
      ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.moveTo(-2.4, 0);
      ctx.lineTo(-2.4, c.head - 2.4);
      ctx.arc(0, c.head - 2.4, 2.4, Math.PI, 0, true);
      ctx.lineTo(2.4, 0);
      ctx.arc(0, 0, 2.4, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }, this);
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

  ContactShore.prototype.drawDragonfly = function (ctx) {
    var d = this.dragonfly;
    var t = this.time;
    // A little bob while it hovers.
    var x = d.x + (d.wait > 0 ? Math.sin(t * 5) * 1.2 : 0);
    var y = d.y + (d.wait > 0 ? Math.sin(t * 7.3) * 1.5 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d.face, 1);
    ctx.globalAlpha = 1 - this.night;
    var flick = 0.55 + 0.45 * Math.abs(Math.sin(t * 60));
    ctx.fillStyle = "rgba(225, 242, 255, " + (0.35 * flick).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(1, -4.5, 8, 2.2, -0.35, 0, TAU);
    ctx.ellipse(-3, -4, 7, 2, -0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1d6f86";
    ctx.beginPath();
    ctx.ellipse(-9, 0.6, 9, 1.1, 0.06, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2a8fa8";
    ctx.beginPath();
    ctx.ellipse(1.5, 0, 3.2, 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#24576a";
    ctx.beginPath();
    ctx.arc(5.2, -0.3, 1.9, 0, TAU);
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.night < 1) this.drawMotes(ctx);
    this.drawReeds(ctx);
    if (this.dragonfly) this.drawDragonfly(ctx);
    if (this.night > 0) this.drawFireflies(ctx);
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
