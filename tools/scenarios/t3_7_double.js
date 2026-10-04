// Double Hellfire: real distinct-target salvo and a matching two-missile view.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshDouble(owned = true) {
  __sr.hold(false); __sr.reset();
  check(__sr.node('hellfire', 1) && __sr.node('doubleHellfire', owned ? 1 : 0), 'Hellfire nodes missing');
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.bot(false); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null;
  h.order = {kind: 'move', x: h.x, y: h.y};
}
function fixture() {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.5; h.y = g.camY + H * 0.75;
  h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
  return {g, h, s: g.tr.s, anchors: []};
}
function addBrute(f, dx, dy) {
  const z = __sr.spawn(2, f.h.x - f.g.camX + dx, f.h.y - f.g.camY + dy);
  z.sp = 0; z.hp = 100;
  f.anchors.push({z, x: z.x, y: z.y}); return z;
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60);
  }
}
function launch(f, count) {
  for (let i = 0; i < 700 && !__sr.units().hellfire.shots; i++) pinned(f, 1 / 60);
  const state = __sr.units().hellfire;
  check(state.salvos === 1 && state.shots === count && state.inFlight === count, 'Wrong first-salvo count: ' + JSON.stringify(state));
  return f.g.rounds.filter(r => r.kind === 'hellfire');
}
function doubleShot() {
  freshDouble(); __sr.sim(8); __sr.frames(240);
  const f = fixture();
  const targets = [addBrute(f, -70, -55), addBrute(f, 80, -55)];
  f.h.hd = 0;
  const rounds = launch(f, 2);
  check(new Set(rounds.map(r => r.tgt)).size === 2 && targets.every(z => rounds.some(r => r.tgt === z)), 'Shot missiles share a target');
  pinned(f, 0.35);
  const state = __sr.units().hellfire;
  check(state.active.length === 2 && state.active.every(r => r.age > 0.3 && r.age < r.T), 'Shot is not two missiles in mid-flight');
  __sr.hold(true); __sr.frames(1);
  return {state, heli: __sr.helis()[0], points: state.active.map(r => ({
    x: +(r.position[0] - f.g.camX).toFixed(1),
    y: +(r.position[1] - r.position[2] - f.g.camY).toFixed(1)
  }))};
}

freshDouble(false);
check(__sr.G.up.hellfireCount === 1 && __sr.units().hellfire.count === 1, 'Base missile count is not one');
freshDouble();
check(__sr.G.up.hellfireCount === 2 && __sr.units().hellfire.count === 2, 'Double missile count is not two');
let f = fixture(), targets = [addBrute(f, -70, -55), addBrute(f, 80, -55)];
let rounds = launch(f, 2), launchState = __sr.units().hellfire;
check(new Set(rounds.map(r => r.tgt)).size === 2 && targets.every(z => rounds.some(r => r.tgt === z)), 'Two brutes did not receive distinct missiles');
check(launchState.lastTargets.length === 2 && launchState.lastTargets[0].t === launchState.lastTargets[1].t, 'Two missiles were not in the same salvo');
pinned(f, 0.85);
const hitState = __sr.units().hellfire;
check(targets.every(z => Math.abs(z.hp - 82) < 1e-7 && z.pending === 0) && hitState.impacts === 2, 'Both distinct brutes were not hit once');

freshDouble(); f = fixture();
const single = addBrute(f, 80, -55);
rounds = launch(f, 1);
check(rounds[0].tgt === single && __sr.units().hellfire.lastTargets.length === 1, 'Single target was duplicated');
pinned(f, 0.85);
check(Math.abs(single.hp - 82) < 1e-7 && __sr.units().hellfire.impacts === 1, 'Single enemy received duplicate damage');

freshDouble(); f = fixture(); pinned(f, 20);
const empty = __sr.units().hellfire;
check(empty.shots === 0 && empty.salvos === 0 && empty.inFlight === 0, 'No eligible enemies still launched a missile');
const shot = doubleShot(); __sr.frames(30);
check(__sr.late() <= 1, 'Double Hellfire drew extra late atlas pages');
QA_DONE({baseCount: 1, upgradedCount: 2, distinctSameSalvo: true,
  bothHit: {impacts: hitState.impacts, damageEach: 18, time: launchState.lastTargets[0].t},
  singleTarget: {shots: 1, impacts: 1}, noTargets: {shots: empty.shots, salvos: empty.salvos},
  shot: {heli: shot.heli, points: shot.points, ages: shot.state.active.map(r => r.age)}, matchingShotRendered: true});

