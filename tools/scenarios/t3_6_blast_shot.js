// Shot mode: the actual large Hellfire blast throws the selected brute and nearby walkers from its centre.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-7, label + ': ' + a); }
function freshHellfire(maximum = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['hellfire', 1], ['hellfireDamage', maximum ? 4 : 0],
    ['hellfireReload', maximum ? 4 : 0], ['hellfireBlast', maximum ? 3 : 0]]) check(__sr.node(id, level), 'Missing Hellfire node ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.rightUp(4, 70);
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  g.station = null; g.walls.length = 0;
  h.vx = h.vy = 0; h.cd = h.look = 1000000;
  h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function fixture(centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * (centred ? 0.5 : 0.6); h.y = g.camY + H * 0.75;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return {g, h, s: g.tr.s, anchors: []};
}
function add(f, type, dx, dy, hp, gold = false) {
  const z = gold ? __sr.gold(f.h.x - f.g.camX + dx, f.h.y - f.g.camY + dy)
    : __sr.spawn(type, f.h.x - f.g.camX + dx, f.h.y - f.g.camY + dy);
  z.sp = 0; if (hp != null) z.hp = hp;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) { a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0; }
    __sr.sim(1 / 60);
  }
}
function launch(f) {
  for (let i = 0; i < 700 && !__sr.units().hellfire.shots; i++) pinned(f, 1 / 60);
  const r = f.g.rounds.find(r => r.kind === 'hellfire');
  check(r && __sr.units().hellfire.shots === 1, 'First Hellfire did not launch');
  return r;
}
function hellfireShot(kind) {
  freshHellfire();
  __sr.sim(8); __sr.frames(240);
  const f = fixture(true), brute = add(f, 2, 80, -70, kind === 'curve' ? 1000000 : 6);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; add(f, 0, 80 + Math.cos(a) * 22, -70 + Math.sin(a) * 22 * 0.72); }
  f.h.hd = Math.atan2(brute.x - f.h.x, -(brute.y - f.h.y));
  launch(f);
  if (kind === 'curve') {
    pinned(f, 0.35);
    check(__sr.units().hellfire.inFlight === 1, 'Mid-curve missile is missing');
  } else {
    for (let i = 0; i < 60 && !__sr.units().hellfire.impacts; i++) pinned(f, 1 / 60);
    check(brute.dead && __sr.units().hellfire.kills >= 13, 'Big blast did not kill its selected brute and area crowd');
    pinned(f, 0.1);
    check(__sr.fx().booms > 0, 'Big Hellfire blast effects missing');
  }
  __sr.hold(true); __sr.frames(1);
  const state = __sr.units().hellfire, p = state.active[0]?.position || [state.lastImpact.x, state.lastImpact.y, 0];
  return {state, heli: __sr.helis()[0], point: {x: +(p[0] - f.g.camX).toFixed(1), y: +(p[1] - p[2] - f.g.camY).toFixed(1)}};
}
hellfireShot('blast');
