// run mode: real climbers, Steam Vent clock/reach, moving Hot Cloud entry and white bursts.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function steam() { return __sr.steam(); }
function freshSteam(maximum = false, hot = false, reach = maximum ? 3 : 0, quiet = true) {
  __sr.hold(false); __sr.pause(false); __sr.reset();
  for (const [id, level] of Object.entries({steamVent: 1, steamDamage: maximum ? 4 : 0,
    steamSpeed: maximum ? 4 : 0, steamReach: reach, hotCloud: hot ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing Steam node ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(1); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, pinned: true, anchors: []}; }
function add(f, x, y, hp = 2, speed = 0) {
  const z = __sr.spawn(0, x - f.g.camX, y - f.g.camY);
  z.hp = hp; z.sp = speed; z.block = []; z.blockT = 1000000;
  if (!speed) f.anchors.push({z, x, y}); return z;
}
function climbers(f, hp = 2) {
  const zs = [];
  for (let car = 0; car < 5; car++) for (const side of [-1, 1]) {
    const c = f.g.tr.cars[car], z = add(f, c.cx + c.nx * side * 10, c.cy + c.ny * side * 10, hp);
    Object.assign(z, {st: 2, car, side, al: 0, ox: 0, dmg: 0, dps: 0, bang: 0}); zs.push(z);
  }
  return zs;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    if (f.pinned) { f.g.tr.s = f.s; f.g.tr.v = 0; }
    for (const a of f.anchors) if (!a.z.dead && a.z.st !== 2) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
    check(!f.g.result, 'Steam fixture reached its station');
  }
}
function envelopeDistance(x, y, envelope = steam().envelope) {
  let best = Infinity;
  for (const s of envelope.segments) {
    const ax = s.ax, ay = s.ay / envelope.fore, bx = s.bx, by = s.by / envelope.fore;
    const dx = bx - ax, dy = by - ay, px = x - ax, py = y / envelope.fore - ay;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(px - t * dx, py - t * dy));
  }
  return Math.max(0, best - envelope.halfWidth);
}
function beside(distance, car = 2, side = 1, along = 0) {
  const c = __sr.G.tr.cars[car], x = c.cx + c.dx * along, y = c.cy + c.dy * along;
  let lo = 0, hi = 100;
  for (let i = 0; i < 35; i++) {
    const d = (lo + hi) / 2;
    if (envelopeDistance(x + c.nx * side * d, y + c.ny * side * d) < distance) lo = d; else hi = d;
  }
  return {x: x + c.nx * side * hi, y: y + c.ny * side * hi};
}
function steamShot(camera = 0) {
  freshSteam(true, true); __sr.thermal(camera); __sr.sim(4); __sr.frames(240);
  const f = field(), targets = climbers(f), before = steam().bursts; __sr.hp(80);
  for (let i = 0; i < 180 && steam().bursts === before; i++) advance(f, 1, true);
  check(steam().bursts === before + 1 && targets.every(z => z.dead), 'White burst view did not vent actual climbers');
  const burstTime = steam().lastBurst.t;
  for (let i = 0; i < 180 && f.g.run - burstTime < 0.35; i++) advance(f, 1, true);
  check(f.g.run - burstTime >= 0.35 && steam().cloud && __sr.fx().parts > 0 && f.g.tr.hp === 80,
    'White burst view lacks grown active steam/cloud or train safety');
  __sr.hold(true); __sr.frames(1);
  const c = f.g.tr.cars[2];
  return {camera, steam: steam(), fx: __sr.fx(), crop: {x: Math.round(c.cx - f.g.camX - 32),
    y: Math.round(c.cy - f.g.camY - 34), w: 64, h: 68, scale: 4}};
}

freshSteam(); const climbField = field(), ten = climbers(climbField), hp = climbField.g.tr.hp;
advance(climbField, 330);
check(ten.length === 10 && ten.every(z => z.dead) && steam().bursts === 1 && steam().kills === 10 && steam().hits === 10,
  'Ten actual climbers did not die after5.5s: ' + JSON.stringify(steam()));
check(climbField.g.tr.hp === hp && __sr.rockets().shots === 0, 'Steam damaged train or used helicopter shots');
const tenClimbers = steam();

const cadence = [];
for (const maximum of [false, true]) {
  freshSteam(maximum); const f = field(), zs = climbers(f, 100), initial = steam();
  near(initial.damage, maximum ? 4 : 2, 'Steam damage'); near(initial.interval, maximum ? 2.5 : 5, 'Steam interval');
  for (let i = 1; i <= 3; i++) {
    advance(f, maximum ? 150 : 300); const state = steam();
    check(state.bursts === i && state.lastBurst.hits === 10 && zs.every(z => z.hp === 100 - state.damage * i),
      'Actual vent cadence/damage failed: ' + JSON.stringify({maximum, state, hp: zs.map(z => z.hp)}));
    near(state.lastBurst.t, i * (maximum ? 2.5 : 5), 'Steam burst start');
  }
  cadence.push({maximum, state: steam(), hp: zs.map(z => z.hp)});
}

