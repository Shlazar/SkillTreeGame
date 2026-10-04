// run mode: twelve declared timelines, real normal-type introductions and visible brute-led escorts.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function freshLeg(n, replay = false, bot = true, hunts = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  if (hunts) for (const id of ['goldHunt', 'silverHunt', 'boomHunt']) check(__sr.node(id, 3) === true, 'Max Hunt setup failed: ' + id);
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(bot); __sr.rightUp(4, 70);
}
function onScreen(z, g, view) {
  return !z.dead && !z.gone && z.x >= g.camX && z.x < g.camX + view.W &&
    z.y >= g.camY && z.y < g.camY + view.VH;
}
function trainDistance(z, g) {
  return Math.min(...g.tr.cars.map(c => Math.hypot(z.x - c.cx, (z.y - c.cy) / 0.72)));
}
function escortApproach(prior) {
  const g = __sr.G, id = 'leg-10-event-0', released = new Set(), releases = [];
  const members = () => g.zombies.filter(z => z.streamEventId === id);
  const start = prior.startDistance;
  let closest = prior.closestLeaderDistance, followed = prior.followed, threat = null;
  __sr.hold(false); __sr.hp(9999);
  for (let frame = 0; frame < 1200 && !threat; frame++) {
    __sr.sim(1 / 60);
    for (const z of members()) {
      if (z.streamLead && !z.dead && !z.gone) closest = Math.min(closest, trainDistance(z, g));
      if (!z.streamLead) {
        followed ||= !!z.escort;
        if (z.escortReleased && !released.has(z)) {
          released.add(z); releases.push({index: z.streamIndex, at: z.escortReleaseAt, reason: z.escortReleaseReason});
        }
        if (z.escortReleased && !z.dead && !z.gone && (z.st === 2 || trainDistance(z, g) < 40))
          threat = {index: z.streamIndex, at: g.run, state: z.st, distance: trainDistance(z, g), reason: z.escortReleaseReason};
      }
    }
  }
  check(followed && Number.isFinite(start) && closest < start - 10 && releases.length > 0 && threat,
    'Natural escort failed to follow, approach, release and threaten the train: ' + JSON.stringify({start, closest, followed,
      releases, threat, state: __sr.legState(), pack: members().map(z => ({index: z.streamIndex, lead: !!z.streamLead,
        x: z.x - g.camX, y: z.y - g.camY, dead: !!z.dead, gone: !!z.gone, following: !!z.escort,
        released: !!z.escortReleased, reason: z.escortReleaseReason, state: z.st}))}));
  check(releases.every(r => Number.isFinite(r.at) && ['nearTrain', 'leadersGone'].includes(r.reason)),
    'Escort release did not come from natural leader proximity/death');
  return {startDistance: start, closestLeaderDistance: closest, followed, releases, threat};
}
function escortShot() {
  return seeded(0x62A, () => {
    freshLeg(10, false, false); const g = __sr.G, view = __sr.stats(), id = 'leg-10-event-0';
    __sr.sim(3);
    let snapshot = null;
    const startDistance = Math.min(...g.zombies.filter(z => z.streamEventId === id && z.streamLead && !z.dead && !z.gone).map(z => trainDistance(z, g)));
    let closestLeaderDistance = startDistance, followed = false;
    for (let frame = 0; frame < 480 && !snapshot; frame++) {
      __sr.frames(1);
      const pack = g.zombies.filter(z => z.streamEventId === id && onScreen(z, g, view) && z.y - g.camY >= 35);
      const leaders = pack.filter(z => z.streamLead), followers = pack.filter(z => !z.streamLead);
      for (const z of g.zombies) if (z.streamEventId === id) {
        if (z.streamLead && !z.dead && !z.gone) closestLeaderDistance = Math.min(closestLeaderDistance, trainDistance(z, g));
        if (!z.streamLead) followed ||= !!z.escort;
      }
      if (leaders.length >= 1 && followers.length >= 2 &&
          Math.min(...leaders.map(z => z.y)) > Math.max(...followers.map(z => z.y))) {
        snapshot = {time: g.run, startDistance, closestLeaderDistance, followed, leaders: leaders.map(z => ({type: z.type, x: z.x - g.camX, y: z.y - g.camY})),
          followers: followers.map(z => ({type: z.type, x: z.x - g.camX, y: z.y - g.camY}))};
      }
    }
    check(snapshot && snapshot.leaders.every(z => z.type === 2) && snapshot.followers.every(z => z.type === 1),
      'Actual leg10 escort never showed its first natural visible brute-led runner formation: ' + JSON.stringify({
        state: __sr.legState(), pack: g.zombies.filter(z => z.streamEventId === id).map(z => ({
          index: z.streamIndex, lead: !!z.streamLead, type: z.type, x: z.x - g.camX, y: z.y - g.camY,
          dead: !!z.dead, gone: !!z.gone, state: z.st, hp: z.hp}))}));
    __sr.hp(view.max); __sr.hold(true); __sr.frames(1);
    const points = [...snapshot.leaders, ...snapshot.followers], x = Math.min(...points.map(z => z.x)), y = Math.min(...points.map(z => z.y));
    return {formation: snapshot, state: __sr.legState(), stats: __sr.stats(),
      crop: {x: Math.max(0, Math.floor(x - 14)), y: Math.max(0, Math.floor(y - 18)), w: 90, h: 70, scale: 4}};
  });
}

