/* What is drawn over the picture. Colour mode keeps its panels in the page (shell.html) and draws
 * only a pixel reticle and markers here; thermal mode draws the gun camera's white vector overlay. */
const HUD = { ctx: null, w: 1, h: 1, dpr: 1, s: 1, banner: null };
const INK = '#f2f2f2', DIM = 'rgba(242,242,242,0.58)', FAINT = 'rgba(242,242,242,0.3)', SHADOW = 'rgba(0,0,0,0.75)';
function initHud(canvas) { HUD.canvas = canvas; HUD.ctx = canvas.getContext('2d'); }
function resizeHud(w, h, dpr) {
  HUD.w = w; HUD.h = h; HUD.dpr = dpr;
  HUD.canvas.width = Math.round(w * dpr); HUD.canvas.height = Math.round(h * dpr);
  HUD.s = clamp(Math.min(w / 1280, h / 720), 0.68, 1.5);
}
function txt(c, s, x, y, size, align, color) {
  c.font = `${Math.round(size * HUD.s)}px 'Share Tech Mono', ui-monospace, Consolas, monospace`;
  c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
  c.lineWidth = 3; c.strokeStyle = SHADOW; c.strokeText(s, x, y);
  c.fillStyle = color || INK; c.fillText(s, x, y);
}
function seg(c, pts, color, width) {
  c.beginPath();
  for (let k = 0; k < pts.length; k += 4) { c.moveTo(pts[k], pts[k + 1]); c.lineTo(pts[k + 2], pts[k + 3]); }
  c.lineWidth = (width || 1.5) + 2; c.strokeStyle = SHADOW; c.stroke();
  c.lineWidth = width || 1.5; c.strokeStyle = color || INK; c.stroke();
}
// a world point in page pixels
const HA = [0, 0];
function toPage(x, y, z) {
  toArt(x, y, z, HA);
  const k = VIEW.S / HUD.dpr;
  return [HA[0] * k, HA[1] * k];
}
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clock = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function showBanner(text) { HUD.banner = { text, t: 0 }; }

/* ---------------------------------------------------------- pixel shapes */
// plot on the art pixel grid of the picture, so the reticle is as crisp as the world
function pixelRing(c, cx, cy, r, gaps, color, k) {
  c.fillStyle = color;
  const n = Math.ceil(r * 8);
  let last = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, q = ((a + Math.PI / 4) % (Math.PI / 2)) / (Math.PI / 2);
    if (gaps && (q < 0.2 || q > 0.8)) continue;
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r), key = x + ',' + y;
    if (key === last) continue;
    last = key;
    c.fillRect(x * k, y * k, k, k);
  }
}
function pixelLine(c, x0, y0, x1, y1, color, k) {
  c.fillStyle = color;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + (x1 - x0) * i / n) * k, Math.round(y0 + (y1 - y0) * i / n) * k, k, k);
}

