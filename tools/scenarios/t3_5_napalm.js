// Run mode: actual Napalm salvo, walkers entering burning ground, three-second expiry, bounded fire rendering and matching shot.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshNapalm(on, maximum = false, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  for (const [id, level] of [['rocketPods', 1], ['napalm', on ? 1 : 0],
    ['podDamage', maximum ? 4 : 0], ['podReload', maximum ? 4 : 0], ['podSalvo', maximum ? 3 : 0]]) {
    check(__sr.node(id, level), 'Missing Napalm/pod node ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  check(__sr.fires().length === 0, 'A fresh run retained old burning ground');
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  g.station = null;
  g.walls.length = 0;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function crowdFixture() {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats(), anchors = [];
  h.x = g.camX + W * 0.5;
  h.y = g.camY + H * 0.72;
  h.alt = 25;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, z = __sr.spawn(0, h.x - g.camX + 70 + Math.cos(a) * 5, h.y - g.camY - 50 + Math.sin(a) * 5 * 0.72);
    z.hp = 1000000;
    anchors.push({z, x: z.x, y: z.y});
  }
  return {g, h, s: g.tr.s, anchors};
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
function oneSalvo(f) {
  for (let i = 0; i < 700 && __sr.units().pods.impacts < 4; i++) pinned(f, 1 / 60);
  check(__sr.units().pods.shots === 4 && __sr.units().pods.impacts === 4, 'One actual base pod salvo did not complete');
  f.g.up.pods = false; // The salvo snapshots already fired; stop the next one while watching fire expire.
  return __sr.units().pods;
}
function napalmShot() {
  freshNapalm(true);
  __sr.sim(8);
  __sr.frames(240);
  const f = crowdFixture(), p = oneSalvo(f);
  check(__sr.fires().length > 0, 'Shot has no actual Napalm patches');
  const victims = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    victims.push(__sr.spawn(0, p.lastTarget.x - f.g.camX + Math.cos(a) * 3, p.lastTarget.y - f.g.camY + Math.sin(a) * 3 * 0.72));
  }
  pinned(f, 1.1);
  check(victims.every(z => z.dead) && __sr.fireStats().kills >= 4, 'Shot walkers did not burn after the initial rocket blast');
  check(f.anchors.every(a => !a.z.dead) && __sr.fires().length > 0, 'Shot lost its durable crowd or active flames');
  __sr.hold(true);
  __sr.frames(1);
  return {fires: __sr.fires(), stats: __sr.fireStats(), heli: __sr.helis()[0],
    point: {x: +(p.lastTarget.x - f.g.camX).toFixed(1), y: +(p.lastTarget.y - f.g.camY).toFixed(1)}};
}

freshNapalm(false);
let f = crowdFixture();
oneSalvo(f);
check(__sr.G.up.napalmDuration === 0 && __sr.units().pods.napalmDuration === 0 && __sr.fires().length === 0, 'Pods without Napalm created burning ground');

freshNapalm(true);
f = crowdFixture();
const hp = f.g.tr.hp, salvo = oneSalvo(f), initial = __sr.fires();
check(__sr.G.up.napalmDuration === 3 && initial.length > 0, 'Actual Napalm salvo created no three-second patches');
check(initial.every(p => p.source === 'napalm' && p.duration === 3 && p.R === 16 && p.dps === 2 && p.time > 0 && p.time <= 3), 'Napalm patch values: ' + JSON.stringify(initial));
const startX = Math.max(...initial.map(p => p.x + p.R)) + 4;
const walker = __sr.spawn(0, startX - f.g.camX, salvo.lastTarget.y - f.g.camY);
walker.sp = 20; walker.wob = 0;
check(initial.every(p => Math.hypot(walker.x - p.x, (walker.y - p.y) / 0.72) > p.R), 'Entry walker started inside fire');
const before = __sr.fireStats(), killsBefore = f.g.kills;
let entered = false;
for (let i = 0; i < 150 && !walker.dead; i++) {
  pinned(f, 1 / 60);
  if (__sr.fires().some(p => Math.hypot(walker.x - p.x, (walker.y - p.y) / 0.72) <= p.R)) entered = true;
}
check(entered && walker.dead && Math.abs(walker.x - startX) > 1, 'Walker did not walk into Napalm and die');
check(__sr.fireStats().kills === before.kills + 1 && f.g.kills === killsBefore + 1, 'Entering walker was not a scored fire kill');
check(f.g.tr.hp === hp, 'Napalm damaged the train');
const lastLifetime = Math.max(...__sr.fires().map(p => p.time));
check(lastLifetime > 0.05, 'Fire disappeared before its three-second lifetime');
pinned(f, lastLifetime - 0.05);
check(__sr.fires().length > 0, 'Last Napalm patch expired early');
pinned(f, 0.1);
check(__sr.fires().length === 0 && Math.abs(f.g.run - (salvo.lastImpact.t + 3)) <= 0.08, 'Fire did not expire three seconds after last impact');
const fireResult = __sr.fireStats();

// The direct helper is used only for bounded-list stress and fire-on-engine safety.
freshNapalm(false);
const g = __sr.G, {W, H} = __sr.stats(), c = g.tr.cars[0], stress = {g, s: g.tr.s, anchors: []}, stressHp = g.tr.hp;
for (let i = 0; i < 60; i++) {
  check(__sr.addBurn(40 + (i % 10) * (W - 80) / 9, 75 + Math.floor(i / 10) * 20) === i + 1, 'Burn fixture did not append patch ' + i);
}
check(__sr.addBurn(c.cx - g.camX, c.cy - g.camY) === 60 && __sr.fires().length === 60 && __sr.fireStats().created === 61, 'BURN exceeded cap60');
pinned(stress, 1);
__sr.frames(30);
const stressFx = __sr.fx();
check(stressFx.parts <= 2600 && __sr.fires().length <= 60 && g.tr.hp === stressHp, 'Fire stress exceeded particle/patch caps or hurt the engine');
pinned(stress, 1.6);
check(__sr.fires().length === 0, 'Stress patches survived their lifetime');

const shot = napalmShot();
__sr.frames(30);
check(__sr.late() <= 1, 'Burn rendering created extra late atlas pages');

const performance = [];
for (let i = 0; i < 3; i++) {
  freshNapalm(true, true, false);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.sim(20);
  __sr.frames(30);
  const stats = __sr.stats();
  performance.push({bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(),
    kills: stats.kills, zombies: stats.zombies, parts: stats.parts, fires: __sr.fires().length, created: __sr.fireStats().created});
  check(stats.kills > 0 && stats.hp > 0 && __sr.fireStats().created > 0 && __sr.late() <= 1, 'Busy Napalm fight is not sane');
}
const median = performance.map(p => p.bench).sort((a, b) => a - b)[1];
QA_DONE({noNapalmNoFire: true, realSalvo: {patches: initial.length, duration: 3, dps: 2, radius: 16},
  walkingEntry: {entered, dead: walker.dead, fireKills: fireResult.kills}, expiresAfterThreeSeconds: true,
  trainSafe: true, stress: {created: 61, cap: 60, expired: true, fx: stressFx},
  shot: {patches: shot.fires.length, fireKills: shot.stats.kills, heli: shot.heli, point: shot.point}, shotRendered: true,
  performance, medianBench: median});
