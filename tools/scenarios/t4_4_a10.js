// A-10 upgrade fixtures: actual lanes, payload, cooldown and matching one-/four-line views.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function freshA10(maximum = false, bombs = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['a10', 1], ['a10Damage', maximum ? 4 : 0], ['a10Cooldown', maximum ? 5 : 0],
    ['a10Lines', maximum ? 3 : 0], ['bombRun', bombs ? 1 : 0], ['a10Charge', maximum ? 1 : 0]]) {
    check(__sr.node(id, level), 'Missing A-10 node ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70);
  if (!quiet) { __sr.bot(true); return; }
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() {
  const g = __sr.G, h = g.helis[0], s = __sr.stats(), f = {g, s: g.tr.s, anchors: [],
    target: {x: s.W * 0.7, y: s.VH * 0.65}};
  h.x = g.camX + f.target.x - 140; h.y = g.camY + f.target.y + 65;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return f;
}
function add(f, x, y, hp, lane) {
  const z = __sr.spawn(0, x, y); z.sp = 0; z.hp = hp;
  f.anchors.push({z, x: z.x, y: z.y, lane}); return z;
}
function advance(f, frames, draw = true) {
  for (let i = 0; i < frames; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function launch(f, target = f.target, angle = Math.PI / 2) {
  const t = f.g.run;
  check(__sr.strike('q', target.x, target.y, angle), 'Actual A-10 launch failed');
  const p = __sr.planes().find(p => p.id === 'a10'), show = __sr.planeShow(), j = show.jets[0];
  check(show.jets.length === 1 && j, 'A-10 upgrade spawned multiple jets');
  return {j, p, t, over: Math.ceil((j.delay - j.s / 320) * 60),
    after: Math.ceil((j.delay + (j.end - j.s) / 320 + 0.2) * 60)};
}
function a10Shot(maximum) {
  freshA10(maximum, maximum); __sr.sim(8); __sr.frames(240);
  const f = field(), lanes = maximum ? [-45, -15, 15, 45] : [0];
  for (const lane of lanes) for (let i = 0; i < 15; i++) {
    add(f, f.target.x - lane + (i % 2 ? 4 : -4), f.target.y - 80 + i * 160 / 14, 2, lane);
  }
  const flight = launch(f);
  advance(f, flight.over);
  const show = __sr.planeShow();
  check(show.jets.length === 1 && show.jets[0].lines === lanes.length && show.jets[0].fired &&
    lanes.every(lane => f.anchors.some(a => a.lane === lane && a.z.dead)), 'Shot did not visibly fire every actual lane');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {show, heli: __sr.helis()[0], lanes, kills: f.g.kills};
}

const damage = [];
for (const maximum of [false, true]) {
  freshA10(maximum); const f = field(), lanes = maximum ? [-45, -15, 15, 45] : [0];
  const targets = lanes.map(lane => add(f, f.target.x - lane, f.target.y, 100, lane));
  const outside = add(f, f.target.x + (maximum ? 70 : 30), f.target.y, 100, 'outside');
  const flight = launch(f), expectedCd = maximum ? 12 : 25, expectedDamage = maximum ? 6 : 3;
  near(flight.p.cd, expectedCd, 'Actual A-10 cooldown');
  near(flight.j.dmg, expectedDamage, 'Actual A-10 payload damage');
  check(flight.j.lines === lanes.length && JSON.stringify(flight.j.offsets) === JSON.stringify(lanes), 'Actual lane offsets are not spaced30px');
  advance(f, flight.after);
  check(targets.every(z => Math.abs(z.hp - (100 - expectedDamage)) < 1e-6) && outside.hp === 100,
    'A-10 lane hit missed, hit twice or damaged outside the lane');
  const remaining = Math.round((flight.t + expectedCd - f.g.run) * 60);
  check(remaining > 1, 'Flight unexpectedly consumed the whole cooldown');
  advance(f, remaining - 1, false);
  check(__sr.planes()[0].charges === (maximum ? 1 : 0) && __sr.planes()[0].cd > 0, 'Charge recovered early');
  advance(f, 1, false);
  check(__sr.planes()[0].charges === (maximum ? 2 : 1) && __sr.planes()[0].cd === 0, 'A-10 did not recover at its actual cooldown');
  damage.push({lines: lanes.length, offsets: flight.j.offsets, damage: expectedDamage, hp: targets.map(z => z.hp), cooldown: expectedCd});
}

freshA10(true, true); const bf = field(), bombFlight = launch(bf);
for (let i = 0; i < 300 && __sr.strafeState().bombs < 4; i++) advance(bf, 1);
check(__sr.strafeState().bombs === 4 && __sr.planeShow().jets.length === 1 &&
  __sr.planeShow().jets[0].bombCount === 4 && __sr.planeShow().jets[0].dropped, 'Bomb Run did not drop exactly4 bombs from one jet');
advance(bf, 15);
check(__sr.strafeState().bombs === 4, 'Four bombs were not falling together before the first impact');
const bombState = __sr.strafeState();

freshA10(true); const sf = field(), c = sf.g.tr.cars[0], hp = sf.g.tr.hp, hurt = JSON.stringify(sf.g.hurt);
const safeTargets = [-45, -15, 15, 45].map(lane => add(sf, c.cx - sf.g.camX + c.nx * 14, c.cy - sf.g.camY + lane, 2, lane));
const safeFlight = launch(sf, {x: c.cx - sf.g.camX, y: c.cy - sf.g.camY}, 0);
advance(sf, safeFlight.after);
check(safeTargets.every(z => z.dead) && sf.g.tr.hp === hp && JSON.stringify(sf.g.hurt) === hurt,
  'Four-lane engine-centre strafe missed a lane or hurt the train');

const one = a10Shot(false); __sr.frames(30);
const four = a10Shot(true); __sr.frames(30);
freshA10(true, true, false); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
const s = __sr.stats();
__sr.crowd(80, s.W * 0.7, s.VH * 0.65, 70, 0);
__sr.G.helis[0].cd = 1000000;
const beforeStrikeKills = __sr.G.kills;
check(__sr.strike('q', s.W * 0.7, s.VH * 0.65, Math.PI / 2), 'Busy A-10 strike failed');
__sr.frames(90);
const peak = __sr.planeShow();
check(peak.jets.length === 1 && peak.jets[0].lines === 4 && peak.jets[0].fired && __sr.G.kills > beforeStrikeKills,
  'Busy measurement did not catch a real four-line attack at peak effects');
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), fx: __sr.fx(), show: peak};
check(performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1, 'A-10 busy check failed');
QA_DONE({damage, singleJet: true, bombs: {fallingTogether: bombState.bombs, count: bombFlight.j.bombCount},
  twoCharges: true, trainSafe: {hp, actualLaneKills: safeTargets.length},
  shots: {one: {heli: one.heli, lanes: one.lanes, kills: one.kills}, four: {heli: four.heli, lanes: four.lanes, kills: four.kills}},
  bothShotsRendered: true, performance, baseline: {bench: 3.27, render: 2.97, late: 1}});
