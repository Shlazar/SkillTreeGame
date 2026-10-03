// land.js - the look of the countryside: a calm, clean stage so the dead and their blood stand out.
// The ground is a few flat colours in big areas: fresh grass, warm tan dirt (ploughed fields and
// farm tracks) with a soft lip where the two meet, darker woods far off to both sides, corn round
// the stations, packed earth round the station houses, and the railway (a pale gravel bed, dark
// sleepers, two bright steel rails). Each 128 px chunk is painted once (paintLand), from fields
// worked out on a coarse 4 px grid and blended between its points, so a chunk costs about 1 ms.
// The props are few and big (landPlan): clumps of round trees with a lit top and a shadow, dense
// woods at the far sides, hay bales on the fields, a fence or a wreck now and then, the poles.
// Hooks: initLand (initSprites), landPlan (plan), paintLand (bakeChunk), cornAt (station.js).

// ---------- palette (also for the other parts: the dead should be pale with dark outlines)
const LAND = {
  grass: ['#5e8f38', '#689b3e', '#73a645'],     // in shade, base, sun patch
  blade: '#4f7f30', bladeHi: '#8cbd55', lip: '#84b84e',
  wood: ['#3c6a2c', '#447433'],                  // the woods' floor
  dirt: ['#af824f', '#b88b56', '#c29762'],       // furrow, base, sun patch
  rim: '#8d633a', rim2: '#9e7144',               // dirt in the shade of the grass edge
  path: ['#ad8150', '#bd915c'],                  // the farm tracks (a little paler)
  corn: ['#4f6e28', '#6f9434', '#8db244', '#d2c873'], // row gap, stalks, lit tops, tassels
  yard: ['#a58257', '#b39066', '#bf9c72'],       // packed earth round a house
  plat: ['#9c968a', '#b0aa9c'],                  // the gravel by a platform
  gravel: ['#857e72', '#9b9588', '#aea798'], gEdge: '#6f685d',
  sleeper: ['#4a3423', '#6b4b33', '#835d40'],
  rail: ['#2c2e33', '#5f646c', '#e6e9ee']
};
const LRGB = {};
for (const k in LAND) LRGB[k] = Array.isArray(LAND[k]) ? LAND[k].map(hexRgb) : hexRgb(LAND[k]);

// JIT: a small tile of fixed jitter (-0.9..0.9 per 2x2 block): it roughens the edges a little
const JIT = new Float32Array(64 * 64);
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) JIT[y * 64 + x] = (hrnd(x >> 1, y >> 1, 515) - 0.5) * 1.8;

// ---------- the fields (in world px)
// Dirt fields: big patches where a warped, slow noise is high (0..1, the edge at FIELD_T).
const FIELD_T = 0.62;
function fieldVal(X, Y) {
  const wx = X + (vnoise(X / 140, Y / 140, 31) - 0.5) * 110, wy = Y + (vnoise(X / 140 + 7, Y / 140 - 3, 32) - 0.5) * 90;
  return vnoise(wx / 300, wy / 300, 35) * 0.8 + vnoise(wx / 95, wy / 95, 36) * 0.2;
}
// > 0 inside the woods at the far sides (about px past their edge), < 0 out in the open
function woodsVal(X, Y) {
  return Math.abs(X - trackX(Y)) - (236 + vnoise(X / 90, Y / 90, 42) * 70);
}
// the big soft patches of sun and shade on the grass and the dirt (0..1)
const shadeVal = (X, Y) => vnoise(X / 70, Y / 70, 33) * 0.75 + vnoise(X / 24, Y / 24, 34) * 0.25;
// true when there are woods at (x, y) at least m px in
const inWoods = (x, y, m) => woodsVal(x, y) > (m || 0);
// the dirt field's direction of furrows at (x, y): 0..3 eighths of a turn
const furrowDir = (x, y) => Math.floor(vnoise(x / 520 + 9, y / 520 - 4, 36) * 4) * Math.PI / 4;

