// helis.js - the Viper escorts the train and its nose gun continuously shoots the closest threat
// (the dead on the train first, then the dead on the rails ahead, then the nearest). It is always
// selected: right click a zombie to focus it, the ground to fly there, or the train to escort it.
// Multiple-unit selection and 105mm helpers remain for the full game, disabled in this demo.
// The model is a pile of top-down slices like the train cars, made at HN headings; the main rotor is
// a baked blur disc with blade flicks, the tail rotor flickers, the shadow falls south-east.

// alt = flying height (px), low = height while it holds a spot, range = how far its gun reaches
// (px on the ground), sep = px two helis keep apart, look = seconds between two looks for a target,
// turn = how fast it turns (radians per second), mast = px from its middle to the rotor mast,
// nose = px from its middle to the gun's muzzle
const HC = { alt: 34, low: 25, range: 150, sep: 40, look: 0.12, turn: 4, mast: 6, nose: 23, names: ['VIPER', 'VIPER 2', 'VIPER 3'] };
// Range preview: seconds at departure, dot spacing in ground px, opacity (proposal)
const HRING = { time: 3, gap: 8, alpha: 0.4 };
// the escort slots round the engine: [px ahead of its nose, px right of the rails]
const SLOTS = [[8, -40], [-58, 44], [-112, -44]];
// the click and selection state: box = a drag that started at (x0, y0), arm = the 105 waits for a
// click on the map, marks = the markers of the last orders, cards = the unit cards on screen,
// lastT / lastH = the last click on a heli (a second one soon after selects them all), msg = a
// short line over the cards for a weapon's loading state
const HUI = { box: null, arm: false, marks: [], cards: [], lastT: -9, lastH: null, msg: null, hov: null };

