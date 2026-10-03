// scenery.js - more of the world: the sprites of broken fences, railway signs, relay boxes, hay
// bales and tyres (land.js places some of them); the wires that sag between the telegraph poles (with their shadows); crows that sit in the fields
// and fly up when the train, a blast or a shot comes near; and what makes the stations and the Depot
// real places: a water tower, a name board, fences, sandbag walls, lamps, benches, crates and, at
// the Depot, an engine shed, a fuel tank and a coal heap.
// Hooks: initScenery (initSprites), dressStop (buildStop), updateScenery (step),
// drawGroundLife (render, over the ground), drawSky (render, over everything in the world).

// SCN = the sprites only stations and the Depot use
const SCN = {};
// ---------- sprites
// A wooden fence n posts long; broken = a rail missing and a post leaning.
function fenceSpr(n, rng, broken) {
  const w = n * 5 - 4;
  return pix(w + 1, 8, (r) => {
    const gap = broken ? 1 + ((rng() * (n - 2)) | 0) : -1;
    for (let k = 0; k < n - 1; k++) {
      if (k === gap) { r(k * 5 + 1, 3, 2, 1, '#6b5038'); continue; }
      r(k * 5, 2, 5, 1, '#8a6a44'); r(k * 5, 5, 5, 1, '#6b5038'); r(k * 5, 3, 5, 1, '#3a2718');
    }
    for (let k = 0; k < n; k++) {
      const lean = broken && k === gap + 1 ? 1 : 0;
      r(k * 5 + lean, 1, 1, 7, '#5b4632'); r(k * 5 + lean, 0, 1, 1, '#a38558'); r(k * 5 + lean, 1, 1, 1, '#8a6a44');
    }
  });
}
// A white picket fence n pickets long (stations).
function picketSpr(n) {
  return pix(n * 2, 8, (r) => {
    r(0, 3, n * 2, 1, '#a8a290'); r(0, 6, n * 2, 1, '#8a8472');
    for (let k = 0; k < n; k++) { r(k * 2, 1, 1, 7, '#d6cdb6'); r(k * 2, 0, 1, 1, '#f0e6cc'); r(k * 2, 7, 1, 1, '#6a6458'); }
  });
}
// Railway signs: 0 a whistle board (W), 1 a km post, 2 a crossing sign (a white X on a post),
// 3 a yellow speed board.
function signSpr(k) {
  if (k === 0) return pix(5, 12, (r) => { r(2, 5, 1, 7, '#5d636e'); r(0, 0, 5, 5, '#e8e2cc'); r(0, 4, 5, 1, '#8a8472'); r(1, 1, 1, 3, '#14100c'); r(3, 1, 1, 3, '#14100c'); r(2, 2, 1, 1, '#14100c'); });
  if (k === 1) return pix(3, 9, (r) => { r(0, 0, 3, 9, '#d6cdb6'); r(0, 0, 1, 9, '#f0e6cc'); r(0, 2, 3, 2, '#14100c'); r(2, 0, 1, 9, '#8a8472'); r(0, 8, 3, 1, '#4a4038'); });
  if (k === 2) return pix(9, 16, (r, g) => {
    r(4, 4, 1, 12, '#5d636e'); r(4, 4, 1, 12, '#8b919c'); r(3, 15, 3, 1, '#2a2d33');
    pl(g, 0, 0, 8, 6, '#e8e2cc'); pl(g, 0, 6, 8, 0, '#e8e2cc'); pl(g, 1, 0, 8, 5, '#c8432e'); pl(g, 1, 6, 8, 1, '#c8432e');
    r(3, 9, 3, 2, '#c8432e'); r(4, 9, 1, 2, '#ff6a50');
  });
  return pix(5, 12, (r) => { r(2, 5, 1, 7, '#5d636e'); r(0, 0, 5, 5, '#e3b04b'); r(0, 0, 5, 1, '#f6dc8e'); r(1, 1, 3, 1, '#14100c'); r(1, 3, 3, 1, '#14100c'); r(0, 4, 5, 1, '#8a6420'); });
}
// A grey relay box beside the rails.
function cabSpr() {
  return pix(7, 9, (r) => {
    r(0, 2, 7, 7, '#5d636e'); r(0, 2, 2, 7, '#7d838c'); r(6, 2, 1, 7, '#3a3e48'); r(0, 0, 7, 3, '#8b919c'); r(0, 0, 7, 1, '#b4b9c1');
    r(3, 4, 1, 3, '#2a2d33'); r(2, 8, 4, 1, '#2a2d33'); r(1, 6, 1, 2, '#6a3a1e');
  });
}
// A round hay bale, lit on its top left.
function baleSpr() {
  return pix(9, 8, (r) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) {
      const dx = (x - 4) / 4.5, dy = (y - 3.6) / 4;
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.6 - dy * 0.8 + (hrnd(x, y, 61) - 0.5) * 0.5;
      r(x, y, 1, 1, l > 0.55 ? '#d8b868' : l > 0 ? '#b49446' : l > -0.5 ? '#8a6e32' : '#5e4a22');
    }
    r(2, 1, 1, 6, '#6e5426'); r(6, 1, 1, 6, '#6e5426');
  });
}
// A pile of old tyres.
function tyreSpr() {
  return pix(9, 7, (r) => {
    for (const [x, y] of [[0, 3], [4, 3], [2, 0]]) { r(x, y, 5, 4, '#16171a'); r(x + 1, y, 3, 1, '#3a3c42'); r(x + 2, y + 1, 1, 2, '#07080a'); r(x, y + 1, 1, 2, '#2a2c32'); }
  });
}
// The water tower: a wooden tank with iron bands on four legs, a cone roof and a spout.
function waterTowerSpr() {
  return pix(20, 40, (r, g) => {
    for (const x of [3, 15]) { r(x, 18, 2, 22, '#3a2718'); r(x, 18, 1, 22, '#5b3f27'); }
    r(8, 20, 2, 20, '#2a1d13'); r(8, 20, 1, 20, '#4a3220');
    pl(g, 4, 22, 15, 36, '#2a1d13'); pl(g, 15, 22, 4, 36, '#3a2718'); r(3, 29, 14, 1, '#4a3220');
    r(2, 8, 16, 11, '#6e4a2c'); r(2, 8, 3, 11, '#8a6040'); r(15, 8, 3, 11, '#4a3220');
    for (let x = 4; x < 18; x += 3) r(x, 8, 1, 11, '#5b3f27');
    for (const y of [10, 15]) { r(2, y, 16, 1, '#2a2d33'); r(2, y, 4, 1, '#5d636e'); }
    r(2, 18, 16, 1, '#2a1d13');
    r(1, 6, 18, 2, '#3a3e48'); r(3, 4, 14, 2, '#4b5263'); r(5, 2, 10, 2, '#5d636e'); r(8, 0, 4, 2, '#7d838c'); r(5, 2, 3, 1, '#8b919c'); r(1, 6, 5, 1, '#626875');
    r(17, 12, 3, 1, '#2a2d33'); r(19, 12, 1, 4, '#2a2d33'); r(19, 16, 1, 1, '#5d636e');
  });
}
// A name board on two posts (the letters are dashes too small to read, the name floats above).
function boardSpr(col) {
  return pix(22, 12, (r) => {
    r(2, 6, 1, 6, '#3a3e48'); r(19, 6, 1, 6, '#3a3e48');
    r(0, 0, 22, 7, '#e8e2cc'); r(1, 1, 20, 5, col); r(1, 1, 20, 1, '#ffffff22');
    for (let x = 3; x < 19; x += 2) if (x !== 11) r(x, 3, 1, 1, '#e8e2cc');
    r(0, 6, 22, 1, '#6a6458');
  });
}
// A low wall of sandbags, n bags long.
function bagWallSpr(n) {
  return pix(n * 4 + 2, 7, (r) => {
    for (let row = 0; row < 2; row++) for (let k = 0; k < n + (row ? 0 : 0); k++) {
      const x = k * 4 + (row ? 2 : 0), y = row ? 0 : 3;
      if (row && k === n - 1) continue;
      r(x, y, 4, 4, '#8a7a56'); r(x, y, 4, 1, '#c4b088'); r(x, y, 1, 3, '#a8946a'); r(x + 3, y + 1, 1, 3, '#5e5238'); r(x, y + 3, 4, 1, '#4a3f2c');
    }
  });
}
// A bench on the platform.
function benchSpr() {
  return pix(10, 5, (r) => { r(0, 0, 10, 2, '#7b5735'); r(0, 0, 10, 1, '#a38558'); r(1, 2, 1, 3, '#2a1d13'); r(8, 2, 1, 3, '#2a1d13'); r(0, 2, 10, 1, '#4a3220'); });
}
// The Depot's engine shed: a long brick building with a big dark door, a tin roof and a skylight.
function shedSpr() {
  return pix(46, 34, (r) => {
    r(0, 0, 46, 15, '#3e4652'); r(0, 0, 46, 1, '#7d8a98'); r(0, 0, 2, 15, '#5d6876');
    for (let x = 3; x < 46; x += 4) r(x, 1, 1, 14, '#323944');
    r(16, 2, 14, 4, '#9fb8c8'); r(16, 2, 14, 1, '#d0e0e8'); r(22, 2, 1, 4, '#3e4652');
    r(9, 10, 3, 2, '#6a3a1e'); r(33, 6, 4, 2, '#6a3a1e');
    r(0, 15, 46, 19, '#6a3226');
    for (let y = 16; y < 34; y += 3) for (let x = (y % 2) * 3; x < 46; x += 6) r(x, y, 1, 2, '#4a2018');
    r(0, 15, 46, 1, '#2a1410'); r(0, 15, 1, 19, '#8a4a36');
    r(13, 19, 20, 15, '#14100c'); r(13, 19, 20, 1, '#3a2a22'); r(14, 20, 1, 14, '#2a1d13'); r(31, 20, 1, 14, '#2a1d13');
    r(15, 29, 16, 5, '#1c1612');
    r(4, 20, 5, 5, '#ffcf6a'); r(4, 20, 5, 1, '#fff1c2'); r(6, 20, 1, 5, '#6a3226');
    r(37, 20, 5, 5, '#2a3040'); r(37, 20, 5, 1, '#4a5468');
    r(0, 33, 46, 1, '#2a1410');
  });
}
// The Depot's fuel tank on legs.
function fuelSpr() {
  return pix(16, 18, (r) => {
    r(2, 10, 1, 8, '#2a2d33'); r(13, 10, 1, 8, '#2a2d33');
    for (let y = 0; y < 12; y++) { const w = y < 2 || y > 9 ? 6 : 8; r(8 - w, y, w * 2, 1, y < 4 ? '#a3a9b2' : y < 8 ? '#7d838c' : '#4b5263'); }
    r(1, 2, 2, 8, '#c4c8ce'); r(3, 5, 10, 2, '#9a3326'); r(6, 0, 3, 1, '#e8e2cc');
  });
}
// A heap of coal.
function coalSpr() {
  return pix(14, 7, (r) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 14; x++) {
      const dx = (x - 6.5) / 7, dy = (y - 6.5) / 7;
      if (dx * dx + dy * dy > 1) continue;
      const v = hrnd(x, y, 71);
      r(x, y, 1, 1, v < 0.15 ? '#5a5e66' : v < 0.5 ? '#1c1e23' : '#101114');
    }
  });
}