// The corn round each station (station.js), as [s along the rails, from, to] across: true at (x, y)
// when it is in one. The dead come out of it, so it is painted flat (they stay in plain view).
const CORN_A0 = -86, CORN_A1 = 104, CORN_U0 = 120, CORN_U1 = 200;
function cornAt(T) {
  for (const d of STATIONS) {
    const s = sAtKm(d.km), a = T.a - s, u = Math.abs(T.u);
    if (a > CORN_A0 - 4 && a < CORN_A1 + 4 && u > CORN_U0 && u < CORN_U1) return a - CORN_A0;
  }
  return -1;
}

// ---------- painting a chunk
// NODES on a 4 px grid (33 x 33 for a chunk): the dirt field, the farm tracks, the woods, the shade.
const LS = 4, LN = CH / LS + 1;
const NF = new Float32Array(LN * LN), NR = new Float32Array(LN * LN), NW = new Float32Array(LN * LN), NS = new Float32Array(LN * LN);
// KIND[i] per pixel of the chunk last painted: 0 grass, 1 dirt, 2 track, 3 woods, 4 railway, 5 yard, 6 corn
const KIND = new Uint8Array(CH * CH);
const LT = { u: 0, a: 0, c: 1 };
function paintLand(g, ci, cj) {
  const X0 = ci * CH, Y0 = cj * CH;
  for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) {
    const X = X0 + i * LS, Y = Y0 + j * LS, k = j * LN + i;
    NF[k] = fieldVal(X, Y);
    NR[k] = roadDist(X, Y);
    NW[k] = woodsVal(X, Y);
    NS[k] = shadeVal(X, Y);
  }
  const yardsNear = landYards(X0, Y0), stNear = STATIONS.some((d) => Math.abs(yOfS(sAtKm(d.km)) - (Y0 + 64)) < 300);
  const im = g.createImageData(CH, CH), D = im.data, L = LRGB;
  const fa = furrowDir(X0 + 64, Y0 + 64), fc = Math.cos(fa), fs = Math.sin(fa);
  let col;
  for (let y = 0; y < CH; y++) {
    const Y = Y0 + y, j = (y / LS) | 0, ty = (y - j * LS) / LS;
    // the railway on this row: its middle, slope and the distance along it
    const tx = trackX(Y), tp = trackSlope(Y), tc = 1 / Math.sqrt(1 + tp * tp), ts = trackS(Y);
    for (let x = 0; x < CH; x++) {
      const X = X0 + x, i = (x / LS) | 0, tx4 = (x - i * LS) / LS, k = j * LN + i;
      const w00 = (1 - tx4) * (1 - ty), w10 = tx4 * (1 - ty), w01 = (1 - tx4) * ty, w11 = tx4 * ty;
      const f = NF[k] * w00 + NF[k + 1] * w10 + NF[k + LN] * w01 + NF[k + LN + 1] * w11;
      const rd = NR[k] * w00 + NR[k + 1] * w10 + NR[k + LN] * w01 + NR[k + LN + 1] * w11;
      const wd = NW[k] * w00 + NW[k + 1] * w10 + NW[k + LN] * w01 + NW[k + LN + 1] * w11;
      const sh = NS[k] * w00 + NS[k + 1] * w10 + NS[k + LN] * w01 + NS[k + LN + 1] * w11;
      // the field's edge in px: its value over how fast it changes across this cell
      const gx = (NF[k + 1] - NF[k] + NF[k + LN + 1] - NF[k + LN]) / (2 * LS), gy = (NF[k + LN] - NF[k] + NF[k + LN + 1] - NF[k + 1]) / (2 * LS);
      const fd = (f - FIELD_T) / Math.max(0.0015, Math.sqrt(gx * gx + gy * gy));
      const jt = JIT[((Y & 63) << 6) | (X & 63)];
      const road = 6.5 - rd, e = Math.max(fd, road) + jt * 0.7;
      let kind;
      if (e >= 0) {
        // dirt: a darker band just inside the grass (its shade), furrows across a field
        kind = road > fd ? 2 : 1;
        if (e < 1.3) col = L.rim;
        else if (e < 2.4) col = L.rim2;
        else if (kind === 2) col = L.path[sh > 0.6 ? 1 : 0];
        else {
          const u = X * fc + Y * fs;
          col = (Math.floor(u) % 7 + 7) % 7 === 0 ? L.dirt[0] : L.dirt[sh > 0.62 ? 2 : 1];
        }
      } else if (wd > jt * 3) {
        kind = 3;
        col = L.wood[sh > 0.55 ? 1 : 0];
      } else {
        kind = 0;
        col = e > -1.3 ? L.lip : L.grass[sh > 0.63 + jt * 0.02 ? 2 : sh < 0.36 + jt * 0.02 ? 0 : 1];
      }
      // corn and yards near the stations (in the railway's own terms)
      if (stNear || yardsNear) {
        trackLocal(X, Y, LT);
        if (stNear) {
          const ca = cornAt(LT);
          if (ca >= 0) {
            kind = 6;
            const r5 = (Math.floor(Math.abs(LT.u)) % 5), edge = Math.min(ca, CORN_A1 - CORN_A0 - ca, Math.abs(LT.u) - CORN_U0, CORN_U1 - Math.abs(LT.u));
            col = r5 === 0 ? L.corn[0] : r5 === 1 ? L.corn[2] : L.corn[1];
            if (edge < 2 + jt) col = L.corn[0];
            else if (r5 === 1 && hrnd(X, Y, 61) < 0.12) col = L.corn[3];
          }
        }
        if (yardsNear) {
          const yc = yardCol(LT, yardsNear, jt);
          if (yc) { col = yc; kind = 5; }
        }
      }
      // the railway: the gravel bed with a ragged edge, a sleeper every 7 px, two rails
      const off = X - tx, ru = Math.floor(off * tc);
      if (ru >= -14 && ru <= 13) {
        const edge = ru < 0 ? -ru - 12 : ru - 11;
        if (edge <= jt) {
          kind = 4;
          const hv = hrnd(X, Y, 91);
          col = edge > -1 + jt * 0.5 ? L.gEdge : hv < 0.16 ? L.gravel[0] : hv > 0.88 ? L.gravel[2] : L.gravel[1];
          if (ru >= -9 && ru <= 8) {
            const sy = (Math.floor(ts + off * tp * tc) % 7 + 7) % 7;
            if (sy === 0) col = L.sleeper[2];
            else if (sy === 1) col = L.sleeper[1];
            else if (sy === 2) col = L.sleeper[0];
          }
          if (ru === -5 || ru === 4) col = L.rail[2];
          else if (ru === -4 || ru === 5) col = L.rail[1];
          else if (ru === -3 || ru === 6) col = L.rail[0];
        }
      }
      const p = (y * CH + x) * 4;
      D[p] = col[0]; D[p + 1] = col[1]; D[p + 2] = col[2]; D[p + 3] = 255;
      KIND[y * CH + x] = kind;
    }
  }
  g.putImageData(im, 0, 0);
  dressGround(g, ci, cj);
}
// The yards in reach of the chunk at (X0, Y0): [s of the house, side] for the Depot and every
// station, or null.
function landYards(X0, Y0) {
  let near = null;
  for (const [s, side] of yards()) {
    const y = yOfS(s);
    if (Math.abs(y - (Y0 + CH / 2)) < 200 && Math.abs(trackX(y) - (X0 + CH / 2)) < 260) (near = near || []).push([s, side]);
  }
  return near;
}
// The colour of a yard at railway point T (or null): pale gravel along the platform, packed earth
// round the house with a worn path to its door, a soft edge into the grass.
function yardCol(T, near, jt) {
  for (const [s, side] of near) {
    const u = T.u * side, a = T.a - s - 9;
    if (u < 13 || u > 122 || Math.abs(a) > 74) continue;
    const edge = Math.max(u - 104, Math.abs(a) - 58);
    if (edge > 14 + jt * 2) continue;
    if (u < 34 && Math.abs(a) < 62) return LRGB.plat[edge > 9 ? 0 : 1];
    if (edge > 11 + jt) return LRGB.rim2;
    const path = Math.abs(a + 9) < 6 && u < 96;
    return LRGB.yard[path ? 2 : (jt > 0.6 ? 0 : 1)];
  }
  return null;
}
// A few marks on the painted chunk: little V's of grass, wild flowers, pebbles on the dirt. Only
// where the ground is of the right kind (KIND), and never on the railway.
function dressGround(g, ci, cj) {
  const rng = mulberry(hash32(Math.imul(ci, 2654435761) ^ Math.imul(cj, 40503) ^ 0x1a2d));
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const kindAt = (x, y) => (x < 0 || y < 0 || x >= CH || y >= CH ? 255 : KIND[y * CH + x]);
  for (let n = 0; n < 26; n++) {
    const x = 1 + ((rng() * (CH - 2)) | 0), y = 1 + ((rng() * (CH - 2)) | 0), kd = kindAt(x, y);
    if (kd !== 0 && kd !== 3) continue;
    r(x - 1, y - 1, 1, 1, LAND.blade); r(x, y, 1, 1, LAND.blade); r(x + 1, y - 1, 1, 1, LAND.blade);
    if (rng() < 0.5) r(x - 1, y - 2, 1, 1, LAND.bladeHi);
  }
  for (let n = 0; n < 2; n++) {
    if (rng() < 0.45) continue;
    const x = 4 + ((rng() * (CH - 8)) | 0), y = 4 + ((rng() * (CH - 8)) | 0);
    if (kindAt(x, y) !== 0) continue;
    const c = ['#f4efdc', '#f2d250', '#e98aa0'][(rng() * 3) | 0];
    for (let f = 0; f < 4 + rng() * 4; f++) {
      const fx = x + Math.round((rng() - 0.5) * 8), fy = y + Math.round((rng() - 0.5) * 5);
      if (kindAt(fx, fy) !== 0) continue;
      r(fx, fy + 1, 1, 1, LAND.blade);
      r(fx, fy, 1, 1, c);
    }
  }
  for (let n = 0; n < 14; n++) {
    const x = (rng() * (CH - 1)) | 0, y = (rng() * (CH - 1)) | 0, kd = kindAt(x, y);
    if (kd !== 1 && kd !== 2 && kd !== 5) continue;
    r(x, y, 1, 1, LAND.dirt[2]);
    r(x, y + 1, 1, 1, LAND.rim);
  }
}

