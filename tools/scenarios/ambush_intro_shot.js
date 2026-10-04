// Run/shot mode: the real third ambush before the player repositions to protect the rear cars.
__sr.reset(); __sr.start(); __sr.bot(false);
for (let i = 0; i < 800 && !__sr.G.result && !(__sr.G.ambush.index === 2 && __sr.G.ambush.phase === 'hold'); i++) __sr.sim(0.1);
if (__sr.G.result || __sr.G.ambush.index !== 2) throw new Error('Third ambush was not reached');
__sr.frames(36); __sr.hold(true); __sr.frames(1);
QA_DONE({ambush: __sr.ambushState(), stats: __sr.stats()});
