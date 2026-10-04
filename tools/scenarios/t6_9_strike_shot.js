// shot mode: exact natural finale setup, also rendered in t6_9_finale.js run mode.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const previous = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = previous; }
}
// Battle ownership fixture only; travel, gate clocks, waves, strikes and rewards remain production paths.
const FINALE_BUILD = {armor: 6, hdmg: 4, hrate: 3, hrange: 2, magnet: 2, rockets: 2,
  rocketPods: 1, podDamage: 2, podReload: 2, podSalvo: 1, napalm: 1,
  hellfire: 1, hellfireDamage: 2, hellfireReload: 1, hellfireBlast: 1,
  a10: 1, a10Damage: 3, a10Cooldown: 3, a10Lines: 2, a10Charge: 1,
  f4: 1, fireDamage: 2, f4Cooldown: 2, fireLength: 2,
  b52: 1, b52Bombs: 2, b52Cooldown: 2, b52Blast: 1,
  mgCar: 1, mgDamage: 3, mgRate: 3, mgRange: 1, mgTurrets: 1, apRounds: 1,
  katyusha: 1, katyushaRockets: 2, katyushaReload: 1, katyushaBlast: 1,
  ram: 1, ramPower: 2, ramCooldown: 2, ramDuration: 1,
  steamVent: 1, steamDamage: 2, steamSpeed: 2, steamReach: 1, hotCloud: 1};
