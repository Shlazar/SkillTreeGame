// fx.js - the effects, in the Ball x Archers style: particles (dirt and blood land and stay on the
// ground as decal pixels), fire explosions made of pixel puffs, rings, glows, floating numbers,
// coins that fly to the cash counter, banners, screen shake and hit-stop, and the scorch marks.
// Positions are world pixels (x, y on the ground, z = height), except coins and banners (screen).

// ---------- shake, kick and hit-stop
const cam = { trauma: 0, t: 0, kx: 0, ky: 0 };
let shakeReq = 0, slowT = 0, slowK = 1;
// Ask for screen shake of strength a (weaker with reduced motion).
function addShake(a) {
  shakeReq = Math.max(shakeReq, a * (REDUCED ? 0.3 : 1));
}
// Slow motion for d seconds at time scale k (default 0.12). Off with reduced motion.
function hitStop(d, k) {
  if (REDUCED) return;
  slowT = Math.max(slowT, d);
  slowK = Math.min(slowK, k == null ? 0.12 : k);
}
// Knock the view by (x, y) pixels; it springs back fast. A gun's recoil.
function kick(x, y) {
  if (REDUCED) return;
  cam.kx = clamp(cam.kx + x, -3, 3);
  cam.ky = clamp(cam.ky + y, -3, 3);
}
function updateCam(dt) {
  cam.t += dt;
  cam.trauma = Math.min(1, cam.trauma + shakeReq * (1 - cam.trauma * 0.6));
  shakeReq = 0;
  cam.trauma = Math.max(0, cam.trauma - dt * 2);
  const k = Math.exp(-16 * dt);
  cam.kx *= k;
  cam.ky *= k;
}
// Screen shake offset [x, y]. Strength = trauma squared; two sine waves per axis, plus the kick.
function shakeOff() {
  const s = cam.trauma * cam.trauma * 5;
  return [Math.round((Math.sin(cam.t * 71.3) + Math.sin(cam.t * 37.9) * 0.6) * s * 0.6 + cam.kx),
    Math.round((Math.sin(cam.t * 53.1 + 1.3) + Math.sin(cam.t * 29.7) * 0.6) * s * 0.6 + cam.ky)];
}

// ---------- effect lists
const parts = [], lights = [], booms = [], rings = [], texts = [], banners = [], coins = [], flames = [];
function clearFX() {
  for (const a of [parts, lights, booms, rings, texts, banners, coins, flames]) a.length = 0;
  clearDecals();
}

// Add one particle (o itself becomes the particle). Returns null when a limit is hit: 2600
// particles in all and about 260 glowing ("add") ones. o = {x, y, z, vx, vy, vz, g (gravity),
// life, max, s (size), c (color), add (glows), land (1 = becomes a ground pixel when it lands),
// drag, grow, smoke (fades softly)}.
let ADD = 0;
function part(o) {
  if (parts.length >= 2600) return null;
  if (o.add) {
    if (ADD >= 260) return null;
    ADD++;
  }
  if (o.land === undefined) o.land = 0;
  parts.push(o);
  return o;
}

// A fire explosion: R = size in px, n puffs, T seconds, cap = biggest puff radius,
// delay = seconds before it starts.
function addBoom(x, y, R, n, T, cap, delay) {
  const pf = [];
  for (let i = 0; i < n; i++) pf.push({ a: i * TAU / n + rnd(-0.5, 0.5), d: rnd(0.2, 0.45), s: rnd(0.42, 0.6), up: rnd(0.3, 0.6) });
  booms.push({ x, y, r: R, t: -(delay || 0), T, cap: cap || 7, pf });
}

// A floating "+N" over (x, y) ("-N" when neg: damage). A total close to a recent one of the same
// color adds up instead.
function addTotal(x, y, v, c, big, neg) {
  const sign = neg ? '-' : '+';
  for (const t of texts) {
    if (t.tot && t.c === c && t.sign === sign && t.life > t.max * 0.35 && Math.abs(t.x - x) < 24 && Math.abs(t.y - y) < 18) {
      t.val += v;
      t.v = sign + fmt(t.val);
      t.life = t.max;
      t.hot = 0.05;
      if (t.val >= 20) t.s = 2;
      return;
    }
  }
  if (texts.length >= 40) return;
  texts.push({ tot: true, sign, x, y, z: 16, vz: big ? 40 : 28, vx: 0, s: big ? 2 : 1, c, val: v, v: sign + fmt(v),
    life: big ? 1 : 0.75, max: big ? 1 : 0.75, hot: 0.06 });
}
// A word that floats up from (x, y), like OVERHEAT.
function floatText(x, y, s, c) {
  if (texts.length >= 40) return;
  texts.push({ x, y, z: 18, vz: 22, vx: 0, s: 1, c, v: s, life: 0.9, max: 0.9, hot: 0.05 });
}

