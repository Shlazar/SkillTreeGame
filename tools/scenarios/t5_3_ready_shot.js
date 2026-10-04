// shot mode: real Space input, timed Ram charge/cooldown, smash damage and safe end shock.
function check(ok, message) { if (!ok) throw new Error(message); }
function near(a, b, label) { check(Math.abs(a - b) < 1e-6, label + ': ' + a); }
function info() { return __sr.ramInfo(); }
function freshRam(maximum = false, shock = false, quiet = true, planes = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset();
  for (const [id, level] of Object.entries({ram: 1, ramPower: maximum ? 4 : 0,
    ramCooldown: maximum ? 4 : 0, ramDuration: maximum ? 3 : 0, shockwave: shock ? 1 : 0})) {
    check(__sr.node(id, level), 'Missing Ram node ' + id);
  }
  if (planes) for (const id of ['a10', 'f4']) check(__sr.node(id, 1), 'Missing plane ' + id);
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.leg(1); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, anchors: []}; }
function add(f, type, across, forward = 3, hp = null) {
  const c = f.g.tr.cars[0], x = c.x0 + c.nx * across + c.dx * forward,
    y = c.y0 + c.ny * across + c.dy * forward;
  const z = __sr.spawn(type, x - f.g.camX, y - f.g.camY);
  if (hp !== null) z.hp = hp;
  z.sp = 0; z.block = []; z.blockT = 1000000;
  f.anchors.push({z, x, y}); return z;
}
function advance(f, n, draw = false) {
  for (let i = 0; i < n; i++) {
    // Keep the real leg's station ahead, while measuring only its first30s clock.
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    if (draw) __sr.frames(1); else __sr.sim(1 / 60);
    check(!f.g.result && f.g.run < 30, 'Ram fixture left the first30s of its real leg');
  }
}
function startSpace() {
  const uses = info().uses; __sr.press(' ');
  check(info().uses === uses + 1 && info().on, 'Real Space did not activate ready Ram');
  return info();
}
function ramShot(kind = 'ready') {
  freshRam(false, kind === 'shock', true, true); __sr.sim(4); __sr.frames(240);
  const f = field();
  if (kind === 'cooldown') { startSpace(); advance(f, 240, true); }
  if (kind === 'shock') {
    for (const across of [-28, 28]) for (const forward of [-6, 6]) add(f, 0, across, forward);
    __sr.hp(80); startSpace();
    for (let i = 0; i < 300 && info().on; i++) advance(f, 1, true);
    advance(f, 9, true);
    check(info().shocks === 1 && info().shockKills === 4 && f.anchors.every(a => a.z.dead) &&
      info().rings.some(r => r.source === 'ramShock' && r.t > 0) && f.g.tr.hp === 80,
      'Shock view lacks the expanded actual ring, outside-band victims or train safety');
  }
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  const state = info(), band = __sr.planeBand(), card = state.card;
  check(card.on && card.w > 0 && card.h > 0 && card.y + card.h <= band.y,
    'Ram card is missing or extends into the plane band');
  check(kind === 'ready' ? state.state === 'ready' && state.cd === 0 : state.state === 'cooldown' && state.cd > 0 && state.progress > 0,
    'Ram card view has the wrong actual state: ' + JSON.stringify(state));
  const c = f.g.tr.cars[0];
  return {kind, state, band, crop: kind === 'shock'
    ? {x: Math.round(c.x0 - f.g.camX - 50), y: Math.round(c.y0 - f.g.camY - 40), w: 100, h: 80, scale: 4}
    : {x: card.x - 3, y: card.y - 3, w: card.w + 6, h: card.h + 6, scale: 4}};
}


ramShot('ready');