const table = __sr.line().legs, supported = ['railCrowd', 'stream', 'wave', 'pile', 'crate'];
const pending = {T6_3: ['deadWall'], T6_4: ['golden', 'goldCrate'], T6_5: ['rescue'], T6_6: ['silverGroup', 'explosiveStream']};
check(table.length === 12 && table.every((l, i) => l.n === i + 1 && l.len === 2400), 'Route does not contain twelve full legs');
const leg1 = [[3, 'railCrowd', {n: 6}], [12, 'stream', {edge: -1, n: 12}],
  [22, 'pile', {ahead: 120, off: 100, side: 1, pay: 15}], [32, 'stream', {edge: 1, n: 14}],
  [42, 'railCrowd', {n: 8}], [52, 'wave', {n: 10}]];
check(JSON.stringify(table[0].events) === JSON.stringify(leg1), 'The exact leg1 prototype changed');
function firstKind(kind) { return table.find(l => l.events.some(e => e[1] === kind))?.n; }
check(firstKind('golden') === 3 && firstKind('rescue') === 4 && firstKind('silverGroup') === 4 &&
  firstKind('deadWall') === 5 && firstKind('goldCrate') === 6 && firstKind('explosiveStream') === 7,
  'Declared special introductions do not match the design');
check(JSON.stringify(table.filter(l => l.events.some(e => e[1] === 'goldCrate')).map(l => l.n)) === '[6,8,9,11,12]',
  'Golden-crate declarations are not exactly legs6/8/9/11/12');
check(table.find(l => l.events.some(e => e[1] === 'wave' && e[2].big))?.n === 8 &&
  table[7].events.some(e => e[0] === 51 && e[1] === 'wave' && e[2].n === 40), 'Leg8 lacks the first large two-sided wave');
check(table[8].events.filter(e => e[0] === 27).map(e => e[1]).sort().join(',') === 'deadWall,stream',
  'Leg9 wall and stream are not simultaneous');
check(table[1].events.some(e => e[1] === 'stream' && e[2].type === 1) &&
  table[5].events.some(e => e[1] === 'railCrowd' && e[2].leaders >= 1 && e[2].leadType === 2),
  'Runner/brute introduction has no guaranteed ordinary-type event');
check(table[9].events.filter(e => e[1] === 'stream').every(e => e[2].leaders > 0 && e[2].leadType === 2 && e[2].type === 1),
  'Leg10 streams are not brute-led runner escorts');
check(table[11].finale && !table.slice(0, 11).some(l => l.finale) && table.every(l => l.stars === (l.n >= 3)),
  'Finale or stars eligibility is assigned to the wrong leg');
for (const l of table) {
  check(l.base.run >= 0 && l.base.brute >= 0 && l.base.railBrute >= 0 && l.base.run + l.base.brute <= 1,
    'Invalid normal-type shares on leg' + l.n);
  check(l.n >= 2 || l.base.run === 0, 'Runner share before leg2');
  check(l.n >= 6 || l.base.brute === 0 && l.base.railBrute === 0, 'Brute share before leg6');
  l.events.forEach((e, i) => {
    check(e[0] >= 3 && e[0] <= 52, 'Event falls outside the playable timeline');
    if (i) check(e[0] >= l.events[i - 1][0] && (e[0] === l.events[i - 1][0] ||
      e[0] - l.events[i - 1][0] >= 8 && e[0] - l.events[i - 1][0] <= 12), 'Unexpected event gap on leg' + l.n);
  });
  if (l.n > 1) check(l.base.want > table[l.n - 2].base.want && l.base.size >= table[l.n - 2].base.size &&
    l.base.gap < table[l.n - 2].base.gap, 'Base difficulty does not grow on leg' + l.n);
}
check(table[10].base.want === Math.max(...table.slice(0, 11).map(l => l.base.want)), 'Leg11 is not the densest pre-finale horde');