function drawHud(S, dt, opts) {
  const c = HUD.ctx, w = HUD.w, h = HUD.h, s = HUD.s, t = S.t, thermal = opts.thermal;
  c.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.lineCap = 'square';
  const kk = VIEW.S / HUD.dpr;                                     // page pixels per art pixel
  const ax = S.cursorArt[0] * kk, ay = S.cursorArt[1] * kk;        // the crosshair
  const ready = S.heReload <= 0;
  if (thermal) drawThermalHud(c, S, dt, opts, w, h, s, t);
  if (!opts.live) return;
  const k = Math.max(2, kk);                                       // pixel size of the colour overlay
  const at = (x, y) => [Math.round(x / k), Math.round(y / k)];
  // shells on their way down: a marker and the seconds to impact
  for (const r of S.rounds) {
    if (r.kind !== 'he' || !r.player) continue;
    const [x, yy] = toPage(r.b.x, 0, r.b.z);
    const left = Math.max(0, r.travel - r.age), q = (6 + left * 10) * s;
    if (thermal) {
      seg(c, [x - q, yy, x, yy - q, x, yy - q, x + q, yy, x + q, yy, x, yy + q, x, yy + q, x - q, yy], INK, 1.3);
      txt(c, left.toFixed(1), x + q + 6 * s, yy + 4 * s, 12, 'left', DIM);
    } else {
      const [px, py] = at(x, yy);
      pixelRing(c, px, py, Math.round(q / k) + 2, false, 'rgba(255,170,90,0.9)', k);
    }
  }
  // the locked zombie: brackets round its sprite
  if (S.lock && !S.lock.dead) {
    const z = S.lock, [fx, fy] = toPage(z.x, 0, z.z), hw = (z.big ? 12 : 8) * kk, top = (z.big ? 29 : 20) * kk;
    if (thermal) {
      const x0 = fx - hw - 3 * s, x1 = fx + hw + 3 * s, y0 = fy - top - 3 * s, y1 = fy + 3 * s, L = 6 * s;
      seg(c, [x0, y0, x0 + L, y0, x0, y0, x0, y0 + L, x1, y0, x1 - L, y0, x1, y0, x1, y0 + L,
        x0, y1, x0 + L, y1, x0, y1, x0, y1 - L, x1, y1, x1 - L, y1, x1, y1, x1, y1 - L], INK, 1.5);
    } else {
      const p = (Math.sin(t * 18) > 0 ? 0 : 1), [x0, y0] = at(fx - hw, fy - top), [x1, y1] = at(fx + hw, fy);
      const col = '#ff6a4a', a = x0 - 2 - p, b = x1 + 2 + p, cTop = y0 - 2 - p, cBot = y1 + 2 + p;
      for (const [sx, sy, dx, dy] of [[a, cTop, 1, 1], [b, cTop, -1, 1], [a, cBot, 1, -1], [b, cBot, -1, -1]]) {
        pixelLine(c, sx, sy, sx + dx * 3, sy, col, k);
        pixelLine(c, sx, sy, sx, sy + dy * 3, col, k);
      }
    }
  }
  // a big one's health, while it is locked or hurt
  for (const z of S.zombies) {
    if (!z.big || (z.hp >= CFG.types[2].hp && z !== S.lock)) continue;
    const [fx, fy] = toPage(z.x, 0, z.z), f = Math.max(0, z.hp) / CFG.types[2].hp;
    if (thermal) { c.fillStyle = SHADOW; c.fillRect(fx - 12 * s, fy - 33 * kk, 24 * s, 4 * s); c.fillStyle = INK; c.fillRect(fx - 12 * s, fy - 33 * kk, 24 * s * f, 4 * s); }
    else {
      const [px, py] = at(fx, fy - 32 * kk);
      c.fillStyle = 'rgba(8,10,20,0.8)'; c.fillRect((px - 6) * k, py * k, 13 * k, 2 * k);
      c.fillStyle = f > 0.5 ? '#9be36a' : f > 0.25 ? '#ffd176' : '#ff5a4a'; c.fillRect((px - 6) * k, py * k, Math.max(1, Math.round(13 * f)) * k, k);
    }
  }
  // kills: a red cross where each one fell, and the cash it brought floating up
  for (const m of S.marks) {
    const [fx, fy] = toPage(m.x, 0, m.z), cy = fy - (m.big ? 12 : 8) * kk, r = (2 + m.t * 14) * (thermal ? s * 1.4 : 1);
    if (thermal) seg(c, [fx - r, cy - r, fx + r, cy + r, fx - r, cy + r, fx + r, cy - r], INK, 1.5);
    else {
      const [px, py] = at(fx, cy), q = Math.round(r / 2) + 1, col = m.t < 0.12 ? '#ffffff' : '#ff4a3a';
      pixelLine(c, px - q, py - q, px + q, py + q, col, k); pixelLine(c, px - q, py + q, px + q, py - q, col, k);
    }
  }
  for (const p of S.pops) {
    const [fx, fy] = toPage(p.x, 0, p.z), rise = (p.big ? 34 : 24) + p.t * 22, size = (p.big ? 13 : 8) * Math.max(1.4, kk);
    c.globalAlpha = p.t > 0.65 ? (1 - p.t) / 0.35 : 1;
    c.font = thermal ? `${Math.round(size * 0.9)}px 'Share Tech Mono', monospace` : `600 ${Math.round(size)}px 'Pixelify Sans', monospace`;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.lineWidth = 3; c.strokeStyle = SHADOW; c.strokeText(p.text, fx, fy - rise * kk / 2);
    c.fillStyle = thermal ? INK : p.big ? '#ffb56a' : '#ffd176'; c.fillText(p.text, fx, fy - rise * kk / 2);
    c.globalAlpha = 1;
  }
  // the reticle
  if (thermal) {
    const g = 5 * s, l = 14 * s, R = 22 * s;
    seg(c, [ax - g - l, ay, ax - g, ay, ax + g, ay, ax + g + l, ay, ax, ay - g - l, ax, ay - g, ax, ay + g, ax, ay + g + l], INK, 1.5);
    c.lineWidth = 3.5; c.strokeStyle = SHADOW;
    for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(ax, ay, R, q * Math.PI / 2 + 0.25, (q + 1) * Math.PI / 2 - 0.25); c.stroke(); }
    c.lineWidth = 1.5; c.strokeStyle = S.lock ? INK : DIM;
    for (let q = 0; q < 4; q++) { c.beginPath(); c.arc(ax, ay, R, q * Math.PI / 2 + 0.25, (q + 1) * Math.PI / 2 - 0.25); c.stroke(); }
    if (S.mgHeat > 0.01) {
      c.lineWidth = 3 * s; c.strokeStyle = S.overheat && Math.floor(t * 6) % 2 ? DIM : INK;
      c.beginPath(); c.arc(ax, ay, R + 6 * s, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 0.5 * S.mgHeat); c.stroke();
    }
    if (!ready) { c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.arc(ax, ay, R + 12 * s, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - S.heReload / CFG.he.reload)); c.stroke(); }
    if (S.hitT > 0) {
      const a = 9 * s, b2 = 15 * s;
      seg(c, [ax - a, ay - a, ax - b2, ay - b2, ax + a, ay - a, ax + b2, ay - b2, ax - a, ay + a, ax - b2, ay + b2, ax + a, ay + a, ax + b2, ay + b2], INK, 2);
    }
    if (S.streak.n >= 3 && t - S.streak.t < 1.6) txt(c, '×' + S.streak.n, ax + R + 16 * s, ay - R + 4 * s, 18, 'left');
  } else {
    // a pixel reticle on the art grid: a broken ring, a dot, the 105 ring filling as it loads
    const [px, py] = at(ax, ay), dark = 'rgba(8,10,20,0.7)', lit = S.lock ? '#ffffff' : '#f4f1e6';
    for (const [ox, oy] of [[1, 0], [0, 1]]) pixelRing(c, px + ox, py + oy, 8, true, dark, k);
    pixelRing(c, px, py, 8, true, S.overheat ? (Math.floor(t * 6) % 2 ? '#ff5a4a' : '#ffd0c8') : lit, k);
    c.fillStyle = dark; c.fillRect((px + 1) * k, (py + 1) * k, k, k);
    c.fillStyle = S.lock ? '#ff6a4a' : '#ffd176'; c.fillRect(px * k, py * k, k, k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pixelLine(c, px + dx * 11, py + dy * 11, px + dx * 13, py + dy * 13, lit, k);
    if (!ready) {
      const n = 48, fill = 1 - S.heReload / CFG.he.reload;
      c.fillStyle = '#ffb56a';
      for (let i = 0; i < n * fill; i++) { const a = -Math.PI / 2 + (i / n) * TAU; c.fillRect(Math.round(px + Math.cos(a) * 16) * k, Math.round(py + Math.sin(a) * 16) * k, k, k); }
    }
    if (S.hitT > 0) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pixelLine(c, px + dx * 4, py + dy * 4, px + dx * 6, py + dy * 6, '#ff5a4a', k);
    if (S.mgHeat > 0.02) {
      const n = 40, fill = S.mgHeat;
      c.fillStyle = S.mgHeat > 0.75 ? '#ff5a4a' : '#8fc9ed';
      for (let i = 0; i < n * fill * 0.25; i++) { const a = Math.PI * 0.75 + (i / n) * TAU; c.fillRect(Math.round(px + Math.cos(a) * 11) * k, Math.round(py + Math.sin(a) * 11) * k, k, k); }
    }
    if (S.streak.n >= 3 && t - S.streak.t < 1.6) {
      const size = Math.round(9 * k), tx = (px + 14) * k, ty = (py - 8) * k;
      c.font = `600 ${size}px 'Pixelify Sans', monospace`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.lineWidth = 3; c.strokeStyle = SHADOW; c.strokeText('×' + S.streak.n, tx, ty);
      c.fillStyle = S.streak.n >= 25 ? '#ff6a4a' : S.streak.n >= 10 ? '#ffb56a' : '#ffd176'; c.fillText('×' + S.streak.n, tx, ty);
      c.fillStyle = 'rgba(255,209,118,0.85)'; c.fillRect(tx, ty + 3 * k / 2, size * 1.6 * (1 - (t - S.streak.t) / 1.6), k);
    }
  }
  if (opts.hint && thermal) txt(c, opts.hint, w / 2, h - 40 * s, 15, 'center', DIM);
}

