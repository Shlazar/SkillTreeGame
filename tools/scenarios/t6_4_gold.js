// run mode: production golden chases, immediate receipts/stars/chest, Hunt cap and real crate pickups.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function startGold(n = 3, reset = true, hunt = 0, replay = false) {
  __sr.hold(false); __sr.pause(false); if (reset) __sr.reset(); __sr.thermal(0);
  check(__sr.node('goldHunt', hunt) === true, 'Gold Hunt setup failed');
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70); silenceGun();
}
function silenceGun() { const h = __sr.G.helis[0]; h.cd = h.look = 1000000; h.order = null; }
function receipt(id) { return __sr.goldState().events.find(e => e.itemId === id); }
function until(predicate, seconds = 60, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Gold condition timed out: ' + JSON.stringify({gold: __sr.goldState(), state: __sr.legState(), helis: __sr.helis()}));
}
function catchGolden(id = 'golden-primary') {
  until(() => !!receipt(id));
  const g = __sr.G, z = g.zombies.find(z => z.goldItemId === id && !z.dead && !z.gone);
  check(z && z.gold && z.value === 0 && z.hp === 1, 'Actual scheduled golden runner is missing or retains ordinary scrap pay');
  const before = {gold: __sr.save().gold, scrap: g.pay.loot}, h = g.helis[0];
  h.cd = h.look = 0; __sr.order(0, 'attack', z);
  until(() => receipt(id)?.caughtAt != null, 12);
  const result = {...receipt(id), before, savedGold: __sr.save().gold, actualActorDead: !!z.dead};
  check(z.dead && result.escapedAt == null, 'Catch was not an actual weapon kill'); silenceGun();
  return result;
}
function crateEvent(n) { return __sr.line().legs[n - 1].events.find(e => e[1] === 'goldCrate'); }
function collectCrate(n) {
  const event = crateEvent(n); check(event, 'Leg has no declared golden crate: ' + n);
  until(() => __sr.loot().some(f => f.kind === 'gold'));
  const g = __sr.G, f = __sr.loot().find(f => f.kind === 'gold'), h = g.helis[0];
  check(f.rewardId === 'gold-crate' && f.pay === 5 && !f.gone, 'Golden crate has incorrect stable ID/value or was auto-collected');
  const start = {x: h.x, y: h.y}, gold = __sr.save().gold; let flying = false;
  __sr.order(0, 'move', f.x, f.y);
  for (let frame = 0; frame < 600 && !__sr.loot()[f.i].reward; frame++) { __sr.sim(1 / 60); flying ||= g.lootFly.length > 0; }
  const collected = __sr.loot()[f.i];
  check(collected.gone && collected.reward && flying && Math.hypot(h.x - start.x, h.y - start.y) > 10,
    'Real heli flight/proximity did not collect and immediately bank the golden crate: ' + JSON.stringify(collected));
  const banked = __sr.save().gold; __sr.sim(0.5);
  check(__sr.save().gold === banked && banked - gold === collected.reward.gold && __sr.loot().filter(x => x.kind === 'gold').length === 1,
    'Golden crate animation paid twice or changed its receipt'); silenceGun();
  return {leg: n, at: event[0], crate: collected, savedGoldBefore: gold, savedGoldAfter: banked, flying,
    start, finish: {x: h.x, y: h.y}};
}
function goldShot(kind = 'runner') {
  return seeded(0x644, () => {
    startGold(kind === 'runner' ? 3 : 6);
    __sr.pause(true); __sr.frames(240); __sr.pause(false);
    if (kind === 'runner') {
      until(() => !!receipt('golden-primary'));
      until(() => {
        const z = __sr.goldState().active.find(z => z.itemId === 'golden-primary'), tip = __sr.tutState();
        return z && z.sx >= 70 && z.sx < __sr.stats().W - 40 && __sr.SAVE.seen.p_golden === true &&
          tip.tip === 'CATCH THE GOLDEN ZOMBIE!';
      }, 6, true);
    } else until(() => __sr.loot().some(f => f.kind === 'gold' && !f.gone));
    if (kind === 'crate') { __sr.pause(true); __sr.frames(360); __sr.pause(false); }
    __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
    const state = __sr.goldState(), find = __sr.loot().find(f => f.kind === 'gold' && !f.gone);
    const point = kind === 'runner' ? state.active.find(z => z.itemId === 'golden-primary') :
      {sx: find.x - __sr.G.camX, sy: find.y - __sr.G.camY};
    check(point && state.art.frames > 0 && state.art.atlas, 'Gold view lacks its actual actor/find or startup art');
    return {kind, gold: state, find, tip: __sr.tutState(), stats: __sr.stats(),
      crop: {x: Math.round(point.sx - 22), y: Math.round(point.sy - 26), w: 44, h: 52, scale: 4}};
  });
}

