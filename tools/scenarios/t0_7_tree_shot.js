// Shot mode: every remaining branch is visible and linked after Phase 0's removals.
__sr.reset();
__sr.give(3000, 30);
for (const node of __sr.treeNodes()) __sr.node(node.id, 1);
__sr.depot('tree');
__sr.treeCam(0, -1, 0.75);
__sr.frames(30);
