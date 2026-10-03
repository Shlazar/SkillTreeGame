// render.js - draws one frame of the world: the baked ground and its marks, the helicopters' shadows
// and the other shadows, then trees, props, the train, the station, the safe zone, survivors and
// the dead sorted by depth (the dead behind a tree show through it), fires, particles, explosions,
// flying bodies, the helicopters (helis.js), tracers and glows (headlights, lamps, searchlights),
// then a light vignette (clear daylight), or the thermal camera look (grey, hot things white).

let VIG = null, SCAN = null, GRAIN = null, BODYSH = null;
// Made once: the shadow under a flying body.
function bakeStatic() {
  BODYSH = shadowSpr(9);
}
// Made again for every size of the picture: a light vignette (only its edges are ever drawn, see
// drawVignette), thermal grain and lines.
function bakeOverlays() {
  let g, gr;
  [VIG, g] = mk(W, H);
  g.setTransform(1, 0, 0, H / W, 0, 0);
  gr = g.createRadialGradient(W * 0.5, W * 0.5, W * 0.38, W * 0.5, W * 0.5, W * 0.62);
  gr.addColorStop(0, 'rgba(10,20,12,0)');
  gr.addColorStop(1, 'rgba(10,20,12,0.3)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, W);
  g.setTransform(1, 0, 0, 1, 0, 0);
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
  // the dead: a crowd in the open is drawn in one go (drawHorde), the rest sorted in here (horde.js)
  gatherHorde(x0, x1, y0, y1);
  DL.sort(byK);
}

// ---------- pieces
function zImg(z) {
  const fr = z.S.walk[(z.anim | 0) & 3];
  if (z.flash > 0) return z.left ? fr.wf : fr.w;
  if (thermal) return z.left ? fr.hf : fr.h;
  return z.left ? fr.nf : fr.n;
}
function drawZombie(z) {
  const S = z.S;
  if (z.gold && drawGold(z)) return;
  ctx.drawImage(zImg(z), Math.round(z.x - S.ax), Math.round(z.y - S.ay));
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
// survivors ride on the flatcar, standing on its deck; with the flatcar gun, it stands at the front
// and two of them stay at the back. While the Turbo Ram runs the engine glows orange.
function drawCar(i) {
  if (i) drawCoupler(i);
  const t = TRAIN[i], c = G.tr.cars[i], a = angIdx(c.ang);
  const img = thermal ? t.h[a] : G.tr.hit[i] > 0 ? carRed(t, a) : t.n[a], x0 = Math.round(c.cx) - img.ox, y0 = Math.round(c.cy) - img.oy;
  blit(img, x0, y0);
  if (i === 0) drawEngineKit(c);
  if (i === 0 && G.ram.on && !thermal) {
    ctx.globalAlpha = ramK() * (0.3 + 0.08 * Math.sin(realT * 18));
    blit(carGlow(t, a), x0, y0);
    ctx.globalAlpha = 1;
  }
  if (i !== 2) return;
  const gun = G.up.gun > 0, R = gun ? RIDERS_GUN : RIDERS;
  if (gun) drawCannon();
  for (let k = 0; k < R.length; k++) {
    const [u, al] = R[k], s = SURV[k], bob = Math.sin(realT * 5 + k * 1.7) > 0.6 ? 1 : 0;
    const x = c.cx + c.dx * al + c.nx * u, y = c.cy + c.dy * al + c.ny * u;
    blit(thermal ? s.h : s.n, Math.round(x) - 2, Math.round(y) - 10 - bob);
  }
}
// The deck's height over the rails (the rail cannon stands on it).
const DECK = 3;
// The train's shadow: each car's footprint, moved away from the sun by its height.
function drawTrainShadow() {
  for (let i = 0; i < CAR.n; i++) {
    const c = G.tr.cars[i];
    blit(TRAIN[i].foot[angIdx(c.ang)], Math.round(c.cx) - 18, Math.round(c.cy) - 18);
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
// Bodies in the air: knocked over (fall) or thrown and turning (spin).
function drawBodies() {
  for (const b of G.bodies) {
    const S = b.S;
    if (b.fall) {
      if (b.age < 0.07) blit(S.walk[0].w, Math.round(b.x - S.ax), Math.round(b.y - S.ay - b.z));
      else if (b.age < 0.16 && !thermal) blit(S.tilt, Math.round(b.x - S.tilt.width / 2), Math.round(b.y - S.tilt.height * 0.7 - b.z));
      else blit(thermal ? S.deadH : S.dead, Math.round(b.x - S.dax), Math.round(b.y - S.day - b.z));
    } else {
      const n = S.spin.length, img = (thermal ? S.spinH : S.spin)[mod(Math.round(b.rot / (TAU / n)), n)];
      blit(img, Math.round(b.x - img.width / 2), Math.round(b.y - b.z - 5 - img.height / 2));
    }
  }
}
// Where a 105 shell will land: a blinking ring that closes on the spot (red when it will hit the
// train too).
function drawShellMarks() {
  for (const r of G.rounds) {
    if (r.kind !== 'he' || !r.player) continue;
    const u = r.age / r.T, rr = lerp(CFG.he.kill * 1.5, CFG.he.kill, ease(u));
    const col = thermal ? '#ffffff' : trainDist(r.bx, r.by, G.tr.v * (r.T - r.age)) < CFG.he.close ? '#ff2a1a' : '#ff6a28';
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
    if (r.h) {
      drawHeliRound(r);
      continue;
    }
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
// While the Turbo Ram runs: its kills so far beside the engine's nose (white for a moment at each one;
// amber from 15, red from 30, the counts of its ranks).
function drawRamCount() {
  const r = G.ram;
  if (!r.on || !r.kills || G.demo) return;
  const c = G.tr.cars[0], n = r.kills, col = realT - r.killT < 0.07 ? '#ffffff' : n >= 30 ? '#ff7a4a' : n >= 15 ? U.amber : U.gold;
  text('×' + n, c.x0 + 13, c.y0 - 10, col, { scale: 2, drop: true });
}
// The vignette: only the bands along the edges where it is not clear (the middle is skipped).
function drawVignette() {
  const bx = Math.round(W * 0.14), by = Math.round(H * 0.16);
  ctx.drawImage(VIG, 0, 0, W, by, 0, 0, W, by);
  ctx.drawImage(VIG, 0, H - by, W, by, 0, H - by, W, by);
  ctx.drawImage(VIG, 0, by, bx, H - 2 * by, 0, by, bx, H - 2 * by);
  ctx.drawImage(VIG, W - bx, by, bx, H - 2 * by, W - bx, by, bx, H - 2 * by);
}

// ---------- the frame (world layer)
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#060708';
  ctx.fillRect(0, 0, W, H);
  // (the skill tree covers the whole world: nothing to draw under it)
  if (treeCovers()) return;
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
  drawGroundLife();
  drawShellMarks();
  drawHorde(sx, sy);
  // shadows of the dead, and of bodies in the air
  ctx.globalAlpha = thermal ? 0.2 : 0.32;
  for (const z of VZ) {
    const S = z.S, fr = S.walk[(z.anim | 0) & 3];
    ctx.drawImage(fr.s, Math.round(z.x - S.ax), Math.round(z.y - 1 - S.shp));
  }
  drawTrainShadow();
  ctx.globalAlpha = 0.25;
  for (const b of G.bodies) blit(BODYSH, Math.round(b.x - 4), Math.round(b.y - 2));
  ctx.globalAlpha = 1;
  drawHeliGround();
  drawPlaneShadows();
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
  // the dead standing in front of everything near them (horde.js)
  drawHordeTop(sx, sy);
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
  drawJuice();
  drawHelis();
  // glows (added light)
  ctx.globalCompositeOperation = 'lighter';
  drawLights();
  for (const f of FIRES) light(f.x, f.y - (f.big ? 6 : 3), f.big ? 22 : 14, '#ff9a4a', 0.45 + Math.sin(realT * 13 + f.seed) * 0.08);
  // the train's headlights (in daylight their beam on the rails ahead only shows while the Turbo
  // Ram runs: bigger lights, beams that follow the bends, and the engine glows orange)
  if (G.result !== 'lost') {
    const tr = G.tr, c = tr.cars[0], k = ramK(), hr = 6 + 4 * k;
    light(c.x0 - c.nx * 4, c.y0 - c.ny * 4 - 7, hr, '#fff1c2', 0.8);
    light(c.x0 + c.nx * 3, c.y0 + c.ny * 3 - 7, hr, '#fff1c2', 0.8);
    if (k > 0) for (const [ds, r, a] of [[24, 22, 0.3 * k], [56, 30, 0.18 * k], [90, 34, 0.16 * k]]) {
      const y = yAtS(tr.s - ds, tr.fy - ds);
      light(trackX(y), y, r, '#ffe2a0', a);
    }
    if (k > 0 && !thermal) light(c.cx, c.cy - 6, 24, '#ff8a3a', 0.2 * k + 0.05 * Math.sin(realT * 18));
  }
  // station lamps (lit by day, just a glint)
  for (const p of G.statics) if (p.lamp && Math.abs(p.y - G.camY - H / 2) < H) light(p.x, p.y - 17, 5, '#ffe2a0', 0.6);
  // the searchlights of the safe zone sweep the ground in front of the wall
  for (const p of G.statics) if (p.tower && Math.abs(p.y - (G.camY + H / 2)) < H) {
    light(p.x + 5, p.y - 26, 5, '#fff1c2', 0.9);
    light(p.x + Math.sin(realT * 0.7 + p.tower) * 70, p.y + 46 + Math.cos(realT * 0.9 + p.tower * 2) * 18, 28, '#fff1c2', 0.22);
  }
  ctx.globalAlpha = 1;
  drawRings();
  drawParts(true);
  drawRounds();
  drawHeliFx();
  drawCannonFx();
  drawZaps();
  drawTowerFx();
  drawJuiceTop();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawSky();
  // the names of the safe zone (past the gate), the Depot and the stations, over everything on the ground
  if (G.goalY > G.camY - 80 && G.goalY < G.camY + H + 80) text('SAFE ZONE', trackX(G.goalY) + 96, G.goalY - 30, '#8fd18a', { align: 'center', scale: 2 });
  for (const st of G.stops) {
    const hs = st.house;
    if (Math.abs(hs.y - G.camY - H / 2) < H) text(st.name, hs.x, hs.y - 36, st.id === 'depot' ? U.gold : U.blue, { align: 'center' });
  }
  drawLoot();
  drawHeliTop();
  drawPlanes();
  drawTexts();
  drawRamCount();
  ctx.restore();
  // the camera's look over everything
  if (!thermal) drawVignette();
  else {
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