// A big banner: a = title, b = subtitle, c = color. pri = priority: a newer banner does not
// replace a young one (under 0.6 s) with a higher priority.
function banner(a, b, c, pri) {
  pri = pri || 0;
  const o = banners[0];
  if (o && o.t < 0.6 && (o.pri || 0) > pri) return;
  banners.length = 0;
  banners.push({ a, b: b || '', c: c || U.ink, t: 0, T: 2.2, pri });
  SFX.banner();
}

// ---------- update
function updateFX(dt) {
  ADD = 0;
  // particles: gravity, drag, growth. A falling particle with land = 1 becomes a ground pixel
  // when it lands; the others stop and slide.
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    if (p.add) ADD++;
    p.vz -= (p.g || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.drag) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      if (!p.g) p.vz *= k;
    }
    if (p.grow) p.s += p.grow * dt;
    if (p.g > 0 && p.z <= 0 && p.vz < 0) {
      p.z = 0;
      if (p.land === 1) {
        stampPix(p.x, p.y, p.c, p.s | 0 || 1);
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      p.vz = 0;
      p.vx *= 0.6;
      p.vy *= 0.6;
    }
  }
  // lights, explosions and rings only age and go
  for (let i = lights.length - 1; i >= 0; i--) {
    lights[i].life -= dt;
    if (lights[i].life <= 0) {
      lights[i] = lights[lights.length - 1];
      lights.pop();
    }
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    booms[i].t += dt;
    if (booms[i].t >= booms[i].T) booms.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].t += dt;
    if (rings[i].t >= rings[i].T) rings.splice(i, 1);
  }
  // floating texts rise and slow down
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    if (t.hot > 0) t.hot -= dt;
    t.z += t.vz * dt;
    t.vz -= 70 * dt;
    t.x += t.vx * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
  // coins fly to the cash counter; when one gets there the counter jumps
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt;
    if (c.t >= c.T) {
      coins.splice(i, 1);
      if (G) G.cashPulse = 1;
      if (G && !G.demo) SFX.coin();
    }
  }
  // small fires left by the 105: tongues of flame, embers and smoke
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i];
    f.life -= dt;
    if (f.life <= 0) {
      flames.splice(i, 1);
      continue;
    }
    if (Math.random() < dt * 5) part({ x: f.x + rnd(-1.5, 1.5), y: f.y, z: rnd(2, 4), vx: rnd(-4, 4), vy: rnd(-2, 2), vz: rnd(14, 26),
      g: -4, life: rnd(0.4, 0.8), max: 0.8, s: 1, c: pick(['#ffc27a', '#ff8a3a', '#e2552f']), add: true, drag: 1.5 });
    if (Math.random() < dt * 1.6) part({ x: f.x + rnd(-1, 1), y: f.y, z: 5, vx: rnd(3, 8), vy: rnd(-2, 2), vz: rnd(7, 12),
      g: 0, life: rnd(1.4, 2.2), max: 2.2, s: rnd(2, 3), c: pick(['rgba(92,88,84,0.55)', 'rgba(120,116,110,0.45)']), grow: 2.5, drag: 0.4, smoke: true });
  }
}

// ---------- marks on the ground
// SCORCH[k]: a dark dithered ellipse, radius 4 (a 25mm round), 9, 16 and 24 (the 105 crater with
// a rim of thrown-up earth).
const SCORCH = [];
function bakeScorch() {
  SCORCH.length = 0;
  for (const R of [4, 9, 16, 24]) {
    const Ry = Math.round(R * FORE), rg = mulberry(R * 7 + 1), w = R * 2 + 3, h = Ry * 2 + 3;
    SCORCH.push(pix(w, h, (r) => {
      for (let y = -Ry - 1; y <= Ry + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
        const d = Math.hypot(x / R, y / Ry) + (rg() - 0.5) * 0.2, X = x + R + 1, Y = y + Ry + 1;
        if (d > 1.08) continue;
        if (d > 0.88) {
          if (R > 8 && rg() < 0.6) r(X, Y, 1, 1, rg() < 0.5 ? 'rgba(96,80,58,0.85)' : 'rgba(64,53,41,0.85)');
          continue;
        }
        if (R > 8 && d < 0.55) r(X, Y, 1, 1, d < 0.3 ? 'rgba(8,6,5,0.82)' : 'rgba(16,12,9,0.72)');
        else if ((1 - d) * 1.8 > bayer(X, Y) + 0.1) r(X, Y, 1, 1, d < 0.45 ? 'rgba(12,9,7,0.62)' : 'rgba(26,19,13,0.5)');
      }
    }));
  }
}
function stampScorch(x, y, k) {
  const s = SCORCH[k];
  stampSpr(s, x - (s.width >> 1), y - (s.height >> 1), 1);
}
// One of the 2 corpse images of zombie sprite set S, with its pool of blood.
function stampCorpse(S, x, y) {
  stampSpr(S.corpses[(Math.random() * 2) | 0], x - S.cax, y - S.cay, 0.9);
  bloodPool(x, y, S);
}

