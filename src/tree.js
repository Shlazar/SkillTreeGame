// tree.js - the skill tree. One table, NODES, drives all of it: the map on the SKILL TREE tab of the
// Depot, how each node looks, the tooltip (what it does, NOW > NEXT, the price), buying, and the goal
// line under the summary. What a node does in a run is read from the UP numbers (game.js, and the new
// ones below), the same numbers the tooltip shows.
// The look: a dark starry panel with glowing nodes and lines around VIPER. Drag to move the map,
// use the wheel to zoom, and C to centre it. Blue is scrap, orange is survivors, and gold is gold.

// ---------- colours and numbers
// Each kind of node: c = bright, m = mid, d = dark (the body when maxed), g = its glow.
const NODE_KIND = {
  root: { c: '#ffd36a', m: '#a07a30', d: '#2e2410', g: '#ffb040' },
  scrap: { c: '#62c8ff', m: '#2f6f9e', d: '#0b2234', g: '#2a9dff' },
  surv: { c: '#ffa448', m: '#a55a1e', d: '#331b08', g: '#ff7a1a' },
  gold: { c: '#ffd36a', m: '#a07a30', d: '#2e2410', g: '#ffb040' },
  tease: { c: '#3a4458', m: '#202838', d: '#10141c', g: '#3a4458' }
};
// A value with its unit, for the tooltip. (2 px on the ground = 1 m.)
const perS = (v) => +v.toFixed(1) + '/S', secs = (v) => +v.toFixed(1) + ' S', metres = (px) => Math.round(px / 2) + ' M';
const pctS = (v) => Math.round(v * 100) + '%';
const TRACKS = {
  A: [15, 23, 34, 51, 76, 114, 171, 256],
  B: [20, 30, 45, 68, 101, 152],
  C: [25, 38, 56, 84, 127],
  D: [30, 45, 68, 101, 152],
  E: [40, 60, 90, 135],
  F: [40, 64, 102, 164]
};

// ---------- node values
// These are the demo's numbers at level l. New weapons read them when their systems are added;
// treeUp below bridges only the weapons that are already active.
Object.assign(UP, {
  hdmg: (l) => 1 + 0.2 * l,
  hrate: (l) => 1 + 0.12 * l,
  hrange: (l) => 1 + 0.15 * l,
  rockets: (l) => [0, 0.05, 0.08, 0.11, 0.14, 0.18][l],
  podDamage: (l) => 1 + 0.25 * l,
  podReload: (l) => [8, 7, 6, 5.5, 5][l],
  podSalvo: (l) => 4 + l,
  napalm: (l) => l ? 3 : 0,
  hellfireDamage: (l) => 1 + 0.3 * l,
  hellfireReload: (l) => 10 - l,
  hellfireBlast: (l) => 1 + 0.2 * l,
  doubleHellfire: (l) => l ? 2 : 1,
  mgDamage: (l) => 1 + 0.25 * l,
  mgRate: (l) => 2 * (1 + 0.15 * l),
  mgRange: (l) => 1 + 0.15 * l,
  mgTurrets: (l) => 1 + l,
  apRounds: (l) => l ? 3 : 1,
  katyushaRockets: (l) => 6 + 2 * l,
  katyushaReload: (l) => 15 - 1.5 * l,
  katyushaBlast: (l) => 1 + 0.2 * l,
  clusterRockets: (l) => l ? 3 : 0,
  ramPower: (l) => 1 + 0.3 * l,
  ramCooldown: (l) => 20 - 2 * l,
  ramDuration: (l) => 2 + 0.5 * l,
  shockwave: (l) => l > 0,
  steamDamage: (l) => 1 + 0.25 * l,
  steamSpeed: (l) => [5, 4.4, 3.8, 3.2, 2.5][l],
  steamReach: (l) => l,
  hotCloud: (l) => l ? 2 : 0,
  a10Damage: (l) => 1 + 0.25 * l,
  a10Cooldown: (l) => [25, 22, 19, 16, 14, 12][l],
  a10Lines: (l) => 1 + l,
  bombRun: (l) => l ? 4 : 0,
  a10Charge: (l) => 1 + l,
  fireDamage: (l) => 1 + 0.25 * l,
  f4Cooldown: (l) => 30 - 3 * l,
  fireLength: (l) => 1 + 0.2 * l,
  fireDuration: (l) => 4 + l,
  fireWall: (l) => l ? 12 : 4,
  f4Charge: (l) => 1 + l,
  b52Bombs: (l) => 8 + 2 * l,
  b52Cooldown: (l) => 45 - 5 * l,
  b52Blast: (l) => 1 + 0.2 * l,
  fireBombs: (l) => l > 0,
  b52Charge: (l) => 1 + l,
  salvageCrew: (l) => 0.08 * l,
  silverHunt: (l) => l,
  boomHunt: (l) => l,
  goldHunt: (l) => l
});

