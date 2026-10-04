// Shot mode: the Farmlands line, earlier stars, and leg 5's RIDE TO OLD MILL button.
__sr.hold(false);
__sr.reset();
__sr.setLeg(5);
__sr.SAVE.legs[3].stars = [true, false, true];
__sr.SAVE.legs[4].stars = [true, true, false];
__sr.SAVE.flags.survShown = true;
__sr.SAVE.flags.goldShown = true;
__sr.give(245, 2, 7);
for (const [id, level] of [['hdmg', 2], ['armor', 1]]) {
  if (!__sr.node(id, level)) throw new Error('Unknown route shot upgrade: ' + id);
}
__sr.depot('tree');
__sr.treeCam(0, 0, 0.75);
__sr.frames(180);
