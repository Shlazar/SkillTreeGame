// towers.js - what you build at a station, in the run: MG nests that shoot by themselves, sandbags
// the dead must climb over, barbed wire that slows them. Also the corn round each station (the dead
// come out of it), the sprites of all of these, and their sounds. What is built where is kept in
// SAVE.towers[station id] (the Station tab in the Depot edits it, stationtab.js).

// MG NEST: rounds per second come from the tree (G.up.nest), damage, how many zombies one round
// hits (its target and the nearest within splash px), range (px), round flight time, barrel turn
// speed. SANDBAGS: blocker radius, seconds of pushing before a zombie climbs over, and how long the
// climb takes. Prices and limits per station: a nest (the first is free), sandbags (6 free), wire.
const TOWER = {
  nest: { dmg: 1, hits: 2, splash: 5, range: 96, travel: 0.07, turn: 12, max: 4, cost: [0, 150, 300, 600], free: 1 },
  bag: { r: 11, push: 3, climb: 1, max: 24, cost: 10, free: 6 },
  wire: { max: 12, cost: 15 }
};
const TOWER_TYPES = ['nest', 'bag', 'wire'];

// ---------- what is built (the save)
// The towers at station id: [{t, c, r, paid}], the free kit until anything is changed there.
function towersOf(id) {
  const list = SAVE.towers[id];
  if (Array.isArray(list)) return list.filter((o) => o && TOWER[o.t] && o.c >= 0 && o.c < GRID_C && o.r >= 0 && o.r < GRID_R);
  const d = stopDef(id);
  return d && d.kit ? d.kit.map(([t, c, r]) => ({ t, c, r, paid: 0 })) : [];
}
// how many of type t stand at station id, and how many of them were free
const builtOf = (list, t) => list.filter((o) => o.t === t).length;
// What the next one of type t costs at station id (prices count per station; free kit slots first).
function towerPrice(list, t) {
  const n = builtOf(list, t), free = list.filter((o) => o.t === t && !o.paid).length;
  if (t === 'nest') return free < TOWER.nest.free ? 0 : TOWER.nest.cost[Math.min(n, TOWER.nest.cost.length - 1)];
  if (t === 'bag') return free < TOWER.bag.free ? 0 : TOWER.bag.cost;
  return TOWER.wire.cost;
}

