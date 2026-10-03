// stationtab.js - the STATION tab of the Depot: a station's 14 x 9 grid drawn with the real sprites
// (rails and the parked train, platform, lamps, house, the door path, the corn at the edges), and
// the towers you build on it. Cards on the right pick what to build (keys 1-3), an info box tells
// what it does, a waves box tells where the dead come from. Also the hold's bar in the run.

// ST = the tab's state: id = the station shown, sel = the tower type being placed, drag = a tower
// being moved {o, c, r}, flash = {c, r, t} the tile just built on, pops = little +N / -N words
const ST = { id: 'farm', sel: null, drag: null, flash: null, pops: [], paint: false };
const ST_CARDS = [
  { t: 'nest', key: '1', name: 'MG NEST' },
  { t: 'bag', key: '2', name: 'SANDBAGS' },
  { t: 'wire', key: '3', name: 'WIRE' },
  { t: 'mortar', key: '4', name: 'MORTAR' }
];
const ST_GUIDE = [
  'THIS IS FARM STOP. YOUR TOWERS WAIT HERE.',
  'WAVE 2 CAME FROM THE EAST. PUT A NEW MG NEST THERE.',
  'DRAG TO MOVE. RIGHT CLICK: SELL (FULL REFUND).'
];
const GUIDE_TILE = [11, 5];

// the stations you can see in the tab: Farm Stop, and the others once reached
const stTabList = () => STATIONS.filter((d, i) => i === 0 || SAVE.reached.includes(d.id));
const stDef = () => stTabList().find((d) => d.id === ST.id) || STATIONS[0];
const canBuild = () => stationOpen();
const wireOpen = () => lv('wire') > 0;
// the guided steps: 0..2, or 3 = done
const guideStep = () => (stationOpen() ? Math.min(3, SAVE.flags.stGuide | 0) : 3);
function guideNext() {
  SAVE.flags.stGuide = guideStep() + 1;
  saveSave();
  SFX.ui();
}

// Where everything goes this frame: k = zoom (2 when the window has the room), T = tile px on
// screen, the grid at (gx, gy), the column on the right at (cx, cy) w cw.
function stLayout(y0, y1) {
  let k = 2;
  if (y1 - y0 - 18 < GRID_R * 32 || W - 14 * 32 - 26 < 150) k = 1;
  const T = TILE * k, gx = 14, gy = y0 + 15, gw = GRID_C * T, gh = GRID_R * T;
  const cx = gx + gw + 12, cw = W - cx - 6;
  return { k, T, gx, gy, gw, gh, cx, cy: gy, cw, y0, y1 };
}
let ST_L = stLayout(19, 331);
// the tile under the mouse, or null
function stTile(L) {
  const c = Math.floor((M.x - L.gx) / L.T), r = Math.floor((M.y - L.gy) / L.T);
  return M.inside && c >= 0 && r >= 0 && c < GRID_C && r < GRID_R ? { c, r } : null;
}
// screen point of a world offset round the station: u px east of the rails, a px along (south +)
const stX = (L, u) => L.gx + (u / TILE + 7) * L.T;
const stY = (L, a) => L.gy + (a / TILE + 4) * L.T;
// a sprite (with anchor ax, ay) at a screen point, at the zoom
function zblit(spr, x, y, ax, ay, k) {
  blit(spr, Math.round(x - ax * k), Math.round(y - ay * k), spr.width * k, spr.height * k);
}

