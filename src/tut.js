// tut.js - one queued lesson at a time, the pause menu, screen fades and the finale thanks card.
// Features call tutEvent at real moments. Pending lesson keys survive screen changes and reloads;
// a lesson enters SAVE.seen only when it becomes the visible tip. Arrow targets stay in memory.
// Tip duration, fades and departure delay in seconds (proposal).
const TIPC = { duration: 4, fadeIn: 0.15, fadeOut: 0.4, departure: 1.5 };
const TIP_DUE = 'tipDue:';
const TIP_DEFS = {
  p_move: { msg: 'RIGHT-CLICK TO MOVE YOUR HELI.', where: 'play' },
  currency_scrap: { msg: 'KILLS GIVE SCRAP. SCRAP BUYS UPGRADES.', where: 'both', cur: 'scrap' },
  currency_surv: { msg: 'SURVIVORS CREW NEW UNITS. EACH NEW UNIT COSTS 1.', where: 'depot', cur: 'surv' },
  currency_gold: { msg: 'GOLD BUYS SPECIAL NODES.', where: 'depot', cur: 'gold' },
  p_plane: { msg: 'PRESS Q (OR CLICK THE PLANE), AIM, THEN LEFT CLICK. RIGHT CLICK CANCELS.', where: 'play' },
  p_plane_double: { msg: 'PRESS Q TWICE TO HIT THE BIGGEST CROWD.', where: 'play' },
  p_ram: { msg: 'PRESS SPACE TO RAM!', where: 'play' },
  p_charge: { msg: 'THIS PLANE NOW HOLDS 2 STRIKES.', where: 'both' },
  p_hangar: { msg: 'PICK WHICH PLANES TO BRING.', where: 'hangar' },
  p_golden: { msg: 'CATCH THE GOLDEN ZOMBIE!', where: 'play' },
  p_sos: { msg: 'HOVER OVER HIM TO WINCH HIM UP.', where: 'play' },
  p_wall: { msg: 'A DEAD WALL! SHOOT IT DOWN.', where: 'play' },
  p_brute_focus: { msg: 'RIGHT-CLICK A BRUTE TO FOCUS IT.', where: 'play' },
  p_boom: { msg: 'EXPLOSIVE ZOMBIES BLOW UP THEIR FRIENDS.', where: 'play' },
  p_b2: { msg: 'A B-2 JOINS YOU, ONCE! PRESS E TWICE TO STRIKE.', where: 'play' }
};
const TUT = { tip: null, tipQ: [], anchors: {}, save: null, g: null, mode: '', fade: 1, fadeK: 1,
  card: null, sum: [] };
const seen = (k) => !!SAVE.seen[k];
// Mark prompt k as shown. True the first time.
function see(k) {
  if (SAVE.seen[k]) return false;
  SAVE.seen[k] = true;
  saveSave();
  return true;
}
// a real run is on (not the demo, not over)
const tutLive = () => G && !G.demo && mode === 'play' && !G.result;

// ---------- the queue
// SAVE.flags is a strict boolean map. Its insertion order preserves the order lessons became due.
function tip(key, msg, at) {
  if (TUT.save !== SAVE) { TUT.save = SAVE; TUT.tip = null; TUT.anchors = {}; }
  if (!TIP_DEFS[key] || seen(key)) return;
  if (at) TUT.anchors[key] = { g: G, at };
  const flag = TIP_DUE + key;
  if (!SAVE.flags[flag]) { SAVE.flags[flag] = true; saveSave(); }
}
function tutPending() {
  const keys = Object.keys(SAVE.flags).filter((k) => k.startsWith(TIP_DUE) && SAVE.flags[k] === true)
    .map((k) => k.slice(TIP_DUE.length)).filter((k) => TIP_DEFS[k] && !seen(k));
  // A very early first kill must still teach moving before it teaches scrap.
  const i = keys.indexOf('p_move');
  if (i > 0) keys.unshift(keys.splice(i, 1)[0]);
  return keys;
}
function currencyTips() {
  if (SAVE.flags.scrapEarned) tip('currency_scrap');
  if (SAVE.flags.survShown) tip('currency_surv');
  if (SAVE.flags.goldShown) tip('currency_gold');
}
// a zombie's place on the screen
const onScreen = (z) => [z.x - G.camX, z.y - G.camY];
const inView = (z) => {
  const [x, y] = onScreen(z);
  return x > 4 && x < W - 4 && y > 24 && y < VH - 8;
};

