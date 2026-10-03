// Shot mode: all 73 demo/full-game nodes, owned demo branches and the complete overview.
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

maxTree();

