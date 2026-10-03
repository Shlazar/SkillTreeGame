// Shot mode: mid tree at wide zoom.
function setup(stage, zoom) {
  __sr.hold(false);
  __sr.reset();
  for (const k of ['currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[k] = true;
  if (stage !== 'start') for (const k of ['survShown', 'goldShown', 'silverSeen', 'boomSeen']) __sr.SAVE.flags[k] = true;
  __sr.give(stage === 'start' ? 80 : 20000, stage === 'start' ? 0 : 30, stage === 'start' ? 0 : 500);
  if (stage === 'mid') for (const id of ['hdmg', 'hrate', 'hrange', 'armor', 'magnet', 'salvageCrew', 'a10', 'rockets', 'rocketPods', 'mgCar', 'ram', 'steamVent']) {
    if (!__sr.buy(id)) throw new Error('Mid-game buy failed: ' + id);
  }
  if (stage === 'all') for (const n of __sr.treeNodes()) {
    if (n.k !== 'tease' && !__sr.node(n.id, n.max)) throw new Error('Max-level setup failed: ' + n.id);
  }
  __sr.depot('tree');
  __sr.treeCam(zoom === 1 || stage === 'start' ? 0 : 1.5, zoom === 1 || stage === 'start' ? 0 : 0.75, zoom);
  __sr.hover(4, 70);
  __sr.frames(300);
}

setup('mid', 0.25);

