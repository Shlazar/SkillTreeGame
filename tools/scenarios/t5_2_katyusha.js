// run mode: Katyusha cadence, forward crowd selection, clustered payload and cached rack art.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function kat() { return __sr.units().katyusha; }
function freshKat(maximum = false, cluster = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of Object.entries({katyusha: 1, katyushaRockets: maximum ? 4 : 0,
    katyushaReload: maximum ? 4 : 0, katyushaBlast: maximum ? 3 : 0, clusterRockets: cluster ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing Katyusha node ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
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

const cadence = [];
for (const cluster of [false, true]) {
  freshKat(false, cluster); const f = field(); pack(f);
  const starts = [];
  for (let i = 1; i <= 4; i++) {
    advance(f, 900); const state = kat();
    check(state.salvos === i, 'Base salvo count at ' + 15 * i + 's: ' + JSON.stringify(state));
    near(state.lastSalvo.t, i * 15, 'Base salvo start');
    check(state.lastSalvo.count === 6 && state.lastSalvo.cluster === (cluster ? 3 : 0), 'Incorrect base salvo payload');
    starts.push({t: state.lastSalvo.t, count: state.lastSalvo.count});
  }
  advance(f, 78); const state = kat();
  check(state.salvos === 4 && state.shots === 24 && state.queued === 0 && state.inFlight === 0,
    'Base salvos did not finish by61.3s: ' + JSON.stringify(state));
  check(state.impacts === (cluster ? 72 : 24) && state.rocketImpacts === (cluster ? 0 : 24) &&
    state.clusterImpacts === (cluster ? 72 : 0) && state.splits === (cluster ? 24 : 0) && state.clusterBombs === (cluster ? 72 : 0),
    'Cluster must replace each parent with exactly three impacts: ' + JSON.stringify(state));
  near(state.lastImpact.damage, cluster ? 4 : 8, 'Actual impact damage');
  near(state.lastImpact.radius, cluster ? 12 : 24, 'Actual base impact radius');
  check(state.hits > 0 && state.hits <= state.shots && __sr.rockets().shots === 0 && f.g.tr.hp === 9999,
    'Quiet salvo accuracy/train safety/heli isolation failed');
  cadence.push({cluster, seconds: f.g.run, starts, state});
}

freshKat(true); const maxField = field(); pack(maxField); const maxInitial = kat();
near(maxInitial.reload, 9, 'Maximum reload'); near(maxInitial.blastRadius, 38.4, 'Maximum blast radius');
near(maxInitial.damage, 8, 'Blast upgrades preserve damage');
check(maxInitial.salvo === 14 && maxInitial.range === 300, 'Maximum salvo/range incorrect');
advance(maxField, 3600); const maximum = kat();
check(maximum.salvos === 6 && maximum.shots === 84 && maximum.rocketImpacts === 84 && maximum.impacts === 84,
  'Maximum six fourteen-rocket salvos did not finish: ' + JSON.stringify(maximum));
near(maximum.lastSalvo.t, 54, 'Last max salvo start'); near(maximum.lastImpact.radius, 38.4, 'Actual max blast radius');

freshKat(); const selectionField = field(), ahead = pack(selectionField, 12), rear = pack(selectionField, 32, 1000000, true);
advance(selectionField, 900); const selected = kat().lastTarget, nose = selectionField.g.tr.cars[0];
check(selected && selected.count >= 10 && Math.hypot(selected.x - ahead.x, (selected.y - ahead.y) / 0.72) < 30 &&
  (selected.x - nose.x0) * nose.dx + (selected.y - nose.y0) * nose.dy > 0,
  'Katyusha selected denser rear pack instead of eligible ahead crowd: ' + JSON.stringify({selected, ahead, rear}));
advance(selectionField, 15); const arc = kat();
check(arc.active.length >= 4 && arc.active.every(r => r.source === 'katyusha' && r.T === 0.8 && r.arc === 32) &&
  arc.active.some(r => r.position[2] > r.sz), 'Actual salvo lacks its independent upward arc');
const ages = arc.active.map(r => r.age).sort((a, b) => a - b);
check(new Set(ages.map(n => n.toFixed(3))).size === ages.length && ages[ages.length - 1] - ages[0] >= 0.2,
  'Rack rockets did not launch sequentially');

freshKat(); const safeField = field(), engine = safeField.g.tr.cars[0];
const safeTarget = add(safeField, engine.x0 + engine.dx * 8 + engine.nx * 17,
  engine.y0 + engine.dy * 8 + engine.ny * 17, 100);
const hp = safeField.g.tr.hp, hurt = JSON.stringify(safeField.g.hurt);
for (let i = 0; i < 1100 && kat().impacts === 0; i++) advance(safeField, 1);
check(kat().impacts === 1 && safeTarget.hp === 92 && safeField.g.tr.hp === hp && JSON.stringify(safeField.g.hurt) === hurt,
  'Actual nearby rocket blast failed its damage/train-safety check: ' + JSON.stringify({hp: safeTarget.hp, trainHp: safeField.g.tr.hp, state: kat()}));

freshKat(true, true); const childField = field(); pack(childField); advance(childField, 600); const children = kat();
check(children.clusterImpacts > 0 && children.rocketImpacts === 0 && children.lastImpact.source === 'katyushaCluster',
  'Maximum clusters created a parent blast');
near(children.lastImpact.radius, 19.2, 'Actual upgraded child radius'); near(children.lastImpact.damage, 4, 'Actual child damage');

const shots = [];
for (const [kind, camera] of [['launch', 0], ['impact', 0], ['normalImpact', 0], ['launch', 1]]) {
  shots.push(katShot(kind, camera)); __sr.frames(30);
  check(__sr.late() <= 1, 'Normal/thermal Katyusha held rendering created late atlas pages');
}
freshKat(true, true, false); __sr.give(3000, 30); __sr.bot(true); __sr.sim(20); __sr.frames(30);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), katyusha: kat()};
check(performance.katyusha.salvos >= 2 && performance.katyusha.kills > 0 && performance.late <= 1,
  'Standard busy20s check missed real Katyusha payloads');
__sr.sim(10); __sr.frames(30);
const lateProbe = {late: __sr.late(), stats: __sr.stats(), katyusha: kat()};
check(lateProbe.late <= 1, 'Thirty-second Katyusha probe created late atlas pages');
QA_DONE({cadence, maximum, crowdSelection: {selected, ahead, rear}, arc, friendlySafe: {hp, targetHp: safeTarget.hp},
  upgradedChildren: children, shots, allFourExactShotsRendered: true, performance, lateProbe,
  baseline: {bench: 3.27, render: 2.97, late: 1}});
