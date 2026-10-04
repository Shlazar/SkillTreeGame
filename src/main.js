// main.js - input (mouse, keys, wheel), the camera mode, the main loop (fixed steps with hit-stop)
// and the start-up (the save is read first). window.__sr is a small API for tests and the browser
// console.

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
  M.right = !!(e.buttons & 2);
  if (HANGAR.drag) hangarMove(p.x, p.y);
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
    M.right = true;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* release still reaches the window */ }
    if (mode === 'depot') { M.rpressed = true; hangarCancel(); }
    if (mode === 'play' && !paused && airCancel()) return;
    if (mode === 'play' && !paused && p.y >= 19 && p.y < VH) heliRight(p.x, p.y);
    return;
  }
  if (e.button !== 0) return;
  if (mode === 'depot' && depotTab === 'hangar' && hangarDown(p.x, p.y)) {
    M.down = true;
    M.px = p.x;
    M.py = p.y;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* outside release cancels below */ }
    return;
  }
  // Plane controls consume their own clicks before the battlefield sees them.
  if (mode === 'play' && !paused && airDown(p.x, p.y)) {
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* release can still reach the canvas */ }
    return;
  }
  if (mode === 'play' && p.y >= VH) return;
  // a click on the Turbo Ram's card rams (it does not fire the 25mm)
  if (mode === 'play' && !paused && RAMCARD.on && inR(p.x, p.y, RAMCARD.x, RAMCARD.y, RAMCARD.w, RAMCARD.h)) {
    tryRam();
    return;
  }
  // The remaining click is handled by the current screen or the field.
  M.down = true;
  M.pressed = true;
  M.px = p.x;
  M.py = p.y;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine without */ }
  if (mode === 'summary' && realT - sumStart > 0.6) sumSkip();
  if (mode !== 'play' || p.y < 19) return;
  // a click on the field goes on after a pause; otherwise it selects helis (helis.js)
  if (paused) {
    if (!pauseHit(p.x, p.y)) {
      setPaused(false);
      M.used = true;
    }
  } else heliDown(p.x, p.y, e.shiftKey);
});
cv.addEventListener('pointerup', (e) => {
  const p = toCanvas(e);
  M.x = p.x;
  M.y = p.y;
  M.right = !!(e.buttons & 2);
  if (e.button !== 0) return;
  if (M.down) {
    M.down = false;
    M.released = true;
  }
  if (mode === 'depot' && depotTab === 'hangar' && hangarUp(p.x, p.y)) { M.used = true; return; }
  if (mode === 'play' && !paused && airUp(p.x, p.y)) return;
  // A drag released in the reserved strip cannot command units in the world above it.
  if (mode === 'play' && p.y >= VH) { HUI.box = null; return; }
  if (mode === 'play' && !paused && p.y < VH) heliUp(p.x, p.y);
  else HUI.box = null;
});
cv.addEventListener('pointercancel', () => {
  M.down = M.right = false;
  airCancel();
  hangarCancel();
  if (G) G.trigger = false;
});
cv.addEventListener('lostpointercapture', () => {
  M.right = false;
  if (HANGAR.drag) { M.down = false; hangarCancel(); }
});
// A release can land outside the canvas, or arrive as a move when another button stays held.
addEventListener('pointerup', (e) => {
  if (!(e.buttons & 2)) M.right = false;
  if (e.target !== cv && HANGAR.drag) { M.down = false; hangarCancel(); }
});
addEventListener('pointermove', (e) => { if (!(e.buttons & 2)) M.right = false; });
addEventListener('pointercancel', () => { M.right = false; hangarCancel(); });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
// the wheel zooms in and out one step (bigger or smaller pixels)
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  // (over the skill tree it zooms the tree)
  if (treeCovers()) {
    treeWheel(e.deltaY);
    return;
  }
  if (mode === 'depot' && depotTab === 'hangar') return;
  const z = clamp(zoomStep + (e.deltaY < 0 ? 1 : -1), -1, 1);
  if (z !== zoomStep) {
    zoomStep = z;
    onResize();
  }
}, { passive: false });