const ePlane = () => __sr.planes().find(p => p.key === 'e');
const savedAir = () => JSON.stringify({nodes: __sr.save().nodes, hangar: __sr.save().hangar});
let finaleBefore = null;
function until(predicate, seconds = 180, draw = false) {
  for (let i = 0; i < seconds * 60 && !predicate(); i++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Finale condition timed out: ' + JSON.stringify({finale: __sr.finaleState(), planes: __sr.planes(),
    leg: __sr.legState(), mode: __sr.mode, tutorial: __sr.tutState()}));
}
function startFinale(reset = true, replay = false) {
  __sr.hold(false); __sr.pause(false); if (reset) __sr.reset(); __sr.thermal(0);
  if (reset) {
    for (const [id, level] of Object.entries(FINALE_BUILD)) check(__sr.node(id, level), 'Missing finale node: ' + id);
    __sr.setLeg(12); // Route fixture grants no currency or rescue rewards.
  }
  for (const key of ['p_auto', 'p_brute', 'p_pile', 'p_golden', 'p_sos', 'p_boom', 't_attack',
    'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  const prior = __sr.save(); finaleBefore = {leg: prior.leg, surv: prior.surv, rescues: prior.rescues.slice()};
  __sr.leg(12, replay); __sr.hp(9999); __sr.bot(true); __sr.rightUp(4, 70);
  __sr.planes(); // Normalize the two genuine Q/W slots before the ownership baseline.
  __sr.pause(true); __sr.frames(300); __sr.pause(false);
  check(!ePlane() && __sr.save().hangar.length === 2, 'B-2 appeared before the finale gift or changed production slot count');
  return {savedAir: savedAir(), ordinary: __sr.planes().map(p => ({id: p.id, key: p.key, slot: p.slot}))};
}
function reachHold() {
  until(() => __sr.finaleState()?.phase === 'hold');
  const f = __sr.finaleState();
  check(f.gateClosed && Math.abs(f.trainS - f.stopS) < 0.01 && f.trainSpeed === 0 && !__sr.G.result &&
    __sr.save().leg === finaleBefore.leg && __sr.save().surv === finaleBefore.surv &&
    JSON.stringify(__sr.save().rescues) === JSON.stringify(finaleBefore.rescues),
    'Natural closed gate did not park the train without early rewards: ' + JSON.stringify(f));
  return f;
}
function reachGift() {
  until(() => __sr.finaleState()?.gifted, 31); __sr.bot(false);
  const f = __sr.finaleState(), p = ePlane();
  check(f.phase === 'hold' && Math.abs(f.giftAt - f.holdAt - 15) < 0.04 && p?.id === 'b2' && p.slot === 2 &&
    p.gift && !p.used && p.ready && p.charges === 1 && p.cd === 0 && p.strikes === 0,
    'Peak did not grant the actual ready one-use E B-2: ' + JSON.stringify({f, p}));
  return {finale: f, plane: p};
}
function useGift() {
  const before = savedAir(), ordinary = __sr.planes().filter(p => p.key !== 'e').map(p => ({id: p.id, key: p.key, charges: p.charges, strikes: p.strikes}));
  __sr.press('e'); check(__sr.planeAim().active && __sr.planeAim().id === 'b2', 'Real E did not arm the gifted B-2');
  __sr.press('e'); const p = ePlane(), show = __sr.planeShow(), slot = __sr.planeBand().slots.find(s => s.key === 'e');
  check(p?.used && p.charges === 0 && !p.ready && p.strikes === 1 && p.cd === 0 && slot?.status === 'fullGame' &&
    show.stats.b2.launched === 1 && show.jets.some(j => j.id === 'b2'), 'Real E double-tap did not launch/consume one B-2 and show FULL GAME');
  check(savedAir() === before && JSON.stringify(__sr.planes().filter(p => p.key !== 'e').map(p =>
    ({id: p.id, key: p.key, charges: p.charges, strikes: p.strikes}))) === JSON.stringify(ordinary),
    'Gift consumption changed saved ownership/loadout or consumed Q/W');
  __sr.press('e'); __sr.press('e'); check(__sr.planeShow().stats.b2.launched === 1, 'Spent E launched another gift');
  until(() => __sr.planeShow().stats.b2.impacts === 1, 12);
  const impact = __sr.planeShow().stats.b2;
  check(impact.dropped === 1 && impact.impacts === 1 && impact.lastImpact.radius === 65, 'Gift did not execute one real B-2 bomb/impact');
  return {plane: p, slot, impact};
}
function finishGate(initial, ownership) {
  let minS = initial.trainS, maxS = initial.trainS; const edges = new Set();
  while (__sr.finaleState().phase === 'hold') {
    const f = __sr.finaleState(); minS = Math.min(minS, f.trainS); maxS = Math.max(maxS, f.trainS);
    check(!__sr.G.result && __sr.save().leg === finaleBefore.leg && __sr.save().surv === finaleBefore.surv &&
      JSON.stringify(__sr.save().rescues) === JSON.stringify(finaleBefore.rescues),
      'Hold paid arrival/camp rewards before opening');
    for (const z of __sr.G.zombies) if (z.streamEventId?.startsWith('leg-12-finale-')) edges.add(z.streamEdge);
    __sr.sim(1 / 60);
    check(__sr.G.run - initial.holdAt <= 32, 'Gate never opened');
  }
  const opened = __sr.finaleState();
  check(Math.abs(opened.openAt - initial.holdAt - 30) < 0.04 && maxS - minS < 0.01 && !opened.gateClosed,
    'Gate did not hold the actual train for30s: ' + JSON.stringify({initial, opened, minS, maxS}));
  check(JSON.stringify(opened.events.map(e => e.id)) === JSON.stringify([0, 1, 2, 3].map(i => 'leg-12-finale-' + i)) &&
    opened.events.every((e, i) => Math.abs(e.t - initial.holdAt - [0, 8, 15, 23][i]) < 0.04) &&
    [-1, 1, 0, 2].every(edge => edges.has(edge)), 'Actual finale waves did not fire once from all four edges');
  until(() => __sr.G.result === 'won', 8);
  const arrived = __sr.finaleState(), save = __sr.save();
  check(arrived.arrivedAt >= arrived.openAt && save.leg === 13 && save.legs[12].won && save.surv === 3 &&
    ['rescue-4', 'rescue-8', 'rescue-10'].every(id => save.rescues.includes(id)), 'Actual Terminus roll-in did not advance/claim missing camp rescues');
  check(savedAir() === ownership.savedAir && JSON.stringify(__sr.planes().filter(p => p.key !== 'e').map(p =>
    ({id: p.id, key: p.key, slot: p.slot}))) === JSON.stringify(ownership.ordinary), 'Finale polluted saved plane ownership/ordinary slot assignments');
  check(!ePlane().ready && ePlane().charges === 0 && ePlane().strikes === 1, 'Gift refilled before run completion');
  return {holdSeconds: opened.openAt - initial.holdAt, stoppedSpan: maxS - minS, edges: [...edges], opened, arrived};
}
function openEndCard() {
  until(() => __sr.mode === 'summary', 6); __sr.frames(240); __sr.press('Enter'); __sr.frames(90);
  const state = __sr.tutState(), card = state.endCard;
  check(state.card && card?.title === 'THANKS FOR PLAYING!' && card.buttonLabel === 'TO THE DEPOT' && card.button?.w > 0,
    'Won finale did not show its actual THANKS FOR PLAYING card: ' + JSON.stringify(state));
  return card;
}
function finaleShot(kind) {
  return seeded(0x699, () => {
    const ownership = startFinale(), held = reachHold(), gift = reachGift();
    let strike = null, gate = null, card = null;
    if (kind === 'hold') {
      until(() => __sr.finaleState().elapsed >= 17, 5);
      check(ePlane().ready && !__sr.finaleState().giftUsed, 'Hold shot consumed the gift');
    } else {
      strike = useGift();
      if (kind === 'strike') {
        __sr.frames(30); check(__sr.b2Fx().cores.length && __sr.b2Fx().rings.length,
          'Strike shot missed the expanded real B-2 fireball/rings');
      } else { gate = finishGate(held, ownership); card = openEndCard(); }
    }
    if (kind !== 'card') __sr.hp(__sr.stats().max);
    __sr.hold(true); __sr.frames(1);
    if (kind === 'hold') check(__sr.SAVE.seen.p_b2 &&
      __sr.tutState().tip === 'A B-2 JOINS YOU, ONCE! PRESS E TWICE TO STRIKE.', 'Hold shot lacks the real B-2 gift instruction');
    return {kind, held, gift, strike, gate, card, finale: __sr.finaleState(), planes: __sr.planes(),
      live: __sr.G.zombies.filter(z => !z.dead && !z.gone).length, tip: __sr.tutState(), fx: __sr.fx(), stats: __sr.stats()};
  });
}

finaleShot('strike');
