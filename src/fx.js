/* Weapon effects and the per-frame overlay, after Isle Express: muzzle-hot tracers, sparks,
 * fireballs, rings of dust, smoke lit by the fire under it. Every shape follows its effect's own
 * age and seed, so a frame never depends on the ones before. */

const FLASH_C = ramp(['#ffffff', '#fff3b8', '#ffc24a', '#f5782a']);
const TRACER_C = ramp(['#ffffff', '#fff8dc', '#ffe28a', '#ffb347', '#f07a2e']);
const SPARK_C = ramp(['#ffffff', '#fff4c0', '#ffd25a', '#ffa23a', '#f0642a', '#b8401e', '#6e2418']);
const EMBER_C = ramp(['#fff3b0', '#ffc24a', '#ff8a2a', '#d4461c', '#8a2a16']);
const DEBRIS_C = ramp(['#9a9084', '#5d564f', '#35302c']);
const DIRT_C = ramp(['#7d5c3e', '#5b4332', '#3e2e24']);
const GIB_C = ramp(['#9aab82', '#8a1f1c', '#5a1414']);
const BLOOD_C = ramp(['#b02a22', '#8a1f1c', '#5a1414']);
const FIRE = ramp(['#fffbe6', '#fff0a8', '#ffd24a', '#ffa030', '#f06a22', '#c83c1c', '#8a2616', '#4a1c14', '#2a1a1a']);
const BLAST_C = ramp(['#ffffff', '#fff6cc', '#ffe07a', '#ffb347', '#f07a2a', '#b84a22', '#6a3024', '#3a2622', '#241c1c']);
const RING_DUST = packHex('#8c8274'), EMBER = packHex('#ff8a2a');
const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
const UI_INK = packHex('#fff4d6'), UI_DIM = packHex('#8a8a9c'), UI_DARK = packHex('#0a0c14'), UI_HOT = packHex('#ff7a4a'), UI_GOLD = packHex('#ffd35a');

