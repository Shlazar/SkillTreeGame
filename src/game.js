// game.js - the game: escort the last train. You fly a gunship helicopter (WASD) over a railway that
// winds north. The line is fixed: the train leaves the Depot (at y = 0), stops at the stations on the
// way to take on survivors, and the safe zone wall stands at the far end. The dead walk in from both
// sides, more of them the further the train gets; the ones ahead of the train step onto the rails,
// and before each station a Dead Wall of them stands on the track. The engine runs them down, but
// each one slows it and hurts it, and the dead that reach the train climb on and tear at it. The run
// ends when the train breaks; every scrap and survivor of the run is kept. When no key is held the
// helicopter keeps pace with the train. Behind the title and the Depot the same game runs as a demo.
// Units are world pixels and seconds; y on the ground is squashed by FORE; the train runs to -y.

const CFG = {
  // the line: px along the rails in 1 km (2 px = 1 m), and the km of the safe zone wall at its end
  line: { km: 2000, end: 4 },
  // the train: top speed (px/s), how fast it gets back up to speed, how hard it brakes, its health,
  // and the health it loses for each zombie it runs over (a brute costs more)
  train: { cruise: 26, accel: 7, brake: 10, hp: 80, crush: 2, crushBig: 10 },
  // the helicopter: top speed against the train, how fast it gets there, how far from the engine it
  // may fly (its radio range), how near loot must be to pick it up, its height (where its shadow falls)
  heli: { speed: 170, accel: 3.2, range: 300, pickup: 14, alt: 100 },
  lock: 12,                    // px round the sight that a zombie is locked within
  // 25mm: rounds per second, flight time (short: the hit lands at once), spread without a lock,
  // burst radius, most zombies one round can hit, heat per round, cooling per second
  mg: { rate: 6, travel: 0.07, spread: 5, splash: 7, victims: 4, heatPer: 0.05, cool: 0.55 },
  // 105mm: reload, flight time, kill radius, hurt radius (a hurt walker dies too, a brute may not),
  // and how close to the train a blast hurts the train too
  he: { reload: 2.4, travel: 0.7, kill: 34, hurt: 56, close: 28 },
  // the horde: the most dead alive at once, and from how many km runners come and brutes stand on
  // the rails (how many come at each km is in HORDE)
  pop: { max: 400, runFrom: 0.4, bruteFrom: 1.1 },
  // a station stop: survivors waiting on a later visit (a first visit has the station's own number),
  // seconds between two setting off, their speed, the shortest stop, how long a zombie holds a
  // survivor before it is too late, how near the door the dead keep the survivors in (and for how
  // long, at most)
  station: { again: 3, gap: 1.1, run: 24, minStop: 12, grab: 1.4, clear: 34, wait: 8 },
  // scrap for the ride (1 for every dist px, so 1 per 20 m) and for a station stop (the first time
  // it is held, then each time after)
  pay: { dist: 40, stop: 50, stopAgain: 25 },
  // a Dead Wall: px along the rails it fills, px from the rail middle, how near the train comes
  // before it moves, how far ahead it is placed, how far ahead the warning comes (px)
  wall: { len: 120, half: 12, wake: 110, place: 600, warn: 300 },
  // bought in the skill tree. The rail cannon (cannon.js): seconds to reload, seconds each GUN SPEED
  // level takes off, px either side of its line that it kills, how fast its barrel turns (radians/s).
  gun: { reload: 4, fast: 0.5, hw: 5, turn: 7 },
  // The Turbo Ram: top speed (px/s), seconds at it, seconds to get up to it and to ease back, the
  // kill zone (px either side of the rail middle, px behind and ahead of the nose), kills to fill it
  // again, the next stop nearer than noStart px = it can't start, nearer than cut px = it ends
  // (250 and 200 m), px the camera leads, its kills pay ×pay. taste = the first run's Ram: the walkers
  // at the Depot gate, and its seconds. prompt = px before a Dead Wall where PRESS E! shows (once).
  ram: { speed: 80, dur: 4, rise: 0.4, ease: 1, band: 16, back: 10, front: 8, charge: 200, noStart: 500, cut: 400,
    lead: 40, pay: 2, taste: 12, tasteDur: 3, prompt: 150 },
  // what else the tree buys: an MG nest's rounds per second, the speed of the dead on barbed wire,
  // the seconds the winch needs over a survivor
  nest: { rate: 4 },
  wire: { slow: 0.4 },
  winch: { hover: 1.5 },
  // what one level of a skill tree node adds: train HP (ARMOR), the 25mm's heat per round is
  // multiplied (COOLING), 25mm rounds per second (FAST FEED), 25mm damage (HEAVY ROUNDS), 105mm
  // reload seconds taken off (FAST RELOAD), px of flying range (RADIO RANGE), px of pickup reach
  // (MAGNET), share of kill scrap (SCAVENGER), rounds per second (GUN SPEED, NEST SPEED)
  up: { armor: 20, cool: 0.8, feed: 1, heavy: 1, reload: 0.3, radio: 60, magnet: 10, scav: 0.1, gun: 1, nest: 1 },
  // dps = damage to the train each second while it holds on
  types: [
    { hp: 1, speed: [11, 16], value: 1, dps: 0.5 },                // walker
    { hp: 1, speed: [32, 40], value: 2, dps: 0.5, run: true },     // runner
    { hp: 8, speed: [8, 10], value: 10, dps: 2, big: true }        // brute
  ]
};
// the cars: length on the ground, the gap between two, half the width, how many (TRAIN in sprites)
const CAR = { L: 28, gap: 4, half: 8, n: 5 };
const TRAIN_LEN = CAR.n * (CAR.L + CAR.gap) - CAR.gap;
const CAMS = ['COLOUR', 'WHITE HOT', 'BLACK HOT'];

// G = this run (or the demo behind the title and the Depot). mode = 'title', 'depot', 'play',
// 'ending' or 'summary'. thermal = camera: 0 colour, 1 white hot, 2 black hot.
let G = null, mode = 'title', paused = false, realT = 0, frameDt = 0, sumStart = 0, thermal = 0;

// ---------- the fixed line
// DEPOT_S = the Depot's place along the rails (it stands at y = 0). The rest of the line is counted
// in km from there: sAtKm(k) = the place k km up the line, kmAt(s) = how many km s is from the Depot.
const DEPOT_S = trackS(0);
const sAtKm = (k) => DEPOT_S - k * CFG.line.km;
const kmAt = (s) => (DEPOT_S - s) / CFG.line.km;
// DK() = how far the engine's nose is from the Depot, in km
const DK = () => kmAt(G.tr.s);
// km2(k) = k km cut down to the whole 10 m, the way every screen and the save show km (0.659 -> 0.65)
const km2 = (k) => Math.floor(k * 100 + 1e-6) / 100;
// The y on the ground where the distance along the rails is s, from any distance away.
const yOfS = (s) => yAtS(s, yAtS(s, s / 1.0354));

// ---------- what the skill tree changes
// Each number at level l of its node. The game reads them through G.up (set when a run starts) and
// the skill tree's info box shows the very same numbers, so the two always agree.
const UP = {
  hp: (l) => CFG.train.hp + CFG.up.armor * l,                        // ARMOR: the train's health
  rate: (l) => CFG.mg.rate + CFG.up.feed * l,                        // FAST FEED: 25mm rounds per second
  // the 25mm's heat per round: COOLING multiplies it (the levels stack); FAST FEED lowers it so the
  // heat per second stays the same
  heat: (cool, feed) => CFG.mg.heatPer * Math.pow(CFG.up.cool, cool) * CFG.mg.rate / UP.rate(feed),
  // seconds of held fire before the 25mm overheats (it cools a quarter as fast while it fires)
  hot: (cool) => {
    const k = UP.rate(0) * UP.heat(cool, 0) - CFG.mg.cool * 0.25;
    return k > 0 ? 1 / k : Infinity;
  },
  dmg: (l) => 1 + CFG.up.heavy * l,                                  // HEAVY ROUNDS: damage per hit
  reload: (l) => CFG.he.reload - CFG.up.reload * l,                  // FAST RELOAD: 105mm reload (s)
  range: (l) => CFG.heli.range + CFG.up.radio * l,                   // RADIO RANGE: flying range (px)
  pickup: (l) => CFG.heli.pickup + CFG.up.magnet * l,                // MAGNET: pickup reach (px)
  scav: (l) => CFG.up.scav * l,                                      // SCAVENGER: extra kill scrap
  gun: (l) => CFG.gun.reload - CFG.gun.fast * l,                     // GUN SPEED: rail cannon reload (s)
  nest: (l) => CFG.nest.rate + CFG.up.nest * l                       // NEST SPEED: MG nest rounds/s
};
// This run's numbers from the skill tree (they cannot change during a run). The demo behind the
// menus uses the plain numbers, but shows off the 105mm, the flatcar gun and the Turbo Ram. he,
// winch, ram, wire = owned; gun = the rail cannon's reload seconds (0 = none).
function runUp(demo) {
  const L = demo ? () => 0 : lv;
  return {
    hp: UP.hp(L('armor')), rate: UP.rate(L('feed')), heat: UP.heat(L('cool'), L('feed')), dmg: UP.dmg(L('heavy')),
    he: demo || L('he') > 0, reload: UP.reload(L('reload')), range: UP.range(L('radio')), pickup: UP.pickup(L('magnet')),
    scav: UP.scav(L('scav')), winch: L('winch') > 0, gun: demo || L('gun') > 0 ? UP.gun(L('gunspd')) : 0, ram: demo || L('ram') > 0,
    nest: UP.nest(L('nestspd')), wire: L('wire') > 0,
    // the first ring (skills.js): chain jumps, the cow catcher, 1 golden zombie in this many (0 = none),
    // and the armor level (its plates show on the engine)
    chain: UP.chain(L('chain')), cow: L('cow') > 0, gold: UP.gold(L('goldz')), armor: L('armor')
  };
}
// The train's full health.
function maxHP() {
  return UP.hp(lv('armor'));
}

