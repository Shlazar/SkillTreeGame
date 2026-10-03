// sprites.js - every sprite is drawn in code at startup (no image files).
// Inside: the palettes (P for pixel art, U for the UI), the zombie sets (ZS, drawn in horde.js),
// the train (engine and four cars, the survivors on the flatcar), the props (trees, bushes, rocks,
// stumps, wrecks, barrels, crates, ruined walls, telegraph poles), the safe zone (wall, gate,
// watchtowers) and the icons. The rows below are art data: x, y, w, h, color.

// ---------- palette
const P = {
  out: '#0a0b0e', dk: '#07070a', em: '#ff6a28', em2: '#ffc27a',
  i0: '#1c1e23', i1: '#2d3038', i2: '#434753', i3: '#626875', i4: '#8b919c', st: '#b4b9c1',
  c1: '#561b1f', c2: '#7a2a2a', c3: '#a33b2c', rag0: '#3a1614',
  l0: '#281f19', l1: '#3b2e25', l2: '#56422f', w0: '#3a2718', w1: '#5b3f27', w2: '#7b5735',
  bone: '#d6cdb6', rim: '#b9c2cc', rim2: '#8d96a3',
  bl0: '#2a0e0c', bl1: '#4a1512', bl2: '#6a1c18'
};
// UI colours (text and highlights)
const U = {
  ink: '#e8dfc8', dim: '#9a9ca3', faint: '#5d616b', gold: '#e3b04b', red: '#d0553f', teal: '#56c2a8',
  blue: '#9fd3f2', amber: '#e8913a', green: '#8fd18a'
};
// ---------- zombie frame sets (made in horde.js)
// A copy of src turned by angle a (nearest pixel, hard edges), on a square canvas.
function rotA(src, a) {
  const s = Math.ceil(Math.hypot(src.width, src.height)) + 1;
  const [c, g] = mk(s, s, true);
  g.translate(s / 2, s / 2);
  g.rotate(a);
  g.drawImage(src, -src.width / 2, -src.height / 2);
  const im = g.getImageData(0, 0, s, s), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  g.putImageData(im, 0, 0);
  return c;
}
// ZS[type] = the colour variants of each type (0 walker, 1 runner, 2 brute)
const ZS = [[], [], []];

