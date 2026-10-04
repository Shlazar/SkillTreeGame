// horde.js - the dead, the Orc Problem way: many small, weak, easy-to-see zombies that come in
// streams and waves from the edges of the screen and flow round each other to the train, and die
// in a red pop that stays on the ground (a red carpet after a big fight).
// Inside: the zombie art (pale sickly bodies, a dark outline, a dark head, a red mouth), the
// per-leg base horde (HORDE) and the spawner (streams, waves, crowds on the rails), the step of
// every zombie (updateZombies, with the railway looked up from a cache of rows), the fast pixel
// layer that draws a crowd of hundreds in one go (gatherHorde, drawHorde), the kill pop, silver
// zombies (G.up.silver: they shine and pay more), explosive zombies (G.up.boom, G.up.boomR: they
// blow up when they die and trigger neighbouring explosions), the hit sparks where a
// heli round lands and the heli's muzzle flash.

// ---------- the zombie art
// A drawing takes (r, f, c): r = painter r(x, y, w, h, colour), f = walk frame 0..3, c = colours.
// 0 and 2 = a stride (the near leg ahead, then behind), 1 and 3 = the legs together, the body 1 px
// up. They face right; the outline is added after.
const ZOUT = '#0c0f09', ZRED = '#c4261c', ZWOUND = '#7e1712';
// colours: body [shade, mid, light], head [dark, mid], legs [dark, mid], wound = a red smear on it
const ZPAL = {
  walk: [
    { body: ['#7f9a6a', '#a3be89', '#c6dbab'], head: ['#1b2216', '#2f3b27'], leg: ['#283124', '#414c38'], wound: true },
    { body: ['#83907b', '#a8b59c', '#cad5bf'], head: ['#1c2019', '#30362b'], leg: ['#2a2f2a', '#434a42'], wound: false },
    { body: ['#8c9864', '#b0bc86', '#d0d9a6'], head: ['#20231a', '#363b2b'], leg: ['#2e2c22', '#4a4636'], wound: true }
  ],
  run: [
    { body: ['#97a676', '#c0cd9a', '#e0e8c2'], head: ['#1d2218', '#333a2a'], leg: ['#2b3126', '#454e3c'], wound: false },
    { body: ['#9a9f80', '#c3c7a6', '#e2e4cc'], head: ['#20211c', '#37382f'], leg: ['#2f2e29', '#4a4840'], wound: true }
  ],
  brute: [
    { body: ['#4a6240', '#68845a', '#89a674'], head: ['#121710', '#222b1c'], leg: ['#1c2318', '#2f3a28'], wound: true },
    { body: ['#55604a', '#748064', '#96a184'], head: ['#141612', '#262a20'], leg: ['#1f221c', '#33382d'], wound: true }
  ]
};
// Walker: 8 x 11, arms reaching out, a dark head.
function hWalker(r, f, c) {
  const b = f & 1 ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [b0, b1, b2] = c.body, [h0, h1] = c.head, [l0, l1] = c.leg, near = f === 2 ? l0 : l1, far = f === 2 ? l1 : l0;
  if (f & 1) {
    // legs together under the body
    r(3, 7, 1, 4, l0); r(4, 7, 1, 3, l1); r(4, 10, 2, 1, l1);
  } else {
    r(2, 8, 1, 2, far); r(1, 10, 2, 1, far);
    r(5, 8, 1, 2, near); r(5, 10, 2, 1, near);
  }
  o(2, 7, 4, 1, l1);
  // torso, lit from the left
  o(2, 3, 4, 4, b1); o(2, 3, 1, 4, b2); o(5, 3, 1, 4, b0); o(3, 3, 2, 1, b2);
  if (c.wound) o(4, 5, 1, 1, ZWOUND);
  // two thin arms straight out in front (the gap between them turns to outline)
  o(5, 3, 3, 1, b2); o(6, 5, 2, 1, b1);
  // the head: dark, a red mouth
  o(3, 0, 3, 3, h1); o(5, 0, 1, 3, h0); o(3, 0, 1, 1, b0); o(5, 2, 1, 1, ZRED);
}
// Runner: 9 x 10, bent low and forward, a long stride.
function hRunner(r, f, c) {
  const b = f & 1 ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [b0, b1, b2] = c.body, [h0, h1] = c.head, [l0, l1] = c.leg, near = f === 2 ? l0 : l1, far = f === 2 ? l1 : l0;
  if (f & 1) {
    r(3, 6, 1, 3, l0); r(2, 9, 2, 1, l0); r(4, 6, 1, 2, l1); r(5, 7, 1, 1, l1); r(5, 8, 2, 1, l1);
  } else {
    r(2, 7, 1, 1, far); r(1, 8, 1, 1, far); r(0, 9, 2, 1, far);
    r(5, 7, 1, 1, near); r(6, 8, 1, 1, near); r(6, 9, 2, 1, near);
  }
  o(2, 6, 4, 1, l1);
  o(2, 3, 4, 3, b1); o(2, 3, 1, 3, b2); o(3, 2, 3, 1, b2); o(5, 4, 1, 2, b0);
  if (c.wound) o(3, 4, 1, 1, ZWOUND);
  // claws out front, swinging with the stride
  if (f === 0) { o(6, 3, 2, 1, b2); o(8, 2, 1, 1, b2); o(6, 4, 2, 1, b0); }
  else { o(6, 3, 3, 1, b2); o(6, 5, 2, 1, b0); }
  o(5, 0, 3, 3, h1); o(7, 0, 1, 3, h0); o(5, 0, 2, 1, b0); o(7, 2, 1, 1, ZRED);
}
// Brute: 12 x 14, a big dark hulk with a small head and long heavy arms.
function hBrute(r, f, c) {
  const b = f & 1 ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [b0, b1, b2] = c.body, [h0, h1] = c.head, [l0, l1] = c.leg, near = f === 2 ? l0 : l1, far = f === 2 ? l1 : l0;
  if (f & 1) {
    r(4, 10, 2, 4, l0); r(6, 10, 2, 3, l1); r(6, 13, 3, 1, l1);
  } else {
    r(3, 10, 2, 3, far); r(2, 13, 3, 1, far);
    r(7, 10, 2, 3, near); r(7, 13, 3, 1, near);
  }
  o(3, 9, 6, 1, l1);
  // the hulk: shoulders, chest, belly
  o(2, 3, 7, 6, b1); o(3, 2, 5, 1, b1); o(2, 3, 2, 6, b2); o(4, 2, 2, 1, b2); o(7, 4, 2, 5, b0); o(4, 8, 3, 1, b0);
  if (c.wound) { o(5, 6, 2, 1, ZWOUND); o(5, 7, 1, 1, ZRED); }
  // long heavy arms, apart from the body: the far one behind, the near one hanging in front
  o(0, 4, 1, 5, b0);
  o(10, 3, 2, 6, b1); o(10, 3, 1, 6, b2); o(10, 9, 2, 1, b2);
  // the small dark head sunk between the shoulders
  o(6, 0, 3, 3, h1); o(8, 0, 1, 3, h0); o(6, 0, 2, 1, b0); o(8, 2, 1, 1, ZRED);
}
// The white hit flash of an outlined sprite: every inside pixel white, the outline stays dark.
function flashSpr(src) {
  const [c, g] = mk(src.width, src.height, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, [R, Gr, B] = hexRgb(ZOUT);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3] || (d[i] === R && d[i + 1] === Gr && d[i + 2] === B)) continue;
    d[i] = 255; d[i + 1] = 252; d[i + 2] = 240;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// A silver copy of an outlined sprite: brightness picks a shade of polished silver.
