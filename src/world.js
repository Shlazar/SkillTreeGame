/* The endless world. Terrain is painted per pixel; scenery is dealt out per 32-unit cell from a
 * hash, so any part of the world can be rebuilt identically. The G-buffer lives in 128 px tiles
 * held in a wrap-around store (12 x 8 tiles) that mirrors the GPU textures: scrolling only ever
 * builds the strip of tiles coming into view. */

/* ----------------------------------------------------------------- roads */
const ROAD = { sx: 380, sy: 440 };
function roadDist(x, y) {
  const wx = x + 26 * Math.sin(y * 0.0071) + 11 * Math.sin(y * 0.019 + 1.7);
  const wy = y + 26 * Math.sin(x * 0.0063 + 0.6) + 11 * Math.sin(x * 0.017 + 2.9);
  return Math.min(Math.abs(mod(wx, ROAD.sx) - ROAD.sx / 2), Math.abs(mod(wy, ROAD.sy) - ROAD.sy / 2));
}
function roadGrad(x, y) {
  const gx = roadDist(x + 1, y) - roadDist(x - 1, y), gy = roadDist(x, y + 1) - roadDist(x, y - 1), l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l];
}
const fieldAt = (x, y) => noise2(x * 0.0042 + 31.7, y * 0.0042 - 12.3, 31);
const forestAt = (x, y) => noise2(x * 0.0075, y * 0.0075, 81);

/* ---------------------------------------------------------------- terrain */
function terrainPaint(o) {
  const x = o.x, y = o.y, r = rnd(o.sx, o.sy, 22), rd = roadDist(x, y);
  if (rd < 6.2) {                                   // a farm track: two muddy ruts, a grassy crown
    if (rd < 1.1) { o.mat = r < 0.5 ? M.grassDk : M.dirt; o.tex = r < 0.15 ? -1 : 0; }
    else if (Math.abs(rd - 2.4) < 0.8) { o.mat = M.mud; o.tex = r < 0.25 ? -1 : 0; }
    else if (rd < 4.9) { o.mat = M.dirt; o.tex = r < 0.12 ? 1 : r > 0.9 ? -1 : 0; }
    else { o.mat = noise2(x * 0.5, y * 0.5, 9) > 0.5 ? M.grassDk : M.dirt; o.tex = r < 0.2 ? -1 : 0; }
    return;
  }
  const fn = fieldAt(x, y);
  if (fn > 0.64 && rd > 9) {                        // a ploughed field, furrows one way per field
    const fa = Math.floor(noise2(x * 0.0021, y * 0.0021, 32) * 4) * (Math.PI / 4);
    const s = Math.sin((x * Math.cos(fa) + y * Math.sin(fa)) * 1.6);
    o.mat = fn < 0.665 ? M.grassDk : s > 0.35 ? M.soil : M.soilDk;
    o.tex = s > 0.85 ? 1 : r < 0.08 ? -1 : 0;
    return;
  }
  o.mat = noise2(x * 0.085, y * 0.085, 5) > 0.6 ? M.grassDk : M.grass;
  if (noise2(x * 0.06 + 40, y * 0.06, 6) > 0.7 && r < 0.35) o.mat = M.grassLt;
  o.tex = r < 0.1 ? 1 : r > 0.92 ? -1 : 0;
  if (noise2(x * 0.03 + 11, y * 0.03 - 4, 7) > 0.78 && r < 0.6) { o.mat = M.dirt; o.tex = r < 0.1 ? -1 : 0; }
}

