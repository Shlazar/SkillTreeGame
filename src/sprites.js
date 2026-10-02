/* The dead: hand-drawn pixel sprites shaded with the same colour ramps as the world. A zombie is
 * 13x17, facing right, feet at the bottom centre. Falls, tumbles and bodies are made from the
 * standing frame by pixel rotation, so every pose keeps the same colours. */

const ZTOP = [
  '.....hHh.....',
  '....hSSSs....',
  '....SSSeS....',
  '....kSSSs....',
  '.....bWs.....',
  '.....ks......',
  '...qcCCCSSSs.',
  '..qcCsBCCssSS',
  '..qcCCCBCc...',
  '..qcBCsCCc...',
  '...qcCCCc....',
];
const ZLEGS = {
  stand: ['...pPPPPp....', '...pPp.PP....', '...pP..pP....', '...pP..pP....', '...pP..pP....', '...FF..FF....'],
  a: ['...pPPPPp....', '..pPp..PP....', '..pP....PP...', '.pP.....pP...', '.pP......pP..', '.FF......FF..'],
  b: ['...pPPPPp....', '....pPPp.....', '....pPP......', '....pPp......', '....pPp......', '....FFF......'],
  c: ['...pPPPPp....', '..PPp..pP....', '..PP....pP...', '.PP.....pP...', '.Pp......pP..', '.FF......FF..'],
};
// char -> [part, shade]; parts other than skin/shirt/pants name a material
const ZPART = {
  H: ['hair', 2], h: ['hair', 1], S: ['skin', 4], s: ['skin', 3], k: ['skin', 1], W: ['bone', 4],
  C: ['shirt', 3], c: ['shirt', 2], q: ['shirt', 1], P: ['pants', 3], p: ['pants', 1],
  B: ['blood', 3], b: ['gore', 2], F: ['boot', 1], e: ['gore', 0],
};
const EMPTY13 = '.............';
function zFrame(legs, bob) {
  const top = bob ? [EMPTY13].concat(ZTOP.slice(0, ZTOP.length - 1)) : ZTOP;
  return top.concat(legs);
}
// rotate a frame about its feet (nearest pixel) into a 23x23 frame whose feet sit at (11, 21)
function rotFrame(rows, ang) {
  const w = rows[0].length, h = rows.length, px = (w - 1) / 2, py = h - 1, S = 23, out = [];
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let y = 0; y < S; y++) {
    let row = '';
    for (let x = 0; x < S; x++) {
      const dx = x - 11, dy = y - 21;
      const ix = Math.round(c * dx + s * dy + px), iy = Math.round(-s * dx + c * dy + py);
      row += ix >= 0 && iy >= 0 && ix < w && iy < h ? rows[iy][ix] : '.';
    }
    out.push(row);
  }
  return out;
}
// crop away empty rows and columns
function trim(rows) {
  let t = 0, b = rows.length - 1, l = rows[0].length, r = -1;
  while (t < b && !/[^.]/.test(rows[t])) t++;
  while (b > t && !/[^.]/.test(rows[b])) b--;
  for (let y = t; y <= b; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] !== '.') { l = Math.min(l, x); r = Math.max(r, x); }
  return rows.slice(t, b + 1).map((row) => row.slice(l, r + 1));
}
// a body lying flat on the ground: on its back, then foreshortened to the 2:1 ground
function lying(rows) {
  const flat = trim(rotFrame(rows, -Math.PI / 2)), out = [];
  for (let y = flat.length - 1; y >= 0; y -= 2) out.unshift(flat[y]);
  return out;
}
// Scale3x (AdvMAME3x), then the centre pixel of every 2x2 block: a sprite 1.5x bigger without
// blurring or doubling pixels unevenly (from Isle Express)
function scale3xGrid(rows) {
  const w = rows[0].length, h = rows.length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  const big = [];
  for (let y = 0; y < h * 3; y++) big.push(new Array(w * 3).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), Ee = at(x, y), F = at(x + 1, y);
    const G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1), e = [Ee, Ee, Ee, Ee, Ee, Ee, Ee, Ee, Ee];
    if (B !== Hh && D !== F) {
      e[0] = D === B ? D : Ee;
      e[1] = (D === B && Ee !== C) || (B === F && Ee !== A) ? B : Ee;
      e[2] = B === F ? F : Ee;
      e[3] = (D === B && Ee !== G) || (D === Hh && Ee !== A) ? D : Ee;
      e[5] = (B === F && Ee !== I) || (Hh === F && Ee !== C) ? F : Ee;
      e[6] = D === Hh ? D : Ee;
      e[7] = (D === Hh && Ee !== I) || (Hh === F && Ee !== G) ? Hh : Ee;
      e[8] = Hh === F ? F : Ee;
    }
    for (let k = 0; k < 9; k++) big[y * 3 + ((k / 3) | 0)][x * 3 + (k % 3)] = e[k];
  }
  return big;
}
function scale15(rows) {
  const w = rows[0].length, h = rows.length, big = scale3xGrid(rows), out = [];
  for (let y = 0; y < Math.ceil(h * 1.5); y++) {
    let row = '';
    for (let x = 0; x < Math.ceil(w * 1.5); x++) {
      const p = (i, j) => (big[y * 2 + j] || [])[x * 2 + i] || '.';
      let c = p(1, 1);
      if (c !== 'e') for (const [i, j] of [[0, 0], [1, 0], [0, 1]]) if (p(i, j) === 'e') { c = 'e'; break; }
      row += c;
    }
    out.push(row);
  }
  return out;
}
function makeSet(big) {
  const f = big ? scale15 : (r) => r;
  const set = {
    walk: [zFrame(ZLEGS.a, true), zFrame(ZLEGS.b, false), zFrame(ZLEGS.c, true), zFrame(ZLEGS.b, false)].map(f),
    stand: f(zFrame(ZLEGS.stand, false)),
  };
  const base = zFrame(ZLEGS.stand, false);
  set.die = [-0.5, -1.0, -1.38].map((a) => f(rotFrame(base, a)));
  set.tumble = [];
  for (let k = 0; k < 8; k++) set.tumble.push(f(trim(rotFrame(base, k * TAU / 8))));
  set.corpse = [lying(base), lying(zFrame(ZLEGS.a, false))].map((r) => (big ? scale15(r) : r));
  return set;
}
const ZS = makeSet(false), ZB = makeSet(true);
const CORPSE = ZS.corpse, CORPSE_BIG = ZB.corpse;

