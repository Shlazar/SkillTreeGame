// tree.js - the skill tree. One table, NODES, drives all of it: the map on the SKILL TREE tab of the
// Depot, how each node looks, the tooltip (what it does, NOW > NEXT, the price), buying, and the goal
// line under the summary. What a node does in a run is read from the UP numbers (game.js, and the new
// ones below), the same numbers the tooltip shows.
// The look: a dark starry panel, glowing neon nodes and lines that grow out from LAST TRAIN in the
// middle. Blue = a small upgrade (many levels, cheap, bought often), orange = a big unlock, pink =
// something special. Drag to move the map, the wheel zooms, C centres it.

// ---------- colours and numbers
// Each kind of node: c = bright, m = mid, d = dark (the body when maxed), g = its glow.
const NODE_KIND = {
  root: { c: '#ffd36a', m: '#a07a30', d: '#2e2410', g: '#ffb040' },
  up: { c: '#62c8ff', m: '#2f6f9e', d: '#0b2234', g: '#2a9dff' },
  big: { c: '#ffa448', m: '#a55a1e', d: '#331b08', g: '#ff7a1a' },
  spec: { c: '#ff70d4', m: '#9e3a84', d: '#2e0c26', g: '#ff3ab8' }
};
// A value with its unit, for the tooltip. (2 px on the ground = 1 m.)
const perS = (v) => +v.toFixed(1) + '/S', secs = (v) => +v.toFixed(1) + ' S', metres = (px) => Math.round(px / 2) + ' M';
const hotS = (t) => (isFinite(t) ? Math.round(t) + ' S' : 'NEVER');
const pctS = (v) => Math.round(v * 100) + '%';
// The prices of n levels: base, then each one k times the one before (rounded to 5, or 10 from 100).
function nodeCosts(base, n, k) {
  const a = [];
  let p = base;
  for (let i = 0; i < n; i++) {
    a.push(p < 100 ? Math.round(p / 5) * 5 : Math.round(p / 10) * 10);
    p *= k;
  }
  return a;
}

// ---------- what the new nodes do (numbers at level l; game.js has the older ones)
Object.assign(UP, {
  hdmg: (l) => 1 + 0.15 * l,       // HELI DAMAGE: x the heli guns' damage
  hrate: (l) => 1 + 0.08 * l,      // HELI FIRE RATE: x the heli guns' rounds per second
  hrange: (l) => 1 + 0.1 * l,      // HELI RANGE: x how far the heli guns reach
  bonus: (l) => 10 * l,            // BONUS SCRAP: scrap added at the end of a run
  bonusP: (l) => 0.05 * l,         // BIG BONUS: share of the run's scrap added at its end
  boom: (l) => 0.03 * l,           // EXPLOSIVE ZOMBIES: chance a zombie blows up when it dies
  boomR: (l) => 18 + 4 * l,        // BLAST RADIUS: how far that blast reaches (px)
  silver: (l) => 0.02 * l,         // SILVER ZOMBIES: chance a zombie is silver (worth more)
  ramTime: (l) => 0.5 * l,         // RAM TIME: seconds added to the Turbo Ram
  ramCharge: (l) => 20 * l         // RAM CHARGE: fewer kills to fill the Ram again
});