const SILVER = [[34, 40, 52], [104, 116, 136], [164, 178, 198], [214, 226, 240], [255, 255, 255]];
function silverSpr(src) {
  const [c, g] = mk(src.width, src.height, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const L = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15, col = SILVER[L < 25 ? 0 : L < 60 ? 1 : L < 110 ? 2 : L < 170 ? 3 : 4];
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
  }
  g.putImageData(im, 0, 0);
  return c;
}
// The pixels of a sprite for the fast crowd layer: {w, h, d}, d = one 32-bit colour per pixel
// (0 = see-through, 1 = the ground shadow: the ground under it is darkened). The shadow is an
// ellipse shw px wide at the feet, one row longer than the sprite.
function pixOf(src, shw) {
  const w = src.width, h = src.height + 1, s = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const d = new Uint32Array(w * h), cx = (w - 1) / 2, cy = h - 2.5, rx = shw / 2, ry = 1.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (y < src.height) {
      const j = i * 4;
      if (s[j + 3] > 128) {
        d[i] = ((255 << 24) | (s[j + 2] << 16) | (s[j + 1] << 8) | s[j]) >>> 0;
        continue;
      }
    }
    const ex = (x - cx) / rx, ey = (y - cy) / ry;
    if (ex * ex + ey * ey <= 1) d[i] = 1;
  }
  return { w, h, d };
}
// A splat of blood on the ground, r px across (bright in the middle, dark at the rim, drops round it).
function splatSpr(r, seed) {
  const rg = mulberry(seed), w = r * 2 + 7, h = Math.round(r * FORE) * 2 + 7, ry = r * FORE;
  return pix(w, h, (R) => {
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
      const d = Math.sqrt(dx * dx + dy * dy) - 0.22 * Math.sin(a * 3 + seed) - 0.12 * Math.sin(a * 5 + seed * 2);
      if (d > 1) continue;
      R(x, y, 1, 1, d < 0.35 ? '#b01c14' : d < 0.75 ? '#8e1510' : '#640f0c');
    }
    // drops thrown out round it, and a wet highlight
    for (let k = 0; k < 7; k++) {
      const a = rg() * TAU, l = 1.05 + rg() * 0.8;
      R(Math.round(cx + Math.cos(a) * r * l), Math.round(cy + Math.sin(a) * ry * l), 1, 1, rg() < 0.5 ? '#80120f' : '#5a0d0b');
    }
    R(Math.round(cx - r * 0.3), Math.round(cy - ry * 0.3), 2, 1, '#c8352a');
  });
}
// A body lying in its splat: the walk frame on its side, squashed, darkened, a splash of red on it.
function corpseOf(raw, r, seed, flip) {
  const sp = splatSpr(r, seed), lie = rot90(raw), w = lie.width, h = Math.max(3, Math.round(lie.height * 0.6));
  const [c, g] = mk(Math.max(sp.width, w + 2), sp.height + 2);
  g.drawImage(sp, (c.width - sp.width) >> 1, 1);
  const [b, bg] = mk(w, h);
  if (flip) { bg.translate(w, 0); bg.scale(-1, 1); }
  bg.drawImage(lie, 0, 0, w, h);
  bg.setTransform(1, 0, 0, 1, 0, 0);
  bg.globalCompositeOperation = 'source-atop';
  bg.fillStyle = 'rgba(64,14,10,0.62)';
  bg.fillRect(0, 0, w, h);
  bg.fillStyle = '#8c1510';
  for (let k = 0; k < 3; k++) bg.fillRect((hrnd(k, seed, 5) * w) | 0, (hrnd(k, seed, 6) * h) | 0, 2, 1);
  g.drawImage(b, (c.width - w) >> 1, ((c.height - h) >> 1) - 1);
  return c;
}
// One zombie look: the four walk frames (n normal, w white hit flash, h hot for the thermal camera,
// each also mirrored: nf, wf, hf; s / sf = a small ground shadow) and their crowd-layer pixels
// (px), the body on its side and thrown, the corpses that stay on the ground, its colours.
function makeHordeSet(w, h, draw, pal, shw, big) {
  // (the small shadow for the dead drawn one by one: as wide as the sprite, the ellipse in the middle)
  const S = { walk: [] }, sw = shadowSpr(shw), [sh, sg] = mk(w + 2, sw.height);
  sg.drawImage(sw, (w + 2 - shw) >> 1, 0);
  for (let f = 0; f < 4; f++) {
    const raw = pix(w, h, (r) => draw(r, f, pal)), n = outline(raw, ZOUT), nf = flipH(n);
    const wt = flashSpr(n), hot = outline(hotSpr(raw), '#161616');
    const fr = { raw, n, nf, w: wt, wf: flipH(wt), h: hot, hf: flipH(hot), s: sh, sf: sh };
    fr.px = { n: pixOf(n, shw), nf: pixOf(nf, shw), w: pixOf(fr.w, shw), wf: pixOf(fr.wf, shw), h: pixOf(hot, shw), hf: pixOf(fr.hf, shw) };
    S.walk.push(fr);
  }
  const c0 = S.walk[0].n;
  S.ax = c0.width >> 1;
  S.ay = c0.height - 1;
  S.h = c0.height;
  S.w = c0.width;
  S.shp = (sh.height >> 1) - 1;
  S.dead = rot90(c0);
  S.deadH = rot90(S.walk[0].h);
  S.tilt = rotA(c0, Math.PI / 4);
  S.dax = S.dead.width >> 1;
  S.day = S.dead.height - 1;
  S.spin = [];
  S.spinH = [];
  for (let k = 0; k < 8; k++) {
    S.spin.push(k & 1 ? rotA(c0, k * Math.PI / 4) : k === 0 ? c0 : k === 2 ? S.dead : k === 4 ? rot90(S.dead) : rot90(rot90(S.dead)));
    S.spinH.push(k & 1 ? rotA(S.walk[0].h, k * Math.PI / 4) : k === 0 ? S.walk[0].h : k === 2 ? S.deadH : k === 4 ? rot90(S.deadH) : rot90(rot90(S.deadH)));
  }
  const raw0 = outline(S.walk[0].raw, ZOUT), r = big ? 7 : 5;
  S.corpses = [corpseOf(raw0, r, 3, false), corpseOf(raw0, r + 1, 11, true), corpseOf(raw0, r, 23, true)];
  S.cax = S.corpses[0].width >> 1;
  S.cay = S.corpses[0].height >> 1;
  // a splat alone (a burst body leaves only this)
  S.splats = [splatSpr(r, 5), splatSpr(r + 1, 17), splatSpr(r - 1, 29)];
  // its colours, for the torn bits (skin, trousers, shirt)
  S.pal = { sk: [pal.body[0], pal.body[1], pal.body[2], pal.body[2]], pa: pal.leg.concat(pal.leg[1]), sh: [pal.body[0], pal.body[1], pal.body[2]] };
  S.big = !!big;
  return S;
}
// The silver copy of set S (made once): the same frames in polished silver.
function silverSet(S) {
  if (S.silver) return S.silver;
  const V = Object.assign({}, S, { walk: [] });
  for (const fr of S.walk) {
    const n = silverSpr(fr.n), nf = flipH(n), shw = Math.round(S.w * 0.7);
    V.walk.push(Object.assign({}, fr, { n, nf, px: Object.assign({}, fr.px, { n: pixOf(n, shw), nf: pixOf(nf, shw) }) }));
  }
  V.dead = silverSpr(S.dead);
  V.spin = S.spin.map(silverSpr);
  V.isSilver = true;
  S.silver = V;
  V.silver = V;
  return V;
}
// Fill ZS (0 walkers, 1 runners, 2 brutes) with the horde's looks (initSprites calls it).
function makeHordeSprites() {
  for (const a of ZS) a.length = 0;
  for (const p of ZPAL.walk) ZS[0].push(makeHordeSet(8, 11, hWalker, p, 7));
  for (const p of ZPAL.run) ZS[1].push(makeHordeSet(9, 10, hRunner, p, 7));
  for (const p of ZPAL.brute) ZS[2].push(makeHordeSet(12, 14, hBrute, p, 11, true));
  for (const a of ZS) for (const S of a) silverSet(S);
}

