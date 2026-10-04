// ambush.js - first-leg tower-defense prototype. The train brakes at three finite encounters,
// keeps fighting while stopped, and resumes only when every assigned walker has been defeated.
// The eleven later legs, rewards, normal Viper and fixed-step pause/speed controls are unchanged.

// Stop distances from departure, flank offsets and stop tolerance in rail/world px. (proposal)
const AMBUSHC = { stops: [60, 160, 260], flank: 72, along: [-9, 0, 9],
  cars: [[0, 1], [0, 1, 2], [0, 1, 2, 3]], sides: [[-1], [1], [-1, 1]],
  snap: 0.6, brakeCreep: 1.5,
  pileAhead: 0, pileOff: 56, notice: 3, clearedNotice: 2 };

function initAmbush() {
  const startS = G.tr.startS;
  G.ambush = { phase: 'travel', index: 0, total: INTRO_LEG.attackers.length,
    remaining: 0, pending: 0, spawned: 0, killed: 0, startS, goalS: G.goalS,
    stops: INTRO_LEG.attackers.map((count, index) => ({ id: 'leg-1-ambush-' + (index + 1),
      index, stopS: startS - AMBUSHC.stops[index], count, startedAt: null, clearedAt: null,
      spawned: 0, killed: 0, remaining: count, actors: [] })) };
}

function beginAmbush() {
  const a = G.ambush, r = a.stops[a.index];
  if (r.startedAt != null) return;
  a.phase = 'hold'; r.startedAt = G.run;
  G.tr.s = r.stopS; G.tr.v = 0;
  const sides = AMBUSHC.sides[a.index];
  for (let i = 0; i < sides.length; i++) {
    const side = sides[i], count = Math.floor(r.count / sides.length) + Number(i < r.count % sides.length);
    addStream(count, side, true, { type: 0, eventId: r.id, ambushId: r.id,
      ambushCars: AMBUSHC.cars[a.index], ambushLanes: AMBUSHC.along,
      ambushOff: side * AMBUSHC.flank });
  }
  a.remaining = r.count; a.pending = r.count;
  G.events.push({ id: r.id, kind: 'ambush', at: null, t: G.run, n: r.count });
  banner('AMBUSH ' + (a.index + 1) + '/' + a.total, 'CLEAR THE DEAD TO KEEP MOVING.', U.red, AMBUSHC.notice);
  SFX.horn();
  if (a.index === 1) {
    const id = r.id + '-pile';
    if (addLegLoot('pile', { pay: INTRO_LEG.pile, ahead: AMBUSHC.pileAhead,
      off: AMBUSHC.pileOff, side: -1 }, id)) G.events.push({ id, kind: 'pile', at: null, t: G.run, n: 1 });
  }
}

function driveAmbush(dt) {
  const a = G.ambush, tr = G.tr;
  if (a.phase === 'hold') { tr.v = 0; return; }
  const r = a.stops[a.index], distance = Math.max(0, tr.s - r.stopS);
  tr.v = Math.min(CFG.train.cruise, tr.v + CFG.train.accel * dt,
    Math.sqrt(2 * CFG.train.brake * distance) + AMBUSHC.brakeCreep);
  if (distance <= AMBUSHC.snap) beginAmbush();
}

function ambushBorn(z) {
  const r = G.ambush?.stops.find((s) => s.id === z.ambushId);
  if (!r) return;
  r.actors.push(z); r.spawned++;
}

function updateAmbush() {
  const a = G.ambush;
  if (!a || G.demo || G.result || mode !== 'play' || paused) return;
  a.spawned = a.killed = 0;
  for (const r of a.stops) {
    r.killed = r.actors.reduce((n, z) => n + Number(z.dead === true), 0);
    r.remaining = r.count - r.killed;
    a.spawned += r.spawned; a.killed += r.killed;
  }
  if (a.phase !== 'hold') return;
  const r = a.stops[a.index];
  a.pending = r.count - r.spawned;
  a.remaining = r.remaining;
  // Missing births and living attackers both block travel. No elapsed-time shortcut clears a wave.
  if (r.spawned !== r.count || r.killed !== r.count) return;
  r.clearedAt = G.run;
  a.index++; a.remaining = a.pending = 0;
  a.phase = a.index < a.total ? 'travel' : 'done';
  G.events.push({ id: r.id + '-clear', kind: 'ambushClear', at: null, t: G.run, n: r.killed });
  banner('AMBUSH CLEARED!', a.phase === 'done' ? 'ROLL INTO MILLBROOK.' : 'THE TRAIN IS MOVING AGAIN.', U.green, AMBUSHC.clearedNotice);
  SFX.horn();
}

function ambushState() {
  const a = G?.ambush;
  if (!a) return null;
  return { phase: a.phase, index: a.index, total: a.total, remaining: a.remaining, pending: a.pending,
    spawned: a.spawned, killed: a.killed, startS: a.startS, goalS: a.goalS,
    trainS: G.tr.s, trainSpeed: G.tr.v,
    stops: a.stops.map((r) => ({ id: r.id, index: r.index, stopS: r.stopS, count: r.count,
      startedAt: r.startedAt, clearedAt: r.clearedAt, spawned: r.spawned, killed: r.killed,
      remaining: r.remaining, live: r.actors.filter((z) => !z.dead).map((z) => ({
        x: z.x, y: z.y, sx: z.x - G.camX, sy: z.y - G.camY, hp: z.hp, type: z.type, st: z.st,
        gone: !!z.gone, id: z.ambushId, car: z.ambushCar, along: z.ambushAlong })) })) };
}
