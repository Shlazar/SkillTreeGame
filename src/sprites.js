/* The dead: hand-drawn pixel sprites (13 x 17, facing right, feet at the bottom middle) drawn as
 * billboards that stand on whole art pixels. Falls, tumbles and bodies are made from the standing
 * frame by pixel rotation, so every pose keeps the same pixels. The atlas holds a code per pixel
 * (hair, skin, shirt...) and a normal; each zombie brings its own skin, shirt and trousers, and the
 * shader colours, lights and heats the codes. */

const ZTOP = [
  '.....hHh.....',
  '....hSSSs....',
  '....SSSeS....',
  '....kSSSs....',
  '.....bWs.....',
  '.....ks......',
  '...qcCCCSSSs.',
  '..qcCsBCCssSS',
  '..qcCCCBCc...',
  '..qcBCsCCc...',
  '...qcCCCc....',
];
const ZLEGS = {
  stand: ['...pPPPPp....', '...pPp.PP....', '...pP..pP....', '...pP..pP....', '...pP..pP....', '...FF..FF....'],
  a: ['...pPPPPp....', '..pPp..PP....', '..pP....PP...', '.pP.....pP...', '.pP......pP..', '.FF......FF..'],
  b: ['...pPPPPp....', '....pPPp.....', '....pPP......', '....pPp......', '....pPp......', '....FFF......'],
  c: ['...pPPPPp....', '..PPp..pP....', '..PP....pP...', '.PP.....pP...', '.Pp......pP..', '.FF......FF..'],
};
// codes: H h hair, S s k skin, W bone, C c q shirt, P p trousers, B blood, b gore, F boot, e eye; 15 outline
const ZCHARS = 'HhSskWCcqPpBbFe';
const EMPTY13 = '.............';
function zFrame(legs, bob) {
  const top = bob ? [EMPTY13].concat(ZTOP.slice(0, ZTOP.length - 1)) : ZTOP;
  return top.concat(legs);
}
// rotate a frame about its feet (nearest pixel) into a 23x23 frame whose feet sit at (11, 21)
function rotFrame(rows, ang) {
  const w = rows[0].length, h = rows.length, px = (w - 1) / 2, py = h - 1, S = 23, out = [];
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let y = 0; y < S; y++) {
    let row = '';
    for (let x = 0; x < S; x++) {
      const dx = x - 11, dy = y - 21;
      const ix = Math.round(c * dx + s * dy + px), iy = Math.round(-s * dx + c * dy + py);
      row += ix >= 0 && iy >= 0 && ix < w && iy < h ? rows[iy][ix] : '.';
    }
    out.push(row);
  }
  return out;
}
function trim(rows) {
  let t = 0, b = rows.length - 1, l = rows[0].length, r = -1;
  while (t < b && !/[^.]/.test(rows[t])) t++;
  while (b > t && !/[^.]/.test(rows[b])) b--;
  for (let y = t; y <= b; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] !== '.') { l = Math.min(l, x); r = Math.max(r, x); }
  return rows.slice(t, b + 1).map((row) => row.slice(l, r + 1));
}
// a body lying flat: on its back, then squashed to the 2:1 ground
function lying(rows) {
  const flat = trim(rotFrame(rows, -Math.PI / 2)), out = [];
  for (let y = flat.length - 1; y >= 0; y -= 2) out.unshift(flat[y]);
  return out;
}
// Scale3x, then the centre pixel of every 2x2 block: a sprite 1.5x bigger without blurring
function scale15(rows) {
  const w = rows[0].length, h = rows.length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  const big = [];
  for (let y = 0; y < h * 3; y++) big.push(new Array(w * 3).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), Ee = at(x, y), F = at(x + 1, y);
    const G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1), e = [Ee, Ee, Ee, Ee, Ee, Ee, Ee, Ee, Ee];
    if (B !== Hh && D !== F) {
      e[0] = D === B ? D : Ee;
      e[1] = (D === B && Ee !== C) || (B === F && Ee !== A) ? B : Ee;
      e[2] = B === F ? F : Ee;
      e[3] = (D === B && Ee !== G) || (D === Hh && Ee !== A) ? D : Ee;
      e[5] = (B === F && Ee !== I) || (Hh === F && Ee !== C) ? F : Ee;
      e[6] = D === Hh ? D : Ee;
      e[7] = (D === Hh && Ee !== I) || (Hh === F && Ee !== G) ? Hh : Ee;
      e[8] = Hh === F ? F : Ee;
    }
    for (let k = 0; k < 9; k++) big[y * 3 + ((k / 3) | 0)][x * 3 + (k % 3)] = e[k];
  }
  const out = [];
  for (let y = 0; y < Math.ceil(h * 1.5); y++) {
    let row = '';
    for (let x = 0; x < Math.ceil(w * 1.5); x++) {
      const p = (i, j) => (big[y * 2 + j] || [])[x * 2 + i] || '.';
      let c = p(1, 1);
      if (c !== 'e') for (const [i, j] of [[0, 0], [1, 0], [0, 1]]) if (p(i, j) === 'e') { c = 'e'; break; }
      row += c;
    }
    out.push(row);
  }
  return out;
}

