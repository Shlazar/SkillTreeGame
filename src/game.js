// game.js - the game: escort the last train, trip after trip. You fly a gunship helicopter (WASD)
// over a railway that winds north. The train runs along it to a walled safe zone, stopping halfway
// at a station to take on survivors who run for it. The dead walk in from both sides; the ones ahead
// of the train step onto the rails. The engine runs them down, but each one slows it, and the dead
// that reach the train climb on and tear at it. When no key is held the helicopter keeps pace with
// the train. Every run's cash is banked for upgrades (meta.js); G.k holds the upgraded stats and
// G.ti the numbers of this trip. Behind the title the same game runs as a demo.
// Units are world pixels and seconds; y on the ground is squashed by FORE; the train runs to -y.

const CFG = {
  trip: 2000,                  // px along the rails from the start to the safe zone (the station is halfway)
  // the train: top speed (px/s), how fast it gets back up to speed, how hard it brakes, its health
  train: { cruise: 26, accel: 7, brake: 10, hp: 150 },
  // the helicopter: top speed against the train, how fast it gets there, how far from the engine it
  // may fly, its height (where its shadow falls)
  heli: { speed: 170, accel: 3.2, leash: 470, alt: 100 },
  lock: 16,                    // px round the sight that a zombie is locked within
  // 25mm: rounds per second, flight time, spread without a lock, burst radius, most zombies one
  // round can hit, heat per round, cooling per second
  mg: { rate: 12, travel: 0.45, spread: 5, splash: 7, victims: 4, heatPer: 0.025, cool: 0.55 },
  // 105mm: reload, flight time, kill radius, hurt radius (a hurt walker dies too, a brute may not),
  // and how close to the train a blast hurts the train too
  he: { reload: 2.4, travel: 1.1, kill: 34, hurt: 56, close: 28 },
  // the horde: zombies at the start, more each second, the most at once
  pop: { start: 110, perSec: 3.5, max: 400 },
  // the station: survivors waiting, seconds between two setting off, their speed, the shortest stop,
  // how long a zombie holds a survivor before it is too late, how near the door the dead keep the
  // survivors in (and for how long, at most)
  station: { people: 8, gap: 1.1, run: 24, minStop: 12, grab: 1.4, clear: 34, wait: 8 },
  // dps = damage to the train each second while it holds on
  types: [
    { hp: 1, speed: [11, 16], value: 1, dps: 0.5 },                // walker
    { hp: 1, speed: [32, 40], value: 2, dps: 0.5, run: true },     // runner
    { hp: 8, speed: [8, 10], value: 10, dps: 2, big: true }        // brute
  ]
};
// the cars: length on the ground, the gap between two, half the width, how many (TRAIN in sprites)
const CAR = { L: 28, gap: 4, half: 8, n: 5 };
const TRAIN_LEN = CAR.n * (CAR.L + CAR.gap) - CAR.gap;
const CAMS = ['COLOUR', 'WHITE HOT', 'BLACK HOT'];

// G = this run (or the demo behind the title). mode = 'title', 'play', 'ending' or 'summary'.
// thermal = camera: 0 colour, 1 white hot, 2 black hot.
let G = null, mode = 'title', paused = false, realT = 0, frameDt = 0, sumStart = 0, thermal = 0;

// ---------- a run
// G.cash = cash earned this run (G.banked of it already in the bank), G.earn = where it came from.
function newGame(demo, trip) {
  const y0 = Math.round(rnd(-40000, 40000)), s0 = trackS(y0), T = demo ? 1 : trip || META.trip;
  const k = demo ? baseStats() : runStats();
  const cars = [];
  for (let k = 0; k < CAR.n; k++) cars.push({ x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, dx: 0, dy: -1, nx: 1, ny: 0, ang: 0, k: 0 });
  G = {
    demo: !!demo, t: 0, run: 0, endT: 0, result: '', bonus: 0, trip: T, ti: tripInfo(T), k, mult: demo ? 1 : cashMult(T),
    kills: 0, cash: 0, banked: 0, shownCash: META.cash, cashPulse: 0, killBump: 0, shots: 0, hits: 0, bestBlast: 0,
    earn: { kills: 0, bonus: 0, finds: 0, station: 0, boss: 0, arrival: 0, first: 0 },
    afford: 0, readyT: 0,
    trigger: false, mgCd: 0, heat: 0, overheat: false, heReload: 0, heQueue: false, hitT: 0, muzzle: [0, 0],
    // the train: s = distance along the rails of the engine's nose (it falls as the train runs north),
    // v = speed, hit[k] = car k flashes red, fx / fy = the nose on the ground
    tr: { s: s0, startS: s0, v: CFG.train.cruise, hp: k.trainMax, hpShown: k.trainMax, hit: [0, 0, 0, 0, 0],
      clack: 0, smokeT: 0, hornT: 0, fx: trackX(y0), fy: y0, cars },
    // the helicopter: ox / oy = where it is from the engine's nose, vx / vy = its speed against the
    // train, hd = its heading, home = flying back over the train
    heli: { ox: 0, oy: Math.round(H * 0.12), vx: 0, vy: 0, hd: 0, home: false, far: false },
    goalS: demo ? -1e12 : s0 - CFG.trip, goalY: -1e9, station: null,
    camX: 0, camY: 0, aimSX: W / 2, aimSY: H / 2,
    lock: null, box: null,
    zombies: [], bodies: [], rounds: [], timers: [], statics: [], people: [],
    spawnCd: 0, railCd: rnd(5, 7), onTrain: 0, blocked: false, decalT: 0, sum: null,
    bot: false, botT: 0, botZ: null
  };
  G.afford = demo ? 0 : affordableCount(META.cash);
  clearFX();
  GRID.clear();
  layoutTrain();
  if (!demo) {
    G.goalY = yAtS(G.goalS, y0 - CFG.trip);
    buildSafeZone();
    buildStation(s0 - CFG.trip * 0.5);
  }
  placeCamera();
  scatter();
}
function startGame(trip) {
  audioInit();
  newGame(false, trip);
  META.trip = G.trip;
  META.played = true;
  saveMeta();
  mode = 'play';
  paused = false;
  banner('TRIP ' + G.trip, 'ESCORT THE TRAIN. PICK UP SURVIVORS AT THE STATION.', U.gold);
  SFX.horn();
}
// Pay cash into this run (times the run's cash multiplier). kind = which summary row it counts for.
// Returns what was paid.
function pay(base, kind) {
  if (G.demo) return 0;
  const v = base * G.mult;
  G.cash += v;
  G.earn[kind] += v;
  return v;
}
// The cash to spend: the bank plus this run's cash not banked yet.
const wallet = () => META.cash + (G && !G.demo ? G.cash - G.banked : 0);
// Put this run's cash in the bank (only what is not there yet) and save.
function bankRun() {
  if (G.demo) return;
  META.cash += G.cash - G.banked;
  G.banked = G.cash;
  saveMeta();
}
// The run is over: first-clear pay, the camp, the bank, the best scores, and the summary rows.
function endGame() {
  mode = 'summary';
  sumStart = realT;
  G.trigger = false;
  G.sumTicks = 0;
  const st = G.station, T = G.trip, safe = G.result === 'safe', cleared = safe;
  let first = 0, camp = 0;
  if (cleared && META.cleared.indexOf(T) < 0) {
    META.cleared.push(T);
    first = pay(300, 'first');
  }
  if (cleared) {
    META.maxTrip = Math.max(META.maxTrip, T + 1);
    META.trip = T + 1;
  }
  if (safe && st) camp += st.saved;
  META.camp += camp;
  const wallet0 = META.cash - G.banked, e = G.earn;
  bankRun();
  const nb = G.kills > META.best.kills;
  if (nb) META.best.kills = G.kills;
  if (safe) META.best.safe++;
  saveMeta();
  // the rows: name, count, cash
  const rows = [['KILLS', fmt(G.kills), e.kills + e.bonus], ['STATION', (st ? st.saved : 0) + '/' + G.ti.people, e.station]];
  if (safe) rows.push(['ARRIVAL', Math.round(G.tr.hp / G.k.trainMax * 100) + '% HP', e.arrival]);
  if (first) rows.push(['FIRST CLEAR', '', first]);
  G.sum = {
    result: G.result, trip: T, cleared, first, camp, rows, total: G.cash, wallet: META.cash, wallet0,
    newBest: nb && G.kills > 0, canBuy: affordableCount(META.cash),
    tip: safe ? '' : lossTip(st && st.state === 'boarding')
  };
}
// After a loss: the cheapest card that would have helped (at the station: the guns; out on the
// line: the train).
function lossTip(atStation) {
  let best = null, bc = Infinity;
  for (const id of atStation ? ['dmg', 'cannon', 'sniper'] : ['armor', 'cow', 'gunners']) {
    if (upgMaxed(id) || upgLocked(id)) continue;
    const c = upgCost(id);
    if (c < bc) { bc = c; best = id; }
  }
  if (!best) return '';
  const u = UPGMAP[best];
  return 'TIP: ' + u.name + ' $' + fmt(bc) + ' = ' + u.val(lvl(best) + 1) + ' ' + u.unit;
}
// Leave a run from the pause screen: the cash is kept, the run counts as lost.
function quitRun() {
  bankRun();
  toDepot();
}
function toTitle() {
  newGame(true);
  mode = 'title';
  paused = false;
}
function toDepot() {
  newGame(true);
  mode = 'depot';
  paused = false;
}
const scoring = () => !G.demo && (mode === 'play' || mode === 'ending');
// Run f after t seconds of game time.
function later(t, f) {
  G.timers.push({ t, f });
}

