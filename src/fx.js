/* Effects, drawn into the G-buffer like everything else so the night lights them: fire and sparks
 * glow, smoke is a dithered cloud the moon and the flames light, earth and gore are chunks of pixels.
 * Marks on the ground (craters, scorches, blood) cool down over time. Tracers are drawn in screen
 * space: every round rises from the bottom of the picture, where the gunship is, to its target. */

/* -------------------------------------------------------------- particles
 * kind: 0 fire (glows), 1 smoke (lit, dithered), 2 chunk (lit), 3 spark (glowing streak), 4 dust */
class Particles {
  constructor(max) {
    this.max = max; this.next = 0;
    const F = (k) => new Float32Array(max * k);
    this.vel = F(3); this.life = F(1); this.maxLife = F(1); this.s0 = F(1); this.s1 = F(1); this.h0 = F(1); this.h1 = F(1);
    this.a0 = F(1); this.grav = F(1); this.drag = F(1); this.fadeIn = F(1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.A = new THREE.InstancedBufferAttribute(F(4), 4); this.B = new THREE.InstancedBufferAttribute(F(4), 4); this.C = new THREE.InstancedBufferAttribute(F(4), 4);
    for (const a of [this.A, this.B, this.C]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('pA', this.A); g.setAttribute('pB', this.B); g.setAttribute('pC', this.C);
    g.instanceCount = max;
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: `
        attribute vec4 pA;      // x, y, z, size (m)
        attribute vec4 pB;      // kind, heat (or temperature), alpha, seed
        attribute vec4 pC;      // velocity, colour
        uniform int uPass;
        uniform vec3 uCR, uCU, uCV, uLR, uLU, uT;
        uniform float uK;
        varying vec2 vQ; varying vec4 vB, vC; varying vec3 vW; varying float vR, vLen;
        void main() {
          vB = pB; vC = pC;
          vec3 R = uPass == 2 ? uLR : uCR, Up = uPass == 2 ? uLU : uCU;
          float rpx = max(0.5, pA.w * uK);                       // radius in art pixels
          vec3 A = pA.xyz;
          vec2 q = position.xy;
          vLen = 0.0;
          if (pB.x > 2.5 && pB.x < 3.5) {                        // a spark: a streak along its screen velocity
            vec2 sv = vec2(dot(pC.xyz, uCR), dot(pC.xyz, uCU)) * uK;
            float l = length(sv), len = clamp(l * 0.03, 1.0, 9.0);
            vec2 d = l > 0.01 ? sv / l : vec2(0.0, 1.0), sd = vec2(-d.y, d.x);
            vec2 o = d * (q.y * 0.5 + 0.5) * len * -1.0 + sd * q.x * 0.75;
            vQ = q; vLen = len;
            A += (R * o.x + Up * o.y) / uK;
          } else {
            rpx = max(rpx, 0.75);
            vQ = q * (rpx + 0.5);
            A += (R * vQ.x + Up * vQ.y) / uK;
          }
          vR = rpx; vW = pA.xyz;
          gl_Position = pB.z <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(A, 1.0);
          if (uPass == 2 && pB.x != 1.0 && pB.x != 4.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: GLSL_GB + `
        varying vec2 vQ; varying vec4 vB, vC; varying vec3 vW; varying float vR, vLen;
        vec3 flame(float T) {
          return T < 0.25 ? mix(vec3(0.25, 0.06, 0.04), vec3(0.75, 0.16, 0.06), T * 4.0)
            : T < 0.55 ? mix(vec3(0.75, 0.16, 0.06), vec3(1.0, 0.5, 0.12), (T - 0.25) / 0.3)
            : T < 0.85 ? mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.86, 0.4), (T - 0.55) / 0.3)
            : mix(vec3(1.0, 0.86, 0.4), vec3(1.0, 0.98, 0.9), (T - 0.85) / 0.15);
        }
        void main() {
          float kind = vB.x, a = vB.z, seed = vB.w;
          vec2 g = gpix();
          vec3 n = uCV, P = vW;
          if (kind > 2.5 && kind < 3.5) {                       // spark
            float T = clamp(vB.y, 0.0, 1.0);
            gl_FragColor = gOut(flame(0.55 + 0.45 * T), 50.0 + 70.0 * T, n, P + uCV * 2.0, 1.0 + T * 2.0);
            return;
          }
          float r = length(vQ) / (vR + 0.5);
          float lump = (vnoise(normalize(vQ + 1e-4) * 2.7 + seed * 13.0 + uTime * (kind < 0.5 ? 3.0 : 0.3)) - 0.5) * (kind < 0.5 ? 0.5 : 0.35);
          if (r > 1.0 + lump * step(2.5, vR)) discard;
          if (kind < 0.5) {                                     // fire: hotter in the core, flickering pixels at the rim
            float T = clamp(vB.y * (1.15 - r * 0.45), 0.0, 1.0);
            if (a < 0.999 && bayer4(g + seed * 7.0) > a) discard;
            gl_FragColor = gOut(flame(T), 30.0 + 97.0 * T, n, P + uCV * 1.0, 0.5 + vB.y * 2.6);
            return;
          }
          float z = sqrt(max(0.0, 1.0 - r * r));
          n = normalize(uCR * vQ.x / (vR + 0.5) + uCU * vQ.y / (vR + 0.5) + uCV * (z + 0.3));
          if (kind < 1.5 || kind > 3.5) {                       // smoke and dust: dithered, thinner at the rim
            float cover = a * (1.0 - r * r * 0.7) * (uThermal > 0.5 && kind < 1.5 ? 0.45 : 1.0);   // the camera sees through smoke
            if (bayer4(g + floor(seed * 4.0)) > cover) discard;
            vec3 col = kind < 1.5 ? mix(vec3(0.3, 0.29, 0.3), vec3(0.62, 0.6, 0.6), vC.w) : vC.w > 1.5 ? vec3(0.5, 0.07, 0.06) : vec3(0.55, 0.45, 0.34);
            col *= 0.85 + 0.3 * vnoise(vQ * 0.6 + seed * 5.0);
            gl_FragColor = gOut(col, 210.0, n, P + n * vR / uK * 0.5, vB.y);
            return;
          }
          vec3 col = vC.w < 0.5 ? P_dirt : vC.w < 1.5 ? P_gore : vC.w < 2.5 ? P_blood : vC.w < 3.5 ? P_soot : P_concrete;
          gl_FragColor = gOut(col, 200.0, n, P, vB.y);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }
  // o: { life, s0, s1, h0, h1, a, kind, grav, drag, fadeIn, col }
  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.next, A = this.A.array, B = this.B.array, C = this.C.array;
    this.next = (i + 1) % this.max;
    A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = z; A[i * 4 + 3] = o.s0;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    B[i * 4] = o.kind; B[i * 4 + 1] = o.h0; B[i * 4 + 2] = o.fadeIn ? 0.001 : o.a; B[i * 4 + 3] = Math.random();
    C[i * 4] = vx; C[i * 4 + 1] = vy; C[i * 4 + 2] = vz; C[i * 4 + 3] = o.col || 0;
    this.life[i] = o.life; this.maxLife[i] = o.life; this.s0[i] = o.s0; this.s1[i] = o.s1 === undefined ? o.s0 : o.s1;
    this.h0[i] = o.h0; this.h1[i] = o.h1 === undefined ? o.h0 : o.h1; this.a0[i] = o.a;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag || 0; this.fadeIn[i] = o.fadeIn || 0;
  }
  update(dt) {
    const A = this.A.array, B = this.B.array, C = this.C.array, V = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (B[i * 4 + 2] !== 0) B[i * 4 + 2] = 0; continue; }
      const l = (this.life[i] -= dt);
      if (l <= 0) { B[i * 4 + 2] = 0; continue; }
      const k = 1 - l / this.maxLife[i], i3 = i * 3, i4 = i * 4, dr = Math.exp(-this.drag[i] * dt);
      V[i3] *= dr; V[i3 + 1] = V[i3 + 1] * dr - this.grav[i] * dt; V[i3 + 2] *= dr;
      A[i4] += V[i3] * dt; A[i4 + 1] += V[i3 + 1] * dt; A[i4 + 2] += V[i3 + 2] * dt;
      if (A[i4 + 1] < 0.05 && V[i3 + 1] < 0) { A[i4 + 1] = 0.05; V[i3 + 1] *= -0.25; V[i3] *= 0.5; V[i3 + 2] *= 0.5; }
      C[i4] = V[i3]; C[i4 + 1] = V[i3 + 1]; C[i4 + 2] = V[i3 + 2];
      A[i4 + 3] = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - k) * (1 - k));
      B[i4 + 1] = this.h0[i] + (this.h1[i] - this.h0[i]) * k;
      const fi = this.fadeIn[i] ? Math.min(1, k / this.fadeIn[i]) : 1;
      B[i4 + 2] = this.a0[i] * fi * (1 - k * k);
    }
    this.A.needsUpdate = true; this.B.needsUpdate = true; this.C.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}
