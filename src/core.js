/* Sky Reaper core. The world is pixel art: it is drawn at "art" resolution (one art pixel covers
 * S x S screen pixels) by an orthographic camera at the 2:1 angle pixel artists use, so a metre
 * along a world axis is exactly 4 pixels across and 2 down. The camera only moves in whole art
 * pixels, so nothing shimmers. Each frame the scene is drawn twice into a G-buffer (colour, then
 * normal / depth / heat), then either lit as a moonlit night (colour mode, look.js) or read as heat
 * by a thermal camera (black and white). */

// three.js comes from a CDN. Without it there is no game: say so instead of hanging on the loading line.
// (The build wraps every file in one function, so this return stops all of it.)
if (typeof THREE === 'undefined') {
  document.getElementById('loading').hidden = true;
  const note = document.getElementById('noGl');
  note.textContent = 'The 3D engine did not load. Check your connection, then reload the page.';
  note.hidden = false;
  document.getElementById('startBtn').disabled = true;
  return;
}

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;
function hash32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
const rnd = (a, b, c) => hash32(Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 982451653)) / 4294967296;
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- palette
 * Daylight colours of every surface (sRGB). The night comes from the lighting, not from here. */
const PAL = {
  grass: '#5f8452', grassDk: '#46674a', grassLt: '#80a35c', lawn: '#668f52', lawnDk: '#557b47', lawnLt: '#7aa45c',
  soil: '#6a4834', soilDk: '#4c3428', dirt: '#7d5c3e', mud: '#5b4332', gravel: '#8a8478',
  stubble: '#a8935e', stubbleDk: '#8a7848', crop: '#5c7a3c', cropDk: '#46602e',
  asphalt: '#56575f', asphaltDk: '#46474f', asphaltLt: '#696a72', paintW: '#d8d4c4', paintY: '#d8b84a',
  concrete: '#a4a196', concreteDk: '#86847a', curb: '#bab7ac',
  brick: '#8e5a48', brickDk: '#6c4335', plaster: '#dccca8', sidingW: '#d2d0c4', sidingB: '#7f97ad', sidingY: '#d2b878', sidingG: '#8fa08a',
  woodLt: '#a8784c', wood: '#83573a', woodDk: '#553626', trim: '#e6e2d6',
  slate: '#5e5c78', slateDk: '#4a4862', roofR: '#8a4a3c', roofRDk: '#6c372d', roofB: '#4f5a66', roofBDk: '#3e4752', shingle: '#6c6560', shingleDk: '#55504c',
  bark: '#6d5242', pine: '#3f6c4e', pineDk: '#2e5242', leaf: '#4f7f3a', leafDk: '#3b6534', leafLt: '#6f9c46', autumn: '#b86a30', autumnDk: '#8e4a26',
  iron: '#3c3c48', ironLt: '#8a8a9c', steel: '#6a6e78', hay: '#c8a860', hayDk: '#a08446',
  carR: '#8e3a34', carB: '#3d5a86', carC: '#cfc4a4', carG: '#4d6b4a', carW: '#c4c8cc', carK: '#2c2e36',
  rust: '#7a4a2e', tire: '#26242c', glass: '#2a3346', soot: '#2b2826', ash: '#4a4642',
  fence: '#7a6048', fenceW: '#c8c4b8', water: '#2d4a5e', pool: '#3f8aa8',
  blood: '#8a1f1c', gore: '#5a1414', bone: '#e8e0cc', hair: '#2e2622', boot: '#2b2724',
  winGlow: '#ffc469', lampGlow: '#ffe9a8', fireGlow: '#ff9a3c',
};
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const GLSL_PAL = Object.keys(PAL).map((k) => { const c = hexRGB(PAL[k]); return `const vec3 P_${k} = vec3(${c.map((v) => v.toFixed(4)).join(', ')});`; }).join('\n');