// ---------- the nodes
// Each node: id, name, k = kind ('up', 'big', 'spec'), p = the node it grows from, x, y = its place
// (in cells of 36 px, LAST TRAIN at 0, 0; -y is up), need = the level p must have (1 if not said),
// cost = the price of each level (as many levels as prices), cur = 'surv' when it nodeCosts survivors
// (else scrap), desc = one short sentence, stat (and stat2) = [label, value at level l] for the
// NOW > NEXT line. given = not for sale (holding Farm Stop gives it). soon = shown with its price,
// not for sale yet. later = from later in the game: a padlock for now.
const NODES = [
  { id: 'root', name: 'LAST TRAIN', k: 'root', x: 0, y: 0, cost: [0], desc: 'THE START OF YOUR WHOLE TREE.',
    stat: ['BRANCHES OPEN', (l) => (l ? 6 : 0)] },
  // HELIS (west)
  { id: 'hdmg', name: 'HELI DAMAGE', k: 'up', p: 'root', x: -1.7, y: 0, cost: nodeCosts(15, 10, 1.4),
    desc: 'EVERY HELI ROUND HITS HARDER.', stat: ['HELI DAMAGE', (l) => pctS(UP.hdmg(l))] },
  { id: 'hrate', name: 'HELI FIRE RATE', k: 'up', p: 'hdmg', x: -3.0, y: -0.85, cost: nodeCosts(20, 10, 1.4),
    desc: 'HELI GUNS FIRE FASTER.', stat: ['FIRE RATE', (l) => pctS(UP.hrate(l))] },
  { id: 'cool', name: 'COOLING', k: 'up', p: 'hrate', x: -4.25, y: -1.55, cost: [25, 50, 100],
    desc: 'HELI GUNS GET HOT MORE SLOWLY.', stat: ['OVERHEAT AFTER', (l) => hotS(UP.hot(l))] },
  { id: 'feed', name: 'FAST FEED', k: 'up', p: 'cool', x: -5.55, y: -1.95, cost: [40, 80, 160, 320, 640],
    desc: '+1 ROUND A SECOND, NO MORE HEAT.', stat: ['EACH HELI GUN', (l) => perS(UP.rate(l))] },
  { id: 'heavy', name: 'HEAVY ROUNDS', k: 'up', p: 'feed', x: -6.85, y: -2.45, cost: [120, 300, 700],
    desc: 'BIG ROUNDS: +1 DAMAGE EACH.', stat: ['DAMAGE A ROUND', (l) => UP.dmg(l)],
    stat2: ['HITS TO KILL A BRUTE', (l) => Math.ceil(CFG.types[2].hp / UP.dmg(l))] },
  { id: 'hrange', name: 'HELI RANGE', k: 'up', p: 'hdmg', x: -2.65, y: 1.55, cost: nodeCosts(25, 5, 1.5),
    desc: 'HELI GUNS REACH FURTHER.', stat: ['GUN RANGE', (l) => metres(HC.range * UP.hrange(l))] },
  { id: 'radio', name: 'FAST ROTORS', k: 'up', p: 'hrange', x: -3.45, y: 2.75, cost: nodeCosts(20, 5, 1.6),
    desc: 'YOUR HELIS FLY FASTER.', stat: ['HELI SPEED', (l) => UP.fly(l) + ' PX/S'] },
  // TRAIN (east)
  { id: 'armor', name: 'ARMOR', k: 'up', p: 'root', x: 1.7, y: 0, cost: nodeCosts(15, 10, 1.38),
    desc: 'STEEL PLATES: MORE TRAIN HEALTH.', stat: ['TRAIN HP', (l) => UP.hp(l)] },
  { id: 'ram', name: 'TURBO RAM', k: 'big', p: 'armor', x: 5.0, y: 1.65, cost: [350], star: true,
    desc: 'PRESS E: SMASH THROUGH THE DEAD.',
    stat: ['TURBO RAM', (l) => (l ? CFG.ram.dur + ' S AT ' + Math.round(CFG.ram.speed / CFG.train.cruise) + '× SPEED' : 'NONE')],
    stat2: ['FULL AGAIN AFTER', () => CFG.ram.charge + ' KILLS'] },
  { id: 'ramtime', name: 'RAM TIME', k: 'up', p: 'ram', x: 6.35, y: 2.15, cost: nodeCosts(40, 5, 1.6),
    desc: 'THE TURBO RAM LASTS LONGER.', stat: ['RAM LASTS', (l) => secs(CFG.ram.dur + UP.ramTime(l))] },
  { id: 'charge', name: 'RAM CHARGE', k: 'up', p: 'ram', x: 4.6, y: 3.0, cost: nodeCosts(40, 5, 1.6),
    desc: 'FEWER KILLS FILL THE RAM AGAIN.', stat: ['FULL AGAIN AFTER', (l) => CFG.ram.charge - UP.ramCharge(l) + ' KILLS'] },
  // LOOT (north)
  { id: 'bonus', name: 'BONUS SCRAP', k: 'up', p: 'root', x: 0, y: -1.6, cost: nodeCosts(20, 10, 1.4),
    desc: 'MORE SCRAP AT THE END OF A RUN.', stat: ['RUN BONUS', (l) => '+' + UP.bonus(l)] },
  { id: 'goldz', name: 'GOLDEN ZOMBIES', k: 'spec', p: 'bonus', x: 1.15, y: -2.6, cost: [30, 80, 200],
    desc: 'RARE GOLD ZOMBIES. CHASE THEM DOWN!', stat: ['GOLDEN ZOMBIES', (l) => (l ? '1 IN ' + UP.gold(l) : 0)],
    stat2: ['EACH ONE PAYS', () => SK.gold.value + ' SCRAP'] },
  { id: 'silver', name: 'SILVER ZOMBIES', k: 'spec', p: 'bonus', x: -1.15, y: -2.6, cost: nodeCosts(30, 5, 1.5),
    desc: 'SOME ZOMBIES ARE SILVER: MORE SCRAP.', stat: ['SILVER ZOMBIES', (l) => pctS(UP.silver(l))] },
  { id: 'scav', name: 'SCAVENGER', k: 'up', p: 'bonus', x: 0, y: -3.1, cost: nodeCosts(50, 5, 1.8),
    desc: 'MORE SCRAP FROM EVERY KILL.', stat: ['KILL SCRAP', (l) => '+' + Math.round(UP.scav(l) * 100) + '%'] },
  { id: 'magnet', name: 'MAGNET', k: 'up', p: 'scav', x: 1.15, y: -4.1, cost: [20, 40, 80],
    desc: 'GRAB LOOT FROM FURTHER AWAY.', stat: ['PICKUP RANGE', (l) => metres(UP.pickup(l))] },
  { id: 'winch', name: 'WINCH', k: 'big', p: 'scav', x: -1.15, y: -4.1, cost: [5], cur: 'surv', star: true,
    desc: 'LIFT SURVIVORS OUT OF THE FIELD.', stat: ['WINCH', (l) => (l ? 'LIFTS IN ' + secs(CFG.winch.hover) : 'NONE')] },
  { id: 'bonusP', name: 'BIG BONUS', k: 'up', p: 'scav', x: 0, y: -4.75, cost: nodeCosts(80, 5, 1.7),
    desc: 'A SHARE MORE OF THE RUN\'S SCRAP.', stat: ['END OF RUN', (l) => '+' + pctS(UP.bonusP(l))] },
  // EXPLOSIVES (north-east)
  { id: 'boom', name: 'EXPLOSIVE ZOMBIES', k: 'spec', p: 'root', x: 2.35, y: -2.2, cost: nodeCosts(25, 10, 1.4),
    desc: 'SOME ZOMBIES BLOW UP WHEN THEY DIE.', stat: ['CHANCE', (l) => pctS(UP.boom(l))] },
  { id: 'boomR', name: 'BLAST RADIUS', k: 'spec', p: 'boom', x: 3.7, y: -2.75, cost: nodeCosts(30, 5, 1.6),
    desc: 'THEIR BLASTS REACH FURTHER.', stat: ['BLAST', (l) => metres(UP.boomR(l) * 2) + ' WIDE'] },
  // AIR STRIKE (north-west)
  { id: 'strafe', name: 'STRAFING RUN', k: 'big', p: 'root', x: -2.35, y: -2.25, cost: [200], star: true,
    desc: 'PRESS Q: A JET STRAFES A LINE OF DEAD.', stat: ['STRAFING RUNS', (l) => (l ? '1 A RUN' : 'NONE')],
    stat2: ['FIRE WITH', () => 'Q, THEN CLICK THE MAP'] },
  { id: 'strafeD', name: 'STRAFE DAMAGE', k: 'up', p: 'strafe', x: -3.65, y: -2.95, cost: nodeCosts(40, 5, 1.6),
    desc: 'THE JET\'S GUNS HIT HARDER.', stat: ['DAMAGE A HIT', (l) => UP.strafeD(l)] },
  { id: 'strafeW', name: 'WIDE RUN', k: 'up', p: 'strafeD', x: -4.95, y: -3.35, cost: nodeCosts(40, 5, 1.6),
    desc: 'THE JET STRAFES A WIDER LINE.', stat: ['LINE WIDTH', (l) => metres(UP.strafeW(l) * 2)] },
  { id: 'strafeN', name: 'MORE RUNS', k: 'spec', p: 'strafe', x: -2.6, y: -3.75, cost: [150, 300, 600],
    desc: 'ONE MORE STRAFING RUN EACH RUN.', stat: ['STRAFING RUNS', (l) => 1 + l + ' A RUN'] },
  { id: 'strafeB', name: 'BOMB RUN', k: 'spec', p: 'strafeN', x: -2.05, y: -5.05, cost: [250],
    desc: 'THE JET DROPS BOMBS AT THE END.', stat: ['BOMBS', (l) => (l ? 3 : 0)] },
  { id: 'twin', name: 'TWIN JETS', k: 'big', p: 'strafeN', x: -3.5, y: -4.85, cost: [4], cur: 'surv', star: true,
    desc: 'TWO JETS FLY EVERY STRAFING RUN!', stat: ['JETS', (l) => 1 + l] },
  // STATION (south)
  { id: 'farm', name: 'FARM STOP', k: 'big', p: 'root', x: 0, y: 1.7, cost: [0], given: true,
    desc: 'YOUR FIRST STATION TO BUILD AT.', stat: ['STATION TAB', (l) => (l ? 'OPEN' : 'LOCKED')] },
  { id: 'nestspd', name: 'NEST SPEED', k: 'up', p: 'farm', x: -1.0, y: 2.85, cost: [80, 160, 320],
    desc: 'ALL YOUR MG NESTS SHOOT FASTER.', stat: ['MG NEST', (l) => perS(UP.nest(l))] },
  { id: 'wire', name: 'BARBED WIRE', k: 'spec', p: 'farm', x: 1.0, y: 2.85, cost: [60],
    desc: 'BUILD WIRE THAT SLOWS THE DEAD.',
    stat: ['ZOMBIE SPEED ON WIRE', (l) => (l ? Math.round(CFG.wire.slow * 100) : 100) + '%'] },
  { id: 'mortar', name: 'MORTAR PIT', k: 'big', p: 'farm', x: 0, y: 3.55, cost: [8], cur: 'surv', star: true, station: true,
    soon: true, desc: 'A BIG GUN FOR YOUR STATION.' }
];
const NODE = {};
for (const n of NODES) NODE[n.id] = n;
const T_CELL = 36;
const maxLv = (n) => n.cost.length;
const parentOf = (n) => (n.p ? NODE[n.p] : null);
// the level its parent must have
const needOf = (n) => n.need || 1;
const needsMet = (n) => !n.p || lv(n.p) >= needOf(n);
// the price of the next level, and whether you can pay it
const priceOf = (n) => n.cost[Math.min(lv(n.id), maxLv(n) - 1)];
const canPay = (n) => (n.cur === 'surv' ? SAVE.surv : SAVE.scrap) >= priceOf(n);
// "ARMOR 1", "FAST ROTORS 2": a node at a level, as NEEDS: and the goal line say it
const nodeLv = (id, l) => NODE[id].name + (maxLv(NODE[id]) > 1 ? ' ' + l : '');
// What a node is now:
//  'off'    not on the map (what it grows from is not shown, or is still a padlock)
//  'hidden' a padlock: what it grows from has no level yet (or it is from later in the game)
//  'locked' FARM STOP before Farm Stop is held
//  'soon'   shown with its price, not for sale yet
//  'poor'   for sale, but you cannot pay
//  'buy'    for sale, and you can pay
//  'max'    every level bought
function nodeState(n) {
  if (lv(n.id) >= maxLv(n)) return 'max';
  const p = parentOf(n);
  // (a node with a level always shows: an old save may own one whose parent has none)
  if (p && !lv(n.id)) {
    const ps = nodeState(p);
    if (ps === 'off' || ps === 'hidden') return 'off';
    if (n.station && !stationOpen()) return 'off';
    if (n.later || !needsMet(n)) return 'hidden';
  }
  if (n.given) return 'locked';
  if (n.soon) return 'soon';
  return canPay(n) ? 'buy' : 'poor';
}
// 0 = not on the map, 1 = a padlock, 2 = shown
const shownAs = (n) => ({ off: 0, hidden: 1 })[nodeState(n)] ?? 2;

