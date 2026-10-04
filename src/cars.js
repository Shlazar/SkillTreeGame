// cars.js - automatic weapons mounted on the existing train cars. Art is baked before the atlas
// warms; runtime state belongs to one G and never keeps zombie references between shots.
// Hooks: updateTrainWeapons (step), drawTrainWeapon (drawCar), drawTrainWeaponFx (additive pass).
const MGC = {
  car: 3, headings: 32, rate: 2, scale: 0.6, flash: 0.07,
  damage: 1, range: 100, wallRange: 200, barrel: 8, barrelZ: 2, halfWidth: 3, recoil: 1.3, recoilDecay: 12 // (proposal)
};
const MG_OFFSETS = [[0], [-7, 7], [-9, 0, 9]];
const MGART = { n: [], h: [], bn: [], bh: [] };
const MGCAR = { g: null, mg: null };
// Independent rocket range/payload, flight seconds/height, launch/retry timing and spread (proposal)
const KATC = { car: 2, deck: 3, headings: 32, damage: 8, radius: 24, range: 300,
  travel: 0.8, arc: 32, gap: 0.08, retry: 0.25, spread: 12, split: 0.65,
  tubeFront: 9, muzzleZ: 4, flash: 0.07,
  cluster: { damage: 4, radius: 12, fall: 0.3, spread: 12 } };
const KAT_TUBES = [-5, -3, -1, 1, 3, 5], KATART = { n: [], h: [] };

// Coordinates on the ground, with height kept separate so sprites and effects use one mount.
function trainMount(i, along = 0, across = 0, z = 0) {
  const c = G.tr.cars[i];
  return { x: c.cx + c.dx * along + c.nx * across, y: c.cy + c.dy * along + c.ny * across, z };
}

// A six-pixel armored cupola and a separate eight-pixel gun tube, using the train's steel palette.
function mgCarArt() {
  const body = [
    pix(10, 10, (r) => { r(2, 2, 6, 6, '#15191e'); r(3, 1, 4, 8, '#15191e'); }),
    pix(10, 10, (r) => { r(2, 2, 6, 6, '#353a43'); r(2, 2, 6, 1, '#6b727e'); r(2, 3, 1, 4, '#535a65'); }),
    pix(10, 10, (r) => { r(2, 2, 6, 5, '#474d58'); r(3, 1, 4, 2, '#5d6470'); r(2, 3, 1, 3, '#7b8390'); r(7, 3, 1, 3, '#262a31'); }),
    pix(10, 10, (r) => {
      r(3, 2, 4, 4, '#5d6470'); r(3, 2, 4, 1, '#a3abb7'); r(3, 3, 1, 2, '#7b8390');
      r(5, 4, 2, 1, '#262a31'); r(3, 6, 1, 1, '#d8a93a'); r(5, 6, 1, 1, '#d8a93a');
    })
  ];
  const barrel = [
    pix(22, 22, (r) => { r(10, 7, 3, 4, '#262a31'); r(11, 3, 1, 7, '#353a43'); r(10, 3, 3, 1, '#262a31'); }),
    pix(22, 22, (r) => { r(10, 7, 3, 3, '#5d6470'); r(10, 7, 1, 3, '#a3abb7'); r(11, 3, 1, 5, '#c3c8cf'); r(10, 3, 3, 1, '#7b8390'); })
  ];
  for (let i = 0; i < MGC.headings; i++) {
    const a = i / MGC.headings * TAU, raw = stackSpr(body, a, 16), br = stackSpr(barrel, a, 24);
    const n = selOut(rimLight(raw, '#e8e2cc', 0.2)), h = outline(hotSpr(raw, 120), '#161616');
    const bn = selOut(rimLight(br, '#f2eee0', 0.25)), bh = outline(hotSpr(br, 135), '#161616');
    n.ox = h.ox = 9; n.oy = h.oy = 13;
    bn.ox = bh.ox = 13; bn.oy = bh.oy = 15;
    MGART.n.push(n); MGART.h.push(h); MGART.bn.push(bn); MGART.bh.push(bh);
    atl(n); atl(h); atl(bn); atl(bh);
  }
}

