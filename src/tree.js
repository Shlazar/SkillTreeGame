// tree.js - the skill tree. One table, NODES, drives all of it: the map on the SKILL TREE tab of the
// Depot, how each node looks, the info box (what it does, NOW > NEXT, the price), buying, and the
// goal line under the summary. What a node does in a run is read from the UP numbers in game.js,
// the same numbers the info box shows.

// ---------- the nodes
// The 4 branches: their colour and the faint name drawn by them.
const BRANCH = {
  root: { col: U.ink, name: '' },
  heli: { col: U.blue, name: 'HELI' },
  train: { col: U.gold, name: 'TRAIN' },
  station: { col: U.teal, name: 'STATION' },
  explore: { col: U.green, name: 'EXPLORE' }
};
// A value with its unit, for the info box. (2 px on the ground = 1 m.)
const perS = (v) => v + '/S', secs = (v) => +v.toFixed(1) + ' S', metres = (px) => Math.round(px / 2) + ' M';
const hotS = (t) => (isFinite(t) ? Math.round(t) + ' S' : 'NEVER');
// Each node: id, name, br = branch, c, r = its cell on the map (32 px each; r < 0 is up), needs =
// [the node it grows from, the level that node must have], cost = the price of each level (as many
// levels as prices), cur = 'surv' when it costs survivors (else scrap), star = a big unlock (*),
// desc = one short sentence, stat (and stat2) = [label, value at level l] for the NOW > NEXT line.
// given = not for sale (holding Farm Stop gives it). soon = shown with its price, not for sale yet.
// later = a node from later in the game: a '?' for now.
const NODES = [
  { id: 'root', name: 'LAST TRAIN', br: 'root', c: 0, r: 0, cost: [0], desc: 'THE START OF YOUR WHOLE TREE.',
    stat: ['BRANCHES OPEN', (l) => l * 4] },
  // TRAIN
  { id: 'cow', name: 'COW CATCHER', br: 'train', c: 2, r: 0, needs: ['root', 1], cost: [80],
    desc: 'A STEEL PLOW THROWS ZOMBIES ASIDE.', stat: ['WALKERS SLOW THE TRAIN', (l) => (l ? 'NO' : 'YES')],
    stat2: ['BRUTES', () => 'STILL STOP THE TRAIN'] },
  { id: 'armor', name: 'ARMOR', br: 'train', c: 2, r: -2, needs: ['cow', 1], cost: [40, 80, 160, 320, 640],
    desc: 'STEEL PLATES: MORE TRAIN HEALTH.', stat: ['TRAIN HP', (l) => UP.hp(l)] },
  { id: 'gun', name: 'FLATCAR GUN', star: true, br: 'train', c: 4, r: 0, needs: ['cow', 1], cost: [300],
    desc: 'AN AUTO GUN ON THE TRAIN.', stat: ['TRAIN GUN', (l) => (l ? perS(UP.gun(0)) : 'NONE')],
    stat2: ['IT SHOOTS UP TO', () => metres(CFG.gun.range) + ' AWAY'] },
  { id: 'gunspd', name: 'GUN SPEED', br: 'train', c: 6, r: 0, needs: ['gun', 1], cost: [150, 300, 600],
    desc: 'THE TRAIN GUN SHOOTS FASTER.', stat: ['TRAIN GUN', (l) => perS(UP.gun(l))] },
  { id: 'ram', name: 'TURBO RAM', star: true, br: 'train', c: 4, r: -2, needs: ['gun', 1], cost: [500],
    desc: 'PRESS E: SMASH THROUGH THE DEAD.',
    stat: ['TURBO RAM', (l) => (l ? CFG.ram.dur + ' S AT ' + Math.round(CFG.ram.speed / CFG.train.cruise) + '× SPEED' : 'NONE')],
    stat2: ['FULL AGAIN AFTER', () => CFG.ram.charge + ' KILLS'] },
  // HELI
  { id: 'chain', name: 'CHAIN SHOT', br: 'heli', c: -2, r: 0, needs: ['root', 1], cost: [60, 150, 400],
    desc: 'A KILL SPARKS ON TO MORE ZOMBIES.', stat: ['CHAIN JUMPS', (l) => UP.chain(l)],
    stat2: ['A JUMP REACHES', () => metres(SK.chain.reach)] },
  { id: 'cool', name: 'COOLING', br: 'heli', c: -4, r: 0, needs: ['chain', 1], cost: [40, 80, 160],
    desc: 'THE 25MM GETS HOT MORE SLOWLY.', stat: ['OVERHEAT AFTER', (l) => hotS(UP.hot(l))] },
  { id: 'feed', name: 'FAST FEED', br: 'heli', c: -6, r: 0, needs: ['cool', 1], cost: [60, 120, 240, 480, 960],
    desc: 'MORE 25MM ROUNDS, NO EXTRA HEAT.', stat: ['25MM FIRE RATE', (l) => perS(UP.rate(l))] },
  { id: 'heavy', name: 'HEAVY ROUNDS', br: 'heli', c: -6, r: -2, needs: ['feed', 1], cost: [200, 400, 800],
    desc: 'EACH 25MM HIT DOES MORE DAMAGE.', stat: ['25MM DAMAGE', (l) => UP.dmg(l)],
    stat2: ['HITS TO KILL A BRUTE', (l) => Math.ceil(CFG.types[2].hp / UP.dmg(l))] },
  { id: 'he', name: '105MM CANNON', star: true, br: 'heli', c: -2, r: -2, needs: ['chain', 1], cost: [5], cur: 'surv',
    desc: 'A BIG SHELL FOR BIG CROWDS.', stat: ['105MM', (l) => (l ? 'RELOAD ' + secs(UP.reload(0)) : 'NONE')],
    stat2: ['FIRE WITH', () => 'RIGHT CLICK / SPACE'] },
  { id: 'reload', name: 'FAST RELOAD', br: 'heli', c: -4, r: -2, needs: ['he', 1], cost: [150, 300, 600],
    desc: 'THE 105MM LOADS FASTER.', stat: ['105MM RELOAD', (l) => secs(UP.reload(l))] },
  // EXPLORE
  { id: 'goldz', name: 'GOLDEN ZOMBIES', br: 'explore', c: 0, r: -2, needs: ['root', 1], cost: [60, 150, 400],
    desc: 'RARE GOLD ZOMBIES. CHASE THEM DOWN!', stat: ['GOLDEN ZOMBIES', (l) => (l ? '1 IN ' + UP.gold(l) : 0)],
    stat2: ['EACH ONE PAYS', () => SK.gold.value + ' SCRAP'] },
  { id: 'radio', name: 'RADIO RANGE', br: 'explore', c: 0, r: -4, needs: ['goldz', 1], cost: [40, 80, 160, 320, 640],
    desc: 'FLY FURTHER AWAY FROM THE TRAIN.', stat: ['RADIO RANGE', (l) => metres(UP.range(l))] },
  { id: 'magnet', name: 'MAGNET', br: 'explore', c: -2, r: -4, needs: ['radio', 1], cost: [40, 80, 160],
    desc: 'GRAB LOOT FROM FURTHER AWAY.', stat: ['PICKUP RANGE', (l) => metres(UP.pickup(l))] },
  { id: 'scav', name: 'SCAVENGER', br: 'explore', c: 2, r: -4, needs: ['radio', 1], cost: [150, 300, 600, 1200, 2400],
    desc: 'MORE SCRAP FROM EVERY KILL.', stat: ['KILL SCRAP', (l) => '+' + Math.round(UP.scav(l) * 100) + '%'] },
  { id: 'winch', name: 'WINCH', star: true, br: 'explore', c: 0, r: -6, needs: ['radio', 2], cost: [5], cur: 'surv',
    desc: 'LIFT SURVIVORS OUT OF THE FIELD.', stat: ['WINCH', (l) => (l ? 'LIFTS IN ' + secs(CFG.winch.hover) : 'NONE')] },
  // STATION
  { id: 'farm', name: 'FARM STOP', br: 'station', c: 0, r: 2, needs: ['root', 1], cost: [0], given: true,
    desc: 'YOUR FIRST STATION TO BUILD AT.', stat: ['STATION TAB', (l) => (l ? 'OPEN' : 'LOCKED')] },
  { id: 'nestspd', name: 'NEST SPEED', br: 'station', c: -2, r: 3, needs: ['farm', 1], cost: [150, 300, 600],
    desc: 'ALL YOUR MG NESTS SHOOT FASTER.', stat: ['MG NEST', (l) => perS(UP.nest(l))] },
  { id: 'wire', name: 'BARBED WIRE', br: 'station', c: 2, r: 3, needs: ['farm', 1], cost: [100],
    desc: 'BUILD WIRE THAT SLOWS THE DEAD.',
    stat: ['ZOMBIE SPEED ON WIRE', (l) => (l ? Math.round(CFG.wire.slow * 100) : 100) + '%'] },
  { id: 'mortar', name: 'MORTAR PIT', star: true, br: 'station', c: 0, r: 4, needs: ['nestspd', 1], cost: [8], cur: 'surv',
    soon: true, desc: 'A BIG GUN FOR YOUR STATION.' },
  // later in the game: a '?' for now
  { id: 'ramtime', name: 'RAM TIME', br: 'train', c: 6, r: -2, needs: ['ram', 1], cost: [0], later: true, desc: 'THE RAM LASTS LONGER.' },
  { id: 'charge', name: 'QUICK CHARGE', br: 'train', c: 6, r: -4, needs: ['ram', 1], cost: [0], later: true, desc: 'THE RAM FILLS UP FASTER.' },
  { id: 'autoram', name: 'AUTO RAM', star: true, br: 'train', c: 8, r: -2, needs: ['ramtime', 1], cost: [0], later: true,
    desc: 'THE TRAIN RAMS BY ITSELF.' },
  { id: 'horn', name: 'SHOCK HORN', star: true, br: 'train', c: 8, r: 0, needs: ['gunspd', 1], cost: [0], later: true,
    desc: 'PRESS Q: BLAST THE DEAD OFF.' },
  { id: 'crates', name: 'MORE CRATES', br: 'explore', c: 2, r: -6, needs: ['scav', 1], cost: [0], later: true,
    desc: 'MORE SUPPLY CRATES OUT THERE.' },
  { id: 'platform', name: 'BIG PLATFORM', br: 'station', c: 4, r: 3, needs: ['wire', 1], cost: [0], later: true,
    desc: 'MORE SURVIVORS AT EACH STATION.' }
];
const NODE = {};
for (const n of NODES) NODE[n.id] = n;
// the first ring: one exciting node per branch, right round LAST TRAIN
const FIRST = ['chain', 'cow', 'goldz'];
const maxLv = (n) => n.cost.length;
const parentOf = (n) => (n.needs ? NODE[n.needs[0]] : null);
const needsMet = (n) => !n.needs || lv(n.needs[0]) >= n.needs[1];
// the price of the next level, and whether you can pay it
const priceOf = (n) => n.cost[Math.min(lv(n.id), maxLv(n) - 1)];
const canPay = (n) => (n.cur === 'surv' ? SAVE.surv : SAVE.scrap) >= priceOf(n);
// "ARMOR 1", "RADIO RANGE 2": a node at a level, as NEEDS: and the goal line say it
const nodeLv = (id, l) => NODE[id].name + (maxLv(NODE[id]) > 1 ? ' ' + l : '');
// What a node is now:
//  'off'    not on the map yet (until LAST TRAIN is bought only it shows)
//  'hidden' a '?': what it grows from has no level yet (or it is from later in the game)
//  'locked' FARM STOP before Farm Stop is held
//  'soon'   shown with its price, not for sale yet
//  'goal'   a * node whose needs are not met yet
//  'poor'   for sale, but you cannot pay
//  'buy'    for sale, and you can pay
//  'max'    every level bought
function nodeState(n) {
  if (n.id !== 'root' && !lv('root')) return 'off';
  if (n.later) return 'hidden';
  if (lv(n.id) >= maxLv(n)) return 'max';
  if (n.given) return 'locked';
  if (n.star) {
    if (n.br === 'station' && !stationOpen()) return 'hidden';
    if (n.soon) return 'soon';
    if (!needsMet(n)) return 'goal';
  } else if (!needsMet(n)) return 'hidden';
  return canPay(n) ? 'buy' : 'poor';
}
// 0 = not on the map, 1 = a '?', 2 = shown
const shownAs = (n) => ({ off: 0, hidden: 1 })[nodeState(n)] ?? 2;

