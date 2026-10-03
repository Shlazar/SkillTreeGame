/* The endless world, in 150 m field cells. Each cell's crop, pond, hedges, ruins, cars and lamps
 * come from a hash of its coordinates, so any part of the world rebuilds the same. Towns sit on the
 * highway crossings; their houses are gone, burnt down to floors and stubs of wall that hide nothing.
 * Everything is painted pixel by pixel in its shader: ruins stand on a half-metre grid and their
 * details are measured in art pixels (0.25 m along a wall, VU up it), so every brick row lands on
 * whole pixels. */

const CELL = 150, FT = 64;
const HU = 0.25, VU = 1 / (KPX * CE);          // one art pixel along a wall, and up it
const snapH = (v) => Math.round(v * 2) / 2;    // the half-metre grid buildings stand on
const snapV = (v) => Math.round(v / VU) * VU;

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
// heat thrown onto nearby surfaces by fires and blasts (thermal mode)
U.uSrc = { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 1, 0)) };
U.uNSrc = { value: 0 };
const GLSL_SRC = `
  uniform vec4 uSrc[24];
  uniform int uNSrc;
  float srcHeat(vec3 wp) {
    float s = 0.0;
    for (int i = 0; i < 24; i++) {
      if (i >= uNSrc) break;
      vec2 d = wp.xz - uSrc[i].xy;
      s += uSrc[i].w * exp(-dot(d, d) / (uSrc[i].z * uSrc[i].z));
    }
    return s;
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
// where a mission starts: a street near the first town's centre
function startSpot() { const c = crossing(0, 0); return [Math.round(c[0] / 75) * 75 + 37, Math.round(c[1] / 75) * 75 + 2]; }
// field types: 0 pasture, 1 ploughed, 2 crop rows, 3 stubble, 4 woodland, 5 town
const fieldCache = new Map();
function fieldOf(ci, cj) {
  const key = ci * 100003 + cj;
  let f = fieldCache.get(key);
  if (f) return f;
  const r = rnd(ci, cj, 1), forest = vnoise2(ci * 0.21, cj * 0.21, 4), town = townOf((ci + 0.5) * CELL, (cj + 0.5) * CELL);
  const type = town.d < town.r ? 5 : forest > 0.7 ? 4 : r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.76 ? 2 : 3;
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
  fragmentShader: GLSL_GB + GLSL_SRC + GLSL_ROADS + `
    uniform sampler2D uField; uniform vec2 uFieldO;
    varying vec3 vW;
    void main() {
      if (uPass == 2) discard;
      vec3 P = vec3(vW.x, 0.0, vW.z);
      vec2 p = P.xz, g = gpix();
      float r = hash12(g * 0.731 + 3.1), r2 = hash12(g * 1.37 + 9.7);
      float t = r < 0.08 ? 1.0 : r > 0.93 ? -1.0 : 0.0;
      vec2 q = p / 150.0, cell = floor(q), fr = q - cell;
      vec4 F = texture2D(uField, (cell - uFieldO + 0.5) / 64.0);
      float type = floor(F.r * 255.0 + 0.5), ang = floor(F.g * 255.0 + 0.5) * 0.785398;
      vec2 dir = vec2(cos(ang), sin(ang));
      float n1 = vnoise(p * 0.11), n2 = vnoise(p * 0.035 + 7.0), n3 = vnoise(p * 0.7);
      float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)) * 150.0;
      vec3 col; float cls = 200.0, heat;
      if (type < 0.5) {                                   // pasture
        col = n1 > 0.62 ? P_grassDk : P_grass;
        if (n2 > 0.68 && r2 < 0.45) col = P_grassLt;
        if (vnoise(p * 0.045 + 21.0) > 0.8 && r2 < 0.6) { col = P_dirt; t = r < 0.15 ? -1.0 : 0.0; }
        if (r2 > 0.996) col = r > 0.5 ? P_trim : P_paintY;            // wild flowers
        cls = 210.0; heat = 0.3 + (n2 - 0.5) * 0.04;
      } else if (type < 1.5) {                            // ploughed: furrows one way per field
        float s = sin(dot(p, dir) * 6.98 + n3 * 0.6);
        col = s > 0.15 ? P_soil : P_soilDk; t = s > 0.85 ? 1.0 : r > 0.95 ? -1.0 : 0.0;
        heat = 0.375 + (n1 - 0.5) * 0.04;
      } else if (type < 2.5) {                            // crop rows on bare soil
        float s = sin(dot(p, dir) * 6.98);
        bool row = s > -0.15;
        col = row ? (n3 > 0.55 ? P_cropDk : P_crop) : P_soilDk; cls = row ? 210.0 : 200.0;
        heat = 0.295 + (n1 - 0.5) * 0.03;
      } else if (type < 3.5) {                            // stubble and straw lines
        float s = fract(dot(p, dir) * 1.25 + r2 * 0.2);
        col = s < 0.28 ? P_stubbleDk : P_stubble; if (n1 > 0.7 && r2 < 0.5) col = P_dirt;
        heat = 0.34 + (n1 - 0.5) * 0.04;
      } else if (type < 4.5) {                            // woodland floor: moss, mud, fallen leaves
        col = n1 > 0.74 ? P_mud : n2 > 0.6 ? P_leafDk : P_grassDk; if (r2 > 0.93) col = P_autumnDk; if (r2 < 0.05) col = P_grass;
        cls = 210.0; heat = 0.335 + (n1 - 0.5) * 0.04;
      } else {                                            // town: 75 m blocks, streets on their edges
        vec2 bl = mod(p, 75.0), e = min(bl, 75.0 - bl);
        float sd = min(e.x, e.y), lx = bl.x - 6.0, lot = lx - floor(lx / 21.0) * 21.0, inLots = step(0.0, lx) * step(lx, 63.0);
        col = mod(floor(p.x / 1.5), 2.0) < 1.0 ? P_lawn : mix(P_lawn, P_lawnLt, 0.55);   // mown stripes
        if (n1 > 0.7) col = P_lawnDk;
        cls = 210.0; heat = 0.3 + (n2 - 0.5) * 0.03;
        if (inLots * step(15.0, lot) * step(lot, 19.5) * step(e.y, 21.0) > 0.5) {        // driveways
          col = P_concrete; cls = 200.0; heat = 0.355; t = r > 0.9 ? -1.0 : 0.0;
          if (fract(e.y / 3.0) < 0.09) col = P_concreteDk;
        }
        if (sd < 6.0) {                                                                    // sidewalks with joints
          float along = e.y < e.x ? p.x : p.y;
          col = fract(along / 1.5) < 0.17 ? P_concreteDk : P_concrete; cls = 200.0; heat = 0.36; t = r > 0.94 ? -1.0 : 0.0;
        }
        if (sd < 4.25) { col = P_curb; heat = 0.36; t = 0.0; }                            // the curb
        if (sd < 4.0) {                                                                    // the street
          col = n3 > 0.62 ? P_asphaltDk : P_asphalt; heat = 0.385; t = r < 0.06 ? 1.0 : r > 0.9 ? -1.0 : 0.0;
          if (smoothstep(0.93, 0.97, vnoise(p * vec2(0.8, 0.3))) > 0.5) col = P_asphaltDk;
          if (sd > 3.6) col = P_asphaltDk;                                                 // the gutter
        }
      }
      if (type < 3.5 && edge < 1.5) { col = P_grassDk; cls = 210.0; heat += 0.02; }          // a damp ditch round each field
      if (F.a > 0.5) {                                                                     // a pond
        vec2 c = fr - 0.5;
        float rr = length(c * vec2(1.0, 1.25)) + (vnoise(p * 0.05) - 0.5) * 0.12;
        if (rr < 0.255) {
          col = P_water; cls = 220.0; heat = 0.212; t = 0.0;
          float ripple = hash12(floor(g / vec2(3.0, 1.0)) + floor(uTime * 1.5));
          if (ripple > 0.94) col = mix(P_water, P_trim, 0.35);
          if (rr > 0.24) col = P_mud;
        } else if (rr < 0.29) { col = r2 < 0.5 ? P_grassDk : P_mud; cls = 210.0; }
      }
      float td = trackD(p);                                                                 // farm tracks: ruts and a grassy crown
      if (type < 4.5 && td < 2.7) {
        cls = 200.0; heat = 0.365;
        if (td < 0.5) { col = r < 0.5 ? P_grassDk : P_dirt; cls = 210.0; }
        else if (abs(td - 1.2) < 0.45) { col = P_mud; t = r < 0.2 ? -1.0 : 0.0; }
        else col = r2 < 0.12 ? P_grassDk : P_dirt;
      }
      float dx = hwDx(p), dz = hwDz(p), hd = min(dx, dz), along = dx < dz ? p.y : p.x;      // highways
      if (hd < 6.0) {
        cls = 200.0;
        if (hd < 4.0) {
          col = n3 > 0.6 ? P_asphaltDk : P_asphalt; heat = 0.395; t = r < 0.05 ? 1.0 : r > 0.9 ? -1.0 : 0.0;
          if (smoothstep(0.93, 0.97, vnoise(p * vec2(0.9, 0.35))) > 0.5) col = P_asphaltDk;
          if (hd < 0.2 && fract(along / 9.0) > 0.45) { col = P_paintY; heat = 0.37; }      // the centre line
          if (abs(hd - 3.55) < 0.13) { col = P_paintW; heat = 0.37; }                     // edge lines
        } else { col = r2 < 0.5 ? P_gravel : P_concreteDk; heat = 0.37; t = r < 0.15 ? -1.0 : 0.0; }
      }
      heat += srcHeat(P);
      gl_FragColor = gOut(tex(col, t), cls, vec3(0.0, 1.0, 0.0), P, heat);
    }`,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2), groundMat);
ground.frustumCulled = false;

/* ----------------------------------------------------------- instance pools
 * Every scenery shape is a unit mesh drawn with per-instance attributes:
 *   iA = x, y, z, yaw     iB = size x, y, z, kind     iC = seed and three paint parameters */
const VERT_POOL = `
  attribute vec4 iA, iB, iC;
  varying vec3 vL, vN, vNw, vW;
  varying vec4 vB, vC;
  void main() {
    vec3 l = position * iB.xyz;
    float c = cos(iA.w), s = sin(iA.w);
    vec3 n = normalize(normal / iB.xyz);
    vec3 w = vec3(c * l.x + s * l.z, l.y, -s * l.x + c * l.z) + iA.xyz;
    vL = l; vN = n; vNw = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z); vW = w; vB = iB; vC = iC;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const POOL_HEAD = GLSL_GB + GLSL_SRC + `
  varying vec3 vL, vN, vNw, vW;
  varying vec4 vB, vC;
  const float HU = ${HU.toFixed(4)}, VU = ${VU.toFixed(6)};
  float h1(float a, float b) { return hash12(vec2(a * 1.731 + b * 0.37, b * 2.113 - a * 0.71)); }
`;
// props in boxes; kind: 0 plain, 1 chimney, 2 fence, 3 car body, 4 car cabin, 5 air conditioner,
// 6 pool, 7 lamp head, 8 timber, 9 bale wrap, 10 mailbox, 11 floor slab, 12 broken wall, 13 rubble
const BOX_FRAG = POOL_HEAD + `
  vec3 plain(float i) {
    if (i < 0.5) return P_concrete; if (i < 1.5) return P_iron; if (i < 2.5) return P_wood; if (i < 3.5) return P_steel; return P_trim;
  }
  vec3 carCol(float i) {
    if (i < 0.5) return P_carR; if (i < 1.5) return P_carB; if (i < 2.5) return P_carC; if (i < 3.5) return P_carG; if (i < 4.5) return P_carW; return P_carK;
  }
  vec3 wallCol(float i) {
    if (i < 0.5) return P_plaster; if (i < 1.5) return P_sidingW; if (i < 2.5) return P_sidingB; if (i < 3.5) return P_sidingY;
    if (i < 4.5) return P_sidingG; if (i < 5.5) return P_brick; if (i < 6.5) return P_woodLt; return vec3(0.54, 0.23, 0.18);
  }
  vec3 debrisCol(float i) {
    if (i < 0.5) return P_brick; if (i < 1.5) return P_plaster; if (i < 2.5) return P_wood; if (i < 3.5) return P_soot; return P_concrete;
  }
  void main() {
    float kind = vB.w, seed = vC.x, p1 = vC.y, p2 = vC.z, p3 = vC.w;
    vec3 n = normalize(vNw), P = vW, col = plain(p1);
    float r = phash(seed), t = 0.0, cls = 200.0, heat = 0.33;
    bool top = vN.y > 0.5, endw = abs(vN.x) > 0.5;
    float ax = floor(((endw ? vL.z : vL.x) + (endw ? vB.z : vB.x) * 0.5) / HU), ay = floor(vL.y / VU);
    if (uPass == 2 && kind > 5.5 && kind < 6.5) discard;             // a pool casts no shadow
    if (kind > 12.5) {                                                // rubble
      col = debrisCol(p1); t = r < 0.25 ? -1.0 : r > 0.85 ? 1.0 : 0.0; heat = 0.34;
    } else if (kind > 11.5) {                                         // what is left of a wall: a jagged top, scorched
      if (top) discard;
      float hpx = floor(vB.y / VU + 0.5);
      float jag = floor(h1(floor(ax / 2.0), seed) * 4.0) + (h1(ax, seed + 1.0) < 0.3 ? 1.0 : 0.0);
      if (ay >= hpx - jag) discard;
      col = wallCol(p1);
      if (p1 > 4.5 && p1 < 5.5) { col = h1(floor(ax / 2.0 + mod(ay, 2.0) * 0.5), ay) < 0.35 ? P_brickDk : P_brick; if (mod(ay, 3.0) < 1.0) col = mix(P_brick, P_concrete, 0.45); }
      else if (p1 > 6.5) t = mod(ax, 3.0) < 1.0 ? -1.0 : 0.0;
      else if (p1 > 0.5 && mod(ay, 3.0) < 1.0) t = -1.0;
      col *= 1.0 - 0.6 * smoothstep(0.4, 0.8, vnoise(vec2(ax * 0.35, ay * 0.4) + seed));
      if (ay >= hpx - jag - 1.0) col *= 0.72;
      heat = 0.36;
    } else if (kind > 10.5) {                                         // a floor slab: tiles or boards, ash and soot
      if (top) {
        bool boards = h1(seed, 2.0) < 0.5;
        vec2 q = floor(vL.xz / (boards ? vec2(1.0, 0.25) : vec2(0.5, 0.5)));
        col = boards ? (mod(q.y, 2.0) < 1.0 ? P_wood : P_woodDk) : (mod(q.x + q.y, 2.0) < 1.0 ? P_concrete : P_trim * 0.85);
        float burn = smoothstep(0.3, 0.7, vnoise(vL.xz * 0.35 + seed)) * (p1 > 0.5 ? 1.0 : 0.35);
        col = mix(col, P_soot, burn * 0.85);
        if (r > 0.94) col = P_ash;
        if (r < 0.04) col = debrisCol(mod(seed, 5.0));
        heat = 0.33 + burn * 0.03;
      } else { col = P_concreteDk; heat = 0.34; }
    } else if (kind > 9.5) { col = P_steel; heat = 0.3; }
    else if (kind > 8.5) { col = P_hay; heat = 0.37; }
    else if (kind > 7.5) { col = P_woodDk; t = r < 0.2 ? -1.0 : 0.0; heat = 0.3; }
    else if (kind > 6.5) {                                            // street lamp: iron hood, glowing glass below
      col = P_iron; heat = 0.45;
      if (vN.y < -0.5 || (!top && vL.y < VU * 0.9)) { col = vec3(1.0, 0.94, 0.78); cls = 110.0; heat = 0.9; }
    } else if (kind > 5.5) {                                          // swimming pool: tiles round the edge, rippling water
      col = P_pool; cls = 220.0; heat = 0.26;
      float ex = min(vB.x * 0.5 - abs(vL.x), vB.z * 0.5 - abs(vL.z));
      if (ex < 0.3 || !top) { col = P_trim; cls = 200.0; }
      else if (hash12(floor(gpix() / vec2(2.0, 1.0)) + floor(uTime * 2.0 + seed)) > 0.93) col = mix(P_pool, P_trim, 0.5);
    } else if (kind > 4.5) {                                          // air conditioner: grille slits, a fan on top
      col = P_steel; heat = 0.52;
      if (top) { if (length(vL.xz) < 0.3) col = P_iron; } else if (mod(ay, 2.0) < 1.0) t = -1.0;
    } else if (kind > 3.5) {                                          // car cabin: glass all round, pillars
      col = carCol(p1); heat = p2 > 1.5 ? 1.1 : 0.29;
      if (!top) { float u = endw ? ax : ax; if (mod(u + 1.0, 5.0) > 0.9 && ay > 0.0) { col = P_glass; cls = 220.0; } }
      if (p2 > 1.5) col = vnoise(vL.xz * 3.0 + seed) > 0.5 ? P_soot : P_rust;
    } else if (kind > 2.5) {                                          // car body: lights front and back, dark sills
      col = carCol(p1); heat = p2 > 0.5 && p2 < 1.5 ? 0.62 : p2 > 1.5 ? 0.95 : 0.29;
      if (!top && ay < 1.0) col = P_iron;
      if (endw && !top && ay >= 1.0 && (ax < 2.0 || ax > floor(vB.z / HU) - 3.0)) col = vN.x > 0.0 ? vec3(0.95, 0.92, 0.8) : vec3(0.75, 0.15, 0.12);
      if (p2 > 1.5) { col = vnoise(vL.xz * 3.0 + seed) > 0.45 ? P_soot : P_rust; if (hash12(gpix() + floor(uTime * 9.0)) > 0.97) { col = P_fireGlow; cls = 100.0; } }
    } else if (kind > 1.5) {                                          // fence: boards with gaps, a top rail
      col = h1(seed, 1.0) < 0.5 ? P_fence : P_fenceW;
      if (!top && mod(ax, 2.0) > 1.0) t = -1.0;
      if (!top && ay > floor(vB.y / VU) - 2.0) t = 1.0;
      heat = 0.33;
    } else if (kind > 0.5) {                                          // chimney: brick courses, soot on top
      col = mod(ay, 2.0) < 1.0 ? P_brick : P_brickDk; heat = 0.43;
      if (top) { col = P_soot; heat = 0.6; }
    }
    if (kind < 0.5 && r > 0.92) t = -1.0;
    heat += srcHeat(P) * 0.7;
    gl_FragColor = gOut(tex(col, t), cls, n, P, heat);
  }`;
