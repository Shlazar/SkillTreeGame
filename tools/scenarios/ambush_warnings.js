// Run mode, also with QA_REDUCED=1: natural runner/brute warnings, viewport bounds and clock guards.
function check(ok, why) { if (!ok) throw new Error(why); }
function seeded(seed, run) {
  const random = Math.random;
  Math.random = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = random; }
}
function overlap(a, b) {
  return a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function defend(g, view) {
  const h = g.helis[0], visible = g.zombies.filter(z => !z.dead && !z.gone &&
    z.x - g.camX >= 0 && z.x - g.camX < view.W &&
    z.y - z.S.h * 0.5 - g.camY >= 19 && z.y - z.S.h * 0.5 - g.camY < view.VH);
  const score = z => (z.st === 2 ? -1000 : 0) + (z.type === 2 ? -600 : 0) +
    Math.hypot(z.x - h.x, (z.y - h.y) / 0.72);
  visible.sort((a, b) => score(a) - score(b));
  const z = visible[0];
  if (!z || h.order?.kind === 'attack' && h.order.z === z) return false;
  const x = z.x - g.camX, y = z.y - z.S.h * 0.5 - g.camY;
  __sr.rightDown(x, y); __sr.rightUp(x, y);
  return true;
}
function markerBounds() {
  const b = __sr.uiBounds(), h = b.hud, {W, VH} = b.viewport, rows = b.ambushWarnings;
  check(Array.isArray(rows), 'Copied incoming-warning bounds are missing');
  const controls = h ? [...h.counters, h.kills, ...Object.values(h.health), h.pause, h.speed,
    h.route?.label, h.route?.line, h.mute, ...h.warnings, b.radar, b.ram, ...b.weapons, ...b.planes] : [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    check(['x', 'y', 'w', 'h', 'seconds'].every(k => Number.isFinite(r[k])) &&
      r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 102 && r.x + r.w <= W && r.y + r.h <= VH,
      'Incoming marker leaves its play area: ' + JSON.stringify({r, viewport: b.viewport}));
    check(['RUNNERS', 'BRUTE'].includes(r.label) && r.seconds > 0,
      'Incoming marker has invalid label/countdown: ' + JSON.stringify(r));
    for (const c of controls) check(!overlap(r, c), 'Incoming marker overlaps a control: ' + JSON.stringify({r, c}));
    for (let j = 0; j < i; j++) check(!overlap(r, rows[j]), 'Incoming markers overlap each other');
  }
  return {viewport: b.viewport, markers: rows};
}
function frozenMarkers(g) {
  return JSON.stringify({run: g.run, trainS: g.tr.s, hp: g.tr.hp, markers: __sr.uiBounds().ambushWarnings});
}
const sizes = [[640, 360], [350, 500], [640, 266]], keys = ['innerWidth', 'innerHeight', 'devicePixelRatio'];
const original = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(window, k)])), rows = [];
try {
  for (const [width, height] of sizes) {
    for (const [key, value] of [['innerWidth', width], ['innerHeight', height], ['devicePixelRatio', 1]])
      Object.defineProperty(window, key, {configurable: true, value});
    window.dispatchEvent(new Event('resize'));
    rows.push(seeded(0xA8B01, () => {
      __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.leg(1, false); __sr.bot(false);
      const g = __sr.G, view = __sr.stats(), seen = new Map(), disappearances = [];
      check(g.tr.hp === g.up.hp && g.tr.hp === g.tr.max, 'Warning ride did not use normal health');
      let nextCommand = 0, commands = 0, freezeChecked = false, perf = null;
      for (let i = 0; i < 1800 && !g.result; i++) {
        if (g.run >= nextCommand) { commands += Number(defend(g, view)); nextCommand = g.run + 0.5; }
        __sr.sim(0.1);
        // Render ordinary frames too: the actual marker scene must work outside simulation-only tests.
        if (i % 5 === 0) __sr.frames(1);
        const a = __sr.ambushState(), bounds = markerBounds();
        for (const marker of bounds.markers) {
          const key = a.index + ':' + marker.label;
          if (!seen.has(key)) {
            const type = marker.label === 'BRUTE' ? 2 : 1, r = g.ambush.stops[a.index];
            const group = r.groups.find(x => x.type === type && x.warnedAt != null && x.sentAt == null);
            check(group && marker.seconds > 0, 'Marker did not come from a real pending group');
            seen.set(key, {index: a.index, label: marker.label, firstAt: g.run, seconds: marker.seconds,
              rect: {...marker}, group, checked: false});
            const before = JSON.stringify(__sr.uiBounds().ambushWarnings);
            bounds.markers[0].x = -999; bounds.markers[0].seconds = -1; bounds.markers[0].label = 'MUTATED';
            check(JSON.stringify(__sr.uiBounds().ambushWarnings) === before, 'Copied marker bounds changed production state');
          }
        }
        if (bounds.markers.length && !freezeChecked) {
          __sr.pause(true); const before = frozenMarkers(g); __sr.frames(60);
          check(frozenMarkers(g) === before, 'Pause advanced an incoming countdown');
          __sr.pause(false); __sr.hold(true); const held = frozenMarkers(g); __sr.frames(30);
          check(frozenMarkers(g) === held, 'Hold advanced an incoming countdown');
          __sr.hold(false); freezeChecked = true;
        }
        if (!perf && bounds.markers.length && g.zombies.length >= 6) {
          __sr.hold(true); __sr.frames(30);
          const before = frozenMarkers(g), bench = __sr.bench(60), cost = __sr.cost(20), late = __sr.late();
          check(frozenMarkers(g) === before, 'Timing a frozen warning changed its simulation state');
          check(bench < 8 && late <= 1, 'Busy warning rendering exceeded frame/atlas budget: ' + JSON.stringify({bench, cost, late}));
          perf = {at: g.run, alive: g.zombies.length, markers: __sr.uiBounds().ambushWarnings, bench, cost, late};
          __sr.hold(false);
        }
        for (const warning of seen.values()) if (!warning.checked && warning.group.sentAt != null && warning.group.spawned > 0) {
          const active = __sr.uiBounds().ambushWarnings;
          check(g.ambush.index !== warning.index || !active.some(r => r.label === warning.label),
            'A dispatched group retained its incoming marker');
          warning.checked = true;
          disappearances.push({index: warning.index, label: warning.label, sentAt: warning.group.sentAt,
            firstBirth: warning.group.firstAt, spawned: warning.group.spawned});
        }
      }
      const warnings = [...seen.values()].map(({group, ...w}) => w);
      check(g.result === 'won' && g.tr.hp > 0 && commands > 0, 'Normal-health warning ride did not arrive: ' + JSON.stringify({result: g.result, hp: g.tr.hp, ambush: __sr.ambushState()}));
      check(freezeChecked && warnings.some(w => w.label === 'RUNNERS') && warnings.some(w => w.label === 'BRUTE') &&
        warnings.every(w => w.checked) && __sr.uiBounds().ambushWarnings.length === 0,
        'Runner/brute warning lifecycle was not fully exercised');
      check(perf, 'No actual busy warning scene was sampled');
      return {window: {width, height}, viewport: view, normalHealth: {start: g.tr.max, end: g.tr.hp},
        duration: g.run, commands, warnings, disappearances, freezeChecked, perf, reduced: __sr.motionProbe(false).reduced};
    }));
  }
} finally {
  __sr.hold(false); __sr.pause(false);
  for (const key of keys) if (original[key]) Object.defineProperty(window, key, original[key]); else delete window[key];
  window.dispatchEvent(new Event('resize'));
}
QA_DONE({sizes: rows, viewportRestored: true, noForcedHealthKillsArrivals: true,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches});
