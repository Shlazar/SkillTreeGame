// main.js - input (mouse, keys, wheel), the camera mode, the main loop (fixed steps with hit-stop)
// and the start-up. window.__sr is a small API for tests and the browser console.

// ---------- camera mode
function setThermal(k) {
  thermal = k;
  if (mode === 'play' || mode === 'ending') banner('CAMERA', CAMS[thermal], thermal ? '#e8e8e8' : U.ink, 3);
}

// ---------- input
// Browser pointer position -> game pixels.
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointermove', (e) => {
  const p = toCanvas(e);
  M.x = p.x;
  M.y = p.y;
  M.inside = true;
});
cv.addEventListener('pointerleave', () => { M.inside = false; });
cv.addEventListener('pointerdown', (e) => {
  audioInit();
  try { cv.focus({ preventScroll: true }); } catch (_) { /* old browsers */ }
  const p = toCanvas(e);
  M.x = p.x;
  M.y = p.y;
  M.inside = true;
  if (e.button === 2) {
    tryHE();
    return;
  }
  if (e.button !== 0) return;
  M.down = true;
  M.pressed = true;
  M.px = p.x;
  M.py = p.y;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
  if (mode !== 'play' || p.y < 19) return;
  // a click on the field goes on after a pause; otherwise it is the trigger
  if (paused) {
    paused = false;
    M.used = true;
  } else G.trigger = true;
});
cv.addEventListener('pointerup', (e) => {
  const p = toCanvas(e);
  M.x = p.x;
  M.y = p.y;
  if (e.button !== 0) return;
  if (M.down) {
    M.down = false;
    M.released = true;
  }
  if (G) G.trigger = false;
});
cv.addEventListener('pointercancel', () => {
  M.down = false;
  if (G) G.trigger = false;
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
// the wheel zooms in and out one step (bigger or smaller pixels)
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const z = clamp(zoomStep + (e.deltaY < 0 ? 1 : -1), -1, 1);
  if (z !== zoomStep) {
    zoomStep = z;
    onResize();
  }
}, { passive: false });

const KEYS = {};
const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = keyName(e);
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
  KEYS[k] = true;
  if (e.repeat) return;
  audioInit();
  if (k === 'm') {
    Au.muted = !Au.muted;
    droneLevel = -1;
    return;
  }
  if (k === 't') {
    setThermal((thermal + 1) % 3);
    return;
  }
  if (mode === 'play') {
    if (k === ' ') tryHE();
    else if (k === 'Escape' || k === 'p') {
      paused = !paused;
      G.trigger = false;
    }
  } else if (mode === 'title') {
    if (k === 'Enter' || k === ' ') startGame();
  } else if (mode === 'summary') {
    if (k === 'Enter') startGame();
    else if (k === 'Escape') toTitle();
  }
});
addEventListener('keyup', (e) => { KEYS[keyName(e)] = false; });
// WASD or the arrow keys slide the view
function keyPan() {
  const x = (KEYS.d || KEYS.ArrowRight ? 1 : 0) - (KEYS.a || KEYS.ArrowLeft ? 1 : 0);
  const y = (KEYS.s || KEYS.ArrowDown ? 1 : 0) - (KEYS.w || KEYS.ArrowUp ? 1 : 0);
  const l = Math.hypot(x, y) || 1;
  G.pan[0] = mode === 'play' && !paused ? x / l : 0;
  G.pan[1] = mode === 'play' && !paused ? y / l : 0;
}
// pause when the window loses focus or the tab is hidden; let go of every key
function lostFocus() {
  for (const k in KEYS) KEYS[k] = false;
  if (G) G.trigger = false;
  M.down = false;
  if (mode === 'play') paused = true;
}
addEventListener('blur', lostFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden) lostFocus(); });
function onResize() {
  if (resize()) {
    bakeOverlays();
    if (G) placeCamera();
  }
}
addEventListener('resize', onResize);

