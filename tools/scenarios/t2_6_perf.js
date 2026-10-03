// Run mode: the standard busy fight with Armor, Magnet and Salvage Crew at maximum.
__sr.reset();
for (const [id, level] of [['armor', 6], ['magnet', 5], ['salvageCrew', 4]]) __sr.node(id, level);
__sr.give(3000, 30);
__sr.start(); __sr.bot(true); __sr.sim(20); __sr.frames(30); __sr.hold(true);
const samples = [__sr.bench(60), __sr.bench(60), __sr.bench(60)].map(v => +v.toFixed(2));
const median = samples.slice().sort((a,b)=>a-b)[1];
if (median >= 8 || __sr.late() > 1) throw new Error('Salvage fight exceeded the frame or atlas budget');
QA_DONE({samples, median, cost:__sr.cost(20), land:__sr.landBench(5), fx:__sr.fx(), horde:__sr.horde(), late:__sr.late()});
