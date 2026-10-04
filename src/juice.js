// juice.js - the extra kick of every hit, in the same pixel style as fx.js: blood sprayed away from
// the shot and a small knock back, torn bits (gibs) that tumble, leave a trail and stay on the
// ground, pools of blood that spread under the dead, the 105's full blast (a hot core, a shock ring
// of dust, smoking debris, a column of smoke with embers, a crater with rays), the Turbo Ram's bow
// wave, coins that pop out and bounce, the golden zombie's glints and a short flash of the screen.
// Hooks: juiceHit (hitZombie), juiceKill (kill), bloodPool (stampCorpse), juiceBoom (boomFx),
// juiceRamFx (ramFx), juiceGold (goldKill), juicePop / coinPop (loot), updateJuice (step),
// drawJuice (render, after the flying bodies) and drawJuiceTop (render, over the glows).

// from = where the next hit comes from ([x, y] on the ground; a gun may set it before it hits, or
// the hit comes from below the screen, where the gunship is); flash = screen flash left (s)
const JUICE = { g: null, from: null, flash: 0, emit: [], gibs: [], debris: [], pools: [], coins: [] };
const BLOOD = [P.bl0, P.bl1, P.bl2, P.bl2, '#821f1a'];
const DUSTC = ['rgba(150,128,96,0.55)', 'rgba(124,106,80,0.55)', 'rgba(170,150,116,0.45)'];
const JD = [0, 0];
// The unit direction [x, y] a hit on z travels (away from its source), y on the flat ground.
function hitDir(z, cause, out) {
  out = out || JD;
  let sx, sy;
  if (JUICE.from) [sx, sy] = JUICE.from;
  else if (cause === 'gun' && G.up.gun && typeof gunXY === 'function') [sx, sy] = gunXY();
  else { sx = G.camX + W / 2; sy = G.camY + VH + 40; }
  const dx = z.x - sx, dy = (z.y - sy) / FORE, l = Math.hypot(dx, dy) || 1;
  out[0] = dx / l;
  out[1] = dy / l;
  return out;
}
// n drops of blood thrown along (dx, dy) from (x, y) at height up to zh, and a red mist puff.
// k = force. They land and stay on the ground.
function spray(x, y, dx, dy, n, zh, k) {
  k = k || 1;
  for (let i = 0; i < n; i++) {
    const v = rnd(30, 105) * k, s = rnd(-0.55, 0.55);
    part({ x: x + rnd(-1, 1), y, z: rnd(zh * 0.4, zh), vx: (dx - dy * s) * v, vy: (dy + dx * s) * v * FORE, vz: rnd(5, 45) * k,
      g: 260, life: 1.4, max: 1.4, s: Math.random() < 0.18 * k ? 2 : 1, c: pick(BLOOD), land: 1 });
  }
  part({ x: x + dx * 2, y: y + dy * 2 * FORE, z: zh * 0.7, vx: dx * 22 * k, vy: dy * 22 * k * FORE, vz: 4, g: 0, life: 0.32, max: 0.32,
    s: 2, c: 'rgba(150,24,18,0.55)', grow: 9, drag: 4, smoke: true });
}
// A hit that does not kill (and the first part of one that does): blood out of the far side, a
// small push back. Brutes take it heavy: more blood, dust at their feet, a longer flash, a nudge
// of the view.
function juiceHit(z, cause) {
  const [dx, dy] = hitDir(z, cause), big = z.big, S = z.S;
  if (z.hp > 0) {
    spray(z.x, z.y, dx, dy, big ? 8 : 4, S.h * 0.65, big ? 1.1 : 0.9);
    if (z.st !== 2) {
      z.kbx += dx * (big ? 7 : 16);
      z.kby += dy * (big ? 7 : 16) * FORE;
    }
  }
  if (big) {
    z.flash = 0.14;
    for (let i = 0; i < 3; i++) part({ x: z.x + rnd(-4, 4), y: z.y, z: 1, vx: rnd(-14, 14), vy: rnd(-4, 4), vz: rnd(3, 8), g: 0,
      life: rnd(0.4, 0.6), max: 0.6, s: 2, c: pick(DUSTC), grow: 5, drag: 3, smoke: true });
    if (!G.demo && !offView(z.x, z.y, 0)) addShake(0.035);
  }
}
// A kill: more blood along the blow, and for the big blows (the 105, the train, the Ram, a brute)
// torn bits that tumble and stay. cause and the blast centre (cx, cy) as in kill().
function juiceKill(z, cause, cx, cy) {
  const S = z.S, big = z.big;
  let dx, dy;
  if (cause === 'he') {
    const ex = z.x - cx, ey = (z.y - cy) / FORE, l = Math.hypot(ex, ey) || 1;
    dx = ex / l;
    dy = ey / l;
  } else if (cause === 'train' || cause === 'ram') {
    const c = G.tr.cars[0], s = trackLocal(z.x, z.y, TL).u < 0 ? -1 : 1;
    dx = c.nx * s * 0.8 + c.dx * 0.6;
    dy = (c.ny * s * 0.8 + c.dy * 0.6) / FORE;
  } else [dx, dy] = hitDir(z, cause);
  JUICE.from = null;
  if (offView(z.x, z.y, 40)) return;
  const hard = cause === 'he' || cause === 'train' || cause === 'ram';
  spray(z.x, z.y, dx, dy, hard ? 9 : big ? 10 : 6, S.h * 0.6, hard ? 1.25 : 1.1);
  // torn bits: always from the 105, the Ram and the train, and from a brute; now and then from a gun
  const n = cause === 'he' ? rndi(2, 4) : cause === 'ram' ? rndi(1, 3) : cause === 'train' ? rndi(1, 2) : big ? 3 : Math.random() < 0.15 ? 1 : 0;
  for (let i = 0; i < n + (big && hard ? 2 : 0); i++) gib(z, dx, dy, hard ? 1.4 : 1);
  if (cause === 'ram' || cause === 'train') {
    // the smack on the nose: a hot white spark and a smear of blood on the rails
    const c = G.tr.cars[0];
    if (realT - (JUICE.smack || 0) > 0.12) {
      JUICE.smack = realT;
      lights.push({ x: c.x0, y: c.y0, z: 4, r: 10, c: '#fff1d8', life: 0.07, max: 0.07, a: 0.55 });
    }
    for (let i = 0; i < 4; i++) stampPix(z.x + rnd(-3, 3), z.y + rnd(-2, 2), pick(BLOOD), Math.random() < 0.3 ? 2 : 1);
  }
}
// One torn bit of zombie z (an arm, a leg, a piece of shirt, a bone), thrown along (dx, dy).
function gib(z, dx, dy, k) {
  if (JUICE.gibs.length >= 60) return;
  const p = z.S.pal, kind = rndi(0, 3), v = rnd(40, 100) * k, s = rnd(-0.7, 0.7);
  const c = kind === 0 ? p.sk[2] : kind === 1 ? p.pa[1] : kind === 2 ? p.sh[1] : P.bone;
  JUICE.gibs.push({ x: z.x, y: z.y, z: z.S.h * 0.5, vx: (dx - dy * s) * v, vy: (dy + dx * s) * v * FORE, vz: rnd(50, 110) * k,
    rot: rnd(TAU), spin: rnd(-18, 18), c, c2: kind === 3 ? '#8a826f' : P.bl2, len: kind === 2 ? 2 : 3, trail: 0 });
}