// ---------- the railway, looked up by row
// The dead ask where the rails are every step; the answer for each whole row of y is kept in a
// ring of 4096 rows (filled when first asked), and in between two rows it is blended.
const RWN = 4096, RWY = new Float64Array(RWN).fill(NaN), RWX = new Float64Array(RWN), RWP = new Float64Array(RWN);
const RWS = new Float64Array(RWN), RWC = new Float64Array(RWN);
function trow(yi) {
  const k = yi & (RWN - 1);
  if (RWY[k] !== yi) {
    const p = trackSlope(yi);
    RWY[k] = yi;
    RWX[k] = trackX(yi);
    RWP[k] = p;
    RWC[k] = 1 / Math.sqrt(1 + p * p);
    RWS[k] = trackS(yi);
  }
  return k;
}
// trackX(y) from the rows
function railX(y) {
  const yi = Math.floor(y), a = trow(yi), b = trow(yi + 1);
  return RWX[a] + (RWX[b] - RWX[a]) * (y - yi);
}
// trackLocal from the rows; out.x = the rails' middle on that row
function railLocal(x, y, out) {
  const yi = Math.floor(y), f = y - yi, a = trow(yi), b = trow(yi + 1);
  const tx = RWX[a] + (RWX[b] - RWX[a]) * f, p = RWP[a] + (RWP[b] - RWP[a]) * f, c = RWC[a] + (RWC[b] - RWC[a]) * f;
  const off = x - tx;
  out.u = off * c;
  out.a = RWS[a] + (RWS[b] - RWS[a]) * f + off * p * c;
  out.c = c;
  out.x = tx;
  return out;
}

// ---------- the small base horde under each leg's event timeline
// legs.js fills each row with its own population, cadence and type shares. There is no km blend.
// Fallback living cap, base stream size and seconds between streams (proposal)
const HORDE = Array.from({ length: 12 }, () => ({ want: 160, size: 4, gap: 4, run: 0, brute: 0, railBrute: 0 }));
// The menu battle retains its previous middle-route pace, independently of the selected leg.
const DEMO_HD = { want: 420, size: 16.75, gap: 1.025, wave: 10.25, waveN: 5, run: 0.1, brute: 0.02 };
// Older diagnostics may pass km; actual play always reads its selected leg instead.
function horde() {
  if (G.demo) return DEMO_HD;
  return legDef(G.leg)?.base || HORDE[0];
}
// 0 walker, 1 runner, 2 brute. rail = for a crowd on the rails.
function pickType(rail) {
  const r = Math.random();
  if (G.demo) return r < 0.02 ? 2 : r < 0.12 ? 1 : 0;
  const h = horde(), b = legAllows('brute') ? (rail ? h.railBrute : h.brute) : 0;
  const run = legAllows('runner') ? h.run : 0;
  return r < b ? 2 : r < b + run ? 1 : 0;
}
// Real spawners obey the selected leg, including explicit leaders and old-leg replays.
function legSpawnType(type) {
  const t = Number.isInteger(type) && type >= 0 && type <= 2 ? type : 0;
  if (G.demo) return t;
  return t === 1 && !legAllows('runner') || t === 2 && !legAllows('brute') ? 0 : t;
}
function pickSpawnType(rail, params = {}, index = 0) {
  const type = index < (params.leaders || 0) ? (params.leadType ?? 2) : params.type;
  return type == null ? pickType(rail) : legSpawnType(type);
}
// A pack of n standing round (hx, hy) (the start of a run, the demo).
function pack(n, hx, hy) {
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(Math.random()) * (6 + n * 1.1), b = rnd(TAU);
    G.zombies.push(newDead(hx + Math.cos(b) * r, hy + Math.sin(b) * r * FORE, pickType(false)));
  }
}
// A normal leg zombie; golden runners are explicit timeline events, never a random variant.
function newDead(x, y, type) {
  return makeZombie(x, y, legSpawnType(type));
}

