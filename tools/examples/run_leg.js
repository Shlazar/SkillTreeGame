// Run mode: ride the whole first leg with the bot, then inspect its saved result.
__sr.reset();
__sr.leg(1, false);
__sr.hp(9999);
__sr.bot(true);
for (let seconds = 0; seconds < 120 && !__sr.G.result; seconds++) __sr.sim(1);
if (__sr.G.result !== 'won') throw new Error('Leg 1 did not arrive within 120 seconds');
__sr.frames(30);
const leg = __sr.legState();
if (__sr.save().leg !== 2 || __sr.save().surv !== 1) throw new Error('First arrival was not saved');
QA_DONE(leg);