// ---------- the model
// HSPR.n[i] / h[i] = the heli at heading i / HN * TAU (normal / thermal), sh[i] = its flat shadow.
// ox, oy = where its middle on the ground is in the sprite. ROTOR = the main rotor's blur frames.
const HN = 48, HSPR = { n: [], h: [], sh: [] }, ROTOR = [], ROTOR_R = 21, ROTOR_RY = 17;
let HICON = null;
// the slices, bottom to top: 28 x 46, its nose at the top, its middle at (14, 23). Each pixel of
// each slice comes from heliPix(): the body is a rounded tube (light along its spine, darker to the
// sides), the tandem canopy is glass, two engines bulge behind it, the stub wings carry a rocket pod
// and a missile each, and a long thin tail boom ends in a fin.
const HZ = 9;
function heliSlices() {
  const out = [];
  for (let z = 0; z < HZ; z++) out.push(pix(28, 46, (r) => {
    for (let y = 0; y < 46; y++) for (let x = 0; x < 28; x++) {
      const c = heliPix(x, y, z);
      if (c) r(x, y, 1, 1, c);
    }
  }));
  return out;
}
// the body's half width in row y, and the height of its top
const bodyHW = (y) => (y < 3 ? 0 : y < 7 ? [1.5, 2, 2.5, 3][y - 3] : y < 15 ? 3 : y < 25 ? 3.5 : y < 27 ? 3 : y < 31 ? 2 : y < 45 ? 1 : 0);
const bodyTop = (y) => (y < 5 ? 3 : y < 10 ? 5 : y < 15 ? 6 : y < 27 ? 5 : 3);
// a shade across a rounded top: t = 0 on the spine, 1 at the edge
const roundTop = (t, c) => (t < 0.34 ? c[0] : t < 0.7 ? c[1] : c[2]);
const OLIVE = ['#87945f', '#64714a', '#465034'], GLASS = ['#5f8ca4', '#2f4b5d', '#172630'], POD = ['#666b74', '#484c54', '#33363c'];
function heliPix(x, y, z) {
  const dx = x + 0.5 - 14, ax = Math.abs(dx);
  // the chin gun: its barrel, lit on the left, and the turret ball under the nose
  if (y <= 2 && ax <= 1) return z === 1 ? (dx < 0 ? '#a3a9b2' : '#4b4f5a') : null;
  if (y <= 4 && ax <= 1.5 && (z === 1 || z === 2)) return z === 2 && y === 3 && dx > 0 ? '#ff6a3a' : '#24272c';
  // the rocket pods: their front face full of tubes, a lit top
  if (ax >= 9.5 && ax < 12.5 && y >= 14 && y <= 21 && z >= 1 && z <= 3) {
    if (y === 14) return ax === 10.5 && z === 2 ? '#2d3036' : '#0b0c0e';
    if (z < 3) return '#26282c';
    return roundTop(Math.abs(ax - 11) / 1.5, POD);
  }
  // a missile under each wing (its orange tip shows in front of the wing)
  if (ax >= 6.5 && ax < 8.5 && y >= 15 && y <= 20 && z === 2) return y === 15 ? '#c9772f' : y === 20 ? '#2d3036' : '#4d5442';
  // the stub wings: lit leading edge, a pale mark near each tip
  if (ax < 9.5 && y >= 17 && y <= 19 && z === 3 && ax > 2) {
    if (y === 18 && ax >= 7 && ax < 8) return '#c9cdb8';
    return y === 17 ? '#7c885a' : y === 18 ? '#5d6844' : '#3c4430';
  }
  // the tail planes and the fin (red at its top end)
  if (y >= 38 && y <= 39 && ax <= 5 && z === 3) return y === 38 ? '#6b7650' : '#3c4430';
  if (x === 14 && y >= 39 && z >= 3 && z <= 7) return z === 7 ? (y >= 44 ? '#b8402e' : '#5d6844') : '#3c4430';
  // the engines on each side behind the cockpit: dark intakes in front, exhausts behind
  if (ax >= 2.5 && ax < 5.5 && y >= 15 && y <= 25 && z >= 3 && z <= 6) {
    if (z < 6) return y === 15 ? '#121316' : '#323b28';
    if (y === 15) return '#121316';
    if (y >= 24) return y === 25 ? '#0e0f10' : '#2a2420';
    return roundTop(Math.abs(ax - 4) / 1.5, OLIVE);
  }
  // the rotor mast's base
  if (z === 6 && y >= 16 && y <= 18 && ax <= 1.5) return ax <= 0.5 && y === 17 ? '#6a6f78' : '#2a2d33';
  // the body: a rounded tube, the canopy glass on its top, a yellow stripe on the tail boom
  const hw = bodyHW(y), top = bodyTop(y);
  if (ax > hw || z > top) return null;
  if ((z === top || z === 0) && hw >= 2 && ax > hw - 1) return null;
  const glass = y >= 5 && y <= 14 && y !== 9;
  if (z < top) {
    if (glass && z === top - 1 && ax > hw - 1.5) return '#1b2c38';
    return z <= 1 ? '#1a1e15' : z <= 3 ? '#283021' : '#323b28';
  }
  const t = ax / Math.max(1, hw - 1);
  if (glass) {
    if ((y === 6 || y === 11) && dx > -2 && dx < 0) return '#c4ecf8';
    return roundTop(t, GLASS);
  }
  if (y === 9) return '#20261a';
  if (y === 34) return '#c9b45a';
  return roundTop(t, OLIVE);
}
// A pile of slices drawn flat (no height): the heli's outline seen from right above, for its shadow.
function flatSpr(slices, ang, box) {
  const [c, g] = mk(box, box, true), sw = slices[0].width / 2, sh = slices[0].height / 2;
  g.translate(box / 2, box / 2);
  g.rotate(ang);
  for (const s of slices) g.drawImage(s, -sw, -sh);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const im = g.getImageData(0, 0, box, box), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] >= 110;
    d[i] = d[i + 1] = d[i + 2] = 0;
    d[i + 3] = on ? 255 : 0;
  }
  g.putImageData(im, 0, 0);
  return c;
}
// One frame of the main rotor, its 4 blades at angle th: a see-through pale disc, a blur trailing
// each blade, the blades with yellow tips, and a pale rim (brighter on the side to the sun).
function rotorFrame(th) {
  const R = ROTOR_R, ry = ROTOR_RY;
  return pix(R * 2 + 1, ry * 2 + 1, (r) => {
    for (let y = -ry; y <= ry; y++) for (let x = -R; x <= R; x++) {
      const u = x / R, v = y / ry, d = Math.hypot(u, v);
      if (d > 1 || d < 0.14) continue;
      const a = Math.atan2(v, u);
      let near = 9;
      for (let k = 0; k < 4; k++) near = Math.min(near, mod(th + k * Math.PI / 2 - a, TAU));
      let col;
      if (near * d * R < 0.6) col = d > 0.84 ? '#e0c050' : 'rgba(20,22,26,0.7)';
      else if (d > 0.94) col = 'rgba(226,230,234,' + (u + v < -0.3 ? 0.55 : 0.22) + ')';
      else if (near < 0.9) col = 'rgba(206,212,218,' + (0.05 + 0.24 * Math.pow(1 - near / 0.9, 2)).toFixed(2) + ')';
      else col = 'rgba(206,212,218,0.05)';
      r(x + R, y + ry, 1, 1, col);
    }
  });
}
// Build the heli at every heading, its rotor frames and its card icon. Called once at startup.
function bakeHelis() {
  const sl = heliSlices(), n = sl.length, B = 58;
  HSPR.n.length = HSPR.h.length = HSPR.sh.length = 0;
  for (let i = 0; i < HN; i++) {
    const a = i / HN * TAU, raw = stackSpr(sl, a, B);
    const nn = selOut(rimLight(raw, '#f0ead4', 0.32)), hh = outline(hotSpr(raw, 150), '#161616');
    nn.ox = hh.ox = B / 2 + 1;
    nn.oy = hh.oy = B / 2 + n + 1;
    HSPR.n.push(nn);
    HSPR.h.push(hh);
    HSPR.sh.push(flatSpr(sl, a, B));
  }
  HSPR.n0 = n;
  ROTOR.length = 0;
  for (let k = 0; k < 8; k++) ROTOR.push(rotorFrame(k / 8 * Math.PI / 2));
  HICON = outline(strSpr(['.....m.....', '....xvx....', '....vBv....', '....vBv....', 'xx..vvv..xx', 'vVvvvVvvvVv',
    'xx..vvv..xx', '....xvx....', '.....v.....', '.....v.....', '...vvvvv...', '.....v.....'], NPAL), P.out);
  for (const c of [...HSPR.n, ...HSPR.h, ...ROTOR, HICON]) atl(c);
}
// ---------- the units
// A point on the heli at (dx, dy) from its middle (slice px: +y = to the tail), turned to heading a.
const turnXY = (a, dx, dy) => [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
// the helis to command now: the selected ones, or all of them when none is
const selHelis = () => (G.helis.some((h) => h.sel) ? G.helis.filter((h) => h.sel) : G.helis);
// A sole Viper never needs selection. Input also calls this before its next simulation step.
function selectSingleHeli() {
  if (G.helis.length !== 1) return false;
  G.helis[0].sel = true;
  HUI.box = null;
  return true;
}
// Where heli i flies when it escorts the train: its slot round the engine, drifting a little.
function escortAt(i) {
  const c = G.tr.cars[0], s = SLOTS[i % SLOTS.length], t = G.t;
  const a = s[0] + Math.sin(t * 0.37 + i * 2.1) * 10, u = s[1] + Math.sin(t * 0.29 + i * 1.3) * 8;
  return [c.x0 + c.dx * a + c.nx * u, c.y0 + c.dy * a + c.ny * u];
}
// The run's helis (G.up.helis of them), in their escort slots.
function makeHelis() {
  HUI.arm = false;
  HUI.box = null;
  HUI.cards.length = 0;
  G.helis = [];
  for (let i = 0; i < G.up.helis; i++) {
    const [x, y] = escortAt(i);
    G.helis.push({ i, name: HC.names[i] || 'VIPER ' + (i + 1), x, y, vx: 0, vy: 0, hd: G.tr.cars[0].ang, alt: HC.alt, ph: rnd(TAU),
      heat: 0, hot: false, firing: false, cd: rnd(0.15), tgt: null, look: 0, order: null, sel: G.up.helis === 1, flash: 0, heR: 0, kick: 0,
      cmdT: -9, spin: rnd(8), dust: 0, smoke: rnd(0.2), lean: 0, podFlash: [0, 0] });
  }
}
// how far the heli guns reach this run (HELI RANGE makes it more)
const hRange = () => HC.range * (G.up.heliRange || 1);
// A short range preview at departure, and while right click is held.
const heliRangeVisible = () => mode === 'play' && !G.demo && !G.result && (G.run < HRING.time || M.right);
// ground distance from heli h to zombie z (round the ellipse the view squashes, like queryEll)
const hDist = (h, z) => Math.hypot(z.x - h.x, (z.y - h.y) / FORE);
// The best target in reach of heli h (one the rounds in the air will not already kill), or null:
// the dead on the train, then the dead on the rails ahead, then the nearest. (The dead at the Depot
// gate are left for the first run's Ram.)
function heliTarget(h) {
  let best = null, bk = Infinity;
  const s0 = G.tr.s;
  queryEll(h.x, h.y, hRange(), (z, d) => {
    if (z.pending >= z.hp || z.gate && z.still) return;
    const k = z.st === 2 ? d : z.st === 1 && trackLocal(z.x, z.y, TL).a < s0 ? 1000 + d : 2000 + d;
    if (k < bk) {
      bk = k;
      best = z;
    }
  });
  return best;
}
// Each step: every heli flies to its order (or its escort slot), turns, picks a target and shoots.
function updateHelis(dt) {
  const hs = G.helis, c0 = G.tr.cars[0], tv = G.tr.v, sp = G.up.fly, live = !G.result;
  selectSingleHeli();
  let rel = 0, readyNow = false;
  for (const h of hs) {
    // Retain safe zero values for the existing debug stats; heat no longer gates the gun.
    h.heat = 0;
    h.hot = false;
    let o = h.order;
    if (o && o.kind === 'attack' && (o.z.dead || o.z.gone)) o = h.order = null;
    // where it wants to be: its slot over the train, its spot, or in reach of its target
    let tx, ty, fx = 0, fy = 0;
    if (!o) {
      [tx, ty] = escortAt(h.i);
      fx = c0.dx * tv;
      fy = c0.dy * tv;
    } else if (o.kind === 'move') [tx, ty] = [o.x, o.y];
    else {
      const z = o.z, d = hDist(h, z) || 1, r = Math.min(d, hRange() * 0.55);
      tx = z.x + (h.x - z.x) / d * r;
      ty = z.y + (h.y - z.y) / d * r;
    }
    // fly there: fast while far, slowing as it gets close, smoothly
    const ex = tx - h.x, ey = ty - h.y, ed = Math.hypot(ex, ey), want = Math.min(sp, ed * 2.6);
    const wx = (ed > 0.3 ? ex / ed * want : 0) + fx, wy = (ed > 0.3 ? ey / ed * want : 0) + fy, k = Math.min(1, dt * CFG.heli.accel);
    h.vx += (wx - h.vx) * k;
    h.vy += (wy - h.vy) * k;
    // the helis keep apart
    for (const q of hs) {
      if (q === h) continue;
      const dx = h.x - q.x, dy = h.y - q.y, d = Math.hypot(dx, dy);
      if (d < HC.sep && d > 0.01) {
        h.vx += dx / d * (HC.sep - d) * 6 * dt;
        h.vy += dy / d * (HC.sep - d) * 6 * dt;
      }
    }
    // (a 105 shot pushes it back for a moment)
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.kick = Math.max(0, h.kick - dt * 3);
    // low over a spot it holds, else at its flying height
    const ta = o && o.kind === 'move' && ed < 14 ? HC.low : HC.alt;
    h.alt += (ta - h.alt) * Math.min(1, dt * 1.4);
    // the target: its order's zombie, or the best one in reach (looked for again every 0.12 s)
    let z = o && o.kind === 'attack' ? o.z : h.tgt;
    if (z && !(o && o.z === z) && (z.dead || hDist(h, z) > hRange() + 8)) z = null;
    h.look -= dt;
    if (!(o && o.kind === 'attack') && (!z || h.look <= 0 || z.pending >= z.hp)) {
      z = heliTarget(h) || (z && !z.dead && z.pending < z.hp ? z : null);
      h.look = HC.look;
    }
    h.tgt = z;
    const inR = z && hDist(h, z) <= hRange();
    // it turns its nose to the target in reach, else to where it flies (or the train's way)
    const own = Math.hypot(h.vx - fx, h.vy - fy);
    let aim = h.hd;
    if (inR) aim = Math.atan2(z.x - h.x, -(z.y - h.y));
    else if (own > 25) aim = Math.atan2(h.vx, -h.vy);
    else if (!o) aim = c0.ang;
    const da = mod(aim - h.hd + Math.PI, TAU) - Math.PI, turn = clamp(da, -HC.turn * dt, HC.turn * dt);
    h.hd = mod(h.hd + turn, TAU);
    // it leans into its speed (and into a turn)
    h.lean += (clamp(own / 170, 0, 1) - h.lean) * Math.min(1, dt * 4);
    // The gun fires continuously while its nose points at a target in reach.
    h.firing = false;
    if (live && inR && Math.abs(da) < 0.55 && z.pending < z.hp && !(z.gate && z.still)) {
      h.firing = true;
      h.cd -= dt;
      while (h.cd <= 0 && z.pending < z.hp) {
        heliShot(h, z);
        h.cd += 1 / heliRate();
      }
      if (z.pending >= z.hp) h.look = 0;
    } else h.cd = Math.max(0, h.cd - dt);
    h.flash = Math.max(0, h.flash - dt);
    for (let k = 0; k < h.podFlash.length; k++) h.podFlash[k] = Math.max(0, h.podFlash[k] - dt);
    h.spin += dt;
    // the 105 loads
    if (h.heR > 0) {
      h.heR = Math.max(0, h.heR - dt);
      if (G.up.he && h.heR <= 0 && !G.demo && mode === 'play') readyNow = true;
    }
    rel = Math.max(rel, h.heR);
    heliDust(h, dt);
  }
  // Legacy heat stats stay zero; the dormant 105 keeps its reload stat.
  G.heat = 0;
  G.overheat = false;
  G.heReload = rel;
  if (!G.up.he) G.heQueue = false;
  if (G.up.he && readyNow) {
    if (G.heQueue) {
      G.heQueue = false;
      heFire(G.camX + G.aimSX, G.camY + G.aimSY);
    } else SFX.ready();
  }
  for (let i = HUI.marks.length - 1; i >= 0; i--) if (realT - HUI.marks[i].t > 0.7) HUI.marks.splice(i, 1);
  updateHeShells();
  updateHeliWeapons(dt);
}
// A nose-gun shot: an ordinary bullet lands almost at once, or Rockets replaces it with a blast.
// Both keep the same muzzle flash and shot count.
function heliShot(h, z) {
  const rocket = heliRocketShot(h, z);
  if (!rocket) {
    const T = CFG.mg.travel, s = Math.sqrt(Math.random()) * 1.2, a = rnd(TAU), dmg = heliDmg();
    z.pending += dmg;
    G.rounds.push({ kind: 'heli', h, bx: z.x + z.vx * T + Math.cos(a) * s, by: z.y + z.vy * T + Math.sin(a) * s * FORE, tgt: z, age: 0, T,
      dmg, side: 0, j: 0, player: true });
  }
  // (each shot's muzzle flash is a new star)
  h.flash = 0.07;
  h.fs = (Math.random() * 1e6) | 0;
  // a spent case jumps out of its right side and falls to the ground
  const [ox, oy] = turnXY(h.hd, 4, -14), [rx, ry] = turnXY(h.hd, 1, 0);
  part({ x: h.x + ox, y: h.y + oy, z: h.alt - 1, vx: rx * rnd(18, 34) + h.vx * 0.6, vy: ry * rnd(18, 34) + h.vy * 0.6, vz: rnd(4, 18), g: 200,
    life: 0.9, max: 0.9, s: 1, c: pick(['#e3b04b', '#c9952f', '#f0c85a']), land: 1 });
  if (G.demo) return;
  G.shots++;
  if (!rocket) SFX.mg();
}
// Dust kicked up by the rotor's downwash when it flies slow or low, and a faint haze from its exhausts.
function heliDust(h, dt) {
  if (offView(h.x, h.y, 30)) return;
  const own = Math.hypot(h.vx, h.vy), low = HC.alt - h.alt;
  h.dust -= dt;
  if (h.dust <= 0 && (own < 70 || low > 3)) {
    h.dust = low > 3 ? 0.035 : 0.07;
    const a = rnd(TAU), r = rnd(4, 9), s = rnd(28, 48) * (low > 3 ? 1.3 : 1);
    part({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * FORE, z: 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(2, 7), g: 0,
      life: rnd(0.5, 0.9), max: 0.9, s: rnd(2, 3), c: pick(['rgba(124,108,82,0.34)', 'rgba(98,86,66,0.32)', 'rgba(140,126,98,0.26)']),
      grow: 3, drag: 2.4, smoke: true });
  }
  h.smoke -= dt;
  if (h.smoke <= 0) {
    h.smoke = 0.14;
    for (const sx of [-4, 4]) {
      const [ox, oy] = turnXY(h.hd, sx, 3);
      part({ x: h.x + ox, y: h.y + oy, z: h.alt + 6, vx: h.vx * 0.3 + rnd(-3, 3), vy: h.vy * 0.3 + rnd(-3, 3), vz: rnd(-2, 2), g: 0,
        life: 0.6, max: 0.6, s: 2, c: 'rgba(52,50,48,0.22)', grow: 3, drag: 1.5, smoke: true });
    }
  }
}
// A 105 shell leaves heli h: it is shoved back, a big flash at its side.
function heliRecoil(h) {
  const [fx, fy] = turnXY(h.hd, 0, -1);
  h.vx -= fx * 45;
  h.vy -= fy * 45;
  h.kick = 1;
  h.flash = 0.08;
  const [ox, oy] = turnXY(h.hd, -11, -8);
  lights.push({ x: h.x + ox, y: h.y + oy, z: h.alt + 3, r: 26, c: '#ffb060', life: 0.15, max: 0.15, a: 0.9 });
  for (let k = 0; k < 8; k++) part({ x: h.x + ox, y: h.y + oy, z: h.alt + 3, vx: fx * rnd(20, 60) + rnd(-15, 15), vy: fy * rnd(20, 60) + rnd(-15, 15),
    vz: rnd(-5, 10), g: 0, life: rnd(0.4, 0.8), max: 0.8, s: rnd(2, 4), c: pick(['rgba(70,64,58,0.5)', 'rgba(96,90,82,0.45)']), grow: 5, drag: 2, smoke: true });
}
// SPACE (or the armed 105MM card and a click) at (tx, ty): every selected heli (or all) with its 105
// loaded fires one shell there, a little apart; it leads the zombie nearest the spot. Pressed just
// before one is loaded, it fires the moment it is.
function heFire(tx, ty) {
  if (!G.up.he || G.result) return false;
  const list = selHelis(), ready = list.filter((h) => h.heR <= 0);
  if (!ready.length) {
    if (list.some((h) => h.heR < 0.5)) G.heQueue = true;
    else {
      HUI.msg = { t: realT, s: '105MM LOADING...' };
      SFX.deny();
    }
    return false;
  }
  let lead = null, ld = 12;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - tx, (z.y - ty) / FORE);
    if (d < ld) { ld = d; lead = z; }
  }
  const lx = lead ? lead.vx * CFG.he.travel : 0, ly = lead ? lead.vy * CFG.he.travel : 0;
  ready.forEach((h, k) => {
    const a = k * 2.3, r = k ? 14 : 0;
    fireHE(true, tx + lx + Math.cos(a) * r, ty + ly + Math.sin(a) * r * FORE, h);
  });
  return true;
}
// the title demo, the Depot's demo and the autopilot: one 105 from the first heli with it loaded
function botHE(tx, ty, player) {
  if (!G.up.he) return false;
  const h = G.helis.find((q) => q.heR <= 0);
  if (!h) return false;
  fireHE(player, tx, ty, h);
  if (!player) h.heR = 3.5;
  return true;
}