// ---------- a run
// demo = the demo behind the menus, on a random stretch of the line. Otherwise from = where the run
// starts: 'depot', or the id of a station reached before (the train starts 60 px before its stop).
function newGame(demo, from) {
  const at = demo ? null : STATIONS.find((d) => d.id === from) || null;
  const yd = Math.round(rnd(-40000, 40000));
  const s0 = demo ? trackS(yd) : at ? sAtKm(at.km) - STOP_OFF + 60 : DEPOT_S;
  const y0 = demo ? yd : yOfS(s0), up = runUp(demo), hp = up.hp;
  const cars = [];
  for (let k = 0; k < CAR.n; k++) cars.push({ x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, dx: 0, dy: -1, nx: 1, ny: 0, ang: 0, k: 0 });
  G = {
    demo: !!demo, t: 0, run: 0, endT: 0, result: '', up,
    kills: 0, cash: 0, shownCash: 0, cashPulse: 0, killBump: 0, shots: 0, hits: 0, bestBlast: 0, scavAcc: 0, scavPaid: 0,
    trigger: false, mgCd: 0, heat: 0, overheat: false, heReload: 0, heQueue: false, hitT: 0, muzzle: [0, 0],
    // the train: s = distance along the rails of the engine's nose (it falls as the train runs north),
    // v = speed, hp / max = its health now and when whole, hit[k] = car k flashes red, fx / fy = the
    // nose on the ground
    tr: { s: s0, startS: s0, v: CFG.train.cruise, hp, max: hp, hpShown: hp, hit: [0, 0, 0, 0, 0],
      clack: 0, smokeT: 0, hornT: 0, fx: trackX(y0), fy: y0, cars },
    // the helicopter: ox / oy = where it is from the engine's nose, vx / vy = its speed against the
    // train, hd = its heading, home = flying back over the train
    heli: { ox: 0, oy: Math.round(H * 0.12), vx: 0, vy: 0, hd: 0, home: false, far: false },
    goalS: demo ? -1e12 : sAtKm(CFG.line.end), goalY: -1e9,
    // the stops on this run (the Depot and the stations ahead), the stations alone, the one the
    // train goes to next (or stands at), and the Dead Walls ahead
    stops: [], stations: [], station: null, walls: [],
    camX: 0, camY: 0, aimSX: W / 2, aimSY: H / 2,
    lock: null, lockWait: false, box: null,
    zombies: [], bodies: [], rounds: [], timers: [], statics: [], people: [],
    spawnCd: 0, railCd: rnd(5, 7), onTrain: 0, blocked: false, decalT: 0, sum: null,
    // this run's scrap by where it came from (the summary lists them), the survivors aboard, the px
    // the train has ridden, the furthest km, and what is already in the save
    pay: { kills: 0, dist: 0, stop: 0, loot: 0 }, stopNames: [], surv: 0, ride: 0, maxKm: 0, banked: { scrap: 0, surv: 0 },
    newBest: false, oldBest: 0, bot: false, botT: 0, botZ: null, hurt: { crush: 0, claw: 0, shell: 0 },
    // the rail cannon on the flatcar (cannon.js)
    gun: newCannon(),
    // the Turbo Ram: on = running, t = seconds since it started, dur = its seconds at top speed,
    // left = kills still needed to fill it (0 = full; every run starts full), kills / pay = this Ram's,
    // card = its card shows, taste = the first run's Ram, flash = when it got full, crack = when the
    // taste broke it, msg = a line over its card, pop = scrap of its kills not yet shown (popT = when
    // the last +N popped)
    ram: { on: false, t: 0, dur: 0, left: 0, kills: 0, pay: 0, card: up.ram || !!SAVE.flags.taste, taste: false,
      hissed: false, flash: -9, crack: -9, killT: -9, msg: null, uses: 0, total: 0, pop: 0, popT: -9 },
    // the first run's Ram taste is still to come; the dead on the rails within 130 m ahead; the PRESS E!
    // moment ({left: real seconds, w: the Dead Wall}); px the camera is moved by (camLead)
    taste: !demo && !at && !SAVE.flags.taste && !up.ram, railAhead: 0, prompt: null, lead: [0, 0]
  };
  RADIO.q.length = 0;
  RADIO.cur = null;
  RAMCARD.on = false;
  SFX.ramStop(0.1);
  clearFX();
  GRID.clear();
  layoutTrain();
  if (!demo) {
    G.goalY = yOfS(G.goalS);
    G.maxKm = DK();
    buildSafeZone();
    buildLine(at);
    rollLoot();
  }
  placeCamera();
  scatter(at);
}
// Start a real run from 'depot' or a reached station.
function startGame(from) {
  audioInit();
  from = startsOpen().includes(from) ? from : 'depot';
  SAVE.start = from;
  SAVE.runs++;
  saveSave();
  newGame(false, from);
  // the best before this run (NEW BEST is measured against it, even after the run is banked)
  G.oldBest = SAVE.best;
  mode = 'play';
  paused = false;
  const st = G.station;
  banner('ESCORT THE TRAIN', st ? 'NEXT: ' + st.name + '  ' + fmtM(kmAt(st.s) - DK()) : 'GET IT AS FAR AS YOU CAN', U.gold);
  SFX.horn();
  // the first run of a save: the dead stand at the Depot gate, and the Engineer gives it full steam
  if (G.taste) {
    SAVE.flags.taste = true;
    saveSave();
    later(0.3, () => radio('ENGINEER', 'DEAD ON THE TRACK! FULL STEAM!'));
    later(1, () => { if (!G.result) ramStart(true); });
  }
}
// Put what this run has earned so far in the save. You keep it all, whatever happens to the train.
function bankRun() {
  if (!G || G.demo) return;
  const sc = Math.floor(G.cash) - G.banked.scrap, sv = G.surv - G.banked.surv;
  SAVE.scrap += sc;
  SAVE.surv += sv;
  G.banked.scrap += sc;
  G.banked.surv += sv;
  SAVE.best = Math.max(SAVE.best, km2(G.maxKm));
  saveSave();
}
// The run is over: bank it and build the summary (drawn by drawSummary).
function endGame() {
  mode = 'summary';
  sumStart = realT;
  G.trigger = false;
  // a mouse press from the run must not click TO THE DEPOT when it is let go
  M.px = M.py = -1e4;
  // where the run ended (the train may roll on a little after it is lost; that does not count)
  const k = G.maxKm;
  refillHouses();
  bankRun();
  G.sum = {
    result: G.result, km: km2(k), ride: km2(G.ride / CFG.line.km), kills: G.kills, pay: Object.assign({}, G.pay),
    scrap: Math.floor(G.cash), surv: G.surv, stops: G.stopNames.slice(), best: SAVE.best, newBest: G.oldBest > 0 && SAVE.best > G.oldBest,
    near: nearMiss(k), wall: wallStop(k), goal: summaryGoal(), sounds: 0
  };
}
// "Mill Town was 380 m away!": the next station, when the train was lost on the way to it.
function nearMiss(k) {
  if (G.result !== 'lost') return '';
  const st = G.stations.find((s) => s.state === 'ahead' || s.state === 'braking');
  if (!st) return '';
  const m = kmAt(st.s) - k;
  return m < 0.7 ? st.name + ' WAS ' + fmtM(Math.max(0.01, m)) + ' AWAY!' : '';
}
// The summary's lines for a run lost at a Dead Wall, or after one that cost the train a quarter of
// its health or more (with no station since): what happened, and what gets you through (without the
// Turbo Ram: buy it; with it: save it for the wall, press E there, or more armor when it ran into the
// wall and the train still broke). [] for any other run.
function wallStop(k) {
  if (G.result !== 'lost') return [];
  let w = G.walls.find((x) => k > x.km - 0.04 && k < x.km + CFG.wall.len / CFG.line.km + 0.03), say = 'THE DEAD WALL STOPPED YOU.';
  if (!w) {
    w = G.walls.filter((x) => x.hpOut != null && x.km < k).pop();
    if (!w || w.hpIn - w.hpOut < G.tr.max * 0.25 || G.stations.some((st) => kmAt(st.s) > w.km && kmAt(st.s) < k)) return [];
    say = 'THE DEAD WALL COST THE TRAIN ' + Math.round(w.hpIn - w.hpOut) + ' HP.';
  }
  const tip = !G.up.ram ? 'TURBO RAM SMASHES THROUGH IT.' : w.rammed ? 'MORE ARMOR WOULD GET YOU THROUGH.'
    : w.ready ? 'PRESS E AT THE WALL TO RAM IT!' : 'SAVE YOUR TURBO RAM FOR IT.';
  return [[say, U.red], [tip, U.ink]];
}
// km as metres for the screen: 340 M (to the nearest 10 m), 1.25 KM from 1 km up
function fmtM(k) {
  return k >= 1 ? k.toFixed(2) + ' KM' : Math.round(k * 100) * 10 + ' M';
}
function toTitle() {
  if (!G || !G.demo) newGame(true);
  mode = 'title';
  paused = false;
}
const scoring = () => !G.demo && (mode === 'play' || mode === 'ending');
// Run f after t seconds of game time.
function later(t, f) {
  G.timers.push({ t, f });
}

// ---------- the train
// Place the cars along the curve: each car's front and back on the rails, its middle, its heading
// (dx, dy = unit vector to its front, nx, ny = to its right) and its depth for drawing.
function layoutTrain() {
  const tr = G.tr;
  let y = yAtS(tr.s, tr.fy);
  tr.fy = y;
  tr.fx = trackX(y);
  for (let k = 0; k < CAR.n; k++) {
    const c = tr.cars[k], s0 = tr.s + k * (CAR.L + CAR.gap);
    const y0 = k ? yAtS(s0, y + CAR.gap) : y, y1 = yAtS(s0 + CAR.L, y0 + CAR.L);
    const x0 = trackX(y0), x1 = trackX(y1), dx = x0 - x1, dy = y0 - y1, l = Math.hypot(dx, dy) || 1;
    c.x0 = x0; c.y0 = y0; c.x1 = x1; c.y1 = y1;
    c.cx = (x0 + x1) / 2; c.cy = (y0 + y1) / 2;
    c.dx = dx / l; c.dy = dy / l;
    c.nx = -c.dy; c.ny = c.dx;
    c.ang = Math.atan2(c.dx, -c.dy);
    c.k = Math.max(y0, y1) + 3;
    y = y1;
  }
}
// Distance from (x, y) to the segment a-b, with y squashed like the blasts measure it.
function segDist(px, py, ax, ay, bx, by) {
  py /= FORE; ay /= FORE; by /= FORE;
  const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}
// How far (x, y) on the ground is from the train (0 = on it); ahead = px the train will have moved on.
function trainDist(x, y, ahead) {
  const a = ahead || 0;
  let d = 1e9;
  for (const c of G.tr.cars) d = Math.min(d, segDist(x, y, c.x1 + c.dx * a, c.y1 + c.dy * a, c.x0 + c.dx * (a + 6), c.y0 + c.dy * (a + 6)));
  return Math.max(0, d - CAR.half);
}
// The car nearest (x, y).
function carNear(x, y) {
  let best = 0, bd = 1e9;
  G.tr.cars.forEach((c, k) => { const d = Math.hypot(c.cx - x, c.cy - y); if (d < bd) { bd = d; best = k; } });
  return best;
}
// The train takes a damage; car = the car hit (it flashes red); why = 'crush', 'claw' or 'shell' (the
// run adds up each kind in G.hurt, for tests and balance).
function hurtTrain(a, car, why) {
  if (G.demo || G.result) return;
  const tr = G.tr, was = tr.hp, low = tr.max * 0.35;
  if (why) G.hurt[why] += Math.min(a, tr.hp);
  tr.hp = Math.max(0, tr.hp - a);
  tr.hit[car] = 0.12;
  if (tr.hp <= 0) lose();
  else if (was >= low && tr.hp < low) {
    banner('TRAIN IN DANGER', 'CLEAR THE DEAD OFF IT', U.red, 4);
    SFX.warn();
  }
}
// The safe zone: a concrete wall right across the land, a gate for the railway, two watchtowers.
function buildSafeZone() {
  const y = Math.round(G.goalY), gx = Math.round(trackX(G.goalY)), st = G.statics;
  for (let x = gx - 640; x <= gx + 640; x += 16) {
    if (Math.abs(x - gx) < 26) continue;
    st.push({ d: SAFE.blocks[mod(x >> 4, SAFE.blocks.length)], x, y, k: y });
  }
  for (const s of [-1, 1]) {
    st.push({ d: SAFE.pillar, x: gx + s * 20, y: y + 1, k: y + 1 });
    st.push({ d: SAFE.tower, x: gx + s * 50, y: y - 4, k: y - 4, tower: s });
  }
}
// The train gets through the safe zone gate: the guards shoot the dead off it.
function arrive() {
  G.result = 'safe';
  mode = 'ending';
  G.endT = 0;
  G.trigger = false;
  G.lock = null;
  banner('SAFE ZONE!', 'THE TRAIN MADE IT ALL THE WAY', U.gold, 9);
  SFX.horn();
  for (const z of G.zombies) if (z.st === 2) later(rnd(0.2, 1.4), () => {
    if (z.dead) return;
    lights.push({ x: z.x, y: z.y, z: 6, r: 10, c: '#ffb060', life: 0.08, max: 0.08, a: 0.8 });
    kill(z, 'mg', 0, 0, 0, true);
  });
}
// The dead have taken the train: the fuel tanker goes up, then the engine.
function lose() {
  G.result = 'lost';
  mode = 'ending';
  G.endT = 0;
  G.trigger = false;
  G.lock = null;
  G.prompt = null;
  banner('TRAIN LOST', 'AT ' + km2(G.maxKm).toFixed(2) + ' KM.  YOU KEEP ALL YOUR SCRAP.', U.red, 9);
  const blast = (k, big) => () => {
    const c = G.tr.cars[k], x = c.cx + rnd(-3, 3), y = c.cy;
    boomFx(x, y, big);
    for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - x, (z.y - y) / FORE) < 30) kill(z, 'he', x, y, 10, true);
    addShake(big ? 0.8 : 0.4);
    SFX.boom();
  };
  later(0.15, blast(4, true));
  later(0.7, blast(2, false));
  later(1.3, blast(0, true));
}

