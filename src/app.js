/* Sky Reaper: the frame, input, sound, HUD and the loop. */
const $ = (id) => document.getElementById(id);
const frameEl = $('frame'), glCanvas = $('gl');
const game = createGame();
const GS = game.S;
let gfx = null, gfxScale = 2, slowFrames = 0;
let mode = 'title', last = performance.now(), acc = 0, shake = 0, flash = 0, artPx = 1, touchId = null;
let best = 0, bank = 0;
try { best = +localStorage.getItem('skyreaper.iso.best') || 0; bank = +localStorage.getItem('skyreaper.iso.bank') || 0; } catch (e) { /* storage blocked */ }
const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } };

/* ------------------------------------------------------------- lights */
const LIGHTBUF = new Float32Array(64 * 16), EMITK = new Float32Array(16);
// light colours, and per kind: GPU intensity, radius scale, how much it lights the fog
const LCOL = { lamp: [1.0, 0.68, 0.36], window: [1.0, 0.56, 0.26], fire: [1.0, 0.45, 0.16], flash: [1.0, 0.78, 0.42] };
const LGPU = { lamp: [1.9, 1.0, 1.0], window: [0.75, 1.0, 0.5], fire: [1.3, 1.0, 0.6], flash: [3.2, 1.0, 1.0] };
const CPUK = { lamp: 1, window: 0.6, fire: 1, flash: 1 };
const fireFlick = (t, seed) => 0.8 + 0.12 * Math.sin(t * 17 + seed) + 0.08 * Math.sin(t * 31 + seed * 1.7);
const CPU_LIGHTS = [];
function collectLights(t, statics, dyn) {
  CPU_LIGHTS.length = 0;
  for (const L of statics) {
    const I = L.kind === 'fire' ? fireFlick(t, L.seed) : L.kind === 'lamp' ? 1 + 0.03 * Math.sin(t * 9 + L.seed) : 0.9 + 0.08 * noise1(t * 1.3, L.seed);
    CPU_LIGHTS.push({ x: L.x, y: L.y, z: L.z, r: L.r, I, kind: L.kind, cpuK: CPUK[L.kind] });
  }
  for (const L of dyn) CPU_LIGHTS.push({ x: L.x, y: L.y, z: L.z, r: L.r, I: L.I * (1 - L.age / L.life), kind: L.kind, cpuK: 1 });
  let n = 0;
  for (const L of CPU_LIGHTS) {
    if (n >= 64) break;
    const c = LCOL[L.kind] || LCOL.flash, g = LGPU[L.kind] || LGPU.flash, o = n * 16;
    LIGHTBUF[o] = L.x; LIGHTBUF[o + 1] = L.y; LIGHTBUF[o + 2] = L.z; LIGHTBUF[o + 3] = L.r * g[1];
    LIGHTBUF[o + 4] = c[0]; LIGHTBUF[o + 5] = c[1]; LIGHTBUF[o + 6] = c[2]; LIGHTBUF[o + 7] = L.I * g[0];
    LIGHTBUF[o + 8] = 0; LIGHTBUF[o + 9] = 0; LIGHTBUF[o + 10] = 0; LIGHTBUF[o + 11] = -2;
    LIGHTBUF[o + 12] = 0; LIGHTBUF[o + 13] = g[2]; LIGHTBUF[o + 14] = 0; LIGHTBUF[o + 15] = 0;
    n++;
  }
  EMITK[0] = 1; EMITK[1] = 1 + 0.03 * Math.sin(t * 9); EMITK[2] = 0.92 + 0.08 * noise1(t * 1.3, 5);
  for (let k = 3; k < 7; k++) EMITK[k] = fireFlick(t, k * 13) * 1.15;
  return n;
}