/* ---------------------------------------------------------------- scenery */
function barkPaint(o) { o.tex = rnd(o.sx, o.sy, 93) < 0.2 ? -1 : 0; }
function pinePaint(seed) {
  return (o) => {
    o.mat = noise2(o.x * 0.45 + o.z * 0.2, o.y * 0.45 - o.z * 0.35, seed) > 0.56 ? M.pineDk : M.pine;
    const r = rnd(o.sx, o.sy, seed);
    o.tex = r < 0.08 ? 1 : r > 0.9 ? -1 : 0;
  };
}
function leafPaint(seed, autumn) {
  return (o) => {
    const n = noise2(o.x * 0.42 + o.z * 0.25, o.y * 0.42 - o.z * 0.3, seed);
    o.mat = autumn ? (n > 0.5 ? M.autumn : M.autumnDk) : n > 0.64 ? M.leafLt : n < 0.34 ? M.leafDk : M.leaf;
    const r = rnd(o.sx, o.sy, seed + 1);
    o.tex = r < 0.07 ? 1 : r > 0.92 ? -1 : 0;
  };
}
function pine(F, x, y, h, seed) {
  cyl(F, TF0, 2, 0, h * 0.34, x, y, 0.9, 8, M.bark, { cap0: false, paint: barkPaint });
  for (let k = 0; k < 3; k++) {
    const z0 = h * (0.2 + k * 0.23), z1 = z0 + h * (0.44 - k * 0.04), r = h * (0.3 - k * 0.075);
    cone(F, TF0, x, y, z0, z1, r, 14, M.pine, { paint: pinePaint(seed + k), rot: rnd(seed, k, 3) * TAU });
  }
}
function roundTree(F, x, y, h, seed, autumn) {
  cyl(F, TF0, 2, 0, h * 0.55, x, y, 1.1, 8, M.bark, { cap0: false, paint: barkPaint });
  const rng = mulberry(seed), R = h * 0.28, paint = leafPaint(seed, autumn);
  sphere(F, x, y, h * 0.66, R, M.leaf, { paint });
  for (let k = 0; k < 5; k++) {
    const a = rng() * TAU, d = R * (0.55 + rng() * 0.25);
    sphere(F, x + Math.cos(a) * d, y + Math.sin(a) * d, h * (0.52 + rng() * 0.28), R * (0.5 + rng() * 0.2), M.leaf, { paint });
  }
}
function bush(F, x, y, r, seed) { sphere(F, x, y, r * 0.35, r, M.leaf, { paint: leafPaint(seed, false) }); }
function rockPaint(o) { const r = rnd(o.sx, o.sy, 57); o.mat = r < 0.3 ? M.rockDk : M.rock; o.tex = r > 0.9 ? 1 : r < 0.12 ? -1 : 0; }
function glassPaint(o, F) {
  if (F.side === 5 || (Math.abs(o.lx) > 0.72 && Math.abs(o.ly) > 0.72)) { o.mat = M.iron; return; }
  o.mat = E.lamp; o.tex = o.lz < 0.9 ? 4 : 3; o.emi = CH.lamp;
}
function lampPost(F, P, x, y, h) {
  P.push([x, y, 0, h - 1.8, M.iron]);
  box(F, tfAt(x, y, h - 2, 0), -1, 1, -1, 1, 0, 2, M.iron, { paint: glassPaint, noShadow: true });
  box(F, TF0, x - 1.4, x + 1.4, y - 1.4, y + 1.4, h, h + 0.6, M.iron);
  P.push([x, y, h + 0.6, h + 1.4, M.iron]);
}
// a farmhouse: walls with windows (some lit), a slate roof and a chimney
function housePaints(seed) {
  const rng = mulberry(seed), wall = [M.plaster, M.woodLt, M.brick][Math.floor(rng() * 3)], lit = [];
  for (let k = 0; k < 8; k++) lit.push(rng() < 0.55);
  const opens = [];
  for (const side of [3, 4]) for (let k = 0; k < 3; k++) opens.push({ side, a: -11 + k * 9, b: -7 + k * 9, z0: 5, z1: 10, lit: lit[opens.length], door: side === 3 && k === 1 });
  for (const side of [1, 2]) opens.push({ side, a: -2, b: 2, z0: 5, z1: 10, lit: lit[opens.length] });
  const wallPaint = (o, F) => {
    const hc = F.side === 1 || F.side === 2 ? o.ly : o.lx, z = o.lz;
    for (const w of opens) {
      if (w.side !== F.side || hc < w.a || hc > w.b || z > w.z1 || z < (w.door ? 0 : w.z0)) continue;
      const fa = hc - w.a, fb = w.b - hc, fz1 = w.z1 - z, fz0 = z - w.z0, mid = (w.a + w.b) / 2, zm = (w.z0 + w.z1) / 2;
      if (w.door) {
        if (fa < 0.5 || fb < 0.5 || fz1 < 0.5) { o.mat = M.woodDk; o.tex = 1; return; }
        o.mat = M.woodDk; o.tex = mod(hc, 1.0) < 0.25 ? -1 : 0;
        return;
      }
      if (fa < 0.5 || fb < 0.5 || fz0 < 0.5 || fz1 < 0.5) { o.mat = M.woodDk; o.tex = fz1 < 0.5 ? 1 : 0; return; }
      if (Math.abs(hc - mid) < 0.3 || Math.abs(z - zm) < 0.3) { o.mat = E.sil; o.tex = 3; o.emi = 0; return; }
      if (w.lit) { o.mat = E.window; o.tex = z > zm ? 4 : 5; o.emi = CH.window; } else { o.mat = E.sil; o.tex = 1; o.emi = 0; }
      return;
    }
    if (z < 1.6) { o.mat = M.stoneDk; o.tex = mod(hc, 2.4) < 0.3 ? -1 : 0; return; }
    if (wall === M.brick) { const row = Math.floor(z / 0.9); o.tex = mod(z, 0.9) < 0.3 || mod(hc + (row & 1) * 1.1, 2.2) < 0.35 ? -1 : 0; return; }
    if (wall === M.woodLt) { o.tex = mod(z, 1.2) < 0.3 ? -1 : 0; return; }
    o.tex = rnd(o.sx, o.sy, 91) < 0.06 ? -1 : 0;
  };
  return { wall, opens, wallPaint };
}
function roofPaint(o) {
  if (o.flip) { o.mat = M.woodDk; o.tex = -1; return; }
  const row = Math.floor(o.lz / 1.05), col = Math.floor((o.lx + (row & 1) * 1.1) / 2.2);
  o.mat = rnd(col, row, 95) < 0.3 ? M.slateDk : M.slate;
  o.tex = mod(o.lz, 1.05) < 0.3 ? -1 : 0;
}
function house(F, P, ob) {
  const tf = tfAt(ob.x, ob.y, 0, ob.hd), hp = housePaints(ob.seed), L = 15, Wd = 10, Hw = 13, ridge = 21, oh = 1.4;
  const w = (x, y, z) => W3(tf, x, y, z), n = (x, y, z) => nL(tf, x, y, z);
  box(F, tf, -L, L, -Wd, Wd, 0, Hw, hp.wall, { paint: hp.wallPaint });
  const slope = (ridge - Hw) / (Wd + oh), zAt = (y) => ridge - slope * Math.abs(y);
  for (const [x, sx] of [[L, 1], [-L, -1]]) {
    pushPts(F, [w(x, Wd, Hw), w(x, Wd, zAt(Wd)), w(x, 0, ridge), w(x, -Wd, zAt(-Wd)), w(x, -Wd, Hw)], M.woodLt,
      { paint: (o) => { o.mat = mod(o.ly, 1.6) < 0.35 ? M.woodDk : M.woodLt; o.tex = 0; }, side: sx > 0 ? 1 : 2, tf }, n(sx, 0, 0));
  }
  const xa = -L - oh, xb = L + oh;
  pushPts(F, [w(xa, Wd + oh, Hw - oh * slope), w(xb, Wd + oh, Hw - oh * slope), w(xb, 0, ridge), w(xa, 0, ridge)], M.slate, { paint: roofPaint, two: true, tf }, n(0, 1, 1));
  pushPts(F, [w(xa, -Wd - oh, Hw - oh * slope), w(xa, 0, ridge), w(xb, 0, ridge), w(xb, -Wd - oh, Hw - oh * slope)], M.slate, { paint: roofPaint, two: true, tf }, n(0, -1, 1));
  box(F, tf, 7, 9.6, -5, -2.4, 15, 25, M.brick, { paint: (o, F2) => { if (F2.side !== 5 && mod(o.lz, 0.9) < 0.3) o.tex = -1; } });
}
function carPaints(burnt) {
  const body = (o, F) => {
    if (burnt) { const r = rnd(o.sx, o.sy, 33); o.mat = r < 0.35 ? M.rust : M.soot; o.tex = r > 0.9 ? 1 : 0; return; }
    if (F.side === 5) { o.tex = 1; return; }
    if (o.lz < 2.4) { o.mat = M.iron; o.tex = -1; }
  };
  const cabin = (o, F) => {
    if (F.side === 5) { if (burnt) { o.mat = M.soot; o.tex = -1; } else o.tex = 1; return; }
    const a = F.side === 1 || F.side === 2 ? o.ly : o.lx;
    if (o.lz > 5.8 && o.lz < 8.0 && Math.abs(mod(a + 20, 5) - 2.5) < 2.0) { o.mat = burnt ? M.soot : M.glassDk; o.tex = burnt ? -1 : 1; return; }
    if (burnt) { o.mat = rnd(o.sx, o.sy, 34) < 0.4 ? M.rust : M.soot; o.tex = 0; }
  };
  return { body, cabin };
}
function car(F, ob) {
  const tf = tfAt(ob.x, ob.y, 0, ob.hd), p = carPaints(ob.burning), L = 11, Wd = 5;
  for (const wx of [-7, 7]) for (const s of [-1, 1]) {
    cyl(F, tf, 1, s * (Wd - 1.4), s * (Wd + 0.1), wx, 2.2, 2.2, 8, M.tire, {});
  }
  box(F, tf, -L, L, -Wd, Wd, 1.6, 5.4, ob.burning ? M.soot : ob.paint, { paint: p.body });
  box(F, tf, -5.5, 4.5, -Wd + 0.6, Wd - 0.6, 5.4, 8.8, ob.burning ? M.soot : ob.paint, { paint: p.cabin });
}

