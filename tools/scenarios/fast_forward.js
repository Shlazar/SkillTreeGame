// Player 1X/2X uses actual fixed-step frames, keyboard input and the rendered HUD button.
function check(ok, why) { if (!ok) throw new Error(why); }
function near(actual, expected, why, tolerance = 1 / 60 + 1e-6) {
  check(Math.abs(actual - expected) <= tolerance, why + ': ' + actual + ' expected ' + expected);
}
function fresh() {
  __sr.hold(false); __sr.pause(false); __sr.reset();
  check(__sr.node('a10', 1) && __sr.node('ram', 1), 'Speed fixture ownership failed');
  for (const lesson of __sr.tutState().lessonText) __sr.SAVE.seen[lesson.key] = true;
  __sr.start(); __sr.bot(false); __sr.hp(9999); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  // Isolate clock behavior from hits, timed rewards and arrivals; weapons/input remain production.
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  g.eventIndex = __sr.line().legs[g.leg - 1].events.length;
  g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  return g;
}
function advance(g, n, dt = 1 / 60) {
  const before = g.run; __sr.frames(n, dt); return g.run - before;
}
function pointer(type, button, x, y) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, button,
    buttons: type === 'pointerdown' ? (button === 2 ? 2 : 1) : 0,
    pointerId: 1, pointerType: 'mouse', isPrimary: true,
    clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
}
function click(x, y, button = 0) {
  pointer('pointerdown', button, x, y); __sr.frames(1);
  pointer('pointerup', button, x, y); __sr.frames(1);
}
function overlap(a, b) {
  return a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function inside(r, W, H, why) {
  if (!r) return;
  check(['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) && r.x >= 0 && r.y >= 0 &&
    r.x + r.w <= W && r.y + r.h <= H, why + ': ' + JSON.stringify(r));
}

let g = fresh();
check(__sr.playSpeed().selected === 1 && __sr.playSpeed().effective === 1, 'New run is not1X');
const normal = advance(g, 60); near(normal, 1, '1X real-frame clock');
const savedBeforeKey = JSON.stringify(__sr.save());
__sr.press('f');
check(__sr.playSpeed().selected === 2 && __sr.playSpeed().effective === 2, 'F did not select2X');
check(JSON.stringify(__sr.save()) === savedBeforeKey, 'F changed the persistent save');
const fast = advance(g, 60); near(fast, 2, '2X real-frame clock');
const catchup = advance(g, 10, 0.1); near(catchup, 2, '2X100ms-frame catch-up budget');
dispatchEvent(new KeyboardEvent('keydown', {key: 'f', repeat: true}));
dispatchEvent(new KeyboardEvent('keyup', {key: 'f'}));
check(__sr.playSpeed().selected === 2, 'Held F repeated the toggle');

__sr.press('p');
check(__sr.playSpeed().effective === 0 && !__sr.playSpeed().available, 'Pause did not freeze speed');
__sr.press('f'); near(advance(g, 30), 0, 'Paused2X clock', 1e-9);
check(__sr.playSpeed().selected === 2, 'F changed speed while paused');
const pausedButton = __sr.uiBounds().hud.speed;
click(pausedButton.x + pausedButton.w / 2, pausedButton.y + pausedButton.h / 2);
check(__sr.playSpeed().selected === 2 && __sr.playSpeed().effective === 0, 'Disabled HUD speed button changed pause');
__sr.press('p');
near(advance(g, 30), 1, 'Pause resume retained2X');
__sr.hold(true); near(advance(g, 30), 0, 'Debug hold remained frozen', 1e-9); __sr.hold(false);

__sr.press('q'); check(__sr.planeAim().active, 'Q did not begin production aiming');
const aimingRate = __sr.uiBounds().viewport.reduced ? 2 : 0.5;
near(__sr.playSpeed().effective, aimingRate, 'Actual aiming rate', 1e-9);
const aiming = advance(g, 60); near(aiming, aimingRate, '2X still preserves aiming slow motion');
const dims = __sr.stats(); click(dims.W * 0.55, dims.VH * 0.45, 2);
check(!__sr.planeAim().active && __sr.playSpeed().selected === 2 && __sr.playSpeed().effective === 2,
  'Aim cancellation did not restore2X');

__sr.press(' '); check(g.ram.on, 'Space did not start Turbo Ram at2X');
const ramBefore = {t: g.ram.t, cd: g.ram.cd, duration: g.ram.dur, damage: g.ram.damage};
const ramElapsed = advance(g, 30);
near(ramElapsed, 1, '2X Ram world time'); near(g.ram.t - ramBefore.t, 1, 'Ram duration advanced in game time');
near(ramBefore.cd - g.ram.cd, 1, 'Ram cooldown advanced in game time');
check(g.ram.dur === ramBefore.duration && g.ram.damage === ramBefore.damage && g.tr.v <= __sr.CFG.ram.speed,
  'Fast-forward altered Ram stats or train speed');

g = fresh(); __sr.frames(1);
const speedButton = __sr.uiBounds().hud.speed, orderBefore = JSON.stringify(g.helis[0].order);
const savedBeforeClick = JSON.stringify(__sr.save());
click(speedButton.x + speedButton.w / 2, speedButton.y + speedButton.h / 2);
check(__sr.playSpeed().selected === 2 && JSON.stringify(g.helis[0].order) === orderBefore, 'HUD click did not toggle independently of Viper orders');
check(JSON.stringify(__sr.save()) === savedBeforeClick, 'HUD speed click changed the save');
near(advance(g, 30), 1, 'HUD-selected2X clock');
__sr.lose();
check(!__sr.playSpeed().available && __sr.playSpeed().effective === 1, 'Ending retained fast-forward');
const endingBefore = g.t; __sr.frames(6); near(g.t - endingBefore, 0.1, 'Ending animation remains1X');
__sr.press('f'); check(__sr.playSpeed().selected === 2, 'Ending accepted F');
__sr.sim(4); check(__sr.mode === 'summary', 'Loss did not reach summary');
__sr.press('f'); check(__sr.playSpeed().selected === 2 && !__sr.playSpeed().available, 'Summary accepted F');
__sr.title(); __sr.press('f'); check(__sr.mode === 'title' && !__sr.playSpeed().available, 'Title accepted F');
__sr.start(); check(__sr.playSpeed().selected === 1, 'Next real run retained2X');

// Lose during the first fixed step of a 2X frame, not before the frame starts.
// The remaining accumulator must retain only its equivalent 1X wall-time duration.
g = fresh(); __sr.press('f');
const transitionBefore = {t: g.t, pending: __sr.playSpeed().pending}, transitionDt = 0.1, fixed = 1 / 60;
g.timers.push({t: fixed, f: () => __sr.lose()});
const remaining = (transitionBefore.pending + transitionDt * 2 - fixed) / 2;
const endingSteps = Math.floor(remaining / fixed), expectedPending = remaining - endingSteps * fixed;
__sr.frames(1, transitionDt);
check(__sr.mode === 'ending' && __sr.playSpeed().effective === 1, 'Mid-frame loss did not leave2X');
near(g.t - transitionBefore.t, (1 + endingSteps) * fixed, 'Mid-frame ending steps', 1e-9);
near(__sr.playSpeed().pending, expectedPending, 'Mid-frame remainder rescaled exactly once', 1e-9);
check(g.endT <= transitionDt + fixed, 'Mid-frame ending consumed the old2X budget');
const transition = {before: transitionBefore, elapsed: g.t - transitionBefore.t,
  endTime: g.endT, pending: __sr.playSpeed().pending, expectedPending};

// Real portrait resize: all three counters, health, route, speed and pause must fit independently.
const properties = ['innerWidth', 'innerHeight', 'devicePixelRatio'];
const originals = Object.fromEntries(properties.map(k => [k, Object.getOwnPropertyDescriptor(window, k)]));
let narrow;
try {
  Object.defineProperty(window, 'innerWidth', {configurable: true, value: 700});
  Object.defineProperty(window, 'innerHeight', {configurable: true, value: 1000});
  Object.defineProperty(window, 'devicePixelRatio', {configurable: true, value: 1});
  dispatchEvent(new Event('resize'));
  g = fresh(); g.cash = g.shownCash = 1234; g.surv = 12; g.gold = 123; g.kills = 321;
  __sr.SAVE.flags.survShown = __sr.SAVE.flags.goldShown = true;
  __sr.hp(152); __sr.hold(true); __sr.frames(1);
  const bounds = __sr.uiBounds(), h = bounds.hud, {W, H} = bounds.viewport;
  check(W === 350 && h.speed, 'Expected350px portrait HUD');
  const rects = [...h.counters, h.kills, ...Object.values(h.health), h.route?.label, h.route?.line, h.speed, h.pause].filter(Boolean);
  for (const r of rects) inside(r, W, H, 'Narrow HUD bounds');
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++)
    check(!overlap(rects[i], rects[j]), 'Narrow HUD collision: ' + JSON.stringify([rects[i], rects[j]]));
  __sr.pause(true); __sr.frames(1); inside(__sr.uiBounds().pauseMenu, W, H, 'Pause help bounds');
  narrow = {viewport: bounds.viewport, hud: h, pause: __sr.uiBounds().pauseMenu};
  __sr.title(); __sr.frames(1); inside(__sr.uiBounds().title, W, H, 'Title help bounds');
} finally {
  __sr.hold(false); __sr.pause(false);
  for (const key of properties) if (originals[key]) Object.defineProperty(window, key, originals[key]); else delete window[key];
  dispatchEvent(new Event('resize'));
}
QA_DONE({normal, fast, catchup, aiming, aimingRate, ramElapsed, actualKeyAndButton: true,
  pauseAndHold: true, endingMenus1X: true, transition, resetEachRun: true, noSaveMutation: true, narrow});
