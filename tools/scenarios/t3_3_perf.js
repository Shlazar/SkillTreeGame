// Run mode: isolated busy-fight render samples with maximum nose-gun rockets.
__sr.reset();
__sr.node('rockets', 5);
__sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(20); __sr.frames(30); __sr.hold(true);
const samples = [__sr.bench(60), __sr.bench(60), __sr.bench(60)].map(v => +v.toFixed(2));
const median = samples.slice().sort((a, b) => a - b)[1];
if (median >= 8 || __sr.late() > 1 || !__sr.rockets().rockets) throw new Error('Rocket fight failed the frame, atlas or firing check');
QA_DONE({samples, median, cost: __sr.cost(20), land: __sr.landBench(5), fx: __sr.fx(), horde: __sr.horde(), late: __sr.late()});
