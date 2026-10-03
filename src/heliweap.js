// heliweap.js - the Viper's automatic weapons. A nose-gun shot can become a rocket, with a short
// smoke trail and an area blast. Projectiles carry their own numbers and world launch position.
// Friendly blasts use zombie damage helpers only, so they cannot hurt the train.

const HWC = {
  // Seconds without a rocket before the next nose-gun shot must become one.
  rocketWait: 6,
  // Flight seconds, blast radius/damage, arc height, smoke lifetime and hot streak spacing (proposal)
  rocket: { travel: 0.25, radius: 16, damage: 6, arc: 12, smokeLife: [0.4, 0.6], streakStep: 0.005 },
  // Ground range, launch/retry seconds, spread/mount px, flash seconds and glow radius (proposal)
  pod: { range: 180, gap: 0.08, retry: 0.25, spread: 8, mountX: 11, mountY: -9, flash: 0.07, flashRadius: 8 }
};
// Lazy run state also works behind the title: a new G starts fresh counters without touching SAVE.
// first/last/maxGap are game seconds since departure; shots includes ordinary bullets.
const HW = { g: null };
const heliWeaponTime = () => G.demo ? G.t : G.run;
function heliWeaponState() {
  if (HW.g !== G) Object.assign(HW, {
    g: G, shots: 0, rockets: 0, first: null, last: 0, maxGap: 0,
    forced: !G.demo && G.up.rocketChance > 0 && !SAVE.flags.rocketShown,
    impacts: 0, kills: 0, lastImpact: null,
    pods: { next: G.up.podReload, retry: 0, salvos: 0, shots: 0, queue: [],
      lastTarget: null, impacts: 0, kills: 0, lastImpact: null }
  });
  return HW;
}
// Exact crowd count at every living zombie centre in reach. The grid keeps each local count small;
// callers search only when a weapon is due, never for every projectile or every frame.
function bestCrowd(x, y, R, r) {
  let best = null, distance = Infinity;
  queryEll(x, y, R, (z, d) => {
    if (z.gone || z.gate && z.still) return;
    let count = 0;
    queryEll(z.x, z.y, r, (q) => {
      if (!q.gone && !(q.gate && q.still)) count++;
    });
    if (!best || count > best.count || count === best.count && d < distance) {
      best = { x: z.x, y: z.y, count };
      distance = d;
    }
  });
  return best;
}
// Pod payload and target are fixed for a salvo; its launch position follows the actual heli.
function launchPod(q) {
  const p = heliWeaponState().pods, h = q.h, c = HWC.pod;
  const [ox, oy] = turnXY(h.hd, q.side * c.mountX, c.mountY);
  G.rounds.push({ kind: 'rocket', source: 'pods', h, tgt: null,
    sx: h.x + ox, sy: h.y + oy, sz: h.alt + 1, bx: q.x, by: q.y,
    age: 0, T: q.T, dmg: q.dmg, R: q.R, arc: q.arc, player: true });
  h.podFlash[q.side < 0 ? 0 : 1] = c.flash;
  p.shots++;
  if (!G.demo) { G.shots++; SFX.rocket(); }
}
// Automatic pods have their own range and reload: Gun Range affects only the nose gun.
function updateHeliWeapons(dt) {
  const p = heliWeaponState().pods, now = heliWeaponTime(), c = HWC.pod;
  if (!G.up.pods || G.result || !(mode === 'play' || G.demo)) {
    p.queue.length = 0;
    return;
  }
  while (p.queue.length && p.queue[0].at <= now + 1e-9) launchPod(p.queue.shift());
  if (now < p.next - 1e-9 || now < p.retry - 1e-9) return;
  const h = G.helis[0];
  if (!h) return;
  const target = bestCrowd(h.x, h.y, c.range, HWC.rocket.radius);
  if (!target) { p.retry = now + c.retry; return; }
  p.salvos++;
  p.lastTarget = { ...target, t: now };
  // Waiting for a crowd does not bank missed salvos to launch all at once.
  p.next = now + G.up.podReload;
  p.retry = 0;
  const n = G.up.podSalvo, rocket = HWC.rocket;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU;
    const q = { h, at: now + k * c.gap, side: k % 2 ? 1 : -1,
      x: target.x + Math.cos(a) * c.spread, y: target.y + Math.sin(a) * c.spread * FORE,
      dmg: rocket.damage * G.up.podDamage, R: rocket.radius, T: rocket.travel, arc: rocket.arc };
    if (k === 0) launchPod(q);
    else p.queue.push(q);
  }
}
// Called for every nose-gun shot. True means a rocket replaced the ordinary bullet.
function heliRocketShot(h, z) {
  const state = heliWeaponState(), chance = G.up.rocketChance || 0, now = G.run;
  state.shots++;
  if (chance <= 0) return false;
  const rolled = Math.random() < chance;
  // The epsilon prevents an exact six-second cadence from slipping to the next .25 s shot.
  const overdue = now - state.last >= HWC.rocketWait - 1e-9;
  if (!state.forced && !overdue && !rolled) return false;

  const c = HWC.rocket, [nx, ny] = turnXY(h.hd, 0, -HC.nose);
  const r = { kind: 'rocket', h, tgt: z, sx: h.x + nx, sy: h.y + ny, sz: h.alt + 1,
    bx: z.x + z.vx * c.travel, by: z.y + z.vy * c.travel, age: 0, T: c.travel,
    dmg: c.damage, R: c.radius, arc: c.arc, player: true };
  // Reserve the rocket's own blast damage, and release that same amount on impact.
  z.pending += r.dmg;
  G.rounds.push(r);
  state.rockets++;
  if (state.first === null) state.first = now;
  state.maxGap = Math.max(state.maxGap, now - state.last);
  state.last = now;
  state.forced = false;
  if (!G.demo) {
    if (!SAVE.flags.rocketShown) { SAVE.flags.rocketShown = true; saveSave(); }
    SFX.rocket();
  }
  return true;
}
// World x/y and height: the launch coordinates are on the ground, with altitude applied once.
function rocketAt(r, age = r.age) {
  const u = clamp(age / r.T, 0, 1);
  return [lerp(r.sx, r.bx, u), lerp(r.sy, r.by, u), lerp(r.sz, 0, u) + Math.sin(u * Math.PI) * r.arc];
}
// updateRounds advances age first. One small, short-lived smoke puff follows each step.
function updateRocket(r, dt) {
  const [x, y, z] = rocketAt(r), life = rnd(...HWC.rocket.smokeLife);
  part({ x, y, z, vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(1, 4), g: 0,
    life, max: life, s: 2, grow: 4, drag: 1.2, smoke: true,
    c: pick(['rgba(176,168,158,0.6)', 'rgba(136,128,120,0.55)']) });
}
// A bright pixel head and a short streak, using the same rounded-pixel drawing as 105 shells.
function drawRocket(r) {
  const [x, y, z] = rocketAt(r), px = Math.round(x), py = Math.round(y - z);
  let hx = px, hy = py;
  for (let k = 1; k <= 6; k++) {
    const [bx, by, bz] = rocketAt(r, Math.max(0, r.age - k * HWC.rocket.streakStep));
    const tx = Math.round(bx), ty = Math.round(by - bz);
    ctx.globalAlpha = 1 - k / 7;
    pl(ctx, hx, hy, tx, ty, k < 3 ? '#ffd27a' : '#c9772f');
    hx = tx;
    hy = ty;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = thermal ? '#ffffff' : '#fff6e0';
  ctx.fillRect(px - 1, py - 1, 3, 2);
  light(px, py, 12, '#ffd27a', 0.8);
  ctx.globalAlpha = 1;
}
// A medium blast follows the existing strafeBlast recipe, without its random sound choice.
function rocketBlast(x, y) {
  addBoom(x, y - 1, rnd(13, 17), 7, 0.8, 8);
  lights.push({ x, y, z: 4, r: rnd(44, 56), c: '#ffb060', life: 0.3, max: 0.3, a: 0.7 });
  rings.push({ x, y, r0: 4, r1: 26, t: 0, T: 0.22, c: '#fff1c2', w: 2 });
  for (let i = 0; i < 6; i++) {
    const a = rnd(TAU), v = rnd(40, 90);
    part({ x, y, z: 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * FORE, vz: rnd(30, 80), g: 200,
      life: rnd(0.3, 0.5), max: 0.5, s: 1, c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 1.5 });
  }
  stampScorch(x, y, 1);
  if (!G.demo) {
    addShake(0.08);
    SFX.boom();
  }
}
// Lethal blast hits throw bodies from the actual centre; survivors of a hit use a gun cause.
function rocketImpact(r) {
  const weapons = heliWeaponState(), state = r.source === 'pods' ? weapons.pods : weapons, x = r.bx, y = r.by;
  if (r.tgt) r.tgt.pending = Math.max(0, r.tgt.pending - r.dmg);
  let hits = 0, killed = 0;
  queryEll(x, y, r.R, (z, d) => {
    if (z.gone || z.gate && z.still) return;
    hits++;
    if (z.hp <= r.dmg) {
      kill(z, 'he', x, y, d);
      killed++;
    } else {
      JUICE.from = [x, y];
      hitZombie(z, r.dmg, 'boom');
      JUICE.from = null;
    }
  });
  state.impacts++;
  state.kills += killed;
  state.lastImpact = { x, y, radius: r.R, damage: r.dmg, hits, kills: killed, t: heliWeaponTime() };
  if (hits && r.player && !G.demo) {
    G.hits++;
    G.hitT = 0.12;
  }
  rocketBlast(x, y);
}
