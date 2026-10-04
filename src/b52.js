// b52.js - the eight-engine bomber and its row of falling bombs. Flights live in STRAF.
// Hooks: b52Payload/b52Drop (plane launch/update), drawBombLane (air aim), planeArt (body/shadow).
const B52C = {
  // Lane length, blast radius/damage, fall seconds, fire seconds/DPS and preview opacity (proposal)
  length: 300, radius: 18, damage: 12, fall: 0.55, burnDuration: 4, burnDamage: 2, previewAlpha: 0.12
};
const B52 = { n: [], sh: [], engines: [12, 18, 29, 35, 61, 67, 78, 84].map((x) => ({ x, y: 44 })) };
function b52Raw() {
  return pix(96, 76, (r) => {
    const L = '#c3cad0', A = '#a1a9b1', B = '#848d96', D = '#636b74', E = '#454b53', K = '#18191c';
    // Long swept wings have a bright upper edge and a dark trailing edge.
    for (let y = 19; y <= 34; y++) {
      const w = Math.min(48, 9 + (y - 19) * 3);
      r(48 - w, y, w, 1, y === 34 ? E : A);
      r(48, y, w, 1, y === 34 ? E : B);
      r(48 - w, y, 1, 1, L); r(47 + w, y, 1, 1, D);
    }
    r(0, 32, 3, 5, D); r(93, 32, 3, 5, E);
    r(0, 32, 3, 1, L); r(93, 32, 3, 1, B);
    // A narrow tail contrasts with the wide main wing and the thick, long fuselage.
    for (let y = 59; y <= 67; y++) {
      const w = 4 + (y - 59) * 2;
      r(48 - w, y, w * 2, 1, y === 67 ? E : B);
      r(48 - w, y, 1, 1, L); r(47 + w, y, 1, 1, D);
    }
    r(46, 0, 4, 3, D); r(45, 3, 6, 4, B);
    r(43, 7, 10, 61, B); r(43, 7, 1, 60, L); r(44, 7, 3, 60, A); r(52, 8, 1, 60, E);
    r(44, 9, 8, 6, '#22384a'); r(44, 9, 2, 1, '#c4ecf8'); r(45, 10, 1, 2, '#c4ecf8');
    r(44, 15, 8, 1, D); r(44, 24, 8, 1, D);
    r(45, 38, 6, 16, E); r(45, 38, 1, 16, D);
    r(45, 68, 6, 5, B); r(46, 73, 4, 3, D);
    r(47, 58, 3, 16, D); r(47, 58, 1, 16, L);
    // Four pylons carry four paired pods: every engine has its own intake and exhaust.
    for (const x of [15, 32, 64, 81]) r(x - 1, 28, 2, 11, D);
    for (const { x, y } of B52.engines) {
      r(x - 2, y - 8, 4, 16, B); r(x - 2, y - 8, 1, 15, L); r(x + 1, y - 7, 1, 15, E);
      r(x - 2, y - 9, 4, 2, K); r(x - 1, y - 8, 2, 1, D);
      r(x - 1, y + 8, 2, 2, '#2a2420'); r(x - 1, y + 9, 2, 1, '#c9772f');
    }
    for (const x of [5, 88]) {
      r(x, 29, 3, 3, '#2c3a5a'); r(x + 1, 30, 1, 1, '#e8e2cc');
    }
  });
}
// Larger than the A-10, but still a fixed startup atlas set with no runtime image creation.
function bakeB52() {
  const raw = b52Raw();
  for (let i = 0; i < JETC.N; i++) {
    const r = rotA(raw, i / JETC.N * TAU);
    B52.n.push(jetSpriteBounds(selOut(r)));
    B52.sh.push(jetSpriteBounds(tint(r, '#000', 1, 'source-in')));
  }
  for (const c of [...B52.n, ...B52.sh]) atl(c);
}
bakeB52();

function b52Payload(up) {
  const bombCount = clamp(Math.floor(up.b52Bombs ?? 8), 8, 16);
  return { len: B52C.length, bombCount, bombStep: B52C.length / (bombCount - 1), bombNext: 0, bombsDropped: 0,
    bombRadius: B52C.radius * (up.b52Blast ?? 1), bombDamage: B52C.damage,
    burnTime: up.fireBombs ? B52C.burnDuration : 0, burnDamage: B52C.burnDamage };
}
function b52Drop(j) {
  while (j.bombNext < j.bombCount) {
    const s = -j.len / 2 + j.bombNext * j.bombStep;
    if (j.s < s) break;
    const [x0, y0] = jetGround(j), x1 = j.px + j.ux * s, y1 = j.py + j.uy * s;
    STRAF.bombs.push({ source: 'b52', x0, y0, x1, y1, z0: j.alt, t: 0, T: B52C.fall,
      a: Math.atan2(j.ux, -j.uy), radius: j.bombRadius, dmg: j.bombDamage, burnTime: j.burnTime, burnDamage: j.burnDamage });
    const stats = STRAF.stats.b52;
    stats.dropped++;
    stats.lastDrop = { x: x1, y: y1, t: heliWeaponTime(), index: j.bombNext,
      radius: j.bombRadius, damage: j.bombDamage, burnTime: j.burnTime };
    j.bombNext++; j.bombsDropped++; j.fired = true;
  }
  j.dropped = j.bombNext === j.bombCount;
}
// The bomb marks use the release/landing centres and the snapshotted blast-radius lane width.
function drawBombLane(x, y, ux, uy, count = 8, blastMultiplier = 1) {
  const n = clamp(Math.floor(count), 8, 16), L = B52C.length / 2, nx = -uy, ny = ux;
  const R = B52C.radius * blastMultiplier, hw = R * Math.hypot(nx, ny * FORE);
  ctx.globalAlpha = B52C.previewAlpha;
  ctx.fillStyle = '#ff9a3a';
  ctx.beginPath();
  ctx.moveTo(x - ux * L + nx * hw, y - uy * L + ny * hw);
  ctx.lineTo(x + ux * L + nx * hw, y + uy * L + ny * hw);
  ctx.lineTo(x + ux * L - nx * hw, y + uy * L - ny * hw);
  ctx.lineTo(x - ux * L - nx * hw, y - uy * L - ny * hw);
  ctx.fill();
  ctx.globalAlpha = Math.floor(realT * 6) % 2 ? 0.9 : 0.6;
  for (let i = 0; i < n; i++) {
    const s = -L + i * B52C.length / (n - 1), px = x + ux * s, py = y + uy * s;
    pell(px, py, R, R * FORE, '#ffb347');
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 4);
  }
  ctx.globalAlpha = 1;
}