const PART = new Particles(6000);
// fire temperatures run 0..1 (h0/h1); smoke and chunks carry heat for the thermal camera
const fire = (x, y, z, vx, vy, vz, o) => PART.spawn(x, y, z, vx, vy, vz, Object.assign({ kind: 0, a: 1 }, o));
const smoke = (x, y, z, vx, vy, vz, o) => PART.spawn(x, y, z, vx, vy, vz, Object.assign({ kind: 1, a: 0.85 }, o));
const chunk = (x, y, z, vx, vy, vz, o) => PART.spawn(x, y, z, vx, vy, vz, Object.assign({ kind: 2, a: 1 }, o));
const spark = (x, y, z, vx, vy, vz, o) => PART.spawn(x, y, z, vx, vy, vz, Object.assign({ kind: 3, a: 1, s0: 0.1 }, o));
const dust = (x, y, z, vx, vy, vz, o) => PART.spawn(x, y, z, vx, vy, vz, Object.assign({ kind: 4, a: 0.8 }, o));

/* ---------------------------------------------------------- ground marks
 * kind 0 crater, 1 scorch, 2 blood, 3 scuff, 4 blast ring (grows, then goes) */
const DEC_MAX = 2000;
const decGeo = new THREE.InstancedBufferGeometry();
decGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
decGeo.setIndex([0, 2, 1, 0, 3, 2]);
const DA = new THREE.InstancedBufferAttribute(new Float32Array(DEC_MAX * 4), 4), DB = new THREE.InstancedBufferAttribute(new Float32Array(DEC_MAX * 4), 4);
decGeo.setAttribute('dA', DA); decGeo.setAttribute('dB', DB);
decGeo.instanceCount = 0;
const decalMesh = new THREE.Mesh(decGeo, new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: `
    attribute vec4 dA, dB;             // x, z, size, angle | born, kind, heat, seed
    uniform int uPass;
    varying vec2 vUv; varying vec4 vB; varying vec3 vW;
    void main() {
      float c = cos(dA.w), s = sin(dA.w);
      vec2 q = vec2(c * position.x - s * position.z, s * position.x + c * position.z) * dA.z;
      vec4 wp = vec4(dA.x + q.x, 0.02 + dB.y * 0.004, dA.y + q.y, 1.0);
      vUv = position.xz; vB = dB; vW = wp.xyz;
      gl_Position = uPass == 2 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: GLSL_GB + `
    varying vec2 vUv; varying vec4 vB; varying vec3 vW;
    void main() {
      float r = length(vUv) * 2.0, ang = atan(vUv.y, vUv.x), age = uTime - vB.x, kind = vB.y, seed = vB.w * 53.0;
      vec2 g = gpix();
      float px = hash12(g * 0.913 + seed);
      vec3 col; float heat, cls = 200.0;
      if (kind < 0.5) {                               // crater: a dark pit, a rim of thrown earth, rays of ejecta, embers
        float edge = 0.62 + 0.14 * vnoise(vec2(ang * 3.0 + seed, seed));
        float rays = step(0.6, vnoise(vec2(ang * 9.0 + seed, 1.0))) * (1.0 - smoothstep(edge, 1.0, r));
        float pit = 1.0 - step(edge * 0.62, r), rim = step(edge * 0.5, r) * (1.0 - step(edge, r));
        if (r > edge && (rays < 0.5 || px > 0.55 + 0.4 * (1.0 - r))) discard;
        float cool = smoothstep(0.0, 25.0, age);
        col = pit > 0.5 ? (px < 0.3 ? P_soot : P_soilDk * 0.6) : rim > 0.5 ? (px < 0.4 ? P_soil : P_dirt) : (px < 0.5 ? P_soilDk : P_dirt);
        float life = 3.0 + 9.0 * hash12(g * 0.21 + seed);                // each ember dies on its own time
        float ember = step(0.955, hash12(g * 0.37 + seed)) * pit * step(age, life);
        heat = mix(vB.z * (0.42 + 0.18 * pit), 0.27 + 0.12 * rim, cool);
        if (ember > 0.5) {
          float fl = hash12(g + floor(uTime * 6.0 + seed * 9.0)), k = 1.0 - age / life;
          col = mix(vec3(0.75, 0.16, 0.05), vec3(1.0, 0.62, 0.2), fl * k); cls = 20.0 + 60.0 * k * (0.6 + 0.4 * fl); heat += 0.9 * k;
        }
      } else if (kind < 1.5) {                        // scorch from a 25mm round
        float edge = 0.55 + 0.3 * vnoise(vec2(ang * 2.0 + seed, seed));
        if (r > edge || px > 1.1 - r * 0.6) discard;
        col = px < 0.5 ? P_soot : P_ash; heat = mix(vB.z, 0.31, smoothstep(0.0, 5.0, age));
      } else if (kind < 2.5) {                        // blood: a splat and drops
        float edge = 0.38 + 0.4 * vnoise(vec2(ang * 1.7 + seed, seed));
        bool drop = hash12(floor(vUv * 9.0 + seed)) > 0.86 && r < 1.0;
        if (r > edge && !drop) discard;
        col = px < 0.35 ? P_gore : P_blood; heat = mix(vB.z, 0.32, smoothstep(0.0, 40.0, age));
        if (age > 150.0 && px < smoothstep(150.0, 180.0, age)) discard;
      } else if (kind < 3.5) {                        // scuffed earth
        if (r > 0.8 || px > 0.6) discard;
        col = P_dirt; heat = 0.33;
      } else {                                        // a blast ring of dust racing out
        float u = clamp(age / 0.5, 0.0, 1.0), R = 1.0 - (1.0 - u) * (1.0 - u) * (1.0 - u);
        if (u >= 1.0 || abs(r - R) > 0.06 + 0.04 * (1.0 - u) || px > 0.85 - u * 0.5) discard;
        col = mix(vec3(0.7, 0.62, 0.5), vec3(1.0, 0.8, 0.5), 1.0 - u); cls = 30.0 * (1.0 - u) + 1.0; heat = vB.z * (1.0 - u);
      }
      gl_FragColor = gOut(col, cls, vec3(0.0, 1.0, 0.0), vW, heat);
    }`,
}));
decalMesh.frustumCulled = false;
let decHead = 0, decTotal = 0, decDirty = false;
function addDecal(kind, x, z, size, heat, now) {
  const i = decHead, a = DA.array, b = DB.array;
  decHead = (decHead + 1) % DEC_MAX; decTotal++;
  a[i * 4] = x; a[i * 4 + 1] = z; a[i * 4 + 2] = size; a[i * 4 + 3] = Math.random() * TAU;
  b[i * 4] = now; b[i * 4 + 1] = kind; b[i * 4 + 2] = heat; b[i * 4 + 3] = Math.random();
  decGeo.instanceCount = Math.min(decTotal, DEC_MAX);
  decDirty = true;
}
function clearDecals() { decHead = 0; decTotal = 0; decGeo.instanceCount = 0; }

/* ------------------------------------------------------- rounds in the air
 * A round fired from the gunship is seen from behind the gun: it starts below the bottom of the
 * picture and falls into the target, fast at first and slower as it shrinks into the distance. */
const TR_MAX = 400;
const trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR_MAX * 6 * 3), 3));
trGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(TR_MAX * 6 * 2), 2));
trGeo.setDrawRange(0, 0);
const tracerMesh = new THREE.Mesh(trGeo, new THREE.ShaderMaterial({
  uniforms: U, depthTest: false, depthWrite: false,
  vertexShader: `
    attribute vec2 aT;           // along the streak (0 tail, 1 head), heat
    uniform int uPass;
    varying vec2 vT;
    void main() { vT = aT; gl_Position = uPass == 2 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: GLSL_GB + `
    varying vec2 vT;
    void main() {
      float u = vT.x;
      vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.96, 0.8), u * u);
      if (bayer4(gpix()) > 0.25 + u * 1.2) discard;
      gl_FragColor = gOut(col, 40.0 + 87.0 * u, uCV, uT + uCV * 300.0, vT.y * (0.4 + 0.6 * u));
    }`,
}));
tracerMesh.frustumCulled = false; tracerMesh.renderOrder = 10;
const TP = [0, 0];
// where a round is on the screen (art pixels, y down): u is how far along its flight it is
function roundScreen(r, u, out) {
  toArt(r.b.x, 0, r.b.z, TP);
  const z0 = 16, D = 1250, g = (1 - u) * z0 / (z0 + u * (D - z0));
  out[0] = TP[0] + r.side * 0.035 * VIEW.H * 3.8 * g;
  out[1] = TP[1] + 3.8 * VIEW.H * g;
  return out;
}
const RS0 = [0, 0], RS1 = [0, 0];
function writeTracers(rounds) {
  const pos = trGeo.attributes.position.array, at = trGeo.attributes.aT.array;
  let n = 0;
  const quad = (x0, y0, x1, y1, w0, w1, heat) => {
    if (n >= TR_MAX) return;
    // art pixels -> clip space
    const cx = (x) => (x / VIEW.W) * 2 - 1, cy = (y) => 1 - (y / VIEW.H) * 2;
    let dx = x1 - x0, dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    const v = [[x0 - nx * w0, y0 - ny * w0, 0], [x0 + nx * w0, y0 + ny * w0, 0], [x1 + nx * w1, y1 + ny * w1, 1], [x1 - nx * w1, y1 - ny * w1, 1]];
    const idx = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const p = v[idx[k]], o = (n * 6 + k);
      pos[o * 3] = cx(p[0]); pos[o * 3 + 1] = cy(p[1]); pos[o * 3 + 2] = 0;
      at[o * 2] = p[2]; at[o * 2 + 1] = heat;
    }
    n++;
  };
  for (const r of rounds) {
    const u = Math.min(1, r.age / r.travel), tail = Math.max(0, u - r.streak / r.dist);
    roundScreen(r, u, RS1); roundScreen(r, tail, RS0);
    if (r.kind === 'mg') quad(RS0[0], RS0[1], RS1[0], RS1[1], 0.5, 0.75, 2.4);
    else { quad(RS0[0], RS0[1], RS1[0], RS1[1], 0.6, 1.6, 3); quad(RS1[0] - 1.6, RS1[1], RS1[0] + 1.6, RS1[1], 1.6, 1.6, 3.4); }
  }
  trGeo.setDrawRange(0, n * 6);
  trGeo.attributes.position.needsUpdate = true;
  trGeo.attributes.aT.needsUpdate = true;
}

