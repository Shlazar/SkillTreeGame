// world.js - the countryside the railway runs through, built in 128 px chunks as the camera moves.
// Every chunk has a plan (its trees, wrecks, ruins, rocks, poles, tufts and fires, from a seed made
// of its coordinates, so the same place always holds the same things) and a baked ground image:
// painted grass and dirt from warped noise in world coordinates (so chunks meet without seams), farm
// tracks, ploughed fields, the railway, specks, pebbles, flowers, and the cast shadows of everything
// standing on it. Decals (blood, bodies, scorch, craters) are painted onto a second image per chunk
// and slowly fade.

const CH = 128;
// hue-shifted ramps (darks lean teal, lights lean warm olive), from Ball x Archers
const GR = ['#1e2a24', '#243226', '#2b3928', '#323f29', '#3a472b', '#44502e'].map(hexRgb);
const DR = ['#2a2521', '#332b24', '#3c3229', '#463b2f', '#514435'].map(hexRgb);
const PLOW = ['#251e19', '#2f2620', '#3a3027', '#46392d'].map(hexRgb);
// ---------- the railway
// It winds north for ever: its middle is at x = trackX(y), two gentle waves added together (the
// steepest bend is under 30 degrees from north). trackSlope(y) = dx/dy, trackS(y) = the distance
// along the rails from y = 0 (from the first terms of the arc-length integral: off by far less
// than a pixel per sleeper).
const TK = { a1: 140, l1: 520, p1: 0.7, a2: 50, l2: 190, p2: 2.1 };
function trackX(y) {
  return TK.a1 * Math.sin(y / TK.l1 + TK.p1) + TK.a2 * Math.sin(y / TK.l2 + TK.p2);
}
function trackSlope(y) {
  return TK.a1 / TK.l1 * Math.cos(y / TK.l1 + TK.p1) + TK.a2 / TK.l2 * Math.cos(y / TK.l2 + TK.p2);
}
function trackS(y) {
  const a1 = TK.a1 / TK.l1, a2 = TK.a2 / TK.l2, k1 = 1 / TK.l1, k2 = 1 / TK.l2, km = k1 - k2, kp = k1 + k2;
  const i1 = y / 2 + Math.sin(2 * (y * k1 + TK.p1)) / (4 * k1);
  const i2 = y / 2 + Math.sin(2 * (y * k2 + TK.p2)) / (4 * k2);
  const i12 = 0.5 * (Math.sin(km * y + TK.p1 - TK.p2) / km + Math.sin(kp * y + TK.p1 + TK.p2) / kp);
  return y + 0.5 * (a1 * a1 * i1 + a2 * a2 * i2 + 2 * a1 * a2 * i12);
}
// The y where the distance along the rails is s (Newton's method from a nearby guess).
function yAtS(s, guess) {
  let y = guess;
  for (let i = 0; i < 3; i++) {
    const fp = trackSlope(y);
    y -= (trackS(y) - s) / (1 + 0.5 * fp * fp);
  }
  return y;
}
// A point in the railway's own terms: u = px to the right of its middle (east), a = distance along it.
function trackLocal(x, y, out) {
  const fp = trackSlope(y), c = 1 / Math.sqrt(1 + fp * fp), off = x - trackX(y);
  out.u = off * c;
  out.a = trackS(y) + off * fp * c;
  out.c = c;
  return out;
}
// true when (x, y) is closer than m (across) to the middle of the railway
const nearRail = (x, y, m) => Math.abs(x - trackX(y)) < m;
// the colours: gravel, wooden sleepers, steel rails (shadow, top)
const BAL = ['#2e2b27', '#3b3732', '#47423b', '#555047'].map(hexRgb);
const SLP = ['#2a1f17', '#3d2d20', '#4f3b29'].map(hexRgb);
const RAILC = ['#24262b', '#8f959e'].map(hexRgb);
// the railway at the row being painted (groundPix goes row by row)
let tkY = NaN, tkX = 0, tkP = 0, tkC = 1, tkS = 0;

