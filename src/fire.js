// fire.js - burning ground shared by Napalm and planes; Fire Walls also stop walking zombies.
// Hooks: updateBurn (step), drawBurn/drawBurnFx (render), blockBurnWall (updateZombies).
// Each patch has its own damage cadence. Overlapping patches stack, and only zombies take hits.
const BURNC = {
  step: 0.25,
  // Patch cap, flame count/spread, final fade seconds and glow radius/opacity/flicker (proposal)
  cap: 60, flames: 7, spread: 0.6, fade: 0.35, glow: 1.5, alpha: 0.38, flicker: 0.08,
  // Zombie body padding outside a blocking patch, in ground px (proposal)
  wallPad: 2, wallBrutePad: 3
};
const BURN = [];
const BURNWALL = [];
const BURNSTAT = { g: null, kills: 0, ticks: 0, hits: 0, created: 0 };
function clearBurn() {
  BURN.length = BURNWALL.length = 0;
  Object.assign(BURNSTAT, { g: G, kills: 0, ticks: 0, hits: 0, created: 0 });
}
// Debug readers and weapon calls can arrive before the first simulation step of a new run.
function burnState() {
  if (BURNSTAT.g !== G) clearBurn();
  return BURNSTAT;
}
function addBurn(x, y, R, duration, dps, source = 'napalm', wall = false) {
  const stats = burnState();
  if (!(R > 0 && duration > 0 && dps > 0)) return null;
  if (BURN.length >= BURNC.cap) {
    // Ordinary fire must not open a hole in an active Fire Wall. Two F-4 charges fit under the cap.
    const old = BURN.findIndex((p) => !p.wall);
    if (old < 0) return null;
    BURN.splice(old, 1);
  }
  const p = { x, y, R, time: duration, age: 0, duration, dps, tick: 0, source, wall, seed: rnd(TAU) };
  BURN.push(p);
  if (wall) BURNWALL.push(p);
  stats.created++;
  // A persistent mark is stamped once, rather than on every tick or rendered frame.
  stampScorch(x, y, 1);
  return p;
}
function burnTick(p, seconds) {
  const stats = burnState();
  stats.ticks++;
  if (G.result) return;
  queryEll(p.x, p.y, p.R, (z) => {
    if (z.gone || z.gate && z.still) return;
    stats.hits++;
    JUICE.from = [p.x, p.y];
    if (hitZombie(z, p.dps * seconds, 'fire')) stats.kills++;
    JUICE.from = null;
  });
}
function updateBurn(dt) {
  burnState();
  if (!(dt > 0)) return;
  for (let i = BURN.length - 1; i >= 0; i--) {
    const p = BURN[i], alive = Math.min(dt, p.time);
    p.age = Math.min(p.duration, p.age + alive);
    p.time = Math.max(0, p.duration - p.age);
    p.tick += alive;
    while (p.tick >= BURNC.step - 1e-9) {
      burnTick(p, BURNC.step);
      p.tick = Math.max(0, p.tick - BURNC.step);
    }
    if (p.time <= 1e-9) {
      // A non-quarter-second lifetime still deals only its actual final fraction of damage.
      if (p.tick > 1e-9) burnTick(p, p.tick);
      if (p.wall) BURNWALL.splice(BURNWALL.indexOf(p), 1);
      BURN.splice(i, 1);
    }
  }
}
// Stop at the first edge of a burning patch, including fast movement and crowd pushes.
// Swept circles use the same ground ellipse as damage. A zombie already caught inside can leave outwards.
function blockBurnWall(z, x0, y0) {
  if (z.gate && z.still) return false;
  let stopped = false;
  for (const p of BURNWALL) {
    const R = p.R + (z.big ? BURNC.wallBrutePad : BURNC.wallPad), ry = R * FORE;
    if (Math.min(x0, z.x) > p.x + R || Math.max(x0, z.x) < p.x - R ||
        Math.min(y0, z.y) > p.y + ry || Math.max(y0, z.y) < p.y - ry) continue;
    const ax = x0 - p.x, ay = (y0 - p.y) / FORE;
    const bx = z.x - p.x, by = (z.y - p.y) / FORE, rr = R * R;
    const d0 = ax * ax + ay * ay, d1 = bx * bx + by * by;
    if (d0 < rr) {
      if (d1 >= rr && ax * bx + ay * by >= 0) continue;
      const dx = d0 > 1e-9 ? ax : bx || 1, dy = d0 > 1e-9 ? ay : by;
      const d = Math.hypot(dx, dy);
      z.x = p.x + dx / d * (R + 0.01);
      z.y = p.y + dy / d * (R + 0.01) * FORE;
    } else {
      const dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
      const b = ax * dx + ay * dy, disc = b * b - a * (d0 - rr);
      if (a < 1e-9 || b >= 0 || disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / a;
      if (t < 0 || t > 1) continue;
      const before = Math.max(0, t - 0.001);
      z.x = x0 + dx * before;
      z.y = y0 + dy * before * FORE;
    }
    z.vx = z.vy = z.kbx = z.kby = 0;
    z.k = z.y;
    stopped = true;
  }
  return stopped;
}
function drawBurn() {
  for (const p of BURN) {
    if (offView(p.x, p.y, p.R)) continue;
    ctx.globalAlpha = Math.min(1, p.time / BURNC.fade);
    for (let k = 0; k < BURNC.flames; k++) {
      const a = (k - 1) / (BURNC.flames - 1) * TAU + p.seed;
      const r = k ? p.R * BURNC.spread : 0;
      drawFlame(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * FORE, false, p.seed + k);
    }
  }
  ctx.globalAlpha = 1;
}
// Called in the existing additive pass. It uses the scenery-fire glow colour already cached.
function drawBurnFx() {
  for (const p of BURN) {
    if (offView(p.x, p.y, p.R)) continue;
    const fade = Math.min(1, p.time / BURNC.fade);
    light(p.x, p.y - 3, p.R * BURNC.glow, '#ff9a4a',
      (BURNC.alpha + Math.sin(realT * 13 + p.seed) * BURNC.flicker) * fade);
  }
  ctx.globalAlpha = 1;
}