const actual = table.map(l => seeded(0x620 + l.n, () => {
  freshLeg(l.n); const g = __sr.G, view = __sr.stats(), seen = new Set(), types = new Set();
  const flags = {gold: false, silver: false, boom: false}, streams = {}, railIntro = [], released = new Set();
  function sample() {
    for (const z of g.zombies) {
      types.add(z.type); for (const key of Object.keys(flags)) flags[key] ||= !!z[key];
      check(l.n >= 2 || z.type === 0, 'Leg1 spawned a runner or brute');
      check(l.n >= 6 || z.type !== 2, 'Brute appeared before leg6: leg' + l.n);
      check(!z.gold && !z.silver && !z.boom, 'A future special handler is active during T6.2');
      if (z.streamEventId) {
        const s = streams[z.streamEventId] || (streams[z.streamEventId] = {births: [], firstLeader: null, firstFollower: null,
          initialFormation: null, followed: false, releases: [], threatenedTrain: false});
        if (!seen.has(z)) s.births.push({index: z.streamIndex, lead: !!z.streamLead, type: z.type,
          at: z.streamAt, sx: z.x - g.camX, sy: z.y - g.camY});
        if (!z.streamLead) {
          s.followed ||= !!z.escort;
          if (z.escortReleased && !released.has(z)) {
            released.add(z); s.releases.push({index: z.streamIndex, at: z.escortReleaseAt, reason: z.escortReleaseReason});
          }
          s.threatenedTrain ||= !!z.escortReleased && !z.dead && !z.gone && (z.st === 2 || trainDistance(z, g) < 40);
        }
        if (onScreen(z, g, view)) {
          if (z.streamLead && s.firstLeader === null) s.firstLeader = g.run;
          if (!z.streamLead && s.firstFollower === null) s.firstFollower = g.run;
        }
      }
      seen.add(z);
    }
    for (const [id, s] of Object.entries(streams)) if (s.firstFollower !== null && !s.initialFormation) {
      const pack = g.zombies.filter(z => z.streamEventId === id && onScreen(z, g, view));
      const leads = pack.filter(z => z.streamLead), follows = pack.filter(z => !z.streamLead);
      if (leads.length && follows.length) s.initialFormation = {axis: 'y', leaders: leads.map(z => z.y - g.camY), followers: follows.map(z => z.y - g.camY)};
    }
  }
  sample();
  for (let frame = 0; frame < 3600; frame++) {
    const before = new Set(g.zombies), receipts = g.events.length; __sr.sim(1 / 60); sample();
    if (l.n === 6 && g.events.length > receipts && g.events.some(e => e.id === 'leg-6-event-0'))
      for (const z of g.zombies) if (!before.has(z) && z.st === 1) railIntro.push({type: z.type, at: g.run});
  }
  const state = __sr.legState(), expected = l.events.map((e, i) => ({e, i})).filter(({e}) => supported.includes(e[1]));
  check(state.eventIndex === l.events.length && state.events.length === expected.length,
    'Timeline omitted/duplicated supported events on leg' + l.n + ': ' + JSON.stringify(state));
  state.events.forEach((e, i) => {
    const spec = expected[i].e, n = spec[2].n;
    check(e.id === 'leg-' + l.n + '-event-' + expected[i].i && e.kind === spec[1] &&
      Math.abs(e.t - e.at) < 1e-6, 'Wrong actual receipt identity/timing on leg' + l.n);
    check(e.kind === 'railCrowd' ? e.n >= 0 && e.n <= n : e.kind === 'stream' ? e.n === n :
      e.kind === 'wave' ? e.n === n * 2 : e.n === 1, 'Wrong actual receipt count on leg' + l.n);
  });
  check(types.has(0) && (l.n < 2 || types.has(1)) && (l.n < 6 || types.has(2)),
    'Expected normal type never appeared on leg' + l.n + ': ' + JSON.stringify([...types]));
  if (l.n === 2) check(streams['leg-2-event-1']?.births.length > 0 && streams['leg-2-event-1'].births.every(z => z.type === 1),
    'Leg2 guaranteed runner stream did not actually emit runners');
  if (l.n === 6) check(railIntro.some(z => z.type === 2 && Math.abs(z.at - 3) < 1e-6), 'Leg6 introductory rail crowd did not create its guaranteed brute');
  const escorts = [];
  l.events.forEach((e, i) => {
    if (e[1] !== 'stream' || !e[2].leaders) return;
    const id = 'leg-' + l.n + '-event-' + i, s = streams[id], p = e[2];
    check(s && s.births.filter(z => z.lead).length === p.leaders && s.births.some(z => !z.lead), 'Escort leaders/followers were not emitted: ' + id);
    s.births.forEach(z => check(z.lead === (z.index < p.leaders) && z.type === (z.lead ? 2 : 1), 'Escort type/order mismatch: ' + id));
    const leadBirths = s.births.filter(z => z.lead), followerBirths = s.births.filter(z => !z.lead);
    check(Math.max(...leadBirths.map(z => z.at)) < Math.min(...followerBirths.map(z => z.at)), 'A follower emitted before a brute leader');
    check(Math.min(...leadBirths.map(z => z.sy)) > Math.max(...followerBirths.map(z => z.sy)),
      'Runner followers did not start behind the top-entry brute leaders');
    check(s.firstLeader !== null && s.firstFollower !== null && s.firstLeader < s.firstFollower && s.initialFormation,
      'Brutes did not visibly enter before runners: ' + JSON.stringify({id, ...s}));
    check(Math.min(...s.initialFormation.leaders) > Math.max(...s.initialFormation.followers),
      'First visible top-entry escort has runners ahead of brutes: ' + id);
    check(p.edge === 0 && s.followed && s.releases.length > 0 && s.threatenedTrain &&
      s.releases.every(r => Number.isFinite(r.at) && ['nearTrain', 'leadersGone'].includes(r.reason)),
      'Escort did not naturally follow, release and threaten the train: ' + JSON.stringify({id, ...s}));
    escorts.push({id, leaders: leadBirths.length, followers: followerBirths.length, firstLeader: s.firstLeader,
      firstFollower: s.firstFollower, formation: s.initialFormation, followed: s.followed, releases: s.releases, threatenedTrain: s.threatenedTrain});
  });
  return {leg: l.n, base: l.base, types: [...types].sort(), flags, declared: l.events.map(e => ({at: e[0], kind: e[1]})),
    state, escorts, railIntro, pendingKinds: l.events.filter(e => !supported.includes(e[1])).map(e => e[1])};
}));

