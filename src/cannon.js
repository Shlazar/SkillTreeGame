// cannon.js - the RAIL CANNON: the train's big gun on the flatcar (the tree node id is still gun). It shoots
// by itself, anything on the screen, once every few seconds (G.up.gun = its reload). Each shot goes
// straight from the cannon through its target to the edge of the screen and kills every zombie on
// that line, brutes too. It takes the line that kills the most, but the dead on the train come first.
// While it reloads its barrel glows hotter and the lights round its base fill up; when it is ready
// they flash once. The shot: a huge muzzle blast, the barrel kicks back, the flatcar jolts, a white
// beam, a row of blasts and dust along the line, bodies thrown off it, and a burnt line on the ground.

// ---------- the model
// Two piles of slices, like the cars: the turret (TURRET.n / h = normal / thermal, at CANNON_N
// headings, 0 = north, clockwise) and its long barrel (bn / bh), drawn apart so the barrel can kick
// back. glow[i] = the barrel lit orange (laid over it while it charges), white[i] = all white (the
// ready flash), both made when first needed. CB_Z = the barrel's height over the deck, CB_LEN = px
// from the cannon's middle to the muzzle, CB_H = the muzzle's height over the ground.
const TURRET = { n: [], h: [], bn: [], bh: [], glow: [], white: [], raw: [] };
const CANNON_N = 64, CB_Z = 3, CB_LEN = 25, CB_H = 8;
// one 22 x 22 turret slice / one 52 x 52 barrel slice (the middle is between pixels 10 and 11 / 25 and 26)
const tSl = (fn) => pix(22, 22, fn), bSl = (fn) => pix(52, 52, fn);
function tDisc(r, R, col) {
  for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) if (Math.hypot(x + 0.5 - 11, y + 0.5 - 11) <= R) r(x, y, 1, 1, col);
}
// the turret's armored body: half its width on each row from the front (row 5) to the back (row 16)
const HULL = [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6];
function tHull(r, col, inset) {
  for (let k = inset || 0; k < HULL.length - (inset || 0); k++) {
    const w = HULL[k] - (inset || 0);
    r(11 - w, 5 + k, w * 2, 1, col);
  }
}
function turretSlices() {
  // dark steel, with hazard yellow on the front plate and round the back
  const S = ['#1a1d22', '#262a31', '#353a43', '#474d58', '#5d6470', '#7b8390', '#a3abb7'], Y = '#d8a93a', K = '#16181c';
  return [
    // the turning ring under it, with eight bolts
    tSl((r) => tDisc(r, 6.6, '#121417')),
    tSl((r) => {
      tDisc(r, 6.6, '#2a2d34');
      for (let k = 0; k < 8; k++) r(Math.floor(11 + Math.sin(k * TAU / 8) * 5.6), Math.floor(11 - Math.cos(k * TAU / 8) * 5.6), 1, 1, '#6b707c');
    }),
    // the body, with armor skirts on both sides
    tSl((r) => { tHull(r, S[1]); r(4, 7, 1, 9, S[0]); r(17, 7, 1, 9, S[0]); }),
    tSl((r) => {
      tHull(r, S[2]);
      r(4, 7, 1, 9, S[3]); r(17, 7, 1, 9, S[2]);
      for (const y of [8, 11, 14]) { r(4, y, 1, 1, S[5]); r(17, y, 1, 1, S[1]); }
      // the mantlet the barrel comes out of
      r(9, 3, 4, 2, S[1]);
    }),
    tSl((r) => {
      tHull(r, S[3]);
      // the sloped front plate with hazard stripes
      r(7, 5, 8, 1, S[5]);
      for (let x = 6; x < 16; x++) r(x, 6, 1, 1, (x >> 1) & 1 ? Y : K);
      r(5, 7, 12, 1, S[2]);
      r(4, 7, 1, 9, S[5]); r(17, 7, 1, 9, S[3]);
      r(9, 3, 4, 2, S[2]); r(9, 3, 4, 1, S[4]);
    }),
    // the roof: lit front and left edges, a hatch, a vent and a hazard stripe at the back
    tSl((r) => {
      tHull(r, S[4], 1); r(6, 7, 10, 1, S[6]); r(6, 7, 1, 8, S[5]); r(15, 8, 1, 7, S[3]);
      r(8, 4, 6, 3, S[3]); r(8, 4, 6, 1, S[6]);
      r(13, 12, 2, 2, S[1]); r(13, 12, 1, 1, S[5]);
      for (let x = 7; x < 11; x += 2) r(x, 11, 1, 3, S[1]);
      for (let x = 6; x < 16; x++) r(x, 15, 1, 1, (x >> 1) & 1 ? K : Y);
    }),
    // the cupola with its periscope
    tSl((r) => { r(12, 8, 3, 3, S[5]); r(12, 8, 3, 1, S[6]); r(13, 8, 1, 1, '#9fd3f2'); })
  ];
}
// the barrel: a long thin tube from a thick sleeve in the mantlet, a band, a muzzle brake with side vents
function barrelShape(r, col) {
  r(24, 17, 4, 5, col);
  r(25, 4, 2, 13, col);
  r(24, 1, 4, 3, col);
}
function barrelSlices() {
  return [
    bSl((r) => { barrelShape(r, '#24272d'); r(24, 2, 1, 1, '#0c0d10'); r(27, 2, 1, 1, '#0c0d10'); }),
    bSl((r) => {
      barrelShape(r, '#5a5f6b');
      r(25, 4, 1, 13, '#c3c8cf'); r(26, 4, 1, 13, '#7d838c'); r(25, 11, 2, 1, '#3d414b');
      r(24, 17, 1, 5, '#9aa0aa'); r(27, 17, 1, 5, '#3d414b'); r(25, 17, 2, 1, '#2a2d34');
      r(24, 1, 4, 1, '#d6d9de'); r(24, 2, 1, 2, '#8b919c'); r(27, 2, 1, 2, '#2a2d34'); r(25, 3, 2, 1, '#3d414b');
    })
  ];
}
// Every heading, made once when the game starts, and put in the sprite atlas.
function cannonArt() {
  const ts = turretSlices(), bs = barrelSlices();
  for (let i = 0; i < CANNON_N; i++) {
    const a = i / CANNON_N * TAU;
    const raw = stackSpr(ts, a, 24), n = selOut(rimLight(raw, '#e8e2cc', 0.2)), h = outline(hotSpr(raw, 120), '#161616');
    n.ox = h.ox = 13;
    n.oy = h.oy = 12 + ts.length + 1;
    const braw = stackSpr(bs, a, 52), bn = selOut(rimLight(braw, '#f2eee0', 0.25)), bh = outline(hotSpr(braw, 135), '#161616');
    bn.ox = bh.ox = 27;
    bn.oy = bh.oy = 26 + bs.length + 1;
    TURRET.n.push(n);
    TURRET.h.push(h);
    TURRET.bn.push(bn);
    TURRET.bh.push(bh);
    TURRET.raw.push([braw, a]);
  }
  for (const c of [...TURRET.n, ...TURRET.h, ...TURRET.bn, ...TURRET.bh]) atl(c);
}
// The barrel at heading i glowing hot (only its own pixels, not its outline): dark red at the
// turret, orange, then yellow-white at the muzzle, fading out toward the turret / the cannon all white.
const HEAT = [[122, 26, 8], [226, 85, 47], [255, 154, 58], [255, 226, 160]];
function cbGlow(i) {
  if (!TURRET.glow[i]) {
    const [raw, a] = TURRET.raw[i], w = raw.width + 2, h = raw.height + 2, [c, g] = mk(w, h, true);
    g.drawImage(raw, 1, 1);
    const im = g.getImageData(0, 0, w, h), d = im.data, px = 27, py = 26 + 2 + 1, ux = Math.sin(a), uy = -Math.cos(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (!d[k + 3]) continue;
      // how far along the barrel (0 at the turret, 1 at the muzzle)
      const t = clamp(((x + 0.5 - px) * ux + (y + 1.5 - py) * uy - 8) / (CB_LEN - 8), 0, 1), j = Math.min(2, (t * 3) | 0), f = t * 3 - j;
      for (let q = 0; q < 3; q++) d[k + q] = HEAT[j][q] + (HEAT[j + 1][q] - HEAT[j][q]) * f;
      d[k + 3] = Math.round(255 * Math.pow(t, 1.3));
    }
    g.putImageData(im, 0, 0);
    TURRET.glow[i] = c;
  }
  return TURRET.glow[i];
}
function cbWhite(i) {
  if (!TURRET.white[i]) TURRET.white[i] = [tint(TURRET.n[i], '#fff6e0', 1), tint(TURRET.bn[i], '#fff6e0', 1)];
  return TURRET.white[i];
}

