// Real-input, normal-health intro comparison. All enemy counts and clocks come from the live encounter diagnostics.
const VARIETY_SEEDS = [0xA8B01, 0xA8B02, 0xA8B03], VARIETY_LIMIT = 110;
const VARIETY_SAMPLE = 0.1, VARIETY_COMMAND_GAP = 0.6, VARIETY_STEP = 1 / 60;
function check(ok, why) { if (!ok) throw new Error(why); }
const rounded = n => Number.isFinite(n) ? +n.toFixed(3) : null;
function seeded(seed, run) {
  const random = Math.random;
  Math.random = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = random; }
}
function focus(g, view) {
  const h = g.helis[0], distance = z => Math.hypot(z.x - h.x, (z.y - h.y) / 0.72);
  const candidates = g.zombies.filter(z => !z.dead && !z.gone &&
    z.x - g.camX >= 0 && z.x - g.camX < view.W &&
    z.y - z.S.h * 0.5 - g.camY >= 19 && z.y - z.S.h * 0.5 - g.camY < view.VH);
  // Focus climbers first; among equally urgent threats, keep the closest firing opportunity.
  candidates.sort((a, b) => (a.st === 2 ? -1000 : 0) + distance(a) -
                           (b.st === 2 ? -1000 : 0) - distance(b));
  const z = candidates[0];
  if (!z || h.order?.kind === 'attack' && h.order.z === z) return null;
  __sr.rightDown(z.x - g.camX, z.y - z.S.h * 0.5 - g.camY);
  __sr.rightUp(z.x - g.camX, z.y - z.S.h * 0.5 - g.camY);
  return {t: rounded(g.run), wave: g.ambush.index + 1, type: z.type,
    climber: z.st === 2, accepted: h.order?.kind === 'attack'};
}
function ride(seed, active) {
  return seeded(seed, () => {
    __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
    __sr.leg(1, false); __sr.bot(false); __sr.rightUp(4, 70);
    const g = __sr.G, view = __sr.stats(), initial = __sr.ambushState();
    check(g.tr.hp === 80 && g.tr.max === 80 && g.helis.length === 1,
      'Comparison must start with ordinary80HP and one Viper');
    check(!g.up.rocketChance && !g.up.mgCar && !g.up.katyusha && !g.up.ram &&
      !g.up.steamVent && !g.up.planeOwned.length, 'Intro received an unearned combat unit');
    check(initial?.total === 3 && initial.stops[0].groups.every(q => q.type === 0) &&
      initial.stops[1].groups.some(q => q.type === 1) &&
      initial.stops[2].groups.filter(q => q.type === 2).reduce((n, q) => n + q.n, 0) === 1,
      'Intro must teach walkers, then runners, then exactly one brute');
    const expected = initial.stops.reduce((n, s) => n + s.count, 0);
    const waves = initial.stops.map(s => ({id: s.id, name: s.name, count: s.count,
      start: null, clear: null, hpStart: null, hpEnd: null, types: new Set(),
      births: new Set(), lateAt: null, lateRemaining: null, lateSeconds: null,
      pendingSamples: 0, notYetSentSamples: 0, groups: null}));
    const commands = [];
    let firstShot = null, nextCommand = 0, minHp = 80, pendingSamples = 0;
    function sample() {
      const a = __sr.ambushState();
      minHp = Math.min(minHp, g.tr.hp);
      if (firstShot === null && g.shots > 0) firstShot = g.run;
      for (const z of g.zombies) {
        check(z.ambushId && !z.gold && !z.silver && !z.boom && z.type >= 0 && z.type <= 2,
          'Unscripted/advanced variant entered the intro');
        check(!z.gone || z.dead, 'Live tagged attacker was discarded');
        const index = Number(z.ambushId.slice(-1)) - 1, w = waves[index];
        check(w && z.type === initial.stops[index].groups[z.ambushGroup]?.type,
          'Actual birth type did not match its configured group');
        w.types.add(z.type); w.births.add(z);
      }
      for (const s of a.stops) {
        const w = waves[s.index];
        check(s.live.every(z => !z.gone), 'A live removed attacker could block the finite clear');
        if (s.startedAt === null) continue;
        if (w.start === null) { w.start = s.startedAt; w.hpStart = g.tr.hp; }
        const elapsed = g.run - s.startedAt;
        for (const q of s.groups) {
          if (q.sentAt !== null) {
            check(q.sentAt + 1e-7 >= s.startedAt + q.at &&
              q.sentAt <= s.startedAt + q.at + VARIETY_STEP + 1e-6,
              'Group was sent outside its configured clock: ' + s.id + '/' + q.index);
          } else if (elapsed + 1e-7 < q.at) {
            check(q.spawned === 0 && q.firstAt === null, 'Future group was born before its clock');
            w.notYetSentSamples++;
            check(s.clearedAt === null && a.phase === 'hold' && a.index === s.index,
              'A delayed unspawned group failed to keep the train stopped');
          }
          if (q.firstAt !== null) {
            check(q.sentAt !== null && q.firstAt + 1e-7 >= q.sentAt,
              'Birth occurred before its group dispatch');
            if (q.type > 0) check(q.warnedAt !== null && q.firstAt - q.warnedAt >= 2.45,
              'Special group had less than2.45s warning before actual birth');
          }
        }
        if (s.clearedAt === null && a.index === s.index && a.phase === 'hold') {
          const pending = s.count - s.spawned;
          check(a.remaining === s.remaining && a.remaining >= pending &&
            Math.abs(g.tr.s - s.stopS) < 0.01 && g.tr.v === 0,
            'Train moved or omitted pending attackers from its hold counter');
          if (pending > 0) { pendingSamples++; w.pendingSamples++; }
          if (pending === 0 && s.remaining > 0 && s.remaining <= 3 && w.lateAt === null) {
            w.lateAt = g.run; w.lateRemaining = s.remaining;
          }
        }
        if (s.clearedAt !== null && w.clear === null) {
          check(s.spawned === s.count && s.killed === s.count && s.remaining === 0 &&
            s.live.length === 0 && s.groups.every(q => q.spawned === q.n),
            'Encounter cleared with pending or living assigned attackers');
          w.clear = s.clearedAt; w.hpEnd = g.tr.hp;
          w.lateSeconds = w.lateAt === null ? null : s.clearedAt - w.lateAt;
          w.groups = s.groups.map(q => ({index: q.index, type: q.type, count: q.n, at: q.at,
            sent: rounded(q.sentAt - s.startedAt), first: rounded(q.firstAt - s.startedAt),
            warningLead: q.type > 0 ? rounded(q.firstAt - q.warnedAt) : null, spawned: q.spawned}));
        }
      }
    }
    sample();
    for (let i = 0; i < VARIETY_LIMIT / VARIETY_SAMPLE && !g.result; i++) {
      if (active && g.run + 1e-7 >= nextCommand) {
        const command = focus(g, view); if (command) commands.push(command);
        nextCommand = g.run + VARIETY_COMMAND_GAP;
      }
      __sr.sim(VARIETY_SAMPLE); sample();
    }
    const final = __sr.ambushState();
    if (active) {
      check(g.result === 'won' && g.tr.hp > 0,
        'Active normal-health intro failed: ' + JSON.stringify({seed, t: g.run, hp: g.tr.hp,
          phase: final.phase, wave: final.index + 1, remaining: final.remaining}));
      check(final.phase === 'done' && final.spawned === expected && final.killed === expected &&
        final.pending === 0 && final.remaining === 0 && waves.every(w => w.clear !== null),
        'Active ride did not actually defeat every configured attacker');
      check(waves[0].types.size === 1 && waves[0].types.has(0) && waves[1].types.has(1) &&
        waves[2].types.has(2),
        'Required variety did not appear in actual births');
      check(waves[2].births.size && [...waves[2].births].filter(z => z.type === 2).length === 1,
        'Third encounter did not produce exactly one actual brute');
      check(pendingSamples > 0 && waves.every(w => w.pendingSamples > 0),
        'Finite pending-group holds were not exercised');
      check(__sr.save().leg === 2 && __sr.save().surv === 1 && __sr.save().gold === 0,
        'Natural intro completion changed station/progression/introduction rewards');
    }
    const waveRows = waves.map(w => ({id: w.id, name: w.name, count: w.count,
      startedAt: rounded(w.start), clearedAt: rounded(w.clear),
      holdSeconds: w.clear === null ? null : rounded(w.clear - w.start),
      hpStart: rounded(w.hpStart), hpEnd: rounded(w.hpEnd), types: [...w.types].sort(),
      actualObservedBirths: w.births.size, pendingSamples: w.pendingSamples,
      notYetSentSamples: w.notYetSentSamples, lastThreeAt: rounded(w.lateAt),
      lastThreeRemaining: w.lateRemaining, lastThreeCleanupSeconds: rounded(w.lateSeconds), groups: w.groups}));
    return {seed, control: active ? 'real_focus_every_0.6s' : 'passive', result: g.result || 'unfinished',
      duration: rounded(g.run), hp: rounded(g.tr.hp), minHp: rounded(minHp), maxHp: g.tr.max,
      firstShot: rounded(firstShot), shots: g.shots, kills: g.kills, expectedAttackers: expected,
      killed: final.killed, remaining: final.remaining, pending: final.pending,
      commands: commands.length, acceptedCommands: commands.filter(c => c.accepted).length,
      commandTypes: [...new Set(commands.map(c => c.type))].sort(), waves: waveRows,
      income: __sr.incomeState()};
  });
}
const comparison = VARIETY_SEEDS.map(seed => {
  const active = ride(seed, true), passive = ride(seed, false);
  return {seed, active, passive, healthDifference: rounded(active.hp - passive.hp),
    durationDifference: rounded(active.duration - passive.duration)};
});
// The early brute exception belongs exclusively to the three scripted intro groups.
const otherLegs = [];
for (let leg = 2; leg <= 5; leg++) {
  const row = seeded(0xA8C00 + leg, () => {
    __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.leg(leg, false); __sr.bot(false);
    const g = __sr.G, types = new Set();
    for (let i = 0; i < 700 && !g.result; i++) {
      __sr.sim(0.1);
      check(__sr.ambushState() === null && !g.ambush, 'Intro controller leaked into leg' + leg);
      for (const z of g.zombies) {
        check(!z.ambushId && (z.type === 0 || z.type === 1), 'Early brute exception leaked into leg' + leg);
        check((leg >= 3 || !z.gold) && (leg >= 4 || !z.silver) && !z.boom,
          'Unrelated variant introduction changed in leg' + leg);
        types.add(z.type);
      }
    }
    return {leg, seconds: rounded(g.run), result: g.result || 'unfinished', types: [...types].sort()};
  });
  otherLegs.push(row);
}
__sr.title(); __sr.frames(1);
check(__sr.ambushState() === null && !__sr.G.ambush && !__sr.G.zombies.some(z => z.ambushId),
  'Title attract battle received scripted intro encounters');
QA_DONE({comparison, otherLegs, titleWithoutAmbush: true,
  noHealthCurrencyUpgradeKillArrivalFixtures: true, limitSeconds: VARIETY_LIMIT});