/* ----------------------------------------------------------------- atlas
 * Frames: per set, walk 0-3, stand 4, die 5-7, tumble 8-15, corpse 16-17. Each frame gets a
 * one-pixel outline. Texture rows run from the bottom, so a frame rect is (x, y, w, h) upwards. */
const ATLAS_W = 512, ATLAS_H = 256;
const ZF = { walk: 0, stand: 4, die: 5, tumble: 8, corpse: 16, n: 18 };
const atlasData = new Uint8Array(ATLAS_W * ATLAS_H * 4);
const frameData = new Float32Array(64 * 2 * 4);
let frameCount = 0;
function addFrame(rows, ax, ay, flat) {
  const code = (ch) => ZCHARS.indexOf(ch);
  const w = rows[0].length + 2, h = rows.length + 2;
  if (addFrame.x + w > ATLAS_W) { addFrame.x = 0; addFrame.y += addFrame.rowH; addFrame.rowH = 0; }
  const X = addFrame.x, Y = addFrame.y;
  addFrame.x += w + 1; addFrame.rowH = Math.max(addFrame.rowH, h + 1);
  const on = (r, k) => r >= 0 && r < rows.length && k >= 0 && k < rows[0].length && rows[r][k] !== '.';
  for (let r = -1; r <= rows.length; r++) {
    // the row's extent, for a rounded normal across the body
    let l = 99, rr = -1;
    for (let k = 0; k < rows[0].length; k++) if (on(r, k)) { l = Math.min(l, k); rr = Math.max(rr, k); }
    for (let k = -1; k <= rows[0].length; k++) {
      const tx = X + k + 1, ty = Y + (rows.length - r);       // flip rows: texture y runs up
      const o = (ty * ATLAS_W + tx) * 4;
      if (on(r, k)) {
        const span = Math.max(1, rr - l + 1);
        let nx = clamp(((k - l + 0.5) / span - 0.5) * 1.5, -0.8, 0.8);
        let ny = !on(r - 1, k) ? 0.55 : !on(r + 1, k) ? -0.35 : 0.05;
        if (flat) { nx *= 0.5; ny = ny * 0.3 + 0.6; }
        atlasData[o] = code(rows[r][k]); atlasData[o + 1] = Math.round((nx * 0.5 + 0.5) * 255); atlasData[o + 2] = Math.round((ny * 0.5 + 0.5) * 255); atlasData[o + 3] = 255;
      } else if (on(r - 1, k) || on(r + 1, k) || on(r, k - 1) || on(r, k + 1)) {
        atlasData[o] = 15; atlasData[o + 1] = 128; atlasData[o + 2] = flat ? 200 : 140; atlasData[o + 3] = 255;
      }
    }
  }
  const f = frameCount++;
  frameData.set([X, Y, w, h], f * 4);
  frameData.set([ax + 1, ay + 1, flat ? 1 : 0, 0], (64 + f) * 4);
  return f;
}
addFrame.x = 0; addFrame.y = 0; addFrame.rowH = 0;
function buildSet(big) {
  const f = big ? scale15 : (r) => r, k = big ? 1.5 : 1, base = zFrame(ZLEGS.stand, false);
  const feet = (rows) => [Math.floor(rows[0].length / 2), 0];
  const first = frameCount;
  for (const fr of [zFrame(ZLEGS.a, true), zFrame(ZLEGS.b, false), zFrame(ZLEGS.c, true), zFrame(ZLEGS.b, false), base]) { const r = f(fr); addFrame(r, ...feet(r), false); }
  for (const a of [-0.5, -1.0, -1.38]) { const r = f(rotFrame(base, a)); addFrame(r, Math.round(11 * k), Math.round(1 * k), false); }
  for (let j = 0; j < 8; j++) { const r = f(trim(rotFrame(base, j * TAU / 8))); addFrame(r, Math.floor(r[0].length / 2), Math.floor(r.length / 2), false); }
  for (const fr of [lying(base), lying(zFrame(ZLEGS.a, false))]) { const r = big ? scale15(fr) : fr; addFrame(r, Math.floor(r[0].length / 2), Math.floor(r.length / 2), true); }
  return first;
}
const ZSET = [buildSet(false), buildSet(true)];
const atlasTex = new THREE.DataTexture(atlasData, ATLAS_W, ATLAS_H, THREE.RGBAFormat);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.needsUpdate = true;
const frameTex = new THREE.DataTexture(frameData, 64, 2, THREE.RGBAFormat, THREE.FloatType);
frameTex.magFilter = THREE.NearestFilter; frameTex.minFilter = THREE.NearestFilter; frameTex.needsUpdate = true;

