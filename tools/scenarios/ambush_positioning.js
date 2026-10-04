// One ground-position command per ambush is enough; repeated focus-clicking is not required.
function check(ok, why) { if (!ok) throw new Error(why); }
__sr.reset(); __sr.start(); __sr.bot(false);
const g = __sr.G, commands = [], positioned = new Set();
for (let i = 0; i < 1200 && !g.result; i++) {
  const a = g.ambush;
  if (a.phase === 'hold' && !positioned.has(a.index)) {
    const car = g.tr.cars[a.index ? 1 : 0], side = a.index === 1 ? 1 : -1;
    const x = car.cx + car.nx * side * 38 - g.camX, y = car.cy + car.ny * side * 38 - g.camY;
    __sr.rightDown(x, y); __sr.rightUp(x, y);
    check(g.helis[0].order?.kind === 'move', 'Position command did not reach the ground');
    positioned.add(a.index); commands.push({ambush: a.index + 1, at: g.run, x, y});
  }
  __sr.sim(0.1);
}
check(g.result === 'won' && g.tr.hp > 0 && commands.length === 3, 'Three simple positions could not defend the train');
const defense = __sr.ambushState(), health = g.tr.hp, seconds = g.run;
__sr.sim(4);
const survivors = __sr.save().surv, gold = __sr.save().gold;
__sr.start(1, true); __sr.win(); __sr.sim(5);
check(__sr.G.result === 'won' && __sr.save().surv === survivors && __sr.save().gold === gold,
  'Forced replay reward fixture duplicated a one-time reward');
QA_DONE({commands, health, seconds, defense, replayRewardGuard: true,
  method: 'Natural first ride, normal health, three real ground clicks; forced arrival is used only for the separate replay reward check.'});