// ---------- streams and waves
// A stream: the dead walking in one after another from one point at the edge of the screen (kept
// in screen px, so it stays at the edge while the view moves on). n = how many are still to come,
// gap = seconds between two, t = time to the next, edge = -1 left, 1 right, 0 top.
const STREAMS = [];
// Escort followers begin farther outside the edge, behind the first emitted brutes. (proposal)
const STREAM_ESCORT_BACK = 72;
const ESCORTS = [];
// Rail-centred entry and a short following gap let slow brute escorts intercept the train. (proposal)
const ESCORTC = { railOff: 8, gap: 14, release: 30, approach: 2, lane: 4 };
// A new stream of n at the edge; fast = a wave's (they come quicker).
function addStream(n, edge, fast, params = {}) {
  const tr = G.tr, nose = tr.cars[0];
  const leaders = Math.min(n, Math.max(0, Math.floor(params.leaders || 0)));
  let sx, sy;
  if (edge === 0) {
    // over the top edge, to one side of the rails ahead
    sy = -10;
    const rx = railX(G.camY + 10) - G.camX, s = Math.random() < 0.5 ? -1 : 1;
    sx = clamp(rx + s * (leaders ? ESCORTC.railOff : rnd(40, 190)), 8, W - 8);
  } else {
    // in from a side, level with the ground ahead of the engine (or beside it)
    sx = edge < 0 ? -10 : W + 10;
    sy = clamp(nose.y0 - G.camY - rnd(-30, 150), 14, VH * 0.7);
  }
  const escort = edge === 0 && leaders ? { leaders: [], members: [], expected: leaders, emitted: 0, active: true, ready: false, x: 0, y: 0 } : null;
  if (escort) ESCORTS.push(escort);
  STREAMS.push({ sx, sy, n, gap: fast ? rnd(0.05, 0.08) : rnd(0.09, 0.15), t: 0, edge, fast, age: 0,
    type: params.type, leadType: params.leadType ?? 2, leaders, escort,
    railOff: leaders ? (Math.random() < 0.5 ? -1 : 1) * ESCORTC.railOff : 0,
    emitted: 0, eventId: params.eventId || '' });
}
// Each step: the streams let out their dead (none past the most the horde wants).
function updateStreams(dt, want) {
  for (let i = STREAMS.length - 1; i >= 0; i--) {
    const s = STREAMS[i];
    s.age += dt;
    s.t -= dt;
    while (s.t <= 0 && s.n > 0) {
      s.t += s.gap;
      s.n--;
      const index = s.emitted++;
      const lead = index < s.leaders;
      if (lead && s.escort) s.escort.emitted++;
      if (G.zombies.length >= want) continue;
      // (a stream from the side comes in a band, one from the top in a line across)
      const jx = s.edge ? rnd(-4, 4) : s.escort ? rnd(-2, 2) : rnd(-10, 10), jy = s.edge ? rnd(-8, 8) : rnd(-3, 3);
      const back = s.leaders && !lead ? STREAM_ESCORT_BACK : 0;
      const y = G.camY + s.sy + jy - (s.edge ? 0 : back * FORE);
      const x = s.escort ? railX(y) + s.railOff + jx : G.camX + s.sx + jx + (s.edge ? s.edge * back : 0);
      const z = newDead(x, y, pickSpawnType(false, s, index));
      z.stream = 1;
      if (s.escort) { z.streamLead = lead; z.streamIndex = index; }
      if (s.escort && s.escort.active) {
        z.escort = s.escort;
        s.escort.members.push(z);
        if (lead) s.escort.leaders.push(z);
      } else if (s.escort) {
        z.escortReleased = true; z.escortReleaseAt = s.escort.releasedAt;
        z.escortReleaseReason = s.escort.releaseReason;
      }
      if (s.eventId) { z.streamEventId = s.eventId; z.streamIndex = index; z.streamLead = lead; z.streamAt = G.run; }
      G.zombies.push(z);
    }
    if (s.n <= 0) STREAMS.splice(i, 1);
  }
}
// Real legs have only a small base trickle here; the timeline supplies their waves and rail
// crowds. The attract battle keeps its independent automatic waves and crowds.
function spawn(dt) {
  const h = horde(), want = Math.min(CFG.pop.max, h.want);
  updateStreams(dt, want);
  G.spawnCd -= dt;
  if (G.spawnCd <= 0 && G.zombies.length < want) {
    const r = Math.random();
    addStream(Math.round(h.size * rnd(1, 1.5)), r < 0.5 ? 0 : r < 0.75 ? -1 : 1, false);
    G.spawnCd = h.gap * rnd(0.8, 1.25);
  }
  if (!G.demo) return;
  G.waveCd = (G.waveCd == null ? h.wave * 0.6 : G.waveCd) - dt;
  if (G.waveCd <= 0) {
    G.waveCd = h.wave * rnd(0.85, 1.15);
    for (let k = 0; k < h.waveN; k++) addStream(Math.round(h.size * rnd(1.2, 1.7)), k % 3 === 0 ? 0 : k % 3 === 1 ? -1 : 1, true);
    G.waves = (G.waves || 0) + 1;
  }
  G.railCd -= dt;
  if (G.railCd <= 0) {
    railGroup(rndi(6, 10));
    G.railCd = rnd(6, 9);
  }
}
// A new run (or the demo) starts with no streams.
function clearStreams() {
  STREAMS.length = 0;
  ESCORTS.length = 0;
  BOOMS.length = 0;
}

function updateEscorts() {
  for (let i = ESCORTS.length - 1; i >= 0; i--) {
    const e = ESCORTS[i];
    let n = 0, x = 0, y = Infinity, near = false;
    for (const z of e.leaders) if (!z.dead && !z.gone) {
      n++; x += z.x; y = Math.min(y, z.y);
      if (z.st === 2 || trainDist(z.x, z.y) <= ESCORTC.release) near = true;
    }
    if (near || !n && e.emitted >= e.expected) {
      e.active = false;
      e.releasedAt = G.run; e.releaseReason = near ? 'nearTrain' : 'leadersGone';
      for (const z of e.members) {
        z.escort = null; z.escortReleased = true; z.escortReleaseAt = G.run;
        z.escortReleaseReason = e.releaseReason;
      }
      e.members.length = 0; e.leaders.length = 0;
      ESCORTS.splice(i, 1);
    } else {
      e.ready = n > 0;
      if (n) { e.x = x / n; e.y = y - ESCORTC.gap * FORE; }
    }
  }
}

function constrainEscorts() {
  let moved = false;
  for (const e of ESCORTS) if (e.ready) {
    for (const z of e.members) if (!z.streamLead && !z.dead && !z.gone && z.st !== 2 && z.y > e.y) {
      z.y = e.y; z.k = z.y; moved = true;
    }
  }
  return moved;
}

