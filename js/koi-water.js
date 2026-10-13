(function () {
  "use strict";

  // WebGL water for the koi pond. The pond draws fish and lily pads into
  // ordinary 2D canvases; this composites them under a moving water surface:
  // a pond floor lit by caustics, soft shadows, refraction, sky reflection and
  // sun glints, plus a small wave simulation for ripples you can make by clicking.

  var VERT = [
    "attribute vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes;",
    "uniform float uDpr;",
    "uniform float uTime;",
    "uniform float uTop;",
    "uniform float uNight;",
    "uniform vec2 uGrid;",
    "uniform float uCell;",
    "uniform sampler2D uFish;",
    "uniform sampler2D uPads;",
    "uniform sampler2D uRipple;",
    "uniform vec4 uDrops[12];",

    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    // Distance to the nearest edge between drifting cells. Sunlight focused by
    // the waves gathers along those edges, which is the net of light on a pond floor.
    "float cells(vec2 p, float t) {",
    "  vec2 i = floor(p); vec2 f = fract(p);",
    "  float d1 = 8.0; float d2 = 8.0;",
    "  for (int y = -1; y <= 1; y++) {",
    "    for (int x = -1; x <= 1; x++) {",
    "      vec2 c = vec2(float(x), float(y));",
    "      vec2 h = vec2(hash(i + c), hash(i + c + 31.7));",
    "      vec2 r = c + 0.5 + 0.38 * sin(t + 6.2831853 * h) - f;",
    "      float d = dot(r, r);",
    "      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }",
    "    }",
    "  }",
    "  return sqrt(d2) - sqrt(d1);",
    "}",
    "float fbm(vec2 p) {",
    "  float s = 0.0; float a = 0.5;",
    "  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }",
    "  return s;",
    "}",

    // One travelling wave; g collects how far it bends light reaching the floor, in px.
    "void wave(vec2 p, float ang, float lambda, float s, float speed, float ph, inout vec2 g) {",
    "  vec2 d = vec2(cos(ang), sin(ang));",
    "  float k = 6.2831853 / lambda;",
    "  g += d * (s / k) * cos(k * (dot(d, p) - speed * uTime) + ph);",
    "}",


    "float soft(sampler2D tex, vec2 p, float r) {",
    "  vec2 px = 1.0 / uRes;",
    "  float d = r * 0.7071;",
    "  float a = texture2D(tex, p * px).a * 0.2;",
    "  a += texture2D(tex, (p + vec2(r, 0.0)) * px).a * 0.1;",
    "  a += texture2D(tex, (p - vec2(r, 0.0)) * px).a * 0.1;",
    "  a += texture2D(tex, (p + vec2(0.0, r)) * px).a * 0.1;",
    "  a += texture2D(tex, (p - vec2(0.0, r)) * px).a * 0.1;",
    "  a += texture2D(tex, (p + vec2(d, d)) * px).a * 0.1;",
    "  a += texture2D(tex, (p - vec2(d, d)) * px).a * 0.1;",
    "  a += texture2D(tex, (p + vec2(d, -d)) * px).a * 0.1;",
    "  a += texture2D(tex, (p - vec2(d, -d)) * px).a * 0.1;",
    "  return a;",
    "}",

    "void main() {",
    "  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;",
    "  vec2 uv = p / uRes;",

    // Gentle swell that never stops.
    "  vec2 g = vec2(0.0);",
    "  wave(p, 0.35, 118.0, 0.24, 6.0, 0.0, g);",
    "  wave(p, 1.45, 97.0, 0.22, 7.5, 1.7, g);",
    "  wave(p, 2.30, 134.0, 0.21, 5.5, 4.1, g);",
    "  wave(p, 3.55, 86.0, 0.19, 8.0, 2.6, g);",
    "  wave(p, 4.60, 107.0, 0.2, 6.5, 5.3, g);",
    "  wave(p, 5.50, 76.0, 0.17, 8.5, 3.3, g);",

    // Ripples from feeding and from the fish, simulated on the CPU.
    "  vec4 rip = texture2D(uRipple, (p / uCell + 1.0) / uGrid);",
    "  vec2 rg = (rip.rg - 0.5) * 48.0;",
    "  float rl = (rip.a - 0.5) * 6.0;",
    "  g += rg * 0.6;",
    // Food landing and fish feeding: small rings, too fine for the simulation grid,
    // drawn directly. Each one is a crest with a smaller one behind it.
    "  vec2 dropG = vec2(0.0);",
    "  for (int i = 0; i < 12; i++) {",
    "    vec4 d = uDrops[i];",
    "    float age = uTime - d.z;",
    "    if (d.w <= 0.0 || age < 0.0 || age > 1.2) continue;",
    "    vec2 off = p - d.xy;",
    "    float dist = length(off);",
    "    float rad = 2.0 + 20.0 * age;",
    "    float wid = 1.3 + 1.5 * age;",
    "    float x1 = (dist - rad) / wid;",
    "    float x2 = (dist - rad * 0.6) / wid;",
    "    float wv = (x1 * exp(-x1 * x1) + 0.5 * x2 * exp(-x2 * x2)) * exp(-age * 3.2) * d.w;",
    "    dropG += off / max(dist, 0.5) * wv;",
    "  }",
    "  g += dropG;",
    // A ripple crest is a weak lens: a little brighter floor under it, darker under the trough.
    "  float ringLight = clamp(1.0 / ((1.0 + 0.5 * rl) * (1.0 + 0.5 * rl)), 0.6, 1.6);",

    // Fine wind ripples: they only catch the sun, they are too small to focus light.
    // A breeze ruffles patches of the surface; the heading's patch stays calm.
    "  vec2 mid = (p - vec2(uRes.x * 0.5, (uTop + uRes.y) * 0.5)) / vec2(260.0, 70.0);",
    "  float breeze = smoothstep(0.5, 0.85, noise(p * 0.005 + vec2(uTime * 0.05, -uTime * 0.03)));",
    "  breeze *= smoothstep(0.8, 1.6, length(mid));",
    "  vec2 bq = p * 0.09 + vec2(uTime * 0.6, uTime * 0.25);",
    "  float b0 = noise(bq);",
    "  vec2 gw = vec2(noise(bq + vec2(0.05, 0.0)) - b0, noise(bq + vec2(0.0, 0.05)) - b0) * 20.0;",
    "  vec2 slope = g / 110.0 + gw * breeze * 0.09;",

    // Pond floor: silt and stone seen through clear water.
    "  vec2 fp = p + g * 0.16;",
    "  float vis = clamp((p.y - uTop) / max(uRes.y - uTop, 1.0), 0.0, 1.0);",
    "  float big = fbm(fp * 0.003 + vec2(3.7, 1.3));",
    // Sunny light blue by day, deep blue in night mode.
    "  float day = 1.0 - uNight;",
    "  vec3 shallow = mix(vec3(0.38, 0.65, 0.86), vec3(0.14, 0.34, 0.56), uNight);",
    "  vec3 deep = mix(vec3(0.17, 0.42, 0.66), vec3(0.04, 0.12, 0.29), uNight);",
    "  vec3 bed = mix(shallow, deep, clamp(vis * 0.9 + (big - 0.5) * 0.5, 0.0, 1.0));",
    "  bed *= 0.86 + 0.2 * fbm(fp * 0.02 + vec2(9.2, 4.4));",
    "  float mud = smoothstep(0.45, 0.75, fbm(fp * 0.006 + vec2(1.9, 7.3)));",
    "  vec3 silt = mix(vec3(0.3, 0.38, 0.48), vec3(0.16, 0.22, 0.32), uNight);",
    "  bed = mix(bed, silt * (1.1 - vis * 0.6), mud * 0.25);",

    "  float fishSh = soft(uFish, fp - vec2(11.0, 14.0), 5.5);",
    "  float padSh = soft(uPads, fp - vec2(15.0, 19.0), 7.0);",
    "  float sh = clamp(fishSh * 0.75 + padSh * 0.85, 0.0, 0.9);",
    // Light on the floor. In a pond it is faint and broken: soft wavy threads
    // that come and go, over broad patches of sun and shade from the trees.
    "  vec2 cp = fp * 0.012;",
    "  cp += (vec2(noise(cp * 0.8 + uTime * 0.025), noise(cp * 0.8 + 7.7 - uTime * 0.02)) - 0.5) * 1.7;",
    "  float e1 = cells(cp, uTime * 0.09);",
    "  float thick = 0.7 + 0.6 * noise(cp * 1.3 + vec2(uTime * 0.03, 3.0));",
    "  vec3 lw = vec3(0.15, 0.17, 0.19) * thick;",
    "  vec3 c1 = 1.0 - smoothstep(vec3(0.0), lw, vec3(e1));",
    "  float threads = smoothstep(0.4, 0.75, noise(cp * 0.6 + vec2(uTime * 0.025, 1.0)));",
    "  vec3 caust = c1 * c1 * threads;",
    "  float dapple = smoothstep(0.3, 0.7, fbm(fp * 0.0035 + vec2(uTime * 0.01, 2.0)));",
    "  caust *= (mix(0.3, 0.6, day) + mix(1.0, 0.7, day) * dapple) * ringLight;",
    // By day the whole pond is in sun: shade patches and shadows are light.
    "  float lit = mix(0.8, 0.9, day) + mix(0.3, 0.18, day) * dapple - sh * mix(0.36, 0.24, day);",
    "  vec3 col = bed * lit * mix(1.0, ringLight, 0.35);",
    "  vec3 sunCol = mix(vec3(0.74, 0.88, 1.0), vec3(1.0, 0.97, 0.86), day);",
    "  col += sunCol * caust * (1.0 - sh) * mix(0.13, 0.06, vis) * (1.0 + 0.8 * day);",

    // Fish, a little shallower: bent less, lit more softly, tinted by the water.
    "  vec2 fishP = p + g * 0.12;",
    "  vec4 fish = texture2D(uFish, fishP / uRes);",
    "  float padOnFish = soft(uPads, fishP - vec2(6.0, 8.0), 4.0);",
    "  float fishLit = 1.0 - smoothstep(0.0, 0.3, e1);",
    "  vec3 fc = fish.rgb * (0.9 + 0.22 * fishLit) * (1.0 - mix(0.45, 0.28, day) * padOnFish);",
    "  fc = mix(fc, mix(vec3(0.14, 0.32, 0.48), vec3(0.07, 0.2, 0.38), uNight) * fish.a, 0.1);",
    "  col = col * (1.0 - fish.a) + fc;",

    // The surface: sky and trees reflected in it, bent by its slope, and sun glints.
    "  vec3 n = normalize(vec3(-slope, 1.0));",
    "  vec2 rq = p * 0.0021 + n.xy * 2.2 + vec2(uTime * 0.006, uTime * 0.002);",
    "  float sky = smoothstep(0.35, 0.8, fbm(rq));",
    "  col = mix(col, vec3(0.86, 0.92, 0.97), (0.02 + 0.06 * sky) * mix(1.3, 0.6, uNight));",
    // Ripple rings show mostly as the sky caught on the side that faces it.
    "  col += vec3(0.75, 0.85, 0.8) * clamp(dot(rg, vec2(-0.6, -0.8)) / 24.0, 0.0, 1.0) * 0.3;",
    "  col += vec3(0.8, 0.9, 0.85) * clamp(dot(dropG, vec2(-0.6, -0.8)) * 0.12, -0.07, 0.16);",
    // Pollen and dust floating on the surface, drifting with the breeze.
    "  vec2 dp = (p + vec2(uTime * 2.0, uTime * 0.7)) / 23.0;",
    "  vec2 di = floor(dp);",
    "  vec2 dc = vec2(hash(di + 5.1), hash(di + 9.7)) * 0.8 + 0.1;",
    "  vec2 dd = (fract(dp) - dc) * 23.0;",
    "  float speck = step(0.82, hash(di + 2.3)) * exp(-dot(dd, dd) * 1.4);",
    "  col = mix(col, vec3(0.8, 0.76, 0.58), speck * 0.35);",
    // Sun glints: tiny ripple facets that tip toward the sun for an instant.
    // A few random points per patch of water, each flashing on its own beat.
    "  vec2 gp = p / 7.0;",
    "  vec2 gi = floor(gp);",
    "  float gh = hash(gi + 3.7);",
    "  vec2 gc = vec2(hash(gi + 11.3), hash(gi + 27.1)) * 0.7 + 0.15;",
    "  vec2 gd = (fract(gp) - gc) * 7.0;",
    "  float flash = pow(max(sin(uTime * (0.8 + 1.2 * gh) + gh * 40.0), 0.0), 16.0);",
    "  float spark = flash * step(0.87, hash(gi + 51.9)) * exp(-dot(gd, gd) * 0.9);",
    "  col += vec3(1.0, 0.97, 0.9) * spark * breeze * mix(2.2, 1.8, uNight);",

    // Lily pads float on top. Water hugs their edges in a thin bright line.
    "  vec4 pad = texture2D(uPads, uv);",
    "  float hug = clamp(soft(uPads, p, 2.0) - pad.a, 0.0, 1.0);",
    "  col += vec3(0.7, 0.85, 0.98) * hug * 0.22;",
    "  col = col * (1.0 - pad.a) + pad.rgb;",

    "  vec2 q = uv - vec2(0.5, 0.58);",
    // A touch of warm sunlight over everything by day.
    "  col *= mix(vec3(1.0), vec3(1.04, 1.02, 0.97), day);",
    "  col *= 1.0 - mix(0.18, 0.35, uNight) * smoothstep(0.32, 0.95, length(q * vec2(1.0, 1.4)));",
    "  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  var MIN_CELL = 4; // ripple grid spacing in CSS px
  var MAX_CELLS_X = 420;
  var STEP = 1 / 60;
  var WAVE_K = 0.14; // (c * dt / dx)^2; ripples spread about 22 cells a second
  var WAVE_DAMP = 0.96; // small ripples die out within half a second or so
  var WAVE_VISC = 0.008; // smooths out grid-sized wiggles faster than real ripples
  var SPONGE = 6; // cells of absorbing border so ripples leave the frame quietly
  var FLOOR_DEPTH = 60; // px of water between surface and floor, for ripple light
  var SLOPE_RANGE = 24; // must match the 48.0 decode (2 * range) in the shader
  var CURVE_RANGE = 3; // must match the 6.0 decode (2 * range) in the shader
  var DROP_SLOTS = 12; // must match uDrops[12] in the shader

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("koi water shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function KoiWater(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    this.lost = false;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.top = 0;
    this.cell = MIN_CELL;
    this.gw = 0;
    this.gh = 0;
    this.height = null;
    this.vel = null;
    this.mask = null;
    this.packed = null;
    this.acc = 0;
    this.active = false;
    this.padSource = null;
    this.onRestore = null;
    this.time = 0;
    this.night = 0;
    this.nightTarget = 0;
    this.drops = new Float32Array(DROP_SLOTS * 4);
    this.dropNext = 0;

    var self = this;
    this._onLost = function (e) {
      e.preventDefault();
      self.lost = true;
    };
    this._onRestored = function () {
      self.lost = false;
      if (self.setup()) {
        self.allocGrid();
        if (self.padSource) self.setPads(self.padSource);
        if (self.onRestore) self.onRestore();
      }
    };
    canvas.addEventListener("webglcontextlost", this._onLost, false);
    canvas.addEventListener("webglcontextrestored", this._onRestored, false);
  }

  KoiWater.create = function (canvas) {
    var opts = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    };
    var gl = null;
    try {
      gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
    } catch (e) {
      gl = null;
    }
    if (!gl) return null;
    var water = new KoiWater(canvas, gl);
    return water.setup() ? water : null;
  };

  KoiWater.prototype.setup = function () {
    var gl = this.gl;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn("koi water link:", gl.getProgramInfoLog(prog));
      return false;
    }
    this.prog = prog;
    gl.useProgram(prog);

    // One triangle that covers the screen.
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ["uRes", "uDpr", "uTime", "uTop", "uNight", "uGrid", "uCell", "uFish", "uPads", "uRipple", "uDrops"].forEach(function (name) {
      u[name] = gl.getUniformLocation(prog, name);
    });
    this.u = u;
    gl.uniform1i(u.uFish, 0);
    gl.uniform1i(u.uPads, 1);
    gl.uniform1i(u.uRipple, 2);

    this.fishTex = this.makeTexture(0);
    this.padTex = this.makeTexture(1);
    this.rippleTex = this.makeTexture(2);
    var empty = new Uint8Array([0, 0, 0, 0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, empty);
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, empty);
    return !gl.isContextLost();
  };

  KoiWater.prototype.makeTexture = function (unit) {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };

  KoiWater.prototype.resize = function (w, h, dpr, top) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.top = top || 0;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.allocGrid();
  };

  KoiWater.prototype.allocGrid = function () {
    if (!this.w || !this.h) return;
    this.cell = Math.max(MIN_CELL, this.w / MAX_CELLS_X);
    var gw = Math.ceil(this.w / this.cell) + 2;
    var gh = Math.ceil(this.h / this.cell) + 2;
    var size = gw * gh;
    if (gw !== this.gw || gh !== this.gh) {
      this.gw = gw;
      this.gh = gh;
      this.height = new Float32Array(size);
      this.vel = new Float32Array(size);
      this.velNext = new Float32Array(size);
      this.mask = new Float32Array(size);
      this.packed = new Uint8Array(size * 4);
    }
    this.buildMask(this.pads || []);
    this.packed.fill(128);
    this.uploadRipple();
  };

  // Ripples fade out at the frame edges and bounce softly off lily pads.
  KoiWater.prototype.buildMask = function (pads) {
    this.pads = pads;
    if (!this.mask) return;
    var gw = this.gw;
    var gh = this.gh;
    var cell = this.cell;
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var edge = Math.min(x, y, gw - 1 - x, gh - 1 - y);
        var m = edge >= SPONGE ? 1 : 0.8 + 0.2 * (edge / SPONGE);
        if (edge === 0) m = 0;
        var px = (x - 0.5) * cell;
        var py = (y - 0.5) * cell;
        for (var i = 0; i < pads.length; i++) {
          var pad = pads[i];
          var dx = (px - pad.x) / pad.rx;
          var dy = (py - pad.y) / pad.ry;
          if (dx * dx + dy * dy < 0.85) {
            m *= 0.55;
            break;
          }
        }
        this.mask[y * gw + x] = m;
      }
    }
  };

  // Push the surface down (amount > 0) in a soft dot of the given radius.
  KoiWater.prototype.disturb = function (x, y, radius, amount) {
    if (!this.height) return;
    var cell = this.cell;
    var cx = x / cell + 0.5;
    var cy = y / cell + 0.5;
    var r = Math.max(1, radius / cell);
    var x0 = Math.max(1, Math.floor(cx - r * 2));
    var x1 = Math.min(this.gw - 2, Math.ceil(cx + r * 2));
    var y0 = Math.max(1, Math.floor(cy - r * 2));
    var y1 = Math.min(this.gh - 2, Math.ceil(cy + r * 2));
    var inv = 1 / (r * r);
    for (var gy = y0; gy <= y1; gy++) {
      for (var gx = x0; gx <= x1; gx++) {
        var dx = gx - cx;
        var dy = gy - cy;
        var d2 = (dx * dx + dy * dy) * inv;
        if (d2 > 4) continue;
        this.height[gy * this.gw + gx] -= amount * Math.exp(-d2);
      }
    }
    this.active = true;
  };

  // Night mode darkens the water. It fades over about half a second unless `now`.
  KoiWater.prototype.setNight = function (on, now) {
    this.nightTarget = on ? 1 : 0;
    if (now) this.night = this.nightTarget;
  };

  // A small ring where something touches the surface, starting `delay` seconds from now.
  KoiWater.prototype.drop = function (x, y, strength, delay) {
    var o = this.dropNext * 4;
    this.drops[o] = x;
    this.drops[o + 1] = y;
    this.drops[o + 2] = this.time + (delay || 0);
    this.drops[o + 3] = strength;
    this.dropNext = (this.dropNext + 1) % DROP_SLOTS;
  };

  KoiWater.prototype.step = function (dt) {
    if (!this.height || !this.active) return;
    this.acc = Math.min(this.acc + dt, STEP * 3);
    var steps = 0;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.simulate();
      steps++;
    }
    if (steps) this.pack();
  };

  KoiWater.prototype.simulate = function () {
    var h = this.height;
    var v = this.vel;
    var vn = this.velNext;
    var m = this.mask;
    var gw = this.gw;
    var gh = this.gh;
    var x;
    var y;
    var i;
    for (y = 1; y < gh - 1; y++) {
      i = y * gw + 1;
      for (x = 1; x < gw - 1; x++, i++) {
        // Nine-point Laplacian: round ripples instead of slightly square ones.
        var lap =
          (4 * (h[i - 1] + h[i + 1] + h[i - gw] + h[i + gw]) +
            h[i - gw - 1] + h[i - gw + 1] + h[i + gw - 1] + h[i + gw + 1] -
            20 * h[i]) / 6;
        var visc = v[i - 1] + v[i + 1] + v[i - gw] + v[i + gw] - 4 * v[i];
        vn[i] = (v[i] + WAVE_K * lap + WAVE_VISC * visc) * WAVE_DAMP;
      }
    }
    this.vel = vn;
    this.velNext = v;
    v = vn;
    var peak = 0;
    for (i = 0; i < h.length; i++) {
      var hv = (h[i] + v[i]) * m[i];
      h[i] = hv;
      if (hv > peak) peak = hv;
      else if (-hv > peak) peak = -hv;
    }
    if (peak < 0.002) {
      h.fill(0);
      v.fill(0);
      this.velNext.fill(0);
      this.active = false;
    }
  };

  KoiWater.prototype.pack = function () {
    var h = this.height;
    var out = this.packed;
    var gw = this.gw;
    var gh = this.gh;
    var cell = this.cell;
    var slopeScale = FLOOR_DEPTH / (2 * cell * SLOPE_RANGE);
    var curveScale = (FLOOR_DEPTH * 0.5) / (cell * cell * CURVE_RANGE);
    for (var y = 1; y < gh - 1; y++) {
      var i = y * gw + 1;
      for (var x = 1; x < gw - 1; x++, i++) {
        var o = i * 4;
        var gx = (h[i + 1] - h[i - 1]) * slopeScale;
        var gy = (h[i + gw] - h[i - gw]) * slopeScale;
        var c = (h[i - 1] + h[i + 1] + h[i - gw] + h[i + gw] - 4 * h[i]) * curveScale;
        out[o] = 127.5 + 127.5 * (gx > 1 ? 1 : gx < -1 ? -1 : gx);
        out[o + 1] = 127.5 + 127.5 * (gy > 1 ? 1 : gy < -1 ? -1 : gy);
        out[o + 3] = 127.5 + 127.5 * (c > 1 ? 1 : c < -1 ? -1 : c);
      }
    }
    this.uploadRipple();
  };

  KoiWater.prototype.uploadRipple = function () {
    var gl = this.gl;
    if (this.lost || !this.packed) return;
    gl.activeTexture(gl.TEXTURE2);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.gw, this.gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.packed);
  };

  KoiWater.prototype.uploadCanvas = function (unit, source) {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  };

  KoiWater.prototype.setPads = function (padCanvas) {
    this.padSource = padCanvas;
    if (this.lost) return;
    this.uploadCanvas(1, padCanvas);
  };

  KoiWater.prototype.render = function (seconds, fishCanvas) {
    if (this.lost || !this.w) return;
    var gl = this.gl;
    var u = this.u;
    if (fishCanvas) this.uploadCanvas(0, fishCanvas);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1f(u.uDpr, this.canvas.width / this.w);
    var t = seconds % 3600;
    var dt = Math.max(0, Math.min(0.1, t - this.time));
    this.time = t;
    if (this.night !== this.nightTarget) {
      var stepN = dt / 0.5;
      this.night += Math.max(-stepN, Math.min(stepN, this.nightTarget - this.night));
    }
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uNight, this.night);
    gl.uniform4fv(u.uDrops, this.drops);
    gl.uniform1f(u.uTop, this.top);
    gl.uniform2f(u.uGrid, this.gw, this.gh);
    gl.uniform1f(u.uCell, this.cell);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  KoiWater.prototype.destroy = function () {
    this.canvas.removeEventListener("webglcontextlost", this._onLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this._onRestored, false);
    var gl = this.gl;
    if (!this.lost) {
      gl.deleteTexture(this.fishTex);
      gl.deleteTexture(this.padTex);
      gl.deleteTexture(this.rippleTex);
      gl.deleteProgram(this.prog);
    }
  };

  window.KoiWater = KoiWater;
})();
