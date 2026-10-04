// run mode: real silver/explosive introductions, spawn rolls, rewards, chains and cached variant art.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function startVariant(n = 7, hunt = 0, replay = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const id of ['silverHunt', 'boomHunt']) check(__sr.node(id, hunt) === true, 'Hunt setup failed: ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70); silenceGun();
}
function silenceGun() { const h = __sr.G.helis[0]; h.cd = h.look = 1000000; h.order = null; }
function until(predicate, seconds = 60, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Variant condition timed out: ' + JSON.stringify({variants: __sr.variantState(), state: __sr.legState()}));
}
function quietVariant() {
  const g = __sr.G; g.zombies.length = 0; g.spawnCd = 1000000;
  g.eventIndex = __sr.line().legs[g.leg - 1].events.length; silenceGun(); __sr.hp(80);
}
function addVariant(kind, x, y, type = 0) {
  const i = __sr.variantSpawn(kind, x, y, type);
  check(Number.isInteger(i) && i >= 0, 'Production variant fixture failed: ' + kind);
  const z = __sr.G.zombies[i]; z.sp = 0; z.still = true; return z;
}
function shoot(z) {
  const g = __sr.G, h = g.helis[0], before = {shots: g.shots, kills: g.kills, cash: g.cash};
  h.cd = h.look = 0; __sr.order(0, 'attack', z); until(() => z.dead, 8); silenceGun();
  check(g.shots > before.shots && z.dead, 'Viper did not kill the actual variant'); return before;
}
function variantShot() {
  return seeded(0x667, () => {
    startVariant(); quietVariant(); __sr.pause(true); __sr.frames(360); __sr.pause(false);
    const s = __sr.stats(), x = Math.round(s.W * 0.72), y = Math.round(s.VH * 0.58);
    const walker = addVariant('normal', x - 24, y), silver = addVariant('silver', x, y), boom = addVariant('boom', x + 24, y);
    __sr.sim(1 / 60); __sr.hold(true); __sr.frames(1);
    const art = __sr.variantState().art;
    check(!walker.silver && !walker.boom && silver.silver && !silver.boom && boom.boom && !boom.silver &&
      walker.S !== silver.S && walker.S !== boom.S && silver.S !== boom.S && silver.S.isSilver &&
      art.silver.frames > 0 && art.boom.frames > 0 && art.silver.atlas && art.boom.atlas,
      'Side-by-side view lacks three distinct living production sets baked at startup');
    return {variants: __sr.variantState(), actors: [walker, silver, boom].map(z => ({type: z.type, silver: !!z.silver, boom: !!z.boom,
      sx: z.x - __sr.G.camX, sy: z.y - __sr.G.camY, w: z.S.w, h: z.S.h})), stats: __sr.stats(),
      crop: {x: x - 40, y: y - 26, w: 80, h: 42, scale: 4}};
  });
}

const introductions = seeded(0x664, () => {
  startVariant(4); until(() => __sr.legState().events.some(e => e.kind === 'silverGroup'));
  const receipt = __sr.legState().events.find(e => e.kind === 'silverGroup');
  until(() => __sr.G.zombies.filter(z => z.streamEventId === receipt.id).length >= 3, 3);
  const group = __sr.G.zombies.filter(z => z.streamEventId === receipt.id);
  check(receipt.at === 43 && receipt.n === 3 && group.length === 3 && group.every(z => z.silver && !z.dead) &&
    !__sr.G.zombies.some(z => z.boom), 'Leg4 did not introduce its real three-silver group without explosives');
  until(() => __sr.SAVE.flags.silverSeen === true, 20);
  __sr.node('magnet', 1); __sr.node('salvageCrew', 1);
  check(__sr.treeShown().includes('silverHunt') && !__sr.treeShown().includes('boomHunt'), 'Seeing silver failed to reveal only its eligible Hunt');
  const silver = {receipt, variants: __sr.variantState(), flag: __sr.SAVE.flags.silverSeen};
  startVariant(7); until(() => __sr.legState().events.some(e => e.kind === 'explosiveStream'));
  const explosive = __sr.legState().events.find(e => e.kind === 'explosiveStream');
  until(() => __sr.G.zombies.filter(z => z.streamEventId === explosive.id).length >= 8, 3);
  const actors = __sr.G.zombies.filter(z => z.streamEventId === explosive.id);
  check(explosive.at === 3 && explosive.n === 8 && actors.length === 8 && actors.every(z => z.boom && !z.dead && !z.silver),
    'Leg7 explosive stream did not consist of eight visibly explosive living actors');
  until(() => __sr.SAVE.flags.boomSeen === true, 20);
  __sr.node('magnet', 1); __sr.node('salvageCrew', 1);
  check(__sr.treeShown().includes('boomHunt'), 'Seeing an explosive failed to reveal Boom Hunt');
  return {silver, explosive: {receipt: explosive, actors: actors.map(z => ({index: z.streamIndex, boom: !!z.boom, dead: z.dead})),
    variants: __sr.variantState(), flag: __sr.SAVE.flags.boomSeen}};
});

