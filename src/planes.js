// planes.js - the STRAFING RUN: an attack jet you call in. Press Q (or click its card), then click
// the map: the jet comes in low across the screen through that point, along the rails (drag before
// you let go to aim it any way you like). Its big nose gun rakes a line of ground ahead of it: a row
// of bright hits and blasts that kills the dead in a band, and with BOMB RUN it drops three bombs at
// the end. G.up.strafe = runs per run (0 = locked), strafeW = half the band's width (px), strafeD =
// damage a hit, strafeBomb = bombs, twin = a second jet beside it.

// speed = px/s, alt = height (px) as it comes in, dive = px lower while it fires, len = px of
// ground it strafes, lead = px ahead of the jet its rounds land, step = px between two hits you see
// (a puff of fire every 3rd, a big blast every 8th), half / dmg = the band and the damage before upgrades, bombR = px
// a bomb kills round it
const JETC = { speed: 320, alt: 46, dive: 12, len: 230, lead: 44, step: 4, half: 13, dmg: 3, bombR: 34, N: 32 };

// ---------- the jet
// A twin-engine attack jet seen from right above, its nose up: straight wings with bombs under
// them, engines on the back of the body, a wide tail with a fin at each end.
const JET = { n: [], sh: [], icon: null, bomb: null };
function jetRaw() {
  return pix(62, 54, (r) => {
    const L = '#c3cad0', A = '#a1a9b1', B = '#848d96', D = '#636b74', E = '#454b53', K = '#18191c';
    // bombs under the wings (their noses show in front of the wing)
    for (const x of [9, 15, 45, 51]) {
      r(x - 1, 14, 2, 6, '#58603f');
      r(x - 1, 14, 1, 6, '#737c58');
      r(x - 1, 13, 2, 1, '#2d3036');
    }
    // the wings: a lit leading edge, darker towards the back, flaps, dark tips, the marks near them
    r(3, 19, 56, 1, L);
    r(2, 20, 58, 4, A);
    r(2, 24, 58, 1, B);
    r(2, 25, 58, 1, D);
    r(3, 26, 56, 1, E);
    for (const x of [8, 40]) r(x, 25, 14, 1, E);
    r(0, 20, 3, 6, D);
    r(59, 20, 3, 6, D);
    r(0, 20, 3, 1, B);
    r(59, 20, 3, 1, B);
    for (const x of [7, 52]) {
      r(x, 21, 3, 3, '#2c3a5a');
      r(x + 1, 22, 1, 1, '#e8e2cc');
    }
    // the tail plane and the two fins at its ends
    r(16, 44, 30, 1, L);
    r(16, 45, 30, 2, B);
    r(16, 47, 30, 1, D);
    for (const x of [14, 45]) {
      r(x, 40, 3, 13, D);
      r(x, 40, 1, 13, A);
      r(x, 40, 3, 1, L);
      r(x + 1, 52, 1, 1, '#c8432e');
    }
    // the body: lit on its left side, a dark nose with the big gun
    r(28, 4, 6, 48, B);
    r(28, 4, 1, 48, L);
    r(29, 4, 2, 48, A);
    r(33, 4, 1, 48, D);
    r(29, 1, 4, 3, D);
    r(29, 1, 1, 3, B);
    r(30, 0, 2, 2, K);
    r(30, 52, 2, 2, E);
    // the canopy, its frame and a glint
    r(28, 8, 6, 7, '#22384a');
    r(29, 9, 1, 3, '#c4ecf8');
    r(30, 9, 1, 1, '#c4ecf8');
    r(28, 12, 6, 1, D);
    // the engines on pylons: round pods, a dark intake in front, the exhaust behind
    for (const x of [19, 36]) {
      r(x, 29, 7, 11, B);
      r(x, 29, 1, 11, L);
      r(x + 1, 29, 2, 11, A);
      r(x + 6, 29, 1, 11, E);
      r(x, 29, 7, 1, K);
      r(x + 1, 30, 5, 1, E);
      r(x + 2, 30, 3, 1, '#2a2d33');
      r(x + 1, 40, 5, 1, '#2a2420');
    }
    r(26, 32, 2, 2, D);
    r(34, 32, 2, 2, D);
  });
}
// Build the jet at JETC.N headings (0 = nose up, clockwise), its shadow and its card icon. At startup.
function bakeJet() {
  const raw = jetRaw();
  JET.n.length = JET.sh.length = 0;
  for (let i = 0; i < JETC.N; i++) {
    const r = rotA(raw, i / JETC.N * TAU);
    JET.n.push(selOut(r));
    JET.sh.push(tint(r, '#000', 1, 'source-in'));
  }
  JET.bomb = outline(pix(3, 6, (r) => {
    r(0, 0, 3, 5, '#565c46');
    r(0, 0, 1, 5, '#7a8262');
    r(0, 5, 3, 1, '#2d3036');
  }), P.out);
  for (const c of [...JET.n, ...JET.sh, JET.bomb]) atl(c);
}
bakeJet();

