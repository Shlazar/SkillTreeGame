/* Effects, all drawn as heat: tracers streaking from the gunship into the scene, hot particles
 * (flashes, fire, sparks, embers), cooler ones (smoke, dust, earth), and marks on the ground
 * (craters, scorches, blood) that cool down over time. */

const U_PX = { value: 0.001 };      // world size of one screen pixel at one metre
const quadGeo = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

/* -------------------------------------------------------------- particles
 * kind: 0 glow (fire, flash), 1 smoke / dust (lumpy, soft), 2 chunk (earth, gore), 3 streak (spark) */
class Particles {
  constructor(max, additive) {
    this.max = max; this.next = 0;
    const F = (k) => new Float32Array(max * k);
    this.vel = F(3); this.life = F(1); this.maxLife = F(1); this.s0 = F(1); this.s1 = F(1); this.h0 = F(1); this.h1 = F(1);
    this.a0 = F(1); this.grav = F(1); this.drag = F(1); this.spin = F(1); this.fadeIn = F(1);
    const g = quadGeo();
    this.A = new THREE.InstancedBufferAttribute(F(4), 4); this.B = new THREE.InstancedBufferAttribute(F(4), 4); this.C = new THREE.InstancedBufferAttribute(F(4), 4);
    for (const a of [this.A, this.B, this.C]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.A); g.setAttribute('iB', this.B); g.setAttribute('iC', this.C);
    g.instanceCount = max;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: U_PX }, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      defines: additive ? { ADDITIVE: 1 } : {},
      vertexShader: `
        uniform float uPx;
        attribute vec4 iA, iB, iC;
        varying vec2 vUv; varying vec4 vC;
        void main() {
          vec3 P = iA.xyz;
          float dist = distance(P, cameraPosition), kind = iC.z;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 wp;
          if (kind > 2.5) {
            vec3 v = iB.xyz; float sp = length(v);
            vec3 ax = sp > 0.01 ? v / sp : up, sd = normalize(cross(ax, normalize(cameraPosition - P)));
            wp = P + ax * position.y * max(iA.w, sp * 0.035) + sd * position.x * max(iA.w * 0.3, dist * uPx * 1.4);
          } else {
            float s = max(iA.w, dist * uPx * 1.6), c = cos(iB.w), sn = sin(iB.w);
            vec2 q = vec2(c * position.x - sn * position.y, sn * position.x + c * position.y);
            wp = P + (right * q.x + up * q.y) * s;
          }
          vUv = uv; vC = iC;
          gl_Position = iC.y <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: GLSL_NOISE + `
        varying vec2 vUv; varying vec4 vC;
        void main() {
          float heat = vC.x, a = vC.y, kind = vC.z, seed = vC.w;
          vec2 c = vUv - 0.5; float r = length(c) * 2.0, m;
          if (kind < 0.5) m = pow(max(0.0, 1.0 - r), 1.6);
          else if (kind < 1.5) m = 1.0 - smoothstep(0.3, 1.0, r + (fbm(c * 3.2 + seed * 17.0) - 0.5) * 0.6);
          else if (kind < 2.5) m = 1.0 - smoothstep(0.75, 1.0, r);
          else m = (1.0 - smoothstep(0.2, 1.0, abs(c.x) * 2.0)) * (0.35 + 0.65 * vUv.y);
          #ifdef ADDITIVE
            gl_FragColor = vec4(vec3(heat * 0.5 * a * m), 1.0);
          #else
            float al = a * m;
            if (al < 0.01) discard;
            gl_FragColor = vec4(vec3(heat * 0.5), al);
          #endif
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 4 : 3;
  }
  // o: { life, s0, s1, h0, h1, a, kind, grav, drag, spin, fadeIn }
  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.next, A = this.A.array, B = this.B.array, C = this.C.array;
    this.next = (i + 1) % this.max;
    A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = z; A[i * 4 + 3] = o.s0;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    B[i * 4] = vx; B[i * 4 + 1] = vy; B[i * 4 + 2] = vz; B[i * 4 + 3] = Math.random() * TAU;
    C[i * 4] = o.h0; C[i * 4 + 1] = o.fadeIn ? 0.001 : o.a; C[i * 4 + 2] = o.kind; C[i * 4 + 3] = Math.random();
    this.life[i] = o.life; this.maxLife[i] = o.life; this.s0[i] = o.s0; this.s1[i] = o.s1 === undefined ? o.s0 : o.s1;
    this.h0[i] = o.h0; this.h1[i] = o.h1 === undefined ? o.h0 : o.h1; this.a0[i] = o.a;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag || 0; this.spin[i] = o.spin || 0; this.fadeIn[i] = o.fadeIn || 0;
  }
  update(dt) {
    const A = this.A.array, B = this.B.array, C = this.C.array, V = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (C[i * 4 + 1] !== 0) C[i * 4 + 1] = 0; continue; }
      const l = (this.life[i] -= dt);
      if (l <= 0) { C[i * 4 + 1] = 0; continue; }
      const k = 1 - l / this.maxLife[i], i3 = i * 3, i4 = i * 4, dr = Math.exp(-this.drag[i] * dt);
      V[i3] *= dr; V[i3 + 1] = V[i3 + 1] * dr - this.grav[i] * dt; V[i3 + 2] *= dr;
      A[i4] += V[i3] * dt; A[i4 + 1] += V[i3 + 1] * dt; A[i4 + 2] += V[i3 + 2] * dt;
      if (A[i4 + 1] < 0.05 && V[i3 + 1] < 0) { A[i4 + 1] = 0.05; V[i3 + 1] *= -0.25; V[i3] *= 0.5; V[i3 + 2] *= 0.5; }
      B[i4] = V[i3]; B[i4 + 1] = V[i3 + 1]; B[i4 + 2] = V[i3 + 2]; B[i4 + 3] += this.spin[i] * dt;
      A[i4 + 3] = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - k) * (1 - k));
      C[i4] = this.h0[i] + (this.h1[i] - this.h0[i]) * k;
      const fi = this.fadeIn[i] ? Math.min(1, k / this.fadeIn[i]) : 1;
      C[i4 + 1] = this.a0[i] * fi * (1 - k * k);
    }
    this.A.needsUpdate = true; this.B.needsUpdate = true; this.C.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}