const seenTiming = seeded(0x666, () => {
  startVariant(); quietVariant(); __sr.SAVE.flags.silverSeen = __sr.SAVE.flags.boomSeen = false;
  const silver = addVariant('silver', 100, 90), boom = addVariant('boom', 140, 130);
  silver.x = __sr.G.camX - 180; boom.x = __sr.G.camX - 160;
  __sr.sim(1 / 60); check(!__sr.SAVE.flags.silverSeen && !__sr.SAVE.flags.boomSeen, 'Offscreen actors falsely marked variants seen');
  silver.x = __sr.G.camX + 100; silver.y = __sr.G.camY + 90;
  boom.x = __sr.G.camX + 140; boom.y = __sr.G.camY + 130;
  __sr.sim(1 / 60); __sr.frames(1);
  check(__sr.SAVE.flags.silverSeen && __sr.SAVE.flags.boomSeen, 'Living visible variants did not persist their seen flags');
  const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  check(stored.flags.silverSeen && stored.flags.boomSeen, 'Seen variant flags were not immediately saved'); return __sr.variantState();
});
const gates = [];
for (const n of [1, 2, 3, 4, 6]) {
  gates.push(seeded(0x661 + n, () => {
    startVariant(n, 3, true); __sr.sim(60);
    const flags = {silver: false, boom: false};
    for (const z of __sr.G.zombies) { flags.silver ||= !!z.silver; flags.boom ||= !!z.boom; }
    const state = __sr.variantState();
    check((n >= 4 || !flags.silver && state.silver === 0) && !flags.boom && state.boom === 0 && !__sr.SAVE.flags.boomSeen &&
      (n >= 4 || !__sr.SAVE.flags.silverSeen), 'Hunts/replays bypassed the variant introduction gates: ' + n);
    return {leg: n, ...flags, state: __sr.variantState()};
  }));
}
function rollSample(hunt) {
  return seeded(0x66A, () => {
    startVariant(7, hunt); quietVariant(); const state = __sr.variantState(), total = 3000;
    let silver = 0, boom = 0;
    for (let i = 0; i < total; i++) {
      const z = __sr.spawn(0, -100, -100); silver += !!z.silver; boom += !!z.boom;
      check(!(z.silver && z.boom), 'Spawn rolled two special variants for one actor');
    }
    return {hunt, total, silver, boom, silverChance: state.silverChance, boomChance: state.boomChance};
  });
}
const rolls = {base: rollSample(0), max: rollSample(3)};
check(Math.abs(rolls.base.silverChance - 0.004) < 1e-9 && Math.abs(rolls.max.silverChance - 0.013) < 1e-9 &&
  Math.abs(rolls.base.boomChance - 0.006) < 1e-9 && Math.abs(rolls.max.boomChance - 0.024) < 1e-9 &&
  rolls.max.silver > rolls.base.silver && rolls.max.boom > rolls.base.boom, 'Actual Hunt upgrade/spawn rolls did not increase both variants');

const silverPay = seeded(0x665, () => {
  startVariant(4); quietVariant(); const s = __sr.stats(), z = addVariant('silver', s.W * 0.66, s.VH * 0.6);
  check(z.value === 15 && z.silver && !z.boom, 'Silver actor does not carry its base15scrap value');
  const before = shoot(z); check(__sr.G.cash - before.cash === 15 && __sr.G.kills - before.kills === 1 && __sr.G.tr.hp === 80,
    'Actual Viper silver kill did not pay exactly15scrap safely'); return {scrap: __sr.G.cash - before.cash, shots: __sr.G.shots - before.shots};
});
const chain = seeded(0x66B, () => {
  startVariant(); quietVariant(); const s = __sr.stats(), x = s.W * 0.7, y = s.VH * 0.58;
  const explosive = addVariant('boom', x, y), walkers = [[10, 0], [-10, 0], [0, 8], [0, -8]].map(([dx, dy]) => addVariant('normal', x + dx, y + dy));
  const outside = addVariant('normal', x + 38, y), beforeState = __sr.variantState(), before = shoot(explosive);
  until(() => walkers.every(z => z.dead), 2);
  const after = __sr.variantState();
  check(walkers.filter(z => z.dead).length >= 3 && !outside.dead && after.blasts > beforeState.blasts &&
    after.kills - beforeState.kills >= 3 && __sr.G.tr.hp === 80, 'Real explosive death failed the bounded train-safe chain: ' + JSON.stringify({beforeState, after}));
  return {insideDead: walkers.filter(z => z.dead).length, outsideAlive: !outside.dead, viperShots: __sr.G.shots - before.shots,
    trainHP: __sr.G.tr.hp, before: beforeState, after};
});
const shot = variantShot(); __sr.frames(30); check(__sr.late() <= 1, 'Variant view caused late atlas growth');
const performance = seeded(0x666, () => {
  startVariant(7, 3); __sr.G.helis[0].cd = __sr.G.helis[0].look = 0; __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), variants: __sr.variantState(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1, 'Standard20s variant battle exceeded frame/atlas limits');
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), variants: __sr.variantState()};
  check(result.lateProbe.late <= 1, 'Natural30s variant battle added late atlas pages'); return result;
});
QA_DONE({introductions, seenTiming, gates, rolls, silverPay, chain, shot, exactShotRendered30Frames: true, performance,
  baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
