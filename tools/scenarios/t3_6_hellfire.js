// Run mode: Hellfire priority, independent cadence/range, live guidance, train-safe blast and two matching shots.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-7, label + ': ' + a); }
function freshHellfire(maximum = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['hellfire', 1], ['hellfireDamage', maximum ? 4 : 0],
    ['hellfireReload', maximum ? 4 : 0], ['hellfireBlast', maximum ? 3 : 0]]) check(__sr.node(id, level), 'Missing Hellfire node ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.rightUp(4, 70);
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  g.station = null; g.walls.length = 0;
  h.vx = h.vy = 0; h.cd = h.look = 1000000;
  h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function fixture(centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * (centred ? 0.5 : 0.6); h.y = g.camY + H * 0.75;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return {g, h, s: g.tr.s, anchors: []};
}
function add(f, type, dx, dy, hp, gold = false) {
  const z = gold ? __sr.gold(f.h.x - f.g.camX + dx, f.h.y - f.g.camY + dy)
    : __sr.spawn(type, f.h.x - f.g.camX + dx, f.h.y - f.g.camY + dy);
  z.sp = 0; if (hp != null) z.hp = hp;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) { a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0; }
    __sr.sim(1 / 60);
  }
}
function launch(f) {
  for (let i = 0; i < 700 && !__sr.units().hellfire.shots; i++) pinned(f, 1 / 60);
  const r = f.g.rounds.find(r => r.kind === 'hellfire');
  check(r && __sr.units().hellfire.shots === 1, 'First Hellfire did not launch');
  return r;
}
function hellfireShot(kind) {
  freshHellfire();
  __sr.sim(8); __sr.frames(240);
  const f = fixture(true), brute = add(f, 2, 80, -70, kind === 'curve' ? 1000000 : 6);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; add(f, 0, 80 + Math.cos(a) * 22, -70 + Math.sin(a) * 22 * 0.72); }
  f.h.hd = Math.atan2(brute.x - f.h.x, -(brute.y - f.h.y));
  launch(f);
  if (kind === 'curve') {
    pinned(f, 0.35);
    check(__sr.units().hellfire.inFlight === 1, 'Mid-curve missile is missing');
  } else {
    for (let i = 0; i < 60 && !__sr.units().hellfire.impacts; i++) pinned(f, 1 / 60);
    check(brute.dead && __sr.units().hellfire.kills >= 13, 'Big blast did not kill its selected brute and area crowd');
    pinned(f, 0.1);
    check(__sr.fx().booms > 0, 'Big Hellfire blast effects missing');
  }
  __sr.hold(true); __sr.frames(1);
  const state = __sr.units().hellfire, p = state.active[0]?.position || [state.lastImpact.x, state.lastImpact.y, 0];
  return {state, heli: __sr.helis()[0], point: {x: +(p[0] - f.g.camX).toFixed(1), y: +(p[1] - p[2] - f.g.camY).toFixed(1)}};
}

freshHellfire();
let f = fixture(), brute = add(f, 2, 100, -55);
for (let i = 0; i < 30; i++) { const a = i * Math.PI / 15; add(f, 0, 35 + Math.cos(a) * 20, 15 + Math.sin(a) * 20 * 0.72); }
let round = launch(f), first = __sr.units().hellfire;
check(round.tgt === brute && first.lastTargets[0].priority === 'brute' && first.lastTargets[0].type === 2, 'Hellfire did not prefer brute over 30 walkers');
near(first.lastTargets[0].t, 10, 'Base first missile time');
check(first.damage === 18 && first.blastRadius === 30 && first.range === 220 && first.reload === 10, 'Base Hellfire values');
pinned(f, 0.85);
check(brute.dead && __sr.units().hellfire.impacts === 1, 'First missile did not hit the selected brute');

freshHellfire();
f = fixture();
const gold = add(f, 0, 100, -55, null, true);
add(f, 0, 35, -10, 1000);
round = launch(f);
check(round.tgt === gold && __sr.units().hellfire.lastTargets[0].priority === 'gold', 'Golden target lost priority to a higher-HP walker');
pinned(f, 0.85);
check(gold.dead, 'Selected golden zombie was not hit');

freshHellfire();
f = fixture();
add(f, 0, 60, 0, 11);
const highest = add(f, 0, 190, 0, 24);
add(f, 0, 260, 0, 1000);
round = launch(f);
check(round.tgt === highest && __sr.units().hellfire.lastTargets[0].priority === 'hp', 'Highest current HP in independent220px range was not selected');

