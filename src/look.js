/* The two looks of the same G-buffer.
 *
 * Colour: a moonlit night lit per pixel (after Isle Express): soft moon shadows from a shadow map,
 * ambient occlusion from depth, every lamp, window and fire with falloff, height fog the lamps glow
 * in, bloom, a touch of tilt-shift, filmic tone mapping and grading. Lighting runs at L pixels per
 * art pixel with depth and normals blended inside each surface, so light pools are smooth while
 * every art pixel stays a crisp square.
 *
 * Thermal: the heat channel through a camera's automatic gain, detail halo, glow on hot spots,
 * grain per art pixel and column noise; white hot or black hot. */

const LOOK = {
  exposure: 1.1, bloom: 0.34, dof: 0.18, fog: 0.045, air: 1.6, cloud: 0.35,
  moon: [0.21, 0.27, 0.52], ambSky: [0.032, 0.048, 0.095], ambGnd: [0.013, 0.015, 0.024], fogCol: [0.05, 0.068, 0.12],
};
const MAT = {};
const HEAD = GLSL_NOISE + `
  vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
`;
function initLook() {
  initPasses();
  const vec2 = () => ({ value: new THREE.Vector2() });
  MAT.light = passMat(HEAD + `
    uniform sampler2D tA, tB, tS, tL;
    uniform vec2 uArt, uShadowTexel;
    uniform float uLf, uK, uTime, uFog, uAir, uCloud;
    uniform vec3 uCR, uCU, uCV, uT, uLD, uMoon, uAmbSky, uAmbGnd, uFogCol;
    uniform mat4 uMoonVP;
    uniform int uNL;
    varying vec2 vUv;
    ivec2 cl(ivec2 q) { return clamp(q, ivec2(0), ivec2(uArt) - 1); }
    float dep(ivec2 q) { return texelFetch(tB, cl(q), 0).z; }
    float cls(ivec2 q) { return floor(texelFetch(tA, cl(q), 0).a * 255.0 + 0.5); }
    vec3 nrm(ivec2 q) { vec2 v = texelFetch(tB, cl(q), 0).xy; return v.x * uCR + v.y * uCU + sqrt(max(0.0, 1.0 - dot(v, v))) * uCV; }
    vec3 world(vec2 p, float d) { return uT + uCR * ((p.x - uArt.x * 0.5) / uK) + uCU * ((p.y - uArt.y * 0.5) / uK) + uCV * d; }
    float fogDens(vec3 P) {
      float n = fbm(P.xz * 0.04 + vec2(uTime * 0.025, -uTime * 0.016));
      float pocket = smoothstep(0.55, 0.8, vnoise(P.xz * 0.011 + 7.0));
      return uFog * (0.25 + 1.3 * n) * (1.0 + 1.8 * pocket * smoothstep(0.25, 0.7, n));
    }
    float moonVis(vec3 P, vec3 n) {
      vec4 c = uMoonVP * vec4(P + n * 0.12, 1.0);
      vec2 uv = c.xy * 0.5 + 0.5;
      if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1.0;
      float d = dot(P, uLD), s = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
        s += texture2D(tS, uv + vec2(float(i), float(j)) * uShadowTexel).r > d + 0.3 ? 0.0 : 1.0;
      return s / 9.0;
    }
    void main() {
      vec2 p = gl_FragCoord.xy / uLf;                     // art pixels, y up
      ivec2 ip = ivec2(floor(p));
      vec4 alb = texelFetch(tA, cl(ip), 0);
      float c = floor(alb.a * 255.0 + 0.5);
      float d0 = dep(ip);
      // inside one continuous surface, blend depth and normal between art pixels
      vec2 q = p - 0.5;
      ivec2 b0 = ivec2(floor(q)), b1 = b0 + ivec2(1, 0), b2 = b0 + ivec2(0, 1), b3 = b0 + ivec2(1, 1);
      vec2 w = q - floor(q);
      float da = dep(b0), db = dep(b1), dc = dep(b2), dd = dep(b3);
      bool sm = max(max(da, db), max(dc, dd)) - min(min(da, db), min(dc, dd)) < 1.0
        && cls(b0) == c && cls(b1) == c && cls(b2) == c && cls(b3) == c;
      float d = sm ? mix(mix(da, db, w.x), mix(dc, dd, w.x), w.y) : d0;
      vec3 n = normalize(sm ? mix(mix(nrm(b0), nrm(b1), w.x), mix(nrm(b2), nrm(b3), w.x), w.y) : nrm(ip));
      vec3 P = world(p, d);
      vec3 A = toLin(alb.rgb), col;
      if (c < 0.5) col = vec3(0.0);
      else if (c < 128.0) {
        col = A * (c / 127.0) * 7.0;                       // lamps, windows, fire
      } else {
        bool foliage = abs(c - 210.0) < 0.5, metal = abs(c - 220.0) < 0.5, living = abs(c - 230.0) < 0.5;
        float wrap = foliage ? 0.35 : 0.0;
        float vis = moonVis(P, n);
        // ambient occlusion from the depth buffer
        float occ = 0.0, rot = hash12(floor(p) + 0.5) * 6.283;
        for (int k = 0; k < 8; k++) {
          float a = float(k) * 2.39996 + rot, r = 1.5 + float(k) * 1.1;
          vec2 spt = p + vec2(cos(a), sin(a)) * r;
          vec3 v = world(spt, dep(ivec2(floor(spt)))) - P;
          float l = length(v);
          occ += max(0.0, dot(n, v) / (l + 1e-3) - 0.15) * smoothstep(4.0, 0.4, l);
        }
        float ao = clamp(1.0 - occ * 0.24, 0.3, 1.0);
        float cloud = 1.0 - uCloud * smoothstep(0.5, 0.74, fbm(P.xz * 0.014 + uTime * vec2(0.012, 0.007)));
        vec3 light = uMoon * max(0.0, (dot(n, uLD) + wrap) / (1.0 + wrap)) * vis * cloud;
        light += mix(uAmbGnd, uAmbSky, n.y * 0.5 + 0.5) * ao;
        vec3 spec = vec3(0.0);
        for (int k = 0; k < 64; k++) {
          if (k >= uNL) break;
          vec4 L0 = texelFetch(tL, ivec2(0, k), 0);
          vec3 lv = L0.xyz - P;
          float d2 = dot(lv, lv);
          if (d2 >= L0.w * L0.w) continue;
          vec4 L1 = texelFetch(tL, ivec2(1, k), 0), L2 = texelFetch(tL, ivec2(2, k), 0);
          float dl = sqrt(d2);
          vec3 l = lv / max(dl, 1e-3);
          float x = dl / L0.w, att = (1.0 - x * x) * (1.0 - x * x) / (1.0 + d2 * 0.05);
          if (L2.w > -1.5) att *= smoothstep(L2.w, texelFetch(tL, ivec2(3, k), 0).x, dot(-l, L2.xyz));
          light += L1.rgb * L1.a * att * max(0.0, (dot(n, l) + wrap) / (1.0 + wrap));
          if (metal) spec += L1.rgb * L1.a * att * pow(max(0.0, dot(n, normalize(l + uCV))), 36.0) * 2.0;
        }
        if (metal) spec += uMoon * vis * pow(max(0.0, dot(n, normalize(uLD + uCV))), 24.0) * 0.8;
        // the dead are lit by the gunship's illuminator (from the camera) and rimmed by the moon,
        // so they always read against the ground
        if (living) {
          float face = max(0.0, dot(n, uCV));
          light += vec3(0.62, 0.6, 0.55) * (0.55 + 0.45 * face) + uMoon * pow(1.0 - face, 2.0) * 2.5;
          ao = 1.0;
        }
        col = A * light * (0.55 + 0.45 * ao) + spec;
        // silhouettes: a moonlit rim on upper edges, a darker line under objects
        float e = 0.0;
        if (dep(ip + ivec2(0, 1)) < d0 - 1.2 || dep(ip + ivec2(-1, 0)) < d0 - 1.2) e = 1.0;
        else if (dep(ip + ivec2(0, -1)) < d0 - 1.2 || dep(ip + ivec2(1, 0)) < d0 - 1.2) e = -1.0;
        col *= 1.0 + 0.28 * e;
        if (e > 0.0) col += A * uMoon * 0.1;
      }
      // height fog, lit by the moon and by every lamp its ray passes
      const float TOP = 14.0, HF = 2.6;
      float sTop = max(0.0, (TOP - P.y) / uCV.y);
      float dens = fogDens(P);
      float od = dens * HF / uCV.y * (exp(-max(P.y, -2.0) / HF) - exp(-TOP / HF));
      float T = exp(-od);
      col = col * T + uFogCol * (1.0 - T);
      vec3 air = vec3(0.0);
      for (int k = 0; k < 64; k++) {
        if (k >= uNL) break;
        vec4 L0 = texelFetch(tL, ivec2(0, k), 0), L3 = texelFetch(tL, ivec2(3, k), 0);
        if (L3.y <= 0.0) continue;
        float R = L0.w * 0.8;
        float s0 = clamp(dot(L0.xyz - P, uCV), 0.0, sTop);
        vec3 C0 = P + uCV * s0;
        if (dot(L0.xyz - C0, L0.xyz - C0) >= R * R) continue;
        vec4 L1 = texelFetch(tL, ivec2(1, k), 0);
        float h = max(length(L0.xyz - C0), 0.3);
        float g = (atan((sTop - s0) / h) + atan(s0 / h)) / h;
        air += L1.rgb * L1.a * L3.y * g * (1.0 - h / R) * dens * exp(-max(C0.y, -2.0) / HF);
      }
      col += air * uAir;
      gl_FragColor = vec4(col, 1.0);
    }`, {
    tA: { value: null }, tB: { value: null }, tS: { value: null }, tL: { value: lightTex }, uArt: vec2(), uShadowTexel: vec2(),
    uLf: { value: 1 }, uK: { value: KPX }, uTime: { value: 0 }, uFog: { value: LOOK.fog }, uAir: { value: LOOK.air }, uCloud: { value: LOOK.cloud },
    uCR: { value: CR }, uCU: { value: CU }, uCV: { value: CV }, uT: U.uT, uLD: { value: LD },
    uMoon: { value: new THREE.Vector3(...LOOK.moon) }, uAmbSky: { value: new THREE.Vector3(...LOOK.ambSky) }, uAmbGnd: { value: new THREE.Vector3(...LOOK.ambGnd) },
    uFogCol: { value: new THREE.Vector3(...LOOK.fogCol) }, uMoonVP: { value: new THREE.Matrix4() }, uNL: { value: 0 },
  });
  MAT.down = passMat(`
    uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
    void main() {
      vec4 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5))
        + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)));
      if (uThr > 0.0) { float l = max(c.r, max(c.g, c.b)); c.rgb *= max(0.0, l - uThr) / max(l, 1e-4); }
      gl_FragColor = c;
    }`, { tSrc: { value: null }, uTexel: vec2(), uThr: { value: 0 } });
  MAT.blur = passMat(`
    uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tSrc, vUv) * 0.227027;
      c += (texture2D(tSrc, vUv + uDir) + texture2D(tSrc, vUv - uDir)) * 0.1945946;
      c += (texture2D(tSrc, vUv + uDir * 2.0) + texture2D(tSrc, vUv - uDir * 2.0)) * 0.1216216;
      c += (texture2D(tSrc, vUv + uDir * 3.0) + texture2D(tSrc, vUv - uDir * 3.0)) * 0.054054;
      c += (texture2D(tSrc, vUv + uDir * 4.0) + texture2D(tSrc, vUv - uDir * 4.0)) * 0.016216;
      gl_FragColor = c;
    }`, { tSrc: { value: null }, uDir: vec2() });
  MAT.final = passMat(HEAD + `
    uniform sampler2D tHDR, tDof, tB1, tB2, tB3;
    uniform vec2 uRes;
    uniform float uTime, uExposure, uBloom, uDof, uFlash, uStatic, uScale;
    varying vec2 vUv;
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec2 uv = vUv;
      ivec2 hp = ivec2(floor(gl_FragCoord.xy / uScale));             // the lighting pixel (crisp)
      vec3 sharp = texelFetch(tHDR, hp, 0).rgb;
      float coc = uDof * smoothstep(0.28, 0.5, abs(uv.y - 0.5));
      vec3 col = mix(sharp, texture2D(tDof, uv).rgb, coc);
      col += (texture2D(tB1, uv).rgb * 0.5 + texture2D(tB2, uv).rgb * 0.75 + texture2D(tB3, uv).rgb * 1.0) * uBloom;
      col += vec3(1.0, 0.85, 0.65) * uFlash;
      col = aces(col * uExposure);
      col = pow(col, vec3(1.0 / 2.2));
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.9, 0.99, 1.12), (1.0 - l) * 0.4);      // cool shadows
      col = mix(col, col * vec3(1.08, 1.0, 0.9), l * 0.3);               // warm highlights
      col = mix(vec3(l), col, 1.1);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
      vec2 v = (uv - 0.5) * vec2(1.2, 1.0);
      col *= 1.0 - 0.45 * pow(min(1.0, dot(v, v) * 1.6), 1.4);
      col += (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 91.7) - 0.5) * 0.024;
      col = mix(col, vec3(hash12(floor(gl_FragCoord.xy / 3.0) + floor(uTime * 24.0) * 17.0)), uStatic);
      gl_FragColor = vec4(col, 1.0);
    }`, { tHDR: { value: null }, tDof: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, uRes: vec2(),
    uTime: { value: 0 }, uExposure: { value: LOOK.exposure }, uBloom: { value: LOOK.bloom }, uDof: { value: LOOK.dof }, uFlash: { value: 0 },
    uStatic: { value: 0 }, uScale: { value: 1 } });

  /* ---------------- thermal */
  MAT.stat0 = passMat(`
    uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;
    void main() {
      float s = 0.0, s2 = 0.0, m = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        float h = min(texture2D(tSrc, vUv + (vec2(float(i), float(j)) - 1.5) * uStep).w, 1.0);   // fire must not wash out the dead
        s += h; s2 += h * h; m = max(m, h);
      }
      gl_FragColor = vec4(s / 16.0, s2 / 16.0, m, 1.0);
    }`, { tSrc: { value: null }, uStep: vec2() });
  MAT.stat1 = passMat(`
    uniform sampler2D tSrc; uniform vec2 uSize; uniform float uN; varying vec2 vUv;
    void main() {
      vec4 acc = vec4(0.0); float m = 0.0;
      vec2 base = floor(gl_FragCoord.xy) * uN;
      for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
        vec4 v = texture2D(tSrc, (base + vec2(float(i), float(j)) + 0.5) / uSize);
        acc += v; m = max(m, v.b);
      }
      acc /= uN * uN;
      gl_FragColor = vec4(acc.r, acc.g, m, 1.0);
    }`, { tSrc: { value: null }, uSize: vec2(), uN: { value: 8 } });
  MAT.stat2 = passMat(`
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
  MAT.agc = passMat(`
    uniform sampler2D tCur, tPrev; uniform float uRate; varying vec2 vUv;
    void main() { gl_FragColor = mix(texture2D(tPrev, vec2(0.5)), texture2D(tCur, vec2(0.5)), uRate); }`,
  { tCur: { value: null }, tPrev: { value: null }, uRate: { value: 1 } });
  // heat -> grey through the gain; how far past white, for the glow
  MAT.tmap = passMat(`
    uniform sampler2D tSrc, tAgc; varying vec2 vUv;
    void main() {
      vec4 a = texture2D(tAgc, vec2(0.5));
      float mean = a.r, sd = sqrt(max(a.g - a.r * a.r, 0.0));
      sd = clamp(mix(sd, 0.05, 0.3), 0.035, 0.16);
      float lo = mean - 2.0 * sd, hi = mean + 3.4 * sd;
      float v = (texture2D(tSrc, vUv).w - lo) / (hi - lo);
      gl_FragColor = vec4(v, clamp((v - 1.0) * 0.125, 0.0, 1.0), 0.0, 1.0);
    }`, { tSrc: { value: null }, tAgc: { value: null } });
  MAT.tglow = passMat(`
    uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      float g = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).g + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).g
        + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).g + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).g);
      gl_FragColor = vec4(vec3(max(g * 8.0 - 2.5, 0.0) * 0.12), 1.0);
    }`, { tSrc: { value: null }, uTexel: vec2() });
  MAT.tfinal = passMat(HEAD + `
    uniform sampler2D tDisp, tSoft, tGlow;
    uniform vec2 uArt;
    uniform float uTime, uInvert, uFlash, uStatic, uScale;
    varying vec2 vUv;
    void main() {
      vec2 ap = floor(gl_FragCoord.xy / uScale);                     // the art pixel
      vec2 uv = (ap + 0.5) / uArt;
      float d = texelFetch(tDisp, ivec2(ap), 0).r, soft = texture2D(tSoft, uv).r;
      d = mix(d, soft, 0.1) + (d - soft) * 0.8;                      // the sensor's sharpening halo
      d += texture2D(tGlow, vUv).r * 0.9;                             // hot spots bloom
      d = mix(d, 1.0, uFlash);
      d += (hash12(ap + fract(uTime * 13.7) * 311.0) - 0.5) * 0.05;  // grain, one grain per art pixel
      d += (hash12(vec2(ap.x, 7.0)) - 0.5) * 0.018;                  // column pattern
      d = mix(d, hash12(ap * 0.7 + floor(uTime * 24.0) * 17.0), uStatic);
      d = clamp(d, 0.0, 1.0);
      d = mix(d, 1.0 - d, uInvert);
      vec2 c = vUv - 0.5; c.x *= uArt.x / uArt.y;
      d *= 1.0 - 0.32 * dot(c, c);
      gl_FragColor = vec4(vec3(d), 1.0);
    }`, { tDisp: { value: null }, tSoft: { value: null }, tGlow: { value: null }, uArt: vec2(), uTime: { value: 0 }, uInvert: { value: 0 },
    uFlash: { value: 0 }, uStatic: { value: 0 }, uScale: { value: 1 } });
  const stat = (w, h) => target(w, h);
  MAT.s1 = stat(128, 72); MAT.s2 = stat(16, 9); MAT.s3 = stat(1, 1); MAT.agcA = stat(1, 1); MAT.agcB = stat(1, 1);
  MAT.fresh = true;
}

/* ------------------------------------------------------------------ frame */
const NOCAST = [];       // things that cast no moon shadow: hidden for that pass
const CLEAR_A = new THREE.Color(0, 0, 0);
function renderGBuffer() {
  const r = R3.renderer, T = R3.targets;
  // the moon's shadow map
  U.uPass.value = 2;
  for (const o of NOCAST) o.visible = false;
  r.setRenderTarget(R3.shadow);
  r.setClearColor(CLEAR_A, 1);
  r.setClearColor(new THREE.Color(-1e9, 0, 0), 1);
  r.clear(true, true, true);
  r.render(R3.scene, R3.moonCam);
  for (const o of NOCAST) o.visible = true;
  // colour and class
  U.uPass.value = 0;
  r.setRenderTarget(T.gA);
  r.setClearColor(CLEAR_A, 0);
  r.clear(true, true, true);
  r.render(R3.scene, R3.camera);
  // normal, depth, heat
  U.uPass.value = 1;
  r.setRenderTarget(T.gB);
  r.setClearColor(new THREE.Color(0, 0, -1e4), 0.3);
  r.clear(true, true, true);
  r.render(R3.scene, R3.camera);
}
const MVP = new THREE.Matrix4();
function renderColour(f) {
  const T = R3.targets, M = MAT;
  const L = M.light.uniforms;
  L.tA.value = T.gA.texture; L.tB.value = T.gB.texture; L.tS.value = R3.shadow.texture;
  L.uArt.value.set(VIEW.W, VIEW.H); L.uLf.value = VIEW.L; L.uTime.value = f.time; L.uNL.value = nLights;
  L.uShadowTexel.value.set(1 / SHADOW_RES, 1 / SHADOW_RES);
  MVP.multiplyMatrices(R3.moonCam.projectionMatrix, R3.moonCam.matrixWorldInverse);
  L.uMoonVP.value.copy(MVP);
  runPass(M.light, T.hdr);
  // tilt-shift copy, bloom
  const down = (src, dst, thr) => { M.down.uniforms.tSrc.value = src.texture; M.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); M.down.uniforms.uThr.value = thr; runPass(M.down, dst); };
  const blur = (rt, tmp, s) => {
    M.blur.uniforms.tSrc.value = rt.texture; M.blur.uniforms.uDir.value.set(s / rt.width, 0); runPass(M.blur, tmp);
    M.blur.uniforms.tSrc.value = tmp.texture; M.blur.uniforms.uDir.value.set(0, s / rt.height); runPass(M.blur, rt);
  };
  down(T.hdr, T.dof, 0); blur(T.dof, T.b1t, 1.5);
  down(T.hdr, T.b1, 1.0); blur(T.b1, T.b1t, 1);
  down(T.b1, T.b2, 0); blur(T.b2, T.b2t, 1);
  down(T.b2, T.b3, 0); blur(T.b3, T.b3t, 1);
  const F = M.final.uniforms;
  F.tHDR.value = T.hdr.texture; F.tDof.value = T.dof.texture; F.tB1.value = T.b1.texture; F.tB2.value = T.b2.texture; F.tB3.value = T.b3.texture;
  F.uRes.value.set(VIEW.W * VIEW.S, VIEW.H * VIEW.S); F.uTime.value = f.time; F.uFlash.value = f.flash || 0; F.uStatic.value = f.static || 0;
  F.uScale.value = VIEW.S / VIEW.L;
  runPass(M.final, null);
}
function renderThermal(f) {
  const T = R3.targets, M = MAT, src = T.gB;
  M.stat0.uniforms.tSrc.value = src.texture; M.stat0.uniforms.uStep.value.set(1 / 512, 1 / 288);
  runPass(M.stat0, M.s1);
  M.stat1.uniforms.tSrc.value = M.s1.texture; M.stat1.uniforms.uSize.value.set(128, 72); M.stat1.uniforms.uN.value = 8;
  runPass(M.stat1, M.s2);
  M.stat2.uniforms.tSrc.value = M.s2.texture;
  runPass(M.stat2, M.s3);
  M.agc.uniforms.tCur.value = M.s3.texture; M.agc.uniforms.tPrev.value = M.agcA.texture;
  M.agc.uniforms.uRate.value = M.fresh ? 1 : 1 - Math.exp(-f.dt * 2.5);
  runPass(M.agc, M.agcB);
  M.fresh = false;
  const t = M.agcA; M.agcA = M.agcB; M.agcB = t;
  M.tmap.uniforms.tSrc.value = src.texture; M.tmap.uniforms.tAgc.value = M.agcA.texture;
  runPass(M.tmap, T.th);
  // a soft copy for the halo, and the glow of whatever is far past white
  M.down.uniforms.tSrc.value = T.th.texture; M.down.uniforms.uTexel.value.set(1 / T.th.width, 1 / T.th.height); M.down.uniforms.uThr.value = 0;
  runPass(M.down, T.thS);
  M.blur.uniforms.tSrc.value = T.thS.texture; M.blur.uniforms.uDir.value.set(1 / T.thS.width, 0); runPass(M.blur, T.thT);
  M.blur.uniforms.tSrc.value = T.thT.texture; M.blur.uniforms.uDir.value.set(0, 1 / T.thS.height); runPass(M.blur, T.thS);
  M.tglow.uniforms.tSrc.value = T.thS.texture; M.tglow.uniforms.uTexel.value.set(1 / T.thS.width, 1 / T.thS.height);
  runPass(M.tglow, T.thG);
  M.blur.uniforms.tSrc.value = T.thG.texture; M.blur.uniforms.uDir.value.set(1.5 / T.thG.width, 0); runPass(M.blur, T.thGt);
  M.blur.uniforms.tSrc.value = T.thGt.texture; M.blur.uniforms.uDir.value.set(0, 1.5 / T.thG.height); runPass(M.blur, T.thG);
  const F = M.tfinal.uniforms;
  F.tDisp.value = T.th.texture; F.tSoft.value = T.thS.texture; F.tGlow.value = T.thG.texture;
  F.uArt.value.set(VIEW.W, VIEW.H); F.uTime.value = f.time; F.uInvert.value = f.invert ? 1 : 0;
  F.uFlash.value = f.flash || 0; F.uStatic.value = f.static || 0; F.uScale.value = VIEW.S;
  runPass(M.tfinal, null);
}
// f: { time, dt, thermal, invert, flash, static }
function renderFrame(f) {
  U.uThermal.value = f.thermal ? 1 : 0;
  renderGBuffer();
  if (f.thermal) renderThermal(f); else renderColour(f);
}
