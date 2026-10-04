// F-4 payload, real persistent burning ground and a sustained Fire Wall crossing fixture.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function f4() { const p = __sr.planes().find(p => p.id === 'f4'); check(p, 'F-4 not owned'); return p; }
function freshF4(maximum = false, wall = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['f4', 1], ['fireDamage', maximum ? 4 : 0], ['f4Cooldown', maximum ? 5 : 0],
    ['fireLength', maximum ? 3 : 0], ['fireWall', wall ? 1 : 0], ['f4Charge', maximum ? 1 : 0]]) check(__sr.node(id, level), 'Missing F-4 node ' + id);
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
  const g = __sr.G, h = g.helis[0], s = __sr.stats(), f = {g, s: g.tr.s, anchors: [],
    target: {x: s.W * 0.7, y: s.VH * 0.5}};
  h.x = g.camX + f.target.x - 120; h.y = g.camY + f.target.y + 80;
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
  }
}
function launch(f, angle = Math.PI / 2) {
  const t = f.g.run;
  check(__sr.strike(f4().key, f.target.x, f.target.y, angle), 'Production F-4 strike failed');
  const show = __sr.planeShow(), j = show.jets.find(j => j.id === 'f4');
  check(j && show.jets.length === 1, 'F-4 did not launch one swept-wing jet');
  return {j, p: f4(), t, over: Math.ceil((j.delay - j.s / 320) * 60),
    after: Math.ceil((j.delay + (j.end - j.s) / 320 + 0.2) * 60)};
}
function f4Shot(kind) {
  freshF4(kind === 'fire', kind === 'fire'); __sr.sim(8); __sr.frames(240);
  const f = field();
  for (let i = 0; i < 18; i++) {
    const x = kind === 'fire' ? f.target.x - 90 + i * 180 / 17 : f.target.x + (i % 2 ? 5 : -5);
    const y = kind === 'fire' ? f.target.y - 18 - (i % 3) * 4 : f.target.y - 90 + i * 180 / 17;
    const z = __sr.spawn(0, x, y);
    z.sp = 0; z.hp = 2; f.anchors.push({z, x: z.x, y: z.y});
  }
  const flight = launch(f, kind === 'fire' ? 0 : Math.PI / 2);
  advance(f, kind === 'pass' ? flight.over : flight.after, true);
  const show = __sr.planeShow(), fires = __sr.fires().filter(p => p.source === 'f4');
  check(fires.length > 0, 'F-4 screenshot has no actual burning line');
  if (kind === 'pass') check(show.jets.some(j => j.id === 'f4' && j.bodyVisible && j.fired), 'F-4 flyover is not visible');
  else check(fires.length === flight.j.patchCount && fires.every(p => p.wall && p.duration === 12), 'Fire screenshot has no completed12s wall');
  check(show.art.f4.w * show.art.f4.h > show.art.heli.w * show.art.heli.h, 'F-4 sprite is not bigger than heli');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {show, fires, heli: __sr.helis()[0], hits: __sr.fireStats().hits};
}

f4Shot('fire');