// ---------- the nodes
// p is the neighbouring parent, x/y are 36 px cells, and cost has one price per level.
// Explicit currencies keep table data and buying consistent. Charges are single-level gold nodes.
function scrapNode(id, name, p, x, y, track, levels, desc, stat, stat2) {
  return { id, name, k: 'scrap', p, x, y, cost: typeof track === 'string' ? TRACKS[track].slice(0, levels) : track.slice(),
    cur: 'scrap', desc, stat, stat2 };
}
function unlockNode(id, name, p, x, y, desc, stat, stat2) {
  return { id, name, k: 'surv', p, x, y, cost: [1], cur: 'surv', star: true, desc, stat, stat2 };
}
function goldNode(id, name, p, x, y, cost, desc, stat, charge = false) {
  return { id, name, k: 'gold', p, x, y, cost, cur: 'gold', charge, desc, stat };
}
function teaseNode(id, name, p, x, y) {
  return { id, name, k: 'tease', p, x, y, cost: [], cur: 'scrap', desc: 'AVAILABLE IN THE FULL GAME.' };
}
const NODES = [
  { id: 'root', name: 'VIPER', k: 'root', x: 0, y: 0, cost: [0], cur: 'scrap',
    desc: 'YOUR HELI FLIES AND FIRES BY ITSELF.', stat: ['GUN', () => '4/S, 2 HITS'] },
  // HELI: north
  scrapNode('hdmg', 'GUN DAMAGE', 'root', -1.5, -1.5, 'A', 8, 'EVERY BULLET HITS 20% HARDER.', ['DAMAGE', (l) => pctS(UP.hdmg(l))]),
  scrapNode('hrate', 'FIRE RATE', 'root', 0, -1.5, 'B', 6, 'FIRE 12% MORE SHOTS PER SECOND.', ['FIRE RATE', (l) => perS(4 * UP.hrate(l))]),
  scrapNode('hrange', 'GUN RANGE', 'hrate', 0, -3, 'C', 4, 'THE GUN REACHES 15% FURTHER.', ['RANGE', (l) => pctS(UP.hrange(l))]),
  goldNode('rockets', 'ROCKETS', 'hrange', -1.5, -4.5, [4, 6, 8, 10, 12], 'BULLETS SOMETIMES BECOME ROCKETS.', ['ROCKET CHANCE', (l) => pctS(UP.rockets(l))]),
  unlockNode('rocketPods', 'ROCKET PODS', 'rockets', -3, -6, 'FIRE FOUR ROCKETS AT A CROWD.', ['SALVO', (l) => l ? '4 / 8 S' : 'NONE']),
  scrapNode('podDamage', 'POD DAMAGE', 'rocketPods', -3, -7.5, 'C', 4, 'POD ROCKETS HIT 25% HARDER.', ['DAMAGE', (l) => pctS(UP.podDamage(l))]),
  scrapNode('podReload', 'POD RELOAD', 'podDamage', -3, -9, 'C', 4, 'RELOAD THE PODS MORE QUICKLY.', ['RELOAD', (l) => secs(UP.podReload(l))]),
  scrapNode('podSalvo', 'POD SALVO', 'podReload', -3, -10.5, 'E', 3, 'ADD ONE ROCKET TO EACH SALVO.', ['ROCKETS', UP.podSalvo]),
  goldNode('napalm', 'NAPALM', 'podSalvo', -3, -12, [12], 'POD ROCKETS LEAVE BURNING GROUND.', ['BURN', (l) => secs(UP.napalm(l))]),
  unlockNode('hellfire', 'HELLFIRE', 'hrange', 1.5, -4.5, 'HIT THE TOUGHEST TARGET IN RANGE.', ['MISSILES', (l) => l ? '1 / 10 S' : 'NONE']),
  scrapNode('hellfireDamage', 'HELLFIRE DAMAGE', 'hellfire', 1.5, -6, 'C', 4, 'MISSILES HIT 30% HARDER.', ['DAMAGE', (l) => pctS(UP.hellfireDamage(l))]),
  scrapNode('hellfireReload', 'HELLFIRE RELOAD', 'hellfireDamage', 1.5, -7.5, 'C', 4, 'FIRE THE NEXT MISSILE SOONER.', ['RELOAD', (l) => secs(UP.hellfireReload(l))]),
  scrapNode('hellfireBlast', 'HELLFIRE BLAST', 'hellfireReload', 1.5, -9, 'E', 3, 'MISSILE BLASTS GROW BY 20%.', ['BLAST', (l) => pctS(UP.hellfireBlast(l))]),
  goldNode('doubleHellfire', 'DOUBLE HELLFIRE', 'hellfireBlast', 1.5, -10.5, [12], 'FIRE AT TWO DIFFERENT TARGETS.', ['MISSILES', UP.doubleHellfire]),
  teaseNode('doorGunner', 'DOOR GUNNER', 'hrange', -1.5, -3),
  teaseNode('apache', 'APACHE', 'rocketPods', -4.5, -6),
  // TRAIN: cars north-east, gadgets south-east
  scrapNode('armor', 'TRAIN ARMOR', 'root', 1.5, 0, 'A', 6, 'ADD 15% MORE TRAIN HEALTH.', ['TRAIN HP', (l) => Math.round(UP.hp(l))]),
  unlockNode('mgCar', 'MG CAR', 'armor', 3, -1.5, 'ADD A TURRET TO THE TRAIN.', ['TURRETS', (l) => l ? 1 : 'NONE'], ['FIRE RATE', (l) => l ? '2/S' : 'NONE']),
  scrapNode('mgDamage', 'MG DAMAGE', 'mgCar', 4.5, -1.5, 'B', 5, 'TURRET BULLETS HIT 25% HARDER.', ['DAMAGE', (l) => pctS(UP.mgDamage(l))]),
  scrapNode('mgRate', 'MG FIRE RATE', 'mgDamage', 6, -1.5, 'B', 5, 'TURRETS FIRE 15% FASTER.', ['FIRE RATE', (l) => perS(UP.mgRate(l))]),
  scrapNode('mgRange', 'MG RANGE', 'mgRate', 7.5, -1.5, 'C', 3, 'TURRETS REACH 15% FURTHER.', ['RANGE', (l) => pctS(UP.mgRange(l))]),
  scrapNode('mgTurrets', '+1 TURRET', 'mgRange', 9, -1.5, [40, 100], 2, 'ADD ONE MORE TURRET TO THE CAR.', ['TURRETS', UP.mgTurrets]),
  goldNode('apRounds', 'AP ROUNDS', 'mgTurrets', 10.5, -1.5, [12], 'BULLETS GO THROUGH THREE ZOMBIES.', ['TARGETS', UP.apRounds]),
  unlockNode('katyusha', 'KATYUSHA CAR', 'mgRate', 6, -3, 'FIRE SIX ROCKETS AT A CROWD.', ['SALVO', (l) => l ? '6 / 15 S' : 'NONE']),
  scrapNode('katyushaRockets', 'MORE ROCKETS', 'katyusha', 7.5, -3, 'D', 4, 'ADD TWO ROCKETS TO EACH SALVO.', ['ROCKETS', UP.katyushaRockets]),
  scrapNode('katyushaReload', 'KATYUSHA RELOAD', 'katyushaRockets', 9, -3, 'D', 4, 'FIRE THE NEXT SALVO SOONER.', ['RELOAD', (l) => secs(UP.katyushaReload(l))]),
  scrapNode('katyushaBlast', 'KATYUSHA BLAST', 'katyushaReload', 10.5, -3, 'E', 3, 'ROCKET BLASTS GROW BY 20%.', ['BLAST', (l) => pctS(UP.katyushaBlast(l))]),
  goldNode('clusterRockets', 'CLUSTER ROCKETS', 'katyushaBlast', 12, -3, [15], 'ROCKETS SPLIT INTO SMALL BOMBS.', ['BOMBS / ROCKET', UP.clusterRockets]),
  unlockNode('ram', 'TURBO RAM', 'armor', 3, 1.5, 'SPACE: SMASH THROUGH THE DEAD.', ['CHARGE', (l) => l ? '2 S' : 'NONE'], ['COOLDOWN', (l) => l ? '20 S' : 'NONE']),
  scrapNode('ramPower', 'RAM POWER', 'ram', 4.5, 1.5, 'C', 4, 'THE RAM SMASHES 30% HARDER.', ['POWER', (l) => pctS(UP.ramPower(l))]),
  scrapNode('ramCooldown', 'RAM COOLDOWN', 'ramPower', 6, 1.5, 'C', 4, 'THE RAM IS READY TWO SECONDS EARLIER.', ['COOLDOWN', (l) => secs(UP.ramCooldown(l))]),
  scrapNode('ramDuration', 'LONG CHARGE', 'ramCooldown', 7.5, 1.5, 'E', 3, 'THE CHARGE LASTS LONGER AND WIDENS.', ['CHARGE', (l) => secs(UP.ramDuration(l))]),
  goldNode('shockwave', 'SHOCKWAVE', 'ramDuration', 9, 1.5, [10], 'END THE CHARGE WITH A RING BLAST.', ['SHOCKWAVE', (l) => UP.shockwave(l) ? 'ON' : 'OFF']),
  unlockNode('steamVent', 'STEAM VENT', 'armor', 3, 4.5, 'BLAST CLIMBERS WITH HOT STEAM.', ['BLAST EVERY', (l) => l ? '5 S' : 'NONE']),
  scrapNode('steamDamage', 'STEAM DAMAGE', 'steamVent', 4.5, 4.5, 'B', 4, 'THE STEAM HITS 25% HARDER.', ['DAMAGE', (l) => pctS(UP.steamDamage(l))]),
  scrapNode('steamSpeed', 'VENT SPEED', 'steamDamage', 6, 4.5, 'B', 4, 'VENT STEAM MORE OFTEN.', ['BLAST EVERY', (l) => secs(UP.steamSpeed(l))]),
  scrapNode('steamReach', 'STEAM REACH', 'steamSpeed', 7.5, 4.5, 'D', 3, 'GROW THE CLOUD TO HIT NEARBY DEAD.', ['REACH LEVEL', UP.steamReach]),
  goldNode('hotCloud', 'HOT CLOUD', 'steamReach', 9, 4.5, [10], 'STEAM STAYS AND HURTS NEW ARRIVALS.', ['CLOUD LASTS', (l) => secs(UP.hotCloud(l))]),
  teaseNode('railCannon', 'RAIL CANNON CAR', 'katyusha', 6, -4.5),
  teaseNode('cowCatcher', 'COW CATCHER', 'ram', 3, 3),
  teaseNode('mineLayer', 'MINE LAYER', 'steamVent', 3, 6),
  teaseNode('twinMG', 'TWIN MG CAR', 'apRounds', 12, -1.5),
  // AIR: south
  unlockNode('a10', 'A-10', 'root', 0, 1.5, 'CALL A THIN LINE OF GUN FIRE.', ['COOLDOWN', (l) => l ? '25 S' : 'NONE']),
  scrapNode('a10Damage', 'A-10 DAMAGE', 'a10', 0, 3, 'C', 4, 'THE A-10 HITS 25% HARDER.', ['DAMAGE', (l) => pctS(UP.a10Damage(l))]),
  scrapNode('a10Cooldown', 'A-10 COOLDOWN', 'a10Damage', 0, 4.5, 'C', 5, 'CALL THE NEXT STRIKE SOONER.', ['COOLDOWN', (l) => secs(UP.a10Cooldown(l))]),
  scrapNode('a10Lines', 'WIDER LINE', 'a10Cooldown', 0, 6, 'E', 3, 'ADD ONE MORE LINE OF GUN FIRE.', ['GUN LINES', UP.a10Lines]),
  goldNode('bombRun', 'BOMB RUN', 'a10Lines', 0, 7.5, [12], 'DROP FOUR BOMBS AFTER THE STRAFE.', ['BOMBS', UP.bombRun]),
  goldNode('a10Charge', 'A-10 +1 CHARGE', 'a10Cooldown', 1.5, 4.5, [15], 'HOLD TWO STRIKES READY TO CALL.', ['CHARGES', UP.a10Charge], true),
  unlockNode('f4', 'F-4', 'a10', -1.5, 1.5, 'LAY A LINE OF NAPALM FIRE.', ['COOLDOWN', (l) => l ? '30 S' : 'NONE'], ['BURN', (l) => l ? '4 S' : 'NONE']),
  scrapNode('fireDamage', 'FIRE DAMAGE', 'f4', -3, 3, 'D', 4, 'NAPALM HITS 25% HARDER.', ['DAMAGE', (l) => pctS(UP.fireDamage(l))]),
  scrapNode('f4Cooldown', 'F-4 COOLDOWN', 'fireDamage', -3, 4.5, 'D', 5, 'CALL THE NEXT FIRE LINE SOONER.', ['COOLDOWN', (l) => secs(UP.f4Cooldown(l))]),
  scrapNode('fireLength', 'LONGER FIRE', 'f4Cooldown', -3, 6, 'E', 3, 'ADD 20% LENGTH AND ONE SECOND.', ['LENGTH', (l) => pctS(UP.fireLength(l))], ['BURN', (l) => secs(UP.fireDuration(l))]),
  goldNode('fireWall', 'FIRE WALL', 'fireLength', -3, 7.5, [15], 'FIRE BURNS LONGER AND BLOCKS DEAD.', ['BURN', (l) => secs(UP.fireWall(l))]),
  goldNode('f4Charge', 'F-4 +1 CHARGE', 'f4Cooldown', -4.5, 4.5, [18], 'HOLD TWO FIRE STRIKES READY.', ['CHARGES', UP.f4Charge], true),
  unlockNode('b52', 'B-52', 'f4Cooldown', -6, 6, 'DROP EIGHT BOMBS ALONG A LANE.', ['COOLDOWN', (l) => l ? '45 S' : 'NONE'], ['BOMBS', (l) => l ? 8 : 0]),
  scrapNode('b52Bombs', 'MORE BOMBS', 'b52', -6, 7.5, 'E', 4, 'ADD TWO BOMBS TO EACH RUN.', ['BOMBS', UP.b52Bombs]),
  scrapNode('b52Cooldown', 'B-52 COOLDOWN', 'b52Bombs', -6, 9, 'E', 4, 'CALL THE NEXT BOMBER SOONER.', ['COOLDOWN', (l) => secs(UP.b52Cooldown(l))]),
  scrapNode('b52Blast', 'BIGGER BOMBS', 'b52Cooldown', -6, 10.5, 'F', 3, 'BOMB BLASTS GROW BY 20%.', ['BLAST', (l) => pctS(UP.b52Blast(l))]),
  goldNode('fireBombs', 'FIRE BOMBS', 'b52Blast', -6, 12, [15], 'BOMBS LEAVE BURNING GROUND.', ['FIRE BOMBS', (l) => UP.fireBombs(l) ? 'ON' : 'OFF']),
  goldNode('b52Charge', 'B-52 +1 CHARGE', 'b52Cooldown', -7.5, 9, [20], 'HOLD TWO BOMB RUNS READY.', ['CHARGES', UP.b52Charge], true),
  teaseNode('autoPilotA10', 'A-10 AUTO PILOT', 'bombRun', 0, 9),
  teaseNode('autoPilotF4', 'F-4 AUTO PILOT', 'fireWall', -3, 9),
  teaseNode('autoPilotB52', 'B-52 AUTO PILOT', 'fireBombs', -6, 13.5),
  teaseNode('hangar3', 'HANGAR SLOT 3', 'b52Charge', -7.5, 10.5),
  teaseNode('hangar4', 'HANGAR SLOT 4', 'b52Charge', -9, 10.5),
  teaseNode('b2', 'B-2', 'fireBombs', -7.5, 12),
  teaseNode('ac130', 'AC-130', 'bombRun', 1.5, 7.5),
  // SALVAGE: west
  scrapNode('magnet', 'SCRAP MAGNET', 'root', -1.5, 0, 'A', 5, 'LOOT PICKUP REACH GROWS BY 25%.', ['PICKUP', (l) => metres(UP.pickup(l))]),
  scrapNode('salvageCrew', 'SALVAGE CREW', 'magnet', -3, 0, 'D', 4, 'EARN 8% MORE SCRAP FROM EVERYTHING.', ['SCRAP', (l) => pctS(1 + UP.salvageCrew(l))]),
  scrapNode('silverHunt', 'SILVER HUNT', 'salvageCrew', -4.5, -1.5, 'E', 3, 'FIND MORE SILVER ZOMBIES.', ['HUNT LEVEL', UP.silverHunt]),
  scrapNode('boomHunt', 'BOOM HUNT', 'salvageCrew', -4.5, 1.5, 'E', 3, 'FIND MORE EXPLOSIVE ZOMBIES.', ['HUNT LEVEL', UP.boomHunt]),
  scrapNode('goldHunt', 'GOLD HUNT', 'silverHunt', -6, -1.5, 'F', 3, 'FIND MORE GOLDEN ZOMBIES.', ['EXTRA GOLDEN', UP.goldHunt])
];
const NODE = {};
for (const n of NODES) NODE[n.id] = n;
const T_CELL = 36;
const maxLv = (n) => n.cost.length;
const parentOf = (n) => (n.p ? NODE[n.p] : null);
// the price of the next level, and whether you can pay it
const priceOf = (n) => n.cost[Math.min(lv(n.id), maxLv(n) - 1)] || 0;
const canPay = (n) => n.k !== 'tease' && SAVE[n.cur || 'scrap'] >= priceOf(n);
// A node's name and level for the goal line.
const nodeLv = (id, l) => NODE[id].name + (maxLv(NODE[id]) > 1 ? ' ' + l : '');
// What a node is now:
//  'off'    its currency or hunt has not appeared, or its parent is not owned
//  'tease'  a grey FULL GAME node, never for sale
//  'poor'   for sale, but you cannot pay
//  'buy'    for sale, and you can pay
//  'max'    every level bought
function nodeState(n) {
  const flags = SAVE.flags;
  if (n.cur === 'surv' && !flags.survShown || n.cur === 'gold' && !flags.goldShown) return 'off';
  if (n.id === 'silverHunt' && !flags.silverSeen || n.id === 'boomHunt' && !flags.boomSeen ||
    n.id === 'goldHunt' && !flags.goldShown) return 'off';
  if (n.p && lv(n.p) < 1) return 'off';
  if (n.k === 'tease') return 'tease';
  if (lv(n.id) >= maxLv(n)) return 'max';
  return canPay(n) ? 'buy' : 'poor';
}
// 0 = absent, 1 = a FULL GAME tease, 2 = a demo node. Growth uses this visibility snapshot.
const shownAs = (n) => ({ off: 0, tease: 1 })[nodeState(n)] ?? 2;