/* --------------------------------------------------------------- the cells */
const CELL = 32, MAXH = 44, MAXR = 22;
const cellCache = new Map();
const cellKey = (ci, cj) => (ci + 32768) * 65536 + (cj + 32768);
const CAR_PAINT = [M.carRed, M.carBlue, M.carCream, M.carGreen];
function cellObjects(ci, cj) {
  const key = cellKey(ci, cj);
  let c = cellCache.get(key);
  if (c) return c;
  const rng = mulberry(hash(ci * 7919 + 13) ^ hash(cj * 104729 + 7) ^ 0x51ed27);
  const x0 = ci * CELL, y0 = cj * CELL, cx = x0 + CELL / 2, cy = y0 + CELL / 2, list = [];
  const rd = roadDist(cx, cy);
  const inCell = (x, y, m) => x > x0 + m && x < x0 + CELL - m && y > y0 + m && y < y0 + CELL - m;
  // a lamp post beside the track now and then
  if (rd < CELL * 0.8 && rng() < 0.28) {
    const px = cx + (rng() - 0.5) * CELL * 0.5, py = cy + (rng() - 0.5) * CELL * 0.5, g = roadGrad(px, py), d = roadDist(px, py);
    const x = px + g[0] * (10 - d), y = py + g[1] * (10 - d);
    if (inCell(x, y, 2) && Math.abs(roadDist(x, y) - 10) < 2.5) {
      list.push({ kind: 'lamp', x, y, h: 17, r: 2, seed: hash(key) % 1000,
        light: { x, y, z: 16, r: 46, kind: 'lamp', glowR: 15 } });
    }
  }
  // an abandoned car on the track; some still burn
  if (rd < 3.6 && rng() < 0.1) {
    const g = roadGrad(cx, cy), hd = Math.atan2(g[1], g[0]) + Math.PI / 2 + (rng() - 0.5) * 0.7, burning = rng() < 0.45;
    const x = cx + (rng() - 0.5) * 6, y = cy + (rng() - 0.5) * 6;
    list.push({ kind: 'car', x, y, hd, r: 9, h: 9, burning, paint: CAR_PAINT[Math.floor(rng() * 4)], seed: hash(key + 1) % 1000,
      light: burning ? { x, y, z: 9, r: 52, kind: 'fire', ch: 3 + (hash(key) & 3) } : null });
  }
  // a farmhouse back from the track, rarely
  if (rd > 30 && rd < 60 && rnd(ci, cj, 77) < 0.012 && fieldAt(cx, cy) < 0.62) {
    const g = roadGrad(cx, cy), hd = Math.atan2(g[1], g[0]);
    const seed = hash(key + 2) % 100000, hp = housePaints(seed), lights = [];
    const tf = tfAt(cx, cy, 0, hd);
    for (const w of hp.opens) if (w.lit) {
      const m = (w.a + w.b) / 2;
      const q = w.side === 3 ? W3(tf, m, 12, 7.5) : w.side === 4 ? W3(tf, m, -12, 7.5) : W3(tf, w.side === 1 ? 17 : -17, m, 7.5);
      lights.push({ x: q[0], y: q[1], z: q[2], r: 24, kind: 'window', ch: CH.window });
    }
    list.push({ kind: 'house', x: cx, y: cy, hd, r: 19, h: 26, seed, lights });
  }
  // trees: copses where the forest noise is high, a lone tree elsewhere; none in fields or tracks
  const forest = forestAt(cx, cy), dense = forest > 0.64;
  const nt = dense ? 1 + Math.floor(rng() * 3) : rng() < 0.07 ? 1 : 0;
  for (let k = 0; k < nt; k++) {
    const x = x0 + 4 + rng() * (CELL - 8), y = y0 + 4 + rng() * (CELL - 8), kind = rng(), seed = hash(key + 10 + k) % 100000;
    if (roadDist(x, y) < 16 || fieldAt(x, y) > 0.62) continue;
    if (kind < 0.6) list.push({ kind: 'pine', x, y, h: 24 + rng() * 12, r: 9, seed });
    else list.push({ kind: 'tree', x, y, h: 22 + rng() * 9, r: 10, seed, autumn: noise2(x * 0.006, y * 0.006, 82) > 0.62 });
  }
  if (rng() < 0.1) {
    const x = x0 + 3 + rng() * (CELL - 6), y = y0 + 3 + rng() * (CELL - 6);
    if (roadDist(x, y) > 9 && fieldAt(x, y) < 0.62) list.push({ kind: 'bush', x, y, r: 3 + rng() * 2.2, h: 6, seed: hash(key + 30) % 100000 });
  }
  if (rng() < 0.05) {
    const x = x0 + 3 + rng() * (CELL - 6), y = y0 + 3 + rng() * (CELL - 6);
    if (roadDist(x, y) > 8) list.push({ kind: 'rock', x, y, r: 1.8 + rng() * 1.8, h: 4, seed: hash(key + 40) % 100000 });
  }
  c = { list, faces: null, poles: null };
  if (cellCache.size > 6000) cellCache.clear();
  cellCache.set(key, c);
  return c;
}
// the faces of a cell's scenery, built once and kept with the cell
function cellGeometry(c) {
  if (c.faces) return c;
  const F = [], P = [];
  for (const ob of c.list) {
    if (ob.kind === 'pine') pine(F, ob.x, ob.y, ob.h, ob.seed);
    else if (ob.kind === 'tree') roundTree(F, ob.x, ob.y, ob.h * 0.85, ob.seed, ob.autumn);
    else if (ob.kind === 'bush') bush(F, ob.x, ob.y, ob.r, ob.seed);
    else if (ob.kind === 'rock') sphere(F, ob.x, ob.y, 0.4, ob.r, M.rock, { paint: rockPaint });
    else if (ob.kind === 'lamp') lampPost(F, P, ob.x, ob.y, ob.h);
    else if (ob.kind === 'car') car(F, ob);
    else if (ob.kind === 'house') house(F, P, ob);
  }
  c.faces = F; c.poles = P;
  return c;
}
function forCells(x0, y0, x1, y1, fn) {
  const i0 = Math.floor(x0 / CELL), i1 = Math.floor(x1 / CELL), j0 = Math.floor(y0 / CELL), j1 = Math.floor(y1 / CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) fn(cellObjects(i, j), i, j);
}
// the world box under a rectangle of global pixels at ground level
const BX = [0, 0, 0];
function groundBox(gx0, gy0, gx1, gy1) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [gx, gy] of [[gx0, gy0], [gx1, gy0], [gx0, gy1], [gx1, gy1]]) {
    groundAtG(gx, gy, BX);
    x0 = Math.min(x0, BX[0]); x1 = Math.max(x1, BX[0]); y0 = Math.min(y0, BX[1]); y1 = Math.max(y1, BX[1]);
  }
  return [x0, y0, x1, y1];
}

