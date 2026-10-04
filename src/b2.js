// b2.js - a flying wing and one huge, train-safe blast. The finale gift enables its slot later.
// Hooks: b2Payload/b2Drop/b2Impact (planes), drawB2Circle (aim), planeArt (normal/shadow/thermal).
const B2C = {
  // Ground radius, fall seconds, largest core radius/cap/time, ring ratio/times, preview opacity (proposal)
  radius: 65, fall: 0.7, coreRadius: 44, coreCap: 20, coreTime: 1.1,
  outerRing: 1.5, ringTime: 0.35, dustTime: 0.7, previewAlpha: 0.1,
  // Huge-blast shake, hit-stop seconds, and thermal body brightness (proposal)
  shake: 0.9, stop: 0.08, heat: 150
};
const B2 = { n: [], sh: [], hot: [] };
function b2Raw() {
  return pix(110, 58, (r) => {
    const edge = [[55, 0], [109, 39], [78, 52], [70, 44], [55, 55], [40, 44], [32, 52], [0, 39]];
    // Scan whole-pixel rows of the flying wing; its angular rear edge has no tail or fins.
    for (let y = 0; y <= 55; y++) {
      const xs = [];
      for (let i = 0; i < edge.length; i++) {
        const [ax, ay] = edge[i], [bx, by] = edge[(i + 1) % edge.length];
        if (y >= Math.min(ay, by) && y < Math.max(ay, by)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length; i += 2) {
        const l = Math.ceil(xs[i]), h = Math.floor(xs[i + 1]);
        if (h < l) continue;
        r(l, y, h - l + 1, 1, '#454b53');
        if (l < 55) r(l, y, Math.min(h + 1, 55) - l, 1, '#636b74');
        r(l, y, 1, 1, '#848d96'); r(h, y, 1, 1, '#18191c');
      }
    }
    // Subtle panel seams and a small canopy keep the silhouette broad and uninterrupted.
    for (let y = 18; y < 39; y++) {
      const d = Math.floor((y - 12) * 1.1);
      r(54 - d, y, 1, 1, '#454b53'); r(55 + d, y, 1, 1, '#2b2e35');
    }
    r(51, 11, 8, 4, '#22384a'); r(52, 11, 2, 1, '#c4ecf8');
    r(52, 16, 6, 14, '#636b74'); r(54, 17, 1, 11, '#848d96');
    for (const x of [36, 44, 62, 70]) {
      r(x, 36, 4, 7, '#2b2e35'); r(x, 36, 4, 1, '#848d96');
      r(x + 1, 42, 2, 1, '#c9772f');
    }
  });
}
// Every picture is made before warmAtlas. Thermal view uses its own baked bright body.
function bakeB2() {
  const raw = b2Raw();
  for (let i = 0; i < JETC.N; i++) {
    const r = rotA(raw, i / JETC.N * TAU);
    B2.n.push(jetSpriteBounds(selOut(rimLight(r, '#e8e2cc', 0.2))));
    B2.sh.push(jetSpriteBounds(tint(r, '#000', 1, 'source-in')));
    B2.hot.push(jetSpriteBounds(outline(hotSpr(r, B2C.heat), '#161616')));
  }
  for (const c of [...B2.n, ...B2.sh, ...B2.hot]) atl(c);
}
bakeB2();

function b2Payload() {
  return { len: JETC.len, bombCount: 1, bombsDropped: 0, bombRadius: B2C.radius, bombDamage: null };
}
function b2Drop(j) {
  if (j.dropped || j.s < 0) return;
  const [x0, y0] = jetGround(j);
  STRAF.bombs.push({ source: 'b2', x0, y0, x1: j.px, y1: j.py, z0: j.alt, t: 0, T: B2C.fall,
    a: Math.atan2(j.ux, -j.uy), radius: j.bombRadius, dmg: null, burnTime: 0, burnDamage: 0 });
  j.dropped = j.fired = true; j.bombsDropped = 1;
  const stats = STRAF.stats.b2;
  stats.dropped++;
  stats.lastDrop = { x: j.px, y: j.py, t: heliWeaponTime(), radius: j.bombRadius };
}
function b2Impact(x, y, payload) {
  // boomFx supplies the huge-blast recipe without any of explode's train/survivor damage.
  boomFx(x, y, true);
  addBoom(x, y - 2, B2C.coreRadius, 8, B2C.coreTime, B2C.coreCap);
  const core = booms[booms.length - 1];
  core.source = 'b2';
  rings.push({ source: 'b2', x, y, r0: 8, r1: payload.radius, t: 0, T: B2C.ringTime, c: '#fff1c2', w: 2 });
  const outerRing = payload.radius * B2C.outerRing;
  rings.push({ source: 'b2', x, y, r0: 20, r1: outerRing, t: 0, T: B2C.dustTime, c: '#a89878' });
  let killed = 0;
  queryEll(x, y, payload.radius, (z, d) => {
    if (z.gone || z.gate && z.still) return;
    killed++; kill(z, 'he', x, y, d);
  });
  const stats = STRAF.stats.b2;
  stats.impacts++; stats.kills += killed;
  stats.lastImpact = { x, y, t: heliWeaponTime(), radius: payload.radius, kills: killed, coreRadius: core.r, outerRing };
  if (!G.demo) { addShake(B2C.shake); hitStop(B2C.stop, 0.25); SFX.b2Boom(); }
}
// Circle means a ground ellipse in this view. Whole-pixel rows keep the preview sharp.
function drawB2Circle(x, y, radius = B2C.radius) {
  const R = Math.round(radius), RY = Math.round(radius * FORE), px = Math.round(x), py = Math.round(y);
  ctx.globalAlpha = B2C.previewAlpha; ctx.fillStyle = '#e2552f';
  for (let dy = -RY; dy <= RY; dy++) {
    const w = Math.floor(R * Math.sqrt(Math.max(0, 1 - dy * dy / (RY * RY))));
    ctx.fillRect(px - w, py + dy, w * 2 + 1, 1);
  }
  ctx.globalAlpha = Math.floor(realT * 6) % 2 ? 0.9 : 0.6;
  pell(px, py, R, RY, '#ffb347');
  ctx.fillStyle = '#fff1c2'; ctx.fillRect(px - 2, py, 5, 1); ctx.fillRect(px, py - 2, 1, 5);
  ctx.globalAlpha = 1;
}
