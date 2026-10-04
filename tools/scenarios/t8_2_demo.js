// run mode: natural menu battles show rockets, MG and plane passes without saved rewards or cues.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, fn) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = before; }
}
const result = seeded(0x822, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  // These owned planes reveal the actual Hangar surface; the demo's weapons remain its own snapshot.
  for (const id of ['a10', 'f4', 'b52']) check(__sr.node(id, 1), 'Missing Hangar fixture node: ' + id);
  __sr.SAVE.seen.p_hangar = true;
  __sr.depot('hangar'); // Initialize the real saved slots before measuring passive demo changes.
  __sr.title();
  const saved = JSON.stringify(__sr.save()), audio = __sr.audioState();
  check(__sr.G.demo && __sr.units().rockets.enabled && __sr.units().mg.enabled,
    'Attract snapshot lacks its rockets or MG Car');
  const surfaces = [];
  for (const surface of ['title', 'hangar']) {
    if (surface === 'hangar') __sr.depot('hangar');
    let planeSamples = 0;
    const before = { rockets: __sr.rockets().rockets, mg: __sr.units().mg.shots };
    for (let i = 0; i < 120; i++) {
      __sr.sim(0.5);
      if (__sr.planeShow().jets.length) planeSamples++;
    }
    __sr.hold(true); __sr.frames(1); __sr.hold(false);
    const rockets = __sr.rockets(), units = __sr.units(), tips = __sr.tutState();
    check(rockets.rockets > before.rockets && units.mg.shots > before.mg && planeSamples > 0,
      surface + ' did not show all three natural attract weapons');
    check(JSON.stringify(__sr.save()) === saved && !tips.tip && !tips.pendingKeys.length,
      surface + ' attract battle changed saved rewards or queued lessons');
    check(__sr.G.cash === 0 && __sr.G.surv === 0 && __sr.G.gold === 0 && __sr.planeShow().roars === 0,
      surface + ' attract battle paid money or requested a plane roar');
    surfaces.push({ surface, seconds: 60, rockets: rockets.rockets - before.rockets,
      mgShots: units.mg.shots - before.mg, planeSamples, units: { heli: units.heli, rockets: units.rockets,
        mg: { enabled: units.mg.enabled, count: units.mg.count } } });
  }
  // The opaque tree retains its intentional world pause.
  __sr.depot('tree'); const time = __sr.G.t; __sr.frames(10);
  check(__sr.G.t === time, 'Opaque tree advanced the hidden demo');
  const after = __sr.audioState();
  for (const [name, cue] of Object.entries(after.cues)) check(cue.requests === (audio.cues[name]?.requests || 0),
    'Attract battle requested a gameplay sound: ' + name);
  return { surfaces, saveUnchanged: true, noGameplayCues: true, treeFrozen: true, audio: after };
});
QA_DONE(result);
