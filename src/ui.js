// ui.js - everything drawn over the world, in screen pixels: the gun sight and lock brackets, the
// top bar, the weapon cards, coins, banners, hints, the low fuel edge, and the screens (title,
// pause, summary). Buttons are drawn in the canvas too (from Ball x Archers).

// M = the mouse in game pixels. pressed / released are true for one frame; px, py = where the
// press started; used = this click was already handled; inside = the mouse is over the game.
const M = { x: -99, y: -99, down: false, pressed: false, released: false, px: 0, py: 0, used: false, inside: false };
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
// Draw a button (o.primary = gold). Returns true when it is clicked.
function button(x, y, w, h, label, o) {
  o = o || {};
  const hov = inR(M.x, M.y, x, y, w, h), pr = hov && M.down;
  ctx.fillStyle = pr ? '#0b0c0f' : hov ? '#1d1f25' : '#131419';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, o.primary ? (hov ? '#f0c264' : '#b8862f') : (hov ? '#6a6f7b' : '#3a3e48'));
  ctx.fillStyle = o.primary ? 'rgba(227,176,75,0.12)' : '#22252c';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  text(label, x + w / 2, y + Math.round(h / 2) - 3 + (pr ? 1 : 0), o.primary ? U.gold : U.ink, { align: 'center' });
  if (hov) cursor = 'pointer';
  return clicked(x, y, w, h);
}

// ---------- the sight
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
const TICKS = [[-8, 0, 5, 1], [4, 0, 5, 1], [0, -8, 1, 5], [0, 4, 1, 5]];
function drawSight() {
  const x = Math.round(G.aimSX), y = Math.round(G.aimSY);
  // lock brackets: they slide to the locked zombie and close round it
  const z = G.lock;
  if (z && !z.dead) {
    const S = z.S, w = S.walk[0].n.width + 4, h = S.h + 4;
    const tx = z.x - G.camX - S.ax - 2, ty = z.y - G.camY - S.ay - 2;
    const b = G.box || (G.box = { x: x - 14, y: y - 14, w: 28, h: 28 });
    const k = 1 - Math.exp(-frameDt * 28);
    b.x += (tx - b.x) * k;
    b.y += (ty - b.y) * k;
    b.w += (w - b.w) * k;
    b.h += (h - b.h) * k;
    corners(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h), thermal ? '#ffffff' : '#ff5a3a');
  } else G.box = null;
  // the sight: 4 ticks round a gap and a dot, with dark edges so it reads on any ground
  const col = G.overheat ? U.red : thermal ? '#f4f4f4' : '#e8dfc8';
  ctx.fillStyle = '#07080a';
  for (const t of TICKS) ctx.fillRect(x + t[0] - 1, y + t[1] - 1, t[2] + 2, t[3] + 2);
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = col;
  for (const t of TICKS) ctx.fillRect(x + t[0], y + t[1], t[2], t[3]);
  ctx.fillRect(x, y, 1, 1);
  // hit marker: a white X when rounds hit
  if (G.hitT > 0) {
    ctx.fillStyle = '#ffffff';
    for (const d of [2, 3]) {
      ctx.fillRect(x - d, y - d, 1, 1);
      ctx.fillRect(x + d, y - d, 1, 1);
      ctx.fillRect(x - d, y + d, 1, 1);
      ctx.fillRect(x + d, y + d, 1, 1);
    }
  }
  // the 105 is loaded: a gold pip at the top right of the sight
  if (G.heReload <= 0) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x + 6, y - 9, 4, 4);
    ctx.fillStyle = thermal ? '#ffffff' : U.gold;
    ctx.fillRect(x + 7, y - 8, 2, 2);
  }
  // gun heat: a small bar under the sight while the 25mm is warm
  if (G.heat > 0.15) {
    const hw = 13;
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x - 7, y + 11, hw + 2, 3);
    ctx.fillStyle = G.overheat ? U.red : G.heat > 0.75 ? U.amber : '#8b919c';
    ctx.fillRect(x - 6, y + 12, Math.round(hw * G.heat), 1);
  }
}