// ---------- this run's strafing runs
// STRAF = g: the run it is for, left: runs still to use, arm: waiting for a click on the map, aim:
// where the press was (a drag aims), jets, bombs, embers = the holes that still glow, card = its card,
// msg = a short line over the card.
const STRAF = { g: null, left: 0, arm: false, aim: null, jets: [], bombs: [], embers: [], card: { x: 0, y: 0, w: 96, h: 26, on: false }, msg: null };
// A new run: it starts with all its runs, nothing in the air.
function srSync() {
  if (STRAF.g === G) return;
  STRAF.g = G;
  STRAF.left = G.up.strafe || 0;
  STRAF.arm = false;
  STRAF.aim = null;
  STRAF.jets.length = STRAF.bombs.length = STRAF.embers.length = 0;
  STRAF.msg = null;
}
// Q or a click on the card: get ready to pick a spot (again: put it away). True when it is ready.
function tryStrafe() {
  srSync();
  if (!G.up.strafe || G.result || mode !== 'play') return false;
  if (STRAF.arm) {
    strafeCancel();
    return false;
  }
  if (STRAF.left <= 0) {
    STRAF.msg = { t: realT, s: 'NO STRAFING RUNS LEFT THIS RUN.' };
    SFX.deny();
    return false;
  }
  STRAF.arm = true;
  HUI.arm = false;
  SFX.ui();
  return true;
}
function strafeCancel() {
  if (!STRAF.arm) return false;
  STRAF.arm = false;
  STRAF.aim = null;
  SFX.ui();
  return true;
}
// Left button down at screen (x, y): the card, or the spot when it is ready. True when used here.
function strafeDown(x, y) {
  srSync();
  const C = STRAF.card;
  if (C.on && inR(x, y, C.x, C.y, C.w, C.h)) {
    tryStrafe();
    return true;
  }
  if (STRAF.arm && y >= 19) {
    STRAF.aim = { x, y };
    return true;
  }
  return false;
}
// Left button up: the jet is called in through where the press was, along the drag (or the rails).
function strafeUp(x, y) {
  const a = STRAF.aim;
  if (!a) return false;
  STRAF.aim = null;
  STRAF.arm = false;
  const [ux, uy] = strafeDir(a.x, a.y, x, y);
  callStrafe(G.camX + a.x, G.camY + a.y, ux, uy);
  return true;
}
// The way the jet flies for a press at (ax, ay) let go at (bx, by): the drag, or the train's way.
function strafeDir(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  if (d >= 12) return [dx / d, dy / d];
  const c = G.tr.cars[0];
  return [c.dx, c.dy];
}
// Send the jet (two with TWIN JETS) through world point (px, py) flying along (ux, uy).
function callStrafe(px, py, ux, uy) {
  srSync();
  if (STRAF.left <= 0 && !G.demo) return false;
  if (!G.demo) STRAF.left--;
  // it comes in from just off the screen, and flies on until it is off the other side
  const half = G.up.strafeW || JETC.half, offs = G.up.twin ? [-(half + 2), half + 2] : [0];
  const back = Math.max(jetEdge(px, py, -ux, -uy) + 40, JETC.len / 2 + JETC.lead + 20), on = jetEdge(px, py, ux, uy) + 60;
  offs.forEach((o, i) => STRAF.jets.push({ px, py, ux, uy, o, s: -back - i * 26, end: Math.max(on, JETC.len / 2 + 40),
    front: -Infinity, half, dmg: G.up.strafeD || JETC.dmg, bomb: !!G.up.strafeBomb, dropped: false, fired: false, step: 0, blast: 0,
    smoke: 0, alt: JETC.alt }));
  if (!G.demo) STRAF.msg = { t: realT, s: G.up.twin ? 'TWO JETS INBOUND!' : 'JET INBOUND!' };
  return true;
}

