// station.js - the stops on the fixed line: the Depot where every run from home starts, and the
// stations further up, each at its own km. At a station the train stops with its passenger car at
// the station house and HOLDS: for a set time the dead come out of the corn in waves, the survivors
// run from the house to the train, and the towers you built there (towers.js) fight beside you.
// Each survivor aboard is +1 survivor to keep; the hold pays scrap too.

// The station grid: 14 columns (0 = west) x 9 rows (0 = north, the way the train goes). One tile is
// 16 x 16 world px. = rails (the parked train), P platform, L lamp, ~ the door path, H the house,
// . free to build on. Farm Stop has its house east; Mill Town is the mirror of it.
const GRID_C = 14, GRID_R = 9, TILE = 16;
const FARM_MAP = [
  '......==......',
  '......==P.....',
  '......==L.....',
  '......==P~~HH.',
  '......==P~~HH.',
  '......==P.....',
  '......==L.....',
  '......==P.....',
  '......==......'
];
const mirrorMap = (m) => m.map((r) => r.split('').reverse().join(''));
// a later visit (and a run that starts at the station): 25 s, 3 survivors (they leave the house at
// 2, 8 and 14 s), the 20 dead waiting there, waves that start at the near edge of the corn (px from
// the rail middle). Wave side: -1 = the side away from the house, 1 = the house side, 0 = both.
// w / r / b = walkers, runners, brutes. brute = px out on the house side where the brute starts.
const HOLD_LATER = {
  T: 25, people: 3, outs: [2, 8, 14], dead: 20, far: [120, 140], brute: 120,
  waves: [{ t: 0, side: -1, w: 30, r: 0, b: 0 }, { t: 6, side: 1, w: 32, r: 6, b: 0 }, { t: 11, side: 0, w: 42, r: 8, b: 1 }]
};
const DEPOT = { id: 'depot', name: 'DEPOT', km: 0 };
// side = where the house is (1 = east of the rails). kit = the free towers the people there built:
// [type, column, row]. first = the first hold (out0 + i x gap = when survivor i leaves the house).
const STATIONS = [
  { id: 'farm', name: 'FARM STOP', km: 1, side: 1, map: FARM_MAP,
    kit: [['nest', 4, 4], ['bag', 2, 0], ['bag', 2, 1], ['bag', 2, 2], ['bag', 2, 6], ['bag', 2, 7], ['bag', 2, 8]],
    first: { T: 40, people: 8, out0: 2, gap: 4.5, dead: 20, far: [150, 200], brute: 140,
      waves: [{ t: 0, side: -1, w: 35, r: 0, b: 0 }, { t: 10, side: 1, w: 39, r: 6, b: 0 }, { t: 20, side: 0, w: 52, r: 8, b: 1 }] },
    later: HOLD_LATER },
  { id: 'mill', name: 'MILL TOWN', km: 2, side: -1, map: mirrorMap(FARM_MAP),
    kit: [['nest', 9, 4], ['bag', 11, 0], ['bag', 11, 1], ['bag', 11, 2], ['bag', 11, 6], ['bag', 11, 7], ['bag', 11, 8]],
    first: { T: 50, people: 10, out0: 2, gap: 4.5, dead: 20, far: [150, 200], brute: 140,
      waves: [{ t: 0, side: -1, w: 44, r: 0, b: 0 }, { t: 12, side: 1, w: 49, r: 8, b: 0 }, { t: 24, side: 0, w: 65, r: 10, b: 1 }] },
    later: HOLD_LATER }
];
// the rows the dead walk in on (the lanes), how near the door the dead keep a survivor inside (px)
// and for how long at most (s), how long the train waits for the last survivors after the time is
// up (s), the HP the crew repairs on stopping, the scrap a hold pays (first / later), px from the
// stop where the dead waiting there are placed and where they start to walk, the seconds after a
// wave starts when its runners step out of the corn
const HOLD = { runners: [3, 6], lanes: [1, 7], clear: 34, wait: 3, extra: 8, repair: 20, pay: 50, payAgain: 25, place: 600, walk: 200 };
// px from a stop's house (along the rails) to where the engine's nose stops: the passenger car
// (car 1) then stands at the house
const STOP_OFF = CAR.L + CAR.gap + CAR.L / 2;
// a stop by its id ('depot' too)
const stopDef = (id) => (id === 'depot' ? DEPOT : STATIONS.find((d) => d.id === id) || null);
// what is on tile (c, r) of station def: '=', 'P', 'L', '~', 'H' or '.' ('#' = off the grid)
const tileAt = (def, c, r) => (c < 0 || r < 0 || c >= GRID_C || r >= GRID_R ? '#' : def.map[r][c]);
const sideName = (s) => (s < 0 ? 'WEST' : s > 0 ? 'EAST' : 'BOTH');