// ---------- the train
// Place the cars along the curve: each car's front and back on the rails, its middle, its heading
// (dx, dy = unit vector to its front, nx, ny = to its right) and its depth for drawing.
function layoutTrain() {
  const tr = G.tr;
  let y = yAtS(tr.s, tr.fy);
  tr.fy = y;
  tr.fx = trackX(y);
  for (let k = 0; k < CAR.n; k++) {
    const c = tr.cars[k], s0 = tr.s + k * (CAR.L + CAR.gap);
    const y0 = k ? yAtS(s0, y + CAR.gap) : y, y1 = yAtS(s0 + CAR.L, y0 + CAR.L);
    const x0 = trackX(y0), x1 = trackX(y1), dx = x0 - x1, dy = y0 - y1, l = Math.hypot(dx, dy) || 1;
    c.x0 = x0; c.y0 = y0; c.x1 = x1; c.y1 = y1;
    c.cx = (x0 + x1) / 2; c.cy = (y0 + y1) / 2;
    c.dx = dx / l; c.dy = dy / l;
    c.nx = -c.dy; c.ny = c.dx;
    c.ang = Math.atan2(c.dx, -c.dy);
    c.k = Math.max(y0, y1) + 3;
    y = y1;
  }
}
// Distance from (x, y) to the segment a-b, with y squashed like the blasts measure it.
function segDist(px, py, ax, ay, bx, by) {
  py /= FORE; ay /= FORE; by /= FORE;
  const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
// How far (x, y) on the ground is from the train (0 = on it); ahead = px the train will have moved on.
function trainDist(x, y, ahead) {
  const a = ahead || 0;
  let d = 1e9;
  for (const c of G.tr.cars) d = Math.min(d, segDist(x, y, c.x1 + c.dx * a, c.y1 + c.dy * a, c.x0 + c.dx * (a + 6), c.y0 + c.dy * (a + 6)));
  return Math.max(0, d - CAR.half);
}
// The car nearest (x, y).
function carNear(x, y) {
  let best = 0, bd = 1e9;
  G.tr.cars.forEach((c, k) => { const d = Math.hypot(c.cx - x, c.cy - y); if (d < bd) { bd = d; best = k; } });
  return best;
}
function hurtTrain(a, car) {
  if (G.demo || G.result) return;
  const tr = G.tr, was = tr.hp, low = G.k.trainMax * 0.35;
  tr.hp = Math.max(0, tr.hp - a);
  tr.hit[car] = 0.12;
  if (tr.hp <= 0) lose();
  else if (was >= low && tr.hp < low) {
    banner('TRAIN IN DANGER', 'CLEAR THE DEAD OFF IT', U.red, 4);
    SFX.warn();
  }
}
// The safe zone: a concrete wall right across the land, a gate for the railway, two watchtowers.
function buildSafeZone() {
  const y = Math.round(G.goalY), gx = Math.round(trackX(G.goalY)), st = G.statics;
  for (let x = gx - 640; x <= gx + 640; x += 16) {
    if (Math.abs(x - gx) < 26) continue;
    st.push({ d: SAFE.blocks[mod(x >> 4, SAFE.blocks.length)], x, y, k: y });
  }
  for (const s of [-1, 1]) {
    st.push({ d: SAFE.pillar, x: gx + s * 20, y: y + 1, k: y + 1 });
    st.push({ d: SAFE.tower, x: gx + s * 50, y: y - 4, k: y - 4, tower: s });
  }
}
// The station halfway, on the east side of the rails: a platform, the station house, two lamps.
// The train stops with its passenger car (car 1) at the house.
function buildStation(s) {
  const y = yAtS(s, G.tr.fy - (G.tr.s - s)), tl = trackLocal(trackX(y), y, {}), c = tl.c, fp = trackSlope(y);
  const nx = c, ny = -fp * c;                               // to the right of the rails
  const hx = trackX(y) + nx * 74, hy = y + ny * 74;
  const st = G.station = {
    s, stopS: s - (CAR.L + CAR.gap) - CAR.L / 2, y, state: 'ahead', t: 0, warned: false,
    saved: 0, lost: 0, blockedT: 0, house: { x: hx, y: hy }, door: { x: hx, y: hy + 4 }
  };
  for (let a = -66; a <= 66; a += 12) {
    const yy = yAtS(s + a, y + a), fpp = trackSlope(yy), cc = 1 / Math.sqrt(1 + fpp * fpp);
    const x = Math.round(trackX(yy) + cc * 18), py = Math.round(yy - fpp * cc * 18);
    G.statics.push({ d: STATION.slab, x, y: py, k: py });
  }
  for (const a of [-44, 44]) {
    const yy = yAtS(s + a, y + a), x = Math.round(trackX(yy) + 26);
    G.statics.push({ d: STATION.lamp, x, y: Math.round(yy), k: Math.round(yy), lamp: true });
  }
  G.statics.push({ d: STATION.house, x: Math.round(hx), y: Math.round(hy), k: Math.round(hy) });
  for (let i = 0; i < G.ti.people; i++) {
    G.people.push({ person: true, x: hx + rnd(-8, 8), y: hy + rnd(3, 7), st: 'wait', go: 0.6 + i * CFG.station.gap,
      sv: SURV[i % SURV.length], anim: rnd(2), left: Math.random() < 0.5, k: 0, by: null, gt: 0 });
  }
  return st;
}
// The train gets through the gate: the guards shoot the dead off it, the survivors are safe.
function arrive() {
  G.result = 'safe';
  mode = 'ending';
  G.endT = 0;
  G.trigger = false;
  G.lock = null;
  const st = G.station, saved = st ? st.saved : 0;
  G.bonus = pay(Math.round(G.tr.hp / G.k.trainMax * 100) * 3, 'arrival');
  banner('TRAIN SAFE', saved + ' SURVIVORS SAVED.  +$' + fmt(G.bonus), U.gold, 9);
  SFX.horn();
  for (const z of G.zombies) if (z.st === 2) later(rnd(0.2, 1.4), () => {
    if (z.dead) return;
    lights.push({ x: z.x, y: z.y, z: 6, r: 10, c: '#ffb060', life: 0.08, max: 0.08, a: 0.8 });
    kill(z, 'mg', 0, 0, 0, true);
  });
}
// The dead have taken the train: the fuel tanker goes up, then the engine.
function lose() {
  G.result = 'lost';
  mode = 'ending';
  G.endT = 0;
  G.trigger = false;
  G.lock = null;
  banner('TRAIN LOST', 'THE DEAD HAVE TAKEN IT', U.red, 9);
  const blast = (k, big) => () => {
    const c = G.tr.cars[k], x = c.cx + rnd(-3, 3), y = c.cy;
    boomFx(x, y, big);
    for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - x, (z.y - y) / FORE) < 30) kill(z, 'he', x, y, 10, true);
    addShake(big ? 0.8 : 0.4);
    SFX.boom();
  };
  later(0.15, blast(4, true));
  later(0.7, blast(2, false));
  later(1.3, blast(0, true));
}

