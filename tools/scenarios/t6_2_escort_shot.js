// shot mode: twelve declared timelines, real normal-type introductions and visible brute-led escorts.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
function freshLeg(n, replay = false, bot = true, hunts = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  if (hunts) for (const id of ['goldHunt', 'silverHunt', 'boomHunt']) check(__sr.node(id, 3) === true, 'Max Hunt setup failed: ' + id);
  __sr.leg(n, replay); __sr.hp(9999); __sr.bot(bot); __sr.rightUp(4, 70);
}
function onScreen(z, g, view) {
  return !z.dead && !z.gone && z.x >= g.camX && z.x < g.camX + view.W &&
    z.y >= g.camY && z.y < g.camY + view.VH;
}
function trainDistance(z, g) {
  return Math.min(...g.tr.cars.map(c => Math.hypot(z.x - c.cx, (z.y - c.cy) / 0.72)));
}
function escortApproach(prior) {
  const g = __sr.G, id = 'leg-10-event-0', released = new Set(), releases = [];
  const members = () => g.zombies.filter(z => z.streamEventId === id);
  const start = prior.startDistance;
  let closest = prior.closestLeaderDistance, followed = prior.followed, threat = null;
  __sr.hold(false); __sr.hp(9999);
  for (let frame = 0; frame < 1200 && !threat; frame++) {
    __sr.sim(1 / 60);
    for (const z of members()) {
      if (z.streamLead && !z.dead && !z.gone) closest = Math.min(closest, trainDistance(z, g));
      if (!z.streamLead) {
        followed ||= !!z.escort;
        if (z.escortReleased && !released.has(z)) {
          released.add(z); releases.push({index: z.streamIndex, at: z.escortReleaseAt, reason: z.escortReleaseReason});
        }
        if (z.escortReleased && !z.dead && !z.gone && (z.st === 2 || trainDistance(z, g) < 40))
          threat = {index: z.streamIndex, at: g.run, state: z.st, distance: trainDistance(z, g), reason: z.escortReleaseReason};
      }
    }
  }
  check(followed && Number.isFinite(start) && closest < start - 10 && releases.length > 0 && threat,
    'Natural escort failed to follow, approach, release and threaten the train: ' + JSON.stringify({start, closest, followed,
      releases, threat, state: __sr.legState(), pack: members().map(z => ({index: z.streamIndex, lead: !!z.streamLead,
        x: z.x - g.camX, y: z.y - g.camY, dead: !!z.dead, gone: !!z.gone, following: !!z.escort,
        released: !!z.escortReleased, reason: z.escortReleaseReason, state: z.st}))}));
  check(releases.every(r => Number.isFinite(r.at) && ['nearTrain', 'leadersGone'].includes(r.reason)),
    'Escort release did not come from natural leader proximity/death');
  return {startDistance: start, closestLeaderDistance: closest, followed, releases, threat};
}
function escortShot() {
  return seeded(0x62A, () => {
    freshLeg(10, false, false); const g = __sr.G, view = __sr.stats(), id = 'leg-10-event-0';
    __sr.sim(3);
    let snapshot = null;
    const startDistance = Math.min(...g.zombies.filter(z => z.streamEventId === id && z.streamLead && !z.dead && !z.gone).map(z => trainDistance(z, g)));
    let closestLeaderDistance = startDistance, followed = false;
    for (let frame = 0; frame < 480 && !snapshot; frame++) {
      __sr.frames(1);
      const pack = g.zombies.filter(z => z.streamEventId === id && onScreen(z, g, view) && z.y - g.camY >= 35);
      const leaders = pack.filter(z => z.streamLead), followers = pack.filter(z => !z.streamLead);
      for (const z of g.zombies) if (z.streamEventId === id) {
        if (z.streamLead && !z.dead && !z.gone) closestLeaderDistance = Math.min(closestLeaderDistance, trainDistance(z, g));
        if (!z.streamLead) followed ||= !!z.escort;
      }
      if (leaders.length >= 1 && followers.length >= 2 &&
          Math.min(...leaders.map(z => z.y)) > Math.max(...followers.map(z => z.y))) {
        snapshot = {time: g.run, startDistance, closestLeaderDistance, followed, leaders: leaders.map(z => ({type: z.type, x: z.x - g.camX, y: z.y - g.camY})),
          followers: followers.map(z => ({type: z.type, x: z.x - g.camX, y: z.y - g.camY}))};
      }
    }
    check(snapshot && snapshot.leaders.every(z => z.type === 2) && snapshot.followers.every(z => z.type === 1),
      'Actual leg10 escort never showed its first natural visible brute-led runner formation: ' + JSON.stringify({
        state: __sr.legState(), pack: g.zombies.filter(z => z.streamEventId === id).map(z => ({
          index: z.streamIndex, lead: !!z.streamLead, type: z.type, x: z.x - g.camX, y: z.y - g.camY,
          dead: !!z.dead, gone: !!z.gone, state: z.st, hp: z.hp}))}));
    __sr.hp(view.max); __sr.hold(true); __sr.frames(1);
    const points = [...snapshot.leaders, ...snapshot.followers], x = Math.min(...points.map(z => z.x)), y = Math.min(...points.map(z => z.y));
    return {formation: snapshot, state: __sr.legState(), stats: __sr.stats(),
      crop: {x: Math.max(0, Math.floor(x - 14)), y: Math.max(0, Math.floor(y - 18)), w: 90, h: 70, scale: 4}};
  });
}


escortShot();

