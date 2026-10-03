// fire.js - short-lived burning ground shared by Napalm and later fire weapons.
// Each patch has its own damage cadence. Overlapping patches stack, and only zombies take hits.
const BURNC = {
  step: 0.25,
  // Patch cap, flame count/spread, final fade seconds and glow radius/opacity/flicker (proposal)
  cap: 60, flames: 7, spread: 0.6, fade: 0.35, glow: 1.5, alpha: 0.38, flicker: 0.08
};
const BURN = [];
const BURNSTAT = { g: null, kills: 0, ticks: 0, hits: 0, created: 0 };
function clearBurn() {
  BURN.length = 0;
  Object.assign(BURNSTAT, { g: G, kills: 0, ticks: 0, hits: 0, created: 0 });
}
// Debug readers and weapon calls can arrive before the first simulation step of a new run.
function burnState() {
  if (BURNSTAT.g !== G) clearBurn();
  return BURNSTAT;
}
function addBurn(x, y, R, duration, dps, source = 'napalm') {
  const stats = burnState();
  if (!(R > 0 && duration > 0 && dps > 0)) return null;
  if (BURN.length >= BURNC.cap) BURN.shift();
  const p = { x, y, R, time: duration, age: 0, duration, dps, tick: 0, source, seed: rnd(TAU) };
  BURN.push(p);
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
      BURN.splice(i, 1);
    }
  }
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