// farm tracks: a warped grid, about 1400 x 1000 px
function roadDist(x, y) {
  const wx = x + 60 * Math.sin(y * 0.004) + 25 * Math.sin(y * 0.011 + 1.3);
  const wy = y + 50 * Math.sin(x * 0.0035 + 0.7) + 20 * Math.sin(x * 0.009 + 2.1);
  return Math.min(Math.abs(mod(wx, 1400) - 700), Math.abs(mod(wy, 1000) - 500));
}
// ploughed fields: big patches, each with its own furrow direction
const fieldAt = (x, y) => vnoise(x / 260, y / 260, 35);
const fieldDir = (x, y) => Math.floor(vnoise(x / 520 + 9, y / 520 - 4, 36) * 4) * Math.PI / 4;

// The colour of the ground at one world pixel, written into out[0..2].
function groundPix(X, Y, out) {
  const th = bayer(X, Y);
  // domain warp: organic patches, no grid-aligned squares
  const n2 = vnoise(X / 16, Y / 16, 31), n2b = vnoise(X / 16 + 37.1, Y / 16 - 11.3, 32);
  const wx = X + (n2 - 0.5) * 48, wy = Y + (n2b - 0.5) * 36;
  const gv = vnoise(wx / 56, wy / 56, 33) * 0.7 + n2 * 0.3;
  const dirt = vnoise(wx / 40, wy / 40, 34) + (th - 0.5) * 0.1;
  let col;
  if (dirt > 0.74) col = DR[clamp(Math.floor((gv - 0.3) / 0.4 * 2.5 + 1.2 + th - 0.5), 0, DR.length - 1)];
  else col = GR[clamp(Math.floor((gv - 0.3) / 0.4 * 2.5 + 1.5 + (dirt > 0.68 ? -1 : 0) + th - 0.5), 0, GR.length - 1)];
  // ploughed fields: furrows every 3 px, softened at the field edge
  const fv = fieldAt(X, Y);
  if (fv > 0.63 + (th - 0.5) * 0.02) {
    const a = fieldDir(X, Y), u = X * Math.cos(a) + Y * Math.sin(a);
    const row = mod(Math.floor(u), 4) === 0 ? 0 : 1, edge = fv < 0.66;
    col = PLOW[clamp(row + (gv > 0.5 ? 1 : 0) + (edge ? 1 : 0) + (th > 0.85 ? 1 : 0), 0, 3)];
    if (row && vnoise(X / 5, Y / 5, 37) > 0.74) col = GR[2];          // a few sprouts
  }
  // farm tracks: a grassy crown, two muddy ruts, worn earth, a dithered edge
  const rd = roadDist(X, Y);
  if (rd < 8.5 + (th - 0.5) * 2) {
    if (rd < 1.4) col = GR[1];
    else if (Math.abs(rd - 3.6) < 1.1) col = DR[0];
    else col = DR[clamp(2 + (gv > 0.5 ? 1 : 0) + (th > 0.75 ? 1 : 0) - (rd > 6.5 ? 1 : 0), 0, 4)];
  }
  // the railway: a bed of gravel with a ragged edge, a sleeper every 6 px along the rails (lit
  // side, shadow), and the two rails (bright tops, their shadow on the east side)
  if (Y !== tkY) {
    tkY = Y;
    tkX = trackX(Y);
    tkP = trackSlope(Y);
    tkC = 1 / Math.sqrt(1 + tkP * tkP);
    tkS = trackS(Y);
  }
  const off = X - tkX, ru = Math.floor(off * tkC);
  if (ru >= -13 && ru <= 12) {
    const edge = ru < 0 ? -ru - 10 : ru - 9;
    if (edge <= 0 || th * 3 > edge) {
      col = BAL[clamp(Math.floor(hrnd(X, Y, 91) * 2.4 + gv * 1.5 - (edge > 0 ? 1 : 0)), 0, 3)];
      const sy = mod(Math.floor(tkS + off * tkP * tkC), 6);
      if (ru >= -8 && ru <= 7 && sy < 2) col = SLP[sy === 0 ? 2 : 1];
      else if (ru >= -8 && ru <= 7 && sy === 2) col = SLP[0];
      if (ru === -5 || ru === 4) col = RAILC[1];
      else if (ru === -4 || ru === 5) col = RAILC[0];
    }
  }
  out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
}