// ---------- pools of blood that spread under the dead
// POOL[r] = a dark red puddle r px across (lumpy, dithered at its edge).
const POOL = [];
function poolSpr(r) {
  if (!POOL[r]) {
    const ry = Math.max(1, Math.round(r * FORE)), rg = mulberry(r * 13 + 5);
    POOL[r] = pix(r * 2 + 3, ry * 2 + 3, (R) => {
      for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.hypot(x / r, y / ry) + (rg() - 0.5) * 0.3;
        if (d > 1) continue;
        R(x + r + 1, y + ry + 1, 1, 1, d < 0.45 ? '#3a0c0a' : d < 0.8 ? '#4a1210' : (x + y) & 1 ? '#5a1612' : '#401010');
      }
      R(r - 1, ry - 1, 2, 1, '#7a2a24');
    });
  }
  return POOL[r];
}
// Paint spr under what is already on the ground there (so a pool grows round a body, not over it).
function stampUnder(spr, x, y, a) {
  x = Math.round(x);
  y = Math.round(y);
  const ci0 = Math.floor(x / CH), ci1 = Math.floor((x + spr.width - 1) / CH), cj0 = Math.floor(y / CH), cj1 = Math.floor((y + spr.height - 1) / CH);
  for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
    const d = decalChunk(ci, cj);
    d.g.globalCompositeOperation = 'destination-over';
    d.g.globalAlpha = a;
    d.g.drawImage(spr, x - ci * CH, y - cj * CH);
    d.g.globalAlpha = 1;
    d.g.globalCompositeOperation = 'source-over';
  }
}
// A body came to rest at (x, y): its pool spreads out under it over a second or so.
function bloodPool(x, y, S) {
  if (JUICE.pools.length >= 50 || offView(x, y, 30)) return;
  JUICE.pools.push({ x, y: y - 1, r: 2, max: S.h > 18 ? 8 : rndi(4, 6), t: 0 });
}

