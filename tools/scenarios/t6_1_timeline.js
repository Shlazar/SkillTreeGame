// run mode: production leg1 event clock, retries/replay/demo isolation and real timed-pile pickup.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function freshTimeline(replay = false, bot = true) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.leg(1, replay); __sr.hp(9999); __sr.bot(bot); __sr.rightUp(4, 70);
  check(__sr.legState().eventIndex === 0 && __sr.legState().events.length === 0 && __sr.loot().length === 0,
    'A new leg inherited event receipts or km-rolled finds');
}
function protectedRewards() {
  const s = __sr.save();
  return JSON.stringify({leg: s.leg, surv: s.surv, gold: s.gold, chest: s.chest,
    legs: s.legs, rescues: s.rescues, hangar: s.hangar});
}
function pileShot() {
  return seeded(0x611, () => {
    freshTimeline(false, false); __sr.sim(22); __sr.frames(30);
    // The closer opening packs can be cleared at22.5s; catch the next natural attacker with the pile.
    const inView = z => !z.dead && !z.gone && z.x - __sr.G.camX >= 0 && z.x - __sr.G.camX < __sr.stats().W &&
      z.y - __sr.G.camY >= 19 && z.y - __sr.G.camY < __sr.stats().VH;
    for (let frame = 0; frame < 240 && !__sr.G.zombies.some(inView); frame++) __sr.frames(1);
    const state = __sr.legState(), pile = __sr.loot().find(f => f.eventId === 'leg-1-event-2');
    const g = __sr.G, view = __sr.stats(), visible = g.zombies.filter(z => !z.dead && !z.gone &&
      z.x - g.camX >= 0 && z.x - g.camX < view.W && z.y - g.camY >= 0 && z.y - g.camY < view.VH).length;
    check(pile && pile.kind === 'pile' && !pile.gone && state.events.length === 3 && visible > 0,
      'Timed-pile view lacks the actual find and its encounter: ' + JSON.stringify({state, pile, visible}));
    __sr.hp(view.max); __sr.hold(true); __sr.frames(1);
    return {state, pile, visible, stats: __sr.stats(), point: {x: pile.x - g.camX, y: pile.y - g.camY},
      crop: {x: Math.round(pile.x - g.camX - 24), y: Math.round(pile.y - g.camY - 28), w: 48, h: 56, scale: 4}};
  });
}

const expected = [[3, 'railCrowd', 6], [12, 'stream', 12], [22, 'pile', 1],
  [32, 'stream', 14], [42, 'railCrowd', 8], [52, 'wave', 20]];
const table = __sr.line().legs[0];
check(table.events.length === 6 && table.events.every((e, i) => e[0] === expected[i][0] && e[1] === expected[i][1]),
  'Leg1 does not have the approved3/12/22/32/42/52 timeline');
check(table.base.run === 0 && table.base.brute === 0 && table.base.railBrute === 0 && table.base.size > 0 && table.base.want > 0,
  'Leg1 base trickle has advanced zombie types or is empty');
table.events[0][2].n = 999; table.base.run = 1;
check(__sr.line().legs[0].events[0][2].n === 6 && __sr.line().legs[0].base.run === 0,
  'line() exposes mutable event params/base row');

const timeline = seeded(0x611, () => {
  freshTimeline(); const g = __sr.G, types = new Set(), boundaries = [];
  for (let frame = 1; frame <= 3600; frame++) {
    const before = __sr.legState().events.length; __sr.sim(1 / 60);
    for (const z of g.zombies) {
      types.add(z.type + ':' + !!z.gold + ':' + !!z.silver + ':' + !!z.boom);
      check(z.type === 0 && !z.gold && !z.silver && !z.boom, 'Leg1 spawned runner/brute/gold/silver/explosive');
    }
    const state = __sr.legState();
    if (state.events.length !== before) boundaries.push({frame, time: g.run, event: state.events[state.events.length - 1]});
    const due = expected.filter(e => e[0] <= g.run + 1e-8).length;
    check(state.events.length === due && state.eventIndex === due, 'Event cursor fired early/late/duplicated: ' + JSON.stringify(state));
  }
  const state = __sr.legState();
  check(state.events.length === 6 && new Set(state.events.map(e => e.id)).size === 6, 'Sixty-second leg did not fire six unique events');
  state.events.forEach((e, i) => {
    check(e.id === 'leg-1-event-' + i && e.kind === expected[i][1] && e.at === expected[i][0], 'Incorrect receipt order/identity');
    near(e.t, e.at, 'Actual event fire time');
    check(e.n >= 0 && (e.kind === 'railCrowd' ? e.n <= expected[i][2] : e.n === expected[i][2]), 'Incorrect actual event spawn receipt');
    if (i) check(e.t - state.events[i - 1].t >= 8 && e.t - state.events[i - 1].t <= 12, 'Events are not8–12seconds apart');
  });
  const copy = __sr.legState(); copy.events[0].kind = 'mutated';
  check(__sr.legState().events[0].kind === 'railCrowd', 'legState() exposes mutable receipt objects');
  check(types.size === 1 && __sr.loot().filter(f => f.kind === 'pile').length === 1 &&
    __sr.loot().every(f => f.kind === 'pile'), 'Leg1 added untimed/advanced loot or no walkers');
  __sr.sim(1); check(__sr.legState().events.length === 6, 'Finished timeline dispatched again');
  return {state, boundaries, types: [...types], loot: __sr.loot(), stats: __sr.stats()};
});

