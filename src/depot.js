// depot.js - the save, and the Depot: the screen between runs. SAVE is everything kept from run to
// run, one object in this browser's storage. The Depot screen has a top bar (your scrap and
// survivors and gold as they are revealed, the SKILL TREE tab, your best km), the tree panel, and a bottom bar
// (where the next run starts, and START RUN). The title demo keeps running behind it, dimmed.

// ---------- the save
const SAVE_KEY = 'sky-reaper-save-1', SAVE_V = 2;
// v = version. scrap, surv, gold = money. leg = next ride (13 means the demo is complete).
// legs keeps wins, three stars and paid gold item ids by leg. rescues are lifted survivors;
// rescueDue are missed survivors waiting to wave again. chest = none/locked/opened (0/1/2).
// hangar holds the two plane slot ids, or null for an empty slot. nodes = skill tree levels by id.
// The old route fields stay until the leg route replaces every reader. towers, house = what is
// built at each station, and the survivors waiting in each station house. reached = stations the
// train has stopped at (a run can start there), held = stations held at least once. best = the
// furthest km. runs = runs started. start = where the next run starts. seen = tutorial prompts
// already shown. flags = one-off things done.
function freshSave() {
  return {
    v: SAVE_V, scrap: 0, surv: 0, gold: 0, leg: 1, legs: {}, rescues: [], rescueDue: [], chest: 0,
    hangar: [null, null], nodes: {}, towers: {}, house: {}, reached: [], held: [], best: 0, runs: 0,
    start: 'depot', seen: {}, flags: {}
  };
}
let SAVE = freshSave();
// Read the save. A missing, broken or older one starts fresh. True when a save was found.
function loadSave() {
  SAVE = freshSave();
  let o = null;
  try {
    o = JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch (e) {
    o = null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== SAVE_V) return false;
  const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
  const obj = (m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {});
  const integer = (v, min, max, fallback) => typeof v === 'number' && isFinite(v) ? clamp(Math.floor(v), min, max) : fallback;
  const money = (v) => integer(v, 0, Number.MAX_SAFE_INTEGER, 0);
  // Null-prototype maps safely keep arbitrary stable ids, including keys such as __proto__.
  const boolMap = (value, trueOnly = false) => {
    const map = Object.create(null);
    for (const [id, flag] of Object.entries(obj(value))) {
      if (id && typeof flag === 'boolean' && (!trueOnly || flag)) map[id] = flag;
    }
    return map;
  };
  const rescueIds = (a) => Array.isArray(a) ? [...new Set(a.filter((id) => typeof id === 'string' && id.length > 0))] : [];
  const ids = (a) => (Array.isArray(a) ? a.filter((id, i) => STATIONS.some((d) => d.id === id) && a.indexOf(id) === i) : []);
  SAVE.scrap = money(o.scrap);
  SAVE.surv = money(o.surv);
  SAVE.gold = money(o.gold);
  SAVE.leg = integer(o.leg, 1, 13, 1);
  for (const [id, value] of Object.entries(obj(o.legs))) {
    if (!/^(?:[1-9]|1[0-2])$/.test(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    SAVE.legs[id] = {
      won: value.won === true,
      stars: [0, 1, 2].map((i) => Array.isArray(value.stars) && value.stars[i] === true),
      paid: boolMap(value.paid, true)
    };
  }
  SAVE.rescues = rescueIds(o.rescues);
  SAVE.rescueDue = rescueIds(o.rescueDue).filter((id) => !SAVE.rescues.includes(id));
  SAVE.chest = integer(o.chest, 0, 2, 0);
  const planes = Array.isArray(o.hangar) ? o.hangar : [];
  for (let i = 0; i < SAVE.hangar.length; i++) {
    const id = planes[i];
    if (['a10', 'f4', 'b52'].includes(id) && !SAVE.hangar.includes(id)) SAVE.hangar[i] = id;
  }
  SAVE.best = num(o.best);
  SAVE.runs = money(o.runs);
  SAVE.reached = ids(o.reached);
  SAVE.held = ids(o.held);
  // a station held is a station reached
  for (const id of SAVE.held) if (!SAVE.reached.includes(id)) SAVE.reached.push(id);
  SAVE.start = typeof o.start === 'string' && stopDef(o.start) ? o.start : 'depot';
  // skill tree levels: known nodes only, never above their top level
  for (const [k, v] of Object.entries(obj(o.nodes))) {
    if (!Object.prototype.hasOwnProperty.call(NODE, k)) continue;
    const l = integer(v, 0, maxLv(NODE[k]), 0);
    if (l) SAVE.nodes[k] = l;
  }
  SAVE.towers = obj(o.towers);
  SAVE.house = obj(o.house);
  SAVE.seen = boolMap(o.seen);
  SAVE.flags = boolMap(o.flags);
  return true;
}
function saveSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE));
  } catch (e) { /* no storage: progress lasts until the page closes */ }
}
// Wipe everything and start over.
function newSave() {
  SAVE = freshSave();
  saveSave();
  resetTree();
}
// true once there is something to lose (the title then offers CONTINUE and NEW GAME)
const hasProgress = () => SAVE.runs > 0 || SAVE.scrap > 0 || SAVE.surv > 0 || SAVE.gold > 0 || SAVE.leg > 1 ||
  Object.keys(SAVE.nodes).some((id) => id !== 'root' && SAVE.nodes[id] > 0) ||
  Object.values(SAVE.legs).some((leg) => leg.won || leg.stars.some(Boolean) || Object.values(leg.paid).some(Boolean)) ||
  SAVE.rescues.length > 0 || SAVE.rescueDue.length > 0 || SAVE.chest > 0 || SAVE.hangar.some(Boolean);