// cylinders; kind: 0 bark, 1 timber pole, 2 iron pole, 3 tyre, 4 hay bale
const CYL_FRAG = POOL_HEAD + `
  void main() {
    float kind = vB.w, seed = vC.x;
    vec3 n = normalize(vNw), P = vW, col;
    float r = phash(seed + 2.0), t = 0.0, heat = 0.35, cls = 200.0;
    if (kind < 0.5) { col = r < 0.3 ? P_bark * 0.75 : P_bark; heat = 0.36; }
    else if (kind < 1.5) { col = r < 0.25 ? P_woodDk : P_wood; heat = 0.3; }
    else if (kind < 2.5) { col = P_iron; cls = 220.0; heat = 0.3; }
    else if (kind < 3.5) { col = P_tire; heat = 0.31; if (abs(dot(vN, vec3(0.0, 0.0, 1.0))) > 0.7 && length(vL.xy) < 0.45 * vB.x) col = P_steel; }
    else { col = mod(floor(length(vL.xy) / 0.16), 2.0) < 1.0 ? P_hay : P_hayDk; if (abs(vN.z) < 0.7) col = r < 0.4 ? P_hayDk : P_hay; heat = 0.37; }
    heat += srcHeat(P) * 0.7;
    gl_FragColor = gOut(tex(col, t), cls, n, P, heat);
  }`;
