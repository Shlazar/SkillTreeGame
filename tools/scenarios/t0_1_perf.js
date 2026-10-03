// Run mode: record the unchanged busy-fight baseline from tools/README.md section 6.
__sr.give(3000, 30);
__sr.start();
__sr.bot(true);
__sr.sim(20);
__sr.frames(30);
QA_DONE({
  bench: +__sr.bench(60).toFixed(2),
  cost: __sr.cost(20),
  land: __sr.landBench(5),
  fx: __sr.fx(), horde: __sr.horde(), late: __sr.late()
});