// ---------- into a run
// The new nodes' numbers for a run (runUp in game.js calls this; L(id) = a node's level, 0 for the
// demo). HELI DAMAGE and HELI FIRE RATE are folded into the 25mm's dmg and rate (with the heat per
// round lowered, so a faster gun does not overheat sooner); heliRange is read in helis.js.
function treeUp(L, up) {
  const hd = UP.hdmg(L('hdmg')), hr = UP.hrate(L('hrate'));
  up.dmg *= hd;
  up.rate *= hr;
  up.heat /= hr;
  return Object.assign(up, {
    heliDmg: hd, heliRate: hr, heliRange: UP.hrange(L('hrange')),
    bonus: UP.bonus(L('bonus')), bonusP: UP.bonusP(L('bonusP')),
    boom: UP.boom(L('boom')), boomR: UP.boomR(L('boomR')), silver: UP.silver(L('silver')),
    ramTime: UP.ramTime(L('ramtime')), ramCharge: UP.ramCharge(L('charge')), power: false,
    strafe: L('strafe') ? 1 + L('strafeN') : 0, strafeW: UP.strafeW(L('strafeW')), strafeD: UP.strafeD(L('strafeD')),
    strafeBomb: L('strafeB') > 0, twin: L('twin') > 0
  });
}
// BONUS SCRAP and BIG BONUS: paid when the run ends (endGame calls this before the run is banked).
function payBonus() {
  if (!G || G.demo || G.pay.bonus) return;
  const b = Math.floor((G.up.bonus || 0) + Math.floor(G.cash) * (G.up.bonusP || 0));
  if (b <= 0) return;
  G.pay.bonus = b;
  G.cash += b;
}

// ---------- buying
// TREE = the panel's state: born[id] = when its line starts to grow (the node pops in GROW s later),
// pop[id] = when it popped in, lit[id] = when its line lit up, flash[id] = its last buy, shake[id] =
// a click that could not buy, rings, sparks and floats after a buy, hov = the node under the mouse,
// cam = the view (x, y = the cell in the middle of the panel, z = zoom; zt = the zoom it goes to,
// anchor = the point that stays under the mouse while it zooms), drag = a drag of the map.
const TREE = {};
const ZOOMS = [0.5, 0.75, 1, 1.5, 2];
function resetTree() {
  Object.assign(TREE, { born: {}, pop: {}, lit: {}, flash: {}, shake: {}, rings: [], sparks: [], floats: [], hov: null, sel: null,
    cam: { x: 0, y: 0, z: 1 }, zt: 1, anchor: null, drag: null, lastBuy: -9, y0: 19, y1: 331 });
}
resetTree();
const GROW = 0.3;
// Buy one level of node id. True when it was bought. It is saved at once.
function buyNode(id) {
  const n = NODE[id];
  if (!n || nodeState(n) !== 'buy') return false;
  const before = NODES.map(shownAs), p = priceOf(n);
  if (n.cur === 'surv') SAVE.surv -= p;
  else SAVE.scrap -= p;
  SAVE.nodes[id] = lv(id) + 1;
  saveSave();
  boughtFx(n, p);
  grew(before);
  SFX.buy(!!n.star || n.id === 'root');
  return true;
}
// The look of a buy: a white flash, glowing rings, a burst of sparks, the price floating up, the line lit.
function boughtFx(n, p) {
  const K = NODE_KIND[n.k], big = n.star || n.id === 'root';
  TREE.flash[n.id] = realT;
  TREE.rings.push({ id: n.id, t: realT, c: K.c, big });
  if (big) TREE.rings.push({ id: n.id, t: realT + 0.12, c: '#ffffff', big });
  for (let i = 0; i < (big ? 26 : 14); i++) {
    const a = rnd(TAU), v = rnd(30, big ? 110 : 75);
    TREE.sparks.push({ x: n.x * T_CELL, y: n.y * T_CELL, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: realT, T: rnd(0.35, 0.7),
      c: Math.random() < 0.35 ? '#ffffff' : K.c });
  }
  if (p) TREE.floats.push({ id: n.id, s: '-' + fmt(p), c: n.cur === 'surv' ? U.green : U.gold, t: realT });
  if (lv(n.id) === 1) TREE.lit[n.id] = realT;
}
// After a change: nodes that just came onto the map grow their line, one ring after another; a
// padlock that just opened pops.
function grew(before) {
  NODES.forEach((n, i) => {
    const now = shownAs(n), was = before[i];
    if (now === was) return;
    if (was === 0) {
      const p = parentOf(n), pb = p ? TREE.born[p.id] : null;
      TREE.born[n.id] = pb != null && pb >= realT ? pb + GROW : realT;
    }
    if (now === 2) TREE.pop[n.id] = was === 0 ? TREE.born[n.id] + GROW : realT;
  });
}
// FARM STOP is given by holding Farm Stop: hand it over (with the buy look) once that has happened.
function syncGiven() {
  const n = NODE.farm;
  if (!stationOpen() || lv(n.id)) return;
  const before = NODES.map(shownAs);
  SAVE.nodes[n.id] = 1;
  saveSave();
  boughtFx(n, 0);
  grew(before);
}
// Set a node's level (tests): no price, no show.
function setNode(id, l) {
  const n = NODE[id];
  if (!n) return false;
  l = clamp(l | 0, 0, maxLv(n));
  if (l) SAVE.nodes[id] = l;
  else delete SAVE.nodes[id];
  saveSave();
  return true;
}