// ---------- the dead
function makeZombie(x, y, type) {
  const T = CFG.types[type], sets = ZS[type], hp = T.big ? Math.round(G.ti.bruteHp) : T.hp;
  return {
    x, y, type, S: sets[(Math.random() * sets.length) | 0], hp, max: hp, value: T.value, run: !!T.run, big: !!T.big,
    sp: rnd(T.speed[0], T.speed[1]), dps: T.dps, wob: rnd(TAU), anim: rnd(2), left: Math.random() < 0.5,
    vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, pending: 0, block: [], blockT: rnd(0.5), dead: false, gone: false, qd: 0, k: y,
    // st: 0 walking, 1 on the rails ahead of the train, 2 holding on to the train
    st: 0, rx: rnd(-3, 3), side: 0, car: 0, al: 0, ox: 0, bang: 0, dmg: 0
  };
}
function pickType() {
  const r = Math.random(), ti = G.ti;
  if (G.demo) return r < 0.03 ? 2 : r < 0.1 ? 1 : 0;
  if (G.run > 15 && r < ti.brute) return 2;
  if (G.run > 5 && r < ti.brute + ti.runner) return 1;
  return 0;
}
function pack(n, hx, hy) {
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(Math.random()) * (8 + n * 1.5), b = rnd(TAU);
    G.zombies.push(makeZombie(hx + Math.cos(b) * r, hy + Math.sin(b) * r * FORE, pickType()));
  }
}
// true when (x, y) is out of the camera's view by more than m px
const offView = (x, y, m) => x < G.camX - m || x > G.camX + W + m || y < G.camY - m || y > G.camY + H + m;
// A pack walks in from one side of the railway, out of view; ds = along the rails from the engine.
function sidePack(n, ds0, ds1) {
  for (let i = 0; i < 6; i++) {
    const s = G.tr.s + rnd(ds0, ds1), y = yAtS(s, G.tr.fy + (s - G.tr.s)), side = Math.random() < 0.5 ? -1 : 1;
    const x = trackX(y) + side * rnd(110, 380);
    if (y < G.goalY + 40 || !offView(x, y, 24)) continue;
    pack(n, x, y);
    return;
  }
}
// A crowd standing on the rails ahead of the train, out of view.
function railGroup(n) {
  for (let i = 0; i < 4; i++) {
    const s = G.tr.s - rnd(230, 380) - i * 90, y = yAtS(s, G.tr.fy + (s - G.tr.s));
    if (y < G.goalY + 60) return;
    if (!offView(trackX(y), y, 16)) continue;
    for (let k = 0; k < n; k++) {
      const yy = y - k * rnd(3, 8), z = makeZombie(trackX(yy) + rnd(-3, 3), yy, pickType());
      z.st = 1;
      z.rx = z.x - trackX(yy);
      G.zombies.push(z);
    }
    return;
  }
}
// the start: packs on both sides of the railway, most of them ahead, and a crowd on the rails ahead
function scatter() {
  for (let k = 0; k < 10; k++) {
    const s = G.tr.s - rnd(-40, 300), y = yAtS(s, G.tr.fy + (s - G.tr.s));
    pack(rndi(5, 12), trackX(y) + (Math.random() < 0.5 ? -1 : 1) * rnd(90, W / 2), y);
  }
  const s = G.tr.s - 110, y = yAtS(s, G.tr.fy - 110);
  for (let k = 0; k < 5; k++) {
    const yy = y - k * 6, z = makeZombie(trackX(yy) + rnd(-3, 3), yy, 0);
    z.st = 1;
    z.rx = z.x - trackX(yy);
    G.zombies.push(z);
  }
}
function spawn(dt) {
  const st = G.station, stopped = st && st.state === 'boarding';
  const ti = G.ti, want = G.demo ? 300 : Math.min(ti.cap, ti.start + ti.perSec * G.run);
  G.spawnCd -= dt;
  if (G.spawnCd <= 0 && G.zombies.length < want + (stopped ? 50 : 0)) {
    if (stopped) sidePack(rndi(4, 8), -240, 300);
    else sidePack(rndi(3, 7) + Math.min(4, Math.floor(G.run / 25)), -420, 80);
    G.spawnCd = stopped ? rnd(0.3, 0.45) : rnd(0.3, 0.6);
  }
  G.railCd -= dt;
  if (G.railCd <= 0 && !stopped) {
    railGroup(rndi(3, 6) + G.ti.railExtra + Math.min(5, Math.floor(G.run / 20)));
    G.railCd = Math.max(3.6, rnd(7, 10) - G.run * 0.04);
  }
}

// a grid of 16 px cells over the dead, for spacing and for finding who a round hits
const GC = 16, GRID = new Map();
const gk = (i, j) => (i + 40000) * 80000 + (j + 40000);
function gridBuild() {
  if (GRID.size > 3000) GRID.clear();
  for (const a of GRID.values()) a.length = 0;
  for (const z of G.zombies) {
    const k = gk(Math.floor(z.x / GC), Math.floor(z.y / GC));
    let a = GRID.get(k);
    if (!a) GRID.set(k, (a = []));
    a.push(z);
  }
}
// Call fn(z, d) for every living zombie within R of (x, y) on the ground (d = distance).
function queryEll(x, y, R, fn) {
  const i0 = Math.floor((x - R) / GC), i1 = Math.floor((x + R) / GC);
  const j0 = Math.floor((y - R * FORE) / GC), j1 = Math.floor((y + R * FORE) / GC);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const list = GRID.get(gk(i, j));
    if (!list) continue;
    for (const z of list) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, (z.y - y) / FORE);
      if (d <= R) fn(z, d);
    }
  }
}

