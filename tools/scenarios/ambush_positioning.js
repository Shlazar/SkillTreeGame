// A few ground moves in response to warnings plus one brute focus can defend the new opening.
function check(ok, why) { if (!ok) throw new Error(why); }
__sr.reset(); __sr.start(); __sr.bot(false);
const g = __sr.G, commands = [], positioned = new Set();
function move(key, carIndex, side) {
  const car = g.tr.cars[carIndex];
  const x = car.cx + car.nx * side * 38 - g.camX, y = car.cy + car.ny * side * 38 - g.camY;
  __sr.rightDown(x, y); __sr.rightUp(x, y);
  check(g.helis[0].order?.kind === 'move', 'Position command did not reach the ground');
  positioned.add(key); commands.push({key, at: g.run, x, y});
}
for (let i = 0; i < 1100 && !g.result; i++) {
  const a = g.ambush, r = a.stops[a.index];
  if (a.phase === 'hold') {
    const start = 'start-' + a.index;
    if (!positioned.has(start)) move(start, a.index ? 1 : 0, a.index === 1 ? 1 : -1);
    const brute = r.actors.find(z => z.big && !z.dead);
    if (brute && !positioned.has('brute')) {
      const x = brute.x - g.camX, y = brute.y - brute.S.h / 2 - g.camY;
      __sr.rightDown(x, y); __sr.rightUp(x, y);
      check(g.helis[0].order?.z === brute, 'Brute focus did not reach its target');
      positioned.add('brute'); commands.push({key:'brute', at:g.run});
    }
    const runners = r.groups.find(s => s.type === 1), rear = 'rear-' + a.index, back = 'back-' + a.index;
    if (runners?.warnedAt != null && !brute && !positioned.has(rear)) move(rear, 3, runners.side);
    if (runners && positioned.has(rear) && !positioned.has(back) && runners.spawned === runners.n &&
      !r.actors.some(z => z.run && !z.dead)) move(back, 1, a.index === 1 ? 1 : -1);
  }
  __sr.sim(0.1);
}
check(g.result === 'won' && g.tr.hp > 0 && commands.length <= 8 && positioned.has('brute'),
  'Limited warning responses could not defend the train: ' + JSON.stringify({result:g.result, hp:g.tr.hp, t:g.run, commands}));
const defense = __sr.ambushState(), health = g.tr.hp, seconds = g.run;
__sr.sim(4);
const survivors = __sr.save().surv, gold = __sr.save().gold;
__sr.start(1, true); __sr.win(); __sr.sim(5);
check(__sr.G.result === 'won' && __sr.save().surv === survivors && __sr.save().gold === gold,
  'Forced replay reward fixture duplicated a one-time reward');
QA_DONE({commands, health, seconds, defense, replayRewardGuard: true,
  method: 'Natural first ride, normal health, at most seven real ground clicks and one brute focus; forced arrival is used only for the separate replay reward check.'});
