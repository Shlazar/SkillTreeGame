// depot.js - the save, and the Depot: the screen between runs. SAVE is everything kept from run to
// run, one object in this browser's storage. The Depot shows revealed money, the station line,
// the skill tree, and a button to ride the next leg or replay an old one for scrap.

// ---------- the save
const SAVE_KEY = 'sky-reaper-save-1', SAVE_V = 2;
// v = version. scrap, surv, gold = money. leg = next ride (13 means the demo is complete).
// legs keeps wins, three stars and paid gold item ids by leg. rescues are lifted survivors;
// rescueDue are missed survivors waiting to wave again. chest = none/locked/opened (0/1/2).
// hangar holds the two plane slot ids, or null for an empty slot. nodes = skill tree levels by id.
// runs = rides started. seen = tutorial prompts already shown. flags = one-off things done.
function freshSave() {
  return {
    v: SAVE_V, scrap: 0, surv: 0, gold: 0, leg: 1, legs: {}, rescues: [], rescueDue: [], chest: 0,
    hangar: [null, null], nodes: {}, runs: 0, seen: {}, flags: {}
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
  SAVE.runs = money(o.runs);
  // skill tree levels: known nodes only, never above their top level
  for (const [k, v] of Object.entries(obj(o.nodes))) {
    if (!Object.prototype.hasOwnProperty.call(NODE, k)) continue;
    const l = integer(v, 0, maxLv(NODE[k]), 0);
    if (l) SAVE.nodes[k] = l;
  }
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
  depotLeg = 1;
  depotLoss = '';
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
// ---------- the Depot screen
// Selection and the last loss belong to this screen, not to the saved furthest leg.
let depotTab = 'tree', depotLeg = 1, depotLoss = '';
// Go to the Depot (from the title the demo behind it goes on; after a run a new one starts).
function toDepot(tab) {
  if (G && !G.demo) depotLoss = G.result === 'lost' ? 'THE TRAIN BROKE. YOU KEEP ' + fmt(Math.floor(G.cash)) + ' SCRAP.' : '';
  if (!G || !G.demo) newGame(true);
  depotLeg = Math.min(SAVE.leg, 12);
  mode = 'depot';
  paused = false;
  SHOWN.scrap = SHOWN.surv = SHOWN.gold = -1;
  setTab(tab);
}
// Keep the Depot on the tree until another panel is added.
function setTab() {
  depotTab = 'tree';
}
// Keys on the Depot screen: ENTER rides the selection, ESC goes back to the title.
// TAB does nothing while there is only one panel.
function depotKey(k) {
  if (treeKey(k)) return;
  if (k === 'Enter') {
    const state = depotRouteState();
    startGame(state.selected, state.replay);
  }
  else if (k === 'Escape') toTitle();
}
function drawDepot() {
  // the demo behind, dimmed
  ctx.fillStyle = 'rgba(5,6,8,0.62)';
  ctx.fillRect(0, 0, W, H);
  const y0 = 63, y1 = H - 45;
  drawTreeTab(y0, y1);
  drawDepotTop();
  drawDepotRoute();
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
}
// A compact line of thirteen stops; each leg's midpoint is its click target.
function depotRouteState() {
  const current = Math.min(SAVE.leg, 12), pad = W < 500 ? 18 : 28, step = (W - pad * 2) / 12;
  if (!legDef(depotLeg) || depotLeg !== current && !SAVE.legs[depotLeg]?.won) depotLeg = current;
  const replay = !!SAVE.legs[depotLeg]?.won;
  return {
    selected: depotLeg, replay,
    startLabel: replay ? 'REPLAY: SCRAP ONLY' : 'RIDE TO ' + legDef(depotLeg).to.name,
    loss: depotLoss,
    legs: LEGS.map((l) => ({ n: l.n, x: Math.round(pad + (l.n - 0.5) * step), y: 43,
      won: !!SAVE.legs[l.n]?.won, selectable: l.n === current || !!SAVE.legs[l.n]?.won }))
  };
}
function depotStartRect() {
  const w = Math.min(W - 12, Math.max(122, tw(depotRouteState().startLabel) + 22));
  return { x: W - w - 6, y: H - 26, w, h: 22 };
}
function drawDepotRoute() {
  const state = depotRouteState(), pad = W < 500 ? 18 : 28, step = (W - pad * 2) / 12;
  const stopX = (n) => Math.round(pad + n * step), current = Math.min(SAVE.leg, 12);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 19, W, 44);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 62, W, 1);
  text('LEG ' + state.selected + ': ' + legDef(state.selected).to.name, 8, 24, U.ink);
  text(state.replay ? 'SCRAP ONLY' : SAVE.leg > 12 ? 'DEMO COMPLETE' : 'NEXT STATION', W - 8, 24, state.replay ? U.blue : U.dim, { align: 'right' });
  for (const leg of state.legs) {
    const x0 = stopX(leg.n - 1), x1 = stopX(leg.n), chosen = leg.n === state.selected;
    const color = chosen ? U.gold : leg.n === current ? U.amber : leg.won ? U.blue : U.faint;
    if (chosen) {
      ctx.fillStyle = '#242014';
      ctx.fillRect(x0 + 3, 33, x1 - x0 - 6, 26);
    }
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 4, 43, x1 - x0 - 8, 1);
    text(leg.n, leg.x, 34, color, { align: 'center', outline: false });
    if (leg.won && leg.n >= 3) {
      const stars = SAVE.legs[leg.n].stars, sw = ICON.star.width, sx = leg.x - Math.floor((sw * 3 + 2) / 2);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = stars[i] ? 1 : 0.2;
        blit(ICON.star, sx + i * (sw + 1), 51);
      }
      ctx.globalAlpha = 1;
    }
    const hover = M.inside && (inR(M.x, M.y, x0 + 3, 32, x1 - x0 - 6, 27) || inR(M.x, M.y, x1 - 5, 36, 10, 13));
    if (leg.selectable && hover) cursor = 'pointer';
    if (leg.selectable && (clicked(x0 + 3, 32, x1 - x0 - 6, 27) || clicked(x1 - 5, 36, 10, 13))) depotLeg = leg.n;
    tipAt(x0 + 3, 32, x1 - x0 - 6, 27, [['LEG ' + leg.n + ': ' + legDef(leg.n).to.name, color],
      [leg.won ? 'REPLAY: SCRAP ONLY.' : leg.selectable ? 'RIDE TO THE NEXT STATION.' : 'REACH THE PREVIOUS STATION FIRST.', U.dim]]);
  }
  for (let n = 0; n < STOPS.length; n++) {
    const d = STOPS[n], x = stopX(n), reached = n === 0 || !!SAVE.legs[n]?.won, color = reached ? U.blue : U.faint;
    if (d.kind === 'end') {
      ctx.globalAlpha = reached ? 1 : 0.45;
      blit(ICON.flag, x - 3, 37);
      ctx.globalAlpha = 1;
    } else if (d.kind === 'big') {
      frame(x - 3, 40, 7, 7, '#07080a');
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, 41, 5, 5);
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(x - 1, 42, 3, 3);
    } else {
      ctx.fillStyle = '#07080a';
      ctx.fillRect(x - 3, 42, 7, 3);
      ctx.fillRect(x - 1, 40, 3, 7);
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, 43, 5, 1);
      ctx.fillRect(x, 41, 1, 5);
    }
    tipAt(x - 5, 38, 10, 11, [[d.name, color], [n === 0 ? 'DEPARTURE DEPOT' : d.kind === 'big' ? 'SURVIVOR CAMP' : d.kind === 'small' ? 'GOLD STOP' : 'END OF THE DEMO', U.dim]]);
  }
}
// The bottom row gives context without covering the ride button.
function depotHint() {
  if (depotRouteState().replay) return ['SCRAP ONLY: NO GOLD OR SURVIVORS.', U.blue];
  const tut = tutHint();
  if (tut) return tut;
  const th = treeHint();
  if (th) return th;
  return ['ENTER: RIDE TO THE NEXT STATION.', U.faint];
}
function drawDepotBottom() {
  const y = H - 44, state = depotRouteState(), leg = legDef(state.selected), start = depotStartRect();
  ctx.fillStyle = 'rgba(6,7,9,0.94)';
  ctx.fillRect(0, y, W, 44);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, y, W, 1);
  const message = state.loss || (SAVE.leg > 12 ? 'DEMO COMPLETE. PICK AN OLD LEG TO REPLAY FOR SCRAP.'
    : 'LEG ' + leg.n + ': ' + leg.from.name + ' TO ' + leg.to.name);
  text(message, 8, y + 6, state.loss ? U.red : U.dim);
  if (button(start.x, start.y, start.w, start.h, state.startLabel, { primary: true })) startGame(state.selected, state.replay);
  const [hint, hc] = depotHint(), hw = tw(hint);
  text(hw < start.x - 16 ? hint : state.replay ? 'REPLAY: SCRAP ONLY' : 'ENTER: START', 8, start.y + 8, hw < start.x - 16 ? hc : U.faint);
}
// The SKILL TREE tab is drawn by drawTreeTab in tree.js.