// ---------- the state
// cd = seconds to ready, ready = loaded, ang = where its barrel points (0 = north, clockwise),
// plan = the line it wants {ang, tgt, n}, look = time to look again, rec = the barrel's kick (1 at
// a shot), jolt = the flatcar's jolt, readyT = the ready flash, smk = smoke from the barrel after a
// shot, beams = the shots' lines still fading, shots / kills = this run's.
function newCannon() {
  return { cd: 0, ready: true, ang: 0, plan: null, tgt: null, look: 0, rec: 0, recT: 9, jolt: 0, joltT: 9, ju: [0, 1],
    readyT: 0, smk: 0, beams: [], shots: 0, kills: 0, last: 0 };
}
// the reload's share done (0 just fired .. 1 ready)
const cannonK = () => (G.gun.ready ? 1 : 1 - G.gun.cd / G.up.gun);

// ---------- aiming
// The dead on the screen (the cannon reaches all of them).
const CVIS = [];
function cannonSeen() {
  CVIS.length = 0;
  const x0 = G.camX - 2, y0 = G.camY - 2, x1 = G.camX + W + 2, y1 = G.camY + H + 2;
  for (const z of G.zombies) if (!z.dead && !z.gone && z.x > x0 && z.x < x1 && z.y > y0 && z.y < y1) CVIS.push(z);
  return CVIS;
}
// How far along (ux, uy) from (x, y) the line leaves the screen (and a little past it).
function cannonReach(x, y, ux, uy) {
  let t = 2000;
  const x0 = G.camX - 30, y0 = G.camY - 30, x1 = G.camX + W + 30, y1 = G.camY + H + 30;
  if (ux > 1e-6) t = Math.min(t, (x1 - x) / ux); else if (ux < -1e-6) t = Math.min(t, (x0 - x) / ux);
  if (uy > 1e-6) t = Math.min(t, (y1 - y) / uy); else if (uy < -1e-6) t = Math.min(t, (y0 - y) / uy);
  return Math.max(0, t);
}
// Is zombie z on the line from (gx, gy) along (ux, uy), within reach L? Returns how far along, or -1.
function onLine(z, gx, gy, ux, uy, L) {
  const dx = z.x - gx, dy = z.y - 4 - gy, t = dx * ux + dy * uy;
  if (t < 3 || t > L) return -1;
  return Math.abs(dx * uy - dy * ux) <= CFG.gun.hw + (z.big ? 3 : 0) ? t : -1;
}
// The best line: through each one of the dead on the train (if any are), else through each one on the
// screen; the one that kills the most wins (the nearer target when they tie).
function cannonPlan(gx, gy) {
  const vis = cannonSeen();
  if (!vis.length) return null;
  const onTrain = vis.some((z) => z.st === 2);
  let best = null, bn = -1, bd = Infinity;
  for (const t of vis) {
    if (onTrain && t.st !== 2) continue;
    const dx = t.x - gx, dy = t.y - 4 - gy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, L = cannonReach(gx, gy, ux, uy);
    let n = 1;
    for (const z of vis) if (z !== t && onLine(z, gx, gy, ux, uy, L) >= 0) n += z.big ? 1.5 : 1;
    if (n > bn || (n === bn && d < bd)) {
      bn = n;
      bd = d;
      best = { ang: Math.atan2(ux, -uy), tgt: t, n };
    }
  }
  return best;
}

