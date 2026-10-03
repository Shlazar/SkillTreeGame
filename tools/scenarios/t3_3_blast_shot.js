// Shot mode: the first real rocket blast throws an area crowd from its actual impact centre.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshRocket(level, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  check(__sr.node('hrate', 1) && __sr.node('hrange', 1), 'Rocket purchase parents missing');
  __sr.SAVE.flags.goldShown = true;
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.give(0, 0, 100);
  __sr.depot('tree');
  for (let i = 0; i < level; i++) check(__sr.buy('rockets'), 'Actual Rockets purchase failed at level ' + (i + 1));
  check(!__sr.save().flags.rocketShown, 'Purchase consumed first-rocket demonstration before firing');
  __sr.start();
  __sr.rightUp(4, 70);
  if (quiet) isolate();
}
function isolate() {
  const g = __sr.G, h = g.helis[0];
  __sr.bot(false);
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  // Pin only this test's route, so real weapon time can reach 60 seconds without an arrival.
  g.station = null;
  g.walls.length = 0;
  g.t3_3GoalS = g.goalS;
  g.goalS = -1000000000;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function aimFixture(hp = 1000000, centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * (centred ? 0.55 : 0.7);
  h.y = g.camY + H * 0.7;
  h.alt = 25;
  h.vx = h.vy = 0;
  const z = __sr.spawn(0, h.x - g.camX + (centred ? 70 : 0), h.y - g.camY - (centred ? 65 : 45));
  z.hp = hp;
  h.hd = Math.atan2(z.x - h.x, -(z.y - h.y));
  h.cd = 0;
  __sr.order(0, 'attack', z);
  return {g, h, z, s: g.tr.s, x: z.x, y: z.y};
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s;
    f.g.tr.v = 0;
    // A durable test target remains under aim; knockback must not move it out of the camera.
    f.z.x = f.x;
    f.z.y = f.y;
    f.z.vx = f.z.vy = f.z.kbx = f.z.kby = 0;
    __sr.sim(1 / 60);
  }
}
function rocketShot(kind) {
  freshRocket(1);
  __sr.sim(8);
  __sr.frames(240);
  const f = aimFixture(2, true), neighbours = [];
  // The timing sample's distant goal is unnecessary here; keep the real destination in the HUD.
  f.g.goalS = f.g.t3_3GoalS;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    neighbours.push(__sr.spawn(0, f.x - f.g.camX + Math.cos(a) * 10, f.y - f.g.camY + Math.sin(a) * 10 * 0.72));
  }
  for (let i = 0; i < 40 && !__sr.rockets().active.length; i++) pinned(f, 1 / 60);
  check(__sr.rockets().active.length === 1, 'First actual rocket never launched');
  if (kind === 'trail') {
    for (let i = 0; i < 20 && __sr.rockets().active[0]?.age < 0.12; i++) pinned(f, 1 / 60);
    const active = __sr.rockets().active[0];
    check(active && active.age >= 0.12 && active.age < active.T, 'Trail shot did not freeze a flying rocket');
  } else {
    for (let i = 0; i < 30 && !__sr.rockets().impacts; i++) pinned(f, 1 / 60);
    check(__sr.rockets().impacts === 1 && f.z.dead && neighbours.every(z => z.dead), 'Blast shot did not kill its area crowd');
    f.h.cd = 1000000;
    pinned(f, 6 / 60);
    check(__sr.fx().booms > 0 && __sr.fx().rings > 0, 'Rocket blast effects missing');
  }
  __sr.hold(true);
  __sr.frames(1);
  const r = __sr.rockets(), active = r.active[0], point = active ? active.position : [r.lastImpact.x, r.lastImpact.y, 0];
  return {state: r, heli: __sr.helis()[0], point: {x: +(point[0] - f.g.camX).toFixed(1), y: +(point[1] - point[2] - f.g.camY).toFixed(1)}};
}
rocketShot('blast');
