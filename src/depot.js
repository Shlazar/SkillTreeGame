// depot.js - the DEPOT between runs: spend the bank on upgrades (14 cards in 3 columns: the
// helicopter, the train and the station), pick a trip on the route, and go. The title demo runs on
// behind a dark veil. On a narrow screen the columns become tabs; on a short one the cards are
// smaller and lose their effect line.

// tab = the column shown on a narrow screen, flash[id] = time left of a bought card's flash,
// pops = rising "+1"s
const DEP = { tab: 0, flash: {}, pops: [] };
const GROUP_ICON = () => [ICON.heli, ICON.train, ICON.house];

// Where everything goes at this screen size.
function depotLayout() {
  const narrow = W < 632, short = H < 360, ch = short ? 30 : 44, gap = short ? 32 : 48;
  const top = narrow ? 42 : 38, py = H - (short ? 64 : 68), x0 = Math.floor((W - 624) / 2);
  const cards = [];
  for (const u of UPG) {
    if (narrow && u.group !== DEP.tab) continue;
    const i = cards.filter((c) => c.u.group === u.group).length;
    cards.push({ u, x: narrow ? Math.floor((W - 200) / 2) : x0 + u.group * 212, y: top + i * gap, w: 200, h: ch });
  }
  return { narrow, short, cards, x0, py, rw: narrow ? Math.max(100, W - 200) : 360 };
}

// One upgrade card. Left click buys, right click pins it (the run's top bar then counts toward it).
function depotCard(c, w, sh) {
  const u = c.u, id = u.id, L = lvl(id), max = upgMaxed(id), locked = upgLocked(id), cost = upgCost(id);
  const can = !max && !locked && cost <= w, hov = inR(M.x, M.y, c.x, c.y, c.w, c.h), fl = DEP.flash[id] > 0;
  const x = c.x, y = c.y;
  ctx.fillStyle = fl ? '#d8d2c0' : hov ? '#17191e' : '#101115';
  ctx.fillRect(x + 1, y + 1, c.w - 2, c.h - 2);
  frame(x, y, c.w, c.h, can ? (Math.sin(realT * 6) > 0 ? '#f0c264' : '#9a7228') : hov ? '#4a4f5a' : '#2e3139');
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(x + 2, y + 1, c.w - 4, 1);
  ctx.globalAlpha = locked ? 0.35 : 1;
  ctx.drawImage(ICON.up[id], x + 6, y + (sh ? 9 : 6));
  ctx.globalAlpha = 1;
  text(locked ? '???' : u.name, x + 24, y + 5, locked ? U.faint : U.ink);
  if (!locked) text(max ? 'MAX' : 'LV ' + L, x + 194, y + 5, max ? '#8fd18a' : U.dim, { align: 'right' });
  if (!sh && !locked) {
    const fx = max ? u.val(L) + ' ' + u.unit : u.group === 2 && id !== 'pads' && !L ? 'NOT BUILT > BUILD' : u.val(L) + ' > ' + u.val(L + 1) + ' ' + u.unit;
    text(fx, x + 24, y + 17, U.dim, { outline: false });
  }
  const ry = y + (sh ? 17 : 30), pyy = y + (sh ? 15 : 27);
  if (!locked) text(u.role, x + 24, ry, '#4e525b', { outline: false });
  if (locked) text('REACH TRIP ' + u.trip, x + 194, pyy + 3, U.faint, { align: 'right', outline: false });
  else if (!max) {
    ctx.fillStyle = can ? '#2e2310' : '#17181c';
    ctx.fillRect(x + 137, pyy + 1, 56, 11);
    frame(x + 136, pyy, 58, 13, can ? U.gold : '#3a3e48');
    text('$' + fmt(cost), x + 165, pyy + 3, can ? U.gold : U.faint, { align: 'center', outline: false });
  }
  if (META.pin === id) ctx.drawImage(ICON.pin, x + 2, y + 2);
  if (hov && !locked) cursor = 'pointer';
  if (hov && M.rpressed && !locked && !max) {
    META.pin = META.pin === id ? null : id;
    saveMeta();
    SFX.ui();
  }
  if (M.released && !M.used && inR(M.px, M.py, x, y, c.w, c.h) && hov) {
    M.used = true;
    if (buyUpg(id)) {
      DEP.flash[id] = 0.15;
      DEP.pops.push({ x: x + 165, y: y + 4, t: 0 });
      SFX.buy();
    } else if (!locked && !max) SFX.ui();
  }
  return hov;
}

