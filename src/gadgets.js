// gadgets.js - hot steam clears climbers, then its optional cloud follows the train for two seconds.
// Each burst has one receipt per zombie, shared with its cloud. Steam uses ordinary white smoke
// particles and zombie damage helpers, never fire, scorch or train damage.
// Hooks: updateGadgets (step, after updateZombies); steamState (read-only run diagnostics).

// Base damage/ground reach, puff spacing/count, minimum emitter height and particle tuning (proposal)
const STEAMC = { damage: 2, interval: 5, reachStep: 6, wallReach: 24, cloudBase: 6, cloudDuration: 2,
  puffGap: 0.25, puffsPerVent: 2, refreshPuffs: 1, ventAcross: 8, ventZ: 3,
  life: [0.5, 0.75], size: [2, 3], grow: 8, growPerLevel: 3, sideSpeed: [24, 40], rise: [25, 45], carry: 0.45, drag: 2.6,
  colors: ['rgba(240,240,232,0.65)', 'rgba(214,218,214,0.5)'] };
const STEAM = { g: null }, STEAMBOX = { x0: 0, y0: 0, x1: 0, y1: 0 };

// Reset lazily with G, with the first burst due after the unit's full interval.
function steamState() {
  if (STEAM.g !== G) Object.assign(STEAM, { g: G, next: G.up.steamSpeed || STEAMC.interval,
    bursts: 0, hits: 0, kills: 0, cloudHits: 0, cloudKills: 0, lastBurst: null, cloud: null });
  return STEAM;
}

// Conservative bounds around the same extended car segments used by trainDist, on this frame.
function steamBounds(reach) {
  const b = STEAMBOX, margin = CAR.half + reach;
  b.x0 = b.y0 = Infinity; b.x1 = b.y1 = -Infinity;
  for (const c of G.tr.cars) {
    const x = c.x0 + c.dx * 6, y = c.y0 + c.dy * 6;
    b.x0 = Math.min(b.x0, c.x1, x); b.x1 = Math.max(b.x1, c.x1, x);
    b.y0 = Math.min(b.y0, c.y1, y); b.y1 = Math.max(b.y1, c.y1, y);
  }
  b.x0 -= margin; b.x1 += margin; b.y0 -= margin * FORE; b.y1 += margin * FORE;
  return b;
}
const steamEligible = (z) => !z.dead && !z.gone && !(z.gate && z.still);
function steamTouches(z, reach, bounds) {
  if (z.st === 2) return true;
  return reach > 0 && z.x >= bounds.x0 && z.x <= bounds.x1 && z.y >= bounds.y0 && z.y <= bounds.y1 &&
    trainDist(z.x, z.y) <= reach + 1e-9;
}

// One ordinary safe hit. The shared burst id prevents a victim from taking a second cloud hit.
function steamHit(z, id, damage, cloud) {
  const s = steamState();
  if (z.steamBurst === id) return false;
  z.steamBurst = id;
  const car = carNear(z.x, z.y), mount = trainMount(car, 0, 0, 0);
  JUICE.from = [mount.x, mount.y];
  const killed = hitZombie(z, damage, 'steam');
  JUICE.from = null;
  s.hits++; if (killed) s.kills++;
  if (cloud) { s.cloudHits++; if (killed) s.cloudKills++; }
  return killed;
}

// Two side vents per car, at its actual upper side rather than hidden inside a tall roof.
function steamPuffs(level, refresh) {
  const count = refresh ? STEAMC.refreshPuffs : STEAMC.puffsPerVent, tr = G.tr;
  for (let i = 0; i < tr.cars.length; i++) for (const side of [-1, 1]) {
    const c = tr.cars[i], m = trainMount(i, 0, side * STEAMC.ventAcross, Math.max(STEAMC.ventZ, TRAIN[i].tall - 1));
    for (let k = 0; k < count; k++) {
      const speed = rnd(...STEAMC.sideSpeed), life = rnd(...STEAMC.life);
      part({ x: m.x, y: m.y, z: m.z, vx: c.nx * side * speed + c.dx * tr.v * STEAMC.carry,
        vy: c.ny * side * speed * FORE + c.dy * tr.v * STEAMC.carry, vz: rnd(...STEAMC.rise), g: 0,
        life, max: life, s: rnd(...STEAMC.size), c: pick(STEAMC.colors),
        grow: STEAMC.grow + level * STEAMC.growPerLevel, drag: STEAMC.drag, smoke: true, source: 'steam' });
    }
  }
}

// A burst reaches every climber; upgrades additionally reach the envelope beside the train.
function steamBurst(s, now) {
  const level = G.up.steamReach || 0, reach = level * STEAMC.reachStep, damage = STEAMC.damage * (G.up.steamDamage || 1);
  const id = ++s.bursts, bounds = steamBounds(reach);
  let hits = 0, kills = 0;
  for (const z of G.zombies) {
    if (!steamEligible(z) || !steamTouches(z, reach, bounds)) continue;
    hits++; if (steamHit(z, id, damage, false)) kills++;
  }
  // Steam at the nose reaches the face of the wall that stopped this train. (proposal: 24 px)
  const wall = blockingWall();
  if (wall && trainDist(wall.x, wall.y) <= STEAMC.wallReach) {
    hits++; if (steamHit(wall.target, id, damage, false)) kills++;
  }
  const duration = G.up.hotCloud || 0;
  s.lastBurst = { id, t: now, damage, reach, hits, kills, cloudDuration: duration };
  steamPuffs(level, false);
  if (!G.demo) SFX.hiss();
  if (duration > 0) s.cloud = { id, time: duration, age: 0, duration, reach: STEAMC.cloudBase + reach,
    damage, puffNext: STEAMC.puffGap };
}

// Only nearby ground candidates pay for trainDist; attached climbers always qualify.
function steamCloudHits(cloud) {
  const bounds = steamBounds(cloud.reach);
  for (const z of G.zombies) {
    if (z.steamBurst === cloud.id || !steamEligible(z) || !steamTouches(z, cloud.reach, bounds)) continue;
    steamHit(z, cloud.id, cloud.damage, true);
  }
  const wall = blockingWall();
  if (wall && trainDist(wall.x, wall.y) <= Math.max(STEAMC.wallReach, cloud.reach))
    steamHit(wall.target, cloud.id, cloud.damage, true);
}

// Clouds age in game time, while the absolute burst clock keeps the upgrade's exact cadence.
function updateGadgets(dt) {
  const s = steamState();
  if (!G.up.steamVent || G.result || !(mode === 'play' || G.demo)) { s.cloud = null; return; }
  if (s.cloud) {
    const c = s.cloud;
    c.age += dt; c.time = Math.max(0, c.duration - c.age);
    if (c.time <= 1e-9) s.cloud = null;
    else {
      steamCloudHits(c);
      if (c.age >= c.puffNext - 1e-9) {
        steamPuffs(G.up.steamReach || 0, true);
        c.puffNext += STEAMC.puffGap;
      }
    }
  }
  const now = heliWeaponTime();
  if (now < s.next - 1e-9) return;
  steamBurst(s, now);
  s.next += G.up.steamSpeed || STEAMC.interval;
  if (s.cloud) steamCloudHits(s.cloud);
}