// ---------- each step
function updateCannon(dt) {
  const g = G.gun, c = G.tr.cars[2], [gx, gy] = gunXY();
  // reload; the moment it is loaded the lights flash
  if (!g.ready) {
    g.cd -= dt;
    if (g.cd <= 0) {
      g.cd = 0;
      g.ready = true;
      g.readyT = 0.3;
      rings.push({ x: gx, y: gy, r0: 4, r1: 16, t: 0, T: 0.3, c: '#ffe2a0', w: 1 });
    }
  }
  g.readyT = Math.max(0, g.readyT - dt);
  g.recT += dt;
  g.joltT += dt;
  // look for the best line often (at once when its target is gone)
  g.look -= dt;
  if (g.look <= 0 || (g.plan && (g.plan.tgt.dead || g.plan.tgt.gone))) {
    g.plan = cannonPlan(gx, gy);
    g.look = g.ready ? 0.1 : 0.25;
  }
  const p = g.plan, live = p && !p.tgt.dead && !p.tgt.gone;
  g.tgt = live ? p.tgt : null;
  // the barrel turns to it, smoothly (back to the front of the train when there is nothing to shoot);
  // it follows a moving target, so the angle is worked out again each step
  const want = live ? Math.atan2(p.tgt.x - gx, -(p.tgt.y - 4 - gy)) : c.ang;
  const da = mod(want - g.ang + Math.PI, TAU) - Math.PI, turn = CFG.gun.turn * dt;
  g.ang = mod(g.ang + clamp(da * Math.min(1, dt * 9), -turn, turn), TAU);
  if (g.ready && live && Math.abs(da) < 0.05) cannonFire(gx, gy, want);
  // the flatcar jolts back from the shot (and the riders and the cannon with it)
  if (g.joltT < 0.5) {
    const k = Math.exp(-g.joltT * 9) * Math.cos(g.joltT * 34) * 2.4;
    c.cx -= g.ju[0] * k;
    c.cy -= g.ju[1] * k;
  }
  // smoke curls out of the hot barrel after a shot
  if (g.smk > 0) {
    g.smk -= dt;
    if (Math.random() < dt * 26 * g.smk) {
      const [mx, my] = cannonMuzzle();
      part({ x: mx + rnd(-1, 1), y: my, z: CB_H, vx: rnd(-3, 3), vy: rnd(-3, 1), vz: rnd(8, 16), g: 0, life: rnd(0.9, 1.6), max: 1.6,
        s: rnd(1, 2), c: pick(['rgba(70,64,58,0.55)', 'rgba(96,90,82,0.45)']), grow: 3, drag: 0.6, smoke: true });
    }
  }
  // near the end of the reload, sparks are drawn into the muzzle
  const k = cannonK();
  if (!g.ready && k > 0.6 && Math.random() < dt * 40 * (k - 0.5)) {
    const [mx, my] = cannonMuzzle(), a = rnd(TAU), r = rnd(6, 11);
    part({ x: mx + Math.cos(a) * r, y: my + Math.sin(a) * r * FORE, z: CB_H, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * FORE * 4,
      vz: 0, g: 0, life: 0.22, max: 0.22, s: 1, c: pick(['#ffd27a', '#ff9a3a', '#fff1c2']), add: true });
  }
  for (let i = g.beams.length - 1; i >= 0; i--) if ((g.beams[i].t += dt) > 1.6) g.beams.splice(i, 1);
}
// The muzzle on the ground (its height is CB_H), with the barrel's kick.
function cannonMuzzle() {
  const g = G.gun, [gx, gy] = gunXY(), l = CB_LEN + 1 - cannonKick();
  return [gx + Math.sin(g.ang) * l, gy - Math.cos(g.ang) * l];
}
// px the barrel is pushed back: 5 at the shot, sliding home over half a second
const cannonKick = () => 5 * Math.pow(Math.max(0, 1 - G.gun.recT / 0.5), 2);