// ---------- the dead
function makeZombie(x, y, type) {
  const T = CFG.types[type], sets = ZS[type];
  return {
    x, y, type, S: sets[(Math.random() * sets.length) | 0], hp: T.hp, max: T.hp, value: T.value, run: !!T.run, big: !!T.big,
    sp: rnd(T.speed[0], T.speed[1]), dps: T.dps, wob: rnd(TAU), anim: rnd(2), left: Math.random() < 0.5,
    vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, pending: 0, block: [], blockT: rnd(0.5), dead: false, gone: false, qd: 0, k: y,
    // st: 0 walking, 1 on the rails ahead of the train, 2 holding on to the train
    st: 0, rx: rnd(-3, 3), side: 0, car: 0, al: 0, ox: 0, bang: 0, dmg: 0
  };
}
// The horde by distance from the Depot. One row per distance: [km, dead around the train, side pack
// size (the smallest; the biggest is 4 more), a rail crowd every (s, from, to), rail crowd size (the
// smallest; the biggest is 3 more), share of runners, share of brutes in rail crowds]. Between two
// rows the numbers blend; past the last row they stay. Runners and brutes only come from the km in
// CFG.pop.
const HORDE = [
  [0, 110, 3, 7, 10, 3, 0, 0],
  [0.25, 140, 3, 6.6, 9.6, 3, 0, 0],
  [0.5, 170, 4, 6.3, 9.3, 4, 0.04, 0],
  [0.75, 200, 4, 5.9, 8.9, 4, 0.14, 0],
  [1, 230, 5, 5.5, 8.5, 5, 0.24, 0],
  [1.25, 297, 5, 5.1, 8.1, 6, 0.25, 0.08],
  [1.5, 365, 7, 4.8, 7.8, 9, 0.25, 0.11],
  [2, 400, 10, 4, 7, 13, 0.25, 0.17]
];
const HD = { want: 0, side: 0, every0: 0, every1: 0, rail: 0, run: 0, brute: 0 };
// The horde's numbers at d km (filled into HD).
function horde(d) {
  let i = 0;
  while (i < HORDE.length - 2 && d > HORDE[i + 1][0]) i++;
  const a = HORDE[i], b = HORDE[i + 1], t = clamp((d - a[0]) / (b[0] - a[0]), 0, 1), m = (k) => lerp(a[k], b[k], t);
  HD.want = Math.min(CFG.pop.max, Math.round(m(1)));
  HD.side = Math.floor(m(2));
  HD.every0 = m(3);
  HD.every1 = m(4);
  HD.rail = Math.floor(m(5));
  HD.run = d < CFG.pop.runFrom ? 0 : m(6);
  HD.brute = d < CFG.pop.bruteFrom ? 0 : m(7);
  return HD;
}
// 0 walker, 1 runner, 2 brute. rail = for a crowd on the rails (brutes only come there).
function pickType(rail) {
  const r = Math.random();
  if (G.demo) return r < 0.03 ? 2 : r < 0.1 ? 1 : 0;
  const h = horde(DK()), b = rail ? h.brute : 0;
  return r < b ? 2 : r < b + h.run ? 1 : 0;
}
function pack(n, hx, hy) {
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(Math.random()) * (8 + n * 1.5), b = rnd(TAU);
    G.zombies.push(goldRoll(makeZombie(hx + Math.cos(b) * r, hy + Math.sin(b) * r * FORE, pickType(false))));
  }
}
// true when (x, y) is out of the camera's view by more than m px
const offView = (x, y, m) => x < G.camX - m || x > G.camX + W + m || y < G.camY - m || y > G.camY + H + m;
// A pack walks in from one side of the railway, out of view; ds = along the rails from the engine.
function sidePack(n, ds0, ds1) {
  for (let i = 0; i < 6; i++) {
    const s = G.tr.s + rnd(ds0, ds1), y = yAtS(s, G.tr.fy + (s - G.tr.s)), side = Math.random() < 0.5 ? -1 : 1;
    const x = trackX(y) + side * rnd(110, 380);
    if (y < G.goalY + 40 || !offView(x, y, 24)) continue;
    pack(n, x, y);
    return;
  }
}
// One of the dead standing on the rails at s, u px right of the rail middle.
function railZombie(s, u, type) {
  const y = yOfS(s), z = makeZombie(trackX(y) + u, y, type);
  z.st = 1;
  z.rx = u;
  G.zombies.push(z);
  return z;
}
// A crowd standing on the rails ahead of the train, out of view (never in a Dead Wall's last 150 m).
function railGroup(n) {
  for (let i = 0; i < 4; i++) {
    const s = G.tr.s - rnd(230, 380) - i * 90, y = yAtS(s, G.tr.fy + (s - G.tr.s));
    if (y < G.goalY + 60) return;
    if (!offView(trackX(y), y, 16) || wallZone(s)) continue;
    for (let k = 0; k < n; k++) {
      const yy = y - k * rnd(3, 8), z = makeZombie(trackX(yy) + rnd(-3, 3), yy, pickType(true));
      z.st = 1;
      z.rx = z.x - trackX(yy);
      G.zombies.push(z);
    }
    return;
  }
}
// The start: packs on both sides of the railway, most of them ahead (10 behind the menus, 4 in a
// run), and at the Depot 5 of the dead on the rails just ahead. at = the station a run starts at.
// The first run of a save has 12 at the Depot gate instead, standing in a crowd for the Ram taste.
function scatter(at) {
  for (let k = 0, n = G.demo ? 10 : 4; k < n; k++) {
    const s = G.tr.s - rnd(-40, 300), y = yAtS(s, G.tr.fy + (s - G.tr.s));
    pack(rndi(5, 12), trackX(y) + (Math.random() < 0.5 ? -1 : 1) * rnd(90, W / 2), y);
  }
  if (at) return;
  if (G.taste) {
    for (let k = 0; k < CFG.ram.taste; k++) {
      const z = railZombie(G.tr.s - 105 - (k >> 1) * 7 - rnd(0, 3), (k & 1 ? 1 : -1) * rnd(1, 6), 0);
      z.still = z.gate = true;
    }
    // (should the Ram not come, they wake after a while)
    later(8, () => { for (const z of G.zombies) if (z.gate) z.still = false; });
    return;
  }
  for (let k = 0; k < 5; k++) railZombie(G.tr.s - 110 - k * 6, rnd(-3, 3), 0);
}
// More of the dead come as the train goes: side packs while there are fewer than the horde wants
// (none while the train stands at a station), and now and then a crowd on the rails ahead.
function spawn(dt) {
  const st = G.station, stopped = st && st.state === 'hold', h = G.demo ? null : horde(DK());
  G.spawnCd -= dt;
  if (G.spawnCd <= 0 && !stopped && G.zombies.length < (h ? h.want : 300)) {
    sidePack(h ? rndi(h.side, h.side + 4) : rndi(3, 7), -420, 80);
    G.spawnCd = rnd(0.3, 0.6);
  }
  G.railCd -= dt;
  if (G.railCd <= 0 && !stopped) {
    if (!h) {
      railGroup(rndi(3, 6));
      G.railCd = rnd(7, 10);
    } else {
      if (!wallAhead(CFG.wall.warn)) railGroup(rndi(h.rail, h.rail + 3));
      G.railCd = rnd(h.every0, h.every1);
    }
  }
}

// ---------- Dead Walls
// Before each station a crowd of the dead with brutes stands packed on the rails. It is placed when
// the train is 600 px away, stands still until the train is 110 px away, and comes back every run.
// km = where its front is; it fills 120 px of rails behind that.
const WALLS = [
  { km: 0.65, walkers: 30, brutes: 4 },
  { km: 1.65, walkers: 40, brutes: 6 }
];
// true when s (along the rails) is in a Dead Wall or in the 150 m in front of one
function wallZone(s) {
  for (const w of G.walls) if (s <= w.s + CFG.wall.warn && s >= w.s - CFG.wall.len - 30) return true;
  return false;
}
// true when the engine is less than d px before a Dead Wall (or in it)
function wallAhead(d) {
  for (const w of G.walls) if (G.tr.s - w.s < d && G.tr.s - w.s > -CFG.wall.len) return true;
  return false;
}
function placeWall(w) {
  w.placed = true;
  const c = CFG.wall;
  for (let i = 0; i < w.walkers + w.brutes; i++) {
    // anywhere in the wall, within c.half px of the rail middle (the brutes nearer to it)
    const big = i < w.brutes;
    const z = railZombie(w.s - rnd(0, c.len), rnd(-c.half, c.half) * (big ? 0.5 : 1), big ? 2 : 0);
    z.still = true;
    w.zs.push(z);
  }
}
// Place the walls coming up, warn of them, and wake them when the train is close.
function updateWalls() {
  const tr = G.tr, c = CFG.wall;
  for (const w of G.walls) {
    const d = tr.s - w.s;
    if (!w.placed && d < c.place && d > -c.len) placeWall(w);
    if (!w.warned && d < c.warn && d > 0) {
      w.warned = true;
      banner('DEAD WALL IN ' + Math.round(d / 2 / 10) * 10 + ' M', G.up.ram ? 'SAVE YOUR TURBO RAM!' : 'BRUTES ON THE TRACK', U.red, 3);
      SFX.warn();
    }
    // the first time the train comes up to a wall with the Ram full: time slows, PRESS E!
    if (!SAVE.flags.pressE && mode === 'play' && d > 0 && d < CFG.ram.prompt && ramState() === 'ready') {
      SAVE.flags.pressE = true;
      saveSave();
      G.prompt = { left: 3, w };
      banners.length = 0;
      SFX.slow();
    }
    if (w.placed && !w.awake && d < c.wake) {
      w.awake = true;
      w.hpIn = tr.hp;
      for (const z of w.zs) z.still = false;
    }
    // for the summary: the health the wall cost the train (from when it woke until the nose is 40 px
    // past its far end), the Turbo Ram ran into it, or was full near it and not used
    if (w.hpIn != null && w.hpOut == null && d < -c.len - 40) w.hpOut = tr.hp;
    if (d < c.wake && d > -c.len) {
      if (G.ram.on && d < 10) w.rammed = true;
      else if (ramState() === 'ready') w.ready = true;
    }
  }
}

