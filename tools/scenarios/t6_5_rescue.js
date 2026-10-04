// run mode: real continuous-hover rescues, immediate persistence, carry/replay rules and final camp.
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

const declared = __sr.line().legs.flatMap(leg => leg.events.filter(e => e[1] === 'rescue').map(e => e[2].id));
check(JSON.stringify(declared) === JSON.stringify(['rescue-4', 'rescue-8', 'rescue-10']), 'Route must declare exactly three stable field rescue IDs');
const immediate = seeded(0x654, () => {
  const f = spawnRescue4(); __sr.lootGo(f.i); __sr.sim(1.9);
  check(__sr.save().surv === 0 && !rescue().saved && rescue().w >= 1.89, 'Rescue paid before two seconds of hover');
  __sr.sim(0.6); const paid = rescue(), save = __sr.save(), stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  check(paid.saved && ['rope', 'lift'].includes(paid.stage) && save.surv === 1 && save.rescues.includes('rescue-4') &&
    !save.rescueDue.includes('rescue-4') && stored.surv === 1 && stored.rescues.includes('rescue-4'),
    'Rescue did not bank at two-second hover before the cosmetic lift finished');
  __sr.lose(); check(__sr.save().surv === 1 && __sr.save().rescues.includes('rescue-4'), 'Loss erased the rescued survivor');
  check(__sr.load() === true, 'Rescue save failed exact bootloader roundtrip'); __sr.title(); __sr.frames(30);
  check(__sr.save().surv === 1 && __sr.save().rescues.includes('rescue-4') && !__sr.save().rescueDue.length,
    'Reload erased the saved rescue or requeued it');
  startRescue(4, false); __sr.sim(30); check(!rescue() && __sr.save().surv === 1, 'A claimed rescue appeared/paid on retry');
  return {spawn: f, paid, persistedImmediately: true, keptAfterLossAndReload: true, saved: __sr.save()};
});

const partial = seeded(0x654, () => {
  const f = spawnRescue4(); __sr.lootGo(f.i); __sr.sim(1.25);
  const first = rescue(); check(first.w >= 1.24 && !first.saved, 'Partial hover was not recorded');
  __sr.order(0, 'move', f.x + 80, f.y); until(() => rescue().w === 0, 2);
  check(!rescue().saved && __sr.save().surv === 0, 'Leaving a partial hover paid instead of resetting');
  __sr.lootGo(f.i); __sr.sim(1.25); const second = rescue();
  check(!second.saved && __sr.save().surv === 0 && second.w >= 1.24 && second.w < 1.27,
    'Separate hover visits accumulated toward a rescue');
  __sr.sim(0.8); check(rescue().saved && __sr.save().surv === 1, 'A fresh complete hover did not rescue');
  return {first, second, paid: rescue()};
});

const realFlight = seeded(0x654, () => {
  const f = spawnRescue4(), h = __sr.G.helis[0], start = {x: h.x, y: h.y};
  __sr.order(0, 'move', f.x, f.y); until(() => !!rescue()?.saved, 10);
  check(Math.hypot(h.x - start.x, h.y - start.y) > 10 && __sr.save().surv === 1 && rescue().w >= 2 - 1e-6,
    'Real movement/proximity hover did not lift the survivor');
  return {start, finish: {x: h.x, y: h.y}, rescued: rescue(), saved: __sr.save().rescues};
});

const carry = seeded(0x654, () => {
  const f = spawnRescue4(); __sr.lose(); check(__sr.save().rescueDue.includes('rescue-4'), 'Missed rescue was not queued across a loss');
  check(__sr.load() === true, 'Pending rescue was not persisted'); __sr.title(); __sr.frames(30);
  check(__sr.G.demo && !__sr.loot().some(f => f.rescueId) && __sr.save().rescueDue.includes('rescue-4'), 'Demo consumed a pending rescue');
  startRescue(5, false); __sr.sim(1 / 60); const carried = rescue();
  check(carried && carried.carried && !carried.saved && __sr.loot().filter(f => f.rescueId === 'rescue-4').length === 1,
    'Missed rescue did not appear exactly once in the next non-replay leg');
  __sr.sim(0.5); check(__sr.loot().filter(f => f.rescueId === 'rescue-4').length === 1 && __sr.save().surv === 0,
    'Pending carry duplicated or auto-awarded');
  __sr.lootGo(carried.i); __sr.sim(2.5); check(__sr.save().surv === 1 && __sr.save().rescues.includes('rescue-4') &&
    !__sr.save().rescueDue.includes('rescue-4'), 'Carried rescue was not awarded/removed from due exactly once');
  startRescue(5, false); __sr.sim(1 / 60); check(!rescue() && __sr.save().surv === 1, 'Claimed carry spawned again');
  return {missed: f, carried, claimedOnce: true};
});

