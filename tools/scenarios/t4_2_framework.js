// A-10 plane framework only: band states, aiming input and cooldown charges.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a + ' expected ' + b); }
function plane() {
  const p = __sr.planes().find(p => p.id === 'a10');
  check(p, 'Owned A-10 is missing'); return p;
}
function freshPlane(charges = 1, quiet = true) {
  __sr.hold(false); __sr.reset();
  check(__sr.node('a10', 1) && __sr.node('a10Charge', charges - 1), 'Plane node fixtures failed');
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  if (quiet) {
    __sr.bot(false);
    g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
    g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
    h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  } else __sr.bot(true);
  return {g, s: g.tr.s};
}
function advance(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0; __sr.sim(1 / 60);
  }
}
function pointer(type, button, x, y) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, button, buttons: type === 'pointerdown' ? (button === 2 ? 2 : 1) : 0,
    pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
}
function clickWorld(x, y, button = 0) {
  pointer('pointerdown', button, x, y); __sr.frames(1);
  pointer('pointerup', button, x, y); __sr.frames(1);
}
function planeShot(kind) {
  const f = freshPlane(kind === 'two' ? 2 : 1, false);
  __sr.sim(8); __sr.frames(240);
  if (kind === 'used') {
    const s = __sr.stats();
    check(__sr.strike('q', s.W * 0.6, s.VH * 0.45), 'Used-band shot did not consume a strike');
    f.s = f.g.tr.s;
    advance(f, 5);
    check(plane().charges === 0 && plane().cd > 0 && !plane().ready, 'Used-band shot is ready');
  } else check(plane().ready && plane().charges === (kind === 'two' ? 2 : 1), 'Ready-band shot has wrong charges');
  __sr.hold(true); __sr.frames(1);
  return {plane: plane(), band: __sr.planeBand()};
}

let f = freshPlane(), p = plane();
check(p.ready && p.charges === 1 && p.maxCharges === 1 && p.cd === 0 && p.key === 'q', 'A-10 does not begin ready in Q slot');
const s = __sr.stats(), point = {x: s.W * 0.6, y: s.VH * 0.45};
check(__sr.strike('q', point.x, point.y), 'Production strike helper failed');
p = plane(); near(p.cd, 25, 'Base cooldown immediately after strike');
check(p.charges === 0 && !p.ready && p.strikes === 1, 'Strike did not use its one charge');
advance(f, 25 - 1 / 60);
check(plane().charges === 0 && !plane().ready && plane().cd > 0, 'Base charge returned before25s');
advance(f, 1 / 60);
check(plane().ready && plane().charges === 1 && plane().cd === 0, 'Base charge did not return exactly25s');

f = freshPlane(2);
check(plane().ready && plane().charges === 2 && plane().maxCharges === 2, '+1 charge did not start full');
check(__sr.strike('q', point.x, point.y), 'First two-charge strike failed');
check(plane().charges === 1 && plane().ready, 'Remaining charge was not usable');
advance(f, 5); near(plane().cd, 20, 'Partial recharge clock');
check(__sr.strike('q', point.x, point.y), 'Second two-charge strike failed');
near(plane().cd, 20, 'Second strike restarted partial recharge');
check(plane().charges === 0 && !plane().ready, 'Both charges were not consumed');
advance(f, 20);
check(plane().charges === 1 && plane().ready, 'First serial charge did not return');
near(plane().cd, 25, 'Second serial refill clock');
advance(f, 25);
check(plane().charges === 2 && plane().cd === 0, 'Second serial charge did not return');

f = freshPlane();
const h = f.g.helis[0]; __sr.order(0, 'move', h.x + 11, h.y - 7);
const beforeOrder = JSON.stringify(h.order);
__sr.press('q');
check(__sr.planeAim().active && __sr.planeAim().id === 'a10' && plane().strikes === 0, 'Q did not enter aim without consuming');
clickWorld(point.x, point.y, 2);
check(!__sr.planeAim().active && plane().charges === 1 && plane().strikes === 0 && JSON.stringify(h.order) === beforeOrder, 'Right cancel consumed a charge or changed heli order');

f = freshPlane();
__sr.frames(1);
const cell = __sr.planeBand().slots.find(c => c.id === 'a10');
check(cell && cell.h > 0, 'Rendered band has no A-10 click target');
clickWorld(cell.x + cell.w / 2, cell.y + cell.h / 2);
check(__sr.planeAim().active && plane().strikes === 0, 'Real band click did not begin aiming');
clickWorld(point.x, point.y);
check(!__sr.planeAim().active && plane().strikes === 1 && plane().charges === 0, 'Real world confirmation did not strike');

f = freshPlane();
let before = f.g.run; __sr.frames(60); const fullSpeed = f.g.run - before;
__sr.press('q'); before = f.g.run; __sr.frames(60); const aimingSpeed = f.g.run - before;
check(Math.abs(fullSpeed - 1) <= 1 / 60 + 1e-6 && Math.abs(aimingSpeed - 0.5) <= 1 / 60 + 1e-6,
  'Aiming did not run oneFrame at50%: ' + JSON.stringify({fullSpeed, aimingSpeed}));
clickWorld(point.x, point.y, 2);

f = freshPlane();
const dims = __sr.stats(), crowdX = dims.W * 0.7, crowdY = dims.VH * 0.43;
const expected = {x: f.g.camX + crowdX, y: f.g.camY + crowdY};
__sr.crowd(40, crowdX, crowdY, 12, 0);
// A larger group just outside the field must not steal the visible smart strike.
__sr.crowd(60, dims.W + 20, crowdY, 8, 0);
for (const z of f.g.zombies) { z.hp = 1000000; z.sp = 0; }
__sr.press('q'); __sr.frames(6); __sr.press('q');
const smart = plane();
check(smart.strikes === 1 && !__sr.planeAim().active && Math.hypot(smart.lastStrike.x - expected.x, smart.lastStrike.y - expected.y) < 30,
  'Actual double tap missed the40-zombie crowd: ' + JSON.stringify(smart));
__sr.leg(2, false);
check(plane().ready && plane().charges === plane().maxCharges && plane().cd === 0 && plane().strikes === 0, 'New leg retained used plane cooldown');

const shots = {};
for (const kind of ['ready', 'used', 'two']) { shots[kind] = planeShot(kind); __sr.frames(30); }
freshPlane(1, false); __sr.give(3000, 30); __sr.sim(20); __sr.frames(30);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
check(performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1, 'Plane framework busy check failed');
QA_DONE({initialReady: true, baseCooldown: 25, exactRecovery: true,
  twoCharges: {serial: true, firstReturnsAt: 25, secondAt: 50, secondUsePreservedClock: true},
  input: {qAim: true, rightCancel: true, orderUnchanged: true, bandClick: true, worldConfirm: true,
    doubleTap: {strikes: smart.strikes, lastStrike: smart.lastStrike, expectedCrowd: expected}},
  frameTime: {fullSpeed, aimingSpeed}, newLegReady: true, shots, allShotSetupsRendered: true,
  performance, baseline: {bench: 3.27, render: 2.97, late: 1}});