const earlyReplays = [1, 2].map(n => seeded(0x62F + n, () => {
  freshLeg(n, true, true, true); const g = __sr.G;
  const protectedSave = () => JSON.stringify({leg: __sr.SAVE.leg, legs: __sr.SAVE.legs,
    gold: __sr.SAVE.gold, surv: __sr.SAVE.surv, chest: __sr.SAVE.chest, rescues: __sr.SAVE.rescues});
  const before = protectedSave();
  for (let frame = 0; frame < 3600; frame++) {
    __sr.sim(1 / 60);
    check(g.zombies.every(z => !z.gold && !z.silver && !z.boom && z.type !== 2 && (n > 1 || z.type === 0)),
      'Max Hunt upgrades leaked an advanced enemy into replay leg' + n);
  }
  check(protectedSave() === before, 'An early Hunt replay mutated progression or non-scrap rewards');
  return {leg: n, hunts: {gold: 3, silver: 3, boom: 3}, state: __sr.legState(), stats: __sr.stats()};
}));
const shot = escortShot(); __sr.frames(30); check(__sr.late() <= 1, 'Held escort view baked late atlas pages');
const approach = escortApproach(shot.formation);
// Reproduce the standalone1280x720 capture, which is640x360 logical pixels at SCALE2.
const shotViewport = (() => {
  const width = Object.getOwnPropertyDescriptor(window, 'innerWidth'), height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  const original = {W: __sr.stats().W, H: __sr.stats().H};
  try {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1280});
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 720});
    window.dispatchEvent(new Event('resize'));
    check(__sr.stats().W === 640 && __sr.stats().H === 360, 'Exact shot viewport was not640x360');
    const result = escortShot(); __sr.frames(30);
    check(__sr.late() <= 1, '640x360 held escort view baked late atlas pages');
    const approach = escortApproach(result.formation);
    return {logical: {W: 640, H: 360}, shot: result, approach, exactShotRendered30Frames: true};
  } finally {
    if (width) Object.defineProperty(window, 'innerWidth', width); else delete window.innerWidth;
    if (height) Object.defineProperty(window, 'innerHeight', height); else delete window.innerHeight;
    window.dispatchEvent(new Event('resize'));
    check(__sr.stats().W === original.W && __sr.stats().H === original.H, 'Escort viewport test failed to restore dimensions');
  }
})();
const performance = seeded(0x622, () => {
  freshLeg(1); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1 && result.stats.zombies > 0, 'Standard20s normal-camera benchmark failed: ' + JSON.stringify(result));
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), stats: __sr.stats()};
  check(result.lateProbe.late <= 1, 'Natural30s leg baked late atlas pages'); return result;
});
QA_DONE({table, actual, earlyReplays, shot, approach, shotViewport, exactShotRendered30Frames: true, pendingHandlers: pending,
  pendingNote: 'Declared special introductions are checked here; actual wall/gold/rescue/silver/explosive behavior awaits T6.3–T6.6.',
  performance, baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
