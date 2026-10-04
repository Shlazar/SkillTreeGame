// ui.js - everything drawn over the world, in screen pixels: the top bar (three currencies, kills, the train's health, the route up the line), warnings, arrows on
// the screen edge to the train and to trouble out of view, the radar, the weapon cards, coins,
// banners, hints, the red edge when the train is nearly lost, and the screens (title, pause,
// summary; the Depot is in depot.js). Buttons are drawn in the canvas too (from Ball x Archers).

// M = the mouse in game pixels. pressed / released are true for one frame; px, py = where the
// press started; right = the right button is held; used = this click was already handled;
// inside = the mouse is over the game.
const M = { x: -99, y: -99, down: false, right: false, pressed: false, released: false, px: 0, py: 0, used: false, inside: false };
let cursor = 'default';

// True when a button at (x, y, w, h) was clicked this frame.
function clicked(x, y, w, h) {
  if (M.released && !M.used && inR(M.px, M.py, x, y, w, h) && inR(M.x, M.y, x, y, w, h)) {
    M.used = true;
    SFX.ui();
    return true;
  }
  return false;
}
// Draw a button (o.primary = gold, o.danger = red, o.off = greyed out, never clicked). Returns true
// when it is clicked.
function button(x, y, w, h, label, o) {
  o = o || {};
  const hov = !o.off && inR(M.x, M.y, x, y, w, h), pr = hov && M.down;
  ctx.fillStyle = pr ? '#0b0c0f' : hov ? '#1d1f25' : '#131419';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, o.off ? '#24272e' : o.primary ? (hov ? '#f0c264' : '#b8862f') : o.danger ? (hov ? '#e0705a' : '#8a3a2c') : (hov ? '#6a6f7b' : '#3a3e48'));
  ctx.fillStyle = o.primary ? 'rgba(227,176,75,0.12)' : '#22252c';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  const col = o.off ? U.faint : o.primary ? U.gold : o.danger ? U.red : U.ink;
  text(label, x + w / 2, y + Math.round(h / 2) - 3 + (pr ? 1 : 0), col, { align: 'center' });
  if (o.off) return false;
  if (hov) cursor = 'pointer';
  return clicked(x, y, w, h);
}

