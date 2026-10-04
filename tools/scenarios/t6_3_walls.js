// run mode: natural leg5 wall timing, real Ram breaks, isolated weapon damage and wall views.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function wall() { return __sr.wallState()[0]; }
function freshWall(nodes = {hdmg: 2, hrate: 2}, quiet = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const [id, level] of Object.entries(nodes)) check(__sr.node(id, level) === true, 'Wall setup node failed: ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.leg(quiet ? 1 : 5); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (quiet) {
    const g = __sr.G, h = g.helis[0];
    g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
    g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[0].events.length;
    h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
    __sr.hp(80);
  }
}
function until(predicate, seconds = 80, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Wall condition timed out: ' + JSON.stringify({wall: wall(), state: __sr.legState(), stats: __sr.stats()}));
}
function naturalStop() {
  freshWall(); until(() => wall()?.stoppedAt != null);
  const w = wall();
  check(w.leg === 5 && w.eventId === 'leg-5-event-3' && w.spawnT >= 27 - 1e-6 && !w.broken &&
    Math.abs(__sr.G.tr.s - w.stopS) < 0.01 && __sr.G.tr.v === 0,
    'Natural leg5 wall did not stop the train in front of its live shared HP: ' + JSON.stringify(w));
  return w;
}
function wallShot(stage) {
  return seeded(0x633, () => {
    freshWall();
    // Let the start notice expire on the real UI clock without changing the natural ride.
    __sr.pause(true); __sr.frames(240); __sr.pause(false);
    if (stage === 'ahead') until(() => {
      const w = wall(); return w && !w.broken && w.stoppedAt == null && w.sy >= 85 && w.sy < __sr.stats().VH - 40;
    });
    else {
      until(() => wall()?.stoppedAt != null);
      if (stage === 'mid') until(() => wall() && !wall().broken && __sr.G.run - wall().stoppedAt >= 3);
      else {
        until(() => !!wall()?.broken); const brokenAt = wall().brokenAt;
        until(() => __sr.G.run - brokenAt >= 0.22, 2, true);
      }
    }
    const w = wall();
    check(stage === 'break' ? w.broken && w.hp === 0 && __sr.fx().parts > 0 : w.hp > 0 && w.hp <= w.max,
      'Wall view lacks actual HP/damage or the real break effect: ' + stage);
    if (stage === 'mid') check(w.hp < w.max && w.stoppedAt != null, 'Mid-wall view is not an actual stopped fight');
    __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(120);
    return {stage, wall: wall(), fx: __sr.fx(), stats: __sr.stats(),
      crop: {x: Math.round(w.sx - 42), y: Math.round(w.sy - 30), w: 84, h: 70, scale: 4}};
  });
}

const natural = seeded(0x633, () => {
  const stopped = naturalStop(), g = __sr.G, s = g.tr.s;
  check(g.helis[0].order === null || g.helis[0].order == null, 'Natural wall ride forced a helicopter attack order');
  until(() => !!wall()?.broken); const broken = wall(), elapsed = broken.brokenAt - broken.stoppedAt;
  check(elapsed >= 8 && elapsed <= 10, 'Natural dmg2/rate2 wall fight is outside8–10s after stop: ' + JSON.stringify({elapsed, stopped, broken}));
  check(broken.hp === 0 && broken.max > 0 && !broken.rammed && broken.lootId,
    'Natural bullet break did not resolve shared HP and its stable loot receipt');
  until(() => g.tr.v > 0 && g.tr.s < s - 10, 5);
  const piles = __sr.loot().filter(f => f.eventId === broken.lootId);
  check(piles.length === 1 && piles[0].kind === 'pile' && !piles[0].gone, 'Broken wall did not create exactly one collectible scrap pile');
  const pile = piles[0], before = g.pay.loot;
  __sr.order(0, 'move', pile.x, pile.y); until(() => __sr.loot()[pile.i].gone && g.pay.loot > before, 10);
  check(g.pay.loot - before === pile.pay, 'Wall pile paid an incorrect amount');
  const paid = g.pay.loot; __sr.sim(0.5);
  check(g.pay.loot === paid && __sr.loot().filter(f => f.eventId === broken.lootId).length === 1,
    'Wall break or pile paid more than once');
  return {stopped, broken, secondsAfterStop: elapsed, trainResumed: true, pile, actualPickupPay: paid - before,
    stats: __sr.stats(), state: __sr.legState()};
});

const rams = [];
for (const moving of [false, true]) {
  freshWall({ram: 1}, true);
  const initial = __sr.wallFixture({ahead: moving ? 80 : 20, hp: 1000, id: 'qa-ram-' + moving});
  check(initial && initial.hp === 1000, 'Ram wall fixture was not created');
  if (!moving) until(() => wall()?.stoppedAt != null, 2);
  const before = wall(), hp = __sr.G.tr.hp; __sr.press(' ');
  if (moving) until(() => !!wall()?.broken, 2);
  else { __sr.sim(1 / 60); check(wall().broken, 'One real Space activation while stopped did not break the wall on its first tick'); }
  const broken = wall();
  check(broken.hp === 0 && broken.rammed && __sr.ramInfo().uses === 1 && __sr.G.tr.hp === hp &&
    (moving ? before.stoppedAt == null && broken.stoppedAt == null : before.stoppedAt != null),
    'One-charge Ram wall break or train safety failed');
  const s = __sr.G.tr.s; until(() => __sr.G.tr.v > 0 && __sr.G.tr.s < s - 10, 3);
  rams.push({moving, before, broken, ram: __sr.ramInfo(), trainResumed: true});
}

