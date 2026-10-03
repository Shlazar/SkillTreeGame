// Shot mode: real currency purchases reveal heli weapons, train units and the first plane.
function midTree() {
  __sr.hold(false);
  __sr.reset();
  __sr.SAVE.flags.goldShown = true;
  __sr.give(300, 6, 30);
  __sr.depot('tree');
  __sr.frames(30);
  for (const id of ['hdmg', 'hrate', 'hrange', 'armor', 'magnet', 'a10', 'rockets', 'rocketPods', 'mgCar', 'ram', 'steamVent']) {
    if (!__sr.buy(id)) throw new Error('Mid-tree purchase failed: ' + id);
    __sr.frames(24);
  }
  __sr.treeCam(1, -0.75, 0.5);
  __sr.frames(180);
}

midTree();