// ---------- sprites
// One round crown of radius R at (cx, cy): a dark rim, then lit from the top left (a bright cap, a
// highlight) and in shade at the lower right. The rim is a little lumpy. pal = [rim, shade, base,
// lit, highlight].
function crown(r, cx, cy, R, pal, ph) {
  for (let y = -R - 2; y <= R + 2; y++) for (let x = -R - 2; x <= R + 2; x++) {
    const a = Math.atan2(y, x), rr = R * (1 + 0.07 * Math.sin(a * 5 + ph) + 0.04 * Math.sin(a * 9 + ph * 2)) + 0.5;
    const d = Math.hypot(x, y / 0.9);
    if (d > rr) continue;
    let c;
    if (d > rr - 1.1) c = pal[0];
    else {
      const l = (-x * 0.6 - y * 0.8) / R + (1 - d / rr) * 0.25;
      c = l > 0.72 ? pal[4] : l > 0.28 ? pal[3] : l > -0.38 ? pal[2] : pal[1];
    }
    r(cx + x, cy + y, 1, 1, c);
  }
}
// A clump of n round trees (or one, with its trunk showing): crowns drawn back to front, so each
// one sits in front of the one behind it. size = the biggest crown's radius.
function groveSpr(n, size, rng, pal) {
  const C = [];
  const rx = n === 1 ? 0 : 6 + n * 3.2, ry = n === 1 ? 0 : 3 + n * 1.6;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng());
    C.push({ x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d, R: Math.round(size * (0.7 + rng() * 0.3)), ph: rng() * TAU });
  }
  C.sort((p, q) => p.y - q.y);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const c of C) { x0 = Math.min(x0, c.x - c.R - 2); x1 = Math.max(x1, c.x + c.R + 2); y0 = Math.min(y0, c.y - c.R - 2); y1 = Math.max(y1, c.y + c.R + 5); }
  const w = Math.ceil(x1 - x0) + 1, h = Math.ceil(y1 - y0) + 1;
  return pix(w, h, (r) => {
    for (const c of C) {
      const cx = Math.round(c.x - x0), cy = Math.round(c.y - y0);
      // the trunk under the crown (only the front ones show it)
      r(cx - 1, cy + c.R - 2, 2, 5, '#4a3322'); r(cx - 1, cy + c.R - 2, 1, 5, '#6a4a30');
      crown(r, cx, cy, c.R, pal, c.ph);
    }
  });
}
// A round hay bale, lit on its top left, with a dark outline.
function hayBaleSpr() {
  return pix(11, 9, (r) => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) {
      const dx = (x - 5) / 5.4, dy = (y - 4.2) / 4.4, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const l = -dx * 0.6 - dy * 0.8;
      r(x, y, 1, 1, d > 0.72 ? '#6a4c1e' : l > 0.45 ? '#f0d488' : l > -0.1 ? '#d8b562' : '#b08a3e');
    }
    r(3, 1, 1, 7, '#a07c34'); r(7, 1, 1, 7, '#a07c34');
  });
}
const TREE_PAL = {
  green: ['#21401f', '#2f5c2a', '#3d7633', '#559340', '#79b453'],
  deep: ['#183218', '#24481f', '#2f5d29', '#3f7633', '#5a9442'],
  olive: ['#2b3e19', '#3f5a24', '#56752e', '#6f923a', '#93b452'],
  autumn: ['#4a2b12', '#8a4a1e', '#b0652a', '#cf8a3a', '#ecb85e']
};
function initLand() {
  const rng = mulberry(4417);
  // lone trees, groves of 3 to 6, and the big clumps of the woods
  PROPS.tree1 = [];
  PROPS.grove = [];
  PROPS.wood = [];
  for (let k = 0; k < 6; k++) PROPS.tree1.push(prop(groveSpr(1, 7 + ((rng() * 3) | 0), rng, k === 5 ? TREE_PAL.autumn : k & 1 ? TREE_PAL.olive : TREE_PAL.green), 3, { tree: true }));
  for (let k = 0; k < 8; k++) PROPS.grove.push(prop(groveSpr(3 + ((rng() * 4) | 0), 8 + ((rng() * 3) | 0), rng, k === 7 ? TREE_PAL.autumn : k % 3 === 1 ? TREE_PAL.olive : TREE_PAL.green), 6, { tree: true }));
  for (let k = 0; k < 6; k++) PROPS.wood.push(prop(groveSpr(5 + ((rng() * 4) | 0), 9 + ((rng() * 3) | 0), rng, k === 5 ? TREE_PAL.olive : TREE_PAL.deep), 8, { tree: true }));
  PROPS.hay = [prop(hayBaleSpr(), 4)];
  // the lone trees and groves into the atlas now (drawn often)
  for (const p of [...PROPS.tree1, ...PROPS.grove, ...PROPS.wood]) atl(p.spr);
}