// ---------- commands
// the heli whose body is under screen point (x, y), or null
function heliAt(x, y) {
  let best = null, bd = 15;
  for (const h of G.helis) {
    const d = Math.hypot(h.x - G.camX - x, h.y - h.alt - 4 - G.camY - y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
// the living zombie under screen point (x, y), or null
function zombieAt(x, y) {
  let best = null, bd = 9;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - G.camX - x, z.y - z.S.h * 0.5 - G.camY - y);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
// tell the tutorial what was done (when it is built in)
function heliTut(kind) {
  if (typeof tutCount === 'function') tutCount(kind);
}
// the selection changed: count it for the tutorial
function selDone() {
  const n = G.helis.filter((h) => h.sel).length;
  if (n) heliTut('select');
  if (n >= 2 && n === G.helis.length) heliTut('selall');
}
function selectAll() {
  for (const h of G.helis) h.sel = true;
  SFX.ui();
  selDone();
}
// a click on a heli (or its card): select it alone; shift adds or takes it away; twice = all
function clickHeli(h, shift) {
  if (selectSingleHeli()) {
    SFX.ui();
    return;
  }
  if (realT - HUI.lastT < 0.35 && HUI.lastH === h) {
    HUI.lastT = -9;
    selectAll();
    return;
  }
  HUI.lastT = realT;
  HUI.lastH = h;
  if (shift) h.sel = !h.sel;
  else for (const q of G.helis) q.sel = q === h;
  SFX.ui();
  selDone();
}
// Left button down: a card is clicked or the dormant armed 105 fires. A drag selects units only
// when multiple helis are enabled in the full game.
function heliDown(x, y, shift) {
  const single = selectSingleHeli();
  if (!G.up.he) HUI.arm = false;
  for (const c of HUI.cards) {
    if (!inR(x, y, c.x, c.y, c.w, c.ht)) continue;
    if (c.he) {
      HUI.arm = !HUI.arm && G.up.he;
      SFX.ui();
    } else clickHeli(c.heli, shift);
    return;
  }
  if (HUI.arm) {
    HUI.arm = false;
    heFire(G.camX + x, G.camY + y);
    return;
  }
  if (!single) HUI.box = { x0: x, y0: y, shift };
}
// Left button up keeps the sole Viper selected. With multiple full-game units, a drag selects
// the helis in the box; a plain click selects one or clears selection on the ground.
function heliUp(x, y) {
  if (selectSingleHeli()) return;
  const b = HUI.box;
  if (!b) return;
  HUI.box = null;
  if (Math.abs(x - b.x0) + Math.abs(y - b.y0) > 5) {
    const l = Math.min(x, b.x0) - 6, r = Math.max(x, b.x0) + 6, t = Math.min(y, b.y0) - 6, u = Math.max(y, b.y0) + 6;
    const got = G.helis.filter((h) => inR(h.x - G.camX, h.y - h.alt - 4 - G.camY, l, t, r - l, u - t));
    if (!b.shift) for (const h of G.helis) h.sel = false;
    for (const h of got) h.sel = true;
    if (got.length) SFX.ui();
    selDone();
    return;
  }
  const h = heliAt(x, y);
  if (h) clickHeli(h, b.shift);
  else if (!b.shift) for (const q of G.helis) q.sel = false;
}
// Right click at screen (x, y): a zombie = attack it, the train = escort it,
// the ground = fly there and hold (more than one: round the spot, the first right on it).
function heliRight(x, y) {
  selectSingleHeli();
  if (!G.up.he) HUI.arm = false;
  if (HUI.arm) {
    HUI.arm = false;
    return;
  }
  const sel = selHelis();
  if (!sel.length) return;
  const wx = G.camX + x, wy = G.camY + y, z = zombieAt(x, y);
  if (z) {
    for (const h of sel) {
      h.order = { kind: 'attack', z };
      h.tgt = z;
    }
    HUI.marks.push({ kind: 'attack', z, t: realT });
    heliTut('attack');
    SFX.lock();
  } else if (trainDist(wx, wy + 5) < 4) {
    for (const h of sel) h.order = null;
    HUI.marks.push({ kind: 'train', x: wx, y: wy, t: realT });
    floatText(wx, wy - 6, 'ESCORT', U.green);
    SFX.ui();
  } else {
    sel.forEach((h, k) => {
      const a = (k - 1) * 2.1 + 0.6, r = k ? 22 : 0;
      h.order = { kind: 'move', x: wx + Math.cos(a) * r, y: wy + Math.sin(a) * r * FORE };
    });
    HUI.marks.push({ kind: 'move', x: wx, y: wy, t: realT });
    heliTut('move');
    SFX.ui();
  }
  for (const h of sel) h.cmdT = realT;
}
// Multiple-unit selection keys remain for the full game. The sole Viper needs none of them.
function heliKey(k) {
  if (selectSingleHeli()) return false;
  if (k === 'a') {
    selectAll();
    return true;
  }
  const i = '123456789'.indexOf(k);
  if (i < 0 || !G.helis[i]) return false;
  for (const q of G.helis) q.sel = q === G.helis[i];
  SFX.ui();
  selDone();
  return true;
}

// ---------- drawing (world layer)
// On the ground, under everything standing: each heli's shadow (south-east of it, by its height)
// with its rotor's, the selection rings, the orders' lines and the markers of the last commands.
function drawHeliGround() {
  for (const h of G.helis) {
    const a = h.alt, gx = Math.round(h.x + a * SUNX), gy = Math.round(h.y + a * SUNY), i = mod(Math.round(h.hd / TAU * HN), HN);
    const sh = HSPR.sh[i];
    ctx.globalAlpha = thermal ? 0.25 : 0.42;
    blit(sh, gx - sh.width / 2, gy - sh.height / 2);
    // the faint disc the blades sweep, and the blades
    const [mx, my] = turnXY(h.hd, 0, -HC.mast), cx = gx + Math.round(mx), cy = gy + Math.round(my), R = ROTOR_R, ry = Math.round(R * FORE);
    ctx.globalAlpha = thermal ? 0.05 : 0.09;
    ctx.fillStyle = '#000';
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = Math.round(R * Math.sqrt(1 - (dy * dy) / (ry * ry)));
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
    ctx.globalAlpha = thermal ? 0.16 : 0.22;
    const a0 = h.spin * 31;
    for (let k = 0; k < 4; k++) {
      const b = a0 + k * Math.PI / 2;
      pl(ctx, cx, cy, cx + Math.cos(b) * R, cy + Math.sin(b) * R * FORE, '#000');
    }
    ctx.globalAlpha = 1;
  }
  // The gun's reach on the ground: faint, evenly spaced pixel dots, with no canvas path blur.
  if (heliRangeVisible()) {
    const R = hRange(), n = Math.ceil(TAU * R / HRING.gap);
    ctx.globalAlpha = HRING.alpha;
    ctx.fillStyle = '#8fd18a';
    for (const h of G.helis) for (let k = 0; k < n; k++) {
      const a = k / n * TAU;
      ctx.fillRect(Math.round(h.x + Math.cos(a) * R), Math.round(h.y + Math.sin(a) * R * FORE), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // the orders of the selected helis: a dotted line to the spot or the target (bright just after the
  // order, then faint), a small mark on the spot
  for (const h of G.helis) {
    const o = h.order;
    if (!h.sel || !o) continue;
    const tx = o.kind === 'move' ? o.x : o.z.x, ty = o.kind === 'move' ? o.y : o.z.y, col = o.kind === 'move' ? '#8fd18a' : '#ff5a3a';
    const n = Math.floor(Math.hypot(tx - h.x, ty - h.y) / 4), fresh = realT - h.cmdT < 0.8;
    ctx.globalAlpha = fresh ? 0.85 : 0.3;
    ctx.fillStyle = col;
    for (let k = 1; k < n; k++) if ((k + Math.floor(realT * 8)) % 2) ctx.fillRect(Math.round(lerp(h.x, tx, k / n)), Math.round(lerp(h.y, ty, k / n)), 1, 1);
    if (o.kind === 'move') {
      ctx.fillRect(Math.round(tx) - 2, Math.round(ty), 5, 1);
      ctx.fillRect(Math.round(tx), Math.round(ty) - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  }
  // a selected heli: a green ring on the ground right under it, turning slowly, and a faint line
  // up to it
  for (const h of G.helis) {
    if (!h.sel) continue;
    const R = 13, a0 = realT * 1.2;
    ctx.fillStyle = 'rgba(143,209,138,0.55)';
    for (let y = Math.round(h.y - h.alt + 6); y < h.y - 3; y += 2) ctx.fillRect(Math.round(h.x), y, 1, 1);
    for (let k = 0; k < 44; k++) {
      const a = k / 44 * TAU;
      if (mod(a - a0, Math.PI / 2) > 1.15) continue;
      const x = Math.round(h.x + Math.cos(a) * R), y = Math.round(h.y + Math.sin(a) * R * FORE);
      ctx.fillStyle = '#07080a';
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = '#8fd18a';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // the last commands: a ring closing on the spot, red corners round the target
  for (const m of HUI.marks) {
    const u = (realT - m.t) / 0.7;
    if (m.kind === 'move' || m.kind === 'train') {
      ctx.globalAlpha = 1 - u;
      const r = lerp(16, 3, ease(u)), col = '#8fd18a';
      pell(m.x, m.y, r, r * FORE, col);
      pell(m.x, m.y, r + 4, (r + 4) * FORE, 'rgba(143,209,138,0.4)');
    } else if (!m.z.dead) {
      const z = m.z, S = z.S, w = S.walk[0].n.width + 6 + Math.round((1 - ease(u)) * 8), hh = S.h + 6 + Math.round((1 - ease(u)) * 8);
      ctx.globalAlpha = u < 0.5 || Math.floor(realT * 16) % 2 ? 1 : 0.4;
      corners(Math.round(z.x - w / 2), Math.round(z.y - S.ay - 3 - (hh - S.h - 6) / 2), w, hh, '#ff5a3a');
    }
    ctx.globalAlpha = 1;
  }
}
// The helis, over everything on the ground (back to front): the body leaning into its speed, the
// muzzle flash at the nose, the tail rotor, the main rotor's blur and the hub.
const HORD = [];
function drawHelis() {
  HORD.length = 0;
  for (const h of G.helis) HORD.push(h);
  HORD.sort((a, b) => a.y - b.y);
  for (const h of HORD) {
    const i = mod(Math.round(h.hd / TAU * HN), HN), img = (thermal ? HSPR.h : HSPR.n)[i];
    // it bobs gently; the lean moves the body a little and the rotor more, the way it flies
    const bob = Math.sin(G.t * 2.2 + h.ph) * 1.2, sp = Math.hypot(h.vx, h.vy) || 1;
    const lx = h.vx / sp * h.lean, ly = h.vy / sp * h.lean;
    const X = Math.round(h.x + lx), Y = Math.round(h.y - h.alt + bob + ly);
    blit(img, X - img.ox, Y - img.oy);
    // the tail rotor: a flicker on the fin's right side
    const [tx, ty] = turnXY(h.hd, 3, 19), f = Math.floor(h.spin * 40) % 3;
    const ux = Math.sin(h.hd), uy = -Math.cos(h.hd);
    ctx.fillStyle = f === 1 ? '#8b919c' : '#2a2d31';
    const qx = Math.round(X + tx), qy = Math.round(Y + ty - 5);
    if (f === 0) pl(ctx, qx - ux * 3, qy - uy * 3, qx + ux * 3, qy + uy * 3, '#2a2d31');
    else if (f === 1) ctx.fillRect(qx, qy - 3, 1, 7);
    else pl(ctx, qx - ux * 2, qy - 2, qx + ux * 2, qy + 2, '#3a3e48');
    // the main rotor: its blur frames turn round the mast, tilted the way it flies
    const [mx, my] = turnXY(h.hd, 0, -HC.mast), fr = ROTOR[Math.floor(h.spin * 52) % ROTOR.length];
    const rx = Math.round(X + mx + lx * 2.5), ry = Math.round(Y + my - HSPR.n0 - 1 + ly * 2.5);
    blit(fr, rx - ROTOR_R, ry - ROTOR_RY);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(rx - 1, ry - 1, 3, 3);
    ctx.fillStyle = '#8b919c';
    ctx.fillRect(rx, ry - 1, 1, 1);
    // the gun's muzzle flash: a star at the nose, longer forward
    if (h.flash > 0) {
      const [nx, ny] = turnXY(h.hd, 0, -HC.nose), px = Math.round(X + nx), py = Math.round(Y + ny - 1);
      ctx.fillStyle = '#ffd27a';
      pl(ctx, px, py, px + ux * 4, py + uy * 4, '#ffd27a');
      ctx.fillRect(px - 1, py, 3, 1);
      ctx.fillRect(px, py - 1, 1, 3);
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(px, py, 1, 1);
    }
    // Small launch flashes at the two pod mouths on the stub wings.
    for (let k = 0; k < h.podFlash.length; k++) {
      if (h.podFlash[k] <= 0) continue;
      const [ox, oy] = turnXY(h.hd, (k ? 1 : -1) * HWC.pod.mountX, HWC.pod.mountY);
      const px = Math.round(X + ox), py = Math.round(Y + oy - 1);
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(px - 1, py, 3, 1);
      ctx.fillRect(px, py - 1, 1, 3);
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(px, py, 1, 1);
    }
    h.sx = X;
    h.sy = Y;
  }
}
// where heli h's gun muzzle is now (world px, as drawn)
function noseXY(h) {
  const [nx, ny] = turnXY(h.hd, 0, -HC.nose);
  return [h.x + nx, h.y - h.alt + ny - 1];
}
// Ordinary bullets have no tracer. Rockets and the dormant 105 shells are drawn in flight.
function drawHeliRound(r) {
  if (r.kind === 'rocket') drawRocket(r);
  else if (r.kind === 'hellfire') drawHellfire(r);
  else if (r.kind === 'he') drawHeShell(r);
}
// A 105 shell on its way: up and over from the heli's side to the spot, a bright head, a smoke
// trail behind it (left in updateHeShells).
function shellAt(r) {
  const u = r.age / r.T, h = r.h, x = lerp(r.sx, r.bx, u), y = lerp(r.sy, r.by, u), z = lerp(r.sz, 0, u) + Math.sin(u * Math.PI) * 26;
  return [x, y - z, h];
}
function drawHeShell(r) {
  const [x, y] = shellAt(r), u = r.age / r.T;
  // a hot streak along the last bit of its path, fading behind it
  const back = (t) => shellAt({ age: Math.max(0, r.age - t), T: r.T, sx: r.sx, sy: r.sy, sz: r.sz, bx: r.bx, by: r.by });
  let [px, py] = [x, y];
  for (let k = 1; k <= 6; k++) {
    const [qx, qy] = back(k * 0.025);
    ctx.globalAlpha = 1 - k / 7;
    pl(ctx, px, py, qx, qy, k < 3 ? '#ffd27a' : '#c9772f');
    [px, py] = [qx, qy];
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff6e0';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2);
  light(x, y, 12, '#ffd27a', 0.8 - u * 0.2);
}
// Each step: the shells in the air leave a trail of smoke.
function updateHeShells() {
  for (const r of G.rounds) {
    if (r.kind !== 'he' || !r.h) continue;
    const u = r.age / r.T, x = lerp(r.sx, r.bx, u), y = lerp(r.sy, r.by, u), z = lerp(r.sz, 0, u) + Math.sin(u * Math.PI) * 26;
    part({ x, y, z, vx: rnd(-3, 3), vy: rnd(-2, 2), vz: rnd(1, 4), g: 0, life: rnd(0.6, 1), max: 1, s: 2,
      c: pick(['rgba(176,168,158,0.6)', 'rgba(136,128,120,0.55)']), grow: 4, drag: 1.2, smoke: true });
  }
}
// The glows (with 'lighter'): the muzzle flashes, the blinking lights on the wing tips and the tail.
function drawHeliFx() {
  for (const h of G.helis) {
    if (h.sx == null) continue;
    const X = h.sx, Y = h.sy;
    if (h.flash > 0) drawMuzzle(h);
    for (let k = 0; k < h.podFlash.length; k++) {
      if (h.podFlash[k] <= 0) continue;
      const [ox, oy] = turnXY(h.hd, (k ? 1 : -1) * HWC.pod.mountX, HWC.pod.mountY);
      light(X + ox, Y + oy - 1, HWC.pod.flashRadius, '#ffd27a', h.podFlash[k] / HWC.pod.flash);
    }
    const t = (G.t + h.ph) % 1.2, on = t < 0.5;
    if (on) {
      for (const [dx, col] of [[-11, '#ff3a2a'], [11, '#5aff7a']]) {
        const [ox, oy] = turnXY(h.hd, dx, -4);
        light(X + ox, Y + oy - 3, 4, col, 0.8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(X + ox), Math.round(Y + oy - 3), 1, 1);
      }
    }
    // the engines' hot exhausts
    for (const ex of [-4, 4]) {
      const [ox, oy] = turnXY(h.hd, ex, 2);
      light(X + ox, Y + oy - 6, 3, '#ff8a3a', 0.3 + 0.1 * Math.sin(realT * 23 + ex));
    }
    if (t < 0.06 || (t > 0.14 && t < 0.2)) {
      const [ox, oy] = turnXY(h.hd, 0, 21);
      light(X + ox, Y + oy - 6, 6, '#ffffff', 0.9);
    }
  }
  drawHits();
  ctx.globalAlpha = 1;
}
// Over the helis: the name of the one under the mouse.
function drawHeliTop() {
  for (const h of G.helis) {
    if (h.sx == null) continue;
    const X = h.sx, Y = h.sy - 37;
    if (HUI.hov === h) text(h.name, X, Y - 11, h.sel ? U.green : U.ink, { align: 'center' });
  }
}

// ---------- the UI (screen px)
// Unit cards, bottom left: the always-selected Viper, or numbered units in the full game.
// The dormant 105MM card can follow them when that weapon is enabled.
// Returns the x after them.
function drawUnitCards(x, y) {
  HUI.cards.length = 0;
  const w = W >= 560 ? 80 : 72;
  for (const h of G.helis) {
    const tag = G.helis.length > 1 ? String(h.i + 1) : '', hov = inR(M.x, M.y, x, y, w, 26);
    card(x, y, w, 26, HICON, h.name, tag, h.sel ? U.green : U.faint, null, '#8b919c', h.sel ? U.green : U.ink);
    if (h.sel) {
      frame(x, y, w, 26, '#5f9a5a');
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#8fd18a';
      ctx.fillRect(x + 1, y + 1, w - 2, 24);
      ctx.globalAlpha = 1;
    }
    if (hov && mode === 'play' && !paused) cursor = 'pointer';
    HUI.cards.push({ x, y, w, ht: 26, heli: h, he: false });
    x += w + 4;
  }
  if (G.up.he) {
    const list = selHelis(), best = Math.min(...list.map((h) => h.heR)), n = list.filter((h) => h.heR <= 0).length, rdy = n > 0;
    card(x, y, 96, 26, ICON.he, '105MM', HUI.arm ? 'CLICK!' : rdy ? (list.length > 1 ? n + ' READY' : 'SPACE') : 'LOADING',
      HUI.arm ? '#ffe39a' : rdy ? U.gold : U.faint, 1 - best / G.up.reload, rdy ? '#e3b04b' : '#7a6a50');
    if (HUI.arm) frame(x - 1, y - 1, 98, 28, Math.floor(realT * 8) % 2 ? '#ffd36a' : '#b8862f');
    if (inR(M.x, M.y, x, y, 96, 26) && mode === 'play' && !paused) cursor = 'pointer';
    HUI.cards.push({ x, y, w: 96, ht: 26, heli: null, he: true });
    x += 100;
  }
  // why not: a line over the cards for 2 s
  const m = HUI.msg, mt = m ? realT - m.t : 9;
  if (mt < 2) {
    ctx.globalAlpha = clamp((2 - mt) / 0.4, 0, 1);
    text(m.s, 4, y - 10 - tipRoom(), U.amber);
    ctx.globalAlpha = 1;
  }
  return x;
}
// The mouse in play: the drag box, the heli or zombie under it (the cursor, the heli's name), the
// 105 aim (its ring while the card is armed, a gold pip when one is loaded, DANGER CLOSE near the
// train).
function drawHeliCursor() {
  const mx = Math.round(clamp(M.x, 0, W - 1)), my = Math.round(clamp(M.y, 0, H - 1)), b = HUI.box;
  HUI.hov = M.inside && M.y >= 19 ? heliAt(mx, my) : null;
  if (b && M.down) {
    const l = Math.round(Math.min(b.x0, mx)), t = Math.round(Math.min(b.y0, my)), w = Math.abs(Math.round(b.x0) - mx), h = Math.abs(Math.round(b.y0) - my);
    if (w + h > 5) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#8fd18a';
      ctx.fillRect(l, t, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#07080a';
      ctx.fillRect(l + 1, t + h + 1, w, 1);
      ctx.fillRect(l + w + 1, t + 1, 1, h);
      ctx.fillStyle = '#8fd18a';
      ctx.fillRect(l, t, w + 1, 1);
      ctx.fillRect(l, t + h, w + 1, 1);
      ctx.fillRect(l, t, 1, h);
      ctx.fillRect(l + w, t, 1, h + 1);
    }
  }
  if (!M.inside || M.y < 19 || HUI.cards.some((c) => inR(mx, my, c.x, c.y, c.w, c.ht)) || (RAMCARD.on && inR(mx, my, RAMCARD.x, RAMCARD.y, RAMCARD.w, RAMCARD.h))) return;
  if (HUI.hov) cursor = 'pointer';
  else if (G.helis.some((h) => h.sel) && zombieAt(mx, my)) cursor = 'crosshair';
  if (!G.up.he) return;
  const ready = selHelis().some((h) => h.heR <= 0), wx = G.camX + mx, wy = G.camY + my;
  if (HUI.arm) {
    cursor = 'crosshair';
    ctx.globalAlpha = 0.5 + 0.3 * (Math.sin(realT * 20) > 0 ? 1 : 0);
    pell(mx, my, CFG.he.kill, CFG.he.kill * FORE, '#ff6a28');
    ctx.globalAlpha = 1;
  }
  if (ready && !HUI.hov) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(mx + 7, my - 10, 4, 4);
    ctx.fillStyle = thermal ? '#ffffff' : U.gold;
    ctx.fillRect(mx + 8, my - 9, 2, 2);
    if (trainDist(wx, wy, G.tr.v * CFG.he.travel) < CFG.he.close + 4) text('DANGER CLOSE', mx, my + 12, U.red, { align: 'center' });
  }
}