// pale, sickly skin and bright clothes, so the dead stand out from the ground
const SKINS = ['#bfe0a0', '#e2dcb8', '#b7c9b4', '#d6c49e'].map(hexRGB);
const SHIRTS = ['#4f7fd0', '#d04a3c', '#ece6d2', '#6fae4c', '#e8b83c', '#a46ad0'].map(hexRGB);
const PANTS = ['#4c5a86', '#7a5a3e', '#6a6e62'].map(hexRGB);
const glslList = (name, list) => `vec3 ${name}(float i) {` + list.map((c, k) => `${k < list.length - 1 ? `if (i < ${k}.5) ` : ''}return vec3(${c.map((v) => v.toFixed(3)).join(', ')});`).join(' ') + '}';

/* --------------------------------------------------------------- drawing */
const ZMAXI = 4600;
const zGeo = new THREE.InstancedBufferGeometry();
zGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
zGeo.setIndex([0, 1, 2, 0, 2, 3]);
const ZA = new THREE.InstancedBufferAttribute(new Float32Array(ZMAXI * 4), 4), ZB = new THREE.InstancedBufferAttribute(new Float32Array(ZMAXI * 4), 4), ZC = new THREE.InstancedBufferAttribute(new Float32Array(ZMAXI * 4), 4);
for (const a of [ZA, ZB, ZC]) { a.setUsage(THREE.DynamicDrawUsage); }
zGeo.setAttribute('zA', ZA); zGeo.setAttribute('zB', ZB); zGeo.setAttribute('zC', ZC);
zGeo.instanceCount = 0;
const zombieMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({ tAtlas: { value: atlasTex }, tFrames: { value: frameTex } }, U),
  vertexShader: GLSL_BILL + `
    attribute vec4 zA;      // feet x, y, z; frame
    attribute vec4 zB;      // flip, flat, fade, flash
    attribute vec4 zC;      // skin, shirt, trousers, heat
    uniform sampler2D tFrames;
    varying vec2 vUv; varying vec4 vB, vC; varying vec3 vW;
    void main() {
      int f = int(zA.w + 0.5);
      vec4 rect = texelFetch(tFrames, ivec2(f, 0), 0), anc = texelFetch(tFrames, ivec2(f, 1), 0);
      vec2 corner = position.xy;
      bool flip = zB.x > 0.5;
      vec2 anchor = vec2(flip ? rect.z - anc.x : anc.x, anc.y);
      vec3 P = billboard(zA.xyz, rect.zw, anchor, corner, zB.y);
      #ifdef XRAY
        P += uCV * 0.7;          // only something well in front (a tree, a car) counts as hiding it
      #endif
      vUv = (rect.xy + vec2(flip ? 1.0 - corner.x : corner.x, corner.y) * rect.zw) / vec2(${ATLAS_W}.0, ${ATLAS_H}.0);
      vB = zB; vC = zC; vW = P;
      gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
      if (uPass == 2 && zB.y > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);    // bodies on the ground cast no shadow
    }`,
  fragmentShader: GLSL_GB + `
    uniform sampler2D tAtlas;
    varying vec2 vUv; varying vec4 vB, vC; varying vec3 vW;
    ${glslList('skinC', SKINS)}
    ${glslList('shirtC', SHIRTS)}
    ${glslList('pantsC', PANTS)}
    void main() {
      vec4 a = texture2D(tAtlas, vUv);
      if (a.a < 0.5) discard;
      if (vB.z < 0.999 && bayer4(gl_FragCoord.xy) > vB.z) discard;
      float code = floor(a.r * 255.0 + 0.5);
      vec2 nv = a.gb * 2.0 - 1.0;
      if (vB.x > 0.5) nv.x = -nv.x;
      vec3 n = vB.y > 0.5 ? normalize(vec3(0.0, 1.0, 0.0) + uCR * nv.x * 0.6) : normalize(uCR * nv.x + uCU * nv.y + uCV * sqrt(max(0.05, 1.0 - dot(nv, nv))));
      vec3 skin = skinC(vC.x), shirt = shirtC(vC.y), pants = pantsC(vC.z), col;
      float cls = vB.y > 0.5 ? 210.0 : 230.0, hk = 1.0;           // the living get the gunship's light
      if (code < 0.5) { col = P_hair * 1.2; hk = 0.85; }
      else if (code < 1.5) { col = P_hair; hk = 0.85; }
      else if (code < 2.5) col = skin;
      else if (code < 3.5) col = skin * 0.86;
      else if (code < 4.5) col = skin * 0.62;
      else if (code < 5.5) { col = P_bone; hk = 0.8; }
      else if (code < 6.5) { col = shirt; hk = 0.82; }
      else if (code < 7.5) { col = shirt * 0.8; hk = 0.82; }
      else if (code < 8.5) { col = shirt * 0.62; hk = 0.8; }
      else if (code < 9.5) { col = pants; hk = 0.78; }
      else if (code < 10.5) { col = pants * 0.7; hk = 0.76; }
      else if (code < 11.5) { col = P_blood; hk = 0.95; }
      else if (code < 12.5) { col = P_gore; hk = 0.9; }
      else if (code < 13.5) { col = P_boot; hk = 0.55; }
      else if (code < 14.5) { col = vB.y > 0.5 ? P_gore : vec3(1.0, 0.48, 0.29); cls = vB.y > 0.5 ? 200.0 : 40.0; }   // the eye glows while it walks
      else { col = vec3(0.04, 0.05, 0.09); hk = 0.55; }
      if (vB.w > 0.0) { col = vec3(1.0, 0.97, 0.9); cls = 60.0; hk = 1.25; }                  // hit: a white flash
      gl_FragColor = gOut(col, cls, n, vW, vC.w * hk);
    }`,
});
const zombieMesh = new THREE.Mesh(zGeo, zombieMat);
zombieMesh.frustumCulled = false;
// the parts of the dead hidden behind trees or wrecks, drawn again as a dim glowing silhouette
const zombieXray = new THREE.Mesh(zGeo, new THREE.ShaderMaterial({
  uniforms: zombieMat.uniforms, depthFunc: THREE.GreaterDepth, depthWrite: false, defines: { XRAY: 1 },
  vertexShader: zombieMat.vertexShader,
  fragmentShader: GLSL_GB + `
    uniform sampler2D tAtlas;
    varying vec2 vUv; varying vec4 vB, vC; varying vec3 vW;
    void main() {
      vec4 a = texture2D(tAtlas, vUv);
      if (a.a < 0.5 || vB.y > 0.5) discard;
      bool rim = floor(a.r * 255.0 + 0.5) > 14.5;                   // the outline, and a light fill
      if (!rim && bayer4(gl_FragCoord.xy) > 0.25) discard;
      gl_FragColor = gOut(rim ? vec3(1.0, 0.62, 0.42) : vec3(1.0, 0.85, 0.65), rim ? 18.0 : 10.0, uCV, vW, vC.w * 0.85);
    }`,
}));
zombieXray.frustumCulled = false;
// drawn after the scenery and before the other zombies, so only scenery (not the crowd) hides anyone
zombieXray.renderOrder = 8; zombieMesh.renderOrder = 9;

