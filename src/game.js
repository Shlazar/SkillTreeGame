// game.js - the game: the view over the endless field, the horde, the two guns, kills, streaks,
// fuel and the end of a sortie. Behind the title the same game runs as a demo: the gunship works
// the horde on its own. Units are world pixels and seconds; y on the ground is squashed by FORE.

const CFG = {
  fuel: 60,                    // seconds of flight
  pan: 150,                    // px per second with WASD or the mouse at the screen edge
  lock: 16,                    // px round the sight that a zombie is locked within
  // 25mm: rounds per second, flight time, spread without a lock, burst radius, most zombies one
  // round can hit, heat per round, cooling per second
  mg: { rate: 12, travel: 0.45, spread: 5, splash: 7, victims: 4, heatPer: 0.025, cool: 0.55 },
  // 105mm: reload, flight time, kill radius, hurt radius (a hurt walker dies too, a brute may not)
  he: { reload: 2.4, travel: 1.1, kill: 34, hurt: 56 },
  // the horde: zombies at the start, more each second, the most at once
  pop: { start: 160, perSec: 8, max: 700 },
  types: [
    { hp: 1, speed: [11, 16], value: 1 },                 // walker
    { hp: 1, speed: [30, 38], value: 2, run: true },      // runner
    { hp: 8, speed: [7, 9], value: 10, big: true }        // brute
  ]
};
// streak bonuses: [kills in a row, cash]
const STREAKS = [[10, 5], [25, 15], [50, 30], [100, 60], [200, 120]];
const CAMS = ['COLOUR', 'WHITE HOT', 'BLACK HOT'];

// G = this sortie (or the demo behind the title). mode = 'title', 'play', 'ending' or 'summary'.
// thermal = camera: 0 colour, 1 white hot, 2 black hot.
let G = null, mode = 'title', paused = false, realT = 0, frameDt = 0, sumStart = 0, thermal = 0;

// best score, kept in this browser
const BEST_KEY = 'sky-reaper-best';
const best = { kills: 0, cash: 0 };
function loadBest() {
  try {
    const o = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    best.kills = Math.max(0, o.kills | 0);
    best.cash = Math.max(0, o.cash | 0);
  } catch (e) { /* no storage: the best is not kept */ }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* ignore */ }
}

// ---------- sortie
function newGame(demo) {
  // start over open ground, away from the groves
  let x = 0, y = 0;
  for (let k = 0; k < 60; k++) {
    x = Math.round(rnd(-30000, 30000));
    y = Math.round(rnd(-30000, 30000));
    if (vnoise(x / 110, y / 110, 41) < 0.6 && fieldAt(x, y) < 0.6) break;
  }
  G = {
    demo: !!demo, t: 0, run: 0, fuel: CFG.fuel, endT: 0,
    kills: 0, cash: 0, shownCash: 0, cashPulse: 0, killBump: 0, shots: 0, hits: 0, bestBlast: 0,
    trigger: false, mgCd: 0, heat: 0, overheat: false, heReload: 0, heQueue: false, hitT: 0, muzzle: [0, 0],
    T: { x, y }, C: { x, y }, pan: [0, 0], panV: [0, 0], camX: 0, camY: 0, aimSX: W / 2, aimSY: H / 2,
    lock: null, box: null,
    zombies: [], bodies: [], rounds: [],
    streak: { n: 0, t: -9, best: 0 },
    spawnCd: 0, attractT: 1.2, burst: null, decalT: 0, warnT: 0, sum: null
  };
  clearFX();
  GRID.clear();
  placeCamera();
  spawnScatter(demo ? 260 : CFG.pop.start);
}
function startGame() {
  audioInit();
  newGame(false);
  mode = 'play';
  paused = false;
  banner('CLEARED HOT', '60 SECONDS OF FUEL. KILL THEM ALL.', U.gold);
  SFX.radio();
}
function endGame() {
  mode = 'summary';
  sumStart = realT;
  G.trigger = false;
  const nb = G.kills > best.kills;
  G.sum = {
    kills: G.kills, cash: Math.round(G.cash), streak: G.streak.best, blast: G.bestBlast,
    acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, newBest: nb && G.kills > 0
  };
  if (nb) best.kills = G.kills;
  best.cash = Math.max(best.cash, Math.round(G.cash));
  saveBest();
}
function toTitle() {
  newGame(true);
  mode = 'title';
  paused = false;
}
const scoring = () => !G.demo && (mode === 'play' || mode === 'ending');