// ---------- the train, built from stacked slices
// Each car is a pile of top-down slices (16 x 28 px, its front at the top), one per pixel of height.
// Turned to the car's heading and drawn each 1 px above the one under it, the pile looks solid from
// any angle: the roof on top, and below it whichever walls face the camera. Every car is made at
// ANG_N headings between -ANG_MAX and +ANG_MAX (0 = north, + = clockwise).
const ANG_MAX = 40 * Math.PI / 180, ANG_N = 33;
const angIdx = (a) => clamp(Math.round((a + ANG_MAX) / (2 * ANG_MAX) * (ANG_N - 1)), 0, ANG_N - 1);
const angOf = (i) => -ANG_MAX + i * 2 * ANG_MAX / (ANG_N - 1);
const slice = (fn) => pix(16, 28, fn);
// Rust, grime and wear on a car: the outer ring of pixels of a slice (the only ones that show from
// the side) gets spots of rust and dirt from a fixed seed. k = how much.
function wear(r, seed, k, nose) {
  for (let y = 0; y < 28; y++) for (let x = 0; x < 16; x++) {
    if (x > 0 && x < 15 && y > 0 && y < 27 && !(nose && y < 3)) continue;
    const v = hrnd(x, y, seed);
    if (v < k * 0.45) r(x, y, 1, 1, v < k * 0.15 ? '#3a1e12' : '#6a3a1e');
    else if (v > 1 - k * 0.3) r(x, y, 1, 1, '#14100c');
  }
}
// the wheels and the frame (the two bottom slices of every car)
function underSlices() {
  return [slice((r) => {
    r(1, 2, 14, 24, '#0b0c0e');
    for (const y of [4, 20]) { r(0, y, 1, 4, '#2a2d33'); r(15, y, 1, 4, '#2a2d33'); r(0, y + 1, 1, 1, '#5a5e66'); r(15, y + 1, 1, 1, '#5a5e66'); }
  }), slice((r) => {
    r(0, 0, 16, 28, '#1a1d22');
    for (let y = 1; y < 28; y += 3) { r(0, y, 1, 1, '#4a4e57'); r(15, y, 1, 1, '#4a4e57'); }
    r(0, 0, 16, 1, '#2a2d33'); r(7, 0, 2, 1, '#0b0c0e'); r(7, 27, 2, 1, '#0b0c0e');
  })];
}
// a wall slice: the whole outline filled with one colour (only its outer pixels ever show), with
// wear (seed, k) when asked
const wallSlice = (col, nose, seed, k) => slice((r) => {
  if (nose) { r(2, 0, 12, 1, col); r(1, 1, 14, 1, col); r(0, 2, 16, 26, col); } else r(0, 0, 16, 28, col);
  if (seed) wear(r, seed, k || 0.3, nose);
});
function locoSlices() {
  const B = ['#151b24', '#243042', '#34445c', '#4b5f7d'];
  return [...underSlices(), wallSlice(B[0], true, 11, 0.5),
    // a band of hazard stripes round the engine
    slice((r) => {
      r(2, 0, 12, 1, '#c9772f'); r(1, 1, 14, 1, '#c9772f'); r(0, 2, 16, 26, '#c9772f');
      for (let y = 0; y < 28; y++) for (let x = 0; x < 16; x++) if (((x + y) >> 1) % 2 === 0) r(x, y, 1, 1, '#1c1a18');
    }),
    wallSlice(B[1], true, 12, 0.25), wallSlice(B[1], true, 13, 0.12),
    // glass round the cab
    slice((r) => {
      r(2, 0, 12, 1, B[1]); r(1, 1, 14, 1, B[1]); r(0, 2, 16, 26, B[1]);
      r(0, 7, 1, 6, '#1b2836'); r(15, 7, 1, 6, '#1b2836'); r(2, 6, 12, 1, '#1b2836'); r(3, 6, 2, 1, '#6f8aa6');
      r(0, 8, 1, 1, '#9fb8d0'); r(15, 8, 1, 1, '#4a6078');
      // the louvres along the hood
      for (let y = 16; y < 27; y += 2) { r(0, y, 1, 1, '#0e131a'); r(15, y, 1, 1, '#0e131a'); }
    }),
    // the roof: nose with headlights, a number plate and stripes, the cab, the long hood with its
    // fans, handrails along both sides, rust round the stack
    slice((r) => {
      r(2, 0, 12, 1, B[2]); r(1, 1, 14, 1, B[2]); r(0, 2, 16, 26, B[1]);
      r(4, 0, 1, 1, '#fff1c2'); r(11, 0, 1, 1, '#fff1c2'); r(7, 1, 2, 1, '#e3b04b');
      for (let x = 1; x < 15; x += 2) r(x, 3, 1, 1, '#c9772f');
      r(1, 6, 14, 8, B[3]);
      r(0, 14, 2, 14, '#2a2d33'); r(14, 14, 2, 14, '#2a2d33'); r(2, 14, 1, 14, B[2]);
      for (let y = 15; y < 28; y += 3) { r(0, y, 1, 1, '#8b919c'); r(15, y, 1, 1, '#5a5e66'); }
      for (const fy of [19, 23]) { r(6, fy, 4, 3, '#14171c'); r(7, fy, 2, 3, '#3a3e48'); r(6, fy + 1, 4, 1, '#3a3e48'); r(6, fy, 4, 1, '#4b5263'); }
      r(4, 15, 1, 3, '#3a2a22'); r(11, 17, 2, 1, '#4a2e1e'); r(3, 26, 2, 1, '#4a2e1e'); r(12, 24, 1, 2, '#3a2a22');
      r(2, 4, 12, 1, '#1b2430');
    }),
    // on top: the cab roof (lit at its front, a horn and a vent), the exhaust stack with a sooty ring
    slice((r) => {
      r(1, 6, 14, 8, '#6d82a3'); r(1, 6, 14, 1, '#a8bcd8'); r(1, 6, 1, 8, '#8ea3c4'); r(14, 7, 1, 7, '#4b5f7d');
      r(3, 8, 3, 2, '#4b5f7d'); r(3, 8, 3, 1, '#8ea3c4'); r(10, 7, 3, 1, '#c4c8ce'); r(10, 8, 3, 1, '#5d636e');
      r(6, 14, 4, 4, '#1c1e23'); r(7, 15, 2, 2, '#07080a'); r(6, 14, 4, 1, '#3a3530');
    })];
}
function coachSlices() {
  const C = ['#18221a', '#2a3a2a', '#3e563c', '#5b7656'];
  // lit windows along both sides (one boarded up), a door window at each end
  const windows = (top) => slice((r) => {
    r(0, 0, 16, 28, C[1]);
    for (let y = 2; y < 26; y += 4) {
      const board = y === 10;
      r(0, y, 1, 2, board ? '#5b3f27' : top ? '#ffe2a0' : '#ffcf6a'); r(15, y, 1, 2, y === 18 ? '#5b3f27' : top ? '#ffe2a0' : '#e8a84a');
    }
    r(7, 0, 2, 1, '#ffcf6a'); r(7, 27, 2, 1, '#ffcf6a');
    if (!top) for (let y = 4; y < 26; y += 4) { r(0, y, 1, 1, '#121a14'); r(15, y, 1, 1, '#121a14'); }
  });
  return [...underSlices(), wallSlice(C[0], false, 21, 0.5), wallSlice(C[0], false, 22, 0.3), windows(false), windows(true),
    wallSlice(C[1], false, 23, 0.1),
    // the cream band under the roof
    slice((r) => { r(0, 0, 16, 28, '#8a8466'); r(0, 0, 16, 1, '#a8a27e'); wear(r, 24, 0.25); }),
    // the round roof: lit on the left, a walkway, rusty vents, dirt along the edges
    slice((r) => {
      r(0, 0, 16, 28, C[2]); r(0, 0, 2, 28, C[3]); r(13, 0, 3, 28, C[1]); r(7, 0, 2, 28, C[3]);
      for (const vy of [4, 11, 18, 24]) { r(7, vy, 2, 2, '#121a14'); r(7, vy, 2, 1, '#6a3a1e'); }
      for (let y = 0; y < 28; y++) if (hrnd(3, y, 25) < 0.35) r(hrnd(4, y, 26) < 0.5 ? 13 : 14, y, 1, 1, '#1a221a');
      r(2, 6, 1, 3, '#4a3a22'); r(10, 20, 2, 1, '#4a3a22'); r(0, 0, 16, 1, C[3]);
    })];
}
function flatSlices() {
  const ring = (col) => slice((r) => {
    r(0, 0, 16, 2, col); r(0, 26, 16, 2, col); r(0, 0, 2, 28, col); r(14, 0, 2, 28, col);
    r(5, 8, 5, 4, '#7b5735'); r(6, 20, 4, 2, '#46523a');
  });
  return [...underSlices(),
    // the deck of planks
    slice((r) => {
      r(0, 0, 16, 28, '#4f3a26');
      for (let y = 1; y < 28; y += 3) r(0, y, 16, 1, '#3a2718');
      r(0, 0, 1, 28, '#6b5038');
    }),
    ring('#7d6f52'), ring('#9a8a68'),
    // sandbags on top of the ring, the lid of the crate
    slice((r) => {
      for (let k = 0; k < 28; k += 3) { r(0, k, 2, 2, '#b3a27a'); r(14, k, 2, 2, '#b3a27a'); }
      for (let k = 3; k < 13; k += 3) { r(k, 0, 2, 2, '#b3a27a'); r(k, 26, 2, 2, '#b3a27a'); }
      r(5, 8, 5, 4, '#a38558'); r(7, 8, 1, 4, '#5b3f27');
    })];
}
function boxSlices() {
  const R = ['#2e120f', '#4e1d18', '#6c2c22', '#8a3d2c'];
  // planks (each a little lighter or darker), a sliding door on each side with its rail and
  // handle, ribs on the ends, ladders at the corners
  const wall = (col, z) => slice((r) => {
    r(0, 0, 16, 28, col);
    for (let y = 0; y < 28; y++) { const v = hrnd(y >> 1, z, 31); if (v < 0.3) { r(0, y, 1, 1, R[0]); r(15, y, 1, 1, R[0]); } else if (v > 0.8) { r(0, y, 1, 1, R[2]); r(15, y, 1, 1, R[2]); } }
    r(0, 10, 1, 8, '#3e1612'); r(15, 10, 1, 8, '#3e1612');
    if (z === 1) { r(0, 13, 1, 1, '#8b919c'); r(15, 13, 1, 1, '#8b919c'); }
    if (z === 5) { r(0, 9, 1, 10, '#2a2d33'); r(15, 9, 1, 10, '#2a2d33'); }
    for (let x = 2; x < 16; x += 3) { r(x, 0, 1, 1, R[0]); r(x, 27, 1, 1, R[0]); }
    if (z & 1) { r(0, 0, 1, 1, '#8b919c'); r(15, 27, 1, 1, '#5d636e'); }
    wear(r, 40 + z, z < 2 ? 0.35 : 0.12);
  });
  return [...underSlices(), wall(R[1], 0), wall(R[1], 1), wall(R[1], 2), wall(R[1], 3), wall(R[1], 4), wall(R[2], 5), wall(R[2], 6),
    slice((r) => {
      r(0, 0, 16, 28, R[2]); r(0, 0, 2, 28, R[3]); r(14, 0, 2, 28, R[1]);
      for (let y = 3; y < 28; y += 4) r(1, y, 14, 1, R[1]);
      r(6, 0, 4, 28, '#5b3f27');
      for (let y = 1; y < 28; y += 2) r(6, y, 4, 1, '#4a3220');
      r(6, 0, 1, 28, '#7b5735');
      // rust streaks and a patch of the roof gone dull
      r(2, 5, 1, 4, '#5a2418'); r(12, 15, 1, 5, '#5a2418'); r(3, 19, 2, 2, '#7a4a3a'); r(11, 3, 2, 1, '#9a5038');
      r(0, 0, 16, 1, R[3]);
    })];
}
function tankSlices() {
  const out = underSlices(), col = ['#2b2e35', '#2b2e35', '#434753', '#434753', '#626875', '#626875', '#8b919c', '#a3a9b2', '#b4b9c1'];
  // a fuel tank lying along the car: each slice as wide as the round tank is at that height
  for (let z = 0; z < 9; z++) {
    const hw = Math.max(1, Math.round(7 * Math.sqrt(Math.max(0, 1 - Math.pow((z - 4) / 4.6, 2)))));
    out.push(slice((r) => {
      for (let y = 1; y < 27; y++) {
        const end = Math.min(y - 1, 26 - y), w = Math.max(1, hw - (end < 2 ? 2 - end : 0));
        r(8 - w, y, w * 2, 1, col[z]);
        // fuel run down the sides from the dome, and grime low down
        if (z > 1 && z < 7 && (y === 13 || y === 15) && hrnd(y, z, 51) < 0.8) { r(8 - w, y, 1, 1, '#2a2620'); r(7 + w, y, 1, 1, '#2a2620'); }
        if (z < 3 && hrnd(y, z, 52) < 0.35) { r(8 - w, y, 1, 1, '#3a2a1e'); r(7 + w, y, 1, 1, '#3a2a1e'); }
      }
      if (z > 0 && z < 8) { const w = hw; r(8 - w, 9, w * 2, 2, '#9a3326'); }
      // a hazard sign on each side
      if (z === 4 || z === 5) { r(1, 19, 1, 2, z === 4 ? '#e8e2cc' : '#d0553f'); r(14, 19, 1, 2, z === 4 ? '#e8e2cc' : '#d0553f'); }
      if (z === 8) { r(6, 12, 4, 4, '#434753'); r(7, 12, 2, 1, '#e8e2cc'); r(7, 2, 1, 23, '#d0d4da'); r(6, 15, 4, 1, '#2b2e35'); r(9, 3, 1, 1, '#8b919c'); r(9, 23, 1, 1, '#8b919c'); }
    }));
  }
  return out;
}
// Draw a pile of slices turned to heading ang, on a box px wide canvas (36 for a car). The pile's
// middle on the ground is at (box / 2, box / 2 + the number of slices).
function stackSpr(slices, ang, box) {
  box = box || 36;
  const n = slices.length, hb = box >> 1, cy = hb + n, sw = slices[0].width / 2, sh = slices[0].height / 2;
  const [c, g] = mk(box, box + n, true);
  for (let z = 0; z < n; z++) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(hb, cy - z);
    g.rotate(ang);
    g.drawImage(slices[z], -sw, -sh);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // hard edges: a pixel is either there or not
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  g.putImageData(im, 0, 0);
  return c;
}
// The ground shadow of a car turned to heading ang (black). tall = its height in px: the shadow is
// the footprint swept away from the sun up to that height (so a tall car throws a longer one).
function footSpr(ang, tall) {
  const [c, g] = mk(36 + Math.ceil((tall || 0) * SUNX), 36 + Math.ceil((tall || 0) * SUNY), true);
  g.fillStyle = '#000';
  for (let z = 0; z <= (tall || 0); z++) {
    g.setTransform(1, 0, 0, 1, 18 + z * SUNX, 18 + z * SUNY);
    g.rotate(ang);
    g.fillRect(-8, -13, 16, 26);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const im = g.getImageData(0, 0, 36, 36), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  g.putImageData(im, 0, 0);
  return c;
}
// TRAIN[k] = one car (0 = the engine): n[i] = its sprite at heading angOf(i), h[i] = hot (thermal),
// red[i] = taking damage (made when first needed), tall = its height. FOOT[i] = a car's shadow.
const TRAIN = [], FOOT = [];
function carRed(t, i) {
  if (!t.red[i]) {
    const c = tint(t.n[i], '#ff4a30', 0.45);
    c.ox = t.n[i].ox;
    c.oy = t.n[i].oy;
    t.red[i] = c;
  }
  return t.red[i];
}
// The engine glowing orange (laid over it while the Turbo Ram runs), made when first needed.
function carGlow(t, i) {
  if (!t.glow) t.glow = [];
  if (!t.glow[i]) t.glow[i] = tint(t.n[i], '#ff5a10', 1, 'source-atop');
  return t.glow[i];
}
// The survivors riding the flatcar: [px across (right), px along (to the front)] from its middle.
// With the rail cannon on it, the two at the back stay (RIDERS_GUN) and the cannon stands at the front.
const RIDERS = [[-3, 7], [3, 2], [-2, -4], [3, -9]];
const RIDERS_GUN = [[-4, -9], [3, -11]];

// SURV[k] = a survivor: n / h = standing (normal / hot), run = 2 running frames each [n, h].
const SURV = [];
// a survivor with a rifle, 4 x 7; f = 0 standing, 1 / 2 = running
// (a cap or hair on top, the face lit on the left, a shirt with a belt, a rifle with a wooden
// stock, trousers and boots)
function survivorRaw(shirt, skin, f, hat) {
  const lit = lighten(shirt, 40), dk = lighten(shirt, -30);
  return pix(4, 7, (r) => {
    r(0, 0, 3, 2, skin); r(0, 0, 3, 1, hat || '#2e2620'); r(2, 1, 1, 1, lighten(skin, -40));
    r(0, 2, 3, 3, shirt); r(0, 2, 1, 2, lit); r(2, 3, 1, 1, dk); r(0, 4, 3, 1, '#3a2a1e');
    r(3, 0, 1, 3, '#2a2c30'); r(3, 3, 1, 1, '#6b4a2c');
    const L = '#2e3440', B = '#14100c';
    if (f === 1) { r(0, 5, 1, 1, L); r(0, 6, 1, 1, B); r(2, 5, 1, 1, B); }
    else if (f === 2) { r(0, 5, 1, 1, B); r(2, 5, 1, 1, L); r(2, 6, 1, 1, B); }
    else { r(0, 5, 1, 1, L); r(2, 5, 1, 1, L); r(0, 6, 1, 1, B); r(2, 6, 1, 1, B); }
  });
}

// A camp survivor, with an empty hand raised to greet the train. Two poses make the wave.
function campPersonRaw(shirt, skin, wave) {
  return pix(6, 9, (r) => {
    r(1, 1, 3, 2, skin); r(1, 0, 3, 1, '#2e2620'); r(3, 2, 1, 1, lighten(skin, -40));
    r(1, 3, 3, 3, shirt); r(1, 3, 1, 2, lighten(shirt, 40)); r(3, 4, 1, 2, lighten(shirt, -30));
    r(0, 4, 1, 2, skin); r(1, 6, 3, 1, '#3a2a1e');
    r(4, 3, 1, 1, shirt); r(4, 1 + wave, 1, 2, skin); r(5, wave, 1, 2, skin);
    r(1, 7, 1, 1, '#2e3440'); r(3, 7, 1, 1, '#2e3440');
    r(1, 8, 1, 1, '#14100c'); r(3, 8, 1, 1, '#14100c');
  });
}

// ---------- the station halfway: a platform beside the rails, a small station house, lamps
const STATION = {};
function slabSpr() {
  return pix(12, 7, (r) => {
    r(0, 0, 12, 5, '#8f897c'); r(0, 0, 12, 1, '#aaa392'); r(0, 0, 1, 5, '#c9a23a');
    r(0, 5, 12, 2, '#5a564e'); r(11, 0, 1, 5, '#7a756a');
  });
}
function houseSpr() {
  return pix(28, 26, (r) => {
    // a tiled roof, lit on the left, with a chimney
    r(0, 0, 28, 14, '#6a2a22'); r(0, 0, 28, 1, '#a8503a'); r(0, 0, 2, 14, '#8a3d2c'); r(26, 0, 2, 14, '#4a1d18');
    for (let y = 3; y < 14; y += 3) r(1, y, 26, 1, '#5a221c');
    r(13, 0, 2, 14, '#8a3d2c'); r(20, 2, 3, 4, '#3a2a24'); r(20, 2, 3, 1, '#5a4a40');
    // the front wall: plaster, a door, two lit windows
    r(0, 14, 28, 12, '#8f805f'); r(0, 14, 28, 1, '#5e533c'); r(0, 14, 1, 12, '#b3a27a'); r(27, 14, 1, 12, '#6b5f45');
    r(12, 17, 5, 9, '#2e2216'); r(13, 18, 3, 3, '#ffcf6a');
    r(4, 17, 4, 4, '#ffcf6a'); r(4, 17, 4, 1, '#fff1c2'); r(20, 17, 4, 4, '#ffcf6a'); r(20, 17, 4, 1, '#fff1c2');
    r(0, 25, 28, 1, '#3e3b35');
  });
}
function lampSpr() {
  return pix(3, 18, (r) => { r(1, 2, 1, 16, '#3a3e48'); r(0, 0, 3, 2, '#2a2d33'); r(1, 1, 1, 1, '#fff1c2'); });
}

// A colour k steps (0..255 per channel) lighter.
function lighten(col, k) {
  const [R, G, B] = hexRgb(col), h = (v) => clamp(v + k, 0, 255).toString(16).padStart(2, '0');
  return '#' + h(R) + h(G) + h(B);
}

// ---------- props
// Pine, h px tall. pal = [dark, mid, light]; the lit side is on the left (from Ball x Archers).
function pineSpr(h, rng, pal) {
  const w = (Math.round(h * 0.62) | 1), hi = lighten(pal[2], 22);
  return pix(w, h, (r) => {
    const cx = w >> 1;
    r(cx, h - 4, 1, 4, '#24180f'); r(cx - 1, h - 1, 3, 1, '#1a120b');
    const tiers = h > 22 ? 4 : 3, bot = h - 3;
    for (let t = 0; t < tiers; t++) {
      const y0 = Math.round(bot * t / tiers * 0.78), y1 = Math.min(bot, Math.round(bot * (t + 1) / tiers * 0.78 + bot * 0.24));
      const maxw = Math.round((w / 2) * (0.45 + 0.55 * (t + 1) / tiers));
      for (let y = y0; y < y1; y++) {
        const u = (y - y0) / Math.max(1, y1 - y0 - 1), hw = Math.max(0, Math.round(u * maxw));
        for (let x = cx - hw; x <= cx + hw; x++) {
          const side = (x - cx) / (hw + 0.01);
          let c = side < -0.3 ? pal[2] : side < 0.35 ? pal[1] : pal[0];
          // the sun catches the needles at the top left of each tier; each tier's skirt is in shade
          if (side < -0.45 && y - y0 < (y1 - y0) * 0.5 && rng() < 0.45) c = hi;
          if (y >= y1 - 2 && side > -0.6 && rng() < 0.7) c = pal[0];
          if (rng() < 0.06) c = pal[0];
          r(x, y, 1, 1, c);
        }
      }
    }
  });
}
// Leafy tree: a lumpy round crown lit from the top left, on a short trunk.
function oakSpr(h, rng, autumn) {
  const w = Math.round(h * 0.95) | 1, cr = w / 2 - 0.5, th = Math.round(h * 0.32);
  const pal = autumn ? ['#2a1a10', '#4a2a16', '#6e3f1e', '#94582a', '#b8763a'] : ['#18240f', '#26361a', '#384d25', '#506633', '#6a8040'];
  const seed = (rng() * 1000) | 0;
  const lumps = [];
  for (let k = 0; k < 6; k++) lumps.push([rng() * TAU, 0.18 + rng() * 0.16]);
  return pix(w, h, (r) => {
    const cx = (w - 1) / 2, cy = (h - th) / 2;
    r(Math.round(cx) - 1, h - th - 2, 2, th + 2, '#2a1d13'); r(Math.round(cx) - 1, h - th - 2, 1, th + 2, '#3b2a1c');
    r(Math.round(cx) + 1, h - 3, 1, 1, '#2a1d13'); r(Math.round(cx) - 2, h - 1, 1, 1, '#2a1d13');
    for (let y = 0; y < h - th + 1; y++) for (let x = 0; x < w; x++) {
      const dx = (x - cx) / cr, dy = (y - cy) / (cy + 0.5), a = Math.atan2(dy, dx);
      let rim = 0.86;
      for (const [la, lr] of lumps) rim += lr * Math.max(0, Math.cos(a - la)) * 0.45;
      const d = Math.hypot(dx, dy);
      if (d > rim) continue;
      // light from the top left, leaf clumps, a dark underside
      let l = -dx * 0.55 - dy * 0.85 + (rng() - 0.5) * 0.35 + (rim - d) * 0.2 + (vnoise(x / 2.3, y / 2.3, seed) - 0.5) * 0.7;
      if (dy > 0.45) l -= (dy - 0.45) * 1.2;
      r(x, y, 1, 1, l > 1.0 ? pal[4] : l > 0.6 ? pal[3] : l > 0.1 ? pal[2] : l > -0.45 ? pal[1] : pal[0]);
    }
  });
}
// Dead tree: a grey trunk and bare branches.
function deadSpr(h, rng) {
  const w = Math.round(h * 0.7) | 1;
  return pix(w, h, (r, g) => {
    const cx = w >> 1;
    r(cx, h - Math.round(h * 0.6), 2, Math.round(h * 0.6), '#3d342c'); r(cx, h - Math.round(h * 0.6), 1, Math.round(h * 0.6), '#5a4e42');
    const branch = (x, y, len, dir, depth) => {
      const x1 = x + Math.round(Math.cos(dir) * len), y1 = y - Math.round(Math.abs(Math.sin(dir)) * len);
      pl(g, x, y, x1, y1, depth ? '#5e5244' : '#6e6252');
      if (depth < 2) for (let k = 0; k < 2; k++) branch(x1, y1, len * 0.6, dir + (k ? 0.6 : -0.6) + (rng() - 0.5) * 0.3, depth + 1);
    };
    const top = h - Math.round(h * 0.6);
    branch(cx, top + 2, h * 0.28, -2.3 + rng() * 0.3, 0);
    branch(cx + 1, top + 1, h * 0.3, -0.8 + rng() * 0.3, 0);
    branch(cx, top + Math.round(h * 0.2), h * 0.2, -2.6, 1);
  });
}
// Bush: a low lumpy shrub.
function bushSpr(w, rng) {
  const h = Math.round(w * 0.62);
  return pix(w, h, (r) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / h * 2 - 1;
      if (dx * dx + dy * dy * 0.9 + (rng() - 0.5) * 0.25 > 1 || (y > h * 0.8 && Math.abs(dx) > 0.7)) continue;
      const l = -dx * 0.5 - dy * 0.9 + (rng() - 0.5) * 0.5;
      r(x, y, 1, 1, l > 0.5 ? '#4b5c30' : l > 0 ? '#34452a' : l > -0.5 ? '#26341f' : '#182214');
    }
  });
}
// Rock (from Ball x Archers).
function rockSpr(w, h, rng) {
  return pix(w, h, (r) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / h * 2 - 1;
      if (dx * dx + dy * dy * 1.1 > 1 - rng() * 0.14) continue;
      const l = -dx * 0.55 - dy * 0.85 + (rng() - 0.5) * 0.25;
      r(x, y, 1, 1, l > 0.55 ? '#8c8a80' : l > 0.1 ? '#6a6861' : l > -0.45 ? '#4b4a45' : '#302f2c');
    }
  });
}
function stumpSpr() {
  return pix(5, 6, (r) => {
    r(0, 1, 5, 5, '#3b2a1c'); r(0, 1, 2, 5, '#4f3a26'); r(4, 1, 1, 5, '#2a1d13');
    r(0, 0, 5, 2, '#8a7454'); r(1, 0, 3, 1, '#a38b66'); r(2, 1, 1, 1, '#6b5840');
  });
}
// A wrecked car seen from above and the side; burnt = a black and rust shell.
function wreckSpr(rng, burnt, paint) {
  const C = burnt ? ['#141110', '#2a201a', '#4a3424'] : paint;
  return pix(24, 13, (r) => {
    r(3, 9, 4, 3, '#101012'); r(17, 9, 4, 3, '#101012'); r(4, 10, 2, 1, '#2a2a2e'); r(18, 10, 2, 1, '#2a2a2e');
    r(1, 5, 22, 6, C[1]); r(1, 5, 22, 1, C[2]); r(1, 10, 22, 1, C[0]); r(1, 5, 1, 6, C[2]);
    r(5, 1, 13, 5, C[1]); r(5, 1, 13, 1, C[2]); r(5, 1, 1, 4, C[2]); r(17, 2, 1, 4, C[0]);
    r(6, 2, 5, 2, burnt ? '#0a0908' : '#26303f'); r(12, 2, 5, 2, burnt ? '#0a0908' : '#324155');
    r(6, 2, 1, 1, burnt ? '#1a1410' : '#6f8aa6');
    r(22, 6, 1, 1, burnt ? '#2a201a' : '#d8cfb6'); r(1, 6, 1, 1, burnt ? '#2a201a' : '#8a2a22');
    r(9, 7, 1, 3, C[0]); r(15, 7, 1, 3, C[0]);
    for (let k = 0; k < (burnt ? 14 : 5); k++) r(1 + ((rng() * 22) | 0), 2 + ((rng() * 9) | 0), 1 + ((rng() * 2) | 0), 1, rng() < 0.5 ? '#5e3a22' : '#3a2416');
  });
}
function barrelSpr(rng) {
  const base = rng() < 0.5 ? ['#3a1e14', '#6a3420', '#8a4a2a'] : ['#1e2a2a', '#2f4440', '#46605a'];
  return pix(6, 8, (r) => {
    r(0, 1, 6, 7, base[1]); r(0, 1, 2, 7, base[2]); r(5, 1, 1, 7, base[0]);
    r(0, 0, 6, 2, '#2a2420'); r(1, 0, 4, 1, '#5a5048');
    r(0, 3, 6, 1, base[0]); r(0, 6, 6, 1, base[0]);
    r(3, 5, 1, 1, '#a07040');
  });
}
function crateSpr() {
  return pix(8, 8, (r) => {
    r(0, 2, 8, 6, '#5b3f27'); r(0, 2, 2, 6, '#7b5735'); r(7, 2, 1, 6, '#3a2718');
    r(0, 0, 8, 3, '#8a6a44'); r(0, 0, 8, 1, '#a38558'); r(0, 4, 8, 1, '#3a2718'); r(3, 2, 1, 6, '#3a2718');
  });
}
// A broken stretch of field wall, w px long: stones, mortar, a jagged top, moss at the foot.
function wallSpr(w, rng) {
  const H = 8;
  return pix(w, H, (r) => {
    let top = 2 + ((rng() * 3) | 0);
    for (let x = 0; x < w; x++) {
      if (rng() < 0.25) top = clamp(top + (rng() < 0.5 ? -1 : 1), 1, 5);
      const ends = x < 2 || x > w - 3 ? 2 : 0;
      for (let y = top + ends; y < H; y++) {
        const row = (y / 3) | 0, brick = ((x + (row & 1) * 2) / 4) | 0;
        let c = hrnd(brick, row, 7) < 0.5 ? '#6b675e' : '#5a564e';
        if (y % 3 === 0 || (x + (row & 1) * 2) % 4 === 0) c = '#3e3b35';
        if (y === top + ends) c = '#8f897c';
        if (y >= H - 2 && rng() < 0.4) c = '#39462a';
        r(x, y, 1, 1, c);
      }
    }
  });
}
// A prop: its sprite, its cast shadow and its anchor (the middle of the bottom row).
function prop(spr, block, extra) {
  return Object.assign({ spr, sh: castShadow(spr), ax: spr.width >> 1, ay: spr.height - 1, block: block || 0 }, extra || {});
}
const PROPS = { pine: [], oak: [], fall: [], dead: [], bush: [], rock: [], big: [], stump: [], wreck: [], burnt: [], barrel: [], crate: [], wall: [], pole: [] };
// a telegraph pole: a crossbar with two glass insulators
function poleSpr() {
  return pix(5, 22, (r) => {
    r(2, 2, 1, 20, '#4a3828'); r(0, 2, 5, 1, '#2a1d13');
    r(0, 1, 1, 1, '#b4b9c1'); r(4, 1, 1, 1, '#b4b9c1'); r(2, 21, 1, 1, '#2a1d13');
  });
}