function fxPut(x, y, c, dep, glow) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) spritePx(y * W + x, c, dep, glow);
}
// colour c over what the overlay already holds at i, at opacity a
function fxOver(i, c, a, dep, glow) {
  if (a <= 0.01 || staticDepth(i % W, (i / W) | 0) > dep + 0.6) return;
  const o = out[i], oa = (o >>> 24) / 255, na = a + oa * (1 - a), k = oa * (1 - a) / na;
  const r = (c & 255) + ((o & 255) - (c & 255)) * k, g = ((c >> 8) & 255) + (((o >> 8) & 255) - ((c >> 8) & 255)) * k;
  const b = ((c >> 16) & 255) + (((o >> 16) & 255) - ((c >> 16) & 255)) * k;
  out[i] = (Math.round(r) | Math.round(g) << 8 | Math.round(b) << 16 | Math.round(na * 255) << 24) >>> 0;
  if (GLOW[i] !== 255) GLOW[i] = Math.min(254, Math.round(GLOW[i] * (1 - a) + glow * a));
}
function line2(x0, y0, x1, y1, fn) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, k = 0;
  const n = Math.max(dx, -dy);
  for (let guard = 0; guard < 4000; guard++) {
    if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) fn(y0 * W + x0, k, n);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    k++;
  }
}
// a spark: a short streak back along its motion, white at the head, cooling down its tail and as it ages
function drawSpark(x, y, z, vx, vy, vz, u, dep) {
  const k = 0.02 + 0.02 * (1 - u), cool = Math.floor(u * 3.5);
  const hx = scrX(x, y), hy = scrY(x, y, z), tx = scrX(x - vx * k, y - vy * k), ty = scrY(x - vx * k, y - vy * k, z - vz * k);
  line2(hx, hy, tx, ty, (i, j, n) => {
    if (u > 0.55 && bay[i] < (u - 0.55) / 0.45) return;
    const ci = Math.min(6, cool + (n ? Math.round(j / n * 2) : 0));
    spritePx(i, SPARK_C[ci], dep, ci < 3 ? 235 : 150);
  });
}
// a tongue of flame standing on screen (sx, sy), h pixels tall, its tip swaying
function flameTongue(sx, sy, h, sway, dep, heat) {
  const root = heat > 0.66 ? 1 : heat > 0.33 ? 2 : 3;
  for (let j = 0; j < h; j++) {
    const u = h > 1 ? j / (h - 1) : 0, x = sx + Math.round(sway * u * u), y = sy - j;
    const ci = Math.min(8, root + Math.floor(u * 3.6)), glow = Math.max(40, 235 - ci * 26);
    fxPut(x, y, FIRE[ci], dep + j * 0.4, glow);
    if (u < 0.5) fxPut(x + 1, y, FIRE[Math.min(8, ci + 1)], dep + j * 0.4, glow - 30);
  }
}
// the white-hot instant of a hit: a core with rays that shrink away (u 0 to 1)
function hitFlash(x, y, dep, u, size) {
  x = Math.round(x); y = Math.round(y);
  fxPut(x, y, FLASH_C[0], dep, 250);
  const reach = Math.max(1, Math.round((size + 1) * (1 - u)));
  for (let k = 1; k <= reach; k++) for (const [dx, dy] of CROSS) fxPut(x + dx * k, y + dy * k, FLASH_C[k > 1 ? 2 : 1], dep, 230);
  if (size > 1 && u < 0.5) for (const [dx, dy] of DIAG) fxPut(x + dx, y + dy, FLASH_C[1], dep, 220);
}
const FX_PART = {
  ember(p, u, dep) {
    const flick = (Math.floor(p.age * 24) + p.shade) % 3 === 0, ci = Math.min(4, Math.floor(u * 3.2) + (flick ? 1 : 0));
    fxPut(scrX(p.x, p.y), scrY(p.x, p.y, p.z), EMBER_C[ci], dep, Math.round((flick ? 120 : 200) * (1 - u * 0.5)));
  },
  flame(p, u, dep) {
    const x = Math.round(scrX(p.x, p.y)), y = Math.round(scrY(p.x, p.y, p.z)), ci = Math.min(6, 1 + Math.floor(u * 5));
    const glow = Math.round(220 * (1 - u * 0.7));
    fxPut(x, y, FIRE[ci], dep, glow);
    if (u < 0.7) { fxPut(x, y - 1, FIRE[ci + 1], dep, glow - 30); fxPut(x + 1, y, FIRE[ci + 1], dep, glow - 40); }
  },
  debris(p, u, dep) {
    const x = Math.floor(scrX(p.x, p.y)), y = Math.floor(scrY(p.x, p.y, p.z)), turn = Math.floor(p.age * 14) & 3, hot = p.hot && u < 0.7;
    for (let k = 0; k < 4; k++) {
      const lit2 = k === turn, c = lit2 ? (hot ? EMBER_C[1 + Math.floor(u * 3)] : DEBRIS_C[0]) : DEBRIS_C[k === (turn + 2) % 4 ? 2 : 1];
      fxPut(x + (k & 1), y + (k >> 1), c, dep, lit2 && hot ? 180 : 0);
    }
  },
  dirt(p, u, dep) {
    const x = Math.floor(scrX(p.x, p.y)), y = Math.floor(scrY(p.x, p.y, p.z));
    fxPut(x, y, DIRT_C[p.shade % 3], dep, 0);
    if (p.big) { fxPut(x + 1, y, DIRT_C[(p.shade + 1) % 3], dep, 0); fxPut(x, y + 1, DIRT_C[2], dep, 0); }
  },
  gib(p, u, dep) {
    const x = Math.floor(scrX(p.x, p.y)), y = Math.floor(scrY(p.x, p.y, p.z)), turn = Math.floor(p.age * 12) & 1;
    fxPut(x, y, GIB_C[p.shade % 3], dep, 0);
    fxPut(x + 1 - turn, y + turn, GIB_C[1], dep, 0);
  },
  blood(p, u, dep) { fxPut(scrX(p.x, p.y), scrY(p.x, p.y, p.z), BLOOD_C[p.shade % 3], dep, 0); },
};

