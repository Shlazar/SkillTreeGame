// ui.js - everything drawn over the world, in screen pixels: the gun sight and lock brackets, the
// top bar (cash, kills, the train's health, the way to the station and the safe zone), warnings,
// arrows on the screen edge to the train and to trouble out of view, the radar, the weapon cards,
// coins, banners, hints, the red edge when the train is nearly lost, and the screens (title, pause,
// summary). Buttons are drawn in the canvas too (from Ball x Archers).

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
  // the 105 would hit the train too
  if (G.heReload <= 0 && trainDist(G.camX + G.aimSX, G.camY + G.aimSY, G.tr.v * CFG.he.travel) < CFG.he.close + 4) {
    text('DANGER CLOSE', x, y + 17, U.red, { align: 'center' });
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
  // the train's health: green, then amber, then red; the part just lost shows pale for a moment
  const tr = G.tr, f = tr.hp / CFG.train.hp, hx = 150, hw = clamp(Math.round(W * 0.18), 50, 120);
  ctx.drawImage(ICON.train, hx - 12, 5);
  bar(hx, 6, hw, 6, tr.hpShown / CFG.train.hp, '#1a1716', '#d8cfb8');
  ctx.fillStyle = f < 0.35 ? '#b8402e' : f < 0.65 ? '#c9862f' : '#6f9a4f';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 6);
  ctx.fillStyle = f < 0.35 ? '#e06a4f' : f < 0.65 ? '#e8b05a' : '#9cc777';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 1);
  // the way to the safe zone: the line, the station halfway, the train on it, the flag, the
  // distance left (2 px = 1 m)
  if (!G.demo) {
    const px = hx + hw + 20, pw = W - 96 - px, left = Math.max(0, Math.round((tr.s - G.goalS) / 2));
    const k = clamp((tr.startS - tr.s) / CFG.trip, 0, 1);
    if (pw >= 40) {
      ctx.fillStyle = '#2e3139';
      ctx.fillRect(px, 9, pw, 1);
      ctx.fillStyle = '#b8862f';
      ctx.fillRect(px, 9, Math.round(pw * k), 1);
      for (let t = 0; t <= 4; t++) ctx.fillRect(px + Math.round(pw * t / 4), 8, 1, 3);
      const sx = px + Math.round(pw / 2), done = G.station && G.station.state === 'leaving';
      ctx.fillStyle = '#07080a';
      ctx.fillRect(sx - 2, 4, 5, 9);
      ctx.fillStyle = done ? '#8fd18a' : '#9fd3f2';
      ctx.fillRect(sx - 1, 5, 3, 7);
      ctx.fillStyle = '#07080a';
      ctx.fillRect(px + Math.round(pw * k) - 2, 6, 5, 7);
      ctx.fillStyle = '#e8dfc8';
      ctx.fillRect(px + Math.round(pw * k) - 1, 7, 3, 5);
      ctx.drawImage(ICON.flag, px + pw + 4, 4);
    }
    text(left + 'M', W - 30, 6, U.dim, { align: 'right' });
  }
  if (mode === 'play' && button(W - 23, 1, 21, 16, paused ? '>' : 'II')) paused = !paused;
  if (Au.muted) text('MUTE', W - 4, 22, U.faint, { align: 'right' });
  // kill streak: the count and the time left to keep it going
  const s = G.streak, st = G.t - s.t;
  if (s.n >= 3 && st < 1.6) {
    text('STREAK ' + s.n, 5, 24, s.n >= 25 ? '#ffd36a' : U.gold);
    bar(5, 33, 52, 2, 1 - st / 1.6, '#1a1716', '#e3b04b');
  }
}
// warnings under the top bar: the dead on the track or on the train, the helicopter too far away,
// the survivors boarding
function drawWarnings() {
  if (G.result) return;
  const red = Math.floor(realT * 3) % 2 === 0 ? U.red : '#a8241a', st = G.station, L = [];
  if (G.blocked) L.push(['THE DEAD ARE ON THE TRACK AHEAD', red]);
  if (G.onTrain > 0) L.push([G.onTrain + (G.onTrain > 1 ? ' ZOMBIES' : ' ZOMBIE') + ' ON THE TRAIN', red]);
  if (G.heli.far) L.push(['STAY WITH THE TRAIN  (F)', U.amber]);
  if (st && st.state === 'boarding') {
    L.push(['SURVIVORS ABOARD ' + st.saved + ' / ' + CFG.station.people, '#8fd18a']);
    if (st.blockedT > 0.6) L.push(['CLEAR THE DEAD FROM THE STATION DOOR', U.amber]);
  }
  L.forEach(([t, c], i) => text(t, W / 2, 24 + i * 10, c, { align: 'center' }));
}
// An arrow on the edge of the screen pointing at (wx, wy) in the world when that is out of view,
// with a label just inside it.
function edgeArrow(wx, wy, col, label) {
  const sx = wx - G.camX, sy = wy - G.camY;
  if (sx > 8 && sx < W - 8 && sy > 26 && sy < H - 8) return false;
  // the arrows keep inside a frame below the warnings: x 12..W-12, y 62..H-12
  const cx = W / 2, cy = (62 + H - 12) / 2, hw = W / 2 - 12, hh = (H - 74) / 2;
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
    text(label, clamp(lx, w / 2 + 4, W - w / 2 - 4), clamp(ly, 22, H - 10), col, { align: 'center' });
  }
  return true;
}
// Arrows to the train, and to trouble out of view: the dead on a car, on the track ahead, after a
// survivor.
const ON_CAR = [0, 0, 0, 0, 0];
function drawArrows() {
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
  if (!edgeArrow(c.cx, c.cy, n ? U.red : U.gold, 'TRAIN ' + Math.round(Math.hypot(c.cx - G.camX - W / 2, c.cy - G.camY - H / 2) / 2) + 'M' + (n ? '  ' + n + '!' : ''))) {
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
function drawRadar() {
  const R = 36, x0 = W - R * 2 - 6, y0 = H - R * 2 - 6, cx = x0 + R, cy = y0 + R, k = R / 640;
  const hx = G.camX + W / 2, hy = G.camY + H / 2;
  ctx.fillStyle = 'rgba(6,10,8,0.84)';
  ctx.fillRect(x0, y0, R * 2, R * 2);
  frame(x0 - 1, y0 - 1, R * 2 + 2, R * 2 + 2, '#2e3139');
  ctx.fillStyle = 'rgba(86,194,168,0.12)';
  ctx.fillRect(cx, y0, 1, R * 2);
  ctx.fillRect(x0, cy, R * 2, 1);
  const dot = (wx, wy, c, s) => {
    const px = Math.round(cx + (wx - hx) * k), py = Math.round(cy + (wy - hy) * k);
    if (px < x0 || py < y0 || px > x0 + R * 2 - s || py > y0 + R * 2 - s) return;
    ctx.fillStyle = c;
    ctx.fillRect(px, py, s, s);
  };
  for (let wy = hy - 640; wy <= hy + 640; wy += 14) dot(trackX(wy), wy, '#3e434c', 1);
  if (G.goalY > hy - 640 && G.goalY < hy + 640) for (let dx = -560; dx <= 560; dx += 18) dot(trackX(G.goalY) + dx, G.goalY, '#8fd18a', 1);
  const st = G.station;
  if (st) dot(st.house.x - 1, st.house.y - 1, '#9fd3f2', 2);
  for (const z of G.zombies) if (!z.dead) dot(z.x, z.y, z.st ? '#ff4a32' : '#7a2a22', 1);
  for (const p of G.people) if (p.st === 'run' || p.st === 'wait' || p.st === 'grab') dot(p.x, p.y, '#8fd18a', 1);
  for (const c of G.tr.cars) dot(c.cx - 1, c.cy - 1, '#e8dfc8', 2);
  // the view
  const vx = Math.round(cx - W / 2 * k), vy = Math.round(cy - H / 2 * k);
  ctx.globalAlpha = 0.55;
  frame(vx, vy, Math.round(W * k) + 1, Math.round(H * k) + 1, '#9fd3f2');
  ctx.globalAlpha = 1;
  text('N', cx, y0 + 2, U.faint, { align: 'center', outline: false });
}
function drawWeapons() {
  const y = H - 30, rdy = G.heReload <= 0;
  card(4, y, 96, 26, ICON.mg, '25MM', G.overheat ? 'OVERHEAT' : 'L-CLICK', G.overheat ? U.red : U.faint, G.heat,
    G.overheat ? '#b8402e' : G.heat > 0.75 ? U.amber : '#8b919c');
  card(104, y, 96, 26, ICON.he, '105MM', rdy ? 'READY' : 'R-CLICK', rdy ? U.gold : U.faint, 1 - G.heReload / CFG.he.reload,
    rdy ? '#e3b04b' : '#7a6a50');
  text('CAMERA: ' + CAMS[thermal] + '  (T)', W - 6, H - 90, U.faint, { align: 'right' });
}
// first seconds of a run: how to play
function drawHint() {
  const a = clamp((10 - G.run) / 1.5, 0, 1);
  if (a <= 0 || G.run < 1.2 || G.result) return;
  ctx.globalAlpha = a;
  text('WASD: FLY THE HELICOPTER.  LET GO: IT KEEPS PACE WITH THE TRAIN.', W / 2, H - 58, U.ink, { align: 'center' });
  text('F: BACK OVER THE TRAIN.   LEFT CLICK: 25MM.   RIGHT CLICK: 105MM.', W / 2, H - 47, U.dim, { align: 'center' });
  ctx.globalAlpha = 1;
}
// red screen edge while the train is nearly lost
function drawTension() {
  const f = G.tr.hp / CFG.train.hp;
  if (mode !== 'play' || G.result || f >= 0.35) return;
  let a = 0.3 + 0.5 * (1 - f / 0.35);
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
  // the menu sits left of the train (on a wide enough screen)
  const cx = Math.round(W >= 560 ? W * 0.36 : W / 2), pw = 300, ph = 238, px = cx - pw / 2, py = Math.round(H / 2 - ph / 2);
  ctx.fillStyle = 'rgba(8,9,11,0.78)';
  ctx.fillRect(px, py, pw, ph);
  frame(px, py, pw, ph, '#2e3139');
  text('SKY REAPER', cx, py + 18, U.ink, { align: 'center', scale: 3, drop: true });
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(cx - 110, py + 46, 220, 1);
  text('FLY ESCORT FOR THE LAST TRAIN.', cx, py + 54, U.dim, { align: 'center' });
  text('PICK UP SURVIVORS. REACH THE SAFE ZONE.', cx, py + 64, U.dim, { align: 'center' });
  if (button(cx - 75, py + 82, 150, 20, 'START MISSION', { primary: true })) startGame();
  if (button(cx - 75, py + 108, 150, 20, 'CAMERA: ' + CAMS[thermal])) setThermal((thermal + 1) % 3);
  if (best.kills > 0) {
    const s = 'BEST ' + fmt(best.kills) + ' KILLS' + (best.safe ? '   ' + best.safe + ' SAFE' : ''), w = tw(s) + 10;
    ctx.drawImage(ICON.skull, cx - w / 2, py + 140);
    text(s, cx - w / 2 + 10, py + 141, U.gold, { outline: false });
  }
  const L = ['WASD: FLY.  F: BACK OVER THE TRAIN.  MOUSE: AIM.', 'HOLD LEFT CLICK: 25MM.  RIGHT CLICK / SPACE: 105MM.',
    'T: THERMAL.  WHEEL: ZOOM.  M: SOUND.  P: PAUSE.'];
  L.forEach((l, i) => text(l, cx, py + 160 + i * 11, U.faint, { align: 'center', outline: false }));
  text('ENTER TO START', cx, py + 205, U.faint, { align: 'center', outline: false });
}
// After the run: safe or lost, and the numbers count up.
function drawSummary() {
  ctx.fillStyle = 'rgba(5,6,8,0.66)';
  ctx.fillRect(0, 0, W, H);
  const s = G.sum, w = 248, h = 206, x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2), safe = s.result === 'safe';
  panel(x, y, w, h, '#0f1014');
  text(safe ? 'TRAIN SAFE' : 'TRAIN LOST', x + w / 2, y + 12, safe ? U.gold : U.red, { align: 'center', scale: 2 });
  if (s.newBest) text('NEW BEST', x + w / 2, y + 30, U.gold, { align: 'center' });
  const k = ease(clamp((realT - sumStart - 0.3) / 1.4, 0, 1));
  const rows = [['ZOMBIES KILLED', fmt(Math.round(s.kills * k))], ['SURVIVORS SAVED', Math.round(s.saved * k) + ' / ' + s.people],
    ['TRAIN HEALTH', Math.round(s.hp * k) + '%'], ['BIGGEST BLAST', fmt(Math.round(s.blast * k))]];
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
  if (button(x + 16, y + h - 32, 104, 20, safe ? 'NEXT TRAIN' : 'TRY AGAIN', { primary: true })) startGame();
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
    drawWarnings();
    drawRadar();
    drawWeapons();
    drawHint();
    drawBanners();
    drawArrows();
    if (mode === 'play' && !paused) drawSight();
    if (paused) drawPause();
    drawTension();
  } else if (mode === 'summary') drawSummary();
}
