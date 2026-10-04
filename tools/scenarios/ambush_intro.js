// Run mode: normal-health leg 1 clears three finite ambushes through real defensive input and arrives naturally.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const random = Math.random;
  Math.random = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = random; }
}
function defend(g, view) {
  const h = g.helis[0], visible = g.zombies.filter(z => !z.dead && !z.gone &&
    z.x - g.camX >= 0 && z.x - g.camX < view.W &&
    z.y - z.S.h * 0.5 - g.camY >= 19 && z.y - z.S.h * 0.5 - g.camY < view.VH);
  const distance = z => Math.hypot(z.x - h.x, (z.y - h.y) / 0.72);
  visible.sort((a, b) => (a.st === 2 ? -1000 : 0) + distance(a) - (b.st === 2 ? -1000 : 0) - distance(b));
  const z = visible[0];
  if (!z || h.order?.kind === 'attack' && h.order.z === z) return false;
  const x = z.x - g.camX, y = z.y - z.S.h * 0.5 - g.camY;
  __sr.rightDown(x, y); __sr.rightUp(x, y);
  return true;
}
function pausedState(g) {
  const a = __sr.ambushState();
  return JSON.stringify({run: g.run, hp: g.tr.hp, trainS: g.tr.s, speed: g.tr.v,
    phase: a.phase, index: a.index, pending: a.pending, killed: a.killed,
    stops: a.stops.map(s => ({...s, live: s.live.map(z => ({x: z.x, y: z.y, hp: z.hp, type: z.type, st: z.st}))}))});
}
const result = seeded(0xA8B01, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.leg(1, false); __sr.bot(false);
  const g = __sr.G, view = __sr.stats(), initial = __sr.ambushState();
  check(initial?.total === 3 && initial.phase === 'travel' && initial.index === 0, 'Fresh finite intro missing');
  check(g.tr.hp === 80 && g.tr.max === 80, 'Intro did not start at ordinary full health');
  check(initial.stops.map(s => s.count).join(',') === '16,24,32', 'Intro wave sizes changed');
  check(initial.stops.every((s, i) => s.id === 'leg-1-ambush-' + (i + 1) &&
    Math.abs(initial.startS - s.stopS - [60, 160, 260][i]) < 0.01), 'Stop spacing/IDs changed');
  check(Math.abs(initial.startS - initial.goalS - 360) < 0.01, 'Short intro route length changed');
  const started = new Set(), cleared = new Set(), health = [], piles = new Set();
  let pauseChecked = false, commands = 0, nextCommand = 0;
  for (let i = 0; i < 1200 && !g.result; i++) {
    if (g.run >= nextCommand) { commands += Number(defend(g, view)); nextCommand = g.run + 0.5; }
    __sr.sim(0.1);
    const a = __sr.ambushState();
    for (const z of g.zombies) check(z.type === 0 && !z.gold && !z.silver && !z.boom &&
      /^leg-1-ambush-[123]$/.test(z.ambushId), 'Unassigned or advanced enemy entered intro');
    for (const s of a.stops) {
      if (s.startedAt != null && !started.has(s.id)) {
        started.add(s.id); health.push({id: s.id, event: 'started', t: g.run, hp: g.tr.hp});
      }
      if (s.clearedAt != null && !cleared.has(s.id)) {
        check(s.spawned === s.count && s.killed === s.count && s.remaining === 0 && s.live.length === 0 &&
          !g.zombies.some(z => z.ambushId === s.id && !z.dead), 'Wave cleared with missing/live attackers: ' + JSON.stringify(s));
        cleared.add(s.id); health.push({id: s.id, event: 'cleared', t: g.run, hp: g.tr.hp});
      }
    }
    if (a.phase === 'hold') {
      const s = a.stops[a.index];
      check(a.remaining > 0 && Math.abs(a.trainS - s.stopS) < 0.01 && a.trainSpeed === 0,
        'Train moved before finite wave cleared: ' + JSON.stringify(a));
      if (!pauseChecked) {
        __sr.pause(true); const before = pausedState(g); __sr.frames(120);
        check(pausedState(g) === before, 'Paused ambush advanced its timer, attackers, train or health');
        __sr.pause(false); pauseChecked = true;
      }
    }
    for (const f of __sr.loot()) if (f.eventId === 'leg-1-ambush-2-pile') {
      check(f.kind === 'pile' && f.pay === 24, 'Second-hold pile changed'); piles.add(f.eventId);
    }
    check(g.events.every(e => ['ambush', 'ambushClear', 'pile'].includes(e.kind)), 'Legacy timed encounter ran alongside intro');
  }
  const final = __sr.ambushState();
  check(g.result === 'won' && g.tr.hp > 0, 'Normal-health intro stalled/lost: ' + JSON.stringify({final, hp: g.tr.hp, t: g.run, result: g.result}));
  check(started.size === 3 && cleared.size === 3 && pauseChecked && piles.size === 1 &&
    final.phase === 'done' && final.index === 3 && final.spawned === 72 && final.killed === 72 &&
    final.remaining === 0 && final.pending === 0, 'Finite intro did not finish all three real waves');
  check(!g.zombies.some(z => z.ambushId && !z.dead), 'Living intro attackers remain after arrival');
  check(__sr.save().leg === 2 && __sr.save().surv === 1, 'Natural Millbrook arrival failed ordinary station progression');
  const out = {seed: 0xA8B01, normalHealth: {start: 80, end: g.tr.hp, max: g.tr.max},
    duration: g.run, result: g.result, commands, pauseChecked, health, final, station: __sr.legState(), income: __sr.incomeState()};
  __sr.sim(4); check(__sr.save().leg === 2 && __sr.save().surv === 1, 'Ending paid/advanced the intro twice');
  return out;
});
const otherLegs = [];
for (let n = 2; n <= 12; n++) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.leg(n, false); __sr.sim(0.1);
  check(__sr.ambushState() === null && !__sr.G.ambush && !__sr.G.zombies.some(z => z.ambushId), 'Ambush prototype leaked into leg ' + n);
  otherLegs.push(n);
}
__sr.title(); __sr.frames(1); check(__sr.ambushState() === null, 'Attract demo started finite intro waves');
QA_DONE({intro: result, otherLegsWithoutAmbushes: otherLegs, noForcedHealthKillsArrivals: true});
