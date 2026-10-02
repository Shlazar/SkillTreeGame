/* The endless countryside, in 150 m field cells. Each cell's crop, pond, hedges, farmstead, cars
 * and power poles come from a hash of its coordinates, so any part of the world rebuilds the same.
 * Field types reach the ground shader through a small texture; scenery is drawn with instancing. */

const CELL = 150, FT = 64;
// highways and farm tracks: warped grids, the same in JS and GLSL
const hwX = (z) => 40 * Math.sin(z * 0.0021) + 18 * Math.sin(z * 0.0057 + 1.3);
const hwZ = (x) => 40 * Math.sin(x * 0.0019 + 0.7) + 18 * Math.sin(x * 0.0051 + 2.1);
function hwDist(x, z) {
  return Math.min(Math.abs(mod(x + hwX(z), 1100) - 550), Math.abs(mod(z + hwZ(x), 1300) - 650));
}
function trackDist(x, z) {
  const wx = x + 14 * Math.sin(z * 0.011) + 7 * Math.sin(z * 0.029 + 1.7);
  const wz = z + 14 * Math.sin(x * 0.012 + 0.6) + 7 * Math.sin(x * 0.027 + 2.9);
  return Math.min(Math.abs(mod(wx, 300) - 150), Math.abs(mod(wz, 340) - 170));
}
const GLSL_ROADS = `
  float hwDx(vec2 p) { return abs(mod(p.x + 40.0 * sin(p.y * 0.0021) + 18.0 * sin(p.y * 0.0057 + 1.3), 1100.0) - 550.0); }
  float hwDz(vec2 p) { return abs(mod(p.y + 40.0 * sin(p.x * 0.0019 + 0.7) + 18.0 * sin(p.x * 0.0051 + 2.1), 1300.0) - 650.0); }
  float trackD(vec2 p) {
    float wx = p.x + 14.0 * sin(p.y * 0.011) + 7.0 * sin(p.y * 0.029 + 1.7);
    float wz = p.y + 14.0 * sin(p.x * 0.012 + 0.6) + 7.0 * sin(p.x * 0.027 + 2.9);
    return min(abs(mod(wx, 300.0) - 150.0), abs(mod(wz, 340.0) - 170.0));
  }
`;
function vnoise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = rnd(xi, yi, s), b = rnd(xi + 1, yi, s), c = rnd(xi, yi + 1, s), d = rnd(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
// a town sits on every highway crossing
function crossing(kx, kz) {
  let x = 550 + 1100 * kx, z = 650 + 1300 * kz;
  for (let i = 0; i < 4; i++) { x = 550 + 1100 * kx - hwX(z); z = 650 + 1300 * kz - hwZ(x); }
  return [x, z];
}
function townOf(x, z) {
  const kx = Math.round((x + hwX(z) - 550) / 1100), kz = Math.round((z + hwZ(x) - 650) / 1300), c = crossing(kx, kz);
  return { x: c[0], z: c[1], r: 170 + 130 * rnd(kx, kz, 77), d: Math.hypot(x - c[0], z - c[1]) };
}
// where a mission starts: the edge of the first town's centre
function startSpot() { const c = crossing(0, 0); return [c[0] + 45, c[1] + 60]; }
// field types: 0 pasture, 1 ploughed, 2 crop rows, 3 stubble, 4 woodland, 5 town
const fieldCache = new Map();
function fieldOf(ci, cj) {
  const key = ci * 100003 + cj;
  let f = fieldCache.get(key);
  if (f) return f;
  const r = rnd(ci, cj, 1), forest = vnoise2(ci * 0.21, cj * 0.21, 4), town = townOf((ci + 0.5) * CELL, (cj + 0.5) * CELL);
  let type = town.d < town.r ? 5 : forest > 0.7 ? 4 : r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.76 ? 2 : 3;
  f = { type, ang: Math.floor(rnd(ci, cj, 2) * 4), v: rnd(ci, cj, 3), pond: type === 0 && rnd(ci, cj, 9) < 0.07 };
  if (fieldCache.size > 20000) fieldCache.clear();
  fieldCache.set(key, f);
  return f;
}

/* ------------------------------------------------------------- the ground */
const fieldData = new Uint8Array(FT * FT * 4);
const fieldTex = new THREE.DataTexture(fieldData, FT, FT, THREE.RGBAFormat);
fieldTex.magFilter = THREE.NearestFilter; fieldTex.minFilter = THREE.NearestFilter;
const fieldO = new THREE.Vector2(1e9, 1e9);
function updateFieldTex(cx, cz) {
  const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
  if (Math.abs(ci - (fieldO.x + FT / 2)) < 16 && Math.abs(cj - (fieldO.y + FT / 2)) < 16) return;
  fieldO.set(ci - FT / 2, cj - FT / 2);
  for (let j = 0; j < FT; j++) for (let i = 0; i < FT; i++) {
    const f = fieldOf(fieldO.x + i, fieldO.y + j), o = (j * FT + i) * 4;
    fieldData[o] = f.type; fieldData[o + 1] = f.ang; fieldData[o + 2] = Math.round(f.v * 255); fieldData[o + 3] = f.pond ? 255 : 0;
  }
  fieldTex.needsUpdate = true;
}
const groundMat = new THREE.ShaderMaterial({
  uniforms: Object.assign({ uField: { value: fieldTex }, uFieldO: { value: fieldO } }, U),
  vertexShader: `
    varying vec3 vW;
    void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: GLSL_NOISE + GLSL_OUT + GLSL_SRC + GLSL_ROADS + `
    uniform sampler2D uField; uniform vec2 uFieldO; uniform float uTime;
    varying vec3 vW;
    void main() {
      vec2 p = vW.xz, q = p / 150.0, cell = floor(q), fr = q - cell;
      vec4 F = texture2D(uField, (cell - uFieldO + 0.5) / 64.0);
      float type = floor(F.r * 255.0 + 0.5), ang = floor(F.g * 255.0 + 0.5) * 0.785398, var = F.b - 0.5;
      vec2 dir = vec2(cos(ang), sin(ang));
      float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)) * 150.0;
      float g1 = fbm(p * 0.07), g2 = vnoise(p * 1.3), g3 = hash12(floor(p * 2.0));
      float h;
      if (type < 0.5) h = 0.30 + (g1 - 0.5) * 0.06 + (g2 - 0.5) * 0.02 + g3 * 0.006;                    // pasture
      else if (type < 1.5) h = 0.375 + sin(dot(p, dir) * 2.2 + g2 * 2.0) * 0.008 + (g1 - 0.5) * 0.05 + g3 * 0.008;  // ploughed
      else if (type < 2.5) h = 0.295 + (1.0 - smoothstep(0.15, 0.85, abs(sin(dot(p, dir) * 1.4)))) * 0.016 + (g1 - 0.5) * 0.04 + (g2 - 0.5) * 0.02; // crop rows
      else if (type < 3.5) h = 0.34 + sin(dot(p, dir) * 5.0 + g2 * 3.0) * 0.005 + (g1 - 0.5) * 0.04 + g3 * 0.006;    // stubble
      else if (type < 4.5) h = 0.335 + (g1 - 0.5) * 0.05 + (g2 - 0.5) * 0.02;                                // woodland floor
      else {                                    // town: 75 m blocks, streets on their edges, three lots along each street side
        vec2 bl = mod(p, 75.0), e = min(bl, 75.0 - bl);
        float sd = min(e.x, e.y), lx = bl.x - 6.0, lot = lx - floor(lx / 21.0) * 21.0, inLots = step(0.0, lx) * step(lx, 63.0);
        h = 0.3 + (g1 - 0.5) * 0.035 + (g2 - 0.5) * 0.012 + g3 * 0.005;                                   // lawns
        float fence = inLots * (1.0 - smoothstep(0.1, 0.28, min(lot, 21.0 - lot))) * step(6.0, e.y);
        fence = max(fence, (1.0 - smoothstep(0.1, 0.28, abs(e.y - 37.5))) * step(6.0, e.x));
        h = mix(h, 0.35, fence * 0.8);                                                                     // fences between yards
        float drive = inLots * step(15.0, lot) * step(lot, 19.4) * step(e.y, 21.0);
        h = mix(h, 0.355 + (g2 - 0.5) * 0.012, drive);                                                    // driveways
        float along = e.y < e.x ? p.x : p.y;
        h = mix(h, 0.36 + step(0.93, fract(along / 1.6)) * 0.012 + g3 * 0.004, 1.0 - smoothstep(5.9, 6.05, sd)); // sidewalks
        h = mix(h, 0.385 + (vnoise(p * 0.35) - 0.5) * 0.02 + g3 * 0.006 - smoothstep(0.93, 0.97, vnoise(p * vec2(0.8, 0.3))) * 0.015,
          1.0 - smoothstep(3.9, 4.05, sd));                                                                // the street
        h -= (1.0 - smoothstep(0.0, 0.3, abs(sd - 4.0))) * 0.018;                                          // the gutter by the curb
      }
      h += var * 0.03;
      if (type < 3.5) h += (1.0 - smoothstep(0.5, 1.8, edge)) * 0.028;                                        // a damp ditch
      if (F.a > 0.5) {                                                                                        // a pond: cold, flat water
        vec2 c = fr - 0.5;
        float r = length(c * vec2(1.0, 1.25)) + (vnoise(p * 0.05) - 0.5) * 0.12;
        float w = 1.0 - smoothstep(0.24, 0.255, r);
        h = mix(h, 0.212 + (vnoise(p * 0.25 + uTime * 0.04) - 0.5) * 0.006, w);
        h += (smoothstep(0.245, 0.26, r) - smoothstep(0.26, 0.31, r)) * 0.035;
      }
      float td = trackD(p), track = (1.0 - smoothstep(2.1, 2.7, td)) * step(type, 4.5);
      float rut = (1.0 - smoothstep(0.3, 0.55, abs(td - 1.15))) * track;
      h = mix(h, 0.365 + (g2 - 0.5) * 0.02 + rut * 0.022, track);
      float dx = hwDx(p), dz = hwDz(p), hd = min(dx, dz), along = dx < dz ? p.y : p.x;
      float road = 1.0 - smoothstep(3.6, 4.0, hd), shoulder = (1.0 - smoothstep(4.0, 5.6, hd)) * (1.0 - road);
      float lane = (1.0 - smoothstep(0.08, 0.16, hd)) * step(0.45, fract(along / 9.0));
      float crack = smoothstep(0.92, 0.97, vnoise(p * vec2(0.9, 0.35)));
      h = mix(h, 0.395 + (vnoise(p * 0.35) - 0.5) * 0.025 + g3 * 0.008 - crack * 0.02, road);
      h = mix(h, 0.37, lane * road);
      h -= shoulder * 0.022;
      h += srcHeat(vW);
      gl_FragColor = heatOut(h, vW);
    }`,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 1, 1).rotateX(-Math.PI / 2), groundMat);
ground.frustumCulled = false;

/* ---------------------------------------------------------------- scenery */
// solids: heat per instance, faces open to the sky a little cooler, fires warm what is near them
function solidMat(kind) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    defines: { KIND: kind },
    vertexShader: `
      attribute float iHeat;
      varying float vHeat; varying vec3 vN, vW, vL;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(m) * normal); vL = position; vHeat = iHeat;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: GLSL_NOISE + GLSL_OUT + GLSL_SRC + `
      varying float vHeat; varying vec3 vN, vW, vL;
      void main() {
        float h = vHeat - max(vN.y, 0.0) * 0.02 + (fbm(vW.xz * 0.8 + vW.y * 0.3) - 0.5) * 0.025;
        #if KIND == 1
          h += (vnoise(vW.xz * 4.5 + vW.y * 3.3) * 0.45 + vnoise(vW.xz * 10.0 - vW.y * 7.0) * 0.55 - 0.5) * 0.06 + (1.0 - vN.y) * 0.02;   // clumps of leaves
        #elif KIND == 2
          h += step(0.82, fract(vL.z * 9.0)) * 0.012 - step(0.5, vN.y) * 0.02;           // roof: rows of tiles
        #elif KIND == 3
          h += (step(0.85, fract(vW.y * 1.3)) - 0.15) * 0.01;                             // walls: courses
        #endif
        h += srcHeat(vW) * 0.7;
        gl_FragColor = heatOut(h, vW);
      }`,
  });
}
function gableGeo() {
  // a unit gable roof: base x, z in [-0.5, 0.5] at y 0, ridge along x at y 1
  const v = [], n = [];
  const tri = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], nz = ab[0] * ac[1] - ab[1] * ac[0], l = Math.hypot(nx, ny, nz) || 1;
    for (const p of [a, b, c]) { v.push(...p); n.push(nx / l, ny / l, nz / l); }
  };
  const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 0, -0.5], D = [-0.5, 0, -0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0];
  tri(A, B, F); tri(A, F, E); tri(C, D, E); tri(C, E, F); tri(B, C, F); tri(D, A, E);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}
function blobGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, rng = mulberry(seed);
  const bumps = Array.from({ length: 7 }, () => [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, 0.12 + rng() * 0.12]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let k = 1;
    for (const b of bumps) k += b[3] * Math.max(0, x * b[0] + y * b[1] + z * b[2]);
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  return g;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const POOLS = {};
function pool(name, geo, mat, max) {
  geo = geo.clone();
  const heat = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  heat.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iHeat', heat);
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.count = 0;
  POOLS[name] = { mesh, heat, n: 0, max };
  return mesh;
}
const M_PLAIN = solidMat(0), M_LEAF = solidMat(1), M_ROOF = solidMat(2), M_WALL = solidMat(3);
const SCENERY = new THREE.Group();
SCENERY.add(
  pool('trunk', new THREE.CylinderGeometry(0.18, 0.3, 1, 6).translate(0, 0.5, 0), M_PLAIN, 4000),
  pool('crownA', blobGeo(11), M_LEAF, 9000),
  pool('crownB', blobGeo(23), M_LEAF, 6000),
  pool('conifer', new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), M_LEAF, 2000),
  pool('wall', unitBox, M_WALL, 1600),
  pool('roof', gableGeo(), M_ROOF, 1600),
  pool('box', unitBox, M_PLAIN, 14000),
  pool('wheel', new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2), M_PLAIN, 5000),
  pool('bale', new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2), M_PLAIN, 800),
  pool('pole', new THREE.CylinderGeometry(0.13, 0.17, 1, 6).translate(0, 0.5, 0), M_PLAIN, 2600),
);
const wireGeo = new THREE.BufferGeometry();
const wireMax = 800 * 3 * 8;
wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wireMax * 6), 3));
const wires = new THREE.LineSegments(wireGeo, new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: 'varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: GLSL_OUT + 'varying vec3 vW; void main() { gl_FragColor = heatOut(0.28, vW); }',
}));
wires.frustumCulled = false;
SCENERY.add(wires);