// ---------- main loop
// last = time of the last frame, acc = game time still to step. FPS = stats for the debug API.
// hold = time stands still (tests take close-up pictures this way)
let last = performance.now(), acc = 0, droneLevel = -1, hold = false;
const FPS = { n: 0, sum: 0, worst: 0, t: 0, avg: 0, lastWorst: 0 };
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.1, Math.max(0, rdt));
  realT += dt;
  frameDt = dt;
  FPS.n++;
  FPS.sum += rdt;
  FPS.worst = Math.max(FPS.worst, rdt);
  FPS.t += rdt;
  if (FPS.t > 1) {
    FPS.avg = FPS.n / FPS.sum;
    FPS.lastWorst = FPS.worst;
    FPS.n = FPS.sum = FPS.worst = FPS.t = 0;
  }
  keyPan();
  // hit-stop: slow motion while slowT lasts
  let ts = 1;
  if (slowT > 0) {
    slowT -= dt;
    ts = slowK;
    if (slowT <= 0) slowK = 1;
  }
  // fixed steps of STEP seconds, at most 8 a frame
  if (!(mode === 'play' && paused) && !hold) {
    acc += dt * ts;
    let n = 0;
    try {
      while (acc >= STEP && n < 8) {
        step(STEP);
        acc -= STEP;
        n++;
      }
    } catch (err) {
      acc = 0;
      if (!loop.errs) {
        loop.errs = 1;
        console.error(err);
      }
    }
    if (n >= 8) acc = 0;
  }
  updateCam(dt);
  G.shownCash = Math.abs(G.shownCash - G.cash) < 1 ? G.cash : lerp(G.shownCash, G.cash, 1 - Math.exp(-10 * dt));
  // the engine hum: loud in play, quiet behind the menus
  const dl = mode === 'play' && !paused ? 1 : mode === 'ending' ? 0.7 : 0.4;
  if (Au.ctx && dl !== droneLevel) {
    droneLevel = dl;
    drone(dl);
  }
  cursor = 'default';
  try {
    render();
    drawUI();
  } catch (err) {
    if (!loop.rerr) {
      loop.rerr = 1;
      console.error(err);
    }
  }
  // the game draws its own sight, so the mouse pointer hides in play
  cv.style.cursor = mode === 'play' && !paused && M.y >= 19 && cursor === 'default' ? 'none' : cursor;
  M.pressed = false;
  M.released = false;
  M.used = false;
}

// ---------- start
function boot() {
  initSprites();
  bakeScorch();
  resize();
  bakeStatic();
  bakeOverlays();
  loadBest();
  newGame(true);
  mode = 'title';
  window.__sr = {
    get G() { return G; },
    get mode() { return mode; },
    FPS,
    CFG,
    start: startGame,
    title: toTitle,
    // sim(sec): run the game for sec seconds at once, without drawing
    sim: (sec) => {
      const n = Math.round(sec / STEP);
      for (let i = 0; i < n; i++) step(STEP);
    },
    aim: (x, y) => {
      M.x = x;
      M.y = y;
      M.inside = true;
    },
    trigger: (on) => { G.trigger = !!on && mode === 'play'; },
    he: () => tryHE(),
    thermal: (k) => setThermal(k),
    fuel: (f) => { G.fuel = f; },
    pause: (p) => { paused = !!p; },
    hold: (h) => { hold = !!h; },
    // bench(n): draw n frames at once; the average ms per frame
    bench: (n) => {
      const t = performance.now();
      for (let i = 0; i < n; i++) {
        render();
        drawUI();
      }
      return (performance.now() - t) / n;
    },
    stats: () => ({
      mode, kills: G.kills, cash: Math.round(G.cash), fuel: +G.fuel.toFixed(1), zombies: G.zombies.length, bodies: G.bodies.length,
      rounds: G.rounds.length, parts: parts.length, texts: texts.length, chunks: GROUND.size, decals: DECALS.size,
      W, H, SCALE, fps: Math.round(FPS.avg), worstMs: Math.round(FPS.lastWorst * 1000), lock: !!G.lock, heat: +G.heat.toFixed(2)
    })
  };
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(loop);
  });
}
boot();
