// Double Hellfire: real distinct-target salvo and a matching two-missile view.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshDouble(owned = true) {
  __sr.hold(false); __sr.reset();
  check(__sr.node('hellfire', 1) && __sr.node('doubleHellfire', owned ? 1 : 0), 'Hellfire nodes missing');
  for (const key of ['p_auto', 't_attack', 'p_brute', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.bot(false); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
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

doubleShot();