// The dead take hold of the train: side -1 / 1 = its left / right side, 0 = the engine's nose.
// ds = how far behind the nose (along the rails), u = how far right of the rails.
function attach(z, side, ds, u) {
  z.st = 2;
  z.side = side;
  z.dmg = 0;
  z.bang = rnd(TAU);
  z.kbx = z.kby = 0;
  if (side === 0) {
    z.car = 0;
    z.ox = clamp(u, -6, 6);
    z.left = u > 0;
  } else {
    z.car = clamp(Math.floor(ds / (CAR.L + CAR.gap)), 0, CAR.n - 1);
    z.al = CAR.L / 2 - clamp(ds - z.car * (CAR.L + CAR.gap), 4, CAR.L - 6);
    z.ox = rnd(0, 2);
    z.left = side > 0;
  }
}
// The engine runs one down: it dies, and the train loses speed.
function crush(z) {
  const tr = G.tr, c = tr.cars[0];
  tr.v *= z.big ? 0.35 : 0.85;
  kill(z, 'train', 0, 0, 0);
  hurtTrain(z.big ? 5 : 1, 0);
  for (let k = 0; k < 5; k++) {
    const s = k & 1 ? 5 : -5;
    part({ x: c.x0 + c.nx * s, y: c.y0 + c.ny * s + 2, z: 1, vx: rnd(-30, 30), vy: rnd(-10, 25), vz: rnd(10, 40),
      g: 140, life: rnd(0.2, 0.4), max: 0.4, s: 1, c: pick(['#ffe2a0', '#ffb347']), add: true, drag: 2 });
  }
  if (!G.demo) {
    addShake(z.big ? 0.35 : 0.08);
    SFX.crush(z.big);
  }
}
// The nearest survivor out in the open (running, or held by the dead) within r of zombie z.
function preyNear(z, r) {
  let best = null, bd = r;
  for (const p of G.people) {
    if (p.st !== 'run' && p.st !== 'grab') continue;
    const d = Math.hypot(p.x - z.x, (p.y - z.y) / FORE);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const TL = { u: 0, a: 0, c: 1 };
function updateZombies(dt) {
  const zs = G.zombies, tr = G.tr, hw = CAR.half, safe = G.result === 'safe';
  if (!G.result) spawn(dt);
  const kb = Math.exp(-5 * dt), mid = tr.cars[2];
  let onTrain = 0, ahead = 1e9;
  for (const z of zs) {
    if (z.dead) continue;
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
        hurtTrain(1, z.car);
      }
      continue;
    }
    trackLocal(z.x, z.y, TL);
    const ds = TL.a - tr.s, side = TL.u < 0 ? -1 : 1;
    // where to walk: after a survivor, down the rails, onto the rails ahead, to the train's side,
    // or after the train
    let tx, ty;
    const prey = z.st === 0 ? preyNear(z, 70) : null;
    if (prey) {
      tx = prey.x;
      ty = prey.y;
      if (Math.hypot(prey.x - z.x, (prey.y - z.y) / FORE) < 4) grabPerson(prey, z);
    } else if (z.st === 1) { ty = z.y + 24; tx = trackX(ty) + z.rx; }
    else if (ds < -6) { tx = trackX(z.y) + z.rx; ty = z.y + 4; }
    else if (ds <= TRAIN_LEN + 6) { tx = trackX(z.y) + side * (hw + 3) / TL.c; ty = z.y; }
    else { const c = tr.cars[CAR.n - 1]; tx = c.x1 + side * (hw + 3); ty = c.y1; }
    const dx = tx - z.x, dy = (ty - z.y) / FORE, d = Math.hypot(dx, dy) || 1;
    z.wob += dt * (z.run ? 2 : 0.8);
    const w = z.st === 1 ? 0 : Math.sin(z.wob) * (z.run ? 0.25 : 0.4), cw = Math.cos(w), sw = Math.sin(w);
    const ux = (dx * cw - dy * sw) / d, uy = (dx * sw + dy * cw) / d;
    const sp = z.sp * (z.st === 1 ? 0.7 : 1) * (z.flash > 0 ? 0.3 : 1);
    z.vx = ux * sp + z.kbx;
    z.vy = uy * sp * FORE + z.kby;
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    z.kbx *= kb;
    z.kby *= kb;
    z.k = z.y;
    if (Math.abs(ux) > 0.3) z.left = ux < 0;
    z.anim += dt * (0.6 + sp / 3.2);
    if (z.st === 0 && ds < -6 && Math.abs(TL.u - z.rx) < 2.5) z.st = 1;
    // the engine runs it down, or (too slow to crush it) it climbs onto the nose; beside the train
    // it climbs on. Not once the train is safe.
    if (!safe) {
      if (Math.abs(TL.u) < hw + 2 && ds > -5 && ds < 6) {
        if (tr.v > 7 && !G.result) crush(z);
        else attach(z, 0, ds, TL.u);
        continue;
      }
      if (ds >= 0 && ds <= TRAIN_LEN && Math.abs(TL.u) < hw + 4) {
        attach(z, side, ds, TL.u);
        continue;
      }
    }
    if (z.st === 1 && ds < 0) ahead = Math.min(ahead, -ds);
    // far from the train and out of view: gone
    if (Math.abs(z.x - mid.cx) + Math.abs(z.y - mid.cy) > 900 && offView(z.x, z.y, 40)) z.gone = true;
  }
  G.onTrain = onTrain;
  // the dead on the track ahead: a warning, and the train sounds its horn
  G.blocked = ahead < 170;
  tr.hornT -= dt;
  if (ahead < 150 && tr.hornT <= 0 && !G.demo && !G.result) {
    tr.hornT = 7;
    SFX.horn();
  }
  gridBuild();
  // spacing in the crowd, round trees and walls, never inside the train or past the safe zone wall
  for (const a of zs) {
    if (a.dead || a.st === 2) continue;
    const ra = a.big ? 6 : 3.5, i0 = Math.floor(a.x / GC), j0 = Math.floor(a.y / GC);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const list = GRID.get(gk(i, j));
      if (!list) continue;
      for (const b of list) {
        if (b === a || b.st === 2) continue;
        const dx = a.x - b.x, dy = (a.y - b.y) / FORE, d2 = dx * dx + dy * dy, rr = ra + (b.big ? 6 : 3.5);
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), p = (rr - d) * 0.25 / d;
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
      const dx = a.x - a.block[k], dy = (a.y - a.block[k + 1]) / FORE, d = Math.hypot(dx, dy), m = a.block[k + 2] + ra * 0.6;
      if (d < m && d > 1e-4) {
        a.x = a.block[k] + dx / d * m;
        a.y = a.block[k + 1] + dy / d * m * FORE;
      }
    }
    const hs = G.station && G.station.house;
    if (hs) {
      const dx = a.x - hs.x, dy = (a.y - hs.y + 6) / FORE, d = Math.hypot(dx, dy);
      if (d < 16 && d > 1e-4) {
        a.x = hs.x + dx / d * 16;
        a.y = hs.y - 6 + dy / d * 16 * FORE;
      }
    }
    if (Math.abs(a.x - trackX(a.y)) < 26) {
      trackLocal(a.x, a.y, TL);
      const ds = TL.a - tr.s;
      if (ds > 0 && ds < TRAIN_LEN && Math.abs(TL.u) < hw + 2) a.x = trackX(a.y) + (TL.u < 0 ? -1 : 1) * (hw + 2) / TL.c;
    }
    if (a.y < G.goalY + 8) a.y = G.goalY + 8;
  }
  // drop the dead and the lost
  let j = 0;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead && !zs[i].gone) zs[j++] = zs[i];
  zs.length = j;
}

