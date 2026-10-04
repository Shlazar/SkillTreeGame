// shot mode: actual Depot line, revealed currencies and a rendered upgrade tooltip at the requested window size.
function check(ok, why) { if (!ok) throw new Error(why); }
function inside(r, w, h, name) {
  if (!r) return;
  check(['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) && r.w >= 0 && r.h >= 0 &&
    r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.01 && r.y + r.h <= h + 0.01,
    name + ' leaves the screen: ' + JSON.stringify({r, w, h}));
}
function overlap(a, b) {
  return a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function disjoint(rects, name) {
  rects = rects.filter(Boolean);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++)
    check(!overlap(rects[i], rects[j]), name + ' overlaps: ' + JSON.stringify([rects[i], rects[j]]));
}
function visibleRects(o, out = []) {
  if (!o || typeof o !== 'object' || o.visible === false || o.on === false) return out;
  if (['x', 'y', 'w', 'h'].every(k => Number.isFinite(o[k]))) out.push(o);
  for (const value of Object.values(o)) if (value && typeof value === 'object') visibleRects(value, out);
  return out;
}
function validate(surface) {
  const b = __sr.uiBounds(), {W, H, VH} = b.viewport;
  const areas = surface === 'run' ? [b.hud, b.radar, b.ram, b.weapons, b.tutorial, b.pauseMenu] :
    [b.depot, b.hangar, b.title, b.summary, b.endCard];
  for (const r of visibleRects(areas)) inside(r, W, surface === 'run' && r !== b.pauseMenu ? VH : H, surface);
  if (surface === 'run') {
    const h = b.hud;
    disjoint([...h.counters, h.kills, ...Object.values(h.health), h.pause, h.route?.label, h.route?.line], 'HUD');
    disjoint(b.weapons, 'Weapon cards'); disjoint(b.planes, 'Plane slots');
    for (const p of b.planes) { inside(p, W, H, 'Plane slot'); check(p.y >= VH, 'Plane slot overlaps world'); }
    check(__sr.planeBand().h === 18 && VH === H - 18 && b.planes.length === 3, 'Q/W/E band geometry missing');
    if (b.tutorial) for (const r of [b.radar, b.ram, ...b.weapons]) check(!overlap(b.tutorial, r), 'Tip overlaps bottom controls');
  } else if (b.depot) {
    const d = b.depot;
    disjoint(d.counters, 'Depot counters'); disjoint(d.tabs, 'Depot tabs');
    disjoint([d.bottom.message, d.bottom.button, d.bottom.hint], 'Depot bottom');
    for (const r of d.tabs) check(!overlap(r, d.route.heading), 'Depot tab overlaps heading');
    if (d.tooltip) {
      check(d.treeArea && d.tooltip.y >= d.treeArea.y && d.tooltip.y + d.tooltip.h <= d.treeArea.y + d.treeArea.h,
        'Tree tooltip overlaps the map/footer: ' + JSON.stringify({tooltip: d.tooltip, area: d.treeArea}));
      check(__sr.infoFit().bad.length === 0, 'Tooltip text overflows');
    }
    if (b.hangar) { disjoint(b.hangar.cards, 'Hangar cards'); disjoint(b.hangar.slots, 'Hangar slots'); }
  }
  return b;
}
function until(test, seconds) {
  for (let i = 0; i < seconds * 60 && !test(); i++) __sr.sim(1 / 60);
  check(test(), 'Window fixture timed out: ' + JSON.stringify(__sr.finaleState()));
}
function baseFixture() {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  const nodes = {armor: 6, hdmg: 4, hrate: 3, hrange: 2, rockets: 1, a10: 1, f4: 1, b52: 1,
    ram: 1, mgCar: 1, mgTurrets: 2, steamVent: 1};
  for (const [id, lv] of Object.entries(nodes)) check(__sr.node(id, lv), 'Missing layout node: ' + id);
  __sr.give(12345, 12, 123);
  for (const flag of ['survShown', 'goldShown', 'silverSeen', 'boomSeen']) __sr.SAVE.flags[flag] = true;
  for (const lesson of __sr.tutState().lessonText) __sr.SAVE.seen[lesson.key] = true;
  __sr.setLeg(12);
  for (const n of [3, 5, 9]) __sr.SAVE.legs[n].stars = [true, n !== 5, true];
}
function runShot() {
  baseFixture(); delete __sr.SAVE.seen.p_plane;
  __sr.leg(12); __sr.hp(9999); __sr.bot(false);
  // Arrival-position fixture only: real gate braking, 15-second clock and actual E gift follow.
  __sr.win(); until(() => __sr.finaleState()?.gifted, 18);
  __sr.press('e'); __sr.press('e'); until(() => __sr.planeShow().stats.b2.impacts === 1, 12);
  // Large counter values isolate the layout; these are display fixtures, not earned income.
  const g = __sr.G; g.cash = g.shownCash = 1234; g.surv = 12; g.gold = 123; g.kills = 321;
  __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(30);
  check(__sr.tutState().tipKey === 'p_plane' && __sr.uiBounds().tutorial, 'Actual long aiming lesson missing');
  return validate('run');
}
function depotShot() {
  baseFixture(); __sr.depot('tree'); __sr.hold(true); __sr.frames(90);
  const n = __sr.treeNodes().find(n => n.id === 'rocketPods'); check(n, 'Tooltip node missing');
  __sr.treeCam(n.x, n.y, 1); check(__sr.hoverNode(n.id), 'Actual tooltip hover failed'); __sr.frames(30);
  const b = validate('depot'); check(b.depot.tooltip, 'Rendered tree tooltip bounds missing'); return b;
}
depotShot();