/* ------------------------------------------------------------ the tile store */
const TS = 128, NTX = 12, NTY = 8, TW = TS * NTX, TH = TS * NTY;
const mAlb = new Uint8Array(TW * TH * 4), mDep = new Float32Array(TW * TH), mGnd = new Uint8Array(TW * TH), mLit = new Uint8Array(TW * TH);
const slotKey = new Float64Array(NTX * NTY).fill(-1);
const slotDirty = new Uint8Array(NTX * NTY);
const tileKey = (tx, ty) => tx * 65536 + ty;
const TT = target(TS, TS);
const tA = new Uint8Array(TS * TS * 4), tN = new Uint8Array(TS * TS * 4), tD = new Float32Array(TS * TS);
const WORLD = { upload: null, uploadAlb: null, built: 0 };
const UP = [0, 0, 1];
let TSM = smap(8, 8, 1);

function buildTile(tx, ty) {
  const T = TT, gx0 = tx * TS, gy0 = ty * TS;
  T.x0 = gx0; T.y0 = gy0;
  T.d.fill(-1e9); T.mat.fill(0); T.lit.fill(1); T.gnd.fill(0);
  // 1. the ground
  for (let ly = 0; ly < TS; ly++) {
    const gy = gy0 + ly, dep = groundDepthG(gy + 0.5);
    for (let lx = 0; lx < TS; lx++) {
      const gx = gx0 + lx, i = ly * TS + lx;
      unprojectG(gx + 0.5, gy + 0.5, dep, P3);
      O.x = P3[0]; O.y = P3[1]; O.z = 0; O.sx = gx; O.sy = gy; O.emi = 0; O.gnd = 1; O.nx = 0; O.ny = 0; O.nz = 1;
      terrainPaint(O);
      writePx(T, i, dep, O);
    }
  }
  // 2. tufts, flowers and pebbles on the grass
  const gb = groundBox(gx0 - 2, gy0 - 2, gx0 + TS + 2, gy0 + TS + 2);
  forCells(gb[0], gb[1], gb[2], gb[3], (c, i, j) => {
    const rng = mulberry(hash(i * 31337 + 5) ^ hash(j * 7331 + 11));
    for (let k = 0; k < 26; k++) {
      const x = i * CELL + rng() * CELL, y = j * CELL + rng() * CELL, r = rng(), m = rng();
      if (roadDist(x, y) < 6.5 || fieldAt(x, y) > 0.64) continue;
      if (r < 0.1) {
        const mat = [M.flowerR, M.flowerY, M.flowerW][Math.floor(m * 3)];
        for (let q = 0; q < 3; q++) splat(T, x + (rng() - 0.5) * 3, y + (rng() - 0.5) * 3, 0.5, mat, UP, rng() < 0.5 ? 1 : 0, 1);
      } else if (r < 0.88) {
        splat(T, x, y, 0.45, M.grassLt, UP, 0, 1);
        if (m < 0.5) splat(T, x, y, 1.3, M.grass, UP, 1, 1);
      } else splat(T, x, y, 0.4, M.stone, UP, 0, 1);
    }
  });
  // 3. scenery standing in or reaching into the tile
  const padS = MAXR * SC, padT = MAXR * SC * 0.5, padB = MAXH * ZK;
  const db = groundBox(gx0 - padS, gy0 - padT, gx0 + TS + padS, gy0 + TS + padB);
  const drawn = [];
  forCells(db[0], db[1], db[2], db[3], (c) => {
    if (!c.list.length) return;
    cellGeometry(c);
    drawn.push(c);
    for (const f of c.faces) drawAny(f, T);
    for (const p of c.poles) drawPole(T, null, p[0], p[1], p[2], p[3], p[4]);
  });
  // 4. moon shadows: a shadow map fitted to the tile, with every caster near enough to reach it
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [gx, gy] of [[gx0, gy0], [gx0 + TS, gy0], [gx0, gy0 + TS], [gx0 + TS, gy0 + TS]]) {
    for (const z of [0, MAXH]) {
      unprojectG(gx, gy, groundDepthG(gy) + z / CV[2], P3);
      const u = lu(P3[0], P3[1], P3[2]), v = lv(P3[0], P3[1], P3[2]);
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
  }
  const sw = Math.ceil(u1 - u0) + 8, sh = Math.ceil(v1 - v0) + 8;
  if (TSM.buf.length < sw * sh) TSM = smap(sw, sh, 1);
  TSM.w = sw; TSM.h = sh; TSM.u0 = u0 - 4; TSM.v0 = v0 - 4;
  TSM.buf.fill(-1e9, 0, sw * sh);
  const sb = [db[0] - 40, db[1] - 40, db[2] + 40, db[3] + 40];
  forCells(sb[0], sb[1], sb[2], sb[3], (c) => {
    if (!c.list.length) return;
    cellGeometry(c);
    for (const f of c.faces) shadowAny(f, TSM);
    for (const p of c.poles) drawPole(null, TSM, p[0], p[1], p[2], p[3], p[4]);
  });
  for (let i = 0; i < TS * TS; i++) {
    const m = T.mat[i];
    if (!m || m >= 128) continue;
    const lam = (T.nx[i] * LD[0] + T.ny[i] * LD[1] + T.nz[i] * LD[2]) / 127;
    if (lam <= 0) continue;
    unprojectG(gx0 + (i % TS) + 0.5, gy0 + ((i / TS) | 0) + 0.5, T.d[i], P3);
    if (shadowed(TSM, P3[0], P3[1], P3[2], 0.9 + 1.4 * (1 - lam))) T.lit[i] = 0;
  }
  // 5. encode for the GPU: albedo + class, normal + moon visibility, depth
  for (let i = 0; i < TS * TS; i++) {
    const m = T.mat[i], o = i * 4;
    tD[i] = T.d[i];
    tN[o] = 128 + T.nx[i]; tN[o + 1] = 128 + T.ny[i]; tN[o + 2] = 128 + T.nz[i]; tN[o + 3] = T.lit[i] ? 255 : 0;
    if (m >= 128) {
      const e = EMIS[m - 128], c = e[clamp(T.tex[i], 0, e.length - 1)];
      tA[o] = c & 255; tA[o + 1] = (c >> 8) & 255; tA[o + 2] = (c >> 16) & 255; tA[o + 3] = 1 + Math.min(126, T.emi[i]);
      continue;
    }
    const s = MATSRGB[m] || MATSRGB[M.grass], k = clamp(1 + 0.13 * T.tex[i], 0.6, 1.4);
    tA[o] = clamp(s[0] * k, 0, 255); tA[o + 1] = clamp(s[1] * k, 0, 255); tA[o + 2] = clamp(s[2] * k, 0, 255); tA[o + 3] = MATCLASS[m] || 200;
  }
  // 6. the ground marks already made here (blood, craters, the fallen)
  const list = DECALS.get(tileKey(tx, ty));
  if (list) for (const d of list) paintDecal(d, tA, T.gnd, 0, 0, TS, gx0, gy0);
  // 7. into the wrap-around store and the GPU
  const sx = mod(tx, NTX), sy = mod(ty, NTY), ox = sx * TS, oy = sy * TS;
  for (let ly = 0; ly < TS; ly++) {
    const di = (oy + ly) * TW + ox, si = ly * TS;
    mAlb.set(tA.subarray(si * 4, (si + TS) * 4), di * 4);
    mDep.set(tD.subarray(si, si + TS), di);
    mGnd.set(T.gnd.subarray(si, si + TS), di);
    mLit.set(T.lit.subarray(si, si + TS), di);
  }
  slotKey[sy * NTX + sx] = tileKey(tx, ty);
  slotDirty[sy * NTX + sx] = 0;
  if (WORLD.upload) WORLD.upload(ox, oy, tA, tN, tD);
  WORLD.built++;
}
const resident = (tx, ty) => slotKey[mod(ty, NTY) * NTX + mod(tx, NTX)] === tileKey(tx, ty);
// make sure the tiles on screen exist; then build up to `budget` ms of the ring around them
function ensureTiles(budget) {
  const tx0 = Math.floor(VIEW.x / TS), tx1 = Math.floor((VIEW.x + W - 1) / TS);
  const ty0 = Math.floor(VIEW.y / TS), ty1 = Math.floor((VIEW.y + H - 1) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (!resident(tx, ty)) buildTile(tx, ty);
  const start = performance.now(), cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2, todo = [];
  for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
    if (!resident(tx, ty)) todo.push([tx, ty, Math.hypot(tx - cx, (ty - cy) * 1.4)]);
  }
  todo.sort((a, b) => a[2] - b[2]);
  for (const [tx, ty] of todo) {
    if (performance.now() - start > budget) break;
    buildTile(tx, ty);
  }
}
// screen pixel -> index into the store (rows and columns cached per frame)
const rowB = new Int32Array(H), colB = new Int32Array(W);
function syncView() {
  for (let y = 0; y < H; y++) rowB[y] = mod(VIEW.y + y, TH) * TW;
  for (let x = 0; x < W; x++) colB[x] = mod(VIEW.x + x, TW);
}
const storeAt = (sx, sy) => rowB[sy] + colB[sx];

