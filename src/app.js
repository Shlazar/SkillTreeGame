/* Sky Reaper: input, sound, screens and the loop. */
const $ = (id) => document.getElementById(id);
const glCanvas = $('gl'), hudCanvas = $('hud');
let game = null, GS = null, mode = 'title', invert = false, flash = 0, staticV = 0, last = performance.now(), acc = 0;
let dprCap = 1.5, slowT = 0, lockFailed = false, wantLock = false, unlockAt = -1e9, touched = false, skipMoves = 0;
let best = 0, bank = 0;
const DBG = { hold: false, fixedRes: false };      // ?debug: hold the simulation still, keep the resolution (tests)
try { best = +localStorage.getItem('skyreaper.flir.best') || 0; bank = +localStorage.getItem('skyreaper.flir.bank') || 0; invert = localStorage.getItem('skyreaper.flir.bht') === '1'; } catch (e) { /* storage blocked */ }
const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } };

/* -------------------------------------------------------------- sound
 * Heard from inside the aircraft: the engines, the guns right beside you, the blasts far below. */
const AU = { ctx: null, out: null, noise: null };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let c;
  try { c = new AC(); } catch (e) { return; }
  AU.ctx = c;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(c.destination);
  AU.out = c.createGain(); AU.out.gain.value = 0.85; AU.out.connect(comp);
  const len = c.sampleRate * 2;
  AU.noise = c.createBuffer(1, len, c.sampleRate);
  const d = AU.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // four turboprops: a low drone with a slow beat
  const eng = c.createGain(); eng.gain.value = 0.06; eng.connect(AU.out);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(eng);
  for (const f of [52, 52.6, 104.4, 156.9]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; g.gain.value = f > 100 ? 0.25 : 0.55;
    o.connect(g); g.connect(lp); o.start();
  }
  const n = c.createBufferSource(), nl = c.createBiquadFilter(), ng = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  n.buffer = AU.noise; n.loop = true; nl.type = 'lowpass'; nl.frequency.value = 520; ng.gain.value = 0.55;
  lfo.frequency.value = 17; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(ng.gain);
  n.connect(nl); nl.connect(ng); ng.connect(eng); n.start(); lfo.start();
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
  mg() { sTone('sine', 120, 42, 0.13, 0.42); sNoise('bandpass', 900, 380, 0.8, 0.08, 0.28); },
  cannon() { sTone('sine', 72, 24, 0.95, 0.9); sNoise('lowpass', 700, 110, 0.7, 0.6, 0.75); sNoise('highpass', 2600, 2600, 2, 0.08, 0.12, 1.3); sTone('square', 330, 300, 0.05, 0.04, 1.32); },
  boom(k) { sTone('sine', 46, 22, 1.4, 0.55 * k); sNoise('lowpass', 520, 70, 0.6, 1.9, 0.55 * k); },
  pop() { sNoise('bandpass', 1500, 900, 1.5, 0.05, 0.03); },
  overheat() { sNoise('highpass', 3200, 3200, 0.7, 0.6, 0.1); sTone('square', 880, 880, 0.12, 0.05); sTone('square', 880, 880, 0.12, 0.05, 0.2); },
  beep() { sTone('square', 1046, 1046, 0.08, 0.045); },
  ui() { sTone('square', 660, 990, 0.07, 0.04); },
  radio() { sNoise('bandpass', 1800, 1800, 0.8, 0.6, 0.12); },
};