// a grid of 16 px cells over the dead, for spacing and for finding who a round hits
const GC = 16, GRID = new Map();
const gk = (i, j) => (i + 40000) * 80000 + (j + 40000);
function gridBuild() {
  if (GRID.size > 3000) GRID.clear();
  for (const a of GRID.values()) a.length = 0;
  for (const z of G.zombies) {
    const k = gk(Math.floor(z.x / GC), Math.floor(z.y / GC));
    let a = GRID.get(k);
    if (!a) GRID.set(k, (a = []));
    a.push(z);
  }
}
// Call fn(z, d) for every living zombie within R of (x, y) on the ground (d = distance).
function queryEll(x, y, R, fn) {
  const i0 = Math.floor((x - R) / GC), i1 = Math.floor((x + R) / GC);
  const j0 = Math.floor((y - R * FORE) / GC), j1 = Math.floor((y + R * FORE) / GC);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const list = GRID.get(gk(i, j));
    if (!list) continue;
    for (const z of list) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, (z.y - y) / FORE);
      if (d <= R) fn(z, d);
    }
  }
}

// The dead take hold of the train: side -1 / 1 = its left / right side, 0 = the engine's nose.
// ds = how far behind the nose (along the rails), u = how far right of the rails.
function attach(z, side, ds, u) {
  z.st = 2;
  z.side = side;
  z.dmg = 0;
  z.bang = rnd(TAU);
  z.kbx = z.kby = 0;
  if (side === 0) {
    z.car = 0;
    z.ox = clamp(u, -6, 6);
    z.left = u > 0;
  } else {
    z.car = clamp(Math.floor(ds / (CAR.L + CAR.gap)), 0, CAR.n - 1);
    z.al = CAR.L / 2 - clamp(ds - z.car * (CAR.L + CAR.gap), 4, CAR.L - 6);
    z.ox = rnd(0, 2);
    z.left = side > 0;
  }
}
// The engine runs one down: it dies, and the train loses speed and health (a red -2 over the nose).
// Not while the Turbo Ram runs: then it costs nothing.
function crush(z) {
  if (G.ram.on) {
    ramKill(z);
    return;
  }
  if (G.up.cow && !z.big) {
    plow(z);
    return;
  }
  const tr = G.tr, c = tr.cars[0], dmg = z.big ? CFG.train.crushBig : CFG.train.crush;
  tr.v *= z.big ? 0.35 : 0.85;
  kill(z, 'train', 0, 0, 0);
  if (!G.demo && !G.result) addTotal(c.x0, c.y0 - 12, dmg, U.red, z.big, true);
  hurtTrain(dmg, 0, 'crush');
  for (let k = 0; k < 5; k++) {
    const s = k & 1 ? 5 : -5;
    part({ x: c.x0 + c.nx * s, y: c.y0 + c.ny * s + 2, z: 1, vx: rnd(-30, 30), vy: rnd(-10, 25), vz: rnd(10, 40),
      g: 140, life: rnd(0.2, 0.4), max: 0.4, s: 1, c: pick(['#ffe2a0', '#ffb347']), add: true, drag: 2 });
  }
  if (!G.demo) {
    addShake(z.big ? 0.35 : 0.08);
    SFX.crush(z.big);
  }
}
// The nearest survivor out in the open (running, or held by the dead) within r of zombie z.
function preyNear(z, r) {
  let best = null, bd = r;
  for (const p of G.people) {
    if (p.st !== 'run' && p.st !== 'grab') continue;
    const d = Math.hypot(p.x - z.x, (p.y - z.y) / FORE);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const TL = { u: 0, a: 0, c: 1 };
function updateZombies(dt) {
  const zs = G.zombies, tr = G.tr, hw = CAR.half, safe = G.result === 'safe';
  if (!G.result) spawn(dt);
  const kb = Math.exp(-5 * dt), mid = tr.cars[2], R = CFG.ram, ram = G.ram.on;
  let onTrain = 0, ahead = 1e9, railN = 0;
  for (const z of zs) {
    if (z.dead) continue;
    if (z.flash > 0) z.flash -= dt;
    if (z.st === 2) {
      // holding on: it rides along and claws at the car
      onTrain++;
      const c = tr.cars[z.car];
      z.bang += dt * (z.run ? 11 : 8);
      const lunge = Math.sin(z.bang) > 0.5 ? 1 : 0;
      if (z.side === 0) {
        z.x = c.x0 + c.dx * (3 - lunge) + c.nx * z.ox;
        z.y = c.y0 + c.dy * (3 - lunge) + c.ny * z.ox;
      } else {
        const o = (hw + 2 + z.ox - lunge) * z.side;
        z.x = c.cx + c.dx * z.al + c.nx * o;
        z.y = c.cy + c.dy * z.al + c.ny * o;
      }
      z.k = c.k + 0.5;
      z.vx = c.dx * tr.v;
      z.vy = c.dy * tr.v;
      z.anim += dt * 5;
      z.dmg += z.dps * dt;
      if (z.dmg >= 1) {
        z.dmg -= 1;
        hurtTrain(1, z.car, 'claw');
      }
      continue;
    }
    trackLocal(z.x, z.y, TL);
    const ds = TL.a - tr.s, side = TL.u < 0 ? -1 : 1;
    // where to walk: after a survivor, down the rails, onto the rails ahead, to the train's side,
    // or after the train
    let tx, ty;
    // (runners hunt survivors from further away; golden zombies only run)
    const prey = z.st === 0 && !z.gold ? preyNear(z, z.run ? 120 : 70) : null;
    if (z.gold) [tx, ty] = goldFlee(z);
    else if (prey) {
      tx = prey.x;
      ty = prey.y;
      if (Math.hypot(prey.x - z.x, (prey.y - z.y) / FORE) < 4) grabPerson(prey, z);
    } else if (z.st === 1) { ty = z.y + 24; tx = trackX(ty) + z.rx; }
    else if (ds < -6) { tx = trackX(z.y) + z.rx; ty = z.y + 4; }
    else if (ds <= TRAIN_LEN + 6) { tx = trackX(z.y) + side * (hw + 3) / TL.c; ty = z.y; }
    else { const c = tr.cars[CAR.n - 1]; tx = c.x1 + side * (hw + 3); ty = c.y1; }
    const dx = tx - z.x, dy = (ty - z.y) / FORE, d = Math.hypot(dx, dy) || 1;
    z.wob += dt * (z.run ? 2 : 0.8);
    const w = z.st === 1 ? 0 : Math.sin(z.wob) * (z.run ? 0.25 : 0.4), cw = Math.cos(w), sw = Math.sin(w);
    const ux = (dx * cw - dy * sw) / d, uy = (dx * sw + dy * cw) / d;
    // (the dead of a Dead Wall stand still until the train is near)
    const sp = z.still ? 0 : z.sp * (z.st === 1 ? 0.7 : 1) * (z.flash > 0 ? 0.3 : 1);
    z.vx = ux * sp + z.kbx;
    z.vy = uy * sp * FORE + z.kby;
    z.x += z.vx * dt;
    z.y += z.vy * dt;
    z.kbx *= kb;
    z.kby *= kb;
    z.k = z.y;
    if (Math.abs(ux) > 0.3) z.left = ux < 0;
    z.anim += dt * (z.still ? 0.3 : 0.6 + sp / 3.2);
    if (z.st === 0 && !z.gold && ds < -6 && Math.abs(TL.u - z.rx) < 2.5) z.st = 1;
    // the engine runs it down, or (too slow to crush it) it climbs onto the nose; beside the train
    // it climbs on. Not once the train is safe.
    if (!safe) {
      // the Turbo Ram: everything in the strip round the nose dies, brutes too
      if (ram && Math.abs(TL.u) < R.band && ds > -R.front && ds < R.back) {
        ramKill(z);
        continue;
      }
      if (Math.abs(TL.u) < hw + 2 && ds > -5 && ds < 6) {
        if (tr.v > 7 && !G.result) crush(z);
        else attach(z, 0, ds, TL.u);
        continue;
      }
      if (ds >= 0 && ds <= TRAIN_LEN && Math.abs(TL.u) < hw + 4) {
        attach(z, side, ds, TL.u);
        continue;
      }
    }
    if (z.st === 1 && ds < 0) {
      ahead = Math.min(ahead, -ds);
      if (ds > -260) railN++;
    }
    // far from the train and out of view: gone
    if (Math.abs(z.x - mid.cx) + Math.abs(z.y - mid.cy) > 900 && offView(z.x, z.y, 40)) z.gone = true;
  }
  G.onTrain = onTrain;
  G.railAhead = railN;
  // the dead on the track ahead: a warning, and the train sounds its horn
  G.blocked = ahead < 170;
  tr.hornT -= dt;
  if (ahead < 150 && tr.hornT <= 0 && !G.demo && !G.result) {
    tr.hornT = 7;
    SFX.horn();
  }
  gridBuild();
  // spacing in the crowd, round trees and walls, never inside the train or past the safe zone wall
  for (const a of zs) {
    if (a.dead || a.st === 2) continue;
    const ra = a.big ? 6 : 3.5, i0 = Math.floor(a.x / GC), j0 = Math.floor(a.y / GC);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const list = GRID.get(gk(i, j));
      if (!list) continue;
      for (const b of list) {
        if (b === a || b.st === 2) continue;
        const dx = a.x - b.x, dy = (a.y - b.y) / FORE, d2 = dx * dx + dy * dy, rr = ra + (b.big ? 6 : 3.5);
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), p = (rr - d) * 0.25 / d;
          a.x += dx * p;
          a.y += dy * p * FORE;
          b.x -= dx * p;
          b.y -= dy * p * FORE;
        }
      }
    }
    a.blockT -= dt;
    if (a.blockT <= 0) {
      blockersNear(a.x, a.y, a.block);
      a.blockT = rnd(0.5, 0.8);
    }
    for (let k = 0; k < a.block.length; k += 3) {
      const dx = a.x - a.block[k], dy = (a.y - a.block[k + 1]) / FORE, d = Math.hypot(dx, dy), m = a.block[k + 2] + ra * 0.6;
      if (d < m && d > 1e-4) {
        a.x = a.block[k] + dx / d * m;
        a.y = a.block[k + 1] + dy / d * m * FORE;
      }
    }
    for (const sp of G.stops) {
      const hs = sp.house, dx = a.x - hs.x, dy = (a.y - hs.y + 6) / FORE, d = Math.hypot(dx, dy);
      if (d < 16 && d > 1e-4) {
        a.x = hs.x + dx / d * 16;
        a.y = hs.y - 6 + dy / d * 16 * FORE;
      }
    }
    if (Math.abs(a.x - trackX(a.y)) < 26) {
      trackLocal(a.x, a.y, TL);
      const ds = TL.a - tr.s;
      if (ds > 0 && ds < TRAIN_LEN && Math.abs(TL.u) < hw + 2) a.x = trackX(a.y) + (TL.u < 0 ? -1 : 1) * (hw + 2) / TL.c;
    }
    if (a.y < G.goalY + 8) a.y = G.goalY + 8;
  }
  // drop the dead and the lost
  let j = 0;
  for (let i = 0; i < zs.length; i++) if (!zs[i].dead && !zs[i].gone) zs[j++] = zs[i];
  zs.length = j;
}

