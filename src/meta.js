// meta.js - what lasts from run to run: the bank of cash, the upgrade levels, the trips cleared,
// the camp (everyone ever brought home, each worth +0.5% cash for ever), the station layout and the
// best scores. Saved in localStorage (in memory only when storage is blocked).
// Also the upgrade table, upgrade prices, the numbers of each trip, and the stats a run uses (G.k).

const META_KEY = 'sky-reaper-meta-v1';
const META = {};
// a fresh save
function metaDefaults() {
  return {
    v: 1, cash: 0,
    lv: { dmg: 0, rate: 0, cannon: 0, rotors: 0, bounty: 0, armor: 0, cow: 0, boiler: 0, gunners: 0,
      mg: 1, mortar: 0, tesla: 0, sniper: 0, pads: 0 },
    trip: 1, maxTrip: 1, cleared: [], perfect: [], camp: 0,
    layout: ['mg', 'mg', null, null, null, null], pin: null, hints: {}, best: { kills: 0, safe: 0 }, played: false
  };
}

// ---------- the upgrades
// group (0 helicopter, 1 train, 2 station), name, max level, price base and growth (the price of the
// next level = base x growth^(L - start)), start level, the trip that shows it (towers), a few faint
// words on its card (role), what level L gives (val(L) + unit, shown "now > next"), and a longer line
// for the info strip (info(L)).
const tw1 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const UPG = [
  { id: 'dmg', group: 0, name: '25MM DAMAGE', max: 30, base: 80, growth: 1.45, role: 'BRUTES + BOSSES',
    val: (L) => fmtNum(1.25 ** L), unit: 'DMG',
    info: (L) => 'EACH ROUND HITS FOR ' + fmtNum(1.25 ** L) + '. WALKERS DIE TO ONE ROUND ANYWAY: THIS IS FOR BRUTES AND BOSSES.' },
  { id: 'rate', group: 0, name: '25MM RATE', max: 10, base: 100, growth: 1.5, role: 'FIRE FASTER',
    val: (L) => String(12 + L), unit: 'ROUNDS/S',
    info: (L) => (12 + L) + ' ROUNDS A SECOND, AND EACH ONE HEATS THE GUN ' + Math.round(100 - 100 * 0.92 ** L) + '% LESS.' },
  { id: 'cannon', group: 0, name: '105MM CANNON', max: 30, base: 120, growth: 1.45, role: 'BIGGER BLASTS',
    val: (L) => tw1(2.4 - 0.06 * Math.min(L, 20)) + 'S', unit: 'RELOAD',
    info: (L) => 'RELOAD ' + tw1(2.4 - 0.06 * Math.min(L, 20)) + 'S.  KILL RADIUS ' + (34 + Math.min(L, 20)) + 'PX.  BOSS HIT ' + fmtNum(20 * 1.25 ** L) + '.' },
  { id: 'rotors', group: 0, name: 'ROTORS', max: 5, base: 150, growth: 2, role: 'FLY FAR, FIND MORE',
    val: (L) => String(470 + 40 * L), unit: 'PX RANGE',
    info: (L) => 'FLY ' + (470 + 40 * L) + 'PX FROM THE TRAIN, ' + Math.round(6 * L) + '% FASTER. ' + (L ? L + ' DEEP CRATE' + (L > 1 ? 'S' : '') + ' FAR OUT ON EACH TRIP.' : 'EACH LEVEL HIDES A DEEP CRATE FAR OUT.') },
  { id: 'bounty', group: 0, name: 'BOUNTY', max: 30, base: 200, growth: 1.5, role: 'ALL CASH UP',
    val: (L) => '+' + (10 * L) + '%', unit: 'CASH',
    info: (L) => 'EVERY DOLLAR YOU EARN IS WORTH ' + (10 * L) + '% MORE.' },
  { id: 'armor', group: 1, name: 'ARMOR', max: 30, base: 60, growth: 1.42, role: 'TRAIN HEALTH',
    val: (L) => String(150 + 20 * L), unit: 'TRAIN HP',
    info: (L) => 'THE TRAIN HAS ' + (150 + 20 * L) + ' HP. A ZOMBIE ON IT TEARS OFF 0.5 HP A SECOND, A BRUTE 2.' },
  { id: 'cow', group: 1, name: 'COW CATCHER', max: 5, base: 100, growth: 1.6, role: 'RAM THE DEAD',
    val: (L) => (15 - 2 * L) + '%', unit: 'SPEED LOST',
    info: (L) => 'RUNNING ONE DOWN COSTS ' + (15 - 2 * L) + '% SPEED (A BRUTE ' + (65 - 5 * L) + '%) AND ' + Math.round(100 - 15 * L) + '% DAMAGE.' },
  { id: 'boiler', group: 1, name: 'BOILER', max: 5, base: 100, growth: 1.6, role: 'FAST GEAR',
    val: (L) => String(40 + 3 * L), unit: 'PX/S FAST',
    info: (L) => 'FAST GEAR RUNS AT ' + (40 + 3 * L) + ' PX/S. THE TRAIN GETS BACK TO SPEED ' + (7 + L) + ' PX/S EACH SECOND.' },
  { id: 'gunners', group: 1, name: 'ROOF GUNNERS', max: 10, base: 150, growth: 1.55, role: 'RIDERS SHOOT',
    val: (L) => fmtNum(gunShots(L)), unit: 'SHOTS/S',
    info: (L) => L ? Math.min(4, L) + ' RIDER' + (L > 1 ? 'S' : '') + ' SHOOT EVERY ' + tw1(gunGap(L)) + 'S AT THE DEAD CLOSE TO THE TRAIN (HALF YOUR 25MM DAMAGE).' : 'THE RIDERS ON THE FLATCAR PICK UP RIFLES AND SHOOT THE DEAD THAT CLIMB ON.' },
  { id: 'mg', group: 2, name: 'MG NEST', max: 30, base: 100, growth: 1.45, start: 1, role: 'RUNNERS, GRABBERS',
    val: (L) => fmtNum((2.5 + 0.15 * (L - 1)) * 1.2 ** (L - 1)), unit: 'DPS',
    info: (L) => 'STATION TOWER. RANGE ' + Math.min(120, 80 + 2 * (L - 1)) + 'PX, ' + fmtNum(Math.min(6, 2.5 + 0.15 * (L - 1))) + ' SHOTS/S, ' + fmtNum(1.2 ** (L - 1)) + ' DAMAGE. SHOOTS GRABBERS FIRST.' },
  { id: 'mortar', group: 2, name: 'MORTAR', max: 30, base: 300, growth: 1.45, trip: 2, role: 'CROWDS',
    val: (L) => fmtNum(8 * 1.25 ** (L - 1)), unit: 'BLAST DMG',
    info: (L) => 'STATION TOWER. SHELLS THE THICKEST CROWD EVERY ' + tw1(Math.max(1.5, 3.5 - 0.1 * (L - 1))) + 'S. KILLS WALKERS IN ' + Math.min(34, 22 + L - 1) + 'PX, HITS BRUTES FOR ' + fmtNum(8 * 1.25 ** (L - 1)) + '.' },
  { id: 'tesla', group: 2, name: 'TESLA COIL', max: 30, base: 250, growth: 1.45, trip: 3, role: 'THE DOOR',
    val: (L) => fmtNum(3 * 1.2 ** (L - 1)), unit: 'ZAP DMG',
    info: (L) => 'STATION TOWER. ZAPS ' + Math.min(8, 2 + Math.floor((L - 1) / 3)) + ' ZOMBIES AT ONCE FOR ' + fmtNum(3 * 1.2 ** (L - 1)) + '. A ZAP FREES A GRABBED SURVIVOR.' },
  { id: 'sniper', group: 2, name: 'SNIPER', max: 30, base: 500, growth: 1.45, trip: 4, role: 'BRUTES + BOSSES',
    val: (L) => fmtNum(15 * 1.25 ** (L - 1)), unit: 'SHOT DMG',
    info: (L) => 'STATION TOWER. ONE SHOT EVERY ' + tw1(Math.max(1, 2 - 0.05 * (L - 1))) + 'S FOR ' + fmtNum(15 * 1.25 ** (L - 1)) + ', THROUGH 3 ZOMBIES. X3 ON AN OPEN WEAK POINT.' },
  { id: 'pads', group: 2, name: 'PADS', max: 4, base: 400, growth: 3, role: 'MORE TOWERS',
    val: (L) => String(2 + L), unit: 'PADS',
    info: (L) => (2 + L) + ' OF 6 BUILD PADS AT THE STATION. EACH PAD HOLDS ONE TOWER.' }
];
// roof gunners: the gap between two shots of one rider, and shots a second from all of them
const gunGap = (L) => (L > 4 ? 1.2 * 0.85 ** (L - 4) : 1.2);
const gunShots = (L) => (L ? Math.min(4, L) / gunGap(L) : 0);
const UPGMAP = {};
for (const u of UPG) UPGMAP[u.id] = u;
const GROUPS = ['HELICOPTER', 'TRAIN', 'STATION'];
// a short number: 2, 2.4, 12, 1.2K
const fmtNum = (v) => v < 10 ? String(Math.round(v * 10) / 10) : fmt(v);