// the level of skill tree node id (0 = not bought)
const lv = (id) => SAVE.nodes[id] | 0;
// The starts on offer: the Depot, then every station reached, up the line.
function startsOpen() {
  return ['depot'].concat(STATIONS.filter((d) => SAVE.reached.includes(d.id)).map((d) => d.id));
}
function pickStart(dir) {
  const list = startsOpen(), i = Math.max(0, list.indexOf(SAVE.start));
  if (list.length < 2) return;
  SAVE.start = list[mod(i + dir, list.length)];
  saveSave();
  SFX.ui();
}

// ---------- the Depot screen
// depotTab = the open tab: only 'tree' for now.
let depotTab = 'tree';
// Go to the Depot (from the title the demo behind it goes on; after a run a new one starts).
function toDepot(tab) {
  if (!G || !G.demo) newGame(true);
  mode = 'depot';
  paused = false;
  SHOWN.scrap = SHOWN.surv = SHOWN.gold = -1;
  setTab(tab);
}
// Keep the Depot on the tree until another panel is added.
function setTab() {
  depotTab = 'tree';
}
// Keys on the Depot screen: ENTER starts, left / right pick the start, ESC goes back to the title.
// TAB does nothing while there is only one panel.
function depotKey(k) {
  if (treeKey(k)) return;
  if (k === 'Enter') startGame(SAVE.start);
  else if (k === 'ArrowLeft') pickStart(-1);
  else if (k === 'ArrowRight') pickStart(1);
  else if (k === 'Escape') toTitle();
}
function drawDepot() {
  // the demo behind, dimmed
  ctx.fillStyle = 'rgba(5,6,8,0.62)';
  ctx.fillRect(0, 0, W, H);
  const y0 = 19, y1 = H - 29;
  drawTreeTab(y0, y1);
  drawDepotTop();
  drawDepotBottom();
  drawTutTags();
  drawBanners();
  if (TIP.lines) drawTip();
}
// A small box of words by the mouse, for the thing it points at. tipAt(x, y, w, h, lines) asks for
// one this frame when the mouse is in that box (lines = [[text, color], ...]); it is drawn last.
const TIP = { lines: null };
function tipAt(x, y, w, h, lines) {
  if (inR(M.x, M.y, x, y, w, h) && M.inside) TIP.lines = lines;
}
function drawTip() {
  const L = TIP.lines, w = Math.max(...L.map((l) => tw(l[0]))) + 12, h = L.length * 10 + 5;
  const x = clamp(Math.round(M.x + 8), 2, W - w - 2), y = clamp(Math.round(M.y + 12), 20, H - h - 30);
  panel(x, y, w, h, '#0b0c0f');
  L.forEach((l, i) => text(l[0], x + 6, y + 4 + i * 10, l[1]));
  TIP.lines = null;
}
// A tab in the top bar: gold and open at the bottom when it is the open one. Returns true on a click.
function depotTabBtn(x, w, label, on, locked, isNew) {
  const y = 2, h = 17, hov = inR(M.x, M.y, x, y, w, h);
  ctx.fillStyle = on ? '#16171c' : hov ? '#1a1c22' : '#0f1014';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 1);
  ctx.fillStyle = on ? '#b8862f' : hov ? '#6a6f7b' : '#2e3139';
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 1);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 1);
  if (on) {
    ctx.fillStyle = 'rgba(227,176,75,0.16)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
  const col = on ? U.gold : locked ? U.faint : hov ? U.ink : U.dim, lw = tw(label);
  // the label in the middle (with a padlock before it, or a gold NEW tag after it)
  const tag = isNew ? 24 : 0, iw = locked ? ICON.lock.width + 3 : 0, lx = Math.round(x + w / 2 - (iw + lw + tag) / 2);
  if (locked) {
    ctx.globalAlpha = on ? 1 : 0.7;
    blit(ICON.lock, lx, y + 4);
    ctx.globalAlpha = 1;
  }
  text(label, lx + iw, y + 6, col);
  if (isNew) {
    const nx = lx + iw + lw + 5;
    ctx.fillStyle = U.gold;
    ctx.fillRect(nx, y + 5, 19, 9);
    text('NEW', nx + 10, y + 6, '#1a1206', { align: 'center', outline: false });
  }
  if (hov) cursor = 'pointer';
  return clicked(x, y, w, h);
}
// The money as the top bar shows it: after a buy it counts down to the real number.
const SHOWN = { scrap: -1, surv: -1, gold: -1 };
function countMoney() {
  const k = 1 - Math.exp(-9 * frameDt);
  for (const key of ['scrap', 'surv', 'gold']) {
    const v = SAVE[key];
    SHOWN[key] = SHOWN[key] < 0 || Math.abs(SHOWN[key] - v) < 0.5 ? v : SHOWN[key] + (v - SHOWN[key]) * k;
  }
}
function drawDepotTop() {
  ctx.fillStyle = 'rgba(6,7,9,0.94)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 18, W, 1);
  // All three money families share the HUD's layout; a number still counting is lighter.
  countMoney();
  const narrow = W < 500, counters = currencyLayout(SHOWN);
  const pulses = Object.fromEntries(['scrap', 'surv', 'gold'].map((key) => [key, Math.round(SHOWN[key]) !== SAVE[key]]));
  drawCurrencyCounters(counters, 0, pulses);
  const tips = {
    scrap: [['SCRAP', U.blue], ['FROM KILLS AND LOOT.', U.dim], ['IT BUYS UPGRADES IN THE SKILL TREE.', U.dim]],
    surv: [['SURVIVORS', U.amber], ['SURVIVORS CREW NEW UNITS.', U.dim], ['EACH NEW UNIT COSTS 1.', U.dim]],
    gold: [['GOLD', U.gold], ['FROM GOLDEN FINDS, STARS AND STATIONS.', U.dim], ['IT BUYS SPECIAL NODES.', U.dim]]
  };
  for (const item of counters.items) tipAt(item.left - 2, 0, item.textX + tw(item.label) - item.left + 4, 18, tips[item.key]);
  // the tree tab in the middle
  const tw0 = narrow ? 66 : 84, tx = Math.max(counters.end + 4, Math.round((W - tw0) / 2));
  if (depotTabBtn(tx, tw0, narrow ? 'TREE' : 'SKILL TREE', depotTab === 'tree', false, false)) setTab('tree');
  // the best run
  const b = SAVE.best.toFixed(2) + ' KM', bw = tw(b);
  if (W - bw - 6 > tx + tw0 + 8) {
    text(b, W - 6, 6, SAVE.best > 0 ? U.ink : U.faint, { align: 'right' });
    if (!narrow) text('BEST', W - 12 - bw, 6, U.dim, { align: 'right' });
    tipAt(W - bw - 40, 0, bw + 40, 18, [['YOUR BEST RUN', U.ink], ['THE FURTHEST THE TRAIN HAS GOT,', U.dim], ['IN KM FROM THE DEPOT.', U.dim]]);
  }
}
// What the bottom bar says between the start picker and START RUN.
function depotHint() {
  const tut = tutHint();
  if (tut) return tut;
  const th = treeHint();
  if (th) return th;
  return ['ENTER: START RUN.', U.faint];
}
function drawDepotBottom() {
  const y = H - 28;
  ctx.fillStyle = 'rgba(6,7,9,0.94)';
  ctx.fillRect(0, y, W, 28);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, y, W, 1);
  // START FROM [<] DEPOT 0.0 KM [>]
  const list = startsOpen(), d = stopDef(list[Math.max(0, list.indexOf(SAVE.start))]), many = list.length > 1;
  let x = 8;
  if (W >= 420) {
    text('START FROM', x, y + 11, U.dim);
    x += tw('START FROM') + 6;
  }
  if (button(x, y + 6, 15, 16, '<', { off: !many })) pickStart(-1);
  x += 17;
  const nw = 104;
  panel(x, y + 6, nw, 16, '#0b0c0f');
  const name = d.name, km = d.km.toFixed(1) + ' KM', w2 = tw(name) + 6 + tw(km), nx = Math.round(x + nw / 2 - w2 / 2);
  text(name, nx, y + 11, U.ink);
  text(km, nx + tw(name) + 6, y + 11, U.dim);
  tipAt(x, y + 6, nw, 16, many ? [['START FROM', U.ink], ['LEFT / RIGHT: PICK WHERE THE RUN STARTS.', U.dim]]
    : [['START FROM', U.ink], ['REACH A STATION TO START RUNS THERE.', U.dim]]);
  x += nw + 2;
  if (button(x, y + 6, 15, 16, '>', { off: !many })) pickStart(1);
  x += 15;
  // START RUN, and the hint between
  const bw = 100, bx = W - bw - 6;
  if (button(bx, y + 4, bw, 20, 'START RUN', { primary: true })) startGame(SAVE.start);
  const [hint, hc] = depotHint(), hw = tw(hint);
  if (hw < bx - x - 16) text(hint, Math.round((x + bx) / 2), y + 11, hc, { align: 'center' });
}
// The SKILL TREE tab is drawn by drawTreeTab in tree.js.