// the gun camera's overlay: corner brackets, heading, readouts, weapon state, banners
function drawThermalHud(c, S, dt, opts, w, h, s, t) {
  const m = 18 * s, L = 34 * s;
  seg(c, [m, m, m + L, m, m, m, m, m + L, w - m, m, w - m - L, m, w - m, m, w - m, m + L,
    m, h - m, m + L, h - m, m, h - m, m, h - m - L, w - m, h - m, w - m - L, h - m, w - m, h - m, w - m, h - m - L], DIM, 1.5);
  const hd = 315 + Math.sin(t * 0.21) * 1.5, cx = w / 2, ty = 34 * s, half = 160 * s, ppd = half / 45;
  const ticks = [];
  for (let d = Math.ceil((hd - 45) / 5) * 5; d <= hd + 45; d += 5) {
    const x = cx + (d - hd) * ppd, dd = ((d % 360) + 360) % 360, big = dd % 15 === 0;
    ticks.push(x, ty + (big ? 8 : 12) * s, x, ty + 16 * s);
    if (dd % 30 === 0) txt(c, ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'][dd / 30], x, ty + 2 * s, 12, 'center', Math.abs(d - hd) > 35 ? FAINT : DIM);
  }
  seg(c, ticks, DIM, 1.2);
  seg(c, [cx, ty + 20 * s, cx - 5 * s, ty + 27 * s, cx, ty + 20 * s, cx + 5 * s, ty + 27 * s], INK, 1.5);
  txt(c, String(Math.round(hd) % 360).padStart(3, '0'), cx, ty + 44 * s, 15, 'center');
  if (!opts.live) return;
  const lx = 40 * s;
  let y = 52 * s;
  txt(c, 'FUEL', lx, y, 13, 'left', DIM);
  const bw = 150 * s, bx = lx + 48 * s, low = S.fuel < 10;
  c.strokeStyle = DIM; c.lineWidth = 1; c.strokeRect(bx, y - 10 * s, bw, 9 * s);
  c.fillStyle = low && Math.floor(t * 4) % 2 ? DIM : INK; c.fillRect(bx + 2 * s, y - 8 * s, (bw - 4 * s) * Math.max(0, S.fuel) / CFG.fuel, 5 * s);
  txt(c, mmss(S.fuel), bx + bw + 10 * s, y, 15, 'left', low ? INK : DIM);
  y += 34 * s;
  txt(c, 'KILLS', lx, y, 13, 'left', DIM); txt(c, String(S.kills), lx + 64 * s, y + 2 * s, 28);
  y += 30 * s;
  txt(c, 'CASH', lx, y, 13, 'left', DIM); txt(c, '$' + S.cash, lx + 64 * s, y, 18);
  const rx = w - 40 * s;
  y = 52 * s;
  txt(c, 'RNG ' + String(Math.round(1250 + Math.sin(t * 0.3) * 6)).padStart(4, '0') + ' M', rx, y, 15, 'right');
  txt(c, 'ALT ' + Math.round(3215 + Math.sin(t * 0.3) * 12) + ' FT', rx, y + 22 * s, 13, 'right', DIM);
  txt(c, 'ZOOM ' + opts.zoomLabel, rx, y + 42 * s, 13, 'right', DIM);
  txt(c, (opts.invert ? 'BHT' : 'WHT') + '  IR', rx, y + 62 * s, 13, 'right', DIM);
  const wx = 40 * s, wy = h - 92 * s;
  txt(c, 'LMB', wx, wy, 12, 'left', DIM);
  txt(c, '25MM', wx + 40 * s, wy, 17, 'left', S.overheat ? (Math.floor(t * 6) % 2 ? INK : DIM) : INK);
  const hw = 110 * s, hx = wx + 100 * s;
  c.strokeStyle = DIM; c.lineWidth = 1; c.strokeRect(hx, wy - 11 * s, hw, 9 * s);
  c.fillStyle = S.mgHeat > 0.75 ? INK : DIM; c.fillRect(hx + 2 * s, wy - 9 * s, (hw - 4 * s) * S.mgHeat, 5 * s);
  txt(c, S.overheat ? 'OVERHEAT' : S.trigger ? 'FIRING' : 'HEAT', hx + hw + 10 * s, wy, 12, 'left', S.overheat ? INK : DIM);
  const ready = S.heReload <= 0;
  txt(c, 'RMB', wx, wy + 30 * s, 12, 'left', DIM);
  txt(c, '105MM', wx + 40 * s, wy + 30 * s, 17, 'left', ready ? INK : DIM);
  c.strokeStyle = DIM; c.strokeRect(hx, wy + 19 * s, hw, 9 * s);
  c.fillStyle = ready ? INK : DIM; c.fillRect(hx + 2 * s, wy + 21 * s, (hw - 4 * s) * (1 - S.heReload / CFG.he.reload), 5 * s);
  txt(c, ready ? 'READY' : 'LOADING', hx + hw + 10 * s, wy + 30 * s, 12, 'left', ready ? INK : DIM);
  txt(c, 'HORDE ' + S.zombies.length, w - 40 * s, h - 92 * s, 15, 'right');
  const rec = 'REC  T+' + clock(S.run);
  txt(c, rec, w - 40 * s, h - 62 * s, 13, 'right', DIM);
  if (Math.floor(t * 1.4) % 2 === 0) {
    c.font = `${Math.round(13 * s)}px 'Share Tech Mono', monospace`;
    c.fillStyle = INK; c.beginPath(); c.arc(w - 40 * s - c.measureText(rec).width - 10 * s, h - 66 * s, 4 * s, 0, TAU); c.fill();
  }
  if (HUD.banner) {
    HUD.banner.t += dt;
    const u = HUD.banner.t;
    if (u > 1.8) HUD.banner = null;
    else if (u > 0.3 || Math.floor(u * 14) % 2 === 0) {
      c.globalAlpha = u > 1.4 ? (1.8 - u) / 0.4 : 1;
      txt(c, HUD.banner.text, w / 2, h * 0.25, 34, 'center');
      c.globalAlpha = 1;
    }
  }
  if (S.fuel < 10 && S.mode === 'play' && Math.floor(t * 2.5) % 2 === 0) txt(c, 'BINGO FUEL', w / 2, 104 * s, 20, 'center');
  if (S.overheat) txt(c, 'GUN OVERHEAT', w / 2, h / 2 + 96 * s, 15, 'center');
}