// ---------- into a run
// The active Viper upgrades are folded into the current gun. Weapons added in phases 3-5 use
// the new UP values above; their old runtime fields stay neutral until then.
function treeUp(L, up) {
  const hd = UP.hdmg(L('hdmg')), hr = UP.hrate(L('hrate'));
  up.dmg *= hd;
  up.rate *= hr;
  up.heat /= hr;
  return Object.assign(up, {
    heliDmg: hd, heliRate: hr, heliRange: UP.hrange(L('hrange')), rocketChance: UP.rockets(L('rockets')),
    pods: L('rocketPods') > 0, podDamage: UP.podDamage(L('podDamage')),
    podReload: UP.podReload(L('podReload')), podSalvo: UP.podSalvo(L('podSalvo')),
    napalmDuration: UP.napalm(L('napalm')),
    hellfire: L('hellfire') > 0, hellfireDamage: UP.hellfireDamage(L('hellfireDamage')),
    hellfireReload: UP.hellfireReload(L('hellfireReload')), hellfireBlast: UP.hellfireBlast(L('hellfireBlast')),
    planeOwned: ['a10', 'f4', 'b52'].filter((id) => L(id) > 0),
    planeCooldown: { a10: UP.a10Cooldown(L('a10Cooldown')), f4: UP.f4Cooldown(L('f4Cooldown')), b52: UP.b52Cooldown(L('b52Cooldown')) },
    planeCharges: { a10: UP.a10Charge(L('a10Charge')), f4: UP.f4Charge(L('f4Charge')), b52: UP.b52Charge(L('b52Charge')) },
    a10Damage: UP.a10Damage(L('a10Damage')), a10Lines: UP.a10Lines(L('a10Lines')), bombRun: UP.bombRun(L('bombRun')),
    hellfireCount: UP.doubleHellfire(L('doubleHellfire')),
    salvage: UP.salvageCrew(L('salvageCrew')),
    boom: 0, boomR: 18, silver: 0,
    ramTime: 0, ramCharge: 0, power: false
  });
}

