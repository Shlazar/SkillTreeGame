// Run mode: a train slowed to a halt on its station approach must recover and arrive once.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.jump(10);
__sr.sim(1 / 60);
if (__sr.G.station.state !== 'braking') throw new Error('Fixture did not enter the station approach');
__sr.G.tr.v = 0;
__sr.G.zombies.length = 0;
__sr.sim(3);
if (__sr.G.result !== 'won' || Math.abs(__sr.G.tr.s - __sr.G.goalS) > 0.01) throw new Error('Approach did not recover and park');
const paid = __sr.save().surv;
__sr.sim(6);
if (__sr.G.tr.v !== 0 || __sr.save().surv !== paid || paid !== 1) throw new Error('Parked train moved or paid twice');
QA_DONE({recovered: true, stopped: true, survivor: paid, late: __sr.late()});