// ---------- each step of the dead
const ZL = { u: 0, a: 0, c: 1, x: 0 };
function updateZombies(dt) {
  const zs = G.zombies, tr = G.tr, hw = CAR.half, safe = G.result === 'won';
  if (!G.result) spawn(dt);
  updateEscorts();
  updateBooms(dt);
  updateHits(dt);
  silverShine();
  const kb = Math.exp(-5 * dt), mid = tr.cars[2], R = CFG.ram, ram = ramPowered(), hunt = G.people.length > 0, L = ZL;
  let onTrain = 0, ahead = 1e9, railN = 0;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.dead) continue;
    if (BURNWALL.length) { z.fireX = z.x; z.fireY = z.y; }
    if (z.flash > 0) z.flash -= dt;
    if (z.st === 2) {
      // holding on: it rides along and claws at the car
      onTrain++;
      const c = tr.cars[z.car];
      z.bang += dt * (z.run ? 11 : 8);
      const lunge = Math.sin(z.bang) > 0.5 ? 1 : 0;
      if (z.side === 0) {
        z.x = c.x0 + c.dx * (3 - lunge) + c.nx * z.ox;
        z.y = c.y0 + c.dy * (3 - lunge) + c.ny * z.ox;
      } else {
        const o = (hw + 2 + z.ox - lunge) * z.side;
        z.x = c.cx + c.dx * z.al + c.nx * o;
        z.y = c.cy + c.dy * z.al + c.ny * o;
      }
      z.k = c.k + 0.5;
      z.vx = c.dx * tr.v;
      z.vy = c.dy * tr.v;
      z.anim += dt * 5;
      z.dmg += z.dps * dt;
      if (z.dmg >= 1) {
        z.dmg -= 1;
        hurtTrain(1, z.car, 'claw');
      }
      continue;
    }
    railLocal(z.x, z.y, L);
    const ds = L.a - tr.s, side = L.u < 0 ? -1 : 1;
    // where to walk: after a survivor, down the rails, onto the rails ahead, to the train's side,
    // or after the train (runners hunt survivors from further away; golden zombies only run)
    let tx, ty;
    const escort = z.escort && z.escort.active && z.escort.ready && !z.streamLead ? z.escort : null;
    const prey = hunt && z.st === 0 && !z.gold ? preyNear(z, z.run ? 120 : 70) : null;
    if (escort) {
      tx = escort.x + ((z.streamIndex % 3) - 1) * ESCORTC.lane;
      ty = escort.y;
    } else if (z.gold) {
      const g = goldFlee(z);
      tx = g[0];
      ty = g[1];
    } else if (prey) {
      tx = prey.x;
      ty = prey.y;
      if (Math.abs(prey.x - z.x) < 4 && Math.abs(prey.y - z.y) < 3) grabPerson(prey, z);
    } else if (z.st === 1) { ty = z.y + 24; tx = railX(ty) + z.rx; }
    else if (ds < -6) { tx = L.x + z.rx; ty = z.y + 4; }
    else if (ds <= TRAIN_LEN + 6) { tx = L.x + side * (hw + 3) / L.c; ty = z.y; }
    else { const c = tr.cars[CAR.n - 1]; tx = c.x1 + side * (hw + 3); ty = c.y1; }
    const dx = tx - z.x, dy = (ty - z.y) / FORE, d = Math.sqrt(dx * dx + dy * dy) || 1;
    z.wob += dt * (z.run ? 2 : 0.8);
    // (a slow sway round the way: the crowd does not walk in lock step)
    const w = z.st === 1 ? 0 : Math.sin(z.wob) * (z.run ? 0.25 : 0.4), cw = Math.cos(w), sw = Math.sin(w);
    const ux = (dx * cw - dy * sw) / d, uy = (dx * sw + dy * cw) / d;
    // (the dead of a Dead Wall stand still until the train is near; a hit one staggers)
    let sp = z.still ? 0 : z.sp * (z.st === 1 ? 0.7 : 1) * (z.flash > 0 ? 0.3 : 1);
    if (escort) sp = Math.min(sp, d * ESCORTC.approach);
    z.vx = ux * sp + z.kbx;
    z.vy = uy * sp * FORE + z.kby;
    if (z.gold) {
      z.vx = (z.goldDir || (z.left ? -1 : 1)) * sp + z.kbx;
      z.vy = clamp((ty - z.y) / dt, -SK.gold.follow * FORE, SK.gold.follow * FORE) + z.kby;
    }
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    const fireBlocked = BURNWALL.length && blockBurnWall(z, z.fireX, z.fireY);
    z.kbx *= kb;
    z.kby *= kb;
    z.k = z.y;
    if (ux > 0.3) z.left = false;
    else if (ux < -0.3) z.left = true;
    z.anim += dt * (z.still ? 0.3 : 0.6 + sp / 3.2);
    if (!fireBlocked && z.st === 0 && !z.gold && ds < -6 && Math.abs(L.u - z.rx) < 2.5) z.st = 1;
    // the engine runs it down, or (too slow to crush it) it climbs onto the nose; beside the train
    // it climbs on. Not once the train is safe.
    if (!safe && !fireBlocked) {
      const au = L.u < 0 ? -L.u : L.u;
      if (ram && au < G.ram.band && ds > -R.front && ds < R.back) {
        ramHit(z);
        continue;
      }
      if (au < hw + 2 && ds > -5 && ds < 6) {
        if (tr.v > 7 && !G.result) crush(z);
        else attach(z, 0, ds, L.u);
        continue;
      }
      if (ds >= 0 && ds <= TRAIN_LEN && au < hw + 4) {
        attach(z, side, ds, L.u);
        continue;
      }
    }
    if (z.st === 1 && ds < 0) {
      if (-ds < ahead) ahead = -ds;
      if (ds > -260) railN++;
    }
    // far from the train and out of view: gone
    if (Math.abs(z.x - mid.cx) + Math.abs(z.y - mid.cy) > 900 && offView(z.x, z.y, 40)) z.gone = true;
  }
  G.onTrain = onTrain;
  G.railAhead = railN;
  // the dead on the track ahead: a warning, and the train sounds its horn
  G.blocked = ahead < 170;
  tr.hornT -= dt;
  if (ahead < 150 && tr.hornT <= 0 && !G.demo && !G.result) {
    tr.hornT = 7;
    SFX.horn();
  }
  gridBuild();
  spread(dt);
  updateEscorts();
  let moved = constrainEscorts();
  // Neighbours can push after walking, so enforce the wall once more before weapons query the grid.
  if (BURNWALL.length) {
    for (const z of zs) if (!z.dead && z.st !== 2) moved = blockBurnWall(z, z.fireX, z.fireY) || moved;
  }
  if (moved) gridBuild();
  // drop the dead and the lost
  let j = 0;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead && !zs[i].gone) zs[j++] = zs[i];
  zs.length = j;
}
// The crowd flows like a liquid: each one pushes its near neighbours apart a little (brutes push
// harder), walks round trees and walls, and never into the train or past the safe zone wall.
function spread(dt) {
  const zs = G.zombies, tr = G.tr, hw = CAR.half, stops = G.stops, L = ZL, gy = G.goalY + 8;
  for (let n = 0; n < zs.length; n++) {
    const a = zs[n];
    if (a.dead || a.st === 2) continue;
    const ra = a.big ? 5 : 2.8, i0 = Math.floor(a.x / GC), j0 = Math.floor(a.y / GC);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const list = GRID.get(gk(i, j));
      if (!list) continue;
      for (let q = 0; q < list.length; q++) {
        const b = list[q];
        if (b === a || b.st === 2) continue;
        const dx = a.x - b.x, dy = (a.y - b.y) / FORE, d2 = dx * dx + dy * dy, rr = ra + (b.big ? 5 : 2.8);
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), p = (rr - d) * 0.22 / d;
          a.x += dx * p;
          a.y += dy * p * FORE;
          b.x -= dx * p;
          b.y -= dy * p * FORE;
        }
      }
    }
    a.blockT -= dt;
    if (a.blockT <= 0) {
      blockersNear(a.x, a.y, a.block);
      a.blockT = rnd(0.5, 0.8);
    }
    for (let k = 0; k < a.block.length; k += 3) {
      const dx = a.x - a.block[k], dy = (a.y - a.block[k + 1]) / FORE, d = Math.sqrt(dx * dx + dy * dy), m = a.block[k + 2] + ra * 0.6;
      if (d < m && d > 1e-4) {
        a.x = a.block[k] + dx / d * m;
        a.y = a.block[k + 1] + dy / d * m * FORE;
      }
    }
    for (let k = 0; k < stops.length; k++) {
      const hs = stops[k].house, dx = a.x - hs.x, dy = (a.y - hs.y + 6) / FORE;
      if (dx > 16 || dx < -16) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 16 && d > 1e-4) {
        a.x = hs.x + dx / d * 16;
        a.y = hs.y - 6 + dy / d * 16 * FORE;
      }
    }
    const rx = railX(a.y);
    if (Math.abs(a.x - rx) < 26) {
      railLocal(a.x, a.y, L);
      const ds = L.a - tr.s;
      if (ds > 0 && ds < TRAIN_LEN && Math.abs(L.u) < hw + 2) a.x = rx + (L.u < 0 ? -1 : 1) * (hw + 2) / L.c;
    }
    if (a.y < gy) a.y = gy;
  }
}