// ---------- buying
// TREE = the panel's state: born[id] = when its line starts to grow (the node pops in GROW s later),
// pop[id] = when it popped in, lit[id] = when its line lit up, flash[id] = its last buy, shake[id] =
// a click that could not buy, rings, sparks and floats after a buy, hov = the node under the mouse,
// cam = the view (x, y = the cell in the middle of the panel, z = zoom; zt = the zoom it goes to,
// anchor = the point that stays under the mouse while it zooms), drag = a drag of the map,
// shown = the previous visibility snapshot, so flags revealed during play can grow new lines.
const TREE = {};
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2];
function resetTree() {
  Object.assign(TREE, { born: {}, pop: {}, lit: {}, flash: {}, shake: {}, rings: [], sparks: [], floats: [], hov: null, sel: null,
    cam: { x: 0, y: 0, z: 1 }, zt: 1, anchor: null, drag: null, shown: null, lastBuy: -9, y0: 19, y1: 331 });
}
resetTree();
const GROW = 0.3;
// Buy one level of node id. True when it was bought. It is saved at once.
function buyNode(id) {
  const n = NODE[id];
  if (!n || n.k === 'tease' || nodeState(n) !== 'buy') return false;
  const before = TREE.shown || NODES.map(shownAs), p = priceOf(n);
  SAVE[n.cur || 'scrap'] -= p;
  SAVE.nodes[id] = lv(id) + 1;
  if (p > 0 && (!n.cur || n.cur === 'scrap')) SAVE.flags.survShown = true;
  saveSave();
  boughtFx(n, p);
  grew(before);
  SFX.buy(!!n.star || n.id === 'root');
  return true;
}
// The look of a buy: a white flash, glowing rings, a burst of sparks, the price floating up, the line lit.
function boughtFx(n, p) {
  const K = NODE_KIND[n.k], big = n.star || n.id === 'root';
  TREE.flash[n.id] = realT;
  TREE.rings.push({ id: n.id, t: realT, c: K.c, big });
  if (big) TREE.rings.push({ id: n.id, t: realT + 0.12, c: '#ffffff', big });
  for (let i = 0; i < (big ? 26 : 14); i++) {
    const a = rnd(TAU), v = rnd(30, big ? 110 : 75);
    TREE.sparks.push({ x: n.x * T_CELL, y: n.y * T_CELL, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: realT, T: rnd(0.35, 0.7),
      c: Math.random() < 0.35 ? '#ffffff' : K.c });
  }
  if (p) TREE.floats.push({ id: n.id, s: '-' + fmt(p), c: n.cur === 'surv' ? U.amber : n.cur === 'gold' ? U.gold : U.blue, t: realT });
  if (lv(n.id) === 1) TREE.lit[n.id] = realT;
}
// After a change, new nodes grow their line and pop in. Save the mask after purchases as well as
// flag changes, so rendering does not restart an animation that the purchase already started.
function grew(before) {
  const after = NODES.map(shownAs);
  NODES.forEach((n, i) => {
    const now = after[i], was = before[i];
    if (!now || now === was) return;
    if (was === 0) {
      const p = parentOf(n), pb = p ? TREE.born[p.id] : null;
      TREE.born[n.id] = pb != null && pb >= realT ? pb + GROW : realT;
    }
    if (now === 2) TREE.pop[n.id] = was === 0 ? TREE.born[n.id] + GROW : realT;
  });
  TREE.shown = after;
}
// Set a node's level (tests): no price, no show.
function setNode(id, l) {
  const n = NODE[id];
  if (!n || n.k === 'tease') return false;
  l = clamp(l | 0, 0, maxLv(n));
  if (l) SAVE.nodes[id] = l;
  else delete SAVE.nodes[id];
  saveSave();
  return true;
}

