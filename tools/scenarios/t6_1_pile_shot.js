// shot mode: production leg1 event clock, retries/replay/demo isolation and real timed-pile pickup.
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


pileShot();