// px from world point (x, y) along (ux, uy) to the edge of the view (the jet's sprite is half off it there)
function jetEdge(x, y, ux, uy) {
  let t = 2000;
  const x0 = G.camX - 30, y0 = G.camY - 30, x1 = G.camX + W + 30, y1 = G.camY + H + 30;
  if (ux > 1e-6) t = Math.min(t, (x1 - x) / ux); else if (ux < -1e-6) t = Math.min(t, (x0 - x) / ux);
  if (uy > 1e-6) t = Math.min(t, (y1 - y + 60) / uy); else if (uy < -1e-6) t = Math.min(t, (y0 - y - 60) / uy);
  return Math.max(0, t);
}

// ---------- each step
function updatePlanes(dt) {
  srSync();
  // the demo behind the title shows it off now and then, through a crowd near the train
  if (G.demo && mode === 'title') {
    STRAF.demoT = (STRAF.demoT ?? 6) - dt;
    if (STRAF.demoT <= 0 && !STRAF.jets.length) {
      STRAF.demoT = 16;
      // the thickest crowd on the right of the screen (the title box is on the left)
      let z = null, best = 0;
      for (const q of G.zombies) {
        if (q.dead || offView(q.x, q.y, -40) || q.x - G.camX < W * 0.6) continue;
        let n = 0;
        queryEll(q.x, q.y, 40, () => n++);
        if (n >= best) [z, best] = [q, n];
      }
      if (z) {
        const c = G.tr.cars[0];
        callStrafe(z.x, z.y, c.dx, c.dy);
      }
    }
  }
  for (let i = STRAF.jets.length - 1; i >= 0; i--) {
    const j = STRAF.jets[i];
    j.s += JETC.speed * dt;
    // lower while it fires
    const mid = Math.abs(j.s + JETC.lead - 0) / (JETC.len * 0.75);
    j.alt = JETC.alt - JETC.dive * Math.max(0, 1 - mid * mid);
    strafeFire(j);
    if (j.bomb && !j.dropped && j.s + JETC.lead >= JETC.len / 2) dropBombs(j);
    // a thin trail from the engines
    j.smoke -= dt;
    if (j.smoke <= 0) {
      j.smoke = 0.05;
      const [gx, gy] = jetGround(j);
      for (const sx of [-8, 8]) part({ x: gx - j.ux * 10 - j.uy * sx, y: gy - j.uy * 10 + j.ux * sx, z: j.alt + 2, vx: 0, vy: 0, vz: 0, g: 0,
        life: 0.5, max: 0.5, s: 1, c: 'rgba(210,214,220,0.35)', grow: 3, drag: 1, smoke: true });
    }
    if (j.s > j.end) STRAF.jets.splice(i, 1);
  }
  for (let i = STRAF.bombs.length - 1; i >= 0; i--) {
    const b = STRAF.bombs[i];
    b.t += dt;
    if (b.t >= b.T) {
      bombHit(b.x1, b.y1);
      STRAF.bombs.splice(i, 1);
    }
  }
  for (const j of STRAF.jets) if (j.last) j.last.t += dt;
  // the holes cool down (newest last, so the old ones go from the front)
  for (const e of STRAF.embers) e.t += dt;
  let n = 0;
  while (n < STRAF.embers.length && STRAF.embers[n].t > 1.6) n++;
  if (n) STRAF.embers.splice(0, n);
}
// Where jet j is over the ground.
function jetGround(j) {
  return [j.px + j.ux * j.s - j.uy * j.o, j.py + j.uy * j.s + j.ux * j.o];
}
// The gun: its rounds land JETC.lead px ahead of the jet. Every zombie in the band the hits swept over
// since the last step takes the hit; a hit flashes every JETC.step px, a blast every JETC.blast px.
function strafeFire(j) {
  const L = JETC.len / 2, a = Math.min(j.s + JETC.lead, L), a0 = Math.max(j.front, -L);
  j.front = Math.max(j.front, j.s + JETC.lead);
  if (a <= a0 || a < -L) return;
  if (!j.fired) {
    j.fired = true;
    if (!G.demo) addShake(0.3);
  }
  // the line's points: c = middle of what was swept, (ux, uy) along, (nx, ny) across
  const ux = j.ux, uy = j.uy, nx = -uy, ny = ux;
  const ox = j.px + nx * j.o, oy = j.py + ny * j.o, cm = (a0 + a) / 2;
  const cx = ox + ux * cm, cy = oy + uy * cm, R = ((a - a0) / 2 + j.half + 4) / FORE;
  const hit = [];
  queryEll(cx, cy, R, (z) => {
    const dx = z.x - ox, dy = z.y - oy, t = dx * ux + dy * uy, u = dx * nx + dy * ny;
    if (t >= a0 && t < a && Math.abs(u) <= j.half + (z.big ? 2 : 0)) hit.push(z);
  });
  for (const z of hit) {
    const ix = ox + ux * ((z.x - ox) * ux + (z.y - oy) * uy), iy = oy + uy * ((z.x - ox) * ux + (z.y - oy) * uy);
    if (z.hp <= j.dmg) kill(z, 'he', ix, iy, rnd(8, 20));
    else {
      JUICE.from = [ix, iy];
      hitZombie(z, j.dmg, 'strafe');
    }
  }
  // what you see: hits scattered across the band, puffs of fire and bigger blasts along it
  for (let s = Math.ceil(a0 / JETC.step) * JETC.step; s < a; s += JETC.step) {
    const u = rnd(-j.half, j.half), x = ox + ux * s + nx * u, y = oy + uy * s + ny * u;
    strafeHit(j, x, y);
    const k = Math.round(s / JETC.step);
    if (k % 3 === 0) {
      const v = rnd(-0.7, 0.7) * j.half;
      const bx = ox + ux * s + nx * v, by = oy + uy * s + ny * v;
      addBoom(bx, by, rnd(7, 9.5), 4, 0.6, 5);
      part({ x: bx, y: by, z: 3, vx: rnd(-6, 6), vy: rnd(-5, 3), vz: rnd(6, 14), g: 0, life: rnd(1.4, 2.2), max: 2.2, s: 3,
        c: pick(['rgba(70,64,58,0.5)', 'rgba(96,88,78,0.45)', 'rgba(52,48,44,0.55)']), grow: 6, drag: 1.4, smoke: true });
    }
    if (k % 8 === 0) strafeBlast(ox + ux * s + nx * rnd(-0.4, 0.4) * j.half, oy + uy * s + ny * rnd(-0.4, 0.4) * j.half);
  }
}
// A big blast on the line: a fat fireball, a flash of light, a white ring, a burnt crater.
function strafeBlast(x, y) {
  addBoom(x, y - 1, rnd(13, 17), 7, 0.8, 8);
  lights.push({ x, y, z: 4, r: rnd(44, 56), c: '#ffb060', life: 0.3, max: 0.3, a: 0.7 });
  rings.push({ x, y, r0: 4, r1: 26, t: 0, T: 0.22, c: '#fff1c2', w: 2 });
  for (let i = 0; i < 6; i++) {
    const a = rnd(TAU), v = rnd(40, 90);
    part({ x, y, z: 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * FORE, vz: rnd(30, 80), g: 200, life: rnd(0.3, 0.5), max: 0.5, s: 1,
      c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 1.5 });
  }
  stampScorch(x, y, 1);
  if (!G.demo) {
    addShake(0.08);
    if (Math.random() < 0.5) SFX.boom();
  }
}
// One round landing at (x, y): a white-hot flash, sparks, dirt thrown up, a hole that glows for a
// moment, a tracer from the jet.
function strafeHit(j, x, y) {
  j.n = (j.n || 0) + 1;
  if (j.n & 1) lights.push({ x, y, z: 2, r: rnd(14, 20), c: '#ffd27a', life: 0.14, max: 0.14, a: 0.85 });
  part({ x, y, z: 2, vx: rnd(-40, 40) + j.ux * 40, vy: rnd(-30, 30) + j.uy * 40, vz: rnd(20, 60), g: 160,
    life: rnd(0.15, 0.3), max: 0.3, s: 1, c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 2 });
  if (Math.random() < 0.5) part({ x, y, z: 1, vx: rnd(-10, 10), vy: rnd(-8, 4), vz: rnd(10, 25), g: 0, life: rnd(0.6, 1.1), max: 1.1, s: 2,
    c: pick(['rgba(150,128,96,0.55)', 'rgba(124,106,80,0.55)', 'rgba(96,82,62,0.6)']), grow: 5, drag: 2.5, smoke: true });
  part({ x, y, z: 1, vx: rnd(-25, 25), vy: rnd(-20, 20), vz: rnd(30, 70), g: 240, life: 1, max: 1, s: 1,
    c: pick(['#3a2e22', '#4f3f2d', '#2a221a']), land: 1 });
  stampScorch(x, y, 0);
  if (j.n & 1 && STRAF.embers.length < 200) STRAF.embers.push({ x: Math.round(x), y: Math.round(y), t: 0 });
  j.last = { x, y, t: 0 };
  if (!G.demo && Math.random() < 0.3) SFX.mg();
}
// BOMB RUN: three bombs leave the jet; they fly on ahead and fall.
function dropBombs(j) {
  j.dropped = true;
  const [gx, gy] = jetGround(j);
  for (let k = 0; k < 3; k++) {
    const d = 34 + k * 24, sd = (k - 1) * 6;
    STRAF.bombs.push({ x0: gx, y0: gy, x1: gx + j.ux * d - j.uy * sd, y1: gy + j.uy * d + j.ux * sd, z0: j.alt, t: -k * 0.08, T: 0.55, a: Math.atan2(j.ux, -j.uy) });
  }
}
// A bomb lands: the big blast, and every zombie near it dies (brutes too).
function bombHit(x, y) {
  juiceBoom(x, y, false);
  addBoom(x, y - 2, 24, 8, 0.9, 11);
  queryEll(x, y, JETC.bombR, (z, d) => kill(z, 'he', x, y, d));
  if (!G.demo) {
    addShake(0.45);
    hitStop(0.04, 0.3);
    SFX.boom();
  }
}