// ---------- the helicopter
// The keys push it about; with no key held it keeps its place over the train. F flies it back
// over the engine. It cannot fly further from the train than its radio range.
function updateHeli(dt) {
  const h = G.heli, c = CFG.heli, homeY = Math.round(H * 0.12);
  if (G.demo || mode === 'title') {
    // the title: a slow circle off to the side of the train, the menu on the left
    const off = W >= 560 ? -W * 0.22 : 0;
    h.ox = off + Math.cos(G.t * 0.15) * 30;
    h.oy = homeY + Math.sin(G.t * 0.15) * 24;
    h.vx = -Math.sin(G.t * 0.15) * 4.5;
    h.vy = Math.cos(G.t * 0.15) * 3.6;
  } else {
    let [ix, iy] = mode === 'play' ? keyAxis() : [0, 0];
    if (mode === 'play' && M.inside && !G.bot) {
      const ex = M.x / W * 2 - 1, ey = M.y / H * 2 - 1;
      ix = clamp(ix + Math.sign(ex) * smooth(0.94, 0.995, Math.abs(ex)), -1, 1);
      iy = clamp(iy + Math.sign(ey) * smooth(0.92, 0.99, Math.abs(ey)), -1, 1);
    }
    const l = Math.hypot(ix, iy);
    if (l > 1) { ix /= l; iy /= l; }
    if (l > 0.05) h.home = false;
    let tx = ix * c.speed, ty = iy * c.speed;
    if (h.home) {
      const dx = -h.ox, dy = homeY - h.oy, d = Math.hypot(dx, dy);
      if (d < 3) h.home = false;
      else {
        tx = dx / d * Math.min(c.speed, d * 2.5);
        ty = dy / d * Math.min(c.speed, d * 2.5);
      }
    }
    const k = Math.min(1, dt * c.accel);
    h.vx += (tx - h.vx) * k;
    h.vy += (ty - h.vy) * k;
    h.ox += h.vx * dt;
    h.oy += h.vy * dt;
    // the radio range: pulled back softly past it (the warning shows from 95% of it)
    const d = Math.hypot(h.ox, h.oy - homeY), range = G.up.range;
    h.far = d > range * 0.95;
    if (d > range) {
      const f = range / d;
      h.ox *= f;
      h.oy = homeY + (h.oy - homeY) * f;
      h.vx *= 0.8;
      h.vy *= 0.8;
    }
  }
  // the heading follows where it flies (the train's way plus its own)
  const t0 = G.tr.cars[0], gx = t0.dx * G.tr.v + h.vx, gy = t0.dy * G.tr.v + h.vy;
  if (Math.hypot(gx, gy) > 10) {
    let a = Math.atan2(gx, -gy) - h.hd;
    a = mod(a + Math.PI, TAU) - Math.PI;
    h.hd += clamp(a, -2.4 * dt, 2.4 * dt);
  }
}
// The view: over the helicopter, swinging a little ahead of where it flies, swaying as it hovers,
// and moved on by G.lead (camLead).
function placeCamera() {
  camBase(CB);
  G.camX = Math.round(CB[0] + G.lead[0] - W / 2);
  G.camY = Math.round(CB[1] + G.lead[1] - H / 2);
}
// the middle of the view before the lead: over the helicopter, a little ahead of where it flies
const CB = [0, 0];
function camBase(o) {
  const h = G.heli, sw = REDUCED ? 0 : 1;
  o[0] = G.tr.fx + h.ox + h.vx * 0.22 + Math.sin(G.t * 0.9) * 1.3 * sw;
  o[1] = G.tr.fy + h.oy + h.vy * 0.22 + Math.sin(G.t * 1.27 + 1) * 0.9 * sw;
  return o;
}
// G.lead = px the view is moved by (the heli's shadow stays where the heli is): 40 px up the line
// while the Turbo Ram runs, and at PRESS E! over to the train's nose and the Dead Wall ahead of it.
// It glides there in real time (dt = the frame's real seconds), so it is quick even while time runs
// slow; with reduced motion it goes to PRESS E! at once.
function camLead(dt) {
  const L = G.lead, c = G.tr.cars[0], w = G.prompt && mode === 'play' ? G.prompt.w : null;
  let tx = 0, ty = 0, k = 1 - Math.exp(-3 * dt);
  if (w) {
    promptLead(w, PL);
    [tx, ty] = PL;
    k = REDUCED ? 1 : 1 - Math.exp(-7 * dt);
  } else if (G.ram.on) {
    tx = c.dx * CFG.ram.lead;
    ty = c.dy * CFG.ram.lead;
  }
  L[0] += (tx - L[0]) * k;
  L[1] += (ty - L[1]) * k;
}
// At PRESS E!, the lead that shows the train's nose near the bottom and the Dead Wall w above it,
// all of it if it fits (under the top bar and the warnings); if not, its far end is cut off.
// o[2] = the screen y half-way from the nose to the front of the wall (PRESS E! goes there).
const PL = [0, 0, 0];
function promptLead(w, o) {
  const tr = G.tr, yf = yOfS(w.s), yb = yOfS(w.s - CFG.wall.len);
  const lo = tr.fy + 34, hi = yb - 48, cy = lo - hi <= H ? (lo + hi) / 2 : lo - H / 2;
  camBase(CB);
  o[0] = (tr.fx + trackX(yb)) / 2 - CB[0];
  o[1] = cy - CB[1];
  o[2] = Math.round((tr.fy + yf) / 2 - cy + H / 2);
  return o;
}
// chunks in view: [first column, first row, last column, last row]
function viewChunks() {
  return [Math.floor(G.camX / CH), Math.floor(G.camY / CH), Math.floor((G.camX + W) / CH), Math.floor((G.camY + H) / CH)];
}

// ---------- lock-on
// The zombie nearest the sight on screen (a little wider than the lock, so after a kill it jumps
// to the next one). A locked zombie that the rounds in the air will kill stays locked until it
// falls, and no other doomed one is picked: no round is wasted. G.lockWait = the gun waits for a
// doomed one to fall (a few hundredths of a second). quiet = no lock beep.
function findLock(quiet) {
  const keep = G.lock && !G.lock.dead ? G.lock : null, r1 = CFG.lock * CFG.lock, r2 = r1 * 5;
  if (keep && keep.pending >= keep.hp) {
    const dx = keep.x - G.camX - G.aimSX, dy = keep.y - G.camY - keep.S.h * 0.5 - G.aimSY;
    if (dx * dx + dy * dy <= r2) {
      G.lockWait = true;
      return;
    }
  }
  let fresh = null, fd = r2, doomed = false;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const dx = z.x - G.camX - G.aimSX, dy = z.y - G.camY - z.S.h * 0.5 - G.aimSY;
    let d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (z.pending >= z.hp) {
      if (d2 <= r1) doomed = true;
      continue;
    }
    if (z === keep) d2 *= 0.45;
    const w = d2 > r1 ? d2 * 1.5 : d2;
    if (w < fd) { fd = w; fresh = z; }
  }
  if (fresh && !G.lock && mode === 'play' && !quiet) SFX.lock();
  G.lock = fresh;
  G.lockWait = !fresh && doomed;
}

// ---------- the guns
// A 25mm round. With a lock it leads the target; without, it lands near (tx, ty).
function fireMG(player, tx, ty) {
  let bx, by, tgt = null;
  if (player && G.lock) {
    tgt = G.lock;
    const s = Math.sqrt(Math.random()) * 1.2, a = rnd(TAU);
    bx = tgt.x + tgt.vx * CFG.mg.travel + Math.cos(a) * s;
    by = tgt.y + tgt.vy * CFG.mg.travel + Math.sin(a) * s * FORE;
    tgt.pending += G.up.dmg;                         // spoken for: the next round goes elsewhere
  } else {
    const s = Math.sqrt(Math.random()) * CFG.mg.spread, a = rnd(TAU);
    bx = tx + Math.cos(a) * s;
    by = ty + Math.sin(a) * s * FORE;
  }
  G.rounds.push({ kind: 'mg', bx, by, tgt, age: 0, T: CFG.mg.travel, side: 1, j: rnd(-1, 1), player });
  G.muzzle[0] = 0.05;
  if (player) {
    G.shots++;
    G.heat = Math.min(1, G.heat + G.up.heat);
    addShake(0.06);
    kick(rnd(-0.3, 0.3), 0.5);
    SFX.mg();
  }
}
// A 105mm shell at (tx, ty). With a lock it leads: it lands where the crowd under the sight
// will have walked to by then.
function fireHE(player, tx, ty) {
  let bx = tx, by = ty;
  if (player && G.lock) {
    bx += G.lock.vx * CFG.he.travel;
    by += G.lock.vy * CFG.he.travel;
  }
  G.rounds.push({ kind: 'he', bx, by, tgt: null, age: 0, T: CFG.he.travel, side: -1, j: 0, player });
  G.muzzle[1] = 0.12;
  if (player) {
    G.heReload = G.up.reload;
    addShake(0.45);
    kick(rnd(-1, 1), 2.5);
    SFX.cannon();
    SFX.whistle(CFG.he.travel);
  }
}
// Right click or Space. Pressed just before the gun is loaded, it fires the moment it is. Nothing
// happens until the 105MM CANNON is bought in the skill tree.
function tryHE() {
  if (mode !== 'play' || paused || !G.up.he) return;
  if (G.heReload <= 0) fireHE(true, G.camX + G.aimSX, G.camY + G.aimSY);
  else if (G.heReload < 0.5) G.heQueue = true;
}
function updateRounds(dt) {
  const rs = G.rounds;
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    r.age += dt;
    if (r.age < r.T) continue;
    rs[i] = rs[rs.length - 1];
    rs.pop();
    if (r.kind === 'he') explode(r.bx, r.by, r.player);
    else mgImpact(r);
  }
}

// ---------- the rail cannon (cannon.js)
// gunXY() = the cannon's middle on the ground (a little ahead of the flatcar's middle).
function gunXY() {
  const c = G.tr.cars[2];
  return [c.cx + c.dx * 2, c.cy + c.dy * 2];
}