// ---------- drawing (world layer, under the camera transform)
// Explosion colors, from white hot through yellow and orange to grey smoke (5 to 7).
const BC = ['#ffffff', '#fff3b0', '#ffd25a', '#ffa23a', '#f0702a', '#8f8a83', '#aca79f', '#cac5bd'];

// Particles. add = true: only the glowing ones (drawn with 'lighter'), false: only the others.
function drawParts(add) {
  // (the alpha in eighths, and the colour and alpha only set when they change: most are drops of
  // blood and dirt at full alpha, so a thousand of them cost little)
  let la = -1, lc = '';
  for (const p of parts) {
    if (!!p.add !== add) continue;
    const a = add || p.smoke ? clamp(Math.ceil((p.smoke ? Math.min(1, p.life / p.max * 1.5) : p.life / p.max) * 8) / 8, 0, 1) : 1;
    if (a !== la) { ctx.globalAlpha = la = a; }
    if (p.c !== lc) { ctx.fillStyle = lc = p.c; }
    const s = Math.max(1, Math.round(p.s));
    // (a big puff of smoke is round)
    if (p.smoke && s >= 5) pcirc(p.x, p.y - p.z, s / 2, p.c);
    else ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - p.z - s / 2), s, s);
  }
  ctx.globalAlpha = 1;
}
// Fire explosions: a white flash with a yellow edge, then fat puffs (white hot in the middle,
// yellow and orange outside) that swell, rise and cool into grey smoke.
function drawBooms() {
  const many = booms.length > 10;
  for (const b of booms) {
    if (b.t < 0) continue;
    const u = b.t / b.T, e = 1 - Math.pow(1 - u, 3);
    if (u < 0.06) {
      const r = Math.min(b.cap, b.r * 0.45);
      pcirc(b.x, b.y - 3, r + 1, '#ffd25a');
      pcirc(b.x, b.y - 3, r, '#ffffff');
      continue;
    }
    const fade = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    const n = many ? Math.min(3, b.pf.length) : b.pf.length;
    // three passes, so the puffs read as one ball: a deep orange rim under the fire (a soft grey
    // one under the smoke), the puffs (the outer ones cool first), then their lit tops with a
    // white-hot heart while it is young
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) {
      const p = b.pf[i], k = 0.55 + 0.7 * e, ci = clamp((u * 10 + (p.d - 0.32) * 5) | 0, 0, 7);
      const px = b.x + Math.cos(p.a) * b.r * p.d * k,
        py = b.y - 3 + Math.sin(p.a) * b.r * p.d * k * FORE - b.r * p.up * e,
        pr = Math.min(b.cap, b.r * p.s * (0.55 + 0.35 * e)) * (0.6 + 0.4 * fade);
      if (pr < 1) continue;
      const fire = ci < 5;
      if (pass === 0) {
        ctx.globalAlpha = fire ? 1 : 0.3 * fade;
        pcirc(px + 1, py + 1, pr + 1, fire ? '#c2401a' : '#5e5a55');
      } else if (pass === 1) {
        ctx.globalAlpha = fire ? 1 : 0.7 * fade;
        pcirc(px, py, pr, BC[ci]);
      } else if (fire) {
        ctx.globalAlpha = 1;
        pcirc(px - pr * 0.3, py - pr * 0.35, pr * 0.55, BC[Math.max(0, ci - 1)]);
        if (ci < 3) pcirc(px - pr * 0.36, py - pr * 0.42, pr * 0.25, '#ffffff');
      } else {
        ctx.globalAlpha = 0.5 * fade;
        pcirc(px - pr * 0.3, py - pr * 0.35, pr * 0.5, BC[7]);
      }
    }
    ctx.globalAlpha = 1;
  }
}
// Rings that grow on the ground and fade (draw with 'lighter').
function drawRings() {
  for (const r of rings) {
    const u = r.t / r.T, rr = lerp(r.r0, r.r1, 1 - Math.pow(1 - u, 2));
    ctx.globalAlpha = 1 - u;
    pell(r.x, r.y, rr, rr * FORE, r.c);
    if (r.w > 1) pell(r.x, r.y, rr - 1, (rr - 1) * FORE, r.c);
  }
  ctx.globalAlpha = 1;
}
// Effect glows (draw with 'lighter').
function drawLights() {
  for (const l of lights) light(l.x, l.y - l.z, l.r, l.c, l.a * (l.life / l.max));
  ctx.globalAlpha = 1;
}
// Floating numbers and words.
function drawTexts() {
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1);
    text(t.v, t.x, t.y - t.z, t.hot > 0 ? '#ffffff' : t.c, { align: 'center', scale: t.s });
  }
  ctx.globalAlpha = 1;
}
// A small fire: a flickering flame of a few pixels (big = a burning wreck).
function drawFlame(x, y, big, seed) {
  const f = Math.sin(realT * 19 + seed) * 0.5 + Math.sin(realT * 31 + seed * 1.7) * 0.5;
  const g = Math.sin(realT * 23 + seed * 3.1);
  x = Math.round(x);
  y = Math.round(y);
  if (big) {
    ctx.fillStyle = '#c9772f';
    ctx.fillRect(x - 4, y - 1, 9, 1);
    ctx.fillStyle = '#e2552f';
    ctx.fillRect(x - 3, y - 5, 7, 4);
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(x - 2, y - 7 - (f > 0 ? 1 : 0), 5, 6);
    ctx.fillStyle = '#ffcf6a';
    ctx.fillRect(x - 1, y - 5, 3, 4);
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(x, y - 3, 1, 2);
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(x - 1 + (f > 0.2 ? 1 : 0), y - 10 - (g > 0 ? 1 : 0), 2, 3);
    ctx.fillStyle = '#e2552f';
    ctx.fillRect(x + (f < -0.2 ? -2 : 2), y - 12 - (g > 0.5 ? 1 : 0), 1, 2);
    ctx.fillRect(x + (g < 0 ? -3 : 3), y - 8, 1, 1);
  } else {
    ctx.fillStyle = '#c9772f';
    ctx.fillRect(x - 2, y - 1, 5, 1);
    ctx.fillStyle = '#ffcf6a';
    ctx.fillRect(x - 1, y - 3, 3, 2);
    ctx.fillStyle = '#ff8a3a';
    ctx.fillRect(x - 1 + (f > 0.2 ? 1 : 0), y - 5 - (f > 0 ? 1 : 0), 2, 2);
    ctx.fillStyle = '#e2552f';
    ctx.fillRect(x + (f < -0.2 ? -1 : 1), y - 7, 1, 1);
  }
}

