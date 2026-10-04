// run mode: start Chrome with QA_REDUCED=1; actual reduced preference disables shake/slow motion and aiming slowdown.
function check(ok, why) { if (!ok) throw new Error(why); }
check(matchMedia('(prefers-reduced-motion: reduce)').matches && __sr.motionProbe(false).reduced,
  'Run this scenario with QA_REDUCED=1 before the game boots');
__sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
check(__sr.node('a10', 1), 'A-10 fixture failed');
__sr.leg(1); __sr.hp(9999); __sr.bot(false);
const requested = __sr.motionProbe(true), samples = [];
for (let i = 0; i < 12; i++) {
  __sr.frames(1); const p = __sr.motionProbe(false);
  check(p.reduced && p.trauma === 0 && p.slowT === 0 && p.shake.every(v => v === 0),
    'Reduced motion kept a shake/kick/hit-stop effect: ' + JSON.stringify(p));
  samples.push(p);
}
__sr.press('q'); check(__sr.planeAim().active, 'Actual ready A-10 did not arm');
const before = __sr.G.run; __sr.frames(12); const elapsed = __sr.G.run - before, aim = __sr.motionProbe(false);
check(__sr.planeAim().active && aim.aimScale === 1 && elapsed >= 11 / 60 && elapsed <= 13 / 60,
  'Reduced-motion aiming slowed the real game clock: ' + JSON.stringify({before, elapsed, aim}));
__sr.rightDown(10, 60); __sr.rightUp(10, 60); check(!__sr.planeAim().active, 'Actual right-click failed to cancel aim');
__sr.bot(true); __sr.sim(30); __sr.frames(30);
const after = __sr.motionProbe(false);
check(after.trauma === 0 && after.slowT === 0 && after.shake.every(v => v === 0) && __sr.late() <= 1,
  'Actual combat reintroduced motion or late sprites in reduced mode');
QA_DONE({mediaReduced: true, requested, samples, aimedGameSeconds: elapsed, aim, after, stats: __sr.stats(), late: __sr.late()});