// ---------- the goal line under the summary
// How many upgrades you can buy now, and the next big unlock to save for. [[text, colour], ...]
function summaryGoal() {
  if (!lv('root')) return [["NEXT: OPEN THE SKILL TREE. IT'S FREE.", U.gold]];
  const unit = (n) => (n.cur === 'surv' ? ' SURVIVORS' : ' SCRAP');
  const can = NODES.filter((n) => nodeState(n) === 'buy').length;
  const L = [];
  if (can) L.push(['YOU CAN BUY ' + can + ' UPGRADE' + (can > 1 ? 'S' : '') + ' NOW!', U.green]);
  // the cheapest big unlock on the map (scrap ones first)
  const order = (a, b) => (a.cur === 'surv') - (b.cur === 'surv') || priceOf(a) - priceOf(b);
  const goal = NODES.filter((n) => n.star && ['poor', 'buy'].includes(nodeState(n))).sort(order)[0];
  if (goal) {
    L.push(['NEXT BIG UNLOCK: ' + goal.name + ' (' + fmt(priceOf(goal)) + unit(goal) + ')', U.gold]);
    if (!canPay(goal)) L.push(['YOU HAVE ' + fmt(goal.cur === 'surv' ? SAVE.surv : SAVE.scrap) + ' / ' + fmt(priceOf(goal)) + unit(goal) + '.', U.dim]);
  } else if (!can) {
    const next = NODES.filter((n) => nodeState(n) === 'poor').sort(order)[0];
    if (next) L.push(['NEXT: ' + nodeLv(next.id, lv(next.id) + 1) + ' (' + fmt(priceOf(next)) + unit(next) + ')', U.gold]);
  }
  return L;
}
// The Depot's bottom bar on the tree tab: what to do here, or null.
function treeHint() {
  if (!lv('root')) return ["CLICK THE TRAIN. IT'S FREE.", U.gold];
  if (NODES.some((n) => nodeState(n) === 'buy')) return ['CLICK A GLOWING NODE TO BUY IT.', U.ink];
  return null;
}