// ---------- in play
function card(x, y, w, h, icon, name, tag, tagc, f, fc) {
  ctx.fillStyle = 'rgba(12,13,17,0.86)';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, '#2e3139');
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  ctx.drawImage(icon, x + 5, y + Math.round((h - icon.height) / 2));
  text(name, x + 17, y + 5, U.ink);
  text(tag, x + w - 5, y + 5, tagc, { align: 'right', outline: false });
  bar(x + 17, y + 16, w - 23, 4, f, '#1a1716', fc);
}
function drawHUD() {
  ctx.fillStyle = 'rgba(6,7,9,0.88)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 18, W, 1);
  // cash: the coin hops and the number flashes when cash comes in
  const cp = G.cashPulse;
  ctx.drawImage(ICON.coin, 5, 5 - (cp > 0.5 ? 1 : 0));
  text('$' + fmt(G.shownCash), 15, 6, cp > 0 ? '#ffe39a' : U.gold);
  // kills
  ctx.drawImage(ICON.skull, 80, 5);
  text(fmt(G.kills), 90, 6 - (G.killBump > 0.5 ? 1 : 0), U.ink);
  // fuel: red and blinking when it runs low
  const low = G.fuel < 10, fw = Math.min(180, W - 300), fx = Math.round(W / 2 - fw / 2);
  ctx.drawImage(ICON.fuel, fx - 12, 5);
  bar(fx, 6, fw, 6, G.fuel / CFG.fuel, '#1a1716', low ? '#b8402e' : '#b8862f', low ? '#e06a4f' : '#e3b04b');
  if (!low || Math.floor(realT * 4) % 2 === 0) text(Math.ceil(G.fuel) + 'S', fx + fw + 5, 6, low ? U.red : U.dim);
  // the horde
  ctx.drawImage(ICON.zed, W - 82, 5);
  text(fmt(G.zombies.length), W - 72, 6, U.dim);
  if (mode === 'play' && button(W - 23, 1, 21, 16, paused ? '>' : 'II')) paused = !paused;
  if (Au.muted) text('MUTE', W - 4, 22, U.faint, { align: 'right' });
  // kill streak: the count and the time left to keep it going
  const s = G.streak, st = G.t - s.t;
  if (s.n >= 3 && st < 1.6) {
    text('STREAK ' + s.n, 5, 24, s.n >= 25 ? '#ffd36a' : U.gold);
    bar(5, 33, 52, 2, 1 - st / 1.6, '#1a1716', '#e3b04b');
  }
}
function drawWeapons() {
  const y = H - 30, rdy = G.heReload <= 0;
  card(4, y, 96, 26, ICON.mg, '25MM', G.overheat ? 'OVERHEAT' : 'L-CLICK', G.overheat ? U.red : U.faint, G.heat,
    G.overheat ? '#b8402e' : G.heat > 0.75 ? U.amber : '#8b919c');
  card(104, y, 96, 26, ICON.he, '105MM', rdy ? 'READY' : 'R-CLICK', rdy ? U.gold : U.faint, 1 - G.heReload / CFG.he.reload,
    rdy ? '#e3b04b' : '#7a6a50');
  text('CAMERA: ' + CAMS[thermal] + '  (T)', W - 5, H - 11, U.faint, { align: 'right' });
}
// first seconds of a sortie: how to play
function drawHint() {
  const a = clamp((9 - G.run) / 1.5, 0, 1);
  if (a <= 0 || G.run < 1.2) return;
  ctx.globalAlpha = a;
  text('HOLD LEFT CLICK: 25MM GUN.   RIGHT CLICK OR SPACE: 105MM CANNON.', W / 2, H - 58, U.ink, { align: 'center' });
  text('WASD OR THE SCREEN EDGE: MOVE.   T: THERMAL CAMERA.', W / 2, H - 47, U.dim, { align: 'center' });
  ctx.globalAlpha = 1;
}
// red screen edge while the fuel runs out
function drawTension() {
  if (mode !== 'play' || G.fuel >= 10) return;
  let a = 0.3 + 0.5 * (1 - G.fuel / 10);
  if (!REDUCED) a *= 0.7 + 0.3 * Math.sin(realT * 7);
  ctx.fillStyle = '#c0301f';
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = a * (1 - k * 0.3);
    ctx.fillRect(k, k, W - 2 * k, 1);
    ctx.fillRect(k, H - 1 - k, W - 2 * k, 1);
    ctx.fillRect(k, k, 1, H - 2 * k);
    ctx.fillRect(W - 1 - k, k, 1, H - 2 * k);
  }
  ctx.globalAlpha = 1;
  if (Math.floor(realT * 2.5) % 2 === 0) text('BINGO FUEL', W / 2, 26, U.red, { align: 'center' });
}