// ---------- the goal line under the summary
// One useful next choice, using only nodes whose currency and parent have been revealed.
function summaryGoal() {
  const demo = NODES.filter((n) => n.id !== 'root' && n.k !== 'tease');
  if (demo.every((n) => lv(n.id) >= maxLv(n))) return [['ALL DEMO UPGRADES OWNED.', U.green]];
  const choices = demo.filter((n) => ['buy', 'poor'].includes(nodeState(n)));
  const order = (a, b) => Number(canPay(b)) - Number(canPay(a)) || priceOf(a) - priceOf(b);
  const next = choices.filter((n) => n.cur === 'surv').sort(order)[0] || choices.sort(order)[0];
  if (!next) return [['RIDE TO DISCOVER MORE UPGRADES.', U.dim]];
  const price = priceOf(next), unit = next.cur === 'surv' ? (price === 1 ? 'SURVIVOR' : 'SURVIVORS') : next.cur === 'gold' ? 'GOLD' : 'SCRAP';
  const label = next.cur === 'surv' ? 'NEXT NEW UNIT: ' : 'NEXT UPGRADE: ';
  const color = next.cur === 'surv' ? U.amber : next.cur === 'gold' ? U.gold : U.blue;
  return [[label + next.name + ' (' + fmt(price) + ' ' + unit + ')', color]];
}
// The Depot's bottom bar on the tree tab: what to do here, or null.
function treeHint() {
  if (NODES.every((n) => n.k === 'tease' || lv(n.id) >= maxLv(n))) return ['ALL DEMO UPGRADES OWNED. RIDE OR REPLAY.', U.green];
  if (NODES.some((n) => nodeState(n) === 'buy')) {
    const fresh = !NODES.some((n) => n.k === 'scrap' && lv(n.id) > 0);
    return fresh ? ['CLICK A BLUE NODE TO BUY AN UPGRADE.', U.blue] : ['CLICK ANY GLOWING NODE TO BUY IT.', U.ink];
  }
  return ['RIDE FOR MORE REWARDS.', U.dim];
}

