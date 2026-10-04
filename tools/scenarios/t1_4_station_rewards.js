// Run mode: station rewards persist on arrival, pay once, and both reward screenshots render.
function money() {
  const save = __sr.save();
  return {surv: save.surv, gold: save.gold, chest: save.chest};
}
function expectMoney(expected, label) {
  const actual = money();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + ': ' + JSON.stringify(actual));
  }
  const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  for (const key of ['surv', 'gold', 'chest']) {
    if (stored[key] !== expected[key]) throw new Error(label + ': reward not persisted for ' + key);
  }
}
function arrive(leg, replay) {
  __sr.leg(leg, !!replay);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.win();
  for (let frame = 0; frame < 120 && __sr.G.result !== 'won'; frame++) __sr.frames(1);
  if (__sr.G.result !== 'won' || __sr.mode !== 'ending') throw new Error('No arrival in leg ' + leg);
  return {leg, replay: !!replay, mode: __sr.mode, ...money()};
}

__sr.reset();
const arrivals = [];
arrivals.push(arrive(1, false));
expectMoney({surv: 1, gold: 0, chest: 0}, 'First big station, immediately');
__sr.sim(6);
expectMoney({surv: 1, gold: 0, chest: 0}, 'First big station after banking');
arrivals.push(arrive(1, true));
expectMoney({surv: 1, gold: 0, chest: 0}, 'Big station replay');
__sr.sim(6);
expectMoney({surv: 1, gold: 0, chest: 0}, 'Big station replay after banking');

arrivals.push(arrive(2, false));
expectMoney({surv: 1, gold: 0, chest: 1}, 'Cornfield locked chest');
__sr.sim(6);
expectMoney({surv: 1, gold: 0, chest: 1}, 'Cornfield after banking');
arrivals.push(arrive(2, true));
expectMoney({surv: 1, gold: 0, chest: 1}, 'Cornfield replay');
__sr.sim(6);

// Completed star rules add6 gold per full-health arrival from leg3; the first actual gold also opens the6-gold chest.
arrivals.push(arrive(3, false));
expectMoney({surv: 2, gold: 12, chest: 2}, 'Second big station');
__sr.sim(6);
expectMoney({surv: 2, gold: 12, chest: 2}, 'Second big station after banking');
arrivals.push(arrive(3, true));
expectMoney({surv: 2, gold: 12, chest: 2}, 'Second big station replay');
__sr.sim(6);

arrivals.push(arrive(4, false));
expectMoney({surv: 2, gold: 24, chest: 2}, 'Small station gold');
__sr.sim(6);
expectMoney({surv: 2, gold: 24, chest: 2}, 'Small station after banking');
arrivals.push(arrive(4, true));
expectMoney({surv: 2, gold: 24, chest: 2}, 'Small station replay');
__sr.sim(6);
expectMoney({surv: 2, gold: 24, chest: 2}, 'Small station replay after banking');

// Camp sprites must be ready before drawing: the normal 30-second run keeps the baseline atlas count.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(30);
__sr.frames(30);
const perf = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
if (perf.late > 1) throw new Error('Camp sprites added late atlas pages: ' + perf.late);

// Keep this setup identical to t1_4_big_shot.js.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.win();
__sr.frames(50);
__sr.hold(true);
if (__sr.G.result !== 'won' || !__sr.G.stationReward) throw new Error('Big station shot has no live reward');
expectMoney({surv: 1, gold: 0, chest: 0}, 'Big station shot');
__sr.hold(false);

// Keep this setup identical to t1_4_small_shot.js; setLeg marks old wins without giving their rewards.
__sr.reset();
__sr.setLeg(4);
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.win();
__sr.frames(50);
__sr.hold(true);
if (__sr.G.result !== 'won' || !__sr.G.stationReward) throw new Error('Small station shot has no live reward');
expectMoney({surv: 0, gold: 12, chest: 0}, 'Small station shot');
__sr.hold(false);
// Keep this setup identical to t1_4_chest_shot.js.
__sr.reset(); __sr.setLeg(2); __sr.start(); __sr.hp(9999); __sr.bot(true);
__sr.win(); __sr.frames(50); __sr.hold(true);
if (__sr.G.stationReward?.kind !== 'chest') throw new Error('Chest reward did not appear');
expectMoney({surv: 0, gold: 0, chest: 1}, 'Locked chest shot');
QA_DONE({arrivals, perf, bigShot: true, smallShot: true, chestShot: true});