// ---------- the build rules
const itemAt = (list, c, r) => list.find((o) => o.c === c && o.r === r) || null;
// why tower type t can't go on tile (c, r) now ('' = it can)
function whyNot(def, list, t, c, r, moving) {
  if (tileAt(def, c, r) !== '.') return 'BLOCKED';
  const o = itemAt(list, c, r);
  if (o && o !== moving) return 'TAKEN';
  if (moving) return '';
  if (t === 'wire' && !wireOpen()) return 'LOCKED';
  if (builtOf(list, t) >= TOWER[t].max) return 'MAX';
  if (towerPrice(list, t) > SAVE.scrap) return 'SCRAP';
  return '';
}
// Build tower type t on tile (c, r) of station id and pay for it. True when built.
function stPlace(id, t, c, r) {
  const def = stopDef(id), list = towersOf(id);
  if (!def || !TOWER[t] || whyNot(def, list, t, c, r)) return false;
  const paid = towerPrice(list, t);
  list.push({ t, c, r, paid });
  SAVE.scrap -= paid;
  SAVE.towers[id] = list;
  saveSave();
  SFX.place();
  ST.flash = { c, r, t: realT };
  stPop(c, r, paid ? '-' + paid : 'FREE', paid ? U.gold : U.green);
  if (t === 'nest' && guideStep() === 1) guideNext();
  return true;
}
// Sell what stands on tile (c, r): all of its price comes back (a free one goes back to FREE).
function stSell(id, c, r) {
  const list = towersOf(id), o = itemAt(list, c, r);
  if (!o) return false;
  list.splice(list.indexOf(o), 1);
  SAVE.scrap += o.paid;
  SAVE.towers[id] = list;
  saveSave();
  SFX.sell();
  stPop(c, r, o.paid ? '+' + o.paid : 'FREE', o.paid ? U.gold : U.green);
  return true;
}
// Move what stands on (c, r) to (c2, r2). Free.
function stMove(id, c, r, c2, r2) {
  const def = stopDef(id), list = towersOf(id), o = itemAt(list, c, r);
  if (!o || whyNot(def, list, o.t, c2, r2, o)) return false;
  o.c = c2;
  o.r = r2;
  SAVE.towers[id] = list;
  saveSave();
  SFX.place();
  ST.flash = { c: c2, r: r2, t: realT };
  return true;
}
function stPop(c, r, s, col) {
  ST.pops.push({ c, r, s, col, t: realT });
}
function stSelect(t) {
  if (!canBuild() || t === 'mortar') {
    SFX.deny();
    return;
  }
  if (t === 'wire' && !wireOpen()) {
    SFX.deny();
    return;
  }
  ST.sel = ST.sel === t ? null : t;
  ST.drag = null;
  SFX.ui();
}
// Keys on the Station tab: 1-3 pick a tower, ESC drops it (true when the key was used here).
function stationKey(k) {
  const card = ST_CARDS.find((c) => c.key === k && c.t !== 'mortar');
  if (card) {
    stSelect(card.t);
    return true;
  }
  if (k === 'Escape' && (ST.sel || ST.drag)) {
    ST.sel = null;
    ST.drag = null;
    SFX.ui();
    return true;
  }
  return false;
}
function stPick(dir) {
  const list = stTabList(), i = Math.max(0, list.findIndex((d) => d.id === ST.id));
  if (list.length < 2) return;
  ST.id = list[mod(i + dir, list.length)].id;
  ST.sel = ST.drag = null;
  SFX.ui();
}