// ---------- the view
// The panel's middle on screen, and a node's place on screen.
const treeMid = () => [W / 2, Math.round((TREE.y0 + TREE.y1) / 2)];
function treeXY(tx, ty) {
  const [mx, my] = treeMid(), C = TREE.cam;
  return [Math.round(mx + (tx - C.x * T_CELL) * C.z), Math.round(my + (ty - C.y * T_CELL) * C.z)];
}
// where node id is on screen (with the tree tab open)
function nodeXY(id) {
  const n = NODE[id];
  if (!n) return null;
  const [x, y] = treeXY(n.x * T_CELL, n.y * T_CELL);
  return { x, y };
}
// half the size of a node's square at this zoom: a big node is 26 px at zoom 1, the others 20
const halfOf = (n) => Math.max(4, Math.round((n.star || n.id === 'root' ? 13 : 10) * TREE.cam.z));
// Zoom in (+1) or out (-1) one step, keeping the point under (sx, sy) where it is.
function treeZoom(dir, sx, sy) {
  const i = clamp(ZOOMS.indexOf(TREE.zt) + dir, 0, ZOOMS.length - 1);
  if (ZOOMS[i] === TREE.zt) return;
  const [mx, my] = treeMid(), C = TREE.cam;
  sx = sx ?? mx;
  sy = sy ?? my;
  TREE.zt = ZOOMS[i];
  TREE.anchor = { sx, sy, x: C.x + (sx - mx) / C.z / T_CELL, y: C.y + (sy - my) / C.z / T_CELL };
  SFX.ui();
}
// The wheel over the tree (main.js sends it here).
function treeWheel(dy) {
  treeZoom(dy < 0 ? 1 : -1, M.inside ? M.x : null, M.inside ? M.y : null);
}
// Back to LAST TRAIN in the middle, at zoom 1.
function treeCenter() {
  TREE.zt = 1;
  TREE.anchor = null;
  TREE.goTo = { x: 0, y: 0 };
}
// Move the view so node id is on the panel (tests, and the tutorial's tags).
function treeFocus(id) {
  const n = NODE[id];
  if (!n) return;
  const p = nodeXY(id), h = halfOf(n) + 30;
  if (p.x > h && p.x < W - h && p.y > TREE.y0 + h && p.y < TREE.y1 - h) return;
  TREE.cam.x = n.x;
  TREE.cam.y = n.y;
  TREE.goTo = null;
}
// Keys on the tree tab: C or HOME = centre, + / - = zoom. True when used.
function treeKey(k) {
  if (k === 'c' || k === 'Home') treeCenter();
  else if (k === '+' || k === '=') treeZoom(1);
  else if (k === '-' || k === '_') treeZoom(-1);
  else return false;
  return true;
}
// The bounds of the whole map (cells), for keeping the view on it.
const T_SPAN = (() => {
  const xs = NODES.map((n) => n.x), ys = NODES.map((n) => n.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
})();
// Each frame: the zoom glides to its step (the anchor stays under the mouse), the view glides to a
// centre it was sent to, WASD moves it, and it stays near the map.
function treeView() {
  const C = TREE.cam, k = 1 - Math.exp(-14 * frameDt);
  if (Math.abs(C.z - TREE.zt) > 0.002) C.z += (TREE.zt - C.z) * k;
  else C.z = TREE.zt;
  const a = TREE.anchor;
  if (a) {
    const [mx, my] = treeMid();
    C.x = a.x - (a.sx - mx) / C.z / T_CELL;
    C.y = a.y - (a.sy - my) / C.z / T_CELL;
    if (C.z === TREE.zt) TREE.anchor = null;
  }
  const g = TREE.goTo;
  if (g) {
    C.x += (g.x - C.x) * k;
    C.y += (g.y - C.y) * k;
    if (Math.abs(g.x - C.x) + Math.abs(g.y - C.y) < 0.01) TREE.goTo = null;
  }
  const v = 9 * frameDt / C.z;
  if (KEYS.a) C.x -= v;
  if (KEYS.d) C.x += v;
  if (KEYS.w) C.y -= v;
  if (KEYS.s) C.y += v;
  C.x = clamp(C.x, T_SPAN.x0 - 1, T_SPAN.x1 + 1);
  C.y = clamp(C.y, T_SPAN.y0 - 1, T_SPAN.y1 + 1);
}

// A soft round glow (a smooth fall-off, like bloom) in colour col, made once per colour; tGlow
// draws it with radius r at (x, y), strength a (in the 'lighter' blend mode).
const T_SOFT = new Map();
function tGlow(x, y, r, col, a) {
  let c = T_SOFT.get(col);
  if (!c) {
    const [cc, g] = mk(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), [R, G0, B] = hexRgb(col);
    gr.addColorStop(0, 'rgba(' + R + ',' + G0 + ',' + B + ',0.9)');
    gr.addColorStop(0.25, 'rgba(' + R + ',' + G0 + ',' + B + ',0.45)');
    gr.addColorStop(0.6, 'rgba(' + R + ',' + G0 + ',' + B + ',0.12)');
    gr.addColorStop(1, 'rgba(' + R + ',' + G0 + ',' + B + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    T_SOFT.set(col, (c = cc));
  }
  if (r < 1 || a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
  ctx.imageSmoothingEnabled = false;
}

// ---------- the backdrop
// A tile of star dust (faint dots, a few brighter ones with a cross) and a soft glow of colour, made once.
let T_STARS = null, T_NEB = null;
function bakeTreeBack() {
  const rng = mulberry(77);
  T_STARS = pix(256, 256, (r) => {
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rng() * 256), y = Math.floor(rng() * 256), q = rng();
      const col = q < 0.12 ? 'rgba(255,120,210,0.28)' : q < 0.3 ? 'rgba(110,190,255,0.32)' : 'rgba(200,215,240,' + (0.08 + rng() * 0.2).toFixed(2) + ')';
      r(x, y, 1, 1, col);
      if (rng() < 0.05) {
        r(x - 1, y, 1, 1, 'rgba(160,200,255,0.12)');
        r(x + 1, y, 1, 1, 'rgba(160,200,255,0.12)');
        r(x, y - 1, 1, 1, 'rgba(160,200,255,0.12)');
        r(x, y + 1, 1, 1, 'rgba(160,200,255,0.12)');
      }
    }
  });
  // the glow: deep blue round the middle, a touch of violet off to one side (smooth, like a nebula)
  const [c, g] = mk(128, 128);
  for (const [x, y, r, col] of [[64, 64, 64, '30,70,150'], [40, 46, 40, '120,40,150'], [92, 84, 34, '20,110,140']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + col + ',0.2)');
    gr.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  T_NEB = c;
}
function drawTreeBack(y0, y1) {
  if (!T_STARS) bakeTreeBack();
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, y0, W, y1 - y0);
  const C = TREE.cam;
  // the glow sits round LAST TRAIN (half the parallax), the stars far behind (a quarter)
  const [rx, ry] = treeXY(0, 0), ns = Math.round(560 * (0.6 + C.z * 0.4));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(T_NEB, Math.round(rx - ns / 2), Math.round(ry - ns / 2), ns, ns);
  ctx.imageSmoothingEnabled = false;
  const ox = mod(-Math.round(C.x * T_CELL * C.z * 0.25), 256), oy = mod(-Math.round(C.y * T_CELL * C.z * 0.25), 256);
  for (let y = y0 - 256 + mod(oy - y0, 256); y < y1; y += 256) for (let x = ox - 256; x < W; x += 256) ctx.drawImage(T_STARS, x, y);
}

// ---------- the panel
// The SKILL TREE tab, between y0 and y1.
function drawTreeTab(y0, y1) {
  TREE.y0 = y0;
  TREE.y1 = y1;
  treeView();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, W, y1 - y0);
  ctx.clip();
  drawTreeBack(y0, y1);
  // which nodes show (vis[id] = its state); a node pops in after its line has grown
  const vis = {};
  for (const n of NODES) {
    const st = nodeState(n), b = TREE.born[n.id];
    if (st === 'off' || (b != null && realT < b + GROW)) continue;
    vis[n.id] = st;
  }
  treeInput(vis, y0, y1);
  drawTreeLines(vis);
  // (only the nodes on the panel are drawn)
  const m = 40 * TREE.cam.z;
  for (const n of NODES) {
    if (!vis[n.id]) continue;
    const p = nodeXY(n.id);
    if (p.x > -m && p.x < W + m && p.y > y0 - m && p.y < y1 + m) drawTreeNode(n, vis[n.id]);
  }
  drawTreeFx();
  drawTreeHelp(y0, y1);
  const tip = TREE.hov;
  if (tip && vis[tip.id]) drawInfo(tip, vis[tip.id], y0, y1);
  ctx.restore();
}
// The node under screen point (x, y), or null.
function treeNodeAt(vis, x, y) {
  let best = null;
  for (const n of NODES) {
    if (!vis[n.id]) continue;
    const p = nodeXY(n.id), h = halfOf(n) + 2;
    if (inR(x, y, p.x - h, p.y - h, h * 2, h * 2)) best = n;
  }
  return best;
}
// The mouse: a drag moves the map; a click (no drag) on a node buys a level, or says no (a buzz
// and a shake).
function treeInput(vis, y0, y1) {
  const inPanel = (y) => y >= y0 && y < y1;
  if (M.pressed && M.down && inPanel(M.py) && !treeOnButton(M.px, M.py)) {
    TREE.drag = { x: M.px, y: M.py, cx: TREE.cam.x, cy: TREE.cam.y, moved: false };
  }
  const d = TREE.drag;
  if (d && M.down) {
    if (Math.abs(M.x - d.x) + Math.abs(M.y - d.y) > 4) d.moved = true;
    if (d.moved) {
      TREE.goTo = TREE.anchor = null;
      TREE.cam.x = d.cx - (M.x - d.x) / TREE.cam.z / T_CELL;
      TREE.cam.y = d.cy - (M.y - d.y) / TREE.cam.z / T_CELL;
    }
  }
  TREE.hov = null;
  if (M.inside && inPanel(M.y) && !(d && d.moved)) TREE.hov = treeNodeAt(vis, M.x, M.y);
  if (M.released) {
    const was = TREE.drag;
    TREE.drag = null;
    if (was && was.moved) M.used = true;
    else if (!M.used && inPanel(M.py)) {
      const n = treeNodeAt(vis, M.px, M.py);
      if (n && n === treeNodeAt(vis, M.x, M.y)) {
        M.used = true;
        treeClick(n);
      }
    }
  }
  if (TREE.hov) cursor = 'pointer';
  else if (TREE.drag && TREE.drag.moved) cursor = 'grabbing';
  else if (M.inside && inPanel(M.y)) cursor = 'grab';
}
function treeClick(n) {
  if (realT - TREE.lastBuy < 0.08) return; // the same click seen twice: one buy only
  if (buyNode(n.id)) TREE.lastBuy = realT;
  else if (nodeState(n) !== 'max') {
    TREE.shake[n.id] = realT;
    SFX.deny();
  } else SFX.ui();
}
// The zoom buttons, top right: [-] [+] CENTER. Returns true when (x, y) is on one.
const T_BTN = () => [[W - 92, '-', 15], [W - 75, '+', 15], [W - 58, 'CENTER', 52]];
const treeOnButton = (x, y) => T_BTN().some(([bx, , bw]) => inR(x, y, bx, TREE.y0 + 4, bw, 14));
function drawTreeHelp(y0) {
  for (const [bx, s, bw] of T_BTN()) {
    if (button(bx, y0 + 4, bw, 14, s)) {
      if (s === '-') treeZoom(-1);
      else if (s === '+') treeZoom(1);
      else treeCenter();
    }
  }
  text('DRAG: MOVE   WHEEL: ZOOM', 6, y0 + 7, '#3c4658', { outline: false });
}

