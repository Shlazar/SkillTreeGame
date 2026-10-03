// station.js - the stops on the fixed line. Each leg builds its departure and destination, and
// the train brakes at the destination to finish the ride. Platforms, lamps, houses and corn stay
// as scenery; station holds, defense towers and survivors waiting at the house are gone.

const DEPOT = { id: 'depot', name: 'DEPOT', km: 0 };
// Spacing of the stop's scenery in world px. The positions still bend with the railway.
const TILE = 16;
// px from a stop's house along the rails to the engine's stopping point: car 1 lines up with it.
const STOP_OFF = CAR.L + CAR.gap + CAR.L / 2;
// Stop km is the engine nose's rail position; the house/platform sits STOP_OFF behind it.
function stopRailS(def) { return sAtKm(def.km); }
function stopHouseS(def) { return stopRailS(def) + STOP_OFF; }
const stopDef = (id) => (id === 'depot' ? DEPOT : STATIONS.find((d) => d.id === id) || null);

// Scenery coordinates around a stop -> the world. The rails lie between columns 6 and 7, and the
// house lies beside rows 3 and 4. dressStop() also uses these positions for its props.
function gridToWorld(c, r, s) {
  const a = s + (r - 3.5) * TILE, y0 = yAtS(a, yOfS(a)), fp = trackSlope(y0), k = 1 / Math.sqrt(1 + fp * fp);
  const u = (c - 6.5) * TILE;
  return { x: trackX(y0) + k * u, y: y0 - fp * k * u };
}

// Corn sprites are made before boot so their first use never writes to the late atlas pages.
const STATION_CORN = [];
for (let k = 0; k < 3; k++) {
  const rng = mulberry(77 + k);
  const d = prop(pix(11, 19, (r) => {
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 3 + ((rng() * 2) | 0), h = 13 + ((rng() * 5) | 0), y0 = 19 - h;
      r(x, y0, 1, h, i === 1 ? '#5f6b2c' : '#4c5726');
      for (let y = y0 + 3; y < 17; y += 3 + ((rng() * 2) | 0)) {
        const side = rng() < 0.5 ? -1 : 1;
        r(x + side, y, 1, 1, '#76823a'); r(x + side * 2, y + 1, 1, 1, '#56622a');
      }
      r(x, y0 - 1, 1, 1, '#c9b56a'); r(x - 1, y0, 1, 1, '#9a8c4a'); r(x + 1, y0, 1, 1, '#9a8c4a');
    }
  }), 0);
  STATION_CORN.push(d);
  atl(d.spr);
  atl(d.sh);
}

// Corn stays on both sides of the station. Only its near edge stands up; land.js paints the field
// flat so the zombies walking through it remain easy to see.
function buildCorn(st) {
  for (let a = -84; a <= 102; a += 6) for (const side of [-1, 1]) {
    const p = gridToWorld(6.5 + side * (CORN_U0 + 2 + rnd(-1, 1)) / TILE, 3.5 + (a + rnd(-1, 1)) / TILE, st.s);
    G.statics.push({ d: pick(STATION_CORN), x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y) });
  }
}

// A leg has two visible stops. Only its destination is active; walls will be leg events.
function buildLine(leg) {
  const from = buildStop(leg.from, stopHouseS(leg.from), leg.from.side);
  from.state = 'done';
  from.start = true;
  const to = buildStop(leg.to, stopHouseS(leg.to), leg.to.side);
  G.stations.push(to);
  G.station = to;
}

