// B-2 debug launch uses the production single-bomb transport; purchase/gift remain unavailable.
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(fn) {
  const original = Math.random; let seed = 0xB252;
  Math.random = () => {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = original; }
}
function freshB2(quiet = true) {
  __sr.hold(false); __sr.reset(); __sr.node('a10', 1);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70); __sr.thermal(0);
  if (!quiet) { __sr.bot(true); return; }
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() {
  const g = __sr.G, h = g.helis[0], s = __sr.stats(), f = {g, s: g.tr.s, anchors: [],
    target: {x: s.W * 0.7, y: s.VH * 0.55}};
  h.x = g.camX + f.target.x - 125; h.y = g.camY + f.target.y + 85;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return f;
}
function add(f, x, y, hp = 2) {
  const z = __sr.spawn(0, x, y); z.hp = hp; z.sp = 0;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function launch(f, target = f.target) {
  check(__sr.b2Strike(target.x, target.y, Math.PI / 4), 'Real B-2 debug strike failed');
  const show = __sr.planeShow(), j = show.jets.find(j => j.id === 'b2');
  check(j && show.jets.length === 1 && j.bombCount === 1 && show.marks.length === 1 &&
    show.stats.b2.launched === 1 && show.stats.b2.dropped === 0, 'B-2 did not start one warning/flight/bomb payload');
  return {j, over: Math.ceil((j.delay - j.s / 320) * 60)};
}
function impact(f, draw = false) {
  for (let i = 0; i < 500 && !__sr.planeShow().stats.b2.impacts; i++) advance(f, 1, draw);
  const show = __sr.planeShow(), fx = __sr.b2Fx();
  check(show.stats.b2.dropped === 1 && show.stats.b2.impacts === 1 && show.stats.b2.lastImpact.radius === 65,
    'B-2 did not land exactly one65px bomb');
  check(fx.cores.some(b => b.r === 44 && b.cap === 20) && fx.rings.some(r => r.r1 === 65) &&
    fx.rings.some(r => r.r1 === 97.5), 'Largest B-2 core/rings missing from actual effect records: ' + JSON.stringify(fx));
  return {stats: show.stats.b2, fx};
}
function b2Shot(kind) {
  return seeded(() => {
    freshB2(); __sr.sim(8); __sr.frames(240);
    const f = field();
    for (let i = 0; i < 28; i++) {
      const a = i * Math.PI / 14, r = 20 + i % 3 * 12;
      add(f, f.target.x + Math.cos(a) * r, f.target.y + Math.sin(a) * r * 0.72);
    }
    const flight = launch(f);
    if (kind === 'flight') {
      advance(f, flight.over + 6, true);
      const show = __sr.planeShow(), bombs = show.activeBombs.filter(b => b.source === 'b2');
      check(show.jets.some(j => j.id === 'b2' && j.bodyVisible && j.roared) && bombs.length === 1 &&
        bombs[0].radius === 65 && bombs[0].T === 0.7 && show.roars === 1, 'Flight view lacks the visible flying wing and one bomb');
    } else {
      impact(f, true); advance(f, 30, true);
      check(f.anchors.every(a => a.z.dead) && __sr.fx().booms > 0 && __sr.fx().rings > 0, 'Blast shot lacks real crowd kill and large effects');
    }
    const show = __sr.planeShow(), art = show.art;
    check(art.b2.normal === 32 && art.b2.shadow === 32 && art.b2.hot === 32 &&
      art.b2.w * art.b2.h > art.heli.w * art.heli.h, 'B-2 art is not bigger than heli with32 cached normal/shadow/hot headings');
    __sr.hp(80); __sr.hold(true); __sr.frames(1);
    return {show, fx: __sr.b2Fx(), heli: __sr.helis()[0], kills: f.g.kills};
  });
}

freshB2();
check(!__sr.node('b2', 1) && !__sr.buy('b2') && !__sr.planes().some(p => p.id === 'b2') &&
  !__sr.save().nodes.b2, 'B-2 became purchasable/equipped before the finale gift');
const f = field(), inside = [add(f, f.target.x, f.target.y, 1000000),
  add(f, f.target.x + 63, f.target.y, 1000000), add(f, f.target.x, f.target.y + 63 * 0.72, 1000000)];
const outside = [add(f, f.target.x + 67, f.target.y), add(f, f.target.x, f.target.y + 67 * 0.72)];
const saveBefore = JSON.stringify(__sr.save()), planesBefore = JSON.stringify(__sr.planes());
launch(f);
check(JSON.stringify(__sr.save()) === saveBefore && JSON.stringify(__sr.planes()) === planesBefore, 'Debug B-2 launch spent resources or changed ownership');
const boundary = impact(f);
check(inside.every(z => z.dead) && outside.every(z => !z.dead && z.hp === 2) && boundary.stats.kills === 3,
  'Actual65px ellipse boundary failed inside/outside probes');

freshB2(); const sf = field(), c = sf.g.tr.cars[0], hp = sf.g.tr.hp, hurt = JSON.stringify(sf.g.hurt);
const victims = [-1, 1].map(side => add(sf, c.cx - sf.g.camX + side * c.nx * 14, c.cy - sf.g.camY + side * c.ny * 14));
launch(sf, {x: c.cx - sf.g.camX, y: c.cy - sf.g.camY}); impact(sf); advance(sf, 60);
check(victims.every(z => z.dead) && sf.g.tr.hp === hp && JSON.stringify(sf.g.hurt) === hurt, 'Engine-centre B-2 missed actual zombies or damaged the train');
const flight = b2Shot('flight'); __sr.frames(30);
for (const camera of [1, 2, 0]) { __sr.thermal(camera); __sr.frames(1); check(__sr.late() <= 1, 'B-2 thermal rendering added late sprite pages'); }
const blast = b2Shot('blast'); __sr.frames(30);

freshB2(false); __sr.give(3000, 30); __sr.sim(30); __sr.frames(10);
const s = __sr.stats();
__sr.crowd(100, s.W * 0.7, s.VH * 0.55, 60, 0);
check(__sr.b2Strike(s.W * 0.7, s.VH * 0.55, Math.PI / 4), 'Busy B-2 launch failed');
for (let i = 0; i < 300 && !__sr.planeShow().stats.b2.impacts; i++) __sr.frames(1);
__sr.frames(6);
check(__sr.planeShow().stats.b2.impacts === 1 && __sr.fx().booms > 0, 'Busy benchmark missed the real B-2 impact peak');
const early = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), fx: __sr.fx()};
__sr.frames(24);
check(__sr.fx().booms > 0, 'Expanded B-2 fireball expired before the second benchmark');
const expanded = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), fx: __sr.fx()};
const performance = {bench: Math.max(early.bench, expanded.bench),
  cost: early.cost.render > expanded.cost.render ? early.cost : expanded.cost,
  early, expanded, late: __sr.late(), stats: __sr.stats(), fx: __sr.fx()};
check(performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1, 'B-2 thirty-second busy drawing check failed');
QA_DONE({purchaseUnavailable: true, debugLaunchResourceNeutral: true, oneBomb: boundary.stats,
  boundary: {radius: 65, inside: 3, outside: 2}, actualBigCoreAndRings: boundary.fx, trainSafe: {hp, victims: 2},
  cachedArt: flight.show.art.b2, thermalLate: true,
  shots: {flight: {heli: flight.heli, show: flight.show}, blast: {heli: blast.heli, kills: blast.kills, fx: blast.fx}},
  bothShotsRendered: true, performance, baseline: {bench: 3.27, render: 2.97, late: 1}});
