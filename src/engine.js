/* Sky Reaper engine: an isometric pixel-art world drawn on the CPU into a G-buffer, then lit on
 * the GPU (gfx.js). Camera, materials, colour ramps and the face rasteriser follow Isle Express;
 * the difference is that this world never ends, so its G-buffer is built in tiles (world.js). */

const W = 960, H = 540, N = W * H;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ utils */
function hash(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
function rnd(a, b, c) {
  let h = hash((a | 0) ^ 0x2545f491);
  h = hash(h ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b));
  h = hash(h ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35));
  return h / 4294967296;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  return lerp(rnd(i, seed, 3), rnd(i + 1, seed, 3), smooth(f));
}
function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = rnd(xi, yi, seed), b = rnd(xi + 1, yi, seed), c = rnd(xi, yi + 1, seed), d = rnd(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
const norm3 = (v) => { const k = 1 / Math.hypot(v[0], v[1], v[2]); return [v[0] * k, v[1] * k, v[2] * k]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ----------------------------------------------------------------- colour */
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function toSRGB(c) { c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return clamp(Math.round(c * 255), 0, 255); }
function pack(r, g, b) { return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; }
function packHex(h) { const c = hexRGB(h); return pack(c[0], c[1], c[2]); }
const ramp = (list) => list.map(packHex);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bay[y * W + x] = BAYER4[(y & 3) * 4 + (x & 3)];
// q = continuous level; returns an integer level whose transitions are dithered over a narrow seam
function band(q, b, seam) {
  const qi = Math.floor(q), f = (q - qi - 0.5) / seam + 0.5;
  return qi + (f > b ? 1 : 0);
}

/* -------------------------------------------------------------- materials
 * Lit materials (id < 128) get a generated ramp: [shade 0..4][warm 0..7] for sprites shaded on
 * the CPU. The GPU only needs each material's albedo. Emissive materials (id >= 128) get a
 * hand-picked ramp indexed by level. */
const MATS = [null];
const M = {};
function defMat(name, hex) { M[name] = MATS.length; MATS.push({ name, alb: hexRGB(hex).map(toLin) }); }

defMat('grass', '#5f8452'); defMat('grassDk', '#46674a'); defMat('grassLt', '#80a35c');
defMat('soil', '#6a4834'); defMat('soilDk', '#4c3428'); defMat('dirt', '#7d5c3e'); defMat('mud', '#5b4332');
defMat('rock', '#7b7888'); defMat('rockDk', '#5e5b6c'); defMat('stone', '#a3a2ac'); defMat('stoneDk', '#7d7c8a');
defMat('brick', '#8e5a48'); defMat('plaster', '#dccca8'); defMat('wood', '#83573a'); defMat('woodDk', '#553626');
defMat('woodLt', '#a8784c'); defMat('slate', '#5e5c78'); defMat('slateDk', '#4a4862');
defMat('bark', '#6d5242'); defMat('pine', '#3f6c4e'); defMat('pineDk', '#2e5242');
defMat('leaf', '#4f7f3a'); defMat('leafDk', '#3b6534'); defMat('leafLt', '#6f9c46');
defMat('autumn', '#b86a30'); defMat('autumnDk', '#8e4a26');
defMat('flowerR', '#dc5a4a'); defMat('flowerY', '#ecc85a'); defMat('flowerW', '#e6e4f2');
defMat('iron', '#3c3c48'); defMat('ironLt', '#8a8a9c'); defMat('moss', '#6f9444'); defMat('hay', '#c8a860');
defMat('carRed', '#8e3a34'); defMat('carBlue', '#3d5a86'); defMat('carCream', '#cfc4a4'); defMat('carGreen', '#4d6b4a');
defMat('rust', '#7a4a2e'); defMat('tire', '#26242c'); defMat('glassDk', '#2a3346'); defMat('soot', '#2b2826');
defMat('fence', '#7a6048');
// the dead
defMat('zskin', '#b4c79a'); defMat('zskinPale', '#d6cfb2'); defMat('zskinGrey', '#a9b2a5');
defMat('hair', '#2e2622'); defMat('boot', '#2b2724'); defMat('blood', '#8a1f1c'); defMat('gore', '#5a1414');
defMat('shirtB', '#4a68a0'); defMat('shirtR', '#a8433c'); defMat('shirtW', '#d9d2bf'); defMat('shirtG', '#64804f');
defMat('shirtY', '#c9a54e'); defMat('shirtP', '#7d5d90');
defMat('pants', '#39405a'); defMat('pantsBr', '#5c4836'); defMat('pantsGr', '#4f5249');

const EMIS = [];
const E = {};
function defEmis(name, list) { E[name] = 128 + EMIS.length; EMIS.push(ramp(list)); }
defEmis('window', ['#4a2216', '#7a3419', '#a84c1c', '#d06d22', '#ec9432', '#fbb548', '#ffd47a', '#ffeab0', '#fff8dc']);
defEmis('lamp', ['#7a5a30', '#b08a44', '#dcb45a', '#f6d47a', '#ffe9a8', '#fff6d6', '#fffdf2']);
defEmis('flame', ['#a8321c', '#dc5520', '#f5832a', '#ffb53a', '#ffe066', '#fff4c0', '#fffbe6']);
defEmis('sil', ['#140a0c', '#1c0f0e', '#26140f', '#321a12', '#40231a']);

// Emitter channels: every emissive pixel names one; the GPU scales it by EMITK[channel].
const CH = { steady: 0, lamp: 1, window: 2, fire: 3 };   // fire uses 3..6

const SH = 5, WL = 8;
// cold moonlight per shade (linear RGB) and an additive bluish atmosphere per shade
const COLD = [[0.022, 0.028, 0.062], [0.055, 0.075, 0.155], [0.11, 0.155, 0.30], [0.21, 0.29, 0.52], [0.36, 0.47, 0.78]];
const ATMO = [[0.004, 0.008, 0.02], [0.005, 0.01, 0.026], [0.007, 0.014, 0.034], [0.01, 0.02, 0.045], [0.014, 0.026, 0.056]];
const WARM = [1.0, 0.47, 0.17];
const warmK = (w) => 1.6 * Math.pow(w / (WL - 1), 1.3);
function tone(c) { return c < 0.78 ? c : 0.78 + 0.22 * (1 - Math.exp(-(c - 0.78) / 0.22)); }
const TABLE = new Uint32Array(128 * SH * WL);
for (let m = 1; m < MATS.length; m++) {
  const a = MATS[m].alb;
  for (let s = 0; s < SH; s++) for (let w = 0; w < WL; w++) {
    const k = warmK(w);
    const rgb = [0, 1, 2].map((c) => tone(a[c] * (COLD[s][c] + WARM[c] * k) + ATMO[s][c]));
    TABLE[(m * SH + s) * WL + w] = pack(toSRGB(rgb[0]), toSRGB(rgb[1]), toSRGB(rgb[2]));
  }
}
const lit = (m, s, w) => TABLE[(m * SH + clamp(s, 0, SH - 1)) * WL + clamp(w, 0, WL - 1)];
const MATSRGB = [], MATCLASS = new Uint8Array(256);
(function () {
  const foliage = ['grass', 'grassDk', 'grassLt', 'leaf', 'leafDk', 'leafLt', 'pine', 'pineDk', 'autumn', 'autumnDk', 'moss', 'flowerR', 'flowerY', 'flowerW', 'hay'];
  const metal = ['iron', 'ironLt', 'carRed', 'carBlue', 'carCream', 'carGreen', 'glassDk'];
  for (let m = 1; m < MATS.length; m++) {
    MATSRGB[m] = MATS[m].alb.map(toSRGB);
    MATCLASS[m] = foliage.includes(MATS[m].name) ? 210 : metal.includes(MATS[m].name) ? 220 : 200;
  }
})();

/* ================================================================= CAMERA
 * Orthographic, yaw 45°, pitch 30°. A world step along x or y is exactly (±1, 0.5) pixels: the 2:1
 * lines pixel artists use for isometric art. Pixels are addressed in a global plane offset by OFFS
 * so tile and texture coordinates stay positive; VIEW is the global pixel at the screen's corner. */
const YAW = Math.PI / 4, PITCH = Math.PI / 6;
const CR = [Math.cos(YAW), -Math.sin(YAW), 0];                                                 // screen right
const CU = [-Math.sin(PITCH) * Math.sin(YAW), -Math.sin(PITCH) * Math.cos(YAW), Math.cos(PITCH)]; // screen up
const CV = [Math.cos(PITCH) * Math.sin(YAW), Math.cos(PITCH) * Math.cos(YAW), Math.sin(PITCH)];   // towards the camera
const SC = Math.SQRT2;
const ZK = SC * CU[2];          // pixels per unit of height
const OFFS = 1 << 20;
const VIEW = { x: 0, y: 0 };
const GX = (x, y) => OFFS + SC * (x * CR[0] + y * CR[1]);
const GY = (x, y, z) => OFFS - SC * (x * CU[0] + y * CU[1] + z * CU[2]);
const scrX = (x, y) => GX(x, y) - VIEW.x;
const scrY = (x, y, z) => GY(x, y, z) - VIEW.y;
const depth = (x, y, z) => x * CV[0] + y * CV[1] + z * CV[2];   // bigger = nearer the camera
function unprojectG(gx, gy, d, out) {
  const a = (gx - OFFS) / SC, b = (OFFS - gy) / SC;
  out[0] = a * CR[0] + b * CU[0] + d * CV[0];
  out[1] = a * CR[1] + b * CU[1] + d * CV[1];
  out[2] = a * CR[2] + b * CU[2] + d * CV[2];
}
const groundDepthG = (gy) => -((OFFS - gy) / SC) * CU[2] / CV[2];
function groundAtG(gx, gy, out) { unprojectG(gx, gy, groundDepthG(gy), out); out[2] = 0; return out; }
function groundAtScreen(sx, sy, out) { return groundAtG(sx + VIEW.x, sy + VIEW.y, out || [0, 0, 0]); }

// the moon: direction towards it, and an orthonormal basis for its shadow maps
const LD = norm3([-0.3, 0.6, 1.0]);
const LR = norm3([-LD[1], LD[0], 0]);
const LU = cross3(LD, LR);
const lu = (x, y, z) => x * LR[0] + y * LR[1] + z * LR[2];
const lv = (x, y, z) => -(x * LU[0] + y * LU[1] + z * LU[2]);
const ld = (x, y, z) => x * LD[0] + y * LD[1] + z * LD[2];

/* ============================================================== TARGETS
 * A G-buffer target covers a rectangle of the global pixel plane (x0, y0, w, h). Normals are
 * stored as signed bytes (x127); lit is 1 where the moon reaches; gnd marks the bare ground. */
function target(w, h) {
  const n = w * h;
  return { x0: 0, y0: 0, w, h, d: new Float32Array(n), mat: new Uint8Array(n), tex: new Int8Array(n), emi: new Uint8Array(n),
    nx: new Int8Array(n), ny: new Int8Array(n), nz: new Int8Array(n), lit: new Uint8Array(n), gnd: new Uint8Array(n) };
}
function smap(w, h, k) { return { w, h, k, u0: 0, v0: 0, buf: new Float32Array(w * h).fill(-1e9) }; }
function shadowed(S, x, y, z, bias) {
  const u = Math.floor((lu(x, y, z) - S.u0) * S.k), v = Math.floor((lv(x, y, z) - S.v0) * S.k);
  if (u < 0 || v < 0 || u >= S.w || v >= S.h) return false;
  return S.buf[v * S.w + u] > ld(x, y, z) + bias;
}

/* ============================================================== RASTERISER */
const PX = new Float64Array(64), PY = new Float64Array(64), PD = new Float64Array(64);
// fills a convex polygon held in PX/PY/PD (pixel x, y, depth); cb(index, depth)
function rasterConvex(n, bw, bh, cb) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, area = 0;
  for (let k = 0; k < n; k++) {
    const x = PX[k], y = PY[k], k2 = k + 1 === n ? 0 : k + 1;
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
    area += x * PY[k2] - PX[k2] * y;
  }
  if (Math.abs(area) < 1e-6) return;
  const x0 = Math.max(0, Math.floor(minx)), x1 = Math.min(bw - 1, Math.ceil(maxx));
  const y0 = Math.max(0, Math.floor(miny)), y1 = Math.min(bh - 1, Math.ceil(maxy));
  if (x0 > x1 || y0 > y1) return;
  let best = 0, bj = 1;
  for (let j = 1; j < n - 1; j++) {
    const a = Math.abs((PX[j] - PX[0]) * (PY[j + 1] - PY[0]) - (PX[j + 1] - PX[0]) * (PY[j] - PY[0]));
    if (a > best) { best = a; bj = j; }
  }
  if (best < 0.02) return;
  const dx1 = PX[bj] - PX[0], dy1 = PY[bj] - PY[0], dd1 = PD[bj] - PD[0];
  const dx2 = PX[bj + 1] - PX[0], dy2 = PY[bj + 1] - PY[0], dd2 = PD[bj + 1] - PD[0];
  const det = dx1 * dy2 - dx2 * dy1;
  const A = (dd1 * dy2 - dd2 * dy1) / det, B = (dx1 * dd2 - dx2 * dd1) / det;
  const sg = area > 0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let inside = true;
      for (let k = 0; k < n; k++) {
        const k2 = k + 1 === n ? 0 : k + 1;
        if (sg * ((PX[k2] - PX[k]) * (py - PY[k]) - (PY[k2] - PY[k]) * (px - PX[k])) < -1e-7) { inside = false; break; }
      }
      if (inside) cb(y * bw + x, PD[0] + A * (px - PX[0]) + B * (py - PY[0]));
    }
  }
}