// one sprite: world feet (x, y, z), frame in the set, flip, flat, fade, flash, colours, heat
let zN = 0;
function zPut(x, y, z, frame, flip, flat, fade, flash, skin, shirt, pants, heat) {
  if (zN >= ZMAXI) return;
  const i = zN * 4, a = ZA.array, b = ZB.array, c = ZC.array;
  a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = frame;
  b[i] = flip ? 1 : 0; b[i + 1] = flat ? 1 : 0; b[i + 2] = fade; b[i + 3] = flash;
  c[i] = skin; c[i + 1] = shirt; c[i + 2] = pants; c[i + 3] = heat;
  zN++;
}
// which way a sprite faces: right on screen when it moves right
const facesRight = (vx, vz) => vx * CR.x + vz * CR.z >= 0;
// the bodies on the ground, newest kept
const CORPSES = [];
const CORPSE_MAX = 2400;
function addCorpse(z, now) {
  CORPSES.push({ x: z.x, z: z.z, big: z.big, frame: Math.floor(z.seed * 2), flip: z.seed > 0.5, skin: z.skin, shirt: z.shirt, pants: z.pants, heat: z.heat, t: now });
  if (CORPSES.length > CORPSE_MAX) CORPSES.shift();
}
function clearCorpses() { CORPSES.length = 0; }
// every zombie, falling body, thrown body and corpse, written for this frame
function writeZombies(live, dying, now) {
  zN = 0;
  for (const c of CORPSES) {
    const cool = smoothstep(0, 80, now - c.t);
    zPut(c.x, 0.02, c.z, ZSET[c.big ? 1 : 0] + ZF.corpse + c.frame, c.flip, true, 1, 0, c.skin, c.shirt, c.pants, lerp(c.heat, 0.36, cool));
  }
  for (const z of live) {
    const set = ZSET[z.big ? 1 : 0], frame = set + ((z.vis || 1) < 0.25 ? ZF.stand : ZF.walk + (Math.floor(z.phase / (Math.PI / 2)) & 3));
    zPut(z.x, 0, z.z, frame, !z.right, false, 1, z.flash > 0 ? 1 : 0, z.skin, z.shirt, z.pants, z.heat);
  }
  for (const z of dying) {
    const set = ZSET[z.big ? 1 : 0];
    if (z.mode === 'fall') zPut(z.x, 0, z.z, set + ZF.die + Math.min(2, Math.floor(z.t / 0.12)), !z.right, false, 1, z.flash > 0 ? 1 : 0, z.skin, z.shirt, z.pants, z.heat);
    else zPut(z.x, z.y, z.z, set + ZF.tumble + (Math.floor(z.t * 14 + z.seed * 8) & 7), !z.right, false, 1, z.flash > 0 ? 1 : 0, z.skin, z.shirt, z.pants, z.heat);
  }
  zGeo.instanceCount = zN;
  ZA.needsUpdate = true; ZB.needsUpdate = true; ZC.needsUpdate = true;
}
function initZombies() { R3.scene.add(zombieMesh, zombieXray); }