/* ----------------------------------------------------------------- camera
 * Orthographic, looking north-west and 30 degrees down. CV points from the ground towards the
 * camera, CR is screen right, CU screen up. One art pixel is 1/KPX metres on the screen plane. */
const ELEV = Math.PI / 6, SE = Math.sin(ELEV), CE = Math.cos(ELEV), R2 = Math.SQRT1_2;
const CV = new THREE.Vector3(CE * R2, SE, CE * R2);
const CR = new THREE.Vector3(R2, 0, -R2);
const CU = new THREE.Vector3(-SE * R2, CE, -SE * R2);
const KPX = 4 / R2;                       // 1 m east = 4 px right and 2 px down
// the moon: direction towards it, and its camera's right and up
const LD = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
const LR = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), LD).normalize();
const LU = new THREE.Vector3().crossVectors(LD, LR);

// S: screen pixels per art pixel; W x H: the art frame; L: lighting pixels per art pixel
const VIEW = { S: 2, W: 960, H: 540, L: 2, dw: 1920, dh: 1080, pu: 0, pv: 0, T: new THREE.Vector3(), aim: new THREE.Vector3() };
// art pixel (x right, y down from the top-left) of a world point
function toArt(x, y, z, out) {
  out = out || [0, 0];
  out[0] = (x * CR.x + z * CR.z) * KPX - VIEW.pu + VIEW.W / 2;
  out[1] = VIEW.H / 2 - ((x * CU.x + y * CU.y + z * CU.z) * KPX - VIEW.pv);
  return out;
}
// the ground point under an art pixel
function groundAtArt(ax, ay, out) {
  const u = (ax - VIEW.W / 2 + VIEW.pu) / KPX, v = (VIEW.H / 2 - ay + VIEW.pv) / KPX;
  // P = u CR + v CU + t CV with P.y = 0
  const t = -(v * CU.y) / CV.y;
  out = out || new THREE.Vector3();
  return out.set(u * CR.x + v * CU.x + t * CV.x, 0, u * CR.z + v * CU.z + t * CV.z);
}

/* -------------------------------------------------------------- renderer */
const R3 = { renderer: null, scene: null, camera: null, moonCam: null, ok: false, lightBudget: 2.3e6 };
const U = {
  uPass: { value: 0 },
  uCR: { value: CR }, uCU: { value: CU }, uCV: { value: CV }, uLD: { value: LD }, uLR: { value: LR }, uLU: { value: LU },
  uT: { value: new THREE.Vector3() },
  uPix: { value: new THREE.Vector2() },
  uK: { value: KPX },
  uTime: { value: 0 },
  uThermal: { value: 0 },
  uCursor: { value: new THREE.Vector2(-1e4, -1e4) },     // the crosshair, art pixels from the bottom left
  uCutR: { value: 26 },
};
function initRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.get('EXT_color_buffer_float')) return false;
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  R3.renderer = renderer;
  R3.scene = new THREE.Scene();
  R3.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 400, 1600);
  R3.moonCam = new THREE.OrthographicCamera(-200, 200, 200, -200, 200, 1800);
  R3.ok = true;
  return true;
}

