// Phase-four plane views use real key and canvas drag/release input.
function check(ok, message) { if (!ok) throw new Error(message); }
const PLANE_MAX = {a10: 1, a10Damage: 4, a10Cooldown: 5, a10Lines: 3, bombRun: 1, a10Charge: 1,
  f4: 1, fireDamage: 4, f4Cooldown: 5, fireLength: 3, fireWall: 1, f4Charge: 1,
  b52: 1, b52Bombs: 4, b52Cooldown: 4, b52Blast: 3, fireBombs: 1, b52Charge: 1};
function seeded(fn) {
  const original = Math.random; let seed = 0x410B252;
  Math.random = () => {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = original; }
}
function pointer(type, x, y, buttons = 1) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, button: type === 'pointermove' ? -1 : 0, buttons,
    pointerId: 1, pointerType: 'mouse', isPrimary: true,
    clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
}
function fresh(quiet = true) {
  __sr.hold(false); pointer('pointercancel', 4, 70, 0); __sr.reset();
  for (const [id, level] of Object.entries(PLANE_MAX)) check(__sr.node(id, level), 'Missing max plane node ' + id);
  for (const key of ['p_auto', 't_attack', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70); __sr.planes();
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.sim(8); __sr.frames(240);
}
function field() {
  const g = __sr.G, s = __sr.stats();
  return {g, s: g.tr.s, anchors: [], target: {x: s.W * 0.7, y: s.VH * 0.55}};
}
function advance(f, n) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.frames(1);
  }
}
function dragAim(f, id, standalone = true) {
  const before = JSON.stringify(__sr.save());
  check(__sr.planeFixture(id, 0), 'Temporary plane fixture failed for ' + id);
  check(JSON.stringify(__sr.save()) === before, 'Plane fixture changed saved ownership/loadout');
  __sr.press('q');
  check(__sr.planeAim().active && __sr.planeAim().id === id, 'Real Q key did not arm ' + id);
  pointer('pointerdown', f.target.x, f.target.y);
  pointer('pointermove', f.target.x + 55, f.target.y + 55);
  advance(f, 10);
  const aim = __sr.planeAim(), p = __sr.planes().find(p => p.id === id);
  check(aim.active && aim.id === id && p.strikes === 0 && p.charges > 0 &&
    (!standalone || __sr.planeShow().jets.length === 0), 'Held drag launched instead of previewing ' + id);
  return {before, aim, charges: p.charges};
}
function release(f, id, aim) {
  pointer('pointerup', f.target.x + 55, f.target.y + 55, 0);
  const p = __sr.planes().find(p => p.id === id), j = __sr.planeShow().jets.filter(j => j.id === id).slice(-1)[0];
  check(j && p.strikes === 1 && p.charges === aim.charges - 1 && !__sr.planeAim().active,
    'Actual pointer release did not consume one charge and launch ' + id);
  check(Math.abs(j.ux - Math.SQRT1_2) < 1e-6 && Math.abs(j.uy - Math.SQRT1_2) < 1e-6,
    'Real drag direction was not used');
  check(JSON.stringify(__sr.save()) === aim.before, 'Temporary plane launch changed save');
  return {p, j};
}
function planeShot(id, kind) {
  return seeded(() => {
    fresh(); const f = field(), h = f.g.helis[0];
    h.x = f.g.camX + f.target.x - 125; h.y = f.g.camY + f.target.y + 85;
    h.alt = 25; h.vx = h.vy = 0; h.order = {kind: 'move', x: h.x, y: h.y};
    for (let i = 0; i < 60; i++) {
      const d = -115 + (i % 15) * 230 / 14, lane = [-45, -15, 15, 45][Math.floor(i / 15)];
      const z = __sr.spawn(0, f.target.x + Math.SQRT1_2 * (d - lane), f.target.y + Math.SQRT1_2 * (d + lane));
      z.sp = 0; f.anchors.push({z, x: z.x, y: z.y});
    }
    const aim = dragAim(f, id);
    if (kind === 'strike') {
      const launched = release(f, id, aim);
      if (id === 'b2') {
        for (let i = 0; i < 500 && !__sr.planeShow().stats.b2.impacts; i++) advance(f, 1);
        advance(f, 30);
        check(__sr.planeShow().stats.b2.impacts === 1 && __sr.b2Fx().cores.length > 0,
          'B-2 strike view lacks its actual large impact');
      } else {
        for (let i = 0; i < 500; i++) {
          advance(f, 1);
          const j = __sr.planeShow().jets.find(j => j.id === id);
          if (j && j.s >= 0 && j.bodyVisible) break;
        }
        const show = __sr.planeShow(), j = show.jets.find(j => j.id === id);
        check(j && j.bodyVisible && j.roared, 'Strike view lacks visible ' + id);
        if (id === 'a10') check(j.lines === 4 && j.fired && f.g.kills > 0, 'Max four-line A-10 did not hit actual crowd');
        if (id === 'f4') check(j.len === 368 && j.fireWall && __sr.fires().some(p => p.source === 'f4' && p.wall), 'Max F-4 strike lacks real burning wall');
        if (id === 'b52') check(j.bombCount === 16 && show.activeBombs.some(b => b.source === 'b52' && b.visible), 'Max B-52 strike lacks actual falling row');
      }
    }
    __sr.hp(80); __sr.hold(true); __sr.frames(1);
    return {id, kind, target: f.target, aim: __sr.planeAim(), planes: __sr.planes(),
      show: __sr.planeShow(), fx: __sr.fx(), fires: __sr.fires(), kills: f.g.kills, heli: __sr.helis()[0]};
  });
}