const cases = [
  {name: 'MG', nodes: {mgCar: 1}, seconds: 2, active: () => __sr.units().mg.shots > 0},
  {name: 'MG_AP', nodes: {mgCar: 1, apRounds: 1}, seconds: 2, active: () => __sr.units().mg.shots > 0},
  {name: 'Steam', nodes: {steamVent: 1}, seconds: 6, active: () => __sr.steam().bursts > 0},
  {name: 'Rockets', nodes: {rockets: 1}, seconds: 3, active: () => __sr.rockets().impacts > 0, heli: true},
  {name: 'Pods', nodes: {rocketPods: 1}, seconds: 10, active: () => __sr.units().pods.impacts > 0},
  {name: 'Hellfire', nodes: {hellfire: 1}, seconds: 12, active: () => __sr.units().hellfire.impacts > 0},
  {name: 'Katyusha', nodes: {katyusha: 1}, seconds: 18, active: () => __sr.units().katyusha.impacts > 0},
  ...['a10', 'f4', 'b52', 'b2'].map(id => ({name: id, nodes: {}, seconds: 10, plane: id,
    active: () => id === 'f4' ? __sr.fires().some(f => f.source === 'f4') :
      id === 'a10' ? __sr.planeShow().jets.some(j => j.id === id && j.fired) : __sr.planeShow().stats[id].impacts > 0}))
];
const completedWeapons = [];
const weapons = cases.map(c => {
  try { return seeded(0x634, () => {
  freshWall(c.nodes, true);
  check(__sr.wallFixture({ahead: 20, hp: 1000, id: 'qa-' + c.name}), 'Missing isolated wall: ' + c.name);
  until(() => wall()?.stoppedAt != null, 2);
  const w = wall(), g = __sr.G, hp = g.tr.hp;
  if (c.heli) { g.helis[0].cd = g.helis[0].look = 0; g.helis[0].order = null; }
  if (c.plane) {
    check(__sr.planeFixture(c.plane, 0), 'Plane wall fixture was not readied: ' + c.plane);
    // AIR can change the world viewport; read the live wall screen point after the fixture.
    const nose = g.tr.cars[0], angle = Math.atan2(nose.dy, nose.dx), target = wall();
    check(__sr.strike('q', target.sx, target.sy, angle), 'Actual plane strike was rejected: ' + c.plane);
  }
  until(() => wall().hp < w.hp && c.active(), c.seconds);
  const after = wall();
  check(g.tr.hp === hp && after.hp < w.hp && !g.zombies.length, 'Isolated wall damage is missing/unsafe: ' + c.name);
  const detail = {name: c.name, before: w, after, damage: w.hp - after.hp, trainHp: hp,
    units: __sr.units(), rockets: __sr.rockets(), steam: __sr.steam(), planes: __sr.planeShow()};
  if (c.name.startsWith('MG')) {
    const mg = detail.units.mg, t = mg.turrets[0], distance = Math.hypot(w.x - t.x, (w.y - t.y) / 0.72);
    check(distance > mg.range && distance <= 200 && Number.isFinite(distance), 'MG wall fallback did not exercise the finite200 range');
    if (c.name === 'MG_AP') check(mg.pierce === 3 && mg.lastShot.targets.length > 0, 'AP bullet did not record its wall hit');
    detail.actualWallDistance = distance;
  }
  if (c.plane) __sr.clearPlaneFixture();
  completedWeapons.push({name: c.name, damage: detail.damage, trainHp: hp});
  return detail;
  }); } catch (error) {
    throw new Error(c.name + ': ' + error.message + '\nCompleted wall checks: ' + JSON.stringify({
      naturalSecondsAfterStop: natural.secondsAfterStop, weapons: completedWeapons}));
  }
});

const shots = ['ahead', 'mid', 'break'].map(stage => { const shot = wallShot(stage); __sr.frames(30);
  check(__sr.late() <= 1, 'Wall view baked late atlas pages: ' + stage);
  if (stage === 'mid') {
    shot.performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
    check(shot.performance.bench < 8 && shot.performance.late <= 1, 'Active-wall held frame benchmark exceeds8ms');
  }
  return shot; });
const performance = seeded(0x633, () => {
  freshWall(); __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const result = {fixture: 'normal-camera leg5 after20s +30frames', bench: +__sr.bench(60).toFixed(2),
    cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1, 'Standard20s wall-leg performance failed: ' + JSON.stringify(result));
  __sr.sim(10); __sr.frames(30); result.lateProbe = {wall: wall(), late: __sr.late(), stats: __sr.stats()};
  check(result.lateProbe.wall && result.lateProbe.late <= 1, 'Natural30s wall encounter was missing or uncached'); return result;
});
QA_DONE({natural, rams, weapons, shots, exactShotsRendered30Frames: true, performance,
  baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