/* ----------------------------------------------------------- lights
 * Lamps, lit windows and fires come from the scenery; blasts, fireballs and burning scraps add
 * their own for a moment. The 64 that matter most go to the GPU each frame. */
const LIGHTS_MAX = 64;
const lightData = new Float32Array(4 * LIGHTS_MAX * 4);
const lightTex = new THREE.DataTexture(lightData, 4, LIGHTS_MAX, THREE.RGBAFormat, THREE.FloatType);
lightTex.magFilter = THREE.NearestFilter; lightTex.minFilter = THREE.NearestFilter;
const dynLights = [];
// a light for a while: { x, y, z, r, c: [r, g, b], I, life, fall (how the intensity dies) }
function addLight(x, y, z, r, c, I, life, air) { dynLights.push({ x, y, z, r, c, I, life, age: 0, air: air || 0.4, dyn: true }); }
let nLights = 0;
function packLights(dt, t, cx, cz) {
  for (const L of dynLights) L.age += dt;
  for (let k = dynLights.length - 1; k >= 0; k--) if (dynLights[k].age >= dynLights[k].life) dynLights.splice(k, 1);
  const reach = Math.max(VIEW.W, VIEW.H * 2.2) / KPX * 0.75 + 20;
  const list = [];
  for (const L of dynLights) {
    const k = 1 - L.age / L.life;
    list.push([L, L.I * k * k, 1e6]);
  }
  for (const L of ACTIVE.lights) {
    const d = Math.hypot(L.x - cx, L.z - cz);
    if (d > reach + L.r) continue;
    let I = L.I;
    if (L.kind === 'fire') I *= 0.75 + 0.25 * Math.sin(t * 11 + L.seed) * Math.sin(t * 7.3 + L.seed * 1.7);
    list.push([L, I, 1e5 - d]);
  }
  list.sort((a, b) => b[2] - a[2]);
  nLights = Math.min(LIGHTS_MAX, list.length);
  for (let k = 0; k < nLights; k++) {
    const [L, I] = list[k], o = k * 16;
    lightData[o] = L.x; lightData[o + 1] = L.y; lightData[o + 2] = L.z; lightData[o + 3] = L.r;
    lightData[o + 4] = L.c[0]; lightData[o + 5] = L.c[1]; lightData[o + 6] = L.c[2]; lightData[o + 7] = I;
    if (L.spot) { lightData[o + 8] = L.spot[0]; lightData[o + 9] = L.spot[1]; lightData[o + 10] = L.spot[2]; lightData[o + 11] = L.spot[3]; lightData[o + 12] = L.spot[4]; }
    else { lightData[o + 8] = 0; lightData[o + 9] = -1; lightData[o + 10] = 0; lightData[o + 11] = -2; lightData[o + 12] = 0; }
    lightData[o + 13] = L.air || 0; lightData[o + 14] = 0; lightData[o + 15] = 0;
  }
  lightTex.needsUpdate = true;
}

