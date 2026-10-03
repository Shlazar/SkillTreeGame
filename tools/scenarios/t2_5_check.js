// Run mode: six visual setups and the complete tree before combat features.
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

const views = [];
for (const stage of ['start', 'mid', 'all']) for (const zoom of [1, 0.25]) {
  setup(stage, zoom);
  __sr.frames(30);
  const ids = __sr.treeShown(), nodes = __sr.treeNodes();
  if (ids.length !== (stage === 'start' ? 5 : stage === 'all' ? 73 : 26)) throw new Error('Wrong revealed tree size: ' + stage + ':' + ids.length);
  if (__sr.infoFit().bad.length || __sr.treeOverlap().length) throw new Error('Invalid tree layout');
  const {W,H} = __sr.stats();
  if (zoom === 0.25 && stage === 'all') {
    // Run mode has a shorter viewport; every node must remain inside its map panel.
    const clipped = nodes.filter(n => { const p=__sr.nodeAt(n.id); return p.x<4 || p.x>W-4 || p.y<63 || p.y>H-45; });
    // At 632x313 the widest view trims the extremities; the export uses the full640x360 canvas.
    if (clipped.length > 4) throw new Error('Overview clips too much: ' + clipped.map(n=>n.id));
  }
  views.push({stage, zoom, visible: ids.length, goal: __sr.goal()[0][0]});
}
// A map-control click must never buy a node underneath the control.
setup('start', 1);
const {W,H} = __sr.stats(), bx = W - 85, by = 74, midY = Math.round((63 + H - 45) / 2);
__sr.treeCam(-1.5 - (bx - W/2)/36, -1.5 - (by - midY)/36, 1);
__sr.frames(1);
const before = __sr.save().scrap, under = __sr.nodeAt('hdmg');
if (Math.abs(under.x-bx)>1 || Math.abs(under.y-by)>1) throw new Error('Button-over-node setup missed');
__sr.click(bx,by);
if (__sr.save().scrap !== before || __sr.save().nodes.hdmg) throw new Error('Zoom control bought an underlying node');
setup('all', 1);
__sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(30); __sr.frames(30); __sr.hold(true);
const perf = {bench:+__sr.bench(60).toFixed(2),cost:__sr.cost(20),late:__sr.late()};
if (perf.bench >= 8 || perf.late > 1) throw new Error('Tree proof exceeded rendering budget');
QA_DONE({views, overlap:__sr.treeOverlap(), fit:__sr.infoFit().bad, perf});
