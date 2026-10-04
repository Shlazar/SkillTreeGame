// F-4 payload, real persistent burning ground and a sustained Fire Wall crossing fixture.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function f4() { const p = __sr.planes().find(p => p.id === 'f4'); check(p, 'F-4 not owned'); return p; }
function freshF4(maximum = false, wall = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['f4', 1], ['fireDamage', maximum ? 4 : 0], ['f4Cooldown', maximum ? 5 : 0],
    ['fireLength', maximum ? 3 : 0], ['fireWall', wall ? 1 : 0], ['f4Charge', maximum ? 1 : 0]]) check(__sr.node(id, level), 'Missing F-4 node ' + id);
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
    target: {x: s.W * 0.7, y: s.VH * 0.5}};
  h.x = g.camX + f.target.x - 120; h.y = g.camY + f.target.y + 80;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return f;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function launch(f, angle = Math.PI / 2) {
  const t = f.g.run;
  check(__sr.strike(f4().key, f.target.x, f.target.y, angle), 'Production F-4 strike failed');
  const show = __sr.planeShow(), j = show.jets.find(j => j.id === 'f4');
  check(j && show.jets.length === 1, 'F-4 did not launch one swept-wing jet');
  return {j, p: f4(), t, over: Math.ceil((j.delay - j.s / 320) * 60),
    after: Math.ceil((j.delay + (j.end - j.s) / 320 + 0.2) * 60)};
}
function f4Shot(kind) {
  freshF4(kind === 'fire', kind === 'fire'); __sr.sim(8); __sr.frames(240);
  const f = field();
  for (let i = 0; i < 18; i++) {
    const x = kind === 'fire' ? f.target.x - 90 + i * 180 / 17 : f.target.x + (i % 2 ? 5 : -5);
    const y = kind === 'fire' ? f.target.y - 18 - (i % 3) * 4 : f.target.y - 90 + i * 180 / 17;
    const z = __sr.spawn(0, x, y);
    z.sp = 0; z.hp = 2; f.anchors.push({z, x: z.x, y: z.y});
  }
  const flight = launch(f, kind === 'fire' ? 0 : Math.PI / 2);
  advance(f, kind === 'pass' ? flight.over : flight.after, true);
  const show = __sr.planeShow(), fires = __sr.fires().filter(p => p.source === 'f4');
  check(fires.length > 0, 'F-4 screenshot has no actual burning line');
  if (kind === 'pass') check(show.jets.some(j => j.id === 'f4' && j.bodyVisible && j.fired), 'F-4 flyover is not visible');
  else check(fires.length === flight.j.patchCount && fires.every(p => p.wall && p.duration === 12), 'Fire screenshot has no completed12s wall');
  check(show.art.f4.w * show.art.f4.h > show.art.heli.w * show.art.heli.h, 'F-4 sprite is not bigger than heli');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {show, fires, heli: __sr.helis()[0], hits: __sr.fireStats().hits};
}

const payloads = [];
for (const maximum of [false, true]) {
  freshF4(maximum); const f = field();
  const z = __sr.spawn(0, f.target.x, f.target.y); z.hp = 100; z.sp = 0;
  f.anchors.push({z, x: z.x, y: z.y});
  check(f4().ready && f4().charges === (maximum ? 2 : 1), 'F-4 charges did not begin full');
  const flight = launch(f), cd = maximum ? 15 : 30, duration = maximum ? 7 : 4, len = maximum ? 368 : 230;
  near(flight.p.cd, cd, 'Actual F-4 cooldown');
  near(f.g.up.fireDamage, maximum ? 2 : 1, 'F-4 damage multiplier');
  near(flight.j.fireDamage, maximum ? 4 : 2, 'Actual F-4 DPS');
  near(flight.j.len, len, 'Actual fire-line length');
  check(flight.j.fireDuration === duration && !flight.j.fireWall && flight.j.patchRadius === 14 && flight.j.patchStep <= 18,
    'Fire-line lifetime/geometry snapshot is wrong');
  advance(f, flight.after);
  const fires = __sr.fires().filter(p => p.source === 'f4');
  check(fires.length === (maximum ? 22 : 14) && fires.every(p => p.duration === duration && !p.wall && p.dps === (maximum ? 4 : 2)),
    'Real F-4 pass did not deposit its full burning line');
  check(z.hp < 100 && z.hp > 0 && __sr.fireStats().hits > 0, 'Real F-4 burning ground dealt no damage');
  const remaining = Math.round((flight.t + cd - f.g.run) * 60);
  advance(f, remaining - 1);
  check(f4().cd > 0 && f4().charges === (maximum ? 1 : 0), 'F-4 charge recovered early');
  advance(f, 1);
  check(f4().cd === 0 && f4().charges === (maximum ? 2 : 1), 'F-4 charge missed its30/15s recovery');
  payloads.push({cooldown: cd, length: len, duration, dps: flight.j.fireDamage, patches: fires.length, hpAfterFire: z.hp, charges: f4().charges});
}

