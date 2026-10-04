// shot mode: real climbers, Steam Vent clock/reach, moving Hot Cloud entry and white bursts.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function steam() { return __sr.steam(); }
function freshSteam(maximum = false, hot = false, reach = maximum ? 3 : 0, quiet = true) {
  __sr.hold(false); __sr.pause(false); __sr.reset();
  for (const [id, level] of Object.entries({steamVent: 1, steamDamage: maximum ? 4 : 0,
    steamSpeed: maximum ? 4 : 0, steamReach: reach, hotCloud: hot ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing Steam node ' + id);
  }
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.leg(1); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, pinned: true, anchors: []}; }
function add(f, x, y, hp = 2, speed = 0) {
  const z = __sr.spawn(0, x - f.g.camX, y - f.g.camY);
  z.hp = hp; z.sp = speed; z.block = []; z.blockT = 1000000;
  if (!speed) f.anchors.push({z, x, y}); return z;
}
function climbers(f, hp = 2) {
  const zs = [];
  for (let car = 0; car < 5; car++) for (const side of [-1, 1]) {
    const c = f.g.tr.cars[car], z = add(f, c.cx + c.nx * side * 10, c.cy + c.ny * side * 10, hp);
    Object.assign(z, {st: 2, car, side, al: 0, ox: 0, dmg: 0, dps: 0, bang: 0}); zs.push(z);
  }
  return zs;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    if (f.pinned) { f.g.tr.s = f.s; f.g.tr.v = 0; }
    for (const a of f.anchors) if (!a.z.dead && a.z.st !== 2) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
    check(!f.g.result, 'Steam fixture reached its station');
  }
}
function envelopeDistance(x, y, envelope = steam().envelope) {
  let best = Infinity;
  for (const s of envelope.segments) {
    const ax = s.ax, ay = s.ay / envelope.fore, bx = s.bx, by = s.by / envelope.fore;
    const dx = bx - ax, dy = by - ay, px = x - ax, py = y / envelope.fore - ay;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(px - t * dx, py - t * dy));
  }
  return Math.max(0, best - envelope.halfWidth);
}
function beside(distance, car = 2, side = 1, along = 0) {
  const c = __sr.G.tr.cars[car], x = c.cx + c.dx * along, y = c.cy + c.dy * along;
  let lo = 0, hi = 100;
  for (let i = 0; i < 35; i++) {
    const d = (lo + hi) / 2;
    if (envelopeDistance(x + c.nx * side * d, y + c.ny * side * d) < distance) lo = d; else hi = d;
  }
  return {x: x + c.nx * side * hi, y: y + c.ny * side * hi};
}
function steamShot(camera = 0) {
  freshSteam(true, true); __sr.thermal(camera); __sr.sim(4); __sr.frames(240);
  const f = field(), targets = climbers(f), before = steam().bursts; __sr.hp(80);
  for (let i = 0; i < 180 && steam().bursts === before; i++) advance(f, 1, true);
  check(steam().bursts === before + 1 && targets.every(z => z.dead), 'White burst view did not vent actual climbers');
  const burstTime = steam().lastBurst.t;
  for (let i = 0; i < 180 && f.g.run - burstTime < 0.35; i++) advance(f, 1, true);
  check(f.g.run - burstTime >= 0.35 && steam().cloud && __sr.fx().parts > 0 && f.g.tr.hp === 80,
    'White burst view lacks grown active steam/cloud or train safety');
  __sr.hold(true); __sr.frames(1);
  const c = f.g.tr.cars[2];
  return {camera, steam: steam(), fx: __sr.fx(), crop: {x: Math.round(c.cx - f.g.camX - 32),
    y: Math.round(c.cy - f.g.camY - 34), w: 64, h: 68, scale: 4}};
}


steamShot(1);