/* ------------------------------------------------------------- rounds */
// A round from the gunship: a white-hot head streaking in from the sky towards its target, its
// tail cooling to orange behind it.
function drawTracer(tr) {
  const a = tr.a, b = tr.b, u = clamp(tr.age / tr.travel, 0, 1), tail = Math.max(0, u - (tr.kind === 'he' ? 0.12 : 0.22));
  const hx = lerp(a[0], b[0], u), hy = lerp(a[1], b[1], u), hz = lerp(a[2], b[2], u);
  const qx = lerp(a[0], b[0], tail), qy = lerp(a[1], b[1], tail), qz = lerp(a[2], b[2], tail);
  const x0 = scrX(qx, qy), y0 = scrY(qx, qy, qz), x1 = scrX(hx, hy), y1 = scrY(hx, hy, hz);
  const thick = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? W : 1, fat = tr.kind === 'he';
  line2(x0, y0, x1, y1, (i, k, n) => {
    const v = n ? 1 - k / n : 0;                       // 0 at the head, 1 at the tail end
    if (v > 0.75 && bay[i] < (v - 0.75) / 0.25) return;
    const ci = Math.min(4, Math.floor(v * 4.5));
    out[i] = TRACER_C[ci]; GLOW[i] = ci < 2 ? 245 : 200;
    if ((fat || v < 0.35) && i + thick < N) { out[i + thick] = TRACER_C[Math.min(4, ci + 1)]; GLOW[i + thick] = 190; }
  });
  if (fat) {                                           // the shell itself: a red-hot slug
    const x = Math.round(x1), y = Math.round(y1);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const q = dx * dx + dy * dy;
      if (q > 5 || x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H) continue;
      const i = (y + dy) * W + x + dx;
      out[i] = q <= 1 ? FIRE[0] : q <= 2 ? FIRE[2] : FIRE[3]; GLOW[i] = q <= 2 ? 245 : 190;
    }
  }
}

