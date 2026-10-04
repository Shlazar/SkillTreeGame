// shot mode: natural leg5 wall timing, real Ram breaks, isolated weapon damage and wall views.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function wall() { return __sr.wallState()[0]; }
function freshWall(nodes = {hdmg: 2, hrate: 2}, quiet = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const [id, level] of Object.entries(nodes)) check(__sr.node(id, level) === true, 'Wall setup node failed: ' + id);
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(quiet ? 1 : 5); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (quiet) {
    const g = __sr.G, h = g.helis[0];
    g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
    g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[0].events.length;
    h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
    __sr.hp(80);
  }
}
function until(predicate, seconds = 80, draw = false) {
  for (let frame = 0; frame < seconds * 60 && !predicate(); frame++) {
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
  check(predicate(), 'Wall condition timed out: ' + JSON.stringify({wall: wall(), state: __sr.legState(), stats: __sr.stats()}));
}
function naturalStop() {
  freshWall(); until(() => wall()?.stoppedAt != null);
  const w = wall();
  check(w.leg === 5 && w.eventId === 'leg-5-event-3' && w.spawnT >= 27 - 1e-6 && !w.broken &&
    Math.abs(__sr.G.tr.s - w.stopS) < 0.01 && __sr.G.tr.v === 0,
    'Natural leg5 wall did not stop the train in front of its live shared HP: ' + JSON.stringify(w));
  return w;
}
function wallShot(stage) {
  return seeded(0x633, () => {
    freshWall();
    // Let the start notice expire on the real UI clock without changing the natural ride.
    __sr.pause(true); __sr.frames(240); __sr.pause(false);
    if (stage === 'ahead') until(() => {
      const w = wall(); return w && !w.broken && w.stoppedAt == null && w.sy >= 85 && w.sy < __sr.stats().VH - 40;
    });
    else {
      until(() => wall()?.stoppedAt != null);
      if (stage === 'mid') until(() => wall() && !wall().broken && __sr.G.run - wall().stoppedAt >= 3);
      else {
        until(() => !!wall()?.broken); const brokenAt = wall().brokenAt;
        until(() => __sr.G.run - brokenAt >= 0.22, 2, true);
      }
    }
    const w = wall();
    check(stage === 'break' ? w.broken && w.hp === 0 && __sr.fx().parts > 0 : w.hp > 0 && w.hp <= w.max,
      'Wall view lacks actual HP/damage or the real break effect: ' + stage);
    if (stage === 'mid') check(w.hp < w.max && w.stoppedAt != null, 'Mid-wall view is not an actual stopped fight');
    __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(120);
    return {stage, wall: wall(), fx: __sr.fx(), stats: __sr.stats(),
      crop: {x: Math.round(w.sx - 42), y: Math.round(w.sy - 30), w: 84, h: 70, scale: 4}};
  });
}


wallShot('mid');

