// Run mode: VIPER's base four-shot gun, two-hit walkers, built-in winch and immediate single-heli orders.
function check(ok, message) { if (!ok) throw new Error(message); }
function fresh() {
  __sr.hold(false);
  __sr.reset();
  __sr.start();
  __sr.bot(false);
  const g = __sr.G;
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
}
function target(hp) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.7;
  h.y = g.camY + H * 0.7;
  h.vx = h.vy = 0;
  h.hd = 0;
  h.cd = 0;
  const z = __sr.spawn(0, h.x - g.camX, h.y - g.camY - 45);
  if (hp != null) z.hp = hp;
  __sr.order(0, 'attack', z);
  return z;
}
function gunShot() {
  // Keep identical to t3_1_gun_shot.js: first real impact, then the second real muzzle flash.
  fresh();
  __sr.G.helis[0].cd = 1000000;
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
  for (let i = 0; i < 40 && g.shots < 2; i++) __sr.sim(1 / 60);
  check(g.shots === 2 && g.hits >= 1 && h.flash > 0, 'Shot did not capture real muzzle/impact effects');
  __sr.frames(1);
  __sr.hold(true);
  return {heli: __sr.helis()[0], target: {x: +((z.x - g.camX).toFixed(1)), y: +((z.y - g.camY).toFixed(1))},
    shots: g.shots, hits: g.hits, muzzleFlash: +h.flash.toFixed(3)};
}

fresh();
check(__sr.G.helis.length === 1 && __sr.G.helis[0].sel, 'Fresh VIPER must be the selected single heli');
check(__sr.CFG.mg.rate === 4, 'Wrong base fire rate');
check(__sr.CFG.winch.hover === 2 && __sr.lootStats().winch === true, 'Built-in two-second winch missing');
const walker = target();
check(walker.hp === 2, 'Fresh walker is not two HP');
__sr.sim(0.1);
check(__sr.G.shots === 1 && walker.hp === 1 && !walker.dead, 'First actual bullet must leave walker at one HP');
const firstHit = {shots: __sr.G.shots, hp: walker.hp, hits: __sr.G.hits};
__sr.sim(0.3);
check(walker.dead && walker.hp === 0 && __sr.G.shots === 2, 'Second actual bullet must kill walker');
const secondHit = {shots: __sr.G.shots, hp: walker.hp, hits: __sr.G.hits};

fresh();
const {W, H} = __sr.stats(), startingHp = [];
for (let i = 0; i < 20; i++) {
  const z = __sr.spawn(0, W * 0.72 + (i % 5) * 8, H * 0.48 + Math.floor(i / 5) * 8);
  startingHp.push(z.hp);
}
check(startingHp.length === 20 && startingHp.every(hp => hp === 2), 'Twenty fresh walkers must all start at two HP');

// A durable stationary walker keeps the gun loaded with a target throughout the ten-second sample.
fresh();
const durable = target(9999);
__sr.sim(1);
const before = __sr.G.shots, t0 = __sr.G.run, perSecond = [];
for (let i = 0; i < 10; i++) {
  const previous = __sr.G.shots;
  __sr.sim(1);
  check(!durable.dead && __sr.G.helis[0].order?.z === durable, 'Sustained gun lost its locked target');
  perSecond.push(__sr.G.shots - previous);
  check(perSecond[i] >= 3 && perSecond[i] <= 5, 'Continuous gun interrupted its four-shot cadence: ' + JSON.stringify(perSecond));
}
const continuous = {shots: __sr.G.shots - before, seconds: +(__sr.G.run - t0).toFixed(3), targetHp: durable.hp, perSecond};
continuous.rate = +(continuous.shots / continuous.seconds).toFixed(3);
check(continuous.rate >= 3.5 && continuous.rate <= 4.5, 'Base sustained fire is not about four shots/s: ' + JSON.stringify(continuous));

fresh();
__sr.sel();
check(!__sr.G.helis[0].sel, 'Test helper did not clear selection for the immediate-order regression');
const moveX = W * 0.85, moveY = H * 0.6, h = __sr.G.helis[0];
const oldX = h.x, oldY = h.y;
__sr.rclickH(moveX, moveY);
check(h.sel && h.order?.kind === 'move', 'Right click with no explicit selection failed');
check(Math.abs(h.order.x - (__sr.G.camX + moveX)) < 0.001 && Math.abs(h.order.y - (__sr.G.camY + moveY)) < 0.001, 'Ground order misses the clicked point');
__sr.sim(0.4);
check(Math.hypot(h.x - oldX, h.y - oldY) > 1, 'Helicopter did not fly toward ground order');
__sr.lclick(4, 70);
check(h.sel, 'Empty ground click deselected VIPER');
__sr.drag(2, 72, 12, 82);
check(h.sel, 'Empty drag deselected VIPER');
const clickTarget = __sr.spawn(0, W * 0.7, H * 0.45);
__sr.rclickH(clickTarget.x - __sr.G.camX, clickTarget.y - clickTarget.S.h * 0.5 - __sr.G.camY);
check(h.sel && h.order?.kind === 'attack' && h.order.z === clickTarget, 'Right click zombie did not focus it');

__sr.title();
check(__sr.G.up.winch === true, 'Menu demo lost the built-in winch');
__sr.hold(false);
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(30);
__sr.frames(30);
const battle = __sr.stats(), performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
check(battle.kills > 0 && battle.km > 0.03 && battle.hp > 0, 'Thirty-second base fight is not sane');
check(battle.up.winch === true && battle.helis.length === 1, 'Normal battle base heli/winch changed');
check(!__sr.tutState().tasks.some(text => /CLICK YOUR HELI|SELECT.*HELI/.test(text)) && !__sr.seen().includes('p_hot'), 'Selection/overheat lesson remains');
check(performance.late <= 1, 'Base gun created extra late atlas pages');

const shot = gunShot();
__sr.frames(30);
QA_DONE({firstHit, secondHit, twentyWalkerHp: startingHp, continuous, controls: {alwaysSelected: true, groundMove: true, targetFocus: true},
  winch: {builtIn: true, seconds: __sr.CFG.winch.hover, demo: true},
  battle: {kills: battle.kills, shots: battle.shots, km: battle.km, hp: battle.hp, parts: battle.parts},
  performance, shot, shotRendered: true});