function planePerformance(overload = false) {
  return seeded(() => {
    fresh(false); __sr.bot(true); __sr.sim(overload ? 30 : 20); __sr.frames(overload ? 10 : 30); __sr.bot(false);
    const natural = __sr.stats();
    check(!__sr.G.result && natural.hp > 0 && natural.kills > 0, 'Combined plane check missed its live busy ride');
    const f = field(), saveBefore = JSON.stringify(__sr.save()), launches = [];
    if (overload) __sr.crowd(300, f.target.x, f.target.y, 100, 0);
    const before = __sr.planeShow().stats;
    for (const id of ['a10', 'f4', 'b52', 'b2']) {
      const aim = dragAim(f, id, false), launched = release(f, id, aim);
      launches.push({id, resources: launched.p, payload: launched.j});
    }
    check(JSON.stringify(__sr.save()) === saveBefore && __sr.save().hangar.length === 2,
      'Combined runtime fixtures changed the saved two-slot Hangar');
    let peak = {booms: 0, rings: 0, parts: 0, fires: 0, bombs: 0, jets: 0};
    const risingSamples = []; let measuredBooms = 0;
    function observe() {
      const fx = __sr.fx(), show = __sr.planeShow();
      for (const key of ['booms', 'rings', 'parts']) peak[key] = Math.max(peak[key], fx[key] || 0);
      peak.fires = Math.max(peak.fires, __sr.fires().length);
      peak.bombs = Math.max(peak.bombs, show.activeBombs.length); peak.jets = Math.max(peak.jets, show.jets.length);
    }
    for (let i = 0; i < 500 && __sr.planeShow().stats.b2.impacts === before.b2.impacts; i++) {
      advance(f, 1); observe();
      const booms = __sr.fx().booms;
      if (risingSamples.length < 7 && booms >= measuredBooms + 20) {
        measuredBooms = booms; risingSamples.push(sample());
      }
    }
    advance(f, 6); observe();
    function sample() {
      return {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), fx: __sr.fx(),
        fires: __sr.fires(), show: __sr.planeShow(), stats: __sr.stats(), late: __sr.late()};
    }
    const early = sample(); advance(f, 24); observe(); const expanded = sample();
    const final = __sr.planeShow();
    check(final.stats.b2.impacts === before.b2.impacts + 1 && final.stats.b52.impacts > before.b52.impacts &&
      peak.jets >= 4 && peak.bombs > 0 && peak.fires > 0 && peak.booms > 0,
      'Combined peak did not exercise all real plane payloads');
    for (const art of [final.art.jet, final.art.f4, final.art.b52, final.art.b2]) {
      check(art.normal === 32 && art.shadow === 32 && art.hot === 32, 'Plane headings/hot variants were not cached');
    }
    const samples = [...risingSamples, early, expanded];
    const performance = {bench: Math.max(...samples.map(s => s.bench)),
      cost: samples.reduce((worst, s) => s.cost.render > worst.render ? s.cost : worst, samples[0].cost),
      risingSamples, early, expanded, peak, launches, natural, overload, injectedCrowd: overload ? 300 : 0,
      setup: {seconds: overload ? 30 : 20, settlingFrames: overload ? 10 : 30},
      targetMs: 8, late: Math.max(...samples.map(s => s.late))};
    check(performance.late <= 1, 'Combined plane effects created late sprite pages');
    __sr.clearPlaneFixture();
    check(JSON.stringify(__sr.save()) === saveBefore && !__sr.planes().some(p => p.id === 'b2'),
      'Cleared fixtures left B-2 production ownership/resources');
    return performance;
  });
}

const result=[];
for (const id of ['a10','f4','b52','b2']) {
  planeShot(id,'strike');
  for (const mode of [1,2]) { __sr.thermal(mode); __sr.frames(30); check(__sr.late()<=1,'Thermal sprite pages grew'); }
  result.push({id,art:__sr.planeShow().art}); __sr.thermal(0);
}
QA_DONE({bothThermalModesRendered:true,planes:result,late:__sr.late()});