// ---------- the crowd layer
// Drawing hundreds of small sprites one by one is slow, so most of the dead are written straight
// into the picture's pixels in one go, back to front, each with its shadow. Layer A goes under
// everything standing (the dead in the open, and those with only things in front of them), layer B
// over it (those with only things behind them). The rest (between two things, holding on to the
// train, golden) are sorted in with everything standing (render). For that the screen is cut into
// 8 px cells, and each cell keeps the nearest and furthest depth (k) of what stands over it.
const OC = 8, CROWD = { a: [], b: [], ghost: [], list: [], visible: [], kmin: new Float32Array(0), kmax: new Float32Array(0), tree: new Uint8Array(0),
  cols: 0, rows: 0, x0: 0, y0: 0, head: new Int32Array(0), next: new Int32Array(0), force: null };
// (force = 'a' or 'one': every zombie into layer A, or every one drawn one by one; tests only)
// the cells under a box (world px): CC = [first column, last column, first row, last row]
const CC = [0, 0, 0, 0];
function occBox(l, t, w, h) {
  CC[0] = Math.max(0, Math.floor((l - CROWD.x0) / OC));
  CC[1] = Math.min(CROWD.cols - 1, Math.floor((l + w - CROWD.x0) / OC));
  CC[2] = Math.max(0, Math.floor((t - CROWD.y0) / OC));
  CC[3] = Math.min(CROWD.rows - 1, Math.floor((t + h - CROWD.y0) / OC));
}
function occMark(l, t, w, h, k, tree) {
  occBox(l, t, w, h);
  const C = CROWD;
  for (let r = CC[2]; r <= CC[3]; r++) for (let c = CC[0]; c <= CC[1]; c++) {
    const i = r * C.cols + c;
    if (k < C.kmin[i]) C.kmin[i] = k;
    if (k > C.kmax[i]) C.kmax[i] = k;
    if (tree) C.tree[i] = 1;
  }
}
// After gather() has put everything else standing in view into DL: the dead in view go to layer A,
// layer B, or DL and VZ (drawn one by one). x0..y1 = the view in world px.
function gatherHorde(x0, x1, y0, y1) {
  const C = CROWD;
  // After a large strike, a modest surviving crowd is cheaper in the ordinary depth-sorted
  // sprite pass. Its shadows share one opacity pass instead of switching alpha per zombie.
  // Dense hordes still use the existing bulk layers; every zombie remains visible either way.
  if (!C.force && (parts.length > 160 || booms.length > 10 || BURN.length > 20)) {
    C.visible.length = 0;
    for (const z of G.zombies) if (!z.dead && z.x >= x0 - 10 && z.x <= x1 + 10 && z.y >= y0 && z.y <= y1 + 24) C.visible.push(z);
    if (C.visible.length <= 260) {
      C.a.length = C.b.length = C.ghost.length = C.list.length = 0;
      for (const z of C.visible) { DL.push(z); VZ.push(z); }
      return;
    }
  }
  C.x0 = x0 - 16;
  C.y0 = y0 - 24;
  const cols = Math.ceil((x1 - x0 + 32) / OC) + 1, rows = Math.ceil((y1 - y0 + 56) / OC) + 1, n = cols * rows;
  if (C.kmin.length < n) {
    C.kmin = new Float32Array(n);
    C.kmax = new Float32Array(n);
    C.tree = new Uint8Array(n);
  }
  C.cols = cols;
  C.rows = rows;
  C.kmin.fill(Infinity);
  C.kmax.fill(-Infinity);
  C.tree.fill(0);
  for (let i = 0; i < DL.length; i++) {
    const o = DL[i];
    if (o.isCar) {
      // (a car is long and often turned: marked as five boxes along it, each as tall as the car)
      const c = G.tr.cars[o.i], tall = TRAIN[o.i].tall + 4;
      for (let f = 0; f <= 1; f += 0.25) occMark(lerp(c.x1, c.x0, f) - 11, lerp(c.y1, c.y0, f) - tall - 4, 22, tall + 10, o.k, false);
    } else if (o.person) occMark(o.x - 3, o.y - 16, 7, 18, o.k, false);
    else if (o.d) occMark(o.x - o.d.ax, o.y - o.d.ay, o.d.spr.width, o.d.spr.height, o.k, !!o.d.tree);
  }
  C.a.length = C.b.length = C.ghost.length = 0;
  for (const z of G.zombies) {
    if (z.dead || z.x < x0 - 10 || z.x > x1 + 10 || z.y < y0 || z.y > y1 + 24) continue;
    const S = z.S;
    occBox(z.x - S.ax, z.y - S.ay, S.w, S.h + 1);
    let mn = Infinity, mx = -Infinity, tree = 0;
    for (let r = CC[2]; r <= CC[3]; r++) for (let c = CC[0]; c <= CC[1]; c++) {
      const i = r * cols + c;
      if (C.kmin[i] < mn) mn = C.kmin[i];
      if (C.kmax[i] > mx) mx = C.kmax[i];
      tree |= C.tree[i];
    }
    if (C.force) {
      if (C.force === 'a') C.a.push(z);
      else { DL.push(z); VZ.push(z); }
    } else if (mn === Infinity && !z.gold) C.a.push(z);
    else if (z.gold || z.st === 2 || (mn <= z.k && mx >= z.k)) {
      DL.push(z);
      VZ.push(z);
    } else if (mx < z.k) C.b.push(z);
    else {
      C.a.push(z);
      if (tree) C.ghost.push(z);
    }
  }
  // (CROWD.list = all the dead drawn in the layers, for tests)
  C.list.length = 0;
  for (const z of C.a) C.list.push(z);
  for (const z of C.b) C.list.push(z);
}
// Layer A, drawn over the ground and under everything standing. sx, sy = the shake.
function drawHorde(sx, sy) {
  drawStreamMarks();
  crowdPass(CROWD.a, sx, sy);
}
// Layer B, over everything standing, and the dead behind a tree showing faintly through it.
function drawHordeTop(sx, sy) {
  crowdPass(CROWD.b, sx, sy);
  if (!CROWD.ghost.length) return;
  ctx.globalAlpha = thermal ? 0.6 : 0.45;
  for (const z of CROWD.ghost) blit(zImg(z), Math.round(z.x - z.S.ax), Math.round(z.y - z.S.ay));
  ctx.globalAlpha = 1;
}
// Draw list L of the dead: a few as sprites; a crowd written into the pixels (back to front by a
// bucket per screen row, so there is no sort).
function crowdPass(L, sx, sy) {
  const n = L.length;
  if (!n) return;
  const ox = sx - G.camX, oy = sy - G.camY;
  // Native sprites are cheaper for the smaller groups left between overlapping blasts;
  // reserve a full-canvas pixel readback for a genuinely dense layer.
  if (n < 160) {
    L.sort(byK);
    for (const z of L) {
      const S = z.S, fr = S.walk[(z.anim | 0) & 3];
      ctx.globalAlpha = thermal ? 0.2 : 0.32;
      blit(fr.s, Math.round(z.x - (fr.s.width >> 1)), Math.round(z.y - (fr.s.height >> 1)));
      ctx.globalAlpha = 1;
      blit(zImg(z), Math.round(z.x - S.ax), Math.round(z.y - S.ay));
    }
    return;
  }
  const R = VH + 64;
  if (CROWD.head.length < R) CROWD.head = new Int32Array(R);
  if (CROWD.next.length < n) CROWD.next = new Int32Array(n * 2);
  const head = CROWD.head, next = CROWD.next;
  head.fill(-1, 0, R);
  for (let i = 0; i < n; i++) {
    const r = clamp(Math.round(L[i].y + oy) + 24, 0, R - 1);
    next[i] = head[r];
    head[r] = i;
  }
  // putImageData bypasses the world clip, so its buffer itself ends above the plane band.
  const im = ctx.getImageData(0, 0, W, VH), D = new Uint32Array(im.data.buffer);
  for (let r = 0; r < R; r++) {
    for (let i = head[r]; i >= 0; i = next[i]) {
      const z = L[i], S = z.S, fr = S.walk[(z.anim | 0) & 3], P = fr.px;
      const p = thermal ? (z.left ? P.hf : P.h) : z.flash > 0 ? (z.left ? P.wf : P.w) : z.left ? P.nf : P.n;
      const X = Math.round(z.x - S.ax + ox), Y = Math.round(z.y - S.ay + oy), pw = p.w, ph = p.h, pd = p.d;
      const xa = X < 0 ? -X : 0, xb = X + pw > W ? W - X : pw, ya = Y < 0 ? -Y : 0, yb = Y + ph > VH ? VH - Y : ph;
      for (let y = ya; y < yb; y++) {
        let o = (Y + y) * W + X + xa, q = y * pw + xa;
        for (let x = xa; x < xb; x++, o++, q++) {
          const c = pd[q];
          if (c === 0) continue;
          if (c === 1) {
            const g = D[o];
            D[o] = (((g >>> 1) & 0x7f7f7f) + ((g >>> 2) & 0x3f3f3f) | 0xff000000) >>> 0;
          } else D[o] = c;
        }
      }
    }
  }
  ctx.putImageData(im, 0, 0);
}
// The streams coming in: a red ! at the edge where each one enters (screen px, under the HUD).
function drawStreamMarks() {
  if (G.demo || thermal) return;
  for (const s of STREAMS) {
    if (s.age > 2.5 || (realT * 4 | 0) % 2) continue;
    const x = Math.round(clamp(s.sx, 4, W - 6)), y = Math.round(clamp(s.sy, 30, VH - 30));
    ctx.fillStyle = '#0c0f09';
    ctx.fillRect(x - 2, y - 5, 5, 11);
    ctx.fillStyle = s.fast ? '#ff3a2a' : '#c8432e';
    ctx.fillRect(x - 1, y - 4, 3, 6);
    ctx.fillRect(x - 1, y + 3, 3, 2);
  }
}

