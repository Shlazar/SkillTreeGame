// depot.js - the save, and the Depot: the screen between runs. SAVE is everything kept from run to
// run, one object in this browser's storage. The Depot screen has a top bar (your scrap and
// survivors, the SKILL TREE and STATION tabs, your best km), the open tab's panel, and a bottom bar
// (where the next run starts, and START RUN). The title demo keeps running behind it, dimmed.

// ---------- the save
const SAVE_KEY = 'sky-reaper-save-1', SAVE_V = 1;
// v = version. scrap, surv = money. nodes = skill tree levels by node id. towers, house = what is
// built at each station, and the survivors waiting in each station house. reached = stations the
// train has stopped at (a run can start there), held = stations held at least once. best = the
// furthest km. runs = runs started. start = where the next run starts. seen = tutorial prompts
// already shown. flags = one-off things done.
function freshSave() {
  return {
    v: SAVE_V, scrap: 0, surv: 0, nodes: {}, towers: {}, house: {}, reached: [], held: [], best: 0, runs: 0,
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
  if (!o || typeof o !== 'object' || o.v !== SAVE_V) return false;
  const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
  const obj = (m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {});
  const ids = (a) => (Array.isArray(a) ? a.filter((id, i) => STATIONS.some((d) => d.id === id) && a.indexOf(id) === i) : []);
  SAVE.scrap = Math.floor(num(o.scrap));
  SAVE.surv = Math.floor(num(o.surv));
  SAVE.best = num(o.best);
  SAVE.runs = Math.floor(num(o.runs));
  SAVE.reached = ids(o.reached);
  SAVE.held = ids(o.held);
  // a station held is a station reached
  for (const id of SAVE.held) if (!SAVE.reached.includes(id)) SAVE.reached.push(id);
  SAVE.start = typeof o.start === 'string' && stopDef(o.start) ? o.start : 'depot';
  // skill tree levels: known nodes only, never above their top level
  for (const [k, v] of Object.entries(obj(o.nodes))) if (num(v) && NODE[k]) SAVE.nodes[k] = Math.min(maxLv(NODE[k]), Math.floor(v));
  SAVE.towers = obj(o.towers);
  SAVE.house = obj(o.house);
  SAVE.seen = obj(o.seen);
  SAVE.flags = obj(o.flags);
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
const hasProgress = () => SAVE.runs > 0 || SAVE.scrap > 0 || SAVE.surv > 0 || Object.keys(SAVE.nodes).length > 0;
// the level of skill tree node id (0 = not bought)
const lv = (id) => SAVE.nodes[id] | 0;
// the STATION tab opens once Farm Stop has been held
const stationOpen = () => SAVE.held.includes(STATIONS[0].id);
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
// depotTab = the open tab: 'tree' or 'station'
let depotTab = 'tree';
// Go to the Depot (from the title the demo behind it goes on; after a run a new one starts).
function toDepot(tab) {
  if (!G || !G.demo) newGame(true);
  mode = 'depot';
  paused = false;
  SHOWN.scrap = SHOWN.surv = -1;
  if (tab) setTab(tab);
  // FARM STOP comes into the skill tree once Farm Stop has been held
  syncGiven();
}
function setTab(t) {
  depotTab = t;
  if (t === 'station' && stationOpen() && !SAVE.seen.stationTab) {
    SAVE.seen.stationTab = true;
    saveSave();
  }
}
// Keys on the Depot screen: TAB switches tabs, ENTER starts, left / right pick the start, ESC goes
// back to the title. (On the Station tab, 1-3 pick a tower and ESC first drops it.)
function depotKey(k) {
  if (depotTab === 'station' && stationKey(k)) return;
  if (k === 'Tab') {
    setTab(depotTab === 'tree' ? 'station' : 'tree');
    SFX.ui();
  } else if (k === 'Enter') startGame(SAVE.start);
  else if (k === 'ArrowLeft') pickStart(-1);
  else if (k === 'ArrowRight') pickStart(1);
  else if (k === 'Escape') toTitle();
}
function drawDepot() {
  // the demo behind, dimmed
  ctx.fillStyle = 'rgba(5,6,8,0.62)';
  ctx.fillRect(0, 0, W, H);
  const y0 = 19, y1 = H - 29;
  if (depotTab === 'station') drawStationTab(y0, y1);
  else drawTreeTab(y0, y1);
  drawDepotTop();
  drawDepotBottom();
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
const SHOWN = { scrap: -1, surv: -1 };
function countMoney() {
  const k = 1 - Math.exp(-9 * frameDt);
  for (const key of ['scrap', 'surv']) {
    const v = SAVE[key];
    SHOWN[key] = SHOWN[key] < 0 || Math.abs(SHOWN[key] - v) < 0.5 ? v : SHOWN[key] + (v - SHOWN[key]) * k;
  }
}
function drawDepotTop() {
  ctx.fillStyle = 'rgba(6,7,9,0.94)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 18, W, 1);
  // money: scrap (gold, bolt) and survivors (green, person); a number still counting is lighter
  countMoney();
  const narrow = W < 500, sc = fmt(Math.round(SHOWN.scrap)), sv = Math.round(SHOWN.surv);
  const cs = sv !== SAVE.surv, cc = Math.round(SHOWN.scrap) !== SAVE.scrap;
  blit(ICON.scrap, 5, 4 - (cc ? 1 : 0));
  text(sc, 15, 6, cc ? '#ffe39a' : U.gold);
  const sx = 15 + Math.max(18, tw(sc)) + 10, ew = 9 + Math.max(10, tw(String(sv)));
  blit(ICON.surv, sx, 5 - (cs ? 1 : 0));
  text(sv, sx + 9, 6, cs ? '#d4f5cf' : U.green);
  tipAt(2, 0, sx - 6, 18, [['SCRAP', U.gold], ['FROM KILLS, THE RIDE AND STATIONS.', U.dim], ['IT BUYS UPGRADES IN THE SKILL TREE.', U.dim]]);
  tipAt(sx - 2, 0, ew + 6, 18, [['SURVIVORS', U.green], ['SAVE THEM AT STATIONS.', U.dim], ['THEY BUY THE BIGGEST UPGRADES.', U.dim]]);
  // the tabs in the middle
  const tw0 = narrow ? 66 : 84, tx = Math.round(W / 2 - tw0 - 2), open = stationOpen();
  if (depotTabBtn(tx, tw0, narrow ? 'TREE' : 'SKILL TREE', depotTab === 'tree', false, false)) setTab('tree');
  if (depotTabBtn(tx + tw0 + 4, tw0, 'STATION', depotTab === 'station', !open, open && !SAVE.seen.stationTab)) setTab('station');
  if (!open) tipAt(tx + tw0 + 4, 2, tw0, 17, [['STATION', U.teal], ['HOLD FARM STOP ONCE TO BUILD HERE.', U.dim]]);
  // the best run
  const b = SAVE.best.toFixed(2) + ' KM', bw = tw(b);
  if (W - bw - 6 > tx + tw0 * 2 + 12) {
    text(b, W - 6, 6, SAVE.best > 0 ? U.ink : U.faint, { align: 'right' });
    if (!narrow) text('BEST', W - 12 - bw, 6, U.dim, { align: 'right' });
    tipAt(W - bw - 40, 0, bw + 40, 18, [['YOUR BEST RUN', U.ink], ['THE FURTHEST THE TRAIN HAS GOT,', U.dim], ['IN KM FROM THE DEPOT.', U.dim]]);
  }
}
// What the bottom bar says between the start picker and START RUN.
function depotHint() {
  if (depotTab === 'station' && !stationOpen()) return ['HOLD FARM STOP ONCE TO BUILD HERE.', U.ink];
  if (depotTab === 'station' && ST.sel) return ['CLICK A TILE TO BUILD.  R-CLICK OR ESC: STOP.', U.dim];
  const th = depotTab === 'tree' && treeHint();
  if (th) return th;
  const d = stopDef(SAVE.start);
  if (d && d.id !== 'depot') return startHint(d);
  return ['TAB: SWITCH PANELS.  ENTER: START RUN.', U.faint];
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
// (The SKILL TREE tab is drawn by drawTreeTab in tree.js, the STATION tab by drawStationTab in
// stationtab.js.)