/* --------------------------------------------------------------- setup */
function layout() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, dprCap);
  resizeRenderer(w, h, dpr);
  resizeHud(w, h, Math.min(devicePixelRatio || 1, 2));
}
addEventListener('resize', layout);
function setMode(next) {
  mode = next;
  $('titleScreen').hidden = next !== 'title';
  $('pauseScreen').hidden = next !== 'paused';
  $('overScreen').hidden = next !== 'over';
  $('btn105').hidden = next !== 'play';
  document.body.classList.toggle('playing', next === 'play');
  if (next !== 'play') { game.trigger(false); game.setPan(0, 0); }
  last = performance.now(); acc = 0;
}
// Mouse-look needs pointer lock. Where the page may not take the mouse (some embeds), aim with the
// cursor instead. A refusal just after Esc is only the browser's cool-down, so that one doesn't count.
function lockFail() { if (performance.now() - unlockAt > 1600) lockFailed = true; }
function lockMouse() {
  if (lockFailed || !glCanvas.requestPointerLock) { if (!glCanvas.requestPointerLock) lockFailed = true; return; }
  wantLock = true;
  try {
    const p = glCanvas.requestPointerLock();
    if (p && p.catch) p.catch(lockFail);
  } catch (e) { lockFail(); }
}
function start() {
  audioInit(); SFX.ui(); SFX.radio();
  game.start();
  staticV = 0.85;
  setMode('play');
  lockMouse();
}
function pause() {
  if (mode !== 'play') return;
  setMode('paused');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume() { setMode('play'); lockMouse(); }
function showOver() {
  if (document.pointerLockElement) document.exitPointerLock();
  const isBest = GS.kills > best;
  if (isBest) { best = GS.kills; save('skyreaper.flir.best', best); }
  bank += GS.cash; save('skyreaper.flir.bank', bank);
  $('sKills').textContent = GS.kills;
  $('sBlast').textContent = GS.bestBlast;
  $('sAcc').textContent = (GS.shots ? Math.round(GS.hits / GS.shots * 100) : 0) + '%';
  $('sCash').textContent = GS.cash;
  $('sTotals').textContent = 'Best run ' + best + ' kills · Total cash ' + bank;
  $('newBest').hidden = !isBest;
  setMode('over');
  $('againBtn').focus({ preventScroll: true });
}

/* --------------------------------------------------------------- input */
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
document.addEventListener('pointerlockchange', () => {
  GS.locked = document.pointerLockElement === glCanvas;
  if (GS.locked) skipMoves = 2;      // the first moves after the lock carry the cursor's jump to the centre
  else { unlockAt = performance.now(); game.trigger(false); }
  if (!GS.locked && mode === 'play' && wantLock) pause();      // Esc frees the mouse: pause
});
document.addEventListener('pointerlockerror', lockFail);
addEventListener('mousemove', (e) => {
  if (mode !== 'play' && mode !== 'title') return;
  if (GS.locked) {
    const dx = e.movementX || 0, dy = e.movementY || 0;
    if (skipMoves > 0) { skipMoves--; return; }
    if (Math.abs(dx) > innerWidth * 0.3 || Math.abs(dy) > innerHeight * 0.3) return;   // a spurious jump, not a hand
    if (mode === 'play') game.look(dx, dy);
    return;
  }
  GS.cursor.x = clamp(e.clientX / innerWidth, 0, 1); GS.cursor.y = clamp(e.clientY / innerHeight, 0, 1);
});
// mouse buttons come through mousedown: a second button pressed while one is held is no pointerdown
glCanvas.addEventListener('mousedown', (e) => {
  if (mode !== 'play') return;
  audioInit();
  e.preventDefault();
  if (!GS.locked && !lockFailed) { lockMouse(); return; }      // the first click takes the mouse
  if (e.button === 2) game.fireHE();
  else if (e.button === 0) game.trigger(true);
});
addEventListener('mouseup', (e) => { if (e.button === 0) game.trigger(false); });
// touch: the finger aims and holds the 25mm, the round button fires the 105
glCanvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || e.pointerType === 'mouse') return;
  audioInit(); touched = true;
  GS.cursor.x = e.clientX / innerWidth; GS.cursor.y = e.clientY / innerHeight;
  game.trigger(true);
  e.preventDefault();
});
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' && mode === 'play') { GS.cursor.x = e.clientX / innerWidth; GS.cursor.y = e.clientY / innerHeight; }
});
addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') game.trigger(false); });
addEventListener('pointercancel', () => game.trigger(false));
glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (mode === 'play') { e.preventDefault(); game.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); } }, { passive: false });
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && mode === 'play') game.fireHE(); return; }
  if (e.code === 'KeyT' && !e.repeat) { invert = !invert; save('skyreaper.flir.bht', invert ? 1 : 0); return; }
  if (e.code === 'KeyZ' && !e.repeat && mode === 'play') { game.cycleZoom(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (mode === 'play') pause(); else if (mode === 'paused' && e.code === 'KeyP') resume(); return; }
  if (e.code === 'Enter' && !e.repeat && (mode === 'title' || mode === 'over') && !$('startBtn').disabled) { start(); return; }
  if (/^(Key[WASD]|Arrow)/.test(e.code)) { keys.add(e.code); if (mode === 'play') updatePan(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (mode === 'play') updatePan(); });
addEventListener('blur', () => { keys.clear(); if (game) { game.trigger(false); game.setPan(0, 0); } pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => { GS.fuel = 0.01; setMode('play'); });
$('btn105').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); game.fireHE(); });

