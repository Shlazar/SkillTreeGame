// game.js - escort the train for one leg of the fixed Farmlands line. The Viper fights by itself
// or where you send it. Zombies walk in, block the rails and climb onto the train. A run ends at
// the next station or when the train breaks; collected rewards are kept. The view follows the
// train. Behind the title and Depot, a separate demo battle runs without earning rewards.
// Units are world pixels and seconds; y on the ground is squashed by FORE; the train runs to -y.

const CFG = {
  // the line: px along the rails in 1 km (2 px = 1 m)
  line: { km: 2000 },
  // the train: top speed (px/s), how fast it gets back up to speed, how hard it brakes, its health,
  // and the health it loses for each zombie it runs over (a brute costs more)
  train: { cruise: 40, accel: 14, brake: 16, hp: 80, crush: 0.5, crushBig: 6 },
  // a helicopter: its top speed, how fast it gets there, how near loot must be to pick it up
  heli: { speed: 170, accel: 3.2, pickup: 14 },
  // 25mm: 4 rounds/s, flight seconds, spread px, burst radius px and most victims. (proposal)
  // The Viper fires continuously.
  mg: { rate: 4, travel: 0.07, spread: 5, splash: 7, victims: 4 },
  // 105mm: reload, flight time, kill radius, hurt radius (a hurt walker dies too, a brute may not),
  // and how close to the train a blast hurts the train too
  he: { reload: 2.4, travel: 0.7, kill: 34, hurt: 56, close: 28 },
  // The global living limit. Individual leg populations and enemy introductions are in legs.js.
  pop: { max: 1100 },
  // Seconds before a grabbed survivor is lost, for the retained full-game survivor helpers.
  station: { grab: 1.4 },
  // Share of each zombie's scrap value paid now; fractions wait in the kill pot. (proposal)
  pay: { kill: 1 },
  // Dead Wall health, rail placement/standoff, collectible scrap, warning/clearance and crash bodies. (proposal)
  wall: { hp: 75, ahead: 180, stop: 20, loot: 40, warn: 300, len: 48, goalPad: 40, bodies: 6,
    half: 34, depthY: 29 // Cached actor's ground feet span x7..71 and y17..46, behind its face. (proposal)
  },
  // bought in the skill tree. The rail cannon (cannon.js): seconds to reload, seconds each GUN SPEED
  // level takes off, px either side of its line that it kills, how fast its barrel turns (radians/s).
  gun: { reload: 4, fast: 0.5, hw: 5, turn: 7 },
  // The Turbo Ram: top speed (px/s), seconds at it, seconds to get up to it and to ease back, the
  // hit zone (px either side of the rail middle, px behind and ahead of the nose), cooldown seconds,
  // the next stop nearer than noStart px = it can't start, nearer than cut px = it ends
  // (250 and 200 m), px the camera leads, and its kills pay ×pay.
  ram: { speed: 120, dur: 2, cooldown: 20, rise: 0.4, ease: 1, band: 16, back: 10, front: 8, noStart: 500, cut: 400,
    lead: 40, pay: 2,
    damage: 3, bandGrowth: 6, shove: 70, clearance: 3, shockR: 40, shockT: 0.35 // (proposal)
  },
  // Seconds the built-in winch needs over a survivor: about 2 s. (proposal)
  winch: { hover: 2 },
  // dps = damage to the train each second while it holds on
  types: [
    { hp: 2, speed: [15, 20], value: 1, dps: 0.25 },               // walker: 2 base gun hits (proposal)
    { hp: 1, speed: [42, 52], value: 1, dps: 0.3, run: true },     // runner
    { hp: 6, speed: [10, 13], value: 5, dps: 2, big: true }        // brute
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
// DEPOT_S = the original rail origin at y = 0. Stop coordinates use this fixed origin even when
// the intro departure is brought closer to Millbrook; later stations keep their world positions.
const DEPOT_S = trackS(0);
const sAtKm = (k) => DEPOT_S - k * CFG.line.km;
const kmAt = (s) => (DEPOT_S - s) / CFG.line.km;
// DK() = how far the engine's nose is from the Depot, in km
const DK = () => kmAt(G.tr.s);
// The y on the ground where the distance along the rails is s, from any distance away.
const yOfS = (s) => yAtS(s, yAtS(s, s / 1.0354));

// ---------- what the skill tree changes
// Each number at level l of its node. The game reads them through G.up (set when a run starts) and
// the skill tree's info box shows the very same numbers, so the two always agree.
const UP = {
  hp: (l) => CFG.train.hp * (1 + 0.15 * l),
  pickup: (l) => CFG.heli.pickup * (1 + 0.25 * l)
};
// This run's numbers from the skill tree (they cannot change during a run). The demo behind the
// menus uses base upgrades with Rockets, the MG Car and Turbo Ram enabled for its battle.
// The winch is built in. he and ram are weapons; gun is the rail cannon's reload (0 = none).
// One Viper flies, including in the demo.
// salvage is the extra share of every scrap reward; treeUp reads the crew's level.
function runUp(demo) {
  const L = demo ? () => 0 : lv;
  // (tree.js adds the newer nodes' numbers: treeUp)
  const up = treeUp(L, {
    hp: UP.hp(L('armor')), rate: CFG.mg.rate, dmg: 1,
    he: false, reload: CFG.he.reload, fly: CFG.heli.speed, pickup: UP.pickup(L('magnet')),
    helis: 1,
    winch: true, gun: 0, ram: demo || L('ram') > 0,
    // The full-game plow stays disabled; armor still dresses the engine.
    cow: false, armor: L('armor')
  });
  if (demo) Object.assign(up, { rocketChance: UP.rockets(1), mgCar: true });
  return up;
}
// Finds and gold alternatives share lootAcc; wall piles use their own pot for exact source totals.
// Apply Salvage Crew once here; bankRun only stores the whole scrap already paid.
function payLootScrap(base, source = 'loot') {
  if (!(base > 0)) return 0;
  source = source === 'wall' ? 'wall' : 'loot';
  const pot = source === 'wall' ? 'wallAcc' : 'lootAcc';
  G.earnedBase[source] += base;
  G.earnedCounts[source]++;
  G[pot] += base * (1 + G.up.salvage);
  const pay = Math.floor(G[pot] + 1e-9);
  G[pot] = Math.max(0, G[pot] - pay);
  G.earnedSources[source] += pay;
  G.cash += pay;
  G.pay.loot += pay;
  if (pay) G.cashPulse = 1;
  return pay;
}
// Scrap pops keep their old small/large size, plus one size when Salvage Crew is active.
function scrapPopScale(big) {
  return (big ? 2 : 1) + (G.up.salvage > 0 ? 1 : 0);
}

// ---------- a run
// demo = the battle behind the menus. A real ride starts 60 rail px after its departure stop.
function newGame(demo, number, replay) {
  const leg = demo ? null : legDef(number);
  const yd = Math.round(rnd(-40000, 40000));
  const s0 = demo ? trackS(yd) : stopRailS(leg.from) - 60;
  const y0 = demo ? yd : yOfS(s0), up = runUp(demo), hp = up.hp;
  const cars = [];
  for (let k = 0; k < CAR.n; k++) cars.push({ x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, dx: 0, dy: -1, nx: 1, ny: 0, ang: 0, k: 0 });
  G = {
    demo: !!demo, leg: leg ? leg.n : 0, replay: !!replay, eventIndex: 0, events: [], t: 0, run: 0, endT: 0, result: '', up,
    // Ordinary kill pay is fixed for this leg. Raw source bases exclude its factor and Salvage.
    killPay: Number.isFinite(leg?.ordinaryPay) ? Math.max(0, leg.ordinaryPay) : 1,
    earnedSources: { ordinary: 0, silver: 0, loot: 0, wall: 0 },
    earnedBase: { ordinary: 0, silver: 0, loot: 0, wall: 0 },
    earnedCounts: { ordinaryKills: 0, silverKills: 0, ramKills: 0, loot: 0, wall: 0 },
    kills: 0, cash: 0, gold: 0, shownCash: 0, cashPulse: 0, killBump: 0, shots: 0, hits: 0, bestBlast: 0,
    heReload: 0, heQueue: false,
    // the train: s = distance along the rails of the engine's nose (it falls as the train runs north),
    // v = speed, hp / max = its health now and when whole, hit[k] = car k flashes red, fx / fy = the
    // nose on the ground
    tr: { s: s0, startS: s0, v: CFG.train.cruise, hp, max: hp, hpShown: hp, hit: [0, 0, 0, 0, 0],
      clack: 0, smokeT: 0, hornT: 0, fx: trackX(y0), fy: y0, cars },
    // the helicopters (helis.js)
    helis: [],
    goalS: demo ? -1e12 : stopRailS(leg.to), goalY: -1e9,
    // the stops on this run (the Depot and the stations ahead), the stations alone, the one the
    // train goes to next (or stands at), and the Dead Walls ahead
    stops: [], stations: [], station: null, walls: [], wall: null, safeZone: false, finale: null, ambush: null,
    camX: 0, camY: 0, aimSX: W / 2, aimSY: VH / 2,
    zombies: [], bodies: [], rounds: [], timers: [], statics: [], people: [],
    // Each source carries its own fraction, so silver and wall rewards never inherit ordinary pay.
    spawnCd: 0, waveCd: null, waves: 0, killAcc: 0, silverAcc: 0, lootAcc: 0, wallAcc: 0,
    railCd: rnd(4, 6), onTrain: 0, blocked: false, decalT: 0, sum: null,
    // this run's scrap sources, survivors aboard, furthest km and money already banked
    pay: { kills: 0, loot: 0 }, surv: 0, maxKm: 0, banked: { scrap: 0, surv: 0, gold: 0 },
    bot: false, botT: 0, botZ: null, hurt: { crush: 0, claw: 0, shell: 0 },
    // the rail cannon on the flatcar (cannon.js)
    gun: newCannon(),
    // the Turbo Ram: on = running, t = seconds since it started, dur = its seconds at top speed,
    // cd / cooldown = seconds left and its activation snapshot, kills / pay = this Ram's,
    // card = its card shows, flash = when it became ready, msg = a line over its card, pop = scrap of
    // its kills not yet shown (popT = when the last +N popped)
    ram: { on: false, t: 0, dur: up.ramDuration || CFG.ram.dur, cd: 0, cooldown: up.ramCooldown || CFG.ram.cooldown,
      band: CFG.ram.band + ((up.ramDuration || CFG.ram.dur) - CFG.ram.dur) * CFG.ram.bandGrowth,
      damage: CFG.ram.damage * (up.ramPower || 1), hits: 0, shocks: 0, shockKills: 0, lastShock: null,
      kills: 0, pay: 0, card: up.ram, hissed: false, flash: -9, killT: -9, msg: null,
      uses: 0, total: 0, pop: 0, popT: -9 },
    // the dead on the rails within 130 m ahead; px the camera is moved by (camLead)
    railAhead: 0, lead: [0, 0]
  };
  RADIO.q.length = 0;
  RADIO.cur = null;
  RAMCARD.on = false;
  SFX.ramStop(0.1);
  clearFX();
  clearBurn();
  clearStreams();
  GRID.clear();
  layoutTrain();
  makeHelis();
  if (!demo) {
    G.goalY = yOfS(G.goalS);
    G.maxKm = DK();
    buildLine(leg);
    if (leg.td) initAmbush();
    if (leg.finale) {
      G.finale = { phase: 'approach', stopS: G.goalS + FINALEC.stop, holdAt: null, elapsed: 0,
        openAt: null, eventIndex: 0, gifted: false, giftAt: null, giftUsed: false, arrivedAt: null, gateProps: [] };
      G.station.stopS = G.finale.stopS;
      buildSafeZone();
    }
    rollLoot();
  }
  placeCamera();
  if (!G.ambush) scatter(leg && leg.from !== DEPOT ? leg.from : null);
}
// Start the next leg, or a selected old leg. Replays cannot advance the route again.
function startGame(number, replay) {
  audioInit();
  number = Number.isInteger(number) ? clamp(number, 1, 12) : Math.min(SAVE.leg, 12);
  replay = !!replay || !!(SAVE.legs[number] && SAVE.legs[number].won);
  SAVE.runs++;
  saveSave();
  newGame(false, number, replay);
  mode = 'play';
  resetPlaySpeed();
  syncViewHeight();
  placeCamera();
  paused = false;
  const st = G.station;
  banner('LEG ' + number + ': ' + st.name, replay ? 'REPLAY: SCRAP ONLY' : 'ESCORT THE TRAIN TO THE NEXT STATION', U.gold);
  SFX.horn();
  if (typeof tutEvent === 'function') tutEvent('run_start');
}
// Put what this run has earned so far in the save. You keep it all, whatever happens to the train.
function bankRun() {
  if (!G || G.demo) return;
  const sc = Math.floor(G.cash) - G.banked.scrap, sv = G.surv - G.banked.surv, gd = G.gold - G.banked.gold;
  SAVE.scrap += sc;
  SAVE.surv += sv;
  SAVE.gold += gd;
  G.banked.scrap += sc;
  G.banked.surv += sv;
  G.banked.gold += gd;
  saveSave();
}
// The run is over: bank it and build the summary (drawn by drawSummary).
function endGame() {
  mode = 'summary';
  sumStart = realT;
  // a mouse press from the run must not click TO THE DEPOT when it is let go
  M.px = M.py = -1e4;
  // where the run ended (the train may roll on a little after it is lost; that does not count)
  const k = G.maxKm;
  bankRun();
  G.sum = {
    leg: G.leg, destination: legDef(G.leg).to.name, replay: G.replay,
    stars: (SAVE.legs[G.leg]?.stars || [false, false, false]).slice(), hasStars: G.leg >= 3,
    result: G.result, kills: G.kills, pay: Object.assign({}, G.pay),
    scrap: Math.floor(G.cash), surv: G.surv, gold: G.gold,
    near: nearMiss(k), wall: wallStop(k), sounds: 0
  };
}
// "Mill Town was 380 m away!": the next station, when the train was lost on the way to it.
function nearMiss(k) {
  if (G.result !== 'lost') return '';
  const st = G.stations.find((s) => s.state === 'ahead' || s.state === 'braking');
  if (!st) return '';
  const m = kmAt(st.stopS) - k;
  return st.name + ' WAS ' + fmt(Math.max(10, Math.round(m * 100) * 10)) + ' M AWAY!';
}
// A loss at the blocking wall, or after a costly wall fight, names the obstacle and its remedies.
function wallStop(k) {
  if (G.result !== 'lost') return [];
  let w = G.walls.find((x) => !x.broken && k > x.km - 0.04 && k < x.km + 0.03), say = 'THE DEAD WALL STOPPED YOU.';
  if (!w) {
    w = G.walls.filter((x) => x.hpOut != null && x.km < k).pop();
    if (!w || w.hpIn - w.hpOut < G.tr.max * 0.25 || G.stations.some((st) => kmAt(st.s) > w.km && kmAt(st.s) < k)) return [];
    say = 'THE DEAD WALL COST THE TRAIN ' + Math.round(w.hpIn - w.hpOut) + ' HP.';
  }
  const tip = !G.up.ram ? 'UPGRADE YOUR WEAPONS OR ADD TURBO RAM.' : w.rammed ? 'MORE ARMOR WOULD GET YOU THROUGH.'
    : ramState() === 'ready' ? 'RAM THE WALL TO BREAK THROUGH!' : 'SAVE YOUR TURBO RAM FOR IT.';
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
  if (G.safeZone) return;
  G.safeZone = true;
  const y = Math.round(G.goalY), gx = Math.round(trackX(G.goalY)), st = G.statics;
  for (let x = gx - 640; x <= gx + 640; x += 16) {
    if (Math.abs(x - gx) < 26) continue;
    st.push({ d: SAFE.blocks[mod(x >> 4, SAFE.blocks.length)], x, y, k: y });
  }
  for (const s of [-1, 1]) {
    st.push({ d: SAFE.pillar, x: gx + s * 20, y: y + 1, k: y + 1 });
    st.push({ d: SAFE.tower, x: gx + s * 50, y: y - 4, k: y - 4, tower: s });
  }
  if (G.finale) for (const side of [-1, 1]) {
    const p = { d: SAFE.blocks[side < 0 ? 0 : 1], x: gx + side * SAFE.blocks[0].spr.width / 2, y, k: y };
    st.push(p); G.finale.gateProps.push(p);
  }
}
// The closed gate is a route stop, not a damageable wall. Fighting remains live during the hold.
function beginFinaleHold() {
  const f = G.finale;
  if (!f || f.phase !== 'approach' || G.result || G.demo) return false;
  G.tr.s = f.stopS; G.tr.v = 0;
  layoutTrain();
  f.phase = 'hold'; f.holdAt = G.run; f.elapsed = 0;
  banner('HOLD THE GATE!', 'THE TERMINUS GATE IS CLOSED.', U.amber);
  return true;
}
function openFinaleGate() {
  const f = G.finale;
  if (!f || f.phase !== 'hold' || G.result || G.demo) return false;
  f.phase = 'open'; f.openAt = G.run; f.elapsed = FINALEC.hold;
  for (const p of f.gateProps) {
    const i = G.statics.indexOf(p);
    if (i >= 0) G.statics.splice(i, 1);
  }
  f.gateProps.length = 0;
  G.station.stopS = G.goalS;
  banner('GATE OPEN!', 'ROLL INTO THE TERMINUS.', U.gold);
  SFX.horn();
  return true;
}
// Arrival wins this leg. The station guards clear the climbers while the short summary opens.
function arrive() {
  if (G.demo || G.result) return;
  if (G.ambush && G.ambush.phase !== 'done') return;
  if (G.finale && G.finale.phase !== 'open') return;
  if (G.finale) { G.finale.phase = 'done'; G.finale.arrivedAt = G.run; }
  if (G.leg === 12 && !G.replay) rescueCamp();
  // Arrival rewards must bank while the leg is still live; won legs cannot earn missed stars.
  if (G.leg >= 3) {
    earnLegStar(0);
    if (G.tr.hp >= G.tr.max * 0.75) earnLegStar(1);
  }
  G.result = 'won';
  G.tr.v = 0;
  G.tr.s = G.goalS;
  layoutTrain();
  if (!G.replay) {
    legSave(G.leg).won = true;
    SAVE.leg = Math.max(SAVE.leg, G.leg + 1);
    saveSave();
  }
  mode = 'ending';
  G.endT = 0;
  banner('LEG WON!', G.station.name, U.gold, 3);
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
  banner('TRAIN LOST', 'YOU KEEP ALL YOUR SCRAP. RETRY THIS LEG.', U.red, 9);
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
  return variantRoll({
    x, y, type, S: sets[(Math.random() * sets.length) | 0], hp: T.hp, max: T.hp, value: T.value, run: !!T.run, big: !!T.big,
    sp: rnd(T.speed[0], T.speed[1]), dps: T.dps, wob: rnd(TAU), anim: rnd(2), left: Math.random() < 0.5,
    vx: 0, vy: 0, kbx: 0, kby: 0, flash: 0, pending: 0, block: [], blockT: rnd(0.5), dead: false, gone: false, qd: 0, k: y,
    // st: 0 walking, 1 on the rails ahead of the train, 2 holding on to the train
    st: 0, rx: rnd(-3, 3), side: 0, car: 0, al: 0, ox: 0, bang: 0, dmg: 0
  });
}
// The per-leg horde (HORDE), the streams and waves that bring the dead in (spawn) and their
// step (updateZombies) are in horde.js.
// true when (x, y) is out of the camera's view by more than m px
const offView = (x, y, m) => x < G.camX - m || x > G.camX + W + m || y < G.camY - m || y > G.camY + VH + m;
// One of the dead standing on the rails at s, u px right of the rail middle.
function railZombie(s, u, type) {
  const y = yOfS(s), z = makeZombie(trackX(y) + u, y, type);
  z.st = 1;
  z.rx = u;
  G.zombies.push(z);
  return z;
}
// A crowd standing on the rails ahead of the train, out of view (never in a Dead Wall's last 150 m).
function railGroup(n, params = {}) {
  for (let i = 0; i < 4; i++) {
    const s = G.tr.s - rnd(230, 380) - i * 90, y = yAtS(s, G.tr.fy + (s - G.tr.s));
    if (y < G.goalY + 60) return;
    if (!offView(trackX(y), y, 16) || wallZone(s)) continue;
    for (let k = 0; k < n; k++) {
      const yy = y - k * rnd(2.5, 6), z = newDead(trackX(yy) + rnd(-4, 4), yy, pickSpawnType(true, params, k));
      z.st = 1;
      z.rx = z.x - trackX(yy);
      G.zombies.push(z);
    }
    return;
  }
}
// The start: six packs in a run, twelve behind the menus, and five on the rails at the Depot.
// Opening packs enter Viper's protection on opposing sides before the train passes them.
// at = the station a run starts at.
function scatter(at) {
  const early = openingHorde(), opening = OPENING_HORDE;
  for (let k = 0, n = G.demo ? 12 : 6; k < n; k++) {
    const lead = rnd(-40, 300), ahead = early ? opening.packLead[k] : lead;
    const s = G.tr.s - ahead, y = yAtS(s, G.tr.fy + (s - G.tr.s)), count = rndi(10, 22);
    const side = Math.random() < 0.5 ? -1 : 1, direction = early && k < 2 ? (k ? 1 : -1) : side;
    const off = early ? rnd(opening.packOff[0], opening.packOff[1]) : rnd(70, W / 2);
    pack(count, trackX(y) + direction * off, y, early ? opening.packRadius : Infinity);
  }
  if (at) return;
  for (let k = 0; k < 5; k++) railZombie(G.tr.s - 110 - k * 6, rnd(-3, 3), 0);
}
// ---------- Dead Walls
// The timeline creates a composite wall with one health pool. Its weapon target is outside the
// zombie grid, movement, spacing and kill rewards, at the actual rail face.
function addDeadWall(params = {}, eventId = '') {
  if (!G || G.demo || G.result || mode !== 'play') return null;
  const id = String(params.id || eventId || 'leg-' + G.leg + '-wall'), old = G.walls.find((w) => w.id === id);
  if (old) return old;
  const c = CFG.wall, ahead = Number.isFinite(params.ahead) ? Math.max(c.stop, params.ahead) : c.ahead;
  const s = Math.max(G.goalS + c.goalPad, G.tr.s - ahead);
  if (G.tr.s - s < c.stop - 1e-9) return null;
  const y = yOfS(s), x = railX(y), hp = Number.isFinite(params.hp) && params.hp > 0 ? params.hp : c.hp;
  const w = { id, eventId: eventId || id, leg: G.leg, s, km: kmAt(s), x, y, stopS: s + c.stop,
    hp, max: hp, placed: true, warned: true, awake: true, broken: false, state: 'ahead', flash: 0,
    spawnT: G.run, stoppedAt: null, brokenAt: null, rammed: false, hpIn: null, hpOut: null,
    lootId: null, hits: 0, damage: 0, lastHit: null };
  const a = DEADWALLART;
  w.target = { wall: w, x, y, type: -1, big: true, run: false, st: 1, still: false, gate: false,
    dead: false, gone: false, pending: 0, paid: 0, value: 0, flash: 0, vx: 0, vy: 0, kbx: 0, kby: 0,
    qd: 0, k: y, S: { w: a.w, h: a.height, ax: a.ax, ay: a.ay, walk: [{ n: a.n }] } };
  Object.defineProperties(w.target, {
    hp: { get: () => w.hp, set: (v) => { w.hp = v; }, enumerable: true },
    max: { get: () => w.max, enumerable: true }
  });
  G.walls.push(w); G.wall = w;
  legEventNotice('DEAD WALL', U.red); SFX.warn();
  return w;
}
function blockingWall() {
  if (!G || G.demo) return null;
  let best = null;
  for (const w of G.walls) if (!w.broken && G.tr.s - w.s >= -CFG.wall.len && (!best || w.s > best.s)) best = w;
  return best;
}
// Blast circles intersect the packed ground body, extending only behind the aiming face.
function wallDistance(x, y, w) {
  const dx = Math.max(0, Math.abs(x - w.x) - CFG.wall.half);
  const dy = y - clamp(y, w.y - CFG.wall.depthY, w.y);
  return Math.hypot(dx, dy / FORE);
}
// Right-click uses the cached actor's real screen bounds.
function wallAt(sx, sy) {
  const x = G.camX + sx, y = G.camY + sy, a = DEADWALLART;
  for (const w of G.walls) if (!w.broken && x >= w.x - a.ax && x < w.x - a.ax + a.w &&
    y >= w.y - a.ay && y < w.y - a.ay + a.height) return w.target;
  return null;
}
function wallZone(s) {
  for (const w of G.walls) if (!w.broken && s <= w.s + CFG.wall.warn && s >= w.s - CFG.wall.len) return true;
  return false;
}
function wallAhead(d) {
  for (const w of G.walls) if (!w.broken && G.tr.s - w.s < d && G.tr.s - w.s > -CFG.wall.len) return true;
  return false;
}
function damageWall(w, damage, cause = 'mg') {
  if (!w || w.broken || !(damage > 0) || !Number.isFinite(damage)) return false;
  const paid = Math.min(w.hp, damage);
  w.hp = Math.max(0, w.hp - damage); w.flash = w.target.flash = 0.12;
  w.hits++; w.damage += paid; w.lastHit = { damage: paid, cause, t: G.run };
  if (w.hp <= 0) { breakWall(w, cause); return true; }
  SFX.hit();
  return false;
}
// Rewards remain in a collectible pile; the crash bodies and wreck chunks are cosmetic.
function breakWall(w, cause = 'mg') {
  if (!w || w.broken) return false;
  w.broken = true; w.state = 'broken'; w.hp = 0; w.brokenAt = G.run; w.hpOut = G.tr.hp;
  w.cause = cause; w.rammed = cause === 'ram'; w.target.dead = w.target.gone = true;
  w.target.pending = 0; w.target.paid = 0;
  const wallPay = legDef(G.leg)?.wallPay;
  const f = addFind('pile', w.km, 0, 1, Number.isFinite(wallPay) ? Math.max(0, wallPay) : CFG.wall.loot);
  f.scrapSource = 'wall';
  f.eventId = w.id + '-scrap'; w.lootId = f.eventId;
  boomFx(w.x, w.y, true);
  for (let i = 0; i < CFG.wall.bodies && G.bodies.length < 160; i++) {
    const S = ZS[0][i % ZS[0].length], a = i / CFG.wall.bodies * TAU, v = rnd(45, 100);
    G.bodies.push({ S, x: w.x + Math.cos(a) * 12, y: w.y + Math.sin(a) * 8 * FORE, z: 3,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * FORE, vz: rnd(90, 170), spin: rnd(8, 16), rot: 0, fall: false, age: 0 });
  }
  addShake(0.75); hitStop(0.06, 0.25); SFX.boom();
  return true;
}
function stopAtWall(w) {
  if (w.state !== 'stopped') { w.stoppedAt = G.run; w.hpIn = G.tr.hp; }
  w.state = 'stopped'; G.tr.s = w.stopS; G.tr.v = 0; layoutTrain();
}
function updateWalls(dt) {
  const tr = G.tr;
  for (const w of G.walls) {
    w.flash = Math.max(0, w.flash - dt); w.target.flash = w.flash;
    if (w.broken || G.result) continue;
    const d = tr.s - w.s;
    if (ramPowered()) {
      if (w.state === 'stopped' || d <= CFG.ram.front) breakWall(w, 'ram');
      continue;
    }
    const remaining = tr.s - w.stopS;
    if (w.state === 'ahead' && remaining < tr.v * tr.v / (2 * CFG.train.brake) + 1) w.state = 'braking';
    if ((w.state === 'braking' || w.state === 'stopped') && remaining < 0.6) stopAtWall(w);
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
  for (const w of G.walls) if (!w.broken) {
    const d = wallDistance(x, y, w);
    if (d <= R) fn(w.target, d);
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
  if (ramPowered()) {
    ramHit(z);
    return;
  }
  if (G.up.cow && !z.big) {
    plow(z);
    return;
  }
  const tr = G.tr, c = tr.cars[0], dmg = z.big ? CFG.train.crushBig : CFG.train.crush;
  tr.v *= z.big ? 0.5 : 0.9;
  kill(z, 'train', 0, 0, 0);
  // (a walker costs less than 1 HP: the red -N over the nose shows the whole points)
  G.crushAcc = (G.crushAcc || 0) + dmg;
  const shown = Math.floor(G.crushAcc + 1e-9);
  G.crushAcc -= shown;
  if (!G.demo && !G.result && shown) addTotal(c.x0, c.y0 - 12, shown, U.red, z.big, true);
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

// The view: it follows the train, and is moved on by G.lead (camLead).
function placeCamera() {
  camBase(CB);
  G.camX = Math.round(CB[0] + G.lead[0] - W / 2);
  G.camY = Math.round(CB[1] + G.lead[1] - VH / 2);
}
// the middle of the view before the lead: ahead of the train's middle car, so the train sits a
// little below the middle and you see what comes (behind the menus it stands right of the menu)
const CB = [0, 0];
function camBase(o) {
  const c = G.tr.cars[2], f = G.tr.cars[0], a = VH * 0.12, off = G.demo && W >= 560 ? W * 0.22 : 0;
  o[0] = c.cx + f.dx * a - off;
  o[1] = c.cy + f.dy * a;
  return o;
}
// G.lead = px the view glides up the line while the Turbo Ram runs.
function camLead(dt) {
  const L = G.lead, c = G.tr.cars[0], k = 1 - Math.exp(-3 * dt);
  let tx = 0, ty = 0;
  if (G.ram.on) {
    tx = c.dx * CFG.ram.lead;
    ty = c.dy * CFG.ram.lead;
  }
  L[0] += (tx - L[0]) * k;
  L[1] += (ty - L[1]) * k;
}
// chunks in view: [first column, first row, last column, last row]
function viewChunks() {
  return [Math.floor(G.camX / CH), Math.floor(G.camY / CH), Math.floor((G.camX + W) / CH), Math.floor((G.camY + VH) / CH)];
}

// ---------- the guns
// A 105mm shell from heli h at (tx, ty) (heFire in helis.js leads it to where the crowd will be).
function fireHE(player, tx, ty, h) {
  const [ox, oy] = turnXY(h.hd, -11, -8);
  G.rounds.push({ kind: 'he', bx: tx, by: ty, tgt: null, age: 0, T: CFG.he.travel, side: -1, j: 0, player, h, sx: h.x + ox, sy: h.y + oy, sz: h.alt + 3 });
  heliRecoil(h);
  if (player) {
    h.heR = G.up.reload;
    addShake(0.45);
    kick(rnd(-1, 1), 2.5);
    SFX.cannon();
    SFX.whistle(CFG.he.travel);
  }
}
// Retained for the full game: selected helis (or all) fire a 105 at the mouse when owned.
// The demo has no 105 unlock and no keyboard binding for this helper.
function tryHE() {
  if (mode !== 'play' || paused || !G.up.he) return;
  heFire(G.camX + G.aimSX, G.camY + G.aimSY);
}
function updateRounds(dt) {
  const rs = G.rounds;
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    r.age += dt;
    if (r.kind === 'rocket') updateRocket(r, dt);
    else if (r.kind === 'hellfire') updateHellfireRound(r, dt);
    if (r.age < r.T) continue;
    rs[i] = rs[rs.length - 1];
    rs.pop();
    if (r.kind === 'he') explode(r.bx, r.by, r.player);
    else if (r.kind === 'rocket') rocketImpact(r);
    else if (r.kind === 'hellfire') hellfireImpact(r);
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
// Space or its card: a two-second powered charge, then the existing one-second ease. Its clock
// starts at activation, and kills do not change it. Brutes take one shove and hit per charge.
// States: 'none', 'lock', 'on', 'stop', 'cooldown' or 'ready'.
function ramState() {
  const r = G.ram;
  if (r.on) return 'on';
  if (!G.up.ram) return r.card ? 'lock' : 'none';
  if (G.result || nearStop(CFG.ram.noStart)) return 'stop';
  return r.cd > 0 ? 'cooldown' : 'ready';
}
// The filling clock, and the short phase that actually damages the dead.
const ramProgress = () => clamp(1 - G.ram.cd / G.ram.cooldown, 0, 1);
const ramPowered = () => G.ram.on && G.ram.t < G.ram.dur - 1e-9 && !G.result;
// true while the train brakes for a station or stands at one, or the next one is less than d px ahead
function nearStop(d) {
  const st = G.station;
  if (!st || st.state === 'done') return false;
  return st.state !== 'ahead' || G.tr.s - st.stopS < d;
}
// One beep and a gold card flash when the cooldown crosses zero.
function ramFull() {
  if (!G.up.ram || G.demo || G.result) return;
  G.ram.flash = realT;
  SFX.ramReady();
}
// Space or the card. bot = the autopilot (it is not told no). True when the Ram starts.
function tryRam(bot) {
  if (G.result || !(mode === 'play' || G.demo)) return false;
  if (G.ambush?.phase === 'hold') return false;
  const s = ramState(), r = G.ram;
  if (s === 'ready') {
    ramStart();
    return true;
  }
  if (bot || G.demo || s === 'on' || s === 'none') return false;
  // say why not, over the card
  const st = G.station, m = st ? Math.max(0, Math.round((G.tr.s - st.stopS) / 20) * 10) : 0;
  r.msg = { t: realT, s: s === 'lock' ? 'BUY TURBO RAM IN THE SKILL TREE.'
    : s === 'stop' ? (st && st.state === 'ahead' ? 'STATION IN ' + m + ' M. NO RAM UNDER ' + CFG.ram.noStart / 2 + ' M.' : 'NO RAM AT A STATION.')
      : 'READY IN ' + Math.ceil(r.cd) + ' S.' };
  SFX.deny();
  return false;
}
function ramStart() {
  const r = G.ram, tr = G.tr, c = tr.cars[0];
  Object.assign(r, { on: true, t: 0, dur: G.up.ramDuration || CFG.ram.dur,
    cooldown: G.up.ramCooldown || CFG.ram.cooldown,
    band: CFG.ram.band + ((G.up.ramDuration || CFG.ram.dur) - CFG.ram.dur) * CFG.ram.bandGrowth,
    damage: CFG.ram.damage * (G.up.ramPower || 1), kills: 0, pay: 0, hissed: false, card: true,
    pop: 0, popT: -9 });
  r.cd = r.cooldown;
  r.uses++;
  const wall = blockingWall();
  if (wall && (wall.state === 'stopped' || G.tr.s - wall.stopS <= 0.6 && tr.v < 1)) breakWall(wall, 'ram');
  // The nose is cleared immediately; a surviving brute is pushed off it.
  for (const z of G.zombies) if (!z.dead && z.st === 2 && z.side === 0) ramHit(z);
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
// The scrap of the Ram's kills not shown yet pops off the engine's nose as one blue +N, thrown out
// to the left (the kill count is on the right). One each 0.2 s at most: the train leaves them
// behind in a neat line, never on top of each other.
const RAM_POP = 0.2;
function popRam() {
  const r = G.ram, c = G.tr.cars[0], v = '+' + r.pop;
  if (!r.pop) return;
  floatText(c.x0 - 6, c.y0 - 6, v, U.blue);
  const t = texts[texts.length - 1];
  if (t && t.v === v) {
    t.s = scrapPopScale(false);
    t.vx = -rnd(42, 58);
    t.vz = rnd(20, 28);
    t.life = t.max = 0.6;
  }
  r.pop = 0;
  r.popT = G.t;
}
// The Ram kills z: twice the scrap, a crunch that climbs with the count, a small shake.
function ramKill(z) {
  if (z.dead || z.gone) return;
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
// Walkers and runners die immediately. A brute takes one damage hit per use, then moves aside.
function ramHit(z) {
  const r = G.ram, c = G.tr.cars[0], C = CFG.ram;
  if (!ramPowered() || z.dead || z.gone || z.ramUse === r.uses) return;
  z.ramUse = r.uses; r.hits++;
  if (!z.big || z.hp <= r.damage) { ramKill(z); return; }
  JUICE.from = [c.x0, c.y0];
  hitZombie(z, r.damage, 'ram');
  JUICE.from = null;
  const u = (z.x - c.x0) * c.nx + (z.y - c.y0) * c.ny, side = Math.sign(u) || (z.left ? -1 : 1);
  const push = Math.max(0, r.band + C.clearance - Math.abs(u));
  z.st = 0; z.x += c.nx * side * push; z.y += c.ny * side * push; z.k = z.y;
  z.kbx += c.nx * side * C.shove; z.kby += c.ny * side * C.shove;
  if (!G.demo) { addShake(0.12); SFX.crunch(r.kills); }
}
// Each step of the Ram: its time, the station rule, the hiss as it eases off, the end.
function updateRam(dt) {
  const r = G.ram;
  if (r.cd > 0) {
    r.cd = Math.max(0, r.cd - dt);
    if (r.cd < 1e-9) { r.cd = 0; ramFull(); }
  }
  if (!r.on) return;
  if (G.result) {
    r.on = false;
    if (!G.demo) SFX.ramStop(0.4);
    return;
  }
  r.t += dt;
  // a station ahead: it ends now, so the train can brake in time
  if (nearStop(CFG.ram.cut)) {
    ramEnd(true);
    return;
  }
  if (r.t >= r.dur - 1e-9 && !r.hissed) {
    r.hissed = true;
    if (!G.demo) SFX.hiss();
  }
  // (scrap from the last kills, waiting for its turn to pop)
  if (r.pop && G.t - r.popT >= RAM_POP) popRam();
  if (r.t >= r.dur + CFG.ram.ease - 1e-9) {
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
  juiceRamFx();
}
// The Ram is over (cut = a station is near: BRAKES!). Show its rank and what it paid.
function ramEnd(cut) {
  const r = G.ram, c = G.tr.cars[0], n = r.kills;
  if (!r.on) return;
  r.on = false;
  if (G.up.shockwave && G.result !== 'lost') ramShock();
  if (G.demo) return;
  popRam();
  SFX.ramStop(cut ? 0.3 : 0.4);
  if (cut) {
    floatText(c.x0, c.y0 - 16, 'BRAKES!', U.amber);
    if (!r.hissed) SFX.hiss();
  }
  if (n >= 5) {
    const [name, col] = n >= 30 ? ['UNSTOPPABLE', '#ff7a4a'] : n >= 15 ? ['RAMPAGE', U.amber] : ['SMASH', U.gold];
    banner(name + ' ×' + n, '+' + r.pay + ' SCRAP', col, 3);
    SFX.rank(n);
  }
}

// An end shockwave hits zombies only, at the engine's actual nose, including a station cut.
function ramShock() {
  const r = G.ram, c = G.tr.cars[0], C = CFG.ram, x = c.x0, y = c.y0;
  let hits = 0, kills = 0;
  queryEll(x, y, C.shockR, (z, d) => {
    if (z.gone || z.gate && z.still) return;
    hits++;
    if (z.hp <= r.damage) { kill(z, 'he', x, y, d); kills++; }
    else { JUICE.from = [x, y]; hitZombie(z, r.damage, 'boom'); JUICE.from = null; }
  });
  r.shocks++; r.shockKills += kills;
  r.lastShock = { x, y, radius: C.shockR, damage: r.damage, hits, kills, t: G.t };
  rings.push({ x, y, r0: 4, r1: C.shockR, t: 0, T: C.shockT, c: '#fff1c2', w: 2, source: 'ramShock' });
  rocketBlast(x, y);
  if (!G.demo) SFX.ramShock();
}

// ---------- hits and kills
// Blood drops thrown away from the gun (up the screen) and to the sides; they stay on the ground.
function blood(x, y, n, zh) {
  for (let k = 0; k < n; k++) part({ x: x + rnd(-1, 1), y, z: rnd(3, zh), vx: rnd(-35, 35), vy: rnd(-45, 12), vz: rnd(15, 70),
    g: 240, life: 1.4, max: 1.4, s: 1, c: pick([P.bl0, P.bl1, P.bl2, P.bl2]), land: 1 });
}
// cause = 'mg' (a heli's nose gun round), 'gun' (the flatcar gun), 'he' (the 105 at (cx, cy), dist away),
// 'train' (run down) or 'ram' (the Turbo Ram). free = not the player's kill (no score).
function kill(z, cause, cx, cy, dist, free) {
  if (z.wall) { breakWall(z.wall, cause); return; }
  if (z.dead) return;
  z.dead = true;
  z.hp = 0;
  z.paid = 0;
  const sc = scoring() && !free, S = z.S, bs = G.bodies, room = bs.length < 160, ram = cause === 'ram';
  // Ordinary kills retain the Ram bonus and the leg's fractional pay. Silver remains worth 15,
  // boosted only by Salvage. Whole scrap pays now; each source keeps its own fraction.
  let pay = 0;
  if (sc) {
    const source = z.silver ? 'silver' : 'ordinary', pot = z.silver ? 'silverAcc' : 'killAcc';
    const base = z.silver ? SILVER_PAY : z.value * (ram ? CFG.ram.pay : 1) * CFG.pay.kill;
    G.earnedBase[source] += base;
    if (!z.gold) G.earnedCounts[z.silver ? 'silverKills' : 'ordinaryKills']++;
    if (ram && !z.gold && !z.silver) G.earnedCounts.ramKills++;
    G[pot] += base * (z.silver ? 1 : G.killPay) * (1 + G.up.salvage);
    pay = Math.floor(G[pot] + 1e-9);
    G[pot] = Math.max(0, G[pot] - pay);
    G.earnedSources[source] += pay;
    if (cause === 'gun') G.gun.kills++;
    if (!SAVE.flags.scrapEarned) { SAVE.flags.scrapEarned = true; saveSave(); }
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
      } else if (pay) addTotal(z.x, z.y - S.h, pay, U.blue, scrapPopScale(!!z.gold));
    }
  } else if (z.st === 2 && room) {
    // shot off the train: knocked off its side (or off the nose), with the train's speed
    const c = G.tr.cars[z.car], s = z.side, v = rnd(25, 45), tv = G.tr.v * 0.6;
    bs.push(s ? { S, x: z.x, y: z.y, z: 3, vx: c.nx * s * v + c.dx * tv, vy: c.ny * s * v + c.dy * tv, vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 }
      : { S, x: z.x, y: z.y, z: 3, vx: c.dx * (v + tv), vy: c.dy * (v + tv), vz: rnd(25, 45), spin: 0, rot: 0, fall: true, age: 0 });
    blood(z.x, z.y, z.big ? 14 : 8, S.h * 0.6);
    if (sc && pay) addTotal(z.x, z.y - S.h, pay, U.blue, scrapPopScale(!!z.gold));
    if (!G.demo) SFX.splat();
  } else {
    // a gun kill (a heli round, the flatcar gun, a blast of an explosive
    // zombie): the body bursts into a red splat that stays. In a horde only the big ones show
    // their scrap; the rest go to the counter as coins now and then.
    popKill(z, cause);
    if (sc && pay && (z.big || z.gold || z.silver)) addTotal(z.x, z.y - S.h, pay, U.blue, scrapPopScale(!!z.gold));
    if (!G.demo) SFX.splat();
  }
  z.paid = pay;
  if (cause === 'he' || cause === 'train' || ram || z.st === 2) juiceKill(z, cause, cx, cy);
  if (z.gold) goldKill(z, sc);
  if (z.silver) silverKill(z, sc);
  if (!free) boomRoll(z);
  if (sc && (Math.random() < 0.12 || z.big) && coins.length < 45) coins.push({ x0: z.x - G.camX, y0: z.y - G.camY - 8, t: 0, T: rnd(0.55, 0.8) });
  if (z.big && !G.demo) {
    addShake(0.15);
    hitStop(0.05, 0.3);
  }
}
// A 25mm hit: 1 base damage, more with Gun Damage (the demo hits for 1). Or a hit of dmg from another
// gun (cause 'gun' = the flatcar gun).
function hitZombie(z, dmg, cause) {
  if (z.wall) return damageWall(z.wall, dmg != null ? dmg : G.demo ? 1 : heliDmg(), cause || 'mg');
  z.hp -= dmg != null ? dmg : G.demo ? 1 : heliDmg();
  z.flash = z.big ? 0.16 : 0.1;
  juiceHit(z, cause);
  if (z.hp <= 0) {
    kill(z, cause || 'mg', 0, 0, 0);
    return true;
  }
  // A surviving target takes the hit: blood and a step back (unless it holds on to the train).
  blood(z.x, z.y, 4, z.S.h * 0.6);
  if (z.st !== 2) z.kby -= 12;
  if (!G.demo) SFX.hit();
  return false;
}
// A 25mm round lands: its locked target first, then the nearest round the burst. KILLED = the
// ones it killed for the hit-stop.
const NEAR = [], KILLED = [];
function mgImpact(r) {
  const x = r.bx, y = r.by, T = r.tgt, from = r.h ? [r.h.x, r.h.y] : null, dmg = r.dmg ?? heliDmg();
  let hits = 0;
  KILLED.length = 0;
  if (T) T.pending = Math.max(0, T.pending - dmg);
  if (T && !T.dead && Math.hypot(T.x - x, (T.y - y) / FORE) < 6) {
    JUICE.from = from; // the blood flies away from the heli that shot
    if (hitZombie(T, dmg)) KILLED.push(T);
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
      JUICE.from = from;
      if (hitZombie(z, dmg)) KILLED.push(z);
      hits++;
    }
  }
  JUICE.from = null;
  if (hits && r.player) {
    G.hits++;
  }
  if (r.player) roundKills(KILLED);
  // the round lands: a spark of light, a few sparks and a little dust (no mark: the ground stays
  // clean for the blood)
  hitSpark(x, y, r.kind === 'heli' ? dmg : 1);
  if (!G.demo) SFX.pop();
}
// The look of a big blast (no damage): flash, fireball, rings, smoke, earth, sparks, fires, a crater.
function boomFx(x, y, big) {
  lights.push({ x, y, z: 6, r: big ? 50 : 38, c: '#ff8a3a', life: 0.35, max: 0.35, a: 0.6 });
  lights.push({ x, y, z: 6, r: 20, c: '#fff6e0', life: 0.1, max: 0.1, a: 0.8 });
  addBoom(x, y, big ? 26 : 18, 7, 0.75, big ? 11 : 8);
  for (let k = 0; k < (big ? 4 : 2); k++) {
    const a = rnd(TAU), r = rnd(10, 22);
    addBoom(x + Math.cos(a) * r, y + Math.sin(a) * r * FORE, 12, 4, 0.5, 6, rnd(0.03, 0.15));
  }
  rings.push({ x, y, r0: 8, r1: CFG.he.kill * 1.25, t: 0, T: 0.3, c: '#ffd8a0', w: 2 });
  rings.push({ x, y, r0: 20, r1: CFG.he.hurt * 1.5, t: 0, T: 0.55, c: '#a89878' });
  for (let k = 0; k < 16; k++) part({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), z: rnd(4, 18), vx: rnd(-14, 14) + 4, vy: rnd(-6, 6),
    vz: rnd(10, 34), g: 0, life: rnd(1.4, 2.8), max: 2.8, s: rnd(4, 8),
    c: pick(['rgba(96,92,88,0.7)', 'rgba(76,72,68,0.7)', 'rgba(124,120,114,0.6)']), grow: 6, drag: 1, smoke: true });
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
  for (let k = 0; k < 3 && flames.length < 30; k++) {
    const a = rnd(TAU), r = rnd(6, 24);
    flames.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * FORE, life: rnd(3, 7), seed: rnd(100) });
  }
  stampScorch(x, y, 3);
  juiceBoom(x, y, big);
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
    if (value > 0) addTotal(x, y - 10, value, U.blue, scrapPopScale(true));
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
// Plane scan interval in seconds (proposal); use a strike only for a visible crowd of at least 15.
const BOTC = { planeScan: 0.5, planeCrowd: 15 };
// It shoots the dead on the train first, then the ones near the survivors, then the ones on the
// rails nearest the engine, then whoever is nearest the train. The Turbo Ram tackles a Dead Wall
// or a crowd on the rails.
function autopilot(dt) {
  G.botT -= dt;
  if (G.botT <= 0 || !G.botZ || G.botZ.dead) {
    G.botT = 0.2;
    let bestZ = null, bs = 1e9;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const sx = z.x - G.camX, sy = z.y - G.camY;
      if (sx < 6 || sx > W - 6 || sy < 26 || sy > VH - 6) continue;
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
  // the Turbo Ram: at a Dead Wall, or when 6 or more dead stand on the rails ahead (but
  // not when a Dead Wall is less than 600 m ahead: it saves the Ram for that)
  if (ramState() === 'ready' && (wallAhead(130) || G.railAhead >= 6 && !wallAhead(1200))) tryRam(true);
  return { z: G.botZ && !G.botZ.dead ? G.botZ : null };
}
// The title demo: the heli fights by itself and the bot handles the Ram.
function attract(dt) {
  autopilot(dt);
}
// In play with the bot on: the heli fights, and the bot handles the Ram and equipped planes.
function botPlay(dt) {
  autopilot(dt);
  G.botPlaneT = (G.botPlaneT ?? 0) - dt;
  if (G.botPlaneT > 0 || !airLive()) return;
  G.botPlaneT = BOTC.planeScan;
  airSync();
  // A half-second scan avoids repeating the crowd search on every simulation step.
  for (let slot = 0; slot < AIR.slots.length; slot++) {
    if (airReady(AIR.slots[slot])) airSmart(AIRKEYS[slot], BOTC.planeCrowd);
  }
}

// ---------- one step of the game (STEP seconds)
function step(dt) {
  G.t += dt;
  const tr = G.tr, st = G.station, wall = blockingWall();
  // The train recovers after bumps, brakes at its goal, and remains parked after winning.
  if (G.result === 'lost') tr.v = Math.max(0, tr.v - 30 * dt);
  else if (G.result === 'won') tr.v = 0;
  else if (G.finale?.phase === 'hold') tr.v = 0;
  else if (G.ambush && G.ambush.phase !== 'done') driveAmbush(dt);
  else if (wall && !ramPowered() && (wall.state === 'braking' || wall.state === 'stopped')) {
    tr.v = Math.min(CFG.train.cruise, tr.v + CFG.train.accel * dt,
      Math.sqrt(2 * CFG.train.brake * Math.max(0, tr.s - wall.stopS)) + 1.5);
    if (tr.s - wall.stopS < 0.6) stopAtWall(wall);
  }
  else if (st && st.state === 'braking') {
    // A zombie impact can slow the train below its stopping curve. Recover gently so an
    // approach does not become a permanent crawl, while the same curve still prevents overshoot.
    tr.v = Math.min(CFG.train.cruise, tr.v + CFG.train.accel * dt,
      Math.sqrt(2 * CFG.train.brake * Math.max(0, tr.s - st.stopS)) + 1.5);
    if (tr.s - st.stopS < 0.6) {
      tr.v = 0;
      if (!beginFinaleHold()) trainStops(st);
    }
  } else {
    // the Turbo Ram: up to its top speed in 0.4 s, then back down to the cruise over 1 s (also after
    // a Ram cut short). Otherwise the train gets back up to its cruise.
    const R = CFG.ram, cr = CFG.train.cruise, up = (R.speed - cr) / R.rise, down = (R.speed - cr) / R.ease;
    if (ramPowered()) tr.v = Math.min(R.speed, tr.v + up * dt);
    else if (tr.v > cr) tr.v = Math.max(cr, tr.v - down * dt);
    else tr.v = Math.min(cr, tr.v + CFG.train.accel * dt);
  }
  updateRam(dt);
  tr.s -= tr.v * dt;
  layoutTrain();
  // Distance is only route bookkeeping. Riding alone never creates scrap.
  if (!G.demo && !G.result) G.maxKm = Math.max(G.maxKm, DK());
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
  updateHelis(dt);
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
    // (the mouse: where the 105 goes)
    G.aimSX = clamp(M.x, 0, W - 1);
    G.aimSY = clamp(M.y, 0, VH - 1);
  } else {
    G.aimSX = W / 2;
    G.aimSY = VH / 2;
    if (mode === 'title' || mode === 'depot') attract(dt);
    else if (mode === 'ending') {
      G.endT += dt;
      if (G.endT > 3.4) endGame();
    }
  }
  updateLegEvents();
  updateFinale();
  updateAir(dt);
  G.killBump = Math.max(0, G.killBump - dt * 6);
  G.cashPulse = Math.max(0, G.cashPulse - dt * 3);
  updateStation(dt);
  if (!G.demo) updateWalls(dt);
  updateZombies(dt);
  updateGadgets(dt);
  updateTrainWeapons(dt);
  updateRounds(dt);
  updateBurn(dt);
  updateBodies(dt);
  updateFireSpots(dt);
  updateSkills(dt);
  updatePlanes(dt);
  if (!G.demo) updateLoot(dt);
  updateAmbush();
  updateJuice(dt);
  updateScenery(dt);
  updateFX(dt);
  // every 3 s the marks on the ground fade a little
  G.decalT += dt;
  if (G.decalT > 3) {
    G.decalT = 0;
    const [i0, j0, i1, j1] = viewChunks();
    fadeDecals(i0, j0, i1, j1);
  }
}
