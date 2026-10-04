// Run mode: a 60-second ride can finish its leg; combat drawing and the complete demo tree remain healthy.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(60);
const stats = __sr.stats();
if (!(stats.mode === 'play' || stats.result === 'won') || stats.kills <= 0 || stats.km <= 0 || stats.hp <= 0) {
  throw new Error('The 60-second bot run did not stay healthy');
}
// Match the fight shot and let the opening banners age through real drawing frames.
__sr.reset(); __sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(30);
__sr.frames(240);
__sr.hold(true);
const perf = {
  bench: +__sr.bench(60).toFixed(2),
  cost: __sr.cost(20),
  land: __sr.landBench(5),
  late: __sr.late(),
  fx: __sr.fx(),
  horde: __sr.horde()
};
__sr.hold(false);

// Match the tree shot: reveal currencies/variants and own demo nodes; full-game teases stay unowned.
__sr.reset();
__sr.give(3000, 30);
Object.assign(__sr.SAVE.flags, {survShown: true, goldShown: true, silverSeen: true, boomSeen: true});
for (const node of __sr.treeNodes()) {
  if (node.k !== 'tease' && !__sr.node(node.id, 1)) throw new Error('Could not set demo node ' + node.id);
}
__sr.depot('tree');
__sr.treeCam(0, 0, 0.25);
__sr.frames(30);
const nodes = __sr.treeNodes();
const ids = new Set(nodes.map((node) => node.id));
if (nodes.some((node) => !Object.prototype.hasOwnProperty.call(node, 'p'))) {
  throw new Error('treeNodes does not expose parents for the orphan check');
}
const orphans = nodes.filter((node) => node.p && !ids.has(node.p)).map((node) => node.id);
if (orphans.length) throw new Error('Remaining tree has missing parents: ' + orphans.join(', '));
const hidden = nodes.filter((node) => node.st === 'off').map((node) => node.id);
if (hidden.length) throw new Error('Owned branches are hidden: ' + hidden.join(', '));
if (nodes.some((node) => node.k === 'tease' && (node.lv || node.st !== 'tease'))) throw new Error('Full-game tease became owned');
QA_DONE({stats, perf, tree: {count: nodes.length, orphans, hidden, nodes: nodes.map((node) => node.id)}});