// ---------- the station stop and its survivors
// A zombie gets hold of a survivor: shoot it in time and the survivor runs on.
function grabPerson(p, z) {
  if (p.st !== 'run') return;
  p.st = 'grab';
  p.by = z;
  p.gt = CFG.station.grab;
  if (G.demo) return;
  if (!G.demo) {
    floatText(p.x, p.y - 8, 'HELP!', U.red);
    SFX.hit();
  }
}
function catchPerson(p) {
  if (p.st !== 'run' && p.st !== 'grab') return;
  p.st = 'dead';
  G.station.lost++;
  blood(p.x, p.y, 10, 5);
  stampPix(p.x, p.y, P.bl1, 2);
  if (!G.demo) {
    floatText(p.x, p.y - 6, 'SURVIVOR DOWN', U.red);
    SFX.splat();
  }
}
function updateStation(dt) {
  const st = G.station;
  if (!st) return;
  const tr = G.tr;
  if (st.state === 'ahead') {
    if (!st.warned && tr.s - st.stopS < 260) {
      st.warned = true;
      banner('STATION AHEAD', 'THE TRAIN STOPS FOR SURVIVORS', U.blue, 3);
    }
    // brake to stop with the passenger car at the house
    if (tr.s - st.stopS < tr.v * tr.v / (2 * CFG.train.brake) + 1) st.state = 'braking';
  } else if (st.state === 'boarding') {
    st.t += dt;
    const c = tr.cars[1], door = { x: c.cx + c.nx * (CAR.half + 2), y: c.cy + c.ny * (CAR.half + 2) };
    // the next survivor runs once the way out of the door is clear (or, in the end, anyway)
    let near = false;
    for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - st.door.x, (z.y - st.door.y) / FORE) < CFG.station.clear) { near = true; break; }
    let busy = 0, waiting = false;
    for (const p of G.people) {
      if (p.st === 'wait') {
        busy++;
        if (st.t >= p.go) {
          waiting = true;
          if (!near || st.blockedT > CFG.station.wait) {
            p.st = 'run';
            st.blockedT = 0;
          }
        }
        continue;
      }
      if (p.st === 'grab') {
        busy++;
        if (p.by.dead) p.st = 'run';
        else if ((p.gt -= dt) <= 0) catchPerson(p);
        continue;
      }
      if (p.st !== 'run') continue;
      busy++;
      const dx = door.x - p.x, dy = door.y - p.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        p.st = 'in';
        st.saved++;
        const v = pay(25, 'station');
        if (!G.demo) {
          floatText(p.x, p.y - 6, '+1 SAVED +$' + fmt(v), '#8fd18a');
          SFX.saved();
        }
        continue;
      }
      p.x += dx / d * CFG.station.run * dt;
      p.y += dy / d * CFG.station.run * dt;
      p.left = dx < 0;
      p.anim += dt * 8;
    }
    st.blockedT = waiting && near ? st.blockedT + dt : 0;
    if (!busy && st.t >= CFG.station.minStop) {
      st.state = 'leaving';
      banner('ALL ABOARD', st.saved + ' OF ' + G.ti.people + ' SURVIVORS SAVED', '#8fd18a', 3);
      SFX.horn();
    }
  }
  for (const p of G.people) p.k = p.y;
}

// ---------- the helicopter
// The keys push it about; with no key held it keeps its place over the train. F flies it back
// over the engine. It cannot stray more than the leash from the train.
function updateHeli(dt) {
  const h = G.heli, c = CFG.heli, homeY = Math.round(H * 0.12);
  if (G.demo || mode === 'title') {
    // the title: a slow circle off to the side of the train, the menu on the left
    const off = W >= 560 ? -W * 0.22 : 0;
    h.ox = off + Math.cos(G.t * 0.15) * 30;
    h.oy = homeY + Math.sin(G.t * 0.15) * 24;
    h.vx = -Math.sin(G.t * 0.15) * 4.5;
    h.vy = Math.cos(G.t * 0.15) * 3.6;
  } else {
    let [ix, iy] = mode === 'play' ? keyAxis() : [0, 0];
    if (mode === 'play' && M.inside && !G.bot) {
      const ex = M.x / W * 2 - 1, ey = M.y / H * 2 - 1;
      ix = clamp(ix + Math.sign(ex) * smooth(0.94, 0.995, Math.abs(ex)), -1, 1);
      iy = clamp(iy + Math.sign(ey) * smooth(0.92, 0.99, Math.abs(ey)), -1, 1);
    }
    const l = Math.hypot(ix, iy);
    if (l > 1) { ix /= l; iy /= l; }
    if (l > 0.05) h.home = false;
    const sp = G.k.heliSpeed;
    let tx = ix * sp, ty = iy * sp;
    if (h.home) {
      const dx = -h.ox, dy = homeY - h.oy, d = Math.hypot(dx, dy);
      if (d < 3) h.home = false;
      else {
        tx = dx / d * Math.min(sp, d * 2.5);
        ty = dy / d * Math.min(sp, d * 2.5);
      }
    }
    const k = Math.min(1, dt * c.accel);
    h.vx += (tx - h.vx) * k;
    h.vy += (ty - h.vy) * k;
    h.ox += h.vx * dt;
    h.oy += h.vy * dt;
    // the leash: pulled back softly past it
    const d = Math.hypot(h.ox, h.oy - homeY);
    const leash = G.k.leash;
    h.far = d > leash * 0.85;
    if (d > leash) {
      const f = leash / d;
      h.ox *= f;
      h.oy = homeY + (h.oy - homeY) * f;
      h.vx *= 0.8;
      h.vy *= 0.8;
    }
  }
  // the heading follows where it flies (the train's way plus its own)
  const t0 = G.tr.cars[0], gx = t0.dx * G.tr.v + h.vx, gy = t0.dy * G.tr.v + h.vy;
  if (Math.hypot(gx, gy) > 10) {
    let a = Math.atan2(gx, -gy) - h.hd;
    a = mod(a + Math.PI, TAU) - Math.PI;
    h.hd += clamp(a, -2.4 * dt, 2.4 * dt);
  }
}
// The view: over the helicopter, swinging a little ahead of where it flies, swaying as it hovers.
function placeCamera() {
  const h = G.heli, sw = REDUCED ? 0 : 1;
  const cx = G.tr.fx + h.ox + h.vx * 0.22 + Math.sin(G.t * 0.9) * 1.3 * sw;
  const cy = G.tr.fy + h.oy + h.vy * 0.22 + Math.sin(G.t * 1.27 + 1) * 0.9 * sw;
  G.camX = Math.round(cx - W / 2);
  G.camY = Math.round(cy - H / 2);
}
// chunks in view: [first column, first row, last column, last row]
function viewChunks() {
  return [Math.floor(G.camX / CH), Math.floor(G.camY / CH), Math.floor((G.camX + W) / CH), Math.floor((G.camY + H) / CH)];
}

// ---------- lock-on
// The zombie nearest the sight on screen. Ones the rounds in the air will already kill are passed
// over for any other near the sight (a little wider than the lock), so a burst held over a crowd
// spreads one round per zombie; a lone target that is done for still gets the rest.
function findLock() {
  const keep = G.lock && !G.lock.dead ? G.lock : null, r1 = CFG.lock * CFG.lock, r2 = r1 * 5;
  let fresh = null, fd = r2, done = null, dd = r1;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const dx = z.x - G.camX - G.aimSX, dy = z.y - G.camY - z.S.h * 0.5 - G.aimSY;
    let d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (z === keep) d2 *= 0.45;
    if (z.pending * G.k.mgDmg < z.hp) {
      const w = d2 > r1 ? d2 * 1.5 : d2;
      if (w < fd) { fd = w; fresh = z; }
    } else if (d2 < dd) { dd = d2; done = z; }
  }
  const nl = fresh || done;
  if (nl && !G.lock && mode === 'play') SFX.lock();
  G.lock = nl;
}

// ---------- the guns
// A 25mm round. With a lock it leads the target; without, it lands near (tx, ty).
function fireMG(player, tx, ty) {
  let bx, by, tgt = null;
  if (player && G.lock) {
    tgt = G.lock;
    const s = Math.sqrt(Math.random()) * 1.2, a = rnd(TAU);
    bx = tgt.x + tgt.vx * CFG.mg.travel + Math.cos(a) * s;
    by = tgt.y + tgt.vy * CFG.mg.travel + Math.sin(a) * s * FORE;
    tgt.pending++;                                   // spoken for: the next round goes elsewhere
  } else {
    const s = Math.sqrt(Math.random()) * CFG.mg.spread, a = rnd(TAU);
    bx = tx + Math.cos(a) * s;
    by = ty + Math.sin(a) * s * FORE;
  }
  G.rounds.push({ kind: 'mg', bx, by, tgt, age: 0, T: CFG.mg.travel, side: 1, j: rnd(-1, 1), player });
  G.muzzle[0] = 0.05;
  if (player) {
    G.shots++;
    G.heat = Math.min(1, G.heat + G.k.heatPer);
    addShake(0.06);
    kick(rnd(-0.3, 0.3), 0.5);
    SFX.mg();
  }
}
// A 105mm shell at (tx, ty). With a lock it leads: it lands where the crowd under the sight
// will have walked to by then.
function fireHE(player, tx, ty) {
  let bx = tx, by = ty;
  if (player && G.lock) {
    bx += G.lock.vx * CFG.he.travel;
    by += G.lock.vy * CFG.he.travel;
  }
  G.rounds.push({ kind: 'he', bx, by, tgt: null, age: 0, T: CFG.he.travel, side: -1, j: 0, player });
  G.muzzle[1] = 0.12;
  if (player) {
    G.heReload = G.k.heReload;
    addShake(0.45);
    kick(rnd(-1, 1), 2.5);
    SFX.cannon();
    SFX.whistle(CFG.he.travel);
  }
}
// Right click or Space. Pressed just before the gun is loaded, it fires the moment it is.
function tryHE() {
  if (mode !== 'play' || paused) return;
  if (G.heReload <= 0) fireHE(true, G.camX + G.aimSX, G.camY + G.aimSY);
  else if (G.heReload < 0.5) G.heQueue = true;
}
function updateRounds(dt) {
  const rs = G.rounds;
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    r.age += dt;
    if (r.age < r.T) continue;
    rs[i] = rs[rs.length - 1];
    rs.pop();
    if (r.kind === 'he') explode(r.bx, r.by, r.player);
    else mgImpact(r);
  }
}

