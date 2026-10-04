// B-52 actual bomb row, payload and matching falling-row/aftermath views.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function b52() { const p = __sr.planes().find(p => p.id === 'b52'); check(p, 'B-52 not owned'); return p; }
function freshB52(maximum = false, fire = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['b52', 1], ['b52Bombs', maximum ? 4 : 0], ['b52Cooldown', maximum ? 4 : 0],
    ['b52Blast', maximum ? 3 : 0], ['fireBombs', fire ? 1 : 0], ['b52Charge', maximum ? 1 : 0]]) check(__sr.node(id, level), 'Missing B-52 node ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70);
  if (!quiet) { __sr.bot(true); return; }
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() {
  const g = __sr.G, h = g.helis[0], s = __sr.stats(), f = {g, s: g.tr.s, anchors: [], centres: new Map(),
    target: {x: s.W * 0.7, y: s.VH * 0.55}};
  h.x = g.camX + f.target.x - 110; h.y = g.camY + f.target.y + 75;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return f;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
    for (const b of __sr.planeShow().activeBombs.filter(b => b.source === 'b52')) {
      f.centres.set(b.x1.toFixed(3) + ',' + b.y1.toFixed(3), {x: b.x1, y: b.y1, radius: b.radius});
    }
  }
}
function launch(f, target = f.target, angle = Math.PI / 4) {
  const t = f.g.run;
  check(__sr.strike(b52().key, target.x, target.y, angle), 'Actual B-52 strike failed');
  const show = __sr.planeShow(), j = show.jets.find(j => j.id === 'b52');
  check(j && show.jets.length === 1, 'B-52 did not launch one bomber');
  return {j, p: b52(), t, over: Math.ceil((j.delay - j.s / 320) * 60)};
}
function complete(f, count, draw = false) {
  for (let i = 0; i < 500 && __sr.planeShow().stats.b52.impacts < count; i++) advance(f, 1, draw);
  const state = __sr.planeShow().stats.b52;
  check(state.launched === 1 && state.dropped === count && state.impacts === count && f.centres.size === count,
    'B-52 did not land its distinct bomb row: ' + JSON.stringify({state, distinct: f.centres.size}));
  return state;
}
function b52Shot(kind) {
  freshB52(true, true); __sr.sim(8); __sr.frames(240);
  const f = field();
  for (let i = 0; i < 16; i++) {
    const d = -150 + i * 20, z = __sr.spawn(0, f.target.x + Math.SQRT1_2 * d, f.target.y + Math.SQRT1_2 * d);
    z.sp = 0; f.anchors.push({z, x: z.x, y: z.y});
  }
  const flight = launch(f);
  if (kind === 'mid') {
    advance(f, flight.over, true);
    const show = __sr.planeShow(), bombs = show.activeBombs.filter(b => b.source === 'b52' && b.visible);
    check(show.jets.some(j => j.id === 'b52' && j.bodyVisible) && bombs.length >= 3 &&
      new Set(bombs.map(b => b.x1.toFixed(3) + ',' + b.y1.toFixed(3))).size === bombs.length,
      'Midrun view lacks visible bomber and a distinct falling row');
  } else if (kind === 'after') {
    complete(f, 16, true); advance(f, 42, true);
    check(__sr.stats().decals > 0 && f.anchors.every(a => a.z.dead) && __sr.fires().some(p => p.source === 'b52'),
      'Aftermath lacks actual row impacts, craters or burning ground');
  } else {
    complete(f, 16, true); advance(f, 300, true);
    const show = __sr.planeShow();
    check(__sr.stats().decals > 0 && f.centres.size === 16 && f.anchors.every(a => a.z.dead) &&
      !show.activeBombs.some(b => b.source === 'b52') && !__sr.fires().some(p => p.source === 'b52') && __sr.fx().booms === 0,
      'Cooled crater lane lost its impacts or retained blast/fire effects');
  }
  const show = __sr.planeShow(), art = show.art;
  check(art.b52.w > art.jet.w && art.b52.h > art.jet.h && art.b52.engines.length === 8 &&
    new Set(art.b52.engines.map(p => p.x + ',' + p.y)).size === 8, 'B-52 is not the larger eight-engine sprite');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {show, heli: __sr.helis()[0], centres: [...f.centres.values()], decals: __sr.stats().decals, fires: __sr.fires().filter(p => p.source === 'b52').length};
}

