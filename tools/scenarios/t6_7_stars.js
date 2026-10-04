// run mode: actual golden/arrival stars, exact health thresholds, persistence, replays and star views.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function startStars(n = 3, reset = true, replay = false, armor = 0) {
  __sr.hold(false); __sr.pause(false); if (reset) __sr.reset(); __sr.thermal(0);
  check(__sr.node('armor', armor) === true, 'Armor threshold setup failed');
  for (const key of ['p_auto', 't_attack', 'p_golden', 'p_sos', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70); silenceGun();
}
function silenceGun() { const h = __sr.G.helis[0]; h.cd = h.look = 1000000; h.order = null; }
function until(predicate, seconds = 60, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Star condition timed out: ' + JSON.stringify({star: __sr.starState(), gold: __sr.goldState(), leg: __sr.legState()}));
}
function catchPrimary(draw = false) {
  until(() => __sr.goldState().events.some(e => e.itemId === 'golden-primary'), 25, draw);
  const z = __sr.G.zombies.find(z => z.goldItemId === 'golden-primary' && !z.dead && !z.gone);
  check(z, 'Actual primary golden zombie is missing');
  const before = {gold: __sr.save().gold, stars: __sr.starState().gold}, h = __sr.G.helis[0];
  h.cd = h.look = 0; __sr.order(0, 'attack', z);
  until(() => __sr.goldState().events.find(e => e.itemId === 'golden-primary')?.caughtAt != null, 12, draw);
  silenceGun(); const receipt = __sr.goldState().events.find(e => e.itemId === 'golden-primary');
  check(z.dead && receipt.escapedAt == null, 'Star3 catch was not an actual Viper kill'); return {...receipt, before};
}
function winNow() { __sr.win(); until(() => __sr.G.result === 'won', 2); }
function starShot(kind = 'hud') {
  return seeded(0x677, () => {
    startStars(); __sr.setLeg(3); // Route setup only: earlier wins grant no rewards.
    __sr.pause(true); __sr.frames(360); __sr.pause(false);
    const caught = catchPrimary(true);
    check(caught.gold === 1 && caught.starGold === 3 && JSON.stringify(__sr.starState().stars) === '[false,false,true]',
      'Star view lacks the real golden-catch receipt');
    if (kind === 'map') {
      __sr.lose(); __sr.sim(6); __sr.frames(180);
      check(__sr.mode === 'summary' && JSON.stringify(__sr.G.sum.stars) === '[false,false,true]', 'Loss summary omitted the actual caught star');
      __sr.press('Enter'); __sr.frames(240); __sr.hover(4, 70);
      check(__sr.mode === 'depot', 'Loss did not return to the Depot');
      const route = __sr.depotRoute(), leg = route.legs.find(l => l.n === 3);
      check(!leg.won && leg.starsVisible && JSON.stringify(leg.stars) === '[false,false,true]',
        'Unwon leg3 caught star is hidden on the actual Depot map');
      __sr.hold(true); __sr.frames(1);
      return {kind, caught, route, saved: __sr.save(),
        crop: {x: leg.x - 28, y: 30, w: 56, h: 34, scale: 4}};
    }
    __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
    const state = __sr.starState(), s = state.layout;
    check(s.visible && s.stars.length === 3 && s.stars[2].earned && s.stars[2].pop > 0 &&
      !s.stars[0].earned && !s.stars[1].earned && state.atlas,
      'HUD earned-star pop or cached icons are missing');
    return {kind, caught, star: state, stats: __sr.stats(), crop: {x: s.x - 4, y: s.y - 4, w: s.w + 8, h: s.h + 8, scale: 4}};
  });
}