// Tile (c, r) of the station whose house is at s along the rails -> the world. The rails run
// between columns 6 and 7; the coach door is between rows 3 and 4. c, r may be fractions (tile
// middles are at whole numbers). The grid bends with the rails.
function gridToWorld(c, r, s) {
  const a = s + (r - 3.5) * TILE, y0 = yAtS(a, yOfS(a)), fp = trackSlope(y0), k = 1 / Math.sqrt(1 + fp * fp);
  const u = (c - 6.5) * TILE;
  return { x: trackX(y0) + k * u, y: y0 - fp * k * u };
}

// The stops of a real run that starts at station at (or at the Depot when at is null): the Depot
// beside the train, every station from the start on, and the Dead Walls ahead.
function buildLine(at) {
  const k0 = at ? at.km : 0;
  G.trounds = [];
  if (!at) {
    const dp = buildStop(DEPOT, DEPOT_S + STOP_OFF, 1, 0, null);
    dp.state = 'done';
  }
  for (const d of STATIONS) {
    if (d.km < k0) continue;
    // a run that starts here, and every visit once it is held, gets the later hold
    const start = at === d, first = !start && !SAVE.held.includes(d.id), h = SAVE.house[d.id];
    const n = first ? d.first.people : typeof h === 'number' ? clamp(h | 0, 0, HOLD_LATER.people) : HOLD_LATER.people;
    const st = buildStop(d, sAtKm(d.km), d.side, n, first ? d.first : d.later);
    st.first = first;
    st.start = start;
    buildTowers(st);
    G.stations.push(st);
  }
  G.station = G.stations[0] || null;
  for (const w of WALLS) if (w.km > k0) G.walls.push({ km: w.km, walkers: w.walkers, brutes: w.brutes, s: sAtKm(w.km), placed: false, warned: false, awake: false, zs: [] });
}
// A stop with its house at s along the rails: a platform, the house and two lamps on one side of
// the rails (side 1 = east, -1 = west), and n survivors waiting by the door. hold = its hold plan.
function buildStop(def, s, side, n, hold) {
  const y = yOfS(s), col = (c) => 6.5 + side * (c - 6.5);
  const hp = gridToWorld(col(11.5), 4.1, s), hx = hp.x, hy = hp.y;
  const st = {
    def, id: def.id, name: def.name, s, stopS: s - STOP_OFF, y, side, state: 'ahead', t: 0, warned: false, first: false,
    start: false, hold, people: n, saved: 0, lost: 0, blockedT: 0, house: { x: hx, y: hy }, door: { x: hx, y: hy + 3 },
    wave: 0, waveT: -9, waveSide: 0, queue: [], deadPlaced: false, deadZs: [], awake: false, towers: [], nests: [], bags: [], wires: [], perfect: false
  };
  // the platform slabs (column 8, rows 1 to 7) and the lamps (rows 2 and 6)
  for (let r = 0.75; r <= 7.3; r += 0.75) {
    const p = gridToWorld(col(8), r, s);
    G.statics.push({ d: STATION.slab, x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y) - 4 });
  }
  for (const r of [2, 6]) {
    const p = gridToWorld(col(8), r, s);
    G.statics.push({ d: STATION.lamp, x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y), lamp: true });
  }
  G.statics.push({ d: STATION.house, x: Math.round(hx), y: Math.round(hy), k: Math.round(hy) });
  const go = (i) => (!hold ? 0.6 + i : hold.outs ? hold.outs[i] : hold.out0 + i * hold.gap);
  for (let i = 0; i < n; i++) {
    G.people.push({ person: true, stop: st, x: hx + rnd(-8, 8), y: hy + rnd(2, 5), st: 'wait', go: go(i),
      sv: SURV[i % SURV.length], anim: rnd(2), left: Math.random() < 0.5, k: 0, by: null, gt: 0 });
  }
  if (def !== DEPOT) buildCorn(st);
  G.stops.push(st);
  return st;
}
// true when (x, y) is on a station's ground (its grid and the corn round it): no trees or poles there
const SZ = { u: 0, a: 0, c: 1 };
function stationZone(x, y) {
  for (const d of STATIONS) {
    const s = sAtKm(d.km);
    if (d.y0 == null) d.y0 = yOfS(s);
    if (Math.abs(y - d.y0) > 150) continue;
    trackLocal(x, y, SZ);
    if (Math.abs(SZ.a - s) < 112 && Math.abs(SZ.u) < 214) return true;
  }
  return false;
}