// KEYS[k] = true while key k is held.
const KEYS = {};
const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = keyName(e);
  if (k === ' ' || k === 'Tab' || k.startsWith('Arrow')) e.preventDefault();
  KEYS[k] = true;
  if (e.repeat) return;
  audioInit();
  if (k === 'm') {
    Au.muted = !Au.muted;
    droneLevel = -1;
    if (Au.muted) SFX.ramStop(0.05);
    return;
  }
  if (k === 't') {
    setThermal((thermal + 1) % 3);
    return;
  }
  if (mode === 'play') {
    if (['q', 'w', 'e', 'r'].includes(k)) { if (!paused) airKey(k); }
    else if (k === 'Escape' || k === 'p') setPaused(!paused);
    else if (!paused) heliKey(k);
  } else if (mode === 'title') {
    if (k === 'Enter' || k === ' ') titleGo();
    else if (k === 'Escape') titleAsk = false;
  } else if (mode === 'depot') depotKey(k);
  else if (mode === 'summary') {
    // ENTER or ESC: show it all, then go to the Depot, after the opening moment.
    if ((k === 'Enter' || k === 'Escape') && realT - sumStart > 0.6 && !sumSkip()) toDepot();
  }
});
addEventListener('keyup', (e) => { KEYS[keyName(e)] = false; });
// Pause a run or go on: the trigger is let go. The Turbo Ram's roar stops on pause and comes back
// (for the time the Ram has left) on going on.
function setPaused(p) {
  if (p === paused) return;
  paused = p;
  if (G) G.trigger = false;
  if (p) SFX.ramStop(0.15);
  else if (G && G.ram.on && !G.demo && mode === 'play') SFX.roar(G.ram.dur + CFG.ram.ease - G.ram.t, false);
}
// pause when the window loses focus or the tab is hidden; let go of every key and the trigger
function lostFocus() {
  for (const k in KEYS) KEYS[k] = false;
  if (G) G.trigger = false;
  M.down = M.right = false;
  airCancel();
  hangarCancel();
  if (mode === 'play') setPaused(true);
}
addEventListener('blur', lostFocus);
// the page is closed or left in the middle of a run: what the run earned so far is kept
addEventListener('pagehide', () => {
  if (mode === 'play' || mode === 'ending') bankRun();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) lostFocus(); });
function onResize() {
  if (resize()) {
    hangarCancel();
    bakeOverlays();
    if (G) placeCamera();
  }
}
addEventListener('resize', onResize);

