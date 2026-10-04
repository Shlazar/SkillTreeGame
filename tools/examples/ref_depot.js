// Reference shot (docs/style/depot.png): the Depot with the mouse on a node - the tooltip (name,
// level, kind, one sentence, the NOW > NEXT line in green, the price with its icon, CLICK TO BUY).
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
__sr.hoverNode('hrate');
__sr.frames(30);