// ---------- the hold
// The train has stopped at station st: the crew repairs it, the station counts as reached, and the
// hold begins.
function trainStops(st) {
  st.state = 'hold';
  st.t = 0;
  st.awake = true;
  const tr = G.tr;
  tr.hp = Math.min(tr.max, tr.hp + HOLD.repair);
  tr.hpShown = Math.max(tr.hpShown, tr.hp);
  floatText(tr.cars[0].cx, tr.cars[0].cy - 18, '+' + HOLD.repair + ' HP REPAIRED', U.green);
  if (!SAVE.reached.includes(st.id)) {
    SAVE.reached.push(st.id);
    saveSave();
  }
  const T = st.hold.T;
  banner('HOLD THE STATION', T + ' SECONDS. ' + (st.people ? 'SAVE THE SURVIVORS.' : 'THE HOUSE IS EMPTY.'), U.green, 3);
  SFX.bell();
  if (typeof tutEvent === 'function') tutEvent('hold_start', { id: st.id, first: st.first });
}
// The hold is over: the stop pays, PERFECT HOLD when no survivor was lost, and the train leaves.
function trainLeaves(st) {
  st.state = 'done';
  // anyone still out there is left behind; anyone still in the house waits for the next train
  let home = 0;
  for (const p of G.people) {
    if (p.stop !== st) continue;
    if (p.st === 'run' || p.st === 'grab') {
      p.st = 'dead';
      st.lost++;
    } else if (p.st === 'wait') home++;
  }
  SAVE.house[st.id] = home;
  const firstHeld = !SAVE.held.includes(st.id), pay = st.first ? HOLD.pay : HOLD.payAgain, c = G.tr.cars[1];
  G.cash += pay;
  G.pay.stop += pay;
  G.stopNames.push(st.name);
  addTotal(c.cx, c.cy - 16, pay, U.gold, true);
  st.perfect = st.people > 0 && st.lost === 0 && st.saved === st.people;
  if (firstHeld) SAVE.held.push(st.id);
  saveSave();
  banner('STATION HELD!', (st.people ? st.saved + ' OF ' + st.people + ' SURVIVORS ABOARD.  ' : '') + '+' + pay + ' SCRAP', U.green, 3);
  SFX.horn();
  if (st.perfect) {
    G.surv++;
    later(2.3, () => {
      banner('PERFECT HOLD!', '+1 SURVIVOR. NOBODY WAS LOST.', U.gold, 3);
      SFX.saved();
      floatText(G.tr.cars[1].cx, G.tr.cars[1].cy - 20, '+1 SURVIVOR', U.gold);
    });
  }
  if (firstHeld) later(st.perfect ? 4.6 : 2.3, () => banner(st.name + ' IS YOURS', 'BUILD ITS TOWERS IN THE DEPOT.', U.teal, 3));
  if (typeof tutEvent === 'function') tutEvent('station_held', { id: st.id, first: st.first, perfect: st.perfect, saved: st.saved, total: st.people });
}
// At the end of a run. A hold cut short leaves its house with the survivors still inside. After a
// run that rode 0.5 km or more, every station house reached fills up to 3 survivors again.
function refillHouses() {
  if (!G || G.demo) return;
  const st = G.station;
  if (st && st.state === 'hold') SAVE.house[st.id] = G.people.filter((p) => p.stop === st && p.st === 'wait').length;
  if (G.ride >= CFG.line.km * 0.5) {
    for (const id of SAVE.reached) SAVE.house[id] = Math.max(SAVE.house[id] | 0, HOLD_LATER.people);
  }
  saveSave();
}