// ---------- the tab
function drawStationTab(y0, y1) {
  const L = (ST_L = stLayout(y0, y1)), def = stDef(), list = towersOf(def.id), open = canBuild();
  ST.id = def.id;
  const tile = stTile(L);
  stHeader(L, def);
  stInput(L, def, list, tile);
  stGrid(L, def, list, tile);
  stCards(L, def, list);
  if (!open) stLocked(L, def);
  else if (guideStep() < 3 && def.id === 'farm') stGuide(L);
}
// The top line: the station picker, and the hold times.
function stHeader(L, def) {
  const y = L.y0 + 2, many = stTabList().length > 1;
  if (button(L.gx, y, 13, 12, '<', { off: !many })) stPick(-1);
  const nw = 100;
  panel(L.gx + 15, y, nw, 12, '#0b0c0f');
  text(def.name, L.gx + 15 + nw / 2 - tw(def.km.toFixed(1) + ' KM') / 2 - 3, y + 3, U.teal, { align: 'center' });
  text(def.km.toFixed(1) + ' KM', L.gx + 15 + nw / 2 + tw(def.name) / 2 + 3, y + 3, U.dim, { align: 'center' });
  if (button(L.gx + 17 + nw, y, 13, 12, '>', { off: !many })) stPick(1);
  const s = 'FIRST HOLD ' + def.first.T + ' S, LATER ' + def.later.T + ' S';
  if (L.gx + 140 + tw(s) < L.gx + L.gw) text(s, L.gx + L.gw, y + 3, U.dim, { align: 'right' });
}
// The mouse on the grid: place, paint wire, drag to move, right click to sell or drop.
function stInput(L, def, list, tile) {
  if (!canBuild()) return;
  if (tile && (ST.sel || itemAt(list, tile.c, tile.r))) cursor = 'pointer';
  if (M.rpressed) {
    if (tile && itemAt(list, tile.c, tile.r) && !ST.drag) stSell(def.id, tile.c, tile.r);
    else if (ST.sel || ST.drag) {
      ST.sel = ST.drag = null;
      SFX.ui();
    }
    M.rpressed = false;
    return;
  }
  if (M.pressed && tile && !M.used) {
    const o = itemAt(list, tile.c, tile.r);
    if (ST.sel) {
      if (!stPlace(def.id, ST.sel, tile.c, tile.r) && !o) SFX.deny();
      ST.paint = ST.sel === 'wire';
    } else if (o) ST.drag = { o, c: o.c, r: o.r };
    M.used = true;
  }
  // wire: hold the button and paint
  if (ST.paint && M.down && ST.sel === 'wire' && tile && !itemAt(list, tile.c, tile.r)) {
    if (!whyNot(def, list, 'wire', tile.c, tile.r)) stPlace(def.id, 'wire', tile.c, tile.r);
  }
  if (!M.down) ST.paint = false;
  if (ST.drag && M.released) {
    const d = ST.drag;
    ST.drag = null;
    if (tile && (tile.c !== d.c || tile.r !== d.r) && !stMove(def.id, d.c, d.r, tile.c, tile.r)) SFX.deny();
  }
}
// A tile's sprite at the zoom: ground, then what stands on it.
const HATCH = {};
function hatch(T) {
  if (!HATCH[T]) {
    HATCH[T] = pix(T, T, (r) => {
      for (let i = -T; i < T; i += 6) for (let j = 0; j < T; j++) if (i + j >= 0 && i + j < T) r(i + j, j, 1, 1, 'rgba(255,255,255,0.10)');
    });
  }
  return HATCH[T];
}
function stGrid(L, def, list, tile) {
  const { k, T, gx, gy, gw, gh } = L, A = towerArt(), side = def.side;
  ctx.fillStyle = '#07080a';
  ctx.fillRect(gx - 7, gy - 1, gw + 14, gh + 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx - 6, gy, gw + 12, gh);
  ctx.clip();
  // the ground: a checker, the corn at both edges
  for (let r = 0; r < GRID_R; r++) for (let c = 0; c < GRID_C; c++) {
    ctx.fillStyle = (c + r) & 1 ? '#323f29' : '#2b3928';
    ctx.fillRect(gx + c * T, gy + r * T, T, T);
  }
  ctx.fillStyle = '#3c4420';
  ctx.fillRect(gx - 6, gy, 6, gh);
  ctx.fillRect(gx + gw, gy, 6, gh);
  for (let a = -64; a < 84; a += 7) for (const sd of [-1, 1]) zblit(A.corn[((a + 70) / 7 | 0) % 3].spr, stX(L, sd * 117), stY(L, a + 6), 5, 18, k);
  // the door path
  ctx.fillStyle = '#4a3f30';
  const dc = side > 0 ? 9 : 3;
  ctx.fillRect(gx + dc * T, gy + 3 * T + 2 * k, 2 * T, 2 * T - 4 * k);
  ctx.fillStyle = '#5a4c38';
  for (let i = 0; i < 12; i++) ctx.fillRect(gx + dc * T + ((i * 37) % (2 * T - 2)), gy + 3 * T + 4 * k + ((i * 53) % (2 * T - 10 * k)), k, k);
  // the rails, the ballast and the sleepers
  ctx.fillStyle = '#3b3732';
  ctx.fillRect(gx + 6 * T + 2 * k, gy, 2 * T - 4 * k, gh);
  ctx.fillStyle = '#3d2d20';
  for (let y = 0; y < gh; y += 5 * k) ctx.fillRect(gx + 6 * T + 4 * k, gy + y, 2 * T - 8 * k, 2 * k);
  ctx.fillStyle = '#8f959e';
  ctx.fillRect(stX(L, -4) - k, gy, k, gh);
  ctx.fillRect(stX(L, 4), gy, k, gh);
  // the platform, the lamps, the house
  const pu = side * 24;
  for (let r = 0.75; r <= 7.3; r += 0.75) zblit(STATION.slab.spr, stX(L, pu), stY(L, (r - 3.5) * TILE), STATION.slab.ax, STATION.slab.ay, k);
  // the parked train (the tanker stands south of the grid)
  const ai = angIdx(0);
  for (let i = 0; i < CAR.n; i++) {
    const img = TRAIN[i].n[ai];
    zblit(img, stX(L, 0), stY(L, -32 + i * (CAR.L + CAR.gap)), img.ox, img.oy, k);
  }
  for (const r of [2, 6]) zblit(STATION.lamp.spr, stX(L, pu), stY(L, (r - 3.5) * TILE), STATION.lamp.ax, STATION.lamp.ay, k);
  zblit(STATION.house.spr, stX(L, side * 80), stY(L, 0.6 * TILE), STATION.house.ax, STATION.house.ay, k);
  // blocked tiles: hatched. Grid lines.
  const hs = hatch(T);
  for (let r = 0; r < GRID_R; r++) for (let c = 0; c < GRID_C; c++) if (tileAt(def, c, r) !== '.') ctx.drawImage(hs, gx + c * T, gy + r * T);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let c = 1; c < GRID_C; c++) ctx.fillRect(gx + c * T, gy, 1, gh);
  for (let r = 1; r < GRID_R; r++) ctx.fillRect(gx, gy + r * T, gw, 1);
  // the guided step's tile glows
  if (canBuild() && guideStep() === 1 && def.id === 'farm') {
    const [c, r] = GUIDE_TILE, a = 0.35 + 0.3 * Math.sin(realT * 6);
    ctx.fillStyle = 'rgba(227,176,75,' + a.toFixed(2) + ')';
    ctx.fillRect(gx + c * T, gy + r * T, T, T);
    frame(gx + c * T, gy + r * T, T, T, U.gold);
  }
  // the towers (back to front); the one being dragged is drawn under the mouse
  const sorted = list.slice().sort((a, b) => a.r - b.r || (a.t === 'wire' ? -1 : 1));
  for (const o of sorted) {
    if (ST.drag && ST.drag.o === o) continue;
    stItem(L, o.t, o.c, o.r, 1);
  }
  // the WAVES arrows on the lanes, both edges
  const blink = Math.floor(realT * 2) % 2 ? U.red : '#a8241a';
  for (const r of HOLD.lanes) {
    const y = gy + r * T + T / 2;
    laneArrow(gx + 2, y, 1, blink, k);
    laneArrow(gx + gw - 3, y, -1, blink, k);
  }
  text('WAVES', gx + 4, gy + HOLD.lanes[0] * T - 9, U.red);
  text('WAVES', gx + gw - 4, gy + HOLD.lanes[0] * T - 9, U.red, { align: 'right' });
  // the build: hover a nest to see its range, the ghost of what is placed or moved
  const hov = tile && itemAt(list, tile.c, tile.r);
  if (tile && canBuild() && (ST.sel || ST.drag)) {
    const t = ST.drag ? ST.drag.o.t : ST.sel, why = whyNot(def, list, t, tile.c, tile.r, ST.drag && ST.drag.o);
    ctx.globalAlpha = 0.65;
    stItem(L, t, tile.c, tile.r, 1);
    ctx.globalAlpha = 1;
    const col = why ? U.red : '#7ee07a', x = gx + tile.c * T, y = gy + tile.r * T;
    frame(x, y, T, T, col);
    frame(x + 1, y + 1, T - 2, T - 2, col);
    if (t === 'nest' && !why) stRange(L, tile.c, tile.r);
    if (why && why !== 'TAKEN' && why !== 'BLOCKED') text(why === 'SCRAP' ? 'NEED ' + towerPrice(list, t) : why, x + T / 2, y + T + 2, U.red, { align: 'center' });
  } else if (hov && hov.t === 'nest') stRange(L, hov.c, hov.r);
  if (hov && !ST.sel && !ST.drag && canBuild()) frame(gx + hov.c * T, gy + hov.r * T, T, T, U.ink);
  // the tile just built on flashes; +N / -N rise from it
  if (ST.flash && realT - ST.flash.t < 0.35) {
    ctx.globalAlpha = 1 - (realT - ST.flash.t) / 0.35;
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(gx + ST.flash.c * T, gy + ST.flash.r * T, T, T);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  for (let i = ST.pops.length - 1; i >= 0; i--) {
    const p = ST.pops[i], u = (realT - p.t) / 0.9;
    if (u >= 1) {
      ST.pops.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 1 - u * u;
    text(p.s, gx + p.c * T + T / 2, gy + p.r * T + T / 2 - 4 - u * 14, p.col, { align: 'center' });
    ctx.globalAlpha = 1;
  }
  frame(gx - 7, gy - 1, gw + 14, gh + 2, '#2e3139');
}
// a tower at tile (c, r) at the zoom
function stItem(L, t, c, r, a) {
  const A = towerArt(), k = L.k, x = L.gx + (c + 0.5) * L.T, y = L.gy + (r + 0.5) * L.T;
  if (t === 'nest') {
    const p = A.nest[nestIdx(c < 6.5 ? -Math.PI / 2 : Math.PI / 2)];
    zblit(p.spr, x, y + 4 * k, p.ax, p.ay, k);
  } else if (t === 'bag') zblit(A.bag.spr, x, y + 3 * k, A.bag.ax, A.bag.ay, k);
  else if (t === 'wire') zblit(A.wire.spr, x, y + 3 * k, A.wire.ax, A.wire.ay, k);
}
// a nest's range as a dotted oval (96 px across the rails, squashed along them)
function stRange(L, c, r) {
  const x = L.gx + (c + 0.5) * L.T, y = L.gy + (r + 0.5) * L.T, rx = TOWER.nest.range * L.k;
  pell(x, y, rx, rx * FORE, 'rgba(255,241,194,0.75)');
}
// a red arrow on a lane, pointing in (dir 1 = right)
function laneArrow(x, y, dir, col, k) {
  ctx.fillStyle = '#07080a';
  for (let i = -1; i <= 5; i++) ctx.fillRect(x + dir * (i - 1) * k - (dir < 0 ? k : 0), y - (6 - i) * k / 1.2 - k, k, ((6 - i) * 2 / 1.2 + 2) * k);
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) ctx.fillRect(x + dir * i * k - (dir < 0 ? k : 0), y - (5 - i) * k / 1.2, k, (5 - i) * 2 / 1.2 * k + k);
}
// The cards (what to build, its price, how many stand), the info box and the waves box.
function stCards(L, def, list) {
  const x = L.cx, w = L.cw, open = canBuild();
  let y = L.cy;
  panel(x, y - 1, w, 12, '#0b0c0f');
  text('BUILD', x + 6, y + 2, U.teal);
  text('SCRAP ' + fmt(SAVE.scrap), x + w - 6, y + 2, U.gold, { align: 'right' });
  y += 14;
  let info = null;
  const ch = L.k === 2 ? 30 : 24;
  for (const cd of ST_CARDS) {
    const t = cd.t, on = ST.sel === t, mort = t === 'mortar', lock = mort || (t === 'wire' && !wireOpen());
    const hov = inR(M.x, M.y, x, y, w, ch - 2);
    ctx.fillStyle = on ? '#1d1a12' : hov && open ? '#1a1c22' : 'rgba(12,13,17,0.94)';
    ctx.fillRect(x + 1, y + 1, w - 2, ch - 4);
    frame(x, y, w, ch - 2, on ? U.gold : hov && open && !lock ? '#6a6f7b' : '#2e3139');
    if (on) frame(x + 1, y + 1, w - 2, ch - 4, '#b8862f');
    const nc = !open || lock ? U.faint : on ? U.gold : U.ink;
    text('[' + cd.key + ']', x + 5, y + 5, open && !lock ? U.dim : U.faint);
    text(cd.name, x + 24, y + 5, nc);
    let price, pc, sub, sc = U.dim;
    if (mort) {
      price = 'LOCKED';
      pc = U.faint;
      sub = NODE.mortar.cost[0] + ' SURVIVORS';
      sc = U.faint;
    } else if (t === 'wire' && !wireOpen()) {
      price = 'LOCKED';
      pc = U.faint;
      sub = 'BUY BARBED WIRE';
      sc = U.faint;
    } else {
      const n = builtOf(list, t), p = towerPrice(list, t);
      price = n >= TOWER[t].max ? 'MAX' : p ? String(p) : 'FREE';
      pc = n >= TOWER[t].max ? U.dim : !p ? U.green : p > SAVE.scrap ? U.red : U.gold;
      sub = n + '/' + TOWER[t].max + ' BUILT';
    }
    const pw = text(price, x + w - 6, y + 5, open ? pc : U.faint, { align: 'right' });
    if (!mort && !lock && price !== 'MAX' && price !== 'FREE' && open) blit(ICON.boltS, x + w - 14 - pw, y + 4);
    text(sub, x + 24, y + 15, sc);
    if (hov) info = t;
    if (hov && open && clicked(x, y, w, ch - 2)) stSelect(t);
    if (hov && open && !lock) cursor = 'pointer';
    y += ch;
  }
  // the info box: the card under the mouse, else the tower under it, else the one picked
  const tile = stTile(L), o = tile && itemAt(list, tile.c, tile.r);
  info = info || (o && o.t) || ST.sel;
  const ih = L.k === 2 ? 62 : 52;
  panel(x, y, w, ih, 'rgba(12,13,17,0.94)');
  stInfo(x + 6, y + 5, info, !!o && !ST.sel);
  y += ih + 3;
  // the waves box
  const wv = def.first.waves, wh = Math.min(L.gy + L.gh - y, 44);
  if (wh >= 30) {
    panel(x, y, w, wh, 'rgba(12,13,17,0.94)');
    text('WAVES', x + 6, y + 5, U.red);
    const nm = (v) => sideName(v.side * def.side);
    text('1 ' + nm(wv[0]) + '  2 ' + nm(wv[1]), x + 6, y + 16, U.ink);
    text('3 ' + nm(wv[2]) + ' + BRUTE', x + 6, y + 26, U.ink);
  }
}
// What a tower does, in a few lines (numbers from the game's own data).
function stInfo(x, y, t, placed) {
  const L = [];
  if (t === 'nest') {
    L.push(['MG NEST', U.teal], [UP.nest(lv('nestspd')) + ' ROUNDS/S  RANGE ' + Math.round(TOWER.nest.range / TILE) + ' TILES', U.ink],
      ['IT SHOOTS BY ITSELF.', U.dim]);
  } else if (t === 'bag') {
    L.push(['SANDBAGS', U.teal], ['THE DEAD CAN\'T WALK THROUGH.', U.ink], ['THEY CLIMB OVER AFTER ' + TOWER.bag.push + ' S.', U.dim]);
  } else if (t === 'wire') {
    L.push(['BARBED WIRE', U.teal], ['THE DEAD ON IT WALK AT ' + Math.round(CFG.wire.slow * 100) + '%.', U.ink]);
    L.push(wireOpen() ? ['HOLD THE BUTTON TO PAINT IT.', U.dim] : ['BUY BARBED WIRE IN THE TREE.', U.amber]);
  } else if (t === 'mortar') {
    L.push(['MORTAR PIT', U.faint], ['A BIG GUN FOR YOUR STATION.', U.dim], ['COMING SOON.', U.faint]);
  } else {
    L.push(['PICK A TOWER', U.teal], ['CLICK A CARD OR PRESS 1-3,', U.dim], ['THEN CLICK A TILE.', U.dim]);
  }
  if (t && t !== 'mortar') L.push([placed ? 'DRAG: MOVE.  R-CLICK: SELL' : 'R-CLICK A TOWER: SELL', U.faint]);
  L.forEach(([s, c], i) => text(s, x, y + i * 12, c));
}
// Before Farm Stop is held: the grid is a look only.
function stLocked(L, def) {
  const w = 236, h = 50, x = Math.round(L.gx + L.gw / 2 - w / 2), y = Math.round(L.gy + L.gh / 2 - h / 2);
  panel(x, y, w, h, 'rgba(10,11,14,0.94)');
  blit(ICON.lockBig, x + 10, y + 12);
  text(def.name + "'S FREE KIT", x + 44, y + 10, U.teal);
  text('HOLD FARM STOP ONCE', x + 44, y + 23, U.ink);
  text('TO BUILD HERE.', x + 44, y + 33, U.ink);
}
// The 3 guided steps, the first time the tab opens.
function stGuide(L) {
  const i = guideStep(), s = ST_GUIDE[i], w = Math.min(L.gw - 20, tw(s) + 96), h = 22;
  const x = Math.round(L.gx + L.gw / 2 - w / 2), y = L.gy + L.gh - h - 6;
  panel(x, y, w, h, 'rgba(10,11,14,0.96)');
  frame(x, y, w, h, U.gold);
  text((i + 1) + '/3', x + 6, y + 8, U.gold);
  text(s, x + 30, y + 8, U.ink);
  if (button(x + w - 46, y + 3, 42, 16, i === 1 ? 'SKIP' : i === 2 ? 'OK' : 'NEXT', { primary: i !== 1 })) guideNext();
}