// ---------- hits and kills
// Blood drops thrown away from the gun (up the screen) and to the sides; they stay on the ground.
function blood(x, y, n, zh) {
  for (let k = 0; k < n; k++) part({ x: x + rnd(-1, 1), y, z: rnd(3, zh), vx: rnd(-35, 35), vy: rnd(-45, 12), vz: rnd(15, 70),
    g: 240, life: 1.4, max: 1.4, s: 1, c: pick([P.bl0, P.bl1, P.bl2, P.bl2]), land: 1 });
}
// cause = 'mg' (a 25mm round), 'he' (the 105 at (cx, cy), dist away) or 'train' (run down).
// free = not the player's kill (no score).
function kill(z, cause, cx, cy, dist, free) {
  if (z.dead) return;
  z.dead = true;
  z.hp = 0;
  if (G.lock === z) G.lock = null;
  const sc = scoring() && !free, S = z.S, bs = G.bodies, room = bs.length < 160;
  let paid = 0;
  if (sc) {
    G.kills++;
    paid = pay(z.value, 'kills');
    G.killBump = 1;
  }
  if (cause === 'he') {
    // thrown away from the blast, turning over
    const dx = z.x - cx, dy = (z.y - cy) / FORE, l = Math.hypot(dx, dy) || 1, f = 1 - Math.min(1, dist / (G.k.heKill + 22));
    const v = (35 + f * 80) * (z.big ? 0.4 : 1) * rnd(0.8, 1.2);
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: dx / l * v, vy: dy / l * v * FORE,
      vz: (50 + f * 130) * (z.big ? 0.5 : 1) * rnd(0.8, 1.2), spin: rnd(8, 16) * (dx < 0 ? -1 : 1), rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 10 : 4, S.h * 0.5);
    if (Math.random() < 0.4) part({ x: z.x, y: z.y, z: rnd(4, 9), vx: rnd(-10, 10), vy: rnd(-5, 5), vz: rnd(12, 30), g: -6,
      life: rnd(0.4, 0.8), max: 0.8, s: 1, c: pick(['#ff8a3a', '#ffc27a']), add: true, drag: 1.5 });
  } else if (cause === 'train') {
    // run down: flung aside and ahead, a burst of blood
    const c = G.tr.cars[0], s = trackLocal(z.x, z.y, TL).u < 0 ? -1 : 1, v = rnd(40, 80), f = rnd(15, 35);
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: c.nx * s * v + c.dx * f, vy: c.ny * s * v + c.dy * f, vz: rnd(40, 80),
      spin: rnd(10, 18) * s, rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 16 : 10, S.h * 0.6);
    if (sc) addTotal(z.x, z.y - S.h, paid, U.gold, false);
  } else {
    // a 25mm round: knocked over backwards, away from the gun, or off the side of the train
    if (room) {
      if (z.st === 2) {
        const c = G.tr.cars[z.car], s = z.side, v = rnd(25, 45), tv = G.tr.v * 0.6;
        bs.push(s ? { S, x: z.x, y: z.y, z: 3, vx: c.nx * s * v + c.dx * tv, vy: c.ny * s * v + c.dy * tv, vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 }
          : { S, x: z.x, y: z.y, z: 3, vx: c.dx * (v + tv), vy: c.dy * (v + tv), vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 });
      } else bs.push({ S, x: z.x, y: z.y, z: 0, vx: rnd(-8, 8), vy: -rnd(10, 22), vz: rnd(22, 40), spin: 0, rot: 0, fall: true, age: 0 });
    } else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 14 : 8, S.h * 0.6);
    part({ x: z.x, y: z.y, z: S.h * 0.5, vx: rnd(-4, 4), vy: rnd(-6, 0), vz: rnd(4, 10), g: 0, life: 0.45, max: 0.45, s: 3,
      c: 'rgba(110,24,20,0.55)', grow: 7, drag: 3, smoke: true });
    if (sc) addTotal(z.x, z.y - S.h, paid, U.gold, false);
    if (!G.demo) SFX.splat();
  }
  if (sc && (Math.random() < 0.3 || z.big) && coins.length < 45) coins.push({ x0: z.x - G.camX, y0: z.y - G.camY - 8, t: 0, T: rnd(0.55, 0.8) });
  if (z.big && !G.demo) {
    addShake(0.15);
    hitStop(0.05, 0.3);
  }
}
function hitZombie(z) {
  z.hp -= G.k.mgDmg;
  z.flash = 0.1;
  if (z.hp <= 0) {
    kill(z, 'mg', 0, 0, 0);
    return;
  }
  // a brute takes the hit: blood and a step back (not when it holds on to the train)
  blood(z.x, z.y, 4, z.S.h * 0.6);
  if (z.st !== 2) z.kby -= 12;
  if (!G.demo) SFX.hit();
}
// A 25mm round lands: its locked target first, then the nearest round the burst.
const NEAR = [];
function mgImpact(r) {
  const x = r.bx, y = r.by, T = r.tgt;
  let hits = 0;
  if (T) T.pending = Math.max(0, T.pending - 1);
  if (T && !T.dead && Math.hypot(T.x - x, (T.y - y) / FORE) < 6) {
    hitZombie(T);
    hits++;
  }
  NEAR.length = 0;
  queryEll(x, y, CFG.mg.splash, (z, d) => {
    if (z === T) return;
    z.qd = d;
    NEAR.push(z);
  });
  NEAR.sort((a, b) => a.qd - b.qd);
  for (const z of NEAR) {
    if (hits >= CFG.mg.victims) break;
    if (!z.dead) {
      hitZombie(z);
      hits++;
    }
  }
  if (hits && r.player) {
    G.hits++;
    G.hitT = 0.12;
  }
  // the round bursts: a small fire puff, a flash, sparks, earth and dust, a dark mark
  addBoom(x, y, 6, 3, 0.3, 3);
  lights.push({ x, y, z: 3, r: 14, c: '#ffb060', life: 0.1, max: 0.1, a: 0.8 });
  for (let k = 0; k < 4; k++) {
    const a = rnd(TAU), s = rnd(20, 70);
    part({ x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 70), g: 160, life: rnd(0.2, 0.45), max: 0.45,
      s: 1, c: pick(['#ffe2a0', '#ffb347', '#ff6a28']), add: true, drag: 1.5 });
  }
  for (let k = 0; k < 3; k++) {
    const a = rnd(TAU), s = rnd(15, 45);
    part({ x, y, z: 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 80), g: 320, life: 1.2, max: 1.2, s: 1,
      c: pick(['#4c4032', '#362d24', '#5e5140']), land: 1 });
  }
  part({ x: x + rnd(-1, 1), y, z: 2, vx: rnd(-5, 5) + 3, vy: rnd(-3, 3), vz: rnd(6, 12), g: 0, life: rnd(0.6, 1), max: 1, s: 2,
    c: pick(['rgba(92,86,80,0.55)', 'rgba(70,64,58,0.55)']), grow: 4, drag: 1.5, smoke: true });
  stampScorch(x, y, 0);
  if (!G.demo) SFX.pop();
}
// The look of a big blast (no damage): flash, fireball, rings, smoke, earth, sparks, fires, a crater.
function boomFx(x, y, big) {
  lights.push({ x, y, z: 6, r: big ? 90 : 60, c: '#ff8a3a', life: 0.35, max: 0.35, a: 0.9 });
  lights.push({ x, y, z: 6, r: 40, c: '#fff6e0', life: 0.12, max: 0.12, a: 1 });
  addBoom(x, y, big ? 26 : 18, 7, 0.75, big ? 11 : 8);
  for (let k = 0; k < (big ? 4 : 2); k++) {
    const a = rnd(TAU), r = rnd(10, 22);
    addBoom(x + Math.cos(a) * r, y + Math.sin(a) * r * FORE, 12, 4, 0.5, 6, rnd(0.03, 0.15));
  }
  const kr = G.k.heKill;
  rings.push({ x, y, r0: 8, r1: kr * 1.25, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x, y, r0: 20, r1: (kr + 22) * 1.5, t: 0, T: 0.55, c: '#a89878' });
  for (let k = 0; k < 16; k++) part({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), z: rnd(4, 18), vx: rnd(-14, 14) + 4, vy: rnd(-6, 6),
    vz: rnd(10, 34), g: 0, life: rnd(1.4, 2.8), max: 2.8, s: rnd(4, 8),
    c: pick(['rgba(58,50,46,0.75)', 'rgba(40,36,34,0.7)', 'rgba(74,64,56,0.6)']), grow: 6, drag: 1, smoke: true });
  for (let k = 0; k < 34; k++) {
    const a = rnd(TAU), s = rnd(30, 130);
    part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(60, 170), g: 320, life: 2, max: 2,
      s: Math.random() < 0.3 ? 2 : 1, c: pick(['#4c4032', '#362d24', '#5e5140', '#2a241d']), land: 1 });
  }
  for (let k = 0; k < 18; k++) {
    const a = rnd(TAU), s = rnd(30, 120);
    part({ x, y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 140), g: 140, life: rnd(0.4, 0.9), max: 0.9,
      s: 1, c: pick(['#ffe2a0', '#ffb347', '#ff6a28']), add: true, drag: 1.2 });
  }
  for (let k = 0; k < 4 && flames.length < 40; k++) {
    const a = rnd(TAU), r = rnd(6, 24);
    flames.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FORE, life: rnd(3, 7), seed: rnd(100) });
  }
  stampScorch(x, y, 3);
}
// The 105 lands: everything near dies, the edge of the blast throws the rest back. Too close to
// the train, the blast hurts the train as well; it kills survivors on foot too.
function explode(x, y, player) {
  let killed = 0, value = 0;
  const kr = G.k.heKill, close = kr - 6;
  queryEll(x, y, kr + 22, (z, d) => {
    if (d >= kr) {
      z.hp -= G.k.heRing;
      z.flash = 0.25;
      if (z.st !== 2) {
        const dx = z.x - x, dy = (z.y - y) / FORE, l = Math.hypot(dx, dy) || 1;
        z.kbx += dx / l * 60;
        z.kby += dy / l * 60 * FORE;
      }
      if (z.hp > 0) return;
    }
    value += z.value;
    killed++;
    kill(z, 'he', x, y, d);
  });
  boomFx(x, y, true);
  if (!G.demo) {
    addShake(0.75);
    hitStop(killed >= 12 ? 0.1 : 0.04, 0.25);
    SFX.boom();
  }
  for (const p of G.people) if ((p.st === 'run' || p.st === 'grab') && Math.hypot(p.x - x, (p.y - y) / FORE) < kr) catchPerson(p);
  const td = trainDist(x, y);
  if (player && td < close && !G.demo && !G.result) {
    const a = Math.round(14 * (1 - td / close)) + 3, k = carNear(x, y), c = G.tr.cars[k];
    hurtTrain(a, k);
    floatText(c.cx, c.cy - 8, '-' + a, U.red);
    banner('CHECK FIRE!', 'YOUR SHELL HIT THE TRAIN', U.red, 3);
    SFX.radio();
  }
  if (player && scoring()) {
    G.bestBlast = Math.max(G.bestBlast, killed);
    const v = value * G.mult;
    if (killed) addTotal(x, y - 10, v, U.gold, true);
    if (killed >= 4) {
      // the big ones pay a bonus too
      const name = killed >= 25 ? 'MASSACRE' : killed >= 12 ? 'CARNAGE' : 'MULTI KILL';
      const b = pay(killed >= 25 ? 50 : killed >= 12 ? 20 : 5, 'bonus');
      banner(name + ' ×' + killed, '+$' + fmt(v) + '   +$' + fmt(b) + ' BONUS', killed >= 12 ? '#ff7a4a' : U.amber, 2);
    }
  }
}
// Bodies in the air: they fall, bounce once if they come down hard, then lie as corpses.
function updateBodies(dt) {
  const bs = G.bodies;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    b.age += dt;
    b.vz -= 320 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.rot += b.spin * dt;
    if (b.z > 0) continue;
    b.z = 0;
    if (b.vz < -70) {
      b.vz *= -0.3;
      b.vx *= 0.5;
      b.vy *= 0.5;
      b.spin *= 0.5;
      part({ x: b.x, y: b.y, z: 0, vx: 0, vy: 0, vz: 4, g: 0, life: 0.5, max: 0.5, s: 3, c: 'rgba(90,80,64,0.45)', grow: 4, smoke: true });
    } else {
      stampCorpse(b.S, b.x, b.y);
      bs[i] = bs[bs.length - 1];
      bs.pop();
    }
  }
}
// Burning wrecks and farms in view: smoke columns and embers.
function updateFireSpots(dt) {
  const [i0, j0, i1, j1] = viewChunks();
  for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
    for (const f of plan(i, j).fires) {
      const k = f.big ? 1 : 0.6;
      if (Math.random() < dt * 2.2 * k) part({ x: f.x + rnd(-2, 2), y: f.y + rnd(-1, 1), z: f.big ? 9 : 5, vx: rnd(4, 9), vy: rnd(-2, 1),
        vz: rnd(8, 14), g: 0, life: rnd(2.2, 3.6), max: 3.6, s: rnd(2, 4) * k + 1,
        c: pick(['rgba(44,40,38,0.6)', 'rgba(58,52,48,0.55)', 'rgba(36,33,31,0.6)']), grow: 3.5, drag: 0.35, smoke: true });
      if (Math.random() < dt * 5 * k) part({ x: f.x + rnd(-3, 3), y: f.y, z: rnd(4, 9), vx: rnd(-4, 6), vy: rnd(-2, 2), vz: rnd(14, 30),
        g: -4, life: rnd(0.5, 1.1), max: 1.1, s: 1, c: pick(['#ffc27a', '#ff8a3a', '#e2552f']), add: true, drag: 1.2 });
    }
  }
}