const lvl = (id) => META.lv[id] || 0;
const upgMaxed = (id) => lvl(id) >= UPGMAP[id].max;
const upgLocked = (id) => (UPGMAP[id].trip || 1) > META.maxTrip;
function upgCost(id) {
  const u = UPGMAP[id];
  return Math.round(u.base * u.growth ** (lvl(id) - (u.start || 0)));
}
// Buy the next level of upgrade id with banked cash. True when it was bought.
function buyUpg(id) {
  const u = UPGMAP[id];
  if (!u || upgMaxed(id) || upgLocked(id)) return false;
  const c = upgCost(id);
  if (META.cash < c) return false;
  META.cash -= c;
  META.lv[id] = lvl(id) + 1;
  // a tower built for the first time goes on a free pad
  if (u.group === 2 && id !== 'pads' && META.lv[id] === 1) {
    const free = META.layout.findIndex((t, i) => !t && i < 2 + lvl('pads'));
    if (free >= 0) META.layout[free] = id;
  }
  if (META.pin === id && upgMaxed(id)) META.pin = null;
  saveMeta();
  return true;
}
// how many cards the wallet w could buy now (one level each)
function affordableCount(w) {
  let n = 0;
  for (const u of UPG) if (!upgMaxed(u.id) && !upgLocked(u.id) && upgCost(u.id) <= w) n++;
  return n;
}
// The card to save up for: the pinned one, or else the cheapest one the wallet w cannot pay yet.
function nextTarget(w) {
  if (META.pin && !upgMaxed(META.pin) && !upgLocked(META.pin)) return META.pin;
  let best = null, bc = Infinity;
  for (const u of UPG) {
    if (upgMaxed(u.id) || upgLocked(u.id)) continue;
    const c = upgCost(u.id);
    if (c > w && c < bc) { bc = c; best = u.id; }
  }
  return best;
}