// ---------- the hold in a run
// The bar under the top bar: seconds left, and the survivors aboard. Returns the y below it.
function drawHoldBar(y) {
  const st = holdNow();
  if (!st) return y;
  const left = Math.max(0, st.hold.T - st.t), w = 220, x = Math.round(W / 2 - w / 2);
  ctx.fillStyle = 'rgba(8,9,12,0.85)';
  ctx.fillRect(x - 4, y - 3, w + 8, 15);
  const s = left > 0 ? 'HOLD ' + Math.ceil(left) + ' S' : 'ALL ABOARD!';
  text(s, x, y, left > 0 ? U.ink : U.green);
  const bx = x + 62, bw = 64;
  bar(bx, y + 2, bw, 3, left / st.hold.T, '#1a1716', left < 5 ? U.green : U.gold);
  const sv = st.people ? 'SURVIVORS ' + st.saved + '/' + st.people : 'HOUSE EMPTY';
  text(sv, x + w, y, st.lost ? U.amber : U.green, { align: 'right' });
  drawWaveArrows(st);
  return y + 16;
}
// Red arrows on the screen edges at the lanes of the wave that just came (for 5 s).
function drawWaveArrows(st) {
  const since = st.t - st.waveT;
  if (since > 5 || Math.floor(realT * 4) % 2) return;
  for (const sd of st.waveSide ? [st.waveSide] : [-1, 1]) {
    for (const r of HOLD.lanes) {
      const p = gridToWorld(6.5 + sd * 9, r, st.s), sy = clamp(Math.round(p.y - G.camY), 40, H - 20);
      laneArrow(sd < 0 ? 4 : W - 5, sy, sd < 0 ? 1 : -1, U.red, 2);
    }
    text('WAVE ' + st.wave, sd < 0 ? 18 : W - 18, clamp(Math.round(gridToWorld(6.5 + sd * 9, 4, st.s).y - G.camY), 40, H - 20), U.red, { align: sd < 0 ? 'left' : 'right' });
  }
}
// The Depot's hint for a run that starts at a station.
function startHint(d) {
  const h = SAVE.house[d.id], n = typeof h === 'number' ? h : HOLD_LATER.people;
  if (Math.floor(realT / 3) % 2 && n > 0) return [n + ' SURVIVORS WAIT AT ' + d.name + '.', U.green];
  return ['START AT ' + d.name + ': YOUR TOWERS FIGHT FIRST.', U.dim];
}