// Real rail walkers keep trying to march through a production wall; spread pressure is left active.
freshF4(true, true); const wf = field(); launch(wf, 0);
const worldX = wf.g.camX + wf.target.x, worldY = wf.g.camY + wf.target.y;
let section = null;
for (let i = 0; i < 300 && !section; i++) {
  advance(wf, 1);
  section = __sr.fires().find(p => p.source === 'f4' && p.wall && Math.abs(p.x - worldX) < 10);
}
check(section && section.duration === 12, 'Production pass did not create the near12s wall section');
const sectionBorn = wf.g.run - section.age, lineY = section.y, stream = [], starts = [];
for (let i = 0; i < 24; i++) {
  const x = section.x + (i % 8 - 3.5) * 3, y = lineY - 18 - Math.floor(i / 8) * 3;
  const z = __sr.spawn(0, x - wf.g.camX, y - wf.g.camY);
  z.hp = 1000000; z.sp = 30; z.st = 1; z.rx = z.x - __sr.railX(z.y + 24); z.wob = 0;
  stream.push(z); starts.push({x: z.x, y: z.y});
}
const protectedAtChurn = __sr.fires().filter(p => p.wall);
for (let i = 0; i < 80; i++) __sr.addBurn(25, 70, 3, 2, 1);
check(protectedAtChurn.every(p => __sr.fires().some(q => q.wall && q.x === p.x && q.y === p.y)),
  'Ordinary patch churn removed the live Fire Wall');
let crossings = 0, maxY = -Infinity;
while (wf.g.run - sectionBorn < 12 - 1e-9) {
  advance(wf, 1);
  maxY = Math.max(maxY, ...stream.map(z => z.y));
  crossings = Math.max(crossings, stream.filter(z => z.y > lineY + 0.2).length);
}
check(crossings === 0 && stream.every(z => !z.dead) && stream.some((z, i) => Math.hypot(z.x - starts[i].x, z.y - starts[i].y) > 2),
  'Immortal stream crossed before12s or never actually attempted: ' + JSON.stringify({crossings, maxY, lineY}));
const attemptedSeconds = wf.g.run - sectionBorn;
for (let i = 0; i < 180 && __sr.fires().some(p => p.wall); i++) advance(wf, 1);
check(!__sr.fires().some(p => p.wall), 'Fire Wall did not expire');
advance(wf, 120);
const afterCrossings = stream.filter(z => z.y > lineY + 0.2).length;
check(afterCrossings > 0, 'Stream did not cross after extinction');

const pass = f4Shot('pass'); __sr.frames(30);
const fire = f4Shot('fire'); __sr.frames(30);
freshF4(true, true, false); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
const s = __sr.stats(); __sr.crowd(80, s.W * 0.7, s.VH * 0.5, 70, 0);
check(__sr.strike(f4().key, s.W * 0.7, s.VH * 0.5, 0), 'Busy F-4 strike failed');
__sr.frames(150);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(),
  fires: __sr.fires().filter(p => p.source === 'f4').length, fx: __sr.fx()};
check(performance.fires > 0 && performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1, 'F-4 busy fixture failed');
QA_DONE({payloads, wall: {duration: 12, attemptedSeconds, walkers: stream.length, crossings,
  afterExtinction: afterCrossings, protectedDuringOrdinaryChurn: true},
  shots: {pass: {heli: pass.heli, fires: pass.fires.length, show: pass.show}, fire: {heli: fire.heli, fires: fire.fires.length}},
  bothShotsRendered: true, performance, baseline: {bench: 3.27, render: 2.97, late: 1}});