// ---------- kills: the pop, silver, explosive
// A gun kill: the body bursts into a red splat that stays (the corpse in it now and then), a few
// drops fly, now and then a limb, a quick red puff.
function popKill(z, cause) {
  const S = z.S;
  JUICE.from = null;
  const room = Math.random() < 0.35;
  if (room) stampSpr(S.corpses[(Math.random() * S.corpses.length) | 0], z.x - S.cax, z.y - S.cay, 1);
  else { const s = S.splats[(Math.random() * S.splats.length) | 0]; stampSpr(s, z.x - (s.width >> 1), z.y - (s.height >> 1), 1); }
  if (offView(z.x, z.y, 30)) return;
  const [dx, dy] = hitDir(z, cause), n = z.big ? 10 : 5;
  for (let k = 0; k < n; k++) {
    const v = rnd(25, 85), s = rnd(-0.8, 0.8);
    part({ x: z.x + rnd(-1, 1), y: z.y, z: rnd(2, S.h * 0.7), vx: (dx - dy * s) * v, vy: (dy + dx * s) * v * FORE, vz: rnd(20, 70),
      g: 260, life: 1.2, max: 1.2, s: Math.random() < 0.25 ? 2 : 1, c: pick(BLOOD), land: 1 });
  }
  part({ x: z.x, y: z.y, z: S.h * 0.5, vx: dx * 10, vy: dy * 10 * FORE, vz: 5, g: 0, life: 0.28, max: 0.28, s: z.big ? 4 : 3,
    c: 'rgba(196,38,28,0.6)', grow: 12, drag: 4, smoke: true });
  if (Math.random() < (z.big ? 1 : 0.22)) gib(z, dx, dy, 1);
  if (z.big) {
    gib(z, dx, dy, 1.2);
    bloodPool(z.x, z.y, S);
  }
}
// Scrap for a silver zombie, regardless of its base type. (proposal)
const SILVER_PAY = 15;
// Called by makeZombie: roll silver (never in the demo, never a brute).
function silverRoll(z) {
  const c = G && G.up && legAllows('silver') ? G.up.silver || 0 : 0;
  if (c > 0 && !z.big && Math.random() < c) {
    z.silver = true;
    z.S = silverSet(z.S);
    z.value = SILVER_PAY;
  }
  return z;
}
// A silver one dies: a white ring, silver sparks, coins.
function silverKill(z, sc) {
  rings.push({ x: z.x, y: z.y, r0: 2, r1: 16, t: 0, T: 0.3, c: '#e6eef8', w: 1 });
  lights.push({ x: z.x, y: z.y, z: 5, r: 18, c: '#dfe8ff', life: 0.2, max: 0.2, a: 0.8 });
  for (let k = 0; k < 8; k++) {
    const a = rnd(TAU), s = rnd(20, 60);
    part({ x: z.x, y: z.y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 60), g: 180, life: rnd(0.3, 0.6), max: 0.6,
      s: 1, c: pick(['#ffffff', '#dfe8ff', '#a8b8d0']), add: true, drag: 1.5 });
  }
  if (sc) for (let k = 0; k < 3 && coins.length < 60; k++) coins.push({ x0: z.x - G.camX + rnd(-4, 4), y0: z.y - G.camY - 8, t: -k * 0.05, T: rnd(0.55, 0.8) });
}
// The shine of the silver ones in view: a soft glow and a glint now and then.
function silverShine() {
  if (!G.up.silver || thermal) return;
  let n = 0;
  for (const z of G.zombies) {
    if (!z.silver || z.dead || offView(z.x, z.y, 0)) continue;
    if (++n > 40) break;
    lights.push({ x: z.x, y: z.y, z: 5, r: 8, c: '#cfe0ff', life: 0.03, max: 0.03, a: 0.3 });
    if (Math.random() < 0.06) part({ x: z.x + rnd(-3, 3), y: z.y, z: rnd(3, z.S.h), vx: 0, vy: 0, vz: rnd(6, 12), g: 0, life: 0.35, max: 0.35,
      s: 1, c: '#ffffff', add: true });
  }
}
// Explosive zombies: BOOMS = blasts to come ({x, y, t}); at most BOOM_STEP go off in one step.
const BOOMS = [], BOOM_STEP = 6;
// Called by kill(): 1 in G.up.boom of the dead blow up a moment after they fall.
function boomRoll(z) {
  const c = legAllows('boom') ? G.up.boom || 0 : 0;
  if (c > 0 && Math.random() < c && BOOMS.length < 80) BOOMS.push({ x: z.x, y: z.y, t: rnd(0.06, 0.12) });
}
function updateBooms(dt) {
  let n = 0;
  for (let i = 0; i < BOOMS.length && n < BOOM_STEP; i++) {
    const b = BOOMS[i];
    b.t -= dt;
    if (b.t > 0) continue;
    BOOMS.splice(i--, 1);
    n++;
    zombieBlast(b.x, b.y);
  }
}
// One explosive zombie blows up at (x, y): a fat white-yellow puff, smoke, sparks; every zombie in
// G.up.boomR px dies (and may blow up in turn).
function zombieBlast(x, y) {
  const R = G.up.boomR || 18;
  lights.push({ x, y, z: 4, r: R * 1.6, c: '#ffb060', life: 0.2, max: 0.2, a: 0.55 });
  lights.push({ x, y, z: 4, r: R * 0.6, c: '#fff6e0', life: 0.07, max: 0.07, a: 0.8 });
  addBoom(x, y, Math.round(R * 0.7), 5, 0.45, Math.max(5, Math.round(R * 0.4)));
  rings.push({ x, y, r0: 4, r1: R * 1.2, t: 0, T: 0.25, c: '#fff1c2', w: 2 });
  for (let k = 0; k < 10; k++) {
    const a = rnd(TAU), s = rnd(30, 90);
    part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 80), g: 160, life: rnd(0.25, 0.5), max: 0.5,
      s: 1, c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 1.4 });
  }
  for (let k = 0; k < 4; k++) part({ x: x + rnd(-5, 5), y: y + rnd(-3, 3), z: rnd(3, 8), vx: rnd(-8, 8) + 3, vy: rnd(-4, 4), vz: rnd(8, 18),
    g: 0, life: rnd(0.9, 1.5), max: 1.5, s: rnd(3, 5), c: pick(['rgba(70,64,58,0.55)', 'rgba(110,100,90,0.45)']), grow: 5, drag: 1, smoke: true });
  stampScorch(x, y, 1);
  let killed = 0;
  queryEll(x, y, R, (z) => {
    if (z.gate && z.still) return;
    if (z.big) {
      z.hp -= 3;
      z.flash = 0.18;
      if (z.hp > 0) return;
    }
    killed++;
    kill(z, 'boom', x, y, 0);
  });
  if (!G.demo) {
    addShake(0.12);
    if (killed >= 3) hitStop(0.02);
    SFX.pop();
  }
}

