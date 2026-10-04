// shot mode: MG car artwork and mounts.
// MG fixtures isolate its actual targeting and cadence from helicopter fire and ambient spawns.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(actual, expected, label) { check(Math.abs(actual - expected) < 1e-6, label + ': ' + actual); }
function freshMG(maximum = false, ap = false, count = maximum ? 3 : 1, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of Object.entries({mgCar: 1, mgDamage: maximum ? 5 : 0,
    mgRate: maximum ? 5 : 0, mgRange: maximum ? 3 : 0, mgTurrets: count - 1, apRounds: ap ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing MG node ' + id);
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
  const z = __sr.spawn(0, x - f.g.camX, y - f.g.camY); z.hp = hp; z.sp = 0;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead && a.z.st !== 2) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function firstShot(f) {
  const before = __sr.units().mg.shots;
  for (let i = 0; i < 180 && __sr.units().mg.shots === before; i++) advance(f, 1);
  check(__sr.units().mg.shots > before, 'MG did not fire at an eligible target');
  return __sr.units().mg;
}

function mgShot(camera = 0) {
  freshMG(true, true); __sr.thermal(camera); __sr.sim(8); __sr.frames(240);
  let curved = false;
  for (const km of [0.1, 0.2, 0.3, 0.4, 0.5]) {
    __sr.km(km); __sr.sim(1 / 60);
    if (Math.abs(__sr.G.tr.cars[3].dx) > 0.1) { curved = true; break; }
  }
  check(curved, 'MG view did not find a genuinely curved track section');
  const f = field(), c = f.g.tr.cars[3], mg = __sr.units().mg;
  check(mg.count === 3 && mg.turrets.length === 3, 'Three actual MG turrets missing');
  for (const t of mg.turrets) {
    near(t.x, c.cx + c.dx * t.along + c.nx * (t.across || 0), 'Curved turret X anchor');
    near(t.y, c.cy + c.dy * t.along + c.ny * (t.across || 0), 'Curved turret Y anchor');
  }
  for (let i = 0; i < 9; i++) add(f, c.cx + 48 + i % 3 * 14, c.cy + (Math.floor(i / 3) - 1) * 12, 100);
  for (let i = 0; i < 180; i++) {
    advance(f, 1, true);
    if (__sr.units().mg.turrets.every(t => t.flash > 0) && __sr.gunVisual().hits.some(h => h.scale === 0.6)) break;
  }
  const state = __sr.units().mg, hits = __sr.gunVisual().hits;
  check(state.turrets.every(t => t.flash > 0 && t.shots > 0) && hits.some(h => h.scale === 0.6),
    'MG view did not capture actual smaller muzzle flashes and hit sparks');
  check(f.g.rounds.length === 0 && __sr.rockets().shots === 0, 'MG view introduced tracers/heli rounds');
  const art = state.art;
  check(art.normal === 32 && art.hot === 32 && art.barrel === 32 && art.hotBarrel === 32,
    'MG normal/thermal heading sprites were not baked together');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {camera, state: __sr.units().mg, hits, car: {x: c.cx - f.g.camX, y: c.cy - f.g.camY,
    dx: c.dx, dy: c.dy}, crop: {x: Math.round(c.cx - f.g.camX - 28), y: Math.round(c.cy - f.g.camY - 32), w: 56, h: 64, scale: 4}};
}

mgShot(0); __sr.hold(false); __sr.sim(0.12); __sr.hold(true); __sr.frames(1);