// ---------- the sprites (made when first needed)
// ART.nest[i] = an MG nest with its gun turned to heading i of NEST_N (0 = north, clockwise);
// ART.bag, ART.wire, ART.corn[k] = props (sprite + anchor).
const ART = { nest: [], bag: null, wire: null, corn: [] }, NEST_N = 16;
function towerArt() {
  if (ART.bag) return ART;
  // sandbags: two rows of fat bags, lit from the north-west
  const bagRow = (r, y, n, x0) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 5;
      r(x, y, 5, 4, '#8f7a4e'); r(x, y, 5, 1, '#c4ad78'); r(x, y + 1, 1, 2, '#ad9662'); r(x + 4, y + 1, 1, 3, '#6e5c3a'); r(x, y + 3, 5, 1, '#5a4a2e');
    }
  };
  ART.bag = prop(outline(pix(15, 8, (r) => { bagRow(r, 4, 3, 0); bagRow(r, 0, 2, 2); r(7, 1, 1, 1, '#d9c48c'); }), '#1c160c'), 0);
  // barbed wire: two coils on short posts, barbs glinting
  ART.wire = prop(pix(16, 8, (r) => {
    r(1, 2, 1, 6, '#4a3a28'); r(14, 2, 1, 6, '#4a3a28');
    for (let i = 0; i < 4; i++) {
      const x = 1 + i * 4;
      r(x, 2, 4, 1, '#8b919c'); r(x, 6, 4, 1, '#5d616b'); r(x, 3, 1, 3, '#7a7f89'); r(x + 3, 3, 1, 3, '#4b4f5a');
      r(x + 1, 2, 1, 1, '#d6d9de'); r(x + 2, 4, 1, 1, '#b4b9c1');
    }
  }), 0);
  // corn: a clump of stalks with leaves and pale tassels (3 kinds)
  for (let k = 0; k < 3; k++) {
    const rng = mulberry(77 + k);
    ART.corn.push(prop(pix(11, 19, (r) => {
      for (let s = 0; s < 3; s++) {
        const x = 2 + s * 3 + ((rng() * 2) | 0), h = 13 + ((rng() * 5) | 0), y0 = 19 - h;
        r(x, y0, 1, h, s === 1 ? '#5f6b2c' : '#4c5726');
        for (let y = y0 + 3; y < 17; y += 3 + ((rng() * 2) | 0)) {
          const d = rng() < 0.5 ? -1 : 1;
          r(x + d, y, 1, 1, '#76823a'); r(x + d * 2, y + 1, 1, 1, '#56622a');
        }
        r(x, y0 - 1, 1, 1, '#c9b56a'); r(x - 1, y0, 1, 1, '#9a8c4a'); r(x + 1, y0, 1, 1, '#9a8c4a');
      }
    }), 0));
  }
  // the MG nest: a ring of sandbags round a pit, the gun on a post in the middle
  for (let i = 0; i < NEST_N; i++) {
    const a = i / NEST_N * TAU, sx = Math.sin(a), sy = -Math.cos(a) * FORE;
    const spr = pix(22, 18, (r) => {
      // the pit and the ring
      r(4, 9, 14, 6, '#2a241a');
      for (let k = 0; k < 6; k++) {
        r(2 + k * 3, 13, 4, 4, '#8f7a4e'); r(2 + k * 3, 13, 4, 1, '#c4ad78'); r(5 + k * 3, 14, 1, 3, '#6e5c3a');
      }
      r(1, 9, 3, 5, '#8f7a4e'); r(1, 9, 3, 1, '#b8a16c'); r(18, 9, 3, 5, '#7d6a42'); r(18, 9, 3, 1, '#a8925e');
      for (let k = 0; k < 4; k++) { r(4 + k * 4, 7, 4, 3, '#7d6a42'); r(4 + k * 4, 7, 4, 1, '#b8a16c'); }
      // the gunner's helmet behind the gun
      const hx = Math.round(11 - sx * 3), hy = Math.round(10 - sy * 3);
      r(hx - 1, hy - 1, 3, 2, '#4a5732'); r(hx - 1, hy - 1, 2, 1, '#6a7a48');
      // the gun: a body and a barrel turned to heading a
      r(10, 8, 2, 3, '#3a3e48');
      for (let t = 0; t <= 9; t += 0.5) {
        const x = Math.round(11 + sx * t), y = Math.round(9 + sy * t);
        r(x, y, 1, 1, t < 3 ? '#626875' : '#2a2d33');
      }
      const mx = Math.round(11 + sx * 9), my = Math.round(9 + sy * 9);
      r(mx, my, 1, 1, '#8b919c');
    });
    const p = prop(outline(spr, '#141210'), 0);
    p.mx = 12 + sx * 10;
    p.my = 10 + sy * 10;
    ART.nest.push(p);
  }
  return ART;
}
const nestIdx = (ang) => mod(Math.round(ang / TAU * NEST_N), NEST_N);

