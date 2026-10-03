// sprites.js - every sprite is drawn in code at startup (no image files).
// Inside: the palettes (P for pixel art, U for the UI), the zombie drawings (dWalker, dRunner,
// dBrute) with their colour sets, makeZSet() that builds a zombie's frames, the props (trees,
// bushes, rocks, stumps, wrecks, barrels, crates, ruined walls) and the icons.
//
// A zombie drawing takes (r, f, c): r = rectangle painter r(x, y, w, h, color) from pix(),
// f = walk frame 0 or 1, c = its colours. Inside, o() is like r() but moves up 1 px on frame 1
// (a body bob). The drawings face right. The rows below are art data: x, y, w, h, color.

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
  blue: '#9fd3f2', amber: '#e8913a'
};
// zombie colours: skins (dark to light), shirts, trousers, hair
const ZSKIN = [
  ['#3f4a37', '#5f6d50', '#808f69', '#a6b388'],     // grave green
  ['#45433f', '#67645d', '#8d887d', '#b2ab9b'],     // ash grey
  ['#4f4632', '#71654a', '#978863', '#b9ab80'],     // sallow
  ['#3a4548', '#5a686a', '#7f8f8d', '#a4b2ac']      // drowned
];
const ZSHIRT = [
  ['#3a1412', '#6a2420', '#94372c'], ['#1a2238', '#2c3d62', '#45608e'], ['#4e4a42', '#7d776b', '#aaa290'],
  ['#262f1c', '#3f4c2c', '#5c6b40'], ['#2e2016', '#4f3826', '#6f5034'], ['#4a3a14', '#7a6224', '#a68a3c']
];
const ZPANTS = [['#16181d', '#262931', '#3a3e4a'], ['#221a14', '#352920', '#4c3b2c'], ['#1e2420', '#303a33', '#46524a']];
const ZHAIR = ['#1c1612', '#2e2620', '#4a4238', '#3a1e14'];