function initScenery() {
  const rng = mulberry(909);
  PROPS.fence = [];
  for (let k = 0; k < 6; k++) PROPS.fence.push(prop(fenceSpr(3 + ((rng() * 3) | 0), rng, k > 2), 0));
  PROPS.sign = [0, 1, 2, 3].map((k) => prop(signSpr(k), 0));
  PROPS.misc = [prop(cabSpr(), 3), prop(baleSpr(), 4), prop(baleSpr(), 4), prop(tyreSpr(), 3)];
  SCN.tower = prop(waterTowerSpr(), 6);
  SCN.board = prop(boardSpr('#2c4a6a'), 0);
  SCN.boardD = prop(boardSpr('#6a4a14'), 0);
  SCN.picket = prop(picketSpr(8), 0);
  SCN.bags = prop(bagWallSpr(4), 0);
  SCN.bench = prop(benchSpr(), 0);
  SCN.shed = prop(shedSpr(), 14);
  SCN.fuel = prop(fuelSpr(), 6);
  SCN.coal = prop(coalSpr(), 4);
  // the blast's marks, made now and not in the middle of the first blast
  blastRays();
  for (let r = 2; r <= 8; r++) poolSpr(r);
}

// ---------- stations and the Depot
// Dress stop st (side 1 = the house east of the rails): a water tower and a name board north of
// the platform, sandbag walls and a lamp past each end of it, picket fences, a bench on it, crates
// and a barrel by the house. The Depot gets an engine shed, a fuel tank, coal, tyres and more lamps
// and sandbags. All of it stands off the grid's free tiles, and casts a shadow (cast).
function dressStop(st) {
  const side = st.side, col = (c) => 6.5 + side * (c - 6.5), at = (c, r) => gridToWorld(col(c), r, st.s);
  const add = (d, c, r, o) => {
    const p = at(c, r), x = Math.round(p.x), y = Math.round(p.y);
    G.statics.push(Object.assign({ d, x, y, k: y, cast: true }, o || {}));
  };
  const depot = st.def === DEPOT;
  add(SCN.tower, 9.8, -2.3);
  add(depot ? SCN.boardD : SCN.board, 10.6, -0.8);
  add(SCN.bench, 8, 2.9, { k: Math.round(at(8, 2.9).y) + 1 });
  // a barrel and crates against the house
  add(PROPS.barrel[0], 12.9, 3.3);
  add(PROPS.crate[0], 10.9, 3.25);
  // picket fences past the ends, sandbags and a lamp at each end of the platform
  for (const r of [-0.7, 8.7]) add(SCN.picket, 12.4, r);
  for (const r of [-1.3, 9.3]) add(SCN.bags, 8.1, r);
  for (const r of [-2.4, 10.4]) add(STATION.lamp, 8.3, r, { lamp: true });
  if (!depot) return;
  // the Depot: an engine shed across the rails, a fuel tank, coal, crates, more lamps and sandbags
  add(SCN.shed, 3.2, 1.2);
  add(SCN.fuel, 11.8, 7.2);
  add(SCN.coal, 10.4, 7.8);
  add(PROPS.crate[0], 12.4, 1.2);
  add(PROPS.crate[0], 12.9, 1.5);
  add(PROPS.misc[3], 2.6, 6.8);
  add(PROPS.barrel[1], 3.6, 7.4);
  for (const r of [3, 5.8]) add(STATION.lamp, 4.8, r, { lamp: true });
  for (let r = -1; r <= 9; r += 2.2) add(SCN.bags, 0.6, r);
}
// true when (x, y) is on the Depot's ground (no telegraph poles there; stations have stationZone)
function depotZone(x, y) {
  trackLocal(x, y, SZ);
  return Math.abs(SZ.a - DEPOT_S - STOP_OFF) < 130 && Math.abs(SZ.u) < 150;
}
// Where each stop's yard is: [s of its house, side] for the Depot and every station.
function yards() {
  return [[DEPOT_S + STOP_OFF, 1], [DEPOT_S + STOP_OFF, -1], ...STATIONS.map((d) => [sAtKm(d.km), d.side])];
}

