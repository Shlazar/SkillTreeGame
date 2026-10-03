// Shot mode: three staggered automatic pod rockets in flight toward the selected crowd.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshPods(damage = 0, reload = 0, salvo = 0, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  // Pure pods are deliberately set without Nose Rockets so its tracker cannot hide pod failures.
  for (const [id, level] of [['rocketPods', 1], ['podDamage', damage], ['podReload', reload], ['podSalvo', salvo]]) {
    check(__sr.node(id, level), 'Missing pod node ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  if (!quiet) return;
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  g.station = null;
  g.walls.length = 0;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function crowdFixture(distractors = true, centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats(), anchors = [];
  h.x = g.camX + W * (centred ? 0.5 : 0.6);
  h.y = g.camY + H * 0.72;
  h.alt = 25;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  const centre = {x: h.x + 70, y: h.y - 50};
  function pack(n, x, y) {
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n, z = __sr.spawn(0, x - g.camX + Math.cos(a) * 5, y - g.camY + Math.sin(a) * 5 * 0.72);
      z.hp = 1000000;
      anchors.push({z, x: z.x, y: z.y});
    }
  }
  pack(10, centre.x, centre.y);
  if (distractors) {
    pack(1, h.x - 35, h.y);
    pack(20, h.x + 230, h.y - 45);
  }
  return {g, h, s: g.tr.s, centre, anchors};
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) {
      a.z.x = a.x; a.z.y = a.y;
      a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60);
  }
}
function salvoShot() {
  freshPods();
  __sr.sim(8);
  __sr.frames(240);
  const f = crowdFixture(false, true);
  for (let i = 0; i < 180 && __sr.units().pods.inFlight < 3; i++) pinned(f, 1 / 60);
  const p = __sr.units().pods;
  check(p.salvos === 1 && p.inFlight >= 3 && p.inFlight <= 4, 'Shot did not capture staggered pod rockets');
  check(new Set(p.active.map(r => +r.age.toFixed(4))).size >= 3, 'Pod rockets launched together instead of staggering');
  __sr.hold(true);
  __sr.frames(1);
  return {pods: __sr.units().pods, heli: __sr.helis()[0],
    points: p.active.map(r => ({x: +(r.position[0] - f.g.camX).toFixed(1), y: +(r.position[1] - r.position[2] - f.g.camY).toFixed(1)}))};
}
salvoShot();