/* ------------------------------------------------------------- transforms
 * A transform places local geometry: x forward, y left, z up. */
function tfAt(x, y, z, h) { const c = Math.cos(h), s = Math.sin(h); return { o: [x, y, z], f: [c, s], l: [-s, c] }; }
const TF0 = tfAt(0, 0, 0, 0);
function W3(tf, x, y, z) { return [tf.o[0] + x * tf.f[0] + y * tf.l[0], tf.o[1] + x * tf.f[1] + y * tf.l[1], tf.o[2] + z]; }
function nL(tf, x, y, z) { return [x * tf.f[0] + y * tf.l[0], x * tf.f[1] + y * tf.l[1], z]; }

/* ------------------------------------------------------------------ faces
 * A face is a convex planar polygon (flat array of world xyz) with a normal, a material and an
 * optional paint(o, F) that picks material / pattern shade / emitter per pixel.
 * side: 1 +x, 2 -x, 3 +y, 4 -y, 5 top (all local), 7 curved side, 8/9 cylinder caps. */
function mkFace(v, n, mat, tf, side, opt) {
  return { v, n, mat, tf: tf || TF0, side: side || 0, sphere: false,
    paint: (opt && opt.paint) || null, smooth: (opt && opt.smooth) || null,
    tex: (opt && opt.tex) || 0, emi: (opt && opt.emi) || 0, two: !!(opt && opt.two), noShadow: !!(opt && opt.noShadow) };
}
function faceFromPts(pts, mat, opt, hint) {
  let nx = 0, ny = 0, nz = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-9) return null;
  let n = [nx / l, ny / l, nz / l];
  if (hint && n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = [-n[0], -n[1], -n[2]];
  return mkFace([].concat(...pts), n, mat, (opt && opt.tf) || TF0, (opt && opt.side) || 0, opt);
}
function pushPts(out, pts, mat, opt, hint) { const f = faceFromPts(pts, mat, opt, hint); if (f) out.push(f); }
function box(out, tf, x0, x1, y0, y1, z0, z1, mat, opt) {
  const P = (x, y, z) => W3(tf, x, y, z), f = tf.f, l = tf.l;
  const q = (a, b, c, d, n, side) => out.push(mkFace([].concat(a, b, c, d), n, mat, tf, side, opt));
  q(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), [f[0], f[1], 0], 1);
  q(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-f[0], -f[1], 0], 2);
  q(P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), [l[0], l[1], 0], 3);
  q(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), [-l[0], -l[1], 0], 4);
  q(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1], 5);
}
// cylinder along a local axis (0 x, 1 y, 2 z) from a0 to a1, centred at (cu, cv) in the other two
function cyl(out, tf, axis, a0, a1, cu, cv, r, segs, mat, opt) {
  opt = opt || {};
  const L = axis === 0 ? (a, u, v) => W3(tf, a, u, v) : axis === 1 ? (a, u, v) => W3(tf, u, a, v) : (a, u, v) => W3(tf, u, v, a);
  const LN = axis === 0 ? (u, v, w) => nL(tf, w, u, v) : axis === 1 ? (u, v, w) => nL(tf, u, w, v) : (u, v, w) => nL(tf, u, v, w);
  const smoothN = (o) => {
    let du, dv;
    if (axis === 0) { du = o.ly - cu; dv = o.lz - cv; } else if (axis === 1) { du = o.lx - cu; dv = o.lz - cv; } else { du = o.lx - cu; dv = o.ly - cv; }
    const k = 1 / (Math.hypot(du, dv) || 1), n = LN(du * k, dv * k, 0);
    o.nx = n[0]; o.ny = n[1]; o.nz = n[2];
  };
  const sideOpt = { paint: opt.paint, tex: opt.tex, emi: opt.emi, smooth: smoothN, noShadow: opt.noShadow };
  const ring0 = [], ring1 = [], rot = opt.rot || 0;
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * TAU + rot, b = ((k + 1) / segs) * TAU + rot, m = (a + b) / 2;
    const ua = cu + r * Math.cos(a), va = cv + r * Math.sin(a), ub = cu + r * Math.cos(b), vb = cv + r * Math.sin(b);
    out.push(mkFace([].concat(L(a0, ua, va), L(a1, ua, va), L(a1, ub, vb), L(a0, ub, vb)), LN(Math.cos(m), Math.sin(m), 0), mat, tf, 7, sideOpt));
    ring0.push(...L(a0, ua, va)); ring1.push(...L(a1, ua, va));
  }
  const capOpt = { paint: opt.capPaint || opt.paint, tex: opt.tex, emi: opt.emi, noShadow: opt.noShadow };
  if (opt.cap0 !== false) out.push(mkFace(ring0, LN(0, 0, -1), opt.capMat || mat, tf, 8, capOpt));
  if (opt.cap1 !== false) out.push(mkFace(ring1, LN(0, 0, 1), opt.capMat || mat, tf, 9, capOpt));
}
// upright cone with a smooth analytic normal
function cone(out, tf, cx, cy, z0, z1, r, segs, mat, opt) {
  opt = opt || {};
  const h = z1 - z0, kk = 1 / Math.hypot(h, r), rot = opt.rot || 0;
  const smoothN = (o) => {
    const dx = o.lx - cx, dy = o.ly - cy, k = 1 / (Math.hypot(dx, dy) || 1);
    const n = nL(tf, dx * k * h * kk, dy * k * h * kk, r * kk);
    o.nx = n[0]; o.ny = n[1]; o.nz = n[2];
  };
  const apex = W3(tf, cx, cy, z1);
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * TAU + rot, b = ((k + 1) / segs) * TAU + rot, m = (a + b) / 2;
    out.push(mkFace([].concat(apex, W3(tf, cx + r * Math.cos(a), cy + r * Math.sin(a), z0), W3(tf, cx + r * Math.cos(b), cy + r * Math.sin(b), z0)),
      nL(tf, Math.cos(m) * h * kk, Math.sin(m) * h * kk, r * kk), mat, tf, 7, { paint: opt.paint, tex: opt.tex, smooth: smoothN }));
  }
}
function sphere(out, x, y, z, r, mat, opt) {
  out.push({ sphere: true, c: [x, y, z], r, mat, tf: TF0, side: 0, smooth: null, emi: 0, two: false,
    paint: (opt && opt.paint) || null, tex: (opt && opt.tex) || 0, noShadow: !!(opt && opt.noShadow) });
}