// ---------- the wires between the telegraph poles
const POLE_GAP = 72, POLE_U = 27, WIRE_Z = 20;
// SPANS: each span of wire (by the y of its north pole) drawn once: {x, y, w = the two wires,
// s = their shadow on the ground}, or null where a pole is missing (stations, the Depot).
const SPANS = new Map();
function span(y) {
  let s = SPANS.get(y);
  if (s !== undefined) return s;
  if (SPANS.size > 200) SPANS.clear();
  const ya = y + POLE_GAP, xa = Math.round(trackX(ya) + POLE_U), xb = Math.round(trackX(y) + POLE_U);
  s = null;
  if (!(stationZone(xa, ya) || stationZone(xb, y) || depotZone(xa, ya) || depotZone(xb, y))) {
    const ox = Math.round(WIRE_Z * SUNX), oy = Math.round(WIRE_Z * SUNY), x0 = Math.min(xa, xb) - 4, y0 = y - WIRE_Z - 2;
    const w = Math.max(xa, xb) + 6 + ox - x0, h = POLE_GAP + WIRE_Z + oy + 4;
    const [wc, wg] = mk(w, h), [sc, sg] = mk(w, h);
    wireLine(wg, xa - 2 - x0, ya - y0, xb - 2 - x0, y - y0, WIRE_Z, 4, '#16171a');
    wireLine(wg, xa + 2 - x0, ya - y0, xb + 2 - x0, y - y0, WIRE_Z, 5, '#16171a');
    pl(sg, xa + ox - 2 - x0, ya + oy - y0, xb + ox - 2 - x0, y + oy - y0, '#000');
    pl(sg, xa + ox + 2 - x0, ya + oy - y0, xb + ox + 2 - x0, y + oy - y0, '#000');
    s = { x: x0, y: y0, w: wc, s: sc };
  }
  SPANS.set(y, s);
  return s;
}
// Call fn(span) for each span of wire in view.
function eachSpan(fn) {
  const y0 = Math.floor((G.camY - 40) / POLE_GAP) * POLE_GAP, y1 = G.camY + H + 80;
  for (let y = y0; y < y1; y += POLE_GAP) {
    const s = span(y);
    if (s) fn(s);
  }
}
// A wire sagging from pole to pole on context g (oz = the height, sag in px).
function wireLine(g, x0, y0, x1, y1, oz, sag, col) {
  const n = 10;
  let px = x0, py = y0 - oz;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t) - oz + Math.sin(t * Math.PI) * sag;
    pl(g, px, py, x, y, col);
    px = x;
    py = y;
  }
}