// ---------- the 105's blast
// BLASTR = scorched rays round the crater, stamped once per blast.
let BLASTR = null;
function blastRays() {
  if (!BLASTR) {
    const R = 38, Ry = Math.round(R * FORE), rg = mulberry(77);
    const rays = [];
    for (let i = 0; i < 13; i++) rays.push([rg() * TAU, 0.55 + rg() * 0.45]);
    BLASTR = pix(R * 2 + 1, Ry * 2 + 1, (r) => {
      for (const [a, len] of rays) for (let t = 0.35; t < len; t += 0.012) {
        const w = (1 - t / len) * 2.2;
        for (let s = -w; s <= w; s += 1) {
          const x = Math.round(R + Math.cos(a) * t * R - Math.sin(a) * s), y = Math.round(Ry + (Math.sin(a) * t * R + Math.cos(a) * s) * FORE);
          if ((1 - t / len) * 1.4 > bayer(x, y) + 0.15) r(x, y, 1, 1, t < 0.6 ? 'rgba(14,10,8,0.7)' : 'rgba(30,22,16,0.55)');
        }
      }
    });
  }
  return BLASTR;
}
// The full look of a big blast, over boomFx's: a white-hot core, a flash of the screen, a ring of
// dust racing out over the ground, chunks that fly trailing smoke, then a column of smoke and
// embers that rises from the crater for a few seconds, the crater glowing, rays of scorch and
// rubble round it. It also scares the crows.
function juiceBoom(x, y, big, scale = 1) {
  // Small bomber bombs reuse this recipe at their actual blast-size ratio.
  if (!offView(x, y, 20)) JUICE.flash = Math.max(JUICE.flash, (big ? 0.1 : 0.06) * scale);
  addBoom(x, y - 2, (big ? 30 : 22) * scale, 8, big ? 1.1 : 0.9, (big ? 13 : 10) * scale, 0.02);
  lights.push({ x, y, z: 10, r: (big ? 60 : 46) * scale, c: '#ffb060', life: 0.45, max: 0.45, a: 0.35 });
  lights.push({ x, y, z: 1, r: (big ? 26 : 18) * scale, c: '#ff6a28', life: 3, max: 3, a: 0.5 });
  rings.push({ x, y, r0: 4 * scale, r1: (big ? 72 : 48) * scale, t: 0, T: 0.2, c: '#fff6e0', w: 2 });
  // the shock ring of dust along the ground
  const nd = Math.ceil((big ? 22 : 14) * scale);
  for (let i = 0; i < nd; i++) {
    const a = i / nd * TAU + rnd(-0.1, 0.1), s = rnd(110, 170) * scale;
    part({ x: x + Math.cos(a) * 6 * scale, y: y + Math.sin(a) * 6 * FORE * scale, z: 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(2, 8), g: 0,
      life: rnd(0.6, 0.9), max: 0.9, s: rnd(3, 4) * scale, c: pick(DUSTC), grow: 7 * scale, drag: 3.6, smoke: true });
  }
  // chunks that fly trailing smoke (some of them burning)
  for (let i = 0; i < Math.ceil((big ? 7 : 4) * scale) && JUICE.debris.length < 24; i++) {
    const a = rnd(TAU), s = rnd(40, 120) * scale;
    JUICE.debris.push({ x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(90, 190), fire: Math.random() < 0.5, trail: 0,
      c: pick(['#2a241d', '#3a3027', '#4c4032']) });
  }
  // the smoke column and embers, then the crater's rays and rubble
  JUICE.emit.push({ x, y, t: 0, T: (big ? 4.5 : 3) * scale, smoke: 0, ember: 0, scale });
  if (scale >= 1) stampSpr(blastRays(), x - (BLASTR.width >> 1), y - (BLASTR.height >> 1), 0.8);
  stampScorch(x, y, scale < 0.65 ? 1 : scale < 1 ? 2 : 3);
  for (let i = 0; i < 14; i++) {
    const a = rnd(TAU), r = rnd(16, 30) * scale;
    stampPix(x + Math.cos(a) * r, y + Math.sin(a) * r * FORE, pick(['#5e5140', '#2a241d', '#6d6a62', '#463b2f']), Math.random() < 0.3 ? 2 : 1);
  }
  if (typeof scareBirds === 'function') scareBirds(x, y, 220 * scale);
}