// ---------- buying
// TREE = the panel's state: born[id] = when its line starts to grow (the node pops in 0.3 s later),
// pop[id] = when it popped in (a NEW tag shows for 3 s), lit[id] = when its line lit up, flash[id]
// = its last buy, shake[id] = a click that could not buy, rings and floats after a buy, sel = the
// last node clicked, hov = the node under the mouse, pan = how far the map is dragged (small windows).
const TREE = {};
function resetTree() {
  Object.assign(TREE, { born: {}, pop: {}, lit: {}, flash: {}, shake: {}, rings: [], floats: [], sel: null, hov: null,
    pan: { x: 0, y: 0 }, drag: null, lastBuy: -9 });
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
  SFX.buy(n.star || n.id === 'root');
  return true;
}
// The look of a buy: a white flash, a gold ring growing out, the price floating up, the line lit.
function boughtFx(n, p) {
  TREE.flash[n.id] = realT;
  TREE.rings.push({ id: n.id, t: realT });
  if (p) TREE.floats.push({ id: n.id, s: '-' + fmt(p), c: n.cur === 'surv' ? U.green : U.gold, t: realT });
  if (lv(n.id) === 1) TREE.lit[n.id] = realT;
}
// After a change: nodes that just came onto the map grow their line, one after another outward;
// a '?' that just showed what it is pops in with a NEW tag.
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
// The cheapest * node you can work toward ("NEXT GOAL: FLATCAR GUN (300 SCRAP)"), with "YOU CAN BUY
// IT NOW!" when you can, or what it needs first. Once no * node is left, the cheapest next level.
// [[text, colour], ...]
function summaryGoal() {
  if (!lv('root')) return [["NEXT: OPEN THE SKILL TREE. IT'S FREE.", U.gold]];
  const unit = (n) => (n.cur === 'surv' ? ' SURVIVORS' : ' SCRAP');
  const price = (n) => (priceOf(n) ? fmt(priceOf(n)) + unit(n) : 'FREE');
  // how close you are: "YOU HAVE 120 / 300 SCRAP."
  const have = (n) => ['YOU HAVE ' + fmt(n.cur === 'surv' ? SAVE.surv : SAVE.scrap) + ' / ' + fmt(priceOf(n)) + unit(n) + '.', U.dim];
  const order = (a, b) => (a.cur === 'surv') - (b.cur === 'surv') || priceOf(a) - priceOf(b);
  const pickOf = (list, st) => list.filter((n) => st.includes(nodeState(n))).sort(order)[0];
  // the first ring (CHAIN SHOT, COW CATCHER, GOLDEN ZOMBIES) until each has a level: one you can
  // buy now first, else the cheapest
  const first = FIRST.map((id) => NODE[id]).filter((n) => !lv(n.id));
  const f1 = pickOf(first, ['buy']) || pickOf(first, ['poor']);
  if (f1) return [['NEXT GOAL: ' + f1.name + ' (' + price(f1) + ')', U.gold],
    nodeState(f1) === 'buy' ? ['YOU CAN BUY IT NOW!', U.green] : have(f1)];
  const stars = NODES.filter((n) => n.star), rest = NODES.filter((n) => !n.star && !n.given);
  const ready = pickOf(stars, ['buy']), goal = ready || pickOf(stars, ['poor', 'goal']);
  if (goal) {
    const L = [['NEXT GOAL: ' + goal.name + ' (' + price(goal) + ')', U.gold]];
    if (ready) L.push(['YOU CAN BUY IT NOW!', U.green]);
    else if (!needsMet(goal)) L.push(['IT NEEDS ' + nodeLv(goal.needs[0], goal.needs[1]) + ' FIRST.', U.dim]);
    else L.push(have(goal));
    return L;
  }
  const next = pickOf(rest, ['buy']) || pickOf(rest, ['poor']);
  if (!next) return [];
  const L = [['NEXT GOAL: ' + nodeLv(next.id, lv(next.id) + 1) + ' (' + price(next) + ')', U.gold]];
  L.push(nodeState(next) === 'buy' ? ['YOU CAN BUY IT NOW!', U.green] : have(next));
  return L;
}
// The Depot's bottom bar on the tree tab: what to do here, or null.
function treeHint() {
  if (!lv('root')) return ["CLICK THE TRAIN. IT'S FREE.", U.gold];
  if (NODES.some((n) => nodeState(n) === 'buy')) return ['CLICK A GOLD NODE TO BUY IT.', U.ink];
  return null;
}