function mgPayload() {
  return { damage: MGC.damage * (G.up.mgDamage || 1), range: MGC.range * (G.up.mgRange || 1),
    rate: G.up.mgRate || MGC.rate, pierce: G.up.apRounds || 1 };
}
function trainWeaponState() {
  if (MGCAR.g !== G) {
    MGCAR.g = G;
    const count = G.up.mgCar ? clamp(G.up.mgTurrets || 1, 1, 3) : 0, p = mgPayload();
    MGCAR.mg = { shots: 0, hits: 0, kills: 0, targetsHit: 0, lastShot: null, turrets: [] };
    for (let i = 0; i < count; i++) MGCAR.mg.turrets.push({ i, along: MG_OFFSETS[count - 1][i], across: 0,
      x: 0, y: 0, z: 0, ang: G.tr.cars[MGC.car].ang, cd: 1 / p.rate,
      flash: 0, seed: 1, recoil: 0, shots: 0, hits: 0, kills: 0, lastShot: null });
    MGCAR.katyusha = { next: G.up.katyushaReload || 15, retry: 0, salvos: 0, shots: 0, hits: 0, kills: 0,
      splits: 0, clusterBombs: 0, impacts: 0, rocketImpacts: 0, clusterImpacts: 0, queue: [], rounds: [],
      flash: [0, 0, 0, 0, 0, 0], ang: G.tr.cars[KATC.car].ang,
      lastTarget: null, lastSalvo: null, lastLaunch: null, lastImpact: null, recentImpacts: [] };
  }
  for (const t of MGCAR.mg.turrets) {
    const m = trainMount(MGC.car, t.along, t.across, TRAIN[MGC.car].tall - 1);
    t.x = m.x; t.y = m.y; t.z = m.z;
  }
  return MGCAR;
}
const mgCanHit = (z) => !z.dead && !z.gone && !(z.gate && z.still) && (z.pending || 0) < z.hp;
function mgTarget(t, range) {
  let best = null, score = Infinity;
  queryEll(t.x, t.y, range, (z, d) => {
    if (!mgCanHit(z)) return;
    const s = (z.st === 2 ? 0 : range + 1) + d;
    if (s < score) { best = z; score = s; }
  });
  // The rear boxcar can reach a blocking wall's actual face across the train's length.
  // Ordinary enemies keep their short range and have priority over this fallback.
  const w = !best && blockingWall();
  if (w && mgCanHit(w.target) && Math.hypot(w.x - t.x, (w.y - t.y) / FORE) <= MGC.wallRange) best = w.target;
  return best;
}
function mgTargetView(z) {
  return { x: z.x, y: z.y, type: z.type, st: z.st, car: z.car, wall: z.wall?.id || null };
}
// AP tests the same narrow ground ray through the chosen target. Nearer bodies stop it first.
const MG_RAY = [];
function mgShot(t, target, p) {
  const dx = target.x - t.x, dy = target.y - t.y, flatY = dy / FORE, length = Math.hypot(dx, flatY) || 1;
  t.ang = Math.atan2(dx, -dy);
  MG_RAY.length = 0;
  if (p.pierce === 1) MG_RAY.push({ z: target, d: length });
  else {
    const ux = dx / length, uy = flatY / length;
    queryEll(t.x, t.y, p.range, (z) => {
      if (!mgCanHit(z)) return;
      const zx = z.x - t.x, zy = (z.y - t.y) / FORE, along = zx * ux + zy * uy;
      if (along >= 0 && Math.abs(zx * uy - zy * ux) <= MGC.halfWidth) MG_RAY.push({ z, d: along });
    });
    if (target.wall && !MG_RAY.some((v) => v.z === target)) MG_RAY.push({ z: target, d: length });
    MG_RAY.sort((a, b) => a.d - b.d);
  }
  const muzzle = mgMuzzle(t), shot = { x: t.x, y: t.y, z: t.z, muzzle, angle: t.ang, t: G.t,
    damage: p.damage, range: p.range, rate: p.rate, pierce: p.pierce, target: mgTargetView(target), targets: [] };
  let kills = 0;
  for (let i = 0; i < Math.min(p.pierce, MG_RAY.length); i++) {
    const z = MG_RAY[i].z, v = mgTargetView(z), hpBefore = z.hp;
    JUICE.from = [t.x, t.y];
    const killed = hitZombie(z, p.damage, 'mg');
    JUICE.from = null;
    hitSpark(v.x, v.y, MGC.scale);
    shot.targets.push({ ...v, hpBefore, hpAfter: z.hp, killed });
    if (killed) kills++;
  }
  MG_RAY.length = 0;
  const mg = MGCAR.mg, hit = shot.targets.length > 0 ? 1 : 0;
  t.shots++; t.hits += hit; t.kills += kills; t.lastShot = shot;
  mg.shots++; mg.hits += hit; mg.kills += kills; mg.targetsHit += shot.targets.length; mg.lastShot = shot;
  t.flash = MGC.flash; t.seed = (Math.random() * 1e6) | 0; t.recoil = MGC.recoil;
  const c = G.tr.cars[MGC.car], rx = Math.cos(t.ang), ry = Math.sin(t.ang);
  part({ x: t.x + rx * 2, y: t.y + ry * 2, z: muzzle.z, vx: rx * rnd(18, 34) + c.dx * G.tr.v * 0.6,
    vy: ry * rnd(18, 34) + c.dy * G.tr.v * 0.6, vz: rnd(4, 18), g: 200,
    life: 0.9, max: 0.9, s: 1, c: pick(['#e3b04b', '#c9952f', '#f0c85a']), land: 1 });
  if (!G.demo) { G.shots++; G.hits += hit; SFX.mgCar(); }
}
function updateTrainWeapons(dt) {
  const state = trainWeaponState();
  updateMGCar(dt, state.mg);
  updateKatyusha(dt, state.katyusha);
}
function updateMGCar(dt, mg) {
  if (!G.up.mgCar || G.result) return;
  const p = mgPayload();
  for (const t of mg.turrets) {
    t.flash = Math.max(0, t.flash - dt); t.recoil = Math.max(0, t.recoil - MGC.recoilDecay * dt);
    t.cd -= dt;
    while (t.cd <= 1e-9) {
      const z = mgTarget(t, p.range);
      if (!z) { t.cd = 0; break; }
      mgShot(t, z, p);
      t.cd += 1 / p.rate;
    }
  }
}
function mgMuzzle(t) {
  const reach = MGC.barrel - t.recoil;
  return { x: t.x + Math.sin(t.ang) * reach, y: t.y - Math.cos(t.ang) * reach, z: t.z + MGC.barrelZ + 1 };
}
function drawTrainWeapon(i) {
  if (i === KATC.car && G.up.katyusha) {
    drawKatyushaRack();
    return;
  }
  if (i !== MGC.car || !G.up.mgCar) return;
  const turrets = trainWeaponState().mg.turrets;
  // The train always travels northward: its front roof mounts are behind the rear ones in view.
  for (let j = turrets.length - 1; j >= 0; j--) {
    const t = turrets[j], k = mod(Math.round(t.ang / TAU * MGC.headings), MGC.headings);
    const body = (thermal ? MGART.h : MGART.n)[k], barrel = (thermal ? MGART.bh : MGART.bn)[k];
    const x = Math.round(t.x), y = Math.round(t.y - t.z), bx = Math.round(t.x - Math.sin(t.ang) * t.recoil),
      by = Math.round(t.y - t.z - MGC.barrelZ + Math.cos(t.ang) * t.recoil);
    if (Math.cos(t.ang) > 0.15) blit(barrel, bx - barrel.ox, by - barrel.oy);
    blit(body, x - body.ox, y - body.oy);
    if (Math.cos(t.ang) <= 0.15) blit(barrel, bx - barrel.ox, by - barrel.oy);
  }
}
// The Viper's flash recipe at sixty percent, without a tracer or impact mark.
function drawTrainWeaponFx() {
  drawKatyushaFx();
  if (!G.up.mgCar || thermal) return;
  for (const t of trainWeaponState().mg.turrets) {
    if (t.flash <= 0) continue;
    const m = mgMuzzle(t), x = m.x, y = m.y - m.z, k = clamp(t.flash / MGC.flash, 0, 1), scale = MGC.scale;
    light(x, y, 40 * scale, '#ff9a3a', 0.9 * k); light(x, y, 18 * scale, '#fff1c2', k);
    starFlash(x, y, t.seed, 6 * scale, 16 * scale, 0.5 + 0.5 * k, scale);
    const L = Math.round((9 + (t.seed & 7)) * (0.5 + 0.5 * k) * scale), ux = Math.sin(t.ang), uy = -Math.cos(t.ang);
    for (let j = 0; j < L; j++) {
      const f = j / L, width = f < 0.5 ? 2 : 1;
      ctx.globalAlpha = 1 - f * 0.8; ctx.fillStyle = f < 0.3 ? '#fff' : f < 0.65 ? '#ffe2a0' : '#ffb347';
      ctx.fillRect(Math.round(x + ux * j) - (width >> 1), Math.round(y + uy * j * FORE) - (width >> 1), width, width);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
    const mx = Math.round(x), my = Math.round(y);
    ctx.fillRect(mx - 1, my - 1, 3, 2); ctx.fillRect(mx - 1, my - 1, 2, 3);
  }
  ctx.globalAlpha = 1;
}

// The flatcar carries a pivot and six olive launch rails with steel rims and yellow rocket tips.
function katyushaArt() {
  const slices = [
    pix(18, 24, (r) => { r(3, 7, 12, 13, '#1a1d22'); r(2, 8, 1, 10, '#353a43'); r(15, 8, 1, 10, '#262a31'); }),
    pix(18, 24, (r) => { r(5, 8, 8, 10, '#353a43'); r(5, 8, 8, 1, '#7b8390'); r(5, 9, 1, 8, '#5d6470'); }),
    pix(18, 24, (r) => { r(3, 6, 2, 12, '#474d58'); r(13, 6, 2, 12, '#353a43'); r(3, 6, 12, 2, '#5d6470'); }),
    pix(18, 24, (r) => {
      r(3, 5, 12, 15, '#303827'); r(3, 5, 12, 1, '#a3abb7'); r(3, 6, 1, 13, '#7b8390');
      r(4, 17, 10, 2, '#262a31');
    }),
    pix(18, 24, (r) => {
      for (const x of [3, 5, 7, 9, 11, 13]) { r(x, 3, 2, 15, '#465034'); r(x, 3, 1, 15, '#87945f'); r(x, 3, 2, 2, '#d8a93a'); }
      r(3, 15, 12, 1, '#353a43');
    }),
    pix(18, 24, (r) => {
      for (const x of [3, 5, 7, 9, 11, 13]) { r(x, 4, 1, 10, '#a0aa7b'); r(x, 16, 2, 2, '#171a15'); r(x, 16, 1, 1, '#7b8390'); }
      r(3, 5, 12, 1, '#64714a');
    })
  ];
  for (let i = 0; i < KATC.headings; i++) {
    const raw = stackSpr(slices, i / KATC.headings * TAU, 28);
    const n = selOut(rimLight(raw, '#e8e2cc', 0.2)), h = outline(hotSpr(raw, 120), '#161616');
    n.ox = h.ox = 15; n.oy = h.oy = 21;
    KATART.n.push(n); KATART.h.push(h); atl(n); atl(h);
  }
}
// A salvo snapshots its payload. Queued launches follow the moving rack, then retain world origins.
function launchKatyusha(q, state) {
  const mount = trainMount(KATC.car, 0, 0, KATC.deck), across = KAT_TUBES[q.index % KAT_TUBES.length];
  const [ox, oy] = turnXY(q.angle, across, -KATC.tubeFront);
  const r = { kind: 'rocket', source: 'katyusha', sx: mount.x + ox, sy: mount.y + oy, sz: mount.z + KATC.muzzleZ,
    bx: q.x, by: q.y, age: 0, T: KATC.travel, arc: KATC.arc,
    dmg: KATC.damage, R: q.radius, cluster: q.cluster, blast: q.blast,
    salvo: q.salvo, index: q.index, group: { hit: false }, player: true };
  state.rounds.push(r); state.shots++; state.flash[q.index % KAT_TUBES.length] = KATC.flash;
  state.lastLaunch = { x: r.sx, y: r.sy, z: r.sz, mountX: mount.x, mountY: mount.y, mountZ: mount.z,
    along: KATC.tubeFront, across, angle: q.angle, bx: r.bx, by: r.by,
    t: heliWeaponTime(), salvo: q.salvo, index: q.index };
  if (!G.demo) { G.shots++; SFX.rocket(); }
}
// At the crest each cluster rocket is replaced by exactly three bombs, with no parent blast.
function splitKatyusha(r, state) {
  const [x, y, z] = rocketAt(r, r.T * KATC.split), c = KATC.cluster;
  state.splits++;
  for (let i = 0; i < r.cluster; i++) {
    const a = i / r.cluster * TAU;
    state.rounds.push({ kind: 'rocket', source: 'katyushaCluster', sx: x, sy: y, sz: z,
      bx: r.bx + Math.cos(a) * c.spread, by: r.by + Math.sin(a) * c.spread * FORE,
      age: 0, T: c.fall, arc: 0, dmg: c.damage, R: c.radius * r.blast, cluster: 0, blast: r.blast,
      salvo: r.salvo, index: r.index, group: r.group, player: true });
    state.clusterBombs++;
  }
}
// Friendly payloads damage zombies only; child bombs share their mother's one accuracy receipt.
function katyushaImpact(r, state) {
  const x = r.bx, y = r.by;
  let hits = 0, kills = 0;
  queryEll(x, y, r.R, (z, d) => {
    if (z.gone || z.gate && z.still) return;
    hits++;
    if (z.hp <= r.dmg) { kill(z, 'he', x, y, d); kills++; }
    else { JUICE.from = [x, y]; hitZombie(z, r.dmg, 'boom'); JUICE.from = null; }
  });
  state.impacts++; state.kills += kills;
  if (r.source === 'katyushaCluster') state.clusterImpacts++;
  else state.rocketImpacts++;
  if (hits && !r.group.hit) {
    r.group.hit = true; state.hits++;
    if (!G.demo) G.hits++;
  }
  state.lastImpact = { x, y, t: heliWeaponTime(), damage: r.dmg, radius: r.R, source: r.source,
    hits, kills, salvo: r.salvo, index: r.index };
  state.recentImpacts.push(state.lastImpact);
  if (state.recentImpacts.length > 64) state.recentImpacts.shift();
  if (r.source === 'katyushaCluster') katyushaClusterBlast(x, y, r.blast);
  else {
    juiceBoom(x, y, false, r.blast);
    addBoom(x, y - 2, 24 * r.blast, 8, 0.9, 11 * r.blast);
    if (!G.demo) { addShake(0.45); hitStop(0.04, 0.3); SFX.boom(); }
  }
}
// The medium rocket recipe grows with the cluster blast upgrade, retaining its short bright peak.
function katyushaClusterBlast(x, y, scale) {
  addBoom(x, y - 1, rnd(13, 17) * scale, 7, 0.8, 8 * scale);
  lights.push({ x, y, z: 4, r: rnd(44, 56) * scale, c: '#ffb060', life: 0.3, max: 0.3, a: 0.7 });
  rings.push({ x, y, r0: 4 * scale, r1: 26 * scale, t: 0, T: 0.22, c: '#fff1c2', w: 2 });
  for (let i = 0; i < 6; i++) {
    const a = rnd(TAU), v = rnd(40, 90) * scale;
    part({ x, y, z: 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * FORE, vz: rnd(30, 80), g: 200,
      life: rnd(0.3, 0.5), max: 0.5, s: 1, c: pick(['#fff6e0', '#ffd27a', '#ff9a3a']), add: true, drag: 1.5 });
  }
  stampScorch(x, y, 1);
  if (!G.demo) { addShake(0.08); SFX.boom(); }
}
// Search only when due, and retry without storing overdue salvos. The forward test uses the nose.
function updateKatyusha(dt, state) {
  for (let i = 0; i < state.flash.length; i++) state.flash[i] = Math.max(0, state.flash[i] - dt);
  for (let i = state.rounds.length - 1; i >= 0; i--) {
    const r = state.rounds[i];
    r.age += dt; updateRocket(r, dt);
    const split = r.cluster > 0 && r.age >= r.T * KATC.split - 1e-9;
    if (!split && r.age < r.T - 1e-9) continue;
    state.rounds[i] = state.rounds[state.rounds.length - 1]; state.rounds.pop();
    if (split) splitKatyusha(r, state);
    else katyushaImpact(r, state);
  }
  if (!G.up.katyusha || G.result || !(mode === 'play' || G.demo)) { state.queue.length = 0; return; }
  const now = heliWeaponTime();
  while (state.queue.length && state.queue[0].at <= now + 1e-9) launchKatyusha(state.queue.shift(), state);
  if (now < state.next - 1e-9 || now < state.retry - 1e-9) return;
  const mount = trainMount(KATC.car, 0, 0, KATC.deck), nose = G.tr.cars[0], blast = G.up.katyushaBlast || 1;
  const ahead = (z) => (z.x - nose.x0) * nose.dx + (z.y - nose.y0) * nose.dy > 0;
  const target = bestCrowd(mount.x, mount.y, KATC.range, KATC.radius * blast, ahead);
  if (!target) { state.retry = now + KATC.retry; return; }
  const count = G.up.katyushaRockets || 6, cluster = G.up.clusterRockets || 0;
  state.next = state.retry ? now + G.up.katyushaReload : state.next + G.up.katyushaReload;
  state.retry = 0; state.salvos++; state.ang = Math.atan2(target.x - mount.x, -(target.y - mount.y));
  state.lastTarget = { ...target, t: now };
  state.lastSalvo = { t: now, count, x: target.x, y: target.y, damage: KATC.damage, radius: KATC.radius * blast, cluster };
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU, q = { at: now + i * KATC.gap, angle: state.ang,
      x: target.x + Math.cos(a) * KATC.spread, y: target.y + Math.sin(a) * KATC.spread * FORE,
      radius: KATC.radius * blast, blast, cluster, salvo: state.salvos, index: i };
    if (i === 0) launchKatyusha(q, state);
    else state.queue.push(q);
  }
}
function drawKatyushaRack() {
  const state = trainWeaponState().katyusha, mount = trainMount(KATC.car, 0, 0, KATC.deck);
  const i = mod(Math.round(state.ang / TAU * KATC.headings), KATC.headings), art = (thermal ? KATART.h : KATART.n)[i];
  blit(art, Math.round(mount.x) - art.ox, Math.round(mount.y - mount.z) - art.oy);
}
function drawKatyushaFx() {
  const state = trainWeaponState().katyusha;
  for (const r of state.rounds) drawRocket(r);
  if (!G.up.katyusha || thermal) return;
  const mount = trainMount(KATC.car, 0, 0, KATC.deck);
  for (let i = 0; i < state.flash.length; i++) {
    if (state.flash[i] <= 0) continue;
    const [x, y] = turnXY(state.ang, KAT_TUBES[i], -KATC.tubeFront);
    light(mount.x + x, mount.y + y - mount.z - KATC.muzzleZ, 8, '#ffd27a', state.flash[i] / KATC.flash);
  }
}

mgCarArt();
katyushaArt();
