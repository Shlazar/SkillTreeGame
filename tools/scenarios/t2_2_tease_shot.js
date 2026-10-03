// Shot mode: tease node and its unbought price/kind tooltip at normal scale.
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

tooltipSetup('doorGunner');