// ---------- the view
function placeCamera() {
  G.camX = Math.round(G.T.x - W / 2);
  G.camY = Math.round(G.T.y - H / 2);
}
// chunks in view: [first column, first row, last column, last row]
function viewChunks() {
  return [Math.floor(G.camX / CH), Math.floor(G.camY / CH), Math.floor((G.camX + W) / CH), Math.floor((G.camY + H) / CH)];
}
function updateCamera(dt) {
  // WASD slides the view, and so does the mouse held at an edge of the screen
  let px = G.pan[0], py = G.pan[1];
  if (mode === 'play' && M.inside) {
    const ex = M.x / W * 2 - 1, ey = M.y / H * 2 - 1;
    px = clamp(px + Math.sign(ex) * smooth(0.93, 0.995, Math.abs(ex)), -1, 1);
    py = clamp(py + Math.sign(ey) * smooth(0.9, 0.99, Math.abs(ey)), -1, 1);
  }
  if (G.demo) {
    px = Math.cos(G.t * 0.07) * 0.1;
    py = Math.sin(G.t * 0.05) * 0.1;
  }
  const k = Math.min(1, dt * 6);
  G.panV[0] += (px * CFG.pan - G.panV[0]) * k;
  G.panV[1] += (py * CFG.pan - G.panV[1]) * k;
  G.T.x += G.panV[0] * dt;
  G.T.y += G.panV[1] * dt;
  // the packs' meeting point trails the view
  const kc = Math.min(1, dt * 0.25);
  G.C.x += (G.T.x - G.C.x) * kc;
  G.C.y += (G.T.y - G.C.y) * kc;
  placeCamera();
  // the sight: the mouse in play, the middle of the view otherwise
  if (mode === 'play') {
    G.aimSX = clamp(M.x, 0, W - 1);
    G.aimSY = clamp(M.y, 0, H - 1);
  } else {
    G.aimSX = W / 2;
    G.aimSY = H / 2;
  }
}

