// run mode: real seeded first-leg rides must be identical with sound on, muted, then on again.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const previous = Math.random; let calls = 0;
  Math.random = () => { calls++; let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return {ride: run(), randomCalls: calls}; } finally { Math.random = previous; }
}
function ride(muted) {
  // Resetting from a real run builds an attract demo; an already open title reuses it.
  // Begin the gameplay seed at the real START, after that unrelated menu transition.
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  if (__sr.sound().muted !== muted) __sr.press('m');
  return seeded(0x681, () => {
    __sr.press('Enter'); __sr.hp(9999); __sr.bot(true);
    check(__sr.sound().ctx && __sr.sound().muted === muted, 'Real audio context/mute setting was not applied');
    for (let i = 0; i < 1800 && !__sr.G.result; i++) {
      const g = __sr.G, h = g.helis[0];
      const f = g.loot.filter(f => !f.gone).sort((a, b) =>
        Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (f) {
        if (h.order?.kind !== 'move' || h.order.x !== f.x || h.order.y !== f.y) __sr.order(0, 'move', f.x, f.y);
      } else if (h.order) __sr.order(0, 'escort');
      __sr.sim(0.1);
    }
    check(__sr.G.result === 'won', 'Natural audio comparison did not arrive');
    __sr.sim(4);
    check(__sr.mode === 'summary', 'Natural audio comparison did not bank its summary');
    const g = __sr.G, h = g.helis[0], s = __sr.save();
    return {income: __sr.incomeState(), kills: g.kills, shots: g.shots, hits: g.hits, run: g.run,
      train: {s: g.tr.s, v: g.tr.v, hp: g.tr.hp}, heli: {x: h.x, y: h.y, vx: h.vx, vy: h.vy, cd: h.cd},
      events: __sr.legState().events, loot: __sr.loot().map(f => ({kind: f.kind, eventId: f.eventId, gone: f.gone, pay: f.pay})),
      remaining: g.zombies.filter(z => !z.dead && !z.gone).map(z => ({x: z.x, y: z.y, hp: z.hp, st: z.st, type: z.type})),
      wallet: {scrap: s.scrap, surv: s.surv, gold: s.gold}, savedLeg: s.leg};
  });
}
const beforeMuted = __sr.sound().muted;
let trials;
try {
  trials = [ride(false), ride(true), ride(false)];
  const baseline = JSON.stringify(trials[0]);
  check(trials.every(t => JSON.stringify(t) === baseline), 'Audio timing/mute changed the seeded gameplay: ' +
    JSON.stringify(trials.map(t => ({randomCalls: t.randomCalls, income: t.ride.income, kills: t.ride.kills, shots: t.ride.shots, duration: t.ride.run}))));
} finally { if (__sr.sound().muted !== beforeMuted) __sr.press('m'); }
QA_DONE({identical: true, settings: ['sound', 'muted', 'sound'], trials: trials.map(t => ({randomCalls: t.randomCalls,
  income: t.ride.income, kills: t.ride.kills, shots: t.ride.shots, duration: t.ride.run, wallet: t.ride.wallet}))});
