// Reference shot (docs/style/tree.png): the Depot's skill tree tab with some nodes bought - the dark
// starry panel, glowing nodes and lines, levels under the nodes (3/8), the top bar and RIDE.
__sr.give(400, 2);
__sr.node('root', 1);
__sr.node('hdmg', 3);
__sr.node('hrate', 2);
__sr.node('armor', 2);
__sr.node('ram', 1);
__sr.node('a10', 1);
__sr.node('magnet', 1);
__sr.SAVE.flags.survShown = true;
__sr.SAVE.seen.currency_surv = true;
__sr.depot('tree');
__sr.frames(30);
