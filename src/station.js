// station.js - the stops on the fixed line: the Depot where every run from home starts, and the
// stations further up, each at its own km. At a station the train brakes with its passenger car at
// the station house, the survivors run for the train while the heli covers them, and the train
// leaves when they are aboard. Each one aboard is +1 survivor to keep; the stop pays scrap too.
// (Holding a station against waves, and the towers built there, will live in this file as well.)

// the Depot, and the stations: id, name, km from the Depot, survivors waiting on a first visit
const DEPOT = { id: 'depot', name: 'DEPOT', km: 0 };
const STATIONS = [
  { id: 'farm', name: 'FARM STOP', km: 1, people: 8 },
  { id: 'mill', name: 'MILL TOWN', km: 2, people: 10 }
];
// px from a stop's house (along the rails) to where the engine's nose stops: the passenger car
// (car 1) then stands at the house
const STOP_OFF = CAR.L + CAR.gap + CAR.L / 2;
// a stop by its id ('depot' too)
const stopDef = (id) => (id === 'depot' ? DEPOT : STATIONS.find((d) => d.id === id) || null);

// The stops of a real run that starts at station at (or at the Depot when at is null): the Depot
// beside the train, every station from the start on, and the Dead Walls ahead.
function buildLine(at) {
  const k0 = at ? at.km : 0;
  if (!at) {
    const dp = buildStop(DEPOT, DEPOT_S + STOP_OFF, -1, 0);
    dp.state = 'done';
  }
  for (const d of STATIONS) {
    if (d.km < k0) continue;
    const first = !SAVE.held.includes(d.id);
    const st = buildStop(d, sAtKm(d.km), 1, first ? d.people : CFG.station.again);
    st.first = first;
    G.stations.push(st);
  }
  G.station = G.stations[0] || null;
  for (const w of WALLS) if (w.km > k0) G.walls.push({ km: w.km, walkers: w.walkers, brutes: w.brutes, s: sAtKm(w.km), placed: false, warned: false, awake: false, zs: [] });
}
// A stop with its house at s along the rails: a platform, the house and two lamps on one side of
// the rails (side 1 = east, -1 = west), and n survivors waiting by the door.
function buildStop(def, s, side, n) {
  const y = yOfS(s), c = trackLocal(trackX(y), y, {}).c, fp = trackSlope(y);
  const nx = c * side, ny = -fp * c * side;                       // away from the rails, on that side
  const hx = trackX(y) + nx * 74, hy = y + ny * 74;
  const st = {
    def, id: def.id, name: def.name, s, stopS: s - STOP_OFF, y, state: 'ahead', t: 0, warned: false, first: false,
    people: n, saved: 0, lost: 0, blockedT: 0, house: { x: hx, y: hy }, door: { x: hx, y: hy + 4 }
  };
  for (let a = -66; a <= 66; a += 12) {
    const yy = yAtS(s + a, y + a), fpp = trackSlope(yy), cc = 1 / Math.sqrt(1 + fpp * fpp);
    const x = Math.round(trackX(yy) + cc * 18 * side), py = Math.round(yy - fpp * cc * 18 * side);
    G.statics.push({ d: STATION.slab, x, y: py, k: py });
  }
  for (const a of [-44, 44]) {
    const yy = yAtS(s + a, y + a), x = Math.round(trackX(yy) + 26 * side);
    G.statics.push({ d: STATION.lamp, x, y: Math.round(yy), k: Math.round(yy), lamp: true });
  }
  G.statics.push({ d: STATION.house, x: Math.round(hx), y: Math.round(hy), k: Math.round(hy) });
  for (let i = 0; i < n; i++) {
    G.people.push({ person: true, stop: st, x: hx + rnd(-8, 8), y: hy + rnd(3, 7), st: 'wait', go: 0.6 + i * CFG.station.gap,
      sv: SURV[i % SURV.length], anim: rnd(2), left: Math.random() < 0.5, k: 0, by: null, gt: 0 });
  }
  G.stops.push(st);
  return st;
}
// The train has stopped at station st: it counts as reached (a run can start here from now on).
function trainStops(st) {
  st.state = 'boarding';
  st.t = 0;
  if (!SAVE.reached.includes(st.id)) {
    SAVE.reached.push(st.id);
    saveSave();
  }
  banner(st.name, st.people ? 'COVER THE SURVIVORS. THEY RUN FOR THE TRAIN.' : 'NOBODY IS LEFT HERE', U.green, 3);
  SFX.radio();
}
// Everyone is aboard: the stop pays, and the train leaves for the next station.
function trainLeaves(st) {
  st.state = 'done';
  const pay = st.first ? CFG.pay.stop : CFG.pay.stopAgain, c = G.tr.cars[1];
  G.cash += pay;
  G.pay.stop += pay;
  G.stopNames.push(st.name);
  addTotal(c.cx, c.cy - 16, pay, U.gold, true);
  if (st.first && !SAVE.held.includes(st.id)) {
    SAVE.held.push(st.id);
    saveSave();
  }
  banner('ALL ABOARD', (st.people ? st.saved + ' OF ' + st.people + ' SURVIVORS SAVED.  ' : '') + '+' + pay + ' SCRAP', U.green, 3);
  SFX.horn();
}