// ---------- the safe zone at the end of the line: a concrete wall with barbed wire, a gate, towers
const SAFE = {};
function wallBlockSpr(rng) {
  return pix(16, 12, (r) => {
    r(0, 3, 16, 3, '#8f897c'); r(0, 3, 16, 1, '#aaa392');
    r(0, 6, 16, 6, '#5a564e'); r(0, 6, 16, 1, '#6b675e'); r(15, 6, 1, 6, '#3e3b35'); r(0, 11, 16, 1, '#2e2c28');
    r(8, 6, 1, 5, '#3e3b35');
    for (let k = 0; k < 4; k++) r((rng() * 15) | 0, 7 + ((rng() * 4) | 0), 1, 1, '#4a4740');
    for (let x = 0; x < 16; x++) r(x, x % 4 === 0 ? 0 : x % 2 ? 1 : 2, 1, 1, '#7d838c');
  });
}
function towerSpr() {
  return pix(16, 36, (r, g) => {
    r(2, 14, 2, 22, '#3b2a1c'); r(12, 14, 2, 22, '#2a1d13'); r(2, 14, 1, 22, '#5b4632');
    pl(g, 3, 16, 12, 33, '#2a1d13'); pl(g, 12, 16, 3, 33, '#3b2a1c');
    r(0, 6, 16, 9, '#5b3f27'); r(0, 6, 16, 1, '#7b5735'); r(0, 6, 1, 9, '#7b5735'); r(15, 6, 1, 9, '#3a2718');
    r(2, 8, 12, 3, '#1a1410');
    r(6, 8, 2, 3, '#46523a'); r(6, 8, 2, 1, '#5c6b48');
    r(0, 0, 16, 6, '#3a2718'); r(1, 0, 14, 1, '#5b3f27'); r(0, 1, 2, 5, '#4a3220');
    r(10, 9, 3, 2, '#e8e2cc'); r(13, 9, 1, 2, '#fff1c2');
  });
}
function pillarSpr() {
  return pix(6, 16, (r) => {
    r(0, 2, 6, 14, '#6b675e'); r(0, 0, 6, 3, '#8f897c'); r(0, 0, 6, 1, '#aaa392'); r(5, 2, 1, 14, '#3e3b35');
    r(0, 15, 6, 1, '#2e2c28'); r(1, 6, 4, 1, '#c9772f'); r(1, 9, 4, 1, '#c9772f');
  });
}

