// Shot mode: actual Napalm patches glow below a durable crowd while new walkers burn after the rocket impacts.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshNapalm(on, maximum = false, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  for (const [id, level] of [['rocketPods', 1], ['napalm', on ? 1 : 0],
    ['podDamage', maximum ? 4 : 0], ['podReload', maximum ? 4 : 0], ['podSalvo', maximum ? 3 : 0]]) {
    check(__sr.node(id, level), 'Missing Napalm/pod node ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  check(__sr.fires().length === 0, 'A fresh run retained old burning ground');
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  g.station = null;
  g.walls.length = 0;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function crowdFixture() {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats(), anchors = [];
  h.x = g.camX + W * 0.5;
  h.y = g.camY + H * 0.72;
  h.alt = 25;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, z = __sr.spawn(0, h.x - g.camX + 70 + Math.cos(a) * 5, h.y - g.camY - 50 + Math.sin(a) * 5 * 0.72);
    z.hp = 1000000;
    anchors.push({z, x: z.x, y: z.y});
  }
  return {g, h, s: g.tr.s, anchors};
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) {
      a.z.x = a.x; a.z.y = a.y;
      a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60);
  }
}
function oneSalvo(f) {
  for (let i = 0; i < 700 && __sr.units().pods.impacts < 4; i++) pinned(f, 1 / 60);
  check(__sr.units().pods.shots === 4 && __sr.units().pods.impacts === 4, 'One actual base pod salvo did not complete');
  f.g.up.pods = false; // The salvo snapshots already fired; stop the next one while watching fire expire.
  return __sr.units().pods;
}
function napalmShot() {
  freshNapalm(true);
  __sr.sim(8);
  __sr.frames(240);
  const f = crowdFixture(), p = oneSalvo(f);
  check(__sr.fires().length > 0, 'Shot has no actual Napalm patches');
  const victims = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    victims.push(__sr.spawn(0, p.lastTarget.x - f.g.camX + Math.cos(a) * 3, p.lastTarget.y - f.g.camY + Math.sin(a) * 3 * 0.72));
  }
  pinned(f, 1.1);
  check(victims.every(z => z.dead) && __sr.fireStats().kills >= 4, 'Shot walkers did not burn after the initial rocket blast');
  check(f.anchors.every(a => !a.z.dead) && __sr.fires().length > 0, 'Shot lost its durable crowd or active flames');
  __sr.hold(true);
  __sr.frames(1);
  return {fires: __sr.fires(), stats: __sr.fireStats(), heli: __sr.helis()[0],
    point: {x: +(p.lastTarget.x - f.g.camX).toFixed(1), y: +(p.lastTarget.y - f.g.camY).toFixed(1)}};
}
napalmShot();