// ---------- the map
// The cells: 32 px apart, or closer on a small window so the whole map still fits (down to 26 px
// across and 24 down; on a window smaller still, the map can be dragged). SPAN = the columns and
// rows in use. PAD = the room round the outer nodes: half a node at the sides and the top, and the
// pips, the price and the gold corners under the bottom one.
const CELL = 32;
const SPAN = (() => {
  const cs = NODES.map((n) => n.c), rs = NODES.map((n) => n.r);
  return { c0: Math.min(...cs), c1: Math.max(...cs), r0: Math.min(...rs), r1: Math.max(...rs) };
})();
const PAD = { x: 16, top: 15, bot: 31 };
// The root's place on screen and the gaps between cells. The map sits round the middle of the panel
// (half a cell left, as the right side has more nodes); on a window too small for it, it can be
// dragged (or moved with WASD) and TREE.pan says how far.
// Returns [x, y, can pan across, can pan up and down, gap across, gap down].
function treeOrigin() {
  const y0 = 19, y1 = H - 29, P = TREE.pan;
  // the panel's room for the map: 8 px in from each side, 4 under the top bar, 2 over the bottom one
  const cx = clamp(Math.floor((W - 16 - PAD.x * 2) / (SPAN.c1 - SPAN.c0)), 26, CELL);
  const cy = clamp(Math.floor((y1 - y0 - 6 - PAD.top - PAD.bot) / (SPAN.r1 - SPAN.r0)), 24, CELL);
  // one axis: the map from a to b (round the root) inside lo..hi. It sits at want when it fits;
  // else the pan moves it, and the pan is kept so the map's edges stay on screen.
  const fit = (lo, hi, a, b, want, k) => {
    const top = hi - b, bot = lo - a;
    if (bot <= top) {
      P[k] = 0;
      return [Math.round(clamp(want, bot, top)), 0];
    }
    const o = clamp(want + P[k], top, bot);
    P[k] = o - want;
    return [Math.round(o), 1];
  };
  const [ox, px] = fit(8, W - 8, SPAN.c0 * cx - PAD.x, SPAN.c1 * cx + PAD.x, W / 2 - cx / 2, 'x');
  const [oy, py] = fit(y0 + 4, y1 - 2, SPAN.r0 * cy - PAD.top, SPAN.r1 * cy + PAD.bot, (y0 + y1) / 2, 'y');
  return [ox, oy, px, py, cx, cy];
}
// where node id is on screen (with the tree tab open)
function nodeXY(id) {
  const n = NODE[id];
  if (!n) return null;
  const [ox, oy, , , cx, cy] = treeOrigin();
  return { x: ox + n.c * cx, y: oy + n.r * cy };
}
// half the size of a node's square: a * node is 26 px, the others 22
const halfOf = (n) => (n.star ? 13 : 11);
// How far below its middle a node's pips and price reach (px).
const below = (n, st) => halfOf(n) + (st === 'hidden' || st === 'max' || st === 'locked' ? 0 : 3 + (maxLv(n) > 1 ? 5 : 0) + 9);
// When a node shows up on the map (after its line has grown); 0 = it was always there.
const appearAt = (n) => (TREE.born[n.id] != null ? TREE.born[n.id] + GROW : 0);

