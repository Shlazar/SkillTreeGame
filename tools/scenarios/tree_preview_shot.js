// Run/shot mode: the actual compact MG card; set window.TREE_SHOT_ID='a10' for the plane card.
const id = window.TREE_SHOT_ID || 'mgCar';
__sr.reset(); __sr.node('armor', 1); __sr.give(0, 1); __sr.SAVE.flags.survShown = true;
for (const lesson of __sr.tutState().lessonText) __sr.SAVE.seen[lesson.key] = true;
__sr.depot('tree'); __sr.hold(true); __sr.frames(60);
const node = __sr.treeNodes().find(n => n.id === id);
__sr.treeCam(node.x, node.y, 1); __sr.hoverNode(id); __sr.frames(69);
const tooltip = __sr.uiBounds().depot.tooltip;
if (!tooltip?.preview || tooltip.id !== id) throw new Error('Weapon preview was not shown');
const bench = __sr.bench(60);
if (bench >= 8) throw new Error('Preview drawing exceeds 8ms: ' + bench);
QA_DONE({id, tooltip, drawMs: +bench.toFixed(2), late: __sr.late()});
