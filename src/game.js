/* The game: a gunship over an endless countryside at night, guns trained on the middle of the
 * picture. Every round leaves the aircraft (below the bottom of the screen) and takes a second or
 * so to fall into the target. Units are metres and seconds. */

const CFG = {
  fuel: 60,
  pan: 70,                                   // m/s with WASD
  mg: { rate: 12, travel: 0.83, spread: 1.6, splash: 2.6, victims: 4, heatPer: 0.035, cool: 0.45 },
  he: { reload: 2.6, travel: 1.56, kill: 11, hurt: 18 },
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
    S.locked = S.locked || false; S.free = S.free || false; S.cursor = S.cursor || { x: 0.5, y: 0.5 }; S.aim = new THREE.Vector3(); S.aimOK = false;
    S.shake = 0;
    S.zombies = []; S.dying = []; S.rounds = []; S.flames = []; S.events = []; S.spawnCd = 0; S.attractT = 1.5; S.burst = null; S.nextId = 1;
    S.viewR = 130;
  }

  /* ------------------------------------------------------------ camera */
  const AP = [0, 0];
  function updateCamera(dt) {
    // WASD slides the view; with a free cursor, pushing it to an edge does too
    let px = S.pan[0], py = S.pan[1];
    if (S.free && S.mode === 'play') {
      const ex = S.cursor.x * 2 - 1, ey = S.cursor.y * 2 - 1;
      px = clamp(px + Math.sign(ex) * smoothstep(0.7, 0.97, Math.abs(ex)), -1, 1);
      py = clamp(py + Math.sign(ey) * smoothstep(0.7, 0.97, Math.abs(ey)), -1, 1);
    }
    const sp = CFG.pan * 2 / VIEW.S, k = Math.min(1, dt * 6);
    S.panV[0] += ((CR.x * px - G_UP.x * py) * sp - S.panV[0]) * k;
    S.panV[1] += ((CR.z * px - G_UP.z * py) * sp - S.panV[1]) * k;
    S.T.x += S.panV[0] * dt; S.T.z += S.panV[1] * dt;
    // the pack's meeting point trails the view
    const kc = Math.min(1, dt * 0.25);
    S.C.x += (S.T.x - S.C.x) * kc; S.C.z += (S.T.z - S.C.z) * kc;
    // a kick from the guns, in whole art pixels
    const j = S.shake * 1.6;
    setView(S.T.x + (R() - 0.5) * j / KPX * 2, S.T.z + (R() - 0.5) * j / KPX * 2);
    VIEW.aim.copy(S.T);
    if (S.locked || S.mode !== 'play') { S.aim.copy(S.T); S.aimOK = true; }
    else { groundAtArt(S.cursor.x * VIEW.dw / VIEW.S, S.cursor.y * VIEW.dh / VIEW.S, S.aim); S.aimOK = true; }
    S.viewR = Math.hypot(VIEW.W / 2 / KPX, VIEW.H / 2 / (KPX * SE)) + 8;
    void AP;
  }
  // the mouse moved (dx, dy) art pixels while locked: move the aim with it across the ground
  function look(dx, dy) {
    S.T.x += CR.x * dx / KPX - G_UP.x * dy / (KPX * SE);
    S.T.z += CR.z * dx / KPX - G_UP.z * dy / (KPX * SE);
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
      id: S.nextId++, x, z, type, hp: T.hp, value: T.value, run: T.run, big: type === 2,
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
      z.x += ux * sp * dt; z.z += uz * sp * dt;
      const sx = ux * CR.x + uz * CR.z;
      if (Math.abs(sx) > 0.25) z.right = sx > 0;
      z.vis = sp;
      z.phase += dt * sp * 3.9;
      if (z.flash > 0) z.flash -= dt;
      if (Math.hypot(z.x - S.T.x, z.z - S.T.z) > S.viewR * 3 + 120) z.gone = true;
    }
    // spacing in the crowd, and round houses, cars and trees
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
  function blood(x, z, n, up) {
    for (let k = 0; k < n; k++) {
      const a = R() * TAU, v = 1 + R() * 3;
      chunk(x, 1 + R() * 0.8, z, Math.cos(a) * v, up * (0.5 + R()), Math.sin(a) * v, { life: 0.5 + R() * 0.4, s0: 0.09, h0: 0.95, h1: 0.5, grav: 9, col: 2 });
    }
  }
  function kill(z, cause, cx, cz, dist) {
    if (z.dead) return;
    z.dead = true;
    if (scoring()) { S.kills++; S.cash += z.value; }
    S.events.push({ type: 'kill' });
    if (cause === 'mg') {
      S.dying.push(Object.assign(z, { mode: 'fall', t: 0, flash: 0.08 }));
      blood(z.x, z.z, 6, 3);
      addDecal(2, z.x + (R() - 0.5), z.z + (R() - 0.5), 1.4 + R(), 0.72, S.t);
      return;
    }
    let dx = z.x - cx, dz = z.z - cz;
    const l = Math.hypot(dx, dz) || 1, f = 1 - Math.min(1, dist / CFG.he.kill), v = 5 + f * 13 + R() * 3;
    dx /= l; dz /= l;
    S.dying.push(Object.assign(z, { mode: 'thrown', t: 0, y: 1.2, vx: dx * v, vy: 7 + f * 13 + R() * 4, vz: dz * v, flash: 0.1 }));
    z.right = dx * CR.x + dz * CR.z > 0;
    if (f > 0.5) for (let k = 0; k < 6; k++) {
      const a = R() * TAU, s = 4 + R() * 9;
      chunk(z.x, 1, z.z, Math.cos(a) * s, 6 + R() * 10, Math.sin(a) * s, { life: 1 + R() * 0.8, s0: 0.14, h0: 0.95, h1: 0.45, grav: 14, col: 1 });
    }
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
  function fireMG(target, player) {
    const b = new THREE.Vector3().copy(target), s = CFG.mg.spread * Math.sqrt(R()), ang = R() * TAU;
    b.x += Math.cos(ang) * s; b.z += Math.sin(ang) * s; b.y = 0;
    S.rounds.push({ kind: 'mg', side: 1, b, age: 0, travel: CFG.mg.travel, dist: 1250, streak: 80, player });
    if (player) { S.shots++; S.mgHeat = Math.min(1, S.mgHeat + CFG.mg.heatPer); S.shake = Math.min(1.2, S.shake + 0.07); S.events.push({ type: 'mg' }); }
  }
  function fireHE(target, player) {
    const b = new THREE.Vector3().copy(target);
    b.y = 0;
    S.rounds.push({ kind: 'he', side: -1, b, age: 0, travel: CFG.he.travel, dist: 1250, streak: 50, player });
    if (player) { S.heReload = CFG.he.reload; S.shake = Math.min(1.6, S.shake + 0.9); S.events.push({ type: 'cannon' }); }
  }
  function mgImpact(r) {
    const x = r.b.x, z = r.b.z;
    let hits = 0;
    nearby(x, z, CFG.mg.splash, (zb) => {
      if (hits >= CFG.mg.victims) return;
      hits++;
      zb.hp -= 1; zb.flash = 0.1;
      blood(zb.x, zb.z, 2, 2);
      if (zb.hp <= 0) kill(zb, 'mg', x, z, 0);
    });
    if (hits && r.player) { S.hits++; S.hitT = 0.15; }
    fire(x, 0.6, z, 0, 0.5, 0, { life: 0.08, s0: 1.1, s1: 1.5, h0: 1, h1: 0.7 });
    for (let k = 0; k < 5; k++) {
      const a = R() * TAU, v = 6 + R() * 12;
      spark(x, 0.3, z, Math.cos(a) * v, 3 + R() * 9, Math.sin(a) * v, { life: 0.2 + R() * 0.25, h0: 1, h1: 0.3, grav: 20 });
    }
    for (let k = 0; k < 4; k++) {
      const a = R() * TAU, v = 1.5 + R() * 4;
      chunk(x, 0.3, z, Math.cos(a) * v, 3 + R() * 6, Math.sin(a) * v, { life: 0.7 + R() * 0.5, s0: 0.12, h0: 0.38, grav: 16, col: 0 });
    }
    dust(x, 0.8, z, (R() - 0.5), 1.2, (R() - 0.5), { life: 1.4, s0: 0.6, s1: 1.8, h0: 0.45, h1: 0.36, a: 0.7, drag: 1.5 });
    addDecal(1, x, z, 1.8 + R() * 0.8, 0.85, S.t);
    addHeat(x, z, 2.6, 0.5, 1.4);
    addLight(x, 1.2, z, 7, [1, 0.75, 0.4], 2.4, 0.07);
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
  // burning wrecks and houses: tongues of fire and a column of smoke; little fires left by blasts
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
    if (S.mode === 'play') {
      S.run += dt; S.fuel -= dt;
      S.mgHeat = Math.max(0, S.mgHeat - CFG.mg.cool * dt * (S.trigger && !S.overheat ? 0.25 : 1));
      if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); }
      if (S.overheat && S.mgHeat < 0.35) S.overheat = false;
      if (S.trigger && !S.overheat && S.aimOK) {
        S.mgCd -= dt;
        while (S.mgCd <= 0 && !S.overheat) { fireMG(S.aim, true); S.mgCd += 1 / CFG.mg.rate; if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); } }
      } else S.mgCd = Math.max(0, S.mgCd - dt);
      S.heReload = Math.max(0, S.heReload - dt);
      if (S.fuel <= 0) { S.fuel = 0; S.mode = 'ending'; S.endT = 0; S.trigger = false; S.events.push({ type: 'fuelout' }); }
    } else if (S.mode === 'title') attract(dt);
    else if (S.mode === 'ending') { S.endT += dt; if (S.endT > 1.4) S.mode = 'over'; }
    S.hitT = Math.max(0, S.hitT - dt);
    S.shake = Math.max(0, S.shake - dt * 2.5);
    updateCamera(dt);
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
    S, update, look,
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