const payloads = [];
for (const maximum of [false, true]) {
  freshB52(maximum, maximum); const f = field(), count = maximum ? 16 : 8, cd = maximum ? 25 : 45;
  check(b52().ready && b52().charges === (maximum ? 2 : 1), 'B-52 did not start with its full charges');
  const flight = launch(f);
  near(flight.p.cd, cd, 'Actual B-52 cooldown');
  near(f.g.up.b52Blast, maximum ? 1.6 : 1, 'Actual blast multiplier');
  near(flight.j.bombRadius, maximum ? 28.8 : 18, 'Actual bomb blast radius');
  check(flight.j.bombCount === count && flight.j.bombDamage === 12, 'Actual B-52 bomb payload');
  const state = complete(f, count), fires = __sr.fires().filter(p => p.source === 'b52');
  if (maximum) {
    check(fires.length > 0 && fires.every(p => !p.wall && p.duration === 4 && p.dps === 2), 'Fire Bombs did not leave actual ordinary burning ground');
    const p = fires[fires.length - 1], z = __sr.spawn(0, p.x - f.g.camX, p.y - f.g.camY);
    z.sp = 0; f.anchors.push({z, x: z.x, y: z.y});
    advance(f, 66);
    check(z.dead && __sr.fireStats().kills >= 1, 'Walker entering after the blast was not killed by Fire Bombs');
  } else check(fires.length === 0, 'Bombs without Fire Bombs created fire');
  const remaining = Math.round((flight.t + cd - f.g.run) * 60);
  advance(f, remaining - 1);
  check(b52().cd > 0 && b52().charges === (maximum ? 1 : 0), 'B-52 charge recovered early');
  advance(f, 1);
  check(b52().cd === 0 && b52().charges === (maximum ? 2 : 1), 'B-52 missed its45/25s cooldown recovery');
  payloads.push({bombs: count, dropped: state.dropped, impacts: state.impacts, distinctCentres: f.centres.size,
    blastRadius: flight.j.bombRadius, cooldown: cd, charges: b52().charges, fireBombs: maximum});
}
freshB52(true, true); const sf = field(), c = sf.g.tr.cars[0], hp = sf.g.tr.hp, hurt = JSON.stringify(sf.g.hurt);
const victims = [-1, 1].map(side => {
  const z = __sr.spawn(0, c.cx - sf.g.camX + side * c.nx * 14, c.cy - sf.g.camY + side * c.ny * 14);
  z.sp = 0; sf.anchors.push({z, x: z.x, y: z.y}); return z;
});
launch(sf, {x: c.cx - sf.g.camX, y: c.cy - sf.g.camY}, 0); complete(sf, 16); advance(sf, 60);
check(victims.every(z => z.dead) && sf.g.tr.hp === hp && JSON.stringify(sf.g.hurt) === hurt,
  'Actual engine-centre bomb row/fire damaged the train or missed its zombies');

const mid = b52Shot('mid'); __sr.frames(30);
const after = b52Shot('after'); __sr.frames(30);
const craters = b52Shot('craters'); __sr.frames(30);
// Keep the natural fight, with the Viper active, without spending the bomber's charges in warmup.
freshB52(true, true, false); __sr.bot(false); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
const s = __sr.stats(); __sr.crowd(80, s.W * 0.7, s.VH * 0.55, 100, 0);
check(__sr.strike(b52().key, s.W * 0.7, s.VH * 0.55, Math.PI / 4), 'Busy B-52 strike failed');
for (let i = 0; i < 300 && __sr.planeShow().stats.b52.impacts < 8; i++) __sr.frames(1);
__sr.frames(6);
const peak = __sr.planeShow();
check(peak.stats.b52.impacts >= 8 && __sr.fx().booms > 0, 'Busy benchmark missed the actual bomb-impact peak');
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(),
  stats: __sr.stats(), fx: __sr.fx(), payload: peak.stats.b52};
check(performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1, 'B-52 busy check failed');
QA_DONE({payloads, eightEngineArt: mid.show.art.b52, trainSafe: {hp, victims: victims.length},
  shots: {mid: {heli: mid.heli, bombs: mid.show.activeBombs.filter(b => b.source === 'b52').length, show: mid.show},
    after: {heli: after.heli, centres: after.centres, decals: after.decals, fires: after.fires},
    craters: {heli: craters.heli, centres: craters.centres, decals: craters.decals, fires: craters.fires, cooledFrames: 300}},
  bothShotsRendered: true, cooledCraterShotRendered: true,
  performance, baseline: {bench: 3.27, render: 2.97, late: 1}});
