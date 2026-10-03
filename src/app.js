/* Sky Reaper: input, sound, screens, the HUD panels and the loop. */
const $ = (id) => document.getElementById(id);
const glCanvas = $('gl'), hudCanvas = $('hud');
let game = null, GS = null, mode = 'title', thermal = false, invert = false, flash = 0, staticV = 0, last = performance.now(), acc = 0;
let slowT = 0;
let best = 0, bank = 0;
const DBG = { hold: false, noStatic: false };      // ?debug: hold the simulation still, no static (tests)
try {
  best = +localStorage.getItem('skyreaper.px.best') || 0; bank = +localStorage.getItem('skyreaper.px.bank') || 0;
  thermal = localStorage.getItem('skyreaper.px.thermal') === '1'; invert = localStorage.getItem('skyreaper.px.bht') === '1';
} catch (e) { /* storage blocked */ }
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
  click() { sNoise('highpass', 4000, 4000, 1, 0.03, 0.08); sTone('square', 220, 180, 0.05, 0.03); },
  // a kill: a wet thump and the crisp tick of a confirmed hit
  splat() { sNoise('bandpass', 760, 260, 1.1, 0.1, 0.26); sTone('square', 1500, 1500, 0.03, 0.035); },
  tick() { sTone('square', 1900, 1900, 0.025, 0.03); },
  puff() { sNoise('lowpass', 900, 300, 0.7, 0.06, 0.05); },
  streak() { sTone('square', 660, 990, 0.12, 0.05); sTone('square', 990, 1320, 0.14, 0.05, 0.1); },
};

/* --------------------------------------------------------------- setup */
function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 3);
  sizeView(innerWidth, innerHeight, dpr);
  glCanvas.style.width = R3.canvasCss[0] + 'px'; glCanvas.style.height = R3.canvasCss[1] + 'px';
  resizeHud(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
}
addEventListener('resize', layout);
function zoom(step) {
  const z = clamp(zoomStep + step, -1, 1);
  if (z === zoomStep) return;
  zoomStep = z; layout(); SFX.click(); staticV = Math.max(staticV, 0.25);
}
const zoomLabel = () => ['0.5x', '1.0x', '1.5x'][zoomStep + 1];
function setThermal(on) {
  thermal = on; save('skyreaper.px.thermal', on ? 1 : 0);
  document.body.classList.toggle('thermal', on);
  $('modeColour').setAttribute('aria-pressed', String(!on)); $('modeThermal').setAttribute('aria-pressed', String(on));
  staticV = Math.max(staticV, 0.5);
  MAT.fresh = true;
}
function setMode(next) {
  mode = next;
  $('titleScreen').hidden = next !== 'title';
  $('pauseScreen').hidden = next !== 'paused';
  $('overScreen').hidden = next !== 'over';
  $('btn105').hidden = next !== 'play';
  document.body.classList.toggle('playing', next === 'play');
  document.body.classList.toggle('live', next === 'play' || next === 'paused');
  if (next !== 'play') { game.trigger(false); game.setPan(0, 0); }
  last = performance.now(); acc = 0;
}
function start() {
  audioInit(); SFX.ui(); SFX.radio();
  game.start();
  staticV = 0.85;
  setMode('play');
}
function pause() { if (mode === 'play') setMode('paused'); }
function resume() { setMode('play'); }
function showOver() {
  const isBest = GS.kills > best;
  if (isBest) { best = GS.kills; save('skyreaper.px.best', best); }
  bank += GS.cash; save('skyreaper.px.bank', bank);
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
// the crosshair is the mouse: no lock, no extra click
addEventListener('mousemove', (e) => {
  GS.cursor.x = clamp(e.clientX / innerWidth, 0, 1); GS.cursor.y = clamp(e.clientY / innerHeight, 0, 1);
  GS.cursor.inside = true;
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) GS.cursor.inside = false; });
// mouse buttons come through mousedown: a second button pressed while one is held is no pointerdown
glCanvas.addEventListener('mousedown', (e) => {
  if (mode !== 'play') return;
  audioInit();
  e.preventDefault();
  GS.cursor.x = clamp(e.clientX / innerWidth, 0, 1); GS.cursor.y = clamp(e.clientY / innerHeight, 0, 1);
  if (e.button === 2) game.fireHE();
  else if (e.button === 0) game.trigger(true);
});
addEventListener('mouseup', (e) => { if (e.button === 0) game.trigger(false); });
// touch: the finger aims and holds the 25mm, the round button fires the 105
glCanvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || e.pointerType === 'mouse') return;
  audioInit();
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
let wheelAcc = 0;
addEventListener('wheel', (e) => {
  if (mode !== 'play') return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 60) { zoom(wheelAcc < 0 ? 1 : -1); wheelAcc = 0; }
}, { passive: false });
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && mode === 'play') game.fireHE(); return; }
  if (e.code === 'KeyT' && !e.repeat) { setThermal(!thermal); SFX.click(); return; }
  if (e.code === 'KeyB' && !e.repeat) { invert = !invert; save('skyreaper.px.bht', invert ? 1 : 0); if (!thermal) setThermal(true); SFX.click(); return; }
  if (e.code === 'KeyZ' && !e.repeat && mode === 'play') { zoom(zoomStep >= 1 ? -2 : 1); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (mode === 'play') pause(); else if (mode === 'paused') resume(); return; }
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
$('modeColour').addEventListener('click', () => { setThermal(false); SFX.click(); });
$('modeThermal').addEventListener('click', () => { setThermal(true); SFX.click(); });
$('btn105').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); game.fireHE(); });