/* ------------------------------------------------------------------ decals
 * Marks baked into the ground's albedo, so the GPU lights them like the ground: blood, scorched
 * craters, bullet scars and the bodies of the fallen. Each is kept with every tile it touches, to
 * be painted again whenever that tile is rebuilt. */
const DECALS = new Map();
const DECAL_CAP = 700;
function decalBox(d) {
  const cx = GX(d.x, d.y), cy = GY(d.x, d.y, 0), r = d.type === 'scorch' ? d.s * 1.75 : d.type === 'corpse' ? (d.big ? 18 : 12) : d.s * 1.5 + 2;
  return [Math.floor(cx - r), Math.floor(cy - r), Math.ceil(cx + r), Math.ceil(cy + r)];
}
function addDecal(d) {
  const b = decalBox(d);
  const tx0 = Math.floor(b[0] / TS), tx1 = Math.floor(b[2] / TS), ty0 = Math.floor(b[1] / TS), ty1 = Math.floor(b[3] / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const key = tileKey(tx, ty);
    let list = DECALS.get(key);
    if (!list) DECALS.set(key, (list = []));
    list.push(d);
    if (list.length > DECAL_CAP) list.splice(0, list.length - DECAL_CAP);
    if (!resident(tx, ty)) continue;
    const sx = mod(tx, NTX), sy = mod(ty, NTY);
    paintDecal(d, mAlb, mGnd, sx * TS, sy * TS, TW, tx * TS, ty * TS);
    slotDirty[sy * NTX + sx] = 1;
  }
}
// push the albedo of tiles that gained marks this frame
function flushDecals() {
  for (let s = 0; s < NTX * NTY; s++) {
    if (!slotDirty[s]) continue;
    slotDirty[s] = 0;
    if (WORLD.uploadAlb) WORLD.uploadAlb((s % NTX) * TS, ((s / NTX) | 0) * TS);
  }
}
const CHAR_K = 0.12;
function mixPx(A, o, r, g, b, a) {
  A[o] += (r - A[o]) * a; A[o + 1] += (g - A[o + 1]) * a; A[o + 2] += (b - A[o + 2]) * a;
}
// paint decal d into the TS x TS region at global (rx, ry), stored in A/G at (ox, oy) with stride
function paintDecal(d, A, G, ox, oy, stride, rx, ry) {
  const b = decalBox(d);
  const x0 = Math.max(b[0], rx), x1 = Math.min(b[2], rx + TS - 1), y0 = Math.max(b[1], ry), y1 = Math.min(b[3], ry + TS - 1);
  if (x0 > x1 || y0 > y1) return;
  const cx = GX(d.x, d.y), cy = GY(d.x, d.y, 0), seed = d.seed | 0;
  if (d.type === 'corpse') { paintCorpse(d, A, G, ox, oy, stride, rx, ry, x0, y0, x1, y1, cx, cy); return; }
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const idx = (oy + gy - ry) * stride + ox + gx - rx;
    if (!G[idx]) continue;
    const dx = gx + 0.5 - cx, dy = (gy + 0.5 - cy) * 2, q = Math.sqrt(dx * dx + dy * dy) / d.s, o = idx * 4;
    if (d.type === 'blood') {
      const edge = 0.55 + 0.45 * noise2(Math.atan2(dy, dx) * 1.7 + seed, seed * 0.37, 41);
      const drop = q < 1.6 && rnd(gx, gy, seed) < 0.1;
      if (q < edge) mixPx(A, o, 70, 12, 12, 0.78 - 0.2 * q);
      else if (drop) mixPx(A, o, 90, 18, 16, 0.65);
    } else if (d.type === 'scorch') {
      const edge = 0.72 + 0.4 * noise2(Math.atan2(dy, dx) * 2.4 + seed, seed * 0.21, 42);
      const k = q / edge, r = rnd(gx, gy, seed + 1);
      if (k < 0.45) mixPx(A, o, 12, 10, 10, 0.96);                                   // the crater
      else if (k < 0.62) mixPx(A, o, 104, 80, 54, r < 0.2 ? 0.5 : 0.88);            // a rim of thrown-up earth
      else if (k < 1) mixPx(A, o, 24, 20, 18, (0.9 - 0.75 * (k - 0.62) / 0.38) * (0.8 + 0.2 * r));   // soot
      else if (k < 1.6 && r < 0.06) mixPx(A, o, 96, 74, 50, 0.85);                   // flung clods
      if (k > 0.5 && k < 1 && rnd(gx, gy, seed + 2) < 0.05) mixPx(A, o, 110, 104, 96, 0.6);   // pale ash
    } else if (d.type === 'hole') {
      if (q < 1) mixPx(A, o, 22, 18, 16, 0.85);
    }
  }
}
// a body lying where it fell: its sprite, baked flat onto the ground with a pool of blood
function paintCorpse(d, A, G, ox, oy, stride, rx, ry, x0, y0, x1, y1, cx, cy) {
  const set = d.big ? CORPSE_BIG : CORPSE, rows = set[d.frame % set.length], h = rows.length, w = rows[0].length;
  const left = Math.round(cx) - (w >> 1), top = Math.round(cy) - h + 2;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    const idx = (oy + gy - ry) * stride + ox + gx - rx;
    if (!G[idx]) continue;
    const o = idx * 4, dx = gx + 0.5 - cx, dy = (gy + 0.5 - cy - 1) * 2.2, q = Math.hypot(dx, dy) / 8;
    if (q < (d.big ? 1.15 : 0.75) + 0.3 * noise2(gx * 0.5, gy * 0.5, d.seed | 0)) mixPx(A, o, 58, 10, 10, 0.75);
    const r = gy - top, k = d.flip ? w - 1 - (gx - left) : gx - left;
    if (r < 0 || r >= h || k < 0 || k >= w) continue;
    const ch = rows[r][k];
    if (ch === '.') continue;
    const e = ZPART[ch];
    if (!e) continue;
    const mat = e[0] === 'skin' ? d.skin : e[0] === 'shirt' ? d.shirt : e[0] === 'pants' ? d.pants : M[e[0]];
    const s = MATSRGB[mat], f = 0.55 + 0.15 * e[1];
    A[o] = s[0] * f; A[o + 1] = s[1] * f; A[o + 2] = s[2] * f;
  }
}