// ---------- the couplings between the cars
// Car i's front is hooked to the back of the car ahead: a short dark bar with a lit top, at the
// height of the frames (drawn just before car i, so it sits under it and over the car ahead).
function drawCoupler(i) {
  const a = G.tr.cars[i - 1], b = G.tr.cars[i];
  ctx.globalAlpha = 1;
  if (!(Math.abs(a.x1 - b.x0) < 20 && Math.abs(a.y1 - b.y0) < 20)) return;
  pl(ctx, a.x1, a.y1 - 3, b.x0, b.y0 - 3, thermal ? '#3a3a3a' : '#16181c');
  pl(ctx, a.x1, a.y1 - 4, b.x0, b.y0 - 4, thermal ? '#6a6a6a' : '#4b4f5a');
}

// ---------- crows
// BIRDS: crows. sit = on the ground (pecking), else flying away (vx, vy, vz) with flapping wings.
const BIRDS = [];
let birdG = null, birdCd = 0;
function addFlock(x, y) {
  const n = rndi(3, 5);
  for (let i = 0; i < n; i++) BIRDS.push({ x: x + rnd(-12, 12), y: y + rnd(-8, 8), z: 0, vx: 0, vy: 0, vz: 0, sit: true, peck: rnd(3), left: Math.random() < 0.5, f: rnd(2), wait: rnd(0, 0.25) });
}
// Everything within r of (x, y) takes off, away from it.
function scareBirds(x, y, r) {
  for (const b of BIRDS) {
    if (!b.sit || Math.hypot(b.x - x, (b.y - y) / FORE) > r) continue;
    b.sit = false;
    const dx = b.x - x, dy = b.y - y, l = Math.hypot(dx, dy) || 1, s = rnd(40, 60);
    b.vx = dx / l * s + rnd(-12, 12);
    b.vy = dy / l * s * 0.7 - rnd(10, 25);
    b.vz = rnd(28, 40);
    b.left = b.vx < 0;
  }
}
function updateScenery(dt) {
  if (birdG !== G) {
    birdG = G;
    BIRDS.length = 0;
    birdCd = 0;
    // a flock or two in the fields at the start
    for (let k = 0; k < 2; k++) {
      const x = G.camX + rnd(40, W - 40), y = G.camY + rnd(30, H - 40);
      if (!nearRail(x, y, 50)) addFlock(x, y);
    }
  }
  // new flocks land in the fields ahead (just over the top of the view)
  birdCd -= dt;
  if (birdCd <= 0) {
    birdCd = rnd(5, 9);
    if (BIRDS.length < 16) {
      const x = G.camX + rnd(20, W - 20), y = G.camY - rnd(8, 30);
      if (!nearRail(x, y, 50) && !stationZone(x, y)) addFlock(x, y);
    }
  }
  const tr = G.tr, c = tr.cars[0];
  for (let i = BIRDS.length - 1; i >= 0; i--) {
    const b = BIRDS[i];
    if (b.sit) {
      b.peck += dt;
      // the train coming, or the dead walking through them
      if (Math.abs(b.x - trackX(b.y)) < 46 && Math.abs(b.y - c.y0) < 70) scareBirds(c.x0, c.y0, 90);
      if (b.y > G.camY + H + 40 || b.y < G.camY - 300) BIRDS.splice(i, 1);
      continue;
    }
    if (b.wait > 0) { b.wait -= dt; continue; }
    b.f += dt * 11;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z = Math.min(60, b.z + b.vz * dt);
    b.vz = Math.max(4, b.vz - dt * 12);
    if (offView(b.x, b.y - b.z, 60)) BIRDS.splice(i, 1);
  }
  // a crowd of the dead walking into a flock scares it too (one zombie checked a step)
  const zs = G.zombies;
  if (zs.length && BIRDS.length) {
    const z = zs[(Math.random() * zs.length) | 0];
    if (!z.dead) for (const b of BIRDS) if (b.sit && Math.abs(b.x - z.x) < 14 && Math.abs(b.y - z.y) < 10) { scareBirds(z.x, z.y, 40); break; }
  }
}

