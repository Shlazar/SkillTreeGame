// Run mode: a new game goes straight from title to leg 1, then summary and Depot.
const o = [];
__sr.reset(); o.push(__sr.mode);
__sr.press('Enter'); o.push(__sr.mode);
if (__sr.mode !== 'play' || __sr.G.leg !== 1) throw new Error('Fresh title did not start leg 1');
__sr.bot(true); __sr.sim(20); __sr.lose(); __sr.sim(6); o.push(__sr.mode);
__sr.frames(45); __sr.press('Enter');
if (__sr.mode === 'summary') __sr.press('Enter');
o.push(__sr.mode);
if (__sr.mode !== 'depot') throw new Error('Summary did not return to the Depot');
QA_DONE(o);
