/* The game: an AC-130 circling over an endless countryside at night. The camera looks where the
 * crosshair is; the guns fire from the aircraft itself, so every round leaves the camera and flies
 * a second or so down to the ground. Units are metres and seconds. */

const CFG = {
  fuel: 60,
  orbit: { radius: 780, alt: 980, period: 120 },
  fov: { def: 5, min: 2.2, max: 10 },
  mg: { rate: 12, speed: 1500, spread: 0.0016, splash: 2.6, victims: 4, heatPer: 0.035, cool: 0.45 },
  he: { reload: 2.6, speed: 800, kill: 11, hurt: 18 },
  pop: { start: 160, perSec: 8, max: 700 },
  types: [
    { hp: 1, speed: [1.1, 1.7], value: 1, scale: [1.12, 1.28], heat: [0.86, 0.97], run: false },
    { hp: 1, speed: [4.2, 5.6], value: 2, scale: [1.08, 1.18], heat: [0.92, 1.0], run: true },
    { hp: 8, speed: [0.85, 1.0], value: 10, scale: [1.62, 1.75], heat: [1.0, 1.06], run: false },
  ],
};

function createGame() {
  const S = {};
  const R = Math.random;
  const cam = R3.camera;
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const camF = new THREE.Vector3(), camR = new THREE.Vector3(), camU = new THREE.Vector3();

  function reset(keepPlace) {
    S.t = S.t || 0; S.run = 0; S.fuel = CFG.fuel; S.kills = 0; S.cash = 0; S.shots = 0; S.hits = 0; S.bestBlast = 0;
    S.mode = 'title'; S.endT = 0;
    S.trigger = false; S.mgCd = 0; S.mgHeat = 0; S.overheat = false; S.heReload = 0; S.hitT = 0;
    if (!keepPlace || !S.C) { const [x, z] = startSpot(); S.C = new THREE.Vector3(x, 0, z); S.T = new THREE.Vector3(x, 0, z); S.theta = 0.8; }
    S.fov = CFG.fov.def; S.fovT = CFG.fov.def; S.pan = [0, 0]; S.panV = [0, 0];
    S.locked = S.locked || false; S.free = S.free || false; S.cursor = S.cursor || { x: 0.5, y: 0.5 }; S.aim = new THREE.Vector3(); S.aimOK = false;
    S.shake = 0; S.zoomBlur = 0;
    S.zombies = []; S.dying = []; S.rounds = []; S.flames = []; S.events = []; S.spawnCd = 0; S.attractT = 1.5; S.burst = null; S.nextId = 1;
    S.viewR = 300;
  }

  /* ------------------------------------------------------------ camera */
  function updateCamera(dt) {
    S.theta += dt * TAU / CFG.orbit.period;
    // WASD slides the whole orbit over the ground, in the camera's frame
    const fx = -Math.cos(S.theta), fz = -Math.sin(S.theta), rx = -fz, rz = fx;
    let px = S.pan[0], py = S.pan[1];
    if (S.free && S.mode === 'play') {       // no mouse lock: the cursor at the edge of the view pushes it along
      const ex = S.cursor.x * 2 - 1, ey = S.cursor.y * 2 - 1;
      px = clamp(px + Math.sign(ex) * smoothstep(0.7, 0.97, Math.abs(ex)), -1, 1);
      py = clamp(py + Math.sign(ey) * smoothstep(0.7, 0.97, Math.abs(ey)), -1, 1);
    }
    const sp = 70 * (S.fov / CFG.fov.def), k = Math.min(1, dt * 5);
    S.panV[0] += ((rx * px + fx * -py) * sp - S.panV[0]) * k;
    S.panV[1] += ((rz * px + fz * -py) * sp - S.panV[1]) * k;
    S.C.x += S.panV[0] * dt; S.C.z += S.panV[1] * dt; S.T.x += S.panV[0] * dt; S.T.z += S.panV[1] * dt;
    // the aim may roam; past 260 m the orbit follows it
    const dx = S.T.x - S.C.x, dz = S.T.z - S.C.z, d = Math.hypot(dx, dz);
    if (d > 260) { S.C.x = S.T.x - dx / d * 260; S.C.z = S.T.z - dz / d * 260; }
    S.fov += (S.fovT - S.fov) * Math.min(1, dt * 6);
    S.zoomBlur = Math.max(0, Math.min(1, Math.abs(S.fovT - S.fov) / 2.5));
    cam.fov = S.fov;
    cam.updateProjectionMatrix();
    cam.position.set(S.C.x + Math.cos(S.theta) * CFG.orbit.radius, CFG.orbit.alt, S.C.z + Math.sin(S.theta) * CFG.orbit.radius);
    const j = S.shake * S.fov / CFG.fov.def * 0.9;
    V1.set(S.T.x + (R() - 0.5) * j, 0, S.T.z + (R() - 0.5) * j);
    cam.lookAt(V1);
    cam.updateMatrixWorld();
    U.uCamPos.value.copy(cam.position);
    U_PX.value = 2 * Math.tan(S.fov * Math.PI / 360) / R3.h;
    cam.getWorldDirection(camF); camR.crossVectors(camF, cam.up).normalize(); camU.crossVectors(camR, camF);
    // where the crosshair falls: the middle of the screen when the mouse is locked, else the cursor
    if (S.locked || S.mode !== 'play') S.aim.copy(S.T), S.aimOK = true;
    else {
      ndc.set(S.cursor.x * 2 - 1, -(S.cursor.y * 2 - 1));
      ray.setFromCamera(ndc, cam);
      S.aimOK = !!ray.ray.intersectPlane(groundPlane, S.aim);
    }
    // how far the view reaches on the ground, for spawning just out of sight
    let r = 0;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ndc.set(x, y); ray.setFromCamera(ndc, cam);
      if (ray.ray.intersectPlane(groundPlane, V2)) r = Math.max(r, Math.hypot(V2.x - S.T.x, V2.z - S.T.z));
    }
    S.viewR = r || 400;
  }
  // the mouse moved by (dx, dy) pixels while locked: move the aim across the ground
  function look(dx, dy) {
    const mpp = 2 * cam.position.distanceTo(S.T) * Math.tan(S.fov * Math.PI / 360) / Math.max(1, innerHeight);
    const fx = camF.x, fz = camF.z, fl = Math.hypot(fx, fz) || 1, rl = Math.hypot(camR.x, camR.z) || 1;
    const k = mpp * 0.85;
    S.T.x += (camR.x / rl * dx - fx / fl * dy * 1.25) * k;
    S.T.z += (camR.z / rl * dx - fz / fl * dy * 1.25) * k;
  }

  /* --------------------------------------------------------- the horde */
  // the dead move in packs: each pack drifts towards its own spot near the middle of the orbit
  function newPack(p) {
    const a = R() * TAU, r = 10 + R() * 70;
    p = p || {};
    p.ox = Math.cos(a) * r; p.oz = Math.sin(a) * r; p.next = S.t + 6 + R() * 8;
    return p;
  }
  function makeZombie(x, z, type, pack) {
    const T = CFG.types[type], s = T.scale[0] + R() * (T.scale[1] - T.scale[0]);
    return {
      id: S.nextId++, x, z, type, hp: T.hp, value: T.value, run: T.run, big: type === 2,
      speed: T.speed[0] + R() * (T.speed[1] - T.speed[0]), scale: s, heat: T.heat[0] + R() * (T.heat[1] - T.heat[0]),
      yaw: R() * TAU, phase: R() * TAU, seed: R(), limp: R() < 0.35 ? R() : 0, flash: 0,
      pack: pack || newPack(), jx: (R() - 0.5) * 10, jz: (R() - 0.5) * 10, wob: R() * TAU, block: [], blockT: 0,
    };
  }
  function pickType() {
    if (S.mode !== 'play') return R() < 0.07 ? 1 : 0;
    const r = R();
    if (S.run > 25 && r < 0.05) return 2;
    if (S.run > 8 && r < 0.16) return 1;
    return 0;
  }
  function pack(n, hx, hz) {
    const p = newPack();
    for (let k = 0; k < n; k++) {
      const r = Math.sqrt(R()) * (6 + n * 0.45), b = R() * TAU;
      S.zombies.push(makeZombie(hx + Math.cos(b) * r, hz + Math.sin(b) * r, pickType(), p));
    }
  }
  // a pack walks in from just out of sight
  function spawnHorde(n) {
    const a = R() * TAU, d = S.viewR + 15 + R() * 40;
    pack(n, S.T.x + Math.cos(a) * d, S.T.z + Math.sin(a) * d);
  }
  // packs already in view (a new mission, the title screen)
  function spawnScatter(n) {
    while (n > 0) {
      const m = Math.min(n, 6 + Math.floor(R() * 16)), a = R() * TAU, r = 25 + Math.sqrt(R()) * S.viewR * 1.1;
      pack(m, S.T.x + Math.cos(a) * r, S.T.z + Math.sin(a) * r);
      n -= m;
    }
  }
  const GC = 2, gk = (i, j) => (i + 500000) * 1000003 + (j + 500000);
  let grid = new Map();
  function updateZombies(dt) {
    const want = S.mode === 'play' || S.mode === 'ending' ? Math.min(CFG.pop.max, CFG.pop.start + CFG.pop.perSec * S.run) : 220;
    S.spawnCd -= dt;
    if (S.spawnCd <= 0 && S.zombies.length < want) { spawnHorde(Math.min(Math.ceil(want - S.zombies.length), 10 + Math.floor(R() * 16))); S.spawnCd = 0.45; }
    for (const z of S.zombies) {
      const pk = z.pack;
      if (S.t > pk.next) newPack(pk);
      const dx = S.C.x + pk.ox + z.jx - z.x, dz = S.C.z + pk.oz + z.jz - z.z, d = Math.hypot(dx, dz) || 1;
      z.wob += dt * (z.run ? 2 : 0.8);
      const w = Math.sin(z.wob) * (z.run ? 0.25 : 0.45), cw = Math.cos(w), sw = Math.sin(w);
      const ux = (dx * cw - dz * sw) / d, uz = (dx * sw + dz * cw) / d;
      const sp = z.speed * (d < 4 ? 0.12 : 1) * (z.flash > 0 ? 0.3 : 1);
      z.x += ux * sp * dt; z.z += uz * sp * dt;
      let dy = Math.atan2(ux, uz) - z.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      z.yaw += dy * Math.min(1, dt * 4);
      z.phase += dt * (sp * (z.run ? 2.3 : 3.6) / z.scale + 0.3);
      if (z.flash > 0) z.flash -= dt;
      if (Math.hypot(z.x - S.T.x, z.z - S.T.z) > 750) z.gone = true;
    }
    // spacing in the crowd, and round houses, cars and trees
    grid = new Map();
    for (const z of S.zombies) {
      const k = gk(Math.floor(z.x / GC), Math.floor(z.z / GC));
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(z);
    }
    for (const a of S.zombies) {
      const ra = a.big ? 0.85 : 0.48, ix = Math.floor(a.x / GC), iz = Math.floor(a.z / GC);
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iz - 1; j <= iz + 1; j++) {
        const list = grid.get(gk(i, j));
        if (!list) continue;
        for (const b of list) {
          if (b === a) continue;
          const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz, rr = ra + (b.big ? 0.85 : 0.48);
          if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), p = (rr - d) * 0.25 / d; a.x += dx * p; a.z += dz * p; b.x -= dx * p; b.z -= dz * p; }
        }
      }
      a.blockT -= dt;
      if (a.blockT <= 0) { blockersNear(a.x, a.z, a.block); a.blockT = 0.5 + R() * 0.3; }
      for (let k = 0; k < a.block.length; k += 3) {
        const dx = a.x - a.block[k], dz = a.z - a.block[k + 1], d = Math.hypot(dx, dz), m = a.block[k + 2] + ra;
        if (d < m && d > 1e-4) { a.x = a.block[k] + dx / d * m; a.z = a.block[k + 1] + dz / d * m; }
      }
    }
    S.zombies = S.zombies.filter((z) => !z.gone && !z.dead);
  }
  function nearby(x, z, r, fn) {
    const i0 = Math.floor((x - r) / GC), i1 = Math.floor((x + r) / GC), j0 = Math.floor((z - r) / GC), j1 = Math.floor((z + r) / GC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = grid.get(gk(i, j));
      if (!list) continue;
      for (const zb of list) if (!zb.dead && !zb.gone) { const d = Math.hypot(zb.x - x, zb.z - z); if (d <= r) fn(zb, d); }
    }
  }

  /* ------------------------------------------------------------- death */
  function scoring() { return S.mode === 'play' || S.mode === 'ending'; }
  function blood(x, z, n, up) {
    for (let k = 0; k < n; k++) {
      const a = R() * TAU, v = 1 + R() * 3;
      HOT.spawn(x, 1 + R() * 0.6, z, Math.cos(a) * v, up * (0.5 + R()), Math.sin(a) * v, { life: 0.5 + R() * 0.4, s0: 0.14, s1: 0.1, h0: 0.95, h1: 0.5, a: 0.8, kind: 2, grav: 9 });
    }
  }
  function kill(z, cause, cx, cz, dist) {
    if (z.dead) return;
    z.dead = true;
    if (scoring()) { S.kills++; S.cash += z.value; }
    S.events.push({ type: 'kill' });
    if (cause === 'mg') {
      S.dying.push(Object.assign(z, { mode: 'fall', t: 0, dir: R() < 0.6 ? 1 : -1, flash: 0.08 }));
      blood(z.x, z.z, 5, 3);
      addDecal(2, z.x + (R() - 0.5), z.z + (R() - 0.5), 1.4 + R(), 0.72, S.t);
      return;
    }
    let dx = z.x - cx, dz = z.z - cz;
    const l = Math.hypot(dx, dz) || 1, f = 1 - Math.min(1, dist / CFG.he.kill), v = 5 + f * 13 + R() * 3;
    dx /= l; dz /= l;
    const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, z.yaw);
    const axis = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
    S.dying.push(Object.assign(z, { mode: 'thrown', t: 0, y: 0.95 * z.scale, vx: dx * v, vy: 7 + f * 13 + R() * 4, vz: dz * v, q, axis, spin: 5 + R() * 9, flash: 0.1 }));
    if (f > 0.5) for (let k = 0; k < 6; k++) {
      const a = R() * TAU, s = 4 + R() * 9;
      HOT.spawn(z.x, 1, z.z, Math.cos(a) * s, 6 + R() * 10, Math.sin(a) * s, { life: 1 + R() * 0.8, s0: 0.22, s1: 0.18, h0: 0.95, h1: 0.45, a: 1, kind: 2, grav: 14, spin: 6 });
    }
  }
  const QA = new THREE.Quaternion(), QB = new THREE.Quaternion();
  function updateDying(dt) {
    for (const z of S.dying) {
      z.t += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.mode === 'fall') {
        if (z.t >= 0.6) {
          QA.setFromAxisAngle(Y_AXIS, z.yaw); QB.setFromAxisAngle(X_AXIS, -Math.PI / 2 * z.dir);
          QA.multiply(QB);
          addCorpse(z, QA, z.x, 0.12 * z.scale, z.z, S.t);
          z.done = true;
        }
        continue;
      }
      z.vy -= 14 * dt;
      z.x += z.vx * dt; z.y += z.vy * dt; z.z += z.vz * dt;
      QA.setFromAxisAngle(z.axis, z.spin * dt); z.q.premultiply(QA);
      if (z.y <= 0.3 * z.scale && z.vy < 0) {
        QA.setFromAxisAngle(Y_AXIS, R() * TAU); QB.setFromAxisAngle(X_AXIS, (R() < 0.5 ? -1 : 1) * Math.PI / 2);
        QA.multiply(QB);
        addCorpse(z, QA, z.x, 0.12 * z.scale, z.z, S.t);
        addDecal(2, z.x, z.z, 1.8 + R(), 0.75, S.t);
        for (let k = 0; k < 4; k++) COOL.spawn(z.x, 0.3, z.z, (R() - 0.5) * 3, 1 + R(), (R() - 0.5) * 3, { life: 1.2, s0: 0.6, s1: 1.6, h0: 0.36, h1: 0.33, a: 0.5, kind: 1, drag: 2 });
        z.done = true;
      }
    }
    S.dying = S.dying.filter((z) => !z.done);
  }

  /* ----------------------------------------------------------- weapons */
  // The guns sit just under the camera, so their rounds come up from the bottom of the picture. A round's
  // start rides along with the aircraft while it flies, so the streak always leaves the camera.
  function gunPort(side, out) {
    return (out || new THREE.Vector3()).copy(cam.position).addScaledVector(camF, 16).addScaledVector(camR, side * 0.7).addScaledVector(camU, -5.5);
  }
  function fireMG(target, player) {
    const a = gunPort(1), b = new THREE.Vector3().copy(target), dist = a.distanceTo(b);
    const s = CFG.mg.spread * dist * Math.sqrt(R()), ang = R() * TAU;
    b.x += Math.cos(ang) * s; b.z += Math.sin(ang) * s; b.y = 0;
    const d = a.distanceTo(b);
    S.rounds.push({ kind: 'mg', side: 1, a, b, age: 0, travel: d / CFG.mg.speed, dist: d, streak: 80, width: 0.09, heat: 2.2, player });
    if (player) { S.shots++; S.mgHeat = Math.min(1, S.mgHeat + CFG.mg.heatPer); S.shake = Math.min(1.2, S.shake + 0.07); S.events.push({ type: 'mg' }); }
  }
  function fireHE(target, player) {
    const a = gunPort(-1), b = new THREE.Vector3().copy(target);
    b.y = 0;
    const d = a.distanceTo(b);
    S.rounds.push({ kind: 'he', side: -1, a, b, age: 0, travel: d / CFG.he.speed, dist: d, streak: 40, width: 0.26, heat: 3.2, player });
    if (player) { S.heReload = CFG.he.reload; S.shake = Math.min(1.6, S.shake + 0.9); S.events.push({ type: 'cannon' }); }
  }
  function mgImpact(r) {
    const x = r.b.x, z = r.b.z;
    let hits = 0;
    nearby(x, z, CFG.mg.splash, (zb) => {
      if (hits >= CFG.mg.victims) return;
      hits++;
      zb.hp -= 1; zb.flash = 0.1;
      blood(zb.x, zb.z, 2, 2);
      if (zb.hp <= 0) kill(zb, 'mg', x, z, 0);
    });
    if (hits && r.player) { S.hits++; S.hitT = 0.15; }
    HOT.spawn(x, 0.6, z, 0, 0.5, 0, { life: 0.09, s0: 2.6, s1: 3.4, h0: 2.6, h1: 1.2, a: 1, kind: 0 });
    for (let k = 0; k < 5; k++) {
      const a = R() * TAU, v = 6 + R() * 12;
      HOT.spawn(x, 0.3, z, Math.cos(a) * v, 3 + R() * 9, Math.sin(a) * v, { life: 0.2 + R() * 0.25, s0: 0.12, h0: 1.8, h1: 0.8, a: 1, kind: 3, grav: 20 });
    }
    for (let k = 0; k < 4; k++) {
      const a = R() * TAU, v = 1.5 + R() * 4;
      COOL.spawn(x, 0.3, z, Math.cos(a) * v, 3 + R() * 6, Math.sin(a) * v, { life: 0.7 + R() * 0.5, s0: 0.22, s1: 0.18, h0: 0.38, a: 1, kind: 2, grav: 16 });
    }
    COOL.spawn(x, 0.8, z, (R() - 0.5), 1.2, (R() - 0.5), { life: 1.6, s0: 1.2, s1: 3.6, h0: 0.5, h1: 0.36, a: 0.55, kind: 1, drag: 1.5 });
    addDecal(1, x, z, 1.8 + R() * 0.8, 0.85, S.t);
    addHeat(x, z, 2.6, 0.5, 1.4);
  }
  function explode(x, z, player) {
    let killed = 0, value = 0;
    nearby(x, z, CFG.he.hurt, (zb, d) => {
      if (d >= CFG.he.kill) {
        zb.hp -= 4; zb.flash = 0.25;
        const k = 2.5 / Math.max(d, 1);
        zb.x += (zb.x - x) * k; zb.z += (zb.z - z) * k;
        if (zb.hp > 0) return;
      }
      value += zb.value; killed++;
      kill(zb, 'he', x, z, d);
    });
    // the flash, a fireball rolling up, a ring of hot air, earth and sparks thrown out, smoke
    HOT.spawn(x, 3, z, 0, 0, 0, { life: 0.12, s0: 10, s1: 18, h0: 4, h1: 1.5, a: 1, kind: 0 });
    for (let k = 0; k < 12; k++) {                     // the fireball, rolling up and cooling
      const a = R() * TAU, v = R() * 7, r = R() * 3;
      HOT.spawn(x + Math.cos(a) * r, 1.5 + R() * 3, z + Math.sin(a) * r, Math.cos(a) * v, 3 + R() * 6, Math.sin(a) * v,
        { life: 1 + R() * 0.8, s0: 2.5 + R() * 1.5, s1: 7 + R() * 4, h0: 2.4, h1: 0.4, a: 1, kind: 0, grav: -5, drag: 1.6 });
    }
    for (let k = 0; k < 6; k++) {                      // burning ground
      const a = R() * TAU, r = 2 + R() * 6;
      HOT.spawn(x + Math.cos(a) * r, 0.8, z + Math.sin(a) * r, 0, 0.6, 0, { life: 2 + R() * 1.5, s0: 3, s1: 5, h0: 1.3, h1: 0.35, a: 1, kind: 0 });
    }
    for (let k = 0; k < 32; k++) {                     // white-hot fragments flung out on arcs
      const a = R() * TAU, v = 10 + R() * 26;
      HOT.spawn(x, 1, z, Math.cos(a) * v, 10 + R() * 22, Math.sin(a) * v, { life: 0.9 + R() * 1, s0: 0.45, h0: 2.2, h1: 0.6, a: 1, kind: 3, grav: 18, drag: 0.4 });
    }
    for (let k = 0; k < 4; k++) {                      // and a few that keep burning where they land
      const a = R() * TAU, r = 9 + R() * 14;
      S.flames.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, life: 5 + R() * 7 });
    }
    for (let k = 0; k < 45; k++) {
      const a = R() * TAU, v = 6 + R() * 22;
      COOL.spawn(x, 0.5, z, Math.cos(a) * v, 6 + R() * 20, Math.sin(a) * v, { life: 1.2 + R() * 1.2, s0: 0.35 + R() * 0.3, s1: 0.3, h0: R() < 0.3 ? 0.9 : 0.42, h1: 0.36, a: 1, kind: 2, grav: 20, spin: 8 });
    }
    for (let k = 0; k < 14; k++) {
      const a = R() * TAU, r = R() * 6;
      COOL.spawn(x + Math.cos(a) * r, 2 + R() * 6, z + Math.sin(a) * r, Math.cos(a) * 1.5, 2.5 + R() * 2.5, Math.sin(a) * 1.5,
        { life: 6 + R() * 4, s0: 4 + R() * 3, s1: 16 + R() * 9, h0: 0.62, h1: 0.34, a: 0.55, kind: 1, drag: 0.5, fadeIn: 0.1 });
    }
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU;
      COOL.spawn(x + Math.cos(a) * 3, 0.8, z + Math.sin(a) * 3, Math.cos(a) * 26, 1, Math.sin(a) * 26,
        { life: 1.6, s0: 2.5, s1: 6, h0: 0.45, h1: 0.34, a: 0.5, kind: 1, drag: 3 });
    }
    addRing(x, z, CFG.he.hurt * 1.5, 2.2);
    addDecal(0, x, z, 20 + R() * 4, 1, S.t);
    addHeat(x, z, 11, 0.9, 1.2);
    addHeat(x, z, 9, 0.16, 25);
    S.events.push({ type: 'boom', kills: killed, x, z });
    if (player && scoring() && killed) {
      S.bestBlast = Math.max(S.bestBlast, killed);
      if (killed >= 4) S.events.push({ type: 'multi', kills: killed, value });
    }
  }
  function updateRounds(dt) {
    for (const r of S.rounds) {
      r.age += dt;
      gunPort(r.side, r.a);
      if (r.kind === 'he' && r.age < r.travel) {
        const u = r.age / r.travel;
        HOT.spawn(lerp(r.a.x, r.b.x, u), lerp(r.a.y, r.b.y, u), lerp(r.a.z, r.b.z, u), 0, 0, 0, { life: 0.05, s0: 1.4, h0: 3, a: 1, kind: 0 });
      }
      if (r.age >= r.travel) { r.done = true; if (r.kind === 'he') explode(r.b.x, r.b.z, r.player); else mgImpact(r); }
    }
    S.rounds = S.rounds.filter((r) => !r.done);
  }
  // burning wrecks and houses: tongues of fire and a column of warm smoke; little fires left by blasts
  function updateFires(dt) {
    for (const f of S.flames) {
      f.life -= dt;
      if (R() < dt * 14) HOT.spawn(f.x + (R() - 0.5), 0.4, f.z + (R() - 0.5), 0, 1.5 + R(), 0,
        { life: 0.35 + R() * 0.3, s0: 0.7 + R() * 0.5, s1: 0.2, h0: 1.4, h1: 0.5, a: 1, kind: 0, grav: -2 });
    }
    S.flames = S.flames.filter((f) => f.life > 0);
    for (const f of ACTIVE.fires) {
      if (Math.abs(f.x - S.T.x) > 500 || Math.abs(f.z - S.T.z) > 500) continue;
      const k = f.big ? 2.2 : 1, w = f.big ? 6 : 3;
      if (R() < dt * 30 * k) HOT.spawn(f.x + (R() - 0.5) * w, f.y + R(), f.z + (R() - 0.5) * w * 0.6, (R() - 0.5), 3 + R() * 3, (R() - 0.5),
        { life: 0.4 + R() * 0.5, s0: (0.9 + R() * 0.8) * (f.big ? 1.4 : 1), s1: 0.3, h0: 1.5, h1: 0.6, a: 1, kind: 0, grav: -2 });
      if (R() < dt * 5 * k) COOL.spawn(f.x + (R() - 0.5) * w * 0.6, f.y + 2, f.z + (R() - 0.5) * w * 0.6, 0.8 + (R() - 0.5), 3 + R() * 2, (R() - 0.5),
        { life: 7 + R() * 3, s0: 2 * k, s1: 11 * k, h0: 0.5, h1: 0.34, a: 0.5, kind: 1, drag: 0.3, fadeIn: 0.1 });
    }
  }
  // the title screen: the gunship works the horde on its own
  function attract(dt) {
    if (S.burst) {
      S.burst.cd -= dt;
      while (S.burst.cd <= 0 && S.burst.n > 0) { fireMG(S.burst.p, false); S.burst.n--; S.burst.cd += 1 / CFG.mg.rate; }
      if (S.burst.n <= 0) S.burst = null;
    }
    S.attractT -= dt;
    if (S.attractT > 0 || !S.zombies.length) return;
    S.attractT = 1.4 + R() * 1.8;
    const z = S.zombies[Math.floor(R() * S.zombies.length)];
    if (Math.hypot(z.x - S.T.x, z.z - S.T.z) > S.viewR * 0.55) return;
    const p = new THREE.Vector3(z.x, 0, z.z);
    if (R() < 0.45) fireHE(p, false); else S.burst = { p, n: 12, cd: 0 };
  }

  /* -------------------------------------------------------------- step */
  function update(dt) {
    S.t += dt;
    U.uTime.value = S.t;
    if (S.mode !== 'play') S.pan[0] = S.pan[1] = 0;
    updateCamera(dt);
    if (S.mode === 'play') {
      S.run += dt; S.fuel -= dt;
      S.mgHeat = Math.max(0, S.mgHeat - CFG.mg.cool * dt * (S.trigger && !S.overheat ? 0.25 : 1));
      if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); }
      if (S.overheat && S.mgHeat < 0.35) S.overheat = false;
      if (S.trigger && !S.overheat && S.aimOK) {
        S.mgCd -= dt;
        while (S.mgCd <= 0 && !S.overheat) { fireMG(S.aim, true); S.mgCd += 1 / CFG.mg.rate; if (S.mgHeat >= 1) { S.overheat = true; S.events.push({ type: 'overheat' }); } }
      } else S.mgCd = Math.max(0, S.mgCd - dt);
      S.heReload = Math.max(0, S.heReload - dt);
      if (S.fuel <= 0) { S.fuel = 0; S.mode = 'ending'; S.endT = 0; S.trigger = false; S.events.push({ type: 'fuelout' }); }
    } else if (S.mode === 'title') attract(dt);
    else if (S.mode === 'ending') { S.endT += dt; if (S.endT > 1.4) S.mode = 'over'; }
    S.hitT = Math.max(0, S.hitT - dt);
    S.shake = Math.max(0, S.shake - dt * 2.5);
    updateWorld(S.T.x, S.T.z);
    updateZombies(dt);
    updateRounds(dt);
    updateDying(dt);
    updateFires(dt);
    updateFx(dt);
    packHeat(dt, ACTIVE.fires, S.t);
    writeTracers(S.rounds);
    writeZombies(S.zombies, S.dying, S.t);
  }

  reset(false);
  return {
    S, update, look,
    start() {
      reset(true);
      S.mode = 'play';
      S.zombies = []; S.dying = []; S.rounds = []; S.flames = [];
      clearCorpses(); clearFx();
      spawnScatter(CFG.pop.start);
    },
    spawnScatter,
    trigger(on) { S.trigger = !!on && S.mode === 'play'; },
    fireHE() { if (S.mode === 'play' && S.heReload <= 0 && S.aimOK) fireHE(S.aim, true); },
    setPan(x, y) { S.pan[0] = x; S.pan[1] = y; },
    zoom(f) { S.fovT = clamp(S.fovT * f, CFG.fov.min, CFG.fov.max); },
    cycleZoom() { const steps = [9, 5, 2.6], i = steps.findIndex((v) => v < S.fovT - 0.1); S.fovT = i < 0 ? steps[0] : steps[i]; },
  };
}