// ---------- the dead at a station
// The dead who wait at the station: they stand about the grid until the train comes near.
function placeStationDead(st) {
  st.deadPlaced = true;
  if (st.start) return;
  for (let i = 0; i < st.hold.dead; i++) {
    const p = gridToWorld(6.5 + (Math.random() < 0.5 ? -1 : 1) * rnd(2.2, 6), rnd(-0.3, 8.3), st.s);
    const z = makeZombie(p.x, p.y, 0);
    z.still = true;
    G.zombies.push(z);
    st.deadZs.push(z);
  }
}
// Wave n out of the corn: its walkers, runners and brute walk in along the two lanes (rows 1 and
// 7) of its side, or of both sides. They step out of the corn over a few seconds (the walkers
// first, the runners a little after, while the survivors are on their way).
function laneWave(st, w, n) {
  const H0 = st.hold, side = w.side * st.side, q = st.queue;
  const one = (type, sd, far, d) => q.push({ t: st.t + d, type, sd, far });
  const sideOf = (i) => side || (i & 1 ? 1 : -1);
  for (let i = 0; i < w.w; i++) one(0, sideOf(i), rnd(H0.far[0], H0.far[1]), rnd(0, 3));
  for (let i = 0; i < w.r; i++) one(1, sideOf(i), rnd(H0.far[0], H0.far[1]), rnd(HOLD.runners[0], HOLD.runners[1]));
  for (let i = 0; i < w.b; i++) one(2, st.side, H0.brute, 1);
  st.wave = n;
  st.waveT = st.t;
  st.waveSide = side;
  const sub = w.b ? 'A BRUTE IS COMING!' : w.r ? 'RUNNERS GO FOR THE SURVIVORS!' : w.w + ' DEAD OUT OF THE CORN';
  banner('WAVE ' + n + '  ' + (side < 0 ? '< WEST' : side > 0 ? 'EAST >' : '< BOTH >'), sub, U.red, 2);
  SFX.wave();
  if (typeof tutEvent === 'function') tutEvent('wave', { n, side: sideName(side) });
}