const tutNormalPlane = () => !!G && G.up.planeOwned.some((id) => id !== 'b2' && PLANES[id]?.available);
function tutRunTips() {
  if (!tutLive()) return;
  tip('p_move');
  if (tutNormalPlane()) tip('p_plane');
  if (G.up.ram) tip('p_ram');
  if (Object.values(G.up.planeCharges).some((n) => n > 1)) tip('p_charge');
}
// Eligibility belongs to the surface that actually draws the lesson, not merely to its trigger.
function tutEligible(key) {
  const d = TIP_DEFS[key], play = tutLive() && !paused, depot = mode === 'depot';
  if (!d || TUT.fade > 0 || !(play || depot)) return false;
  if (d.where === 'play' && !play || d.where === 'depot' && !depot) return false;
  if (d.where === 'hangar' && !(depot && depotTab === 'hangar' && hangarVisible())) return false;
  if (key === 'currency_scrap' && !seen('p_move')) return false;
  if (key === 'p_move' && G.run < TIPC.departure) return false;
  if (['p_plane', 'p_plane_double'].includes(key) && (!tutNormalPlane() || !seen('p_move'))) return false;
  if (key === 'p_plane_double' && !seen('p_plane')) return false;
  if (key === 'p_ram' && (!G.up.ram || !seen('p_move'))) return false;
  if (key === 'p_b2' && !G.finale?.gifted) return false;
  return true;
}
function tutWorldAt(o) {
  return () => o && !o.dead && !o.gone && !o.saved && !o.broken && inView(o) ? onScreen(o) : null;
}
// Feature hooks retain their moment even when no UI frame has been rendered yet.
function tutEvent(name, d) {
  d = d || {};
  if (name === 'plane_charge') {
    if (mode !== 'depot' && !tutLive()) return;
    tip('p_charge', null, () => mode === 'depot' && depotTab === 'tree' && NODE[d.id] ? (() => {
      const p = nodeXY(d.id); return [p.x, p.y];
    })() : null);
    return;
  }
  if (!G || G.demo || !(mode === 'play' || mode === 'ending')) return;
  const ev = {
    run_start: tutRunTips,
    plane_strike: () => {
      if (d.gift || d.id === 'b2') return;
      if (!SAVE.flags.planeStrike1) { SAVE.flags.planeStrike1 = true; saveSave(); }
      else if (!SAVE.flags.planeStrike2) { SAVE.flags.planeStrike2 = true; tip('p_plane_double'); saveSave(); }
    },
    sos_seen: () => tip('p_sos', null, tutWorldAt(d.rescueId && G.loot?.find((f) => f.rescueId === d.rescueId) || d)),
    golden_seen: () => tip('p_golden', null, tutWorldAt(d.z || d)),
    boom_seen: () => tip('p_boom', null, tutWorldAt(d.z || d)),
    dead_wall: () => tip('p_wall', null, tutWorldAt(d.wall || d)),
    brute_seen: () => tip('p_brute_focus', null, tutWorldAt(d.z || d)),
    b2_gift: () => {
      radio('CONTROL', 'B-2 SUPPORT IS HERE. ONE STRIKE IS YOURS.');
      tip('p_b2', null, () => {
        const slot = airBandSlots().find((s) => s.gift);
        return slot ? [slot.x + slot.w / 2, slot.y + slot.h / 2] : null;
      });
    }
  }[name];
  if (ev) ev();
}