// ---------- drawing
// On the ground: the wires' shadows and the crows sitting (they peck and turn now and then).
function drawGroundLife() {
  if (thermal) return;
  ctx.globalAlpha = 0.3;
  for (const p of G.statics) {
    if (!p.cast && p.d !== STATION.house && p.d !== STATION.lamp || Math.abs(p.y - G.camY - H / 2) > H) continue;
    blit(p.d.sh, p.x - p.d.ax, p.y - 1);
  }
  ctx.globalAlpha = 0.07;
  eachSpan((s) => ctx.drawImage(s.s, s.x, s.y));
  ctx.globalAlpha = 1;
  for (const b of BIRDS) {
    if (!b.sit) continue;
    const x = Math.round(b.x), y = Math.round(b.y), dn = (b.peck * 2.3 + b.x) % 3 < 0.5 ? 1 : 0, d = b.left ? -1 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - 1, y, 4, 1);
    ctx.fillStyle = '#121214';
    ctx.fillRect(x - 1, y - 2, 3, 2);
    ctx.fillRect(x + d * 2, y - 3 + dn, 1, 1);
    ctx.fillStyle = '#34363e';
    ctx.fillRect(x - 1, y - 2, 1, 1);
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(x + d * 3, y - 3 + dn + (dn ? 1 : 0), 1, 1);
  }
}
// Up in the air: the wires from pole to pole, the crows flying (and their shadows), the flash.
function drawSky() {
  ctx.globalAlpha = thermal ? 0.4 : 0.5;
  eachSpan((s) => ctx.drawImage(s.w, s.x, s.y));
  ctx.globalAlpha = 1;
  for (const b of BIRDS) {
    if (b.sit || b.wait > 0) continue;
    const x = Math.round(b.x), y = Math.round(b.y - b.z), up = (b.f | 0) & 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(Math.round(b.x + b.z * SUNX) - 1, Math.round(b.y + b.z * SUNY), 3, 1);
    ctx.fillStyle = thermal ? '#bbbbbb' : '#101012';
    ctx.fillRect(x - 1, y, 3, 1);
    if (up) { ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillRect(x - 3, y - 2, 1, 1); ctx.fillRect(x + 3, y - 2, 1, 1); }
    else { ctx.fillRect(x - 2, y + 1, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); ctx.fillRect(x - 3, y + 1, 1, 1); ctx.fillRect(x + 3, y + 1, 1, 1); }
  }
}