// ---------- icons
const ICON = {};
// A sprite from rows of letters, one letter per pixel: a colour from pal, '.' = clear.
function strSpr(rows, pal) {
  return pix(rows[0].length, rows.length, (r) => rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') r(x, y, 1, 1, pal[row[x]]);
  }));
}
// The skill tree's node icons, 12 x 12 (an outline is added round each). Letters: metal k d m l s,
// cream w, gold y g G, red r R, fire O Y, blue B, olive x v V, green e E, wood n N, sandbag u T.
const NPAL = {
  k: '#0a0b0e', d: '#2d3038', m: '#626875', l: '#8b919c', s: '#c4c8ce', w: '#e8e2cc',
  y: '#8a6420', g: '#d9a33a', G: '#f6dc8e', r: '#6a2420', R: '#b8402e', O: '#ff8a3a', Y: '#ffd27a',
  B: '#9fd3f2', x: '#3c4229', v: '#5a6340', V: '#7d8a58', e: '#4f7a4a', E: '#8fd18a',
  n: '#4a3420', N: '#7b5735', u: '#7a6444', T: '#b49a6a'
};
const NICON = {};
const NODE_ART = {
  // LAST TRAIN: the engine, side on
  root: ['............', '........dd..', 'dddd....ld..', 'dBBd....ld..', 'dBBdlllllld.', 'dsssssssssdG',
    'dllllllllldd', 'dggggggggggd', 'dmmmmmmmmmmd', '.ls..ls..ls.', '.sl..sl..sl.', '............'],
  // COW CATCHER: the steel plow on the engine's nose, seen from the front
  cow: ['............', 'dddddddddddd', 'dmmmmmmmmmmd', '.slslslslsl.', '.slslslslsl.', '..lslslsls..',
    '..lslslsls..', '...slslsl...', '...slslsl...', '....lsls....', '....mmmm....', '............'],
  // GOLDEN ZOMBIES: a gold zombie with sparkles
  goldz: ['.........w..', '...yyyy.wGw.', '..yGGGGy.w..', '..yGkGky....', '..yGGGGy....', '..yGkkGy..w.',
    '...yGGy..wGw', '..yyggyy..w.', '.yGGggGgy...', 'yGGgggggGy..', 'yGgggggggy..', 'yyyyyyyyyy..'],
  // ARMOR: a steel shield with a gold plus
  armor: ['............', '.mssssssssm.', '.slllGglllm.', '.slllGglllm.', '.slGGGggglm.', '.slgggyyylm.',
    '.slllgylllm.', '..sllgyllm..', '..sllllllm..', '...sllllm...', '....slmm....', '.....mm.....'],
  // RAIL CANNON: a heavy turret on a flatcar, its long barrel glowing at the muzzle
  gun: ['..........YO', '........slsY', '.......slmm.', '......sl....', '.....sl.....', '...dsl......',
    '.dmslmmd....', 'dlllllllmd..', 'dgkgkgkgkd..', 'NNNNNNNNNNNN', 'nnnnnnnnnnnn', '.ls......ls.'],
  // GUN SPEED: rounds stacked higher and higher
  gunspd: ['............', '.........s..', '........sll.', '.....s..Ggy.', '....sll.Ggy.', '.s..Ggy.Ggy.',
    'sll.Ggy.Ggy.', 'Ggy.Ggy.Ggy.', 'Ggy.Ggy.Ggy.', 'Ggy.Ggy.Ggy.', 'Ggy.Ggy.Ggy.', 'yyy.yyy.yyy.'],
  // TURBO RAM: two fiery arrows forward
  ram: ['............', 'YO....YO....', '.YO....YO...', '..YO....YO..', '...YO....YO.', '....YO....YO',
    '....YO....YO', '...YO....YO.', '..YO....YO..', '.YO....YO...', 'YO....YO....', '............'],
  // COOLING: a snowflake
  cool: ['....B.B.....', '.....B......', '.B...B...B..', '..B..B..B...', 'B..B.B.B..B.', '.BBBBwBBBB..',
    'B..B.B.B..B.', '..B..B..B...', '.B...B...B..', '.....B......', '....B.B.....', '............'],
  // FAST FEED: an ammo belt
  feed: ['............', '............', '.s..s..s..s.', 'sl.sl.sl.sl.', 'Gg.Gg.Gg.Gg.', 'mmmmmmmmmmm.',
    'Gg.Gg.Gg.Gg.', 'Gy.Gy.Gy.Gy.', 'mmmmmmmmmmm.', 'yy.yy.yy.yy.', '............', '............'],
  // HEAVY ROUNDS: one big round
  heavy: ['.....ss.....', '....slll....', '...sllllm...', '...sllllm...', '...yyyyyy...', '...GGgggy...',
    '...Gggggy...', '...Gggggy...', '...Gggggy...', '...Gggggy...', '...yyyyyy...', '..yyyyyyyy..'],
  // 105MM CANNON: a big olive shell with gold bands
  he: ['.....ll.....', '....slll....', '....sllm....', '...VVvvvx...', '...VVvvvx...', '...Gggggy...',
    '...VVvvvx...', '...VVvvvx...', '...VVvvvx...', '...Gggggy...', '...mmmmmd...', '............'],
  // FAST RELOAD: a shell and an arrow up
  reload: ['............', '..ll.....G..', '.slll...GGg.', '.sllm..GGGgy', '.VVvx....Gy.', '.VVvx....Gy.',
    '.Gggy....Gy.', '.VVvx....Gy.', '.VVvx....Gy.', '.Gggy.......', '.mmmd.......', '............'],
  // RADIO RANGE: a mast sending waves
  radio: ['............', '.E........E.', 'E..E....E..E', 'E.E..RR..E.E', 'E.E..RR..E.E', 'E..E.ll.E..E',
    '.E...ll...E.', '.....ll.....', '....l..l....', '....l..l....', '...l....l...', '..mmmmmmmm..'],
  // MAGNET: a magnet pulling up a bolt
  magnet: ['...RRRRRR...', '..RRrrrrRR..', '.RRr....rRR.', '.Rr......Rr.', '.Rr......Rr.', '.Rr......Rr.',
    '.ss......ss.', '.ll......ll.', '............', '.....Gg.....', '.....gy.....', '.....gy.....'],
  // SCAVENGER: a bolt of scrap and a plus
  scav: ['............', 'GGGGG.......', 'Ggggy...EE..', 'yyyyy...EE..', '.Ggy..EEEEEE', '.Ggy..eeeeee',
    '.gyy....EE..', '.Ggy....ee..', '.gyy........', '.Ggy........', '.yyy........', '............'],
  // WINCH: a drum, a rope and a hook
  winch: ['.mmmmmmmmmm.', 'dlsssssssssd', '.mmmmmmmmmm.', '.....N......', '.....N......', '.....N......',
    '....lsl.....', '.....s......', '.l...s......', '.s...s......', '..ssss......', '............'],
  // FARM STOP: a red barn
  farm: ['.....dd.....', '....dmmd....', '...dmwwmd...', '..dmmwwmmd..', '.dmmmmmmmmd.', 'dddddddddddd',
    '..RRRRRRRR..', '..RRwRRwRR..', '..RRRwwRRR..', '..RRRwwRRR..', '..RRwRRwRR..', '..rrrrrrrr..'],
  // NEST SPEED: an MG nest behind sandbags
  nestspd: ['............', '............', '............', '....dd......', '...dmmssssss', '...dmmddd...',
    '...dmmd.....', '.TTTuTTTuTT.', '.uuuuuuuuuu.', 'TTuTTTuTTTuT', 'uuuuuuuuuuuu', '............'],
  // BARBED WIRE: coils of wire between two posts
  wire: ['............', '............', 'N..........N', 'N..........N', 'N.ss.ss.ss.N', 'Ns..s..s..sN',
    'Ns..s..s..sN', 'N.ss.ss.ss.N', 'N..........N', 'N..........N', 'n..........n', '............'],
  // MORTAR PIT: a mortar tube in a ring of sandbags
  mortar: ['.........dd.', '........dlsd', '.......dls..', '......dls...', '.....dls....', '....dls.....',
    '...dls......', '..mdd.ll....', '.TTTuTTTuTT.', '.uuuuuuuuuu.', 'TTuTTTuTTTuT', 'uuuuuuuuuuuu']
};

