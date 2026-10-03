/* The game: a gunship over an endless countryside at night. The crosshair follows the mouse and
 * locks onto the zombie nearest it; the 25mm leads its target and, held down over a crowd, spreads
 * its rounds one per zombie. Every round leaves the aircraft (below the bottom of the screen) and
 * falls into its target a moment later. Units are metres and seconds. */

const CFG = {
  fuel: 60,
  pan: 70,                                   // m/s with WASD or the screen edge
  lockPx: 26,                                // art pixels round the crosshair that a zombie is locked within
  mg: { rate: 12, travel: 0.5, spread: 1.4, splash: 2.6, victims: 4, heatPer: 0.025, cool: 0.55 },
  he: { reload: 2.4, travel: 1.2, kill: 11, hurt: 18 },
  pop: { start: 160, perSec: 8, max: 700 },
  types: [
    { hp: 1, speed: [1.1, 1.7], value: 1, heat: [0.86, 0.97], run: false },
    { hp: 1, speed: [4.2, 5.6], value: 2, heat: [0.92, 1.0], run: true },
    { hp: 8, speed: [0.85, 1.0], value: 10, heat: [1.0, 1.06], run: false },
  ],
};
const G_UP = new THREE.Vector3(-R2, 0, -R2);       // on the ground, the way that is up the screen