/* ------------------------------------------------------------------ lights
 * The lamps, lit windows and burning wrecks around the view, gathered when the view moves. */
const NEAR = { key: '', lights: [], fires: [] };
function gatherNear() {
  const key = (VIEW.x >> 4) + ',' + (VIEW.y >> 4);
  if (key === NEAR.key) return NEAR;
  NEAR.key = key; NEAR.lights = []; NEAR.fires = [];
  const pad = 60, b = groundBox(VIEW.x - pad, VIEW.y - pad, VIEW.x + W + pad, VIEW.y + H + pad + 40);
  const cxs = W / 2, cys = H / 2;
  forCells(b[0], b[1], b[2], b[3], (c) => {
    for (const ob of c.list) {
      const ls = ob.lights || (ob.light ? [ob.light] : null);
      if (ls) for (const L of ls) {
        const sx = scrX(L.x, L.y), sy = scrY(L.x, L.y, L.z), m = L.r * SC;
        if (sx < -m || sy < -m || sx > W + m || sy > H + m) continue;
        NEAR.lights.push(Object.assign({ dist: Math.hypot(sx - cxs, sy - cys), seed: (ob.seed | 0) + NEAR.lights.length }, L));
      }
      if (ob.kind === 'car' && ob.burning) {
        const sx = scrX(ob.x, ob.y), sy = scrY(ob.x, ob.y, 0);
        if (sx > -40 && sx < W + 40 && sy > -40 && sy < H + 80) NEAR.fires.push(ob);
      }
    }
  });
  NEAR.lights.sort((a, b2) => a.dist - b2.dist);
  if (NEAR.lights.length > 40) NEAR.lights.length = 40;
  return NEAR;
}
// solid scenery to keep the dead from walking through: houses, cars, trunks, rocks
function blockersNear(x, y, out) {
  out.length = 0;
  const i0 = Math.floor((x - 20) / CELL), i1 = Math.floor((x + 20) / CELL), j0 = Math.floor((y - 20) / CELL), j1 = Math.floor((y + 20) / CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const ob of cellObjects(i, j).list) {
    if (ob.kind === 'house') out.push(ob.x, ob.y, 18);
    else if (ob.kind === 'car') out.push(ob.x, ob.y, 9);
    else if (ob.kind === 'pine' || ob.kind === 'tree') out.push(ob.x, ob.y, 2);
    else if (ob.kind === 'rock') out.push(ob.x, ob.y, ob.r + 1);
  }
  return out;
}
