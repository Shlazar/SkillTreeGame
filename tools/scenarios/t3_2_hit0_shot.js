// Shot mode: the first real base-damage impact star.
function fresh(damage, rate, range) {
  __sr.hold(false);
  __sr.reset();
  for (const [id, level] of [['hdmg', damage], ['hrate', rate], ['hrange', range]]) {
    if (!__sr.node(id, level)) throw new Error('Unknown upgrade ' + id);
  }
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start();
  __sr.rightUp(4, 70);
  __sr.bot(false);
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function hitShot(level) {
  fresh(level, 0, 0);
  __sr.sim(8);
  __sr.frames(240);
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.55;
  h.y = g.camY + H * 0.7;
  h.vx = h.vy = 0;
  h.alt = 25;
  h.cd = 0;
  const z = __sr.spawn(0, h.x - g.camX + 36, h.y - g.camY - 65);
  z.hp = 9999;
  h.hd = Math.atan2(z.x - h.x, -(z.y - h.y));
  __sr.order(0, 'attack', z);
  for (let i = 0; i < 40 && g.hits < 1; i++) __sr.sim(1 / 60);
  if (g.hits !== 1 || g.shots !== 1) throw new Error('Hit shot did not capture its first real bullet impact');
  __sr.hold(true);
  __sr.frames(1);
  return {up: __sr.stats().up, hp: z.hp, visual: __sr.gunVisual(),
    heli: __sr.helis()[0], target: {x: +(z.x - g.camX).toFixed(1), y: +(z.y - g.camY).toFixed(1)}};
}
hitShot(0);
