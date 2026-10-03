// render.js - draws one frame of the world: ground and its marks, tufts, the helicopter's shadow and
// the other shadows, then trees, props, the train, the station, the safe zone, survivors and the
// dead sorted by depth (the dead behind a tree show through it), fires, particles, explosions,
// flying bodies, tracers and glows (headlights, lamps, searchlights), the mist and cloud shadows,
// then the color grade and vignette, or the thermal camera look (grey, hot things white).

let VIG = null, GRADE = null, HAZE = null, SCAN = null, GRAIN = null, MIST = null, BODYSH = null;
const CLOUDSPR = [];

// Smooth noise on a grid of cell px from a seeded rng, for a w x h area (from Ball x Archers).
function makeNoise(rng, cell, w, h) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, v = new Float32Array(gw * gh);
  for (let i = 0; i < v.length; i++) v[i] = rng();
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), o = iy * gw + ix;
    return lerp(lerp(v[o], v[o + 1], sx), lerp(v[o + gw], v[o + gw + 1], sx), sy);
  };
}
// Made once: the mist band, 2 cloud shadows, the shadow under a flying body.
function bakeStatic() {
  const fr = mulberry(404);
  let g;
  [MIST, g] = mk(640, 48);
  const nm = makeNoise(fr, 22, 1280, 48);
  g.fillStyle = '#8b9894';
  for (let y = 0; y < 48; y++) for (let x = 0; x < 640; x++) {
    // the noise wraps round at 640 px, so the band tiles without a seam
    const t = Math.sin(y / 48 * Math.PI), n = lerp(nm(x, y), nm(x + 640, y), x / 640);
    if ((n * 1.3 - 0.35) * t > bayer(x, y)) g.fillRect(x, y, 1, 1);
  }
  const cr = mulberry(21);
  CLOUDSPR.length = 0;
  for (let k = 0; k < 2; k++) {
    const cw = 200, ch = 110, n = makeNoise(cr, 18, cw, ch);
    const [cc, cg] = mk(cw, ch);
    cg.fillStyle = '#000';
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const dx = (x - cw / 2) / (cw / 2), dy = (y - ch / 2) / (ch / 2);
      if ((1 - Math.sqrt(dx * dx + dy * dy)) * 1.4 + n(x, y) * 0.8 - 0.55 > bayer(x, y)) cg.fillRect(x, y, 1, 1);
    }
    CLOUDSPR.push(cc);
  }
  BODYSH = shadowSpr(9);
}
// Made again for every size of the picture: vignette, color grade, sun haze, thermal grain and lines.
function bakeOverlays() {
  let g, gr;
  [VIG, g] = mk(W, H);
  gr = g.createRadialGradient(W * 0.5, H * 0.46, H * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // warm top left to cool bottom right
  [GRADE, g] = mk(W, H);
  gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, 'rgba(255,186,120,1)');
  gr.addColorStop(0.45, 'rgba(128,128,128,1)');
  gr.addColorStop(1, 'rgba(70,96,150,1)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // warm sun haze from above the top edge
  [HAZE, g] = mk(W, H);
  gr = g.createRadialGradient(W * 0.47, -60, 10, W * 0.47, -60, Math.max(330, W * 0.52));
  gr.addColorStop(0, 'rgba(255,196,130,0.16)');
  gr.addColorStop(1, 'rgba(255,196,130,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  // thermal: sensor noise and faint scan lines
  [GRAIN, g] = mk(W + 64, H + 64);
  const rg = mulberry(9);
  for (let i = 0; i < (W + 64) * (H + 64) * 0.18; i++) {
    g.fillStyle = rg() < 0.5 ? '#ffffff' : '#000000';
    g.fillRect((rg() * (W + 64)) | 0, (rg() * (H + 64)) | 0, 1, 1);
  }
  [SCAN, g] = mk(W, H);
  g.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
}

// ---------- what is in view
// DL = everything standing, sorted by depth (k: the ground y of its front, or just in front of the
// car for the dead holding on to the train). CARS = the train's cars as draw-list entries.
const DL = [], TREES = [], VZ = [], FIRES = [], CARS = [];
const byK = (a, b) => a.k - b.k;
// Collect the props (from the chunk plans and the safe zone), the train and the living dead in
// view, sorted by depth.
function gather(ci0, cj0, ci1, cj1) {
  DL.length = 0;
  TREES.length = 0;
  VZ.length = 0;
  FIRES.length = 0;
  const x0 = G.camX - 8, x1 = G.camX + W + 8, y0 = G.camY - 8, y1 = G.camY + H + 8;
  for (let j = cj0 - 1; j <= cj1 + 1; j++) for (let i = ci0 - 1; i <= ci1 + 1; i++) {
    const pl = plan(i, j);
    for (const p of pl.props) {
      const d = p.d, l = p.x - d.ax, t = p.y - d.ay;
      if (l > x1 || l + d.spr.width < x0 || t > y1 || p.y + 1 < y0) continue;
      DL.push(p);
      if (d.tree) TREES.push(p);
    }
    for (const f of pl.fires) if (f.x > x0 - 30 && f.x < x1 + 30 && f.y > y0 - 30 && f.y < y1 + 30) FIRES.push(f);
  }
  for (const p of G.statics) {
    const d = p.d, l = p.x - d.ax;
    if (l > x1 || l + d.spr.width < x0 || p.y - d.ay > y1 || p.y + 1 < y0) continue;
    DL.push(p);
  }
  for (let i = 0; i < CAR.n; i++) {
    const c = CARS[i] || (CARS[i] = { isCar: true, i, k: 0 }), tc = G.tr.cars[i];
    c.k = tc.k;
    if (tc.cx > x0 - 30 && tc.cx < x1 + 30 && tc.cy > y0 - 30 && tc.cy < y1 + 40) DL.push(c);
  }
  for (const p of G.people) {
    if ((p.st === 'wait' || p.st === 'run' || p.st === 'grab') && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + 10) DL.push(p);
  }
  for (const z of G.zombies) {
    if (z.dead || z.x < x0 - 10 || z.x > x1 + 10 || z.y < y0 || z.y > y1 + 24) continue;
    DL.push(z);
    VZ.push(z);
  }
  DL.sort(byK);
}

// ---------- pieces
function zImg(z) {
  const fr = z.S.walk[(z.anim | 0) & 1];
  if (z.flash > 0) return z.left ? fr.wf : fr.w;
  if (thermal) return z.left ? fr.hf : fr.h;
  return z.left ? fr.nf : fr.n;
}
function drawZombie(z) {
  const S = z.S;
  blit(zImg(z), Math.round(z.x - S.ax), Math.round(z.y - S.ay));
  if (z.big && z.hp < z.max) {
    const w = 14, x = Math.round(z.x - w / 2), y = Math.round(z.y - S.ay - 4);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#3a1210';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#c8432e';
    ctx.fillRect(x, y, Math.max(1, Math.round(w * z.hp / z.max)), 2);
  }
}
// A car of the train, turned to its heading on the rails (red while it takes damage). The
// survivors ride on the flatcar, standing on its deck.
function drawCar(i) {
  const t = TRAIN[i], c = G.tr.cars[i], a = angIdx(c.ang);
  const img = thermal ? t.h[a] : G.tr.hit[i] > 0 ? carRed(t, a) : t.n[a];
  blit(img, Math.round(c.cx) - img.ox, Math.round(c.cy) - img.oy);
  if (i === 2) for (let k = 0; k < RIDERS.length; k++) {
    const [u, al] = RIDERS[k], s = SURV[k], bob = Math.sin(realT * 5 + k * 1.7) > 0.6 ? 1 : 0;
    const x = c.cx + c.dx * al + c.nx * u, y = c.cy + c.dy * al + c.ny * u;
    blit(thermal ? s.h : s.n, Math.round(x) - 2, Math.round(y) - 10 - bob);
  }
}
// The train's shadow: each car's footprint, moved away from the sun by its height.
function drawTrainShadow() {
  for (let i = 0; i < CAR.n; i++) {
    const c = G.tr.cars[i], h = TRAIN[i].tall;
    blit(FOOT[angIdx(c.ang)], Math.round(c.cx + h * SUNX) - 18, Math.round(c.cy + h * SUNY) - 18);
  }
}
// A survivor on foot: waiting by the station house, running for the train (a green marker over
// them), or held by the dead (a red marker, and they shake).
function drawPerson(p) {
  const sv = p.sv, run = p.st === 'run', grab = p.st === 'grab';
  const x = Math.round(p.x) + (grab && Math.sin(realT * 40) > 0 ? 1 : 0), y = Math.round(p.y);
  blit(run ? sv.run[(p.anim | 0) & 1][thermal ? 1 : 0] : thermal ? sv.h : sv.n, x - 2, y - 8);
  if (run || grab) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x - 2, y - 15, 5, 4);
    ctx.fillStyle = thermal ? '#ffffff' : grab ? (Math.sin(realT * 18) > 0 ? '#ff3a2a' : '#a8241a') : '#8fd18a';
    ctx.fillRect(x - 1, y - 14, 3, 1);
    ctx.fillRect(x, y - 13, 1, 1);
  }
}
// The helicopter's shadow on the ground, south-east of the view's middle (the sun is in the
// north-west), lagging a little as it speeds up, with its rotor turning.
function drawHeliShadow() {
  const h = G.heli, alt = CFG.heli.alt;
  const gx = Math.round(G.camX + W / 2 + alt * SUNX - h.vx * 0.08), gy = Math.round(G.camY + H / 2 + alt * SUNY - h.vy * 0.08);
  ctx.globalAlpha = thermal ? 0.2 : 0.3;
  blit(HELI[mod(Math.round(h.hd / TAU * HELI_N), HELI_N)], gx - 20, gy - 20);
  // the faint disc the blades sweep, then the four blades
  ctx.globalAlpha = thermal ? 0.04 : 0.06;
  ctx.fillStyle = '#000';
  const R = 21, ry = Math.round(R * FORE);
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(R * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    ctx.fillRect(gx - hw, gy + dy, hw * 2 + 1, 1);
  }
  ctx.globalAlpha = thermal ? 0.2 : 0.3;
  const a0 = realT * 31;
  for (let k = 0; k < 4; k++) {
    const a = a0 + k * Math.PI / 2;
    pl(ctx, gx, gy, gx + Math.cos(a) * R, gy + Math.sin(a) * R * FORE, '#000');
  }
  ctx.globalAlpha = 1;
}
// Grass tufts that sway a little.
function drawTufts(ci0, cj0, ci1, cj1) {
  for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
    for (const t of plan(i, j).tufts) {
      const sw = Math.round(Math.sin(realT * 1.6 + t.p + t.x * 0.03) * 0.8);
      ctx.fillStyle = t.c;
      ctx.fillRect(t.x, t.y - t.h + 1, 1, t.h);
      ctx.fillRect(t.x - 1 + sw, t.y - t.h, 1, 1);
      ctx.fillRect(t.x + 2, t.y - t.h + 2, 1, t.h - 1);
      ctx.fillRect(t.x + 2 + sw, t.y - t.h + 1, 1, 1);
    }
  }
}
// Bodies in the air: knocked over (fall) or thrown and turning (spin).
function drawBodies() {
  for (const b of G.bodies) {
    const S = b.S;
    if (b.fall) {
      if (b.age < 0.07) blit(S.walk[0].w, Math.round(b.x - S.ax), Math.round(b.y - S.ay - b.z));
      else blit(thermal ? S.deadH : S.dead, Math.round(b.x - S.dax), Math.round(b.y - S.day - b.z));
    } else {
      const img = (thermal ? S.spinH : S.spin)[mod(Math.round(b.rot / (TAU / 4)), 4)];
      blit(img, Math.round(b.x - img.width / 2), Math.round(b.y - b.z - 5 - img.height / 2));
    }
  }
}
// Where a 105 shell will land: a blinking ring that closes on the spot (red when it will hit the
// train too).
function drawShellMarks() {
  for (const r of G.rounds) {
    if (r.kind !== 'he' || !r.player) continue;
    const u = r.age / r.T, rr = lerp(G.k.heKill * 1.5, G.k.heKill, ease(u));
    const col = thermal ? '#ffffff' : trainDist(r.bx, r.by, G.tr.v * (r.T - r.age)) < G.k.heKill - 6 ? '#ff2a1a' : '#ff6a28';
    ctx.globalAlpha = 0.35 + 0.3 * (Math.sin(realT * 22) > 0 ? 1 : 0);
    pell(r.bx, r.by, rr, rr * FORE, col);
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(r.bx) - 1, Math.round(r.by), 3, 1);
    ctx.fillRect(Math.round(r.bx), Math.round(r.by) - 1, 1, 3);
  }
  ctx.globalAlpha = 1;
}
// Rounds in the air. They leave the gunship below the screen and fall into their spot: seen from
// the gun, a round streaks out fast, then shrinks to a point as it drops away (perspective).
const Z0 = 110, ZD = 1250;
const persp = (u) => (1 - u) * Z0 / (Z0 + u * (ZD - Z0));
// the gun's muzzle, below the bottom edge of the screen (25mm right, 105 left), in world px
const muzzleX = (side) => G.camX + W * (side > 0 ? 0.7 : 0.36);
const muzzleY = (side) => G.camY + H + (side > 0 ? 26 : 36);
const TRC = [['#fff1c2', '#ffd27a', '#ff9a3a', '#c9772f'], ['#fff6e0', '#ffd27a', '#ff9a3a', '#e2552f']];
function drawRounds() {
  for (const r of G.rounds) {
    const u = r.age / r.T, he = r.kind === 'he';
    const mx = muzzleX(r.side) + r.j * 8, my = muzzleY(r.side);
    const g1 = persp(u), g0 = persp(Math.max(0, u - (he ? 0.07 : 0.06)));
    const hx = r.bx + (mx - r.bx) * g1, hy = r.by + (my - r.by) * g1;
    const dx = (r.bx + (mx - r.bx) * g0) - hx, dy = (r.by + (my - r.by) * g0) - hy;
    const n = Math.min(160, Math.ceil(Math.hypot(dx, dy))), cols = TRC[he ? 1 : 0];
    for (let i = 1; i <= n; i++) {
      const f = i / n, w = he && f < 0.5 ? 2 : 1;
      ctx.globalAlpha = 1 - f * 0.75;
      ctx.fillStyle = cols[Math.min(3, (f * 4) | 0)];
      // near the camera the streak is wider
      const s = g1 + (g0 - g1) * f > 0.22 ? w + 1 : w;
      ctx.fillRect(Math.round(hx + dx * f), Math.round(hy + dy * f), s, s);
    }
    ctx.globalAlpha = 1;
    const s = he ? (g1 > 0.12 ? 3 : 2) : (g1 > 0.25 ? 2 : 1);
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(Math.round(hx - (s >> 1)), Math.round(hy - (s >> 1)), s, s);
    light(hx, hy, he ? 10 : 5, he ? '#ffd27a' : '#ffb347', he ? 0.7 : 0.45);
  }
  // the gun flashes below the screen edge
  if (G.muzzle[0] > 0) light(muzzleX(1), muzzleY(1) - 10, 46, '#ffc27a', G.muzzle[0] / 0.05 * 0.5);
  if (G.muzzle[1] > 0) light(muzzleX(-1), muzzleY(-1) - 14, 80, '#ffb060', G.muzzle[1] / 0.12 * 0.8);
  ctx.globalAlpha = 1;
}
// Two bands of mist that drift over the field (they belong to the ground and move with it).
function drawMist() {
  const k0 = Math.floor((G.camY - 48) / 300), k1 = Math.floor((G.camY + H) / 300), mw = MIST.width;
  for (let k = k0; k <= k1; k++) {
    const y = k * 300 + 80, odd = k & 1;
    const off = mod(k * 217 + realT * (odd ? 3 : -2), mw);
    ctx.globalAlpha = odd ? 0.09 : 0.06;
    for (let x = Math.floor((G.camX - off) / mw) * mw + off; x < G.camX + W; x += mw) ctx.drawImage(MIST, Math.round(x), y);
  }
  ctx.globalAlpha = 1;
}
// Cloud shadows that slide over the field.
function drawClouds() {
  const dx = realT * 5, CW = 520, CL = 380;
  const i0 = Math.floor((G.camX - dx) / CW) - 1, i1 = Math.floor((G.camX + W - dx) / CW);
  const j0 = Math.floor(G.camY / CL) - 1, j1 = Math.floor((G.camY + H) / CL);
  ctx.globalAlpha = 0.13;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (hrnd(i, j, 77) < 0.3) continue;
    const s = CLOUDSPR[hrnd(i, j, 78) < 0.5 ? 0 : 1];
    ctx.drawImage(s, Math.round(i * CW + dx + hrnd(i, j, 79) * (CW - s.width)), Math.round(j * CL + hrnd(i, j, 80) * (CL - s.height)));
  }
  ctx.globalAlpha = 1;
}

