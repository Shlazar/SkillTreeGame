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
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.rightUp(4, 70);
  const g = __sr.G, h = g.helis[0];
  if (quiet) {
    __sr.bot(false);
    g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
    g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
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
  // Keep natural crowds, but reserve the plane's charges for this controlled band state.
  __sr.bot(false);
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

planeShot('used');
