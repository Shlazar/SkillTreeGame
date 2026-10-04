// Shot mode: the demo branches and unowned full-game teases fit in the tree overview.
__sr.reset();
__sr.give(3000, 30);
Object.assign(__sr.SAVE.flags, {survShown: true, goldShown: true, silverSeen: true, boomSeen: true});
for (const node of __sr.treeNodes()) if (node.k !== 'tease') __sr.node(node.id, 1);
__sr.depot('tree');
__sr.treeCam(0, 0, 0.25);
__sr.frames(30);