const replay = seeded(0x654, () => {
  spawnRescue4(); __sr.win(); until(() => __sr.G.result === 'won', 2);
  const before = JSON.stringify({surv: __sr.save().surv, rescues: __sr.save().rescues, due: __sr.save().rescueDue});
  check(__sr.save().legs[4].won && __sr.save().rescueDue.includes('rescue-4'), 'Missed-won rescue replay fixture is invalid');
  startRescue(4, false, true); __sr.sim(30);
  check(!__sr.loot().some(f => f.rescueId) && JSON.stringify({surv: __sr.save().surv, rescues: __sr.save().rescues,
    due: __sr.save().rescueDue}) === before, 'Won-leg replay spawned/consumed/paid a pending rescue');
  startRescue(5, false); __sr.sim(1 / 60); const f = rescue(); check(f?.carried, 'Replay lost the next real-leg carry');
  __sr.lootGo(f.i); __sr.sim(2.5); const paid = __sr.save().surv;
  startRescue(4, false, true); __sr.sim(30); check(!rescue() && __sr.save().surv === paid, 'Replay paid an already rescued person');
  return {pendingUntouched: true, paid, claimed: __sr.save().rescues};
});

const finalCamp = seeded(0x65C, () => {
  startRescue(12); __sr.sim(1);
  check(__sr.save().surv === 0 && !__sr.save().rescues.length, 'Final camp awarded missing rescues before arrival');
  __sr.win(); until(() => __sr.G.result === 'won', 2);
  const ids = ['rescue-4', 'rescue-8', 'rescue-10'];
  check(__sr.save().surv === 3 && ids.every(id => __sr.save().rescues.includes(id)) && !__sr.save().rescueDue.length,
    'Actual Terminus arrival did not claim all three missing demo rescues');
  __sr.sim(6); startRescue(12, false, true); __sr.win(); until(() => __sr.G.result === 'won', 2);
  check(__sr.save().surv === 3 && __sr.save().rescues.length === 3, 'Terminus replay duplicated camp rescues');
  spawnRescue4(); __sr.lootGo(rescue().i); __sr.sim(2.5);
  startRescue(12, false); __sr.sim(1); check(__sr.save().surv === 1, 'Partly claimed camp paid early');
  __sr.win(); until(() => __sr.G.result === 'won', 2);
  check(__sr.save().surv === 3 && __sr.save().rescues.length === 3, 'Camp duplicated the field rescue instead of claiming only the missing two');
  return {allMissing: 3, alreadyClaimed: 1, remainingClaimed: 2, replayPaysNone: true, saved: __sr.save()};
});
const shot = winchShot(); __sr.frames(30); check(__sr.late() <= 1, 'Held winch view added late atlas pages');
const performance = seeded(0x655, () => {
  startRescue(); __sr.G.helis[0].cd = __sr.G.helis[0].look = 0; __sr.bot(true); __sr.sim(20); __sr.frames(30);
  const result = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
  check(result.bench < 8 && result.late <= 1, 'Standard20s rescue-leg performance failed');
  __sr.sim(10); __sr.frames(30); result.lateProbe = {late: __sr.late(), loot: __sr.loot(), stats: __sr.stats()};
  check(result.lateProbe.late <= 1, 'Natural30s rescue leg added late atlas pages'); return result;
});
QA_DONE({declared, immediate, partial, realFlight, carry, replay, finalCamp, shot, exactShotRendered30Frames: true, performance,
  baseline: {task: 'T0.1', bench: 3.27, render: 2.97, late: 1}});