const QM = new THREE.Matrix4(), QQ = new THREE.Quaternion(), QP = new THREE.Vector3(), QS = new THREE.Vector3(), QE = new THREE.Euler();
function put(name, x, y, z, sx, sy, sz, yaw, heat) {
  const P = POOLS[name];
  if (P.n >= P.max) return;
  QE.set(0, yaw || 0, 0); QQ.setFromEuler(QE);
  QM.compose(QP.set(x, y, z), QQ, QS.set(sx, sy, sz));
  QM.toArray(P.mesh.instanceMatrix.array, P.n * 16);
  P.heat.array[P.n] = heat;
  P.n++;
}

/* ----------------------------------------------------- what stands in a cell */
const contentCache = new Map();
function cellContent(ci, cj) {
  const key = ci * 100003 + cj;
  let c = contentCache.get(key);
  if (c) return c;
  const f = fieldOf(ci, cj), rng = mulberry(hash32(ci * 7919 + 17) ^ hash32(cj * 104729 + 5) ^ 0x2f6d);
  const x0 = ci * CELL, z0 = cj * CELL;
  c = { trees: [], houses: [], cars: [], poles: [], bales: [], misc: [], block: [] };
  const town = f.type === 5;
  const clear = (x, z, m) => hwDist(x, z) > 7 + m && (town || trackDist(x, z) > 4 + m);
  const tree = (x, z, s) => {
    if (!clear(x, z, 2)) return;
    const kind = rng() < 0.3 ? 2 : rng() < 0.5 ? 1 : 0;
    c.trees.push({ x, z, s: s * (0.8 + rng() * 0.5), kind, heat: 0.36 + rng() * 0.04, yaw: rng() * TAU });
    c.block.push(x, z, 0.8);
  };
  if (f.type === 4) {                                            // a wood
    const n = 34 + Math.floor(rng() * 14);
    for (let k = 0; k < n; k++) tree(x0 + rng() * CELL, z0 + rng() * CELL, 1);
  }
  if (town) {                                                   // houses: three lots along each side of each 75 m block
    for (let bj = 0; bj < 2; bj++) for (let bi = 0; bi < 2; bi++) {
      const bx = x0 + bi * 75, bz = z0 + bj * 75;
      for (const side of [0, 1]) {
        const dir = side ? -1 : 1, front = side ? bz + 69 : bz + 6;
        for (let k = 0; k < 3; k++) {
          const lx = bx + 6 + 21 * k, at = (u, v) => [lx + u, front + dir * v];      // u across the lot, v back from the sidewalk
          if (!clear(...at(10.5, 15), 15) || rng() < 0.06) continue;
          const w = 10 + rng() * 3, d = 8 + rng() * 3, hh = 5 + rng() * 2.2, [hx, hz] = at(2 + w / 2, 5 + d / 2), lit = [];
          for (let n = 0; n < 8; n++) lit.push(rng() < 0.3);
          const burning = rng() < 0.035;
          c.houses.push({ x: hx, z: hz, yaw: (rng() - 0.5) * 0.04, w, d, h: hh, lit, barn: false, heat: 0.39 + rng() * 0.05, burning });
          c.block.push(hx, hz, Math.max(w, d) / 2 + 0.3);
          const [gx, gz] = at(17.2, 18);                                         // the garage at the end of the drive
          c.misc.push(['box', gx, 0, gz, 4.6, 3, 6, 0, 0.36]);
          c.block.push(gx, gz, 3.2);
          if (rng() < 0.55) { const [cx, cz] = at(17.2, 9.5 + rng() * 1.5); c.cars.push({ x: cx, z: cz, yaw: Math.PI / 2, state: rng() < 0.3 ? 'warm' : 'cold' }); c.block.push(cx, cz, 2.4); }
          if (rng() < 0.6) { const [ax, az] = at(1, 5 + d * 0.6); c.misc.push(['box', ax, 0, az, 0.9, 0.9, 0.9, 0, 0.5]); }   // an air conditioner
          if (rng() < 0.35) tree(...at(3 + rng() * 9, 1.5 + rng() * 2), 0.75);                                           // front yard
          for (let n = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0; n > 0; n--) tree(...at(2 + rng() * 17, 25 + rng() * 10), 0.9);
          if (rng() < 0.3) { const [sx, sz] = at(3 + rng() * 14, 30 + rng() * 3); c.misc.push(['box', sx, 0, sz, 3, 2.4, 2.4, 0, 0.33]); c.block.push(sx, sz, 2); }
          else if (rng() < 0.2) { const [px, pz] = at(5 + rng() * 6, 27); c.misc.push(['box', px, 0, pz, 8, 0.05, 4, 0, 0.25]); }  // a pool
        }
        // street lights on the sidewalk, cars parked at the curb
        for (const u of [14, 47]) {
          const x = bx + u, z = side ? bz + 70 : bz + 5;
          if (!clear(x, z, 2)) continue;
          c.misc.push(['pole', x, 0, z, 0.8, 7.4, 0.8, 0, 0.32], ['box', x, 7.3, z - dir * 0.9, 0.35, 0.18, 1.6, 0, 0.32], ['box', x, 7.18, z - dir * 1.5, 0.4, 0.14, 0.5, 0, 0.8]);
        }
        if (rng() < 0.45) {
          const x = bx + 8 + rng() * 60, z = side ? bz + 72.4 : bz + 2.6;
          if (clear(x, z, 0)) { c.cars.push({ x, z, yaw: rng() < 0.5 ? 0 : Math.PI, state: rng() < 0.12 ? 'warm' : 'cold' }); c.block.push(x, z, 2.4); }
        }
      }
    }
  }
  // hedgerows on this cell's west and south edges
  for (const side of [0, 1]) {
    if (town || rnd(ci, cj, 40 + side) > 0.38) continue;
    for (let s = 3; s < CELL; s += 6 + rng() * 6) {
      const x = side ? x0 + s : x0 + (rng() - 0.5) * 2, z = side ? z0 + (rng() - 0.5) * 2 : z0 + s;
      tree(x, z, 0.85);
    }
  }
  // a farmstead: house, barn, a car or two, hay
  if (f.type < 4 && !f.pond && rnd(ci, cj, 5) < 0.12) {
    const hx = x0 + 40 + rng() * 70, hz = z0 + 40 + rng() * 70;
    if (clear(hx, hz, 22)) {
      const yaw = Math.floor(rng() * 4) * Math.PI / 2 + (rng() - 0.5) * 0.3;
      const lit = [];
      for (let k = 0; k < 8; k++) lit.push(rng() < 0.45);
      c.houses.push({ x: hx, z: hz, yaw, w: 11, d: 8, h: 6, lit, barn: false, heat: 0.4 + rng() * 0.04 });
      const bx = hx + Math.cos(yaw) * 24, bz = hz - Math.sin(yaw) * 24;
      c.houses.push({ x: bx, z: bz, yaw, w: 20, d: 12, h: 8, lit: [], barn: true, heat: 0.33 + rng() * 0.03 });
      c.block.push(hx, hz, 7.5, bx, bz, 12);
      for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) tree(hx + (rng() - 0.5) * 50, hz + (rng() - 0.5) * 50, 1.1);
      if (rng() < 0.7) {
        const a = yaw + Math.PI / 2, cx = hx + Math.cos(a) * 12, cz = hz - Math.sin(a) * 12;
        c.cars.push({ x: cx, z: cz, yaw: yaw + (rng() - 0.5) * 0.6, state: rng() < 0.4 ? 'warm' : 'cold' });
        c.block.push(cx, cz, 3);
      }
    }
  }
  if (f.type === 3 && rng() < 0.55) {                             // round bales on the stubble
    const n = 6 + Math.floor(rng() * 10), bx = x0 + 20 + rng() * 80, bz = z0 + 20 + rng() * 80, a = rng() * TAU;
    for (let k = 0; k < n; k++) {
      const x = bx + Math.cos(a) * k * 7 + (rng() - 0.5) * 2, z = bz + Math.sin(a) * k * 7 + (rng() - 0.5) * 2;
      if (clear(x, z, 2)) { c.bales.push({ x, z, yaw: rng() * TAU, heat: 0.37 + rng() * 0.03 }); c.block.push(x, z, 1.1); }
    }
  }
  // the highways through this cell: power poles every 50 m, and cars, some burning
  for (let z = Math.ceil(z0 / 50) * 50; z < z0 + CELL; z += 50) {
    const n = Math.round((x0 + 75 + hwX(z) - 550) / 1100);
    for (const k of [n - 1, n, n + 1]) {
      const x = 550 + 1100 * k - hwX(z);
      if (x >= x0 && x < x0 + CELL) c.poles.push({ x: x + 8, z, line: 'x' + k, at: z });
    }
  }
  for (let x = Math.ceil(x0 / 50) * 50; x < x0 + CELL; x += 50) {
    const n = Math.round((z0 + 75 + hwZ(x) - 650) / 1300);
    for (const k of [n - 1, n, n + 1]) {
      const z = 650 + 1300 * k - hwZ(x);
      if (z >= z0 && z < z0 + CELL) c.poles.push({ x, z: z + 8, line: 'z' + k, at: x });
    }
  }
  if (rng() < (town ? 0.8 : 0.45)) {
    for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) {
      const along = rng() * CELL, side = rng() < 0.5 ? -1.9 : 1.9, onX = rng() < 0.5;
      let x, z, yaw;
      // yaw turns the car's length (local x) along the road: x axis -> (cos yaw, -sin yaw)
      if (onX) { z = z0 + along; const n = Math.round((x0 + 75 + hwX(z) - 550) / 1100); x = 550 + 1100 * n - hwX(z) + side; yaw = Math.atan2(-1, -(hwX(z + 1) - hwX(z - 1)) / 2); }
      else { x = x0 + along; const n = Math.round((z0 + 75 + hwZ(x) - 650) / 1300); z = 650 + 1300 * n - hwZ(x) + side; yaw = Math.atan2((hwZ(x + 1) - hwZ(x - 1)) / 2, 1); }
      if (x < x0 || x >= x0 + CELL || z < z0 || z >= z0 + CELL) continue;
      const r = rng();
      c.cars.push({ x, z, yaw: yaw + (rng() < 0.5 ? Math.PI : 0) + (rng() - 0.5) * 0.5, state: r < 0.2 ? 'burning' : r < 0.45 ? 'warm' : 'cold' });
      c.block.push(x, z, 3);
    }
  }
  if (contentCache.size > 5000) contentCache.clear();
  contentCache.set(key, c);
  return c;
}