/* ------------------------------------------------------------- blasts */
// a ring racing out over the ground: a bright leading edge, then a band of dust
function drawBoomRing(b) {
  const T = b.age, dur = 0.42;
  if (T >= dur) return;
  const u = T / dur, reach = b.radius * 1.55;
  const rr = 4 + (reach - 4) * (1 - (1 - u) * (1 - u) * (1 - u)), n = Math.ceil(TAU * rr * SC * 1.2);
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
    for (let w = 0; w < 2; w++) {
      const r = rr - w * (1 + 2 * u), x = b.x + ca * r, y = b.y + sa * r;
      const sx = Math.round(scrX(x, y)), sy = Math.round(scrY(x, y, 0.8));
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = sy * W + sx;
      if (bay[i] < u * u * (w ? 1.6 : 1)) continue;
      spritePx(i, w ? RING_DUST : BLAST_C[u < 0.25 ? 0 : u < 0.5 ? 1 : 3], depth(x, y, 0.8) + 1.5, w ? 0 : Math.round(210 * (1 - u)));
    }
  }
}
function blastFlash(b, u, sc) {
  const z = 3, cx = scrX(b.x, b.y), cy = scrY(b.x, b.y, z), dep = depth(b.x, b.y, z) + 6;
  const r = Math.max(2, Math.round((4 + 6 * sc) * (1 - 0.5 * u))), len = (10 + 14 * sc) * (1 - 0.4 * u);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const q = (dx * dx + dy * dy) / (r * r);
    if (q <= 1) fxPut(cx + dx, cy + dy, FLASH_C[q < 0.5 ? 0 : 1], dep, 250);
  }
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8 + rnd(b.seed, k, 71) * 0.35, l = len * (0.6 + 0.5 * rnd(b.seed, k, 72)), c = Math.cos(a), s = Math.sin(a) * 0.8;
    line2(cx + c * r, cy + s * r, cx + c * l, cy + s * l, (i, j, n) => {
      if (n && j / n > 1 - u * 0.8) return;
      spritePx(i, FLASH_C[n && j / n > 0.5 ? 2 : 1], dep, 230);
    });
  }
}
// a fireball of a core and lobes bursting out of it that swell, roll upward and burn from white
// through yellow and orange to red before fading into the smoke column
const BOOM_LOBES = [];
function drawBoom(b) {
  const t = b.age, sc = b.scale || 1, pal = BLAST_C;
  if (t < 0.1) blastFlash(b, t / 0.1, sc);
  if (t >= 0.85) return;
  const grow = 1 - Math.pow(1 - Math.min(1, t / 0.16), 3), die = smoothstep(0.3, 0.85, t);
  const R = (15 * (0.3 + 0.7 * grow) * (1 + 0.3 * Math.max(0, t - 0.16)) * (1 - 0.55 * die) + (t < 0.05 ? 7 : 0)) * sc;
  const zc = 2 + R * 0.5 + t * 12, heat = Math.max(0, 1 - t / 0.75) * (1 - 0.4 * die);
  const L = BOOM_LOBES;
  L.length = 0;
  for (let k = 0; k <= 4; k++) {
    let x = b.x, y = b.y, z = zc, r = R, h = heat;
    if (k) {
      const lag = 0.02 + 0.04 * rnd(b.seed, k, 63), g = 1 - Math.pow(1 - clamp((t - lag) / 0.16, 0, 1), 3);
      if (g <= 0) continue;
      const a = rnd(b.seed, k, 61) * TAU, d = R * (0.45 + 0.3 * rnd(b.seed, k, 62)) * g;
      x += Math.cos(a) * d; y += Math.sin(a) * d; z += R * (rnd(b.seed, k, 64) - 0.2) * 0.7 + t * 8;
      r = R * (0.45 + 0.25 * rnd(b.seed, k, 65)) * g; h = heat * (0.9 - 0.25 * rnd(b.seed, k, 66));
    }
    L.push({ cx: scrX(x, y), cy: scrY(x, y, z), cd: depth(x, y, z), r, rs: r * SC, h });
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (const l of L) { x0 = Math.min(x0, l.cx - l.rs); x1 = Math.max(x1, l.cx + l.rs); y0 = Math.min(y0, l.cy - l.rs); y1 = Math.max(y1, l.cy + l.rs); }
  x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(W - 1, Math.ceil(x1)); y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
  const alpha = 1 - die;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let best = null, bq = 1;
    for (const l of L) {
      const dx = x + 0.5 - l.cx, dy = y + 0.5 - l.cy, q = Math.sqrt(dx * dx + dy * dy) / l.rs;
      if (q < bq) { bq = q; best = l; }
    }
    if (!best) continue;
    const edge = 0.78 + 0.22 * noise2(x * 0.2 + b.seed, y * 0.2 - t * 4, 5);
    if (bq >= edge) continue;
    const i = y * W + x;
    const qn = bq / edge, h = best.h * (1.2 - 0.95 * qn * qn) - 0.25 * noise2(x * 0.3 + b.seed, y * 0.3 + t * 9, 9) + (t < 0.05 ? 1 : 0);
    const lv = clamp(Math.floor((1 - h) * 7.5 + bay[i] * 0.8), 0, 7), c = pal[lv], g = lv < 5 ? 235 - lv * 30 : 0;
    if (staticDepth(x, y) > best.cd + best.r * Math.sqrt(1 - qn * qn) + 0.6) continue;
    if (alpha >= 1) { out[i] = c; GLOW[i] = g; continue; }
    out[i] = ((c & 0xffffff) | (Math.round(alpha * 255) << 24)) >>> 0;
    GLOW[i] = Math.round(g * alpha);
  }
}
// scorched ground still glowing: embers flicker in a fresh crater for a few seconds
function drawHotScorches(list) {
  for (const s of list) {
    const hot = Math.max(0, 1 - s.age / 2.5);
    if (hot <= 0) continue;
    const fr = Math.floor(s.age * 8), cx = scrX(s.x, s.y), cy = scrY(s.x, s.y, 0), R = s.r * SC;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R * 0.5)), y1 = Math.min(H - 1, Math.ceil(cy + R * 0.5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / (R * 0.5), q = dx * dx + dy * dy;
      if (q >= 0.8 || rnd(x + VIEW.x, y + VIEW.y, s.seed + fr) >= 0.09 * hot * (1 - q)) continue;
      spritePx(y * W + x, EMBER, staticDepth(x, y) + 0.1, 190);
    }
  }
}