// conifers: three tiers of needles
const CONE_FRAG = POOL_HEAD + `
  void main() {
    if (uPass < 2 && cutHere()) discard;
    float seed = vC.x;
    vec3 n = normalize(vNw), P = vW;
    float band = vnoise(vec2(atan(vL.z, vL.x) * 2.5 + seed, vL.y * 1.4));
    vec3 col = band > 0.55 ? P_pineDk : P_pine;
    float r = phash(seed);
    float t = r < 0.07 ? 1.0 : r > 0.9 ? -1.0 : 0.0;
    float heat = vC.y + srcHeat(P) * 0.7;
    gl_FragColor = gOut(tex(col, t), 210.0, n, P, heat);
  }`;
// round crowns and bushes drawn as spheres in the fragment shader, with a lumpy outline
const BALL_VERT = `
  attribute vec4 iS;          // centre, radius
  attribute vec4 iK;          // kind (0 leaf, 1 autumn, 2 hedge), seed, heat, squash
  varying vec2 vQ; varying vec4 vS, vK;
  uniform int uPass;
  uniform vec3 uCR, uCU, uLR, uLU;
  void main() {
    vec3 R = uPass == 2 ? uLR : uCR, Up = uPass == 2 ? uLU : uCU;
    vQ = position.xy * 1.15;
    vS = iS; vK = iK;
    vec3 w = iS.xyz + (R * vQ.x + Up * vQ.y * iK.w) * iS.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const BALL_FRAG = GLSL_GB + GLSL_SRC + `
  uniform mat4 projectionMatrix;
  varying vec2 vQ; varying vec4 vS, vK;
  uniform vec3 uLR, uLU;
  void main() {
    vec3 R = uPass == 2 ? uLR : uCR, Up = uPass == 2 ? uLU : uCU, V = uPass == 2 ? uLD : uCV;
    vec2 q = vec2(vQ.x, vQ.y);
    float seed = vK.y, ang = atan(q.y, q.x);
    float rim = 0.86 + 0.14 * vnoise(vec2(ang * 2.6 + seed * 7.0, seed));
    float d2 = dot(q, q);
    if (d2 > rim * rim) discard;
    if (uPass < 2 && cutHere()) discard;
    float z = sqrt(rim * rim - d2);
    vec3 nn = normalize(R * q.x + Up * q.y + V * z);
    vec3 P = vS.xyz + (R * q.x + Up * q.y * vK.w + V * z) * vS.w;
    vec4 clip = projectionMatrix * viewMatrix * vec4(P, 1.0);
    gl_FragDepth = 0.5 * clip.z / clip.w + 0.5;
    if (uPass == 2) { gl_FragColor = gOut(vec3(0.0), 0.0, nn, P, 0.0); return; }
    // clumps of leaves: noise on the surface, a little bump in the normal, a speckle per pixel
    float cl = vnoise(P.xz * 0.9 + P.y * 0.7 + seed * 3.0), cl2 = vnoise(P.xz * 2.1 - P.y * 1.3 + seed);
    vec3 col;
    if (vK.x < 0.5) col = cl > 0.62 ? P_leafLt : cl < 0.36 ? P_leafDk : P_leaf;
    else if (vK.x < 1.5) col = cl > 0.5 ? P_autumn : P_autumnDk;
    else col = cl > 0.6 ? P_leaf : P_leafDk;
    vec3 n = normalize(nn + (R * (cl2 - 0.5) + Up * (cl - 0.5)) * 0.55);
    float r = phash(seed);
    float t = r < 0.07 ? 1.0 : r > 0.9 ? -1.0 : 0.0;
    float heat = vK.z + srcHeat(P) * 0.7;
    gl_FragColor = gOut(tex(col, t), 210.0, n, P, heat);
  }`;

const POOLS = {};
function pool(name, geo, frag, max, vert) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = geo.index;
  g.setAttribute('position', geo.attributes.position);
  if (geo.attributes.normal) g.setAttribute('normal', geo.attributes.normal);
  const attrs = vert ? ['iS', 'iK'] : ['iA', 'iB', 'iC'];
  const A = {};
  for (const a of attrs) { A[a] = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); A[a].setUsage(THREE.DynamicDrawUsage); g.setAttribute(a, A[a]); }
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert || VERT_POOL, fragmentShader: frag });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  POOLS[name] = { mesh, A, n: 0, max, geo: g };
  return mesh;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const SCENERY = new THREE.Group();
SCENERY.add(
  pool('box', unitBox, BOX_FRAG, 16000),
  pool('cylV', new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0), CYL_FRAG, 9000),
  pool('cylH', new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2), CYL_FRAG, 6000),
  pool('cone', new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0), CONE_FRAG, 6000),
  pool('ball', new THREE.PlaneGeometry(2, 2), BALL_FRAG, 12000, BALL_VERT),
);
// power lines: three sagging wires between poles
const wireGeo = new THREE.BufferGeometry();
const wireMax = 1200 * 3 * 8;
wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wireMax * 6), 3));
const wires = new THREE.LineSegments(wireGeo, new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: 'varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: GLSL_GB + 'varying vec3 vW; void main() { if (uPass == 2) discard; gl_FragColor = gOut(P_iron * 0.7, 200.0, vec3(0.0, 1.0, 0.0), vW, 0.28); }',
}));
wires.frustumCulled = false;
wires.renderOrder = 10;            // after the dead, so a wire overhead never counts as hiding one
SCENERY.add(wires);

function put(name, x, y, z, yaw, sx, sy, sz, kind, seed, p1, p2, p3) {
  const P = POOLS[name];
  if (P.n >= P.max) return;
  const i = P.n * 4, a = P.A.iA.array, b = P.A.iB.array, c = P.A.iC.array;
  a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = yaw || 0;
  b[i] = sx; b[i + 1] = sy; b[i + 2] = sz; b[i + 3] = kind || 0;
  c[i] = seed || 0; c[i + 1] = p1 || 0; c[i + 2] = p2 || 0; c[i + 3] = p3 || 0;
  P.n++;
}
function putBall(x, y, z, r, kind, seed, heat, squash) {
  const P = POOLS.ball;
  if (P.n >= P.max) return;
  const i = P.n * 4, s = P.A.iS.array, k = P.A.iK.array;
  s[i] = x; s[i + 1] = y; s[i + 2] = z; s[i + 3] = r;
  k[i] = kind; k[i + 1] = seed; k[i + 2] = heat; k[i + 3] = squash || 1;
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
  c = { trees: [], cars: [], poles: [], bales: [], props: [], lamps: [], fences: [], fires: [], block: [] };
  const town = f.type === 5;
  const clear = (x, z, m) => hwDist(x, z) > 7 + m && (town || trackDist(x, z) > 4 + m);
  const tree = (x, z, s, kind) => {
    if (!clear(x, z, 2)) return;
    kind = kind !== undefined ? kind : rng() < 0.3 ? 2 : rng() < 0.22 ? 1 : 0;
    c.trees.push({ x, z, s: s * (0.8 + rng() * 0.5), kind, heat: 0.36 + rng() * 0.04, seed: Math.floor(rng() * 1000) });
    c.block.push(x, z, 0.8);
  };
  // what is left of a house: the floor slab, stubs of wall with gaps, rubble, sometimes the chimney.
  // Nothing taller than a person, so nothing hides the dead or stops them.
  const ruin = (cx, cz, w, d, o) => {
    o = o || {};
    w = snapH(w); d = snapH(d);
    const x = snapH(cx - w / 2) + w / 2, z = snapH(cz - d / 2) + d / 2, seed = Math.floor(rng() * 1000);
    const wc = o.wc !== undefined ? o.wc : Math.floor(rng() * 6), T = 0.25;
    c.props.push(['box', x, 0, z, 0, w, 0.15, d, 11, seed, o.burning || rng() < 0.5 ? 1 : 0]);
    for (const side of [0, 1, 2, 3]) {
      const along = side < 2 ? w : d;
      let u = 0;
      while (u < along - 0.5) {
        const len = snapH(Math.min(along - u, 1.5 + rng() * 4)), gap = rng() < 0.45 ? snapH(1 + rng() * 2) : 0;
        const h = snapV(0.5 + rng() * (o.tall || 1.2));
        if (len >= 0.5 && rng() < 0.85) {
          const m = u + len / 2 - along / 2;
          if (side < 2) c.props.push(['box', x + m, 0.15, z + (side ? 1 : -1) * (d / 2 - T / 2), 0, len, h, T, 12, seed + side * 7 + u, wc]);
          else c.props.push(['box', x + (side === 3 ? 1 : -1) * (w / 2 - T / 2), 0.15, z + m, 0, T, h, len, 12, seed + side * 7 + u, wc]);
        }
        u += len + gap;
      }
    }
    for (let k = 0; k < 3 + Math.floor(rng() * 4); k++) {
      const sz = 0.3 + rng() * 0.6;
      c.props.push(['box', x + (rng() - 0.5) * w * 0.8, 0.15, z + (rng() - 0.5) * d * 0.8, rng() * TAU, sz * (1 + rng()), sz * 0.7, sz, 13, seed + k, Math.floor(rng() * 5)]);
    }
    if (rng() < 0.5 && !o.tall) c.props.push(['box', snapH(x + w * 0.25), 0.15, snapH(z), 0, 1, snapV(1.2 + rng() * 1.2), 1, 1, seed]);
    if (o.burning) c.fires.push({ x, y: 0.6, z, seed, big: false });
  };
  if (f.type === 4) {                                            // a wood
    const n = 34 + Math.floor(rng() * 14);
    for (let k = 0; k < n; k++) tree(x0 + rng() * CELL, z0 + rng() * CELL, 1);
  }
  if (town) {                                                   // three lots along each side of each 75 m block
    for (let bj = 0; bj < 2; bj++) for (let bi = 0; bi < 2; bi++) {
      const bx = x0 + bi * 75, bz = z0 + bj * 75;
      for (const side of [0, 1]) {
        const dir = side ? -1 : 1, front = side ? bz + 69 : bz + 6;
        for (let k = 0; k < 3; k++) {
          const lx = bx + 6 + 21 * k, at = (u, v) => [lx + u, front + dir * v];      // u across the lot, v back from the sidewalk
          if (!clear(...at(10.5, 15), 15) || rng() < 0.06) continue;
          const w = 10 + Math.floor(rng() * 7) * 0.5, d = 8 + Math.floor(rng() * 6) * 0.5;
          const [hx, hz] = at(2 + w / 2, 5 + d / 2);
          ruin(hx, hz, w, d, { burning: rng() < 0.07 });
          if (rng() < 0.55) {
            const [cx, cz] = at(17.25, 9.5 + rng() * 1.5);
            c.cars.push({ x: cx, z: cz, yaw: Math.PI / 2, state: rng() < 0.3 ? 'warm' : 'cold', paint: Math.floor(rng() * 6) });
            c.block.push(cx, cz, 2.4);
          }
          if (rng() < 0.18) tree(...at(3 + rng() * 9, 1.5 + rng() * 2), 0.75);                                           // front yard
          if (rng() < 0.5) tree(...at(2 + rng() * 17, 26 + rng() * 8), 0.9);
          if (rng() < 0.22) { const [px, pz] = at(10, 27); c.props.push(['box', snapH(px), 0, snapH(pz), 0, 8, 0.05, 4, 6, Math.floor(rng() * 99), 0, 0, 0]); }
          // fences: down the side of the lot and along the back
          const fh = 1.2, fz0 = front + dir * 13, fz1 = front + dir * 31.5, fs = Math.floor(rng() * 99);
          c.fences.push([lx, (fz0 + fz1) / 2, 0.12, Math.abs(fz1 - fz0), fh, fs]);
          c.fences.push([lx + 10.5, fz1 - dir * 0.06, 21, 0.12, fh, fs]);
        }
        // street lights on the sidewalk, cars parked at the curb
        for (const u of [14, 47]) {
          const x = bx + u, z = side ? bz + 70 : bz + 5;
          if (clear(x, z, 2)) c.lamps.push({ x, z, dx: 0, dz: -dir, h: 7.2 });
        }
        if (rng() < 0.45) {
          const x = bx + 8 + rng() * 60, z = side ? bz + 72.4 : bz + 2.6;
          if (clear(x, z, 0)) { c.cars.push({ x, z, yaw: rng() < 0.5 ? 0 : Math.PI, state: rng() < 0.12 ? 'warm' : 'cold', paint: Math.floor(rng() * 6) }); c.block.push(x, z, 2.4); }
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
  // a burnt-out farmstead: house, barn, a car, trees
  if (f.type < 4 && !f.pond && rnd(ci, cj, 5) < 0.12) {
    const hx = x0 + 40 + rng() * 70, hz = z0 + 40 + rng() * 70;
    if (clear(hx, hz, 22)) {
      const turn = rng() < 0.5;
      ruin(hx, hz, turn ? 8 : 11, turn ? 11 : 8, { wc: Math.floor(rng() * 7), burning: rng() < 0.2 });
      ruin(hx + (turn ? 0 : 24), hz + (turn ? 24 : 0), turn ? 12 : 20, turn ? 20 : 12, { wc: 7, tall: 1.6 });
      for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) tree(hx + (rng() - 0.5) * 50, hz + (rng() - 0.5) * 50, 1.1);
      if (rng() < 0.7) {
        const cx = hx + (turn ? 9 : 0), cz = hz + (turn ? 0 : 10);
        c.cars.push({ x: cx, z: cz, yaw: rng() * TAU, state: rng() < 0.4 ? 'warm' : 'cold', paint: Math.floor(rng() * 6) });
        c.block.push(cx, cz, 3);
      }
      c.lamps.push({ x: hx + (turn ? 6 : -8), z: hz + (turn ? -8 : 6), dx: 0, dz: 0, h: 5.5 });
    }
  }
  if (f.type === 3 && rng() < 0.55) {                             // round bales on the stubble
    const n = 6 + Math.floor(rng() * 10), bx = x0 + 20 + rng() * 80, bz = z0 + 20 + rng() * 80, a = rng() * TAU;
    for (let k = 0; k < n; k++) {
      const x = bx + Math.cos(a) * k * 7 + (rng() - 0.5) * 2, z = bz + Math.sin(a) * k * 7 + (rng() - 0.5) * 2;
      if (clear(x, z, 2)) { c.bales.push({ x, z, yaw: rng() * TAU }); c.block.push(x, z, 1.1); }
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
      c.cars.push({ x, z, yaw: yaw + (rng() < 0.5 ? Math.PI : 0) + (rng() - 0.5) * 0.5, state: r < 0.2 ? 'burning' : r < 0.45 ? 'warm' : 'cold', paint: Math.floor(rng() * 6) });
      c.block.push(x, z, 3);
    }
  }
  if (contentCache.size > 5000) contentCache.clear();
  contentCache.set(key, c);
  return c;
}

/* -------------------------------------------------- filling the instance pools */
const ACTIVE = { ci: 1e9, cj: 1e9, fires: [], lights: [], cells: [] };
const VIEW_CELLS = 3;
function rebuildScenery(cx, cz) {
  const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
  if (ci === ACTIVE.ci && cj === ACTIVE.cj) return;
  ACTIVE.ci = ci; ACTIVE.cj = cj; ACTIVE.fires = []; ACTIVE.lights = []; ACTIVE.cells = [];
  for (const k in POOLS) POOLS[k].n = 0;
  const poleLines = new Map(), L = ACTIVE.lights;
  for (let j = cj - VIEW_CELLS; j <= cj + VIEW_CELLS; j++) for (let i = ci - VIEW_CELLS; i <= ci + VIEW_CELLS; i++) {
    const c = cellContent(i, j);
    ACTIVE.cells.push(c);
    for (const t of c.trees) {
      const h = (t.kind === 2 ? 13 : 9) * t.s, r = (t.kind === 2 ? 2.6 : 3.4) * t.s;
      put('cylV', t.x, 0, t.z, 0, 0.28 * t.s, h * (t.kind === 2 ? 0.35 : 0.55), 0.28 * t.s, 0, t.seed);
      if (t.kind === 2) {
        for (let k = 0; k < 3; k++) put('cone', t.x, h * (0.18 + k * 0.22), t.z, t.seed + k, r * (1 - k * 0.22), h * (0.42 - k * 0.04), r * (1 - k * 0.22), 0, t.seed + k * 7, t.heat);
      } else {
        const kind = t.kind === 1 ? 1 : 0, rg = mulberry(t.seed * 31 + 7);
        putBall(t.x, h * 0.66, t.z, r, kind, t.seed, t.heat, 0.92);
        for (let k = 0; k < 4; k++) {
          const a = rg() * TAU, d = r * (0.5 + rg() * 0.25);
          putBall(t.x + Math.cos(a) * d, h * (0.5 + rg() * 0.25), t.z + Math.sin(a) * d, r * (0.5 + rg() * 0.2), kind, t.seed + k + 1, t.heat, 0.92);
        }
      }
    }
    for (const f of c.fires) ACTIVE.fires.push(f);
    for (const p of c.props) put(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11], p[12]);
    for (const f of c.fences) put('box', f[0], 0, f[1], 0, f[2], f[4], f[3], 2, f[5]);
    for (const v of c.cars) {
      const ca = Math.cos(v.yaw), sa = Math.sin(v.yaw), st = v.state === 'burning' ? 2 : v.state === 'warm' ? 1 : 0;
      const at = (lx, lz) => [v.x + lx * ca + lz * sa, v.z - lx * sa + lz * ca];
      put('box', v.x, 0.35, v.z, v.yaw, 4.3, 0.8, 1.8, 3, v.paint * 13 + 1, v.paint, st);
      const cab = at(-0.3, 0);
      put('box', cab[0], 1.15, cab[1], v.yaw, 2.3, 0.65, 1.62, 4, v.paint * 7 + 3, v.paint, st);
      for (const lx of [-1.35, 1.35]) for (const lz of [-0.82, 0.82]) { const w = at(lx, lz); put('cylH', w[0], 0.36, w[1], v.yaw, 0.36, 0.36, 0.24, 3, 1); }
      if (st === 2) { ACTIVE.fires.push({ x: v.x, y: 1, z: v.z, seed: Math.floor(v.x * 7 + v.z * 13), big: false }); }
    }
    for (const b of c.bales) put('cylH', b.x, 0.85, b.z, b.yaw, 0.85, 0.85, 1.3, 4, 1);
    for (const lp of c.lamps) {
      put('cylV', lp.x, 0, lp.z, 0, 0.11, lp.h, 0.11, 2, 0);
      const hx = lp.x + lp.dx * 1.1, hz = lp.z + lp.dz * 1.1;
      put('box', (lp.x + hx) / 2, lp.h - 0.1, (lp.z + hz) / 2, 0, Math.abs(lp.dx) * 1.1 + 0.12, 0.12, Math.abs(lp.dz) * 1.1 + 0.12, 0, 0, 1);
      put('box', hx, lp.h - 0.35, hz, 0, 0.55, 0.3, 0.55, 7, 0);
      L.push({ x: hx, y: lp.h - 0.5, z: hz, r: 17, c: [1, 0.8, 0.52], I: 2.2, kind: 'lamp', spot: [0, -1, 0, 0.18, 0.62], air: 1 });
    }
    for (const p of c.poles) {
      put('cylV', p.x, 0, p.z, 0, 0.16, 10, 0.16, 1, 0);
      const arm = p.line[0] === 'x';
      put('box', p.x, 9.2, p.z, 0, arm ? 2.4 : 0.16, 0.16, arm ? 0.16 : 2.4, 8, 0);
      if (!poleLines.has(p.line)) poleLines.set(p.line, []);
      poleLines.get(p.line).push(p);
    }
  }
  for (const k in POOLS) {
    const P = POOLS[k];
    P.geo.instanceCount = P.n;
    for (const a in P.A) P.A[a].needsUpdate = true;
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
  for (const f of ACTIVE.fires) L.push({ x: f.x, y: f.y + 1.5, z: f.z, r: f.big ? 24 : 15, c: [1, 0.5, 0.18], I: f.big ? 2.6 : 1.8, kind: 'fire', seed: f.seed, air: 0.8 });
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
  const span = Math.max(VIEW.W, VIEW.H * 2.4) / KPX * 1.6 + 60;
  ground.scale.set(span, 1, span);
  ground.position.set(cx, 0, cz);
  ground.updateMatrixWorld();
}