// ---------- screens
function drawPause() {
  ctx.fillStyle = 'rgba(5,6,8,0.5)';
  ctx.fillRect(0, 19, W, H - 19);
  text('PAUSED', W / 2, H / 2 - 20, U.ink, { align: 'center', scale: 2 });
  text('CLICK, ESC OR P TO GO ON', W / 2, H / 2 + 2, U.dim, { align: 'center' });
}
function drawTitle() {
  ctx.fillStyle = 'rgba(5,6,8,0.35)';
  ctx.fillRect(0, 0, W, H);
  const cx = Math.round(W / 2), pw = 300, ph = 238, px = cx - pw / 2, py = Math.round(H / 2 - ph / 2);
  ctx.fillStyle = 'rgba(8,9,11,0.78)';
  ctx.fillRect(px, py, pw, ph);
  frame(px, py, pw, ph, '#2e3139');
  text('SKY REAPER', cx, py + 18, U.ink, { align: 'center', scale: 3, drop: true });
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(cx - 110, py + 46, 220, 1);
  text('YOUR GUNSHIP OVER THE ENDLESS DEAD.', cx, py + 54, U.dim, { align: 'center' });
  text('60 SECONDS OF FUEL. KILL ALL YOU CAN.', cx, py + 64, U.dim, { align: 'center' });
  if (button(cx - 75, py + 82, 150, 20, 'START MISSION', { primary: true })) startGame();
  if (button(cx - 75, py + 108, 150, 20, 'CAMERA: ' + CAMS[thermal])) setThermal((thermal + 1) % 3);
  if (best.kills > 0) {
    const s = 'BEST ' + fmt(best.kills) + ' KILLS', w = tw(s) + 10;
    ctx.drawImage(ICON.skull, cx - w / 2, py + 140);
    text(s, cx - w / 2 + 10, py + 141, U.gold, { outline: false });
  }
  const L = ['MOUSE: AIM. IT LOCKS ON THE NEAREST ZOMBIE.', 'HOLD LEFT CLICK: 25MM.  RIGHT CLICK / SPACE: 105MM.',
    'WASD: MOVE.  T: THERMAL.  WHEEL: ZOOM.  M: SOUND.'];
  L.forEach((l, i) => text(l, cx, py + 160 + i * 11, U.faint, { align: 'center', outline: false }));
  text('ENTER TO START', cx, py + 205, U.faint, { align: 'center', outline: false });
}
// After the fuel runs out: the numbers count up.
function drawSummary() {
  ctx.fillStyle = 'rgba(5,6,8,0.66)';
  ctx.fillRect(0, 0, W, H);
  const s = G.sum, w = 248, h = 206, x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2);
  panel(x, y, w, h, '#0f1014');
  text('MISSION OVER', x + w / 2, y + 12, U.ink, { align: 'center', scale: 2 });
  if (s.newBest) text('NEW BEST', x + w / 2, y + 30, U.gold, { align: 'center' });
  const k = ease(clamp((realT - sumStart - 0.3) / 1.4, 0, 1));
  const rows = [['ZOMBIES KILLED', fmt(Math.round(s.kills * k))], ['BEST STREAK', fmt(Math.round(s.streak * k))],
    ['BIGGEST BLAST', fmt(Math.round(s.blast * k))], ['ROUNDS ON TARGET', Math.round(s.acc * k) + '%']];
  rows.forEach((r, i) => {
    text(r[0], x + 20, y + 44 + i * 15, U.dim);
    text(r[1], x + w - 20, y + 44 + i * 15, U.ink, { align: 'right' });
  });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 16, y + 107, w - 32, 1);
  ctx.drawImage(ICON.coin, x + 20, y + 115);
  text('CASH EARNED', x + 30, y + 116, U.ink);
  text('$' + fmt(Math.round(s.cash * clamp((realT - sumStart - 1.5) / 0.8, 0, 1))), x + w - 20, y + 116, U.gold, { align: 'right' });
  text('BEST ' + fmt(best.kills) + ' KILLS', x + w - 20, y + 130, U.faint, { align: 'right' });
  if (button(x + 16, y + h - 32, 104, 20, 'FLY AGAIN', { primary: true })) startGame();
  if (button(x + w - 120, y + h - 32, 104, 20, 'TITLE')) toTitle();
}

// ---------- the UI for the current mode
function drawUI() {
  if (mode === 'title') {
    drawTitle();
    drawBanners();
    return;
  }
  drawHUD();
  drawCoins();
  if (mode === 'play' || mode === 'ending') {
    drawWeapons();
    drawHint();
    drawBanners();
    if (mode === 'play' && !paused) drawSight();
    if (paused) drawPause();
    drawTension();
  } else if (mode === 'summary') drawSummary();
}