/* -------------------------------------------------------------- smoke */
const smokeA = new Float32Array(N), smokeK = new Float32Array(N), smokeH = new Float32Array(N), smokeW = new Float32Array(N);
const SMY = [H, -1];
const SMR0 = new Int16Array(H).fill(W), SMR1 = new Int16Array(H).fill(-1);
// one soft round puff: al opacity, dark 0 (plain smoke) to 1 (soot), heat 0-1 still lit by its
// fire, warm the lamplight reaching it
function smokePuff(x, y, z, r, al, dark, heat, warm) {
  const rs = r * SC, cx = scrX(x, y), cy = scrY(x, y, z), cd = depth(x, y, z);
  const x0 = Math.max(0, Math.floor(cx - rs)), x1 = Math.min(W - 1, Math.ceil(cx + rs));
  const y0 = Math.max(0, Math.floor(cy - rs)), y1 = Math.min(H - 1, Math.ceil(cy + rs));
  if (x0 > x1 || y0 > y1 || al <= 0) return;
  const inv = 1 / (rs * rs);
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
    const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, d2 = (dx * dx + dy * dy) * inv;
    if (d2 >= 1) continue;
    if (staticDepth(xx, yy) > cd + r * 0.5) continue;
    const i = yy * W + xx, a = al * (1 - d2);
    smokeA[i] += a;
    if (dark) smokeK[i] += a * dark;
    if (heat) smokeH[i] += a * heat;
    if (warm) smokeW[i] += a * warm;
  }
  for (let yy = y0; yy <= y1; yy++) { if (x0 < SMR0[yy]) SMR0[yy] = x0; if (x1 > SMR1[yy]) SMR1[yy] = x1; }
  if (y0 < SMY[0]) SMY[0] = y0; if (y1 > SMY[1]) SMY[1] = y1;
}
const SOOT_C = [40, 38, 44];
function drawSmoke() {
  for (let y = SMY[0]; y <= SMY[1]; y++) for (let x = SMR0[y], x1 = SMR1[y]; x <= x1; x++) {
    const i = y * W + x, A = smokeA[i], K = smokeK[i], Ht = smokeH[i], Wm = smokeW[i];
    smokeA[i] = 0; smokeK[i] = 0; smokeH[i] = 0; smokeW[i] = 0;
    if (A <= 0.001) continue;
    const lv = Math.floor(Math.min(A, 0.9) * 5 + bay[i]) / 5;
    if (lv <= 0) continue;
    const warm = clamp(Wm / A, 0, 1);
    let sr = lerp(86, 235, warm), sg = lerp(94, 160, warm), sb = lerp(118, 110, warm);
    const dk = K / A, hk = Math.min(1, Ht / A);
    if (dk > 0) { sr = lerp(sr, SOOT_C[0], dk); sg = lerp(sg, SOOT_C[1], dk); sb = lerp(sb, SOOT_C[2], dk); }
    if (hk > 0) { sr = lerp(sr, 255, hk); sg = lerp(sg, 140, hk); sb = lerp(sb, 60, hk); }
    const k = lv * 0.72, j = i * 4;
    const oa = outC[j + 3] / 255, na = k + oa * (1 - k), w0 = oa * (1 - k) / na;
    outC[j] = sr + (outC[j] - sr) * w0; outC[j + 1] = sg + (outC[j + 1] - sg) * w0; outC[j + 2] = sb + (outC[j + 2] - sb) * w0;
    outC[j + 3] = na * 255;
    if (hk > 0.2 && GLOW[i] < 255) GLOW[i] = Math.max(GLOW[i], Math.round(hk * 90));
  }
  if (SMY[1] >= SMY[0]) { SMR0.fill(W, SMY[0], SMY[1] + 1); SMR1.fill(-1, SMY[0], SMY[1] + 1); }
  SMY[0] = H; SMY[1] = -1;
}

