// game.js - the game: a train runs north along the railway to the safe zone, and the gunship above
// keeps it alive. The dead walk in from the left and the right; the ones ahead of the train step
// onto the rails and wait for it. The engine runs them down, but each one slows it, and the dead
// that reach the train climb on and tear at it. Behind the title the same game runs as a demo.
// Units are world pixels and seconds; y on the ground is squashed by FORE; the train runs to -y.

const CFG = {
  trip: 1800,                  // px of railway from the start to the safe zone
  // the train: top speed (px/s), how fast it gets back up to speed, its health
  train: { cruise: 26, accel: 7, hp: 150 },
  lock: 16,                    // px round the sight that a zombie is locked within
  // 25mm: rounds per second, flight time, spread without a lock, burst radius, most zombies one
  // round can hit, heat per round, cooling per second
  mg: { rate: 12, travel: 0.45, spread: 5, splash: 7, victims: 4, heatPer: 0.025, cool: 0.55 },
  // 105mm: reload, flight time, kill radius, hurt radius (a hurt walker dies too, a brute may not),
  // and how close to the train a blast hurts the train too
  he: { reload: 2.4, travel: 1.1, kill: 34, hurt: 56, close: 28 },
  // the horde: zombies at the start, more each second, the most at once
  pop: { start: 110, perSec: 5, max: 480 },
  // dps = damage to the train each second while it holds on
  types: [
    { hp: 1, speed: [11, 16], value: 1, dps: 0.5 },                // walker
    { hp: 1, speed: [32, 40], value: 2, dps: 0.5, run: true },     // runner
    { hp: 8, speed: [8, 10], value: 10, dps: 2, big: true }        // brute
  ]
};
// the cars: length on the ground, the gap between two, half the width, how many (TRAIN in sprites)
const CAR = { L: 28, gap: 4, half: 8, n: 5 };
// streak bonuses: [kills in a row, cash]
const STREAKS = [[10, 5], [25, 15], [50, 30], [100, 60], [200, 120]];
const CAMS = ['COLOUR', 'WHITE HOT', 'BLACK HOT'];

// G = this run (or the demo behind the title). mode = 'title', 'play', 'ending' or 'summary'.
// thermal = camera: 0 colour, 1 white hot, 2 black hot.
let G = null, mode = 'title', paused = false, realT = 0, frameDt = 0, sumStart = 0, thermal = 0;

// best score, kept in this browser
const BEST_KEY = 'sky-reaper-train';
const best = { kills: 0, safe: 0 };
function loadBest() {
  try {
    const o = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    best.kills = Math.max(0, o.kills | 0);
    best.safe = Math.max(0, o.safe | 0);
  } catch (e) { /* no storage: the best is not kept */ }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* ignore */ }
}

// ---------- a run
function newGame(demo) {
  const y0 = Math.round(rnd(-40000, 40000));
  G = {
    demo: !!demo, t: 0, run: 0, endT: 0, result: '', bonus: 0,
    kills: 0, cash: 0, shownCash: 0, cashPulse: 0, killBump: 0, shots: 0, hits: 0, bestBlast: 0,
    trigger: false, mgCd: 0, heat: 0, overheat: false, heReload: 0, heQueue: false, hitT: 0, muzzle: [0, 0],
    // the train: front = ground y of the engine's nose, v = speed, hit[k] = car k flashes red
    tr: { front: y0, start: y0, v: CFG.train.cruise, hp: CFG.train.hp, hit: [0, 0, 0, 0, 0], clack: 0, smokeT: 0, hornT: 0, hpShown: CFG.train.hp },
    goalY: demo ? -1e9 : y0 - CFG.trip,
    camX: 0, camY: 0, aimSX: W / 2, aimSY: H / 2,
    lock: null, box: null,
    zombies: [], bodies: [], rounds: [], timers: [], statics: [],
    streak: { n: 0, t: -9, best: 0 },
    spawnCd: 0, railCd: rnd(5, 7), onTrain: 0, blocked: false, decalT: 0, sum: null,
    bot: false, botT: 0, botZ: null
  };
  clearFX();
  GRID.clear();
  placeCamera();
  if (!demo) buildSafeZone();
  scatter();
}
function startGame() {
  audioInit();
  newGame(false);
  mode = 'play';
  paused = false;
  banner('PROTECT THE TRAIN', 'GET IT TO THE SAFE ZONE', U.gold);
  SFX.horn();
}
function endGame() {
  mode = 'summary';
  sumStart = realT;
  G.trigger = false;
  const nb = G.kills > best.kills;
  G.sum = {
    result: G.result, kills: G.kills, cash: Math.round(G.cash), streak: G.streak.best, blast: G.bestBlast,
    acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, hp: Math.round(G.tr.hp / CFG.train.hp * 100), newBest: nb && G.kills > 0
  };
  if (nb) best.kills = G.kills;
  if (G.result === 'safe') best.safe++;
  saveBest();
}
function toTitle() {
  newGame(true);
  mode = 'title';
  paused = false;
}
const scoring = () => !G.demo && (mode === 'play' || mode === 'ending');
// Run f after t seconds of game time.
function later(t, f) {
  G.timers.push({ t, f });
}

