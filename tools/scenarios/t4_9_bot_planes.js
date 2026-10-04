// Actual bot scanning and smart-strike thresholds; manual smart strikes keep their lower threshold.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshPlanes(slots = ['a10', 'f4'], quiet = false) {
  __sr.hold(false); __sr.reset();
  for (const id of ['a10', 'f4', 'b52']) check(__sr.node(id, 1), 'Missing plane ' + id);
  __sr.SAVE.hangar = slots.slice();
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  check(JSON.stringify(__sr.planes().map(p => p.id)) === JSON.stringify(slots), 'Wrong equipped loadout');
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.sim(8); __sr.frames(240);
}
function threshold(n, offscreen = false, bot = true) {
  freshPlanes(['a10', 'f4'], true);
  const g = __sr.G, s = __sr.stats(), trainS = g.tr.s, anchors = [];
  const x = offscreen ? s.W + 60 : s.W * 0.7, y = s.VH * 0.65;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, z = __sr.spawn(0, x + Math.cos(a) * 8, y + Math.sin(a) * 8 * 0.72);
    z.hp = 1000000; z.sp = 0; anchors.push({z, x: z.x, y: z.y});
  }
  __sr.bot(bot);
  for (let i = 0; i < 90; i++) {
    g.tr.s = trainS; g.tr.v = 0;
    for (const a of anchors) { a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0; }
    __sr.sim(1 / 60);
  }
  const planes = __sr.planes();
  const shouldLaunch = bot && !offscreen && n >= 15;
  check(planes.every(p => p.strikes === (shouldLaunch ? 1 : 0)),
    'Bot crowd threshold failed: ' + JSON.stringify({n, offscreen, bot, planes}));
  check(__sr.G.shots === 0, 'Isolated threshold fixture allowed heli shots');
  if (shouldLaunch) for (const p of planes) {
    check(p.lastStrike.x - g.camX >= 0 && p.lastStrike.x - g.camX < s.W &&
      p.lastStrike.y - g.camY >= 19 && p.lastStrike.y - g.camY < s.VH, 'Bot target was outside the visible world');
  }
  return {n, offscreen, bot, planes};
}
function botShot() {
  freshPlanes(); __sr.bot(true);
  let jet = null;
  for (let i = 0; i < 1800; i++) {
    __sr.frames(1);
    jet = __sr.planeShow().jets.find(j => j.bodyVisible && j.roared);
    if (__sr.G.run > 4 && jet) break;
  }
  check(jet && __sr.G.bot && __sr.planes().some(p => p.id === jet.id && p.strikes > 0),
    'Natural bot ride never showed a real automatic plane flight');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {jet, planes: __sr.planes(), stats: __sr.stats(), heli: __sr.helis()[0]};
}

const thresholds = [threshold(0), threshold(14), threshold(15), threshold(15, true), threshold(15, false, false)];
// A manual smart strike still accepts a single target; the bot alone requires fifteen.
threshold(1, false, false);
check(__sr.smart('q') && __sr.planes()[0].strikes === 1, 'Manual smart strike acquired the bot-only threshold');
const rides = [];
for (const slots of [['a10', 'f4'], ['b52', 'a10']]) {
  freshPlanes(slots); __sr.bot(true); __sr.sim(60); __sr.frames(10);
  const planes = __sr.planes(), strikes = planes.reduce((n, p) => n + p.strikes, 0);
  check(planes.every(p => p.strikes >= 1) && strikes >= 3,
    'Sixty-second natural bot loadout did not make several strikes: ' + JSON.stringify({slots, planes, leg: __sr.legState()}));
  check(!planes.some(p => !slots.includes(p.id)), 'Bot used an unequipped plane');
  rides.push({slots, planes, strikes, stats: __sr.stats()});
}
const shot = botShot(); __sr.frames(30);
check(__sr.late() <= 1, 'Automatic plane flight created late sprite pages');
__sr.hold(false); __sr.hp(9999); __sr.sim(30); __sr.frames(10);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), planes: __sr.planes()};
check(performance.late <= 1, 'Automatic plane busy drawing created late pages');
QA_DONE({thresholds, manualSingleTarget: true, rides, shot, matchingShotRendered: true, performance,
  baseline: {bench: 3.27, render: 2.97, late: 1}});