// ---------- corners (the skill tree, a helis' attack mark)
// L-shaped corners round a box, with dark edges.
function corners(x, y, w, h, col) {
  const L = 3;
  ctx.fillStyle = '#07080a';
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    ctx.fillRect(Math.min(cx, cx + sx * (L - 1)) - 1, cy - 1, L + 2, 3);
    ctx.fillRect(cx - 1, Math.min(cy, cy + sy * (L - 1)) - 1, 3, L + 2);
  }
  ctx.fillStyle = col;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    ctx.fillRect(Math.min(cx, cx + sx * (L - 1)), cy, L, 1);
    ctx.fillRect(cx, Math.min(cy, cy + sy * (L - 1)), 1, L);
  }
}
// ---------- in play
// A weapon card: icon, name (nc = its colour), a tag on the right (the key, READY, a %...) and a bar.
function card(x, y, w, h, icon, name, tag, tagc, f, fc, nc) {
  ctx.fillStyle = 'rgba(12,13,17,0.86)';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, '#2e3139');
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.drawImage(icon, x + 5, y + Math.round((h - icon.height) / 2));
  text(name, x + 17, y + 5, nc || U.ink);
  text(tag, x + w - 5, y + 5, tagc, { align: 'right', outline: false });
  if (f != null) bar(x + 17, y + 16, w - 23, 4, f, '#1a1716', fc);
}
// Counters share their spacing with flying rewards. Hidden currencies have no target yet.
function currencyIcon(key) {
  return key === 'scrap' ? ICON.scrap : key === 'surv' ? ICON.surv : ICON.goldS;
}
function currencyLayout(values, left = 4) {
  if (!values) {
    if (mode === 'depot') values = Object.fromEntries(['scrap', 'surv', 'gold'].map((key) => [key, SHOWN[key] < 0 ? SAVE[key] : SHOWN[key]]));
    else if (mode === 'title') values = SAVE;
    else values = { scrap: G.shownCash, surv: G.surv, gold: G.gold || 0 };
  }
  const layout = { scrap: null, surv: null, gold: null, end: left, items: [] };
  for (const key of ['scrap', 'surv', 'gold']) {
    if (key === 'surv' && !SAVE.flags.survShown || key === 'gold' && !SAVE.flags.goldShown) continue;
    const icon = currencyIcon(key), label = fmt(Math.round(values[key] || 0));
    const x = layout.end, textX = x + icon.width + 3;
    layout[key] = x + Math.floor(icon.width / 2);
    layout.items.push({ key, left: x, textX, label, color: key === 'scrap' ? U.blue : key === 'surv' ? U.amber : U.gold });
    layout.end = textX + Math.max(key === 'scrap' ? 18 : 6, tw(label)) + 8;
  }
  return layout;
}
function currencyX(key) {
  return currencyLayout()[key] ?? null;
}
function drawCurrencyCounters(layout, y = 0, pulses = {}, outline = true) {
  for (const item of layout.items) {
    const icon = currencyIcon(item.key), pulse = !!pulses[item.key];
    blit(icon, item.left, y + Math.round(8 - icon.height / 2) - (pulse ? 1 : 0));
    const bright = item.key === 'scrap' ? '#d5efff' : item.key === 'surv' ? '#ffd2a1' : '#ffe39a';
    text(item.label, item.textX, y + 6, pulse ? bright : item.color, { outline });
  }
}
// Three cached native star sprites sit below the HUD. The saved receipt is the source of truth;
// only stars newly earned in this G have a timestamp, so a retry never repeats their earned pop.
function starLayout() {
  const sw = ICON.star.width, sh = ICON.star.height, gap = 3, w = sw * 3 + gap * 2;
  const visible = !G.demo && G.leg >= 3 && (mode === 'play' || mode === 'ending');
  const x = W - w - 8, y = 22, saved = SAVE.legs[G.leg]?.stars || [false, false, false];
  return { visible, x, y, w, h: sh, stars: [0, 1, 2].map((index) => {
    const at = G.starAt?.[index], pop = Number.isFinite(at) ? clamp(1 - (realT - at) / STAR_POP, 0, 1) : 0;
    return { index, x: x + index * (sw + gap), y, w: sw, h: sh, earned: saved[index] === true, pop };
  }) };
}
function drawLegStar(x, y, earned, pop = 0) {
  const lift = !REDUCED && earned && pop > 0.5 ? 1 : 0;
  ctx.globalAlpha = earned ? 1 : 0.2;
  blit(ICON.star, x, y - lift);
  if (earned && pop > 0) {
    ctx.globalAlpha = pop;
    ctx.fillStyle = '#fff1c2';
    const cx = x + (ICON.star.width >> 1), cy = y - lift + (ICON.star.height >> 1);
    ctx.fillRect(cx, y - lift - 2, 1, 1);
    ctx.fillRect(cx, y - lift + ICON.star.height + 1, 1, 1);
    ctx.fillRect(x - 2, cy, 1, 1);
    ctx.fillRect(x + ICON.star.width + 1, cy, 1, 1);
  }
  ctx.globalAlpha = 1;
}
function currencyBounds(layout, y = 0) {
  return layout.items.map((i) => ({ key: i.key, x: i.left, y: y + 4,
    w: i.textX + tw(i.label) - i.left, h: 9, text: i.label }));
}
function fitText(s, width) {
  if (tw(s) <= width) return s;
  while (s.length && tw(s + '...') > width) s = s.slice(0, -1);
  return s ? s.trimEnd() + '...' : '';
}
// One measured layout drives the HUD and its bounds diagnostics. The destination gets a second
// row when it cannot fit beside money and health; its full station name and metres stay readable.
function hudLayout() {
  const counters = currencyLayout(), kills = fmt(G.kills), hp = String(Math.ceil(G.tr.hp)), kx = counters.end;
  const hx = kx + 10 + tw(kills) + 24, hw = Math.max(20,
    Math.min(clamp(Math.round(W * 0.16), 44, 100), W - 32 - hx - tw(hp) - 4));
  const x0 = hx + hw + 10 + tw(hp), x1 = W - 28, stars = starLayout();
  let route = null;
  if (!G.demo) {
    const [label, color] = nextLabel(), lw = tw(label), secondary = x1 - x0 < lw + 8;
    const left = secondary ? 4 : x1 - lw, y = secondary ? 22 : 6;
    const lineW = x1 - x0 - lw - 20;
    route = { label: { x: left, y, w: lw, h: 7, text: label, color }, secondary,
      line: !secondary && lineW >= 40 ? { x: x0, y: 5, w: lineW + 10, h: 9 } : null };
  }
  return { counters, kills: { x: kx, y: 5, w: 10 + tw(kills), h: 8, text: kills },
    health: { icon: { x: hx - 12, y: 5, w: ICON.train.width, h: ICON.train.height },
      bar: { x: hx, y: 6, w: hw, h: 6 }, label: { x: hx + hw + 4, y: 6, w: tw(hp), h: 7, text: hp } },
    route, pause: mode === 'play' ? { x: W - 23, y: 1, w: 21, h: 16 } : null,
    stars: stars.visible ? stars : null,
    mute: Au.muted ? { x: W - 4 - tw('MUTE'), y: stars.visible ? 34 : 22, w: tw('MUTE'), h: 7 } : null,
    warningY: route?.secondary ? 34 : 24 };
}
function drawHUD() {
  ctx.fillStyle = 'rgba(6,7,9,0.88)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 18, W, 1);
  // This run's money; survivors and gold appear only after their teaching moment.
  const layout = hudLayout(), { counters } = layout;
  drawCurrencyCounters(counters, 0, { scrap: G.cashPulse > 0 });
  const kills = layout.kills.text, kx = layout.kills.x;
  blit(ICON.skull, kx, 5);
  text(kills, kx + 10, 6 - (G.killBump > 0.5 ? 1 : 0), U.ink);
  // the train's health: green, then amber, then red; the part just lost shows pale for a moment
  const tr = G.tr, f = tr.hp / tr.max, hx = layout.health.bar.x, hw = layout.health.bar.w;
  blit(ICON.train, hx - 12, 5);
  bar(hx, 6, hw, 6, tr.hpShown / tr.max, '#1a1716', '#d8cfb8');
  ctx.fillStyle = f < 0.35 ? '#b8402e' : f < 0.65 ? '#c9862f' : '#6f9a4f';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 6);
  ctx.fillStyle = f < 0.35 ? '#e06a4f' : f < 0.65 ? '#e8b05a' : '#9cc777';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 1);
  // and as a number
  text(Math.ceil(tr.hp), hx + hw + 4, 6, f < 0.35 ? U.red : f < 0.65 ? U.amber : U.dim);
  if (layout.route) drawRoute(layout.route);
  if (mode === 'play' && button(W - 23, 1, 21, 16, paused ? '>' : 'II')) setPaused(!paused);
  const stars = starLayout();
  if (stars.visible) for (const star of stars.stars) drawLegStar(star.x, star.y, star.earned, star.pop);
  if (Au.muted) text('MUTE', W - 4, stars.visible ? 34 : 22, U.faint, { align: 'right' });
}
// The destination for this leg, with metres left to the train's actual stopping point.
function nextLabel() {
  const st = G.station, to = legDef(G.leg).to;
  if (G.result === 'won') return ['ARRIVED: ' + to.name, U.green];
  const distance = Math.max(0, G.tr.s - (st ? st.stopS : G.goalS));
  return ['NEXT: ' + to.name + ' ' + Math.round(distance / 2 / 10) * 10 + ' M', U.blue];
}
// This leg alone, between x0 and x1: start, destination, any Dead Walls, and the train's progress.
function drawRoute(layout) {
  const label = layout.label;
  text(label.text, label.x, label.y, label.color);
  if (!layout.line) return;
  const x0 = layout.line.x, w = layout.line.w - 10;
  const start = G.tr.startS, end = G.goalS, len = Math.max(1, start - end);
  const X = (s) => x0 + Math.round(w * clamp((start - s) / len, 0, 1)), y = 9;
  ctx.fillStyle = '#3a3e48';
  ctx.fillRect(x0, y, w, 1);
  for (let i = 1; i < 4; i++) ctx.fillRect(x0 + Math.round(w * i / 4), y - 1, 1, 3);
  // this run's ride
  ctx.fillStyle = '#b8862f';
  ctx.fillRect(x0, y, Math.max(0, X(G.tr.s) - x0), 1);
  // Only walls inside this leg belong on its route.
  for (const wl of G.walls) {
    if (wl.broken || wl.s >= start || wl.s <= end) continue;
    ctx.fillStyle = '#07080a';
    ctx.fillRect(X(wl.s) - 2, y - 3, 5, 7);
    ctx.fillStyle = U.red;
    ctx.fillRect(X(wl.s) - 1, y - 2, 3, 5);
  }
  for (const [s, got] of [[start, true], [end, G.result === 'won']]) {
    const sx = X(s);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(sx - 2, y - 4, 5, 9);
    ctx.fillStyle = got ? U.green : U.blue;
    ctx.fillRect(sx - 1, y - 3, 3, 7);
  }
  blit(ICON.flag, X(end) + 3, 3);
  // The train is a pale block on the route.
  const tx = X(G.tr.s);
  ctx.fillStyle = '#07080a';
  ctx.fillRect(tx - 2, y - 3, 5, 7);
  ctx.fillStyle = '#e8dfc8';
  ctx.fillRect(tx - 1, y - 2, 3, 5);
}
// Warnings under the top bar: the dead on the track or on the train.
function warningLayout() {
  if (G.result) return [];
  const red = Math.floor(realT * 3) % 2 === 0 ? U.red : '#a8241a', L = [];
  if (G.blocked) L.push(['THE DEAD ARE ON THE TRACK AHEAD' + (G.railAhead >= 4 && ramState() === 'ready' ? '  (SPACE RAM)' : ''), red]);
  if (G.onTrain > 0) L.push([G.onTrain + (G.onTrain > 1 ? ' ZOMBIES' : ' ZOMBIE') + ' ON THE TRAIN', red]);
  // Wrap long warnings below the HUD, leaving its right-hand stars and mute control clear.
  const wx = W / 2, wy = hudLayout().warningY, room = W - 80, rows = [];
  for (const [t, c] of L) for (const line of wrap(t, room)) {
    rows.push({ x: Math.round(wx - tw(line) / 2), y: wy + rows.length * 10, w: tw(line), h: 7, text: line, color: c });
  }
  return rows;
}
function drawWarnings() {
  for (const r of warningLayout()) text(r.text, r.x, r.y, r.color);
}
// An arrow on the edge of the screen pointing at (wx, wy) in the world when that is out of view,
// with a label just inside it.
function edgeArrow(wx, wy, col, label) {
  const sx = wx - G.camX, sy = wy - G.camY;
  if (sx > 8 && sx < W - 8 && sy > 26 && sy < VH - 8) return false;
  // the arrows keep inside a frame below the warnings and above the plane band
  const cx = W / 2, cy = (62 + VH - 12) / 2, hw = W / 2 - 12, hh = (VH - 74) / 2;
  const dx = sx - cx, dy = sy - cy, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const t = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy)));
  const ax = Math.round(cx + dx * t), ay = Math.round(cy + dy * t);
  // a small triangle, tip toward the target, with a dark edge
  for (const [c, g] of [['#07080a', 1], [col, 0]]) {
    ctx.fillStyle = c;
    for (let py = -6; py <= 6; py++) for (let px = -6; px <= 6; px++) {
      const a = px * ux + py * uy, b = -px * uy + py * ux;
      if (a <= 4 + g && a >= -3 - g && Math.abs(b) <= (4 - a) * 0.62 + g * 0.9) ctx.fillRect(ax + px, ay + py, 1, 1);
    }
  }
  // the label just inside the arrow: beside it on the left and right edges, under or over it on
  // the top and bottom
  if (label) {
    const w = tw(label), side = Math.abs(dx) * hh > Math.abs(dy) * hw;
    const lx = side ? ax - Math.sign(ux) * (9 + w / 2) : ax, ly = side ? ay - 3 : ay - Math.sign(uy) * 11 - 3;
    text(label, clamp(lx, w / 2 + 4, W - w / 2 - 4), clamp(ly, 22, VH - 10), col, { align: 'center' });
  }
  return true;
}
// Arrows to the train, and to trouble out of view: the dead on a car, on the track ahead, after a
// survivor.
const ON_CAR = [0, 0, 0, 0, 0];
function drawArrows() {
  drawLootUI();
  // (at PRESS E! the view shows the engine's nose and the wall ahead: that is enough of the train)
  const tr = G.tr, c = tr.cars[2];
  ON_CAR.fill(0);
  let rail = null, rd = 1e9;
  for (const z of G.zombies) {
    if (z.dead) continue;
    if (z.st === 2) ON_CAR[z.car]++;
    else if (z.st === 1) {
      const ds = tr.s - trackLocal(z.x, z.y, TL).a;
      if (ds > 0 && ds < 300 && ds < rd) { rd = ds; rail = z; }
    }
  }
  // the train (its middle): gold, red with a count when the dead are on it; or, when the train is
  // in view, an arrow to any car under attack that is not
  const n = G.result ? 0 : G.onTrain;
  if (!edgeArrow(c.cx, c.cy, n ? U.red : U.gold, 'TRAIN ' + Math.round(Math.hypot(c.cx - G.camX - W / 2, c.cy - G.camY - VH / 2) / 2) + 'M' + (n ? '  ' + n + '!' : ''))) {
    if (!G.result) ON_CAR.forEach((m, k) => { if (m) edgeArrow(tr.cars[k].cx, tr.cars[k].cy, U.red, m + '!'); });
  }
  if (G.result) return;
  if (rail) edgeArrow(rail.x, rail.y, U.red, 'TRACK');
  const held = G.people.find((p) => p.st === 'grab'), out = G.people.find((p) => p.st === 'run');
  if (held) edgeArrow(held.x, held.y, U.red, 'HELP');
  else if (out) edgeArrow(out.x, out.y, '#8fd18a', 'SURVIVOR');
}
// The radar: the land round the helicopter, 1280 px across, north up. The railway, the train,
// the dead (bright red: on the track or the train), survivors, the station, the safe zone wall,
// and the view.
const RADARDEAD = (() => {
  const [c, g] = mk(72, 72, true), im = g.createImageData(72, 72);
  const word = (r, green, b) => new Uint32Array(new Uint8Array([r, green, b, 255]).buffer)[0];
  return {c, g, im, words: new Uint32Array(im.data.buffer), bright: word(255, 74, 50), dark: word(122, 42, 34)};
})();
function drawRadarDead(x0, y0, cx, cy, hx, hy, k) {
  const p = RADARDEAD;
  p.words.fill(0);
  for (const z of G.zombies) {
    if (z.dead) continue;
    const x = Math.round(cx + (z.x - hx) * k) - x0, y = Math.round(cy + (z.y - hy) * k) - y0;
    if (x < 0 || y < 0 || x > 71 || y > 71) continue;
    p.words[y * 72 + x] = z.st ? p.bright : p.dark;
  }
  p.g.putImageData(p.im, 0, 0);
  ctx.drawImage(p.c, x0, y0);
}
function drawRadar() {
  const R = 36, x0 = W - R * 2 - 6, y0 = VH - R * 2 - 6, cx = x0 + R, cy = y0 + R, k = R / 640;
  const hx = G.camX + W / 2, hy = G.camY + VH / 2;
  ctx.fillStyle = 'rgba(6,10,8,0.84)';
  ctx.fillRect(x0, y0, R * 2, R * 2);
  frame(x0 - 1, y0 - 1, R * 2 + 2, R * 2 + 2, '#2e3139');
  ctx.fillStyle = 'rgba(86,194,168,0.12)';
  ctx.fillRect(cx, y0, 1, R * 2);
  ctx.fillRect(x0, cy, R * 2, 1);
  let dotColor = '';
  const dot = (wx, wy, c, s) => {
    const px = Math.round(cx + (wx - hx) * k), py = Math.round(cy + (wy - hy) * k);
    if (px < x0 || py < y0 || px > x0 + R * 2 - s || py > y0 + R * 2 - s) return;
    if (c !== dotColor) ctx.fillStyle = dotColor = c;
    ctx.fillRect(px, py, s, s);
  };
  for (let wy = hy - 640; wy <= hy + 640; wy += 14) dot(trackX(wy), wy, '#3e434c', 1);
  if (G.safeZone && G.goalY > hy - 640 && G.goalY < hy + 640) for (let dx = -560; dx <= 560; dx += 18) dot(trackX(G.goalY) + dx, G.goalY, '#8fd18a', 1);
  for (const st of G.stops) dot(st.house.x - 1, st.house.y - 1, st.id === 'depot' ? U.gold : '#9fd3f2', 2);
  drawRadarDead(x0, y0, cx, cy, hx, hy, k);
  // golden zombies: a blinking gold dot
  if (realT % 0.5 < 0.32) for (const z of G.zombies) if (z.gold && !z.dead) dot(z.x - 1, z.y - 1, '#ffd24a', 2);
  for (const p of G.people) if (p.st === 'run' || p.st === 'wait' || p.st === 'grab') dot(p.x, p.y, '#8fd18a', 1);
  lootRadar(dot);
  for (const c of G.tr.cars) dot(c.cx - 1, c.cy - 1, '#e8dfc8', 2);
  for (const h of G.helis) dot(h.x - 1, h.y - 1, h.sel ? U.green : '#9fd3f2', 2);
  // the view
  const vx = Math.round(cx - W / 2 * k), vy = Math.round(cy - VH / 2 * k);
  ctx.globalAlpha = 0.55;
  frame(vx, vy, Math.round(W * k) + 1, Math.round(VH * k) + 1, '#9fd3f2');
  ctx.globalAlpha = 1;
  text('N', cx, y0 + 2, U.faint, { align: 'center', outline: false });
}
// The cards, bottom left: the heli (helis.js), then the
// Turbo Ram.
function drawWeapons() {
  const y = VH - 30;
  // (on a window too narrow for all the cards in a row, the Ram's goes over the first)
  let rx = drawUnitCards(4, y), ry = y;
  if (rx + RAMCARD.w > W - 82) [rx, ry] = [4, y - 30];
  drawRamCard(rx, ry);
  text('CAMERA: ' + CAMS[thermal] + '  (T)', W - 6, VH - 90, U.faint, { align: 'right' });
}
// The Turbo Ram's card: SPACE in gold when ready, seconds left while its cooldown fills,
// GO! while it runs (the bar is the time left), and STOP near a station (grey). A click on it rams.
// Over it, for a moment, why it can't ram now.
const RAMCARD = { x: 0, y: 0, w: 106, h: 26, on: false };
function drawRamCard(x, y) {
  const r = G.ram, C = RAMCARD, R = CFG.ram;
  const s = ramState();
  C.on = s !== 'none';
  if (!C.on) return;
  C.x = x;
  C.y = y;
  const w = C.w, h = C.h, fl = realT - r.flash;
  // it hops when it becomes ready
  if (fl < 0.2) y--;
  let tag, tagc, f, fc, nc = U.ink, icon = ICON.ram;
  if (s === 'on') [tag, tagc, f, fc] = ['GO!', Math.floor(realT * 8) % 2 ? '#ffe39a' : U.amber, 1 - r.t / (r.dur + R.ease), '#ff8a3a'];
  else if (s === 'ready') [tag, tagc, f, fc] = ['SPACE', U.gold, 1, '#e3b04b'];
  else if (s === 'cooldown') [tag, tagc, f, fc] = [Math.ceil(r.cd) + 'S', U.dim, ramProgress(), '#8a6a3a'];
  else if (s === 'stop') [tag, tagc, f, fc, nc, icon] = ['STOP', U.faint, ramProgress(), '#3a3e48', U.faint, ICON.ramOff];
  else [tag, tagc, f, fc, nc, icon] = ['TREE', U.dim, 0, '#3a3e48', U.faint, ICON.lock];
  card(x, y, w, h, icon, 'TURBO RAM', tag, tagc, f, fc, nc);
  // ready: a gold frame; just full: a white and gold flash
  if (s === 'ready' || s === 'on') frame(x, y, w, h, s === 'on' ? '#c96a2a' : '#b8862f');
  if (fl < 0.5) {
    ctx.globalAlpha = 1 - fl / 0.5;
    frame(x - 1, y - 1, w + 2, h + 2, '#ffd36a');
    ctx.globalAlpha = 0.35 * (1 - fl / 0.5);
    ctx.fillStyle = '#fff3dc';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
  }
  if (mode === 'play' && !paused && inR(M.x, M.y, x, y, w, h)) cursor = 'pointer';
  // why not: a line over the card for 2 s
  const m = r.msg, mt = m ? realT - m.t : 9;
  if (mt < 2) {
    ctx.globalAlpha = clamp((2 - mt) / 0.4, 0, 1);
    text(m.s, clamp(x, 4, W - tw(m.s) - 4), y - 10, U.amber);
    ctx.globalAlpha = 1;
  }
}
// White speed lines streaming down the outer 30% of the screen while the Ram runs (in game time:
// they stand still on pause and slow down with the game).
function drawSpeedLines() {
  const k = ramK() * clamp(G.ram.t / 0.25, 0, 1);
  if (k <= 0) return;
  const n = REDUCED ? 7 : 14, band = W * 0.3, span = VH + 40;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const sp = 320 + hrnd(i, 1, 51) * 260, len = 10 + Math.round(hrnd(i, 2, 51) * 20);
    const p = hrnd(i, 3, 51) * span + G.t * sp, lap = Math.floor(p / span), y = Math.round(p - lap * span) - 30;
    const u = hrnd(i, lap, 52), x = Math.round(i & 1 ? W - 1 - u * band : u * band);
    // a little stronger near the edge
    ctx.globalAlpha = 0.25 * k * (1 - u * 0.4);
    ctx.fillRect(x, y, 1, len);
  }
  ctx.globalAlpha = 1;
}
// ---------- the radio
// A short line from someone up the line (ENGINEER: ...): a small box above the weapon cards with the
// speaker's name in gold, for 4 s. More lines wait their turn. (The tutorial will add its lines here.)
const RADIO = { q: [], cur: null };
function radio(who, msg) {
  RADIO.q.push({ who, msg, t: 0 });
}
function drawRadio() {
  if (!RADIO.cur && RADIO.q.length) {
    RADIO.cur = RADIO.q.shift();
    if (!G.demo) SFX.radio();
  }
  const r = RADIO.cur;
  if (!r) return;
  r.t += frameDt;
  if (r.t >= 4) {
    RADIO.cur = null;
    return;
  }
  const name = r.who + ':', nw = tw(name), room = W - 8 - 20 - nw;
  const lines = tw(r.msg) <= room ? [r.msg] : wrap(r.msg, Math.max(60, room));
  const w = 20 + nw + Math.max(...lines.map((l) => tw(l))) + 8, h = 9 + lines.length * 10;
  const x = 4, y = Math.min(VH - 30, RAMCARD.on ? RAMCARD.y : VH - 30) - 13 - h - tipRoom();
  // it fades in and out
  ctx.globalAlpha = r.t < 0.15 ? r.t / 0.15 : r.t > 3.6 ? (4 - r.t) / 0.4 : 1;
  panel(x, y, w, h, 'rgba(10,11,14,0.92)');
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  // a light that blinks while they talk
  ctx.fillStyle = Math.floor(realT * 4) % 2 ? '#8fd18a' : '#2e4a2e';
  ctx.fillRect(x + 6, y + 6, 3, 3);
  text(name, x + 13, y + 5, U.gold);
  lines.forEach((l, i) => text(l, x + 13 + nw + 6, y + 5 + i * 10, U.ink));
  ctx.globalAlpha = 1;
}
// red screen edge while the train is nearly lost
function drawTension() {
  const f = G.tr.hp / G.tr.max;
  if (mode !== 'play' || G.result || f >= 0.35) return;
  let a = 0.3 + 0.5 * (1 - f / 0.35);
  if (!REDUCED) a *= 0.7 + 0.3 * Math.sin(realT * 7);
  ctx.fillStyle = '#c0301f';
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = a * (1 - k * 0.3);
    ctx.fillRect(k, k, W - 2 * k, 1);
    ctx.fillRect(k, VH - 1 - k, W - 2 * k, 1);
    ctx.fillRect(k, k, 1, VH - 2 * k);
    ctx.fillRect(W - 1 - k, k, 1, VH - 2 * k);
  }
  ctx.globalAlpha = 1;
}

