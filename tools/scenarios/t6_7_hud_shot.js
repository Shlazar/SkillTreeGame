// shot mode: real earned stars, also tested by t6_7_stars.js.
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

starShot('hud');
