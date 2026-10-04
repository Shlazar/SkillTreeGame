// All actual helicopter upgrades, without train/plane/crew upgrade fixtures.
function check(ok, message) { if (!ok) throw new Error(message); }
const HELI_MAX = {hdmg: 8, hrate: 6, hrange: 4, rockets: 5, rocketPods: 1,
  podDamage: 4, podReload: 4, podSalvo: 3, napalm: 1, hellfire: 1,
  hellfireDamage: 4, hellfireReload: 4, hellfireBlast: 3, doubleHellfire: 1};
function freshAll(quiet = false) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of Object.entries(HELI_MAX)) check(__sr.node(id, level), 'Missing heli node ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.rightUp(4, 70);
  const u = __sr.units();
  check(u.heli.count === 1 && u.rockets.chance === 0.18 && u.pods.salvo === 7 &&
    u.pods.reload === 5 && u.pods.napalmDuration === 3 && u.hellfire.count === 2 &&
    u.hellfire.reload === 6, 'Combined weapon upgrades are not maxed');
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.tgt = null; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
}
function allWeaponsShot() {
  freshAll(true);
  // Clear the opening banner before adding enemies; every projectile and patch below is fired normally.
  __sr.sim(8); __sr.frames(240);
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats(), trainS = g.tr.s, anchors = [];
  h.x = g.camX + W * 0.5; h.y = g.camY + H * 0.75; h.alt = 25; h.vx = h.vy = 0;
  function add(type, dx, dy) {
    const z = __sr.spawn(type, h.x - g.camX + dx, h.y - g.camY + dy);
    z.hp = 1000000; z.sp = 0; anchors.push({z, x: z.x, y: z.y}); return z;
  }
  const brutes = [add(2, -70, -55), add(2, 80, -55)];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6; add(0, 70 + Math.cos(a) * 9, -50 + Math.sin(a) * 9 * 0.72);
  }
  h.hd = Math.atan2(brutes[1].x - h.x, -(brutes[1].y - h.y));
  h.cd = h.look = 0; h.tgt = brutes[1]; h.order = {kind: 'attack', z: brutes[1]};
  for (let i = 0; i < 42; i++) {
    g.tr.s = trainS; g.tr.v = 0;
    for (const a of anchors) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60);
  }
  const u = __sr.units(), nose = __sr.rockets(), fires = __sr.fires();
  check(u.hellfire.inFlight === 2 && u.pods.inFlight > 0 && fires.length > 0,
    'Shot lacks simultaneous pod rockets, two Hellfires and Napalm: ' + JSON.stringify({pods: u.pods, hellfire: u.hellfire, fires}));
  check(nose.shots > 0 && nose.rockets > 0, 'Shot did not fire the upgraded nose gun and rockets');
  __sr.hold(true); __sr.frames(1);
  return {heli: __sr.helis()[0], nose, pods: u.pods, hellfire: u.hellfire, fires: fires.length,
    points: [...u.pods.active, ...u.hellfire.active].map(r => ({
      x: +(r.position[0] - g.camX).toFixed(1),
      y: +(r.position[1] - r.position[2] - g.camY).toFixed(1)
    }))};
}

freshAll(); __sr.hp(9999); __sr.bot(true); __sr.sim(60);
const sixty = {stats: __sr.stats(), rockets: __sr.rockets(), units: __sr.units(), fire: __sr.fireStats(), fx: __sr.fx()};
check(sixty.stats.kills > 0 && sixty.stats.km > 0 && sixty.stats.hp > 0, 'All-upgrade 60s leg made no sane progress');
check(sixty.rockets.rockets > 0 && sixty.units.pods.shots > 0 && sixty.units.hellfire.shots > 0 && sixty.fire.created > 0,
  'Combined natural leg did not use each heli weapon');
check(sixty.stats.parts <= 2600 && __sr.fires().length <= 60, 'Combined effects exceeded their caps');

// The README busy-fight setup uses a separate fresh 20s bot run, then 30 frames before measurement.
freshAll(); __sr.give(3000, 30); __sr.hp(9999); __sr.bot(true); __sr.sim(20); __sr.frames(30);
const busyStats = __sr.stats();
check(busyStats.kills > 0 && busyStats.zombies > 0 && busyStats.hp > 0, 'Busy performance fixture is empty or lost');
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), fx: __sr.fx(),
  horde: __sr.horde(), late: __sr.late(), kills: busyStats.kills, zombies: busyStats.zombies};
check(performance.late <= 1, 'All heli weapons created extra late atlas pages');
const shot = allWeaponsShot(); __sr.frames(30);
check(__sr.late() <= 1, 'Combined weapon shot created extra late atlas pages');
QA_DONE({maxLevels: HELI_MAX, requestedSimulation: 60, sixty,
  performance, baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1},
  shot: {heli: shot.heli, podRockets: shot.pods.inFlight, hellfires: shot.hellfire.inFlight,
    burningPatches: shot.fires, noseRockets: shot.nose.rockets, points: shot.points},
  matchingShotRendered: true});