// ---------- the Turbo Ram
// Each step while it runs: clods of earth and gravel thrown off both sides of the nose (a bow wave)
// and dust rolling out over the ground beside the rails.
function juiceRamFx() {
  const tr = G.tr, k = ramK(), c = tr.cars[0];
  if (Math.random() < k * 0.9) for (const s of [-1, 1]) {
    const v = rnd(50, 120);
    part({ x: c.x0 + c.nx * s * 6 + c.dx * 2, y: c.y0 + c.ny * s * 6 + c.dy * 2, z: 2, vx: c.nx * s * v + c.dx * tr.v * rnd(0.6, 1.2),
      vy: c.ny * s * v + c.dy * tr.v * rnd(0.6, 1.2), vz: rnd(30, 75), g: 300, life: 1.2, max: 1.2, s: Math.random() < 0.3 ? 2 : 1,
      c: pick(['#4c4032', '#362d24', '#5e5140', '#555047']), land: 1 });
  }
  if (Math.random() < k * 0.5) {
    const s = Math.random() < 0.5 ? -1 : 1;
    part({ x: c.x0 + c.nx * s * 9, y: c.y0 + c.ny * s * 9, z: 1, vx: c.nx * s * rnd(40, 70) + c.dx * tr.v * 0.5, vy: c.ny * s * rnd(40, 70) + c.dy * tr.v * 0.5,
      vz: rnd(4, 10), g: 0, life: rnd(0.6, 0.9), max: 0.9, s: 3, c: pick(DUSTC), grow: 8, drag: 2.5, smoke: true });
  }
  if (typeof scareBirds === 'function' && Math.random() < 0.1) scareBirds(c.x0, c.y0, 110);
}