// ---------- screens
// (the pause menu is drawPause in tut.js)
// titleAsk = NEW GAME was clicked: the title asks before it wipes the save
let titleAsk = false;
function titleGo() {
  if (titleAsk) return;
  if (hasProgress()) toDepot('tree');
  else startGame(1);
}
function titleLayout() {
  const prog = hasProgress(), ask = titleAsk, w = Math.min(300, W - 20);
  const lines = ['YOUR VIPER FIGHTS BY ITSELF.', 'RIGHT CLICK: ATTACK OR MOVE.',
    'T: THERMAL.  WHEEL: ZOOM.  M: SOUND.  P: PAUSE.'].flatMap((s) => wrap(s, w - 24));
  const h = 82 + (ask ? 58 : prog ? 72 : 30) + lines.length * 11 + 25;
  const cx = Math.round(W >= 560 ? W * 0.36 : W / 2);
  return { x: cx - w / 2, y: Math.round((H - h) / 2), w, h, cx, lines, prog, ask };
}
function drawTitle() {
  ctx.fillStyle = 'rgba(5,6,8,0.35)';
  ctx.fillRect(0, 0, W, H);
  // the menu sits left of the train (on a wide enough screen); its height follows what it shows
  const layout = titleLayout(), { prog, ask, cx, x: px, y: py, w: pw, h: ph } = layout;
  ctx.fillStyle = 'rgba(8,9,11,0.8)';
  ctx.fillRect(px, py, pw, ph);
  frame(px, py, pw, ph, '#2e3139');
  text('SKY REAPER', cx, py + 18, U.ink, { align: 'center', scale: 3, drop: true });
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(cx - 110, py + 46, 220, 1);
  text('FLY ESCORT FOR THE LAST TRAIN.', cx, py + 54, U.dim, { align: 'center' });
  text('EVERY LEG PAYS. REACH THE NEXT STATION.', cx, py + 64, U.dim, { align: 'center' });
  let y = py + 82;
  if (ask) {
    // NEW GAME: ask first
    text('START A NEW GAME?', cx, y + 2, U.red, { align: 'center' });
    text('YOUR SCRAP AND PROGRESS WILL BE GONE.', cx, y + 13, U.dim, { align: 'center' });
    if (button(cx - 122, y + 26, 120, 20, 'YES, START OVER', { danger: true })) {
      newSave();
      titleAsk = false;
      titleGo();
    }
    if (button(cx + 2, y + 26, 120, 20, 'NO, GO BACK')) titleAsk = false;
    y += 58;
  } else if (prog) {
    if (button(cx - 75, y, 150, 20, 'CONTINUE', { primary: true })) titleGo();
    if (button(cx - 75, y + 26, 150, 20, 'NEW GAME')) titleAsk = true;
    y += 52;
    // what you have so far
    const progress = SAVE.leg > 12 ? 'DEMO COMPLETE' : 'LEG ' + SAVE.leg + ' OF 12', width = currencyLayout(SAVE, 0).end + tw(progress);
    const counters = currencyLayout(SAVE, Math.round(cx - width / 2));
    drawCurrencyCounters(counters, y - 3, {}, false);
    text(progress, counters.end, y + 3, U.dim, { outline: false });
    y += 20;
  } else {
    if (button(cx - 75, y, 150, 20, 'PLAY', { primary: true })) titleGo();
    y += 30;
  }
  const L = layout.lines;
  L.forEach((l, i) => text(l, cx, y + i * 11, U.faint, { align: 'center', outline: false }));
  text(ask ? 'ESC: GO BACK' : 'ENTER: ' + (prog ? 'CONTINUE' : 'PLAY'), cx, y + L.length * 11 + 9, U.faint, { align: 'center', outline: false });
}
// A short leg summary: sources, the money kept, saved stars, and the way back to the Depot.
// Times are seconds after it opens; each source counts up with a tick.
function sumPlan(s) {
  const p = s.pay, rows = [['KILLS ' + fmt(s.kills), p.kills || 0]];
  for (const [label, value] of [['LOOT', p.loot], ['WALLS', p.wall ?? p.walls], ['SILVER', p.silver], ['BONUS', p.bonus]]) {
    if (value > 0) rows.push([label, value]);
  }
  const t = rows.map((r, i) => 0.3 + i * 0.18), total = t[t.length - 1] + 0.25;
  const money = [{ key: 'scrap', label: 'TOTAL SCRAP', amount: s.scrap, color: U.blue, at: total }];
  if (s.surv > 0 || SAVE.flags.survShown) money.push({ key: 'surv', label: 'SURVIVORS', amount: s.surv, color: U.amber, at: total + money.length * 0.14 });
  if (s.gold > 0 || SAVE.flags.goldShown) money.push({ key: 'gold', label: 'GOLD', amount: s.gold, color: U.gold, at: total + money.length * 0.14 });
  const stars = money[money.length - 1].at + 0.18, lines = stars + (s.hasStars ? 0.15 : 0);
  const ev = t.map((x) => [x, 'tick']).concat([[total, 'total']]);
  for (const row of money) if (row.key !== 'scrap' && row.amount > 0) ev.push([row.at, row.key === 'surv' ? 'saved' : 'gold']);
  if (s.hasStars && s.stars.some(Boolean)) ev.push([stars, 'tick']);
  return { rows, t, money, total, stars, lines, end: lines + 0.35, ev };
}
// Geometry is shared with click tests. On short screens the row spacing tightens before notes
// are bounded, so the money, stars and button always fit. Notes wrap at the panel's inner width.
function summaryLayout(s, pl) {
  const compact = H < 300, w = Math.min(W - 24, compact ? 288 : 264), inner = w - 32;
  const heading = wrap('LEG ' + s.leg + ': ' + s.destination, inner);
  const messages = [];
  if (s.near) messages.push([s.near, U.amber]);
  if (s.replay) messages.push(['REPLAY: SCRAP ONLY. NO NEW STARS.', U.blue]);
  messages.push(['YOU KEEP EVERYTHING YOU EARNED.', U.dim]);
  for (const line of s.wall || []) messages.push(line);
  messages.push(...summaryGoal());
  let notes = messages.flatMap(([message, color]) => wrap(message, inner).map((line) => [line, color]));
  const rowStep = compact ? 10 : 12, moneyStep = compact ? 12 : 15, noteStep = compact ? 9 : 11;
  const sources = 32 + heading.length * 10, money = sources + pl.rows.length * rowStep + 7;
  const stars = money + pl.money.length * moneyStep, noteTop = stars + (s.hasStars ? 15 : 0) + 6;
  const maxNotes = Math.max(1, Math.floor((H - 26 - noteTop - 28) / noteStep));
  if (notes.length > maxNotes) {
    notes = notes.slice(0, maxNotes);
    let line = notes[notes.length - 1][0];
    while (tw(line + '...') > inner) line = line.slice(0, -1);
    notes[notes.length - 1][0] = line + '...';
  }
  const h = noteTop + notes.length * noteStep + 28;
  const x = Math.round((W - w) / 2), y = Math.max(20, Math.round((H - h) / 2));
  return { x, y, w, h, heading, notes, rowStep, moneyStep, noteStep,
    sourcesY: y + sources, moneyY: y + money, starsY: y + stars, notesY: y + noteTop,
    button: { x: Math.round(x + w / 2 - 70), y: y + h - 25, w: 140, h: 20 } };
}
// Enter or a click before the count is done shows it all at once.
function sumSkip() {
  const s = G.sum, pl = s.plan || (s.plan = sumPlan(s));
  if (realT - sumStart >= pl.end) return false;
  sumStart = realT - pl.end;
  s.sounds = pl.ev.length;
  return true;
}
// The approved short summary comes first. A completed finale then has its own thanks card,
// on every completion including replays; the card's next action returns to the Depot.
function summaryContinue() {
  if (mode !== 'summary' || !G.sum) return false;
  if (TUT.card?.finale) {
    TUT.card = null;
    toDepot();
    return true;
  }
  if (sumSkip()) return false;
  if (G.sum.leg === 12 && G.sum.result === 'won' && !G.sum.thanksShown) {
    G.sum.thanksShown = true;
    openEndCard();
  } else toDepot();
  return true;
}
function drawSummary() {
  ctx.fillStyle = 'rgba(5,6,8,0.66)';
  ctx.fillRect(0, 0, W, H);
  const s = G.sum, pl = s.plan || (s.plan = sumPlan(s)), t = realT - sumStart, won = s.result === 'won';
  const layout = summaryLayout(s, pl), { x, y, w, h } = layout, cx = x + w / 2;
  while (s.sounds < pl.ev.length && t >= pl.ev[s.sounds][0]) {
    const e = pl.ev[s.sounds++][1];
    if (e === 'tick') SFX.tick();
    else if (e === 'total') SFX.total();
    else if (e === 'saved') SFX.saved();
    else if (e === 'gold') SFX.golden();
  }
  panel(x, y, w, h, '#0f1014');
  const quit = s.result === 'quit';
  text(won ? 'LEG WON!' : quit ? 'LEG ENDED' : 'TRAIN LOST', cx, y + 9, won ? U.gold : quit ? U.ink : U.red, { align: 'center', scale: 2, drop: true });
  layout.heading.forEach((line, i) => text(line, cx, y + 28 + i * 10, U.ink, { align: 'center' }));
  // the rows: what each kind of thing paid
  pl.rows.forEach((r, i) => {
    const u = clamp((t - pl.t[i]) / 0.22, 0, 1);
    if (t < pl.t[i]) return;
    const ry = layout.sourcesY + i * layout.rowStep;
    text(r[0], x + 16, ry, U.dim);
    text('+' + fmt(Math.round(r[1] * u)), x + w - 16, ry, u < 1 ? U.ink : U.blue, { align: 'right' });
  });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, layout.moneyY - 5, w - 28, 1);
  pl.money.forEach((row, i) => {
    if (t < row.at) return;
    const ry = layout.moneyY + i * layout.moneyStep, icon = currencyIcon(row.key), u = ease(clamp((t - row.at) / 0.3, 0, 1));
    blit(icon, x + 16, ry + Math.round((layout.moneyStep - icon.height) / 2));
    text(row.label, x + 28, ry + 3, U.ink);
    text('+' + fmt(Math.round(row.amount * u)), x + w - 16, ry, row.color, { align: 'right', scale: row.key === 'scrap' && H >= 300 ? 2 : 1 });
  });
  if (s.hasStars && t >= pl.stars) {
    text('LEG STARS', x + 16, layout.starsY + 3, U.dim);
    for (let i = 0; i < 3; i++) {
      const pop = Number.isFinite(G.starAt?.[i]) ? clamp(1 - (t - pl.stars) / STAR_POP, 0, 1) : 0;
      drawLegStar(x + w - 16 - (3 - i) * (ICON.star.width + 3), layout.starsY + 2, s.stars[i], pop);
    }
  }
  // a near miss, and the promise: nothing is lost
  ctx.globalAlpha = clamp((t - pl.lines) / 0.3, 0, 1);
  layout.notes.forEach(([line, color], i) => text(line, cx, layout.notesY + i * layout.noteStep, color, { align: 'center' }));
  ctx.globalAlpha = 1;
  const b = layout.button;
  const finale = s.leg === 12 && s.result === 'won' && !s.thanksShown;
  if (button(b.x, b.y, b.w, b.h, finale ? 'CONTINUE' : 'TO THE DEPOT', { primary: true })) summaryContinue();
  text('ENTER', b.x + b.w + 6, b.y + 7, U.faint, { outline: false });
}