/* ------------------------------------------------------------ drawing into a target */
const P3 = [0, 0, 0];
const O = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, sx: 0, sy: 0, nx: 0, ny: 0, nz: 0, mat: 0, tex: 0, emi: 0, flip: false, gnd: 0 };
function writePx(T, i, dep, o) {
  T.d[i] = dep; T.mat[i] = o.mat; T.tex[i] = o.tex; T.emi[i] = o.emi; T.gnd[i] = o.gnd;
  T.nx[i] = Math.round(o.nx * 127); T.ny[i] = Math.round(o.ny * 127); T.nz[i] = Math.round(o.nz * 127);
}
function shadePx(T, i, dep, F, n, flip) {
  const gx = T.x0 + (i % T.w), gy = T.y0 + ((i / T.w) | 0);
  unprojectG(gx + 0.5, gy + 0.5, dep, P3);
  const o = O, tf = F.tf;
  o.x = P3[0]; o.y = P3[1]; o.z = P3[2]; o.sx = gx; o.sy = gy; o.gnd = 0;
  const dx = o.x - tf.o[0], dy = o.y - tf.o[1];
  o.lx = dx * tf.f[0] + dy * tf.f[1]; o.ly = dx * tf.l[0] + dy * tf.l[1]; o.lz = o.z - tf.o[2];
  o.nx = n[0]; o.ny = n[1]; o.nz = n[2];
  o.mat = F.mat; o.tex = F.tex; o.emi = F.emi; o.flip = flip;
  if (F.smooth) F.smooth(o);
  if (flip) { o.nx = -o.nx; o.ny = -o.ny; o.nz = -o.nz; }
  if (F.paint) F.paint(o, F);
  if (o.mat) writePx(T, i, dep, o);
}
function drawFace(F, T) {
  const n = F.n, facing = n[0] * CV[0] + n[1] * CV[1] + n[2] * CV[2];
  if (facing <= 1e-4 && !F.two) return;
  const flip = facing <= 0, v = F.v, k = v.length / 3;
  for (let j = 0; j < k; j++) {
    const x = v[j * 3], y = v[j * 3 + 1], z = v[j * 3 + 2];
    PX[j] = GX(x, y) - T.x0; PY[j] = GY(x, y, z) - T.y0; PD[j] = depth(x, y, z);
  }
  rasterConvex(k, T.w, T.h, (i, dep) => { if (dep > T.d[i]) shadePx(T, i, dep, F, n, flip); });
}
const SN = [0, 0, 0];
function drawSphere(F, T) {
  const c = F.c, R = F.r, rs = SC * R;
  const cx = GX(c[0], c[1]) - T.x0, cy = GY(c[0], c[1], c[2]) - T.y0, cd = depth(c[0], c[1], c[2]);
  const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(T.w - 1, Math.ceil(cx + rs));
  const y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(T.h - 1, Math.ceil(cy + rs));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - cx) / rs, dy = (y + 0.5 - cy) / rs, q = dx * dx + dy * dy;
    if (q >= 1) continue;
    const nz = Math.sqrt(1 - q), dep = cd + R * nz, i = y * T.w + x;
    if (dep <= T.d[i]) continue;
    SN[0] = dx * CR[0] - dy * CU[0] + nz * CV[0];
    SN[1] = dx * CR[1] - dy * CU[1] + nz * CV[1];
    SN[2] = dx * CR[2] - dy * CU[2] + nz * CV[2];
    shadePx(T, i, dep, F, SN, false);
  }
}
function drawAny(F, T) { if (F.sphere) drawSphere(F, T); else drawFace(F, T); }