// ---------- the Turbo Ram
// E (or a click on its card): the train runs at 80 px/s for 4 s and smashes every zombie in its way,
// brutes too, at no cost. Every run starts with it full; 200 kills (not its own) fill it again.
// What it can do now: 'none' (no card), 'lock' (the boiler cracked: buy TURBO RAM in the tree),
// 'on' (running), 'stop' (a station is too near), 'charge' (filling up) or 'ready'.
function ramState() {
  const r = G.ram;
  if (r.on) return 'on';
  if (!G.up.ram) return r.card ? 'lock' : 'none';
  if (G.result || nearStop(CFG.ram.noStart)) return 'stop';
  return r.left > 0 ? 'charge' : 'ready';
}
// 0..1: how full the Ram is
const ramCharge = () => 1 - G.ram.left / CFG.ram.charge;
// true while the train brakes for a station or stands at one, or the next one is less than d px ahead
function nearStop(d) {
  const st = G.station;
  if (!st || st.state === 'done') return false;
  return st.state !== 'ahead' || G.tr.s - st.s < d;
}
// A kill (not the Ram's) fills the Ram a little, also while it runs; when it gets full: a beep and a
// gold flash on its card (once the Ram that runs is over).
function chargeRam() {
  const r = G.ram;
  if (r.left <= 0) return;
  r.left--;
  if (r.left <= 0 && !r.on) ramFull();
}
function ramFull() {
  if (!G.up.ram || G.demo) return;
  G.ram.flash = realT;
  SFX.ramReady();
}
// E or a click on the card. bot = the autopilot (it is not told no). True when the Ram starts.
function tryRam(bot) {
  if (G.result || !(mode === 'play' || G.demo)) return false;
  const s = ramState(), r = G.ram;
  if (s === 'ready') {
    ramStart(false);
    return true;
  }
  if (bot || G.demo || s === 'on' || s === 'none') return false;
  // say why not, over the card
  const st = G.station, m = st ? Math.max(0, Math.round((G.tr.s - st.s) / 20) * 10) : 0;
  r.msg = { t: realT, s: s === 'lock' ? 'BUY TURBO RAM IN THE SKILL TREE.'
    : s === 'stop' ? (st && st.state === 'ahead' ? 'STATION IN ' + m + ' M. NO RAM UNDER ' + CFG.ram.noStart / 2 + ' M.' : 'NO RAM AT A STATION.')
      : 'KILL ' + r.left + ' MORE TO FILL IT.' };
  SFX.deny();
  return false;
}
function ramStart(taste) {
  const r = G.ram, tr = G.tr, c = tr.cars[0];
  Object.assign(r, { on: true, t: 0, taste: !!taste, dur: taste ? CFG.ram.tasteDur : CFG.ram.dur, kills: 0, pay: 0, hissed: false, card: true,
    pop: 0, popT: -9 });
  r.left = CFG.ram.charge;
  r.uses++;
  G.prompt = null;
  // the dead holding the engine's nose die at once
  for (const z of G.zombies) if (!z.dead && z.st === 2 && z.side === 0) ramKill(z);
  // black smoke and a jet of steam from the stack, a flash of fire at the engine
  const sx = c.x0 - c.dx * 15, sy = c.y0 - c.dy * 15;
  for (let k = 0; k < 6; k++) {
    const s = k & 1 ? 1 : -1;
    part({ x: sx + rnd(-2, 2), y: sy + rnd(-1, 1), z: 12, vx: c.nx * s * rnd(10, 26) + 6, vy: c.ny * s * rnd(10, 26), vz: rnd(30, 50), g: 0,
      life: rnd(1.6, 2.4), max: 2.4, s: rnd(3, 5), c: pick(['rgba(22,20,20,0.8)', 'rgba(34,31,30,0.75)']), grow: 5, drag: 1.1, smoke: true });
  }
  for (let k = 0; k < 14; k++) part({ x: sx + rnd(-1, 1), y: sy, z: 11, vx: rnd(-8, 8), vy: rnd(-5, 5), vz: rnd(60, 110), g: 0,
    life: rnd(0.5, 0.9), max: 0.9, s: rnd(2, 3), c: pick(['rgba(240,240,232,0.8)', 'rgba(214,218,214,0.75)']), grow: 7, drag: 2.6, smoke: true });
  lights.push({ x: c.cx, y: c.cy, z: 6, r: 40, c: '#ff8a3a', life: 0.4, max: 0.4, a: 0.8 });
  if (G.demo) return;
  banner('TURBO RAM!', 'THE TRAIN SMASHES THROUGH', U.amber, 3);
  addShake(0.7);
  kick(0, -2.5);
  SFX.ramGo(r.dur + CFG.ram.ease);
}
// The scrap of the Ram's kills not shown yet pops off the engine's nose as one gold +N, thrown out
// to the left (the kill count is on the right). One each 0.2 s at most: the train leaves them
// behind in a neat line, never on top of each other.
const RAM_POP = 0.2;
function popRam() {
  const r = G.ram, c = G.tr.cars[0], v = '+' + r.pop;
  if (!r.pop) return;
  floatText(c.x0 - 6, c.y0 - 6, v, U.gold);
  const t = texts[texts.length - 1];
  if (t && t.v === v) {
    t.vx = -rnd(42, 58);
    t.vz = rnd(20, 28);
    t.life = t.max = 0.6;
  }
  r.pop = 0;
  r.popT = G.t;
}
// The Ram kills z: twice the scrap, a crunch that climbs with the count, a small shake.
function ramKill(z) {
  const r = G.ram;
  r.kills++;
  r.total++;
  r.killT = realT;
  kill(z, 'ram', 0, 0, 0);
  r.pay += z.paid;
  if (G.demo) return;
  addShake(z.big ? 0.3 : 0.12);
  SFX.crunch(r.kills);
}
// Each step of the Ram: its time, the station rule, the hiss as it eases off, the end.
function updateRam(dt) {
  const r = G.ram;
  if (!r.on) return;
  if (G.result) {
    r.on = false;
    if (!G.demo) SFX.ramStop(0.4);
    return;
  }
  r.t += dt;
  // a station ahead: it ends now, so the train can brake in time
  if (!r.taste && nearStop(CFG.ram.cut)) {
    ramEnd(true);
    return;
  }
  if (r.t >= r.dur && !r.hissed) {
    r.hissed = true;
    if (!G.demo) SFX.hiss();
  }
  // (scrap from the last kills, waiting for its turn to pop)
  if (r.pop && G.t - r.popT >= RAM_POP) popRam();
  if (r.t >= r.dur + CFG.ram.ease) {
    ramEnd(false);
    return;
  }
  ramFx();
}
// How strong the Ram's look is now: 0..1 (it fades as the train eases off)
function ramK() {
  const r = G.ram;
  return r.on ? (r.t < r.dur ? 1 : clamp(1 - (r.t - r.dur) / CFG.ram.ease, 0, 1)) : 0;
}
// Sparks from every wheel and dust thrown up in front of the nose (the thick smoke from the stack
// is in step()).
function ramFx() {
  const tr = G.tr, k = ramK();
  for (const c of tr.cars) for (let i = 0; i < 2; i++) {
    if (Math.random() > k) continue;
    const s = Math.random() < 0.5 ? -1 : 1, a = rnd(-11, 11);
    part({ x: c.cx + c.nx * s * 8 + c.dx * a, y: c.cy + c.ny * s * 8 + c.dy * a, z: 1, vx: -c.dx * rnd(20, 70) + c.nx * s * rnd(10, 40),
      vy: -c.dy * rnd(20, 70) + c.ny * s * rnd(10, 40), vz: rnd(10, 45), g: 180, life: rnd(0.12, 0.3), max: 0.3, s: 1,
      c: Math.random() < 0.5 ? '#ffe2a0' : '#ff9a3a', add: true, drag: 1 });
  }
  const c = tr.cars[0];
  for (let i = 0; i < 2; i++) {
    if (Math.random() > k) continue;
    const s = Math.random() < 0.5 ? -1 : 1;
    part({ x: c.x0 + c.nx * s * rnd(4, 9) + c.dx * rnd(0, 4), y: c.y0 + c.ny * s * rnd(4, 9) + c.dy * rnd(0, 4), z: 1,
      vx: c.nx * s * rnd(30, 60) + c.dx * tr.v * 0.9, vy: c.ny * s * rnd(30, 60) + c.dy * tr.v * 0.9, vz: rnd(6, 16), g: 0,
      life: rnd(0.4, 0.7), max: 0.7, s: rnd(2, 3), c: pick(['rgba(126,108,84,0.5)', 'rgba(104,90,70,0.5)']), grow: 5, drag: 3, smoke: true });
  }
}
// The Ram is over (cut = a station is near: BRAKES!). Its rank and what it paid; after the first
// run's taste, the boiler cracks.
function ramEnd(cut) {
  const r = G.ram, c = G.tr.cars[0], n = r.kills;
  r.on = false;
  if (G.demo) return;
  popRam();
  SFX.ramStop(cut ? 0.3 : 0.4);
  if (cut) {
    floatText(c.x0, c.y0 - 16, 'BRAKES!', U.amber);
    if (!r.hissed) SFX.hiss();
  }
  // the kills made while it ran have filled it up again
  if (r.left <= 0) ramFull();
  if (r.taste) {
    // (its card shows it spent, 0%, until the crack a moment later: then it locks)
    if (n) banner('RAM ×' + n, '+' + r.pay + ' SCRAP', U.amber, 3);
    later(0.4, () => {
      r.crack = realT;
      SFX.crack();
      radio('ENGINEER', 'THE BOILER CRACKED! FIX IT IN THE SKILL TREE.');
      const e = G.tr.cars[0], sx = e.x0 - e.dx * 15, sy = e.y0 - e.dy * 15;
      for (let k = 0; k < 10; k++) part({ x: sx + rnd(-2, 2), y: sy, z: 10, vx: rnd(-20, 20), vy: rnd(-8, 8), vz: rnd(30, 60), g: 0,
        life: rnd(0.6, 1), max: 1, s: rnd(2, 3), c: 'rgba(230,230,224,0.75)', grow: 6, drag: 2.2, smoke: true });
    });
    return;
  }
  if (n >= 5) {
    const [name, col] = n >= 30 ? ['UNSTOPPABLE', '#ff7a4a'] : n >= 15 ? ['RAMPAGE', U.amber] : ['SMASH', U.gold];
    banner(name + ' ×' + n, '+' + r.pay + ' SCRAP', col, 3);
    SFX.rank(n);
  }
}

