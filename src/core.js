// core.js - the canvas and its whole-number zoom, small helpers, the sprite atlas, seeded random,
// dither and world noise. The game is drawn at about 640 x 360 pixels and scaled up by a whole
// number, so every pixel stays a crisp square (the look and most tools follow Ball x Archers).

// ---------- screen and canvas
// STEP = fixed update step. FORE = how much round things on the ground are squashed (the view is
// three-quarters from above). W x H = the whole picture; VH ends above the plane band.
// SCALE = screen pixels per game pixel.
const STEP = 1 / 60, TAU = Math.PI * 2, FORE = 0.72;
const cv = document.getElementById('c');
// Horde and effects layers read pixels every frame; keep their destination in CPU memory.
const ctx = cv.getContext('2d', { alpha: false, willReadFrequently: true });
ctx.imageSmoothingEnabled = false;
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let W = 640, H = 360, VH = 360, SCALE = 2, zoomStep = 0;

// Fit the canvas to the window: the zoom is a whole number of screen pixels per game pixel, and the
// picture is as big as it needs to be to fill the window.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const dw = Math.max(320, Math.round(innerWidth * dpr)), dh = Math.max(180, Math.round(innerHeight * dpr));
  // about 360 rows (one zoom step more or less), but never under 240 or over 560 rows, and at
  // least 320 columns so the top bar fits on a narrow window
  const hi = Math.max(1, Math.min(Math.floor(dh / 240), Math.floor(dw / 320))), lo = Math.min(hi, Math.max(1, Math.ceil(dh / 560)));
  const s = clamp(Math.round(dh / 360) + zoomStep, lo, hi);
  const w = Math.ceil(dw / s), h = Math.ceil(dh / s);
  const changed = w !== W || h !== H || s !== SCALE;
  W = w; H = h; SCALE = s;
  syncViewHeight();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  cv.style.width = (W * s / dpr) + 'px';
  cv.style.height = (H * s / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
  return changed;
}

// ---------- utils
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
// rnd(a) = random 0..a, rnd(a, b) = random a..b. rndi(a, b) = whole number a..b.
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (a) => a[(Math.random() * a.length) | 0];
const inR = (px, py, x, y, w, h) => px >= x && py >= y && px < x + w && py < y + h;
// ease-out (cubic): fast at the start, slow at the end
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
// 0 below a, 1 above b, a smooth S-curve in between
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Make an offscreen canvas (no smoothing). Returns [canvas, context]. rf = its pixels will be read
// back (sprite making), which is faster on a canvas kept in memory.
function mk(w, h, rf) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d', rf ? { willReadFrequently: true } : undefined);
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// ---------- sprite atlas
// Small sprites are copied once into one big canvas and drawn from there, so a crowd of hundreds
// is hundreds of copies out of a single image. ATL maps a sprite to its {x, y, c} (c = the canvas
// it is in). Writing into the big atlas after it has been drawn from is slow (the whole 16 MB image
// is copied, about 10 ms), so once the first frame has used it, new sprites go into small late
// pages instead (warmAtlas in land.js puts every sprite made at start-up in before that).
const ATLAS = document.createElement('canvas');
ATLAS.width = 2048;
ATLAS.height = 2048;
const AG = ATLAS.getContext('2d');
AG.imageSmoothingEnabled = false;
const ATL = new Map();
let atX = 0, atY = 0, atH = 0, atUsed = false;
// the late pages: {c, g, x, y, h}
const LATE = [];
function atl(src) {
  let s = ATL.get(src);
  if (s !== undefined) return s;
  s = null;
  const w = src.width, h = src.height;
  if (w * h <= 4096 || (h <= 12 && w <= 512)) {
    if (atUsed) s = atlLate(src, w, h);
    else {
      if (atX + w + 1 > 2048) { atX = 0; atY += atH + 1; atH = 0; }
      if (atY + h <= 2048) {
        AG.drawImage(src, atX, atY);
        s = { x: atX, y: atY, c: ATLAS };
        atX += w + 1;
        if (h > atH) atH = h;
      }
    }
  }
  ATL.set(src, s);
  return s;
}
// A sprite made after start-up: into the last late page (512 x 512), or a new one when it is full.
function atlLate(src, w, h) {
  let p = LATE[LATE.length - 1];
  if (p && p.x + w + 1 > 512) { p.x = 0; p.y += p.h + 1; p.h = 0; }
  if (!p || p.y + h > 512) {
    if (LATE.length >= 24) return null;
    const [c, g] = mk(512, 512);
    p = { c, g, x: 0, y: 0, h: 0 };
    LATE.push(p);
  }
  p.g.drawImage(src, p.x, p.y);
  const s = { x: p.x, y: p.y, c: p.c };
  p.x += w + 1;
  if (h > p.h) p.h = h;
  return s;
}
// Draw a sprite, from the atlas when it is there. w, h are optional (stretched size).
function blit(src, x, y, w, h) {
  const s = atl(src);
  if (!s) {
    if (w == null) ctx.drawImage(src, x, y);
    else ctx.drawImage(src, x, y, w, h);
    return;
  }
  if (s.c === ATLAS) atUsed = true;
  ctx.drawImage(s.c, s.x, s.y, src.width, src.height, x, y, w == null ? src.width : w, h == null ? src.height : h);
}

// ---------- colours, numbers, random, dither, noise
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
// Short number text: 1,234 / 1.23M
function fmt(n) {
  n = Math.floor(Math.max(0, n));
  if (n < 1e6) return n.toLocaleString('en-US');
  return (n / 1e6).toFixed(2) + 'M';
}
// Seeded random generator (mulberry32): a function that gives 0..1.
function mulberry(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
// a random 0..1 fixed by three whole numbers: the same answer every time for the same place
const hrnd = (a, b, c) => hash32(Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 982451653)) / 4294967296;
// 4x4 ordered dither (Bayer): bayer(x, y) gives a 0..1 threshold for pixel (x, y), negative x and y too
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
// Smooth value noise over the endless world (grid of 1, seed s): the same value for the same (x, y)
// wherever and whenever it is asked, so the world can be built in pieces that meet without seams.
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hrnd(xi, yi, s), b = hrnd(xi + 1, yi, s), c = hrnd(xi, yi + 1, s), d = hrnd(xi + 1, yi + 1, s);
  return a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy;
}
// Draw a 1-pixel line from (x0, y0) to (x1, y1) on context g (Bresenham).
function pl(g, x0, y0, x1, y1, col) {
  g.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; x0 += sx; }
    if (e2 < dx) { e += dx; y0 += sy; }
  }
}
