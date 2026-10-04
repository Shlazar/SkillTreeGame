// Run mode: Rocket Pods cadence, salvo upgrades, biggest eligible crowd, train-safe damage and matching staggered salvo shot.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshPods(damage = 0, reload = 0, salvo = 0, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  // Pure pods are deliberately set without Nose Rockets so its tracker cannot hide pod failures.
  for (const [id, level] of [['rocketPods', 1], ['podDamage', damage], ['podReload', reload], ['podSalvo', salvo]]) {
    check(__sr.node(id, level), 'Missing pod node ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  g.station = null;
  g.walls.length = 0;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function crowdFixture(distractors = true, centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats(), anchors = [];
  h.x = g.camX + W * (centred ? 0.5 : 0.6);
  h.y = g.camY + H * 0.72;
  h.alt = 25;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  const centre = {x: h.x + 70, y: h.y - 50};
  function pack(n, x, y) {
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n, z = __sr.spawn(0, x - g.camX + Math.cos(a) * 5, y - g.camY + Math.sin(a) * 5 * 0.72);
      z.hp = 1000000;
      anchors.push({z, x: z.x, y: z.y});
    }
  }
  pack(10, centre.x, centre.y);
  if (distractors) {
    pack(1, h.x - 35, h.y);
    pack(20, h.x + 230, h.y - 45);
  }
  return {g, h, s: g.tr.s, centre, anchors};
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) {
      a.z.x = a.x; a.z.y = a.y;
      a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60);
  }
}
function salvoShot() {
  freshPods();
  __sr.sim(8);
  __sr.frames(240);
  const f = crowdFixture(false, true);
  for (let i = 0; i < 180 && __sr.units().pods.inFlight < 3; i++) pinned(f, 1 / 60);
  const p = __sr.units().pods;
  check(p.salvos === 1 && p.inFlight >= 3 && p.inFlight <= 4, 'Shot did not capture staggered pod rockets');
  check(new Set(p.active.map(r => +r.age.toFixed(4))).size >= 3, 'Pod rockets launched together instead of staggering');
  __sr.hold(true);
  __sr.frames(1);
  return {pods: __sr.units().pods, heli: __sr.helis()[0],
    points: p.active.map(r => ({x: +(r.position[0] - f.g.camX).toFixed(1), y: +(r.position[1] - r.position[2] - f.g.camY).toFixed(1)}))};
}

freshPods();
check(__sr.G.up.pods && __sr.G.up.rocketChance === 0, 'Pure-pod fixture has nose rockets');
check(__sr.G.up.podDamage === 1 && __sr.G.up.podReload === 8 && __sr.G.up.podSalvo === 4, 'Base pod run numbers');
const baseFixture = crowdFixture(), hp = baseFixture.g.tr.hp;
pinned(baseFixture, 60);
const base = __sr.units().pods;
check(base.salvos === 7 && base.shots === 28 && base.impacts === 28 && !base.queued, 'Base 60-second pod cadence: ' + JSON.stringify(base));
check(base.lastTarget.count === 10 && Math.hypot(base.lastTarget.x - baseFixture.centre.x, (base.lastTarget.y - baseFixture.centre.y) / 0.72) <= 6,
  'Pods preferred a nearer straggler or the bigger out-of-range pack: ' + JSON.stringify(base.lastTarget));
check(base.range === 180 && baseFixture.g.tr.hp === hp && !baseFixture.g.result, 'Pod range or isolated train health changed');
check(__sr.rockets().shots === 0 && __sr.rockets().rockets === 0 && baseFixture.g.shots === base.shots, 'Nose/pod counters do not separate actual launches');

freshPods(0, 0, 1);
const extraFixture = crowdFixture(false);
pinned(extraFixture, 8.6);
const extra = __sr.units().pods;
check(extra.salvo === 5 && extra.salvos === 1 && extra.shots === 5 && !extra.queued, 'Salvo 1 did not launch five rockets');

freshPods(4, 4, 3);
check(__sr.G.up.podDamage === 2 && __sr.G.up.podReload === 5 && __sr.G.up.podSalvo === 7, 'Max pod values were not copied from UP');
const maxFixture = crowdFixture(false);
pinned(maxFixture, 5.1);
const maximum = __sr.units().pods;
check(maximum.damage === 12 && maximum.reload === 5 && maximum.salvo === 7 && maximum.salvos === 1, 'Max actual pod numbers');
check(maximum.active.length > 0 && maximum.active.every(r => r.dmg === 12), 'Max damage multiplier did not reach actual rockets');

// Aim a real pod rocket over the engine; two walkers are in its blast but outside the train body.
freshPods();
const safe = crowdFixture(false), c = safe.g.tr.cars[0];
for (let i = 0; i < 600 && !__sr.units().pods.shots; i++) pinned(safe, 1 / 60);
const round = safe.g.rounds.find(r => r.kind === 'rocket' && r.source === 'pods');
check(round, 'Train-safety fixture did not launch a real pod rocket');
round.bx = c.cx; round.by = c.cy;
const victims = [-1, 1].map(side => __sr.spawn(0, c.cx - safe.g.camX + side * c.nx * 13, c.cy - safe.g.camY + side * c.ny * 13));
const hpBefore = safe.g.tr.hp, hurtBefore = {...safe.g.hurt};
for (let i = 0; i < 40 && !__sr.units().pods.impacts; i++) pinned(safe, 1 / 60);
const safety = __sr.units().pods;
check(victims.every(z => z.dead) && safety.lastImpact.kills >= 2, 'Pod blast did not kill adjacent area walkers');
check(safe.g.tr.hp === hpBefore && JSON.stringify(safe.g.hurt) === JSON.stringify(hurtBefore), 'Pod blast damaged the train');

const shot = salvoShot();
__sr.frames(30);
check(__sr.late() <= 1, 'Pod salvo drawing created late atlas pages');

// Three independent short busy fights report a median; no long test fixture or its garbage collection affects it.
const performance = [];
for (let i = 0; i < 3; i++) {
  freshPods(4, 4, 3, false);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.sim(20);
  __sr.frames(30);
  const stats = __sr.stats(), p = __sr.units().pods;
  performance.push({bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(),
    kills: stats.kills, zombies: stats.zombies, parts: stats.parts, salvos: p.salvos, podShots: p.shots});
  check(p.shots > 0 && stats.kills > 0 && stats.hp > 0 && __sr.late() <= 1, 'Busy pod fight is not sane');
}
const median = performance.map(p => p.bench).sort((a, b) => a - b)[1];
QA_DONE({base: {salvos: base.salvos, shots: base.shots, impacts: base.impacts, target: base.lastTarget, range: base.range},
  salvo1: {salvos: extra.salvos, shots: extra.shots, salvo: extra.salvo},
  maximum: {multiplier: 2, damage: maximum.damage, reload: maximum.reload, salvo: maximum.salvo},
  safety: {hpBefore, hpAfter: hpBefore, killed: safety.lastImpact.kills, hurt: hurtBefore}, noseCountsZero: true,
  shot: {inFlight: shot.pods.inFlight, ages: shot.pods.active.map(r => +r.age.toFixed(3)), heli: shot.heli, points: shot.points},
  shotRendered: true, performance, medianBench: median});