// The SKILL TREE tab, between y0 and y1.
const RECTS = [];
function drawTreeTab(y0, y1) {
  const can = treeOrigin();
  treeInput(y0, y1, can[2] || can[3]);
  const [ox, oy, canX, canY, cx, cy] = treeOrigin();
  TREE.y0 = y0;
  // the panel: darker than the Depot round it, with a faint dot at every cell
  ctx.fillStyle = 'rgba(6,7,9,0.42)';
  ctx.fillRect(0, y0, W, y1 - y0);
  // nothing on the map draws over the top or bottom bar
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, W, y1 - y0);
  ctx.clip();
  ctx.fillStyle = 'rgba(232,223,200,0.06)';
  for (let y = mod(oy + cy / 2 - y0, cy) + y0; y < y1; y += cy) for (let x = mod(ox + cx / 2, cx); x < W; x += cx) ctx.fillRect(x, y, 1, 1);
  const pos = (n) => [ox + n.c * cx, oy + n.r * cy];
  // which nodes show (vis[id] = its state), and their boxes (the info box must not cover one)
  let vis = {};
  const layout = () => {
    RECTS.length = 0;
    vis = {};
    for (const n of NODES) {
      const st = nodeState(n);
      if (st === 'off' || realT < appearAt(n)) continue;
      vis[n.id] = st;
      // [x, y, w, h, how bad it is to cover it: a '?' least, a node you can buy most]
      const [x, y] = pos(n), h = halfOf(n);
      RECTS.push([x - h - 2, y - h - 2, h * 2 + 4, h + below(n, st) + 4, st === 'hidden' ? 1 : st === 'buy' ? 5 : 3]);
    }
  };
  layout();
  // the node under the mouse
  TREE.hov = null;
  if (!TREE.drag && M.inside && M.y >= y0 && M.y < y1) {
    for (const n of NODES) {
      if (!vis[n.id]) continue;
      const [x, y] = pos(n), h = halfOf(n) + 2;
      if (inR(M.x, M.y, x - h, y - h, h * 2, h * 2)) TREE.hov = n;
    }
  }
  if (TREE.hov) cursor = 'pointer';
  else if (canX || canY) cursor = TREE.drag && TREE.drag.moved ? 'grabbing' : 'grab';
  // a click on a node: buy a level, or say no (a buzz and a shake); either way its info stays up
  const hn = TREE.hov, hh = hn ? halfOf(hn) + 2 : 0, [hx, hy] = hn ? pos(hn) : [0, 0];
  if (hn && M.released && !M.used && inR(M.px, M.py, hx - hh, hy - hh, hh * 2, hh * 2)) {
    M.used = true;
    const n = hn;
    TREE.sel = n.id;
    if (realT - TREE.lastBuy < 0.08) { /* the same click seen twice: one buy only */ }
    else if (buyNode(n.id)) {
      TREE.lastBuy = realT;
      layout();
    } else if (nodeState(n) !== 'max') {
      TREE.shake[n.id] = realT;
      SFX.deny();
    } else SFX.ui();
  }
  // the faint branch names at the far end of each branch
  ctx.globalAlpha = 0.55;
  for (const [id, br, dx, dy, al] of [['feed', 'heli', 0, 33, 'center'], ['gunspd', 'train', 0, 33, 'center'],
    ['winch', 'explore', -19, -3, 'right'], ['mortar', 'station', 19, -3, '']]) {
    if (!vis[id]) continue;
    const [x, y] = pos(NODE[id]);
    text(BRANCH[br].name, x + dx, y + dy, BRANCH[br].col, { align: al, outline: false });
  }
  ctx.globalAlpha = 1;
  // the lines, under the nodes
  for (const n of NODES) {
    const p = parentOf(n);
    if (!p || nodeState(n) === 'off' || !vis[p.id]) continue;
    const [x0, y0n] = pos(p), [x1, y1n] = pos(n), b = TREE.born[n.id];
    const f = b != null ? clamp((realT - b) / GROW, 0, 1) : 1;
    if (f <= 0) continue;
    const st = nodeState(n), base = st === 'hidden' ? '#2a2d34' : '#3e424c';
    pl(ctx, x0, y0n, lerp(x0, x1, f), lerp(y0n, y1n, f), base);
    if (lv(n.id) > 0 && !n.later) {
      const lt = TREE.lit[n.id], g = lt != null ? clamp((realT - lt) / 0.25, 0, 1) : 1;
      if (g > 0) pl(ctx, x0, y0n, lerp(x0, x1, g * f), lerp(y0n, y1n, g * f), BRANCH[n.br].col);
    }
  }
  // the node whose info shows: the one under the mouse, else the last one clicked (before the tree
  // is open, LAST TRAIN). Gold corners mark it.
  let show = TREE.hov || NODE[TREE.sel] || (!lv('root') ? NODE.root : null);
  if (show && !vis[show.id]) show = null;
  if (show) {
    const [x, y] = pos(show), h = halfOf(show) + 4, b = below(show, vis[show.id]) + 4;
    corners(x - h, y - h, h * 2 + 1, h + b + 1, U.gold);
  }
  // the very first time, LAST TRAIN glows: it is all there is, and it is free
  if (!lv('root')) {
    const [x, y] = pos(NODE.root);
    ctx.globalCompositeOperation = 'lighter';
    light(x, y, 36, '#e3b04b', 0.4 + 0.2 * Math.sin(realT * TAU));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // the nodes
  for (const n of NODES) if (vis[n.id]) drawNode(n, ...pos(n), vis[n.id]);
  // rings and prices from buys
  drawTreeFx(pos);
  if (show) drawInfo(show, pos(show), y0, y1);
  // on a window too small for the whole map: how to move it
  if (canX || canY) {
    const t = 'DRAG OR WASD: MOVE THE MAP', tw0 = tw(t) + 8;
    ctx.fillStyle = 'rgba(6,7,9,0.85)';
    ctx.fillRect(4, y0 + 3, tw0, 11);
    text(t, 8, y0 + 5, U.dim, { outline: false });
  }
  ctx.restore();
}
// Mouse dragging and WASD move the map on a window too small to show all of it.
function treeInput(y0, y1, can) {
  const d = TREE.drag;
  if (!can) {
    TREE.drag = null;
    return;
  }
  if (M.pressed && M.down && M.y >= y0 && M.y < y1) TREE.drag = { x: M.x, y: M.y, px: TREE.pan.x, py: TREE.pan.y, moved: false };
  else if (d && M.down) {
    if (Math.abs(M.x - d.x) + Math.abs(M.y - d.y) > 4) d.moved = true;
    if (d.moved) {
      TREE.pan.x = d.px + M.x - d.x;
      TREE.pan.y = d.py + M.y - d.y;
    }
  } else if (d) {
    // the press was a drag, not a click
    if (d.moved) M.used = true;
    TREE.drag = null;
  }
  const v = 220 * frameDt;
  if (KEYS.a) TREE.pan.x += v;
  if (KEYS.d) TREE.pan.x -= v;
  if (KEYS.w) TREE.pan.y += v;
  if (KEYS.s) TREE.pan.y -= v;
}
// One node at (x, y) in state st: its square and icon, its level pips, its price, a NEW tag.
function drawNode(n, x, y, st) {
  const B = BRANCH[n.br], l = lv(n.id), m = maxLv(n), big = !!n.star, h = halfOf(n), s = h * 2;
  // a click that could not buy shakes it
  const sk = realT - (TREE.shake[n.id] ?? -9);
  if (sk < 0.25 && !REDUCED) x += Math.round(Math.sin(sk * 70) * 2 * (1 - sk / 0.25));
  const nx = x - h, ny = y - h, hov = TREE.hov === n;
  if (st === 'hidden') {
    ctx.fillStyle = '#0c0d10';
    ctx.fillRect(nx + 1, ny + 1, s - 2, s - 2);
    frame(nx, ny, s, s, hov ? '#3e424c' : '#25282f');
    if (big) frame(nx + 2, ny + 2, s - 4, s - 4, '#1c1e24');
    text('?', x + 1, y - 3, hov ? U.faint : '#3a3e48', { align: 'center', outline: false });
    return;
  }
  const buy = st === 'buy', pulse = 0.5 + 0.5 * Math.sin(realT * TAU);
  // the body: dark, a light fill of the branch colour once every level is bought
  ctx.fillStyle = '#131419';
  ctx.fillRect(nx + 1, ny + 1, s - 2, s - 2);
  if (st === 'max') {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = B.col;
    ctx.fillRect(nx + 1, ny + 1, s - 2, s - 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(nx + 2, ny + 1, s - 4, 1);
  // the frame: gold and pulsing when you can buy it, the branch colour once it has a level, grey
  // before; a * node has two
  const fc = buy ? '#c99a3e' : l > 0 ? B.col : hov ? '#5d616b' : '#3a3e48';
  frame(nx, ny, s, s, fc);
  if (big) {
    ctx.globalAlpha = 0.6;
    frame(nx + 2, ny + 2, s - 4, s - 4, fc);
    ctx.globalAlpha = 1;
  }
  if (buy) {
    ctx.globalAlpha = 0.25 + 0.65 * pulse;
    frame(nx - 1, ny - 1, s + 2, s + 2, '#ffd36a');
    ctx.globalAlpha = 1;
  } else if (hov) {
    ctx.globalAlpha = 0.5;
    frame(nx - 1, ny - 1, s + 2, s + 2, '#e8dfc8');
    ctx.globalAlpha = 1;
  }
  // the icon: dim while it is only a goal, dimmer when you cannot pay for its first level
  const ic = st === 'locked' ? ICON.lock : NICON[n.id];
  ctx.globalAlpha = st === 'goal' || st === 'soon' ? 0.6 : st === 'poor' && !l ? 0.4 : st === 'locked' ? 0.75 : 1;
  blit(ic, Math.round(x - ic.width / 2), Math.round(y - ic.height / 2));
  ctx.globalAlpha = 1;
  if (big) blit(ICON.star, nx + s - 5, ny - 2);
  // just bought: a white flash; just popped in: a softer one
  const fl = realT - (TREE.flash[n.id] ?? -9), pp = realT - (TREE.pop[n.id] ?? -9);
  const wa = Math.max(fl < 0.12 ? 1 - fl / 0.12 : 0, pp >= 0 && pp < 0.2 ? 0.8 * (1 - pp / 0.2) : 0);
  if (wa > 0) {
    ctx.globalAlpha = wa;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(nx, ny, s, s);
    ctx.globalAlpha = 1;
  }
  // the level pips under it (2 x 2 each, gold when bought)
  let ly = y + h + 3;
  if (m > 1) {
    const pw = m * 3 - 1, px = Math.round(x - pw / 2);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(px - 1, ly - 1, pw + 2, 4);
    for (let i = 0; i < m; i++) {
      ctx.fillStyle = i < l ? '#e3b04b' : '#3a3e48';
      ctx.fillRect(px + i * 3, ly, 2, 2);
    }
    ly += 5;
  }
  // the price of the next level: gold (or green for survivors) when you can pay, red when you cannot
  if (st === 'buy' || st === 'poor' || st === 'goal' || st === 'soon') {
    const p = priceOf(n), surv = n.cur === 'surv';
    if (!p) text('FREE', x, ly, pulse > 0.5 ? '#ffe39a' : U.gold, { align: 'center' });
    else {
      const ok = canPay(n), col = st === 'soon' ? U.faint : !ok ? U.red : st === 'goal' ? U.dim : surv ? U.green : U.gold;
      const ps = fmt(p), iw = 7, w = iw + tw(ps), px = Math.round(x - w / 2);
      // a dark backing, so a line running under it does not cut through the numbers
      ctx.fillStyle = '#07080a';
      ctx.fillRect(px - 2, ly - 1, w + 4, 9);
      if (st === 'soon' || st === 'goal') ctx.globalAlpha = 0.8;
      blit(surv ? ICON.survS : ICON.boltS, px - 1, ly);
      text(ps, px + iw, ly, col);
      ctx.globalAlpha = 1;
    }
  }
  // NEW: a gold tag over it for 3 s after it shows up (to its left when the top bar is in the way)
  const nt = realT - (TREE.pop[n.id] ?? -9);
  if (nt >= 0 && nt < 3) {
    ctx.globalAlpha = nt > 2.6 ? (3 - nt) / 0.4 : 1;
    let tx = x - 10, ty = ny - (big ? 13 : 12);
    if (ty - 1 < (TREE.y0 ?? 0) + 1) [tx, ty] = [nx - 22, y - 4];
    ctx.fillStyle = '#07080a';
    ctx.fillRect(tx - 1, ty - 1, 21, 11);
    ctx.fillStyle = U.gold;
    ctx.fillRect(tx, ty, 19, 9);
    text('NEW', tx + 10, ty + 1, '#1a1206', { align: 'center', outline: false });
    ctx.globalAlpha = 1;
  }
}
// Gold rings growing out of a bought node, and its price floating up.
function drawTreeFx(pos) {
  for (let i = TREE.rings.length - 1; i >= 0; i--) {
    const r = TREE.rings[i], u = (realT - r.t) / 0.45;
    if (u >= 1) {
      TREE.rings.splice(i, 1);
      continue;
    }
    const [x, y] = pos(NODE[r.id]), e = halfOf(NODE[r.id]) + 1 + Math.round(ease(u) * 14);
    ctx.globalAlpha = 1 - u;
    frame(x - e, y - e, e * 2 + 1, e * 2 + 1, '#ffd36a');
    if (u < 0.5) frame(x - e + 1, y - e + 1, e * 2 - 1, e * 2 - 1, '#e3b04b');
    ctx.globalAlpha = 1;
  }
  for (let i = TREE.floats.length - 1; i >= 0; i--) {
    const f = TREE.floats[i], u = (realT - f.t) / 0.9;
    if (u >= 1) {
      TREE.floats.splice(i, 1);
      continue;
    }
    // it floats up from over the node, or down from under it when the top bar is in the way
    const [x, y] = pos(NODE[f.id]), h = halfOf(NODE[f.id]), d = Math.round(ease(u) * 12);
    ctx.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
    text(f.s, x, y - h - 24 >= (TREE.y0 ?? 0) ? y - h - 12 - d : y + h + 3 + d, f.c, { align: 'center' });
    ctx.globalAlpha = 1;
  }
}

// ---------- the info box
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
// The info box for node n: its icon, name and level, what it does, NOW > NEXT, and the price (or why
// it cannot be bought yet). [qx, qy] = where the node is. It sits in a corner of the panel where it
// covers no node.
const INFO_W = 212;
// Where the info box (w x h) for node n at (qx, qy) goes: the first corner of the panel where it
// covers no node (bottom left first). On a small window no corner may be free: then the place where
// it covers the fewest nodes (by RECTS' weights), the nearest one to the node, and never the node.
function infoSpot(n, st, qx, qy, w, h, y0, y1) {
  const hn = halfOf(n), me = [qx - hn - 2, qy - hn - 2, hn * 2 + 4, hn + below(n, st) + 4];
  const over = (r, x, y) => r[0] < x + w && r[0] + r[2] > x && r[1] < y + h && r[1] + r[3] > y;
  const cost = (x, y) => (over(me, x, y) ? 1000 : 0) + RECTS.reduce((k, r) => k + (over(r, x, y) ? r[4] : 0), 0);
  const lo = y0 + 6, hi = y1 - h - 6;
  const spots = [[8, hi], [W - w - 8, hi], [8, lo], [W - w - 8, lo]];
  for (const sp of spots) if (!cost(...sp)) return sp;
  // try right beside the node on each side, and everywhere else in small steps
  const xs = [me[0] - w - 4, me[0] + me[2] + 4, qx - w / 2], ys = [me[1] - h - 4, me[1] + me[3] + 4, qy - h / 2];
  for (let x = 4; x <= W - w - 4; x += 8) xs.push(x);
  for (let y = lo; y <= hi; y += 6) ys.push(y);
  let best = spots[0], bk = Infinity;
  for (const x0 of xs) {
    for (const y0b of ys) {
      const x = Math.round(clamp(x0, 4, W - w - 4)), y = Math.round(clamp(y0b, lo, hi));
      const k = cost(x, y) * 1000 + Math.hypot(x + w / 2 - qx, y + h / 2 - qy);
      if (k < bk) {
        bk = k;
        best = [x, y];
      }
    }
  }
  return best;
}
function drawInfo(n, [qx, qy], y0, y1) {
  const st = nodeState(n), l = lv(n.id), m = maxLv(n), B = BRANCH[n.br], hid = st === 'hidden';
  const p = parentOf(n), w = INFO_W, inner = w - 14;
  // a '?' tells only what to buy to see it (a node from later in the game: its name, and SOON)
  const named = !hid || (n.later && p && lv(p.id) > 0);
  let tag = '', tagc = U.dim;
  if (!hid) {
    if (n.id === 'root' || n.given) [tag, tagc] = l ? ['OWNED', B.col] : [n.given ? 'LOCKED' : '', U.faint];
    else if (n.star) [tag, tagc] = l ? ['OWNED', B.col] : ['BIG UNLOCK', U.gold];
    else [tag, tagc] = st === 'max' ? ['MAX', B.col] : ['LV ' + l + '/' + m, U.dim];
  }
  const desc = named ? wrap(n.desc, inner) : [p && nodeState(p) !== 'hidden' ? 'BUY ' + p.name + ' TO SEE IT.' : 'GROW THE TREE TO SEE IT.'];
  const vals = hid ? [] : [n.stat, n.stat2].filter(Boolean).map((s) => statSegs(s, l, l >= m));
  // the foot: [left text, colour, price icon, right text, colour]
  let foot = null;
  const surv = n.cur === 'surv', pr = priceOf(n), have = surv ? SAVE.surv : SAVE.scrap, icon = surv ? ICON.survS : ICON.boltS;
  const pcol = !canPay(n) ? U.red : surv ? U.green : U.gold;
  if (hid) foot = named ? ['', U.faint, null, 'COMING SOON', U.faint] : null;
  else if (st === 'locked') foot = ['HOLD FARM STOP ONCE TO GET IT.', U.amber, null, '', U.dim];
  else if (st === 'soon') foot = [fmt(pr), U.faint, icon, 'COMING SOON', U.faint];
  else if (st === 'goal') foot = [fmt(pr), canPay(n) ? U.dim : U.red, icon, 'NEEDS: ' + nodeLv(n.needs[0], n.needs[1]), U.amber];
  else if (st === 'poor') foot = [fmt(pr), U.red, icon, 'NEED ' + fmt(pr - have) + ' MORE', U.red];
  else if (st === 'buy') foot = pr ? [fmt(pr), pcol, icon, 'CLICK TO BUY', U.gold] : ['FREE', U.gold, null, 'CLICK TO TAKE IT', U.gold];
  const h = 25 + desc.length * 10 + vals.length * 10 + (foot ? 15 : 0) + 3;
  const [x, y] = infoSpot(n, st, qx, qy, w, h, y0, y1);
  panel(x, y, w, h, 'rgba(13,14,18,0.96)');
  ctx.fillStyle = hid ? '#3a3e48' : B.col;
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  // head: the icon, the name and its branch; the level on the right
  if (hid) {
    frame(x + 6, y + 5, 14, 14, '#3a3e48');
    text('?', x + 14, y + 9, U.faint, { align: 'center', outline: false });
  } else blit(st === 'locked' ? ICON.lock : NICON[n.id], x + 6 + (st === 'locked' ? 2 : 0), y + 5 + (st === 'locked' ? 2 : 0));
  text(named ? n.name : '???', x + 25, y + 5, hid ? U.dim : n.id === 'root' ? U.gold : B.col);
  text(n.id === 'root' ? 'THE ROOT' : B.name, x + 25, y + 14, U.faint, { outline: false });
  if (tag) text(tag, x + w - 7, y + 5, tagc, { align: 'right' });
  let ty = y + 24;
  for (const d of desc) {
    text(d, x + 7, ty, U.ink);
    ty += 10;
  }
  for (const segs of vals) {
    let tx = x + 7;
    for (const [s, c] of segs) tx += text(s, tx, ty, c) + 5;
    ty += 10;
  }
  if (!foot) return;
  ctx.fillStyle = '#24272e';
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