const reach = [];
for (const level of [0, 1, 3]) {
  freshSteam(false, false, level); const f = field(), insideDistance = level ? level * 6 - 1 : 10;
  const p = beside(insideDistance), q = beside(level ? level * 6 + 3 : 14, 2, -1);
  const inside = add(f, p.x, p.y, 100), outside = add(f, q.x, q.y, 100);
  advance(f, 300);
  check(inside.st !== 2 && outside.st !== 2, 'Reach fixture accidentally turned ground targets into climbers');
  check(inside.hp === (level ? 98 : 100) && outside.hp === 100,
    'Steam Reach did not hit only eligible nearby ground: ' + JSON.stringify({level, hp: [inside.hp, outside.hp], state: steam()}));
  near(steam().reach, level * 6, 'Actual burst reach'); near(steam().cloudReach, 6 + level * 6, 'Actual cloud reach');
  reach.push({level, hp: [inside.hp, outside.hp], distances: [envelopeDistance(inside.x, inside.y), envelopeDistance(outside.x, outside.y)]});
}

// Burst survivors receive the same cloud stamp and must not take the burst twice.
freshSteam(false, true, 3); const cloudField = field(), survivor = climbers(cloudField, 100)[0];
advance(cloudField, 300); const burst = steam(), cloudId = burst.cloud.id;
near(survivor.hp, 98, 'Initial Hot Cloud burst');
check(burst.cloud.duration === 2 && burst.cloud.reach === 24 && burst.hotCloud === 2, 'Hot Cloud lifetime/reach incorrect');
advance(cloudField, 30); near(survivor.hp, 98, 'Burst victim must not be hit again by its cloud');

// A genuine walking stream enters the live envelope while the train itself moves.
cloudField.pinned = false;
const stream = [], starts = [];
for (let i = 0; i < 6; i++) {
  const p = beside(26 + i % 2 * 2, 2, 1, (i - 2.5) * 8), z = add(cloudField, p.x, p.y, 2, 22);
  stream.push(z); starts.push({x: z.x, y: z.y});
}
const trainS = cloudField.g.tr.s;
advance(cloudField, 72); const entered = steam();
check(stream.every(z => z.dead) && entered.cloudKills === 6 && entered.cloudHits === 6 &&
  stream.every((z, i) => Math.hypot(z.x - starts[i].x, z.y - starts[i].y) > 0.5) && cloudField.g.tr.s < trainS - 1,
  'Walking stream did not enter the moving cloud once each: ' + JSON.stringify({state: entered, hp: stream.map(z => z.hp), trainS, now: cloudField.g.tr.s}));
near(survivor.hp, 98, 'Moving cloud must still exclude original burst survivors');
advance(cloudField, 30); check(!steam().cloud, 'Hot Cloud persisted beyond its two-second lifetime');
const expired = steam(), latePoint = beside(20), late = add(cloudField, latePoint.x, latePoint.y, 100, 15);
advance(cloudField, 30);
check(late.hp === 100 && steam().cloudHits === expired.cloudHits && steam().bursts === burst.bursts,
  'Expired cloud still damaged a new nearby walker');
const hotCloud = {cloudId, burst, entered, expired, survivorHp: survivor.hp, stream: stream.map((z, i) => ({start: starts[i], x: z.x, y: z.y, hp: z.hp})), lateHp: late.hp};

const shots = [];
for (const camera of [0, 1]) { shots.push(steamShot(camera)); __sr.frames(30); check(__sr.late() <= 1, 'Steam normal/thermal held render added late pages'); }

function steamRandom(seed) {
  return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
let performance, lateProbe; const savedRandom = Math.random; Math.random = steamRandom(0x544);
try {
  freshSteam(true, true, 3, false); __sr.thermal(0); __sr.give(3000, 30); __sr.bot(true); __sr.sim(20); __sr.frames(30);
  performance = {seed: 0x544, camera: 'color', bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), steam: steam()};
  check(performance.steam.bursts >= 8 && performance.steam.kills > 0 && performance.late <= 1, 'Standard20s busy run did not actually vent and kill');
  __sr.sim(10); __sr.frames(30); lateProbe = {late: __sr.late(), stats: __sr.stats(), steam: steam()};
  check(lateProbe.late <= 1, 'Thirty-second Steam probe added late atlas pages');
} finally { Math.random = savedRandom; }
QA_DONE({tenClimbers, cadence, reach, hotCloud, shots, bothExactShotsRendered: true, performance, lateProbe,
  baseline: {bench: 3.27, render: 2.97, late: 1}});