const firstCatch = seeded(0x643, () => {
  startGold(2); __sr.win(); until(() => __sr.G.result === 'won', 2);
  check(__sr.save().chest === 1 && __sr.save().gold === 0, 'Actual leg2 arrival did not earn the locked chest');
  startGold(3, false); const caught = catchGolden();
  const save = __sr.save(), stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  check(caught.gold === 1 && caught.scrap === 0 && caught.starGold === 3 && save.gold === 10 && save.chest === 2 &&
    save.flags.goldShown && save.legs[3].stars[2] && save.legs[3].paid['golden-primary'] && save.legs[3].paid['star-3'],
    'First actual golden catch failed1gold +3star gold +6chest: ' + JSON.stringify({caught, save}));
  check(stored.gold === 10 && stored.legs[3].stars[2] && stored.legs[3].paid['golden-primary'], 'Golden reward/star was not immediately persisted');
  __sr.lose(); check(__sr.save().gold === 10 && __sr.save().legs[3].stars[2], 'Losing erased caught gold/star');
  startGold(3, false); const retry = catchGolden();
  check(retry.gold === 0 && retry.scrap === 10 && retry.starGold === 0 && __sr.save().gold === 10 && __sr.save().chest === 2,
    'Retry duplicated gold/star/chest instead of10scrap');
  return {caught, retry, savedGold: 10, chestOpenedOnce: true, persistedImmediately: true};
});

const escapeAndReplay = seeded(0x643, () => {
  startGold(3); until(() => !!receipt('golden-primary'));
  const g = __sr.G, z = g.zombies.find(z => z.goldItemId === 'golden-primary'), dir = z.goldDir, entry = z.x - g.camX;
  // Observe the actual death assignment/call path; do not change damage, movement or collisions.
  const descriptor = Object.getOwnPropertyDescriptor(z, 'dead'); let dead = z.dead, death = null;
  Object.defineProperty(z, 'dead', {configurable: true, enumerable: true, get: () => dead, set: value => {
    if (value && !dead) {
      const c = g.tr.cars[0], h = g.helis[0];
      death = {stack: new Error('Actual golden death').stack, time: g.run, actor: {x: z.x, y: z.y, hp: z.hp, state: z.st},
        train: {s: g.tr.s, v: g.tr.v, noseX: c.x0, noseY: c.y0, dx: c.dx, dy: c.dy, hp: g.tr.hp},
        weapons: {shots: g.shots, heliCd: h.cd, heliTargetGold: !!h.tgt?.gold, ramUses: __sr.ramInfo().uses,
          mg: __sr.units().mg.shots, katyusha: __sr.units().katyusha.shots, fires: __sr.fires().length}};
    }
    dead = value;
  }});
  let previous = entry, maxStepBack = 0;
  try {
    for (let frame = 0; frame < 1200 && receipt('golden-primary').escapedAt == null && receipt('golden-primary').caughtAt == null; frame++) {
      __sr.sim(1 / 60); const x = z.x - g.camX;
      if (!dead) maxStepBack = Math.max(maxStepBack, (previous - x) * dir); previous = x;
    }
  } finally {
    Object.defineProperty(z, 'dead', {...descriptor, value: dead});
  }
  const escaped = {...receipt('golden-primary')}, width = __sr.stats().W;
  check(escaped.escapedAt != null && escaped.caughtAt == null && z.gone && maxStepBack < 0.1 &&
    (dir > 0 ? previous > width : previous < 0) && (previous - entry) * dir > width && __sr.save().gold === 0 &&
    !__sr.save().legs[3]?.stars[2], 'Golden runner did not cross and escape without gold/star: ' +
      JSON.stringify({escaped, entry, exit: previous, maxStepBack, death}));
  __sr.win(); until(() => __sr.G.result === 'won', 2);
  check(__sr.save().legs[3].won && !__sr.save().legs[3].stars[2], 'Escape fixture did not win with star3 missing');
  const goldBefore = __sr.save().gold; startGold(3, false, 0, true); const replay = catchGolden();
  check(replay.gold === 0 && replay.scrap === 10 && replay.starGold === 0 && __sr.save().gold === goldBefore &&
    !__sr.save().legs[3].stars[2], 'Won-leg replay acquired a missed star/gold');
  return {escaped, dir, entry, exit: previous, maxStepBack, replay, missedStarRemainsMissing: true};
});