const fullWithChest = seeded(0x673, () => {
  startStars(2); winNow(); check(__sr.save().chest === 1 && __sr.save().gold === 0, 'Leg2 chest fixture failed');
  startStars(3, false); const caught = catchPrimary();
  check(caught.gold === 1 && caught.starGold === 3 && __sr.starState().gold === 3 && __sr.save().gold === 10,
    'Primary catch failed1gold+3star gold+6locked chest');
  winNow(); const state = __sr.starState(), save = __sr.save();
  check(JSON.stringify(state.stars) === '[true,true,true]' && state.gold === 9 && save.gold === 16 && save.chest === 2 &&
    ['star-1', 'star-2', 'star-3'].every(id => save.legs[3].paid[id]), 'Actual arrival failed all three stars/9star gold/16total gold');
  __sr.sim(6); __sr.frames(120);
  check(__sr.mode === 'summary' && JSON.stringify(__sr.G.sum.stars) === '[true,true,true]', 'Won summary omitted earned stars');
  return {caught, state, totalGold: save.gold, summaryStars: __sr.G.sum.stars.slice()};
});
const lossRetry = seeded(0x674, () => {
  startStars(); const caught = catchPrimary(); __sr.lose();
  check(__sr.save().gold === 4 && JSON.stringify(__sr.save().legs[3].stars) === '[false,false,true]', 'Loss erased the immediate caught star/gold');
  check(__sr.load() === true, 'Caught star failed exact save roundtrip'); __sr.title(); __sr.frames(30);
  startStars(3, false); const prior = __sr.starState();
  check(!__sr.G.replay && prior.stars[2] && prior.layout.stars.every(s => s.pop === 0), 'Retry lost a star or repeated its earned pop');
  const retry = catchPrimary(); check(retry.gold === 0 && retry.starGold === 0 && retry.scrap === 10 && __sr.save().gold === 4,
    'Retry repaid a caught star or golden item');
  winNow(); check(__sr.save().gold === 10 && __sr.starState().gold === 9, 'Retry arrival failed to earn only the two missing stars');
  startStars(3, false, true); const replayCatch = catchPrimary(); winNow();
  check(replayCatch.gold === 0 && replayCatch.starGold === 0 && __sr.save().gold === 10 &&
    __sr.starState().gold === 9 && JSON.stringify(__sr.starState().stars) === '[true,true,true]', 'Completed replay duplicated stars/gold');
  return {caught, persistedAfterLoss: true, prior, retry, replayCatch, starGold: 9, totalWithoutChest: 10};
});
function threshold(fraction, armor, shown) {
  return seeded(0x675, () => {
    startStars(3, true, false, armor); const g = __sr.G, maximum = g.tr.max;
    // Controlled threshold only: clear live enemies while actual braking/arrival evaluates real HP.
    __sr.win(); g.zombies.length = 0; g.spawnCd = 1000000; g.eventIndex = __sr.line().legs[2].events.length;
    __sr.hp(maximum * fraction); g.tr.hpShown = maximum * shown;
    const hp = g.tr.hp, hpShown = g.tr.hpShown; until(() => g.result === 'won', 2);
    const state = __sr.starState(), expected = fraction >= 0.75 ? [true, true, false] : [true, false, false];
    check(JSON.stringify(state.stars) === JSON.stringify(expected) && state.gold === (fraction >= 0.75 ? 6 : 3),
      'Arrival star used rounded/displayed health or wrong max: ' + JSON.stringify({hp, hpShown, maximum, state}));
    return {hp, hpShown, maximum, fraction, state};
  });
}
const thresholds = [threshold(0.75, 0, 0.2), threshold(0.75 - 0.0001, 0, 1), threshold(0.75, 6, 0.2), threshold(0.75 - 0.0001, 6, 1)];
const missingReplay = seeded(0x676, () => {
  startStars(); __sr.win(); __sr.G.zombies.length = 0; __sr.hp(__sr.G.tr.max * 0.74);
  until(() => __sr.G.result === 'won', 2); check(JSON.stringify(__sr.starState().stars) === '[true,false,false]', 'Missing-star replay fixture is invalid');
  const gold = __sr.save().gold; startStars(3, false, true); const caught = catchPrimary(); winNow();
  check(caught.gold === 0 && caught.starGold === 0 && __sr.save().gold === gold &&
    JSON.stringify(__sr.starState().stars) === '[true,false,false]', 'Replay earned a previously missed health/golden star');
  return {caught, savedGold: gold, stars: __sr.starState().stars};
});
const early = [];
for (const n of [1, 2]) {
  startStars(n); check(!__sr.starState().layout.visible, 'Early leg displayed HUD stars'); winNow();
  const state = __sr.starState(); check(state.gold === 0 && !state.stars.some(Boolean), 'Early arrival granted gold stars');
  early.push({leg: n, state, savedGold: __sr.save().gold});
}
const shots = [];
for (const kind of ['hud', 'map']) {
  shots.push(starShot(kind)); __sr.frames(30); check(__sr.late() <= 1, 'Held star view added late atlas pages');
}
const performance = seeded(0x677, () => {
  startStars(); __sr.G.helis[0].cd = __sr.G.helis[0].look = 0; __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), star: __sr.starState(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1, 'Standard20s star battle exceeded frame/atlas limits');
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), star: __sr.starState()};
  check(result.lateProbe.late <= 1, 'Natural30s star battle added late atlas pages'); return result;
});
QA_DONE({fullWithChest, lossRetry, thresholds, missingReplay, early, shots, exactShotsRendered30Frames: true, performance,
  baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
