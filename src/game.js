/* The game: a gunship circling out of sight over an endless night, the dead walking towards
 * whatever it watches. 25mm rounds stream down from the lower right; 105mm shells drop from the
 * lower left. Fuel runs out after a minute. Units are world units (about 7 to a metre). */

const CFG = {
  fuel: 60,
  pan: 250,                                         // camera pixels per second
  mg: { rate: 11, spread: 2.2, travel: 0.2, splash: 3.4 },
  he: { reload: 2.2, travel: 1.05, kill: 28, hurt: 44 },
  pop: { start: 140, perSec: 7, max: 650 },
  types: [
    { hp: 2, speed: [7, 11], value: 1, skins: ['zskin', 'zskinGrey'], big: false },
    { hp: 1, speed: [24, 30], value: 2, skins: ['zskinPale'], big: false },
    { hp: 14, speed: [5, 6], value: 10, skins: ['zskinGrey'], big: true },
  ],
};
const SHIRTS = ['shirtB', 'shirtR', 'shirtW', 'shirtG', 'shirtY', 'shirtP'], PANTS = ['pants', 'pantsBr', 'pantsGr'];

function createGame() {
  const S = {};
  const R = Math.random;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const G3 = [0, 0, 0];

  function reset(full) {
    S.t = 0; S.run = 0; S.fuel = CFG.fuel; S.kills = 0; S.cash = 0; S.shots = 0; S.hits = 0; S.bestBlast = 0;
    S.mode = 'title'; S.over = false;
    S.trigger = false; S.mgCd = 0; S.heReload = 0; S.hitT = 0;
    S.aim = { sx: W / 2, sy: H / 2, seen: false };
    if (full || S.cx === undefined) { S.cx = OFFS + 0.5; S.cy = OFFS + 0.5; }
    S.pan = [0, 0]; S.vel = [0, 0];
    S.zombies = []; S.dying = []; S.rounds = []; S.particles = []; S.puffs = []; S.booms = []; S.impacts = [];
    S.lights = []; S.numbers = []; S.scorches = []; S.events = []; S.drawList = [];
    S.spawnCd = 0; S.attractT = 1.2; S.burst = null; S.nextId = 1;
    applyView();
  }
  function applyView() {
    VIEW.x = Math.round(S.cx - W / 2); VIEW.y = Math.round(S.cy - H / 2);
    syncView();
  }

  /* ------------------------------------------------------------- the dead */
  function makeZombie(x, y, type) {
    const T = CFG.types[type];
    return {
      id: S.nextId++, x, y, type, hp: T.hp, value: T.value, big: T.big,
      speed: T.speed[0] + R() * (T.speed[1] - T.speed[0]), phase: R() * 4, wob: R() * TAU, flip: R() < 0.5, flash: 0,
      skin: M[pick(T.skins)], shirt: M[pick(SHIRTS)], pants: M[pick(PANTS)],
      ox: 0, oy: 0, retarget: 0, pose: 'walk', st: 0, seed: R(),
    };
  }
  function pickType() {
    if (S.mode !== 'play') return R() < 0.06 ? 1 : 0;
    const r = R();
    if (S.run > 28 && r < 0.05) return 2;
    if (S.run > 10 && r < 0.16) return 1;
    return 0;
  }
  function spawnHorde(n) {
    // just beyond an edge of the screen
    const side = R(), m = 36;
    let sx, sy;
    if (side < 0.3) { sx = -m - R() * 30; sy = R() * H; } else if (side < 0.6) { sx = W + m + R() * 30; sy = R() * H; }
    else if (side < 0.8) { sx = R() * W; sy = -m - R() * 30; } else { sx = R() * W; sy = H + m + R() * 30; }
    const c = groundAtScreen(sx, sy, [0, 0, 0]);
    for (let k = 0; k < n; k++) S.zombies.push(makeZombie(c[0] + (R() - 0.5) * 28, c[1] + (R() - 0.5) * 28, pickType()));
  }
  function spawnScatter(n) {
    for (let k = 0; k < n; k++) {
      const c = groundAtScreen(R() * W, R() * H, [0, 0, 0]);
      S.zombies.push(makeZombie(c[0], c[1], pickType()));
    }
  }
  const attractor = [0, 0, 0];
  const BL = [];
  let gridMap = new Map();
  const GC = 8, gk = (i, j) => (i + 50000) * 100000 + (j + 50000);
  function updateZombies(dt) {
    groundAtScreen(W / 2, H / 2 + 30, attractor);
    const want = S.mode === 'play' || S.mode === 'ending' ? Math.min(CFG.pop.max, CFG.pop.start + CFG.pop.perSec * S.run) : 170;
    S.spawnCd -= dt;
    if (S.spawnCd <= 0 && S.zombies.length < want) { spawnHorde(Math.min(Math.ceil(want - S.zombies.length), 8 + Math.floor(R() * 18))); S.spawnCd = 0.4; }
    const zs = S.zombies;
    for (const z of zs) {
      z.retarget -= dt;
      if (z.retarget <= 0) { const a = R() * TAU, r = 8 + R() * 44; z.ox = Math.cos(a) * r; z.oy = Math.sin(a) * r; z.retarget = 3 + R() * 6; }
      const dx = attractor[0] + z.ox - z.x, dy = attractor[1] + z.oy - z.y, d = Math.hypot(dx, dy) || 1;
      z.wob += dt * 0.9;
      const w = Math.sin(z.wob) * 0.4, cw = Math.cos(w), sw = Math.sin(w);
      const ux = (dx * cw - dy * sw) / d, uy = (dx * sw + dy * cw) / d;
      const sp = z.speed * (d < 6 ? 0.15 : 1) * (z.flash > 0 ? 0.3 : 1);
      z.x += ux * sp * dt; z.y += uy * sp * dt;
      const dsx = ux * CR[0] + uy * CR[1];
      if (Math.abs(dsx) > 0.15) z.flip = dsx < 0;
      z.phase += dt * (sp * (z.big ? 0.32 : 0.45) + 0.4);
      if (z.flash > 0) z.flash -= dt;
      const sx = scrX(z.x, z.y), sy = scrY(z.x, z.y, 0);
      if (sx < -420 || sx > W + 420 || sy < -420 || sy > H + 420) z.gone = true;
    }
    // keep a little room between them, and out of houses, cars and trunks
    gridMap = new Map();
    for (const z of zs) {
      const k = gk(Math.floor(z.x / GC), Math.floor(z.y / GC));
      let a = gridMap.get(k);
      if (!a) gridMap.set(k, (a = []));
      a.push(z);
    }
    for (const a of zs) {
      const r0 = a.big ? 6 : 4, ix = Math.floor(a.x / GC), iy = Math.floor(a.y / GC);
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iy - 1; j <= iy + 1; j++) {
        const list = gridMap.get(gk(i, j));
        if (!list) continue;
        for (const b of list) {
          if (b === a) continue;
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy, rr = r0 + (b.big ? 6 : 4);
          if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = (rr - d) * 0.25 / d; a.x += dx * p; a.y += dy * p; b.x -= dx * p; b.y -= dy * p; }
        }
      }
      if ((a.id + Math.floor(S.t * 30)) % 3) continue;
      blockersNear(a.x, a.y, BL);
      for (let k = 0; k < BL.length; k += 3) {
        const dx = a.x - BL[k], dy = a.y - BL[k + 1], d = Math.hypot(dx, dy), m = BL[k + 2] + 2.5;
        if (d < m && d > 1e-4) { a.x = BL[k] + dx / d * m; a.y = BL[k + 1] + dy / d * m; }
      }
    }
    S.zombies = zs.filter((z) => !z.gone && !z.dead);
  }
  function nearby(x, y, r, fn) {
    const i0 = Math.floor((x - r) / GC), i1 = Math.floor((x + r) / GC), j0 = Math.floor((y - r) / GC), j1 = Math.floor((y + r) / GC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = gridMap.get(gk(i, j));
      if (!list) continue;
      for (const z of list) if (!z.dead && !z.gone) { const d = Math.hypot(z.x - x, z.y - y); if (d <= r) fn(z, d); }
    }
  }

  /* ---------------------------------------------------------- death */
  function bake(z) {
    addDecal({ type: 'blood', x: z.x, y: z.y, s: (z.big ? 8 : 5) + R() * 3, seed: Math.floor(R() * 1e6) });
    addDecal({ type: 'corpse', x: z.x, y: z.y, frame: Math.floor(R() * 2), flip: R() < 0.5, big: z.big,
      skin: z.skin, shirt: z.shirt, pants: z.pants, seed: Math.floor(R() * 1e6) });
  }
  function kill(z, cause, cx, cy, dist) {
    if (z.dead) return;
    z.dead = true;
    if (S.mode === 'play' || S.mode === 'ending') { S.kills++; S.cash += z.value; }
    S.events.push({ type: 'kill', big: z.big });
    if (cause === 'mg') {
      S.dying.push(Object.assign(z, { pose: 'die', st: 0, flash: 0.06 }));
      burst(z.x, z.y, 7, 'blood', 6, 30);
      return;
    }
    let dx = z.x - cx, dy = z.y - cy;
    const l = Math.hypot(dx, dy) || 1, f = 1 - Math.min(1, dist / CFG.he.kill);
    dx /= l; dy /= l;
    const v = 18 + f * 45 + R() * 10;
    S.dying.push(Object.assign(z, { pose: 'tumble', st: 0, h: 2, vx: dx * v, vy: dy * v, vz: 30 + f * 45 + R() * 12, flash: 0.05 }));
    if (f > 0.55) burst(z.x, z.y, 6, 'gib', 5, 40);
  }
  function updateDying(dt) {
    for (const z of S.dying) {
      z.st += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.pose === 'die') { if (z.st > 0.38) { bake(z); z.done = true; } continue; }
      z.vz -= 140 * dt;
      z.x += z.vx * dt; z.y += z.vy * dt; z.h += z.vz * dt;
      if (z.h <= 0 && z.vz < 0) {
        z.h = 0;
        burst(z.x, z.y, 1, 'dirt', 4, 20);
        bake(z); z.done = true;
      }
    }
    S.dying = S.dying.filter((z) => !z.done);
  }

  /* --------------------------------------------------------- effects */
  function burst(x, y, z, kind, n, speed, o) {
    for (let j = 0; j < n && S.particles.length < 900; j++) {
      const a = R() * TAU, v = speed * (0.3 + R() * 0.7);
      S.particles.push({ x, y, z, vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v * 0.7, vz: v * (0.6 + R() * 0.8), kind,
        shade: Math.floor(R() * 3), age: 0, life: 0.6 + R() * 0.9, g: kind === 'ember' ? -12 : 70, drag: kind === 'ember' ? 1.5 : 0,
        hot: o && o.hot, big: R() < 0.3 });
    }
  }
  function puff(x, y, z, r0, gr, a, dark, life, vz, delay, heat) {
    if (S.puffs.length >= 420) return;
    S.puffs.push({ x, y, z, r0, gr, a, dark, life, vz, heat: heat || 0, age: -(delay || 0), vx: -0.6 + (R() - 0.5) * 2, vy: -2.3 + (R() - 0.5) * 2 });
  }
  function light(x, y, z, r, I, life, kind) { S.lights.push({ x, y, z, r, I, age: 0, life, kind }); }

  /* ---------------------------------------------------------- weapons */
  // where a round leaves the gunship: high above and behind the camera, off the lower edge
  function origin(g, side) {
    const D = 420, K = 250, X = side * 80;
    return [g[0] + CV[0] * D - CU[0] * K + CR[0] * X, g[1] + CV[1] * D - CU[1] * K + CR[1] * X, CV[2] * D - CU[2] * K];
  }
  function fireMG(sx, sy, player) {
    const tx = sx + (R() - 0.5) * 2 * CFG.mg.spread, ty = sy + (R() - 0.5) * 2 * CFG.mg.spread;
    const g = groundAtScreen(tx, ty, [0, 0, 0]);
    S.rounds.push({ kind: 'mg', a: origin(g, 1), b: [g[0], g[1], 0], age: 0, travel: CFG.mg.travel, player, ox: tx - sx, oy: ty - sy });
    if (player) { S.shots++; S.events.push({ type: 'mg' }); }
  }
  function fireHE(sx, sy, player) {
    const g = groundAtScreen(sx, sy, [0, 0, 0]);
    S.rounds.push({ kind: 'he', a: origin(g, -1), b: [g[0], g[1], 0], age: 0, travel: CFG.he.travel, player });
    if (player) { S.heReload = CFG.he.reload; S.events.push({ type: 'cannon' }); }
  }
  function mgImpact(r) {
    const x = r.b[0], y = r.b[1], ix = scrX(x, y), iy = scrY(x, y, 0);
    let hits = 0;
    for (const z of S.zombies) {
      if (z.dead || hits >= 2) continue;
      const zx = scrX(z.x, z.y), zy = scrY(z.x, z.y, 0), hw = z.big ? 9 : 6, hh = z.big ? 25 : 17;
      const onSprite = Math.abs(ix - zx) <= hw + 1 && iy >= zy - hh - 1 && iy <= zy + 2;
      if (!onSprite && Math.hypot(z.x - x, z.y - y) > CFG.mg.splash) continue;
      hits++;
      z.hp -= 1; z.flash = 0.08;
      burst(z.x, z.y, 8, 'blood', 3, 26);
      if (z.hp <= 0) kill(z, 'mg', x, y, 0);
    }
    if (hits && r.player) { S.hits++; S.hitT = 0.12; }
    S.impacts.push({ x, y, z: 1, age: 0, life: 0.07, size: 1 });
    for (let k = 0; k < 3; k++) {
      const a = R() * TAU, v = 30 + R() * 50;
      S.particles.push({ x, y, z: 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 20 + R() * 30, kind: 'spark', age: 0, life: 0.22 + R() * 0.15, g: 80, shade: 0 });
    }
    burst(x, y, 0.5, 'dirt', 3, 22);
    if (R() < 0.2) puff(x, y, 2, 1.2, 4, 0.28, 0.1, 0.8, 3, 0, 0);
    light(x, y, 4, 22, 1.6, 0.08, 'flash');
    if (!hits && R() < 0.5) addDecal({ type: 'hole', x, y, s: 1.3, seed: Math.floor(R() * 1e6) });
  }
  function explode(x, y, player) {
    let killed = 0, value = 0;
    nearby(x, y, CFG.he.hurt, (z, d) => {
      if (d >= CFG.he.kill) {
        z.hp -= 4; z.flash = 0.2;
        const k = 6 / Math.max(d, 1);
        z.x += (z.x - x) * k; z.y += (z.y - y) * k;
        if (z.hp > 0) return;
      }
      value += z.value; killed++;
      kill(z, 'he', x, y, d);
    });
    S.booms.push({ x, y, age: 0, life: 1.2, seed: Math.floor(R() * 1000), scale: 1.5, radius: CFG.he.kill });
    S.scorches.push({ x, y, r: 20, age: 0, life: 3, seed: Math.floor(R() * 1000) });
    addDecal({ type: 'scorch', x, y, s: 32 + R() * 6, seed: Math.floor(R() * 1e6) });
    light(x, y, 9, 120, 5, 0.5, 'flash');
    light(x, y, 6, 70, 2.2, 1.6, 'fire');
    burst(x, y, 1.5, 'dirt', 30, 85);
    burst(x, y, 2, 'spark', 24, 100);
    burst(x, y, 3, 'ember', 18, 60);
    burst(x, y, 2, 'debris', 10, 75, { hot: true });
    for (let j = 0; j < 16; j++) {
      const a = R() * TAU, r = R() * 11;
      puff(x + Math.cos(a) * r, y + Math.sin(a) * r, 3 + R() * 10, 5.5 + R() * 3, 4.5 + R() * 2.5, 0.9, 0.5, 2.8 + R() * 1.6, 7 + R() * 8, 0.12 + R() * 0.28, 1);
    }
    for (let k = 0; k < 10; k++) {
      const c = Math.cos(k * TAU / 10), sn = Math.sin(k * TAU / 10);
      S.puffs.push({ x: x + c * 8, y: y + sn * 8, z: 1.2, r0: 2.2, gr: 5.5, a: 0.32, dark: 0.3, life: 1.1, vz: 1.5, heat: 0, age: 0,
        vx: 0, vy: 0, px: c * 60, py: sn * 60, k: 2.8 });
    }
    S.events.push({ type: 'boom', kills: killed, x, y });
    if (player && (S.mode === 'play' || S.mode === 'ending') && killed) {
      S.bestBlast = Math.max(S.bestBlast, killed);
      S.numbers.push({ x, y, z: 22, text: '+' + value, color: 'gold', age: 0, life: 1.4, scale: killed >= 8 ? 2 : 1 });
      if (killed >= 4) S.events.push({ type: 'multi', kills: killed });
    }
  }
  function updateRounds(dt) {
    for (const r of S.rounds) {
      r.age += dt;
      if (r.kind === 'he' && r.age < r.travel) {
        const u = r.age / r.travel;
        S.lights.push({ x: lerp(r.a[0], r.b[0], u), y: lerp(r.a[1], r.b[1], u), z: lerp(r.a[2], r.b[2], u), r: 26, I: 1.1, age: 0, life: dt * 1.5, kind: 'fire' });
      }
      if (r.age >= r.travel) { r.done = true; if (r.kind === 'he') explode(r.b[0], r.b[1], r.player); else mgImpact(r); }
    }
    S.rounds = S.rounds.filter((r) => !r.done);
  }
  function updateEffects(dt) {
    for (const p of S.particles) {
      p.age += dt; p.vz -= (p.g === undefined ? 70 : p.g) * dt;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
    }
    S.particles = S.particles.filter((p) => p.age < p.life);
    for (const a of [S.numbers, S.impacts, S.lights, S.booms, S.scorches, S.puffs]) for (const e of a) e.age += dt;
    S.numbers = S.numbers.filter((e) => e.age < e.life);
    S.impacts = S.impacts.filter((e) => e.age < e.life);
    S.lights = S.lights.filter((e) => e.age < e.life);
    S.booms = S.booms.filter((e) => e.age < e.life);
    S.scorches = S.scorches.filter((e) => e.age < e.life);
    S.puffs = S.puffs.filter((e) => e.age < e.life);
  }

  // Title screen: the gunship works the horde on its own.
  function attract(dt) {
    if (S.burst) {
      S.burst.cd -= dt;
      while (S.burst.cd <= 0 && S.burst.n > 0) { fireMG(S.burst.x, S.burst.y, false); S.burst.n--; S.burst.cd += 1 / CFG.mg.rate; }
      if (S.burst.n <= 0) S.burst = null;
    }
    S.attractT -= dt;
    if (S.attractT > 0 || !S.zombies.length) return;
    S.attractT = 1.3 + R() * 1.6;
    const z = S.zombies[Math.floor(R() * S.zombies.length)], sx = scrX(z.x, z.y), sy = scrY(z.x, z.y, 0) - 8;
    if (sx < 120 || sx > W - 120 || sy < 90 || sy > H - 90) return;
    if (R() < 0.5) fireHE(sx, sy + 8, false); else S.burst = { x: sx, y: sy, n: 10, cd: 0 };
  }

  /* ------------------------------------------------------------- step */
  function update(dt) {
    S.t += dt;
    // the camera: WASD in play, a slow drift on the title
    if (S.mode === 'play') {
      const tx = S.pan[0] * CFG.pan, ty = S.pan[1] * CFG.pan, k = Math.min(1, dt * 6);
      S.vel[0] += (tx - S.vel[0]) * k; S.vel[1] += (ty - S.vel[1]) * k;
    } else if (S.mode === 'title') { S.vel[0] = 9; S.vel[1] = -4; } else { S.vel[0] *= 0.9; S.vel[1] *= 0.9; }
    S.cx += S.vel[0] * dt; S.cy += S.vel[1] * dt;
    applyView();
    if (S.mode === 'play') {
      S.run += dt; S.fuel -= dt;
      if (S.trigger && S.aim.seen) {
        S.mgCd -= dt;
        while (S.mgCd <= 0) { fireMG(S.aim.sx, S.aim.sy, true); S.mgCd += 1 / CFG.mg.rate; }
      } else S.mgCd = Math.max(0, S.mgCd - dt);
      S.heReload = Math.max(0, S.heReload - dt);
      if (S.fuel <= 0) { S.fuel = 0; S.mode = 'ending'; S.endT = 0; S.trigger = false; S.events.push({ type: 'fuelout' }); }
    } else if (S.mode === 'title') attract(dt);
    else if (S.mode === 'ending') { S.endT += dt; if (S.endT > 1.2) { S.mode = 'over'; S.over = true; } }
    S.hitT = Math.max(0, S.hitT - dt);
    updateZombies(dt);
    updateRounds(dt);
    updateDying(dt);
    updateEffects(dt);
  }

  /* ------------------------------------------------------------ views */
  function scene() {
    const dl = S.drawList;
    dl.length = 0;
    for (const z of S.zombies) { z.dep = depth(z.x, z.y, 0); dl.push(z); }
    for (const z of S.dying) { z.dep = depth(z.x, z.y, 0); dl.push(z); }
    S.ui = null;
    if (S.mode === 'play' && S.aim.seen) {
      const g = groundAtScreen(S.aim.sx, S.aim.sy, G3);
      S.ui = { cross: { x: S.aim.sx, y: S.aim.sy, firing: S.trigger, hit: S.hitT },
        ring: { x: g[0], y: g[1], r: CFG.he.kill, ready: S.heReload <= 0 } };
    } else if (S.mode === 'play') S.ui = {};
    return S;
  }
  reset(true);
  return {
    S, reset, update, scene, spawnScatter,
    start() { reset(false); S.mode = 'play'; S.zombies = []; spawnScatter(CFG.pop.start); },
    aim(sx, sy) { S.aim.sx = sx; S.aim.sy = sy; S.aim.seen = true; },
    trigger(on) { S.trigger = !!on && S.mode === 'play'; },
    fireHE() { if (S.mode === 'play' && S.heReload <= 0 && S.aim.seen) fireHE(S.aim.sx, S.aim.sy, true); },
    setPan(x, y) { S.pan[0] = x; S.pan[1] = y; },
  };
}
