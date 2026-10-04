// planes.js - plane flights and payloads. The shared air.js framework owns keys, aiming, charges
// and cooldowns; this file only launches and updates the actual planes, bombs and glowing hits.
// The A-10 flies one pass, with parallel gun bands and an optional four-bomb finish.

// speed = px/s, alt = height (px) as it comes in, dive = px lower while it fires, len = px of
// ground it strafes, lead = px ahead of the jet its rounds land, step = px between two hits you see
// (a puff of fire every 3rd, a big blast every 8th), half / dmg = the band and the damage before upgrades, bombR = px
// a bomb kills round it
const JETC = { speed: 320, alt: 46, dive: 12, len: 230, lead: 44, step: 4, half: 13, dmg: 3, bombR: 34, N: 32,
  // Centre spacing leaves four pixels between the original gun bands (proposal)
  lineGap: 30,
  // Seconds of ground-marker anticipation, then shadow entry before the body appears (proposal)
  showDelay: 0.3, shadowLead: 0.1 };

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
// Cache opaque bounds at startup so an entry uses the picture, rather than its transparent padding.
function jetSpriteBounds(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const b = { left: c.width, top: c.height, right: 0, bottom: 0 };
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!d[(y * c.width + x) * 4 + 3]) continue;
    b.left = Math.min(b.left, x); b.top = Math.min(b.top, y);
    b.right = Math.max(b.right, x + 1); b.bottom = Math.max(b.bottom, y + 1);
  }
  c.planeBounds = b;
  return c;
}
// Build the jet at JETC.N headings (0 = nose up, clockwise), its shadow and its card icon. At startup.
function bakeJet() {
  const raw = jetRaw();
  JET.n.length = JET.sh.length = 0;
  for (let i = 0; i < JETC.N; i++) {
    const r = rotA(raw, i / JETC.N * TAU);
    JET.n.push(jetSpriteBounds(selOut(r)));
    JET.sh.push(jetSpriteBounds(tint(r, '#000', 1, 'source-in')));
  }
  JET.bomb = outline(pix(3, 6, (r) => {
    r(0, 0, 3, 5, '#565c46');
    r(0, 0, 1, 5, '#7a8262');
    r(0, 5, 3, 1, '#2d3036');
  }), P.out);
  for (const c of [...JET.n, ...JET.sh, JET.bomb]) atl(c);
}
bakeJet();

// ---------- this run's flights
// STRAF holds transport effects only. Charges and input belong to AIR.
const STRAF = { g: null, jets: [], bombs: [], embers: [], marks: [], roars: 0, demoT: 6,
  stats: { b52: { launched: 0, dropped: 0, impacts: 0, lastDrop: null, lastImpact: null } } };
function srSync() {
  if (STRAF.g === G) return;
  STRAF.g = G;
  STRAF.jets.length = STRAF.bombs.length = STRAF.embers.length = STRAF.marks.length = 0;
  STRAF.roars = 0;
  STRAF.demoT = 6;
  Object.assign(STRAF.stats.b52, { launched: 0, dropped: 0, impacts: 0, lastDrop: null, lastImpact: null });
}
// The way the jet flies for a press at (ax, ay) let go at (bx, by): the drag, or the train's way.
function strafeDir(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  if (d >= 12) return [dx / d, dy / d];
  const c = G.tr.cars[0];
  return [c.dx, c.dy];
}
// AIR validates ownership and charges before asking a supported payload to launch.
function launchPlane(id, worldX, worldY, ux, uy) {
  if (id !== 'a10' && id !== 'f4' && id !== 'b52') return false;
  return callPlane(id, worldX, worldY, ux, uy);
}
function planeArt(j) { return j.id === 'f4' ? F4 : j.id === 'b52' ? B52 : JET; }
// The aiming preview and the actual payload share centred offsets for one to four bands.
function a10Offsets(count = 1) {
  const n = clamp(Math.floor(count) || 1, 1, 4);
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * JETC.lineGap);
}
// Send a flight through a world point. This transport does not spend any framework resources.
function callStrafe(px, py, ux, uy) {
  return callPlane('a10', px, py, ux, uy);
}
function callPlane(id, px, py, ux, uy) {
  if (!G || G.result || !Number.isFinite(px) || !Number.isFinite(py)) return false;
  const length = Math.hypot(ux, uy);
  if (!Number.isFinite(length) || length <= 0) [ux, uy] = [G.tr.cars[0].dx, G.tr.cars[0].dy];
  else { ux /= length; uy /= length; }
  srSync();
  // it comes in from just off the screen, and flies on until it is off the other side
  const fire = id === 'f4', bomber = id === 'b52', payload = fire ? f4Payload(G.up) : bomber ? b52Payload(G.up) : null;
  const len = payload ? payload.len : JETC.len, lead = payload ? 0 : JETC.lead;
  const half = fire ? payload.patchRadius : bomber ? payload.bombRadius : JETC.half, offsets = payload ? [0] : a10Offsets(G.up.a10Lines);
  const back = Math.max(jetEdge(px, py, -ux, -uy) + 40, len / 2 + lead + 20), on = jetEdge(px, py, ux, uy) + 60;
  const j = { id, len, lead, px, py, ux, uy, o: 0, s: -back, end: Math.max(on, len / 2 + 40),
    front: -Infinity, half, dmg: payload ? 0 : JETC.dmg * (G.up.a10Damage ?? 1), lines: payload ? 0 : offsets.length, offsets,
    bombCount: !payload && G.up.bombRun ? 4 : 0, dropped: false, fired: false, lineHits: payload ? [] : offsets.map(() => null),
    smoke: 0, alt: JETC.alt, delay: JETC.showDelay, age: 0, roared: false,
    shadowSeen: false, shadowAge: 0, bodyReady: false };
  if (payload) Object.assign(j, payload);
  if (bomber) STRAF.stats.b52.launched++;
  STRAF.jets.push(j);
  for (const o of offsets) {
    STRAF.marks.push({ x: px - uy * o, y: py + ux * o, age: 0,
      T: JETC.showDelay + Math.max(0, (back - lead - len / 2) / JETC.speed), radius: half, jet: j });
  }
  return true;
}

