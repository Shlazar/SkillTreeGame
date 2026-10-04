// Run mode: opening engagement and fair-start checks with normal health, natural arrivals and real pointer commands.
// Later-leg node fixtures model modest cumulative purchases; they are listed in every output row.
const OPENING_BUILDS = [
  {},
  {hdmg: 1, hrate: 1, armor: 1, magnet: 1},
  {hdmg: 2, hrate: 1, hrange: 1, armor: 1, magnet: 1},
  {hdmg: 3, hrate: 2, hrange: 1, armor: 2, magnet: 1, rockets: 1},
  {hdmg: 3, hrate: 3, hrange: 2, armor: 2, magnet: 1, rockets: 2}
];
const OPENING_SEEDS = [0x0F1E, 0x0F2E], SAMPLE_STEP = 0.1, LIMIT_SECONDS = 90;
const rounded = n => Number.isFinite(n) ? +n.toFixed(3) : null;
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = before; }
}
// Ground distance to the actual extended car segments, with the view's 0.72 squash and 8px half-width.
function distanceToTrain(z, g) {
  let nearest = Infinity;
  for (const c of g.tr.cars) {
    const ax = c.x1, ay = c.y1 / 0.72, bx = c.x0 + c.dx * 6, by = (c.y0 + c.dy * 6) / 0.72;
    const dx = bx - ax, dy = by - ay, zy = z.y / 0.72;
    const t = Math.max(0, Math.min(1, ((z.x - ax) * dx + (zy - ay) * dy) / (dx * dx + dy * dy || 1)));
    nearest = Math.min(nearest, Math.hypot(z.x - ax - t * dx, zy - ay - t * dy));
  }
  return Math.max(0, nearest - 8);
}
function visible(z, g, view) {
  const x = z.x - g.camX, y = z.y - z.S.h * 0.5 - g.camY;
  return x >= 0 && x < view.W && y >= 19 && y < view.VH;
}
function defensiveClick(g, view) {
  const h = g.helis[0];
  const threats = g.zombies.filter(z => !z.dead && !z.gone && !z.gold && visible(z, g, view));
  threats.sort((a, b) => (a.st === 2 ? -1000 : 0) + distanceToTrain(a, g) -
                         (b.st === 2 ? -1000 : 0) - distanceToTrain(b, g));
  const z = threats[0], wall = __sr.wallState().find(w => !w.broken && Number.isFinite(w.stoppedAt));
  let x, y;
  if (z && (z.st === 2 || !wall)) {
    if (h.order?.kind === 'attack' && h.order.z === z) return null;
    x = z.x - g.camX; y = z.y - z.S.h * 0.5 - g.camY;
  } else if (wall) {
    if (h.order?.kind === 'attack' && h.order.z?.wall) return null;
    x = wall.sx; y = wall.sy - 10;
  } else {
    if (!h.order) return null;
    const c = g.tr.cars[0]; x = c.cx - g.camX; y = c.cy - g.camY - 5;
  }
  if (x < 0 || x >= view.W || y < 19 || y >= view.VH) return null;
  __sr.rightDown(x, y); __sr.rightUp(x, y);
  return {at: rounded(g.run), kind: h.order?.kind || 'escort', x: rounded(x), y: rounded(y)};
}
function diagnose(leg, control, seed) {
  return seeded(seed, () => {
    __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
    const upgrades = OPENING_BUILDS[leg - 1];
    for (const [id, level] of Object.entries(upgrades)) check(__sr.node(id, level), 'Unknown modest upgrade ' + id);
    __sr.leg(leg, false); __sr.bot(false); __sr.rightUp(4, 70);
    const g = __sr.G, view = __sr.stats(), range = __sr.gunVisual().range.radius;
    check(g.tr.hp === g.tr.max, 'Diagnostic did not start with normal full health');
    const startHp = g.tr.hp, samples = [], commands = [], types = new Set(), variants = {gold: false, silver: false, boom: false};
    const first = {visible: null, inViperRange: null, shot: null, kill: null};
    const peak = {living: 0, visible: 0, inViperRange: 0, nearTrain: 0, onTrain: 0};
    const totals = {...peak}, quiet = {shots: 0, kills: 0, both: 0};
    let observations = 0, priorShots = 0, priorKills = 0, lastShot = 0, lastKill = 0, lastAction = 0, nextLog = 0;
    let first10 = null, first30 = null;
    function sample() {
      const live = g.zombies.filter(z => !z.dead && !z.gone), h = g.helis[0];
      const counts = {living: live.length, visible: 0, inViperRange: 0, nearTrain: 0, onTrain: 0};
      for (const z of g.zombies) {
        types.add(z.type);
        for (const key of Object.keys(variants)) variants[key] ||= !!z[key];
        check((leg >= 2 || z.type === 0) && z.type !== 2 && (leg >= 3 || !z.gold) &&
          (leg >= 4 || !z.silver) && !z.boom, 'Opening placement bypassed an enemy introduction: leg' + leg);
      }
      for (const z of live) {
        if (visible(z, g, view)) counts.visible++;
        if (Math.hypot(z.x - h.x, (z.y - h.y) / 0.72) <= range) counts.inViperRange++;
        if (z.st === 2 || distanceToTrain(z, g) <= 40) counts.nearTrain++;
        if (z.st === 2) counts.onTrain++;
      }
      if (first.visible === null && counts.visible) first.visible = rounded(g.run);
      if (first.inViperRange === null && counts.inViperRange) first.inViperRange = rounded(g.run);
      quiet.shots = Math.max(quiet.shots, g.run - lastShot);
      quiet.kills = Math.max(quiet.kills, g.run - lastKill);
      quiet.both = Math.max(quiet.both, g.run - lastAction);
      if (g.shots > priorShots) { first.shot ??= rounded(g.run); lastShot = g.run; }
      if (g.kills > priorKills) { first.kill ??= rounded(g.run); lastKill = g.run; }
      if (g.shots > priorShots || g.kills > priorKills) lastAction = g.run;
      priorShots = g.shots; priorKills = g.kills; observations++;
      for (const key of Object.keys(counts)) { peak[key] = Math.max(peak[key], counts[key]); totals[key] += counts[key]; }
      const snapshot = () => ({at: rounded(g.run), ...counts, shots: g.shots, kills: g.kills,
        hp: rounded(g.tr.hp), wallHp: rounded(__sr.wallState().find(w => !w.broken)?.hp),
        remainingMetres: rounded(Math.max(0, g.tr.s - g.goalS) / 2)});
      if (g.run + 1e-9 >= nextLog || g.result) { samples.push(snapshot()); nextLog += 2; }
      if (!first10 && g.run >= 10 - 1e-9) first10 = snapshot();
      if (!first30 && g.run >= 30 - 1e-9) first30 = snapshot();
    }
    sample();
    for (let step = 0; step < LIMIT_SECONDS / SAMPLE_STEP && !g.result; step++) {
      if (control === 'defensive_right_click' && step % 10 === 0) {
        const command = defensiveClick(g, view); if (command) commands.push(command);
      }
      __sr.sim(SAMPLE_STEP); sample();
    }
    return {leg, control, seed, upgrades, viewport: {W: view.W, H: view.H, VH: view.VH},
      startHp, maxHp: g.tr.max, viperRange: range, first, types: [...types].sort(), variants,
      longestWithoutShots: rounded(quiet.shots), longestWithoutKills: rounded(quiet.kills),
      longestWithoutEither: rounded(quiet.both), peak,
      mean: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, rounded(value / observations)])),
      first10, first30, duration: rounded(g.run), result: g.result || 'time_limit', hp: rounded(g.tr.hp),
      shots: g.shots, kills: g.kills, hurt: {...g.hurt}, remainingMetres: rounded(Math.max(0, g.tr.s - g.goalS) / 2),
      commands, samples, events: __sr.legState().events};
  });
}
const rows = [];
for (let leg = 1; leg <= 5; leg++) for (const seed of OPENING_SEEDS) {
  for (const control of ['zero_input_escort', 'defensive_right_click']) rows.push(diagnose(leg, control, seed + leg));
}
function assertOpening(results) {
  for (const row of results) {
    const label = 'leg' + row.leg + ' ' + row.control + ' seed' + row.seed;
    check(row.first.shot !== null && row.first.shot <= (row.leg === 1 ? 3 : 1), 'Opening gunfire starts too late: ' + label);
    if (row.leg > 1 && row.control === 'zero_input_escort') check(row.longestWithoutEither <= 5,
      'Passive opening has a quiet stretch over 5s: ' + label + ' ' + row.longestWithoutEither);
    if (row.control === 'defensive_right_click') check(row.result === 'won',
      'Normal-health defensive ride or first leg failed: ' + label + ' ' + row.result);
    if (row.leg === 1) check(row.first10 && row.first10.hp >= 40,
      'First leg loses more than half its health in 10s: ' + label + ' ' + row.first10?.hp);
    check(row.types.includes(0) && (row.leg < 2 || row.types.includes(1)), 'Expected opening enemy type never appeared: ' + label);
  }
}
assertOpening(rows);
// Optional focused portrait probe: prepend window.OPENING_NARROW = true in a QA wrapper.
// Its two leg1 rides are separate, so the original 20-row baseline comparison stays intact.
const narrowRows = [];
if (window.OPENING_NARROW === true) {
  const keys = ['innerWidth', 'innerHeight', 'devicePixelRatio'];
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(window, key));
  try {
    for (const [key, value] of [['innerWidth', 700], ['innerHeight', 1000], ['devicePixelRatio', 1]])
      Object.defineProperty(window, key, {configurable: true, value});
    window.dispatchEvent(new Event('resize'));
    check(__sr.stats().W === 350, 'Optional opening viewport is not 350px wide');
    for (const control of ['zero_input_escort', 'defensive_right_click']) narrowRows.push(diagnose(1, control, OPENING_SEEDS[0] + 1));
    assertOpening(narrowRows);
  } finally {
    keys.forEach((key, i) => { if (descriptors[i]) Object.defineProperty(window, key, descriptors[i]); else delete window[key]; });
    window.dispatchEvent(new Event('resize'));
  }
}
QA_DONE({diagnosticOnly: false, sampleResolution: SAMPLE_STEP, timeLimit: LIMIT_SECONDS, seeds: OPENING_SEEDS,
  acceptance: {firstShotSeconds: {ambushIntro: 3, ridingLegs: 1}, ridingPassiveQuietSeconds: 5, defensiveWins: true, leg1HealthAt10Seconds: 40,
    enemyIntroductionsPreserved: true},
  method: 'Independent seeded normal-health rides. The paired controls share each starting seed. No rendered-frame RNG, bot planes, free currency, injected enemies, manual damage or forced arrivals. Later builds are explicit node fixtures.',
  definitions: {visible: 'Living zombie body centre inside the playable view below the HUD',
    inViperRange: 'Living zombie within the actual Viper ground-range ellipse',
    nearTrain: 'Attached or within 40 ground pixels of the current car envelope',
    quiet: 'Game seconds between observed events, including the initial and final quiet stretches',
    defensiveInput: 'At most one real right click per second; focus climbers, a stopped wall, or the closest visible non-golden threat; return to escort when clear'},
  rows, narrowRows});