freshTimeline(false, false); __sr.sim(179 / 60); check(__sr.legState().events.length === 0, 'First event fired before3seconds');
const beforePause = JSON.stringify(__sr.legState()); __sr.pause(true); __sr.frames(180);
check(JSON.stringify(__sr.legState()) === beforePause, 'Paused real frames advanced the timeline');
__sr.pause(false); __sr.sim(1 / 60); check(__sr.legState().events.length === 1, 'Unpause failed to resume exact first event');
__sr.leg(1); __sr.hp(9999); __sr.bot(false);
check(__sr.legState().eventIndex === 0 && __sr.legState().events.length === 0 && __sr.loot().length === 0, 'Retry did not reset timeline/finds');
__sr.sim(3); check(__sr.legState().events.length === 1, 'Retry duplicated/missed its first event');
const retry = __sr.legState();

const replay = seeded(0x611, () => {
  freshTimeline(); __sr.setLeg(2);
  __sr.SAVE.legs[1].stars = [true, false, true]; __sr.SAVE.legs[1].paid['timeline-receipt-fixture'] = true;
  const protectedBefore = protectedRewards(); __sr.leg(1, true); __sr.hp(9999); __sr.bot(true); __sr.sim(60);
  const state = __sr.legState();
  check(state.replay && state.events.length === 6 && new Set(state.events.map(e => e.id)).size === 6,
    'Replay did not reset and dispatch exactly one timeline');
  check(protectedRewards() === protectedBefore, 'Replay timeline mutated progression, stars, paid rewards or non-scrap currencies');
  return {state, protectedRewardsUnchanged: true, stats: __sr.stats()};
});

const demoBefore = JSON.stringify(__sr.save()); __sr.title(); __sr.sim(60); __sr.frames(30);
check(__sr.G.demo && __sr.legState().events.length === 0 && __sr.legState().eventIndex === 0 && __sr.loot().length === 0,
  'Demo dispatched leg events or finds');
check(JSON.stringify(__sr.save()) === demoBefore, 'Demo mutated the saved rewards/progression');
const demo = {state: __sr.legState(), saveUnchanged: true, horde: __sr.horde()};

const pickup = seeded(0x611, () => {
  freshTimeline(false, false); __sr.sim(22);
  const pile = __sr.loot().find(f => f.eventId === 'leg-1-event-2'), g = __sr.G, h = g.helis[0];
  const pilePay = __sr.line().legs[0].events.find(e => e[1] === 'pile')[2].pay;
  check(pile && !pile.gone && pile.pay === pilePay && pilePay > 0, 'Timed pile is missing/already collected/incorrectly priced');
  const start = {x: h.x, y: h.y}, before = g.pay.loot;
  __sr.order(0, 'move', pile.x, pile.y);
  let sawFlight = false;
  for (let i = 0; i < 360 && g.pay.loot === before; i++) { __sr.sim(1 / 60); sawFlight ||= g.lootFly.length > 0; }
  check(__sr.loot()[pile.i].gone && g.pay.loot - before === pilePay && sawFlight &&
    Math.hypot(h.x - start.x, h.y - start.y) > 10, 'Actual heli flight/auto pickup did not collect and pay the timed pile');
  const paid = g.pay.loot; __sr.sim(0.5); check(g.pay.loot === paid, 'One timed pile paid twice');
  return {pile, start, finish: {x: h.x, y: h.y}, pay: paid - before, sawFlight, state: __sr.legState()};
});
const shot = pileShot(); __sr.frames(30); check(__sr.late() <= 1, 'Timed pile held view created late atlas pages');
const performance = seeded(0x611, () => {
  freshTimeline(); __sr.thermal(0); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), state: __sr.legState()};
  check(result.late <= 1 && result.stats.kills > 0 && result.stats.zombies > 0, 'Normal-camera standard20s encounter is empty or uncached');
  check(result.bench < 8, 'Normal-camera timeline benchmark exceeds8ms: ' + JSON.stringify(result));
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), state: __sr.legState(), stats: __sr.stats()};
  check(result.lateProbe.late <= 1, 'Natural30s timeline run added late atlas pages'); return result;
});
QA_DONE({timeline, pauseResumesExactly: true, retry, replay, demo, pickup, shot, exactShotRendered30Frames: true,
  performance, baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
