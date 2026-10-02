/* Sky Reaper core: the renderer and the thermal camera's image chain. The scene renders heat, not
 * colour: every material writes a temperature. The sensor then maps heat to grey the way a real
 * FLIR does: automatic gain (contrast follows the scene, so a big fire dims everything else),
 * unsharp-mask halos, glow on hot spots, grain and fixed-pattern noise, vignette, white or black hot. */

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

// noise shared by every shader
const GLSL_NOISE = `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;
// every scene shader ends with this: heat stored halved (0..2 fits an 8-bit target), with air haze
const U = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uHaze: { value: new THREE.Vector2(0.00032, 0.3) },     // density per metre beyond 900 m, haze heat
  uSrc: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 1, 0)) },   // heat sources: x, z, radius, heat
  uNSrc: { value: 0 },
};
const GLSL_OUT = `
  uniform vec3 uCamPos;
  uniform vec2 uHaze;
  vec4 heatOut(float h, vec3 wp) {
    float d = max(0.0, distance(wp, uCamPos) - 900.0);
    h = mix(h, uHaze.y, 1.0 - exp(-d * uHaze.x));
    return vec4(vec3(h * 0.5), 1.0);
  }
`;
// heat thrown onto nearby surfaces by fires and blasts
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

/* -------------------------------------------------------------- renderer */
const R3 = { renderer: null, scene: null, camera: null, w: 1, h: 1, dpr: 1, ok: false, half: false };
function initRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.setPixelRatio(1);
  renderer.autoClear = true;
  renderer.setClearColor(0x4d4d4d, 1);
  const gl2 = renderer.capabilities.isWebGL2;
  const float = gl2 ? !!renderer.extensions.get('EXT_color_buffer_float') : !!renderer.extensions.get('OES_texture_half_float');
  R3.renderer = renderer; R3.gl2 = gl2; R3.float = float;
  R3.scene = new THREE.Scene();
  R3.camera = new THREE.PerspectiveCamera(9, 16 / 9, 40, 7000);
  R3.ok = true;
  buildPost();
  return true;
}

/* ------------------------------------------------------------ image chain */
const POST = {};
function rt(w, h, opt) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), Object.assign({
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false,
    type: R3.float ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat,
  }, opt || {}));
  t.texture.generateMipmaps = false;
  return t;
}
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
  });
  return m;
}
function buildPost() {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quad.frustumCulled = false;
  POST.scene = new THREE.Scene(); POST.scene.add(quad); POST.quad = quad;
  POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.s1 = rt(128, 72, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.s2 = rt(16, 9, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.s3 = rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.agcA = rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.agcB = rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.fresh = true;
  // heat statistics: mean, mean of squares, max over blocks of the frame
  POST.stat0 = pass(`
    uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;
    void main() {
      float s = 0.0, s2 = 0.0, m = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        float h = texture2D(tSrc, vUv + (vec2(float(i), float(j)) - 1.5) * uStep).r * 2.0;
        s += h; s2 += h * h; m = max(m, h);
      }
      gl_FragColor = vec4(s / 16.0, s2 / 16.0, m, 1.0);
    }`, { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } });
  POST.stat1 = pass(`
    uniform sampler2D tSrc; uniform vec2 uSize; uniform float uN; varying vec2 vUv;
    void main() {
      vec4 acc = vec4(0.0); float m = 0.0;
      vec2 base = floor(gl_FragCoord.xy) * uN;
      for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
        if (float(i) >= uN || float(j) >= uN) continue;
        vec4 v = texture2D(tSrc, (base + vec2(float(i), float(j)) + 0.5) / uSize);
        acc += v; m = max(m, v.b);
      }
      acc /= uN * uN;
      gl_FragColor = vec4(acc.r, acc.g, m, 1.0);
    }`, { tSrc: { value: null }, uSize: { value: new THREE.Vector2() }, uN: { value: 8 } });
  POST.stat2 = pass(`
    uniform sampler2D tSrc; varying vec2 vUv;
    void main() {
      vec4 acc = vec4(0.0); float m = 0.0;
      for (int j = 0; j < 9; j++) for (int i = 0; i < 16; i++) {
        vec4 v = texture2D(tSrc, (vec2(float(i), float(j)) + 0.5) / vec2(16.0, 9.0));
        acc += v; m = max(m, v.b);
      }
      acc /= 144.0;
      gl_FragColor = vec4(acc.r, acc.g, m, 1.0);
    }`, { tSrc: { value: null } });
  // the gain follows the scene with a lag, like a camera's AGC
  POST.agc = pass(`
    uniform sampler2D tCur, tPrev; uniform float uRate; varying vec2 vUv;
    void main() { gl_FragColor = mix(texture2D(tPrev, vec2(0.5)), texture2D(tCur, vec2(0.5)), uRate); }`,
    { tCur: { value: null }, tPrev: { value: null }, uRate: { value: 1 } });
  // heat -> grey through the gain
  POST.map = pass(`
    uniform sampler2D tSrc, tAgc; varying vec2 vUv;
    void main() {
      vec4 a = texture2D(tAgc, vec2(0.5));
      float mean = a.r, sd = sqrt(max(a.g - a.r * a.r, 0.0));
      sd = clamp(mix(sd, 0.05, 0.3), 0.035, 0.3);
      float lo = mean - 2.0 * sd, hi = mean + 3.4 * sd;
      float v = (texture2D(tSrc, vUv).r * 2.0 - lo) / (hi - lo);
      gl_FragColor = vec4(v, clamp((v - 1.0) * 0.125, 0.0, 1.0), 0.0, 1.0);     // grey, and how far past white
    }`, { tSrc: { value: null }, tAgc: { value: null } });
  POST.down = pass(`
    uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
    void main() {
      vec4 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5))
        + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)));
      if (uThr > 0.0) c = vec4(max(c.g * 8.0 - uThr, 0.0) * 0.12);       // glow: only what is far past white
      gl_FragColor = c;
    }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0 } });
  POST.blur = pass(`
    uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tSrc, vUv) * 0.227027;
      c += (texture2D(tSrc, vUv + uDir) + texture2D(tSrc, vUv - uDir)) * 0.1945946;
      c += (texture2D(tSrc, vUv + uDir * 2.0) + texture2D(tSrc, vUv - uDir * 2.0)) * 0.1216216;
      c += (texture2D(tSrc, vUv + uDir * 3.0) + texture2D(tSrc, vUv - uDir * 3.0)) * 0.054054;
      c += (texture2D(tSrc, vUv + uDir * 4.0) + texture2D(tSrc, vUv - uDir * 4.0)) * 0.016216;
      gl_FragColor = c;
    }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  POST.final = pass(`
    uniform sampler2D tDisp, tSoft, tGlow; uniform vec2 uRes; uniform float uTime, uInvert, uFlash, uStatic, uFocus;
    varying vec2 vUv;
    ` + GLSL_NOISE + `
    void main() {
      float d = texture2D(tDisp, vUv).r, soft = texture2D(tSoft, vUv).r;
      d = mix(d, soft, 0.1 + uFocus * 0.8) + (d - soft) * 0.8 * (1.0 - uFocus);   // optics, then the sensor's sharpening halo
      d += texture2D(tGlow, vUv).r * 0.9;                                        // hot spots bloom
      d = mix(d, 1.0, uFlash);
      vec2 px = vUv * uRes;
      d += (hash12(px + fract(uTime * 13.7) * 311.0) - 0.5) * 0.045;           // sensor noise
      d += (hash12(vec2(floor(px.x), 7.0)) - 0.5) * 0.016;                       // column pattern
      d = mix(d, hash12(px * 0.7 + floor(uTime * 24.0) * 17.0), uStatic);
      d = clamp(d, 0.0, 1.0);
      d = mix(d, 1.0 - d, uInvert);
      vec2 c = vUv - 0.5; c.x *= uRes.x / uRes.y;
      d *= 1.0 - 0.32 * dot(c, c);
      gl_FragColor = vec4(vec3(d), 1.0);
    }`, { tDisp: { value: null }, tSoft: { value: null }, tGlow: { value: null }, uRes: { value: new THREE.Vector2() },
    uTime: { value: 0 }, uInvert: { value: 0 }, uFlash: { value: 0 }, uStatic: { value: 0 }, uFocus: { value: 0 } });
}
function resizeRenderer(cssW, cssH, dpr) {
  const w = Math.max(2, Math.round(cssW * dpr)), h = Math.max(2, Math.round(cssH * dpr));
  if (w === R3.w && h === R3.h && POST.scn) return;
  R3.w = w; R3.h = h; R3.dpr = dpr;
  R3.renderer.setSize(w, h, false);
  R3.camera.aspect = w / h;
  R3.camera.updateProjectionMatrix();
  for (const k of ['scn', 'disp', 'h1', 'h2', 'q1', 'q2', 'e1', 'e2']) if (POST[k]) POST[k].dispose();
  // depth with stencil, because three makes a depth-only buffer 16 bits: too coarse at 1.2 km
  if (R3.gl2) {
    POST.scn = new THREE.WebGLMultisampleRenderTarget(w, h, { type: R3.float ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: true });
    POST.scn.samples = 4;
  } else POST.scn = rt(w, h, { depthBuffer: true, stencilBuffer: true });
  POST.disp = rt(w, h, { type: THREE.UnsignedByteType });
  POST.h1 = rt(w / 2, h / 2); POST.h2 = rt(w / 2, h / 2);
  POST.q1 = rt(w / 4, h / 4); POST.q2 = rt(w / 4, h / 4);
  POST.e1 = rt(w / 8, h / 8); POST.e2 = rt(w / 8, h / 8);
}
function runPass(mat, target) {
  POST.quad.material = mat;
  R3.renderer.setRenderTarget(target);
  R3.renderer.render(POST.scene, POST.cam);
}
// render the scene and develop the thermal image; f: { time, dt, invert, flash, static, focus }
function renderFrame(f) {
  const r = R3.renderer, P = POST;
  r.setRenderTarget(P.scn);
  r.render(R3.scene, R3.camera);
  // gain statistics
  P.stat0.uniforms.tSrc.value = P.scn.texture; P.stat0.uniforms.uStep.value.set(1 / R3.w * (R3.w / 128 / 4), 1 / R3.h * (R3.h / 72 / 4));
  runPass(P.stat0, P.s1);
  P.stat1.uniforms.tSrc.value = P.s1.texture; P.stat1.uniforms.uSize.value.set(128, 72); P.stat1.uniforms.uN.value = 8;
  runPass(P.stat1, P.s2);
  P.stat2.uniforms.tSrc.value = P.s2.texture;
  runPass(P.stat2, P.s3);
  P.agc.uniforms.tCur.value = P.s3.texture; P.agc.uniforms.tPrev.value = P.agcA.texture;
  P.agc.uniforms.uRate.value = P.fresh ? 1 : 1 - Math.exp(-f.dt * 2.5);
  runPass(P.agc, P.agcB);
  P.fresh = false;
  const t = P.agcA; P.agcA = P.agcB; P.agcB = t;
  // heat -> grey
  P.map.uniforms.tSrc.value = P.scn.texture; P.map.uniforms.tAgc.value = P.agcA.texture;
  runPass(P.map, P.disp);
  // a soft copy for the optics and the halo, and the glow of hot spots
  P.down.uniforms.tSrc.value = P.disp.texture; P.down.uniforms.uTexel.value.set(1 / R3.w, 1 / R3.h); P.down.uniforms.uThr.value = 0;
  runPass(P.down, P.h1);
  P.blur.uniforms.tSrc.value = P.h1.texture; P.blur.uniforms.uDir.value.set(1 / P.h1.width, 0); runPass(P.blur, P.h2);
  P.blur.uniforms.tSrc.value = P.h2.texture; P.blur.uniforms.uDir.value.set(0, 1 / P.h1.height); runPass(P.blur, P.h1);
  P.down.uniforms.tSrc.value = P.h1.texture; P.down.uniforms.uTexel.value.set(1 / P.h1.width, 1 / P.h1.height); P.down.uniforms.uThr.value = 2.5;
  runPass(P.down, P.q1);
  P.blur.uniforms.tSrc.value = P.q1.texture; P.blur.uniforms.uDir.value.set(1.5 / P.q1.width, 0); runPass(P.blur, P.q2);
  P.blur.uniforms.tSrc.value = P.q2.texture; P.blur.uniforms.uDir.value.set(0, 1.5 / P.q1.height); runPass(P.blur, P.q1);
  P.down.uniforms.tSrc.value = P.q1.texture; P.down.uniforms.uTexel.value.set(1 / P.q1.width, 1 / P.q1.height); P.down.uniforms.uThr.value = 0;
  runPass(P.down, P.e1);
  P.blur.uniforms.tSrc.value = P.e1.texture; P.blur.uniforms.uDir.value.set(2 / P.e1.width, 0); runPass(P.blur, P.e2);
  P.blur.uniforms.tSrc.value = P.e2.texture; P.blur.uniforms.uDir.value.set(0, 2 / P.e1.height); runPass(P.blur, P.e1);
  const F = P.final.uniforms;
  F.tDisp.value = P.disp.texture; F.tSoft.value = P.h1.texture; F.tGlow.value = P.e1.texture;
  F.uRes.value.set(R3.w, R3.h); F.uTime.value = f.time; F.uInvert.value = f.invert ? 1 : 0;
  F.uFlash.value = f.flash || 0; F.uStatic.value = f.static || 0; F.uFocus.value = f.focus || 0;
  runPass(P.final, null);
}
