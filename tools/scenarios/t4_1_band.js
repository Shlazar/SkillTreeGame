// Plane-band layout and matching crowded fight views; this task does not test plane strikes.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshBand(owned) {
  __sr.hold(false); __sr.reset();
  if (owned) check(__sr.node('a10', 1), 'A-10 ownership fixture failed');
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(true); __sr.rightUp(4, 70);
}
function checkBand(owned) {
  const s = __sr.stats(), b = __sr.planeBand();
  check(b.visible === owned && s.VH === b.worldHeight && b.fullHeight === s.H &&
    b.x === 0 && b.y === s.VH && b.w === s.W && b.h === s.H - s.VH, 'Band geometry disagrees: ' + JSON.stringify({s: {W: s.W, H: s.H, VH: s.VH}, b}));
  check(owned ? b.h === 18 : s.VH === s.H && b.h === 0, 'Plane band must reserve exactly18px only when owned');
  return b;
}
function bandShot(owned) {
  freshBand(owned); __sr.sim(10); __sr.frames(240);
  __sr.hold(true); __sr.frames(30);
  const {W, VH} = __sr.stats();
  // A dense visible crowd straddles the new world edge, exercising the horde raster path.
  __sr.crowd(100, W * 0.46, VH - 3, 42, 0);
  __sr.frames(1);
  return {band: checkBand(owned), stats: __sr.stats(), heli: __sr.helis()[0]};
}
function pointer(type, button, x, y) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, button, buttons: type === 'pointerdown' ? (button === 2 ? 2 : 1) : 0,
    pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
}

freshBand(true); __sr.sim(30);
const natural = __sr.stats();
check(natural.kills > 0 && natural.km > 0 && natural.hp > 0, 'Owned-plane natural30s run did not progress');
checkBand(true);
check(__sr.late() <= 1, 'Plane band created extra late atlas pages');

freshBand(true); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
check(performance.stats.zombies > 0 && performance.stats.kills > 0 && performance.late <= 1, 'Plane-band busy fight is not sane');

const without = bandShot(false); __sr.frames(30);
const withPlane = bandShot(true);
const canvas = document.getElementById('c'), context = canvas.getContext('2d'), originalPut = context.putImageData, writes = [];
context.putImageData = function(im, dx, dy, ...dirty) {
  writes.push({height: im.height, dy, dirty});
  return originalPut.call(this, im, dx, dy, ...dirty);
};
try { __sr.frames(30); } finally { context.putImageData = originalPut; }
check(writes.length > 0, 'Dense crowd did not exercise main-canvas putImageData');
check(writes.every(w => w.dy + (w.dirty.length ? Math.min(w.height, w.dirty[1] + w.dirty[3]) : w.height) <= withPlane.band.worldHeight),
  'Horde raster writes into the plane band: ' + JSON.stringify(writes));

__sr.bot(false);
const h = __sr.G.helis[0];
__sr.order(0, 'move', h.x + 7, h.y - 5);
const beforeOrder = JSON.stringify(h.order), band = checkBand(true), clickX = band.w * 0.4, clickY = band.y + band.h / 2;
for (const button of [0, 2]) {
  pointer('pointerdown', button, clickX, clickY); __sr.frames(1);
  pointer('pointerup', button, clickX, clickY); __sr.frames(1);
  check(JSON.stringify(h.order) === beforeOrder, 'Band button' + button + ' changed the helicopter order');
}
__sr.rightUp(4, 70);

// Override viewport dimensions only for the real resize event; always restore browser properties.
const widthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const resizes = [];
try {
  for (const owned of [false, true]) {
    freshBand(owned); __sr.hold(true);
    for (const [width, height] of [[960, 600], [1440, 900], [640, 480]]) {
      Object.defineProperty(window, 'innerWidth', {configurable: true, value: width});
      Object.defineProperty(window, 'innerHeight', {configurable: true, value: height});
      window.dispatchEvent(new Event('resize')); __sr.frames(1);
      const b = checkBand(owned), s = __sr.stats();
      check(canvas.width === s.W && canvas.height === s.H, 'Resize did not update actual canvas dimensions');
      resizes.push({owned, viewport: [width, height], W: s.W, H: s.H, VH: s.VH, band: b.h});
    }
  }
} finally {
  if (widthDescriptor) Object.defineProperty(window, 'innerWidth', widthDescriptor); else delete window.innerWidth;
  if (heightDescriptor) Object.defineProperty(window, 'innerHeight', heightDescriptor); else delete window.innerHeight;
  window.dispatchEvent(new Event('resize')); __sr.frames(1);
}
check(__sr.late() <= 1, 'Resize or crowded band rendering created late atlas pages');
QA_DONE({natural, performance, baseline: {bench: 3.27, render: 2.97, late: 1},
  shots: {without: without.band, withPlane: withPlane.band}, bothShotsRendered: true,
  bandInput: {left: 'order unchanged', right: 'order unchanged'},
  raster: {calls: writes.length, worldHeight: withPlane.band.worldHeight, maxImageHeight: Math.max(...writes.map(w => w.height))},
  resizes, restoredViewport: {W: __sr.stats().W, H: __sr.stats().H, VH: __sr.stats().VH}});

