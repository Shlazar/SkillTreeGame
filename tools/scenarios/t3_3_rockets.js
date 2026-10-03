// Run mode: actual Rockets purchase, seeded per-shot probabilities, pity timer, saved first-use flag, safe area blast and exact effect shots.
function check(ok, message) { if (!ok) throw new Error(message); }
function freshRocket(level, quiet = true) {
  __sr.hold(false);
  __sr.reset();
  check(__sr.node('hrate', 1) && __sr.node('hrange', 1), 'Rocket purchase parents missing');
  __sr.SAVE.flags.goldShown = true;
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.give(0, 0, 100);
  __sr.depot('tree');
  for (let i = 0; i < level; i++) check(__sr.buy('rockets'), 'Actual Rockets purchase failed at level ' + (i + 1));
  check(!__sr.save().flags.rocketShown, 'Purchase consumed first-rocket demonstration before firing');
  __sr.start();
  __sr.rightUp(4, 70);
  if (quiet) isolate();
}
function isolate() {
  const g = __sr.G, h = g.helis[0];
  __sr.bot(false);
  g.zombies.length = g.rounds.length = g.timers.length = 0;
  g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  // Pin only this test's route, so real weapon time can reach 60 seconds without an arrival.
  g.station = null;
  g.walls.length = 0;
  g.t3_3GoalS = g.goalS;
  g.goalS = -1000000000;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
function aimFixture(hp = 1000000, centred = false) {
  const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
  h.x = g.camX + W * (centred ? 0.55 : 0.7);
  h.y = g.camY + H * 0.7;
  h.alt = 25;
  h.vx = h.vy = 0;
  const z = __sr.spawn(0, h.x - g.camX + (centred ? 70 : 0), h.y - g.camY - (centred ? 65 : 45));
  z.hp = hp;
  h.hd = Math.atan2(z.x - h.x, -(z.y - h.y));
  h.cd = 0;
  __sr.order(0, 'attack', z);
  return {g, h, z, s: g.tr.s, x: z.x, y: z.y};
}
function pinned(f, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    f.g.tr.s = f.s;
    f.g.tr.v = 0;
    // A durable test target remains under aim; knockback must not move it out of the camera.
    f.z.x = f.x;
    f.z.y = f.y;
    f.z.vx = f.z.vy = f.z.kbx = f.z.kby = 0;
    __sr.sim(1 / 60);
  }
}
function rocketShot(kind) {
  freshRocket(1);
  __sr.sim(8);
  __sr.frames(240);
  const f = aimFixture(2, true), neighbours = [];
  // The timing sample's distant goal is unnecessary here; keep the real destination in the HUD.
  f.g.goalS = f.g.t3_3GoalS;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    neighbours.push(__sr.spawn(0, f.x - f.g.camX + Math.cos(a) * 10, f.y - f.g.camY + Math.sin(a) * 10 * 0.72));
  }
  for (let i = 0; i < 40 && !__sr.rockets().active.length; i++) pinned(f, 1 / 60);
  check(__sr.rockets().active.length === 1, 'First actual rocket never launched');
  if (kind === 'trail') {
    for (let i = 0; i < 20 && __sr.rockets().active[0]?.age < 0.12; i++) pinned(f, 1 / 60);
    const active = __sr.rockets().active[0];
    check(active && active.age >= 0.12 && active.age < active.T, 'Trail shot did not freeze a flying rocket');
  } else {
    for (let i = 0; i < 30 && !__sr.rockets().impacts; i++) pinned(f, 1 / 60);
    check(__sr.rockets().impacts === 1 && f.z.dead && neighbours.every(z => z.dead), 'Blast shot did not kill its area crowd');
    f.h.cd = 1000000;
    pinned(f, 6 / 60);
    check(__sr.fx().booms > 0 && __sr.fx().rings > 0, 'Rocket blast effects missing');
  }
  __sr.hold(true);
  __sr.frames(1);
  const r = __sr.rockets(), active = r.active[0], point = active ? active.position : [r.lastImpact.x, r.lastImpact.y, 0];
  return {state: r, heli: __sr.helis()[0], point: {x: +(point[0] - f.g.camX).toFixed(1), y: +(point[1] - point[2] - f.g.camY).toFixed(1)}};
}