const EYE = packHex('#ff7a4a'), EYE_DIM = packHex('#5a1a14'), FLASH_WHITE = packHex('#f6f2ff');
const OUTLINE_C = packHex('#0a0c16');
const WQ = 6.0;

/* ------------------------------------------------------------- the overlay
 * Everything that moves is drawn into an RGBA overlay at art resolution; the GPU blends it over
 * the lit world. GLOW per pixel: 0 plain, 1-254 how strongly it glows (bloom), 255 interface
 * (skips the lens). */
const ovBuf = new ArrayBuffer(N * 4);
const out = new Uint32Array(ovBuf), outC = new Uint8ClampedArray(ovBuf);
const GLOW = new Uint8Array(N);
// the static world's depth under screen pixel i
const staticDepth = (x, y) => mDep[rowB[y] + colB[x]];
function spritePx(i, c, dep, glow) {
  const x = i % W, y = (i / W) | 0;
  if (staticDepth(x, y) > dep + 0.6) return false;
  out[i] = c;
  GLOW[i] = glow || 0;
  return true;
}
const uiPx = (i, c) => { out[i] = c; GLOW[i] = 255; };
// warm light reaching a point in the air (for sprites)
function warmAt(x, y, z, lights) {
  let w = 0;
  for (const L of lights) {
    const dx = L.x - x, dy = L.y - y, dz = L.z - z, d = Math.hypot(dx, dy, dz);
    if (d >= L.r) continue;
    let a = 1 - d / L.r;
    a *= a;
    w += a * 0.7 * (L.I !== undefined ? L.I : 1) * (L.cpuK || 1);
  }
  return w;
}
// Frames are compiled once into pixel lists (offsets from the feet, a code per pixel) with their
// one-pixel outline, for both facings, so drawing a crowd is a tight loop.
const ZCHARS = 'HhSskWCcqPpBbFe';
const CODE = {};
for (let k = 0; k < ZCHARS.length; k++) CODE[ZCHARS[k]] = k;
const EYE_CODE = CODE.e;
function compileRows(rows) {
  const w = rows[0].length, h = rows.length, ax = Math.floor(w / 2), make = (flip) => {
    const on = (r, k) => r >= 0 && r < h && k >= 0 && k < w && rows[r][flip ? w - 1 - k : k] !== '.';
    const body = [], ol = [];
    for (let r = -1; r <= h; r++) for (let k = -1; k <= w; k++) {
      if (on(r, k)) body.push(k - ax, r - (h - 1), CODE[rows[r][flip ? w - 1 - k : k]] ?? 0);
      else if (on(r - 1, k) || on(r + 1, k) || on(r, k - 1) || on(r, k + 1)) ol.push(k - ax, r - (h - 1));
    }
    return { body: Int16Array.from(body), ol: Int16Array.from(ol) };
  };
  return { w, h, n: make(false), f: make(true) };
}
function compileSet(set) {
  const c = {};
  for (const k in set) c[k] = Array.isArray(set[k][0]) ? set[k].map(compileRows) : compileRows(set[k]);
  return c;
}
const ZSC = compileSet({ walk: ZS.walk, die: ZS.die, tumble: ZS.tumble }), ZBC = compileSet({ walk: ZB.walk, die: ZB.die, tumble: ZB.tumble });
const PAL = new Uint32Array(16), PGLOW = new Uint8Array(16);
// draw a compiled frame standing at world (x, y, z); PAL / PGLOW give each code's colour and glow
function drawFigure(F, x, y, z, flip, alpha) {
  const fx = Math.round(scrX(x, y)), fy = Math.round(scrY(x, y, z)), d0 = depth(x, y, z), spr = flip ? F.f : F.n;
  if (fx < -F.w || fx > W + F.w || fy < -2 || fy > H + F.h) return;
  const ol = spr.ol, body = spr.body;
  for (let k = 0; k < ol.length; k += 2) {
    const sx = fx + ol[k], sy = fy + ol[k + 1];
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const i = sy * W + sx;
    if (alpha < 1 && bay[i] > alpha) continue;
    if (mDep[rowB[sy] + colB[sx]] > d0 + Math.max(0, -ol[k + 1]) * 0.41 + 0.6) continue;
    out[i] = OUTLINE_C; GLOW[i] = 0;
  }
  for (let k = 0; k < body.length; k += 3) {
    const sx = fx + body[k], sy = fy + body[k + 1];
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const i = sy * W + sx;
    if (alpha < 1 && bay[i] > alpha) continue;
    if (mDep[rowB[sy] + colB[sx]] > d0 + Math.max(0, -body[k + 1]) * 0.41 + 0.6) continue;
    const c = body[k + 2];
    out[i] = PAL[c]; GLOW[i] = PGLOW[c];
  }
}
// the dark patch under a figure's feet: a translucent overlay the GPU blends
function groundShadow(x, y, rw, k) {
  const fx = Math.round(scrX(x, y)), fy = Math.round(scrY(x, y, 0)), a = (Math.round((k || 0.43) * 255) << 24) >>> 0;
  for (let dy = -1; dy <= 0; dy++) for (let dx = -rw; dx <= rw; dx++) {
    if (dy === -1 && Math.abs(dx) === rw) continue;
    const sx = fx + dx, sy = fy + dy;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const i = sy * W + sx;
    if ((out[i] >>> 24) === 0) out[i] = a;
  }
}
// one zombie (live, falling or thrown): z.pose 'walk' | 'die' | 'tumble'
function drawZombie(z, t, lights) {
  const sx0 = scrX(z.x, z.y), sy0 = scrY(z.x, z.y, 0);
  if (sx0 < -30 || sx0 > W + 30 || sy0 < -10 || sy0 > H + 60) return;
  const set = z.big ? ZBC : ZSC;
  let F, lift = 0;
  if (z.pose === 'walk') F = set.walk[Math.floor(z.phase) & 3];
  else if (z.pose === 'die') F = set.die[Math.min(2, Math.floor(z.st / 0.12))];
  else { F = set.tumble[Math.floor(z.st * 14 + z.seed * 8) & 7]; lift = z.h || 0; }
  const fx = clamp(Math.round(sx0), 0, W - 1), fy = clamp(Math.round(sy0), 0, H - 1);
  const shade = mLit[rowB[fy] + colB[fx]] ? 0 : 1;
  const w = band(warmAt(z.x, z.y, 6, lights) * WQ, bay[fy * W + fx], 0.45);
  if (z.pose !== 'tumble' || lift < 30) groundShadow(z.x, z.y, z.big ? 6 : 4, lift > 0 ? 0.43 * Math.max(0.2, 1 - lift / 40) : 0.43);
  const dead = z.pose !== 'walk', flash = z.flash > 0;
  for (let c = 0; c < ZCHARS.length; c++) {
    const ch = ZCHARS[c];
    PGLOW[c] = flash ? 90 : 0;
    if (flash) { PAL[c] = FLASH_WHITE; continue; }
    if (c === EYE_CODE) { PAL[c] = dead ? EYE_DIM : EYE; PGLOW[c] = dead ? 0 : 150; continue; }
    const e = ZPART[ch], mat = e[0] === 'skin' ? z.skin : e[0] === 'shirt' ? z.shirt : e[0] === 'pants' ? z.pants : M[e[0]];
    PAL[c] = lit(mat, e[1] - shade, w);
  }
  drawFigure(F, z.x, z.y, lift, z.flip, z.fade !== undefined ? z.fade : 1);
}