// ---------- the autopilot (the title demo, and tests through window.__sr.bot)
// It shoots the dead on the train first, then the ones near the survivors, then the ones on the
// rails nearest the engine, then whoever is nearest the train; the 105 goes to a crowd on the rails
// well ahead of the train.
function autopilot(dt) {
  G.botT -= dt;
  if (G.botT <= 0 || !G.botZ || G.botZ.dead) {
    G.botT = 0.2;
    let bestZ = null, bs = 1e9;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const sx = z.x - G.camX, sy = z.y - G.camY;
      if (sx < 6 || sx > W - 6 || sy < 26 || sy > H - 6) continue;
      let s;
      const prey = preyNear(z, 50);
      if (prey && prey.by === z) s = -100;
      else if (z.st === 2) s = 0;
      else if (prey) s = 100;
      else if (z.st === 1) s = 300 + Math.max(0, trackLocal(z.x, z.y, TL).a - G.tr.s + 400);
      else s = 900 + trainDist(z.x, z.y);
      if (s < bs) { bs = s; bestZ = z; }
    }
    G.botZ = bestZ;
  }
  let he = null;
  for (const q of G.zombies) {
    if (q.dead || q.st !== 1 || q.y - G.camY < 24 || q.y - G.camY > H) continue;
    if (G.tr.s - trackLocal(q.x, q.y, TL).a > 110) { he = q; break; }
  }
  return { z: G.botZ && !G.botZ.dead ? G.botZ : null, he };
}
// the title demo: bursts of 25mm and a 105 now and then
function attract(dt) {
  const b = autopilot(dt);
  G.mgCd -= dt;
  if (b.z && G.t % 1.8 < 1.1) {
    while (G.mgCd <= 0) {
      fireMG(false, b.z.x + b.z.vx * CFG.mg.travel + rnd(-2, 2), b.z.y + b.z.vy * CFG.mg.travel + rnd(-2, 2));
      G.mgCd += 1 / 10;
    }
  } else G.mgCd = Math.max(0, G.mgCd);
  G.heReload -= dt;
  if (b.he && G.heReload <= 0) {
    fireHE(false, b.he.x + b.he.vx * CFG.he.travel, b.he.y + b.he.vy * CFG.he.travel);
    G.heReload = 3.5;
  }
}
// in play with the bot on: it moves the sight and pulls the triggers
function botPlay(dt) {
  const b = autopilot(dt);
  if (b.z) {
    M.x = b.z.x - G.camX;
    M.y = b.z.y - G.camY - b.z.S.h * 0.5;
    M.inside = true;
  }
  G.trigger = !!b.z;
  if (b.he && G.heReload <= 0) fireHE(true, b.he.x + b.he.vx * CFG.he.travel, b.he.y + b.he.vy * CFG.he.travel);
}