// ---------- test calls (after the start-up has made window.__sr)
queueMicrotask(() => {
  if (!window.__sr) return;
  Object.assign(window.__sr, {
    // place(id, type, c, r): build as a click does (pays); sell(id, c, r); towers(id) = what stands there
    place: (id, t, c, r) => stPlace(id, t, c, r),
    sell: (id, c, r) => stSell(id, c, r),
    move: (id, c, r, c2, r2) => stMove(id, c, r, c2, r2),
    towers: (id) => towersOf(id).map((o) => o.t + ' ' + o.c + ',' + o.r + ' ' + o.paid),
    price: (id, t) => towerPrice(towersOf(id), t),
    // the Station tab: stTab(id) opens it on station id; stSel(type) picks a card; stTile(c, r) =
    // the screen point of a tile's middle (and the mouse goes there); stGuide(n) sets the guided step
    stTab: (id) => {
      toDepot('station');
      if (id) ST.id = id;
      ST.sel = ST.drag = null;
    },
    stSel: (t) => { ST.sel = t || null; },
    stTile: (c, r) => {
      const L = ST_L, p = { x: L.gx + (c + 0.5) * L.T, y: L.gy + (r + 0.5) * L.T };
      M.x = p.x;
      M.y = p.y;
      M.inside = true;
      return p;
    },
    stGuide: (n) => {
      SAVE.flags.stGuide = n;
      saveSave();
    },
    rclick: (x, y) => {
      M.x = x;
      M.y = y;
      M.inside = true;
      M.rpressed = true;
      render();
      drawUI();
      M.rpressed = false;
    },
    // the hold now: station, seconds, survivors, wave, towers
    holdState: () => {
      const st = G.station;
      if (!st) return null;
      return { id: st.id, state: st.state, t: +st.t.toFixed(1), T: st.hold && st.hold.T, first: st.first, people: st.people, saved: st.saved,
        lost: st.lost, wave: st.wave, perfect: st.perfect, nests: st.nests.length, bags: st.bags.length, wires: st.wires.length, awake: st.awake };
    },
    house: () => Object.assign({}, SAVE.house)
  });
});
