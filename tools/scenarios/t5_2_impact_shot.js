// shot mode: Katyusha cadence, forward crowd selection, clustered payload and cached rack art.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function kat() { return __sr.units().katyusha; }
function freshKat(maximum = false, cluster = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of Object.entries({katyusha: 1, katyushaRockets: maximum ? 4 : 0,
    katyushaReload: maximum ? 4 : 0, katyushaBlast: maximum ? 3 : 0, clusterRockets: cluster ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing Katyusha node ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, anchors: []}; }
function add(f, x, y, hp = 1000000) {
  const z = __sr.spawn(0, x - f.g.camX, y - f.g.camY);
  z.hp = hp; z.sp = 0;
  // This quiet weapon fixture preserves crowd spread but excludes scenery avoidance.
  // Its fixed, durable pack keeps a valid target throughout the four-salvo clock.
  z.block = []; z.blockT = 1000000;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
    check(!f.g.result, 'Pinned Katyusha fixture unexpectedly reached its station');
  }
}
function pack(f, count = 12, hp = 1000000, rear = false) {
  const c = f.g.tr.cars[0], rack = f.g.tr.cars[2];
  const x = rear ? rack.cx - c.dx * 55 + c.nx * 80 : c.x0 + c.dx * 65 + c.nx * 75;
  const y = rear ? rack.cy - c.dy * 55 + c.ny * 80 : c.y0 + c.dy * 65 + c.ny * 75;
  for (let i = 0; i < count; i++) add(f, x + (i % 4 - 1.5) * 5, y + (Math.floor(i / 4) - 1) * 4, hp);
  return {x, y, count};
}
function katShot(kind = 'launch', camera = 0) {
  freshKat(true, kind === 'impact'); __sr.thermal(camera); __sr.sim(8); __sr.frames(240);
  let curved = false;
  for (const km of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    __sr.km(km); __sr.sim(1 / 60);
    if (Math.abs(__sr.G.tr.cars[2].dx) > 0.1) { curved = true; break; }
  }
  check(curved, 'Katyusha view did not find curved track');
  const f = field(), target = pack(f, 20, 2), initial = kat();
  for (let i = 0; i < 180 && kat().shots < 4; i++) advance(f, 1, true);
  check(kat().shots >= 4 && kat().active.some(r => r.source === 'katyusha' && r.position[2] > r.sz),
    'Launch view lacks actual sequential rising rockets');
  if (kind === 'impact') {
    for (let i = 0; i < 180 && kat().clusterImpacts === 0; i++) advance(f, 1, true);
    check(kat().clusterImpacts > 0 && kat().rocketImpacts === 0, 'Impact view lacks actual small cluster blasts');
    advance(f, 24, true);
    check(kat().kills > 0 && __sr.fx().booms > 0, 'Impact view lacks visible explosions and real kills');
  } else if (kind === 'normalImpact') {
    for (let i = 0; i < 180 && kat().rocketImpacts === 0; i++) advance(f, 1, true);
    check(kat().rocketImpacts > 0 && kat().clusterImpacts === 0, 'Normal impact view lacks actual large rocket blasts');
    advance(f, 24, true);
    check(kat().kills > 0 && __sr.fx().booms > 0, 'Normal impact view lacks visible explosions and real kills');
  }
  const state = kat(), c = f.g.tr.cars[2], launch = state.lastLaunch;
  near(state.mount.x, c.cx, 'Curved rack X'); near(state.mount.y, c.cy, 'Curved rack Y'); near(state.mount.z, 3, 'Rack deck height');
  near(launch.mountX, c.cx, 'Real launch mount X'); near(launch.mountY, c.cy, 'Real launch mount Y');
  near(launch.mountZ, 3, 'Real launch deck'); near(launch.z, 7, 'Rocket launch height');
  check(state.art.normal === 32 && state.art.hot === 32 && state.art.atlas && initial.art.atlas,
    'Katyusha normal/thermal art was not cached at startup');
  check(__sr.rockets().shots === 0, 'Katyusha view contaminated helicopter gun counts');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {kind, camera, state: kat(), target: {x: target.x - f.g.camX, y: target.y - f.g.camY},
    crop: {x: Math.round(state.mount.sx - 24), y: Math.round(state.mount.sy - 32), w: 48, h: 64, scale: 4}};
}


katShot('impact', 0);