// ---------- the towers in a run
// Put station st's towers into the world, where the grid says (they bend with the rails).
function buildTowers(st) {
  const A = towerArt(), up = G.up;
  for (const o of towersOf(st.id)) {
    if (o.t === 'wire' && !up.wire) continue;
    const p = gridToWorld(o.c, o.r, st.s), x = Math.round(p.x), y = Math.round(p.y);
    const t = { t: o.t, c: o.c, r: o.r, x, y };
    st.towers.push(t);
    if (o.t === 'nest') {
      Object.assign(t, { ang: st.side > 0 ? -Math.PI / 2 : Math.PI / 2, cd: rnd(0.3), tgt: null, look: 0, flash: 0 });
      t.sp = { d: A.nest[nestIdx(t.ang)], x, y: y + 4, k: y + 4 };
      G.statics.push(t.sp);
      st.nests.push(t);
    } else if (o.t === 'bag') {
      G.statics.push({ d: A.bag, x, y: y + 3, k: y + 3 });
      st.bags.push(t);
    } else {
      // (wire lies flat: the dead on it are drawn over it)
      G.statics.push({ d: A.wire, x, y: y + 3, k: y - 6 });
      st.wires.push(t);
    }
  }
}
// The corn: two strips on both sides of the station, 120 to 200 px out from the rails.
function buildCorn(st) {
  const A = towerArt();
  for (let a = -86; a <= 104; a += 8) for (const side of [-1, 1]) for (let u = 122; u <= 198; u += 10) {
    const p = gridToWorld(6.5 + side * (u + rnd(-3, 3)) / TILE, 3.5 + (a + rnd(-2, 2)) / TILE, st.s);
    if (Math.random() < 0.18) continue;
    G.statics.push({ d: pick(A.corn), x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y) });
  }
}
// Every station near the train: its nests shoot, its sandbags hold the dead back, its wire slows them.
function updateTowers(dt) {
  const tr = G.tr;
  for (const st of G.stations) {
    if (!st.towers.length) continue;
    // towers wake when the train is 400 px away, and sleep once it is far past
    const d = tr.s - st.stopS;
    if (!st.awake && d < 400 && d > -400) st.awake = true;
    if (st.awake && d < -600) st.awake = false;
    if (st.awake) for (const n of st.nests) updateNest(n, dt);
    for (const b of st.bags) holdBack(b, dt);
    for (const w of st.wires) slowDown(w, dt);
  }
  updateTowerRounds(dt);
}
// The best target for a nest: the dead holding a survivor, then the dead on the train, then on
// the rails, then the nearest. (Not one the rounds in the air will already kill.)
function nestTarget(n) {
  let best = null, bk = Infinity;
  const s0 = G.tr.s;
  queryEll(n.x, n.y, TOWER.nest.range, (z, d) => {
    if (z.pending >= z.hp) return;
    let k = 3000 + d;
    if (z.st === 2) k = 1000 + d;
    else if (z.st === 1) k = 2000 + d;
    if (k > 1000) for (const p of G.people) if (p.st === 'grab' && p.by === z) k = d;
    if (k < bk) {
      bk = k;
      best = z;
    }
  });
  return best;
}
function updateNest(n, dt) {
  const R = TOWER.nest;
  n.flash = Math.max(0, n.flash - dt);
  let z = n.tgt;
  if (z && (z.dead || Math.hypot(z.x - n.x, (z.y - n.y) / FORE) > R.range + 4)) z = null;
  n.look -= dt;
  if (!z || n.look <= 0) {
    z = nestTarget(n) || (z && z.pending < z.hp ? z : null);
    n.look = 0.1;
  }
  n.tgt = z;
  const want = z ? Math.atan2(z.x - n.x, -(z.y - n.y) / FORE) : n.ang, da = mod(want - n.ang + Math.PI, TAU) - Math.PI;
  n.ang = mod(n.ang + clamp(da, -R.turn * dt, R.turn * dt), TAU);
  n.sp.d = ART.nest[nestIdx(n.ang)];
  n.cd -= dt;
  if (z && Math.abs(da) < 0.35 && n.cd <= 0 && z.pending < z.hp) {
    nestFire(n, z);
    n.cd += 1 / G.up.nest;
  }
  n.cd = Math.max(0, n.cd);
}
// One round from nest n at zombie z: it lands where z will be when it gets there.
function nestFire(n, z) {
  const T = TOWER.nest.travel, A = n.sp.d;
  z.pending += TOWER.nest.dmg;
  G.trounds.push({ n, tgt: z, bx: z.x + z.vx * T, by: z.y + z.vy * T, age: 0, T,
    sx: n.sp.x - A.ax + A.mx, sy: n.sp.y - A.ay + A.my });
  n.flash = 0.05;
  part({ x: n.x + rnd(-2, 2), y: n.y + 2, z: 6, vx: rnd(-20, 20), vy: rnd(-6, 6), vz: rnd(20, 35), g: 220, life: 0.45, max: 0.45, s: 1, c: '#e3b04b' });
  SFX.nest();
}
function updateTowerRounds(dt) {
  const rs = G.trounds;
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    r.age += dt;
    if (r.age < r.T) continue;
    rs[i] = rs[rs.length - 1];
    rs.pop();
    nestImpact(r);
  }
}
// The round lands: its target if it is still in the spot, and the nearest other zombie within 5 px.
function nestImpact(r) {
  const T = r.tgt, R = TOWER.nest, x = r.bx, y = r.by;
  T.pending = Math.max(0, T.pending - R.dmg);
  let hits = 0, other = null, od = R.splash;
  if (!T.dead && Math.hypot(T.x - x, (T.y - y) / FORE) < 8) {
    hitZombie(T, R.dmg, 'nest');
    hits++;
  }
  queryEll(x, y, R.splash, (z, d) => {
    if (z !== T && d <= od) {
      od = d;
      other = z;
    }
  });
  if (other && hits < R.hits) hitZombie(other, R.dmg, 'nest');
  lights.push({ x, y, z: 4, r: 7, c: '#ffb060', life: 0.07, max: 0.07, a: 0.6 });
  for (let k = 0; k < 2; k++) {
    const a = rnd(TAU), s = rnd(15, 40);
    part({ x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(10, 35), g: 160, life: rnd(0.12, 0.25), max: 0.25,
      s: 1, c: pick(['#ffe2a0', '#ffb347']), add: true, drag: 1.5 });
  }
}
// Sandbags: the dead cannot walk through. One that has pushed on them for 3 s climbs over (1 s).
function holdBack(b, dt) {
  const R = TOWER.bag;
  queryEll(b.x, b.y, R.r + 6, (z, d) => {
    if (z.st === 2 || G.t < (z.climbEnd || 0)) return;
    const m = R.r + (z.big ? 6 : 3.5) * 0.6;
    if (d >= m || d < 1e-4) return;
    const dx = z.x - b.x, dy = (z.y - b.y) / FORE;
    z.x = b.x + dx / d * m;
    z.y = b.y + dy / d * m * FORE;
    if (z.pushT !== G.t) {
      if (G.t - (z.pushT || -9) > 0.3) z.push = 0;
      z.push += dt;
      z.pushT = G.t;
      if (z.push >= R.push) {
        z.push = 0;
        z.climbEnd = G.t + R.climb;
      }
    }
  });
}
// Barbed wire: the dead on it walk at 40% (this step's walk is taken back by 60%).
function slowDown(w, dt) {
  const k = 1 - CFG.wire.slow;
  queryEll(w.x, w.y, 12, (z) => {
    if (z.st === 2 || z.wireT === G.t || Math.abs(z.x - w.x) > 8 || Math.abs(z.y - w.y) > 8) return;
    z.wireT = G.t;
    z.x -= (z.vx - z.kbx) * dt * k;
    z.y -= (z.vy - z.kby) * dt * k;
  });
}

