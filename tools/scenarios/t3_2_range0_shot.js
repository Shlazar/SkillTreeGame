// Shot mode: the base 150 px dotted range ring shown by an actual held right button.
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
function rangeShot(level) {
  // Fire Rate is the owned parent for both range comparison fixtures.
  fresh(0, 1, level);
  if (!__sr.gunVisual().range.visible) throw new Error('Initial three-second range ring missing');
  __sr.sim(3.2);
  if (__sr.gunVisual().range.visible) throw new Error('Initial range ring did not expire');
  __sr.hold(true);
  __sr.frames(240);
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * 0.55;
  h.y = g.camY + H * 0.5;
  h.vx = h.vy = 0;
  h.alt = 25;
  h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.rightDown(h.x - g.camX, h.y - g.camY);
  if (!__sr.gunVisual().range.visible) throw new Error('Held right button did not show expired range ring');
  __sr.frames(1);
  return {up: __sr.stats().up, run: +g.run.toFixed(2), visual: __sr.gunVisual(), heli: __sr.helis()[0]};
}
rangeShot(0);