// ---------- drawing (world layer)
// The shadows on the ground (under everything standing), south-east of each jet by its height.
function drawPlaneShadows() {
  if (STRAF.g !== G) return;
  drawEmbers();
  ctx.globalAlpha = thermal ? 0.2 : 0.3;
  for (const j of STRAF.jets) {
    const [gx, gy] = jetGround(j), i = jetIdx(j), sh = JET.sh[i];
    blit(sh, Math.round(gx + j.alt * SUNX - sh.width / 2), Math.round(gy + j.alt * SUNY - sh.height / 2));
  }
  for (const b of STRAF.bombs) {
    if (b.t < 0) continue;
    const u = b.t / b.T, x = lerp(b.x0, b.x1, u), y = lerp(b.y0, b.y1, u);
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(x - 1), Math.round(y), 3, 2);
  }
  ctx.globalAlpha = 1;
}
// The holes the rounds dug glow white, then orange, then dull red as they cool.
function drawEmbers() {
  if (!STRAF.embers.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const e of STRAF.embers) {
    const u = e.t / 1.6;
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.fillStyle = u < 0.12 ? '#fff6e0' : u < 0.35 ? '#ffb347' : u < 0.65 ? '#e2552f' : '#9a3320';
    ctx.fillRect(e.x, e.y, u < 0.35 ? 2 : 1, u < 0.35 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
const jetIdx = (j) => mod(Math.round(Math.atan2(j.ux, -j.uy) / TAU * JETC.N), JETC.N);
// The jets in the air (over the helis), their gun's flash and tracers, and the falling bombs.
function drawPlanes() {
  if (STRAF.g !== G) return;
  if (!STRAF.jets.length && !STRAF.bombs.length) return;
  for (const b of STRAF.bombs) {
    if (b.t < 0) continue;
    const u = b.t / b.T, x = lerp(b.x0, b.x1, u), y = lerp(b.y0, b.y1, u), zz = b.z0 * (1 - u * u);
    blit(JET.bomb, Math.round(x - 2), Math.round(y - zz - 3));
  }
  for (const j of STRAF.jets) {
    const [gx, gy] = jetGround(j), spr = JET.n[jetIdx(j)];
    blit(spr, Math.round(gx - spr.width / 2), Math.round(gy - j.alt - spr.height / 2));
  }
  // the gun: a big flickering flash at the nose, tracers down to where the rounds land
  ctx.globalCompositeOperation = 'lighter';
  for (const j of STRAF.jets) {
    const firing = j.s + JETC.lead > -JETC.len / 2 && j.s + JETC.lead < JETC.len / 2;
    if (!firing) continue;
    const [gx, gy] = jetGround(j), nx = gx + j.ux * 28, ny = gy + j.uy * 28 - j.alt;
    const f = 0.7 + 0.3 * Math.random();
    light(nx, ny, 18 * f, '#ffb060', 0.9);
    light(nx + j.ux * 6, ny + j.uy * 6, 9 * f, '#fff1c2', 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(nx) - 1, Math.round(ny) - 1, 3, 3);
    // the flash's cone, pointing ahead
    ctx.fillStyle = '#ffe2a0';
    for (let k = 2; k < 9; k++) ctx.fillRect(Math.round(nx + j.ux * k + rnd(-1, 1)), Math.round(ny + j.uy * k + rnd(-1, 1)), 2, 2);
  }
  // (one tracer a jet: its newest hit)
  for (const j of STRAF.jets) {
    const h = j.last;
    if (!h || h.t > 0.06) continue;
    const [gx, gy] = jetGround(j);
    ctx.globalAlpha = 0.8 * (1 - h.t / 0.06);
    pl(ctx, Math.round(gx + j.ux * 28), Math.round(gy + j.uy * 28 - j.alt), Math.round(h.x), Math.round(h.y), '#ffd27a');
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- the UI (screen px)
// The STRAFE card, after the Ram's (rx, ry = where that one went; y = the cards' row): Q in gold while
// a run is left, CLICK! while it waits for the map, USED when none are left. The bar = runs left.
function drawStrafeCard(rx, ry, y) {
  srSync();
  const C = STRAF.card;
  C.on = !!G.up.strafe && !G.demo;
  if (!C.on) return;
  let x = RAMCARD.on ? rx + RAMCARD.w + 4 : rx, cy = ry;
  if (x + C.w > W - 82) [x, cy] = ry === y ? [4, y - 30] : [x, ry];
  C.x = x;
  C.y = cy;
  const n = G.up.strafe, flying = STRAF.jets.length > 0;
  const tag = STRAF.arm ? 'CLICK!' : flying ? 'GO!' : STRAF.left ? 'Q' + (STRAF.left > 1 ? ' ×' + STRAF.left : '') : 'USED';
  const tc = STRAF.arm ? (Math.floor(realT * 8) % 2 ? '#ffe39a' : U.amber) : flying ? U.amber : STRAF.left ? U.gold : U.faint;
  card(x, cy, C.w, C.h, NICON.strafe, 'STRAFE', tag, tc, STRAF.left / n, STRAF.left ? '#ff9a3a' : '#3a3e48', STRAF.left || flying ? U.ink : U.faint);
  if (STRAF.arm) frame(x - 1, cy - 1, C.w + 2, C.h + 2, Math.floor(realT * 8) % 2 ? '#ffd36a' : '#b8862f');
  else if (STRAF.left && !flying) frame(x, cy, C.w, C.h, '#b8862f');
  if (mode === 'play' && !paused && inR(M.x, M.y, x, cy, C.w, C.h)) cursor = 'pointer';
  const m = STRAF.msg, mt = m ? realT - m.t : 9;
  if (mt < 2) {
    ctx.globalAlpha = clamp((2 - mt) / 0.4, 0, 1);
    text(m.s, clamp(x, 4, W - tw(m.s) - 4), cy - 10, U.amber);
    ctx.globalAlpha = 1;
  }
  if (STRAF.arm && mode === 'play' && !paused) drawStrafeAim();
}
// While it waits for the map: the band the jet will strafe through the mouse (or from the press
// along the drag), an arrow for its way, and what to do.
function drawStrafeAim() {
  if (!M.inside || M.y < 19 || inR(M.x, M.y, STRAF.card.x, STRAF.card.y, STRAF.card.w, STRAF.card.h)) return;
  cursor = 'crosshair';
  const a = STRAF.aim || { x: M.x, y: M.y }, [ux, uy] = STRAF.aim ? strafeDir(a.x, a.y, M.x, M.y) : strafeDir(a.x, a.y, a.x, a.y);
  const nx = -uy, ny = ux, L = JETC.len / 2, hw = (G.up.strafeW || JETC.half) * (G.up.twin ? 2 : 1) + (G.up.twin ? 2 : 0);
  const on = Math.floor(realT * 6) % 2 ? 0.9 : 0.6;
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ff9a3a';
  ctx.beginPath();
  ctx.moveTo(a.x - ux * L + nx * hw, a.y - uy * L + ny * hw);
  ctx.lineTo(a.x + ux * L + nx * hw, a.y + uy * L + ny * hw);
  ctx.lineTo(a.x + ux * L - nx * hw, a.y + uy * L - ny * hw);
  ctx.lineTo(a.x - ux * L - nx * hw, a.y - uy * L - ny * hw);
  ctx.fill();
  // the edges as dashes of pixels, and the arrow
  ctx.globalAlpha = on;
  ctx.fillStyle = '#ffb060';
  for (let s = -L; s <= L; s += 4) for (const sd of [-1, 1]) ctx.fillRect(Math.round(a.x + ux * s + nx * hw * sd), Math.round(a.y + uy * s + ny * hw * sd), 2, 1);
  for (let k = 0; k < 7; k++) {
    const s = L + 2 - k, w = k * 0.8;
    ctx.fillRect(Math.round(a.x + ux * s - nx * w), Math.round(a.y + uy * s - ny * w), Math.max(1, Math.round(w * 2)), 1);
  }
  ctx.globalAlpha = 1;
  const t = STRAF.aim ? 'LET GO: STRAFE' : 'CLICK: STRAFE HERE.  DRAG: AIM IT.', w = tw(t);
  text(t, Math.round(clamp(M.x, w / 2 + 3, W - w / 2 - 3)), Math.round(Math.min(M.y + 12, H - 44)), '#ffb060', { align: 'center' });
}