// ---------- drawing (in the world, with the glows)
// The nests' tracers and muzzle flashes.
function drawTowerFx() {
  if (G.demo || !G.trounds) return;
  for (const r of G.trounds) {
    const u = r.age / r.T, h = clamp(u * 1.2, 0, 1), t0 = Math.max(0, h - 0.5);
    const ex = r.bx, ey = r.by - 6, hx = lerp(r.sx, ex, h), hy = lerp(r.sy, ey, h);
    pl(ctx, lerp(r.sx, ex, t0), lerp(r.sy, ey, t0), hx, hy, '#c9772f');
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(Math.round(hx), Math.round(hy), 1, 1);
  }
  for (const st of G.stations) for (const n of st.nests) {
    if (n.flash <= 0) continue;
    const A = n.sp.d, mx = Math.round(n.sp.x - A.ax + A.mx), my = Math.round(n.sp.y - A.ay + A.my);
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(mx - 1, my, 3, 1);
    ctx.fillRect(mx, my - 1, 1, 3);
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(mx, my, 1, 1);
    light(mx, my, 7, '#ffb347', 0.7);
  }
}

// ---------- sounds
Object.assign(SFX, {
  nest() {
    // an MG nest: a dry, light knock (quieter than the flatcar gun)
    if (!gap('nest', 45)) return;
    nz(0.05, 0.05, 'bandpass', 1600, 1.4, 600);
    tone(150, 0.05, 'square', 0.012, 70);
  },
  bell() {
    // the station bell: two bright strokes
    tone(1568, 0.6, 'sine', 0.05);
    tone(2349, 0.4, 'sine', 0.02);
    tone(1568, 0.6, 'sine', 0.045, null, 0.32);
    tone(2349, 0.4, 'sine', 0.018, null, 0.32);
  },
  wave() {
    // a moan rising out of the corn
    tone(110, 1.1, 'sawtooth', 0.025, 170);
    tone(98, 1.2, 'sawtooth', 0.02, 150, 0.1);
    nz(1, 0.03, 'bandpass', 420, 1.2, 900);
  },
  place() {
    tone(220, 0.06, 'square', 0.03, 140);
    nz(0.08, 0.06, 'lowpass', 900, 0.8, 300);
  },
  sell() {
    tone(660, 0.07, 'triangle', 0.03);
    tone(880, 0.09, 'triangle', 0.03, null, 0.06);
  }
});