// ---------- one step of the game (STEP seconds)
function step(dt) {
  G.t += dt;
  const tr = G.tr, st = G.station;
  // the train gets back up to speed after every bump. It brakes for the station and waits there;
  // lost, it stops; safe, it rolls on until the whole train is inside the wall, then brakes.
  if (G.result === 'lost') tr.v = Math.max(0, tr.v - 30 * dt);
  else if (G.result === 'safe' && tr.s + TRAIN_LEN < G.goalS - 14) tr.v = Math.max(0, tr.v - 12 * dt);
  else if (st && st.state === 'braking') {
    tr.v = Math.min(tr.v, Math.sqrt(2 * CFG.train.brake * Math.max(0, tr.s - st.stopS)) + 1.5);
    if (tr.s - st.stopS < 0.6) {
      tr.v = 0;
      st.state = 'boarding';
      st.t = 0;
      banner('COVER THE SURVIVORS', 'THEY RUN FOR THE TRAIN', '#8fd18a', 3);
      SFX.radio();
    }
  } else if (st && st.state === 'boarding') tr.v = 0;
  else tr.v = Math.min(CFG.train.cruise, tr.v + G.k.accel * dt);
  tr.s -= tr.v * dt;
  layoutTrain();
  for (let k = 0; k < CAR.n; k++) if (tr.hit[k] > 0) tr.hit[k] -= dt;
  tr.hpShown = Math.max(tr.hp, tr.hpShown - dt * 12);
  // the little fires it runs over go out
  for (const f of flames) if (Math.abs(f.x - trackX(f.y)) < CAR.half + 2 && trainDist(f.x, f.y) < 1) f.life = 0;
  // wheels over the rail joints, and smoke from the stack
  tr.clack += tr.v * dt;
  if (tr.clack > 30) {
    tr.clack -= 30;
    if (!G.demo && mode !== 'summary') SFX.clack();
  }
  tr.smokeT -= dt;
  if (tr.smokeT <= 0 && G.result !== 'lost') {
    const c = tr.cars[0];
    tr.smokeT = tr.v > 1 ? 0.16 : 0.4;
    part({ x: c.x0 - c.dx * 15 + rnd(-1, 1), y: c.y0 - c.dy * 15, z: 10, vx: rnd(-3, 3) + 3, vy: rnd(-2, 2), vz: rnd(14, 22), g: 0,
      life: rnd(1.6, 2.6), max: 2.6, s: rnd(2, 3), c: pick(['rgba(40,38,36,0.6)', 'rgba(56,52,48,0.55)']), grow: 3, drag: 0.8, smoke: true });
  }
  updateHeli(dt);
  placeCamera();
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) {
      G.timers.splice(i, 1);
      tm.f();
    }
  }
  if (mode === 'play') {
    G.run += dt;
    if (G.bot) botPlay(dt);
    G.aimSX = clamp(M.x, 0, W - 1);
    G.aimSY = clamp(M.y, 0, H - 1);
    findLock();
    // the 25mm heats up while it fires and cools when it rests; too hot and it stops for a moment
    G.heat = Math.max(0, G.heat - CFG.mg.cool * dt * (G.trigger && !G.overheat ? 0.25 : 1));
    if (G.overheat && G.heat < 0.35) G.overheat = false;
    if (G.trigger && !G.overheat) {
      G.mgCd -= dt;
      while (G.mgCd <= 0 && !G.overheat) {
        fireMG(true, G.camX + G.aimSX, G.camY + G.aimSY);
        G.mgCd += 1 / G.k.mgRate;
        findLock();
        if (G.heat >= 1) {
          G.overheat = true;
          SFX.overheat();
          floatText(G.camX + G.aimSX, G.camY + G.aimSY + 8, 'OVERHEAT', U.red);
        }
      }
    } else G.mgCd = Math.max(0, G.mgCd - dt);
    if (G.heReload > 0) {
      G.heReload = Math.max(0, G.heReload - dt);
      if (G.heReload <= 0) {
        if (G.heQueue) {
          G.heQueue = false;
          fireHE(true, G.camX + G.aimSX, G.camY + G.aimSY);
        } else SFX.ready();
      }
    }
    if (!G.result && tr.s <= G.goalS) arrive();
    // the wallet passes the price of another upgrade: UPGRADE READY
    const n = affordableCount(wallet());
    if (n > G.afford) {
      G.readyT = 2;
      SFX.upgrade();
    }
    G.afford = n;
  } else {
    G.aimSX = W / 2;
    G.aimSY = H / 2;
    if (G.demo) attract(dt);
    else if (mode === 'ending') {
      G.endT += dt;
      if (G.endT > 3.4 && (G.result !== 'safe' || tr.v < 0.5) || G.endT > 14) endGame();
    }
  }
  G.hitT = Math.max(0, G.hitT - dt);
  G.muzzle[0] = Math.max(0, G.muzzle[0] - dt);
  G.muzzle[1] = Math.max(0, G.muzzle[1] - dt);
  G.killBump = Math.max(0, G.killBump - dt * 6);
  G.cashPulse = Math.max(0, G.cashPulse - dt * 3);
  G.readyT = Math.max(0, G.readyT - dt);
  updateStation(dt);
  updateZombies(dt);
  updateRounds(dt);
  updateBodies(dt);
  updateFireSpots(dt);
  updateFX(dt);
  // every 3 s the marks on the ground fade a little
  G.decalT += dt;
  if (G.decalT > 3) {
    G.decalT = 0;
    const [i0, j0, i1, j1] = viewChunks();
    fadeDecals(i0, j0, i1, j1);
  }
}
