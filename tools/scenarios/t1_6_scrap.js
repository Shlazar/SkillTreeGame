// Scrap comes from kills and loot; gold banking adds only the unbanked part of the run.
__sr.reset(); __sr.start();
const check = (ok, why) => { if (!ok) throw new Error(why); };
const killType = (type) => { const z = __sr.spawn(type, 90, 120); __sr.hit(z, 100); return z; };
const before = __sr.G.cash;
const factor = __sr.G.killPay;
for (let i = 0; i < 10; i++) killType(0);
const walkers = __sr.G.cash - before;
const afterWalkers = __sr.G.cash;
killType(2);
const brute = __sr.G.cash - afterWalkers;
const afterBrute = __sr.G.cash;
killType(1);
const runner = __sr.G.cash - afterBrute;
const whole = (base) => Math.floor(base * factor + 1e-9);
check(walkers === whole(10) && brute === whole(15) - whole(10) && runner === whole(16) - whole(15), 'Wrong calibrated kill payouts');
const income = __sr.incomeState();
check(income.base.ordinary === 16 && income.sources.ordinary === whole(16) &&
  Math.abs(income.fractions.ordinary - (16 * factor - whole(16))) < 1e-8, 'Ordinary values or fractional carry changed');
check(!('dist' in __sr.G.pay) && !('stop' in __sr.G.pay), 'Old income sources remain');
check(Object.keys(__sr.CFG.pay).join(',') === 'kill', 'Old payout config remains');
// Remove targets and weapons, then ride long enough that the old distance payment would pay.
__sr.G.zombies.length = 0; __sr.G.rounds.length = 0; __sr.G.helis.length = 0;
__sr.G.spawnCd = __sr.G.railCd = __sr.G.waveCd = 1e6;
__sr.G.eventIndex = __sr.line().legs[0].events.length;
const cashBeforeRide = __sr.G.cash;
__sr.sim(2);
check(__sr.G.cash === cashBeforeRide, 'Riding still pays scrap');
const gold = __sr.payGold('test:gold', 5, 25);
check(gold.gold === 5 && __sr.G.gold === 5 && __sr.G.banked.gold === 5 && __sr.SAVE.gold === 5, 'Gold did not bank');
__sr.lose(); __sr.sim(6); __sr.frames(30);
check(__sr.SAVE.gold === 5 && __sr.G.sum.gold === 5, 'Gold paid twice on ending');
const pay = {...__sr.G.pay};
// Exact battle screenshot setup with the new kill income.
__sr.reset(); __sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(20); __sr.frames(150); __sr.hold(true);
QA_DONE({walkers, brute, runner, factor, income, pay, gold: 5, rideScrap: __sr.CFG.pay.dist || 0});