const HOT = new Particles(3500, true), COOL = new Particles(3000, false);

/* -------------------------------------------------------------- tracers */
const TR_MAX = 300;
const trGeo = new THREE.InstancedBufferGeometry();
trGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
trGeo.setIndex([0, 1, 2, 0, 2, 3]);
const TR0 = new THREE.InstancedBufferAttribute(new Float32Array(TR_MAX * 4), 4), TR1 = new THREE.InstancedBufferAttribute(new Float32Array(TR_MAX * 4), 4);
TR0.setUsage(THREE.DynamicDrawUsage); TR1.setUsage(THREE.DynamicDrawUsage);
trGeo.setAttribute('iP0', TR0); trGeo.setAttribute('iP1', TR1);
trGeo.instanceCount = 0;
const tracerMesh = new THREE.Mesh(trGeo, new THREE.ShaderMaterial({
  uniforms: { uPx: U_PX }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uPx;
    attribute vec4 iP0, iP1;          // tail xyz + width, head xyz + heat
    varying float vT, vX, vHeat;
    void main() {
      vec3 P = mix(iP0.xyz, iP1.xyz, position.y), ax = normalize(iP1.xyz - iP0.xyz);
      vec3 sd = normalize(cross(ax, normalize(cameraPosition - P)));
      float w = max(iP0.w, distance(P, cameraPosition) * uPx * 1.8);
      vT = position.y; vX = position.x * 2.0; vHeat = iP1.w;
      gl_Position = projectionMatrix * viewMatrix * vec4(P + sd * position.x * w, 1.0);
    }`,
  fragmentShader: `
    varying float vT, vX, vHeat;
    void main() { gl_FragColor = vec4(vec3(vHeat * 0.5 * (0.2 + 0.8 * vT * vT) * (1.0 - vX * vX)), 1.0); }`,
}));
tracerMesh.frustumCulled = false; tracerMesh.renderOrder = 5;
function writeTracers(rounds) {
  const a = TR0.array, b = TR1.array;
  let n = 0;
  for (const r of rounds) {
    if (n >= TR_MAX) break;
    const u = Math.min(1, r.age / r.travel), tail = Math.max(0, u - r.streak / r.dist);
    const hx = lerp(r.a.x, r.b.x, u), hy = lerp(r.a.y, r.b.y, u), hz = lerp(r.a.z, r.b.z, u);
    a[n * 4] = lerp(r.a.x, r.b.x, tail); a[n * 4 + 1] = lerp(r.a.y, r.b.y, tail); a[n * 4 + 2] = lerp(r.a.z, r.b.z, tail); a[n * 4 + 3] = r.width;
    b[n * 4] = hx; b[n * 4 + 1] = hy; b[n * 4 + 2] = hz; b[n * 4 + 3] = r.heat;
    n++;
  }
  trGeo.instanceCount = n;
  TR0.needsUpdate = true; TR1.needsUpdate = true;
}

/* ---------------------------------------------------------- ground marks
 * kind 0 crater, 1 scorch, 2 blood. Each starts hot and cools towards the ground's heat. */
const DEC_MAX = 1600;
const decGeo = quadGeo();
const DA = new THREE.InstancedBufferAttribute(new Float32Array(DEC_MAX * 4), 4), DB = new THREE.InstancedBufferAttribute(new Float32Array(DEC_MAX * 4), 4);
decGeo.setAttribute('iA', DA); decGeo.setAttribute('iB', DB);
decGeo.instanceCount = 0;
const decalMesh = new THREE.Mesh(decGeo, new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `
    attribute vec4 iA, iB;            // x, z, size, angle | born, kind, heat, seed
    varying vec2 vUv; varying vec4 vB; varying vec3 vW;
    void main() {
      float c = cos(iA.w), s = sin(iA.w);
      vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iA.z;
      vec4 wp = vec4(iA.x + q.x, 0.03, iA.y + q.y, 1.0);
      vUv = uv - 0.5; vB = iB; vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: GLSL_NOISE + GLSL_OUT + `
    uniform float uTime;
    varying vec2 vUv; varying vec4 vB; varying vec3 vW;
    void main() {
      float r = length(vUv) * 2.0, ang = atan(vUv.y, vUv.x), age = uTime - vB.x, kind = vB.y, seed = vB.w * 53.0;
      float h, a;
      if (kind < 0.5) {                               // a crater: a hot pit, a rim of thrown earth, rays of ejecta
        float edge = 0.62 + 0.14 * vnoise(vec2(ang * 3.0 + seed, seed));
        float rays = smoothstep(0.55, 0.9, vnoise(vec2(ang * 9.0 + seed, 1.0))) * (1.0 - smoothstep(edge, 1.0, r));
        float pit = 1.0 - smoothstep(edge * 0.55, edge * 0.7, r), rim = smoothstep(edge * 0.5, edge * 0.75, r) * (1.0 - smoothstep(edge * 0.8, edge, r));
        float cool = smoothstep(0.0, 25.0, age);
        float embers = smoothstep(0.78, 0.95, vnoise(vUv * 26.0 + seed)) * (1.0 - smoothstep(edge * 0.4, edge, r));
        float warm = vB.z * (0.42 + 0.18 * pit) + embers * vB.z * 0.9 * (1.0 - smoothstep(0.0, 14.0, age));
        h = mix(warm, 0.27 + 0.12 * rim + 0.04 * rays, cool) + rays * 0.05 * (1.0 - cool);
        a = max(max(pit, rim), rays * 0.85) * (1.0 - smoothstep(edge, edge + 0.12, r) * (1.0 - rays));
        a *= 1.0 - smoothstep(240.0, 300.0, age);
      } else if (kind < 1.5) {                        // a scorch from a 25mm round
        float edge = 0.55 + 0.3 * vnoise(vec2(ang * 2.0 + seed, seed));
        h = mix(vB.z, 0.31, smoothstep(0.0, 5.0, age));
        a = (1.0 - smoothstep(edge * 0.6, edge, r)) * 0.9 * (1.0 - smoothstep(60.0, 90.0, age));
      } else {                                        // blood, warm, then cooling
        float edge = 0.4 + 0.45 * vnoise(vec2(ang * 1.7 + seed, seed));
        float drops = step(0.82, vnoise(vUv * 9.0 + seed)) * step(r, 1.0);
        h = mix(vB.z, 0.32, smoothstep(0.0, 40.0, age));
        a = max(1.0 - smoothstep(edge * 0.8, edge, r), drops) * 0.85 * (1.0 - smoothstep(120.0, 160.0, age));
      }
      if (a < 0.01) discard;
      gl_FragColor = vec4(heatOut(h, vW).rgb, a);
    }`,
}));
decalMesh.frustumCulled = false; decalMesh.renderOrder = 1;
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

/* ----------------------------------------------------------- shockwaves */
const RING_MAX = 24;
const ringGeo = quadGeo();
const RA = new THREE.InstancedBufferAttribute(new Float32Array(RING_MAX * 4), 4);
ringGeo.setAttribute('iA', RA);
ringGeo.instanceCount = RING_MAX;
const ringMesh = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute vec4 iA;                // x, z, radius, heat
    varying vec2 vUv; varying float vHeat;
    void main() {
      vUv = uv - 0.5; vHeat = iA.w;
      vec4 wp = vec4(iA.x + position.x * iA.z * 2.4, 0.4, iA.y + position.y * iA.z * 2.4, 1.0);
      gl_Position = iA.w <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: GLSL_NOISE + `
    varying vec2 vUv; varying float vHeat;
    void main() {
      float r = length(vUv) * 2.4, band = exp(-pow((r - 1.0) * 9.0, 2.0)) * (0.7 + 0.6 * vnoise(vUv * 30.0));
      gl_FragColor = vec4(vec3(vHeat * 0.5 * band), 1.0);
    }`,
}));
ringMesh.frustumCulled = false; ringMesh.renderOrder = 4;
const rings = [];
function addRing(x, z, radius, heat) { rings.push({ x, z, radius, heat, age: 0 }); if (rings.length > RING_MAX) rings.shift(); }
function updateRings(dt) {
  const a = RA.array;
  for (let k = 0; k < RING_MAX; k++) {
    const g = rings[k], o = k * 4;
    if (!g) { a[o + 3] = 0; continue; }
    g.age += dt;
    const u = Math.min(1, g.age / 0.55);
    a[o] = g.x; a[o + 1] = g.z; a[o + 2] = g.radius * (1 - (1 - u) * (1 - u) * (1 - u)) + 0.5; a[o + 3] = g.heat * (1 - u);
  }
  for (let k = rings.length - 1; k >= 0; k--) if (rings[k].age > 0.55) rings.splice(k, 1);
  RA.needsUpdate = true;
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

function initFx() {
  R3.scene.add(HOT.mesh, COOL.mesh, tracerMesh, decalMesh, ringMesh);
}
function updateFx(dt) {
  HOT.update(dt); COOL.update(dt); updateRings(dt);
  if (decDirty) { DA.needsUpdate = true; DB.needsUpdate = true; decDirty = false; }
}
function clearFx() { HOT.clear(); COOL.clear(); clearDecals(); rings.length = 0; heatSources.length = 0; }