/* --------------------------------------------------------------- events */
let lastPop = 0;
function handleEvents() {
  for (const ev of GS.events) {
    if (ev.type === 'mg') SFX.mg();
    else if (ev.type === 'cannon') SFX.cannon();
    else if (ev.type === 'boom') {
      const near = Math.hypot(ev.x - GS.T.x, ev.z - GS.T.z) < GS.viewR;
      SFX.boom(near ? 1 : 0.35);
      if (near) flash = Math.max(flash, 0.12);
    } else if (ev.type === 'kill') { if (GS.t - lastPop > 0.08) { lastPop = GS.t; SFX.pop(); } }
    else if (ev.type === 'multi') showBanner((ev.kills >= 25 ? 'MASSACRE ×' : ev.kills >= 12 ? 'CARNAGE ×' : 'MULTI KILL ×') + ev.kills + '   +$' + ev.value);
    else if (ev.type === 'overheat') SFX.overheat();
    else if (ev.type === 'fuelout') SFX.radio();
  }
  GS.events.length = 0;
}

/* ---------------------------------------------------------------- loop */
let lastBeep = 99;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode !== 'paused' && !DBG.hold) {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 6) { game.update(1 / 60); acc -= 1 / 60; steps++; }
    if (steps === 6) acc = 0;
  }
  handleEvents();
  GS.free = lockFailed || touched;
  if (mode === 'play') {
    staticV = Math.max(0, staticV - dt * 1.4);
    if (GS.fuel < 10 && GS.fuel > 0 && Math.ceil(GS.fuel) !== lastBeep) { lastBeep = Math.ceil(GS.fuel); SFX.beep(); }
    if (GS.mode === 'ending') staticV = Math.min(0.9, GS.endT * 0.8);
    if (GS.mode === 'over') showOver();
  } else staticV = Math.max(0, staticV - dt);
  flash = Math.max(0, flash - dt * 1.2);
  renderFrame({ time: GS.t, dt, invert, flash, static: staticV, focus: GS.zoomBlur });
  const hint = mode !== 'play' ? '' : !GS.locked && !lockFailed ? 'CLICK TO TAKE THE GUNS · ESC TO PAUSE'
    : GS.free && GS.run < 8 ? 'AIM WITH THE CURSOR · PUSH IT TO AN EDGE TO MOVE' : '';
  drawHud(GS, dt, { live: mode === 'play' || mode === 'paused', locked: GS.locked || mode !== 'play', invert, hint });
  // keep the frame rate: drop the resolution if frames run long
  slowT = dt > 0.034 ? slowT + dt : Math.max(0, slowT - dt);
  if (slowT > 2 && dprCap > 0.75 && !DBG.fixedRes) { dprCap = Math.max(0.75, dprCap * 0.8); slowT = 0; layout(); }
  requestAnimationFrame(frame);
}

if (!initRenderer(glCanvas)) {
  $('noGl').hidden = false; $('startBtn').disabled = true; $('loading').hidden = true;
} else {
  initWorld(); initZombies(); initFx(); initHud(hudCanvas);
  game = createGame(); GS = game.S;
  layout();
  setMode('title');
  game.update(1 / 60);
  game.spawnScatter(220);
  if (/[?&]debug/.test(location.search)) window.__sr = { game, GS, R3, POST, U, DBG, HOT, COOL, ACTIVE };
  $('loading').hidden = true;
  requestAnimationFrame(frame);
}