/* -------------------------------------------------- heat thrown on the ground */
const heatSources = [];
function addHeat(x, z, r, heat, life) { heatSources.push({ x, z, r, heat, life, age: 0 }); }
function packHeat(dt, fires, t) {
  for (const h of heatSources) h.age += dt;
  for (let k = heatSources.length - 1; k >= 0; k--) if (heatSources[k].age >= heatSources[k].life) heatSources.splice(k, 1);
  const list = [];
  for (const h of heatSources) list.push([h.x, h.z, h.r, h.heat * Math.pow(1 - h.age / h.life, 1.5)]);
  for (const f of fires) list.push([f.x, f.z, f.big ? 10 : 6, 0.22 + 0.04 * Math.sin(t * 9 + f.seed)]);
  list.sort((a, b) => b[3] * b[2] - a[3] * a[2]);
  const n = Math.min(24, list.length);
  for (let k = 0; k < n; k++) U.uSrc.value[k].set(list[k][0], list[k][1], list[k][2], list[k][3]);
  U.uNSrc.value = n;
}

function initFx() { R3.scene.add(PART.mesh, decalMesh, tracerMesh); }
function updateFx(dt) {
  PART.update(dt);
  if (decDirty) { DA.needsUpdate = true; DB.needsUpdate = true; decDirty = false; }
}
function clearFx() { PART.clear(); clearDecals(); heatSources.length = 0; dynLights.length = 0; }