const hunt = seeded(0x645, () => {
  const results = [];
  for (const n of [3, 4]) {
    startGold(n, n === 3, 3); const primary = catchGolden();
    check(primary.gold === 1 && primary.starGold === 3, 'Hunt changed the primary golden reward');
    check(JSON.stringify(__sr.goldState().queue.map(q => [q.itemId, q.at])) ===
      JSON.stringify([1, 2, 3].map(i => ['golden-hunt-' + i, primary.spawnT + i * 8])), 'Hunt extras lost stable IDs/schedule');
    for (let i = 1; i <= 3; i++) {
      const caught = catchGolden('golden-hunt-' + i), capped = n === 4 && i === 3;
      check(caught.gold === (capped ? 0 : 1) && caught.scrap === (capped ? 10 : 0) && caught.starGold === 0,
        'Extra Hunt reward/cap is incorrect: ' + JSON.stringify(caught)); results.push({leg: n, ...caught});
    }
  }
  check(__sr.goldState().huntGoldPaid === 5 && __sr.save().gold === 13, 'Demo-wide extra Hunt cap is not exactly5');
  startGold(3, false, 3); const primary = catchGolden(), retries = [];
  check(primary.gold === 0 && primary.scrap === 10 && primary.starGold === 0, 'Hunt retry changed the primary receipt');
  for (let i = 1; i <= 3; i++) {
    const caught = catchGolden('golden-hunt-' + i);
    check(caught.gold === 0 && caught.scrap === 10 && caught.starGold === 0, 'A repeated Hunt item paid extra gold'); retries.push(caught);
  }
  check(__sr.goldState().huntGoldPaid === 5 && __sr.save().gold === 13, 'Hunt retries altered the global cap or gold');
  return {results, retries, huntGoldPaid: 5, totalGold: 13};
});

const crates = seeded(0x646, () => [6, 8, 9, 11, 12].map((n, i) => {
  startGold(n, i === 0); const first = collectCrate(n);
  check(first.crate.reward.gold === 5 && first.crate.reward.scrap === 0 && __sr.save().legs[n].paid['gold-crate'], 'First crate did not pay5gold');
  startGold(n, false); const retry = collectCrate(n);
  check(retry.crate.reward.gold === 0 && retry.crate.reward.scrap === 25, 'Golden crate retry did not pay25scrap');
  return {leg: n, first, retry};
}));
check(__sr.save().gold === 25, 'Five first golden crates did not total25gold');
const early = [1, 2].map(n => {
  startGold(n, true, 3, true);
  for (let frame = 0; frame < 3600; frame++) { __sr.sim(1 / 60);
    check(!__sr.G.zombies.some(z => z.gold) && !__sr.goldState().events.length && !__sr.goldState().queue.length,
      'Gold Hunt produced early-leg gold'); }
  return {leg: n, gold: __sr.goldState(), state: __sr.legState()};
});
const shots = ['runner', 'crate'].map(kind => { const shot = goldShot(kind); __sr.frames(30);
  check(__sr.late() <= 1, 'Held gold view baked late atlas pages'); return shot; });
const performance = seeded(0x644, () => {
  startGold(3); __sr.G.helis[0].cd = __sr.G.helis[0].look = 0; __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), gold: __sr.goldState(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1 && result.gold.art.atlas, 'Standard20s golden-leg performance failed');
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), gold: __sr.goldState(), stats: __sr.stats()};
  check(result.lateProbe.late <= 1, 'Natural30s gold play added late atlas pages'); return result;
});
QA_DONE({firstCatch, escapeAndReplay, hunt, crates, early, shots, exactShotsRendered30Frames: true, performance,
  baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
