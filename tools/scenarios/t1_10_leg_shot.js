// Shot mode: the same complete leg ride as tools/examples/run_leg.js, frozen at arrival.
__sr.reset();
__sr.leg(1, false);
__sr.hp(9999);
__sr.bot(true);
for (let seconds = 0; seconds < 120 && !__sr.G.result; seconds++) __sr.sim(1);
if (__sr.G.result !== 'won') throw new Error('Leg 1 did not arrive within 120 seconds');
__sr.frames(30);
__sr.hold(true);
