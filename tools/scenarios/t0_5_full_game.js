// Run mode: full-game weapons cannot fire in play or the demo, and their tree nodes are removed.
const removedIds = ['he', 'reload', 'gun', 'gunspd', 'power', 'cow', 'horn', 'autoram', 'ramtime', 'charge'];
const nodes = __sr.treeNodes();
const ids = new Set(nodes.map((node) => node.id));
const removed = nodes.filter((node) => removedIds.includes(node.id)).map((node) => node.id);
if (removed.length) throw new Error('Full-game nodes remain: ' + removed.join(', '));
if (nodes.some((node) => !Object.prototype.hasOwnProperty.call(node, 'p'))) {
  throw new Error('treeNodes does not expose parents for the orphan check');
}
const orphans = nodes.filter((node) => node.p && !ids.has(node.p)).map((node) => node.id);
if (orphans.length) throw new Error('Nodes have missing parents: ' + orphans.join(', '));
for (const [id, parent] of [['ram', 'armor'], ['ramPower', 'ram'], ['ramCooldown', 'ramPower'], ['ramDuration', 'ramCooldown']]) {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node || node.p !== parent) throw new Error(id + ' must grow from ' + parent);
}

function disabledWeapons() {
  const up = __sr.G.up;
  if (up.he !== false || up.gun !== 0 || up.cow !== false) {
    throw new Error('Full-game weapon enabled: ' + JSON.stringify({he: up.he, gun: up.gun, cow: up.cow}));
  }
  return {he: up.he, gun: up.gun, cow: up.cow};
}
function noWeaponFire(label) {
  if (__sr.G.rounds.some((round) => round.kind === 'he')) throw new Error(label + ': a 105mm shell fired');
  if (__sr.G.helis.some((heli) => heli.heR > 0)) throw new Error(label + ': 105mm reload started');
  if (__sr.G.gun && __sr.G.gun.shots !== 0) throw new Error(label + ': Rail Cannon fired');
}
function fireState() {
  const state = __sr.G;
  return JSON.stringify({
    rounds: state.rounds.map((round) => round.kind),
    shots: state.shots,
    heliReload: state.helis.map((heli) => heli.heR),
    heReload: state.heReload,
    gunShots: state.gun ? state.gun.shots : null,
    ram: {on: state.ram.on, uses: state.ram.uses, cd: state.ram.cd, t: state.ram.t}
  });
}

__sr.start();
__sr.hp(9999);
const runUp = disabledWeapons();
const beforeSpace = fireState();
__sr.press(' ');
const spaceUnchanged = beforeSpace === fireState();
if (!spaceUnchanged) throw new Error('Space fired a weapon or started the Ram');
if (__sr.heArm(true) !== false) throw new Error('Disabled 105mm can still be armed');
__sr.bot(true);
// A shell lives less than one second; inspect every fixed step so firing cannot hide between samples.
for (let step = 0; step < 30 * 60; step++) {
  __sr.sim(1 / 60);
  noWeaponFire('Bot step ' + step);
}
__sr.frames(30);
noWeaponFire('Rendered bot run');
const run = __sr.stats();
const gunShots = run.gun ? run.gun.shots : null;

__sr.title();
const demoUp = disabledWeapons();
for (let step = 0; step < 60 * 60; step++) {
  __sr.sim(1 / 60);
  noWeaponFire('Demo step ' + step);
}
__sr.frames(30);
noWeaponFire('Rendered title demo');
if (__sr.heArm(true) !== false) throw new Error('Demo can arm the disabled 105mm');

// Keep this battle setup identical to t0_5_full_game_shot.js; render mode exposes draw errors.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(30);
__sr.frames(30);
__sr.heArm(true);
__sr.frames(1);
__sr.hold(true);
noWeaponFire('Battle screenshot setup');
__sr.hold(false);

// Keep this tree setup identical to t0_5_tree_shot.js.
__sr.reset();
__sr.give(500, 6);
__sr.node('root', 1);
__sr.node('hdmg', 1);
__sr.node('armor', 1);
__sr.depot('tree');
__sr.frames(30);
QA_DONE({removed, orphans, ramParent: 'armor', runUp, demoUp, spaceUnchanged, gunShots, botSeconds: 30, demoSeconds: 60, heArmed: __sr.heArm(true)});