// ---------- the survivors
// A zombie gets hold of a survivor: shoot it in time and the survivor runs on.
function grabPerson(p, z) {
  if (p.st !== 'run') return;
  p.st = 'grab';
  p.by = z;
  p.gt = CFG.station.grab;
  p.stop.grabs = (p.stop.grabs | 0) + 1;
  if (!G.demo) {
    floatText(p.x, p.y - 8, 'HELP!', U.red);
    SFX.hit();
    if (typeof tutEvent === 'function') tutEvent('survivor_grabbed', {});
  }
}
function catchPerson(p) {
  if (p.st !== 'run' && p.st !== 'grab') return;
  p.st = 'dead';
  p.stop.lost++;
  blood(p.x, p.y, 10, 5);
  stampPix(p.x, p.y, P.bl1, 2);
  if (!G.demo) {
    floatText(p.x, p.y - 6, 'SURVIVOR DOWN', U.red);
    SFX.splat();
    if (typeof tutEvent === 'function') tutEvent('survivor_lost', {});
  }
}
// The next stop: the dead waiting there, the warning, the braking point, and the hold.
function updateStation(dt) {
  if (G.demo) return;
  updateTowers(dt);
  let st = G.station;
  if (st && st.state === 'done') st = G.station = G.stations.find((s) => s.state !== 'done') || null;
  if (!st) return;
  const tr = G.tr, d = tr.s - st.stopS;
  if (!st.deadPlaced && d < HOLD.place) placeStationDead(st);
  if (st.deadZs.length && d < HOLD.walk) {
    for (const z of st.deadZs) z.still = false;
    st.deadZs.length = 0;
  }
  if (st.state === 'ahead') {
    if (!st.warned && d < 260) {
      st.warned = true;
      banner(st.name + ' AHEAD', st.towers.length ? 'YOUR TOWERS ARE READY.' : st.people + ' SURVIVORS WAIT THERE', U.blue, 3);
      if (typeof tutEvent === 'function') tutEvent('station_ahead', { id: st.id });
    }
    // brake to stop with the passenger car at the house
    if (d < tr.v * tr.v / (2 * CFG.train.brake) + 1) st.state = 'braking';
  } else if (st.state === 'hold') updateHold(st, dt);
  for (const p of G.people) p.k = p.y;
}
function updateHold(st, dt) {
  st.t += dt;
  const H0 = st.hold, ws = H0.waves;
  if (st.wave < ws.length && st.t >= ws[st.wave].t) laneWave(st, ws[st.wave], st.wave + 1);
  for (let i = st.queue.length - 1; i >= 0; i--) {
    const o = st.queue[i];
    if (st.t < o.t) continue;
    st.queue.splice(i, 1);
    const p = gridToWorld(6.5 + o.sd * o.far / TILE, pick(HOLD.lanes) + rnd(-0.45, 0.45), st.s);
    G.zombies.push(makeZombie(p.x, p.y, o.type));
  }
  const c = G.tr.cars[1], door = { x: c.cx + c.nx * (CAR.half + 2) * st.side, y: c.cy + c.ny * (CAR.half + 2) * st.side };
  // the next survivor runs once the way out of the door is clear (or after 3 s anyway)
  let near = false;
  queryEll(st.door.x, st.door.y, HOLD.clear, () => { near = true; });
  let out = 0, waiting = false;
  for (const p of G.people) {
    if (p.stop !== st) continue;
    if (p.st === 'wait') {
      if (st.t >= p.go) {
        if (!near || st.blockedT > HOLD.wait) {
          p.st = 'run';
          st.blockedT = 0;
          out++;
        } else waiting = true;
      }
      continue;
    }
    if (p.st === 'grab') {
      out++;
      if (p.by.dead) p.st = 'run';
      else if ((p.gt -= dt) <= 0) catchPerson(p);
      continue;
    }
    if (p.st !== 'run') continue;
    out++;
    const dx = door.x - p.x, dy = door.y - p.y, dd = Math.hypot(dx, dy);
    if (dd < 3) {
      p.st = 'in';
      st.saved++;
      G.surv++;
      floatText(p.x, p.y - 6, '+1 SURVIVOR', U.green);
      SFX.saved();
      continue;
    }
    p.x += dx / dd * CFG.station.run * dt;
    p.y += dy / dd * CFG.station.run * dt;
    p.left = dx < 0;
    p.anim += dt * 8;
  }
  st.blockedT = waiting && near ? st.blockedT + dt : 0;
  // the time is up: the train goes once nobody is out there (or at the door), at most 8 s later
  if (st.t >= H0.T && ((!out && !waiting) || st.t >= H0.T + HOLD.extra)) trainLeaves(st);
}
// The hold now, for the HUD: null, or the station with the seconds left
function holdNow() {
  const st = G && !G.demo ? G.station : null;
  return st && st.state === 'hold' ? st : null;
}