// ---------- the survivors
// A zombie gets hold of a survivor: shoot it in time and the survivor runs on.
function grabPerson(p, z) {
  if (p.st !== 'run') return;
  p.st = 'grab';
  p.by = z;
  p.gt = CFG.station.grab;
  if (!G.demo) {
    floatText(p.x, p.y - 8, 'HELP!', U.red);
    SFX.hit();
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
  }
}
// The next stop: the warning, the braking point, and the survivors running for the train.
function updateStation(dt) {
  let st = G.station;
  if (st && st.state === 'done') st = G.station = G.stations.find((s) => s.state !== 'done') || null;
  if (!st) return;
  const tr = G.tr;
  if (st.state === 'ahead') {
    if (!st.warned && tr.s - st.stopS < 260) {
      st.warned = true;
      banner(st.name + ' AHEAD', st.people ? st.people + ' SURVIVORS WAIT THERE' : 'THE TRAIN STOPS THERE', U.blue, 3);
    }
    // brake to stop with the passenger car at the house
    if (tr.s - st.stopS < tr.v * tr.v / (2 * CFG.train.brake) + 1) st.state = 'braking';
  } else if (st.state === 'boarding') {
    st.t += dt;
    const c = tr.cars[1], door = { x: c.cx + c.nx * (CAR.half + 2), y: c.cy + c.ny * (CAR.half + 2) };
    // the next survivor runs once the way out of the door is clear (or, in the end, anyway)
    let near = false;
    for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - st.door.x, (z.y - st.door.y) / FORE) < CFG.station.clear) { near = true; break; }
    let busy = 0, waiting = false;
    for (const p of G.people) {
      if (p.stop !== st) continue;
      if (p.st === 'wait') {
        busy++;
        if (st.t >= p.go) {
          waiting = true;
          if (!near || st.blockedT > CFG.station.wait) {
            p.st = 'run';
            st.blockedT = 0;
          }
        }
        continue;
      }
      if (p.st === 'grab') {
        busy++;
        if (p.by.dead) p.st = 'run';
        else if ((p.gt -= dt) <= 0) catchPerson(p);
        continue;
      }
      if (p.st !== 'run') continue;
      busy++;
      const dx = door.x - p.x, dy = door.y - p.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        p.st = 'in';
        st.saved++;
        if (!G.demo) {
          G.surv++;
          floatText(p.x, p.y - 6, '+1 SURVIVOR', U.green);
          SFX.saved();
        }
        continue;
      }
      p.x += dx / d * CFG.station.run * dt;
      p.y += dy / d * CFG.station.run * dt;
      p.left = dx < 0;
      p.anim += dt * 8;
    }
    st.blockedT = waiting && near ? st.blockedT + dt : 0;
    if (!busy && st.t >= CFG.station.minStop) trainLeaves(st);
  }
  for (const p of G.people) p.k = p.y;
}