/* --------------------------------------------------------------- events */
let lastPop = 0, lastPuff = 0;
function banner(text) {
  showBanner(text);
  const b = $('banner');
  b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function handleEvents() {
  for (const ev of GS.events) {
    if (ev.type === 'mg') SFX.mg();
    else if (ev.type === 'cannon') SFX.cannon();
    else if (ev.type === 'boom') {
      const near = Math.hypot(ev.x - GS.T.x, ev.z - GS.T.z) < GS.viewR;
      SFX.boom(near ? 1 : 0.35);
      if (near) flash = Math.max(flash, thermal ? 0.12 : 0.08);
    } else if (ev.type === 'kill') { if (GS.t - lastPop > 0.045) { lastPop = GS.t; ev.cause === 'mg' ? SFX.splat() : SFX.pop(); } }
    else if (ev.type === 'hit') SFX.tick();
    else if (ev.type === 'impact') { if (!ev.hits && GS.t - lastPuff > 0.06) { lastPuff = GS.t; SFX.puff(); } }
    else if (ev.type === 'streak') { SFX.streak(); banner('STREAK ×' + ev.n + '   +$' + ev.bonus); }
    else if (ev.type === 'multi') banner((ev.kills >= 25 ? 'MASSACRE ×' : ev.kills >= 12 ? 'CARNAGE ×' : 'MULTI KILL ×') + ev.kills + '   +$' + ev.value);
    else if (ev.type === 'overheat') SFX.overheat();
    else if (ev.type === 'fuelout') SFX.radio();
  }
  GS.events.length = 0;
}
// the panels of the colour HUD
const UI = {};
function updatePanels() {
  const S = GS, low = S.fuel < 10;
  const set = (id, v) => { if (UI[id] !== v) { UI[id] = v; $(id).textContent = v; } };
  set('fuelNum', mmss(S.fuel)); set('cash', String(S.cash)); set('kills', String(S.kills)); set('horde', String(S.zombies.length));
  $('fuelFill').style.width = (Math.max(0, S.fuel) / CFG.fuel * 100).toFixed(1) + '%';
  $('fuelHud').classList.toggle('low', low);
  set('mgState', S.overheat ? 'HOT' : S.trigger ? 'FIRE' : 'HOLD');
  $('mgState').classList.toggle('wait', S.overheat);
  $('mgCard').classList.toggle('hot', S.mgHeat > 0.75);
  $('mgFill').style.width = (S.mgHeat * 100).toFixed(1) + '%';
  const ready = S.heReload <= 0;
  set('heState', ready ? 'READY' : 'LOADING');
  $('heState').classList.toggle('wait', !ready);
  $('heFill').style.width = ((1 - S.heReload / CFG.he.reload) * 100).toFixed(1) + '%';
  const warn = low && S.mode === 'play';
  if ($('warn').hidden === warn) $('warn').hidden = !warn;
  $('warn').classList.toggle('on', warn);
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
  if (mode === 'play') {
    staticV = Math.max(0, staticV - dt * 1.4);
    if (GS.fuel < 10 && GS.fuel > 0 && Math.ceil(GS.fuel) !== lastBeep) { lastBeep = Math.ceil(GS.fuel); SFX.beep(); }
    if (GS.mode === 'ending') staticV = Math.min(0.9, GS.endT * 0.8);
    if (GS.mode === 'over') showOver();
  } else staticV = Math.max(0, staticV - dt);
  flash = Math.max(0, flash - dt * 1.2);
  if (DBG.noStatic) staticV = 0;
  renderFrame({ time: GS.t, dt, thermal, invert, flash, static: staticV });
  const hint = mode === 'play' && GS.run < 6 ? 'HOLD LEFT CLICK ON THE DEAD · THE SIGHT LOCKS ON · RIGHT CLICK FOR THE 105' : '';
  drawHud(GS, dt, { live: mode === 'play' || mode === 'paused', thermal, invert, hint, zoomLabel: zoomLabel() });
  if (!thermal && (mode === 'play' || mode === 'paused')) {
    updatePanels();
    const h = $('hint');
    if (h.textContent !== hint) h.textContent = hint;
    h.hidden = !hint;
  }
  // keep the frame rate: light at fewer pixels if frames run long
  slowT = dt > 0.034 ? slowT + dt : Math.max(0, slowT - dt);
  if (slowT > 2.5 && R3.lightBudget > 6e5 && !DBG.hold) { R3.lightBudget = 6e5; slowT = 0; layout(); }
  requestAnimationFrame(frame);
}

if (!initRenderer(glCanvas)) {
  $('noGl').hidden = false; $('startBtn').disabled = true; $('loading').hidden = true;
} else {
  initLook(); initWorld(); initZombies(); initFx(); initHud(hudCanvas);
  NOCAST.push(ground, decalMesh, tracerMesh, wires, zombieXray);
  game = createGame(); GS = game.S;
  layout();
  setThermal(thermal);
  staticV = 0;
  setMode('title');
  game.update(1 / 60);
  game.spawnScatter(220);
  if (/[?&]debug/.test(location.search)) window.__sr = { game, GS, R3, MAT, U, DBG, VIEW, PART, ACTIVE, setThermal, zoom, layout, toArt };
  $('loading').hidden = true;
  requestAnimationFrame(frame);
}
