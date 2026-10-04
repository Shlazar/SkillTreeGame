// run mode: MG cadence, targeting, upgrades, three mounts, and performance.
// MG fixtures isolate its actual targeting and cadence from helicopter fire and ambient spawns.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(actual, expected, label) { check(Math.abs(actual - expected) < 1e-6, label + ': ' + actual); }
function freshMG(maximum = false, ap = false, count = maximum ? 3 : 1, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of Object.entries({mgCar: 1, mgDamage: maximum ? 5 : 0,
    mgRate: maximum ? 5 : 0, mgRange: maximum ? 3 : 0, mgTurrets: count - 1, apRounds: ap ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing MG node ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, anchors: []}; }
function add(f, x, y, hp = 1000000) {
  const z = __sr.spawn(0, x - f.g.camX, y - f.g.camY); z.hp = hp; z.sp = 0;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead && a.z.st !== 2) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function firstShot(f) {
  const before = __sr.units().mg.shots;
  for (let i = 0; i < 180 && __sr.units().mg.shots === before; i++) advance(f, 1);
  check(__sr.units().mg.shots > before, 'MG did not fire at an eligible target');
  return __sr.units().mg;
}

function mgShot(camera = 0) {
  freshMG(true, true); __sr.thermal(camera); __sr.sim(8); __sr.frames(240);
  let curved = false;
  for (const km of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    __sr.km(km); __sr.sim(1 / 60);
    if (Math.abs(__sr.G.tr.cars[3].dx) > 0.1) { curved = true; break; }
  }
  check(curved, 'MG view did not find a genuinely curved track section');
  const f = field(), c = f.g.tr.cars[3], mg = __sr.units().mg;
  check(mg.count === 3 && mg.turrets.length === 3, 'Three actual MG turrets missing');
  for (const t of mg.turrets) {
    near(t.x, c.cx + c.dx * t.along + c.nx * (t.across || 0), 'Curved turret X anchor');
    near(t.y, c.cy + c.dy * t.along + c.ny * (t.across || 0), 'Curved turret Y anchor');
  }
  for (let i = 0; i < 9; i++) add(f, c.cx + 48 + i % 3 * 14, c.cy + (Math.floor(i / 3) - 1) * 12, 100);
  for (let i = 0; i < 180; i++) {
    advance(f, 1, true);
    if (__sr.units().mg.turrets.every(t => t.flash > 0) && __sr.gunVisual().hits.some(h => h.scale === 0.6)) break;
  }
  const state = __sr.units().mg, hits = __sr.gunVisual().hits;
  check(state.turrets.every(t => t.flash > 0 && t.shots > 0) && hits.some(h => h.scale === 0.6),
    'MG view did not capture actual smaller muzzle flashes and hit sparks');
  check(f.g.rounds.length === 0 && __sr.rockets().shots === 0, 'MG view introduced tracers/heli rounds');
  const art = state.art;
  check(art.normal === 32 && art.hot === 32 && art.barrel === 32 && art.hotBarrel === 32,
    'MG normal/thermal heading sprites were not baked together');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {camera, state: __sr.units().mg, hits, car: {x: c.cx - f.g.camX, y: c.cy - f.g.camY,
    dx: c.dx, dy: c.dy}, crop: {x: Math.round(c.cx - f.g.camX - 28), y: Math.round(c.cy - f.g.camY - 32), w: 56, h: 64, scale: 4}};
}

const cadence = [];
for (const maximum of [false, true]) {
  freshMG(maximum); const f = field(), c = f.g.tr.cars[3]; add(f, c.cx + 55, c.cy);
  const initial = __sr.units().mg;
  check(initial.enabled && initial.count === (maximum ? 3 : 1) && initial.pierce === 1, 'Wrong MG count/pierce');
  near(initial.damage, maximum ? 2.25 : 1, 'MG damage'); near(initial.rate, maximum ? 3.5 : 2, 'MG rate');
  near(initial.range, maximum ? 145 : 100, 'MG range');
  advance(f, 60); const before = __sr.units().mg;
  advance(f, 1800); const after = __sr.units().mg, expected = maximum ? 105 : 60;
  const byTurret = after.turrets.map((t, i) => t.shots - before.turrets[i].shots);
  check(byTurret.every(n => Math.abs(n - expected) <= 1) &&
    Math.abs(after.shots - before.shots - expected * initial.count) <= initial.count,
    'Actual thirty-second MG cadence failed: ' + JSON.stringify({maximum, expected, byTurret, before, after}));
  check(__sr.rockets().shots === 0 && f.g.rounds.length === 0, 'Cadence included helicopter/tracer shots');
  cadence.push({maximum, seconds: 30, expectedPerTurret: expected, byTurret, total: after.shots - before.shots, stats: after});
}

const piercing = [];
for (const ap of [false, true]) {
  freshMG(false, ap); const f = field(), c = f.g.tr.cars[3];
  // Find a ray where ordinary scenery avoidance leaves the stationary targets in line.
  // Disable only this weapon during the placement probe, then fire through its real update path.
  __sr.units().mg;
  const enabled = f.g.up.mgCar; let targets, control, ray = null;
  f.g.up.mgCar = false;
  try {
    for (const angle of [0, Math.PI, Math.PI / 4, -Math.PI / 4, Math.PI * 0.75, -Math.PI * 0.75]) {
      f.g.zombies.length = f.anchors.length = 0;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      targets = [42, 62, 82, 95].map(d => add(f, c.cx + ux * d, c.cy + uy * d * 0.72, 100));
      control = add(f, c.cx + ux * 60 - uy * 20, c.cy + (uy * 60 + ux * 20) * 0.72, 100);
      advance(f, 30);
      if (f.anchors.every(a => Math.hypot(a.z.x - a.x, (a.z.y - a.y) / 0.72) < 0.1)) {
        ray = {angle, positions: targets.map(z => ({x: z.x, y: z.y}))}; break;
      }
    }
  } finally { f.g.up.mgCar = enabled; }
  check(ray, 'AP placement could not find an unobstructed actual ray through four targets');
  const state = firstShot(f);
  const expected = ap ? [99, 99, 99, 100] : [99, 100, 100, 100];
  check(targets.every((z, i) => Math.abs(z.hp - expected[i]) < 1e-6) && control.hp === 100 && state.shots === 1,
    'MG AP did not hit only the first three inline targets: ' + JSON.stringify({ap, hp: targets.map(z => z.hp), control: control.hp, state}));
  piercing.push({ap, ray, hp: targets.map(z => z.hp), control: control.hp, shot: state.lastShot});
}

const ranges = [];
for (const maximum of [false, true]) {
  freshMG(maximum, false, 1); const f = field(), c = f.g.tr.cars[3], z = add(f, c.cx + 120, c.cy, 100);
  if (maximum) { firstShot(f); near(z.hp, 97.75, 'Max-range real bullet damage'); }
  else { advance(f, 60); check(z.hp === 100 && __sr.units().mg.shots === 0, 'Base MG fired beyond its100px range'); }
  ranges.push({maximum, hp: z.hp, range: __sr.units().mg.range});
}

freshMG(); const priorityField = field(), car = priorityField.g.tr.cars[3], rear = priorityField.g.tr.cars[4];
const nearWalker = add(priorityField, car.cx + car.nx * 22, car.cy + car.ny * 22, 100);
const attached = add(priorityField, rear.cx + rear.nx * 10, rear.cy + rear.ny * 10, 100);
Object.assign(attached, {st: 2, car: 4, side: 1, al: 0, ox: 0, dmg: 0, dps: 0, bang: 0});
const priorityState = firstShot(priorityField);
check(attached.hp === 99 && nearWalker.hp === 100, 'MG failed to prioritize a zombie attached to the train');

freshMG(true, false, 1); const safeField = field(), flat = safeField.g.tr.cars[2];
const hp = safeField.g.tr.hp, hurt = JSON.stringify(safeField.g.hurt);
const safeTarget = add(safeField, flat.cx + flat.nx * 20, flat.cy + flat.ny * 20, 100);
firstShot(safeField); advance(safeField, 30);
check(safeTarget.hp < 100 && safeField.g.tr.hp === hp && JSON.stringify(safeField.g.hurt) === hurt,
  'Actual MG fire failed to hit across the train safely');

freshMG(); const killField = field(), killCar = killField.g.tr.cars[3], walker = add(killField, killCar.cx + 55, killCar.cy, 2);
advance(killField, 90);
check(walker.dead && __sr.units().mg.kills === 1, 'MG did not credit an actual two-hit walker kill');
const shots = [];
for (const camera of [0, 1]) { const shot = mgShot(camera); __sr.frames(30); check(__sr.late() <= 1, 'MG normal/thermal rendering added late pages'); shots.push(shot); }

mgShot(0); __sr.hold(false); __sr.sim(0.12); __sr.hold(true); __sr.frames(30);

freshMG(true, true, 3, false); __sr.give(3000, 30); __sr.bot(true); __sr.sim(20); __sr.frames(30);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), mg: __sr.units().mg};
check(performance.mg.kills > 0 && performance.mg.shots > 0 && performance.late <= 1, 'Busy MG benchmark missed actual firing/kills');
__sr.sim(10); __sr.frames(30);
const lateProbe = {stats: __sr.stats(), mg: __sr.units().mg, late: __sr.late()};
check(lateProbe.late <= 1, 'Thirty-second MG probe created late pages');
QA_DONE({cadence, piercing, ranges, onTrainPriority: priorityState.lastShot,
  friendlySafe: {hp, targetHp: safeTarget.hp}, actualWalkerKill: true, shots, bothExactShotsRendered: true,
  performance, lateProbe, baseline: {bench: 3.27, render: 2.97, late: 1}});