// shadow map: the same shapes seen from the moon, keeping the depth nearest to it
function shadowAny(F, S) {
  if (F.noShadow) return;
  if (F.sphere) {
    const c = F.c, R = F.r, rs = R * S.k;
    const cx = (lu(c[0], c[1], c[2]) - S.u0) * S.k, cy = (lv(c[0], c[1], c[2]) - S.v0) * S.k, cd = ld(c[0], c[1], c[2]);
    const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(S.w - 1, Math.ceil(cx + rs));
    const y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(S.h - 1, Math.ceil(cy + rs));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rs, dy = (y + 0.5 - cy) / rs, q = dx * dx + dy * dy;
      if (q >= 1) continue;
      const dep = cd + R * Math.sqrt(1 - q), i = y * S.w + x;
      if (dep > S.buf[i]) S.buf[i] = dep;
    }
    return;
  }
  const v = F.v, k = v.length / 3, buf = S.buf;
  for (let j = 0; j < k; j++) {
    const x = v[j * 3], y = v[j * 3 + 1], z = v[j * 3 + 2];
    PX[j] = (lu(x, y, z) - S.u0) * S.k; PY[j] = (lv(x, y, z) - S.v0) * S.k; PD[j] = ld(x, y, z);
  }
  rasterConvex(k, S.w, S.h, (i, dep) => { if (dep > buf[i]) buf[i] = dep; });
}
function splatShadow(S, x, y, z) {
  const u = Math.floor((lu(x, y, z) - S.u0) * S.k), v = Math.floor((lv(x, y, z) - S.v0) * S.k);
  if (u < 0 || v < 0 || u >= S.w || v >= S.h) return;
  const dep = ld(x, y, z), i = v * S.w + u;
  if (dep > S.buf[i]) S.buf[i] = dep;
}
// single-pixel point with a normal: tufts, flowers, pebbles
function splat(T, x, y, z, mat, n, tex, gnd) {
  const sx = Math.floor(GX(x, y) - T.x0), sy = Math.floor(GY(x, y, z) - T.y0);
  if (sx < 0 || sy < 0 || sx >= T.w || sy >= T.h) return;
  const i = sy * T.w + sx, dep = depth(x, y, z);
  if (dep <= T.d[i]) return;
  O.mat = mat; O.tex = tex || 0; O.emi = 0; O.nx = n[0]; O.ny = n[1]; O.nz = n[2]; O.gnd = gnd ? 1 : 0;
  writePx(T, i, dep, O);
}
// a 2-pixel-wide upright pole: the left pixel faces +y (moonlit), the right faces +x
const NPY = [0, 1, 0], NPX = [1, 0, 0];
function drawPole(T, S, x, y, z0, z1, mat) {
  for (let z = z0; z <= z1; z += 0.35) {
    if (T) {
      const fx = GX(x, y) - T.x0, sy = Math.floor(GY(x, y, z) - T.y0), dep = depth(x, y, z) + 0.3;
      if (sy >= 0 && sy < T.h) for (let k = 0; k < 2; k++) {
        const sx = Math.floor(fx - 0.5) + k;
        if (sx < 0 || sx >= T.w) continue;
        const i = sy * T.w + sx;
        if (dep <= T.d[i]) continue;
        const n = k ? NPX : NPY;
        O.mat = mat; O.tex = 0; O.emi = 0; O.nx = n[0]; O.ny = n[1]; O.nz = n[2]; O.gnd = 0;
        writePx(T, i, dep, O);
      }
    }
    if (S) splatShadow(S, x, y, z);
  }
}