/* ------------------------------------------------- view: size, zoom, snapping */
let zoomStep = 0;
function sizeView(cssW, cssH, dpr) {
  const dw = Math.max(2, Math.round(cssW * dpr)), dh = Math.max(2, Math.round(cssH * dpr));
  const S0 = clamp(Math.round(dh / 400), 1, 8), S = Math.max(1, S0 + zoomStep);
  // even sizes, so the middle of the frame falls between pixels and sprites land on whole pixels
  const W = Math.ceil(dw / S / 2) * 2, H = Math.ceil(dh / S / 2) * 2;
  let L = 1;
  for (let l = S; l >= 1; l--) if (S % l === 0 && W * H * l * l <= R3.lightBudget) { L = l; break; }
  const changed = W !== VIEW.W || H !== VIEW.H || S !== VIEW.S || L !== VIEW.L || dw !== VIEW.dw || dh !== VIEW.dh;
  Object.assign(VIEW, { S, W, H, L, dw, dh });
  if (!changed && R3.targets) return false;
  R3.renderer.setSize(W * S, H * S, false);
  R3.canvasCss = [W * S / dpr, H * S / dpr];
  const c = R3.camera;
  c.left = -W / 2 / KPX; c.right = W / 2 / KPX; c.top = H / 2 / KPX; c.bottom = -H / 2 / KPX;
  c.updateProjectionMatrix();
  makeTargets();
  return true;
}
// point the camera at the ground point (x, z), moved to the nearest whole art pixel
function setView(x, z) {
  const u = (x * CR.x + z * CR.z) * KPX, v = (x * CU.x + z * CU.z) * KPX;
  const pu = Math.round(u), pv = Math.round(v);
  VIEW.pu = pu; VIEW.pv = pv;
  const T = VIEW.T.set(x, 0, z).addScaledVector(CR, (pu - u) / KPX).addScaledVector(CU, (pv - v) / KPX);
  const c = R3.camera;
  c.position.copy(T).addScaledVector(CV, 1000);
  c.up.set(0, 1, 0);
  c.lookAt(T);
  c.updateMatrixWorld();
  U.uT.value.copy(T);
  // global pixel of art pixel (0, 0): stable as the camera moves, so per-pixel patterns stay put
  U.uPix.value.set(pu - VIEW.W / 2, pv - VIEW.H / 2);
  // the moon's camera covers the view, snapped to its own texels
  const m = R3.moonCam, span = Math.max(VIEW.W, VIEW.H * 2.2) / KPX * 0.62 + 30;
  const texel = span * 2 / SHADOW_RES;
  const mu = Math.round((x * LR.x + z * LR.z) / texel) * texel, mv = Math.round((x * LU.x + z * LU.z) / texel) * texel;
  const M0 = new THREE.Vector3().addScaledVector(LR, mu).addScaledVector(LU, mv);
  const along = (x * LD.x + z * LD.z);
  M0.addScaledVector(LD, along - (M0.x * LD.x + M0.y * LD.y + M0.z * LD.z));
  m.left = -span; m.right = span; m.top = span; m.bottom = -span;
  m.updateProjectionMatrix();
  m.position.copy(M0).addScaledVector(LD, 1000);
  m.up.copy(LU);
  m.lookAt(M0);
  m.updateMatrixWorld();
  R3.moonSpan = span;
}

/* ---------------------------------------------------------------- targets */
const SHADOW_RES = 2048;
function target(w, h, opt) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), Object.assign({
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false,
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
  }, opt || {}));
  t.texture.generateMipmaps = false;
  return t;
}
function makeTargets() {
  const T0 = R3.targets;
  if (T0) for (const k in T0) T0[k].dispose();
  const W = VIEW.W, H = VIEW.H, L = VIEW.L, lw = W * L, lh = H * L;
  const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  R3.targets = {
    // the G-buffer: depth with stencil, because three's depth-only buffers are 16 bits
    gA: target(W, H, { type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: true }),
    gB: target(W, H, { type: THREE.FloatType, depthBuffer: true, stencilBuffer: true }),
    hdr: target(lw, lh, lin),
    b1: target(lw / 2, lh / 2, lin), b1t: target(lw / 2, lh / 2, lin),
    b2: target(lw / 4, lh / 4, lin), b2t: target(lw / 4, lh / 4, lin),
    b3: target(lw / 8, lh / 8, lin), b3t: target(lw / 8, lh / 8, lin),
    dof: target(lw / 2, lh / 2, lin),
    th: target(W, H), thS: target(W / 2, H / 2, lin), thT: target(W / 2, H / 2, lin), thG: target(W / 4, H / 4, lin), thGt: target(W / 4, H / 4, lin),
  };
  if (!R3.shadow) R3.shadow = target(SHADOW_RES, SHADOW_RES, { type: THREE.FloatType, depthBuffer: true, stencilBuffer: true });
}