// ---------- zombie drawings
// Walker: shuffles, one arm reaching out, head pushed forward. 9x16 px.
function dWalker(r, f, c) {
  const b = f ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [s0, s1, s2, s3] = c.sk, [h0, h1, h2] = c.sh, [p0, p1, p2] = c.pa;
  // legs: a dragging stride on frame 0, together on frame 1
  if (!f) {
    r(2, 11, 1, 4, p1); r(5, 11, 1, 4, p0); r(2, 13, 1, 1, s1);
    r(1, 15, 2, 1, P.dk); r(5, 15, 2, 1, P.dk);
  } else {
    r(3, 11, 1, 4, p1); r(5, 11, 1, 4, p0);
    r(2, 15, 2, 1, P.dk); r(5, 15, 2, 1, P.dk);
  }
  o(2, 10, 4, 1, p2); o(2, 10, 1, 1, p1);
  // torso: a torn shirt lit on the left, a wound, a ragged hem
  o(2, 5, 4, 5, h1); o(2, 5, 1, 5, h2); o(5, 6, 1, 4, h0); o(3, 5, 2, 1, h2);
  o(3, 7, 1, 1, s1);
  o(4, 8, 1, 2, P.bl2); o(4, 9, 1, 1, P.bl1);
  o(2, 9, 1, 1, h0); o(5, 9, 1, 1, P.rag0);
  // the back arm hangs
  o(1, 6, 1, 3, s1); o(1, 9, 1, 1, s0);
  // head pushed forward: lit top and left, a dark socket, one glowing eye, a slack jaw
  o(3, 1, 4, 4, s2); o(3, 1, 4, 1, s3); o(3, 1, 1, 3, s3); o(6, 2, 1, 3, s1);
  o(3, 0, 3, 1, c.hr); o(3, 1, 1, 1, c.hr);
  o(5, 2, 1, 1, P.em); o(4, 2, 1, 1, s0);
  o(5, 4, 2, 1, s0); o(6, 4, 1, 1, P.bl2);
  o(4, 5, 1, 1, s1);
  // the front arm reaches out, hand open
  o(5, 6, 1, 1, h2); o(6, 6, 2, 1, s2); o(8, 6, 1, 1, s3); o(6, 7, 2, 1, s1); o(8, 7, 1, 1, s2);
}
// Runner: fast, bent low, arms clawing. 10x14 px.
function dRunner(r, f, c) {
  const b = f ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [s0, s1, s2, s3] = c.sk, [h0, h1, h2] = c.sh, [p0, p1, p2] = c.pa;
  if (!f) {
    r(1, 10, 1, 2, p1); r(0, 12, 1, 1, p1); r(0, 13, 2, 1, P.dk);
    r(6, 10, 1, 2, p0); r(7, 12, 1, 1, p0); r(7, 13, 2, 1, P.dk);
  } else {
    r(3, 10, 1, 3, p1); r(5, 10, 1, 3, p0); r(2, 13, 2, 1, P.dk); r(5, 13, 2, 1, P.dk);
  }
  o(2, 9, 5, 1, p2);
  // torso leaning forward
  o(2, 6, 4, 3, h1); o(3, 5, 4, 1, h1); o(4, 4, 3, 1, h2); o(2, 6, 1, 3, h2); o(5, 7, 1, 2, h0);
  o(3, 7, 1, 1, P.bl2);
  // arms: the back one swung behind, the front one clawing ahead
  o(1, 6, 1, 1, s1); o(0, 7, 1, 2, s1);
  o(6, 5, 2, 1, s2); o(8, 6, 1, 1, s3); o(7, 6, 1, 1, s1);
  // head low and forward
  o(6, 1, 3, 3, s2); o(6, 1, 3, 1, s3); o(6, 1, 1, 2, s3); o(9, 2, 1, 2, s1);
  o(6, 0, 3, 1, c.hr);
  o(8, 2, 1, 1, P.em); o(7, 2, 1, 1, s0); o(8, 3, 1, 1, s0);
}
// Brute: bloated and slow, ribs through the skin, long heavy arms. 15x21 px.
function dBrute(r, f, c) {
  const b = f ? -1 : 0, o = (x, y, w, h, col) => r(x, y + b, w, h, col);
  const [s0, s1, s2, s3] = c.sk, [h0, h1, h2] = c.sh, [p0, p1, p2] = c.pa;
  if (!f) {
    r(3, 15, 3, 5, p1); r(9, 15, 3, 5, p0); r(2, 20, 4, 1, P.dk); r(9, 20, 4, 1, P.dk); r(3, 15, 1, 4, p2);
  } else {
    r(4, 15, 3, 5, p1); r(8, 15, 3, 5, p0); r(3, 20, 4, 1, P.dk); r(8, 20, 4, 1, P.dk); r(4, 15, 1, 4, p2);
  }
  // belly and chest, bare and bloated
  o(3, 7, 9, 8, s2); o(3, 7, 2, 8, s3); o(10, 8, 2, 7, s1); o(5, 13, 5, 2, s1);
  for (let k = 0; k < 3; k++) o(6, 8 + k * 2, 3, 1, P.bone);
  o(5, 8, 1, 5, P.bl1); o(9, 9, 1, 4, P.bl2); o(6, 9, 3, 1, P.bl0);
  o(3, 14, 9, 1, p2);
  // shoulders under a torn vest
  o(2, 6, 11, 2, h1); o(2, 6, 11, 1, h2); o(11, 7, 2, 4, h0); o(2, 7, 2, 5, h1);
  // a small head sunk between the shoulders
  o(6, 1, 5, 5, s2); o(6, 1, 5, 1, s3); o(6, 1, 1, 4, s3); o(10, 2, 1, 4, s1);
  o(6, 0, 4, 1, c.hr);
  o(9, 3, 1, 1, P.em); o(8, 3, 1, 1, s0); o(8, 5, 3, 1, s0); o(9, 5, 1, 1, P.bone);
  // arms down to the knees, the front one reaching
  o(0, 8, 3, 7, s1); o(0, 8, 1, 7, s2); o(0, 15, 3, 2, s0);
  o(12, 8, 3, 3, s2); o(13, 11, 2, 4, s1); o(12, 15, 3, 2, s2); o(14, 15, 1, 1, s3);
}

// ---------- zombie frame sets
// Every frame has n = normal, w = white (hit flash), h = hot (thermal camera), s = shadow, each also
// mirrored (nf, wf, hf, sf) for a zombie that walks left. Plus the body turned on its side (dead),
// the 4 turns of a thrown body (spin) and two corpses with a pool of blood.
function makeZSet(w, h, draw, pal, shw) {
  const S = { walk: [] };
  for (let f = 0; f < 2; f++) {
    const raw = pix(w, h, (r) => draw(r, f, pal));
    const n = selOut(rimLight(raw, '#e8e2cc', 0.22));
    const hot = outline(hotSpr(raw), '#161616');
    const nf = flipH(n), hf = flipH(hot);
    S.walk.push({
      n, nf, w: tint(n, '#fff3dc', 0.75), wf: tint(nf, '#fff3dc', 0.75), h: hot, hf,
      s: unitShadow(n, shw), sf: unitShadow(nf, shw)
    });
  }
  const c0 = S.walk[0].n;
  S.ax = c0.width >> 1;
  S.ay = c0.height - 1;
  S.h = c0.height;
  S.shp = S.walk[0].s.pad || 0;
  S.dead = rot90(c0);
  S.deadH = rot90(S.walk[0].h);
  // a body thrown by a blast turns over in the air: 4 quarter turns (normal and hot)
  S.spin = [c0, S.dead, rot90(S.dead), rot90(rot90(S.dead))];
  S.spinH = [S.walk[0].h, S.deadH, rot90(S.deadH), rot90(rot90(S.deadH))];
  S.dax = S.dead.width >> 1;
  S.day = S.dead.height - 1;
  const raw0 = pix(w, h, (r) => draw(r, 0, pal));
  S.corpses = [corpseSpr(raw0, false), corpseSpr(raw0, true)];
  S.cax = S.corpses[0].width >> 1;
  S.cay = S.corpses[0].height - 2;
  return S;
}
// ZS[type] = the colour variants of each type (0 walker, 1 runner, 2 brute)
const ZS = [[], [], []];