// ---------- trips
const BOSSES = ['butcher', 'spitter', 'brood'];
const BOSS_NAME = { butcher: 'THE BUTCHER', spitter: 'THE SPITTER', brood: 'THE BROOD MOTHER' };
// Everything that changes from trip to trip.
function tripInfo(T) {
  const t = T - 1;
  return {
    T, mult: 1.15 ** t, bruteHp: 8 * 1.2 ** t,
    start: Math.min(220, 110 + 10 * t), perSec: Math.min(7, 3.5 + 0.25 * t), cap: Math.min(520, 400 + 15 * t),
    runner: Math.min(0.3, 0.12 + 0.015 * t), brute: Math.min(0.2, 0.05 + 0.01 * t), railExtra: Math.floor(t / 3),
    people: Math.min(14, 8 + Math.floor(t / 2)), bossHp: 1.3 ** t, bossDmg: 1.1 ** t,
    firstClear: Math.round(300 * 1.15 ** t), boss: BOSSES[t % 3], twin: T % 6 === 0
  };
}
// All cash is multiplied: by the trip, by BOUNTY and by the camp.
const cashMult = (T) => 1.15 ** (T - 1) * (1 + 0.1 * lvl('bounty')) * (1 + 0.005 * META.camp);

// The stats of a run, from the upgrade levels.
function runStats() {
  const L = lvl;
  return {
    mgDmg: 1.25 ** L('dmg'), mgRate: 12 + L('rate'), heatPer: 0.025 * 0.92 ** L('rate'),
    heReload: 2.4 - 0.06 * Math.min(L('cannon'), 20), heKill: 34 + Math.min(L('cannon'), 20),
    heBoss: 20 * 1.25 ** L('cannon'), heRing: 4 * 1.25 ** L('cannon'),
    leash: 470 + 40 * L('rotors'), heliSpeed: 170 * (1 + 0.06 * L('rotors')),
    trainMax: 150 + 20 * L('armor'), fullSpeed: 40 + 3 * L('boiler'), accel: 7 + L('boiler'),
    crushLoss: 0.15 - 0.02 * L('cow'), crushBrute: 0.65 - 0.05 * L('cow'), crushDmg: 1 - 0.15 * L('cow'), cow: L('cow'),
    gunners: Math.min(4, L('gunners')), gunRate: gunGap(L('gunners')),
    deep: L('rotors'), pads: 2 + L('pads'),
    tower: { mg: L('mg'), mortar: L('mortar'), tesla: L('tesla'), sniper: L('sniper') }
  };
}
// The stats with no upgrades (the demo behind the title).
function baseStats() {
  const keep = META.lv;
  META.lv = metaDefaults().lv;
  const k = runStats();
  META.lv = keep;
  return k;
}

