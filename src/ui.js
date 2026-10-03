// ui.js - everything drawn over the world, in screen pixels: the gun sight and lock brackets, the
// top bar (scrap, survivors, kills, the train's health, the route up the line), warnings, arrows on
// the screen edge to the train and to trouble out of view, the radar, the weapon cards, coins,
// banners, hints, the red edge when the train is nearly lost, and the screens (title, pause,
// summary; the Depot is in depot.js). Buttons are drawn in the canvas too (from Ball x Archers).

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
  // the 105 is loaded: a gold pip at the top right of the sight (once the 105mm is bought)
  const he = G.up.he && G.heReload <= 0;
  if (he) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x + 6, y - 9, 4, 4);
    ctx.fillStyle = thermal ? '#ffffff' : U.gold;
    ctx.fillRect(x + 7, y - 8, 2, 2);
  }
  // the 105 would hit the train too
  if (he && trainDist(G.camX + G.aimSX, G.camY + G.aimSY, G.tr.v * CFG.he.travel) < CFG.he.close + 4) {
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
  bar(x + 17, y + 16, w - 23, 4, f, '#1a1716', fc);
}
function drawHUD() {
  ctx.fillStyle = 'rgba(6,7,9,0.88)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, 18, W, 1);
  // this run's scrap: the bolt hops and the number flashes when scrap comes in
  const cp = G.cashPulse;
  blit(ICON.scrap, 4, 4 - (cp > 0.5 ? 1 : 0));
  text(fmt(G.shownCash), 14, 6, cp > 0 ? '#ffe39a' : U.gold);
  // survivors aboard this run, and kills
  blit(ICON.surv, 58, 5);
  text(G.surv, 67, 6, G.surv ? U.green : U.faint);
  blit(ICON.skull, 88, 5);
  text(fmt(G.kills), 98, 6 - (G.killBump > 0.5 ? 1 : 0), U.ink);
  // the train's health: green, then amber, then red; the part just lost shows pale for a moment
  const tr = G.tr, f = tr.hp / tr.max, hx = 150, hw = clamp(Math.round(W * 0.16), 44, 100);
  blit(ICON.train, hx - 12, 5);
  bar(hx, 6, hw, 6, tr.hpShown / tr.max, '#1a1716', '#d8cfb8');
  ctx.fillStyle = f < 0.35 ? '#b8402e' : f < 0.65 ? '#c9862f' : '#6f9a4f';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 6);
  ctx.fillStyle = f < 0.35 ? '#e06a4f' : f < 0.65 ? '#e8b05a' : '#9cc777';
  ctx.fillRect(hx, 6, Math.round(hw * clamp(f, 0, 1)), 1);
  // and as a number
  text(Math.ceil(tr.hp), hx + hw + 4, 6, f < 0.35 ? U.red : f < 0.65 ? U.amber : U.dim);
  if (!G.demo) drawRoute(hx + hw + 30, W - 28);
  if (mode === 'play' && button(W - 23, 1, 21, 16, paused ? '>' : 'II')) setPaused(!paused);
  if (Au.muted) text('MUTE', W - 4, 22, U.faint, { align: 'right' });
  // kill streak: the count and the time left to keep it going
  const s = G.streak, st = G.t - s.t;
  if (s.n >= 3 && st < 1.6) {
    text('STREAK ' + s.n, 5, 24, s.n >= 25 ? '#ffd36a' : U.gold);
    bar(5, 33, 52, 2, 1 - st / 1.6, '#1a1716', '#e3b04b');
  }
}
// What comes next up the line, for the top bar: [text, color]. A Dead Wall within 150 m comes
// first; then the next station; past the last one, the safe zone.
function nextLabel() {
  const k = DK(), st = G.station;
  for (const w of G.walls) {
    const m = w.km - k;
    if (m < 0.15 && m > -CFG.wall.len / CFG.line.km) return [m > 0.005 ? 'DEAD WALL ' + fmtM(m) : 'DEAD WALL!', U.red];
  }
  if (st && st.state === 'boarding') return ['AT ' + st.name, U.green];
  if (st) return ['NEXT: ' + st.name + ' ' + fmtM(Math.max(0, kmAt(st.s) - k)), U.blue];
  return ['SAFE ZONE ' + fmtM(Math.max(0, CFG.line.end - k)), U.green];
}
// The route from the Depot (0 km) to the safe zone wall, between x0 and x1 on the top bar: the
// stations (blue, green once reached), the Dead Walls (red), your best (a white tick), this run's
// ride (gold), the train, and what comes next.
function drawRoute(x0, x1) {
  let [lab, lc] = nextLabel();
  let lw = tw(lab), w = x1 - x0 - lw - 20;
  if (w < 60 && lab.startsWith('NEXT: ')) {
    lab = lab.slice(6);
    lw = tw(lab);
    w = x1 - x0 - lw - 20;
  }
  text(lab, x1, 6, lc, { align: 'right' });
  if (w < 40) return;
  const end = CFG.line.end, X = (k) => x0 + Math.round(w * clamp(k / end, 0, 1)), y = 9;
  ctx.fillStyle = '#3a3e48';
  ctx.fillRect(x0, y, w, 1);
  for (let k = 1; k < end; k++) ctx.fillRect(X(k), y - 1, 1, 3);
  // this run's ride
  const k0 = kmAt(G.tr.startS), k1 = DK();
  ctx.fillStyle = '#b8862f';
  ctx.fillRect(X(k0), y, Math.max(0, X(k1) - X(k0)), 1);
  // the walls, the best, the stations, the safe zone flag
  for (const wl of WALLS) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(X(wl.km) - 2, y - 3, 5, 7);
    ctx.fillStyle = U.red;
    ctx.fillRect(X(wl.km) - 1, y - 2, 3, 5);
  }
  if (SAVE.best > 0) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(X(SAVE.best) - 1, y - 5, 3, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X(SAVE.best), y - 4, 1, 9);
  }
  for (const d of STATIONS) {
    const sx = X(d.km), live = G.stops.find((s) => s.id === d.id);
    const got = SAVE.reached.includes(d.id) || (live && live.state !== 'ahead' && live.state !== 'braking');
    ctx.fillStyle = '#07080a';
    ctx.fillRect(sx - 2, y - 4, 5, 9);
    ctx.fillStyle = got ? U.green : U.blue;
    ctx.fillRect(sx - 1, y - 3, 3, 7);
  }
  blit(ICON.flag, X(end) + 3, 3);
  // the train: a pale block that blinks while it stands at a station
  const tx = X(k1), stop = G.station && G.station.state === 'boarding';
  ctx.fillStyle = '#07080a';
  ctx.fillRect(tx - 2, y - 3, 5, 7);
  ctx.fillStyle = stop && Math.floor(realT * 3) % 2 ? U.green : '#e8dfc8';
  ctx.fillRect(tx - 1, y - 2, 3, 5);
}
// warnings under the top bar: the dead on the track or on the train, the helicopter too far away,
// the survivors boarding
function drawWarnings() {
  if (G.result) return;
  const red = Math.floor(realT * 3) % 2 === 0 ? U.red : '#a8241a', st = G.station, L = [];
  if (G.blocked) L.push(['THE DEAD ARE ON THE TRACK AHEAD' + (G.railAhead >= 4 && ramState() === 'ready' ? '  (E: RAM)' : ''), red]);
  if (G.onTrain > 0) L.push([G.onTrain + (G.onTrain > 1 ? ' ZOMBIES' : ' ZOMBIE') + ' ON THE TRAIN', red]);
  if (G.heli.far) L.push(['RADIO RANGE LIMIT  (F: BACK)', U.amber]);
  if (st && st.state === 'boarding') {
    if (st.people) L.push(['SURVIVORS ABOARD ' + st.saved + ' / ' + st.people, U.green]);
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
  // (at PRESS E! the view shows the engine's nose and the wall ahead: that is enough of the train)
  const tr = G.tr, c = G.prompt ? { cx: tr.cars[0].x0, cy: tr.cars[0].y0 } : tr.cars[2];
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
  for (const st of G.stops) dot(st.house.x - 1, st.house.y - 1, st.id === 'depot' ? U.gold : '#9fd3f2', 2);
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
// The weapon cards, bottom left: the 25mm, then the 105mm once it is bought in the skill tree, then
// the Turbo Ram.
function drawWeapons() {
  const y = H - 30, rdy = G.heReload <= 0;
  card(4, y, 96, 26, ICON.mg, '25MM', G.overheat ? 'OVERHEAT' : 'L-CLICK', G.overheat ? U.red : U.faint, G.heat,
    G.overheat ? '#b8402e' : G.heat > 0.75 ? U.amber : '#8b919c');
  if (G.up.he) card(104, y, 96, 26, ICON.he, '105MM', rdy ? 'READY' : 'R-CLICK', rdy ? U.gold : U.faint, 1 - G.heReload / G.up.reload,
    rdy ? '#e3b04b' : '#7a6a50');
  // (on a window too narrow for three cards in a row, the Ram's goes over the 25mm's)
  let rx = G.up.he ? 204 : 104, ry = y;
  if (rx + RAMCARD.w > W - 82) [rx, ry] = [4, y - 30];
  drawRamCard(rx, ry);
  // (on a narrow window the first seconds' hint needs that room)
  if (W >= 480 || !hintOn()) text('CAMERA: ' + CAMS[thermal] + '  (T)', W - 6, H - 90, U.faint, { align: 'right' });
}
// The Turbo Ram's card: E in gold when it is full, the % while it fills (the bar is the charge),
// GO! while it runs (the bar is the time left), STOP near a station (grey), and after the first
// run's taste grey with a padlock and TREE until it is bought. A click on it rams. Over it, for a
// moment, why it can't ram now.
const RAMCARD = { x: 0, y: 0, w: 106, h: 26, on: false };
function drawRamCard(x, y) {
  const r = G.ram, C = RAMCARD, R = CFG.ram;
  // (just after the first run's taste the card shows it spent, until the boiler cracks)
  let s = ramState();
  if (s === 'lock' && r.taste && r.crack < 0) s = 'charge';
  C.on = s !== 'none';
  if (!C.on) return;
  C.x = x;
  C.y = y;
  const w = C.w, h = C.h, fl = realT - r.flash, ck = realT - r.crack;
  // it shakes when the boiler cracks, and hops when it gets full
  if (ck < 0.45 && !REDUCED) x += Math.round(Math.sin(ck * 60) * 2 * (1 - ck / 0.45));
  if (fl < 0.2) y--;
  let tag, tagc, f, fc, nc = U.ink, icon = ICON.ram;
  if (s === 'on') [tag, tagc, f, fc] = ['GO!', Math.floor(realT * 8) % 2 ? '#ffe39a' : U.amber, 1 - r.t / (r.dur + R.ease), '#ff8a3a'];
  else if (s === 'ready') [tag, tagc, f, fc] = ['E', U.gold, 1, '#e3b04b'];
  else if (s === 'charge') [tag, tagc, f, fc] = [Math.floor(ramCharge() * 100) + '%', U.dim, ramCharge(), '#8a6a3a'];
  else if (s === 'stop') [tag, tagc, f, fc, nc, icon] = ['STOP', U.faint, ramCharge(), '#3a3e48', U.faint, ICON.ramOff];
  else [tag, tagc, f, fc, nc, icon] = ['TREE', U.dim, 0, '#3a3e48', U.faint, ICON.lock];
  card(x, y, w, h, icon, 'TURBO RAM', tag, tagc, f, fc, nc);
  // ready: a gold frame; just full: a white and gold flash; PRESS E!: it pulses
  if (s === 'ready' || s === 'on') frame(x, y, w, h, s === 'on' ? '#c96a2a' : '#b8862f');
  if (fl < 0.5) {
    ctx.globalAlpha = 1 - fl / 0.5;
    frame(x - 1, y - 1, w + 2, h + 2, '#ffd36a');
    ctx.globalAlpha = 0.35 * (1 - fl / 0.5);
    ctx.fillStyle = '#fff3dc';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
  }
  if (G.prompt) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(realT * 14);
    frame(x - 1, y - 1, w + 2, h + 2, '#ffd36a');
    frame(x - 2, y - 2, w + 4, h + 4, '#e3b04b');
    ctx.globalAlpha = 1;
  }
  // the boiler cracks: a red flash
  if (ck < 0.5) {
    ctx.globalAlpha = 0.5 * (1 - ck / 0.5);
    ctx.fillStyle = '#ff4a30';
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
// first seconds of a run: how to play (in the first run, after the Engineer has spoken), just over
// the weapon cards. Two groups (flying, then the keys), each on as many lines as the window needs.
const hintT0 = () => (G.taste ? 11 : 1.2);
const hintOn = () => G.run >= hintT0() && G.run < hintT0() + 8.8 && !G.result;
function drawHint() {
  const a = clamp((hintT0() + 8.8 - G.run) / 1.5, 0, 1);
  if (!hintOn() || G.prompt) return;
  const keys = ['F: BACK OVER THE TRAIN.', 'LEFT CLICK: 25MM.'];
  if (G.up.he) keys.push('RIGHT CLICK: 105MM.');
  if (G.up.ram) keys.push('E: TURBO RAM.');
  const L = [];
  for (const [group, col] of [[['WASD: FLY THE HELICOPTER.', 'LET GO: IT KEEPS PACE WITH THE TRAIN.'], U.ink], [keys, U.dim]]) {
    let line = '';
    for (const p of group) {
      const t = line ? line + '   ' + p : p;
      if (line && tw(t) > W - 16) {
        L.push([line, col]);
        line = p;
      } else line = t;
    }
    L.push([line, col]);
  }
  // (over the radar too, when a line is long enough to reach it)
  const wide = L.some(([l]) => tw(l) > W - 170);
  const top = Math.min(RAMCARD.on ? RAMCARD.y : H - 30, H - 30, wide ? H - 82 : H) - 6 - L.length * 11;
  ctx.globalAlpha = a;
  L.forEach(([l, c], i) => text(l, W / 2, top + i * 11, c, { align: 'center' }));
  ctx.globalAlpha = 1;
}
// White speed lines streaming down the outer 30% of the screen while the Ram runs (in game time:
// they stand still on pause and slow down with the game).
function drawSpeedLines() {
  const k = ramK() * clamp(G.ram.t / 0.25, 0, 1);
  if (k <= 0) return;
  const n = REDUCED ? 7 : 14, band = W * 0.3, span = H + 40;
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
// PRESS E!: the first time the train comes up to a Dead Wall with the Ram full. Time runs slow (or
// stops, with reduced motion) until E or for 3 s. The view swings to show the train and the wall
// (camLead), and the words sit on the empty rails between the two.
function drawPrompt() {
  if (!G.prompt || mode !== 'play') return;
  ctx.fillStyle = 'rgba(5,6,8,0.2)';
  ctx.fillRect(0, 19, W, H - 19);
  const w = G.prompt.w, mid = w ? promptLead(w, PL)[2] : Math.round(H * 0.4) + 28;
  const y = clamp(mid - 28, 46, H - 118), on = Math.floor(realT * 5) % 2 === 0;
  text('PRESS E!', W / 2, y, on ? '#ffe39a' : U.gold, { align: 'center', scale: 4, drop: true });
  text('TURBO RAM SMASHES THROUGH THE DEAD WALL.', W / 2, y + 38, U.ink, { align: 'center' });
  text(REDUCED ? '(OR CLICK ITS CARD. ANY OTHER KEY: GO ON.)' : '(OR CLICK ITS CARD)', W / 2, y + 49, U.dim, { align: 'center' });
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
  const x = 4, y = Math.min(H - 30, RAMCARD.on ? RAMCARD.y : H - 30) - 13 - h;
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
// titleAsk = NEW GAME was clicked: the title asks before it wipes the save
let titleAsk = false;
function titleGo() {
  if (!titleAsk) toDepot('tree');
}
function drawTitle() {
  ctx.fillStyle = 'rgba(5,6,8,0.35)';
  ctx.fillRect(0, 0, W, H);
  // the menu sits left of the train (on a wide enough screen); its height follows what it shows
  const prog = hasProgress(), ask = titleAsk;
  const cx = Math.round(W >= 560 ? W * 0.36 : W / 2), pw = 300, ph = 82 + (ask ? 58 : prog ? 72 : 30) + 58;
  const px = cx - pw / 2, py = Math.round(H / 2 - ph / 2);
  ctx.fillStyle = 'rgba(8,9,11,0.8)';
  ctx.fillRect(px, py, pw, ph);
  frame(px, py, pw, ph, '#2e3139');
  text('SKY REAPER', cx, py + 18, U.ink, { align: 'center', scale: 3, drop: true });
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(cx - 110, py + 46, 220, 1);
  text('FLY ESCORT FOR THE LAST TRAIN.', cx, py + 54, U.dim, { align: 'center' });
  text('EVERY RUN PAYS. GET A LITTLE FURTHER EACH TIME.', cx, py + 64, U.dim, { align: 'center' });
  let y = py + 82;
  if (ask) {
    // NEW GAME: ask first
    text('START A NEW GAME?', cx, y + 2, U.red, { align: 'center' });
    text('YOUR SCRAP AND PROGRESS WILL BE GONE.', cx, y + 13, U.dim, { align: 'center' });
    if (button(cx - 122, y + 26, 120, 20, 'YES, START OVER', { danger: true })) {
      newSave();
      titleAsk = false;
      toDepot('tree');
    }
    if (button(cx + 2, y + 26, 120, 20, 'NO, GO BACK')) titleAsk = false;
    y += 58;
  } else if (prog) {
    if (button(cx - 75, y, 150, 20, 'CONTINUE', { primary: true })) titleGo();
    if (button(cx - 75, y + 26, 150, 20, 'NEW GAME')) titleAsk = true;
    y += 52;
    // what you have so far
    const a = fmt(SAVE.scrap), b = String(SAVE.surv), c = 'BEST ' + SAVE.best.toFixed(2) + ' KM';
    let x = Math.round(cx - (10 + tw(a) + 12 + 9 + tw(b) + 12 + tw(c)) / 2);
    blit(ICON.scrap, x, y + 1);
    text(a, x + 10, y + 3, U.gold, { outline: false });
    x += 10 + tw(a) + 12;
    blit(ICON.surv, x, y + 2);
    text(b, x + 9, y + 3, U.green, { outline: false });
    x += 9 + tw(b) + 12;
    text(c, x, y + 3, U.dim, { outline: false });
    y += 20;
  } else {
    if (button(cx - 75, y, 150, 20, 'PLAY', { primary: true })) titleGo();
    y += 30;
  }
  const L = ['WASD: FLY.  F: BACK OVER THE TRAIN.  MOUSE: AIM.',
    lv('he') ? 'HOLD LEFT CLICK: 25MM.  RIGHT CLICK / SPACE: 105MM.' : 'HOLD LEFT CLICK: SHOOT THE 25MM GUN.',
    'T: THERMAL.  WHEEL: ZOOM.  M: SOUND.  P: PAUSE.'];
  L.forEach((l, i) => text(l, cx, y + i * 11, U.faint, { align: 'center', outline: false }));
  text(ask ? 'ESC: GO BACK' : 'ENTER: ' + (prog ? 'CONTINUE' : 'PLAY'), cx, y + 42, U.faint, { align: 'center', outline: false });
}
// After the run: how it ended, then what it paid, row by row. Each row counts up with a tick, then
// the total, the survivors (an icon each), NEW BEST, a near miss, and the way back to the Depot.
// The times (s after the summary opens) are worked out once; sounds play as each time passes.
function sumPlan(s) {
  // [label, scrap, a short note on how it pays]
  const p = s.pay, rows = [['ZOMBIES ' + fmt(s.kills), p.kills, ''], ['STREAKS', p.streaks, 'KILLS IN A ROW'],
    ['DISTANCE ' + s.ride.toFixed(2) + ' KM', p.dist, '+1 PER ' + CFG.pay.dist / 2 + ' M']];
  if (p.stop) rows.push(['STATION', p.stop, s.stops.join(' + ')]);
  if (p.loot) rows.push(['LOOT', p.loot, '']);
  const t = rows.map((r, i) => 0.55 + i * 0.32), total = t[t.length - 1] + 0.45, surv = total + 0.7;
  const icons = Math.min(s.surv, 12), best = surv + (s.surv ? icons * 0.14 + 0.25 : 0) + 0.15;
  const ev = t.map((x) => [x, 'tick']).concat([[total, 'total']]);
  for (let i = 0; i < icons; i++) ev.push([surv + i * 0.14, 'saved']);
  if (s.newBest) ev.push([best, 'best']);
  return { rows, t, total, surv, icons, best, lines: best + 0.3, end: best + 0.5, ev };
}
// Enter or a click before the count is done shows it all at once.
function sumSkip() {
  const s = G.sum, pl = s.plan || (s.plan = sumPlan(s));
  if (realT - sumStart >= pl.end) return false;
  sumStart = realT - pl.end;
  s.sounds = pl.ev.length;
  return true;
}
function drawSummary() {
  ctx.fillStyle = 'rgba(5,6,8,0.66)';
  ctx.fillRect(0, 0, W, H);
  const s = G.sum, pl = s.plan || (s.plan = sumPlan(s)), t = realT - sumStart, safe = s.result === 'safe';
  while (s.sounds < pl.ev.length && t >= pl.ev[s.sounds][0]) {
    const e = pl.ev[s.sounds++][1];
    if (e === 'tick') SFX.tick();
    else if (e === 'total') SFX.total();
    else if (e === 'saved') SFX.saved();
    else SFX.streak();
  }
  const lines = s.wall.slice();
  if (s.near) lines.push([s.near, U.amber]);
  lines.push([s.surv ? 'YOU KEEP ALL YOUR SCRAP AND SURVIVORS.' : 'YOU KEEP ALL YOUR SCRAP.', U.dim]);
  for (const g of s.goal) lines.push(g);
  const w = 264, h = 58 + pl.rows.length * 12 + 10 + 16 + (s.surv ? 16 : 0) + 10 + lines.length * 11 + 36;
  const x = Math.round(W / 2 - w / 2), y = Math.max(20, Math.round(H / 2 - h / 2)), cx = x + w / 2;
  panel(x, y, w, h, '#0f1014');
  text(safe ? 'SAFE ZONE!' : 'TRAIN LOST', cx, y + 10, safe ? U.gold : U.red, { align: 'center', scale: 2, drop: true });
  text((safe ? 'ALL THE WAY: ' : 'AT ') + s.km.toFixed(2) + ' KM', cx, y + 30, U.ink, { align: 'center' });
  // NEW BEST: a gold tag that drops in
  if (s.newBest && t >= pl.best) {
    const u = clamp((t - pl.best) / 0.15, 0, 1), bw = tw('NEW BEST!') + 10, bx = Math.round(cx - bw / 2), by = y + 41 - Math.round((1 - u) * 6);
    ctx.globalAlpha = u;
    ctx.fillStyle = '#07080a';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 11);
    ctx.fillStyle = U.gold;
    ctx.fillRect(bx, by, bw, 9);
    text('NEW BEST!', cx, by + 1, '#1a1206', { align: 'center', outline: false });
    ctx.globalAlpha = 1;
  }
  // the rows: what each kind of thing paid
  let ry = y + 58;
  pl.rows.forEach((r, i) => {
    const u = clamp((t - pl.t[i]) / 0.22, 0, 1);
    if (t < pl.t[i]) return;
    text(r[0], x + 18, ry + i * 12, U.dim);
    if (r[2]) text(r[2], x + 26 + tw(r[0]), ry + i * 12, U.faint);
    text('+' + fmt(Math.round(r[1] * u)), x + w - 18, ry + i * 12, u < 1 ? U.ink : U.gold, { align: 'right' });
  });
  ry += pl.rows.length * 12 + 2;
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, ry, w - 28, 1);
  ry += 8;
  // the total scrap, then the survivors
  if (t >= pl.total) {
    const u = ease(clamp((t - pl.total) / 0.5, 0, 1));
    blit(ICON.scrap, x + 18, ry + 3);
    text('SCRAP', x + 30, ry + 4, U.ink);
    text('+' + fmt(Math.round(s.scrap * u)), x + w - 18, ry, U.gold, { align: 'right', scale: 2 });
  }
  ry += 16;
  if (s.surv) {
    if (t >= pl.surv) {
      blit(ICON.surv, x + 18, ry + 4);
      text('SURVIVORS', x + 30, ry + 4, U.ink);
      const n = Math.min(pl.icons, Math.floor((t - pl.surv) / 0.14) + 1);
      for (let i = 0; i < n; i++) blit(ICON.surv, x + 96 + i * 8, ry + 4);
      text('+' + Math.min(s.surv, Math.round(s.surv * n / pl.icons)), x + w - 18, ry, U.green, { align: 'right', scale: 2 });
    }
    ry += 16;
  }
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, ry + 2, w - 28, 1);
  ry += 10;
  // a near miss, and the promise: nothing is lost
  ctx.globalAlpha = clamp((t - pl.lines) / 0.3, 0, 1);
  lines.forEach((l, i) => text(l[0], cx, ry + i * 11, l[1], { align: 'center' }));
  ctx.globalAlpha = 1;
  ry += lines.length * 11 + 6;
  if (button(Math.round(cx - 70), ry, 140, 20, 'TO THE DEPOT', { primary: true })) toDepot();
  text('ENTER', Math.round(cx + 76), ry + 7, U.faint, { outline: false });
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
  if (run) drawSpeedLines();
  drawHUD();
  drawCoins();
  if (run) {
    drawWarnings();
    drawRadar();
    drawWeapons();
    drawRadio();
    drawHint();
    // (the arrows under the banners, so a banner is never cut by an arrow's label)
    drawArrows();
    drawBanners();
    drawPrompt();
    if (mode === 'play' && !paused) drawSight();
    if (paused) drawPause();
    drawTension();
  } else if (mode === 'summary') drawSummary();
}
