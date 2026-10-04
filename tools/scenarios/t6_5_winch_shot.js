// shot mode: exact real ground-survivor winch setup also exercised by t6_5_rescue.js.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function startRescue(n = 4, reset = true, replay = false) {
  __sr.hold(false); __sr.pause(false); if (reset) __sr.reset(); __sr.thermal(0);
  for (const key of ['p_auto', 't_attack', 'p_golden', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  const h = __sr.G.helis[0]; h.cd = h.look = 1000000; h.order = null;
}
function rescue(id = 'rescue-4') { return __sr.loot().find(f => f.rescueId === id); }
function until(predicate, seconds = 60, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Rescue condition timed out: ' + JSON.stringify({loot: __sr.loot(), stats: __sr.lootStats(), state: __sr.legState()}));
}
function spawnRescue4() {
  startRescue(); until(() => !!rescue()); const f = rescue(), stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  check(f.kind === 'sos' && f.ground && f.eventId === 'leg-4-event-3' && f.stage === 'wait' && !f.saved && f.w === 0 &&
    __sr.lootStats().winch === true && __sr.save().surv === 0 && stored.rescueDue.includes('rescue-4'),
    'Actual leg4 rescue did not spawn unpaid with its pending receipt');
  const actual = __sr.G.loot[f.i];
  check(actual.props.length === 0 && !actual.top, 'Rescue must be a ground survivor without a bus prop');
  return f;
}
function winchShot() {
  return seeded(0x655, () => {
    startRescue(); __sr.pause(true); __sr.frames(240); __sr.pause(false);
    until(() => !!rescue()); const f = rescue(); __sr.lootGo(f.i);
    until(() => { const r = rescue(); return r.saved && r.stage === 'lift' && r.u >= 0.18; }, 5, true);
    const r = rescue(), tip = __sr.tutState();
    check(r.ground && __sr.save().rescues.includes('rescue-4') && __sr.save().surv === 1 && r.stage === 'lift' &&
      __sr.SAVE.seen.p_sos === true && tip.tip === 'HOVER OVER HIM TO WINCH HIM UP.',
      'Winch view lacks the real saved lift and its actual instruction: ' + JSON.stringify({r, tip}));
    __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
    const h = __sr.helis()[0], x = Math.min(h.sx, r.x - __sr.G.camX), y = Math.min(h.sy, r.y - __sr.G.camY);
    return {rescue: rescue(), heli: h, tip: __sr.tutState(), stats: __sr.stats(),
      crop: {x: Math.round(x - 26), y: Math.round(y - 24), w: 52, h: 66, scale: 4}};
  });
}

winchShot();