// ---------- the frame (world layer)
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#060708';
  ctx.fillRect(0, 0, W, H);
  const [sx, sy] = shakeOff();
  const ci0 = Math.floor((G.camX - 8) / CH), ci1 = Math.floor((G.camX + W + 8) / CH);
  const cj0 = Math.floor((G.camY - 8) / CH), cj1 = Math.floor((G.camY + H + 8) / CH);
  // the ground in view is baked now; one more chunk round it per frame, before it is needed
  for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) groundChunk(i, j, true);
  bakeSome(ci0, cj0, ci1, cj1, 1);
  gather(ci0, cj0, ci1, cj1);
  ctx.save();
  ctx.translate(sx - G.camX, sy - G.camY);
  for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
    ctx.drawImage(GROUND.get(ckey(i, j)), i * CH, j * CH);
    const d = DECALS.get(ckey(i, j));
    if (d) ctx.drawImage(d.c, i * CH, j * CH);
  }
  // the thermal camera sees the ground cooler than anything alive
  if (thermal) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(G.camX - 8, G.camY - 8, W + 16, H + 16);
  }
  drawTufts(ci0, cj0, ci1, cj1);
  drawShellMarks();
  // shadows of the dead, and of bodies in the air
  ctx.globalAlpha = thermal ? 0.2 : 0.32;
  for (const z of VZ) {
    const S = z.S, fr = S.walk[(z.anim | 0) & 1];
    blit(z.left ? fr.sf : fr.s, Math.round(z.x - S.ax), Math.round(z.y - 1 - S.shp));
  }
  drawTrainShadow();
  ctx.globalAlpha = 0.25;
  for (const b of G.bodies) blit(BODYSH, Math.round(b.x - 4), Math.round(b.y - 2));
  ctx.globalAlpha = 1;
  drawHeliShadow();
  // trees, props, the train and the dead, back to front. A tree under the sight fades so you can
  // see past it.
  const ax = G.camX + G.aimSX, ay = G.camY + G.aimSY, aiming = mode === 'play';
  for (const o of DL) {
    if (o.isCar) {
      drawCar(o.i);
      continue;
    }
    if (o.person) {
      drawPerson(o);
      continue;
    }
    if (o.S) {
      drawZombie(o);
      continue;
    }
    const d = o.d;
    if (aiming && d.tree && Math.abs(o.x - ax) < d.spr.width / 2 + 10 && ay > o.y - d.spr.height - 10 && ay < o.y + 6) {
      ctx.globalAlpha = 0.4;
      blit(d.spr, o.x - d.ax, o.y - d.ay);
      ctx.globalAlpha = 1;
    } else blit(d.spr, o.x - d.ax, o.y - d.ay);
  }
  // the dead behind a tree show through it, faintly
  if (TREES.length) {
    ctx.globalAlpha = thermal ? 0.6 : 0.45;
    for (const z of VZ) {
      const S = z.S, zl = z.x - S.ax, zt = z.y - S.ay, zw = S.walk[0].n.width;
      for (const t of TREES) {
        if (t.y <= z.y) continue;
        const d = t.d, tl = t.x - d.ax;
        if (zl + zw <= tl || zl >= tl + d.spr.width || zt >= t.y || z.y < t.y - d.ay) continue;
        blit(zImg(z), Math.round(zl), Math.round(zt));
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
  // fires, smoke and dirt, explosions, flying bodies
  for (const f of FIRES) drawFlame(f.x, f.y, f.big, f.seed);
  for (const f of flames) drawFlame(f.x, f.y, false, f.seed);
  drawParts(false);
  drawBooms();
  drawBodies();
  // glows (added light)
  ctx.globalCompositeOperation = 'lighter';
  drawLights();
  for (const f of FIRES) light(f.x, f.y - (f.big ? 6 : 3), f.big ? 30 : 18, '#ff9a4a', 0.45 + Math.sin(realT * 13 + f.seed) * 0.08);
  for (const f of flames) light(f.x, f.y - 2, 10, '#ff8a3a', 0.35 * Math.min(1, f.life));
  // the train's headlights, and their beam on the rails ahead (it follows the bends)
  if (G.result !== 'lost') {
    const tr = G.tr, c = tr.cars[0];
    light(c.x0 - c.nx * 4, c.y0 - c.ny * 4 - 7, 6, '#fff1c2', 0.8);
    light(c.x0 + c.nx * 3, c.y0 + c.ny * 3 - 7, 6, '#fff1c2', 0.8);
    for (const [ds, r, a] of [[24, 22, 0.3], [56, 30, 0.16]]) {
      const y = yAtS(tr.s - ds, tr.fy - ds);
      light(trackX(y), y, r, '#ffe2a0', a);
    }
  }
  // station lamps
  for (const p of G.statics) if (p.lamp && Math.abs(p.y - G.camY - H / 2) < H) light(p.x, p.y - 17, 16, '#ffe2a0', 0.45);
  // the searchlights of the safe zone sweep the ground in front of the wall
  for (const p of G.statics) if (p.tower && Math.abs(p.y - (G.camY + H / 2)) < H) {
    light(p.x + 5, p.y - 26, 5, '#fff1c2', 0.9);
    light(p.x + Math.sin(realT * 0.7 + p.tower) * 70, p.y + 46 + Math.cos(realT * 0.9 + p.tower * 2) * 18, 28, '#fff1c2', 0.22);
  }
  ctx.globalAlpha = 1;
  drawRings();
  drawParts(true);
  drawRounds();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (!thermal) {
    drawMist();
    drawClouds();
  }
  // the names of the safe zone (past the gate) and of the station, over everything on the ground
  if (G.goalY > G.camY - 80 && G.goalY < G.camY + H + 80) text('SAFE ZONE', trackX(G.goalY) + 96, G.goalY - 30, '#8fd18a', { align: 'center', scale: 2 });
  const hs = G.station && G.station.house;
  if (hs && Math.abs(hs.y - G.camY - H / 2) < H) text('STATION', hs.x, hs.y - 36, '#9fd3f2', { align: 'center' });
  drawTexts();
  ctx.restore();
  // the camera's look over everything
  if (!thermal) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(HAZE, 0, 0);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(GRADE, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(VIG, 0, 0);
  } else {
    // grey (the color's saturation taken out), turned over for black hot, then grain and lines
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    if (thermal === 2) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.06;
    ctx.drawImage(GRAIN, -((Math.random() * 64) | 0), -((Math.random() * 64) | 0));
    ctx.globalAlpha = 1;
    ctx.drawImage(SCAN, 0, 0);
    ctx.drawImage(VIG, 0, 0);
  }
}