// ---------- hits and kills
// Blood drops thrown away from the gun (up the screen) and to the sides; they stay on the ground.
function blood(x, y, n, zh) {
  for (let k = 0; k < n; k++) part({ x: x + rnd(-1, 1), y, z: rnd(3, zh), vx: rnd(-35, 35), vy: rnd(-45, 12), vz: rnd(15, 70),
    g: 240, life: 1.4, max: 1.4, s: 1, c: pick([P.bl0, P.bl1, P.bl2, P.bl2]), land: 1 });
}
// cause = 'mg' (a 25mm round), 'gun' (the flatcar gun), 'he' (the 105 at (cx, cy), dist away),
// 'train' (run down) or 'ram' (the Turbo Ram). free = not the player's kill (no score).
function kill(z, cause, cx, cy, dist, free) {
  if (z.dead) return;
  if (typeof tutKill === 'function') tutKill(z, cause, free);
  z.dead = true;
  z.hp = 0;
  z.paid = 0;
  // the lock jumps at once to the next zombie near the sight
  if (G.lock === z) {
    G.lock = null;
    if (mode === 'play') findLock(true);
  }
  const sc = scoring() && !free, S = z.S, bs = G.bodies, room = bs.length < 160, ram = cause === 'ram';
  // every kill but the Ram's own fills the Ram again
  if (!ram && !free) chargeRam();
  // what it pays: its value (twice that for the Ram), plus SCAVENGER's share (kept as whole scrap;
  // the rest waits for the next kill)
  let pay = 0;
  if (sc) {
    const base = z.value * (ram ? CFG.ram.pay : 1);
    pay = base;
    if (cause === 'gun') G.gun.kills++;
    if (G.up.scav) {
      G.scavAcc += base * G.up.scav;
      const e = Math.floor(G.scavAcc + 1e-9);
      G.scavAcc -= e;
      G.scavPaid += e;
      pay += e;
    }
    G.kills++;
    G.cash += pay;
    G.pay.kills += pay;
    G.killBump = 1;
  }
  if (cause === 'he') {
    // thrown away from the blast, turning over
    const dx = z.x - cx, dy = (z.y - cy) / FORE, l = Math.hypot(dx, dy) || 1, f = 1 - Math.min(1, dist / CFG.he.hurt);
    const v = (35 + f * 80) * (z.big ? 0.4 : 1) * rnd(0.8, 1.2);
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: dx / l * v, vy: dy / l * v * FORE,
      vz: (50 + f * 130) * (z.big ? 0.5 : 1) * rnd(0.8, 1.2), spin: rnd(8, 16) * (dx < 0 ? -1 : 1), rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 10 : 4, S.h * 0.5);
    if (Math.random() < 0.4) part({ x: z.x, y: z.y, z: rnd(4, 9), vx: rnd(-10, 10), vy: rnd(-5, 5), vz: rnd(12, 30), g: -6,
      life: rnd(0.4, 0.8), max: 0.8, s: 1, c: pick(['#ff8a3a', '#ffc27a']), add: true, drag: 1.5 });
  } else if (cause === 'train' || ram) {
    // run down: flung aside and ahead, a burst of blood. The Ram throws them twice as hard (and on
    // ahead of the speeding train), and each one pops its scrap
    const c = G.tr.cars[0], s = trackLocal(z.x, z.y, TL).u < 0 ? -1 : 1, k = ram ? 2 : 1;
    const v = rnd(40, 80) * k, f = rnd(15, 35) * k + (ram ? G.tr.v * 0.6 : 0);
    if (room) bs.push({ S, x: z.x, y: z.y, z: 2, vx: c.nx * s * v + c.dx * f, vy: c.ny * s * v + c.dy * f, vz: rnd(40, 80) * k,
      spin: rnd(10, 18) * s * k, rot: 0, fall: false, age: 0 });
    else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 16 : ram ? 14 : 10, S.h * 0.6);
    if (sc) {
      // (the Ram's kills pop their +2 in turn; the scrap of kills too close together goes into the
      // next one, so they never pile up)
      if (ram) {
        G.ram.pop += pay;
        if (G.t - G.ram.popT >= RAM_POP) popRam();
      } else addTotal(z.x, z.y - S.h, pay, U.gold, !!z.gold);
    }
  } else {
    // a 25mm round: knocked over backwards, away from the gun, or off the side of the train; a
    // flatcar gun round knocks them away from the flatcar
    if (room) {
      if (z.st === 2) {
        const c = G.tr.cars[z.car], s = z.side, v = rnd(25, 45), tv = G.tr.v * 0.6;
        bs.push(s ? { S, x: z.x, y: z.y, z: 3, vx: c.nx * s * v + c.dx * tv, vy: c.ny * s * v + c.dy * tv, vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 }
          : { S, x: z.x, y: z.y, z: 3, vx: c.dx * (v + tv), vy: c.dy * (v + tv), vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 });
      } else if (cause === 'gun') {
        const [gx, gy] = gunXY(), dx = z.x - gx, dy = z.y - gy, l = Math.hypot(dx, dy) || 1, v = rnd(14, 24);
        bs.push({ S, x: z.x, y: z.y, z: 0, vx: dx / l * v, vy: dy / l * v, vz: rnd(22, 40), spin: 0, rot: 0, fall: true, age: 0 });
      } else bs.push({ S, x: z.x, y: z.y, z: 0, vx: rnd(-8, 8), vy: -rnd(10, 22), vz: rnd(22, 40), spin: 0, rot: 0, fall: true, age: 0 });
    } else stampCorpse(S, z.x, z.y);
    blood(z.x, z.y, z.big ? 14 : 8, S.h * 0.6);
    part({ x: z.x, y: z.y, z: S.h * 0.5, vx: rnd(-4, 4), vy: rnd(-6, 0), vz: rnd(4, 10), g: 0, life: 0.45, max: 0.45, s: 3,
      c: 'rgba(110,24,20,0.55)', grow: 7, drag: 3, smoke: true });
    if (sc) addTotal(z.x, z.y - S.h, pay, U.gold, !!z.gold);
    if (!G.demo) SFX.splat();
  }
  z.paid = pay;
  if (z.gold) goldKill(z, sc);
  if (sc && (Math.random() < 0.3 || z.big) && coins.length < 45) coins.push({ x0: z.x - G.camX, y0: z.y - G.camY - 8, t: 0, T: rnd(0.55, 0.8) });
  if (z.big && !G.demo) {
    addShake(0.15);
    hitStop(0.05, 0.3);
  }
}
// A 25mm hit: 1 damage, more with HEAVY ROUNDS (the demo hits for 1). Or a hit of dmg from another
// gun (cause 'gun' = the flatcar gun).
function hitZombie(z, dmg, cause) {
  z.hp -= dmg != null ? dmg : G.demo ? 1 : G.up.dmg;
  z.flash = 0.1;
  if (z.hp <= 0) {
    kill(z, cause || 'mg', 0, 0, 0);
    return true;
  }
  // a brute takes the hit: blood and a step back (not when it holds on to the train)
  blood(z.x, z.y, 4, z.S.h * 0.6);
  if (z.st !== 2) z.kby -= 12;
  if (!G.demo) SFX.hit();
  return false;
}
// A 25mm round lands: its locked target first, then the nearest round the burst. KILLED = the
// ones it killed (for CHAIN SHOT and the hit-stop).
const NEAR = [], KILLED = [];
function mgImpact(r) {
  const x = r.bx, y = r.by, T = r.tgt;
  let hits = 0;
  KILLED.length = 0;
  if (T) T.pending = Math.max(0, T.pending - G.up.dmg);
  if (T && !T.dead && Math.hypot(T.x - x, (T.y - y) / FORE) < 6) {
    if (hitZombie(T)) KILLED.push(T);
    hits++;
  }
  NEAR.length = 0;
  queryEll(x, y, CFG.mg.splash, (z, d) => {
    if (z === T) return;
    z.qd = d;
    NEAR.push(z);
  });
  NEAR.sort((a, b) => a.qd - b.qd);
  for (const z of NEAR) {
    if (hits >= CFG.mg.victims) break;
    if (!z.dead) {
      if (hitZombie(z)) KILLED.push(z);
      hits++;
    }
  }
  if (hits && r.player) {
    G.hits++;
    G.hitT = 0.12;
  }
  if (r.player) roundKills(KILLED);
  // the round bursts: a small fire puff, a flash, sparks, earth and dust, a dark mark
  addBoom(x, y, 6, 3, 0.3, 3);
  lights.push({ x, y, z: 3, r: 14, c: '#ffb060', life: 0.1, max: 0.1, a: 0.8 });
  for (let k = 0; k < 4; k++) {
    const a = rnd(TAU), s = rnd(20, 70);
    part({ x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 70), g: 160, life: rnd(0.2, 0.45), max: 0.45,
      s: 1, c: pick(['#ffe2a0', '#ffb347', '#ff6a28']), add: true, drag: 1.5 });
  }
  for (let k = 0; k < 3; k++) {
    const a = rnd(TAU), s = rnd(15, 45);
    part({ x, y, z: 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 80), g: 320, life: 1.2, max: 1.2, s: 1,
      c: pick(['#4c4032', '#362d24', '#5e5140']), land: 1 });
  }
  part({ x: x + rnd(-1, 1), y, z: 2, vx: rnd(-5, 5) + 3, vy: rnd(-3, 3), vz: rnd(6, 12), g: 0, life: rnd(0.6, 1), max: 1, s: 2,
    c: pick(['rgba(92,86,80,0.55)', 'rgba(70,64,58,0.55)']), grow: 4, drag: 1.5, smoke: true });
  stampScorch(x, y, 0);
  if (!G.demo) SFX.pop();
}
// The look of a big blast (no damage): flash, fireball, rings, smoke, earth, sparks, fires, a crater.
function boomFx(x, y, big) {
  lights.push({ x, y, z: 6, r: big ? 90 : 60, c: '#ff8a3a', life: 0.35, max: 0.35, a: 0.9 });
  lights.push({ x, y, z: 6, r: 40, c: '#fff6e0', life: 0.12, max: 0.12, a: 1 });
  addBoom(x, y, big ? 26 : 18, 7, 0.75, big ? 11 : 8);
  for (let k = 0; k < (big ? 4 : 2); k++) {
    const a = rnd(TAU), r = rnd(10, 22);
    addBoom(x + Math.cos(a) * r, y + Math.sin(a) * r * FORE, 12, 4, 0.5, 6, rnd(0.03, 0.15));
  }
  rings.push({ x, y, r0: 8, r1: CFG.he.kill * 1.25, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x, y, r0: 20, r1: CFG.he.hurt * 1.5, t: 0, T: 0.55, c: '#a89878' });
  for (let k = 0; k < 16; k++) part({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), z: rnd(4, 18), vx: rnd(-14, 14) + 4, vy: rnd(-6, 6),
    vz: rnd(10, 34), g: 0, life: rnd(1.4, 2.8), max: 2.8, s: rnd(4, 8),
    c: pick(['rgba(58,50,46,0.75)', 'rgba(40,36,34,0.7)', 'rgba(74,64,56,0.6)']), grow: 6, drag: 1, smoke: true });
  for (let k = 0; k < 34; k++) {
    const a = rnd(TAU), s = rnd(30, 130);
    part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(60, 170), g: 320, life: 2, max: 2,
      s: Math.random() < 0.3 ? 2 : 1, c: pick(['#4c4032', '#362d24', '#5e5140', '#2a241d']), land: 1 });
  }
  for (let k = 0; k < 18; k++) {
    const a = rnd(TAU), s = rnd(30, 120);
    part({ x, y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 140), g: 140, life: rnd(0.4, 0.9), max: 0.9,
      s: 1, c: pick(['#ffe2a0', '#ffb347', '#ff6a28']), add: true, drag: 1.2 });
  }
  for (let k = 0; k < 4 && flames.length < 40; k++) {
    const a = rnd(TAU), r = rnd(6, 24);
    flames.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FORE, life: rnd(3, 7), seed: rnd(100) });
  }
  stampScorch(x, y, 3);
}
// The 105 lands: everything near dies, the edge of the blast throws the rest back. Too close to
// the train, the blast hurts the train as well; it kills survivors on foot too.
function explode(x, y, player) {
  let killed = 0, value = 0;
  queryEll(x, y, CFG.he.hurt, (z, d) => {
    if (d >= CFG.he.kill) {
      z.hp -= 4;
      z.flash = 0.25;
      if (z.st !== 2) {
        const dx = z.x - x, dy = (z.y - y) / FORE, l = Math.hypot(dx, dy) || 1;
        z.kbx += dx / l * 60;
        z.kby += dy / l * 60 * FORE;
      }
      if (z.hp > 0) return;
    }
    killed++;
    kill(z, 'he', x, y, d);
    value += z.paid;
  });
  boomFx(x, y, true);
  if (!G.demo) {
    addShake(0.75);
    hitStop(killed >= 12 ? 0.1 : 0.04, 0.25);
    SFX.boom();
  }
  for (const p of G.people) if ((p.st === 'run' || p.st === 'grab') && Math.hypot(p.x - x, (p.y - y) / FORE) < CFG.he.kill) catchPerson(p);
  const td = trainDist(x, y);
  if (player && td < CFG.he.close && !G.demo && !G.result) {
    const a = Math.round(14 * (1 - td / CFG.he.close)) + 3, k = carNear(x, y), c = G.tr.cars[k];
    hurtTrain(a, k, 'shell');
    floatText(c.cx, c.cy - 8, '-' + a, U.red);
    banner('CHECK FIRE!', 'YOUR SHELL HIT THE TRAIN', U.red, 3);
    SFX.radio();
  }
  if (player && scoring()) {
    G.bestBlast = Math.max(G.bestBlast, killed);
    if (killed) addTotal(x, y - 10, value, U.gold, true);
    if (killed >= 4) {
      const name = killed >= 25 ? 'MASSACRE' : killed >= 12 ? 'CARNAGE' : 'MULTI KILL';
      banner(name + ' ×' + killed, '+' + value + ' SCRAP', killed >= 12 ? '#ff7a4a' : U.amber, 2);
    }
  }
}
// Bodies in the air: they fall, bounce once if they come down hard, then lie as corpses.
function updateBodies(dt) {
  const bs = G.bodies;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    b.age += dt;
    b.vz -= 320 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.rot += b.spin * dt;
    if (b.z > 0) continue;
    b.z = 0;
    if (b.vz < -70) {
      b.vz *= -0.3;
      b.vx *= 0.5;
      b.vy *= 0.5;
      b.spin *= 0.5;
      part({ x: b.x, y: b.y, z: 0, vx: 0, vy: 0, vz: 4, g: 0, life: 0.5, max: 0.5, s: 3, c: 'rgba(90,80,64,0.45)', grow: 4, smoke: true });
    } else {
      stampCorpse(b.S, b.x, b.y);
      bs[i] = bs[bs.length - 1];
      bs.pop();
    }
  }
}
// Burning wrecks and farms in view: smoke columns and embers.
function updateFireSpots(dt) {
  const [i0, j0, i1, j1] = viewChunks();
  for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
    for (const f of plan(i, j).fires) {
      const k = f.big ? 1 : 0.6;
      if (Math.random() < dt * 2.2 * k) part({ x: f.x + rnd(-2, 2), y: f.y + rnd(-1, 1), z: f.big ? 9 : 5, vx: rnd(4, 9), vy: rnd(-2, 1),
        vz: rnd(8, 14), g: 0, life: rnd(2.2, 3.6), max: 3.6, s: rnd(2, 4) * k + 1,
        c: pick(['rgba(44,40,38,0.6)', 'rgba(58,52,48,0.55)', 'rgba(36,33,31,0.6)']), grow: 3.5, drag: 0.35, smoke: true });
      if (Math.random() < dt * 5 * k) part({ x: f.x + rnd(-3, 3), y: f.y, z: rnd(4, 9), vx: rnd(-4, 6), vy: rnd(-2, 2), vz: rnd(14, 30),
        g: -4, life: rnd(0.5, 1.1), max: 1.1, s: 1, c: pick(['#ffc27a', '#ff8a3a', '#e2552f']), add: true, drag: 1.2 });
    }
  }
}