// ---------- what stands in each chunk (called by plan; put / take / rng are plan's own)
// The woods at the far sides (clumps on a loose grid), a grove or a lone tree out in the grass now
// and then (kept away from the rails), hay bales on the dirt fields, a wreck on a farm track, a
// broken fence by a track, crossing signs where a track crosses the line, and the poles.
function landPlan(pl, ci, cj, rng, put, take) {
  const X0 = ci * CH, Y0 = cj * CH;
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    const x = X0 + gx * 32 + 6 + rng() * 20 + (gy & 1) * 10, y = Y0 + gy * 32 + 6 + rng() * 20;
    if (!inWoods(x, y, 14) || roadDist(x, y) < 16) continue;
    put(take(PROPS.wood), x, y);
  }
  for (let k = 0; k < 3; k++) {
    const x = X0 + rng() * CH, y = Y0 + rng() * CH, r = rng();
    if (inWoods(x, y, -24) || nearRail(x, y, 70) || roadDist(x, y) < 18 || fieldVal(x, y) > FIELD_T - 0.04) continue;
    if (r < 0.16) put(take(PROPS.grove), x, y);
    else if (r < 0.34) put(take(PROPS.tree1), x, y);
  }
  // hay bales in a row on a field
  if (rng() < 0.3) {
    const x = X0 + 20 + rng() * 88, y = Y0 + 20 + rng() * 88;
    if (fieldVal(x, y) > FIELD_T + 0.05 && !nearRail(x, y, 50) && roadDist(x, y) > 14) {
      for (let k = 0; k < 2 + ((rng() * 3) | 0); k++) put(PROPS.hay[0], x + k * 14 + rng() * 4, y + rng() * 5);
    }
  }
  // a wreck on a farm track (a third of them burning), a broken fence beside one
  if (rng() < 0.18) {
    for (let k = 0; k < 10; k++) {
      const x = X0 + 12 + rng() * (CH - 24), y = Y0 + 8 + rng() * (CH - 16);
      if (roadDist(x, y) > 3 || nearRail(x, y, 70)) continue;
      const burning = rng() < 0.3;
      put(take(burning ? PROPS.burnt : PROPS.wreck), x, y);
      if (burning) pl.fires.push({ x: Math.round(x) + 1, y: Math.round(y) - 7, seed: (rng() * 1000) | 0, big: true });
      break;
    }
  }
  if (PROPS.fence && rng() < 0.35) {
    for (let k = 0; k < 6; k++) {
      const x = X0 + rng() * CH, y = Y0 + rng() * CH, rd = roadDist(x, y);
      if (rd < 10 || rd > 13 || nearRail(x, y, 40) || inWoods(x, y, -10)) continue;
      put(take(PROPS.fence), x, y);
      break;
    }
  }
  // crossing signs on both sides of the rails where a farm track crosses them
  if (PROPS.sign) for (let y = Y0; y < Y0 + CH; y += 4) {
    const tx = trackX(y);
    if (roadDist(tx, y) > 1.5 || roadDist(tx, y - 4) < roadDist(tx, y)) continue;
    for (const s of [-1, 1]) {
      const x = tx + s * 19;
      if (x >= X0 && x < X0 + CH) put(PROPS.sign[2], x, y + s * 10);
    }
    y += 40;
  }
  // telegraph poles beside the railway, one every 72 px (the wires hang between them)
  for (let y = Math.ceil(Y0 / 72) * 72; y < Y0 + CH; y += 72) {
    const px = trackX(y) + 27;
    if (px >= X0 && px < X0 + CH) put(PROPS.pole[0], px, y);
  }
}