// ---------- the shot
function cannonFire(gx, gy, a) {
  const g = G.gun, ux = Math.sin(a), uy = -Math.cos(a), L = cannonReach(gx, gy, ux, uy), demo = G.demo;
  g.ang = a;
  g.ready = false;
  g.cd = G.up.gun;
  g.shots++;
  g.recT = 0;
  g.joltT = 0;
  g.ju = [ux, uy];
  g.smk = 1.4;
  const [mx, my] = cannonMuzzle();
  // everything on the line dies, nearest first
  const hit = [];
  for (const z of cannonSeen()) {
    const t = z === g.tgt ? Math.max(3, (z.x - gx) * ux + (z.y - 4 - gy) * uy) : onLine(z, gx, gy, ux, uy, L);
    if (t >= 0) hit.push([z, t]);
  }
  hit.sort((p, q) => p[1] - q[1]);
  for (const [z, t] of hit) {
    const nb = G.bodies.length, side = (z.x - gx) * uy - (z.y - gy) * ux < 0 ? -1 : 1;
    kill(z, 'gun', gx, gy, t);
    // thrown off the line, spinning, and on along it
    if (G.bodies.length > nb) {
      const b = G.bodies[G.bodies.length - 1], v = rnd(45, 95) * (z.big ? 0.5 : 1), f = rnd(30, 70);
      b.vx = -uy * side * v + ux * f;
      b.vy = (ux * side * v + uy * f) * FORE;
      b.vz = rnd(70, 130) * (z.big ? 0.6 : 1);
      b.z = 3;
      b.fall = false;
      b.spin = rnd(10, 18) * side;
    }
    // a red burst and a few sparks where it was hit
    for (let k = 0; k < 4; k++) part({ x: z.x, y: z.y, z: rnd(3, 7), vx: -uy * side * rnd(20, 60) + ux * rnd(10, 40),
      vy: (ux * side * rnd(20, 60) + uy * rnd(10, 40)) * FORE, vz: rnd(10, 50), g: 160, life: rnd(0.2, 0.4), max: 0.4, s: 1,
      c: pick(['#fff1c2', '#ffd27a', '#ff9a3a']), add: true, drag: 1.5 });
    addBoom(z.x, z.y, z.big ? 11 : 8, 5, 0.4, 4, t / 1800);
    stampScorch(z.x, z.y, z.big ? 2 : 1);
  }
  g.last = hit.length;
  // the line: a beam that fades, the ground lit, a row of small blasts and dust, a burnt groove
  g.beams.push({ x0: mx, y0: my, ux, uy, L, t: 0, seed: rnd(1000) });
  for (let s = 18; s < L; s += rnd(16, 26)) {
    const x = gx + ux * s + rnd(-2, 2), y = gy + uy * s + rnd(-2, 2), dl = s / 1800;
    addBoom(x, y, rnd(4, 6.5), 4, 0.35, 3, dl);
    part({ x, y, z: 1, vx: rnd(-6, 6), vy: rnd(-4, 2), vz: rnd(4, 10), g: 0, life: rnd(1, 1.8), max: 1.8, s: rnd(2, 4),
      c: pick(['rgba(92,78,58,0.5)', 'rgba(70,60,46,0.55)', 'rgba(110,96,72,0.4)']), grow: 4, drag: 1.2, smoke: true });
    // clods of earth thrown out to both sides
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, v = rnd(15, 45);
      part({ x, y, z: 1, vx: -uy * sd * v, vy: ux * sd * v * FORE, vz: rnd(30, 70), g: 240, life: 1.2, max: 1.2, s: 1,
        c: pick(['#3a2e22', '#4f3f2d', '#2a221a']), land: 1 });
    }
    if (s % 3 < 1) lights.push({ x, y, z: 2, r: rnd(14, 20), c: '#ffb060', life: 0.3, max: 0.3, a: 0.55 });
  }
  cannonScorch(gx, gy, ux, uy, L);
  // the muzzle: a fireball, side blasts out of the brake, a smoke ring, a shock ring, a flash of light
  addBoom(mx, my + 1, 12, 7, 0.32, 5.5);
  lights.push({ x: mx, y: my, z: CB_H, r: 46, c: '#ffd27a', life: 0.16, max: 0.16, a: 1 });
  lights.push({ x: gx, y: gy, z: 0, r: 60, c: '#ff9a4a', life: 0.3, max: 0.3, a: 0.5 });
  for (let k = 0; k < 18; k++) {
    const sd = k & 1 ? 1 : -1, v = rnd(50, 130), fw = rnd(-15, 25);
    part({ x: mx, y: my, z: CB_H, vx: -uy * sd * v + ux * fw, vy: (ux * sd * v + uy * fw) * FORE, vz: rnd(-10, 25), g: 60,
      life: rnd(0.15, 0.35), max: 0.35, s: k < 6 ? 2 : 1, c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 4 });
  }
  for (let k = 0; k < 20; k++) {
    const b = k / 20 * TAU, v = rnd(34, 46);
    part({ x: mx, y: my, z: CB_H, vx: Math.cos(b) * v + ux * 22, vy: Math.sin(b) * v * FORE + uy * 22, vz: rnd(2, 8), g: 0,
      life: rnd(0.8, 1.2), max: 1.2, s: 2, c: pick(['rgba(200,190,170,0.5)', 'rgba(150,140,124,0.55)', 'rgba(110,104,96,0.55)']),
      grow: 4, drag: 3.2, smoke: true });
  }
  for (let k = 0; k < 6; k++) {
    const v = rnd(30, 90);
    part({ x: mx, y: my, z: CB_H, vx: ux * v + rnd(-6, 6), vy: uy * v + rnd(-6, 6), vz: rnd(4, 12), g: 0, life: rnd(1, 1.6), max: 1.6,
      s: 3, c: pick(['rgba(60,56,52,0.6)', 'rgba(84,78,72,0.5)']), grow: 5, drag: 2.5, smoke: true });
  }
  rings.push({ x: mx, y: my, r0: 4, r1: 36, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x: gx, y: gy, r0: 10, r1: 52, t: 0, T: 0.45, c: '#a89878' });
  // a spent shell case, big and brass, thrown off the back
  part({ x: gx - ux * 5, y: gy - uy * 5, z: 7, vx: -ux * rnd(25, 40) + rnd(-10, 10), vy: -uy * rnd(25, 40), vz: rnd(40, 60), g: 220,
    life: 0.9, max: 0.9, s: 2, c: '#e3b04b' });
  if (!demo) {
    addShake(0.6);
    hitStop(0.07, 0.1);
    kick(-ux * 3, -uy * 3);
    SFX.cannon();
    if (hit.length > 2) SFX.boom();
  }
}
// The groove the shot burns into the ground: a black core, earth thrown up on both sides, and scorch
// marks along it (not under the train).
function cannonScorch(gx, gy, ux, uy, L) {
  const nx = -uy, ny = ux;
  for (let s = 16; s < L; s += 1) {
    const x = gx + ux * s, y = gy + uy * s;
    if (Math.abs(x - trackX(y)) < 10) continue;
    const w = Math.sin(s * 0.37) > 0.3 ? 1 : 0;
    stampPix(x - nx * w, y - ny * w, (s | 0) % 5 ? 'rgba(12,9,7,0.95)' : 'rgba(36,24,15,0.95)', 2);
    for (const sd of [-1, 1]) if (Math.random() < 0.45) {
      const o = sd * rnd(2.2, 3.6);
      stampPix(x + nx * o, y + ny * o, pick(['rgba(84,64,42,0.9)', 'rgba(62,47,32,0.9)', 'rgba(40,30,20,0.85)']), 1);
    }
    if ((s | 0) % 7 === 0) stampScorch(x + rnd(-1, 1), y + rnd(-1, 1), 0);
  }
}
// ---------- drawing
// The cannon on the flatcar's deck (called from drawCar): the reload lights round its base, the
// turret, the barrel (behind the turret when it points away, in front when it points this way),
// the barrel's charge glow and the ready flash.
function drawCannon() {
  const g = G.gun, [gx, gy] = gunXY(), i = mod(Math.round(g.ang / TAU * CANNON_N), CANNON_N), x = Math.round(gx), y = Math.round(gy) - DECK;
  const kick = cannonKick(), bx = Math.round(gx - Math.sin(g.ang) * kick), by = Math.round(gy - DECK - CB_Z + Math.cos(g.ang) * kick);
  const body = (thermal ? TURRET.h : TURRET.n)[i], brl = (thermal ? TURRET.bh : TURRET.bn)[i], back = Math.cos(g.ang) > 0.15;
  drawCannonPips(gx, gy - DECK);
  const k = cannonK(), glowA = thermal ? 0 : g.ready ? 0.35 + 0.1 * Math.sin(realT * 6) : Math.pow(k, 2) * 0.85;
  const barrel = () => {
    blit(brl, bx - brl.ox, by - brl.oy);
    if (glowA > 0.02) {
      ctx.globalAlpha = glowA;
      const gl = cbGlow(i);
      blit(gl, bx - brl.ox, by - brl.oy);
      ctx.globalAlpha = 1;
    }
  };
  if (back) barrel();
  blit(body, x - body.ox, y - body.oy);
  if (!back) barrel();
  if (g.readyT > 0 && !thermal) {
    const [wb, wl] = cbWhite(i);
    ctx.globalAlpha = g.readyT / 0.3;
    blit(wb, x - body.ox, y - body.oy);
    blit(wl, bx - brl.ox, by - brl.oy);
    ctx.globalAlpha = 1;
  }
}
// A ring of lamps round the cannon's base, on the deck: it fills clockwise (amber) as the cannon
// reloads, its tip blinking; gold all round when it is ready, white for the ready flash.
function drawCannonPips(x, y) {
  const g = G.gun, n = 40, lit = g.ready ? n : Math.floor(cannonK() * n), blink = Math.sin(realT * 20) > 0;
  ctx.fillStyle = '#100d0a';
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU;
    ctx.fillRect(Math.round(x + Math.sin(a) * 9 - 0.5), Math.round(y - Math.cos(a) * 9 - 0.5), 1, 1);
  }
  ctx.fillStyle = thermal ? '#ffffff' : g.readyT > 0 ? '#ffffff' : g.ready ? '#ffd36a' : '#ff8a3a';
  for (let k = 0; k < lit + (blink && !g.ready ? 1 : 0); k++) {
    const a = k / n * TAU;
    ctx.fillRect(Math.round(x + Math.sin(a) * 9 - 0.5), Math.round(y - Math.cos(a) * 9 - 0.5), 1, 1);
  }
}
// Over the world, in added light: the charge glow at the muzzle, the lit pips, the beams and the
// hot groove they leave.
function drawCannonFx() {
  if (!G.up.gun) return;
  const g = G.gun, [gx, gy] = gunXY(), k = cannonK(), [mx, my] = cannonMuzzle();
  // the barrel charging, then a slow pulse while it waits
  if (!thermal) {
    const a = g.ready ? 0.45 + 0.15 * Math.sin(realT * 6) : k * k * 0.6;
    light(mx, my - CB_H, 3 + k * 7, k > 0.85 ? '#ffd27a' : '#ff7a28', a);
    if (g.ready) light(gx, gy - DECK, 14, '#ffd27a', 0.18 + 0.06 * Math.sin(realT * 6));
    if (g.readyT > 0) light(gx, gy - DECK - 4, 22, '#fff1c2', g.readyT / 0.3 * 0.7);
  }
  for (const b of g.beams) drawBeam(b);
  ctx.globalAlpha = 1;
}
// One shot's line. The first 0.3 s: a white-hot beam that thins out and breaks up; then for 1.6 s
// a glowing groove on the ground that cools from orange to dark red.
function drawBeam(b) {
  const { x0, y0, ux, uy, L, t } = b, ex = x0 + ux * L, ey = y0 + uy * L;
  // the groove on the ground (from the flatcar's edge on)
  const u = t / 1.6, n = Math.floor(L / 2);
  ctx.globalAlpha = Math.pow(1 - u, 1.5) * 0.9;
  for (let s = 8; s < n; s++) {
    const h = (s * 7919 + b.seed) % 13;
    if (h < 4 + u * 9) continue;
    const d = s * 2, x = Math.round(x0 + ux * d), y = Math.round(y0 + uy * d);
    ctx.fillStyle = h > 11 && u < 0.4 ? '#ffd27a' : u < 0.5 ? '#ff7a28' : '#b8401c';
    ctx.fillRect(x, y, 1, 1);
  }
  if (t > 0.3) return;
  // the beam: its start at the muzzle (CB_H up), its end at chest height
  const v = t / 0.3, w = Math.round(3 * Math.pow(1 - v, 1.5)), sx = x0, sy = y0 - CB_H, fx = ex, fy = ey - 5;
  const steep = Math.abs(fy - sy) > Math.abs(fx - sx);
  for (let o = -w - 1; o <= w + 1; o++) {
    const ao = Math.abs(o), col = ao === 0 ? '#fff6e0' : ao <= w - 1 ? '#ffe2a0' : ao <= w ? '#ffb347' : '#e2552f';
    ctx.globalAlpha = (1 - v) * (ao > w ? 0.5 : 1);
    if (v > 0.45) {
      // breaking up into dashes as it fades
      const seg = 10, m = Math.ceil(L / seg);
      for (let q = 0; q < m; q++) {
        if (((q * 31 + b.seed) | 0) % 10 < (v - 0.45) * 20) continue;
        const a0 = q / m, a1 = (q + 0.6) / m;
        pl(ctx, lerp(sx, fx, a0) + (steep ? o : 0), lerp(sy, fy, a0) + (steep ? 0 : o), lerp(sx, fx, a1) + (steep ? o : 0), lerp(sy, fy, a1) + (steep ? 0 : o), col);
      }
    } else pl(ctx, sx + (steep ? o : 0), sy + (steep ? 0 : o), fx + (steep ? o : 0), fy + (steep ? 0 : o), col);
  }
  // a soft glow along it
  ctx.globalAlpha = 1;
  for (let d = 0; d < L; d += 30) light(lerp(sx, fx, d / L), lerp(sy, fy, d / L), 12 * (1 - v) + 4, '#ff9a3a', 0.5 * (1 - v));
}

cannonArt();

// ---------- test calls
// cannon() = its state; cannonReady() = load it now; cannonAim(a) = point it at a (radians).
Object.assign(window.__sr, {
  cannon: () => {
    const g = G.gun;
    return { reload: G.up.gun, cd: +g.cd.toFixed(2), ready: g.ready, ang: +g.ang.toFixed(2), shots: g.shots, kills: g.kills, last: g.last,
      beams: g.beams.length, plan: g.plan ? { n: g.plan.n, st: g.plan.tgt.st } : null };
  },
  cannonReady: () => {
    G.gun.cd = 0;
    G.gun.ready = true;
  },
  cannonAim: (a) => {
    G.gun.ang = a;
  }
});
