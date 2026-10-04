// run mode: a finale gift reserves E and its band even when no ordinary planes are owned.
function check(ok, why) { if (!ok) throw new Error(why); }
const ownership = () => JSON.stringify({nodes: __sr.save().nodes, hangar: __sr.save().hangar});
function until(predicate, seconds) {
  for (let i = 0; i < seconds * 60 && !predicate(); i++) __sr.sim(1 / 60);
  check(predicate(), 'Bare gift condition timed out: ' + JSON.stringify({finale: __sr.finaleState(), planes: __sr.planes(), stats: __sr.stats()}));
}
function startBare(reset = false) {
  __sr.hold(false); __sr.pause(false);
  if (reset) { __sr.reset(); __sr.setLeg(12); }
  __sr.thermal(0); __sr.leg(12); __sr.hp(9999); __sr.bot(false);
  const s = __sr.stats();
  check(s.VH === s.H && !__sr.planeBand().visible && __sr.planes().length === 0 &&
    __sr.save().hangar.every(id => id === null), 'No-plane run reserved a band or ordinary slot before the gift');
  const before = ownership();
  // Arrival-position fixture only; the main T6.9 scenario separately rides here naturally.
  // Production braking starts the hold, whose entire clock is then stepped in real fixed seconds.
  __sr.win(); until(() => __sr.finaleState().phase === 'hold', 2);
  const hold = __sr.finaleState();
  until(() => __sr.finaleState().gifted, 16);
  const f = __sr.finaleState(), p = __sr.planes(), band = __sr.planeBand();
  check(Math.abs(f.giftAt - hold.holdAt - 15) < 0.04 && f.phase === 'hold' && p.length === 1 &&
    p[0].id === 'b2' && p[0].slot === 2 && p[0].key === 'e' && p[0].gift && p[0].charges === 1 &&
    p[0].ready && !p[0].used && p[0].strikes === 0 && band.visible && band.worldHeight === band.fullHeight - 18 &&
    band.slots.length === 1 && band.slots[0].key === 'e' && ownership() === before,
    'Bare gift failed actual E-only band/charge or changed saved ownership: ' + JSON.stringify({f, p, band}));
  return {before, hold, gift: f, plane: p[0], band};
}
const first = startBare(true);
__sr.hold(true); __sr.frames(30); check(__sr.late() <= 1, 'Held bare-gift presentation created late sprites');
__sr.hold(false); __sr.press('e');
check(__sr.planeAim().active && __sr.planeAim().id === 'b2', 'Real E did not arm the unowned gift');
__sr.press('e');
const spent = __sr.planes()[0];
check(spent.used && !spent.ready && spent.charges === 0 && spent.strikes === 1 && spent.cd === 0 &&
  __sr.planeBand().slots[0].status === 'fullGame' && __sr.planeShow().stats.b2.launched === 1,
  'Actual E double-tap did not consume the unowned B-2 once');
until(() => __sr.planeShow().stats.b2.impacts === 1, 12);
const impact = __sr.planeShow().stats.b2;
check(impact.dropped === 1 && impact.impacts === 1 && impact.lastImpact.radius === 65, 'Bare gift did not execute its actual B-2 payload');
__sr.sim(2); __sr.press('e'); __sr.press('e');
check(__sr.planes()[0].charges === 0 && __sr.planes()[0].cd === 0 && __sr.planeShow().stats.b2.launched === 1 &&
  ownership() === first.before, 'Unowned spent gift refilled, relaunched or entered the save');
__sr.lose(); __sr.sim(4);
check(__sr.mode === 'summary' && __sr.save().leg === 12 && !__sr.save().legs[12]?.won &&
  !__sr.save().rescues.length && ownership() === first.before, 'Bare gift loss advanced the finale or polluted saved ownership');
const retry = startBare();
check(!__sr.G.replay && retry.plane.charges === 1 && !retry.plane.used && retry.plane.strikes === 0 &&
  retry.before === first.before, 'Losing a bare gift did not grant a fresh unowned E on retry');
__sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(30);
check(__sr.late() <= 1, 'Held bare retry gift created late sprites');
QA_DONE({first, spent, impact, noRefill: true, noSavedOwnership: true, retry, late: __sr.late(), heldRenders: 60});