// A platform, house and lamps on one side of the rails, dressed with the same scenery as before.
function buildStop(def, s, side) {
  const y = yOfS(s), col = (c) => 6.5 + side * (c - 6.5);
  const hp = gridToWorld(col(11.5), 4.1, s), hx = hp.x, hy = hp.y;
  const st = { def, id: def.id, name: def.name, s, stopS: s - STOP_OFF, y, side, state: 'ahead',
    start: false, house: { x: hx, y: hy }, door: { x: hx, y: hy + 3 } };
  for (let r = 0.75; r <= 7.3; r += 0.75) {
    const p = gridToWorld(col(8), r, s);
    G.statics.push({ d: STATION.slab, x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y) - 4 });
  }
  for (const r of [2, 6]) {
    const p = gridToWorld(col(8), r, s);
    G.statics.push({ d: STATION.lamp, x: Math.round(p.x), y: Math.round(p.y), k: Math.round(p.y), lamp: true });
  }
  G.statics.push({ d: STATION.house, x: Math.round(hx), y: Math.round(hy), k: Math.round(hy) });
  if (def !== DEPOT) buildCorn(st);
  dressStop(st);
  G.stops.push(st);
  return st;
}

// No trees or poles on a station's platform, yard or corn field.
const SZ = { u: 0, a: 0, c: 1 };
function stationZone(x, y) {
  for (const d of STATIONS) {
    const s = stopHouseS(d);
    if (d.y0 == null) d.y0 = yOfS(s);
    if (Math.abs(y - d.y0) > 150) continue;
    trackLocal(x, y, SZ);
    if (Math.abs(SZ.a - s) < 112 && Math.abs(SZ.u) < 214) return true;
  }
  return false;
}

// Finish braking at the destination. arrive() records the won leg and starts its ending.
function trainStops(st) {
  if (st.state === 'done') return;
  G.tr.s = st.stopS;
  G.tr.v = 0;
  layoutTrain();
  st.state = 'done';
  G.stopNames.push(st.name);
  stationReward(st);
  arrive();
}

// First arrival pays once. Store the reward before the ending so closing the page cannot lose it.
function stationReward(st) {
  if (G.demo || G.replay || st.def.kind === 'end') return;
  const record = legSave(G.leg);
  if (record.paid.station) return;
  const x = st.door.x, y = st.door.y;
  if (st.def.kind === 'big') {
    record.paid.station = true;
    G.surv++;
    G.stationReward = { kind: 'surv', x, y, t: G.t, amount: 1 };
    floatText(x, y + 34, '+1 SURVIVOR', U.gold);
    addTotal(x - st.side * 30, y + 10, 1, U.gold, true);
    juicePop(x, y, true);
    SFX.saved();
    bankRun();
  } else if (G.leg === 2 && !SAVE.flags.goldShown) {
    record.paid.station = true;
    SAVE.chest = Math.max(SAVE.chest, 1);
    G.stationReward = { kind: 'chest', x, y, t: G.t, amount: 6 };
    floatText(x, y + 34, 'LOCKED GOLD CHEST', U.gold);
    juicePop(x, y, true);
    SFX.crate();
    saveSave();
  } else {
    payGold('station', 6, 0);
    G.stationReward = { kind: 'gold', x, y, t: G.t, amount: 6 };
    floatText(x, y + 34, '+6 GOLD', U.gold);
    coinPop(x, y, 8);
    currencyCoins('gold', x, y, 6);
    SFX.golden();
    saveSave();
  }
}

// These helpers remain for the generic zombie and 105mm code that reads G.people. Stops no longer
// put people in that list, so the current run keeps it empty.
function grabPerson(p, z) {
  if (p.st !== 'run') return;
  p.st = 'grab';
  p.by = z;
  p.gt = CFG.station.grab;
}
function catchPerson(p) {
  if (p.st !== 'run' && p.st !== 'grab') return;
  p.st = 'dead';
  blood(p.x, p.y, 10, 5);
  stampPix(p.x, p.y, P.bl1, 2);
}

// Start braking when the remaining rail distance reaches the current stopping distance.
function updateStation(dt) {
  if (G.demo || G.result) return;
  const st = G.station;
  if (!st) return;
  const tr = G.tr, d = tr.s - st.stopS;
  if (st.state === 'ahead' && d < tr.v * tr.v / (2 * CFG.train.brake) + 1) st.state = 'braking';
}
