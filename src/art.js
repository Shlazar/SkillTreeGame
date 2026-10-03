// art.js - tools that make pixel-art sprites, the bitmap font and the drawing primitives.
// Sprite helpers: pix() paints a new sprite with rectangles. outline(), selOut(), tint(), flipH(),
// rot90(), castShadow(), shadowSpr(), unitShadow(), corpseSpr(), rimLight(), hotSpr() and scaleSpr()
// each make a new canvas from an existing one.
// Font: a 5x7 pixel font, baked once into a white strip. text() draws a string and caches it.
// Primitives: glow sprites and light(), pixel circles and ellipses, frame(), panel(), bar().

// ---------- sprite helpers
// Make a w x h sprite. fn gets r(x, y, w, h, color) to fill rectangles, and the context g.
function pix(w, h, fn) {
  const [c, g] = mk(w, h, true);
  fn((x, y, ww, hh, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  }, g);
  return c;
}
// Copy of src, 1 px bigger on each side, with a solid outline in color col.
function outline(src, col) {
  const sw = src.width, sh = src.height, w = sw + 2, h = sh + 2;
  const [c, g] = mk(w, h, true);
  const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
  const im = g.createImageData(w, h), od = im.data;
  const [R, G, B] = hexRgb(col);
  const A = (x, y) => (x < 0 || y < 0 || x >= sw || y >= sh) ? 0 : sd[(y * sw + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - 1, sy = y - 1, i = (y * w + x) * 4, a = A(sx, sy);
    if (a > 0) {
      const j = (sy * sw + sx) * 4;
      od[i] = sd[j]; od[i + 1] = sd[j + 1]; od[i + 2] = sd[j + 2]; od[i + 3] = a;
    } else if (A(sx - 1, sy) || A(sx + 1, sy) || A(sx, sy - 1) || A(sx, sy + 1)) {
      od[i] = R; od[i + 1] = G; od[i + 2] = B; od[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}
// Selective outline ("sel-out"): each outline pixel is a darkened copy of the sprite pixel next to
// it; top and left edges a little lighter (k = 0.42), right and bottom edges darker (k = 0.2).
function selOut(src) {
  const sw = src.width, sh = src.height, w = sw + 2, h = sh + 2;
  const [c, g] = mk(w, h, true);
  const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
  const im = g.createImageData(w, h), od = im.data;
  const A = (x, y) => (x < 0 || y < 0 || x >= sw || y >= sh) ? 0 : sd[(y * sw + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - 1, sy = y - 1, i = (y * w + x) * 4;
    if (A(sx, sy)) {
      const j = (sy * sw + sx) * 4;
      od[i] = sd[j]; od[i + 1] = sd[j + 1]; od[i + 2] = sd[j + 2]; od[i + 3] = 255;
      continue;
    }
    let nx = -1, ny = -1, lit = false;
    if (A(sx, sy + 1)) { nx = sx; ny = sy + 1; lit = true; }
    else if (A(sx + 1, sy)) { nx = sx + 1; ny = sy; lit = true; }
    else if (A(sx - 1, sy)) { nx = sx - 1; ny = sy; }
    else if (A(sx, sy - 1)) { nx = sx; ny = sy - 1; }
    if (nx < 0) continue;
    const j = (ny * sw + nx) * 4, k = lit ? 0.42 : 0.2;
    od[i] = sd[j] * k + 5; od[i + 1] = sd[j + 1] * k + 6; od[i + 2] = sd[j + 2] * k + 10; od[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// Copy of src with color col laid over it ('source-atop' = only the sprite pixels). alpha = strength.
function tint(src, col, alpha, mode) {
  const [c, g] = mk(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = mode || 'source-atop';
  g.globalAlpha = alpha == null ? 1 : alpha;
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
// Mirror image (left <-> right).
function flipH(src) {
  const [c, g] = mk(src.width, src.height);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
// Copy of src turned 90 degrees clockwise.
function rot90(src) {
  const [c, g] = mk(src.height, src.width);
  g.translate(src.height, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(src, 0, 0);
  return c;
}
// The sun is low in the north-west: every shadow falls this way (shear per pixel of height).
const SUNX = 0.55, SUNY = 0.32;
// Cast shadow: a black silhouette of src, flattened onto the ground and slanted away from the sun.
function castShadow(src, kx, ky) {
  kx = kx == null ? SUNX : kx;
  ky = ky == null ? SUNY : ky;
  const w = src.width, h = src.height;
  const [c, g] = mk(Math.ceil(w + (h - 1) * kx) + 1, Math.ceil((h - 1) * ky) + 2);
  const sil = tint(src, '#000', 1, 'source-in');
  g.setTransform(1, 0, -kx, -ky, (h - 1) * kx, (h - 1) * ky + 1);
  g.drawImage(sil, 0, 0);
  return c;
}
// Round black ground shadow (an ellipse), w px wide.
function shadowSpr(w) {
  const h = Math.max(2, Math.round(w * 0.42));
  return pix(w, h, (r) => {
    for (let y = 0; y < h; y++) {
      const yy = (y + 0.5) / h * 2 - 1;
      const hw = Math.round(Math.sqrt(1 - yy * yy) * w / 2);
      r(Math.round(w / 2 - hw), y, hw * 2, 1, '#000');
    }
  });
}
// Shadow for a unit: its cast shadow plus a round ground shadow shw px wide at its feet.
// c.pad = rows added on top.
function unitShadow(src, shw) {
  const cs = castShadow(src);
  const eh = Math.max(2, Math.round(shw * 0.42)), pad = (eh >> 1) + 1, ax = src.width >> 1;
  const [c, g] = mk(Math.max(cs.width, ax + shw), cs.height + pad);
  g.drawImage(cs, 0, pad);
  g.drawImage(shadowSpr(shw), ax - (shw >> 1), pad + 1 - (eh >> 1));
  c.pad = pad;
  return c;
}
// Dead body on the ground: the drawing turned on its side, squashed and darkened, with a dark red
// pool behind it. flip = mirror left/right.
function corpseSpr(base, flip) {
  const d = rot90(base);
  const w = d.width, h = Math.max(3, Math.round(d.height * 0.55));
  const [c, g] = mk(w + 2, h + 3);
  if (flip) { g.translate(w + 2, 0); g.scale(-1, 1); }
  g.drawImage(d, 1, 1, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(22,17,14,0.55)';
  g.fillRect(0, 0, w + 2, h + 3);
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = 'rgba(64,12,10,0.7)';
  const cx = (w + 2) / 2, cy = h * 0.6 + 1, rx = w * 0.4, ry = h * 0.55 + 1;
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    g.fillRect(Math.round(cx - hw + ((y * 7) % 3) - 1), Math.round(cy + y), hw * 2, 1);
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}
// Rim light: move the top-edge pixels of a sprite toward color col (strength a), the left edge half as much.
function rimLight(src, col, a) {
  const w = src.width, h = src.height;
  const [c, g] = mk(w, h, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, w, h), d = im.data, s = new Uint8ClampedArray(d);
  const [R, G, B] = hexRgb(col);
  const A = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 0 : s[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!s[i + 3]) continue;
    const k = !A(x, y - 1) ? a : !A(x - 1, y) ? a * 0.5 : 0;
    if (k) {
      d[i] = s[i] + (R - s[i]) * k;
      d[i + 1] = s[i + 1] + (G - s[i + 1]) * k;
      d[i + 2] = s[i + 2] + (B - s[i + 2]) * k;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}
// The same sprite as a thermal camera sees it: a warm body glows white, its clothes a little cooler.
function hotSpr(src, base) {
  const w = src.width, h = src.height;
  const [c, g] = mk(w, h, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
    const v = Math.round((base == null ? 200 : base) + 55 * l);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// Copy of src scaled by k (nearest pixel).
function scaleSpr(src, k) {
  const [c, g] = mk(Math.round(src.width * k), Math.round(src.height * k));
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ---------- bitmap font (5x7)
// One entry per character = 7 rows, top to bottom; each row is 5 bits (16 = leftmost pixel).
const GL = {
  ' ': [0,0,0,0,0,0,0],
  A: [14,17,17,31,17,17,17], B: [30,17,17,30,17,17,30], C: [14,17,16,16,16,17,14], D: [30,17,17,17,17,17,30],
  E: [31,16,16,30,16,16,31], F: [31,16,16,30,16,16,16], G: [14,17,16,23,17,17,15], H: [17,17,17,31,17,17,17],
  I: [14,4,4,4,4,4,14], J: [7,2,2,2,2,18,12], K: [17,18,20,24,20,18,17], L: [16,16,16,16,16,16,31],
  M: [17,27,21,21,17,17,17], N: [17,17,25,21,19,17,17], O: [14,17,17,17,17,17,14], P: [30,17,17,30,16,16,16],
  Q: [14,17,17,17,21,18,13], R: [30,17,17,30,20,18,17], S: [15,16,16,14,1,1,30], T: [31,4,4,4,4,4,4],
  U: [17,17,17,17,17,17,14], V: [17,17,17,17,17,10,4], W: [17,17,17,21,21,21,10], X: [17,17,10,4,10,17,17],
  Y: [17,17,10,4,4,4,4], Z: [31,1,2,4,8,16,31],
  '0': [14,17,19,21,25,17,14], '1': [4,12,4,4,4,4,14], '2': [14,17,1,2,4,8,31], '3': [30,1,1,14,1,1,30],
  '4': [2,6,10,18,31,2,2], '5': [31,16,30,1,1,17,14], '6': [6,8,16,30,17,17,14], '7': [31,1,2,4,8,8,8],
  '8': [14,17,17,14,17,17,14], '9': [14,17,17,15,1,2,12],
  '.': [0,0,0,0,0,4,4], ',': [0,0,0,0,4,4,8], ':': [0,4,4,0,4,4,0], '!': [4,4,4,4,4,0,4], '?': [14,17,1,2,4,0,4],
  '+': [0,4,4,31,4,4,0], '-': [0,0,0,14,0,0,0], '/': [1,1,2,4,8,16,16], '%': [24,25,2,4,8,19,3],
  "'": [4,4,8,0,0,0,0], '(': [2,4,8,8,8,4,2], ')': [8,4,2,2,2,4,8], '>': [8,4,2,1,2,4,8], '<': [2,4,8,16,8,4,2],
  '=': [0,0,31,0,31,0,0], '#': [10,10,31,10,31,10,10], '*': [0,4,21,14,21,4,0], '[': [14,8,8,8,8,8,14],
  ']': [14,2,2,2,2,2,14], '&': [12,18,20,8,21,18,13], '$': [4,15,20,14,5,30,4], '×': [0,17,10,4,10,17,0]
};
// FONT[char] = {x, w}: where the character sits in the white strip, and its width.
const FONT = {};
let FATLAS = null;
const TINTS = new Map();
(function () {
  const ch = Object.keys(GL);
  const [c, g] = mk(ch.length * 6, 7);
  g.fillStyle = '#fff';
  ch.forEach((k, i) => {
    let mn = 5, mx = -1;
    GL[k].forEach((bits, y) => {
      for (let x = 0; x < 5; x++) if (bits & (16 >> x)) {
        g.fillRect(i * 6 + x, y, 1, 1);
        if (x < mn) mn = x;
        if (x > mx) mx = x;
      }
    });
    if (mx < 0) { mn = 0; mx = 2; }
    if (k >= '0' && k <= '9') { mn = 0; mx = 4; }
    FONT[k] = { x: i * 6 + mn, w: mx - mn + 1 };
  });
  FATLAS = c;
})();
function fontT(col) {
  let t = TINTS.get(col);
  if (!t) { t = tint(FATLAS, col, 1, 'source-in'); TINTS.set(col, t); }
  return t;
}
// Width in pixels of string s at scale sc.
function tw(s, sc) {
  sc = sc || 1;
  s = String(s).toUpperCase();
  let w = 0;
  for (const ch of s) { const f = FONT[ch] || FONT['?']; w += (f.w + 1) * sc; }
  return Math.max(0, w - sc);
}
function dstrG(g, a, s, x, y, sc) {
  for (const ch of s) {
    const f = FONT[ch] || FONT['?'];
    g.drawImage(a, f.x, 0, f.w, 7, x, y, f.w * sc, 7 * sc);
    x += (f.w + 1) * sc;
  }
}
// Draw text (upper case). Options o: scale, align ('center' or 'right'), outline (a color, or false),
// drop (extra shadow below). The finished image is cached. Returns its width.
const TXC = new Map();
function text(s, x, y, col, o) {
  o = o || {};
  s = String(s).toUpperCase();
  const sc = o.scale || 1, w = tw(s, sc);
  if (o.align === 'center') x -= w / 2;
  else if (o.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const ol = o.outline === false ? '' : (o.outline || '#07080a');
  const key = s + '|' + (col || '') + '|' + sc + '|' + ol + (o.drop ? '|d' : '');
  let c = TXC.get(key);
  if (!c) {
    if (TXC.size > 700) TXC.clear();
    let g;
    [c, g] = mk(w + sc * 2, 7 * sc + sc * (o.drop ? 3 : 2));
    if (ol) {
      const a = fontT(ol);
      dstrG(g, a, s, 0, sc, sc); dstrG(g, a, s, sc * 2, sc, sc); dstrG(g, a, s, sc, 0, sc); dstrG(g, a, s, sc, sc * 2, sc);
      if (o.drop) dstrG(g, a, s, sc * 2, sc * 3, sc);
    }
    dstrG(g, fontT(col || '#e8dfc8'), s, sc, sc, sc);
    TXC.set(key, c);
  }
  ctx.drawImage(c, x - sc, y - sc);
  return w;
}

// ---------- drawing primitives
// A 64x64 round glow in color col: bright centre, dithered steps to the edge (made on first use).
const GLOWS = new Map();
function glow(col) {
  let c = GLOWS.get(col);
  if (!c) {
    const [cc, g] = mk(64, 64);
    const [R, G, B] = hexRgb(col);
    const im = g.createImageData(64, 64), d = im.data;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const t = Math.hypot(x - 31.5, y - 31.5) / 32;
      if (t >= 1) continue;
      const q = Math.floor(Math.pow(1 - t, 1.7) * 5 + bayer(x, y) * 0.9) / 5;
      if (q <= 0) continue;
      const i = (y * 64 + x) * 4;
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(Math.min(0.9, q) * 255);
    }
    g.putImageData(im, 0, 0);
    c = cc;
    GLOWS.set(col, c);
  }
  return c;
}
// A glow of radius rad at (x, y), strength a (call it with the 'lighter' blend mode).
function light(x, y, rad, col, a) {
  if (rad < 1) return;
  ctx.globalAlpha = clamp(a == null ? 1 : a, 0, 1);
  blit(glow(col), Math.round(x - rad), Math.round(y - rad), Math.round(rad * 2), Math.round(rad * 2));
}
// Filled pixel circle.
function pcirc(x, y, r, col) {
  if (r < 0.5) return;
  ctx.fillStyle = col;
  x = Math.round(x); y = Math.round(y);
  const R = Math.round(r);
  for (let dy = -R; dy <= R; dy++) {
    const w = Math.floor(Math.sqrt(R * R - dy * dy + R * 0.5));
    ctx.fillRect(x - w, y + dy, w * 2 + 1, 1);
  }
}
// Pixel ellipse outline, drawn as dots.
function pell(x, y, rx, ry, col) {
  ctx.fillStyle = col;
  const n = Math.max(16, Math.ceil((rx + ry) * 1.7));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1);
  }
}
// 1-pixel rectangle outline without the corner pixels.
function frame(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
}
// UI panel: fill, frame, a light top line and a dark bottom line.
function panel(x, y, w, h, bg) {
  ctx.fillStyle = bg || '#101115';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, '#2e3139');
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.fillStyle = '#07080a';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
}
// Bar with a dark border. f = filled part 0..1, hi = optional 1 px highlight on top of the fill.
function bar(x, y, w, h, f, bg, fg, hi) {
  ctx.fillStyle = '#07080a';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(f, 0, 1));
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, fw, h);
  if (hi) { ctx.fillStyle = hi; ctx.fillRect(x, y, fw, 1); }
}