// ---------- the autopilot (the title demo, and tests through window.__sr.bot)
// It shoots the dead on the train first, then the ones near the survivors, then the ones on the
// rails nearest the engine, then whoever is nearest the train; the 105 goes to a crowd on the rails
// well ahead of the train, and the Turbo Ram to a Dead Wall or a crowd on the rails.
function autopilot(dt) {
  G.botT -= dt;
  if (G.botT <= 0 || !G.botZ || G.botZ.dead) {
    G.botT = 0.2;
    let bestZ = null, bs = 1e9;
    for (const z of G.zombies) {
      // (the dead at the Depot gate in the first run are left for the Ram taste)
      if (z.dead || z.gate && (!G.ram.uses || G.ram.on)) continue;
      const sx = z.x - G.camX, sy = z.y - G.camY;
      if (sx < 6 || sx > W - 6 || sy < 26 || sy > H - 6) continue;
      let s;
      const prey = preyNear(z, 50);
      if (prey && prey.by === z) s = -100;
      else if (z.st === 2) s = 0;
      else if (prey) s = 100;
      else if (z.st === 1) s = 300 + Math.max(0, trackLocal(z.x, z.y, TL).a - G.tr.s + 400);
      else s = 900 + trainDist(z.x, z.y);
      if (s < bs) { bs = s; bestZ = z; }
    }
    G.botZ = bestZ;
  }
  let he = null;
  for (const q of G.zombies) {
    if (q.dead || q.st !== 1 || q.y - G.camY < 24 || q.y - G.camY > H) continue;
    if (G.tr.s - trackLocal(q.x, q.y, TL).a > 110) { he = q; break; }
  }
  // the Turbo Ram: at a Dead Wall, at PRESS E!, or when 6 or more dead stand on the rails ahead (but
  // not when a Dead Wall is less than 600 m ahead: it saves the Ram for that)
  if (ramState() === 'ready' && (G.prompt || wallAhead(130) || G.railAhead >= 6 && !wallAhead(1200))) tryRam(true);
  return { z: G.botZ && !G.botZ.dead ? G.botZ : null, he };
}
// the title demo: bursts of 25mm and a 105 now and then
function attract(dt) {
  const b = autopilot(dt);
  G.mgCd -= dt;
  if (b.z && G.t % 1.8 < 1.1) {
    while (G.mgCd <= 0) {
      fireMG(false, b.z.x + b.z.vx * CFG.mg.travel + rnd(-2, 2), b.z.y + b.z.vy * CFG.mg.travel + rnd(-2, 2));
      G.mgCd += 1 / CFG.mg.rate;
    }
  } else G.mgCd = Math.max(0, G.mgCd);
  G.heReload -= dt;
  if (b.he && G.heReload <= 0) {
    fireHE(false, b.he.x + b.he.vx * CFG.he.travel, b.he.y + b.he.vy * CFG.he.travel);
    G.heReload = 3.5;
  }
}
// in play with the bot on: it moves the sight and pulls the triggers
function botPlay(dt) {
  const b = autopilot(dt);
  if (b.z) {
    M.x = b.z.x - G.camX;
    M.y = b.z.y - G.camY - b.z.S.h * 0.5;
    M.inside = true;
  }
  G.trigger = !!b.z;
  if (b.he && G.up.he && G.heReload <= 0) fireHE(true, b.he.x + b.he.vx * CFG.he.travel, b.he.y + b.he.vy * CFG.he.travel);
}

// ---------- the ride
// The train has ridden d px further: it pays 1 scrap every CFG.pay.dist px (20 m), and passing the
// best km of all runs shows NEW BEST.
function ride(d) {
  G.ride += d;
  const due = Math.floor(G.ride / CFG.pay.dist) - G.pay.dist;
  if (due > 0) {
    G.cash += due;
    G.pay.dist += due;
  }
  G.maxKm = Math.max(G.maxKm, DK());
  if (!G.newBest && G.oldBest > 0 && km2(G.maxKm) > G.oldBest) {
    G.newBest = true;
    banner('NEW BEST', 'PAST ' + G.oldBest.toFixed(2) + ' KM. KEEP GOING!', U.gold, 1);
    SFX.fanfare();
  }
}

// ---------- one step of the game (STEP seconds)
function step(dt) {
  G.t += dt;
  const tr = G.tr, st = G.station;
  // the train gets back up to speed after every bump. It brakes for the station and waits there;
  // lost, it stops; safe, it rolls on until the whole train is inside the wall, then brakes.
  if (G.result === 'lost') tr.v = Math.max(0, tr.v - 30 * dt);
  else if (G.result === 'safe' && tr.s + TRAIN_LEN < G.goalS - 14) tr.v = Math.max(0, tr.v - 12 * dt);
  else if (st && st.state === 'braking') {
    tr.v = Math.min(tr.v, Math.sqrt(2 * CFG.train.brake * Math.max(0, tr.s - st.stopS)) + 1.5);
    if (tr.s - st.stopS < 0.6) {
      tr.v = 0;
      trainStops(st);
    }
  } else if (st && st.state === 'hold') tr.v = 0;
  else {
    // the Turbo Ram: up to its top speed in 0.4 s, then back down to the cruise over 1 s (also after
    // a Ram cut short). Otherwise the train gets back up to its cruise.
    const R = CFG.ram, cr = CFG.train.cruise, up = (R.speed - cr) / R.rise, down = (R.speed - cr) / R.ease;
    if (G.ram.on && G.ram.t < G.ram.dur) tr.v = Math.min(R.speed, tr.v + up * dt);
    else if (tr.v > cr) tr.v = Math.max(cr, tr.v - down * dt);
    else tr.v = Math.min(cr, tr.v + CFG.train.accel * dt);
  }
  updateRam(dt);
  tr.s -= tr.v * dt;
  layoutTrain();
  if (!G.demo && !G.result) ride(tr.v * dt);
  for (let k = 0; k < CAR.n; k++) if (tr.hit[k] > 0) tr.hit[k] -= dt;
  tr.hpShown = Math.max(tr.hp, tr.hpShown - dt * 12);
  // the little fires it runs over go out
  for (const f of flames) if (Math.abs(f.x - trackX(f.y)) < CAR.half + 2 && trainDist(f.x, f.y) < 1) f.life = 0;
  // wheels over the rail joints, and smoke from the stack
  tr.clack += tr.v * dt;
  if (tr.clack > 30) {
    tr.clack -= 30;
    if (!G.demo && mode !== 'summary') SFX.clack();
  }
  tr.smokeT -= dt;
  if (tr.smokeT <= 0 && G.result !== 'lost') {
    // (the Turbo Ram: thick black smoke, fast)
    const c = tr.cars[0], k = ramK();
    tr.smokeT = tr.v > 1 ? 0.16 - k * 0.11 : 0.4;
    part({ x: c.x0 - c.dx * 15 + rnd(-1, 1), y: c.y0 - c.dy * 15, z: 10, vx: rnd(-3, 3) + 3 + k * rnd(8, 16), vy: rnd(-2, 2), vz: rnd(14, 22) + k * 18, g: 0,
      life: rnd(1.6, 2.6) - k * 0.6, max: 2.6, s: rnd(2, 3) + k, c: k > 0.5 ? pick(['rgba(20,18,18,0.7)', 'rgba(32,30,28,0.65)'])
        : pick(['rgba(40,38,36,0.6)', 'rgba(56,52,48,0.55)']), grow: 3 + k * 2, drag: 0.8, smoke: true });
  }
  updateHeli(dt);
  placeCamera();
  if (G.up.gun && !G.result) updateCannon(dt);
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const tm = G.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) {
      G.timers.splice(i, 1);
      tm.f();
    }
  }
  if (mode === 'play') {
    G.run += dt;
    if (G.bot) botPlay(dt);
    G.aimSX = clamp(M.x, 0, W - 1);
    G.aimSY = clamp(M.y, 0, H - 1);
    findLock();
    // the 25mm heats up while it fires and cools when it rests; too hot and it stops for a moment
    G.heat = Math.max(0, G.heat - CFG.mg.cool * dt * (G.trigger && !G.overheat ? 0.25 : 1));
    if (G.overheat && G.heat < 0.35) G.overheat = false;
    if (G.trigger && !G.overheat) {
      G.mgCd -= dt;
      while (G.mgCd <= 0 && !G.overheat) {
        // (only a zombie already done for under the sight: wait, the round would be wasted)
        if (G.lockWait) {
          G.mgCd = 0;
          break;
        }
        fireMG(true, G.camX + G.aimSX, G.camY + G.aimSY);
        G.mgCd += 1 / G.up.rate;
        findLock(true);
        if (G.heat >= 1) {
          G.overheat = true;
          SFX.overheat();
          floatText(G.camX + G.aimSX, G.camY + G.aimSY + 8, 'OVERHEAT', U.red);
        }
      }
    } else G.mgCd = Math.max(0, G.mgCd - dt);
    if (G.heReload > 0) {
      G.heReload = Math.max(0, G.heReload - dt);
      if (G.heReload <= 0) {
        if (G.heQueue) {
          G.heQueue = false;
          fireHE(true, G.camX + G.aimSX, G.camY + G.aimSY);
        } else SFX.ready();
      }
    }
    if (!G.result && tr.s <= G.goalS) arrive();
  } else {
    G.aimSX = W / 2;
    G.aimSY = H / 2;
    if (mode === 'title' || mode === 'depot') attract(dt);
    else if (mode === 'ending') {
      G.endT += dt;
      if (G.endT > 3.4 && (G.result !== 'safe' || tr.v < 0.5) || G.endT > 14) endGame();
    }
  }
  G.hitT = Math.max(0, G.hitT - dt);
  G.muzzle[0] = Math.max(0, G.muzzle[0] - dt);
  G.muzzle[1] = Math.max(0, G.muzzle[1] - dt);
  G.killBump = Math.max(0, G.killBump - dt * 6);
  G.cashPulse = Math.max(0, G.cashPulse - dt * 3);
  updateStation(dt);
  if (!G.demo) updateWalls();
  updateZombies(dt);
  updateRounds(dt);
  updateBodies(dt);
  updateFireSpots(dt);
  updateSkills(dt);
  if (!G.demo) updateLoot(dt);
  updateFX(dt);
  // every 3 s the marks on the ground fade a little
  G.decalT += dt;
  if (G.decalT > 3) {
    G.decalT = 0;
    const [i0, j0, i1, j1] = viewChunks();
    fadeDecals(i0, j0, i1, j1);
  }
}
