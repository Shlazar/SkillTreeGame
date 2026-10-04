// f4.js - the swept-wing F-4 and its line of burning ground. Flight/show state stays in STRAF.
// Hooks: f4Payload/f4Fire (plane launch/update), drawFireLine (air aim), planeArt (body/shadow).
const F4C = {
  // Base fire-line length, DPS, patch radius/spacing and filled-preview opacity (proposal)
  length: 230, damage: 2, radius: 14, step: 18, previewAlpha: 0.16
};
const F4 = { n: [], sh: [], hot: [] };
function f4Raw() {
  return pix(62, 64, (r) => {
    const L = '#c3cad0', A = '#a1a9b1', B = '#848d96', D = '#636b74', E = '#454b53', K = '#18191c';
    // The swept wings grow rearward from the narrow shoulders, with dark trailing edges.
    for (let y = 18; y <= 41; y++) {
      const w = Math.min(30, Math.floor((y - 18) * 1.4) + 3);
      r(31 - w, y, w, 1, y === 41 ? E : A);
      r(31, y, w, 1, y === 41 ? E : B);
      r(31 - w, y, 1, 1, L);
      r(30 + w, y, 1, 1, D);
    }
    r(1, 39, 3, 5, D); r(58, 39, 3, 5, E);
    r(1, 39, 3, 1, L); r(58, 39, 3, 1, B);
    // Underwing napalm tanks, separate from the two engines in the fuselage.
    for (const x of [13, 44]) {
      r(x, 31, 5, 14, '#58603f'); r(x, 31, 1, 13, '#737c58');
      r(x + 4, 32, 1, 12, '#2d3036'); r(x + 1, 30, 3, 2, '#737c58');
    }
    // Smaller swept tail planes and the long pointed nose.
    for (let y = 48; y <= 57; y++) {
      const w = Math.floor((y - 48) * 1.5) + 3;
      r(31 - w, y, w * 2, 1, y === 57 ? E : B);
      r(31 - w, y, 1, 1, L); r(30 + w, y, 1, 1, D);
    }
    r(29, 0, 4, 5, K); r(29, 2, 1, 3, B);
    r(28, 5, 6, 51, B); r(28, 5, 1, 51, L); r(29, 5, 2, 50, A); r(33, 5, 1, 51, D);
    r(27, 14, 8, 12, D); r(28, 14, 6, 10, '#22384a');
    r(28, 14, 1, 7, '#c4ecf8'); r(29, 15, 1, 2, '#c4ecf8'); r(28, 21, 6, 1, D);
    // Twin intakes lead into slim engine nacelles and warm exhaust mouths.
    for (const x of [23, 32]) {
      r(x, 28, 7, 25, B); r(x, 28, 1, 23, L); r(x + 6, 29, 1, 23, E);
      r(x + 1, 28, 5, 2, K); r(x + 1, 52, 5, 3, '#2a2420');
      r(x + 2, 54, 3, 1, '#c9772f');
    }
    r(30, 48, 3, 15, D); r(30, 48, 1, 15, L); r(31, 62, 1, 2, '#c8432e');
    for (const x of [8, 51]) {
      r(x, 35, 3, 3, '#2c3a5a'); r(x + 1, 36, 1, 1, '#e8e2cc');
    }
  });
}
// Bake every body/shadow heading before warmAtlas; these arrays never gain runtime canvases.
function bakeF4() {
  const raw = f4Raw();
  for (let i = 0; i < JETC.N; i++) {
    const r = rotA(raw, i / JETC.N * TAU);
    F4.n.push(jetSpriteBounds(selOut(rimLight(r, '#e8e2cc', 0.2))));
    F4.sh.push(jetSpriteBounds(tint(r, '#000', 1, 'source-in')));
    F4.hot.push(jetSpriteBounds(outline(hotSpr(r, 150), '#161616')));
  }
  for (const c of [...F4.n, ...F4.sh, ...F4.hot]) atl(c);
}
bakeF4();

function f4Pattern(len) {
  const count = Math.ceil(len / F4C.step) + 1;
  return { count, step: len / (count - 1) };
}
// Capture the run upgrades at launch; the preview uses the same length and patch placement.
function f4Payload(up) {
  const len = F4C.length * (up.fireLength ?? 1), pattern = f4Pattern(len);
  return { len, fireDamage: F4C.damage * (up.fireDamage ?? 1),
    fireDuration: up.fireWall ? 12 : up.fireDuration ?? 4, fireWall: !!up.fireWall,
    patchRadius: F4C.radius, patchStep: pattern.step, patchCount: pattern.count, patchNext: 0, patches: 0 };
}
function f4Fire(j) {
  // The payload lands under the flight, with both endpoints included. At most 22 patches per pass.
  while (j.patchNext < j.patchCount) {
    const s = -j.len / 2 + j.patchNext * j.patchStep;
    if (j.s < s) break;
    const p = addBurn(j.px + j.ux * s, j.py + j.uy * s,
      j.patchRadius, j.fireDuration, j.fireDamage, 'f4', j.fireWall);
    j.patchNext++;
    if (p) {
      if (!j.fired && !G.demo) SFX.f4Ignite();
      j.patches++; j.fired = true;
    }
  }
}
// The filled lane and flame pixels follow the same centres as the production burn patches.
function drawFireLine(x, y, ux, uy, lengthMultiplier = 1, wall = false) {
  const len = F4C.length * lengthMultiplier, pattern = f4Pattern(len), nx = -uy, ny = ux;
  const hw = F4C.radius * Math.hypot(nx, ny * FORE), L = len / 2, col = wall ? '#e2552f' : '#ff9a3a';
  ctx.globalAlpha = F4C.previewAlpha;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - ux * L + nx * hw, y - uy * L + ny * hw);
  ctx.lineTo(x + ux * L + nx * hw, y + uy * L + ny * hw);
  ctx.lineTo(x + ux * L - nx * hw, y + uy * L - ny * hw);
  ctx.lineTo(x - ux * L - nx * hw, y - uy * L - ny * hw);
  ctx.fill();
  ctx.globalAlpha = Math.floor(realT * 6) % 2 ? 0.9 : 0.6;
  for (let i = 0; i < pattern.count; i++) {
    const s = -L + i * pattern.step, px = Math.round(x + ux * s), py = Math.round(y + uy * s);
    ctx.fillStyle = col; ctx.fillRect(px - 1, py - 2, 3, 3);
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(px, py - 3, 1, 3);
  }
  ctx.globalAlpha = 1;
}