// ---------- the view
// The panel's middle on screen, and a node's place on screen.
const treeMid = () => [W / 2, Math.round((TREE.y0 + TREE.y1) / 2)];
function treeXY(tx, ty) {
  const [mx, my] = treeMid(), C = TREE.cam;
  return [Math.round(mx + (tx - C.x * T_CELL) * C.z), Math.round(my + (ty - C.y * T_CELL) * C.z)];
}
// where node id is on screen (with the tree tab open)
function nodeXY(id) {
  const n = NODE[id];
  if (!n) return null;
  const [x, y] = treeXY(n.x * T_CELL, n.y * T_CELL);
  return { x, y };
}
// half the size of a node's square at this zoom: a big node is 26 px at zoom 1, the others 20
const halfOf = (n) => Math.max(4, Math.round((n.star || n.id === 'root' ? 13 : 10) * TREE.cam.z));
// Zoom in (+1) or out (-1) one step, keeping the point under (sx, sy) where it is.
function treeZoom(dir, sx, sy) {
  const i = clamp(ZOOMS.indexOf(TREE.zt) + dir, 0, ZOOMS.length - 1);
  if (ZOOMS[i] === TREE.zt) return;
  const [mx, my] = treeMid(), C = TREE.cam;
  sx = sx ?? mx;
  sy = sy ?? my;
  TREE.zt = ZOOMS[i];
  TREE.anchor = { sx, sy, x: C.x + (sx - mx) / C.z / T_CELL, y: C.y + (sy - my) / C.z / T_CELL };
  SFX.ui();
}
// The wheel over the tree (main.js sends it here).
function treeWheel(dy) {
  treeZoom(dy < 0 ? 1 : -1, M.inside ? M.x : null, M.inside ? M.y : null);
}
// Back to VIPER in the middle, at zoom 1.
function treeCenter() {
  TREE.zt = 1;
  TREE.anchor = null;
  TREE.goTo = { x: 0, y: 0 };
}
// Move the view so node id is on the panel (tests, and the tutorial's tags).
function treeFocus(id) {
  const n = NODE[id];
  if (!n) return;
  const p = nodeXY(id), h = halfOf(n) + 30;
  if (p.x > h && p.x < W - h && p.y > TREE.y0 + h && p.y < TREE.y1 - h) return;
  TREE.cam.x = n.x;
  TREE.cam.y = n.y;
  TREE.goTo = null;
}
// Keys on the tree tab: C or HOME = centre, + / - = zoom. True when used.
function treeKey(k) {
  if (k === 'c' || k === 'Home') treeCenter();
  else if (k === '+' || k === '=') treeZoom(1);
  else if (k === '-' || k === '_') treeZoom(-1);
  else return false;
  return true;
}
// The bounds of the whole map (cells), for keeping the view on it.
const T_SPAN = (() => {
  const xs = NODES.map((n) => n.x), ys = NODES.map((n) => n.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
})();
// Each frame: the zoom glides to its step (the anchor stays under the mouse), the view glides to a
// centre it was sent to, WASD moves it, and it stays near the map.
function treeView() {
  const C = TREE.cam, k = 1 - Math.exp(-14 * frameDt);
  if (Math.abs(C.z - TREE.zt) > 0.002) C.z += (TREE.zt - C.z) * k;
  else C.z = TREE.zt;
  const a = TREE.anchor;
  if (a) {
    const [mx, my] = treeMid();
    C.x = a.x - (a.sx - mx) / C.z / T_CELL;
    C.y = a.y - (a.sy - my) / C.z / T_CELL;
    if (C.z === TREE.zt) TREE.anchor = null;
  }
  const g = TREE.goTo;
  if (g) {
    C.x += (g.x - C.x) * k;
    C.y += (g.y - C.y) * k;
    if (Math.abs(g.x - C.x) + Math.abs(g.y - C.y) < 0.01) TREE.goTo = null;
  }
  const v = 9 * frameDt / C.z;
  if (KEYS.a) C.x -= v;
  if (KEYS.d) C.x += v;
  if (KEYS.w) C.y -= v;
  if (KEYS.s) C.y += v;
  C.x = clamp(C.x, T_SPAN.x0 - 1, T_SPAN.x1 + 1);
  C.y = clamp(C.y, T_SPAN.y0 - 1, T_SPAN.y1 + 1);
}

// A soft round glow (a smooth fall-off, like bloom) in colour col, made once per colour; tGlow
// draws it with radius r at (x, y), strength a (in the 'lighter' blend mode).
const T_SOFT = new Map();
function tGlow(x, y, r, col, a) {
  let c = T_SOFT.get(col);
  if (!c) {
    const [cc, g] = mk(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), [R, G0, B] = hexRgb(col);
    gr.addColorStop(0, 'rgba(' + R + ',' + G0 + ',' + B + ',0.9)');
    gr.addColorStop(0.25, 'rgba(' + R + ',' + G0 + ',' + B + ',0.45)');
    gr.addColorStop(0.6, 'rgba(' + R + ',' + G0 + ',' + B + ',0.12)');
    gr.addColorStop(1, 'rgba(' + R + ',' + G0 + ',' + B + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    T_SOFT.set(col, (c = cc));
  }
  if (r < 1 || a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
  ctx.imageSmoothingEnabled = false;
}

// ---------- the backdrop
// A tile of star dust (faint dots, a few brighter ones with a cross) and a soft glow of colour, made once.
let T_STARS = null, T_NEB = null;
function bakeTreeBack() {
  const rng = mulberry(77);
  T_STARS = pix(256, 256, (r) => {
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rng() * 256), y = Math.floor(rng() * 256), q = rng();
      const col = q < 0.12 ? 'rgba(255,120,210,0.28)' : q < 0.3 ? 'rgba(110,190,255,0.32)' : 'rgba(200,215,240,' + (0.08 + rng() * 0.2).toFixed(2) + ')';
      r(x, y, 1, 1, col);
      if (rng() < 0.05) {
        r(x - 1, y, 1, 1, 'rgba(160,200,255,0.12)');
        r(x + 1, y, 1, 1, 'rgba(160,200,255,0.12)');
        r(x, y - 1, 1, 1, 'rgba(160,200,255,0.12)');
        r(x, y + 1, 1, 1, 'rgba(160,200,255,0.12)');
      }
    }
  });
  // the glow: deep blue round the middle, a touch of violet off to one side (smooth, like a nebula)
  const [c, g] = mk(128, 128);
  for (const [x, y, r, col] of [[64, 64, 64, '30,70,150'], [40, 46, 40, '120,40,150'], [92, 84, 34, '20,110,140']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + col + ',0.2)');
    gr.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  T_NEB = c;
}
function drawTreeBack(y0, y1) {
  if (!T_STARS) bakeTreeBack();
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, y0, W, y1 - y0);
  const C = TREE.cam;
  // the glow sits round LAST TRAIN (half the parallax), the stars far behind (a quarter)
  const [rx, ry] = treeXY(0, 0), ns = Math.round(560 * (0.6 + C.z * 0.4));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(T_NEB, Math.round(rx - ns / 2), Math.round(ry - ns / 2), ns, ns);
  ctx.imageSmoothingEnabled = false;
  const ox = mod(-Math.round(C.x * T_CELL * C.z * 0.25), 256), oy = mod(-Math.round(C.y * T_CELL * C.z * 0.25), 256);
  for (let y = y0 - 256 + mod(oy - y0, 256); y < y1; y += 256) for (let x = ox - 256; x < W; x += 256) ctx.drawImage(T_STARS, x, y);
}

// ---------- the panel
// The SKILL TREE tab, between y0 and y1.
function drawTreeTab(y0, y1) {
  TREE.y0 = y0;
  TREE.y1 = y1;
  // The first visit establishes a baseline. Later visits animate flags earned during a ride.
  if (TREE.shown) grew(TREE.shown);
  else TREE.shown = NODES.map(shownAs);
  treeView();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, W, y1 - y0);
  ctx.clip();
  drawTreeBack(y0, y1);
  // which nodes show (vis[id] = its state); a node pops in after its line has grown
  const vis = {};
  for (const n of NODES) {
    const st = nodeState(n), b = TREE.born[n.id];
    if (st === 'off' || (b != null && realT < b + GROW)) continue;
    vis[n.id] = st;
  }
  treeInput(vis, y0, y1);
  drawTreeLines(vis);
  // (only the nodes on the panel are drawn)
  const m = 40 * TREE.cam.z;
  for (const n of NODES) {
    if (!vis[n.id]) continue;
    const p = nodeXY(n.id);
    if (p.x > -m && p.x < W + m && p.y > y0 - m && p.y < y1 + m) drawTreeNode(n, vis[n.id]);
  }
  drawTreeFx();
  drawTreeHelp(y0, y1);
  const tip = TREE.hov;
  if (tip && vis[tip.id]) drawInfo(tip, vis[tip.id], y0, y1);
  ctx.restore();
}
// The node under screen point (x, y), or null.
function treeNodeAt(vis, x, y) {
  let best = null;
  for (const n of NODES) {
    if (!vis[n.id]) continue;
    const p = nodeXY(n.id), h = halfOf(n) + 2;
    if (inR(x, y, p.x - h, p.y - h, h * 2, h * 2)) best = n;
  }
  return best;
}
// The mouse: a drag moves the map; a click (no drag) on a node buys a level, or says no (a buzz
// and a shake).
function treeInput(vis, y0, y1) {
  const inPanel = (y) => y >= y0 && y < y1;
  if (M.pressed && M.down && inPanel(M.py) && !treeOnButton(M.px, M.py)) {
    TREE.drag = { x: M.px, y: M.py, cx: TREE.cam.x, cy: TREE.cam.y, moved: false };
  }
  const d = TREE.drag;
  if (d && M.down) {
    if (Math.abs(M.x - d.x) + Math.abs(M.y - d.y) > 4) d.moved = true;
    if (d.moved) {
      TREE.goTo = TREE.anchor = null;
      TREE.cam.x = d.cx - (M.x - d.x) / TREE.cam.z / T_CELL;
      TREE.cam.y = d.cy - (M.y - d.y) / TREE.cam.z / T_CELL;
    }
  }
  TREE.hov = null;
  if (M.inside && inPanel(M.y) && !(d && d.moved)) TREE.hov = treeNodeAt(vis, M.x, M.y);
  if (M.released) {
    const was = TREE.drag;
    TREE.drag = null;
    if (was && was.moved) M.used = true;
    else if (!M.used && inPanel(M.py) && !treeOnButton(M.px, M.py)) {
      const n = treeNodeAt(vis, M.px, M.py);
      if (n && n === treeNodeAt(vis, M.x, M.y)) {
        M.used = true;
        treeClick(n);
      }
    }
  }
  if (TREE.hov) cursor = 'pointer';
  else if (TREE.drag && TREE.drag.moved) cursor = 'grabbing';
  else if (M.inside && inPanel(M.y)) cursor = 'grab';
}
function treeClick(n) {
  if (realT - TREE.lastBuy < 0.08) return; // the same click seen twice: one buy only
  if (buyNode(n.id)) TREE.lastBuy = realT;
  else if (nodeState(n) !== 'max') {
    TREE.shake[n.id] = realT;
    SFX.deny();
  } else SFX.ui();
}
// The zoom buttons, top right: [-] [+] CENTER. Returns true when (x, y) is on one.
const T_BTN = () => [[W - 92, '-', 15], [W - 75, '+', 15], [W - 58, 'CENTER', 52]];
const treeOnButton = (x, y) => T_BTN().some(([bx, , bw]) => inR(x, y, bx, TREE.y0 + 4, bw, 14));
function drawTreeHelp(y0) {
  for (const [bx, s, bw] of T_BTN()) {
    if (button(bx, y0 + 4, bw, 14, s)) {
      if (s === '-') treeZoom(-1);
      else if (s === '+') treeZoom(1);
      else treeCenter();
    }
  }
  text('DRAG: MOVE   WHEEL: ZOOM', 6, y0 + 7, '#3c4658', { outline: false });
}