// ---------- the sprite atlas, filled at start-up
// Every small sprite made at start-up goes into the atlas now, before anything is drawn from it
// (a sprite added later costs a lot the first time, see atl in core.js). Walks any arrays and
// objects of sprites: the dead, the train (also red when hit), survivors, props, the station, the
// safe zone, and the glows of the usual light colours. The thermal sprites go last.
const GLOW_COLS = ['#fff1c2', '#ffb060', '#ffd27a', '#ffd24a', '#ff8a3a', '#ffb347', '#ffe2a0', '#ffc27a', '#ff9a4a',
  '#ffffff', '#fff6e0', '#fff1d8', '#ffd36a', '#ff9a3a', '#ff7a28', '#ff6a28', '#ff4a32', '#e3b04b'];
function warmAtlas() {
  const hot = [];
  const visit = (o, d) => {
    if (!o || d > 5) return;
    if (o instanceof HTMLCanvasElement) { atl(o); return; }
    if (Array.isArray(o)) { for (const v of o) visit(v, d + 1); return; }
    if (typeof o !== 'object') return;
    for (const k in o) {
      // (thermal sprites: h, hf, deadH, spinH, and the cars' h lists)
      if (k === 'h' || k === 'hf' || k === 'deadH' || k === 'spinH') { hot.push(o[k]); continue; }
      if (k !== 'pal') visit(o[k], d + 1);
    }
  };
  for (const t of TRAIN) for (let i = 0; i < ANG_N; i++) carRed(t, i);
  visit(ZS, 0);
  visit(TRAIN, 0);
  visit(FOOT, 0);
  visit(SURV, 0);
  for (const c of GLOW_COLS) atl(glow(c));
  for (const k in PROPS) for (const p of PROPS[k]) visit([p.spr, p.sh], 0);
  for (const g of [SCN, STATION, SAFE]) for (const k in g) if (g[k]) visit(g[k].spr ? [g[k].spr, g[k].sh] : g[k], 0);
  for (const h of hot) visit(h, 0);
}