// ---------- the train
const carFront = (k) => Math.round(G.tr.front) + k * (CAR.L + CAR.gap);      // ground y of car k's front end
const carBack = (k) => carFront(k) + CAR.L;                                  // and of its back end
const trainTail = () => carBack(CAR.n - 1);
const carAt = (y) => clamp(Math.floor((y - Math.round(G.tr.front)) / (CAR.L + CAR.gap)), 0, CAR.n - 1);
// How far (x, y) on the ground is from the train (0 = on it); ahead = px the train will have moved on.
function trainDist(x, y, ahead) {
  const a = ahead || 0, dx = Math.max(0, Math.abs(x - RAIL_X) - CAR.half);
  const dy = Math.max(0, carFront(0) - a - 6 - y, y - (trainTail() - a)) / FORE;
  return Math.hypot(dx, dy);
}
function hurtTrain(a, car) {
  if (G.demo || G.result) return;
  const tr = G.tr, was = tr.hp, low = CFG.train.hp * 0.35;
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
  const y = G.goalY, st = G.statics;
  for (let x = RAIL_X - 640; x <= RAIL_X + 640; x += 16) {
    if (Math.abs(x - RAIL_X) < 24) continue;
    st.push({ d: SAFE.blocks[mod(x >> 4, SAFE.blocks.length)], x, y, k: y });
  }
  for (const s of [-1, 1]) {
    st.push({ d: SAFE.pillar, x: RAIL_X + s * 17, y: y + 1, k: y + 1 });
    st.push({ d: SAFE.tower, x: RAIL_X + s * 46, y: y - 4, k: y - 4, tower: s });
  }
}
// The train gets through the gate: the guards shoot the dead off it, the survivors are safe.
function arrive() {
  G.result = 'safe';
  mode = 'ending';
  G.endT = 0;
  G.trigger = false;
  G.lock = null;
  G.bonus = Math.round(G.tr.hp / CFG.train.hp * 100) * 2;
  G.cash += G.bonus;
  banner('TRAIN SAFE', 'THE SURVIVORS MADE IT.  +$' + G.bonus, U.gold, 9);
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
    const x = RAIL_X + rnd(-3, 3), y = carFront(k) + CAR.L * 0.5;
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
  const T = CFG.types[type], sets = ZS[type];
  return {
    x, y, type, S: sets[(Math.random() * sets.length) | 0], hp: T.hp, max: T.hp, value: T.value, run: !!T.run, big: !!T.big,
    sp: rnd(T.speed[0], T.speed[1]), dps: T.dps, wob: rnd(TAU), anim: rnd(2), left: Math.random() < 0.5,
    vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, pending: 0, block: [], blockT: rnd(0.5), dead: false, gone: false, qd: 0, k: y,
    // st: 0 walking, 1 on the rails ahead of the train, 2 holding on to the train
    st: 0, rx: rnd(-3, 3), side: 0, car: 0, ady: 0, ox: 0, bang: 0, dmg: 0
  };
}
function pickType() {
  const r = Math.random();
  if (G.demo) return r < 0.03 ? 2 : r < 0.1 ? 1 : 0;
  if (G.run > 15 && r < 0.05) return 2;
  if (G.run > 5 && r < 0.17) return 1;
  return 0;
}
function pack(n, hx, hy) {
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(Math.random()) * (8 + n * 1.5), b = rnd(TAU);
    G.zombies.push(makeZombie(hx + Math.cos(b) * r, hy + Math.sin(b) * r * FORE, pickType()));
  }
}
// A pack walks in from beyond the left or right edge, or from ahead, off to one side.
function sidePack(n) {
  const side = Math.random() < 0.5 ? -1 : 1;
  let x, y;
  if (Math.random() < 0.55) {
    x = RAIL_X + side * (W / 2 + rnd(20, 60));
    y = G.camY + rnd(-200, H * 0.5);
  } else {
    x = RAIL_X + side * rnd(60, W / 2);
    y = G.camY - rnd(30, 180);
  }
  if (y > G.goalY + 40) pack(n, x, y);
}
// A crowd standing on the rails ahead of the train.
function railGroup(n, y) {
  if (y < G.goalY + 60) return;
  for (let k = 0; k < n; k++) {
    const z = makeZombie(RAIL_X + rnd(-3, 3), y - k * rnd(3, 8), pickType());
    z.st = 1;
    z.rx = z.x - RAIL_X;
    G.zombies.push(z);
  }
}
// the start: packs on both sides of the track, most of them ahead, and a crowd on the rails ahead
function scatter() {
  for (let k = 0; k < 10; k++) pack(rndi(5, 12), RAIL_X + (Math.random() < 0.5 ? -1 : 1) * rnd(90, W / 2), G.camY + rnd(-160, H * 0.4));
  railGroup(5, carFront(0) - 110);
}
function spawn(dt) {
  const want = G.demo ? 300 : Math.min(CFG.pop.max, CFG.pop.start + CFG.pop.perSec * G.run);
  G.spawnCd -= dt;
  if (G.spawnCd <= 0 && G.zombies.length < want) {
    sidePack(rndi(3, 7) + Math.floor(G.run / 15));
    G.spawnCd = rnd(0.3, 0.6);
  }
  G.railCd -= dt;
  if (G.railCd <= 0) {
    railGroup(rndi(3, 6) + Math.floor(G.run / 12), G.camY - rnd(10, 80));
    G.railCd = Math.max(3.2, rnd(7, 10) - G.run * 0.05);
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

// The dead take hold of the train: side -1 / 1 = on its left / right side, 0 = on the engine's nose.
function attach(z, side) {
  const rel = z.y - carFront(0);
  z.st = 2;
  z.side = side;
  z.dmg = 0;
  z.bang = rnd(TAU);
  z.kbx = z.kby = 0;
  if (side === 0) {
    z.car = 0;
    z.ox = clamp(z.x - RAIL_X, -6, 6);
    z.left = z.x > RAIL_X;
  } else {
    z.car = carAt(z.y);
    z.ady = clamp(rel - z.car * (CAR.L + CAR.gap), 4, CAR.L - 6);
    z.ox = rnd(0, 2);
    z.left = side > 0;
  }
}
// The engine runs one down: it dies, and the train loses speed.
function crush(z) {
  const tr = G.tr, F = carFront(0);
  tr.v *= z.big ? 0.35 : 0.85;
  kill(z, 'train', 0, 0, 0);
  hurtTrain(z.big ? 5 : 1, 0);
  for (let k = 0; k < 5; k++) part({ x: RAIL_X + (k & 1 ? 5 : -5), y: F + 2, z: 1, vx: rnd(-30, 30), vy: rnd(-10, 25), vz: rnd(10, 40),
    g: 140, life: rnd(0.2, 0.4), max: 0.4, s: 1, c: pick(['#ffe2a0', '#ffb347']), add: true, drag: 2 });
  if (!G.demo) {
    addShake(z.big ? 0.35 : 0.08);
    SFX.crush(z.big);
  }
}

function updateZombies(dt) {
  const zs = G.zombies, tr = G.tr, F = carFront(0), T = trainTail(), hw = CAR.half;
  if (!G.result) spawn(dt);
  const kb = Math.exp(-5 * dt), behind = G.camY + H + 140, wide = W / 2 + 240;
  let onTrain = 0, ahead = 1e9;
  for (const z of zs) {
    if (z.dead) continue;
    if (z.flash > 0) z.flash -= dt;
    if (z.st === 2) {
      // holding on: it rides along and claws at the car
      onTrain++;
      z.bang += dt * (z.run ? 11 : 8);
      const lunge = Math.sin(z.bang) > 0.5 ? 1 : 0;
      if (z.side === 0) {
        z.x = RAIL_X + z.ox;
        z.y = F - 3 + lunge;
      } else {
        z.x = RAIL_X + z.side * (hw + 2 + z.ox - lunge);
        z.y = carFront(z.car) + z.ady;
      }
      z.k = carBack(z.car) + 0.5;
      z.vx = 0;
      z.vy = -tr.v;
      z.anim += dt * 5;
      z.dmg += z.dps * dt;
      if (z.dmg >= 1) {
        z.dmg -= 1;
        hurtTrain(1, z.car);
      }
      continue;
    }
    // where to walk: onto the rails ahead of the train, to its side, or after it
    const side = z.x < RAIL_X ? -1 : 1;
    let tx, ty;
    if (z.st === 1) { tx = RAIL_X + z.rx; ty = z.y + 40; }
    else if (z.y < F - 6) { tx = RAIL_X + z.rx; ty = z.y + 6; }
    else if (z.y < T + 6) { tx = RAIL_X + side * (hw + 3); ty = z.y; }
    else { tx = RAIL_X + side * (hw + 3); ty = T; }
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
    if (z.st === 0 && z.y < F - 6 && Math.abs(z.x - RAIL_X - z.rx) < 2.5) z.st = 1;
    // the engine runs it down, or (too slow to crush it) it climbs onto the nose; beside the train
    // it climbs on. Not once the train is safe.
    const ax = Math.abs(z.x - RAIL_X);
    if (G.result !== 'safe') {
      if (ax < hw + 2 && z.y > F - 5 && z.y < F + 6) {
        if (tr.v > 7 && !G.result) crush(z);
        else attach(z, 0);
        continue;
      }
      if (z.y >= F && z.y <= T && ax < hw + 4) {
        attach(z, side);
        continue;
      }
    }
    if (z.st === 1 && z.y < F) ahead = Math.min(ahead, F - z.y);
    if (z.y > behind || ax > wide) z.gone = true;
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
  // spacing in the crowd, round trees and walls, and never inside the train or past the safe zone wall
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
    if (a.y > F && a.y < T && Math.abs(a.x - RAIL_X) < hw + 2) a.x = RAIL_X + (a.x < RAIL_X ? -1 : 1) * (hw + 2);
    if (a.y < G.goalY + 8) a.y = G.goalY + 8;
  }
  // drop the dead and the lost
  let j = 0;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead && !zs[i].gone) zs[j++] = zs[i];
  zs.length = j;
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
    if (z.pending < z.hp) {
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
    G.heat = Math.min(1, G.heat + CFG.mg.heatPer);
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
    G.heReload = CFG.he.reload;
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
function streak(n) {
  const s = G.streak;
  if (G.t - s.t > 1.6) s.n = 0;
  const before = s.n;
  s.n += n;
  s.t = G.t;
  s.best = Math.max(s.best, s.n);
  for (const [m, bonus] of STREAKS) if (before < m && s.n >= m) {
    G.cash += bonus;
    banner('STREAK ×' + m, '+$' + bonus + ' BONUS', U.gold, 1);
    SFX.streak();
  }
}
// cause = 'mg' (a 25mm round), 'he' (the 105 at (cx, cy), dist away) or 'train' (run down).
// free = not the player's kill (no score).
function kill(z, cause, cx, cy, dist, free) {
  if (z.dead) return;
  z.dead = true;
  z.hp = 0;
  if (G.lock === z) G.lock = null;
  const sc = scoring() && !free, S = z.S, bs = G.bodies, room = bs.length < 160;
  if (sc) {
    G.kills++;
    G.cash += z.value;
    G.killBump = 1;
    streak(1);
  }
  if (cause === 'he') {
    // thrown away from the blast, turning over
    const dx = z.x - cx, dy = (z.y - cy) / FORE, l = Math.hypot(dx, dy) || 1, f = 1 - Math.min(1, dist / CFG.he.hurt);
    const v = (35 + f * 80) * (z.big ? 0.4 : 1) * rnd(0.8, 1.2);
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: dx / l * v, vy: dy / l * v * FORE,
      vz: (50 + f * 130) * (z.big ? 0.5 : 1) * rnd(0.8, 1.2), spin: rnd(8, 16) * (dx < 0 ? -1 : 1), rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 10 : 4, S.h * 0.5);
    if (Math.random() < 0.4) part({ x: z.x, y: z.y, z: rnd(4, 9), vx: rnd(-10, 10), vy: rnd(-5, 5), vz: rnd(12, 30), g: -6,
      life: rnd(0.4, 0.8), max: 0.8, s: 1, c: pick(['#ff8a3a', '#ffc27a']), add: true, drag: 1.5 });
  } else if (cause === 'train') {
    // run down: flung aside and ahead, a burst of blood
    const s = z.x < RAIL_X ? -1 : 1;
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: s * rnd(40, 80), vy: -rnd(15, 35), vz: rnd(40, 80),
      spin: rnd(10, 18) * s, rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 16 : 10, S.h * 0.6);
    if (sc) addTotal(z.x, z.y - S.h, z.value, U.gold, false);
  } else {
    // a 25mm round: knocked over backwards, away from the gun, or off the side of the train
    const off = z.st === 2, s = z.side || (z.x < RAIL_X ? -1 : 1);
    if (room) bs.push(off
      ? { S, x: z.x, y: z.y, z: 3, vx: z.side ? s * rnd(25, 45) : rnd(-10, 10), vy: z.side ? rnd(-8, 8) - G.tr.v : -rnd(25, 45),
        vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 }
      : { S, x: z.x, y: z.y, z: 0, vx: rnd(-8, 8), vy: -rnd(10, 22), vz: rnd(22, 40), spin: 0, rot: 0, fall: true, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 14 : 8, S.h * 0.6);
    part({ x: z.x, y: z.y, z: S.h * 0.5, vx: rnd(-4, 4), vy: rnd(-6, 0), vz: rnd(4, 10), g: 0, life: 0.45, max: 0.45, s: 3,
      c: 'rgba(110,24,20,0.55)', grow: 7, drag: 3, smoke: true });
    if (sc) addTotal(z.x, z.y - S.h, z.value, U.gold, false);
    if (!G.demo) SFX.splat();
  }
  if (sc && (Math.random() < 0.3 || z.big) && coins.length < 45) coins.push({ x0: z.x - G.camX, y0: z.y - G.camY - 8, t: 0, T: rnd(0.55, 0.8) });
  if (z.big && !G.demo) {
    addShake(0.15);
    hitStop(0.05, 0.3);
  }
}
function hitZombie(z) {
  z.hp -= 1;
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
  rings.push({ x, y, r0: 8, r1: CFG.he.kill * 1.25, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x, y, r0: 20, r1: CFG.he.hurt * 1.5, t: 0, T: 0.55, c: '#a89878' });
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
// the train, the blast hurts the train as well.
function explode(x, y, player) {
  let killed = 0, value = 0;
  queryEll(x, y, CFG.he.hurt, (z, d) => {
    if (d >= CFG.he.kill) {
      z.hp -= 4;
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
  const td = trainDist(x, y);
  if (player && td < CFG.he.close && !G.demo && !G.result) {
    const a = Math.round(14 * (1 - td / CFG.he.close)) + 3, k = carAt(y);
    hurtTrain(a, k);
    floatText(RAIL_X, carFront(k) + 8, '-' + a, U.red);
    banner('CHECK FIRE!', 'YOUR SHELL HIT THE TRAIN', U.red, 3);
    SFX.radio();
  }
  if (player && scoring()) {
    G.bestBlast = Math.max(G.bestBlast, killed);
    if (killed) addTotal(x, y - 10, value, U.gold, true);
    if (killed >= 4) {
      const name = killed >= 25 ? 'MASSACRE' : killed >= 12 ? 'CARNAGE' : 'MULTI KILL';
      banner(name + ' ×' + killed, '+$' + value, killed >= 12 ? '#ff7a4a' : U.amber, 2);
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
// It shoots the dead on the train first, then the ones on the rails nearest the engine, then
// whoever is nearest the train; the 105 goes to a crowd on the rails well ahead of the train.
function autopilot(dt) {
  const F = carFront(0);
  G.botT -= dt;
  if (G.botT <= 0 || !G.botZ || G.botZ.dead) {
    G.botT = 0.2;
    let bestZ = null, bs = 1e9;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const sx = z.x - G.camX, sy = z.y - G.camY;
      if (sx < 6 || sx > W - 6 || sy < 26 || sy > H - 6) continue;
      const s = z.st === 2 ? Math.abs(z.y - F) : z.st === 1 && z.y < F ? 300 + F - z.y : 700 + trainDist(z.x, z.y);
      if (s < bs) { bs = s; bestZ = z; }
    }
    G.botZ = bestZ;
  }
  let he = null;
  for (const q of G.zombies) if (!q.dead && q.st === 1 && F - q.y > 110 && q.y - G.camY > 24) { he = q; break; }
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
    fireHE(false, b.he.x, b.he.y + b.he.vy * CFG.he.travel);
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
  if (b.he && G.heReload <= 0) fireHE(true, b.he.x, b.he.y + b.he.vy * CFG.he.travel);
}

// ---------- the view
// The train runs up the middle of the view (on the title, off to the right of the menu).
function placeCamera() {
  G.camX = Math.round(RAIL_X - W * (mode === 'title' && W >= 560 ? 0.72 : 0.5));
  G.camY = Math.round(G.tr.front) - Math.round(H * 0.38);
}
// chunks in view: [first column, first row, last column, last row]
function viewChunks() {
  return [Math.floor(G.camX / CH), Math.floor(G.camY / CH), Math.floor((G.camX + W) / CH), Math.floor((G.camY + H) / CH)];
}

// ---------- one step of the game (STEP seconds)
function step(dt) {
  G.t += dt;
  const tr = G.tr;
  // the train gets back up to speed after every bump. Lost, it stops; safe, it rolls on until the
  // whole train is inside the wall, then brakes.
  if (G.result === 'lost') tr.v = Math.max(0, tr.v - 30 * dt);
  else if (G.result === 'safe' && trainTail() < G.goalY - 14) tr.v = Math.max(0, tr.v - 12 * dt);
  else tr.v = Math.min(CFG.train.cruise, tr.v + CFG.train.accel * dt);
  tr.front -= tr.v * dt;
  for (let k = 0; k < CAR.n; k++) if (tr.hit[k] > 0) tr.hit[k] -= dt;
  // the little fires it runs over go out
  for (const f of flames) if (Math.abs(f.x - RAIL_X) < CAR.half + 2 && f.y > carFront(0) - 4 && f.y < trainTail() + 4) f.life = 0;
  tr.hpShown = Math.max(tr.hp, tr.hpShown - dt * 12);
  // wheels over the rail joints, and smoke from the stack
  tr.clack += tr.v * dt;
  if (tr.clack > 30) {
    tr.clack -= 30;
    if (!G.demo && mode !== 'summary') SFX.clack();
  }
  tr.smokeT -= dt;
  if (tr.smokeT <= 0 && G.result !== 'lost') {
    tr.smokeT = 0.16;
    part({ x: RAIL_X + rnd(-1, 1), y: carFront(0) + 15, z: 10, vx: rnd(-3, 3) + 3, vy: rnd(-2, 2), vz: rnd(14, 22), g: 0,
      life: rnd(1.6, 2.6), max: 2.6, s: rnd(2, 3), c: pick(['rgba(40,38,36,0.6)', 'rgba(56,52,48,0.55)']), grow: 3, drag: 0.8, smoke: true });
  }
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
        G.mgCd += 1 / CFG.mg.rate;
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
    if (!G.result && tr.front <= G.goalY - 6) arrive();
  } else {
    G.aimSX = W / 2;
    G.aimSY = H / 2;
    if (mode === 'title') attract(dt);
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
