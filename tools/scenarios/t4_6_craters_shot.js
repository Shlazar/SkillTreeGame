// B-52 actual bomb row, payload and matching falling-row/aftermath views.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function b52() { const p = __sr.planes().find(p => p.id === 'b52'); check(p, 'B-52 not owned'); return p; }
function freshB52(maximum = false, fire = false, quiet = true) {
  __sr.hold(false); __sr.reset();
  for (const [id, level] of [['b52', 1], ['b52Bombs', maximum ? 4 : 0], ['b52Cooldown', maximum ? 4 : 0],
    ['b52Blast', maximum ? 3 : 0], ['fireBombs', fire ? 1 : 0], ['b52Charge', maximum ? 1 : 0]]) check(__sr.node(id, level), 'Missing B-52 node ' + id);
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70);
  if (!quiet) { __sr.bot(true); return; }
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
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

b52Shot('craters');


