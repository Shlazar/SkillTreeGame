// run mode: real Space input, timed Ram charge/cooldown, smash damage and safe end shock.
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
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.leg(1); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.eventIndex = __sr.line().legs[g.leg - 1].events.length; g.walls.length = 0;
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

const timing = [];
for (const maximum of [false, true]) {
  freshRam(maximum); const f = field(), initial = info(), cd = maximum ? 12 : 20, duration = maximum ? 3.5 : 2;
  check(initial.state === 'ready' && initial.cd === 0 && !('left' in f.g.ram) && !('ramCharge' in f.g.up),
    'Fresh Ram is not ready or retains kill-charge state');
  near(initial.duration, duration, 'Configured powered duration'); near(initial.band, maximum ? 25 : 16, 'Configured smash band');
  near(initial.damage, maximum ? 6.6 : 3, 'Configured smash damage');
  const started = startSpace(); near(__sr.ramCd(), cd, 'Cooldown starts on activation');
  advance(f, Math.round(duration * 60) - 1);
  check(info().powered && info().on, 'Powered charge ended early');
  advance(f, 2); const easing = info();
  check(!easing.powered && easing.on, 'Charge does not enter its existing one-second visual ease');
  advance(f, 60); const ended = info();
  check(!ended.on && ended.state === 'cooldown' && ended.shocks === 0, 'Plain Ram did not finish charge/ease without a shock');
  const samples = [{t: f.g.run, cd: __sr.ramCd()}];
  while (f.g.run < cd - 1 / 60 - 1e-6) {
    const frames = Math.min(60, Math.round((cd - 1 / 60 - f.g.run) * 60));
    advance(f, frames); samples.push({t: f.g.run, cd: __sr.ramCd()});
  }
  check(__sr.ramCd() > 0 && info().state === 'cooldown', 'Ram became ready before its cooldown finished');
  const uses = info().uses; __sr.press(' '); check(info().uses === uses, 'Space bypassed active cooldown');
  advance(f, 1); near(__sr.ramCd(), 0, 'Cooldown reaches zero');
  check(info().state === 'ready' && samples.every(s => Math.abs(s.cd - (cd - s.t)) < 1e-6), 'Cooldown is not elapsed game time');
  startSpace(); near(__sr.ramCd(), cd, 'Second activation resets full cooldown');
  timing.push({maximum, started, easing, ended, samples, second: info()});
}

freshRam(); const heldField = field();
__sr.pause(true); __sr.press(' '); __sr.frames(60);
check(info().uses === 0 && __sr.ramCd() === 0, 'Paused Space activated or advanced Ram');
__sr.pause(false);
dispatchEvent(new KeyboardEvent('keydown', {key: ' ', repeat: false}));
check(info().uses === 1 && info().on, 'Held Space initial keydown did not activate');
advance(heldField, 1200);
dispatchEvent(new KeyboardEvent('keydown', {key: ' ', repeat: true}));
check(info().uses === 1 && info().state === 'ready', 'Held/repeated Space automatically activated another charge');
dispatchEvent(new KeyboardEvent('keyup', {key: ' '})); startSpace();
const heldInput = info();

const smash = [];
for (const maximum of [false, true]) {
  freshRam(maximum); const f = field(), walker = add(f, 0, -6), runner = add(f, 1, 6), brute = add(f, 2, 12);
  near(brute.hp, 6, 'Fresh brute HP'); startSpace(); advance(f, 30);
  check(walker.dead && runner.dead && (maximum ? brute.dead : !brute.dead && brute.hp === 3),
    'Real charge damage on walker/runner/brute failed: ' + JSON.stringify({maximum, hp: [walker.hp, runner.hp, brute.hp], state: info()}));
  check(info().kills === (maximum ? 3 : 2), 'Ram did not credit actual smash kills');
  smash.push({maximum, hp: [walker.hp, runner.hp, brute.hp], state: info()});
}

