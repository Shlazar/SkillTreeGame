// run mode: maxed natural Terminus ride/hold, real equipped planes and one actual E gift; no injected crowd.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const original = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = original; }
}
function until(test, seconds) {
  for (let i = 0; i < seconds * 60 && !test(); i++) __sr.sim(1 / 60);
  check(test(), 'Natural maxed finale timed out: ' + JSON.stringify({finale: __sr.finaleState(), stats: __sr.stats(), planes: __sr.planes()}));
}
const baseline = {task: 'T0.1', bench: 3.27, render: 2.97, land: {paint: 2.22, full: 2.36}, late: 1};
__sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
const levels = {};
for (const n of __sr.treeNodes().filter(n => n.k !== 'tease' && n.max > 0)) {
  check(__sr.node(n.id, n.max), 'Missing maxed node: ' + n.id); levels[n.id] = n.max;
}
for (const lesson of __sr.tutState().lessonText) __sr.SAVE.seen[lesson.key] = true;
__sr.SAVE.flags.survShown = __sr.SAVE.flags.goldShown = true;
__sr.setLeg(12); // Route/ownership fixtures only; ride, hold, waves and plane launches stay natural.
__sr.depot('hangar'); __sr.hold(true); __sr.frames(1);
check(__sr.hangarDrag('b52', 0) && __sr.hangarDrag('f4', 1), 'Real B52/F4 assignments failed');
const ownedBefore = JSON.stringify({nodes: __sr.save().nodes, hangar: __sr.save().hangar});
const result = seeded(0x844, () => {
  __sr.hold(false); __sr.leg(12); __sr.hp(9999); __sr.bot(true); __sr.thermal(0);
  const g = __sr.G, samples = [];
  function sample(label) {
    __sr.hold(true); __sr.frames(30); const clock = g.run, f = __sr.finaleState(), units = __sr.units();
    const s = {label, gameSeconds: clock, holdSeconds: f.elapsed, phase: f.phase,
      viewport: __sr.uiBounds().viewport, bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20),
      land: __sr.landBench(5), late: __sr.late(), fx: __sr.fx(), juice: __sr.juice(), horde: __sr.horde(),
      live: g.zombies.filter(z => !z.dead && !z.gone).length, onTrain: g.onTrain, kills: g.kills,
      units, ram: __sr.ramInfo(), steam: __sr.steam(), planes: __sr.planes(), show: __sr.planeShow(),
      fireSources: [...new Set(__sr.fires().map(p => p.source))]};
    check(g.run === clock && __sr.G === g && f.phase === 'hold' && !g.result, 'Performance sample advanced/left the real hold');
    check(s.late <= baseline.late && s.fx.parts <= 2600 && __sr.fires().length <= 60,
      'Maxed finale effects or late pages exceeded their limits: ' + JSON.stringify({label, late: s.late, fx: s.fx}));
    samples.push(s); __sr.hold(false); return s;
  }
  __sr.sim(30); __sr.frames(30);
  const lateProbe = {gameSeconds: g.run, late: __sr.late(), stats: __sr.stats()};
  check(lateProbe.late <= baseline.late && !g.result, 'Natural30s maxed ride ended or created late sprite pages');
  until(() => __sr.finaleState().phase === 'hold', 150); const holdAt = __sr.finaleState().holdAt;
  for (const time of [0.5, 8.5]) {
    until(() => __sr.finaleState().elapsed >= time, 10); sample('wave-' + time);
  }
  until(() => __sr.finaleState().gifted, 10); __sr.bot(false);
  const gift = __sr.planes().find(p => p.key === 'e');
  check(gift?.ready && gift.strikes === 0 && gift.charges === 1, 'Natural peak gift was unavailable or consumed before real E input');
  sample('peak-before-gift-strike');
  __sr.press('e'); __sr.press('e');
  check(__sr.planeShow().stats.b2.launched === 1 && __sr.planes().find(p => p.key === 'e').used,
    'Real E double-tap did not launch the one-use B2');
  until(() => __sr.planeShow().stats.b2.impacts === 1, 12); sample('b2-early-impact');
  __sr.frames(30); sample('b2-expanded-impact'); __sr.bot(true);
  for (const time of [23.5, 29.5]) {
    until(() => __sr.finaleState().elapsed >= time, 10); sample('wave-' + time);
  }
  const final = __sr.finaleState(), u = __sr.units(), show = __sr.planeShow();
  check(final.events.length === 4 && u.mg.shots > 0 && u.katyusha.shots > 0 && __sr.steam().bursts > 0 &&
    __sr.ramInfo().uses > 0 && show.stats.b52.impacts > 0 && samples.some(s => s.fireSources.includes('f4')),
    'Natural maxed fight did not exercise all equipped systems');
  check(show.stats.b2.launched === 1 && show.stats.b2.dropped === 1 && show.stats.b2.impacts === 1 &&
    JSON.stringify({nodes: __sr.save().nodes, hangar: __sr.save().hangar}) === ownedBefore,
    'Gift repeated or changed saved ownership/loadout');
  const worst = samples.reduce((a, b) => b.bench > a.bench ? b : a);
  return {fixture: 'Actual maxed leg12, natural route and gate waves; B52/F4 equipped by real Hangar drags; actual E once',
    seed: 0x844, holdAt, lateProbe, samples, worst: {label: worst.label, bench: worst.bench, cost: worst.cost,
      land: worst.land, late: worst.late, live: worst.live, fx: worst.fx}, finale: final, late: __sr.late()};
});
check(result.worst.bench < 8, 'Maxed natural finale exceeds8ms: ' + JSON.stringify(result));
QA_DONE({levels, baseline, result});
