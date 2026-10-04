// run mode: actual maxed combat and reward/rescue hooks schedule bounded procedural sounds.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const previous = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = previous; }
}
function bounded(state) {
  check(state.initialized && !state.muted && Number.isFinite(state.scheduledSources), 'Actual enabled AudioContext diagnostics missing');
  for (const [name, c] of Object.entries(state.cues)) check(Number.isInteger(c.requests) && Number.isInteger(c.played) &&
    c.played >= 0 && c.requests >= c.played, 'Invalid actual cue counters: ' + name);
  for (const [name, v] of Object.entries(state.activeVoices)) check(v.active >= 0 && v.active <= v.max && v.max > 0,
    'Sound exceeded its real overlap limit: ' + name + ' ' + JSON.stringify(v));
}
function delta(before, after) {
  return Object.fromEntries(Object.entries(after.cues).map(([name, c]) => [name, {
    requests: c.requests - (before.cues[name]?.requests || 0), played: c.played - (before.cues[name]?.played || 0)}]));
}
function until(predicate, seconds) {
  for (let i = 0; i < seconds * 60 && !predicate(); i++) __sr.sim(1 / 60);
  check(predicate(), 'Audio feature fixture timed out: ' + JSON.stringify({leg: __sr.legState(), audio: __sr.audioState()}));
}
const battle = seeded(0x811, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const node of __sr.treeNodes().filter(n => n.k !== 'tease' && n.max > 0)) check(__sr.node(node.id, node.max), 'Missing maxed node: ' + node.id);
  __sr.depot('hangar'); __sr.hold(true); __sr.frames(1);
  check(__sr.hangarDrag('b52', 0) && __sr.hangarDrag('f4', 1), 'Real B52/F4 audio loadout failed');
  __sr.hold(false); __sr.leg(12); __sr.hp(9999); __sr.bot(true);
  if (__sr.sound().muted) __sr.press('m');
  const before = __sr.audioState(), samples = [];
  for (let n = 1; n <= 6; n++) {
    __sr.sim(10); const state = __sr.audioState(); bounded(state);
    samples.push({seconds: n * 10, run: __sr.G.run, result: __sr.G.result, state});
  }
  check(__sr.G.run >= 60 - 1e-8 && __sr.G.kills > 0 && __sr.units().mg.shots > 0 &&
    __sr.units().katyusha.shots > 0 && __sr.steam().bursts > 0 && __sr.ramInfo().uses > 0,
    'Sixty-second maxed leg did not exercise actual combat systems');
  // Keep the real route/gate; if its peak comes later, finish that short approach for the B2 cue.
  if (__sr.planeShow().stats.b2.impacts === 0) {
    until(() => __sr.finaleState().gifted, 120);
    const gift = __sr.planes().find(p => p.key === 'e');
    if (gift.ready) { __sr.bot(false); __sr.press('e'); __sr.press('e'); }
    until(() => __sr.planeShow().stats.b2.impacts === 1, 12);
  }
  const after = __sr.audioState(); bounded(after); const cues = delta(before, after);
  for (const name of ['mgCar', 'rocket', 'planeRoar', 'hiss', 'ramGo', 'ramShock', 'f4Ignite', 'b2Boom'])
    check(cues[name]?.requests > 0 && cues[name].played > 0, 'Actual maxed battle did not schedule new cue: ' + name + ' ' + JSON.stringify(cues[name]));
  check(__sr.planeShow().stats.b2.impacts === 1 && cues.b2Boom.requests === 1,
    'One real B2 impact requested its heavy cue more than once');
  return {before, after, cues, samples, stats: __sr.stats(), planes: __sr.planes(), finale: __sr.finaleState()};
});
const rescue = seeded(0x814, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.leg(4); __sr.hp(9999); __sr.bot(false);
  if (__sr.sound().muted) __sr.press('m'); const before = __sr.audioState();
  until(() => __sr.loot().some(f => f.rescueId === 'rescue-4'), 30);
  const f = __sr.loot().find(f => f.rescueId === 'rescue-4'); __sr.lootGo(f.i);
  __sr.sim(4.5); check(__sr.save().rescues.includes('rescue-4'), 'Actual rescue did not complete');
  const after = __sr.audioState(); bounded(after); return {before, after, cues: delta(before, after), rescue: __sr.loot().find(x => x.rescueId === 'rescue-4')};
});
const silver = seeded(0x817, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.leg(4); __sr.hp(9999); __sr.bot(false);
  if (__sr.sound().muted) __sr.press('m'); const before = __sr.audioState();
  // Controlled actor only; conversion, fatal hit, payout and reward sound are production paths.
  const s = __sr.stats(), i = __sr.variantSpawn('silver', s.W * 0.7, s.VH * 0.6);
  check(i >= 0, 'Production silver converter failed'); __sr.hit(__sr.G.zombies[i], 100, 'mg');
  const after = __sr.audioState(); bounded(after); const cues = delta(before, after);
  check(cues.silver?.requests === 1 && cues.silver.played === 1 && __sr.G.cash === 15, 'Actual silver reward did not schedule one chime');
  return {cues, after, cash: __sr.G.cash};
});
QA_DONE({battle, rescue, silver, boundedAudioVoices: true, audioErrorsCheckedByRunner: true});