// ---------- the lines
// A line from each shown node back to the one it grows from: a bright core with a glow once the
// node has a level (a spark runs along it now and then), a dim line in its colour while it is for
// sale, a faint one to a padlock. A new line grows out over GROW s and lights up over 0.3 s.
// The lines are drawn into T_LINES and reused while nothing about them changes (the view, the
// states); while one grows or lights up they are drawn each frame.
const T_LINES = { c: null, g: null, key: '' };
function drawTreeLines(vis) {
  const busy = NODES.some((n) => realT - (TREE.born[n.id] ?? -9) < GROW || realT - (TREE.lit[n.id] ?? -9) < 0.3);
  if (busy) treeLines(ctx, vis);
  else {
    const C = TREE.cam, key = [W, H, TREE.y0, TREE.y1, C.x.toFixed(4), C.y.toFixed(4), C.z.toFixed(4)].join(',') + '|' +
      NODES.map((n) => (vis[n.id] || '-') + lv(n.id)).join(',');
    if (!T_LINES.c || T_LINES.c.width !== W || T_LINES.c.height !== H) {
      [T_LINES.c, T_LINES.g] = mk(W, H);
      T_LINES.key = '';
    }
    if (key !== T_LINES.key) {
      T_LINES.key = key;
      T_LINES.g.clearRect(0, 0, W, H);
      treeLines(T_LINES.g, vis);
    }
    ctx.drawImage(T_LINES.c, 0, 0);
  }
  treeSparks(vis);
}
// Each shown line: calls fn(n, a, b, f, st) with n's parent at a, n at b on screen, f = how far it
// has grown, st = n's state (n itself may not have popped in yet).
function eachLine(vis, fn) {
  for (const n of NODES) {
    const p = parentOf(n), st = vis[n.id] || nodeState(n);
    if (!p || st === 'off' || !vis[p.id]) continue;
    const a = nodeXY(p.id), b = nodeXY(n.id);
    // (a line wholly off the panel is not drawn)
    if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > W || Math.max(a.y, b.y) < TREE.y0 || Math.min(a.y, b.y) > TREE.y1) continue;
    const born = TREE.born[n.id], f = born != null ? clamp((realT - born) / GROW, 0, 1) : 1;
    if (f > 0) fn(n, a, b, f, st);
  }
}
function treeLines(g, vis) {
  const z = TREE.cam.z, wide = z >= 1.4 ? 2 : 1;
  eachLine(vis, (n, a, b, f, st) => {
    const ex = lerp(a.x, b.x, f), ey = lerp(a.y, b.y, f), K = NODE_KIND[n.k];
    if (lv(n.id) > 0) {
      const lt = TREE.lit[n.id], u = lt != null ? clamp((realT - lt) / 0.3, 0, 1) : 1;
      if (u < 1) tLine(g, a.x, a.y, ex, ey, K.m, wide);
      if (u <= 0) return;
      const gx = lerp(a.x, ex, u), gy = lerp(a.y, ey, u);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.22;
      g.strokeStyle = K.g;
      g.lineWidth = Math.min(7, 5 * Math.max(0.7, z));
      g.beginPath();
      g.moveTo(a.x + 0.5, a.y + 0.5);
      g.lineTo(gx + 0.5, gy + 0.5);
      g.stroke();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      tLine(g, a.x, a.y, gx, gy, K.c, wide);
    } else if (st === 'tease') tLine(g, a.x, a.y, ex, ey, '#1a2232', 1);
    else tLine(g, a.x, a.y, ex, ey, st === 'buy' ? K.m : '#24324a', wide);
  });
}
// A spark that runs out along each lit line every couple of seconds.
function treeSparks(vis) {
  const z = TREE.cam.z, wide = z >= 1.4 ? 2 : 1;
  eachLine(vis, (n, a, b, f) => {
    if (f < 1 || !lv(n.id) || realT - (TREE.lit[n.id] ?? -9) < 0.3) return;
    const u = mod(realT * 0.55 + (n.x * 0.37 + n.y * 0.61), 1.6);
    if (u >= 1) return;
    const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u);
    ctx.globalCompositeOperation = 'lighter';
    tGlow(x, y, 7 * Math.max(0.8, z), NODE_KIND[n.k].g, 0.8);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x) - (wide >> 1), Math.round(y) - (wide >> 1), wide, wide);
  });
}
// A crisp line of pixels on g, w px wide.
function tLine(g, x0, y0, x1, y1, col, w) {
  pl(g, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), col);
  if (w > 1) pl(g, Math.round(x0) + 1, Math.round(y0), Math.round(x1) + 1, Math.round(y1), col);
}

// ---------- a node
// The node's glow, square, icon (a padlock while it is locked), its level as 3/10 under it, the
// flash of a buy and the pop when it opens. Nodes you can buy pulse; a big node has a double frame.
function drawTreeNode(n, st) {
  const K = NODE_KIND[n.k], l = lv(n.id), m = maxLv(n), z = TREE.cam.z, p = nodeXY(n.id);
  let x = p.x, y = p.y, h = halfOf(n);
  // a click that could not buy shakes it; a node that just opened pops out of nothing
  const sk = realT - (TREE.shake[n.id] ?? -9);
  if (sk < 0.25 && !REDUCED) x += Math.round(Math.sin(sk * 70) * 2 * (1 - sk / 0.25));
  const pp = realT - (TREE.pop[n.id] ?? -9);
  if (pp >= 0 && pp < 0.25) h = Math.max(2, Math.round(h * (0.4 + 0.6 * ease(pp / 0.25) + Math.sin(pp / 0.25 * Math.PI) * 0.2)));
  const s = h * 2, nx = x - h, ny = y - h, hov = TREE.hov === n, buy = st === 'buy', big = !!n.star || n.id === 'root';
  const pulse = 0.5 + 0.5 * Math.sin(realT * 5 + n.x);
  const lock = st === 'tease';
  // the glow round it
  const ga = lock ? 0 : st === 'max' ? 0.5 : buy ? 0.35 + 0.35 * pulse : l > 0 ? 0.4 : st === 'poor' ? 0.12 : 0.18;
  if (ga > 0 || hov) {
    ctx.globalCompositeOperation = 'lighter';
    tGlow(x, y, Math.min(h * (big ? 3 : 2.6), h + 26) + (buy ? pulse * 3 : 0), K.g, ga + (hov ? 0.15 : 0));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // the body
  ctx.fillStyle = st === 'max' ? K.d : '#070a10';
  ctx.fillRect(nx + 1, ny + 1, s - 2, s - 2);
  if (!lock) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(nx + 2, ny + 1, s - 4, 1);
  }
  // the frame: bright once it has a level or you can buy it (it pulses white), mid while you
  // cannot pay, dark grey while locked
  const fc = lock ? (hov ? '#3a4458' : '#202838') : buy ? (pulse > 0.75 ? '#ffffff' : K.c) : l > 0 ? K.c : K.m;
  frame(nx, ny, s, s, fc);
  if (big && s >= 12) {
    ctx.globalAlpha = lock ? 0.5 : 0.65;
    frame(nx + 2, ny + 2, s - 4, s - 4, fc);
    ctx.globalAlpha = 1;
  }
  if (hov) {
    ctx.globalAlpha = 0.6;
    frame(nx - 1, ny - 1, s + 2, s + 2, lock ? '#3a4458' : '#ffffff');
    ctx.globalAlpha = 1;
  }
  // the icon: crisp, 1x up to 2x and 3x as the view zooms in (none when it is very small)
  const ic = lock ? ICON.lock : NICON[n.id] || ICON.star, k = Math.max(1, Math.floor((s - 4) / Math.max(ic.width, ic.height)));
  if (s >= ic.width + 4) {
    const iw = ic.width * k, ih = ic.height * k;
    ctx.globalAlpha = lock ? 0.45 : st === 'poor' && !l ? 0.55 : 1;
    blit(ic, Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih);
    ctx.globalAlpha = 1;
  } else if (!lock) {
    ctx.fillStyle = l > 0 || buy ? K.c : K.m;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  // just bought: a white flash; just popped in: a softer one
  const fl = realT - (TREE.flash[n.id] ?? -9);
  const wa = Math.max(fl < 0.15 ? 1 - fl / 0.15 : 0, pp >= 0 && pp < 0.2 ? 0.8 * (1 - pp / 0.2) : 0);
  if (wa > 0) {
    ctx.globalAlpha = wa;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(nx, ny, s, s);
    ctx.globalAlpha = 1;
  }
  // the level under it (not on a padlock, and not when the view is far out)
  if (lock || z < 0.7) return;
  let lab, lc;
  if (n.id === 'root') [lab, lc] = l ? ['', ''] : ['FREE', pulse > 0.5 ? '#ffe39a' : U.gold];
  else [lab, lc] = [l + '/' + m, st === 'max' ? K.c : l > 0 ? '#e6f2ff' : buy ? '#c8d4e6' : '#6c7890'];
  if (lab) text(lab, x, y + h + 2, lc, { align: 'center', outline: '#04060a' });
}
// Rings and sparks from buys, and the price floating up.
function drawTreeFx() {
  const z = TREE.cam.z;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = TREE.rings.length - 1; i >= 0; i--) {
    const r = TREE.rings[i], u = (realT - r.t) / 0.5;
    if (u >= 1) {
      TREE.rings.splice(i, 1);
      continue;
    }
    if (u < 0) continue;
    const n = NODE[r.id], p = nodeXY(r.id), e = halfOf(n) + ease(u) * (r.big ? 30 : 18) * z;
    ctx.globalAlpha = (1 - u) * 0.9;
    ctx.strokeStyle = r.c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + 0.5, p.y + 0.5, e, 0, TAU);
    ctx.stroke();
  }
  for (let i = TREE.sparks.length - 1; i >= 0; i--) {
    const s = TREE.sparks[i], t = realT - s.t;
    if (t >= s.T) {
      TREE.sparks.splice(i, 1);
      continue;
    }
    const d = 1 - Math.exp(-4 * t), [x, y] = treeXY(s.x + s.vx * d / 4 * 1.6, s.y + s.vy * d / 4 * 1.6);
    ctx.globalAlpha = 1 - t / s.T;
    ctx.fillStyle = s.c;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = TREE.floats.length - 1; i >= 0; i--) {
    const f = TREE.floats[i], u = (realT - f.t) / 0.9;
    if (u >= 1) {
      TREE.floats.splice(i, 1);
      continue;
    }
    const p = nodeXY(f.id), h = halfOf(NODE[f.id]), d = Math.round(ease(u) * 14);
    ctx.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1;
    text(f.s, p.x, p.y - h - 12 - d, f.c, { align: 'center' });
    ctx.globalAlpha = 1;
  }
}