function createGame() {
  const S = {};
  const R = Math.random;

  function reset(keepPlace) {
    S.t = S.t || 0; S.run = 0; S.fuel = CFG.fuel; S.kills = 0; S.cash = 0; S.shots = 0; S.hits = 0; S.bestBlast = 0;
    S.mode = 'title'; S.endT = 0;
    S.trigger = false; S.mgCd = 0; S.mgHeat = 0; S.overheat = false; S.heReload = 0; S.hitT = 0;
    if (!keepPlace || !S.T) { const [x, z] = startSpot(); S.T = new THREE.Vector3(x, 0, z); S.C = new THREE.Vector3(x, 0, z); }
    S.pan = [0, 0]; S.panV = [0, 0];
    S.cursor = S.cursor || { x: 0.5, y: 0.5, inside: false }; S.cursorArt = [0, 0]; S.aim = new THREE.Vector3(); S.aimOK = false;
    S.lock = null; S.shake = 0;
    S.zombies = []; S.dying = []; S.rounds = []; S.flames = []; S.events = []; S.pops = []; S.marks = [];
    S.streak = { n: 0, t: -9, best: 0 };
    S.spawnCd = 0; S.attractT = 1.5; S.burst = null; S.nextId = 1;
    S.viewR = 130;
  }

  /* ------------------------------------------------------------ camera */
  const AP = [0, 0];
  function updateCamera(dt) {
    // WASD slides the view, and so does the crosshair held near an edge of the screen
    let px = S.pan[0], py = S.pan[1];
    if (S.mode === 'play' && S.cursor.inside) {
      const ex = S.cursor.x * 2 - 1, ey = S.cursor.y * 2 - 1;
      px = clamp(px + Math.sign(ex) * smoothstep(0.88, 0.99, Math.abs(ex)), -1, 1);
      py = clamp(py + Math.sign(ey) * smoothstep(0.85, 0.99, Math.abs(ey)), -1, 1);
    }
    const sp = CFG.pan * 2 / VIEW.S, k = Math.min(1, dt * 6);
    S.panV[0] += ((CR.x * px - G_UP.x * py) * sp - S.panV[0]) * k;
    S.panV[1] += ((CR.z * px - G_UP.z * py) * sp - S.panV[1]) * k;
    S.T.x += S.panV[0] * dt; S.T.z += S.panV[1] * dt;
    // the packs' meeting point trails the view
    const kc = Math.min(1, dt * 0.25);
    S.C.x += (S.T.x - S.C.x) * kc; S.C.z += (S.T.z - S.C.z) * kc;
    // a kick from the guns, in whole art pixels
    const j = S.shake * 1.6;
    setView(S.T.x + (R() - 0.5) * j / KPX * 2, S.T.z + (R() - 0.5) * j / KPX * 2);
    VIEW.aim.copy(S.T);
    // the crosshair: under the mouse in play, the middle of the view otherwise
    if (S.mode === 'play') { S.cursorArt[0] = S.cursor.x * VIEW.dw / VIEW.S; S.cursorArt[1] = S.cursor.y * VIEW.dh / VIEW.S; }
    else { S.cursorArt[0] = VIEW.W / 2; S.cursorArt[1] = VIEW.H / 2; }
    groundAtArt(S.cursorArt[0], S.cursorArt[1], S.aim);
    S.aimOK = true;
    U.uCursor.value.set(S.mode === 'play' ? S.cursorArt[0] : -1e4, VIEW.H - S.cursorArt[1]);
    S.viewR = Math.hypot(VIEW.W / 2 / KPX, VIEW.H / 2 / (KPX * SE)) + 8;
  }
  // The zombie nearest the crosshair on screen. Ones the rounds already in the air will kill are
  // passed over for any other near the sight (a little wider than the lock), so a burst held over a
  // crowd spreads one round per zombie; a lone target that is already done for still gets the rest.
  function findLock() {
    const keep = S.lock && !S.lock.dead ? S.lock : null, r1 = CFG.lockPx * CFG.lockPx, r2 = r1 * 5;
    let fresh = null, fd = r2, done = null, dd = r1;
    for (const z of S.zombies) {
      toArt(z.x, 0, z.z, AP);
      const dx = AP[0] - S.cursorArt[0], dy = AP[1] - (z.big ? 12 : 8) - S.cursorArt[1];
      let d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (z === keep) d2 *= 0.45;
      if ((z.pending || 0) < z.hp) { const w = d2 > r1 ? d2 * 1.5 : d2; if (w < fd) { fd = w; fresh = z; } }
      else if (d2 < dd) { dd = d2; done = z; }
    }
    S.lock = fresh || done;
  }

  /* --------------------------------------------------------- the horde */
  // the dead move in packs: each pack drifts towards its own spot near the middle of the view
  function newPack(p) {
    const a = R() * TAU, r = 10 + R() * 60;
    p = p || {};
    p.ox = Math.cos(a) * r; p.oz = Math.sin(a) * r; p.next = S.t + 6 + R() * 8;
    return p;
  }
  function makeZombie(x, z, type, pack) {
    const T = CFG.types[type];
    return {
      id: S.nextId++, x, z, type, hp: T.hp, value: T.value, run: T.run, big: type === 2, pending: 0, vx: 0, vz: 0,
      speed: T.speed[0] + R() * (T.speed[1] - T.speed[0]), heat: T.heat[0] + R() * (T.heat[1] - T.heat[0]),
      skin: Math.floor(R() * 4), shirt: Math.floor(R() * 6), pants: Math.floor(R() * 3), right: R() < 0.5,
      phase: R() * TAU, seed: R(), flash: 0,
      pack: pack || newPack(), jx: (R() - 0.5) * 12, jz: (R() - 0.5) * 12, wob: R() * TAU, block: [], blockT: 0,
    };
  }
  function pickType() {
    if (S.mode !== 'play') return R() < 0.07 ? 1 : 0;
    const r = R();
    if (S.run > 25 && r < 0.05) return 2;
    if (S.run > 8 && r < 0.16) return 1;
    return 0;
  }
  function pack(n, hx, hz) {
    const p = newPack();
    for (let k = 0; k < n; k++) {
      const r = Math.sqrt(R()) * (6 + n * 0.55), b = R() * TAU;
      S.zombies.push(makeZombie(hx + Math.cos(b) * r, hz + Math.sin(b) * r, pickType(), p));
    }
  }
  function spawnHorde(n) {
    const a = R() * TAU, d = S.viewR + 10 + R() * 30;
    pack(n, S.T.x + Math.cos(a) * d, S.T.z + Math.sin(a) * d);
  }
  function spawnScatter(n) {
    while (n > 0) {
      const m = Math.min(n, 6 + Math.floor(R() * 16)), a = R() * TAU, r = 20 + Math.sqrt(R()) * S.viewR * 1.05;
      pack(m, S.T.x + Math.cos(a) * r, S.T.z + Math.sin(a) * r);
      n -= m;
    }
  }
  const GC = 2, gk = (i, j) => (i + 500000) * 1000003 + (j + 500000);
  let grid = new Map();
  function updateZombies(dt) {
    const want = S.mode === 'play' || S.mode === 'ending' ? Math.min(CFG.pop.max, CFG.pop.start + CFG.pop.perSec * S.run) : 220;
    S.spawnCd -= dt;
    if (S.spawnCd <= 0 && S.zombies.length < want) { spawnHorde(Math.min(Math.ceil(want - S.zombies.length), 10 + Math.floor(R() * 16))); S.spawnCd = 0.45; }
    for (const z of S.zombies) {
      const pk = z.pack;
      if (S.t > pk.next) newPack(pk);
      const dx = S.C.x + pk.ox + z.jx - z.x, dz = S.C.z + pk.oz + z.jz - z.z, d = Math.hypot(dx, dz) || 1;
      z.wob += dt * (z.run ? 2 : 0.8);
      const w = Math.sin(z.wob) * (z.run ? 0.25 : 0.45), cw = Math.cos(w), sw = Math.sin(w);
      const ux = (dx * cw - dz * sw) / d, uz = (dx * sw + dz * cw) / d;
      const sp = z.speed * (d < 4 ? 0.1 : 1) * (z.flash > 0 ? 0.3 : 1);
      z.vx = ux * sp; z.vz = uz * sp;
      z.x += z.vx * dt; z.z += z.vz * dt;
      const sx = ux * CR.x + uz * CR.z;
      if (Math.abs(sx) > 0.25) z.right = sx > 0;
      z.vis = sp;
      z.phase += dt * sp * 3.9;
      if (z.flash > 0) z.flash -= dt;
      if (Math.hypot(z.x - S.T.x, z.z - S.T.z) > S.viewR * 3 + 120) z.gone = true;
    }
    // spacing in the crowd, and round trees and cars
    grid = new Map();
    for (const z of S.zombies) {
      const k = gk(Math.floor(z.x / GC), Math.floor(z.z / GC));
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(z);
    }
    for (const a of S.zombies) {
      const ra = a.big ? 1.2 : 0.75, ix = Math.floor(a.x / GC), iz = Math.floor(a.z / GC);
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iz - 1; j <= iz + 1; j++) {
        const list = grid.get(gk(i, j));
        if (!list) continue;
        for (const b of list) {
          if (b === a) continue;
          const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz, rr = ra + (b.big ? 1.2 : 0.75);
          if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), p = (rr - d) * 0.25 / d; a.x += dx * p; a.z += dz * p; b.x -= dx * p; b.z -= dz * p; }
        }
      }
      a.blockT -= dt;
      if (a.blockT <= 0) { blockersNear(a.x, a.z, a.block); a.blockT = 0.5 + R() * 0.3; }
      for (let k = 0; k < a.block.length; k += 3) {
        const dx = a.x - a.block[k], dz = a.z - a.block[k + 1], d = Math.hypot(dx, dz), m = a.block[k + 2] + ra;
        if (d < m && d > 1e-4) { a.x = a.block[k] + dx / d * m; a.z = a.block[k + 1] + dz / d * m; }
      }
    }
    S.zombies = S.zombies.filter((z) => !z.gone && !z.dead);
  }
  function nearby(x, z, r, fn) {
    const i0 = Math.floor((x - r) / GC), i1 = Math.floor((x + r) / GC), j0 = Math.floor((z - r) / GC), j1 = Math.floor((z + r) / GC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = grid.get(gk(i, j));
      if (!list) continue;
      for (const zb of list) if (!zb.dead && !zb.gone) { const d = Math.hypot(zb.x - x, zb.z - z); if (d <= r) fn(zb, d); }
    }
  }

  /* ------------------------------------------------------------- death */
  function scoring() { return S.mode === 'play' || S.mode === 'ending'; }
  // blood sprays away from the gun (up the screen) and to the sides
  function blood(x, z, n, up) {
    for (let k = 0; k < n; k++) {
      const a = R() * TAU, v = 1 + R() * 3.5, f = 1.5 + R() * 2.5;
      chunk(x, 1 + R() * 0.9, z, Math.cos(a) * v + G_UP.x * f, up * (0.6 + R()), Math.sin(a) * v + G_UP.z * f,
        { life: 0.45 + R() * 0.45, s0: 0.08 + R() * 0.07, h0: 0.95, h1: 0.5, grav: 11, col: R() < 0.7 ? 2 : 1 });
    }
  }
  function streak(n) {
    if (S.t - S.streak.t > 1.6) S.streak.n = 0;
    const before = S.streak.n;
    S.streak.n += n; S.streak.t = S.t; S.streak.best = Math.max(S.streak.best, S.streak.n);
    for (const [m, bonus] of [[10, 5], [25, 15], [50, 30], [100, 60], [200, 120]]) if (before < m && S.streak.n >= m && scoring()) {
      S.cash += bonus;
      S.events.push({ type: 'streak', n: m, bonus });
    }
  }
  function kill(z, cause, cx, cz, dist) {
    if (z.dead) return;
    z.dead = true;
    if (S.lock === z) S.lock = null;
    if (scoring()) { S.kills++; S.cash += z.value; streak(1); }
    S.events.push({ type: 'kill', cause });
    S.marks.push({ x: z.x, z: z.z, t: 0, big: z.big });
    if (cause === 'mg') {
      S.dying.push(Object.assign(z, { mode: 'fall', t: 0, flash: 0.1 }));
      z.x += G_UP.x * 0.35; z.z += G_UP.z * 0.35;                 // knocked back by the hit
      blood(z.x, z.z, z.big ? 18 : 11, 3.5);
      dust(z.x, 1.1, z.z, G_UP.x * 1.5, 0.6, G_UP.z * 1.5, { life: 0.55, s0: 0.35, s1: 1.1, h0: 0.7, h1: 0.4, a: 0.75, drag: 3, col: 2 });
      addDecal(2, z.x + G_UP.x * 0.8 + (R() - 0.5), z.z + G_UP.z * 0.8 + (R() - 0.5), 2.2 + R() * 1.2, 0.75, S.t);
      if (scoring()) S.pops.push({ x: z.x, z: z.z, text: '+' + z.value, t: 0, big: false });
      return;
    }
    let dx = z.x - cx, dz = z.z - cz;
    const l = Math.hypot(dx, dz) || 1, f = 1 - Math.min(1, dist / CFG.he.kill), v = 5 + f * 13 + R() * 3;
    dx /= l; dz /= l;
    S.dying.push(Object.assign(z, { mode: 'thrown', t: 0, y: 1.2, vx: dx * v, vy: 7 + f * 13 + R() * 4, vz: dz * v, flash: 0.1 }));
    z.right = dx * CR.x + dz * CR.z > 0;
    blood(z.x, z.z, 6, 6);
    if (f > 0.5) for (let k = 0; k < 6; k++) {
      const a = R() * TAU, s = 4 + R() * 9;
      chunk(z.x, 1, z.z, Math.cos(a) * s, 6 + R() * 10, Math.sin(a) * s, { life: 1 + R() * 0.8, s0: 0.14, h0: 0.95, h1: 0.45, grav: 14, col: 1 });
    }
  }
  // a 25mm round meets a zombie
  function hitZombie(zb) {
    zb.hp -= 1; zb.flash = 0.12;
    if (zb.hp <= 0) kill(zb, 'mg', zb.x, zb.z, 0);
    else { blood(zb.x, zb.z, 4, 2.5); zb.x += G_UP.x * 0.25; zb.z += G_UP.z * 0.25; S.events.push({ type: 'hit' }); }
  }
  function updateDying(dt) {
    for (const z of S.dying) {
      z.t += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.mode === 'fall') {
        if (z.t >= 0.36) { addCorpse(z, S.t); z.done = true; }
        continue;
      }
      z.vy -= 14 * dt;
      z.x += z.vx * dt; z.y += z.vy * dt; z.z += z.vz * dt;
      if (z.y <= 0.4 && z.vy < 0) {
        addCorpse(z, S.t);
        addDecal(2, z.x, z.z, 1.8 + R(), 0.75, S.t);
        for (let k = 0; k < 4; k++) dust(z.x, 0.3, z.z, (R() - 0.5) * 3, 1 + R(), (R() - 0.5) * 3, { life: 1.2, s0: 0.5, s1: 1.4, h0: 0.36, h1: 0.33, a: 0.6, drag: 2 });
        z.done = true;
      }
    }
    S.dying = S.dying.filter((z) => !z.done);
  }

  /* ----------------------------------------------------------- weapons */
  // where a zombie will be when a round fired now arrives
  const lead = (z, t, out) => out.set(z.x + z.vx * t, 0, z.z + z.vz * t);
  function fireMG(target, player) {
    let b, tgt = null;
    if (player && S.lock) {
      tgt = S.lock;
      b = lead(tgt, CFG.mg.travel, new THREE.Vector3());
      const s = 0.2 * Math.sqrt(R()), a = R() * TAU;
      b.x += Math.cos(a) * s; b.z += Math.sin(a) * s;
      tgt.pending = (tgt.pending || 0) + 1;            // spoken for: the next round goes elsewhere
    } else {
      b = new THREE.Vector3().copy(target);
      const s = CFG.mg.spread * Math.sqrt(R()), a = R() * TAU;
      b.x += Math.cos(a) * s; b.z += Math.sin(a) * s; b.y = 0;
    }
    S.rounds.push({ kind: 'mg', side: 1, b, target: tgt, age: 0, travel: CFG.mg.travel, dist: 1250, streak: 80, player });
    if (player) { S.shots++; S.mgHeat = Math.min(1, S.mgHeat + CFG.mg.heatPer); S.shake = Math.min(1.2, S.shake + 0.06); S.events.push({ type: 'mg' }); }
  }
  function fireHE(target, player) {
    const b = player && S.lock ? lead(S.lock, CFG.he.travel, new THREE.Vector3()) : new THREE.Vector3().copy(target);
    b.y = 0;
    S.rounds.push({ kind: 'he', side: -1, b, age: 0, travel: CFG.he.travel, dist: 1250, streak: 50, player });
    if (player) { S.heReload = CFG.he.reload; S.shake = Math.min(1.6, S.shake + 0.9); S.events.push({ type: 'cannon' }); }
  }
  function mgImpact(r) {
    const x = r.b.x, z = r.b.z, T = r.target;
    let hits = 0;
    if (T) T.pending = Math.max(0, (T.pending || 0) - 1);
    if (T && !T.dead && Math.hypot(T.x - x, T.z - z) < 2.4) { hitZombie(T); hits++; }   // a locked round finds its mark
    // then the splash, nearest first
    const near = [];
    nearby(x, z, CFG.mg.splash, (zb, d) => { if (zb !== T) near.push([d, zb]); });
    near.sort((a, b) => a[0] - b[0]);
    for (const [, zb] of near) { if (hits >= CFG.mg.victims) break; if (!zb.dead) { hitZombie(zb); hits++; } }
    if (hits && r.player) { S.hits++; S.hitT = 0.15; }
    fire(x, 0.6, z, 0, 0.5, 0, { life: 0.08, s0: 1.1, s1: 1.5, h0: 1, h1: 0.7 });
    for (let k = 0; k < 5; k++) {
      const a = R() * TAU, v = 6 + R() * 12;
      spark(x, 0.3, z, Math.cos(a) * v, 3 + R() * 9, Math.sin(a) * v, { life: 0.2 + R() * 0.25, h0: 1, h1: 0.3, grav: 20 });
    }
    if (!hits) for (let k = 0; k < 4; k++) {
      const a = R() * TAU, v = 1.5 + R() * 4;
      chunk(x, 0.3, z, Math.cos(a) * v, 3 + R() * 6, Math.sin(a) * v, { life: 0.7 + R() * 0.5, s0: 0.12, h0: 0.38, grav: 16, col: 0 });
    }
    dust(x, 0.8, z, (R() - 0.5), 1.2, (R() - 0.5), { life: 1.4, s0: 0.6, s1: 1.8, h0: 0.45, h1: 0.36, a: 0.7, drag: 1.5 });
    addDecal(1, x, z, 1.8 + R() * 0.8, 0.85, S.t);
    addHeat(x, z, 2.6, 0.5, 1.4);
    addLight(x, 1.2, z, 7, [1, 0.75, 0.4], 2.4, 0.07);
    S.events.push({ type: 'impact', hits, x, z });
  }
  function explode(x, z, player) {
    let killed = 0, value = 0;
    nearby(x, z, CFG.he.hurt, (zb, d) => {
      if (d >= CFG.he.kill) {
        zb.hp -= 4; zb.flash = 0.25;
        const k = 2.5 / Math.max(d, 1);
        zb.x += (zb.x - x) * k; zb.z += (zb.z - z) * k;
        if (zb.hp > 0) return;
      }
      value += zb.value; killed++;
      kill(zb, 'he', x, z, d);
    });
    // the flash, a fireball rolling up, burning ground, fragments flung out on arcs, earth, smoke, a ring of dust
    addLight(x, 6, z, 46, [1, 0.72, 0.4], 9, 0.25, 1.2);
    addLight(x, 5, z, 30, [1, 0.5, 0.18], 4, 1.8, 0.8);
    addLight(x, 3, z, 22, [1, 0.45, 0.15], 1.2, 7, 0.6);           // the crater smoulders
    fire(x, 2.5, z, 0, 0, 0, { life: 0.12, s0: 7, s1: 11, h0: 1, h1: 0.9 });
    for (let k = 0; k < 14; k++) {
      const a = R() * TAU, v = R() * 7, r = R() * 3;
      fire(x + Math.cos(a) * r, 1.5 + R() * 3, z + Math.sin(a) * r, Math.cos(a) * v, 3 + R() * 6, Math.sin(a) * v,
        { life: 1 + R() * 0.8, s0: 2.2 + R() * 1.2, s1: 4.5 + R() * 2.5, h0: 1, h1: 0.1, grav: -5, drag: 1.6 });
    }
    for (let k = 0; k < 6; k++) {
      const a = R() * TAU, r = 2 + R() * 6;
      fire(x + Math.cos(a) * r, 0.8, z + Math.sin(a) * r, 0, 0.6, 0, { life: 2 + R() * 1.5, s0: 1.6, s1: 2.6, h0: 0.75, h1: 0.15 });
    }
    for (let k = 0; k < 32; k++) {
      const a = R() * TAU, v = 10 + R() * 26;
      spark(x, 1, z, Math.cos(a) * v, 10 + R() * 22, Math.sin(a) * v, { life: 0.9 + R() * 1, h0: 1, h1: 0.2, grav: 18, drag: 0.4 });
    }
    for (let k = 0; k < 4; k++) {
      const a = R() * TAU, r = 9 + R() * 14;
      S.flames.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, life: 5 + R() * 7 });
    }
    for (let k = 0; k < 45; k++) {
      const a = R() * TAU, v = 6 + R() * 22;
      chunk(x, 0.5, z, Math.cos(a) * v, 6 + R() * 20, Math.sin(a) * v, { life: 1.2 + R() * 1.2, s0: 0.16 + R() * 0.12, h0: R() < 0.3 ? 0.9 : 0.42, h1: 0.36, grav: 20, col: R() < 0.2 ? 3 : 0 });
    }
    for (let k = 0; k < 14; k++) {
      const a = R() * TAU, r = R() * 6;
      smoke(x + Math.cos(a) * r, 2 + R() * 6, z + Math.sin(a) * r, Math.cos(a) * 1.5, 2.5 + R() * 2.5, Math.sin(a) * 1.5,
        { life: 6 + R() * 4, s0: 3 + R() * 2, s1: 9 + R() * 5, h0: 0.5, h1: 0.33, a: 0.7, drag: 0.5, fadeIn: 0.1, col: 0.3 + R() * 0.4 });
    }
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU;
      dust(x + Math.cos(a) * 3, 0.8, z + Math.sin(a) * 3, Math.cos(a) * 26, 1, Math.sin(a) * 26, { life: 1.6, s0: 1.6, s1: 3.6, h0: 0.45, h1: 0.34, a: 0.7, drag: 3 });
    }
    addDecal(4, x, z, CFG.he.hurt * 3, 1.4, S.t);
    addDecal(0, x, z, 20 + R() * 4, 1, S.t);
    addHeat(x, z, 11, 0.9, 1.2);
    addHeat(x, z, 9, 0.16, 25);
    S.events.push({ type: 'boom', kills: killed, x, z });
    if (player && scoring() && killed) {
      S.bestBlast = Math.max(S.bestBlast, killed);
      S.pops.push({ x, z, text: '+' + value, t: 0, big: true });
      if (killed >= 4) S.events.push({ type: 'multi', kills: killed, value });
    }
  }
  function updateRounds(dt) {
    for (const r of S.rounds) {
      r.age += dt;
      if (r.age >= r.travel) { r.done = true; if (r.kind === 'he') explode(r.b.x, r.b.z, r.player); else mgImpact(r); }
    }
    S.rounds = S.rounds.filter((r) => !r.done);
  }
  // burning wrecks and ruins: tongues of fire and a column of smoke; little fires left by blasts
  function updateFires(dt) {
    for (const f of S.flames) {
      f.life -= dt;
      if (R() < dt * 14) fire(f.x + (R() - 0.5), 0.4, f.z + (R() - 0.5), 0, 1.5 + R(), 0, { life: 0.35 + R() * 0.3, s0: 0.45 + R() * 0.3, s1: 0.15, h0: 0.8, h1: 0.2, grav: -2 });
    }
    S.flames = S.flames.filter((f) => f.life > 0);
    const reach = S.viewR + 30;
    for (const f of ACTIVE.fires) {
      if (Math.abs(f.x - S.T.x) > reach || Math.abs(f.z - S.T.z) > reach) continue;
      const k = f.big ? 2.2 : 1, w = f.big ? 6 : 3;
      if (R() < dt * 30 * k) fire(f.x + (R() - 0.5) * w, f.y + R(), f.z + (R() - 0.5) * w * 0.6, (R() - 0.5), 3 + R() * 3, (R() - 0.5),
        { life: 0.4 + R() * 0.5, s0: (0.6 + R() * 0.5) * (f.big ? 1.4 : 1), s1: 0.2, h0: 0.9, h1: 0.15, grav: -2 });
      if (R() < dt * 4 * k) smoke(f.x + (R() - 0.5) * w * 0.6, f.y + 2, f.z + (R() - 0.5) * w * 0.6, 0.8 + (R() - 0.5), 3 + R() * 2, (R() - 0.5),
        { life: 7 + R() * 3, s0: 1.4 * k, s1: 6 * k, h0: 0.5, h1: 0.34, a: 0.6, drag: 0.3, fadeIn: 0.1, col: 0.2 });
    }
  }
  // the title screen: the gunship works the horde on its own
  function attract(dt) {
    if (S.burst) {
      S.burst.cd -= dt;
      while (S.burst.cd <= 0 && S.burst.n > 0) { fireMG(S.burst.p, false); S.burst.n--; S.burst.cd += 1 / CFG.mg.rate; }
      if (S.burst.n <= 0) S.burst = null;
    }
    S.attractT -= dt;
    if (S.attractT > 0 || !S.zombies.length) return;
    S.attractT = 1.4 + R() * 1.8;
    const z = S.zombies[Math.floor(R() * S.zombies.length)];
    if (Math.hypot(z.x - S.T.x, z.z - S.T.z) > S.viewR * 0.6) return;
    const p = new THREE.Vector3(z.x, 0, z.z);
    if (R() < 0.45) fireHE(p, false); else S.burst = { p, n: 12, cd: 0 };
  }

  /* -------------------------------------------------------------- step */
  function update(dt) {
    S.t += dt;
    U.uTime.value = S.t;
    if (S.mode !== 'play') S.pan[0] = S.pan[1] = 0;
    updateCamera(dt);
    if (S.mode === 'play') {
      S.run += dt; S.fuel -= dt;
      findLock();
      S.mgHeat = Math.max(0, S.mgHeat - CFG.mg.cool * dt * (S.trigger && !S.overheat ? 0.25 : 1));
      if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); }
      if (S.overheat && S.mgHeat < 0.35) S.overheat = false;
      if (S.trigger && !S.overheat && S.aimOK) {
        S.mgCd -= dt;
        while (S.mgCd <= 0 && !S.overheat) {
          fireMG(S.aim, true); S.mgCd += 1 / CFG.mg.rate;
          findLock();
          if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); }
        }
      } else S.mgCd = Math.max(0, S.mgCd - dt);
      S.heReload = Math.max(0, S.heReload - dt);
      if (S.fuel <= 0) { S.fuel = 0; S.mode = 'ending'; S.endT = 0; S.trigger = false; S.lock = null; S.events.push({ type: 'fuelout' }); }
    } else if (S.mode === 'title') { S.lock = null; attract(dt); }
    else if (S.mode === 'ending') { S.endT += dt; if (S.endT > 1.4) S.mode = 'over'; }
    S.hitT = Math.max(0, S.hitT - dt);
    S.shake = Math.max(0, S.shake - dt * 2.5);
    for (const p of S.pops) p.t += dt;
    S.pops = S.pops.filter((p) => p.t < 1);
    for (const m of S.marks) m.t += dt;
    S.marks = S.marks.filter((m) => m.t < 0.35);
    updateWorld(S.T.x, S.T.z);
    updateZombies(dt);
    updateRounds(dt);
    updateDying(dt);
    updateFires(dt);
    updateFx(dt);
    packHeat(dt, ACTIVE.fires, S.t);
    packLights(dt, S.t, S.T.x, S.T.z);
    writeTracers(S.rounds);
    writeZombies(S.zombies, S.dying, S.t);
  }

  reset(false);
  return {
    S, update,
    start() {
      reset(true);
      S.mode = 'play';
      S.zombies = []; S.dying = []; S.rounds = []; S.flames = [];
      clearCorpses(); clearFx();
      spawnScatter(CFG.pop.start);
    },
    spawnScatter,
    trigger(on) { S.trigger = !!on && S.mode === 'play'; },
    fireHE() { if (S.mode === 'play' && S.heReload <= 0 && S.aimOK) fireHE(S.aim, true); },
    setPan(x, y) { S.pan[0] = x; S.pan[1] = y; },
  };
}
