// Four real-frame strike stages, using the actual launch distance to choose flyover/exit frames.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshShow(crowd = true) {
  __sr.hold(false); __sr.reset(); check(__sr.node('a10', 1), 'A-10 node missing');
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.sim(8); __sr.frames(240);
  const s = __sr.stats(), f = {g, s: g.tr.s, anchors: [], target: {x: s.W * 0.7, y: s.VH * 0.65}};
  h.x = g.camX + f.target.x - 120; h.y = g.camY + f.target.y + 90;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  if (crowd) for (let i = 0; i < 30; i++) {
    const z = __sr.spawn(0, f.target.x + (i % 2 ? 6 : -6), f.target.y - 90 + i * 180 / 29);
    z.sp = 0; f.anchors.push({z, x: z.x, y: z.y});
  }
  return f;
}
function frameAdvance(f, n) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.frames(1);
  }
}
function begin(f, target = f.target, angle = Math.PI / 2) {
  check(__sr.strike('q', target.x, target.y, angle), 'Actual strike did not launch');
  const show = __sr.planeShow(), j = show.jets[0];
  check(j && show.marks.length === 1 && j.delay > 0, 'Strike did not begin with a marker/delay');
  const over = Math.ceil((j.delay - j.s / 320) * 60);
  const after = Math.ceil((j.delay + (j.end - j.s) / 320 + 0.3) * 60);
  return {over, after, delay: j.delay, start: j.s, end: j.end};
}
function showShot(stage) {
  const f = freshShow(), timing = begin(f);
  let frames = {marker: 9, over: timing.over, after: timing.after}[stage];
  if (stage === 'shadow') {
    frames = 0;
    while (frames < 120) {
      frameAdvance(f, 1); frames++;
      const j = __sr.planeShow().jets[0];
      if (j && j.shadowVisible && !j.bodyReady) break;
    }
    frameAdvance(f, 3); frames += 3;
  } else frameAdvance(f, frames);
  const show = __sr.planeShow(), stats = __sr.stats(), fx = __sr.fx(), j = show.jets[0];
  if (stage === 'marker') check(show.marks.length === 1 && j.delay > 0 && !j.fired &&
    show.roars === 0 && f.anchors.every(a => !a.z.dead && a.z.hp === 2), 'Marker preceded neither flight nor damage');
  if (stage === 'shadow') check(j && j.delay <= 1e-7 && !j.fired && j.shadowVisible &&
    !j.bodyReady && !j.bodyVisible && !j.roared && show.roars === 0,
    'Approach must show the incoming shadow before the body/trails/roar');
  if (stage === 'over') check(j && j.fired && show.marks.length === 0 && show.roars === 1 &&
    Math.abs(j.s) < 8 && stats.kills > 0 && fx.parts > 0, 'Flyover lacks jet, real damage or effects');
  if (stage === 'after') check(show.jets.length === 0 && show.marks.length === 0 &&
    show.roars === 1 && f.anchors.every(a => a.z.dead), 'Aftermath did not finish the strike/exit');
  check(show.art.jet.w * show.art.jet.h > show.art.heli.w * show.art.heli.h &&
    Math.max(show.art.jet.w, show.art.jet.h) > Math.max(show.art.heli.w, show.art.heli.h), 'Jet sprite is not bigger than heli');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {stage, frames, timing, show, kills: stats.kills, fx, heli: __sr.helis()[0]};
}

showShot('marker');
