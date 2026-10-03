// Run mode: each currency buys its own kind, with four exact unowned-price/tease tooltip shots.
function money() {
  const save = __sr.save();
  return {scrap: save.scrap, surv: save.surv, gold: save.gold};
}
function buyOnly(id, currency) {
  const node = __sr.treeNodes().find(n => n.id === id), before = money();
  if (!node || node.cur !== currency || node.k !== currency) throw new Error('Wrong node currency/kind: ' + id);
  if (__sr.buy(id) !== true) throw new Error('Could not buy ' + id);
  const after = money(), stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  for (const key of ['scrap', 'surv', 'gold']) {
    const expected = before[key] - (key === currency ? node.cost[node.lv] : 0);
    if (after[key] !== expected || stored[key] !== expected) throw new Error(id + ' changed wrong currency ' + key);
  }
  if (__sr.save().nodes[id] !== node.lv + 1) throw new Error('Purchase did not increment ' + id);
  const hover = __sr.hoverNode(id);
  if (!hover) throw new Error('Bought node cannot be hovered: ' + id);
  __sr.frames(30);
  return {id, currency, price: node.cost[node.lv], before, after};
}
__sr.reset();
__sr.SAVE.flags.survShown = true;
__sr.SAVE.flags.goldShown = true;
__sr.give(300, 3, 30);
__sr.depot('tree');
__sr.frames(120);
const nodes = __sr.treeNodes();
for (const node of nodes) {
  const expected = node.id === 'root' ? 'root' : node.k === 'tease' ? 'tease' : node.cur;
  if (node.k !== expected || !['root', 'scrap', 'surv', 'gold', 'tease'].includes(node.k)) throw new Error('Old/incorrect kind remains: ' + node.id + '=' + node.k);
}
const purchases = [buyOnly('hdmg', 'scrap'), buyOnly('a10', 'surv')];
if (!__sr.node('hrate', 1) || !__sr.node('hrange', 1)) throw new Error('Gold-buy parent setup failed');
purchases.push(buyOnly('rockets', 'gold'));
const beforeTease = money();
if (__sr.buy('doorGunner') !== false || __sr.save().nodes.doorGunner) throw new Error('Full-game tease was bought');
if (JSON.stringify(money()) !== JSON.stringify(beforeTease)) throw new Error('Tease attempt spent money');
__sr.hoverNode('doorGunner');
__sr.frames(30);
if (__sr.infoFit().bad.length) throw new Error('Currency tooltips overflow');

function tooltipSetup(id) {
  __sr.hold(false);
  __sr.reset();
  __sr.SAVE.flags.survShown = true;
  __sr.SAVE.flags.goldShown = true;
  __sr.give(300, 3, 30);
  // Parent setters isolate tooltip/currency behavior from purchasing the whole heli chain.
  if (!__sr.node('hrate', 1) || !__sr.node('hrange', 1)) throw new Error('Tooltip parent setup failed');
  __sr.depot('tree');
  __sr.frames(120);
  const node = __sr.treeNodes().find(n => n.id === id);
  if (!node) throw new Error('Missing tooltip node ' + id);
  __sr.treeCam(node.x, node.y, 1);
  const position = __sr.hoverNode(id);
  __sr.frames(30);
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Tooltip node has no screen position: ' + id);
  return {node, position};
}

const shots = [];
for (const [id, kind] of [['hdmg', 'scrap'], ['a10', 'surv'], ['rockets', 'gold'], ['doorGunner', 'tease']]) {
  // Each standalone shot calls this identical reset/setup and leaves this unbought price visible.
  const {node, position} = tooltipSetup(id);
  if (node.k !== kind || node.lv !== 0 || (kind !== 'tease' && node.st !== 'buy')) throw new Error('Wrong tooltip shot state: ' + id);
  if (kind === 'tease' && __sr.buy(id) !== false) throw new Error('Tease tooltip became buyable');
  const {W, H, SCALE} = __sr.stats();
  if (position.x < 0 || position.x >= W || position.y < 63 || position.y >= H - 45) throw new Error('Tooltip node outside panel');
  // Current fixed tooltip geometry: one description row, one stat row (none for FULL GAME).
  const height = kind === 'tease' ? 58 : 68, half = kind === 'surv' ? 13 : 10;
  const x = Math.round(position.x + half + 10), y = Math.round(position.y - height / 2);
  shots.push({id, kind, node: position, suggestedCrop: {x: x * SCALE, y: y * SCALE, w: 216 * SCALE, h: height * SCALE}});
  __sr.frames(30);
}
QA_DONE({purchases, teaseMoneyPreserved: true, oldKindsRemoved: true, shots});

