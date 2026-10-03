// skills.js - the first ring of the skill tree: things you SEE in a run. CHAIN SHOT (a 25mm kill
// sparks on to more zombies), the COW CATCHER (a steel plow on the engine that throws walkers and
// runners aside), GOLDEN ZOMBIES (rare gold ones that run away and pay big) and the ARMOR plates on
// the engine. Also the 25mm's kill feel: a short hit-stop when one round kills 3 or more.

// CHAIN SHOT: how far a spark jumps (px), its damage, seconds between two jumps.
// GOLDEN ZOMBIES: 1 in every[l] new zombies is golden at level l, the scrap one pays, its speed
// (px/s), and how near the heli or the train (px) it starts to run away.
const SK = {
  chain: { reach: 40, dmg: 1, gap: 0.04 },
  gold: { every: [0, 60, 40, 25], value: 25, speed: [26, 31], fear: 190 }
};
// What a level of the new nodes gives (the tree's info box shows the same numbers).
Object.assign(UP, {
  chain: (l) => l,                          // CHAIN SHOT: zombies a kill sparks on to
  gold: (l) => SK.gold.every[l] || 0        // GOLDEN ZOMBIES: 1 in this many (0 = none)
});
// A tutorial moment for part D's prompts (nothing happens when they are not there).
function skillEvent(name, data) {
  if (typeof tutEvent === 'function') tutEvent(name, data || {});
}

// ---------- one 25mm round's kills
// After a player round lands: a short hit-stop when it killed 3 or more, and each kill sparks on
// with CHAIN SHOT.
function roundKills(list) {
  if (G.demo || !list.length) return;
  if (list.length >= 3) hitStop(0.03);
  if (G.up.chain) for (const z of list) chainFrom(z, G.up.chain, [z]);
}