// ---------- the heli's guns: no tracers, a muzzle flash and the hit
// HITS = the sparks where rounds land: {x, y, t, s (seed), scale (this bullet's damage multiplier)}.
// An optional scale keeps Viper damage upgrades from changing other weapons' hit effects.
const HITS = [];
function hitSpark(x, y, scale = 1) {
  scale = Math.max(0.6, scale);
  if (HITS.length < 60) HITS.push({ x, y, t: 0, s: (Math.random() * 1e6) | 0, scale });
  for (let k = 0; k < 3; k++) {
    const a = rnd(TAU), s = rnd(25, 70);
    part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 60), g: 180, life: rnd(0.12, 0.28), max: 0.28,
      s: 1, c: pick(['#fff6e0', '#ffd27a', '#ffb347']), add: true, drag: 1.5 });
  }
  part({ x: x + rnd(-1, 1), y, z: 1, vx: rnd(-6, 6), vy: rnd(-3, 3), vz: rnd(4, 9), g: 0, life: rnd(0.35, 0.6), max: 0.6, s: 2,
    c: pick(['rgba(150,128,96,0.45)', 'rgba(124,106,80,0.45)']), grow: 4, drag: 2, smoke: true });
}
function updateHits(dt) {
  for (let i = HITS.length - 1; i >= 0; i--) if ((HITS[i].t += dt) > 0.09) HITS.splice(i, 1);
}
// A star of light: a white core and n rays of lengths from len0 to len1 (seeded by s), drawn with
// the 'lighter' blend. k = 0..1 strength.
function starFlash(x, y, s, len0, len1, k, coreScale = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const n = 4 + (s & 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hrnd(s, i, 1) * 0.5, l = Math.round(lerp(len0, len1, hrnd(s, i, 2)) * k), ca = Math.cos(a), sa = Math.sin(a) * FORE;
    for (let j = 1; j <= l; j++) {
      const f = j / l;
      ctx.globalAlpha = 1 - f * 0.7;
      ctx.fillStyle = f < 0.35 ? '#fff6e0' : f < 0.7 ? '#ffd27a' : '#ff9a3a';
      ctx.fillRect(Math.round(x + ca * j), Math.round(y + sa * j), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  const core = Math.max(1, Math.round(3 * coreScale)), half = Math.floor(core / 2);
  ctx.fillRect(x - half, y - half, core, core);
}
// The sparks of the hits (with 'lighter').
function drawHits() {
  for (const h of HITS) {
    const k = 1 - h.t / 0.09, scale = h.scale;
    light(h.x, h.y - 2, 9 * scale, '#ffd27a', 0.6 * k);
    starFlash(h.x, h.y - 2, h.s, 2 * scale, 5 * scale, k, Math.min(1, scale));
  }
}
// Heli h's muzzle flash: a big star of light at its nose, longest along the barrel, and a glow
// round it (with 'lighter'). It is new for every shot (h.fs) and fades in 0.07 s.
function drawMuzzle(h) {
  const k = clamp(h.flash / 0.07, 0, 1), [nx, ny] = turnXY(h.hd, 0, -HC.nose - 3), x = h.sx + nx, y = h.sy + ny;
  const [fx, fy] = turnXY(h.hd, 0, -1);
  light(x, y, 40, '#ff9a3a', 0.9 * k);
  light(x, y, 18, '#fff1c2', k);
  starFlash(x, y, h.fs || 1, 6, 16, 0.5 + 0.5 * k);
  // the blast out of the barrel: a fat streak forward
  const L = Math.round((9 + (h.fs & 7)) * (0.5 + 0.5 * k));
  for (let j = 0; j < L; j++) {
    const f = j / L, w = f < 0.5 ? 1 : 0;
    ctx.globalAlpha = 1 - f * 0.8;
    ctx.fillStyle = f < 0.3 ? '#ffffff' : f < 0.65 ? '#ffe2a0' : '#ffb347';
    ctx.fillRect(Math.round(x + fx * j) - w, Math.round(y + fy * j * FORE) - w, 1 + w * 2, 1 + w * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 3);
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 5);
}
// heli numbers from the skill tree (part T), or the plain ones
const heliRate = () => G.up.rate;   // HELI FIRE RATE is already folded into G.up.rate (treeUp in tree.js)
const heliDmg = () => G.up.dmg;     // HELI DAMAGE is already folded into G.up.dmg
const heliRange = () => HC.range * (G.up.heliRange || 1);   // G.up.heliRange is a multiplier (HELI RANGE node)
