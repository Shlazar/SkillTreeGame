// shot mode: all train systems in sustained combat, actual simultaneous firing, and standard performance.
function check(ok, message) { if (!ok) throw new Error(message); }
const TRAIN_MAX = {armor: 6, mgCar: 1, mgDamage: 5, mgRate: 5, mgRange: 3, mgTurrets: 2, apRounds: 1,
  katyusha: 1, katyushaRockets: 4, katyushaReload: 4, katyushaBlast: 3, clusterRockets: 1,
  ram: 1, ramPower: 4, ramCooldown: 4, ramDuration: 3, shockwave: 1,
  steamVent: 1, steamDamage: 4, steamSpeed: 4, steamReach: 3, hotCloud: 1};
function freshAll(quiet = false, extended = false) {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  for (const [id, level] of Object.entries(TRAIN_MAX)) check(__sr.node(id, level), 'Missing train node ' + id);
  for (const key of ['p_auto', 't_attack', 'p_brute', 'currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  let endpoint = null;
  if (extended) {
    // Read a genuine distant rail endpoint before creating the G whose counters are measured.
    __sr.leg(12); endpoint = {s: __sr.G.goalS, y: __sr.G.goalY};
  }
  __sr.leg(1); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  const g = __sr.G;
  if (extended) { g.goalS = endpoint.s; g.goalY = endpoint.y; g.station = null; g.walls.length = 0; }
  if (quiet) {
    const h = g.helis[0];
    g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
    g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
    h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  }
  return endpoint;
}
function counts() {
  const u = __sr.units(), r = __sr.ramInfo(), s = __sr.steam();
  return {mgShots: u.mg.shots, mgKills: u.mg.kills, katSalvos: u.katyusha.salvos, katShots: u.katyusha.shots,
    katKills: u.katyusha.kills, ramUses: r.uses, ramKills: r.total, shocks: r.shocks,
    steamBursts: s.bursts, steamKills: s.kills, cloudKills: s.cloudKills};
}
function field() { return {g: __sr.G, s: __sr.G.tr.s, anchors: []}; }
function add(f, x, y, type = 0) {
  const z = __sr.spawn(type, x - f.g.camX, y - f.g.camY);
  z.sp = 0; z.block = []; z.blockT = 1000000; f.anchors.push({z, x, y}); return z;
}
function advance(f, n) {
  for (let i = 0; i < n; i++) {
    f.g.tr.s = f.s; f.g.tr.v = 0;
    for (const a of f.anchors) if (!a.z.dead && a.z.st !== 2) {
      a.z.x = a.x; a.z.y = a.y; a.z.vx = a.z.vy = a.z.kbx = a.z.kby = 0;
    }
    __sr.sim(1 / 60); check(!f.g.result, 'Combined shot unexpectedly arrived');
  }
}
function trainShot(camera = 0) {
  freshAll(true); __sr.thermal(camera);
  // Opening tips/banner settle in real UI time, before the weapon clocks begin.
  __sr.pause(true); __sr.frames(240); __sr.pause(false);
  const f = field(); advance(f, 530);
  let c = f.g.tr.cars[0];
  for (let i = 0; i < 24; i++) add(f, c.x0 + c.dx * 65 + c.nx * 75 + (i % 6 - 2.5) * 5,
    c.y0 + c.dy * 65 + c.ny * 75 + (Math.floor(i / 6) - 1.5) * 4);
  advance(f, 52); //9.7s: the real fourteen-rocket salvo is already in progress.
  __sr.press(' '); check(__sr.ramInfo().on, 'Actual Space did not start pictured Ram');
  c = f.g.tr.cars[0];
  for (const across of [-6, 0, 6]) add(f, c.x0 + c.nx * across + c.dx * 3, c.y0 + c.ny * across + c.dy * 3);
  advance(f, 17); //9.983s: climbers are added immediately before the10s burst.
  for (let car = 0; car < 5; car++) for (const side of [-1, 1]) {
    const k = f.g.tr.cars[car], z = add(f, k.cx + k.nx * side * 10, k.cy + k.ny * side * 10);
    Object.assign(z, {st: 2, car, side, al: 0, ox: 0, dmg: 0, dps: 0, bang: 0});
  }
  advance(f, 21); //10.333s: white puffs have grown while late rockets still arc.
  c = f.g.tr.cars[3];
  for (const along of [-12, -4, 4, 12]) add(f, c.cx + c.nx * 55 + c.dx * along, c.cy + c.ny * 55 + c.dy * along);
  advance(f, 1);
  const u = __sr.units(), ram = __sr.ramInfo(), steam = __sr.steam(), fired = counts();
  check(u.mg.turrets.some(t => t.flash > 0) && u.mg.kills > 0 && u.katyusha.inFlight > 0 && u.katyusha.kills > 0 &&
    ram.powered && ram.total > 0 && steam.cloud && steam.kills > 0 && f.g.run - steam.lastBurst.t >= 0.3,
    'Combined view lacks actual MG fire, rockets, powered Ram or grown Steam: ' + JSON.stringify({fired, u, ram, steam}));
  __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
  return {camera, fired, units: u, ram, steam, fx: __sr.fx(), hp: __sr.stats().hp,
    crop: {x: Math.round(f.g.tr.cars[2].cx - f.g.camX - 55),
      y: Math.round(f.g.tr.cars[0].y0 - f.g.camY - 30), w: 110, h: 180, scale: 4}};
}
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}


trainShot(1);
