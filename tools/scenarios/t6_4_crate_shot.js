// shot mode: production golden chases, immediate receipts/stars/chest, Hunt cap and real crate pickups.
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


goldShot('crate');

