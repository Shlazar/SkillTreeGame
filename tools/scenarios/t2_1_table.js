// Run mode: final demo node table, icons, parents, maximum-level drawing and warm-atlas checks.
__sr.reset();
const nodes = __sr.treeNodes(), ids = new Set(nodes.map(n => n.id));
if (ids.size !== nodes.length) throw new Error('Duplicate node ids');
const root = nodes.find(n => n.id === 'root');
if (!root || root.name !== 'VIPER' || root.lv !== 1 || __sr.save().nodes.root !== 1 || root.p) throw new Error('Fresh VIPER root is not owned');
const groups = {
  scrap: nodes.filter(n => n.id !== 'root' && n.k !== 'tease' && n.cur === 'scrap'),
  unlock: nodes.filter(n => n.k !== 'tease' && n.cur === 'surv'),
  gold: nodes.filter(n => n.k !== 'tease' && n.cur === 'gold' && !n.charge),
  charge: nodes.filter(n => n.k !== 'tease' && n.cur === 'gold' && n.charge),
  tease: nodes.filter(n => n.k === 'tease')
};
const expected = {scrap: 37, unlock: 9, gold: 10, charge: 3, tease: 13};
for (const [key, count] of Object.entries(expected)) {
  if (groups[key].length !== count) throw new Error(key + ' count=' + groups[key].length + ', expected ' + count);
}
if (nodes.length !== 73) throw new Error('Expected 73 total nodes');
for (const n of nodes) {
  if (!n.name || !Number.isFinite(n.x) || !Number.isFinite(n.y)) throw new Error('Malformed node metadata: ' + n.id);
  if (n.id !== 'root' && (!n.p || !ids.has(n.p))) throw new Error('Missing parent: ' + n.id);
  const visited = new Set([n.id]);
  for (let p = n.p; p; p = nodes.find(v => v.id === p).p) {
    if (visited.has(p)) throw new Error('Parent cycle: ' + n.id);
    visited.add(p);
  }
  if (n.k !== 'tease' && n.id !== 'root' &&
      (!Array.isArray(n.cost) || !n.cost.length || n.max !== n.cost.length || n.cost.some(v => !Number.isInteger(v) || v <= 0))) {
    throw new Error('Invalid cost track: ' + n.id);
  }
}
for (const n of groups.unlock) {
  if (!n.star || n.max !== 1 || JSON.stringify(n.cost) !== '[1]') throw new Error('Unlock must cost one survivor with a star frame: ' + n.id);
}
for (const n of groups.charge) {
  if (n.max !== 1) throw new Error('Extra plane charge must have one level: ' + n.id);
}
const sumCosts = list => list.reduce((total, n) => total + n.cost.reduce((sum, cost) => sum + cost, 0), 0);
const sums = {scrap: sumCosts(groups.scrap), gold: sumCosts(groups.gold.concat(groups.charge))};
if (sums.scrap !== 8832 || sums.gold !== 206) throw new Error('Wrong demo cost totals: ' + JSON.stringify(sums));
const overlap = __sr.treeOverlap();
if (overlap.length) throw new Error('Nodes overlap: ' + JSON.stringify(overlap));
const art = new Map(__sr.treeArt().map(icon => [icon.id, icon]));
for (const n of nodes) {
  const icon = art.get(n.id);
  if (!icon || icon.w !== 14 || icon.h !== 14) throw new Error('Missing or malformed 12px outlined icon: ' + n.id);
}
const fitFresh = __sr.infoFit();
if (fitFresh.bad.length) throw new Error('Tooltip overflow: ' + JSON.stringify(fitFresh.bad));
__sr.give(20000, 30, 500);
for (const n of groups.tease) {
  if (__sr.buy(n.id) !== false) throw new Error('Full-game tease could be bought: ' + n.id);
  if (__sr.node(n.id, 1) !== false || __sr.save().nodes[n.id]) throw new Error('Full-game tease could be owned: ' + n.id);
}
// The minimum three-currency buying path must already debit a gold node correctly.
const goldTarget = groups.gold[0];
for (let parent = goldTarget.p; parent; parent = nodes.find(n => n.id === parent).p) {
  if (!__sr.node(parent, 1)) throw new Error('Gold-buy parent setup failed: ' + parent);
}
__sr.SAVE.flags.survShown = __sr.SAVE.flags.goldShown = true;
__sr.give(0, 0, 0);
const moneyBeforeGold = __sr.save();
if (__sr.buy(goldTarget.id) !== true) throw new Error('Could not buy gold node ' + goldTarget.id);
const moneyAfterGold = __sr.save();
if (moneyAfterGold.gold !== moneyBeforeGold.gold - goldTarget.cost[0] ||
    moneyAfterGold.scrap !== moneyBeforeGold.scrap || moneyAfterGold.surv !== moneyBeforeGold.surv) {
  throw new Error('Gold node purchase changed the wrong currency');
}

function maxTree() {
  __sr.hold(false);
  __sr.reset();
  __sr.SAVE.flags.survShown = true;
  __sr.SAVE.flags.goldShown = true;
  __sr.give(20000, 30, 500);
  for (const node of __sr.treeNodes()) {
    if (node.k !== 'tease' && !__sr.node(node.id, node.max)) throw new Error('Could not max ' + node.id);
  }
  __sr.depot('tree');
  __sr.treeCam(1.5, 0.75, 0.25);
  __sr.frames(180);
}

// Maximum levels exercise every numeric tooltip and every parent line; all tease icons still render.
maxTree();
const maxed = __sr.treeNodes();
for (const n of maxed) {
  if (n.k === 'tease' ? n.lv !== 0 : n.lv !== n.max || n.st !== 'max') throw new Error('Unexpected maximum-tree state: ' + n.id);
  if (n.k === 'tease' && __sr.buy(n.id) !== false) throw new Error('Owned parent made a full-game tease buyable: ' + n.id);
}
const fitMax = __sr.infoFit();
if (fitMax.bad.length) throw new Error('Maximum-tree tooltip overflow: ' + JSON.stringify(fitMax.bad));
for (const n of maxed) {
  __sr.treeCam(n.x, n.y, 0.75);
  __sr.hoverNode(n.id);
  __sr.frames(2);
}
// A focused root at the existing normal scale also exercises the unchanged node style.
__sr.treeCam(0, 0, 1);
__sr.hoverNode('root');
__sr.frames(30);
const focused = __sr.nodeAt('root');
if (!focused || !Number.isFinite(focused.x) || !Number.isFinite(focused.y)) throw new Error('Focused root has no screen position');

// Icons are registered during startup. A battle after owning every demo node adds no late pages.
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(30);
__sr.frames(30);
if (__sr.mode !== 'play' || __sr.G.result || __sr.G.kills <= 0) throw new Error('Maximum-tree 30-second battle failed');
__sr.hold(true);
const perf = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
if (perf.late > 1) throw new Error('New tree icons wrote late atlas pages: ' + perf.late);

// Keep this final setup identical to t2_1_tree_shot.js and draw additional held frames in run.
maxTree();
__sr.frames(30);
QA_DONE({count: nodes.length, groups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
  sums, overlap, icons: nodes.length, fit: {fresh: fitFresh.bad, max: fitMax.bad}, teaseOwnershipBlocked: true,
  goldBuy: {id: goldTarget.id, cost: goldTarget.cost[0]}, maxTree: true, focusedRoot: true, shot: true, perf});