/* ------------------------------------------------------------------ plans */
const PLANS = new Map();
const ckey = (ci, cj) => ci * 100003 + cj;
// Everything that stands in chunk (ci, cj). props are drawn standing (sorted with the dead),
// flats are painted into the ground, block = flat triples x, y, r the dead walk round.
function plan(ci, cj) {
  const key = ckey(ci, cj);
  let pl = PLANS.get(key);
  if (pl) return pl;
  const rng = mulberry(hash32(Math.imul(ci, 73856093) ^ Math.imul(cj, 19349663) ^ 0x5eed));
  const X0 = ci * CH, Y0 = cj * CH;
  pl = { props: [], flats: [], tufts: [], fires: [], block: [] };
  const take = (list) => list[(rng() * list.length) | 0];
  const put = (def, x, y, o) => {
    const p = Object.assign({ d: def, x: Math.round(x), y: Math.round(y) }, o || {});
    p.k = p.y;
    pl.props.push(p);
    if (def.block) pl.block.push(p.x, p.y, def.block);
    return p;
  };
  // groves where the noise is high, a lone tree now and then
  for (let k = 0; k < 30; k++) {
    const x = X0 + rng() * CH, y = Y0 + rng() * CH;
    if (roadDist(x, y) < 16 || fieldAt(x, y) > 0.61 || nearRail(x, y, 40)) continue;
    const gv = vnoise(x / 110, y / 110, 41);
    if (gv > 0.68 ? rng() < (gv - 0.68) * 4.5 : rng() < 0.01) {
      const r = rng();
      put(take(r < 0.55 ? PROPS.pine : r < 0.78 ? PROPS.oak : r < 0.9 ? PROPS.fall : PROPS.dead), x, y);
    }
  }
  // wrecks on the tracks, a third of them still burning
  if (rng() < 0.4) {
    for (let k = 0; k < 12; k++) {
      const x = X0 + 12 + rng() * (CH - 24), y = Y0 + 8 + rng() * (CH - 16);
      if (roadDist(x, y) > 5 || nearRail(x, y, 60)) continue;
      const burning = rng() < 0.35;
      put(take(burning ? PROPS.burnt : rng() < 0.4 ? PROPS.burnt : PROPS.wreck), x, y);
      if (burning) pl.fires.push({ x: Math.round(x) + 1, y: Math.round(y) - 7, seed: (rng() * 1000) | 0, big: true });
      if (rng() < 0.5) put(take(PROPS.barrel), x + 16 + rng() * 6, y + 4 + rng() * 6);
      break;
    }
  }
  // now and then a burnt-out farm: broken walls, rubble, a barrel or crate, a smouldering fire
  if (hrnd(ci, cj, 5) < 0.05 && roadDist(X0 + 64, Y0 + 64) > 40 && fieldAt(X0 + 64, Y0 + 64) < 0.6 && !nearRail(X0 + 64, Y0 + 64, 220)) {
    const cx = X0 + 40 + rng() * 48, cy = Y0 + 40 + rng() * 48;
    for (let k = 0; k < 3 + ((rng() * 3) | 0); k++) {
      const w = take(PROPS.wall), x = cx + (rng() - 0.5) * 50, y = cy + (k - 1.5) * 12 + (rng() - 0.5) * 4;
      put(w, x, y);
      for (let s = -w.spr.width / 2 + 2; s < w.spr.width / 2; s += 4) pl.block.push(Math.round(x + s), Math.round(y), 3);
    }
    for (let k = 0; k < 2 + ((rng() * 3) | 0); k++) put(take(rng() < 0.6 ? PROPS.barrel : PROPS.crate), cx + (rng() - 0.5) * 44, cy + (rng() - 0.5) * 30);
    if (rng() < 0.6) put(take(PROPS.dead), cx + (rng() - 0.5) * 60, cy - 20 - rng() * 10);
    if (rng() < 0.5) pl.fires.push({ x: Math.round(cx), y: Math.round(cy), seed: (rng() * 1000) | 0, big: false });
  }
  // bushes, rocks, stumps
  for (let k = 0; k < 3; k++) if (rng() < 0.5) {
    const x = X0 + rng() * CH, y = Y0 + rng() * CH;
    if (roadDist(x, y) > 10 && fieldAt(x, y) < 0.62 && !nearRail(x, y, 24)) put(take(PROPS.bush), x, y);
  }
  if (rng() < 0.25) { const x = X0 + rng() * CH, y = Y0 + rng() * CH; if (roadDist(x, y) > 12 && !nearRail(x, y, 28)) put(take(PROPS.big), x, y); }
  for (let k = 0; k < 8; k++) {
    const x = X0 + rng() * CH, y = Y0 + rng() * CH;
    if (roadDist(x, y) < 7 || nearRail(x, y, 17)) continue;
    pl.flats.push({ d: rng() < 0.1 ? PROPS.stump[0] : take(PROPS.rock), x: Math.round(x), y: Math.round(y) });
  }
  // telegraph poles beside the railway, one every 72 px
  for (let y = Math.ceil(Y0 / 72) * 72; y < Y0 + CH; y += 72) {
    const px = trackX(y) + 27;
    if (px >= X0 && px < X0 + CH) put(PROPS.pole[0], px, y);
  }
  // grass tufts (they sway, so they are drawn live)
  for (let k = 0; k < 40 && pl.tufts.length < 16; k++) {
    const x = X0 + ((rng() * CH) | 0), y = Y0 + ((rng() * CH) | 0);
    if (vnoise(x / 16, y / 16, 31) < 0.5 && rng() < 0.8) continue;
    if (roadDist(x, y) < 9 || fieldAt(x, y) > 0.62 || nearRail(x, y, 17)) continue;
    pl.tufts.push({ x, y, h: 2 + ((rng() * 3) | 0), c: rng() < 0.5 ? '#5c6a3d' : '#4a5732', p: rng() * TAU });
  }
  pl.props.sort((a, b) => a.y - b.y);
  if (PLANS.size > 4000) PLANS.clear();
  PLANS.set(key, pl);
  return pl;
}