// ---------- the horde
// The dead move in packs: each pack drifts to its own spot near the middle of the view.
function newPack(p) {
  const a = rnd(TAU), r = rnd(20, 150);
  p = p || {};
  p.ox = Math.cos(a) * r;
  p.oy = Math.sin(a) * r * FORE;
  p.next = G.t + rnd(6, 14);
  return p;
}
function makeZombie(x, y, type, pk) {
  const T = CFG.types[type], sets = ZS[type];
  return {
    x, y, type, S: sets[(Math.random() * sets.length) | 0], hp: T.hp, max: T.hp, value: T.value, run: !!T.run, big: !!T.big,
    sp: rnd(T.speed[0], T.speed[1]), pack: pk, jx: rnd(-14, 14), jy: rnd(-10, 10), wob: rnd(TAU), anim: rnd(2),
    left: Math.random() < 0.5, vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, pending: 0, block: [], blockT: rnd(0.5),
    dead: false, gone: false, d: 0
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
  const p = newPack();
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(Math.random()) * (8 + n * 1.5), b = rnd(TAU);
    G.zombies.push(makeZombie(hx + Math.cos(b) * r, hy + Math.sin(b) * r * FORE, pickType(), p));
  }
}
// a pack walks in from just outside the view
function spawnHorde(n) {
  const a = rnd(TAU), c = Math.cos(a), s = Math.sin(a);
  const k = 1 / Math.max(Math.abs(c) / (W / 2), Math.abs(s) / (H / 2)) + rnd(30, 70);
  pack(n, G.T.x + c * k, G.T.y + s * k);
}
// packs all over the view and round it (the start of a sortie)
function spawnScatter(n) {
  while (n > 0) {
    const m = Math.min(n, rndi(6, 22));
    pack(m, G.T.x + rnd(-0.65, 0.65) * W, G.T.y + rnd(-0.65, 0.65) * H);
    n -= m;
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

function updateZombies(dt) {
  const zs = G.zombies;
  // more of the dead walk in as the sortie goes on
  const want = G.demo ? 260 : Math.min(CFG.pop.max, CFG.pop.start + CFG.pop.perSec * G.run);
  G.spawnCd -= dt;
  if (G.spawnCd <= 0 && zs.length < want) {
    spawnHorde(Math.min(Math.ceil(want - zs.length), rndi(10, 25)));
    G.spawnCd = 0.45;
  }
  const kb = Math.exp(-5 * dt), far = (W + H) * 1.6;
  for (const z of zs) {
    if (z.dead) continue;
    const pk = z.pack;
    if (G.t > pk.next) newPack(pk);
    // walk to the pack's spot, weaving a little
    const dx = G.C.x + pk.ox + z.jx - z.x, dy = (G.C.y + pk.oy + z.jy - z.y) / FORE, d = Math.hypot(dx, dy) || 1;
    z.wob += dt * (z.run ? 2 : 0.8);
    const w = Math.sin(z.wob) * (z.run ? 0.25 : 0.45), cw = Math.cos(w), sw = Math.sin(w);
    const ux = (dx * cw - dy * sw) / d, uy = (dx * sw + dy * cw) / d;
    const sp = z.sp * (d < 12 ? 0.15 : 1) * (z.flash > 0 ? 0.3 : 1);
    z.vx = ux * sp + z.kbx;
    z.vy = uy * sp * FORE + z.kby;
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    z.kbx *= kb;
    z.kby *= kb;
    if (Math.abs(ux) > 0.3) z.left = ux < 0;
    z.anim += dt * (0.6 + sp / 3.2);
    if (z.flash > 0) z.flash -= dt;
    if (Math.abs(z.x - G.T.x) > far || Math.abs(z.y - G.T.y) > far) z.gone = true;
  }
  gridBuild();
  // spacing in the crowd, and round trees, rocks, wrecks and walls
  for (const a of zs) {
    if (a.dead) continue;
    const ra = a.big ? 6 : 3.5, i0 = Math.floor(a.x / GC), j0 = Math.floor(a.y / GC);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const list = GRID.get(gk(i, j));
      if (!list) continue;
      for (const b of list) {
        if (b === a) continue;
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
// cause = 'mg' (a 25mm round) or 'he' (the 105 at (cx, cy), dist away)
function kill(z, cause, cx, cy, dist) {
  if (z.dead) return;
  z.dead = true;
  z.hp = 0;
  if (G.lock === z) G.lock = null;
  const sc = scoring(), S = z.S, bs = G.bodies;
  if (sc) {
    G.kills++;
    G.cash += z.value;
    G.killBump = 1;
    streak(1);
  }
  if (cause === 'mg') {
    // knocked over backwards, away from the gun
    if (bs.length < 160) bs.push({ S, x: z.x, y: z.y, z: 0, vx: rnd(-8, 8), vy: -rnd(10, 22), vz: rnd(22, 40), spin: 0, rot: 0, fall: true, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 14 : 8, S.h * 0.6);
    part({ x: z.x, y: z.y, z: S.h * 0.5, vx: rnd(-4, 4), vy: rnd(-6, 0), vz: rnd(4, 10), g: 0, life: 0.45, max: 0.45, s: 3,
      c: 'rgba(110,24,20,0.55)', grow: 7, drag: 3, smoke: true });
    if (sc) addTotal(z.x, z.y - S.h, z.value, U.gold, false);
    if (!G.demo) SFX.splat();
  } else {
    // thrown away from the blast, turning over
    const dx = z.x - cx, dy = (z.y - cy) / FORE, l = Math.hypot(dx, dy) || 1, f = 1 - Math.min(1, dist / CFG.he.hurt);
    const v = (35 + f * 80) * (z.big ? 0.4 : 1) * rnd(0.8, 1.2);
    if (bs.length < 160) bs.push({ S, x: z.x, y: z.y, z: 2, vx: dx / l * v, vy: dy / l * v * FORE,
      vz: (50 + f * 130) * (z.big ? 0.5 : 1) * rnd(0.8, 1.2), spin: rnd(8, 16) * (dx < 0 ? -1 : 1), rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 10 : 4, S.h * 0.5);
    if (Math.random() < 0.4) part({ x: z.x, y: z.y, z: rnd(4, 9), vx: rnd(-10, 10), vy: rnd(-5, 5), vz: rnd(12, 30), g: -6,
      life: rnd(0.4, 0.8), max: 0.8, s: 1, c: pick(['#ff8a3a', '#ffc27a']), add: true, drag: 1.5 });
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
  // a brute takes the hit: blood and a step back
  blood(z.x, z.y, 4, z.S.h * 0.6);
  z.kby -= 12;
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
    z.d = d;
    NEAR.push(z);
  });
  NEAR.sort((a, b) => a.d - b.d);
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
// The 105 lands: everything near dies, the edge of the blast throws the rest back.
function explode(x, y, player) {
  let killed = 0, value = 0;
  queryEll(x, y, CFG.he.hurt, (z, d) => {
    if (d >= CFG.he.kill) {
      const dx = z.x - x, dy = (z.y - y) / FORE, l = Math.hypot(dx, dy) || 1;
      z.hp -= 4;
      z.flash = 0.25;
      z.kbx += dx / l * 60;
      z.kby += dy / l * 60 * FORE;
      if (z.hp > 0) return;
    }
    value += z.value;
    killed++;
    kill(z, 'he', x, y, d);
  });
  // the flash and the fireball, with smaller bursts round it
  lights.push({ x, y, z: 6, r: 90, c: '#ff8a3a', life: 0.35, max: 0.35, a: 0.9 });
  lights.push({ x, y, z: 6, r: 40, c: '#fff6e0', life: 0.12, max: 0.12, a: 1 });
  addBoom(x, y, 26, 7, 0.75, 11);
  for (let k = 0; k < 4; k++) {
    const a = rnd(TAU), r = rnd(10, 22);
    addBoom(x + Math.cos(a) * r, y + Math.sin(a) * r * FORE, 12, 4, 0.5, 6, rnd(0.03, 0.15));
  }
  rings.push({ x, y, r0: 8, r1: CFG.he.kill * 1.25, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x, y, r0: 20, r1: CFG.he.hurt * 1.5, t: 0, T: 0.55, c: '#a89878' });
  // smoke that rolls up and drifts
  for (let k = 0; k < 16; k++) part({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), z: rnd(4, 18), vx: rnd(-14, 14) + 4, vy: rnd(-6, 6),
    vz: rnd(10, 34), g: 0, life: rnd(1.4, 2.8), max: 2.8, s: rnd(4, 8),
    c: pick(['rgba(58,50,46,0.75)', 'rgba(40,36,34,0.7)', 'rgba(74,64,56,0.6)']), grow: 6, drag: 1, smoke: true });
  // earth thrown up: it lands and stays
  for (let k = 0; k < 34; k++) {
    const a = rnd(TAU), s = rnd(30, 130);
    part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(60, 170), g: 320, life: 2, max: 2,
      s: Math.random() < 0.3 ? 2 : 1, c: pick(['#4c4032', '#362d24', '#5e5140', '#2a241d']), land: 1 });
  }
  // sparks
  for (let k = 0; k < 18; k++) {
    const a = rnd(TAU), s = rnd(30, 120);
    part({ x, y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 140), g: 140, life: rnd(0.4, 0.9), max: 0.9,
      s: 1, c: pick(['#ffe2a0', '#ffb347', '#ff6a28']), add: true, drag: 1.2 });
  }
  // small fires left burning in the crater
  for (let k = 0; k < 4 && flames.length < 40; k++) {
    const a = rnd(TAU), r = rnd(6, 24);
    flames.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FORE, life: rnd(3, 7), seed: rnd(100) });
  }
  stampScorch(x, y, 3);
  if (!G.demo) {
    addShake(0.75);
    hitStop(killed >= 12 ? 0.1 : 0.04, 0.25);
    SFX.boom();
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
// The title screen: the gunship works the horde on its own.
function attract(dt) {
  const b = G.burst;
  if (b) {
    b.cd -= dt;
    while (b.cd <= 0 && b.n > 0) {
      fireMG(false, b.x, b.y);
      b.n--;
      b.cd += 1 / CFG.mg.rate;
    }
    if (b.n <= 0) G.burst = null;
  }
  G.attractT -= dt;
  if (G.attractT > 0 || !G.zombies.length) return;
  G.attractT = rnd(1.4, 3.2);
  const z = pick(G.zombies);
  if (Math.abs(z.x - G.T.x) > W * 0.35 || Math.abs(z.y - G.T.y) > H * 0.35) return;
  if (Math.random() < 0.4) fireHE(false, z.x, z.y);
  else G.burst = { x: z.x, y: z.y, n: 12, cd: 0 };
}

// ---------- one step of the game (STEP seconds)
function step(dt) {
  G.t += dt;
  updateCamera(dt);
  if (mode === 'play') {
    G.run += dt;
    G.fuel -= dt;
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
    if (G.fuel < 10) {
      G.warnT -= dt;
      if (G.warnT <= 0) {
        G.warnT = 2;
        SFX.warn();
      }
    }
    if (G.fuel <= 0) {
      G.fuel = 0;
      mode = 'ending';
      G.endT = 0;
      G.trigger = false;
      G.lock = null;
      banner('BINGO FUEL', 'RETURNING TO BASE', U.amber, 5);
      SFX.radio();
    }
  } else if (mode === 'title') attract(dt);
  else if (mode === 'ending') {
    G.endT += dt;
    if (G.endT > 2.6) endGame();
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
