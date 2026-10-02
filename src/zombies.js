/* The dead: one jointed body (hips, torso, head, two-part arms and legs with feet), drawn with
 * instancing and posed in the vertex shader from a phase and a mode per instance.
 * Modes: 1 shamble, 2 sprint, 3 falling, 4 thrown and flailing, 5 lying dead (cooling). */

function zombieGeometry() {
  const parts = [];
  // [w, h, d, centre x, y, z, part, pivot A (parent joint), pivot B (own joint), heat]
  const add = (w, h, d, x, y, z, part, pa, pb, heat) => parts.push({ w, h, d, x, y, z, part, pa: pa || [0, 0, 0], pb: pb || [0, 0, 0], heat });
  add(0.34, 0.2, 0.2, 0, 0.97, 0, 0, null, null, 0.78);                        // hips
  add(0.42, 0.5, 0.24, 0, 1.31, 0, 1, null, null, 0.82);                       // torso
  add(0.21, 0.25, 0.23, 0, 1.72, 0.03, 2, null, null, 1.0);                    // head
  add(0.08, 0.06, 0.1, 0, 1.585, 0.0, 2, null, null, 0.96);                    // neck
  for (const s of [-1, 1]) {
    const L = s < 0, sx = 0.27 * s, ua = L ? 3 : 5, fa = L ? 4 : 6, th = L ? 7 : 9, sh = L ? 8 : 10, hx = 0.1 * s;
    add(0.11, 0.32, 0.12, sx, 1.36, 0, ua, [sx, 1.52, 0], null, 0.84);         // upper arm
    add(0.1, 0.3, 0.1, sx, 1.06, 0, fa, [sx, 1.52, 0], [sx, 1.2, 0], 0.92);     // forearm
    add(0.09, 0.1, 0.07, sx, 0.86, 0.01, fa, [sx, 1.52, 0], [sx, 1.2, 0], 0.95); // hand
    add(0.15, 0.44, 0.16, hx, 0.71, 0, th, [hx, 0.92, 0], null, 0.78);          // thigh
    add(0.13, 0.43, 0.14, hx, 0.285, 0, sh, [hx, 0.92, 0], [hx, 0.5, 0], 0.76);  // shin
    add(0.12, 0.07, 0.25, hx, 0.035, 0.05, sh, [hx, 0.92, 0], [hx, 0.5, 0], 0.6); // foot
  }
  const pos = [], nor = [], part = [], pa = [], pb = [], heat = [];
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.w, p.h, p.d).translate(p.x, p.y, p.z).toNonIndexed();
    const P = g.attributes.position, Nn = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i));
      part.push(p.part); pa.push(...p.pa); pb.push(...p.pb); heat.push(p.heat);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aPA', new THREE.Float32BufferAttribute(pa, 3));
  g.setAttribute('aPB', new THREE.Float32BufferAttribute(pb, 3));
  g.setAttribute('aHeat', new THREE.Float32BufferAttribute(heat, 1));
  return g;
}
const ZOMBIE_VERT = `
  uniform float uTime;
  attribute float aPart, aHeat;
  attribute vec3 aPA, aPB;
  attribute vec4 iData;    // phase, mode, heat, seed
  attribute vec4 iData2;   // time of death, hit flash, limp, -
  varying float vHeat; varying vec3 vN, vW;
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  void main() {
    vec3 p = position, n = normal;
    float ph = iData.x, mode = iData.y, seed = iData.w;
    bool left = aPart == 3.0 || aPart == 4.0 || aPart == 7.0 || aPart == 8.0;
    float sgn = left ? -1.0 : 1.0, off = left ? 0.0 : 3.14159;
    float sh = 0.0, shZ = 0.0, el = 0.0, hip = 0.0, kn = 0.0, lean = 0.0, side = 0.0, tilt = (fract(seed * 13.0) - 0.5) * 0.7;
    if (mode < 1.5) {                       // the shamble: arms out in front, one leg dragging
      float s = sin(ph + off), limp = left ? 1.0 : 1.0 - iData2.z * 0.6;
      hip = -s * 0.48 * limp; kn = 0.12 + max(0.0, sin(ph + off + 1.4)) * 0.7 * limp;
      sh = -1.3 + s * 0.14 + (fract(seed * 7.0) - 0.5) * 0.5; shZ = 0.08; el = -0.25;
      lean = 0.24 + sin(ph * 2.0) * 0.03; side = sin(ph) * 0.06;
    } else if (mode < 2.5) {                // the sprint
      float s = sin(ph + off);
      hip = -s * 0.85; kn = 0.3 + max(0.0, sin(ph + off + 1.2)) * 1.35;
      sh = -0.6 + s * 0.95; el = -0.9; lean = 0.42; side = sin(ph) * 0.05; tilt *= 0.4;
    } else if (mode < 3.5) {                // going down
      sh = -0.5 - fract(seed * 5.0) * 0.8; shZ = 0.55; el = -0.3; hip = -0.25; kn = 0.35; lean = -0.15;
    } else if (mode < 4.5) {                // thrown through the air
      float t = uTime * 17.0 + seed * 40.0;
      sh = sin(t + aPart) * 1.7; shZ = 0.4 + cos(t * 0.7 + aPart) * 0.8; el = sin(t * 1.3) * 1.1;
      hip = sin(t * 0.9 + aPart * 1.7) * 1.1; kn = 0.6 + sin(t * 1.1) * 0.6; lean = sin(t * 0.5) * 0.4;
    } else {                                // sprawled where it fell
      float r = fract(seed * 7.13);
      sh = -2.5 + r * 0.9 - (left ? 0.0 : 0.6 * r); shZ = 0.45 + r * 0.7; el = -0.5 * r;
      hip = -0.15 - r * 0.35 * (left ? 1.0 : 0.3); kn = 0.2 + r * 0.6; side = (r - 0.5) * 0.3; tilt = (r - 0.5) * 1.4;
    }
    if (aPart >= 3.0 && aPart <= 6.0) {
      mat3 Rs = rotX(sh) * rotZ(shZ * sgn);
      if (aPart == 4.0 || aPart == 6.0) { mat3 Re = rotX(el); p = Re * (p - aPB) + aPB; n = Re * n; }
      p = Rs * (p - aPA) + aPA; n = Rs * n;
    }
    if (aPart >= 7.0) {
      mat3 Rh = rotX(hip);
      if (aPart == 8.0 || aPart == 10.0) { mat3 Rk = rotX(kn); p = Rk * (p - aPB) + aPB; n = Rk * n; }
      p = Rh * (p - aPA) + aPA; n = Rh * n;
    }
    if (aPart >= 1.0 && aPart <= 6.0) {
      if (aPart == 2.0) { mat3 Rt = rotZ(tilt) * rotX(0.2); p = Rt * (p - vec3(0.0, 1.57, 0.0)) + vec3(0.0, 1.57, 0.0); n = Rt * n; }
      mat3 Rl = rotX(lean) * rotZ(side);
      p = Rl * (p - vec3(0.0, 1.04, 0.0)) + vec3(0.0, 1.04, 0.0); n = Rl * n;
    }
    if (mode < 2.5) p.y += abs(cos(ph)) * (mode < 1.5 ? 0.035 : 0.08) - 0.03;
    float heat = iData.z * aHeat;
    if (mode > 4.5) heat = mix(iData.z * aHeat, 0.33 + aHeat * 0.04, smoothstep(0.0, 80.0, uTime - iData2.x));
    vHeat = heat + iData2.y * 0.8;
    mat4 m = modelMatrix * instanceMatrix;
    vec4 wp = m * vec4(p, 1.0);
    vW = wp.xyz; vN = normalize(mat3(m) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const ZOMBIE_FRAG = GLSL_NOISE + GLSL_OUT + `
  varying float vHeat; varying vec3 vN, vW;
  void main() {
    // a warm body seen edge-on reads cooler (emissivity falls at grazing angles)
    vec3 v = normalize(uCamPos - vW);
    float edge = 1.0 - abs(dot(normalize(vN), v));
    float h = vHeat * (1.0 - 0.22 * edge * edge) - max(vN.y, 0.0) * 0.02;
    gl_FragColor = heatOut(h, vW);
  }`;
const ZGEO = zombieGeometry();
const zombieMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: ZOMBIE_VERT, fragmentShader: ZOMBIE_FRAG });
function zombieMesh(max) {
  const g = ZGEO.clone();
  const d1 = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), d2 = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  d1.setUsage(THREE.DynamicDrawUsage); d2.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iData', d1); g.setAttribute('iData2', d2);
  const m = new THREE.InstancedMesh(g, zombieMat, max);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false; m.count = 0;
  return m;
}
const ZMAX = 1400, CMAX = 2400;
const liveMesh = zombieMesh(ZMAX), corpseMesh = zombieMesh(CMAX);
let corpseHead = 0, corpseTotal = 0, corpseDirty = false;
const ZM = new THREE.Matrix4(), ZQ = new THREE.Quaternion(), ZQ2 = new THREE.Quaternion(), ZV = new THREE.Vector3(), ZS = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

// write a standing (or walking) zombie: yaw and uniform scale only, straight into the buffer
function writeStanding(arr, i, x, y, z, yaw, s) {
  const c = Math.cos(yaw) * s, n = Math.sin(yaw) * s, o = i * 16;
  arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -n; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = n; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}
// a body lies where it fell; the ring buffer keeps the most recent ones
function addCorpse(z, q, x, y, zz, now) {
  const i = corpseHead;
  corpseHead = (corpseHead + 1) % CMAX; corpseTotal++;
  ZM.compose(ZV.set(x, y, zz), q, ZS.set(z.scale, z.scale, z.scale));
  ZM.toArray(corpseMesh.instanceMatrix.array, i * 16);
  const a = corpseMesh.geometry.attributes.iData.array, b = corpseMesh.geometry.attributes.iData2.array;
  a[i * 4] = 0; a[i * 4 + 1] = 5; a[i * 4 + 2] = z.heat; a[i * 4 + 3] = z.seed;
  b[i * 4] = now; b[i * 4 + 1] = 0; b[i * 4 + 2] = 0; b[i * 4 + 3] = 0;
  corpseMesh.count = Math.min(corpseTotal, CMAX);
  corpseDirty = true;
}
function clearCorpses() { corpseHead = 0; corpseTotal = 0; corpseMesh.count = 0; }
// write every live and dying zombie for this frame
function writeZombies(live, dying, now) {
  const arr = liveMesh.instanceMatrix.array, a = liveMesh.geometry.attributes.iData.array, b = liveMesh.geometry.attributes.iData2.array;
  let n = 0;
  for (const z of live) {
    if (n >= ZMAX) break;
    writeStanding(arr, n, z.x, 0, z.z, z.yaw, z.scale);
    a[n * 4] = z.phase; a[n * 4 + 1] = z.run ? 2 : 1; a[n * 4 + 2] = z.heat; a[n * 4 + 3] = z.seed;
    b[n * 4] = 0; b[n * 4 + 1] = Math.max(0, z.flash) * 6; b[n * 4 + 2] = z.limp; b[n * 4 + 3] = 0;
    n++;
  }
  for (const z of dying) {
    if (n >= ZMAX) break;
    if (z.mode === 'fall') {
      // tip over about the feet, backwards or forwards
      const k = Math.min(1, z.t / 0.6), e = k * k;
      ZQ.setFromAxisAngle(Y_AXIS, z.yaw); ZQ2.setFromAxisAngle(X_AXIS, -e * Math.PI / 2 * z.dir);
      ZQ.multiply(ZQ2);
      ZM.compose(ZV.set(z.x, e * 0.12 * z.scale, z.z), ZQ, ZS.set(z.scale, z.scale, z.scale));
    } else {
      // thrown: spinning about the body's middle
      ZV.set(0, -0.95 * z.scale, 0).applyQuaternion(z.q);
      ZM.compose(ZV.set(z.x + ZV.x, z.y + ZV.y, z.z + ZV.z), z.q, ZS.set(z.scale, z.scale, z.scale));
    }
    ZM.toArray(arr, n * 16);
    a[n * 4] = z.phase; a[n * 4 + 1] = z.mode === 'fall' ? 3 : 4; a[n * 4 + 2] = z.heat; a[n * 4 + 3] = z.seed;
    b[n * 4] = 0; b[n * 4 + 1] = Math.max(0, z.flash) * 6; b[n * 4 + 2] = 0; b[n * 4 + 3] = 0;
    n++;
  }
  liveMesh.count = n;
  liveMesh.instanceMatrix.needsUpdate = true;
  liveMesh.geometry.attributes.iData.needsUpdate = true;
  liveMesh.geometry.attributes.iData2.needsUpdate = true;
  if (corpseDirty) {
    corpseMesh.instanceMatrix.needsUpdate = true;
    corpseMesh.geometry.attributes.iData.needsUpdate = true;
    corpseMesh.geometry.attributes.iData2.needsUpdate = true;
    corpseDirty = false;
  }
  void now;
}
function initZombies() { R3.scene.add(liveMesh, corpseMesh); }