/* -------------------------------------------------------------- sound */
const AU = { ctx: null, out: null, noise: null };
let lastKillSfx = 0, groanT = 3;
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let c;
  try { c = new AC(); } catch (e) { return; }
  AU.ctx = c;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(c.destination);
  AU.out = c.createGain(); AU.out.gain.value = 0.8; AU.out.connect(comp);
  const len = c.sampleRate * 2;
  AU.noise = c.createBuffer(1, len, c.sampleRate);
  const d = AU.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // the gunship's engines, far off, and the wind
  const drone = c.createGain(); drone.gain.value = 0.045; drone.connect(AU.out);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.connect(drone);
  for (const f of [46, 46.7, 92.3]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; g.gain.value = f > 90 ? 0.3 : 0.6;
    o.connect(g); g.connect(lp); o.start();
  }
  const n = c.createBufferSource(), nl = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = AU.noise; n.loop = true; nl.type = 'lowpass'; nl.frequency.value = 380; ng.gain.value = 0.7;
  n.connect(nl); nl.connect(ng); ng.connect(drone); n.start();
  // crickets: a high tone gated quickly, swelling slowly
  const cr = c.createOscillator(), crG = c.createGain(), gate = c.createOscillator(), gateG = c.createGain(), swell = c.createOscillator(), swellG = c.createGain();
  cr.frequency.value = 4400; crG.gain.value = 0; gate.type = 'square'; gate.frequency.value = 24; gateG.gain.value = 0.004;
  swell.frequency.value = 0.4; swellG.gain.value = 0.004;
  gate.connect(gateG); gateG.connect(crG.gain); swell.connect(swellG); swellG.connect(crG.gain);
  cr.connect(crG); crG.connect(AU.out); cr.start(); gate.start(); swell.start();
}
function sNoise(type, f0, f1, q, dur, vol, delay = 0) {
  const c = AU.ctx;
  if (!c) return;
  const t = c.currentTime + delay, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = AU.noise;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(AU.out);
  src.start(t, Math.random() * Math.max(0, 1.95 - dur)); src.stop(t + dur + 0.02);
}
function sTone(type, f0, f1, dur, vol, delay = 0) {
  const c = AU.ctx;
  if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.out); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  mg() { sTone('sine', 150, 48, 0.1, 0.3); sNoise('bandpass', 1300, 500, 0.9, 0.06, 0.16); },
  cannon() { sTone('sine', 85, 28, 0.6, 0.65); sNoise('lowpass', 900, 180, 0.7, 0.45, 0.5); sTone('sine', 1400, 380, 1.0, 0.035, 0.05); },
  boom(k) { sTone('sine', 60, 20, 1.2, 0.95 * k); sNoise('lowpass', 2600, 90, 0.6, 1.8, 1.05 * k); sNoise('highpass', 2500, 2500, 0.5, 0.7, 0.07 * k, 0.12); },
  kill() { if (GS.t - lastKillSfx < 0.06) return; lastKillSfx = GS.t; sNoise('lowpass', 650, 180, 1, 0.1, 0.16); },
  beep() { sTone('square', 1046, 1046, 0.08, 0.05); },
  ui() { sTone('square', 660, 990, 0.07, 0.05); },
  stall() { sNoise('lowpass', 900, 60, 0.7, 1.6, 0.2); sTone('sawtooth', 120, 40, 1.4, 0.06); },
  groan() {
    const c = AU.ctx;
    if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
    const f0 = 80 + Math.random() * 60;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 0.8, t + 1.4);
    vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 450 + Math.random() * 300; f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(f); f.connect(g); g.connect(AU.out);
    o.start(t); vib.start(t); o.stop(t + 1.6); vib.stop(t + 1.6);
  },
};

/* -------------------------------------------------------------- layout */
function startGfx() {
  try { gfx = GFX.create(glCanvas); } catch (e) { gfx = null; }
  if (!gfx) { $('noGpu').hidden = false; $('startBtn').disabled = true; return; }
  gfx.resize(W * gfxScale, H * gfxScale);
  WORLD.upload = gfx.uploadTile; WORLD.uploadAlb = gfx.uploadAlb;
  slotKey.fill(-1);
}
function layout() {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(innerWidth * dpr / W, innerHeight * dpr / H);
  const whole = Math.floor(fit), scale = whole >= 1 && whole / fit >= 0.8 ? whole : fit;
  artPx = scale / dpr;
  frameEl.style.width = W * artPx + 'px';
  frameEl.style.height = H * artPx + 'px';
}
addEventListener('resize', layout);

function setMode(next) {
  mode = next;
  frameEl.dataset.mode = next;
  $('startOv').hidden = next !== 'title';
  $('pauseOv').hidden = next !== 'paused';
  $('overOv').hidden = next !== 'over';
  frameEl.classList.toggle('playing', next === 'play');
  $('btn105').hidden = next !== 'play';
  if (next !== 'play') { game.trigger(false); touchId = null; }
  last = performance.now(); acc = 0;
}
function start() {
  audioInit(); SFX.ui();
  game.start();
  setMode('play');
}
function togglePause() {
  if (mode === 'play') setMode('paused');
  else if (mode === 'paused') setMode('play');
}
function showOver() {
  const isBest = GS.kills > best;
  if (isBest) { best = GS.kills; save('skyreaper.iso.best', best); }
  bank += GS.cash; save('skyreaper.iso.bank', bank);
  $('sKills').textContent = GS.kills;
  $('sBlast').textContent = GS.bestBlast;
  $('sAcc').textContent = (GS.shots ? Math.round(GS.hits / GS.shots * 100) : 0) + '%';
  $('sCash').textContent = GS.cash;
  $('sTotals').textContent = 'Best run ' + best + ' kills · Total cash ' + bank;
  $('newBest').hidden = !isBest;
  setMode('over');
  $('againBtn').focus({ preventScroll: true });
}