// ---------- props
// Pine, h px tall. pal = [dark, mid, light]; the lit side is on the left (from Ball x Archers).
function pineSpr(h, rng, pal) {
  const w = (Math.round(h * 0.62) | 1);
  return pix(w, h, (r) => {
    const cx = w >> 1;
    r(cx, h - 4, 1, 4, '#24180f');
    const tiers = h > 22 ? 4 : 3, bot = h - 3;
    for (let t = 0; t < tiers; t++) {
      const y0 = Math.round(bot * t / tiers * 0.78), y1 = Math.min(bot, Math.round(bot * (t + 1) / tiers * 0.78 + bot * 0.24));
      const maxw = Math.round((w / 2) * (0.45 + 0.55 * (t + 1) / tiers));
      for (let y = y0; y < y1; y++) {
        const u = (y - y0) / Math.max(1, y1 - y0 - 1), hw = Math.max(0, Math.round(u * maxw));
        for (let x = cx - hw; x <= cx + hw; x++) {
          const side = (x - cx) / (hw + 0.01);
          let c = side < -0.3 ? pal[2] : side < 0.35 ? pal[1] : pal[0];
          if (y === y1 - 1 && rng() < 0.5) c = pal[0];
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
  const pal = autumn ? ['#2a1a10', '#4a2a16', '#6e3f1e', '#94582a'] : ['#18240f', '#26361a', '#384d25', '#506633'];
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
      const l = -dx * 0.55 - dy * 0.85 + (rng() - 0.5) * 0.45 + (rim - d) * 0.2;
      r(x, y, 1, 1, l > 0.62 ? pal[3] : l > 0.12 ? pal[2] : l > -0.45 ? pal[1] : pal[0]);
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
      pl(g, x, y, x1, y1, depth ? '#4a4038' : '#3d342c');
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
const PROPS = { pine: [], oak: [], fall: [], dead: [], bush: [], rock: [], big: [], stump: [], wreck: [], burnt: [], barrel: [], crate: [], wall: [] };

// ---------- icons
const ICON = {};

// Build every sprite. Called once at startup.
function initSprites() {
  const rng = mulberry(2024);
  // the dead: 8 walkers, 4 runners and 3 brutes, each in its own clothes
  const pal = (k) => ({ sk: ZSKIN[k % 4], sh: ZSHIRT[(k * 5 + 1) % 6], pa: ZPANTS[(k * 2) % 3], hr: ZHAIR[(k * 3) % 4] });
  for (let k = 0; k < 8; k++) ZS[0].push(makeZSet(9, 16, dWalker, pal(k), 7));
  for (let k = 0; k < 4; k++) ZS[1].push(makeZSet(10, 14, dRunner, pal(k + 3), 6));
  for (let k = 0; k < 3; k++) ZS[2].push(makeZSet(15, 21, dBrute, pal(k + 1), 12));
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
  // icons
  ICON.coin = outline(pix(5, 5, (r) => {
    r(1, 0, 3, 1, '#e8bd55'); r(0, 1, 5, 3, '#d9a33a'); r(1, 4, 3, 1, '#a8761f'); r(1, 1, 1, 2, '#f6dc8e'); r(3, 2, 1, 2, '#a8761f');
  }), '#1a1206');
  ICON.skull = outline(pix(5, 5, (r) => {
    r(0, 0, 5, 3, P.bone); r(1, 3, 3, 2, P.bone); r(1, 1, 1, 1, P.dk); r(3, 1, 1, 1, P.dk); r(2, 3, 1, 1, '#8a826f');
  }), P.out);
  ICON.fuel = outline(pix(5, 6, (r) => {
    r(0, 1, 5, 5, '#b8402e'); r(0, 1, 1, 5, '#e06a4f'); r(4, 2, 1, 4, '#7a2a22'); r(1, 0, 2, 1, '#8b919c'); r(1, 3, 3, 1, '#e8913a');
  }), P.out);
  ICON.zed = outline(pix(5, 5, (r) => {
    r(0, 0, 5, 5, '#808f69'); r(0, 0, 5, 1, '#a6b388'); r(3, 1, 1, 1, P.em); r(1, 1, 1, 1, '#3f4a37'); r(1, 3, 3, 1, '#3f4a37');
  }), P.out);
  ICON.mg = outline(pix(3, 7, (r) => {
    r(0, 2, 3, 5, '#b8862f'); r(0, 2, 1, 5, '#e3b04b'); r(1, 0, 1, 2, '#b4b9c1'); r(0, 1, 3, 1, '#8b919c');
  }), P.out);
  ICON.he = outline(pix(5, 9, (r) => {
    r(0, 3, 5, 6, '#626875'); r(0, 3, 1, 6, '#8b919c'); r(1, 1, 3, 2, '#b8862f'); r(2, 0, 1, 1, '#e3b04b'); r(0, 7, 5, 1, '#b8862f');
  }), P.out);
}