/* ------------------------------------------------------------------ ground */
const GROUND = new Map();
const PIX = [0, 0, 0];
function bakeChunk(ci, cj) {
  const [c, g] = mk(CH, CH);
  const X0 = ci * CH, Y0 = cj * CH;
  const im = g.createImageData(CH, CH), d = im.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    groundPix(X0 + x, Y0 + y, PIX);
    const i = (y * CH + x) * 4;
    d[i] = PIX[0]; d[i + 1] = PIX[1]; d[i + 2] = PIX[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const rng = mulberry(hash32(Math.imul(ci, 2654435761) ^ Math.imul(cj, 40503) ^ 0xb4e));
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // grass specks in clusters, pebbles on bare earth, a few pale flowers
  for (let k = 0; k < 160; k++) {
    const x = (rng() * CH) | 0, y = (rng() * CH) | 0;
    if (vnoise((X0 + x) / 16, (Y0 + y) / 16, 31) < 0.52) continue;
    r(x, y, 1, rng() < 0.5 ? 2 : 1, rng() < 0.6 ? '#56613a' : '#1c2519');
  }
  for (let k = 0; k < 40; k++) {
    const x = (rng() * CH) | 0, y = (rng() * CH) | 0;
    if (vnoise((X0 + x) / 40, (Y0 + y) / 40, 34) < 0.6 && roadDist(X0 + x, Y0 + y) > 8 || nearRail(X0 + x, Y0 + y, 14)) continue;
    r(x, y, 1, 1, '#6d6a62'); r(x, y + 1, 1, 1, '#1d1b18');
  }
  for (let k = 0; k < 10; k++) {
    const x = (rng() * CH) | 0, y = (rng() * CH) | 0;
    if (vnoise((X0 + x) / 16, (Y0 + y) / 16, 31) < 0.6 || fieldAt(X0 + x, Y0 + y) > 0.62) continue;
    r(x, y, 1, 1, rng() < 0.5 ? '#a99b6e' : '#8f6f7a');
  }
  // cast shadows of everything standing here or nearby, and the flat things themselves
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const pn = plan(ci + di, cj + dj);
    g.globalAlpha = 0.42;
    for (const p of pn.props) g.drawImage(p.d.sh, p.x - p.d.ax - X0, p.y - 1 - Y0);
    for (const f of pn.flats) g.drawImage(f.d.sh, f.x - f.d.ax - X0, f.y - 1 - Y0);
    g.globalAlpha = 1;
    for (const f of pn.flats) g.drawImage(f.d.spr, f.x - f.d.ax - X0, f.y - f.d.ay - Y0);
  }
  return c;
}
// Chunks waiting to be baked: a few per frame, the ones in view first.
function groundChunk(ci, cj, now) {
  const key = ckey(ci, cj);
  let c = GROUND.get(key);
  if (!c && now) { c = bakeChunk(ci, cj); GROUND.set(key, c); }
  return c;
}
function bakeSome(cx0, cy0, cx1, cy1, budget) {
  for (let cj = cy0 - 1; cj <= cy1 + 1 && budget > 0; cj++) for (let ci = cx0 - 1; ci <= cx1 + 1 && budget > 0; ci++) {
    if (!GROUND.has(ckey(ci, cj))) { GROUND.set(ckey(ci, cj), bakeChunk(ci, cj)); budget--; }
  }
  // forget chunks far away
  if (GROUND.size > 160) for (const k of GROUND.keys()) {
    const ci = Math.round(k / 100003), cj = k - ci * 100003;
    if (ci < cx0 - 5 || ci > cx1 + 5 || cj < cy0 - 5 || cj > cy1 + 5) GROUND.delete(k);
  }
}

