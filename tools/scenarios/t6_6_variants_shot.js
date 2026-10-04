// shot mode: living walker/silver/explosive art comparison, also tested by t6_6_variants.js.
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

variantShot();