// Pick the trip: one step back or on (only up to the farthest one unlocked).
function depotTrip(d) {
  const t = clamp(META.trip + d, 1, META.maxTrip);
  if (t !== META.trip) {
    META.trip = t;
    saveMeta();
    SFX.ui();
  }
}
// The longest of the strings that fits in width w.
const fitText = (list, w) => list.find((s) => tw(s) <= w) || list[list.length - 1];
// Split a long line into lines no wider than w.
function wrapText(s, w) {
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

function drawDepot() {
  ctx.fillStyle = 'rgba(5,6,8,0.7)';
  ctx.fillRect(0, 0, W, H);
  const Lo = depotLayout(), w = wallet();
  for (const id in DEP.flash) DEP.flash[id] -= frameDt;
  // the top bar: DEPOT, the wallet, the camp
  ctx.fillStyle = 'rgba(6,7,9,0.92)';
  ctx.fillRect(0, 0, W, 20);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 20, W, 1);
  text('DEPOT', 8, 7, U.ink);
  const ws = '$' + fmt(G.shownCash), ww = tw(ws, 2) + 10, wx = Math.round(W / 2 - ww / 2);
  ctx.drawImage(ICON.coin, wx, 6);
  text(ws, wx + 10, 3, U.gold, { scale: 2 });
  text('CAMP ' + fmt(META.camp) + (META.camp ? ' +' + fmtNum(META.camp * 0.5) + '%' : ''), W - 8, 7, '#8fd18a', { align: 'right' });
  // the column heads, or the tabs on a narrow screen
  const gi = GROUP_ICON();
  if (Lo.narrow) {
    ['HELI', 'TRAIN', 'STATION'].forEach((n, i) => {
      if (button(Math.round(W / 2 - 100 + i * 68), 24, 64, 14, n, { primary: DEP.tab === i })) DEP.tab = i;
    });
  } else {
    GROUPS.forEach((n, i) => {
      const x = Lo.x0 + i * 212;
      ctx.drawImage(gi[i], x, 25);
      text(n, x + gi[i].width + 4, 26, U.dim);
    });
  }
  // the cards
  let hover = null;
  for (const c of Lo.cards) if (depotCard(c, w, Lo.short)) hover = c.u;
  // the info strip: the hovered card in full, or how the depot works
  const iy = Lo.py - 12;
  let info = 'LEFT CLICK: BUY.   RIGHT CLICK: PIN A CARD (THE TOP BAR COUNTS UP TO IT IN A RUN).';
  if (hover) info = upgLocked(hover.id) ? 'REACH TRIP ' + hover.trip + ' TO UNLOCK THIS TOWER.' : hover.info(Math.max(1, lvl(hover.id)));
  const lines = wrapText(info, W - 16);
  if (!Lo.short || hover) {
    ctx.fillStyle = 'rgba(6,7,9,0.8)';
    ctx.fillRect(0, iy - (lines.length - 1) * 10 - 2, W, lines.length * 10 + 1);
    lines.forEach((l, i) => text(l, W / 2, iy - (lines.length - 1 - i) * 10, hover ? U.dim : U.faint, { align: 'center', outline: false }));
  }
  // the bottom panel: the route, the trip and what it holds, GO and TITLE
  const py = Lo.py, sel = META.trip, first = META.maxTrip <= 12 && sel <= 12 ? 1 : Math.max(1, sel - 6);
  panel(8, py, W - 16, 60, '#0f1014');
  const sp = Lo.rw / 11;
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(24 + 2, py + 14, Math.round(sp * 11), 1);
  for (let i = 0; i < 12; i++) {
    const T = first + i, dx = Math.round(24 + i * sp), dy = py + 12, open = T <= META.maxTrip;
    const cl = META.cleared.indexOf(T) >= 0, pf = META.perfect.indexOf(T) >= 0, on = T === sel;
    ctx.fillStyle = '#07080a';
    ctx.fillRect(dx - 1, dy - 1, 7, 7);
    if (!open) frame(dx, dy, 5, 5, '#3e434c');
    else {
      ctx.fillStyle = cl ? U.gold : '#3e434c';
      ctx.fillRect(dx, dy, 5, 5);
      if (pf) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx + 2, dy + 2, 1, 1);
      }
      if (on) {
        if (Math.floor(realT * 3) % 2 === 0) frame(dx - 1, dy - 1, 7, 7, U.ink);
        ctx.drawImage(ICON.skull, dx - 1, dy - 9);
      }
      if (inR(M.x, M.y, dx - 2, dy - 2, 9, 9)) {
        cursor = 'pointer';
        if (clicked(dx - 2, dy - 2, 9, 9)) {
          META.trip = T;
          saveMeta();
        }
      }
    }
  }
  if (button(22, py + 23, 12, 12, '<')) depotTrip(-1);
  const tl = 'TRIP ' + sel;
  text(tl, 40, py + 26, U.ink);
  const ax = 40 + tw(tl) + 6;
  if (button(ax, py + 23, 12, 12, '>')) depotTrip(1);
  const ti = tripInfo(sel), room = W - 174 - 24, bx = Math.max(110, ax + 20);
  text(fitText(['BOSS: ' + BOSS_NAME[ti.boss], BOSS_NAME[ti.boss].replace('THE ', '')], W - 174 - bx), bx, py + 26, U.red);
  const cm = cashMult(sel), done = META.perfect.indexOf(sel) >= 0 ? 'PERFECT' : META.cleared.indexOf(sel) >= 0 ? 'CLEARED' : 'FIRST CLEAR +$' + fmt(300 * cm);
  const info2 = fitText(['BRUTES ' + Math.round(ti.bruteHp) + 'HP   CASH ×' + cm.toFixed(2) + '   ' + done,
    'CASH ×' + cm.toFixed(2) + '   ' + done, 'CASH ×' + cm.toFixed(2)], room);
  text(info2, 24, py + 40, done === 'CLEARED' || done === 'PERFECT' ? U.gold : U.dim);
  if (button(W - 166, py + 8, 150, 28, 'GO!', { primary: true })) depotGo();
  if (button(W - 166, py + 41, 60, 14, 'TITLE')) toTitle();
  text('ENTER', W - 16, py + 45, U.faint, { align: 'right', outline: false });
  // the "+1"s rise from the price of a card just bought
  for (let i = DEP.pops.length - 1; i >= 0; i--) {
    const p = DEP.pops[i];
    p.t += frameDt;
    if (p.t > 0.7) {
      DEP.pops.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = clamp((0.7 - p.t) * 4, 0, 1);
    text('+1', p.x, p.y - p.t * 24, '#8fd18a', { align: 'center', scale: 2 });
    ctx.globalAlpha = 1;
  }
}
function depotGo() {
  startGame(META.trip);
}
// keys in the depot: Enter goes, Esc to the title, A / D (or the arrows) pick the trip, Tab
// changes the column on a narrow screen
function depotKey(k) {
  if (k === 'Enter') depotGo();
  else if (k === 'Escape') toTitle();
  else if (k === 'a' || k === 'ArrowLeft') depotTrip(-1);
  else if (k === 'd' || k === 'ArrowRight') depotTrip(1);
  else if (k === 'Tab') DEP.tab = (DEP.tab + 1) % 3;
}