// A lateral walker is missed by the base band but smashed by Long Charge's wider band.
const width = [];
for (const maximum of [false, true]) {
  freshRam(maximum); const f = field(), target = add(f, 0, 22); startSpace(); advance(f, 30);
  check(maximum ? target.dead : !target.dead && target.hp === 2, 'Long Charge did not widen the real smash band');
  width.push({maximum, hp: target.hp, band: info().band});
}

freshRam(); const killField = field(); startSpace(); advance(killField, 240);
const c = killField.g.tr.cars[0], z = __sr.spawn(0, c.cx + 110 - killField.g.camX, c.cy - killField.g.camY);
z.sp = 0; z.block = []; z.blockT = 1000000;
const cdBeforeKill = __sr.ramCd(), killsBefore = killField.g.kills;
__sr.addBurn(z.x - killField.g.camX, z.y - killField.g.camY, 16, 1, 8); advance(killField, 15);
check(z.dead && killField.g.kills === killsBefore + 1, 'No-kill-charge check did not make a real non-Ram kill');
near(__sr.ramCd(), cdBeforeKill - 0.25, 'Kill must not refill/cancel cooldown');
const killChargeRemoved = {before: cdBeforeKill, after: __sr.ramCd(), kill: __sr.fireStats()};

const shockwaves = [];
for (const maximum of [false, true]) {
  freshRam(maximum, true); const f = field(); __sr.hp(80);
  const walker = add(f, 0, 32, 0), brute = add(f, 2, -32, 0), hp = f.g.tr.hp, hurt = JSON.stringify(f.g.hurt);
  startSpace(); advance(f, Math.round((maximum ? 4.5 : 3) * 60) + 1);
  const state = info();
  check(!state.on && state.shocks === 1 && state.lastShock && state.rings.some(r => r.source === 'ramShock'),
    'Charge end did not emit one actual tagged shock ring');
  near(state.lastShock.radius, 40, 'Shock radius'); near(state.lastShock.damage, maximum ? 6.6 : 3, 'Shock damage');
  check(walker.dead && (maximum ? brute.dead : brute.hp === 3 && !brute.dead) && state.shockKills === (maximum ? 2 : 1),
    'End shock did not hit zombies outside the smash band: ' + JSON.stringify({maximum, state, hp: [walker.hp, brute.hp]}));
  check(f.g.tr.hp === hp && JSON.stringify(f.g.hurt) === hurt, 'Friendly Ram shock hurt the train');
  shockwaves.push({maximum, state, hp});
}

freshRam(false, false, true, true); __sr.frames(1);
const ramUses = info().uses;
for (const key of ['q', 'w']) {
  __sr.press(key); check(__sr.planeAim().active && info().uses === ramUses, key.toUpperCase() + ' did not remain a plane key');
  __sr.rightDown(4, 70); __sr.rightUp(4, 70);
}
__sr.press('e'); check(info().uses === ramUses, 'Legacy E activated Ram');
const shots = [];
for (const kind of ['ready', 'cooldown', 'shock']) { shots.push(ramShot(kind)); __sr.frames(30); check(__sr.late() <= 1, 'Held Ram view render added late pages'); }

function ramRandom(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let performance, lateProbe;
const savedRandom = Math.random;
Math.random = ramRandom(0x533);
try {
  freshRam(true, true, false); __sr.give(3000, 30); __sr.bot(true); __sr.sim(20); __sr.frames(30);
  performance = {seed: 0x533, bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats(), ram: info()};
  check(performance.ram.uses > 0 && performance.ram.total > 0 && performance.late <= 1, 'Busy Ram run did not actually charge and smash');
  __sr.sim(10); __sr.frames(30); lateProbe = {late: __sr.late(), stats: __sr.stats(), ram: info()};
  check(lateProbe.late <= 1, 'Thirty-second Ram run added late atlas pages');
} finally { Math.random = savedRandom; }
QA_DONE({timing, heldInput, smash, width, killChargeRemoved, shockwaves, planeKeysPreserved: true,
  shots, bothExactCardShotsRendered: true, exactShockShotRendered: true, performance, lateProbe, baseline: {bench: 3.27, render: 2.97, late: 1}});