// Copied bounds from the same production layouts used above, plus the tooltip actually drawn.
// Hidden surfaces are null. Nested rectangles describe parts of the same control, not collisions.
function uiBounds() {
  const run = mode === 'play' || mode === 'ending', layout = run ? hudLayout() : null;
  const hud = layout ? { counters: currencyBounds(layout.counters), kills: { ...layout.kills },
    health: { icon: { ...layout.health.icon }, bar: { ...layout.health.bar }, label: { ...layout.health.label } },
    route: layout.route ? { label: { ...layout.route.label }, line: layout.route.line ? { ...layout.route.line } : null,
      secondary: layout.route.secondary } : null,
    pause: layout.pause ? { ...layout.pause } : null, stars: layout.stars,
    mute: layout.mute ? { ...layout.mute } : null, warnings: warningLayout() } : null;
  const depot = mode === 'depot' ? { counters: currencyBounds(currencyLayout(SHOWN)), tabs: depotTabRects(),
    route: depotRouteLayout(), bottom: depotBottomLayout(),
    treeArea: depotTab === 'tree' ? { x: 0, y: TREE.y0, w: W, h: TREE.y1 - TREE.y0 } : null,
    tooltip: depotTab === 'tree' && TREE.infoBounds ? { ...TREE.infoBounds } : null,
    genericTooltip: TIP.bounds ? { ...TIP.bounds } : null } : null;
  return { viewport: { W, H, VH, SCALE, reduced: REDUCED }, hud,
    radar: run ? { x: W - 79, y: VH - 79, w: 74, h: 74 } : null,
    ram: run && RAMCARD.on ? { x: RAMCARD.x, y: RAMCARD.y, w: RAMCARD.w, h: RAMCARD.h } : null,
    weapons: run ? HUI.cards.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.ht })) : [],
    planes: run ? airBandSlots() : [], tutorial: (mode === 'play' || mode === 'depot') && !paused ? tutTipLayout() : null,
    depot, hangar: mode === 'depot' && depotTab === 'hangar' ? hangarLayout() : null,
    title: mode === 'title' ? titleLayout() : null,
    pauseMenu: mode === 'play' && paused ? { ...PAUSE } : null,
    summary: mode === 'summary' && !TUT.card?.finale ? summaryLayout(G.sum, sumPlan(G.sum)) : null,
    endCard: mode === 'summary' && TUT.card?.finale ? endCardLayout() : null };
}

// ---------- the UI for the current mode
function drawUI() {
  if (mode === 'title') {
    drawTitle();
    drawBanners();
    return;
  }
  if (mode === 'depot') {
    drawDepot();
    return;
  }
  const run = mode === 'play' || mode === 'ending';
  if (run) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, VH);
    ctx.clip();
    drawSpeedLines();
  }
  drawHUD();
  drawCoins();
  if (run) {
    drawWarnings();
    drawRadar();
    drawWeapons();
    drawRadio();
    drawTut();
    // (the arrows under the banners, so a banner is never cut by an arrow's label)
    drawArrows();
    drawBanners();
    if (mode === 'play' && !paused) drawHeliCursor();
    drawTension();
    drawAirAim();
    ctx.restore();
    drawAirBand();
    if (paused) drawPause();
  } else if (mode === 'summary') {
    if (TUT.card?.finale) drawEndCard();
    else drawSummary();
  }
}