/* ------------------------------------------------------- burning wrecks */
const WIND = [-1.2, -4.6];
function drawFires(fires, t, lights) {
  for (const ob of fires) {
    const tf = tfAt(ob.x, ob.y, 0, ob.hd), seed = ob.seed | 0, frame = Math.floor(t * 12);
    for (let k = 0; k < 7; k++) {
      const lx = -8 + k * 2.6 + (rnd(seed, k, 4) - 0.5) * 2, ly = (rnd(seed, k, 5) - 0.5) * 6;
      const z = Math.abs(lx) < 5 ? 8.8 : 5.4, p = W3(tf, lx, ly, z);
      const h = Math.ceil(3 + rnd(k, frame, seed) * 8 * (Math.abs(lx) < 5 ? 1.2 : 0.8));
      flameTongue(Math.round(scrX(p[0], p[1])), Math.round(scrY(p[0], p[1], p[2])), h, Math.sin(t * 8 + k * 1.7) * 1.6, depth(p[0], p[1], p[2]) + 2, 0.75);
    }
    for (let k = 0; k < 5; k++) {
      const age = mod(t * 0.9 + k / 5 + rnd(k, seed, 22), 1), x = ob.x + (rnd(k, seed, 23) - 0.5) * 12 + WIND[0] * age * 3;
      const y = ob.y + (rnd(k, seed, 24) - 0.5) * 6 + WIND[1] * age * 3, z = 10 + age * 22;
      fxPut(scrX(x, y), scrY(x, y, z), EMBER_C[Math.min(4, Math.floor(age * 5))], depth(x, y, z), Math.round(190 * (1 - age)));
    }
    const warm = Math.min(1, warmAt(ob.x, ob.y, 14, lights) * 0.25);
    for (let k = 0; k < 6; k++) {
      const life = 4.5, age = mod(t + k * life / 6 + rnd(seed, k, 9) * life, life), u = age / life;
      const x = ob.x + WIND[0] * age * 1.4 + Math.sin(age * 0.9 + k) * 2, y = ob.y + WIND[1] * age * 1.4, z = 12 + age * 7;
      smokePuff(x, y, z, 2.5 + age * 2.2, 0.55 * Math.min(1, age / 0.3) * Math.pow(1 - u, 1.3), 0.75, Math.max(0, 1 - age / 0.8), warm);
    }
  }
}

/* ------------------------------------------------------------ interface */
const DIGITS = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'], 'x': ['...', '#.#', '.#.', '#.#', '...'],
};
const NUMC = { gold: [packHex('#ffd35a'), packHex('#30200a')], red: [packHex('#ff7160'), packHex('#341014')], white: [packHex('#fff5d4'), packHex('#17131e')] };
function drawNumbers(list) {
  for (const nm of list) {
    const u = clamp(nm.age / nm.life, 0, 1), cols = NUMC[nm.color] || NUMC.gold, text = String(nm.text);
    const scale = nm.scale || 1, width = (text.length * 4 - 1) * scale;
    const pop = Math.sin(Math.min(1, u / 0.22) * Math.PI) * 3;
    const x0 = Math.round(scrX(nm.x, nm.y) - width / 2), y0 = Math.round(scrY(nm.x, nm.y, nm.z || 0) - u * 20 - pop);
    const pixels = [];
    for (let k = 0; k < text.length; k++) {
      const glyph = DIGITS[text[k]];
      if (!glyph) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (glyph[r][c] === '#') {
        for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) pixels.push([x0 + (k * 4 + c) * scale + xx, y0 + r * scale + yy]);
      }
    }
    const put = (x, y, color) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (u > 0.75 && bay[i] < (u - 0.75) / 0.25) return;
      uiPx(i, color);
    };
    for (const [x, y] of pixels) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) put(x + dx, y + dy, cols[1]);
    for (const [x, y] of pixels) put(x, y, cols[0]);
  }
}
// a dotted ellipse on the ground round world (x, y): the 105mm's blast, or a shell's impact point
function groundRing(x, y, r, c, phase, every) {
  const cx = scrX(x, y), cy = scrY(x, y, 0), rx = r * SC, ry = r * SC * 0.5, n = Math.ceil(TAU * rx * 0.8);
  for (let k = 0; k < n; k++) {
    if (((k + phase) % every) >= Math.ceil(every / 2)) continue;
    const a = k / n * TAU, px = Math.round(cx + Math.cos(a) * rx), py = Math.round(cy + Math.sin(a) * ry);
    if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
    uiPx(py * W + px, c);
  }
}
function drawCrosshair(ch) {
  const cx = Math.round(ch.x), cy = Math.round(ch.y), c = UI_INK, k = UI_DARK, arms = [];
  for (let d = 3; d <= 6; d++) arms.push([d, 0], [-d, 0], [0, d], [0, -d]);
  const has = new Set(arms.map((a) => a[0] + ',' + a[1]));
  for (const [dx, dy] of arms) for (const [ox, oy] of CROSS) {
    const px = cx + dx + ox, py = cy + dy + oy;
    if (px >= 0 && py >= 0 && px < W && py < H && !has.has((dx + ox) + ',' + (dy + oy))) uiPx(py * W + px, k);
  }
  for (const [dx, dy] of arms.concat([[0, 0]])) {
    const px = cx + dx, py = cy + dy;
    if (px >= 0 && py >= 0 && px < W && py < H) uiPx(py * W + px, dx || dy ? c : (ch.firing ? UI_HOT : c));
  }
  if (ch.hit > 0) for (const [dx, dy] of DIAG) for (let d = 4; d <= 5; d++) {
    const px = cx + dx * d, py = cy + dy * d;
    if (px >= 0 && py >= 0 && px < W && py < H) uiPx(py * W + px, UI_HOT);
  }
}