// ---------- the lines
// A line from each shown node back to the one it grows from: a bright core with a glow once the
// node has a level (a spark runs along it now and then), a dim line in its colour while it is for
// sale, a faint one to a padlock. A new line grows out over GROW s and lights up over 0.3 s.
// The lines are drawn into T_LINES and reused while nothing about them changes (the view, the
// states); while one grows or lights up they are drawn each frame.
const T_LINES = { c: null, g: null, key: '' };
function drawTreeLines(vis) {
  const busy = NODES.some((n) => realT - (TREE.born[n.id] ?? -9) < GROW || realT - (TREE.lit[n.id] ?? -9) < 0.3);
  if (busy) treeLines(ctx, vis);
  else {
    const C = TREE.cam, key = [W, H, TREE.y0, TREE.y1, C.x.toFixed(4), C.y.toFixed(4), C.z.toFixed(4)].join(',') + '|' +
      NODES.map((n) => (vis[n.id] || '-') + lv(n.id)).join(',');
    if (!T_LINES.c || T_LINES.c.width !== W || T_LINES.c.height !== H) {
      [T_LINES.c, T_LINES.g] = mk(W, H);
      T_LINES.key = '';
    }
    if (key !== T_LINES.key) {
      T_LINES.key = key;
      T_LINES.g.clearRect(0, 0, W, H);
      treeLines(T_LINES.g, vis);
    }
    ctx.drawImage(T_LINES.c, 0, 0);
  }
  treeSparks(vis);
}
// Each shown line: calls fn(n, a, b, f, st) with n's parent at a, n at b on screen, f = how far it
// has grown, st = n's state (n itself may not have popped in yet).
function eachLine(vis, fn) {
  for (const n of NODES) {
    const p = parentOf(n), st = vis[n.id] || nodeState(n);
    if (!p || st === 'off' || !vis[p.id]) continue;
    const a = nodeXY(p.id), b = nodeXY(n.id);
    // (a line wholly off the panel is not drawn)
    if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > W || Math.max(a.y, b.y) < TREE.y0 || Math.min(a.y, b.y) > TREE.y1) continue;
    const born = TREE.born[n.id], f = born != null ? clamp((realT - born) / GROW, 0, 1) : 1;
    if (f > 0) fn(n, a, b, f, st);
  }
}
function treeLines(g, vis) {
  const z = TREE.cam.z, wide = z >= 1.4 ? 2 : 1;
  eachLine(vis, (n, a, b, f, st) => {
    const ex = lerp(a.x, b.x, f), ey = lerp(a.y, b.y, f), K = NODE_KIND[n.k];
    if (lv(n.id) > 0) {
      const lt = TREE.lit[n.id], u = lt != null ? clamp((realT - lt) / 0.3, 0, 1) : 1;
      if (u < 1) tLine(g, a.x, a.y, ex, ey, K.m, wide);
      if (u <= 0) return;
      const gx = lerp(a.x, ex, u), gy = lerp(a.y, ey, u);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.22;
      g.strokeStyle = K.g;
      g.lineWidth = Math.min(7, 5 * Math.max(0.7, z));
      g.beginPath();
      g.moveTo(a.x + 0.5, a.y + 0.5);
      g.lineTo(gx + 0.5, gy + 0.5);
      g.stroke();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      tLine(g, a.x, a.y, gx, gy, K.c, wide);
    } else if (st === 'hidden') tLine(g, a.x, a.y, ex, ey, '#1a2232', 1);
    else tLine(g, a.x, a.y, ex, ey, st === 'buy' ? K.m : '#24324a', wide);
  });
}
// A spark that runs out along each lit line every couple of seconds.
function treeSparks(vis) {
  const z = TREE.cam.z, wide = z >= 1.4 ? 2 : 1;
  eachLine(vis, (n, a, b, f) => {
    if (f < 1 || !lv(n.id) || realT - (TREE.lit[n.id] ?? -9) < 0.3) return;
    const u = mod(realT * 0.55 + (n.x * 0.37 + n.y * 0.61), 1.6);
    if (u >= 1) return;
    const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u);
    ctx.globalCompositeOperation = 'lighter';
    tGlow(x, y, 7 * Math.max(0.8, z), NODE_KIND[n.k].g, 0.8);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x) - (wide >> 1), Math.round(y) - (wide >> 1), wide, wide);
  });
}
// A crisp line of pixels on g, w px wide.
function tLine(g, x0, y0, x1, y1, col, w) {
  pl(g, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), col);
  if (w > 1) pl(g, Math.round(x0) + 1, Math.round(y0), Math.round(x1) + 1, Math.round(y1), col);
}

