// fx_pixels.js - paint a crowded particle/blast layer once, with the same pixel shapes and order.
// Like the horde buffer, this avoids thousands of tiny canvas calls during overlapping strikes.
// The ordinary drawing path remains cheaper for a quiet field.
const FXPIX = { force: null, im: null, words: null, w: 0, h: 0,
  x: 0, y: 0, globalAlpha: 1, fillStyle: '#ffffff', colors: new Map(), rows: new Map(),
  fillRect: (x, y, w, h) => fxPixelRect(x, y, w, h) };
const FXCOLOR = mk(1, 1, true)[1];
// Each entry is an immutable byte-to-byte blend operation, independent of frame or position.
const FXBLENDS = { entries: new Array(1024), next: 0, size: 0 };
function fxPixelColor(col) {
  let c = FXPIX.colors.get(col);
  if (!c) {
    FXCOLOR.clearRect(0, 0, 1, 1);
    FXCOLOR.fillStyle = col;
    FXCOLOR.fillRect(0, 0, 1, 1);
    const d = FXCOLOR.getImageData(0, 0, 1, 1).data;
    c = { r: d[0], g: d[1], b: d[2], a: d[3], word: new Uint32Array(d.buffer)[0], blends: new Map() };
    if (FXPIX.colors.size >= 256) FXPIX.colors.delete(FXPIX.colors.keys().next().value);
    FXPIX.colors.set(col, c);
  }
  return c;
}
function fxPixelBlend(c, a) {
  let blend = c.blends.get(a);
  if (blend) return blend;
  const inv = (255 - a) / 255, k = a / 255;
  const red = c.r * k, green = c.g * k, blue = c.b * k;
  blend = { r: new Uint8ClampedArray(256), g: new Uint8ClampedArray(256), b: new Uint8ClampedArray(256) };
  for (let i = 0; i < 256; i++) {
    blend.r[i] = red + i * inv;
    blend.g[i] = green + i * inv;
    blend.b[i] = blue + i * inv;
  }
  const cache = FXBLENDS;
  if (cache.size === cache.entries.length) {
    const old = cache.entries[cache.next];
    old.c.blends.delete(old.a);
  } else cache.size++;
  cache.entries[cache.next] = { c, a };
  cache.next = (cache.next + 1) % cache.entries.length;
  c.blends.set(a, blend);
  return blend;
}
function fxPixelRect(x, y, w, h) {
  const p = FXPIX, c = fxPixelColor(p.fillStyle), a = Math.round(c.a * p.globalAlpha);
  fxPixelRectColor(p, c, a, x, y, w, h);
}
function fxPixelRectColor(p, c, a, x, y, w, h) {
  if (!a) return;
  const x0 = Math.max(0, x - p.x), y0 = Math.max(0, y - p.y);
  const x1 = Math.min(p.w, x - p.x + w), y1 = Math.min(p.h, y - p.y + h);
  if (x0 >= x1 || y0 >= y1) return;
  const blend = a === 255 ? null : fxPixelBlend(c, a);
  for (let yy = y0; yy < y1; yy++) fxPixelSpan(p, c, blend, x0, yy, x1);
}
function fxPixelSpan(p, c, blend, x0, y, x1) {
  const start = y * p.w + x0, end = y * p.w + x1;
  if (!blend) {
    for (let i = start; i < end; i++) p.words[i] = c.word;
    return;
  }
  const d = p.im.data, r = blend.r, g = blend.g, b = blend.b;
  for (let i = start * 4, limit = end * 4; i < limit; i += 4) {
    d[i] = r[d[i]];
    d[i + 1] = g[d[i + 1]];
    d[i + 2] = b[d[i + 2]];
  }
}
function fxPixelCircle(x, y, r, col) {
  if (r < 0.5) return;
  const R = Math.round(r), p = FXPIX, c = fxPixelColor(col), a = Math.round(c.a * p.globalAlpha);
  x = Math.round(x); y = Math.round(y); p.fillStyle = col;
  const cx = x - p.x, cy = y - p.y;
  const y0 = Math.max(-R, -cy), y1 = Math.min(R, p.h - 1 - cy);
  if (!a || y0 > y1 || cx + R < 0 || cx - R >= p.w) return;
  let rows = p.rows.get(R);
  if (!rows) {
    rows = [];
    for (let dy = -R; dy <= R; dy++) rows.push(Math.floor(Math.sqrt(R * R - dy * dy + R * 0.5)));
    p.rows.set(R, rows);
  }
  const blend = a === 255 ? null : fxPixelBlend(c, a);
  for (let dy = y0; dy <= y1; dy++) {
    const w = rows[dy + R];
    const x0 = Math.max(0, cx - w), x1 = Math.min(p.w, cx + w + 1);
    if (x0 < x1) fxPixelSpan(p, c, blend, x0, cy + dy, x1);
  }
}
function drawFxFlames(pixels) {
  for (const f of FIRES) drawFlame(f.x, f.y, f.big, f.seed, pixels);
  for (const f of flames) drawFlame(f.x, f.y, false, f.seed, pixels);
  drawBurn(pixels);
}
function drawNormalFx(withFlames = false) {
  const p = FXPIX, use = p.force == null ? parts.length + booms.length > 160 || BURN.length > 20 : p.force;
  if (!use) {
    if (withFlames) drawFxFlames(false);
    drawParts(false); drawBooms(); return;
  }
  // The horde already paints into the opaque world canvas. Reuse that approach here: an
  // opaque destination needs only source-over colour blending, with no intermediate alpha.
  const [sx, sy] = shakeOff();
  p.w = W; p.h = VH; p.x = G.camX - sx; p.y = G.camY - sy;
  p.im = ctx.getImageData(0, 0, W, VH);
  p.words = new Uint32Array(p.im.data.buffer);
  p.globalAlpha = 1;
  if (withFlames) drawFxFlames(true);
  drawParts(false, true);
  drawBooms(true);
  ctx.globalAlpha = 1;
  // putImageData ignores the world clip, so the buffer itself ends above the plane band.
  ctx.putImageData(p.im, 0, 0);
}