function randomStream(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededSample(level, seed) {
  const original = Math.random;
  let f;
  try {
    // Seed startup too: incidental animation phases must not change a repeated sample's random sequence.
    Math.random = randomStream(seed);
    freshRocket(level);
    f = aimFixture();
    pinned(f, 60);
  } finally { Math.random = original; }
  const state = __sr.rockets();
  check(!f.g.result && Math.abs(f.g.run - 60) < 0.001 && !f.z.dead, 'Continuous sample did not run for 60 seconds');
  check(state.shots === f.g.shots && state.shots > 250, 'Rocket diagnostic excludes ordinary shots');
  check(state.maxGap <= 6.2 && state.first <= 3, 'First/pity rocket timing: ' + JSON.stringify(state));
  check(__sr.save().flags.rocketShown === true, 'First real rocket did not save its receipt');
  return {seed, shots: state.shots, rockets: state.rockets, first: +state.first.toFixed(3), maxGap: +state.maxGap.toFixed(3)};
}

freshRocket(1);
check(__sr.units().rockets.enabled && __sr.units().rockets.chance === 0.05, 'Level 1 rocket chance bridge');
check(__sr.units().heli.count === 1 && __sr.units().pods === null && __sr.units().hellfire === null, 'Unimplemented weapons appeared active');
const level1 = seededSample(1, 101);
level1.ratio = +(level1.rockets / level1.shots).toFixed(5);
check(level1.ratio >= 0.04 && level1.ratio <= 0.12, 'Level 1 rocket ratio: ' + JSON.stringify(level1));

// Eight fixed 60-second samples give a reproducible aggregate rather than a fragile one-run rate.
const level5 = [];
for (let seed = 1; seed <= 8; seed++) level5.push(seededSample(5, seed));
check(__sr.units().rockets.chance === 0.18, 'Max rocket chance bridge');
const aggregate = level5.reduce((a, s) => ({shots: a.shots + s.shots, rockets: a.rockets + s.rockets}), {shots: 0, rockets: 0});
aggregate.ratio = +(aggregate.rockets / aggregate.shots).toFixed(5);
// Sampling an 18% roll needs tolerance below 18%; eight finite runs need not meet the population mean.
check(aggregate.ratio >= 0.16 && aggregate.ratio <= 0.27, 'Level 5 aggregate ratio: ' + JSON.stringify(aggregate));

// The actual saved flag survives load and prevents a forced rocket on a different leg.
const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
check(stored.flags.rocketShown === true && __sr.load() && __sr.save().flags.rocketShown === true, 'First rocket receipt did not persist');
__sr.setLeg(2);
__sr.start();
isolate();
const next = aimFixture(), original = Math.random;
try {
  Math.random = () => 0.99;
  pinned(next, 7);
} finally { Math.random = original; }
const secondLeg = __sr.rockets();
check(next.g.leg === 2 && secondLeg.first > 3 && secondLeg.first >= 5.9 && secondLeg.first <= 6.2, 'A second leg forced the first rocket again: ' + JSON.stringify(secondLeg));
check(secondLeg.rockets === 1 && !secondLeg.forced, 'High-random second leg should fire exactly one pity rocket');

// Redirect one real launched rocket to the engine centre. Adjacent walkers stay outside the train's body.
freshRocket(1);
const safe = aimFixture(), c = safe.g.tr.cars[0];
for (let i = 0; i < 20 && !__sr.rockets().active.length; i++) pinned(safe, 1 / 60);
const round = safe.g.rounds.find(r => r.kind === 'rocket');
check(round, 'Safety fixture did not launch a real rocket');
round.bx = c.cx; round.by = c.cy;
safe.h.cd = 1000000;
const victims = [-1, 1].map(side => __sr.spawn(0, c.cx - safe.g.camX + side * c.nx * 13, c.cy - safe.g.camY + side * c.ny * 13));
const hpBefore = safe.g.tr.hp, hurtBefore = {...safe.g.hurt};
for (let i = 0; i < 30 && !__sr.rockets().impacts; i++) pinned(safe, 1 / 60);
const safety = __sr.rockets();
check(safety.impacts === 1 && victims.every(z => z.dead), 'Train-centre rocket did not damage adjacent area walkers');
check(safe.g.tr.hp === hpBefore && JSON.stringify(safe.g.hurt) === JSON.stringify(hurtBefore), 'Friendly rocket damaged the train');
check(safety.lastImpact.hits >= 2 && safety.lastImpact.kills >= 2, 'Area blast did not hit multiple zombies');
check(safe.z.pending === 0, 'Rocket impact did not release its own pending damage');

// Both exact screenshot setups render frozen frames before the screenshot tool runs them.
const trail = rocketShot('trail');
check(trail.state.active[0].T === 0.25 && trail.state.active[0].R === 16 && trail.state.active[0].dmg === 6, 'Rocket proposal values changed');
__sr.frames(30);
const blast = rocketShot('blast');
__sr.frames(30);

freshRocket(5, false);
__sr.hp(9999);
__sr.bot(true);
__sr.sim(20);
__sr.frames(30);
const battle = __sr.stats(), performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late()};
check(battle.kills > 0 && __sr.rockets().rockets > 0 && battle.hp > 0, 'Busy rocket fight is not sane');
check(performance.late <= 1, 'Rockets created extra late atlas pages');
QA_DONE({level1, level5, aggregate, savedFirstReceipt: true,
  secondLeg: {first: +secondLeg.first.toFixed(3), rockets: secondLeg.rockets, maxGap: +secondLeg.maxGap.toFixed(3)},
  safety: {hpBefore, hpAfter: hpBefore, hits: safety.lastImpact.hits, kills: safety.lastImpact.kills, trainHurt: hurtBefore},
  trailShot: {age: +trail.state.active[0].age.toFixed(3), position: trail.point, heli: trail.heli},
  blastShot: {impact: blast.state.lastImpact, position: blast.point, heli: blast.heli}, bothShotsRendered: true,
  battle: {kills: battle.kills, shots: battle.shots, rockets: __sr.rockets().rockets, zombies: battle.zombies, parts: battle.parts}, performance});