/* ------------------------------------------------------------ GLSL chunks */
const GLSL_NOISE = `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
  float bayer4(vec2 g) {
    ivec2 q = ivec2(mod(g, 4.0));
    int i = q.y * 4 + q.x;
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i] + 0.5) / 16.0;
  }
`;
// Every G-buffer material ends with gOut. Pass 0 writes colour and a class (200 lit, 210 foliage,
// 220 metal, 1-127 glowing with that brightness), pass 1 the normal seen from the camera, depth
// towards the camera and heat, pass 2 depth towards the moon (shadows).
const GLSL_GB = GLSL_NOISE + GLSL_PAL + `
  uniform int uPass;
  uniform vec3 uCR, uCU, uCV, uLD, uT;
  uniform vec2 uPix, uCursor;
  uniform float uK, uTime, uThermal, uCutR;
  vec2 gpix() { return floor(gl_FragCoord.xy) + uPix; }
  // leaves thin out round the crosshair, so nothing under a tree is hidden from the gunner
  bool cutHere() { vec2 d = gl_FragCoord.xy - uCursor; return dot(d, d) < uCutR * uCutR && bayer4(gl_FragCoord.xy) < 0.75; }
  float phash(float s) { return hash12(gpix() * 0.7071 + s * 17.31); }
  vec3 tex(vec3 c, float t) { return c * (t > 0.5 ? 1.08 : t < -0.5 ? 0.87 : 1.0); }
  vec4 gOut(vec3 alb, float cls, vec3 n, vec3 P, float heat) {
    if (uPass == 0) return vec4(alb, cls / 255.0);
    if (uPass == 1) return vec4(dot(n, uCR), dot(n, uCU), dot(P - uT, uCV), heat);
    return vec4(dot(P, uLD), 0.0, 0.0, 1.0);
  }
`;
// billboards: a sprite standing at A, w x h art pixels, its feet on whole pixels; corner in [0,1]^2.
// Upright sprites lean back with height (so a wall in front still hides their legs only); flat ones lie on the ground.
const GLSL_BILL = `
  uniform int uPass;
  uniform vec3 uCR, uCU, uCV, uLR, uLU, uT;
  uniform vec2 uPix;
  uniform float uK;
  vec3 billboard(vec3 A, vec2 size, vec2 anchor, vec2 corner, float isFlat) {
    vec3 R = uPass == 2 ? uLR : uCR;
    if (uPass != 2) {
      float ax = dot(A - uT, uCR) * uK, ay = dot(A - uT, uCU) * uK;
      A += uCR * ((floor(ax - anchor.x + 0.5) - (ax - anchor.x)) / uK) + uCU * ((floor(ay - anchor.y + 0.5) - (ay - anchor.y)) / uK);
    }
    vec2 o = (corner * size - anchor) / uK;
    vec3 up = isFlat > 0.5 ? normalize(vec3(-uCV.x, 0.0, -uCV.z)) / ${SE.toFixed(6)} : vec3(0.0, 1.0 / ${CE.toFixed(6)}, 0.0);
    return A + R * o.x + up * o.y + (isFlat > 0.5 || uPass == 2 ? vec3(0.0) : uCV * 0.04);
  }
`;

/* -------------------------------------------------- full-screen passes */
const PASS = { scene: null, cam: null, quad: null };
function initPasses() {
  PASS.scene = new THREE.Scene();
  PASS.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  PASS.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  PASS.quad.frustumCulled = false;
  PASS.scene.add(PASS.quad);
}
function passMat(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
  });
}
function runPass(mat, rt) {
  PASS.quad.material = mat;
  R3.renderer.setRenderTarget(rt || null);
  R3.renderer.render(PASS.scene, PASS.cam);
}