// ---------- save and load
function loadMeta() {
  Object.assign(META, metaDefaults());
  let o = null;
  try { o = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { o = null; }
  if (o && typeof o === 'object') {
    const num = (v, lo, hi, d) => (Number.isFinite(+v) ? clamp(+v, lo, hi) : d);
    META.cash = num(o.cash, 0, 1e15, 0);
    for (const u of UPG) META.lv[u.id] = Math.floor(num(o.lv && o.lv[u.id], u.start || 0, u.max, u.start || 0));
    META.maxTrip = Math.floor(num(o.maxTrip, 1, 9999, 1));
    META.trip = Math.floor(num(o.trip, 1, META.maxTrip, 1));
    META.camp = Math.floor(num(o.camp, 0, 1e9, 0));
    META.cleared = Array.isArray(o.cleared) ? o.cleared.filter((t) => Number.isInteger(t)) : [];
    META.perfect = Array.isArray(o.perfect) ? o.perfect.filter((t) => Number.isInteger(t)) : [];
    if (Array.isArray(o.layout)) META.layout = [0, 1, 2, 3, 4, 5].map((i) => (UPGMAP[o.layout[i]] && UPGMAP[o.layout[i]].group === 2 && o.layout[i] !== 'pads' ? o.layout[i] : null));
    META.pin = UPGMAP[o.pin] ? o.pin : null;
    META.hints = o.hints && typeof o.hints === 'object' ? o.hints : {};
    META.best = { kills: Math.floor(num(o.best && o.best.kills, 0, 1e9, 0)), safe: Math.floor(num(o.best && o.best.safe, 0, 1e9, 0)) };
    META.played = !!o.played;
  } else {
    // the best score of the old save
    try {
      const b = JSON.parse(localStorage.getItem('sky-reaper-escort') || 'null');
      if (b) META.best = { kills: Math.max(0, b.kills | 0), safe: Math.max(0, b.safe | 0) };
    } catch (e) { /* nothing to bring over */ }
  }
}
function saveMeta() {
  try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) { /* storage blocked: kept in memory */ }
}
function resetMeta() {
  const keepBest = META.best;
  Object.assign(META, metaDefaults());
  META.best = keepBest;
  saveMeta();
}
// Show a hint the first time only.
function hintOnce(id, text) {
  if (META.hints[id]) return;
  META.hints[id] = 1;
  saveMeta();
  banner(text, '', U.ink, 1);
}