// ---------- drawing (screen layer)
// Coins on a curve from where the zombie fell to the cash counter (top left).
function drawCoins() {
  for (const c of coins) {
    if (c.t < 0) continue;
    const u = ease(c.t / c.T);
    const x = lerp(c.x0, 9, u) + Math.sin(u * Math.PI) * -20, y = lerp(c.y0, 8, u) - Math.sin(u * Math.PI) * 30;
    // one step in three the coin is drawn thin, so it seems to spin
    const wob = ((realT * 16 + c.x0) | 0) % 3;
    ctx.fillStyle = '#7a5a1c';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, wob === 1 ? 1 : 3, 3);
    ctx.fillStyle = '#f6dc8e';
    ctx.fillRect(Math.round(x) - (wob === 1 ? 0 : 1), Math.round(y) - 1, 1, 1);
  }
}
// Banners fade in and slide down, stay, then fade out (timed with the real frame time).
function drawBanners() {
  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i];
    b.t += frameDt;
    const u = b.t / b.T;
    if (u >= 1) {
      banners.splice(i, 1);
      continue;
    }
    const a = u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1;
    const dy = Math.round(u < 0.1 ? (1 - u / 0.1) * -6 : 0), y = 58 + dy, h = b.b ? 40 : 28;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(5,6,8,0.55)';
    ctx.fillRect(0, y, W, h);
    ctx.fillStyle = b.c;
    ctx.globalAlpha = a * 0.6;
    ctx.fillRect(0, y, W, 1);
    ctx.fillRect(0, y + h - 1, W, 1);
    ctx.globalAlpha = a;
    text(b.a, W / 2, y + 6, b.c, { align: 'center', scale: 2, drop: true });
    if (b.b) text(b.b, W / 2, y + 26, U.dim, { align: 'center' });
  }
  ctx.globalAlpha = 1;
}