// Build every sprite. Called once at startup.
function initSprites() {
  const rng = mulberry(2024);
  // the dead: 8 walkers, 4 runners and 3 brutes, each in its own clothes
  // (the horde's own look is in horde.js)
  makeHordeSprites();
  // trees and scenery
  const PINE = [['#142018', '#1d2b20', '#2f4229'], ['#101a14', '#18241b', '#283a26'], ['#1a261c', '#243323', '#35492d']];
  for (let k = 0; k < 10; k++) PROPS.pine.push(prop(pineSpr(24 + ((rng() * 16) | 0), rng, PINE[k % 3]), 3, { tree: true }));
  for (let k = 0; k < 6; k++) PROPS.oak.push(prop(oakSpr(20 + ((rng() * 10) | 0), rng, false), 3, { tree: true }));
  for (let k = 0; k < 3; k++) PROPS.fall.push(prop(oakSpr(20 + ((rng() * 8) | 0), rng, true), 3, { tree: true }));
  for (let k = 0; k < 3; k++) PROPS.dead.push(prop(deadSpr(18 + ((rng() * 10) | 0), rng), 2, { tree: true }));
  for (let k = 0; k < 6; k++) PROPS.bush.push(prop(bushSpr(7 + ((rng() * 7) | 0), rng), 0));
  for (let k = 0; k < 10; k++) { const w = 3 + ((rng() * 4) | 0); PROPS.rock.push(prop(rockSpr(w, Math.max(2, (w * 0.7) | 0), rng), 0)); }
  for (let k = 0; k < 4; k++) { const w = 8 + ((rng() * 6) | 0); PROPS.big.push(prop(rockSpr(w, (w * 0.75) | 0, rng), 4)); }
  PROPS.stump.push(prop(stumpSpr(), 2));
  const PAINT = [['#1f2a3a', '#33465e', '#4f6a86'], ['#3a1612', '#6a2a22', '#8e3a30'], ['#4a4434', '#7a7056', '#a49a78'], ['#1e2a1e', '#344a34', '#4f6a4c']];
  for (let k = 0; k < 4; k++) PROPS.wreck.push(prop(wreckSpr(rng, false, PAINT[k]), 9, { wreck: true }));
  for (let k = 0; k < 2; k++) PROPS.burnt.push(prop(wreckSpr(rng, true), 9, { wreck: true }));
  for (let k = 0; k < 2; k++) PROPS.barrel.push(prop(barrelSpr(rng), 3));
  PROPS.crate.push(prop(crateSpr(), 4));
  for (let k = 0; k < 8; k++) PROPS.wall.push(prop(wallSpr(10 + ((rng() * 12) | 0), rng), 0, { wall: true }));
  PROPS.pole.push(prop(poleSpr(), 0));
  // the train at every heading: [slices, height, warmth on the thermal camera]
  TRAIN.length = 0;
  FOOT.length = 0;
  for (const [make, heat] of [[locoSlices, 150], [coachSlices, 100], [flatSlices, 60], [boxSlices, 75], [tankSlices, 55]]) {
    const sl = make(), t = { n: [], h: [], red: [], foot: [], tall: sl.length };
    for (let i = 0; i < ANG_N; i++) {
      const raw = stackSpr(sl, angOf(i));
      const n = selOut(rimLight(raw, '#f0e6cc', 0.3));
      t.foot.push(footSpr(angOf(i), sl.length - 1));
      n.ox = 19;
      n.oy = 19 + sl.length;
      const h = outline(hotSpr(raw, heat), '#161616');
      h.ox = n.ox;
      h.oy = n.oy;
      t.n.push(n);
      t.h.push(h);
    }
    TRAIN.push(t);
  }
  for (let i = 0; i < ANG_N; i++) FOOT.push(footSpr(angOf(i)));
  SURV.length = 0;
  for (const [shirt, skin] of [['#45608e', '#c99a72'], ['#94372c', '#8a6448'], ['#5c6b40', '#b8876a'], ['#7d776b', '#d1a582'],
    ['#9fd3f2', '#c99a72'], ['#e3b04b', '#8a6448']]) {
    const hat = ['#2e2620', '#4a5a34', '#7a3a24', '#2e2620', '#c4b088', '#3a3e48'][SURV.length];
    const one = (f) => { const raw = survivorRaw(shirt, skin, f, hat); return [outline(raw, '#07080a'), outline(hotSpr(raw, 215), '#161616')]; };
    const [n, h] = one(0);
    SURV.push({ n, h, run: [one(1), one(2)] });
  }
  // the helicopters at every heading round the circle (helis.js)
  bakeHelis();
  // the station
  STATION.slab = prop(slabSpr(), 0);
  STATION.house = prop(houseSpr(), 10);
  STATION.lamp = prop(lampSpr(), 0);
  // the safe zone
  SAFE.blocks = [];
  for (let k = 0; k < 4; k++) SAFE.blocks.push(prop(wallBlockSpr(rng), 0));
  SAFE.tower = prop(towerSpr(), 0);
  SAFE.pillar = prop(pillarSpr(), 0);
  // icons
  ICON.coin = outline(pix(5, 5, (r) => {
    r(1, 0, 3, 1, '#e8bd55'); r(0, 1, 5, 3, '#d9a33a'); r(1, 4, 3, 1, '#a8761f'); r(1, 1, 1, 2, '#f6dc8e'); r(3, 2, 1, 2, '#a8761f');
  }), '#1a1206');
  ICON.skull = outline(pix(5, 5, (r) => {
    r(0, 0, 5, 3, P.bone); r(1, 3, 3, 2, P.bone); r(1, 1, 1, 1, P.dk); r(3, 1, 1, 1, P.dk); r(2, 3, 1, 1, '#8a826f');
  }), P.out);
  ICON.mg = outline(pix(3, 7, (r) => {
    r(0, 2, 3, 5, '#b8862f'); r(0, 2, 1, 5, '#e3b04b'); r(1, 0, 1, 2, '#b4b9c1'); r(0, 1, 3, 1, '#8b919c');
  }), P.out);
  ICON.train = outline(pix(7, 6, (r) => {
    r(0, 0, 7, 5, '#465469'); r(0, 0, 7, 1, '#6d82a3'); r(1, 1, 5, 2, '#9fd3f2'); r(1, 3, 1, 1, '#fff1c2'); r(5, 3, 1, 1, '#fff1c2');
    r(0, 5, 7, 1, '#151b24');
  }), P.out);
  ICON.flag = outline(pix(5, 7, (r) => {
    r(0, 0, 1, 7, '#8b919c'); r(1, 0, 4, 3, '#56c2a8'); r(1, 2, 4, 1, '#2f7a68');
  }), P.out);
  ICON.he = outline(pix(5, 9, (r) => {
    r(0, 3, 5, 6, '#626875'); r(0, 3, 1, 6, '#8b919c'); r(1, 1, 3, 2, '#b8862f'); r(2, 0, 1, 1, '#e3b04b'); r(0, 7, 5, 1, '#b8862f');
  }), P.out);
  // TURBO RAM: two fiery chevrons pointing up the line
  ICON.ram = outline(strSpr(['...G...', '..GYO..', '.GYOOO.', 'GYO.OOR', '...G...', '..GYO..', '.GYOOO.', 'GYO.OOR'], NPAL), P.out);
  ICON.ramOff = tint(ICON.ram, '#4b4f5a', 0.8);
  // scrap: a brass bolt (a hex head on a threaded shank)
  ICON.scrap = outline(pix(5, 8, (r) => {
    r(0, 0, 5, 3, '#d9a33a'); r(0, 0, 5, 1, '#f6dc8e'); r(0, 2, 5, 1, '#a8761f'); r(2, 0, 1, 3, '#b8862f'); r(2, 0, 1, 1, '#f6dc8e');
    r(1, 3, 3, 5, '#d9a33a'); r(1, 3, 1, 5, '#f6dc8e'); r(1, 4, 3, 1, '#8a6420'); r(1, 6, 3, 1, '#8a6420'); r(3, 3, 1, 5, '#a8761f');
  }), '#1a1206');
  // survivors: a person in a green shirt
  ICON.surv = outline(pix(5, 7, (r) => {
    r(1, 0, 3, 2, '#e0b48c'); r(1, 0, 3, 1, '#4a3a2e');
    r(0, 2, 5, 3, '#5f9a5a'); r(1, 2, 3, 3, '#8fd18a'); r(1, 2, 1, 2, '#c4ecbd');
    r(1, 5, 1, 2, '#2e4a2e'); r(3, 5, 1, 2, '#2e4a2e');
  }), P.out);
  // a padlock (something still locked)
  ICON.lock = outline(pix(7, 7, (r) => {
    r(2, 0, 3, 1, '#8b919c'); r(1, 1, 1, 2, '#8b919c'); r(5, 1, 1, 2, '#626875');
    r(0, 3, 7, 4, '#a3a8b0'); r(0, 3, 7, 1, '#d6d9de'); r(6, 4, 1, 3, '#626875'); r(3, 4, 1, 2, '#1c1e23');
  }), P.out);
  ICON.lockBig = scaleSpr(ICON.lock, 3);
  ICON.survBig = scaleSpr(ICON.surv, 3);
  // small price marks for the skill tree (a bolt = scrap, a person = survivors), and the star of a
  // big unlock
  ICON.boltS = outline(strSpr(['GGg', 'gyy', '.g.', '.g.', '.y.'], NPAL), P.out);
  ICON.survS = outline(strSpr(['.w.', 'EEE', 'EEE', 'e.e', 'e.e'], NPAL), P.out);
  ICON.star = outline(strSpr(['..G..', '..G..', 'GGGgy', '.Ggy.', '.g.y.'], NPAL), P.out);
  // the node icons
  for (const [id, rows] of Object.entries(NODE_ART)) {
    if (rows.length !== 12 || rows.some((r) => r.length !== 12)) console.error('node icon ' + id + ' is not 12 x 12');
    NICON[id] = outline(strSpr(rows, NPAL), P.out);
  }
  // into the atlas now, not on the first frame of the tree (each new atlas sprite costs a re-upload)
  for (const c of [...Object.values(NICON), ICON.boltS, ICON.survS, ICON.star, ICON.lock]) atl(c);
  // the same for the run's new sprites: the Ram card's icon (the rail cannon's are in cannon.js)
  for (const c of [ICON.ram, ICON.ramOff]) atl(c);
  for (let i = 0; i < ANG_N; i++) atl(carGlow(TRAIN[0], i));
  initScenery();
  initLand();
  warmAtlas();
}