/* ------------------------------------------------------------ the frame */
// draw everything that moves into the overlay; S is the game's view of itself
function renderOverlay(S, t, lights, fires) {
  out.fill(0); GLOW.fill(0);
  drawHotScorches(S.scorches);
  for (const b of S.booms) drawBoomRing(b);
  const zs = S.drawList;
  zs.sort((a, b) => a.dep - b.dep);
  for (const z of zs) drawZombie(z, t, lights);
  for (const p of S.puffs) {
    if (p.age < 0) continue;
    const u = p.age / p.life, thrown = p.k ? (1 - Math.exp(-p.k * p.age)) / p.k : 0;
    smokePuff(p.x + p.vx * p.age + (p.px || 0) * thrown, p.y + p.vy * p.age + (p.py || 0) * thrown, p.z + p.vz * p.age * (1 - 0.3 * u),
      p.r0 + p.gr * p.age, p.a * Math.min(1, p.age / 0.08) * Math.pow(1 - u, 1.5), p.dark, p.heat * Math.max(0, 1 - p.age / 0.7), p.warm || 0);
  }
  drawFires(fires, t, lights);
  drawSmoke();
  for (const p of S.particles) {
    const dep = depth(p.x, p.y, p.z), u = p.life ? clamp(p.age / p.life, 0, 1) : 0;
    if (p.kind === 'spark') drawSpark(p.x, p.y, p.z, p.vx, p.vy, p.vz, u, dep + 1);
    else if (FX_PART[p.kind]) FX_PART[p.kind](p, u, dep);
  }
  for (const b of S.booms) drawBoom(b);
  for (const hit of S.impacts) {
    const u = hit.age / hit.life, sx = scrX(hit.x, hit.y), sy = scrY(hit.x, hit.y, hit.z || 1), dep = depth(hit.x, hit.y, hit.z || 1) + 2;
    if (u < 1) hitFlash(sx, sy, dep, u, hit.size || 1);
  }
  for (const tr of S.rounds) drawTracer(tr);
  drawNumbers(S.numbers);
  if (S.ui) {
    for (const r of S.rounds) if (r.kind === 'he') {
      const left = Math.max(0, r.travel - r.age);
      groundRing(r.b[0], r.b[1], 4 + left * 14, UI_HOT, Math.floor(t * 20), 4);
    }
    if (S.ui.ring) groundRing(S.ui.ring.x, S.ui.ring.y, S.ui.ring.r, S.ui.ring.ready ? UI_INK : UI_DIM, Math.floor(t * 8), 6);
    if (S.ui.cross) drawCrosshair(S.ui.cross);
  }
}
