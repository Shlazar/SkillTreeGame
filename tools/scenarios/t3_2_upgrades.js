// Run mode: heli upgrade values, real damage/rate/range, tooltip NOW > NEXT and matching effect/range shots.
function check(ok, message) { if (!ok) throw new Error(message); }
function close(actual, expected, label) {
  check(Math.abs(actual - expected) < 1e-7, label + ': ' + actual + ' != ' + expected);
}
function fresh(damage, rate, range) {
  __sr.hold(false);
  __sr.reset();
  for (const [id, level] of [['hdmg', damage], ['hrate', rate], ['hrange', range]]) {
    if (!__sr.node(id, level)) throw new Error('Unknown upgrade ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function hitShot(level) {
  fresh(level, 0, 0);
  __sr.sim(8);
  __sr.frames(240);
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.55;
  h.y = g.camY + H * 0.7;
  h.vx = h.vy = 0;
  h.alt = 25;
  h.cd = 0;
  const z = __sr.spawn(0, h.x - g.camX + 36, h.y - g.camY - 65);
  z.hp = 9999;
  h.hd = Math.atan2(z.x - h.x, -(z.y - h.y));
  __sr.order(0, 'attack', z);
  for (let i = 0; i < 40 && g.hits < 1; i++) __sr.sim(1 / 60);
  if (g.hits !== 1 || g.shots !== 1) throw new Error('Hit shot did not capture its first real bullet impact');
  __sr.hold(true);
  __sr.frames(1);
  return {up: __sr.stats().up, hp: z.hp, visual: __sr.gunVisual(),
    heli: __sr.helis()[0], target: {x: +(z.x - g.camX).toFixed(1), y: +(z.y - g.camY).toFixed(1)}};
}
function rangeShot(level) {
  // Fire Rate is the owned parent for both range comparison fixtures.
  fresh(0, 1, level);
  if (!__sr.gunVisual().range.visible) throw new Error('Initial three-second range ring missing');
  __sr.sim(3.2);
  if (__sr.gunVisual().range.visible) throw new Error('Initial range ring did not expire');
  __sr.hold(true);
  __sr.frames(240);
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.55;
  h.y = g.camY + H * 0.5;
  h.vx = h.vy = 0;
  h.alt = 25;
  h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.rightDown(h.x - g.camX, h.y - g.camY);
  if (!__sr.gunVisual().range.visible) throw new Error('Held right button did not show expired range ring');
  __sr.frames(1);
  return {up: __sr.stats().up, run: +g.run.toFixed(2), visual: __sr.gunVisual(), heli: __sr.helis()[0]};
}

fresh(0, 0, 0);
const zero = __sr.stats().up;
close(zero.dmg, 1, 'Base actual damage');
close(zero.heliDmg, 1, 'Base damage multiplier');
close(zero.rate, 4, 'Base shots/s');
close(zero.heliRate, 1, 'Base fire rate multiplier');
close(zero.heliRange, 1, 'Base range multiplier');
close(__sr.gunVisual().range.radius, 150, 'Base gun radius');
fresh(8, 6, 4);
const maximum = __sr.stats().up;
close(maximum.dmg, 2.6, 'Max actual damage');
close(maximum.heliDmg, 2.6, 'Max damage multiplier');
close(maximum.rate, 6.88, 'Max shots/s');
close(maximum.heliRate, 1.72, 'Max fire rate multiplier');
close(maximum.heliRange, 1.6, 'Max range multiplier');
close(__sr.gunVisual().range.radius, 240, 'Max gun radius');

// Sample an aimed durable target after warm-up; no ambient spawns or loot can interfere.
fresh(0, 6, 0);
let g = __sr.G, h = g.helis[0], view = __sr.stats();
h.x = g.camX + view.W * 0.7;
h.y = g.camY + view.H * 0.7;
h.vx = h.vy = 0;
h.hd = 0;
h.cd = 0;
let z = __sr.spawn(0, h.x - g.camX, h.y - g.camY - 45);
z.hp = 9999;
__sr.order(0, 'attack', z);
__sr.sim(1);
const before = g.shots, t0 = g.run;
__sr.sim(10);
const rate = {shots: g.shots - before, seconds: +(g.run - t0).toFixed(3)};
rate.perSecond = +(rate.shots / rate.seconds).toFixed(3);
check(Math.abs(rate.perSecond - 6.88) <= 0.15 && !z.dead, 'Actual max fire rate: ' + JSON.stringify(rate));

// A move order holds the heli still: it must not approach a target just to make the range test pass.
const reach = [];
for (const level of [0, 4]) {
  fresh(0, 1, level);
  g = __sr.G; h = g.helis[0]; view = __sr.stats();
  h.x = g.camX + view.W * 0.4;
  h.y = g.camY + view.H * 0.65;
  h.vx = h.vy = 0;
  h.hd = Math.PI / 2;
  h.cd = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  z = __sr.spawn(0, h.x - g.camX + 200, h.y - g.camY);
  h.tgt = z;
  h.look = 1000000;
  __sr.sim(0.15);
  check(level === 0 ? g.shots === 0 && z.hp === 2 : g.shots === 1 && z.hp === 1, 'Real 200 px target range at level ' + level);
  reach.push({level, radius: __sr.gunVisual().range.radius, shots: g.shots, targetHp: z.hp});
}

const tooltipChecks = [];
for (const spec of [
  {id: 'hdmg', max: 8, cases: [[0, 'DAMAGE 100% > 120%'], [7, 'DAMAGE 240% > 260%'], [8, 'DAMAGE 260%']]},
  {id: 'hrate', max: 6, cases: [[0, 'FIRE RATE 4/S > 4.5/S'], [5, 'FIRE RATE 6.4/S > 6.9/S'], [6, 'FIRE RATE 6.9/S']]},
  {id: 'hrange', max: 4, cases: [[0, 'RANGE 100% > 115%'], [3, 'RANGE 145% > 160%'], [4, 'RANGE 160%']]}
]) {
  for (const [level, expected] of spec.cases) {
    __sr.hold(false);
    __sr.reset();
    if (spec.id === 'hrange') check(__sr.node('hrate', 1), 'Range tooltip parent missing');
    check(__sr.node(spec.id, level), 'Tooltip node missing: ' + spec.id);
    __sr.give(20000, 0, 0);
    __sr.depot('tree');
    __sr.frames(60);
    check(__sr.hoverNode(spec.id), 'Tooltip could not be focused: ' + spec.id);
    __sr.frames(1);
    const rows = __sr.treeStats(spec.id).map(row => row.map(segment => segment[0]).join(' '));
    check(rows.includes(expected), 'Tooltip ' + spec.id + '@' + level + ': ' + JSON.stringify(rows));
    check(__sr.infoFit().bad.length === 0, 'Tooltip overflow: ' + spec.id);
    tooltipChecks.push({id: spec.id, level, text: rows[0]});
  }
}

// Repeat all four exact screenshot setups, then render held frames to expose draw errors.
const lowHit = hitShot(0);
check(lowHit.visual.hits.length > 0, 'Base impact star missing');
close(lowHit.hp, 9998, 'Base actual bullet damage');
close(lowHit.visual.hits[0].scale, 1, 'Base hit effect size');
__sr.frames(30);
const highHit = hitShot(8);
check(highHit.visual.hits.length > 0, 'Max impact star missing');
close(highHit.hp, 9996.4, 'Max actual bullet damage');
close(highHit.visual.hits[0].scale, 2.6, 'Max hit effect size');
__sr.frames(30);
const lowRange = rangeShot(0);
close(lowRange.visual.range.radius, 150, 'Base held ring');
__sr.frames(30);
__sr.rightUp(4, 70);
check(!__sr.gunVisual().range.visible, 'Right button release left base ring visible');
const highRange = rangeShot(4);
close(highRange.visual.range.radius, 240, 'Max held ring');
__sr.frames(30);
__sr.rightUp(4, 70);
check(!__sr.gunVisual().range.visible, 'Right button release left max ring visible');

__sr.hold(false);
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(30);
__sr.frames(30);
const battle = __sr.stats(), performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
check(battle.kills > 0 && battle.hp > 0 && battle.km > 0.03, 'Busy normal battle is not sane');
check(performance.late <= 1, 'Upgrade effects made extra late atlas pages');
QA_DONE({zero: {damage: zero.dmg, rate: zero.rate, range: zero.heliRange},
  maximum: {damage: maximum.dmg, rate: maximum.rate, range: maximum.heliRange}, rate, reach, tooltipChecks,
  hitShots: [{level: 0, scale: lowHit.visual.hits[0].scale, heli: lowHit.heli, target: lowHit.target},
    {level: 8, scale: highHit.visual.hits[0].scale, heli: highHit.heli, target: highHit.target}],
  rangeShots: [{level: 0, radius: lowRange.visual.range.radius, heli: lowRange.heli},
    {level: 4, radius: highRange.visual.range.radius, heli: highRange.heli}],
  initialRingExpires: true, realRightDownUp: true, fourShotsRendered: true,
  battle: {kills: battle.kills, shots: battle.shots, zombies: battle.zombies, parts: battle.parts}, performance});
