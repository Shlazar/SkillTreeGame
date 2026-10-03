// Run mode: the whole loop title -> depot -> run -> summary -> depot must work with no errors.
const o = [];
__sr.title(); o.push(__sr.mode);
__sr.depot('tree'); o.push(__sr.mode);
__sr.start(); o.push(__sr.mode);
__sr.bot(true); __sr.sim(20); __sr.lose(); __sr.sim(6); o.push(__sr.mode);
__sr.depot('tree'); o.push(__sr.mode);
QA_DONE(o);