// ---------- the tooltip
// Split s into lines no wider than w px.
function wrap(s, w) {
  const out = [];
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (line && tw(t) > w) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}
// The NOW > NEXT line for stat [label, value at a level]: [[text, colour], ...] (just NOW when every
// level is bought, or when the next level does not change it)
function statSegs(stat, l, done) {
  const [label, val] = stat, now = String(val(l));
  if (done || now === String(val(l + 1))) return [[label, U.dim], [now, U.ink]];
  return [[label, U.dim], [now, now === 'NONE' ? U.faint : U.ink], ['>', U.faint], [String(val(l + 1)), U.green]];
}
// The tooltip for node n beside it: NAME and LEVEL x/y, a line in its colour, what it does, NOW >
// NEXT, then the price (red when you cannot pay) and what a click does.
const INFO_W = 216;
function drawInfo(n, st, y0, y1) {
  const K = NODE_KIND[n.k], l = lv(n.id), m = maxLv(n), tease = st === 'tease', lock = tease;
  const inner = INFO_W - 14;
  const desc = wrap(n.desc, inner);
  const vals = lock || !n.stat ? [] : [n.stat, n.stat2].filter(Boolean).map((s) => statSegs(s, l, l >= m));
  // the foot: [price text, colour, price icon, right text, colour]
  const surv = n.cur === 'surv', gold = n.cur === 'gold', pr = priceOf(n), have = SAVE[n.cur || 'scrap'];
  const icon = surv ? ICON.survS : gold ? ICON.goldS : ICON.boltS;
  const pcol = !canPay(n) ? U.red : surv ? U.amber : gold ? U.gold : U.blue;
  let foot;
  if (tease) foot = ['', U.faint, null, 'FULL GAME', U.dim];
  else if (st === 'max') foot = ['', U.dim, null, n.id === 'root' || m === 1 ? 'OWNED' : 'MAXED', K.c];
  else if (st === 'poor') foot = [fmt(pr), U.red, icon, 'NEED ' + fmt(pr - have) + ' MORE', U.red];
  else foot = pr ? [fmt(pr), pcol, icon, 'CLICK TO BUY', U.gold] : ['FREE', U.gold, null, 'CLICK TO TAKE IT', U.gold];
  const kindName = tease ? 'FULL GAME' : n.id === 'root' ? 'THE ROOT' : n.k === 'surv' ? 'NEW UNIT' : n.k === 'gold' ? 'SPECIAL' : 'UPGRADE';
  const w = INFO_W, h = 31 + desc.length * 10 + vals.length * 10 + 17;
  // beside the node (right, else left), kept on the panel
  const q = nodeXY(n.id), hn = halfOf(n);
  let x = q.x + hn + 10;
  if (x + w > W - 4) x = q.x - hn - 10 - w;
  if (x < 4) x = clamp(q.x - w / 2, 4, W - w - 4);
  let y = clamp(q.y - Math.round(h / 2), y0 + 22, y1 - h - 4);
  if (x === clamp(q.x - w / 2, 4, W - w - 4)) y = q.y + hn + 12 + h < y1 ? q.y + hn + 12 : q.y - hn - 12 - h;
  y = clamp(y, y0 + 22, y1 - h - 4);
  x = Math.round(x);
  y = Math.round(y);
  // the box: near black, a frame and a line under the head in the node's colour
  ctx.fillStyle = 'rgba(5,8,13,0.97)';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  frame(x, y, w, h, lock ? '#2a3448' : K.m);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = K.g;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  text(n.name, x + 7, y + 5, lock ? U.dim : '#ffffff');
  if (!tease) text(n.id === 'root' ? (l ? 'OWNED' : '0/1') : l + '/' + m, x + w - 7, y + 5, st === 'max' ? K.c : U.ink, { align: 'right' });
  text(kindName, x + 7, y + 14, tease ? U.dim : lock ? '#3c4658' : K.m, { outline: false });
  ctx.fillStyle = lock ? '#1c2434' : K.m;
  ctx.fillRect(x + 6, y + 23, w - 12, 1);
  let ty = y + 27;
  for (const d of desc) {
    text(d, x + 7, ty, lock ? U.faint : U.ink);
    ty += 10;
  }
  for (const segs of vals) {
    let tx = x + 7;
    for (const [s, c] of segs) tx += text(s, tx, ty, c) + 5;
    ty += 10;
  }
  ctx.fillStyle = '#161c28';
  ctx.fillRect(x + 6, ty + 1, w - 12, 1);
  ty += 5;
  const [lt, lc, li, rt, rc] = foot;
  let fx = x + 7;
  if (li) {
    blit(li, fx - 1, ty);
    fx += 7;
  }
  if (lt) text(lt, fx, ty, lc);
  if (rt) {
    const blink = rc === U.gold && Math.sin(realT * TAU) < -0.3;
    text(rt, x + w - 7, ty, blink ? '#ffe39a' : rc, { align: 'right' });
  }
}

// The world is not drawn (nor run) while the skill tree covers it.
const treeCovers = () => mode === 'depot' && depotTab === 'tree';