// ---------- each frame
function tutFrame(dt) {
  if (TUT.save !== SAVE) { TUT.save = SAVE; TUT.tip = null; TUT.anchors = {}; }
  const m = mode === 'ending' ? 'play' : mode;
  if (m !== TUT.mode) {
    TUT.fade = TUT.fadeK = m === 'summary' ? 0.5 : 1;
    if (m === 'play') tutNewRun();
    if (m === 'summary') tutSumOpen();
    TUT.tip = null;
    TUT.mode = m;
  }
  TUT.fade = Math.max(0, TUT.fade - dt / 0.25 * TUT.fadeK);
  if (TUT.card && mode !== 'summary') TUT.card = null;
  if (G !== TUT.g) {
    TUT.g = G;
    TUT.anchors = Object.fromEntries(Object.entries(TUT.anchors).filter(([, a]) => a.g === G));
    if (m === 'play') tutNewRun();
    else TUT.tip = null;
  }
  if (tutLive() && !paused) tutLook();
  currencyTips();
  if (mode === 'depot' && hangarVisible()) tip('p_hangar');
  if (SAVE.flags.planeStrike2) tip('p_plane_double');
  tutChannels(dt);
}
function tutNewRun() {
  TUT.tip = null;
  TUT.card = null;
  tutRunTips();
}
function tutChannels(dt) {
  TUT.tipQ = tutPending();
  if (mode === 'play' && paused) return;
  if (TUT.tip && !tutEligible(TUT.tip.key)) TUT.tip = null;
  if (TUT.tip) {
    TUT.tip.t += dt;
    if (TUT.tip.t >= TIPC.duration) TUT.tip = null;
  }
  TUT.tipQ = tutPending();
  if (TUT.tip) return;
  const key = TUT.tipQ.find(tutEligible);
  if (!key) return;
  const d = TIP_DEFS[key];
  TUT.tip = { key, msg: key === 'p_wall' && G.up.ram ? 'A DEAD WALL! PRESS SPACE TO RAM IT.' : d.msg,
    cur: d.cur || null, t: Math.min(Math.max(dt, 1 / 60), TIPC.fadeIn) };
  delete SAVE.flags[TIP_DUE + key];
  see(key);
  TUT.tipQ = tutPending();
}
function tutLook() {
  tutRunTips();
  const w = G.walls.find((w) => !w.broken && inView(w));
  if (w) tip('p_wall', null, tutWorldAt(w));
  const z = G.zombies.find((z) => !z.dead && !z.gone && z.type === 2 && inView(z));
  if (z) tip('p_brute_focus', null, tutWorldAt(z));
}