// ---------- a node
// The node's glow, square, icon (a padlock while it is locked), its level as 3/10 under it, the
// flash of a buy and the pop when it opens. Nodes you can buy pulse; a big node has a double frame.
function drawTreeNode(n, st) {
  const K = NODE_KIND[n.k], l = lv(n.id), m = maxLv(n), z = TREE.cam.z, p = nodeXY(n.id);
  let x = p.x, y = p.y, h = halfOf(n);
  // a click that could not buy shakes it; a node that just opened pops out of nothing
  const sk = realT - (TREE.shake[n.id] ?? -9);
  if (sk < 0.25 && !REDUCED) x += Math.round(Math.sin(sk * 70) * 2 * (1 - sk / 0.25));
  const pp = realT - (TREE.pop[n.id] ?? -9);
  if (pp >= 0 && pp < 0.25) h = Math.max(2, Math.round(h * (0.4 + 0.6 * ease(pp / 0.25) + Math.sin(pp / 0.25 * Math.PI) * 0.2)));
  const s = h * 2, nx = x - h, ny = y - h, hov = TREE.hov === n, buy = st === 'buy', big = !!n.star || n.id === 'root';
  const pulse = 0.5 + 0.5 * Math.sin(realT * 5 + n.x);
  const lock = st === 'hidden' || st === 'locked';
  // the glow round it
  const ga = lock ? 0 : st === 'max' ? 0.5 : buy ? 0.35 + 0.35 * pulse : l > 0 ? 0.4 : st === 'poor' ? 0.12 : 0.18;
  if (ga > 0 || hov) {
    ctx.globalCompositeOperation = 'lighter';
    tGlow(x, y, Math.min(h * (big ? 3 : 2.6), h + 26) + (buy ? pulse * 3 : 0), K.g, ga + (hov ? 0.15 : 0));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // the body
  ctx.fillStyle = st === 'max' ? K.d : '#070a10';
  ctx.fillRect(nx + 1, ny + 1, s - 2, s - 2);
  if (!lock) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(nx + 2, ny + 1, s - 4, 1);
  }
  // the frame: bright once it has a level or you can buy it (it pulses white), mid while you
  // cannot pay, dark grey while locked
  const fc = lock ? (hov ? '#3a4458' : '#202838') : buy ? (pulse > 0.75 ? '#ffffff' : K.c) : l > 0 ? K.c : K.m;
  frame(nx, ny, s, s, fc);
  if (big && s >= 12) {
    ctx.globalAlpha = lock ? 0.5 : 0.65;
    frame(nx + 2, ny + 2, s - 4, s - 4, fc);
    ctx.globalAlpha = 1;
  }
  if (hov) {
    ctx.globalAlpha = 0.6;
    frame(nx - 1, ny - 1, s + 2, s + 2, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // the icon: crisp, 1x up to 2x and 3x as the view zooms in (none when it is very small)
  const ic = lock ? ICON.lock : NICON[n.id] || ICON.star, k = Math.max(1, Math.floor((s - 6) / 12));
  if (s >= 13) {
    const iw = ic.width * k, ih = ic.height * k;
    ctx.globalAlpha = lock ? 0.45 : st === 'poor' && !l ? 0.55 : 1;
    blit(ic, Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih);
    ctx.globalAlpha = 1;
  } else if (!lock) {
    ctx.fillStyle = l > 0 || buy ? K.c : K.m;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  // just bought: a white flash; just popped in: a softer one
  const fl = realT - (TREE.flash[n.id] ?? -9);
  const wa = Math.max(fl < 0.15 ? 1 - fl / 0.15 : 0, pp >= 0 && pp < 0.2 ? 0.8 * (1 - pp / 0.2) : 0);
  if (wa > 0) {
    ctx.globalAlpha = wa;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(nx, ny, s, s);
    ctx.globalAlpha = 1;
  }
  // the level under it (not on a padlock, and not when the view is far out)
  if (lock || z < 0.7) return;
  let lab, lc;
  if (n.id === 'root') [lab, lc] = l ? ['', ''] : ['FREE', pulse > 0.5 ? '#ffe39a' : U.gold];
  else if (st === 'soon') [lab, lc] = ['SOON', '#5a6478'];
  else [lab, lc] = [l + '/' + m, st === 'max' ? K.c : l > 0 ? '#e6f2ff' : buy ? '#c8d4e6' : '#6c7890'];
  if (lab) text(lab, x, y + h + 2, lc, { align: 'center', outline: '#04060a' });
}
// Rings and sparks from buys, and the price floating up.
function drawTreeFx() {
  const z = TREE.cam.z;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = TREE.rings.length - 1; i >= 0; i--) {
    const r = TREE.rings[i], u = (realT - r.t) / 0.5;
    if (u >= 1) {
      TREE.rings.splice(i, 1);
      continue;
    }
    if (u < 0) continue;
    const n = NODE[r.id], p = nodeXY(r.id), e = halfOf(n) + ease(u) * (r.big ? 30 : 18) * z;
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.strokeStyle = r.c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + 0.5, p.y + 0.5, e, 0, TAU);
    ctx.stroke();
  }
  for (let i = TREE.sparks.length - 1; i >= 0; i--) {
    const s = TREE.sparks[i], t = realT - s.t;
    if (t >= s.T) {
      TREE.sparks.splice(i, 1);
      continue;
    }
    const d = 1 - Math.exp(-4 * t), [x, y] = treeXY(s.x + s.vx * d / 4 * 1.6, s.y + s.vy * d / 4 * 1.6);
    ctx.globalAlpha = 1 - t / s.T;
    ctx.fillStyle = s.c;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = TREE.floats.length - 1; i >= 0; i--) {
    const f = TREE.floats[i], u = (realT - f.t) / 0.9;
    if (u >= 1) {
      TREE.floats.splice(i, 1);
      continue;
    }
    const p = nodeXY(f.id), h = halfOf(NODE[f.id]), d = Math.round(ease(u) * 14);
    ctx.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
    text(f.s, p.x, p.y - h - 12 - d, f.c, { align: 'center' });
    ctx.globalAlpha = 1;
  }
}

// ---------- the tooltip
// Split s into lines no wider than w px.
function wrap(s, w) {
  const out = [];
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (line && tw(t) > w) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}
// The NOW > NEXT line for stat [label, value at a level]: [[text, colour], ...] (just NOW when every
// level is bought, or when the next level does not change it)
function statSegs(stat, l, done) {
  const [label, val] = stat, now = String(val(l));
  if (done || now === String(val(l + 1))) return [[label, U.dim], [now, U.ink]];
  return [[label, U.dim], [now, now === 'NONE' || now === 'LOCKED' ? U.faint : U.ink], ['>', U.faint], [String(val(l + 1)), U.green]];
}
// The tooltip for node n beside it: NAME and LEVEL x/y, a line in its colour, what it does, NOW >
// NEXT, then the price (red when you cannot pay) and what a click does.
const INFO_W = 216;
function drawInfo(n, st, y0, y1) {
  const K = NODE_KIND[n.k], l = lv(n.id), m = maxLv(n), lock = st === 'hidden', p = parentOf(n);
  const named = !lock || !n.later || (p && lv(p.id) > 0);
  const inner = INFO_W - 14;
  const desc = wrap(named ? n.desc : '???', inner);
  const vals = lock || !n.stat ? [] : [n.stat, n.stat2].filter(Boolean).map((s) => statSegs(s, l, l >= m));
  // the foot: [price text, colour, price icon, right text, colour]
  const surv = n.cur === 'surv', pr = priceOf(n), have = surv ? SAVE.surv : SAVE.scrap, icon = surv ? ICON.survS : ICON.boltS;
  const pcol = !canPay(n) ? U.red : surv ? U.green : U.gold;
  let foot;
  if (n.later) foot = ['', U.faint, null, 'COMING SOON', U.faint];
  else if (lock) foot = [fmt(pr), canPay(n) ? U.dim : U.red, icon, 'NEEDS: ' + nodeLv(p.id, needOf(n)), U.amber];
  else if (st === 'max') foot = ['', U.dim, null, n.id === 'root' || m === 1 ? 'OWNED' : 'MAXED', K.c];
  else if (st === 'locked') foot = ['', U.dim, null, 'HOLD FARM STOP ONCE TO GET IT.', U.amber];
  else if (st === 'soon') foot = [fmt(pr), U.faint, icon, 'COMING SOON', U.faint];
  else if (st === 'poor') foot = [fmt(pr), U.red, icon, 'NEED ' + fmt(pr - have) + ' MORE', U.red];
  else foot = pr ? [fmt(pr), pcol, icon, 'CLICK TO BUY', U.gold] : ['FREE', U.gold, null, 'CLICK TO TAKE IT', U.gold];
  const kindName = n.id === 'root' ? 'THE ROOT' : n.star ? 'BIG UNLOCK' : n.k === 'spec' ? 'SPECIAL' : 'UPGRADE';
  const w = INFO_W, h = 31 + desc.length * 10 + vals.length * 10 + 17;
  // beside the node (right, else left), kept on the panel
  const q = nodeXY(n.id), hn = halfOf(n);
  let x = q.x + hn + 10;
  if (x + w > W - 4) x = q.x - hn - 10 - w;
  if (x < 4) x = clamp(q.x - w / 2, 4, W - w - 4);
  let y = clamp(q.y - Math.round(h / 2), y0 + 22, y1 - h - 4);
  if (x === clamp(q.x - w / 2, 4, W - w - 4)) y = q.y + hn + 12 + h < y1 ? q.y + hn + 12 : q.y - hn - 12 - h;
  x = Math.round(x);
  y = Math.round(y);
  // the box: near black, a frame and a line under the head in the node's colour
  ctx.fillStyle = 'rgba(5,8,13,0.97)';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, lock ? '#2a3448' : K.m);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = K.g;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  text(named ? n.name : '???', x + 7, y + 5, lock ? U.dim : '#ffffff');
  text(lock && !n.later ? 'LOCKED' : n.id === 'root' ? (l ? 'OWNED' : '0/1') : l + '/' + m, x + w - 7, y + 5, lock ? U.faint : st === 'max' ? K.c : U.ink, { align: 'right' });
  text(kindName, x + 7, y + 14, lock ? '#3c4658' : K.m, { outline: false });
  ctx.fillStyle = lock ? '#1c2434' : K.m;
  ctx.fillRect(x + 6, y + 23, w - 12, 1);
  let ty = y + 27;
  for (const d of desc) {
    text(d, x + 7, ty, lock ? U.faint : U.ink);
    ty += 10;
  }
  for (const segs of vals) {
    let tx = x + 7;
    for (const [s, c] of segs) tx += text(s, tx, ty, c) + 5;
    ty += 10;
  }
  ctx.fillStyle = '#161c28';
  ctx.fillRect(x + 6, ty + 1, w - 12, 1);
  ty += 5;
  const [lt, lc, li, rt, rc] = foot;
  let fx = x + 7;
  if (li) {
    blit(li, fx - 1, ty);
    fx += 7;
  }
  if (lt) text(lt, fx, ty, lc);
  if (rt) {
    const blink = rc === U.gold && Math.sin(realT * TAU) < -0.3;
    text(rt, x + w - 7, ty, blink ? '#ffe39a' : rc, { align: 'right' });
  }
}

