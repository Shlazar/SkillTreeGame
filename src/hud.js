/* The gunship's display: thin white vector lines and a monospace readout over the thermal feed. */
const HUD = { ctx: null, w: 1, h: 1, dpr: 1, s: 1, banner: null, flashT: 0 };
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
const P2 = new THREE.Vector3();
function toScreen(x, y, z) {
  P2.set(x, y, z).project(R3.camera);
  return [(P2.x + 1) / 2 * HUD.w, (1 - P2.y) / 2 * HUD.h, P2.z < 1];
}
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const clock = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function showBanner(text) { HUD.banner = { text, t: 0 }; }

function drawHud(S, dt, opts) {
  const c = HUD.ctx, w = HUD.w, h = HUD.h, s = HUD.s, t = S.t;
  c.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.lineCap = 'square';
  // the frame's corners
  const m = 18 * s, L = 34 * s;
  seg(c, [m, m, m + L, m, m, m, m, m + L, w - m, m, w - m - L, m, w - m, m, w - m, m + L,
    m, h - m, m + L, h - m, m, h - m, m, h - m - L, w - m, h - m, w - m - L, h - m, w - m, h - m, w - m, h - m - L], DIM, 1.5);
  // heading tape
  const fx = -Math.cos(S.theta), fz = -Math.sin(S.theta);
  const hd = (Math.atan2(fx, -fz) * 180 / Math.PI + 360) % 360, cx = w / 2, ty = 34 * s, half = 160 * s, ppd = half / 45;
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

  // fuel, kills, cash
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

  // sensor readouts
  const rx = w - 40 * s;
  y = 52 * s;
  const range = R3.camera.position.distanceTo(S.aim);
  txt(c, 'RNG ' + String(Math.round(range)).padStart(4, '0') + ' M', rx, y, 15, 'right');
  txt(c, 'ALT ' + Math.round(CFG.orbit.alt * 3.281 + Math.sin(t * 0.3) * 12) + ' FT', rx, y + 22 * s, 13, 'right', DIM);
  txt(c, 'FOV ' + S.fov.toFixed(1) + '°  ' + (CFG.fov.def / S.fov).toFixed(1) + 'x', rx, y + 42 * s, 13, 'right', DIM);
  txt(c, (opts.invert ? 'BHT' : 'WHT') + '  IR', rx, y + 62 * s, 13, 'right', DIM);

  // weapons
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

  // horde and the recorder
  txt(c, 'HORDE ' + S.zombies.length, w - 40 * s, h - 92 * s, 15, 'right');
  const rec = 'REC  T+' + clock(S.run);
  txt(c, rec, w - 40 * s, h - 62 * s, 13, 'right', DIM);
  if (Math.floor(t * 1.4) % 2 === 0) {
    c.font = `${Math.round(13 * s)}px 'Share Tech Mono', monospace`;
    c.fillStyle = INK; c.beginPath(); c.arc(w - 40 * s - c.measureText(rec).width - 10 * s, h - 66 * s, 4 * s, 0, TAU); c.fill();
  }

  // shells on their way down: a marker and the seconds to impact
  for (const r of S.rounds) {
    if (r.kind !== 'he' || !r.player) continue;
    const [x, yy, on] = toScreen(r.b.x, 0, r.b.z);
    if (!on) continue;
    const left = Math.max(0, r.travel - r.age), q = (6 + left * 10) * s;
    seg(c, [x - q, yy, x, yy - q, x, yy - q, x + q, yy, x + q, yy, x, yy + q, x, yy + q, x - q, yy], INK, 1.3);
    txt(c, left.toFixed(1), x + q + 6 * s, yy + 4 * s, 12, 'left', DIM);
  }

  // the reticle: in the middle when the mouse is locked, else under the cursor
  const ax = opts.locked ? w / 2 : S.cursor.x * w, ay = opts.locked ? h / 2 : S.cursor.y * h;
  const g = 7 * s, l = 22 * s, R = 36 * s;
  seg(c, [ax - g - l, ay, ax - g, ay, ax + g, ay, ax + g + l, ay, ax, ay - g - l, ax, ay - g, ax, ay + g, ax, ay + g + l], INK, 1.5);
  c.lineWidth = 3.5; c.strokeStyle = SHADOW;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(ax, ay, R, k * Math.PI / 2 + 0.22, (k + 1) * Math.PI / 2 - 0.22); c.stroke(); }
  c.lineWidth = 1.5; c.strokeStyle = DIM;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(ax, ay, R, k * Math.PI / 2 + 0.22, (k + 1) * Math.PI / 2 - 0.22); c.stroke(); }
  // gun heat as an arc on the left of the ring
  if (S.mgHeat > 0.01) {
    c.lineWidth = 3 * s; c.strokeStyle = S.overheat && Math.floor(t * 6) % 2 ? DIM : INK;
    c.beginPath(); c.arc(ax, ay, R + 6 * s, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 0.5 * S.mgHeat); c.stroke();
  }
  // brackets: solid when the 105 is loaded, filling in as it reloads
  const B = 64 * s, bl = 14 * s, col = ready ? INK : FAINT;
  seg(c, [ax - B, ay - B, ax - B + bl, ay - B, ax - B, ay - B, ax - B, ay - B + bl, ax + B, ay - B, ax + B - bl, ay - B, ax + B, ay - B, ax + B, ay - B + bl,
    ax - B, ay + B, ax - B + bl, ay + B, ax - B, ay + B, ax - B, ay + B - bl, ax + B, ay + B, ax + B - bl, ay + B, ax + B, ay + B, ax + B, ay + B - bl], col, 1.5);
  if (!ready) { c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.arc(ax, ay, B * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - S.heReload / CFG.he.reload)); c.stroke(); }
  if (S.hitT > 0) {
    const a = 12 * s, b2 = 20 * s;
    seg(c, [ax - a, ay - a, ax - b2, ay - b2, ax + a, ay - a, ax + b2, ay - b2, ax - a, ay + a, ax - b2, ay + b2, ax + a, ay + a, ax + b2, ay + b2], INK, 2);
  }

  // messages
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
  if (opts.hint) txt(c, opts.hint, w / 2, h - 40 * s, 15, 'center', DIM);
}
