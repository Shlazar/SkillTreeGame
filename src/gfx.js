/* The look, "Lumen" (from Isle Express): the world relit on the GPU (WebGL2).
 *
 * The CPU hands over its G-buffer (albedo + material class, normal + moon visibility, depth) in a
 * wrap-around store of tiles, the lights, and an overlay holding every sprite. This lights it per
 * screen pixel without quantising, then runs a small lens stack:
 *   light   soft moon shadows, ambient occlusion from depth, every lamp with falloff and metal
 *           glints, clouds drifting over the moon, height fog that each lamp lights up
 *   bloom   bright pass, three blurred levels
 *   final   gentle tilt-shift, filmic tone mapping, grading, vignette, grain; the crosshair and
 *           numbers skip the lens */
const GFX = (() => {
const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 oCol;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
`;

const FS_LIGHT = HEAD + `
uniform sampler2D tAlb, tNrm, tOv, tGlow, tDep, tLights, tEmit;
uniform vec2 uArt, uCamF;
uniform ivec2 uCam, uTex;
uniform vec3 uCR, uCU, uCV, uLD, uMoon, uAmbSky, uAmbGnd, uFogCol;
uniform float uSC, uTime, uFog, uAir, uCloud;
uniform int uNL;

ivec2 st(ivec2 q) { return ivec2((q.x + uCam.x + uTex.x) % uTex.x, (q.y + uCam.y + uTex.y) % uTex.y); }
float dep(ivec2 q) { return texelFetch(tDep, st(q), 0).r; }
float cls(ivec2 q) { return floor(texelFetch(tAlb, st(q), 0).a * 255.0 + 0.5); }
vec3 nrm(ivec2 q) { return (texelFetch(tNrm, st(q), 0).rgb * 255.0 - 128.0) / 127.0; }
vec3 world(vec2 p, float d) { float a = (p.x + uCamF.x) / uSC, b = -(p.y + uCamF.y) / uSC; return a * uCR + b * uCU + d * uCV; }
float fogDens(vec3 P) {
  float n = fbm(P.xy * 0.016 + vec2(uTime * 0.025, -uTime * 0.016));
  float pocket = smoothstep(0.55, 0.8, vnoise(P.xy * 0.0045 + 7.0));
  return uFog * (0.25 + 1.3 * n) * (1.0 + 1.8 * pocket * smoothstep(0.25, 0.7, n));
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uArt;            // art pixels, y down
  ivec2 ip = ivec2(floor(p));
  ivec2 sp0 = clamp(ip, ivec2(0), ivec2(uArt) - 1);
  vec4 alb = texelFetch(tAlb, st(ip), 0);
  float c = floor(alb.a * 255.0 + 0.5);
  vec4 ov = texelFetch(tOv, sp0, 0);
  float glow = texelFetch(tGlow, sp0, 0).r;
  vec3 col, P;
  float d0 = dep(ip);
  // inside one continuous surface, interpolate depth and normal between art pixels
  vec2 q = p - 0.5;
  ivec2 b0 = ivec2(floor(q)), b1 = b0 + ivec2(1, 0), b2 = b0 + ivec2(0, 1), b3 = b0 + ivec2(1, 1);
  vec2 w = q - floor(q);
  float da = dep(b0), db = dep(b1), dc = dep(b2), dd = dep(b3);
  bool sm = max(max(da, db), max(dc, dd)) - min(min(da, db), min(dc, dd)) < 2.5
    && cls(b0) == c && cls(b1) == c && cls(b2) == c && cls(b3) == c;
  float d = sm ? mix(mix(da, db, w.x), mix(dc, dd, w.x), w.y) : d0;
  vec3 n = normalize(sm ? mix(mix(nrm(b0), nrm(b1), w.x), mix(nrm(b2), nrm(b3), w.x), w.y) : nrm(ip));
  P = world(p, d);
  vec3 A = toLin(alb.rgb);
  if (c < 128.0) {
    col = A * texelFetch(tEmit, ivec2(int(c) - 1, 0), 0).r * 3.4;          // lamps, windows, fire
  } else {
    bool foliage = abs(c - 210.0) < 0.5, metal = abs(c - 220.0) < 0.5;
    float wrap = foliage ? 0.35 : 0.0;
    // soft moon shadow: visibility averaged over neighbours on the same surface
    float vis = 0.0, ws = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 s = ip + ivec2(i, j);
      float wt = abs(dep(s) - d0) < 3.0 ? 1.0 : 0.0;
      vis += texelFetch(tNrm, st(s), 0).a * wt;
      ws += wt;
    }
    vis /= max(ws, 1.0);
    // ambient occlusion from the depth buffer
    float occ = 0.0, rot = hash(floor(p + uCamF)) * 6.283;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 2.39996 + rot, r = 1.5 + float(k) * 0.95;
      vec2 spt = p + vec2(cos(a), sin(a)) * r;
      ivec2 sq = ivec2(floor(spt));
      vec3 v = world(spt, dep(sq)) - P;
      float l = length(v);
      occ += max(0.0, dot(n, v) / (l + 1e-3) - 0.15) * smoothstep(10.0, 1.0, l);
    }
    float ao = clamp(1.0 - occ * 0.24, 0.3, 1.0);
    float cloud = 1.0 - uCloud * smoothstep(0.5, 0.74, fbm(P.xy * 0.0055 + uTime * vec2(0.012, 0.007)));
    vec3 light = uMoon * max(0.0, (dot(n, uLD) + wrap) / (1.0 + wrap)) * vis * cloud;
    light += mix(uAmbGnd, uAmbSky, n.z * 0.5 + 0.5) * ao;
    vec3 spec = vec3(0.0);
    for (int k = 0; k < 64; k++) {
      if (k >= uNL) break;
      vec4 L0 = texelFetch(tLights, ivec2(0, k), 0);
      vec3 lv = L0.xyz - P;
      float d2 = dot(lv, lv);
      if (d2 >= L0.w * L0.w) continue;
      vec4 L1 = texelFetch(tLights, ivec2(1, k), 0), L2 = texelFetch(tLights, ivec2(2, k), 0);
      float dl = sqrt(d2);
      vec3 l = lv / max(dl, 1e-3);
      float x = dl / L0.w, att = (1.0 - x * x) * (1.0 - x * x) / (1.0 + d2 * 0.01);
      if (L2.w > -1.5) att *= smoothstep(L2.w, texelFetch(tLights, ivec2(3, k), 0).x, dot(-l, L2.xyz));
      light += L1.rgb * L1.a * att * max(0.0, (dot(n, l) + wrap) / (1.0 + wrap));
      if (metal) spec += L1.rgb * L1.a * att * pow(max(0.0, dot(n, normalize(l + uCV))), 36.0) * 2.0;
    }
    if (metal) spec += uMoon * vis * pow(max(0.0, dot(n, normalize(uLD + uCV))), 24.0) * 0.7;
    col = A * light * (0.55 + 0.45 * ao) + spec;
    // silhouettes: a moonlit rim on top/left edges, a darker line on bottom/right edges
    float e = 0.0;
    if (dep(ip + ivec2(0, -1)) < d0 - 3.0 || dep(ip + ivec2(-1, 0)) < d0 - 3.0) e = 1.0;
    else if (dep(ip + ivec2(0, 1)) < d0 - 3.0 || dep(ip + ivec2(1, 0)) < d0 - 3.0) e = -1.0;
    col *= 1.0 + 0.28 * e;
    if (e > 0.0) col += A * uMoon * 0.1;
  }
  // sprites and smoke from the overlay; glowing overlay pixels feed the bloom
  if (ov.a > 0.004) col = mix(col, toLin(ov.rgb), ov.a);
  if (glow > 0.004 && glow < 0.99) col += toLin(ov.rgb) * glow * 4.0;
  // height fog, lit by the moon and by every lamp its ray passes
  const float TOP = 34.0, HF = 6.5;
  float sTop = max(0.0, (TOP - P.z) / uCV.z);
  float dens = fogDens(P);
  float od = dens * HF / uCV.z * (exp(-max(P.z, -6.0) / HF) - exp(-TOP / HF));
  float T = exp(-od);
  col = col * T + uFogCol * (1.0 - T);
  vec3 air = vec3(0.0);
  for (int k = 0; k < 64; k++) {
    if (k >= uNL) break;
    vec4 L0 = texelFetch(tLights, ivec2(0, k), 0);
    float R = L0.w * 1.1;
    float s0 = clamp(dot(L0.xyz - P, uCV), 0.0, sTop);
    vec3 C0 = P + uCV * s0;
    if (dot(L0.xyz - C0, L0.xyz - C0) >= R * R) continue;
    vec4 L1 = texelFetch(tLights, ivec2(1, k), 0), L2 = texelFetch(tLights, ivec2(2, k), 0), L3 = texelFetch(tLights, ivec2(3, k), 0);
    if (L2.w > -1.5) {
      float acc = 0.0, span = min(sTop, 70.0);
      for (int j = 0; j < 12; j++) {
        vec3 C = P + uCV * (span * (float(j) + 0.5) / 12.0);
        vec3 v = C - L0.xyz;
        float dl = length(v);
        if (dl >= R) continue;
        float x = dl / R;
        acc += smoothstep(L2.w, L3.x, dot(v / max(dl, 1e-3), L2.xyz)) * (1.0 - x) * (1.0 - x) * exp(-max(C.z, -6.0) / HF);
      }
      air += L1.rgb * L1.a * L3.y * acc * span / 12.0 * dens * 0.2;
    } else {
      float s = s0;
      vec3 C = C0;
      float h = max(length(L0.xyz - C), 0.7);
      float g = (atan((sTop - s) / h) + atan(s / h)) / h;
      air += L1.rgb * L1.a * L3.y * g * (1.0 - h / R) * dens * exp(-max(C.z, -6.0) / HF);
    }
  }
  col += air * uAir;
  oCol = vec4(col, 0.0);
}`;

const FS_DOWN = HEAD + `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr;
void main() {
  vec4 c = 0.25 * (texture(tSrc, vUv + uTexel * vec2(-0.5, -0.5)) + texture(tSrc, vUv + uTexel * vec2(0.5, -0.5))
    + texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5)) + texture(tSrc, vUv + uTexel * vec2(0.5, 0.5)));
  if (uThr > 0.0) { float l = max(c.r, max(c.g, c.b)); c.rgb *= max(0.0, l - uThr) / max(l, 1e-4); }
  oCol = c;
}`;
const FS_BLUR = HEAD + `
uniform sampler2D tSrc; uniform vec2 uDir;
void main() {
  const float W0 = 0.227027, W1 = 0.1945946, W2 = 0.1216216, W3 = 0.054054, W4 = 0.016216;
  vec4 c = texture(tSrc, vUv) * W0;
  c += (texture(tSrc, vUv + uDir) + texture(tSrc, vUv - uDir)) * W1;
  c += (texture(tSrc, vUv + uDir * 2.0) + texture(tSrc, vUv - uDir * 2.0)) * W2;
  c += (texture(tSrc, vUv + uDir * 3.0) + texture(tSrc, vUv - uDir * 3.0)) * W3;
  c += (texture(tSrc, vUv + uDir * 4.0) + texture(tSrc, vUv - uDir * 4.0)) * W4;
  oCol = c;
}`;
const FS_FINAL = HEAD + `
uniform sampler2D tHDR, tDof, tB1, tB2, tB3, tOv, tGlow;
uniform vec2 uArt, uRes;
uniform float uTime, uExposure, uBloom, uDof, uFlash;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv = vUv;
  float coc = uDof * smoothstep(0.26, 0.5, abs(uv.y - 0.5));
  vec2 ca = (uv - 0.5) * 0.0006;
  vec3 sharp = vec3(texture(tHDR, uv + ca).r, texture(tHDR, uv).g, texture(tHDR, uv - ca).b);
  vec3 col = mix(sharp, texture(tDof, uv).rgb, coc);
  col += (texture(tB1, uv).rgb * 0.5 + texture(tB2, uv).rgb * 0.75 + texture(tB3, uv).rgb * 1.0) * uBloom;
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
  col += (hash(uv * uRes + fract(uTime * 7.0) * 91.7) - 0.5) * 0.028;
  ivec2 ip = min(ivec2(floor(vec2(uv.x, 1.0 - uv.y) * uArt)), ivec2(uArt) - 1);
  if (texelFetch(tGlow, ip, 0).r > 0.99) col = texelFetch(tOv, ip, 0).rgb;
  oCol = vec4(col, 1.0);
}`;

function create(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return null;
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, VS);
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let k = 0; k < n; k++) { const a = gl.getActiveUniform(p, k); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  let P;
  try {
    P = { light: program(FS_LIGHT), down: program(FS_DOWN), blur: program(FS_BLUR), final: program(FS_FINAL) };
  } catch (e) {
    console.warn('Lumen shaders failed:', e.message);
    return null;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function texture(internal, format, type, w, h, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const tAlb = texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, TW, TH, gl.NEAREST);
  const tNrm = texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, TW, TH, gl.NEAREST);
  const tDep = texture(gl.R32F, gl.RED, gl.FLOAT, TW, TH, gl.NEAREST);
  const tOv = texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, W, H, gl.NEAREST);
  const tGlow = texture(gl.R8, gl.RED, gl.UNSIGNED_BYTE, W, H, gl.NEAREST);
  const tLights = texture(gl.RGBA32F, gl.RGBA, gl.FLOAT, 4, 64, gl.NEAREST);
  const tEmit = texture(gl.R32F, gl.RED, gl.FLOAT, 16, 1, gl.NEAREST);

  const HDR = floatRT ? [gl.RGBA16F, gl.HALF_FLOAT] : [gl.RGBA8, gl.UNSIGNED_BYTE];
  function rtarget(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const t = texture(HDR[0], gl.RGBA, HDR[1], w, h, gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb, w, h };
  }
  let RT = null, width = 0, height = 0;
  function resize(w, h) {
    if (w === width && h === height && RT) return;
    width = w; height = h;
    canvas.width = w; canvas.height = h;
    if (RT) for (const k in RT) { gl.deleteTexture(RT[k].t); gl.deleteFramebuffer(RT[k].fb); }
    RT = {
      hdr: rtarget(w, h), s1: rtarget(w / 2, h / 2), d1: rtarget(w / 2, h / 2), t1: rtarget(w / 2, h / 2),
      b1: rtarget(w / 2, h / 2), b2: rtarget(w / 4, h / 4), t2: rtarget(w / 4, h / 4), b3: rtarget(w / 8, h / 8), t3: rtarget(w / 8, h / 8),
    };
  }
  // a block of the G-buffer store: x, y in texels; rows of the source are `stride` texels long
  function uploadBlock(t, format, type, data, x, y, w, h, stride, sx, sy) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, stride);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, sx || 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, sy || 0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format, type, data);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }
  function uploadTile(x, y, alb, nrm, dep) {
    uploadBlock(tAlb, gl.RGBA, gl.UNSIGNED_BYTE, alb, x, y, TS, TS, TS);
    uploadBlock(tNrm, gl.RGBA, gl.UNSIGNED_BYTE, nrm, x, y, TS, TS, TS);
    uploadBlock(tDep, gl.RED, gl.FLOAT, dep, x, y, TS, TS, TS);
  }
  function uploadAlb(x, y) { uploadBlock(tAlb, gl.RGBA, gl.UNSIGNED_BYTE, mAlb, x, y, TS, TS, TW, x, y); }
  function bind(prog, unit, name, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(prog.u[name], unit);
  }
  function draw(rt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fb : null);
    gl.viewport(0, 0, rt ? rt.w : width, rt ? rt.h : height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function down(src, dst, thr) {
    gl.useProgram(P.down.p);
    bind(P.down, 0, 'tSrc', src.t);
    gl.uniform2f(P.down.u.uTexel, 1 / src.w, 1 / src.h);
    gl.uniform1f(P.down.u.uThr, thr);
    draw(dst);
  }
  function blur(rt, tmp, step) {
    gl.useProgram(P.blur.p);
    bind(P.blur, 0, 'tSrc', rt.t);
    gl.uniform2f(P.blur.u.uDir, step / rt.w, 0);
    draw(tmp);
    bind(P.blur, 0, 'tSrc', tmp.t);
    gl.uniform2f(P.blur.u.uDir, 0, step / rt.h);
    draw(rt);
  }
  // exposure, bloom, tilt-shift, fog, lamp haze, clouds; moonlight and ambient colours
  const look = { exposure: 1.05, bloom: 0.32, dof: 0.16, fog: 0.03, air: 1.7, cloud: 0.4,
    moon: [0.2, 0.26, 0.5], ambSky: [0.03, 0.045, 0.09], ambGnd: [0.012, 0.014, 0.022], fogCol: [0.05, 0.068, 0.12] };

  function render(f) {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    uploadBlock(tOv, gl.RGBA, gl.UNSIGNED_BYTE, f.ov, 0, 0, W, H, W);
    uploadBlock(tGlow, gl.RED, gl.UNSIGNED_BYTE, f.glow, 0, 0, W, H, W);
    gl.bindTexture(gl.TEXTURE_2D, tLights);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, 64, gl.RGBA, gl.FLOAT, f.lights);
    gl.bindTexture(gl.TEXTURE_2D, tEmit);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 16, 1, gl.RED, gl.FLOAT, f.emit);

    const L = P.light;
    gl.useProgram(L.p);
    bind(L, 0, 'tAlb', tAlb); bind(L, 1, 'tNrm', tNrm); bind(L, 2, 'tOv', tOv); bind(L, 3, 'tGlow', tGlow);
    bind(L, 4, 'tDep', tDep); bind(L, 5, 'tLights', tLights); bind(L, 6, 'tEmit', tEmit);
    gl.uniform2f(L.u.uArt, W, H);
    gl.uniform2f(L.u.uCamF, VIEW.x - OFFS, VIEW.y - OFFS);
    gl.uniform2i(L.u.uCam, mod(VIEW.x, TW), mod(VIEW.y, TH));
    gl.uniform2i(L.u.uTex, TW, TH);
    gl.uniform3fv(L.u.uCR, CR); gl.uniform3fv(L.u.uCU, CU); gl.uniform3fv(L.u.uCV, CV); gl.uniform3fv(L.u.uLD, LD);
    gl.uniform3fv(L.u.uMoon, look.moon);
    gl.uniform3fv(L.u.uAmbSky, look.ambSky);
    gl.uniform3fv(L.u.uAmbGnd, look.ambGnd);
    gl.uniform3fv(L.u.uFogCol, look.fogCol);
    gl.uniform1f(L.u.uSC, SC);
    gl.uniform1f(L.u.uTime, f.time);
    gl.uniform1f(L.u.uFog, look.fog);
    gl.uniform1f(L.u.uAir, look.air);
    gl.uniform1f(L.u.uCloud, look.cloud);
    gl.uniform1i(L.u.uNL, f.nLights);
    draw(RT.hdr);

    down(RT.hdr, RT.s1, 0);
    gl.useProgram(P.blur.p);
    bind(P.blur, 0, 'tSrc', RT.s1.t); gl.uniform2f(P.blur.u.uDir, 1.5 / RT.s1.w, 0); draw(RT.t1);
    bind(P.blur, 0, 'tSrc', RT.t1.t); gl.uniform2f(P.blur.u.uDir, 0, 1.5 / RT.s1.h); draw(RT.d1);
    down(RT.hdr, RT.b1, 1.0);
    blur(RT.b1, RT.t1, 1);
    down(RT.b1, RT.b2, 0);
    blur(RT.b2, RT.t2, 1);
    down(RT.b2, RT.b3, 0);
    blur(RT.b3, RT.t3, 1);

    const F = P.final;
    gl.useProgram(F.p);
    bind(F, 0, 'tHDR', RT.hdr.t); bind(F, 1, 'tDof', RT.d1.t); bind(F, 2, 'tB1', RT.b1.t); bind(F, 3, 'tB2', RT.b2.t);
    bind(F, 4, 'tB3', RT.b3.t); bind(F, 6, 'tOv', tOv); bind(F, 7, 'tGlow', tGlow);
    gl.uniform2f(F.u.uArt, W, H);
    gl.uniform2f(F.u.uRes, width, height);
    gl.uniform1f(F.u.uTime, f.time);
    gl.uniform1f(F.u.uExposure, look.exposure);
    gl.uniform1f(F.u.uBloom, look.bloom);
    gl.uniform1f(F.u.uDof, look.dof);
    gl.uniform1f(F.u.uFlash, f.flash || 0);
    draw(null);
  }
  resize(W * 2, H * 2);
  return { render, resize, uploadTile, uploadAlb, look, gl, get lost() { return gl.isContextLost(); } };
}
return { create };
})();