/* -------------------------------------------------------------- input */
const keys = new Set();
function updatePan() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  const l = Math.hypot(x, y) || 1;
  game.setPan(x / l, y / l);
}
function toArt(e) {
  const r = glCanvas.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
}
frameEl.addEventListener('pointermove', (e) => {
  if (mode !== 'play') return;
  if (touchId !== null && e.pointerId !== touchId) return;
  const p = toArt(e);
  game.aim(p[0], p[1]);
});
glCanvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  audioInit();
  const p = toArt(e);
  game.aim(p[0], p[1]);
  if (e.button === 2) game.fireHE();
  else {
    game.trigger(true);
    if (e.pointerType === 'touch') touchId = e.pointerId;
    try { glCanvas.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
  }
  e.preventDefault();
});
addEventListener('pointerup', (e) => {
  if (e.button === 0 || e.pointerType === 'touch') { game.trigger(false); if (e.pointerId === touchId) { touchId = null; game.setPan(0, 0); } }
});
addEventListener('pointercancel', () => { game.trigger(false); touchId = null; });
glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && mode === 'play') game.fireHE(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { togglePause(); return; }
  if (e.code === 'Enter' && !e.repeat && (mode === 'title' || mode === 'over') && !$('startBtn').disabled) { start(); return; }
  if (/^(Key[WASD]|Arrow)/.test(e.code)) { keys.add(e.code); updatePan(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys.delete(e.code); updatePan(); });
addEventListener('blur', () => { keys.clear(); updatePan(); game.trigger(false); if (mode === 'play') setMode('paused'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('paused'); });
$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('resumeBtn').addEventListener('click', () => setMode('play'));
$('quitBtn').addEventListener('click', () => { GS.fuel = 0.01; setMode('play'); });
$('btn105').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); game.fireHE(); });

/* ---------------------------------------------------------------- HUD */
const hudEls = { fuelFill: $('fuelFill'), fuelNum: $('fuelNum'), fuelHud: $('fuelHud'), cash: $('cash'), kills: $('kills'), horde: $('horde'),
  mgState: $('mgState'), mgFill: $('mgFill'), heState: $('heState'), heFill: $('heFill'), warn: $('warn'), banner: $('banner') };
const hudLast = {};
function setText(el, key, v) { if (hudLast[key] !== v) { hudLast[key] = v; el.textContent = v; } }
function updateHud() {
  const f = Math.max(0, GS.fuel), low = f < 10 && mode === 'play';
  const fs = Math.ceil(f);
  setText(hudEls.fuelNum, 'fuel', Math.floor(fs / 60) + ':' + String(fs % 60).padStart(2, '0'));
  hudEls.fuelFill.style.width = (f / CFG.fuel * 100).toFixed(1) + '%';
  if (hudLast.low !== low) { hudLast.low = low; hudEls.fuelHud.classList.toggle('low', low); hudEls.warn.hidden = !low; hudEls.warn.classList.toggle('on', low); }
  setText(hudEls.cash, 'cash', String(GS.cash));
  setText(hudEls.kills, 'kills', String(GS.kills));
  setText(hudEls.horde, 'horde', String(GS.zombies.length));
  setText(hudEls.mgState, 'mg', GS.trigger ? 'FIRING' : 'HOLD');
  const ready = GS.heReload <= 0;
  setText(hudEls.heState, 'he', ready ? 'READY' : 'LOADING');
  if (hudLast.heReady !== ready) { hudLast.heReady = ready; hudEls.heState.classList.toggle('wait', !ready); }
  hudEls.heFill.style.width = ((1 - GS.heReload / CFG.he.reload) * 100).toFixed(1) + '%';
}
function showBanner(text) {
  const b = hudEls.banner;
  b.textContent = text;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}
function handleEvents() {
  for (const ev of GS.events) {
    if (ev.type === 'mg') { if (mode === 'play') SFX.mg(); shake = Math.max(shake, 0.12); }
    else if (ev.type === 'cannon') { SFX.cannon(); shake = Math.max(shake, 0.35); }
    else if (ev.type === 'boom') {
      const sx = scrX(ev.x, ev.y), sy = scrY(ev.x, ev.y, 0), on = sx > -60 && sx < W + 60 && sy > -60 && sy < H + 60;
      if (on) { SFX.boom(1); shake = Math.max(shake, 1); flash = Math.max(flash, 0.12); } else SFX.boom(0.35);
    } else if (ev.type === 'kill') SFX.kill();
    else if (ev.type === 'multi') showBanner((ev.kills >= 25 ? 'MASSACRE ×' : ev.kills >= 12 ? 'CARNAGE ×' : 'MULTI KILL ×') + ev.kills);
    else if (ev.type === 'fuelout') SFX.stall();
  }
  GS.events.length = 0;
}