// ---------- coins
// A golden zombie falls: its coins burst out over the ground, and a ring of gold.
function juiceGold(z) {
  coinPop(z.x, z.y, 14, 1.2);
  rings.push({ x: z.x, y: z.y, r0: 6, r1: 40, t: 0, T: 0.55, c: '#fff1c2' });
  JUICE.flash = Math.max(JUICE.flash, 0.03);
}
// n coins pop out of (x, y), bounce twice with a clink of light and wink out.
function coinPop(x, y, n, k) {
  k = k || 1;
  for (let i = 0; i < n && JUICE.coins.length < 70; i++) {
    const a = rnd(TAU), s = rnd(14, 46) * k;
    JUICE.coins.push({ x, y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(70, 120) * k, t: 0, T: rnd(0.9, 1.3), b: 0, f: rnd(3) });
  }
}
// A find leaves the ground: a puff of dust, a ring and a few coins.
function juicePop(x, y, big) {
  rings.push({ x, y, r0: 3, r1: big ? 28 : 18, t: 0, T: 0.3, c: '#ffe2a0', w: 2 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    part({ x, y, z: 1, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 * FORE, vz: rnd(3, 8), g: 0, life: 0.5, max: 0.5, s: 2, c: pick(DUSTC), grow: 6, drag: 4, smoke: true });
  }
  coinPop(x, y, big ? 8 : 4, 0.8);
}

// ---------- each step
function updateJuice(dt) {
  const J = JUICE;
  // (a new run, or the demo behind the menus, starts with nothing left over)
  if (J.g !== G) {
    J.g = G;
    J.emit.length = J.gibs.length = J.debris.length = J.pools.length = J.coins.length = 0;
    J.flash = 0;
    J.from = null;
  }
  J.flash = Math.max(0, J.flash - dt);
  // smoke columns and embers over the craters
  for (let i = J.emit.length - 1; i >= 0; i--) {
    const e = J.emit[i];
    e.t += dt;
    if (e.t >= e.T) { J.emit.splice(i, 1); continue; }
    const k = 1 - e.t / e.T, scale = e.scale ?? 1;
    e.smoke += dt * (2 + 4 * k);
    while (e.smoke >= 1) {
      e.smoke--;
      const dark = Math.random() < k;
      part({ x: e.x + rnd(-6, 6) * scale, y: e.y + rnd(-3, 3) * scale, z: rnd(2, 8), vx: rnd(2, 9), vy: rnd(-3, 1), vz: rnd(12, 24) * (0.6 + k * 0.6), g: 0,
        life: rnd(2.2, 3.4), max: 3.4, s: rnd(3, 6) * scale, c: dark ? pick(['rgba(66,62,58,0.7)', 'rgba(84,80,76,0.65)']) : pick(['rgba(128,124,118,0.5)', 'rgba(156,152,146,0.45)']),
        grow: 4.5 * scale, drag: 0.5, smoke: true });
    }
    e.ember += dt * 5 * k;
    while (e.ember >= 1) {
      e.ember--;
      part({ x: e.x + rnd(-8, 8), y: e.y + rnd(-4, 4), z: rnd(1, 4), vx: rnd(-6, 8), vy: rnd(-3, 3), vz: rnd(18, 40), g: -6,
        life: rnd(0.6, 1.4), max: 1.4, s: 1, c: pick(['#ffd27a', '#ff8a3a', '#e2552f']), add: true, drag: 1.2 });
    }
  }
  // torn bits: they fly, turn, leave a trail of drops, bounce once and lie where they stop
  for (let i = J.gibs.length - 1; i >= 0; i--) {
    const b = J.gibs[i];
    b.vz -= 300 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.rot += b.spin * dt;
    b.trail -= dt;
    if (b.trail <= 0 && b.z > 2) {
      b.trail = 0.07;
      part({ x: b.x, y: b.y, z: b.z, vx: b.vx * 0.2, vy: b.vy * 0.2, vz: 0, g: 260, life: 1, max: 1, s: 1, c: pick(BLOOD), land: 1 });
    }
    if (b.z > 0) continue;
    b.z = 0;
    if (b.vz < -60) {
      b.vz *= -0.3;
      b.vx *= 0.5;
      b.vy *= 0.5;
      b.spin *= 0.5;
      continue;
    }
    const [ox, oy] = gibOff(b.rot);
    for (let k = 0; k < b.len; k++) stampPix(b.x + ox * k, b.y + oy * k, k ? b.c : b.c2);
    stampPix(b.x + rnd(-1, 1), b.y + 1, P.bl1);
    J.gibs[i] = J.gibs[J.gibs.length - 1];
    J.gibs.pop();
  }
  // chunks of the blast: a trail of smoke (or fire), a puff where they land
  for (let i = J.debris.length - 1; i >= 0; i--) {
    const b = J.debris[i];
    b.vz -= 320 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.trail -= dt;
    if (b.trail <= 0) {
      b.trail = 0.05;
      part({ x: b.x, y: b.y, z: b.z, vx: rnd(-2, 2), vy: rnd(-2, 2), vz: rnd(2, 6), g: 0, life: rnd(0.4, 0.7), max: 0.7, s: 2,
        c: b.fire ? 'rgba(60,50,44,0.55)' : 'rgba(80,72,64,0.45)', grow: 3, drag: 1, smoke: true });
      if (b.fire) part({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, g: 0, life: 0.18, max: 0.18, s: 1, c: pick(['#ffd27a', '#ff8a3a']), add: true });
    }
    if (b.z > 0) continue;
    stampPix(b.x, b.y, b.c, 2);
    part({ x: b.x, y: b.y, z: 0, vx: 0, vy: 0, vz: 4, g: 0, life: 0.6, max: 0.6, s: 3, c: pick(DUSTC), grow: 5, smoke: true });
    if (b.fire && flames.length < 30 && Math.random() < 0.5) flames.push({ x: b.x, y: b.y, life: rnd(1, 2.2), seed: rnd(100) });
    J.debris[i] = J.debris[J.debris.length - 1];
    J.debris.pop();
  }
  // pools grow one pixel every 0.12 s up to their size
  for (let i = J.pools.length - 1; i >= 0; i--) {
    const p = J.pools[i];
    p.t += dt;
    if (p.t < 0.12) continue;
    p.t = 0;
    const s = poolSpr(p.r);
    stampUnder(s, p.x - (s.width >> 1), p.y - (s.height >> 1), 0.8);
    if (++p.r > p.max) {
      J.pools[i] = J.pools[J.pools.length - 1];
      J.pools.pop();
    }
  }
  // coins bounce and wink out
  for (let i = J.coins.length - 1; i >= 0; i--) {
    const c = J.coins[i];
    c.t += dt;
    if (c.t >= c.T) {
      part({ x: c.x, y: c.y, z: c.z + 2, vx: 0, vy: 0, vz: 10, g: 0, life: 0.25, max: 0.25, s: 1, c: '#fff6c0', add: true });
      J.coins[i] = J.coins[J.coins.length - 1];
      J.coins.pop();
      continue;
    }
    c.vz -= 340 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt;
    if (c.z <= 0 && c.vz < 0) {
      c.z = 0;
      c.vz = c.b < 2 ? -c.vz * 0.45 : 0;
      c.vx *= 0.55;
      c.vy *= 0.55;
      c.b++;
      if (c.b <= 2) lights.push({ x: c.x, y: c.y, z: 1, r: 4, c: '#ffd24a', life: 0.08, max: 0.08, a: 0.7 });
    }
  }
  // golden zombies glint: a spark now and then rises off them
  if (G.up.gold) for (const z of G.zombies) {
    if (!z.gold || z.dead || Math.random() > dt * 9 || offView(z.x, z.y, 0)) continue;
    part({ x: z.x + rnd(-4, 4), y: z.y, z: rnd(2, z.S.h), vx: 0, vy: 0, vz: rnd(8, 16), g: 0, life: 0.5, max: 0.5, s: 1,
      c: pick(['#fff6c0', '#ffd24a']), add: true });
  }
}
// the pixel step of a gib turned to angle a (it lies along it)
function gibOff(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [Math.abs(c) > 0.38 ? Math.sign(c) : 0, Math.abs(s) > 0.38 ? Math.sign(s) : 0];
}

// ---------- drawing
// Torn bits, blast chunks and coins in the air (with their shadows), over the bodies.
function drawJuice() {
  const J = JUICE;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  for (const b of J.gibs) {
    const x = Math.round(b.x) - 1, y = Math.round(b.y);
    if (worldRectVisible(x, y, 3, 1)) ctx.fillRect(x, y, 3, 1);
  }
  for (const c of J.coins) {
    const x = Math.round(c.x) - 1, y = Math.round(c.y);
    if (worldRectVisible(x, y, 3, 1)) ctx.fillRect(x, y, 3, 1);
  }
  ctx.globalAlpha = 1;
  for (const b of J.gibs) {
    // Preserve the final drawing colour even when every pixel of this piece is outside the clip.
    if (offView(b.x, b.y - b.z, b.len + 8)) {
      if (b.len > 0) ctx.fillStyle = thermal ? (b.len > 1 ? '#e0e0e0' : '#c0c0c0') : b.len > 1 ? b.c : b.c2;
      continue;
    }
    const [ox, oy] = gibOff(b.rot), x = Math.round(b.x), y = Math.round(b.y - b.z);
    for (let k = 0; k < b.len; k++) {
      ctx.fillStyle = k ? (thermal ? '#e0e0e0' : b.c) : (thermal ? '#c0c0c0' : b.c2);
      ctx.fillRect(x + ox * k, y + oy * k, 1, 1);
    }
  }
  for (const b of J.debris) {
    ctx.fillStyle = b.fire && !thermal ? '#ff8a3a' : b.c;
    const x = Math.round(b.x), y = Math.round(b.y - b.z);
    if (worldRectVisible(x, y, 2, 2)) ctx.fillRect(x, y, 2, 2);
  }
  for (const c of J.coins) {
    const x = Math.round(c.x), y = Math.round(c.y - c.z) - 2, wob = ((realT * 14 + c.f) | 0) % 3;
    if (!worldRectVisible(x - 1, y - 1, 3, 3)) { ctx.fillStyle = '#fff1c2'; continue; }
    ctx.fillStyle = '#5a3e10';
    ctx.fillRect(x - 1, y - 1, wob === 1 ? 1 : 3, 3);
    ctx.fillStyle = '#e3b04b';
    ctx.fillRect(x - (wob === 1 ? 1 : 1), y - 1, wob === 1 ? 1 : 2, 2);
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(x - 1, y - 1, 1, 1);
  }
}
// The flash of a big blast, over everything in the world (drawn with 'lighter').
function drawJuiceTop() {
  if (JUICE.flash <= 0 || thermal) return;
  ctx.globalAlpha = Math.min(0.35, JUICE.flash * 3.5);
  ctx.fillStyle = '#ffcf9a';
  ctx.fillRect(G.camX - 16, G.camY - 16, W + 32, VH + 32);
  ctx.globalAlpha = 1;
}
