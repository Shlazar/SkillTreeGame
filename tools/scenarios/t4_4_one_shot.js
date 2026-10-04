// A-10 upgrade fixtures: actual lanes, payload, cooldown and matching one-/four-line views.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function freshA10(maximum = false, bombs = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['a10', 1], ['a10Damage', maximum ? 4 : 0], ['a10Cooldown', maximum ? 5 : 0],
    ['a10Lines', maximum ? 3 : 0], ['bombRun', bombs ? 1 : 0], ['a10Charge', maximum ? 1 : 0]]) {
    check(__sr.node(id, level), 'Missing A-10 node ' + id);
  }
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
    target: {x: s.W * 0.7, y: s.VH * 0.65}};
  h.x = g.camX + f.target.x - 140; h.y = g.camY + f.target.y + 65;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return f;
}
function add(f, x, y, hp, lane) {
  const z = __sr.spawn(0, x, y); z.sp = 0; z.hp = hp;
  f.anchors.push({z, x: z.x, y: z.y, lane}); return z;
}
function advance(f, frames, draw = true) {
  for (let i = 0; i < frames; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
  }
}
function launch(f, target = f.target, angle = Math.PI / 2) {
  const t = f.g.run;
  check(__sr.strike('q', target.x, target.y, angle), 'Actual A-10 launch failed');
  const p = __sr.planes().find(p => p.id === 'a10'), show = __sr.planeShow(), j = show.jets[0];
  check(show.jets.length === 1 && j, 'A-10 upgrade spawned multiple jets');
  return {j, p, t, over: Math.ceil((j.delay - j.s / 320) * 60),
    after: Math.ceil((j.delay + (j.end - j.s) / 320 + 0.2) * 60)};
}
function a10Shot(maximum) {
  freshA10(maximum, maximum); __sr.sim(8); __sr.frames(240);
  const f = field(), lanes = maximum ? [-45, -15, 15, 45] : [0];
  for (const lane of lanes) for (let i = 0; i < 15; i++) {
    add(f, f.target.x - lane + (i % 2 ? 4 : -4), f.target.y - 80 + i * 160 / 14, 2, lane);
  }
  const flight = launch(f);
  advance(f, flight.over);
  const show = __sr.planeShow();
  check(show.jets.length === 1 && show.jets[0].lines === lanes.length && show.jets[0].fired &&
    lanes.every(lane => f.anchors.some(a => a.lane === lane && a.z.dead)), 'Shot did not visibly fire every actual lane');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {show, heli: __sr.helis()[0], lanes, kills: f.g.kills};
}

a10Shot(false);