// ---------- CHAIN SHOT
// zaps = the lightning lines in the air: [x0, y0, x1, y1, seed, age]
const zaps = [];
// A spark jumps from zombie z0 to the nearest living one within reach (not hit by this chain yet),
// hurts it, and jumps on while left > 1.
function chainFrom(z0, left, hit) {
  let best = null, bd = SK.chain.reach + 1;
  queryEll(z0.x, z0.y, SK.chain.reach, (z, d) => {
    if (d < bd && !hit.includes(z)) { bd = d; best = z; }
  });
  if (!best) return;
  hit.push(best);
  const x0 = z0.x, y0 = z0.y - z0.S.h * 0.5, x1 = best.x, y1 = best.y - best.S.h * 0.5;
  zaps.push({ x0, y0, x1, y1, seed: (Math.random() * 1e6) | 0, t: 0, T: 0.18 });
  // a small flash and sparks where it lands
  lights.push({ x: x1, y: best.y, z: best.S.h * 0.5, r: 12, c: '#ffd24a', life: 0.12, max: 0.12, a: 0.9 });
  for (let k = 0; k < 4; k++) {
    const a = rnd(TAU), s = rnd(20, 50);
    part({ x: x1, y: best.y, z: best.S.h * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(10, 40), g: 120,
      life: rnd(0.15, 0.3), max: 0.3, s: 1, c: pick(['#fff6c0', '#ffd24a']), add: true, drag: 2 });
  }
  SFX.zap();
  if (hitZombie(best, SK.chain.dmg, 'chain') && !G.chainSeen) {
    G.chainSeen = true;
    skillEvent('chain_first');
  }
  if (left > 1) later(SK.chain.gap, () => chainFrom(best, left - 1, hit));
}
// The lightning: a jagged 1 px line that flickers (its kinks move every 0.04 s), white in the
// middle of a yellow glow, gone in 0.18 s.
function drawZaps() {
  ctx.globalCompositeOperation = 'source-over';
  drawPlow();
  for (const z of zaps) {
    const u = z.t / z.T, f = (z.t / 0.04) | 0, dx = z.x1 - z.x0, dy = z.y1 - z.y0, l = Math.hypot(dx, dy) || 1;
    const n = Math.max(2, Math.round(l / 6)), px = -dy / l, py = dx / l;
    let ax = z.x0, ay = z.y0;
    ctx.globalAlpha = 1 - u * 0.7;
    for (let i = 1; i <= n; i++) {
      const o = i === n ? 0 : (hrnd(z.seed, i, f) - 0.5) * 7;
      const bx = z.x0 + dx * i / n + px * o, by = z.y0 + dy * i / n + py * o;
      pl(ctx, ax, ay, bx, by, u < 0.4 ? '#ffffff' : '#ffe27a');
      ax = bx;
      ay = by;
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const z of zaps) light((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, 10, '#ffd24a', 0.4 * (1 - z.t / z.T));
  ctx.globalAlpha = 1;
}

// ---------- the COW CATCHER and the ARMOR plates
// The plow throws a walker or runner aside: it dies, and the train loses no health and no speed.
function plow(z) {
  kill(z, 'train', 0, 0, 0);
  for (let k = 0; k < 3; k++) part({ x: z.x, y: z.y, z: 2, vx: rnd(-40, 40), vy: rnd(-20, 10), vz: rnd(15, 45), g: 160,
    life: rnd(0.15, 0.3), max: 0.3, s: 1, c: pick(['#ffffff', '#ffe2a0']), add: true, drag: 2 });
  if (!G.demo) {
    addShake(0.04);
    SFX.clang();
  }
}
// Drawn on the engine (car c) after its sprite, at its heading: steel plates down both sides with
// rivets (from ARMOR 1; longer with more levels).
const KIT = (thermal) => (thermal ? ['#141414', '#3a3a3a', '#5a5a5a', '#3a3a3a'] : ['#16181c', '#5d636e', '#b8bec8', '#c8432e']);
const kpx = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
function drawEngineKit(c) {
  const up = G.up, k = kpx, st = KIT(thermal);
  if (up.armor) {
    const len = 4 + Math.min(5, up.armor) * 2;
    for (const s of [-1, 1]) for (let al = -len; al <= len; al++) {
      const x = c.cx + c.dx * al + c.nx * s * 8.5, y = c.cy + c.dy * al + c.ny * s * 8.5;
      k(x, y - 2, st[0]);
      k(x, y - 3, st[1]);
      k(x, y - 4, al % 5 === 0 ? st[2] : st[1]);
      k(x, y - 5, st[0]);
    }
  }
}

// The COW CATCHER: a steel plow round the engine's nose, a wedge of bars with its tip 10 px ahead
// and red on top at the point. (Drawn over the headlights' glow, so it always reads.)
function drawPlow() {
  if (!G.up.cow) return;
  const c = G.tr.cars[0], k = kpx, st = KIT(thermal);
  for (let u = -9; u <= 9; u += 0.5) {
    const f = 2 + (9 - Math.abs(u)) * 0.95, x = c.x0 + c.dx * f + c.nx * u, y = c.y0 + c.dy * f + c.ny * u;
    const bar = (Math.round(u * 2) & 3) < 2;
    k(x, y, st[0]);
    k(x, y - 1, bar ? st[2] : st[1]);
    k(x, y - 2, bar ? st[2] : st[1]);
    k(x, y - 3, Math.abs(u) < 3 ? st[3] : st[0]);
  }
}

// ---------- GOLDEN ZOMBIES
// A new zombie z is golden 1 time in G.up.gold (never a brute, never in the demo). Returns z.
function goldRoll(z) {
  if (G.demo || !G.up.gold || z.big || Math.random() * G.up.gold >= 1) return z;
  return makeGold(z);
}
// Turn zombie z golden. Returns z.
function makeGold(z) {
  z.gold = true;
  z.value = SK.gold.value;
  z.run = true;
  z.hp = z.max = 1;
  z.sp = rnd(SK.gold.speed[0], SK.gold.speed[1]);
  return z;
}
// Where a golden zombie runs: away from the heli (the middle of the view) and from the rails, when
// either is near; else it strolls out into the field. [x, y] on the ground.
const GF = [0, 0];
function goldFlee(z) {
  const F = SK.gold.fear, hx = G.camX + W / 2, hy = G.camY + H / 2;
  const ax = z.x - hx, ay = (z.y - hy) / FORE, ad = Math.hypot(ax, ay) || 1, side = z.x < trackX(z.y) ? -1 : 1;
  const rd = Math.abs(z.x - trackX(z.y));
  let vx = side * (rd < F ? 1.2 * (1 - rd / F) + 0.2 : 0.15), vy = -0.15;
  if (ad < F) {
    const w = 1.6 * (1 - ad / F) + 0.3;
    vx += ax / ad * w;
    vy += ay / ad * w;
  }
  GF[0] = z.x + vx * 60;
  GF[1] = z.y + vy * 60 * FORE;
  return GF;
}
// A golden zombie dies: a gold ring, a burst of gold, a shower of coins to the counter and a chime.
function goldKill(z, sc) {
  rings.push({ x: z.x, y: z.y, r0: 3, r1: 26, t: 0, T: 0.4, c: '#ffd24a', w: 2 });
  lights.push({ x: z.x, y: z.y, z: 6, r: 30, c: '#ffd24a', life: 0.3, max: 0.3, a: 0.9 });
  for (let k = 0; k < 16; k++) {
    const a = rnd(TAU), s = rnd(25, 80);
    part({ x: z.x, y: z.y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 90), g: 200, life: rnd(0.4, 0.8),
      max: 0.8, s: 1, c: pick(['#fff6c0', '#ffd24a', '#e3b04b']), add: true, drag: 1.5 });
  }
  if (!sc) return;
  for (let k = 0; k < 10 && coins.length < 60; k++) coins.push({ x0: z.x - G.camX + rnd(-5, 5), y0: z.y - G.camY - 8 + rnd(-4, 4), t: -k * 0.04, T: rnd(0.55, 0.8) });
  SFX.gold();
}
// A gold statue copy of sprite src: each pixel's brightness picks a shade of gold; the dark
// outline stays dark.
const GOLDS = [[42, 26, 6], [122, 84, 24], [184, 134, 42], [232, 184, 74], [255, 224, 138]];
function goldSpr(src) {
  const [c, g] = mk(src.width, src.height, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const L = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15, col = GOLDS[L < 34 ? 0 : L < 70 ? 1 : L < 110 ? 2 : L < 160 ? 3 : 4];
    d[i] = col[0];
    d[i + 1] = col[1];
    d[i + 2] = col[2];
  }
  g.putImageData(im, 0, 0);
  return c;
}
// The gold look: a golden copy of its frame (made once per clothes), and sparkles round it.
// Returns false when the plain frame must show (the white hit flash, the thermal camera).
function drawGold(z) {
  if (z.flash > 0 || thermal) return false;
  const S = z.S, f = (z.anim | 0) & 1;
  if (!S.gold) S.gold = S.walk.map((fr) => [goldSpr(fr.n), goldSpr(fr.nf)]);
  blit(S.gold[f][z.left ? 1 : 0], Math.round(z.x - S.ax), Math.round(z.y - S.ay));
  // two sparkles that blink round it
  for (let i = 0; i < 2; i++) {
    const p = (realT * 3 + i * 0.5 + (z.wob % 1)) % 1;
    if (p > 0.45) continue;
    const sx = Math.round(z.x + (hrnd(i, (realT * 3) | 0, z.sp * 100) - 0.5) * 12), sy = Math.round(z.y - S.h * hrnd(i + 7, (realT * 3) | 0, 3));
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(sx, sy, 1, 1);
    if (p < 0.25) {
      ctx.fillRect(sx - 1, sy, 3, 1);
      ctx.fillRect(sx, sy - 1, 1, 3);
    }
  }
  return true;
}

// ---------- each step
function updateSkills(dt) {
  for (let i = zaps.length - 1; i >= 0; i--) {
    zaps[i].t += dt;
    if (zaps[i].t >= zaps[i].T) zaps.splice(i, 1);
  }
  if (!G.up.gold) return;
  for (const z of G.zombies) {
    if (!z.gold || z.dead || offView(z.x, z.y, 0)) continue;
    // a soft gold glow
    lights.push({ x: z.x, y: z.y, z: 6, r: 12, c: '#ffd24a', life: 0.03, max: 0.03, a: 0.35 });
    if (!G.goldSeen && !offView(z.x, z.y, -24)) {
      G.goldSeen = true;
      floatText(z.x, z.y - z.S.h - 4, 'GOLD! ' + SK.gold.value + ' SCRAP', U.gold);
      SFX.coin();
      skillEvent('golden_seen');
    }
  }
}

// ---------- sounds
Object.assign(SFX, {
  zap() {
    // a short electric crack
    if (!gap('zap', 30)) return;
    tone(rnd(1500, 1900), 0.05, 'sawtooth', 0.012, 500);
    nz(0.05, 0.03, 'highpass', 3500, 0.8, 1800);
  },
  clang() {
    // the plow hits one: a steel knock
    if (!gap('clang', 40)) return;
    tone(rnd(700, 820), 0.08, 'square', 0.012, 380);
    nz(0.04, 0.03, 'bandpass', 1800, 2);
  },
  gold() {
    // a golden zombie falls: a bright chime up
    tone(1320, 0.08, 'triangle', 0.035);
    tone(1760, 0.08, 'triangle', 0.035, null, 0.07);
    tone(2640, 0.18, 'triangle', 0.03, null, 0.14);
  }
});
