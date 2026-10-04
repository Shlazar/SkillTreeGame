// Plane-band layout and matching crowded fight views; this task does not test plane strikes.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshBand(owned) {
  __sr.hold(false); __sr.reset();
  if (owned) check(__sr.node('a10', 1), 'A-10 ownership fixture failed');
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
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

bandShot(true);