// ---------- drawing in the run
// Keep the tip and radio above the Ram card and the plane band.
const cardsTop = () => Math.min(VH - 30, RAMCARD.on ? RAMCARD.y : VH - 30);
const warnAt = () => [W / 2, 24];
const tipRoom = () => {
  const layout = TUT.tip && mode === 'play' ? tutTipLayout() : null;
  return layout ? layout.lines.length * 10 + 4 + layout.rise : 0;
};
// A small blinking triangle at (x, y), its tip toward (ux, uy).
function triangle(x, y, ux, uy, col) {
  for (const [c, g] of [['#07080a', 1], [col, 0]]) {
    ctx.fillStyle = c;
    for (let py = -5; py <= 5; py++) for (let px = -5; px <= 5; px++) {
      const a = px * ux + py * uy, b = -px * uy + py * ux;
      if (a <= 3 + g && a >= -2 - g && Math.abs(b) <= (3 - a) * 0.62 + g * 0.9) ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}
function drawTut() {
  if (mode !== 'play') return;
  drawTipLine();
}
function tutTipAt(t) {
  if (t.cur) return [currencyX(t.cur), 8];
  const a = TUT.anchors[t.key];
  if (a && a.g === G) {
    const p = a.at();
    if (p) return p;
  }
  if (t.key === 'p_move') {
    const h = G.helis[0]; return h ? [h.x - G.camX, h.y - h.alt - G.camY] : null;
  }
  if (t.key === 'p_ram') return RAMCARD.on ? [RAMCARD.x + RAMCARD.w / 2, RAMCARD.y + 13] : null;
  if (['p_plane', 'p_plane_double', 'p_b2', 'p_charge'].includes(t.key) && mode === 'play') {
    const slot = airBandSlots().find((s) => t.key === 'p_b2' ? s.gift : !s.gift);
    return slot ? [slot.x + slot.w / 2, slot.y + slot.h / 2] : null;
  }
  return null;
}
function tutTipLayout() {
  const t = TUT.tip;
  if (!t) return null;
  const lines = wrap(t.msg, W - 36), w = Math.max(...lines.map((l) => tw(l))), target = tutTipAt(t), aw = target ? 12 : 0;
  const x = Math.round((W - w - aw) / 2), h = lines.length * 10 + 3;
  const baseY = (mode === 'depot' ? H - 60 : cardsTop() - 22) - (lines.length - 1) * 10;
  const overlapsRadar = mode === 'play' && x - 5 < W - 5 && x + w + aw + 5 > W - 79;
  const y = overlapsRadar ? Math.min(baseY, VH - 79 - h - 5) : baseY;
  return { x, y, w: w + aw, h, lines, target, aw, rise: baseY - y };
}
function drawTipLine() {
  const t = TUT.tip;
  if (!t) return;
  const { x, y, w, h, lines: L, target: p, aw } = tutTipLayout();
  const col = t.cur === 'scrap' ? U.blue : t.cur === 'surv' ? U.amber : U.gold;
  ctx.globalAlpha = t.t < TIPC.fadeIn ? t.t / TIPC.fadeIn : Math.min(1, (TIPC.duration - t.t) / TIPC.fadeOut);
  ctx.fillStyle = 'rgba(5,6,8,0.7)';
  ctx.fillRect(x - 5, y - 3, w + 10, h);
  L.forEach((l, i) => text(l, x + aw, y + i * 10, col));
  // the arrow toward the thing it means, blinking
  if (p && Math.floor(realT * 4) % 2 === 0) {
    const cx = x + 4, cy = y + 3, dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    triangle(cx, cy, dx / l, dy / l, col);
  }
  ctx.globalAlpha = 1;
}

// ---------- the Depot: the hint bar and the tags
// Currency tips own the lessons; treeHint supplies the ordinary bottom-bar guidance.
function tutHint() {
  return null;
}
// The fresh Depot tag points to an affordable blue node until the player buys one.
function tutTag() {
  if (depotTab !== 'tree' || NODES.some((n) => n.k === 'scrap' && lv(n.id) > 0)) return null;
  const first = NODES.find((n) => n.k === 'scrap' && nodeState(n) === 'buy');
  return first ? [first.id, 'CHOOSE ANY BLUE UPGRADE.'] : null;
}
function drawTutTags() {
  if (TUT.tip) { drawTipLine(); return; }
  const g = tutTag();
  if (!g) return;
  const [id, msg] = g, L = tw(msg) > 190 ? wrap(msg, 190) : [msg];
  const w = Math.max(...L.map((l) => tw(l))) + 12, h = L.length * 10 + 6, bob = Math.round(Math.sin(realT * 6) * 1.5);
  let x, y, ux, uy;
  const p = nodeXY(id), r = halfOf(NODE[id]) + 10, sides = [
    [p.x + r, p.y - h / 2, -1, 0], [p.x - r - w, p.y - h / 2, 1, 0], [p.x - w / 2, p.y - r - h, 0, 1], [p.x - w / 2, p.y + r + 12, 0, -1]];
  let best = 1e9;
  for (const [sx, sy, dx, dy] of sides) {
    let n = sx < 4 || sy < TREE.y0 + 3 || sx + w > W - 4 || sy + h > TREE.y1 - 3 ? 100 : 0;
    for (const o of NODES) {
      if (o.id === id || !shownAs(o)) continue;
      const q = nodeXY(o.id), a = halfOf(o) + 2;
      if (q.x + a > sx && q.x - a < sx + w && q.y + a + 12 > sy && q.y - a < sy + h) n++;
    }
    if (n < best) [best, x, y, ux, uy] = [n, sx, sy, dx, dy];
  }
  x += -ux * bob;
  y = clamp(Math.round(y - uy * bob), TREE.y0 + 3, TREE.y1 - 3 - h);
  const ax = ux ? (ux < 0 ? x - 4 : x + w + 3) : p.x, ay = uy ? (uy < 0 ? y - 4 : y + h + 3) : p.y;
  x = Math.round(x);
  panel(x, y, w, h, 'rgba(14,12,8,0.95)');
  frame(x, y, w, h, '#b8862f');
  L.forEach((l, i) => text(l, x + 6, y + 4 + i * 10, U.gold));
  triangle(Math.round(ax), Math.round(ay), ux, uy, U.gold);
}

// ---------- the pause menu
// PAUSE = the menu's box (a click outside it goes on with the run)
const PAUSE = { x: 0, y: 0, w: 0, h: 0 };
// true when a click at (x, y) is on the pause menu or the end card (it does not go on)
const pauseHit = (x, y) => !!TUT.card || inR(x, y, PAUSE.x, PAUSE.y, PAUSE.w, PAUSE.h);
function drawPause() {
  ctx.fillStyle = 'rgba(5,6,8,0.6)';
  ctx.fillRect(0, 19, W, H - 19);
  if (TUT.card) {
    drawEndCard();
    return;
  }
  const L = ['YOUR VIPER FIGHTS BY ITSELF.', 'RIGHT CLICK: ATTACK OR MOVE.', 'FLY OVER A SURVIVOR TO WINCH THEM UP.'];
  if (G.up.ram) L.push('PRESS SPACE TO RAM.');
  if (G.up.planeOwned.length) L.push('Q / W: AIM PLANE. DOUBLE TAP: SMART STRIKE.');
  L.push('T: CAMERA.  M: SOUND.  WHEEL: ZOOM.');
  const w = 280, h = 112 + L.length * 10, x = Math.round(W / 2 - w / 2), y = Math.max(22, Math.round((H + 19) / 2 - h / 2)), cx = x + w / 2;
  Object.assign(PAUSE, { x, y, w, h });
  panel(x, y, w, h, '#0f1014');
  text('PAUSED', cx, y + 9, U.ink, { align: 'center', scale: 2, drop: true });
  if (button(cx - 70, y + 30, 140, 20, 'RESUME', { primary: true })) setPaused(false);
  if (button(cx - 70, y + 55, 140, 20, 'BACK TO DEPOT', { danger: true })) quitRun();
  text('YOU KEEP ALL YOUR SCRAP.', cx, y + 80, U.dim, { align: 'center' });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, y + 93, w - 28, 1);
  L.forEach((l, i) => text(l, cx, y + 100 + i * 10, U.faint, { align: 'center' }));
  text('ESC OR CLICK OUTSIDE: RESUME', cx, y + h + 6, U.dim, { align: 'center' });
}
// BACK TO DEPOT: the run ends here (no blast); what it earned is kept, and the summary shows it.
function quitRun() {
  if (mode !== 'play' || !G || G.demo || G.result) return;
  paused = false;
  G.result = 'quit';
  G.lock = null;
  banners.length = 0;
  SFX.ramStop(0.1);
  endGame();
}

// ---------- the finale thanks card (after the short leg summary)
function openEndCard() {
  if (mode !== 'summary' || G.sum?.leg !== 12 || G.sum.result !== 'won') return false;
  TUT.card = { finale: true, t: realT, replay: G.sum.replay };
  M.px = M.py = -1e4;
  SFX.total();
  return true;
}
function endCardLayout() {
  const w = Math.min(W - 24, 288), h = 140, x = Math.round((W - w) / 2), y = Math.max(20, Math.round((H - h) / 2));
  return { x, y, w, h, button: { x: Math.round(W / 2 - 70), y: y + h - 31, w: 140, h: 20 } };
}
function drawEndCard() {
  const c = TUT.card;
  if (!c?.finale) return;
  const u = clamp((realT - c.t) / 0.3, 0, 1), layout = endCardLayout(), { x, y, w, h } = layout, cx = x + w / 2;
  ctx.fillStyle = 'rgba(5,6,8,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = u;
  panel(x, y + Math.round((1 - u) * 8), w, h, '#0f1014');
  frame(x, y, w, h, '#b8862f');
  ctx.globalAlpha = 1;
  if (u < 1) return;
  text('THANKS FOR PLAYING!', cx, y + 13, U.gold, { align: 'center', scale: 2, drop: true });
  text('FARMLANDS TERMINUS REACHED.', cx, y + 39, U.ink, { align: 'center' });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, y + 56, w - 28, 1);
  text('MORE IN THE FULL GAME.', cx, y + 69, U.gold, { align: 'center' });
  text('REPLAY ANY LEG FOR SCRAP.', cx, y + 84, U.dim, { align: 'center' });
  const b = layout.button;
  if (button(b.x, b.y, b.w, b.h, 'TO THE DEPOT', { primary: true })) summaryContinue();
  text('ENTER', b.x + b.w + 6, b.y + 7, U.faint, { outline: false });
}
// The summary's lines for a lesson from this run, worked out as
// the summary opens.
function tutSumLines() {
  return TUT.sum;
}
function tutSumOpen() {
  TUT.sum = [];
}

