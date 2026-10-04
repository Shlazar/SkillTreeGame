// ambush.js - first-leg tower-defense prototype. The train brakes at three finite encounters,
// keeps fighting while stopped, and resumes only when every assigned attacker has been defeated.
// The eleven later legs, rewards, normal Viper and fixed-step pause/speed controls are unchanged.

// Stop distances from departure, flank offsets and stop tolerance in rail/world px. (proposal)
const AMBUSHC = { stops: [60, 160, 260], along: [-9, 0, 9], warning: 2.5,
  snap: 0.6, brakeCreep: 1.5,
  pileAhead: 0, pileOff: 56, notice: 3, clearedNotice: 2 };

function initAmbush() {
  const startS = G.tr.startS;
  G.ambush = { phase: 'travel', index: 0, total: INTRO_LEG.encounters.length,
    remaining: 0, pending: 0, spawned: 0, killed: 0, startS, goalS: G.goalS,
    stops: INTRO_LEG.encounters.map((e, index) => {
      const count = e.groups.reduce((n, g) => n + g.n, 0);
      return { id: 'leg-1-ambush-' + (index + 1), name: e.name, hint: e.hint,
        index, stopS: startS - AMBUSHC.stops[index], count, startedAt: null, clearedAt: null,
        groups: e.groups.map((g, i) => ({ ...g, cars: g.cars.slice(), index: i,
          warnedAt: null, sentAt: null, firstAt: null, spawned: 0 })),
        spawned: 0, killed: 0, remaining: count, actors: [] };
    }) };
}

function beginAmbush() {
  const a = G.ambush, r = a.stops[a.index];
  if (r.startedAt != null) return;
  a.phase = 'hold'; r.startedAt = G.run;
  G.tr.s = r.stopS; G.tr.v = 0;
  dispatchAmbushGroups(r);
  a.remaining = r.count; a.pending = r.count;
  G.events.push({ id: r.id, kind: 'ambush', at: null, t: G.run, n: r.count });
  banner((a.index + 1) + '/' + a.total + ' ' + r.name, r.hint, U.red, AMBUSHC.notice);
  SFX.horn();
  if (a.index === 1) {
    const id = r.id + '-pile';
    if (addLegLoot('pile', { pay: INTRO_LEG.pile, ahead: AMBUSHC.pileAhead,
      off: AMBUSHC.pileOff, side: -1 }, id)) G.events.push({ id, kind: 'pile', at: null, t: G.run, n: 1 });
  }
}

// Warnings and births share the simulation clock, so pause and fast-forward stay consistent.
function dispatchAmbushGroups(r) {
  const elapsed = G.run - r.startedAt;
  for (const g of r.groups) {
    if (g.type > 0 && g.warnedAt == null && elapsed >= g.at - AMBUSHC.warning) {
      g.warnedAt = G.run;
      G.events.push({ id: r.id + '-warning-' + g.index, kind: 'ambushWarning', t: G.run, n: g.n });
      SFX.horn();
    }
    if (g.sentAt != null || elapsed + 1e-8 < g.at) continue;
    g.sentAt = G.run;
    addStream(g.n, g.side, true, { type: g.type, eventId: r.id, ambushId: r.id,
      ambushGroup: g.index, ambushCars: g.cars, ambushLanes: AMBUSHC.along,
      ambushOff: g.side * g.off, ambushGap: g.gap });
  }
}

// Only a configured group of the active intro encounter can use the early enemy exception.
function ambushSpawnType(s) {
  const a = G.ambush, r = a?.stops[a.index], g = r?.groups[s.ambushGroup];
  return a?.phase === 'hold' && r.id === s.ambushId && g?.sentAt != null ? g.type : 0;
}

function ambushWarnings() {
  const a = G?.ambush, r = a?.stops[a.index];
  if (!r || a.phase !== 'hold' || G.result || G.demo) return [];
  return r.groups.filter(g => g.warnedAt != null && g.sentAt == null).map(g => {
    const p = trainMount(g.cars[g.cars.length - 1], 0, g.side * g.off);
    return { label: g.type === 2 ? 'BRUTE' : 'RUNNERS', type: g.type,
      seconds: Math.max(0, r.startedAt + g.at - G.run), x: p.x, y: p.y };
  });
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
  const g = r.groups[z.ambushGroup];
  if (g) { g.spawned++; g.firstAt ??= G.run; }
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
  dispatchAmbushGroups(r);
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
    stops: a.stops.map((r) => ({ id: r.id, name: r.name, index: r.index, stopS: r.stopS, count: r.count,
      startedAt: r.startedAt, clearedAt: r.clearedAt, spawned: r.spawned, killed: r.killed,
      remaining: r.remaining, groups: r.groups.map(g => ({ ...g, cars: g.cars.slice() })), live: r.actors.filter((z) => !z.dead).map((z) => ({
        x: z.x, y: z.y, sx: z.x - G.camX, sy: z.y - G.camY, hp: z.hp, type: z.type, st: z.st,
        gone: !!z.gone, id: z.ambushId, group: z.ambushGroup, car: z.ambushCar, along: z.ambushAlong })) })) };
}
