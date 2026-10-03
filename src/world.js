// world.js - the countryside the railway runs through, built in 128 px chunks as the camera moves.
// Every chunk has a plan (what stands there: trees, hay, wrecks, poles and fires, from a seed made
// of its coordinates, so the same place always holds the same things; see landPlan in land.js) and
// a baked ground image (paintLand in land.js, then the cast shadows of everything standing on it).
// Decals (blood, bodies, scorch, craters) are painted onto a second image per chunk and slowly fade.

const CH = 128;
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
// farm tracks: a warped grid, about 1400 x 1000 px
function roadDist(x, y) {
  const wx = x + 60 * Math.sin(y * 0.004) + 25 * Math.sin(y * 0.011 + 1.3);
  const wy = y + 50 * Math.sin(x * 0.0035 + 0.7) + 20 * Math.sin(x * 0.009 + 2.1);
  return Math.min(Math.abs(mod(wx, 1400) - 700), Math.abs(mod(wy, 1000) - 500));
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
  pl = { props: [], flats: [], tufts: [], fires: [], block: [] };
  const take = (list) => list[(rng() * list.length) | 0];
  const put = (def, x, y, o) => {
    // (nothing stands on a station's ground or the Depot's)
    if (stationZone(x, y) || depotZone(x, y)) return null;
    const p = Object.assign({ d: def, x: Math.round(x), y: Math.round(y) }, o || {});
    p.k = p.y;
    pl.props.push(p);
    if (def.block) pl.block.push(p.x, p.y, def.block);
    return p;
  };
  landPlan(pl, ci, cj, rng, put, take);
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
  paintLand(g, ci, cj);
  // soft shade under each tree's crown, then the cast shadows of everything standing here or
  // nearby (in the colour of shade on grass), and the flat things themselves
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const pn = plan(ci + di, cj + dj);
    g.globalAlpha = 0.22;
    for (const p of pn.props) if (p.d.tree) { const s = softShadow(p.d.spr.width); g.drawImage(s, p.x - (s.width >> 1) - X0 + 3, p.y - (s.height >> 1) - Y0 + 1); }
    g.globalAlpha = 0.3;
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

/* ------------------------------------------------------------------ ground details */
// A soft round shade w px across (a darker middle, a lighter rim), for under the trees.
const SOFT = new Map();
function softShadow(w) {
  w = Math.max(6, Math.round(w * 0.9));
  let c = SOFT.get(w);
  if (!c) {
    const h = Math.max(3, Math.round(w * 0.5));
    c = pix(w, h, (r) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1);
        if (d < 1) r(x, y, 1, 1, d < 0.72 ? '#000' : 'rgba(0,0,0,0.5)');
      }
    });
    SOFT.set(w, c);
  }
  return c;
}