/* ------------------------------------------------------------------ decals */
const DECALS = new Map();
function decalChunk(ci, cj) {
  const key = ckey(ci, cj);
  let d = DECALS.get(key);
  if (!d) { const [c, g] = mk(CH, CH); d = { c, g, ci, cj }; DECALS.set(key, d); }
  return d;
}
// Paint one pixel (or an s x s square) of color c onto the ground.
function stampPix(x, y, c, s) {
  x = Math.round(x); y = Math.round(y);
  const ci = Math.floor(x / CH), cj = Math.floor(y / CH), d = decalChunk(ci, cj);
  d.g.globalAlpha = 0.85;
  d.g.fillStyle = c;
  d.g.fillRect(x - ci * CH, y - cj * CH, s || 1, s || 1);
  d.g.globalAlpha = 1;
}
// Paint a sprite onto the ground, top left at (x, y), in every chunk it touches.
function stampSpr(spr, x, y, a) {
  x = Math.round(x); y = Math.round(y);
  const ci0 = Math.floor(x / CH), ci1 = Math.floor((x + spr.width - 1) / CH), cj0 = Math.floor(y / CH), cj1 = Math.floor((y + spr.height - 1) / CH);
  for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
    const d = decalChunk(ci, cj);
    d.g.globalAlpha = a == null ? 0.85 : a;
    d.g.drawImage(spr, x - ci * CH, y - cj * CH);
    d.g.globalAlpha = 1;
  }
}
// Every few seconds the marks fade a little; chunks far from the view are dropped.
function fadeDecals(cx0, cy0, cx1, cy1) {
  for (const [k, d] of DECALS) {
    if (d.ci < cx0 - 4 || d.ci > cx1 + 4 || d.cj < cy0 - 4 || d.cj > cy1 + 4) { DECALS.delete(k); continue; }
    d.g.globalCompositeOperation = 'destination-out';
    d.g.fillStyle = 'rgba(0,0,0,0.05)';
    d.g.fillRect(0, 0, CH, CH);
    d.g.globalCompositeOperation = 'source-over';
  }
}
function clearDecals() { DECALS.clear(); }

// Solid things near (x, y) the dead walk round: flat triples x, y, radius.
function blockersNear(x, y, out) {
  out.length = 0;
  const i0 = Math.floor((x - 16) / CH), i1 = Math.floor((x + 16) / CH), j0 = Math.floor((y - 16) / CH), j1 = Math.floor((y + 16) / CH);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const b = plan(i, j).block;
    for (let k = 0; k < b.length; k += 3) if (Math.abs(b[k] - x) < 16 && Math.abs(b[k + 1] - y) < 16) out.push(b[k], b[k + 1], b[k + 2]);
  }
  return out;
}