/* --------------------------------------------------------------- loop */
let lastBeep = 99;
function draw(dt) {
  if (gfx && gfx.lost) startGfx();
  if (!gfx) return;
  ensureTiles(mode === 'play' ? 3 : 6);
  flushDecals();
  const near = gatherNear(), t = GS.t;
  const nL = collectLights(t, near.lights, GS.lights);
  game.scene();
  renderOverlay(GS, t, CPU_LIGHTS, near.fires);
  if (!DEBUG || !DEBUG.skipGpu) gfx.render({ ov: outC, glow: GLOW, lights: LIGHTBUF, nLights: nL, emit: EMITK, time: t, flash });
  // the picture shakes with the guns and the blasts
  if (shake > 0.01 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const k = shake * 3 * artPx;
    glCanvas.style.transform = 'translate(' + ((Math.random() - 0.5) * k).toFixed(1) + 'px,' + ((Math.random() - 0.5) * k).toFixed(1) + 'px)';
  } else glCanvas.style.transform = '';
  shake = Math.max(0, shake - dt * 3);
  flash = Math.max(0, flash - dt * 1.5);
}
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode !== 'paused') {
    acc += dt;
    let steps = 0;
    const u0 = performance.now();
    while (acc >= 1 / 60 && steps < 6) { game.update(1 / 60); acc -= 1 / 60; steps++; }
    if (DEBUG) { DEBUG.update += performance.now() - u0; DEBUG.steps += steps; }
    if (steps === 6) acc = 0;
  }
  handleEvents();
  const t0 = performance.now();
  draw(dt);
  if (DEBUG) { DEBUG.draw += performance.now() - t0; DEBUG.frames++; }
  updateHud();
  if (mode === 'play' && touchId !== null) {
    // on a touch screen, holding near an edge slides the view that way
    const ax = GS.aim.sx / W, ay = GS.aim.sy / H;
    game.setPan(ax < 0.12 ? -1 : ax > 0.88 ? 1 : 0, ay < 0.12 ? -1 : ay > 0.88 ? 1 : 0);
  }
  if (mode === 'play') {
    if (GS.fuel < 10 && GS.fuel > 0 && Math.ceil(GS.fuel) !== lastBeep) { lastBeep = Math.ceil(GS.fuel); SFX.beep(); }
    groanT -= dt;
    if (groanT <= 0) { groanT = 2 + Math.random() * 4; if (GS.zombies.length > 20) SFX.groan(); }
    if (GS.mode === 'over') showOver();
  }
  if (gfx && gfxScale > 1 && mode === 'play') {
    slowFrames = dt > 0.028 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 90) { gfxScale = 1; gfx.resize(W, H); }
  }
  requestAnimationFrame(frame);
}

const DEBUG = /[?&]debug/.test(location.search) ? { draw: 0, frames: 0, update: 0, steps: 0, skipGpu: false } : null;
if (DEBUG) {
  window.__sr = { GS, game, VIEW, DEBUG, WORLD, mAlb, mGnd, rowB, colB, DECALS, slotKey, groundAtScreen, scrX, scrY, GX, GY };
  // CPU cost of a frame without the GPU: update, tiles, lights and the overlay
  DEBUG.bench = (n) => {
    const parts = { update: 0, tiles: 0, lights: 0, overlay: 0 };
    for (let k = 0; k < n; k++) {
      let t0 = performance.now();
      game.update(1 / 60);
      let t1 = performance.now(); parts.update += t1 - t0; t0 = t1;
      ensureTiles(3); flushDecals();
      t1 = performance.now(); parts.tiles += t1 - t0; t0 = t1;
      const near = gatherNear();
      collectLights(GS.t, near.lights, GS.lights);
      game.scene();
      t1 = performance.now(); parts.lights += t1 - t0; t0 = t1;
      renderOverlay(GS, GS.t, CPU_LIGHTS, near.fires);
      t1 = performance.now(); parts.overlay += t1 - t0;
    }
    for (const k in parts) parts[k] = +(parts[k] / n).toFixed(2);
    return parts;
  };
}
layout();
setMode('title');
startGfx();
game.spawnScatter(170);
setTimeout(() => {
  if (gfx) { ensureTiles(0); }
  $('loading').hidden = true;
  last = performance.now();
  requestAnimationFrame(frame);
}, 30);