freshHellfire(true);
f = fixture();
add(f, 2, 100, -55, 1000000);
near(f.g.up.hellfireDamage, 2.2, 'Max damage multiplier');
near(f.g.up.hellfireReload, 6, 'Max reload');
near(f.g.up.hellfireBlast, 1.6, 'Max blast multiplier');
pinned(f, 5.9);
check(__sr.units().hellfire.shots === 0, 'Max reload fired before6s');
pinned(f, 0.3);
const maximum = __sr.units().hellfire;
check(maximum.shots === 1 && maximum.reload === 6, 'Max first missile timing');
near(maximum.active[0].dmg, 39.6, 'Actual max missile damage');
near(maximum.active[0].R, 48, 'Actual max blast radius');
pinned(f, 12);
check(__sr.units().hellfire.salvos === 3 && __sr.units().hellfire.shots === 3, 'Independent6s reload did not repeat');

// The real target walks during flight; guidance must follow it while retaining the launch snapshot.
freshHellfire();
f = fixture();
const moving = add(f, 2, 90, -50, 1000000);
round = launch(f);
const launchX = moving.x, launchY = moving.y, snapshot = {...round.targetSnapshot};
f.anchors.length = 0;
moving.sp = 20; moving.wob = 0;
pinned(f, 0.3);
const guided = __sr.units().hellfire.active[0], u = guided.age / guided.T;
check(Math.hypot(moving.x - launchX, moving.y - launchY) > 1, 'Guidance target did not actually move');
check(Math.hypot(guided.bx - moving.x, guided.by - moving.y) < 1, 'Missile endpoint did not follow live target');
check(guided.targetSnapshot.x === snapshot.x && guided.targetSnapshot.y === snapshot.y, 'Guidance changed immutable launch snapshot');
const linearX = guided.sx + (guided.bx - guided.sx) * u, linearY = guided.sy + (guided.by - guided.sy) * u;
check(Math.hypot(guided.position[0] - linearX, (guided.position[1] - linearY) / 0.72) > 1 && guided.position[2] > guided.sz * (1 - u), 'Missile did not curve and climb');
pinned(f, 0.6);
near(moving.hp, 1000000 - 18, 'Guided missile actual hit');
near(moving.pending, 0, 'Guided impact released pending damage');

// Freeze the guidance endpoint at the engine after its original target disappears.
freshHellfire();
f = fixture(); add(f, 2, 100, -55, 1000000);
round = launch(f);
const c = f.g.tr.cars[0];
round.tgt.gone = true; round.bx = c.cx; round.by = c.cy;
const victims = [-1, 1].map(side => __sr.spawn(0, c.cx - f.g.camX + side * c.nx * 14, c.cy - f.g.camY + side * c.ny * 14));
const hp = f.g.tr.hp, hurt = {...f.g.hurt};
pinned(f, 0.85);
const safety = __sr.units().hellfire;
check(victims.every(z => z.dead) && safety.lastImpact.kills >= 2, 'Train-centre Hellfire did not kill area walkers');
check(f.g.tr.hp === hp && JSON.stringify(f.g.hurt) === JSON.stringify(hurt), 'Friendly Hellfire damaged the train');

const curve = hellfireShot('curve'); __sr.frames(30);
const blast = hellfireShot('blast'); __sr.frames(30);
check(__sr.late() <= 1, 'Hellfire drawing created extra late atlas pages');
const performance = [];
for (let i = 0; i < 3; i++) {
  freshHellfire(true, false); __sr.hp(9999); __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const s = __sr.stats(), h = __sr.units().hellfire;
  performance.push({bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), kills: s.kills, zombies: s.zombies, parts: s.parts, missiles: h.shots});
  check(s.kills > 0 && h.shots > 0 && s.hp > 0 && __sr.late() <= 1, 'Busy Hellfire fight is not sane');
}
QA_DONE({priority: ['brute', 'gold', 'highestCurrentHP'], base: {first: first.lastTargets[0].t, damage: first.damage, radius: first.blastRadius, range: first.range, reload: first.reload},
  maximum: {damage: maximum.damage, radius: maximum.blastRadius, reload: maximum.reload, threeSalvosBy: 18.2},
  movingGuidance: true, launchSnapshotStable: true, curveAndClimb: true, trainSafe: {hp, kills: safety.lastImpact.kills},
  shots: {curve: {heli: curve.heli, point: curve.point, age: curve.state.active[0].age}, blast: {heli: blast.heli, point: blast.point}}, bothShotsRendered: true,
  performance, medianBench: performance.map(p => p.bench).sort((a, b) => a - b)[1]});