// px from world point (x, y) along (ux, uy) to the edge of the view (the jet's sprite is half off it there)
function jetEdge(x, y, ux, uy) {
  let t = 2000;
  const x0 = G.camX - 30, y0 = G.camY - 30, x1 = G.camX + W + 30, y1 = G.camY + VH + 30;
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
    j.age += dt;
    let flightDt = dt;
    if (j.delay > 0) {
      const wait = Math.min(j.delay, dt);
      j.delay = Math.max(0, j.delay - wait);
      if (j.delay < 1e-9) j.delay = 0;
      flightDt -= wait;
      if (flightDt <= 1e-9) continue;
    }
    j.s += JETC.speed * flightDt;
    // lower while it fires
    const mid = Math.abs(j.s + j.lead) / (j.len * 0.75);
    j.alt = JETC.alt - JETC.dive * Math.max(0, 1 - mid * mid);
    if (!j.shadowSeen && jetShadowInView(j)) j.shadowSeen = true;
    else if (j.shadowSeen) j.shadowAge += flightDt;
    if (j.shadowSeen && j.shadowAge >= JETC.shadowLead - 1e-9) j.bodyReady = true;
    if (j.bodyReady && !j.roared && jetBodyInView(j)) {
      j.roared = true;
      // Count actual player-flight requests; the audio helper caps overlapping voices.
      if (!G.demo) { STRAF.roars++; SFX.planeRoar(); }
    }
    if (j.id === 'f4') f4Fire(j);
    else if (j.id === 'b52') b52Drop(j);
    else strafeFire(j);
    if (j.id === 'a10' && j.bombCount && !j.dropped && j.s + j.lead >= j.len / 2) dropBombs(j);
    // a thin trail from the engines
    if (j.bodyReady) j.smoke -= flightDt;
    if (j.bodyReady && j.smoke <= 0) {
      j.smoke = 0.05;
      const [gx, gy] = jetGround(j);
      for (const sx of [-8, 8]) part({ x: gx - j.ux * 10 - j.uy * sx, y: gy - j.uy * 10 + j.ux * sx, z: j.alt + 2, vx: 0, vy: 0, vz: 0, g: 0,
        life: 0.5, max: 0.5, s: 1, c: 'rgba(210,214,220,0.35)', grow: 3, drag: 1, smoke: true });
    }
    if (j.s > j.end) STRAF.jets.splice(i, 1);
  }
  for (let i = STRAF.marks.length - 1; i >= 0; i--) {
    const m = STRAF.marks[i];
    m.age = m.jet.age;
    if (m.jet.fired || m.jet.s > m.jet.end) STRAF.marks.splice(i, 1);
  }
  for (let i = STRAF.bombs.length - 1; i >= 0; i--) {
    const b = STRAF.bombs[i];
    b.t += dt;
    if (b.t >= b.T) {
      bombHit(b.x1, b.y1, b);
      STRAF.bombs.splice(i, 1);
    }
  }
  for (const j of STRAF.jets) for (const h of j.lineHits) if (h) h.t += dt;
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
// These same bounds serve the presentation gate and its copied diagnostics, below the opaque HUD.
function jetSpriteInView(c, x, y) {
  const b = c.planeBounds, ox = Math.round(x - c.width / 2), oy = Math.round(y - c.height / 2);
  return ox + b.right > G.camX && ox + b.left < G.camX + W &&
    oy + b.bottom > G.camY + 19 && oy + b.top < G.camY + VH;
}
function jetShadowInView(j) {
  const [x, y] = jetGround(j);
  return j.delay <= 0 && jetSpriteInView(planeArt(j).sh[jetIdx(j)], x + j.alt * SUNX, y + j.alt * SUNY);
}
function jetBodyInView(j) {
  const [x, y] = jetGround(j);
  return j.delay <= 0 && jetSpriteInView(planeArt(j).n[jetIdx(j)], x, y - j.alt);
}
// The gun: its rounds land JETC.lead px ahead of the jet. Every zombie in the band the hits swept over
// since the last step takes the hit; a hit flashes every JETC.step px, a blast every JETC.blast px.
function strafeFire(j) {
  const L = j.len / 2, a = Math.min(j.s + j.lead, L), a0 = Math.max(j.front, -L);
  j.front = Math.max(j.front, j.s + j.lead);
  if (a <= a0 || a < -L) return;
  if (!j.fired) {
    j.fired = true;
    if (!G.demo) addShake(0.3);
  }
  // A large target touching two band edges still takes this pass's damage only once.
  const hitThisStep = new Set();
  for (let i = 0; i < j.offsets.length; i++) strafeBand(j, j.offsets[i], i, a0, a, hitThisStep);
}
function strafeBand(j, offset, line, a0, a, hitThisStep) {
  // the line's points: c = middle of what was swept, (ux, uy) along, (nx, ny) across
  const ux = j.ux, uy = j.uy, nx = -uy, ny = ux;
  const ox = j.px + nx * offset, oy = j.py + ny * offset, cm = (a0 + a) / 2;
  const cx = ox + ux * cm, cy = oy + uy * cm, R = ((a - a0) / 2 + j.half + 4) / FORE;
  const hit = [];
  queryEll(cx, cy, R, (z) => {
    const dx = z.x - ox, dy = z.y - oy, t = dx * ux + dy * uy, u = dx * nx + dy * ny;
    if (t >= a0 && t < a && Math.abs(u) <= j.half + (z.big ? 2 : 0) && !hitThisStep.has(z)) {
      hitThisStep.add(z);
      hit.push(z);
    }
  });
  for (const z of hit) {
    const ix = ox + ux * ((z.x - ox) * ux + (z.y - oy) * uy), iy = oy + uy * ((z.x - ox) * ux + (z.y - oy) * uy);
    if (z.hp <= j.dmg) kill(z, 'he', ix, iy, rnd(8, 20));
    else {
      JUICE.from = [ix, iy];
      hitZombie(z, j.dmg, 'strafe');
      JUICE.from = null;
    }
  }
  // what you see: hits scattered across the band, puffs of fire and bigger blasts along it
  for (let s = Math.ceil(a0 / JETC.step) * JETC.step; s < a; s += JETC.step) {
    const u = rnd(-j.half, j.half), x = ox + ux * s + nx * u, y = oy + uy * s + ny * u;
    strafeHit(j, x, y, line);
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
function strafeHit(j, x, y, line) {
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
  j.last = j.lineHits[line] = { x, y, t: 0 };
  if (!G.demo && Math.random() < 0.3) SFX.mg();
}
// BOMB RUN: four bombs leave the jet once, after its gun pass; they fly on ahead and fall.
function dropBombs(j) {
  j.dropped = true;
  const [gx, gy] = jetGround(j);
  for (let k = 0; k < j.bombCount; k++) {
    const d = 34 + k * 24, sd = (k - (j.bombCount - 1) / 2) * 6;
    STRAF.bombs.push({ source: 'a10', x0: gx, y0: gy, x1: gx + j.ux * d - j.uy * sd, y1: gy + j.uy * d + j.ux * sd,
      z0: j.alt, t: -k * 0.08, T: 0.55, a: Math.atan2(j.ux, -j.uy), radius: JETC.bombR, dmg: null, burnTime: 0, burnDamage: 0 });
  }
}
// A-10 bombs retain their lethal blast; bomber payloads use their snapshotted radius and damage.
function bombHit(x, y, payload) {
  const radius = payload?.radius ?? JETC.bombR, damage = payload?.dmg;
  const scale = payload?.source === 'b52' ? radius / JETC.bombR : 1;
  juiceBoom(x, y, false, scale);
  addBoom(x, y - 2, 24 * scale, 8, 0.9, 11 * scale);
  queryEll(x, y, radius, (z, d) => {
    if (damage == null || z.hp <= damage) kill(z, 'he', x, y, d);
    else {
      JUICE.from = [x, y];
      hitZombie(z, damage, 'boom');
      JUICE.from = null;
    }
  });
  if (payload?.burnTime) addBurn(x, y, radius, payload.burnTime, payload.burnDamage, payload.source);
  if (payload?.source === 'b52') {
    const stats = STRAF.stats.b52;
    stats.impacts++;
    stats.lastImpact = { x, y, t: heliWeaponTime(), radius, damage, burnTime: payload.burnTime };
  }
  if (!G.demo) {
    addShake(0.45);
    hitStop(0.04, 0.3);
    SFX.boom();
  }
}

// ---------- drawing (world layer)
// A red ground ring closes on the strike point, then vanishes when the actual firing begins.
function drawPlaneMarks() {
  if (STRAF.g !== G) return;
  for (const m of STRAF.marks) {
    if (offView(m.x, m.y, m.radius * 1.5)) continue;
    const rr = lerp(m.radius * 1.5, m.radius, ease(clamp(m.age / m.T, 0, 1)));
    const col = thermal ? '#ffffff' : '#ff2a1a';
    ctx.globalAlpha = 0.35 + 0.3 * (Math.sin(realT * 22) > 0 ? 1 : 0);
    pell(m.x, m.y, rr, rr * FORE, col);
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y), 3, 1);
    ctx.fillRect(Math.round(m.x), Math.round(m.y) - 1, 1, 3);
  }
  ctx.globalAlpha = 1;
}
// The shadows on the ground (under everything standing), south-east of each jet by its height.
function drawPlaneShadows() {
  if (STRAF.g !== G) return;
  drawEmbers();
  ctx.globalAlpha = thermal ? 0.2 : 0.3;
  for (const j of STRAF.jets) {
    if (j.delay > 0) continue;
    const [gx, gy] = jetGround(j), i = jetIdx(j), sh = planeArt(j).sh[i];
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
    if (offView(e.x, e.y, 14)) continue;
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
    if (!j.bodyReady) continue;
    const [gx, gy] = jetGround(j), spr = planeArt(j).n[jetIdx(j)];
    blit(spr, Math.round(gx - spr.width / 2), Math.round(gy - j.alt - spr.height / 2));
  }
  // the gun: a big flickering flash at the nose, tracers down to where the rounds land
  ctx.globalCompositeOperation = 'lighter';
  for (const j of STRAF.jets) {
    if (!j.bodyReady || j.id !== 'a10') continue;
    const firing = j.s + j.lead > -j.len / 2 && j.s + j.lead < j.len / 2;
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
  // One recent tracer per gun band, all coming from the single plane.
  for (const j of STRAF.jets) {
    if (!j.bodyReady) continue;
    const [gx, gy] = jetGround(j);
    for (const h of j.lineHits) {
      if (!h || h.t > 0.06) continue;
      ctx.globalAlpha = 0.8 * (1 - h.t / 0.06);
      pl(ctx, Math.round(gx + j.ux * 28), Math.round(gy + j.uy * 28 - j.alt), Math.round(h.x), Math.round(h.y), '#ffd27a');
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- preview geometry (screen px)
// AIR supplies its current point and direction, and owns the prompt and pointer state.
function drawStrafeLine(x, y, ux, uy, lineCount = 1) {
  const nx = -uy, ny = ux, L = JETC.len / 2, hw = JETC.half;
  const on = Math.floor(realT * 6) % 2 ? 0.9 : 0.6;
  for (const o of a10Offsets(lineCount)) {
    const a = { x: x + nx * o, y: y + ny * o };
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ff9a3a';
    ctx.beginPath();
    ctx.moveTo(a.x - ux * L + nx * hw, a.y - uy * L + ny * hw);
    ctx.lineTo(a.x + ux * L + nx * hw, a.y + uy * L + ny * hw);
    ctx.lineTo(a.x + ux * L - nx * hw, a.y + uy * L - ny * hw);
    ctx.lineTo(a.x - ux * L - nx * hw, a.y - uy * L - ny * hw);
    ctx.fill();
    // Each band has the original pixel dashes and direction arrow.
    ctx.globalAlpha = on;
    ctx.fillStyle = '#ffb060';
    for (let s = -L; s <= L; s += 4) for (const sd of [-1, 1]) ctx.fillRect(Math.round(a.x + ux * s + nx * hw * sd), Math.round(a.y + uy * s + ny * hw * sd), 2, 1);
    for (let k = 0; k < 7; k++) {
      const s = L + 2 - k, w = k * 0.8;
      ctx.fillRect(Math.round(a.x + ux * s - nx * w), Math.round(a.y + uy * s - ny * w), Math.max(1, Math.round(w * 2)), 1);
    }
  }
  ctx.globalAlpha = 1;
}