// ---------- main loop
// last = time of the last frame, acc = game time still to step. FPS = stats for the debug API.
// hold = time stands still (tests take close-up pictures this way)
let last = performance.now(), acc = 0, droneLevel = -1, hold = false;
// tests: a skill tree node the mouse stays on (__sr.hoverNode), even while the window settles
let testHover = null;
const FPS = { n: 0, sum: 0, worst: 0, t: 0, avg: 0, lastWorst: 0 };
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = (now - last) / 1000;
  last = now;
  FPS.n++;
  FPS.sum += rdt;
  FPS.worst = Math.max(FPS.worst, rdt);
  FPS.t += rdt;
  if (FPS.t > 1) {
    FPS.avg = FPS.n / FPS.sum;
    FPS.lastWorst = FPS.worst;
    FPS.n = FPS.sum = FPS.worst = FPS.t = 0;
  }
  oneFrame(Math.min(0.1, Math.max(0, rdt)));
}
// One frame of dt seconds: the game steps, the camera, the sound, the drawing, then the mouse
// clicks are used up.
function oneFrame(dt) {
  syncViewHeight();
  realT += dt;
  frameDt = dt;
  // hit-stop: slow motion while slowT lasts
  let ts = 1;
  if (slowT > 0) {
    slowT -= dt;
    ts = slowK;
    if (slowT <= 0) slowK = 1;
  }
  // Aiming leaves time to place the strike; reduced motion keeps normal game speed.
  if (!REDUCED && mode === 'play' && airAimActive()) ts = Math.min(ts, 0.5);
  // fixed steps of STEP seconds, at most 8 a frame
  if (!(mode === 'play' && paused) && !hold && !treeCovers()) {
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
  // the view's lead glides in real time, also while time runs slow or stands still
  camLead(dt);
  placeCamera();
  updateCam(dt);
  G.shownCash = Math.abs(G.shownCash - G.cash) < 1 ? G.cash : lerp(G.shownCash, G.cash, 1 - Math.exp(-10 * dt));
  // the engine hum: loud in play, quiet behind the menus, higher while the Turbo Ram runs
  const live = mode === 'play' && !paused, dl = live ? 1 : mode === 'ending' ? 0.7 : 0.4;
  const dk = live && !G.demo ? Math.round(ramK() * 4) / 4 : 0;
  if (Au.ctx && dl + dk * 10 !== droneLevel) {
    droneLevel = dl + dk * 10;
    drone(dl, dk);
  }
  cursor = 'default';
  if (testHover && mode === 'depot') {
    const p = nodeXY(testHover);
    M.x = p.x;
    M.y = p.y;
    M.inside = true;
  }
  try {
    tutFrame(dt);
    render();
    drawUI();
    drawFade();
  } catch (err) {
    if (!loop.rerr) {
      loop.rerr = 1;
      console.error(err);
    }
  }
  cv.style.cursor = cursor;
  M.pressed = false;
  M.released = false;
  M.used = false;
  M.rpressed = false;
}

// ---------- start
function boot() {
  initSprites();
  bakeScorch();
  resize();
  bakeStatic();
  bakeOverlays();
  loadSave();
  newGame(true);
  mode = 'title';
  window.__sr = {
    get G() { return G; },
    get mode() { return mode; },
    get SAVE() { return SAVE; },
    FPS,
    CFG,
    // the horde by distance (rows of HORDE in game.js), for balance tests
    HORDE,
    // the sprites, for a test sheet
    art: () => ({ TRAIN, FOOT, HSPR, ROTOR, STATION, SURV, ZS, ICON, TURRET }),
    // start(): ride the next leg; start(n) selects a leg for tests.
    start: (n) => startGame(n),
    title: toTitle,
    // depot(tab): the Depot screen with its tree tab open
    depot: (tab) => toDepot(tab || 'tree'),
    // sim(sec): run the game for sec seconds at once, without drawing
    sim: (sec) => {
      const n = Math.round(sec / STEP);
      for (let i = 0; i < n; i++) {
        step(STEP);
        camLead(STEP);
      }
    },
    aim: (x, y) => {
      M.x = x;
      M.y = y;
      M.inside = true;
    },
    trigger: (on) => { G.trigger = !!on && mode === 'play'; },
    he: () => tryHE(),
    thermal: (k) => setThermal(k),
    // hp(v): set health. jump(px): move to px before this leg's goal; leave the dead behind.
    hp: (v) => { G.tr.hp = G.tr.hpShown = v; },
    jump: (px) => {
      const to = G.goalS + Math.max(0, Number(px) || 0);
      G.tr.s = Math.min(G.tr.s, to);
      for (const z of G.zombies) z.gone = true;
      layoutTrain();
      placeCamera();
    },
    // km(x): move within this leg without paying. Arrival still goes through braking.
    km: (x) => {
      if (G.demo) return;
      const s = clamp(sAtKm(x), G.goalS, G.tr.startS), tr = G.tr;
      tr.s = s;
      tr.fy = yOfS(s);
      for (const w of G.walls) if (w.s > s) w.placed = w.warned = w.awake = true;
      for (const z of G.zombies) z.gone = true;
      G.maxKm = Math.max(G.maxKm, kmAt(s));
      layoutTrain();
      placeCamera();
    },
    // lose(): the train breaks now (the summary follows 3.4 s later)
    lose: () => { if (mode === 'play' && !G.result) lose(); },
    keys: (k, on) => { KEYS[k] = !!on; },
    // hit(z, dmg, cause): zombie z takes dmg (default 1) as from a gun ('mg', or 'gun' = the flatcar gun)
    hit: (z, dmg, cause) => hitZombie(z, dmg || 1, cause || 'mg'),
    // spawn(type, sx, sy): a zombie standing still at screen pixel (sx, sy): 0 walker, 1 runner, 2 brute
    spawn: (type, sx, sy) => {
      const z = makeZombie(G.camX + sx, G.camY + sy, type | 0);
      z.sp = 0;
      G.zombies.push(z);
      return z;
    },
    // press(k): a key goes down and up, as if typed (k = 'Enter', 'Tab', 'Escape', 'a'...)
    press: (k) => {
      dispatchEvent(new KeyboardEvent('keydown', { key: k }));
      dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    },
    // hover(x, y) / click(x, y): the mouse over / a full click at game pixel (x, y); click draws
    // one frame so the button under it acts at once
    hover: (x, y) => {
      testHover = null;
      M.x = x;
      M.y = y;
      M.inside = true;
    },
    click: (x, y) => {
      M.x = M.px = x;
      M.y = M.py = y;
      M.inside = true;
      M.down = false;
      M.pressed = M.released = true;
      M.used = false;
      if (mode === 'summary') sumSkip();
      render();
      drawUI();
      M.pressed = M.released = false;
    },
    // frames(n, dt): n whole frames of dt s (default 1/60) at once, as the main loop runs them
    // (the clock, the game, the drawing, the clicks). Headless pages barely run their own frames.
    frames: (n, dt) => {
      for (let i = 0; i < (n || 1); i++) oneFrame(dt || 1 / 60);
    },
    // the Turbo Ram: ram() = press E (true when it starts), ramCharge(v) = fill it to v (0..1);
    // ramState() = 'none', 'lock', 'on', 'stop', 'charge' or 'ready'
    ram: () => tryRam(),
    ramCharge: (v) => {
      G.ram.left = Math.round((1 - clamp(+v || 0, 0, 1)) * CFG.ram.charge);
      return ramCharge();
    },
    ramState: () => ramState(),
    // sound: roar = the Ram's roar is playing (or set to play), ctx = the audio is on
    sound: () => ({ ctx: !!Au.ctx, roar: !!Au.roar, muted: Au.muted }),
    // bot(on): the autopilot handles the Ram and smart plane strikes; the Viper fires by itself.
    bot: (on) => { G.bot = !!on; if (!on) G.trigger = false; },
    pause: (p) => setPaused(!!p),
    hold: (h) => { hold = !!h; },
    // the save: give(scrap, surv, gold) adds money,
    // save() is a copy of it, load() reads it again from storage, reset() wipes it (to the title)
    give: (scrap, surv, gold) => {
      for (const [key, value] of [['scrap', scrap], ['surv', surv], ['gold', gold]]) {
        const amount = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
        SAVE[key] = clamp(SAVE[key] + amount, 0, Number.MAX_SAFE_INTEGER);
      }
      saveSave();
      return { scrap: SAVE.scrap, surv: SAVE.surv, gold: SAVE.gold };
    },
    // the skill tree: node(id, l) sets a level (no price), buy(id) buys one level as a click does
    // (true when bought), nodeAt(id) = where the node is on screen with the tree tab open,
    // hoverNode(id) puts the mouse on it, clickNode(id) clicks it, tree() = each node's level and state
    node: (id, l) => setNode(id, l),
    buy: (id) => buyNode(id),
    nodeAt: (id) => nodeXY(id),
    hoverNode: (id) => {
      testHover = NODE[id] ? id : null;
      const p = nodeXY(id);
      if (p) {
        M.x = p.x;
        M.y = p.y;
        M.inside = true;
      }
      return p;
    },
    clickNode: (id) => {
      const p = nodeXY(id);
      if (p) window.__sr.click(p.x, p.y);
      return p;
    },
    tree: () => Object.fromEntries(NODES.map((n) => [n.id, lv(n.id) + ' ' + nodeState(n)])),
    goal: () => summaryGoal(),
    // infoFit() = the info box lines that do not fit on one line of the box, at any level (none is
    // right), and the widest line's width next to the room there is
    infoFit: () => {
      const bad = [], inner = INFO_W - 14;
      let widest = 0;
      for (const n of NODES) {
        widest = Math.max(widest, tw(n.desc));
        if (tw(n.desc) > inner) bad.push(n.id + ': ' + n.desc);
        for (const s of [n.stat, n.stat2].filter(Boolean)) {
          for (let l = 0; l <= maxLv(n); l++) {
            const w = statSegs(s, l, l >= maxLv(n)).reduce((a, [t]) => a + tw(t) + 5, -5);
            widest = Math.max(widest, w);
            if (w > inner) bad.push(n.id + ' LV ' + l + ': ' + w);
          }
        }
      }
      return { bad, widest, inner };
    },
    save: () => JSON.parse(JSON.stringify(SAVE)),
    load: () => loadSave(),
    reset: () => {
      newSave();
      titleAsk = false;
      toTitle();
    },
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
      mode, result: G.result, km: G.demo ? 0 : +DK().toFixed(3), kills: G.kills, cash: Math.floor(G.cash), runSurv: G.surv,
      scrap: SAVE.scrap, survivors: SAVE.surv, gold: SAVE.gold, leg: G.leg, runs: SAVE.runs,
      pay: Object.assign({}, G.pay), hp: Math.round(G.tr.hp), max: G.tr.max, speed: +G.tr.v.toFixed(1),
      onTrain: G.onTrain, t: +G.run.toFixed(1), zombies: G.zombies.length, bodies: G.bodies.length, up: Object.assign({}, G.up),
      shots: G.shots, scavPaid: G.scavPaid, overheat: G.overheat, heReload: +G.heReload.toFixed(2), hurt: Object.assign({}, G.hurt),
      station: G.station ? G.station.id + ' ' + G.station.state : '-',
      walls: G.walls.map((w) => w.km + (w.awake ? ' awake' : w.placed ? ' placed' : ' ahead')),
      helis: G.helis.map((h) => [Math.round(h.x - G.tr.fx), Math.round(h.y - G.tr.fy)]),
      rounds: G.rounds.length, parts: parts.length, texts: texts.length, chunks: GROUND.size, decals: DECALS.size,
      W, H, VH, SCALE, fps: Math.round(FPS.avg), worstMs: Math.round(FPS.lastWorst * 1000), heat: +G.heat.toFixed(2),
      gun: { rate: G.up.gun, shots: G.gun.shots, kills: G.gun.kills, ang: +G.gun.ang.toFixed(2), tgt: G.gun.tgt ? G.gun.tgt.st : -1 },
      ram: { state: ramState(), on: G.ram.on, t: +G.ram.t.toFixed(2), charge: +ramCharge().toFixed(3), kills: G.ram.kills, pay: G.ram.pay,
        uses: G.ram.uses, total: G.ram.total }
    })
  };
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(loop);
  });
}
boot();