// The world is not drawn (nor run) while the skill tree covers it.
const treeCovers = () => mode === 'depot' && depotTab === 'tree';

// ---------- the new nodes' icons (12 x 12; sprites.js turns them into NICON at startup)
Object.assign(NODE_ART, {
  // HELI DAMAGE: a round and a red plus
  hdmg: ['...l........', '..lsl.......', '..lsl.......', '.yGGg.......', '.yGgg...RR..', '.yGgg...RR..',
    '.yGgg.RRRRRR', '.yGgg.RRRRRR', '.yGgg...RR..', '.yGgg...RR..', '.yyyy.......', '............'],
  // HELI FIRE RATE: rounds flying, with speed lines
  hrate: ['............', '............', '..d...yGGGl.', '.d...yGGGGsl', '..d...yGGGl.', '............',
    '............', '.d..yGGGl...', 'd..yGGGGsl..', '.d..yGGGl...', '............', '............'],
  // HELI RANGE: a radar ring round a red dot
  hrange: ['....BBBB....', '..BB....BB..', '.B........B.', '.B...ll...B.', 'B...l..l...B', 'B..l.RR.l..B',
    'B..l.RR.l..B', 'B...l..l...B', '.B...ll...B.', '.B........B.', '..BB....BB..', '....BBBB....'],
  // BONUS SCRAP: a stack of gold and a green plus
  bonus: ['.........E..', '........EEE.', '.........E..', '...yGGGy....', '..ygggggy...', '..yGGGGGy...',
    '..ygggggy...', '..yGGGGGy...', '..ygggggy...', '..yGGGGGy...', '..yyyyyyy...', '............'],
  // BIG BONUS: a sack of scrap
  bonusP: ['....n..n....', '.....nn.....', '....nNNn....', '...nNNNNn...', '..nNNGNNNn..', '.nNNGGGNNNn.',
    '.nNNNGNNNNn.', '.nNNGGGNNNn.', '.nNNNNGNNNn.', '.nNNGGGNNNn.', '..nnnnnnnn..', '............'],
  // EXPLOSIVE ZOMBIES: a bomb with a lit fuse
  boom: ['.......Y.O..', '........Y...', '.......dY...', '......d.....', '...dddd.....', '..dmmmmd....',
    '.dmllmmmd...', '.dmlmmmmd...', '.dmmmmmmd...', '.dmmmmmmd...', '..dmmmmd....', '...dddd.....'],
  // BLAST RADIUS: a burst of fire
  boomR: ['.....O......', '..O..Y..O...', '...OYYYO....', '..OYwwwYO...', '.OYwwwwwYO..', 'OOYwwwwwYOO.',
    '.OYwwwwwYO..', '..OYwwwYO...', '...OYYYO....', '..O..Y..O...', '.....O......', '............'],
  // RAM TIME: a clock and the Ram's chevrons
  ramtime: ['...dlllld...', '..l......l..', '.l...w....l.', 'l....w.....l', 'l....w.....l', 'l....wwww..l',
    'l..........l', '.l........l.', '..l......l..', '...dlllld...', '....YO.YO...', '...YO.YO....'],
  // RAM CHARGE: a battery with a bolt
  charge: ['....llll....', '..llllllll..', '..l......l..', '..l...Y..l..', '..l..YY..l..', '..lOOYOOOl..',
    '..lOYYYYOl..', '..lOOOYYOl..', '..lOOOYOOl..', '..lOOOOOOl..', '..llllllll..', '............'],
  // POWER SHOT: a huge glowing shell
  power: ['.....ww.....', '....wYYw....', '...wYOOYw...', '...YOOOOY...', '...lsssss...', '...lslllm...',
    '...lslllm...', '...lslllm...', '...lslllm...', '...ggggGg...', '...yggggy...', '...yyyyyy...'],
  // STRAFING RUN: the attack jet from above
  strafe: ['.....ll.....', '.....ss.....', '.....BB.....', '.....ll.....', 'ssssssssssss', 'mllllllllllm',
    '.....ll.....', '...dmllmd...', '...dmllmd...', '.....ll.....', '..llllllll..', '..m..mm..m..'],
  // STRAFE DAMAGE: a row of hits
  strafeD: ['............', '.........O..', '........OYO.', '.........O..', '......O.....', '.....OYO....',
    '......O.....', '...O........', '..OYO.......', '...O........', 'l...........', 'sl..........'],
  // WIDE RUN: arrows apart
  strafeW: ['............', '............', '..O......O..', '.OO......OO.', 'OOOOOOOOOOOO', '.OO......OO.',
    '..O......O..', '............', 'llllllllllll', '............', '............', '............'],
  // MORE RUNS: a jet and a pink plus
  strafeN: ['...l........', '...s........', '...B........', 'sssssss.....', 'mlllllm.....', '...l........',
    '..lll...RR..', '........RR..', '......RRRRRR', '......RRRRRR', '........RR..', '........RR..'],
  // BOMB RUN: a falling bomb
  strafeB: ['....l..l....', '....lmml....', '.....mm.....', '....mllm....', '....mllm....', '....mlmm....',
    '....mlmm....', '....mmmm....', '.....mm.....', '..O..O...O..', '.OYO.Y..OYO.', '..O.....O...'],
  // TWIN JETS: two jets side by side
  twin: ['..l......l..', '..s......s..', '..B......B..', 'sssss..sssss', 'mlllm..mlllm', '..l......l..',
    '.lll....lll.', '............', '............', '............', '............', '............']
});
// SILVER ZOMBIES: the golden zombie's icon in silver
NODE_ART.silver = NODE_ART.goldz.map((r) => r.replace(/y/g, 'm').replace(/G/g, 'w').replace(/g/g, 's'));