/* -------------------------------------------------- filling the instance pools */
const ACTIVE = { ci: 1e9, cj: 1e9, fires: [], cells: [] };
const VIEW_CELLS = 5;
function rebuildScenery(cx, cz) {
  const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
  if (ci === ACTIVE.ci && cj === ACTIVE.cj) return;
  ACTIVE.ci = ci; ACTIVE.cj = cj; ACTIVE.fires = []; ACTIVE.cells = [];
  for (const k in POOLS) POOLS[k].n = 0;
  const poleLines = new Map();
  for (let j = cj - VIEW_CELLS; j <= cj + VIEW_CELLS; j++) for (let i = ci - VIEW_CELLS; i <= ci + VIEW_CELLS; i++) {
    const c = cellContent(i, j);
    ACTIVE.cells.push(c);
    for (const t of c.trees) {
      const h = (t.kind === 2 ? 15 : 12) * t.s, r = (t.kind === 2 ? 3.2 : 4.4) * t.s;
      put('trunk', t.x, 0, t.z, t.s, h * (t.kind === 2 ? 0.45 : 0.62), t.s, 0, 0.36);
      if (t.kind === 2) put('conifer', t.x, h * 0.2, t.z, r, h * 0.85, r, t.yaw, t.heat);
      else {                                       // a crown of three lobes, so no two trees have the same outline
        const pa = t.kind ? 'crownB' : 'crownA', pb = t.kind ? 'crownA' : 'crownB';
        put(pa, t.x, h * 0.66, t.z, r, r, r, t.yaw, t.heat);
        put(pb, t.x + Math.cos(t.yaw) * r * 0.6, h * 0.6, t.z + Math.sin(t.yaw) * r * 0.6, r * 0.7, r * 0.75, r * 0.7, t.yaw * 3, t.heat + 0.01);
        put(pa, t.x + Math.cos(t.yaw + 2.4) * r * 0.55, h * 0.58, t.z + Math.sin(t.yaw + 2.4) * r * 0.55, r * 0.6, r * 0.65, r * 0.6, t.yaw * 5, t.heat - 0.01);
      }
    }
    for (const m of c.misc) put(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
    for (const b of c.houses) {
      put('wall', b.x, 0, b.z, b.w, b.h, b.d, b.yaw, b.burning ? 0.5 : b.heat);
      put('roof', b.x, b.h, b.z, b.w + 1.2, b.barn ? 5 : 3.6, b.d + 1.6, b.yaw, b.burning ? 0.6 : b.barn ? 0.28 : 0.3);
      const ca = Math.cos(b.yaw), sa = Math.sin(b.yaw);
      const at = (lx, lz) => [b.x + lx * ca + lz * sa, b.z - lx * sa + lz * ca];
      if (!b.barn) {
        const ch = at(b.w * 0.28, 0);
        put('box', ch[0], b.h, ch[1], 1.1, 4.6, 1.1, b.yaw, 0.43);          // a chimney, still warm
        let k = 0;
        for (const lz of [-1, 1]) for (const lx of [-3.6, 0, 3.6]) {
          const p = at(lx, lz * (b.d / 2 + 0.05));
          put('box', p[0], 2.6, p[1], 1.4, 1.5, 0.12, b.yaw, b.burning ? 1.2 : b.lit[k++] ? 0.5 : 0.25);
        }
        for (const lx of [-1, 1]) { const p = at(lx * (b.w / 2 + 0.05), 0); put('box', p[0], 2.6, p[1], 0.12, 1.5, 1.4, b.yaw, b.burning ? 1.2 : b.lit[k++] ? 0.5 : 0.25); }
        if (b.burning) ACTIVE.fires.push({ x: b.x, y: b.h + 1, z: b.z, seed: Math.floor(b.x * 7 + b.z * 13), big: true });
      } else {
        const p = at(0, b.d / 2 + 0.05);
        put('box', p[0], 0, p[1], 6, 5.5, 0.15, b.yaw, 0.3);               // the barn door
      }
    }
    for (const v of c.cars) {
      const ca = Math.cos(v.yaw), sa = Math.sin(v.yaw), body = v.state === 'burning' ? 0.9 : 0.29;
      const at = (lx, lz) => [v.x + lx * ca + lz * sa, v.z - lx * sa + lz * ca];
      put('box', v.x, 0.45, v.z, 4.3, 0.75, 1.8, v.yaw, body);
      const cab = at(-0.3, 0);
      put('box', cab[0], 1.2, cab[1], 2.2, 0.62, 1.6, v.yaw, v.state === 'burning' ? 1.15 : 0.27);
      const hood = at(1.5, 0);
      put('box', hood[0], 1.2, hood[1], 1.1, 0.04, 1.6, v.yaw, v.state === 'warm' ? 0.72 : v.state === 'burning' ? 1.3 : 0.3);
      for (const lx of [-1.35, 1.35]) for (const lz of [-0.85, 0.85]) { const w = at(lx, lz); put('wheel', w[0], 0.36, w[1], 0.36, 0.36, 0.22, v.yaw, 0.31); }
      if (v.state === 'burning') ACTIVE.fires.push({ x: v.x, y: 1, z: v.z, seed: Math.floor(v.x * 7 + v.z * 13), big: false });
    }
    for (const b of c.bales) put('bale', b.x, 0.85, b.z, 1.3, 0.85, 0.85, b.yaw, b.heat);
    for (const p of c.poles) {
      put('pole', p.x, 0, p.z, 1, 10, 1, 0, 0.3);
      const arm = p.line[0] === 'x';
      put('box', p.x, 9.2, p.z, arm ? 2.4 : 0.14, 0.14, arm ? 0.14 : 2.4, 0, 0.29);
      if (!poleLines.has(p.line)) poleLines.set(p.line, []);
      poleLines.get(p.line).push(p);
    }
  }
  for (const k in POOLS) {
    const P = POOLS[k];
    P.mesh.count = P.n;
    P.mesh.instanceMatrix.needsUpdate = true;
    P.heat.needsUpdate = true;
  }
  // three sagging wires between neighbouring poles along each highway
  const wp = wireGeo.attributes.position.array;
  let w = 0;
  for (const list of poleLines.values()) {
    list.sort((a, b) => a.at - b.at);
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1], b = list[k];
      if (b.at - a.at > 55) continue;
      const arm = a.line[0] === 'x';
      for (const off of [-1.05, 0, 1.05]) {
        const ox = arm ? off : 0, oz = arm ? 0 : off;
        for (let s = 0; s < 8 && w < wireMax; s++) {
          const u0 = s / 8, u1 = (s + 1) / 8, sag = (u) => 9.3 - 0.9 * 4 * u * (1 - u);
          wp.set([lerp(a.x, b.x, u0) + ox, sag(u0), lerp(a.z, b.z, u0) + oz, lerp(a.x, b.x, u1) + ox, sag(u1), lerp(a.z, b.z, u1) + oz], w * 6);
          w++;
        }
      }
    }
  }
  wireGeo.setDrawRange(0, w * 2);
  wireGeo.attributes.position.needsUpdate = true;
}
// solid things near (x, z) the dead must walk round: flat triples x, z, radius
function blockersNear(x, z, out) {
  out.length = 0;
  const i0 = Math.floor((x - 14) / CELL), i1 = Math.floor((x + 14) / CELL), j0 = Math.floor((z - 14) / CELL), j1 = Math.floor((z + 14) / CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const b = cellContent(i, j).block;
    for (let k = 0; k < b.length; k += 3) if (Math.abs(b[k] - x) < 14 && Math.abs(b[k + 1] - z) < 14) out.push(b[k], b[k + 1], b[k + 2]);
  }
  return out;
}
function initWorld() {
  R3.scene.add(ground, SCENERY);
}
function updateWorld(cx, cz) {
  updateFieldTex(cx, cz);
  rebuildScenery(cx, cz);
  ground.position.set(Math.round(cx / 50) * 50, 0, Math.round(cz / 50) * 50);
}