// ---------- the fade between screens
function drawFade() {
  if (TUT.fade <= 0) return;
  ctx.globalAlpha = Math.min(1, TUT.fade);
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ---------- tests
Object.assign(window.__sr, {
  // tut(name, data): send a tutorial event; seen() = the prompts shown so far (SAVE.seen)
  tut: (name, d) => tutEvent(name, d),
  seen: () => Object.keys(SAVE.seen).filter((k) => SAVE.seen[k] === true),
  // tutState() preserves empty task diagnostics for old callers; all teaching is one tip now.
  tutState: () => ({
    tasks: [], queued: 0, tip: TUT.tip && TUT.tip.msg,
    tips: tutPending().length, tipKey: TUT.tip?.key || null, tipAge: TUT.tip?.t || 0,
    queuedKeys: tutPending().filter(tutEligible), pendingKeys: tutPending(), layout: tutTipLayout(),
    lessonText: Object.entries(TIP_DEFS).map(([key, d]) => ({ key, text: d.msg })).concat([
      { key: 'p_wall_ram', text: 'A DEAD WALL! PRESS SPACE TO RAM IT.' }]),
    fontOK: Object.values(TIP_DEFS).every((d) => [...d.msg].every((c) => c === ' ' || GL[c])) &&
      [...'A DEAD WALL! PRESS SPACE TO RAM IT.'].every((c) => c === ' ' || GL[c]),
    radio: RADIO.cur && RADIO.cur.msg, banner: banners[0] && banners[0].a, tag: mode === 'depot' && !TUT.tip ? tutTag() : null,
    hint: mode === 'depot' ? tutHint() : null, card: !!TUT.card,
    endCard: TUT.card?.finale ? { title: 'THANKS FOR PLAYING!', buttonLabel: 'TO THE DEPOT', ...endCardLayout(), replay: TUT.card.replay } : null,
    fade: +TUT.fade.toFixed(2), paused
  }),
  quit: () => quitRun()
});
