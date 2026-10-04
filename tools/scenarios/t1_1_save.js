// Run mode: version 2 saves round-trip safely, drop obsolete route fields and reject broken saves.
const saveKey = 'sky-reaper-save-1';
const same = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
};
function reload(value, raw) {
  localStorage.setItem(saveKey, raw ? value : JSON.stringify(value));
  const found = __sr.load();
  __sr.title();
  __sr.frames(30);
  return {found, save: __sr.save()};
}

__sr.reset();
const fresh = __sr.save();
same(fresh.v, 2, 'Save version');
for (const [key, value] of Object.entries({gold: 0, leg: 1, legs: {}, rescues: [], rescueDue: [], chest: 0, hangar: [null, null]})) {
  same(fresh[key], value, 'Fresh ' + key);
}
for (const key of ['reached', 'held', 'best', 'start', 'towers', 'house']) {
  if (Object.prototype.hasOwnProperty.call(fresh, key)) throw new Error('Obsolete field remains: ' + key);
}
const give = __sr.give(10, 1, 5);
same(give, {scrap: 10, surv: 1, gold: 5}, 'give return');
const given = __sr.save();
same([given.scrap, given.surv, given.gold], [10, 1, 5], 'Given money persisted');
const storedMoney = JSON.parse(localStorage.getItem(saveKey));
same([storedMoney.scrap, storedMoney.surv, storedMoney.gold], [10, 1, 5], 'Stored money');

const fixture = {
  ...given,
  leg: 5,
  legs: {'3': {won: true, stars: [true, false, true], paid: {golden: true, crate: true}}},
  rescues: ['r4'],
  rescueDue: ['r8'],
  chest: 1,
  hangar: ['a10', 'f4'],
  flags: {survShown: true, goldShown: true, silverSeen: true, boomSeen: true, rocketShown: true},
  nodes: {root: 1, hdmg: 2}
};
Object.assign(__sr.SAVE, fixture);
__sr.give(0, 0, 0);
const persisted = JSON.parse(localStorage.getItem(saveKey));
for (const key of ['leg', 'legs', 'rescues', 'rescueDue', 'chest', 'hangar', 'flags']) {
  same(persisted[key], fixture[key], 'Persisted ' + key);
}
const loaded = reload(persisted);
if (!loaded.found) throw new Error('Valid v2 save was rejected');
// Rendering the revealed currencies durably queues their unseen lessons, even on the title.
const roundTrip = {...fixture, flags: {...fixture.flags, 'tipDue:currency_surv': true, 'tipDue:currency_gold': true}};
for (const key of ['scrap', 'surv', 'gold', 'leg', 'legs', 'rescues', 'rescueDue', 'chest', 'hangar', 'flags', 'nodes']) {
  same(loaded.save[key], roundTrip[key], 'Round-trip ' + key);
}
for (const key of ['currency_surv', 'currency_gold']) {
  if (loaded.save.seen[key] === true) throw new Error('Title promoted an ineligible currency lesson: ' + key);
}
const legacyV2 = reload({...persisted, reached: ['millbrook'], held: ['millbrook'], best: 5,
  start: 'millbrook', towers: {millbrook: []}, house: {millbrook: 3}});
if (!legacyV2.found) throw new Error('v2 with obsolete fields should still load');
for (const key of ['reached', 'held', 'best', 'start', 'towers', 'house']) {
  if (Object.prototype.hasOwnProperty.call(legacyV2.save, key)) throw new Error('Loaded obsolete field: ' + key);
}
same(legacyV2.save.leg, 5, 'Obsolete fields do not replace current leg');

const malformed = reload({
  ...fresh,
  scrap: -7, surv: '8', gold: {}, leg: '5', chest: '1',
  legs: {
    '3': {won: 'yes', stars: [true, 1, 'yes', true], paid: {one: true, two: 'true', three: 1, four: false}},
    '99': {won: true, stars: [true, true, true], paid: {bad: true}}
  },
  rescues: ['r4', 'r4', null, 9], rescueDue: {},
  hangar: ['b52', 'b52', 'a10'],
  flags: {survShown: true, goldShown: 'yes', rocketShown: 1},
  reached: {}, held: 'farm', best: -1, start: {}, towers: [], house: []
});
if (!malformed.found) throw new Error('Malformed v2 fields should sanitize safely');
same([malformed.save.scrap, malformed.save.surv, malformed.save.gold], [0, 0, 0], 'Malformed money');
same(malformed.save.leg, 1, 'Malformed leg');
same(malformed.save.chest, 0, 'Malformed chest');
same(malformed.save.legs['3'].won, false, 'Strict won boolean');
same(malformed.save.legs['3'].stars, [true, false, false], 'Strict star booleans');
same(malformed.save.legs['3'].paid, {one: true}, 'Strict paid map');
if ('99' in malformed.save.legs) throw new Error('Out-of-range leg survived');
same(malformed.save.rescues, ['r4'], 'Rescue ids');
same(malformed.save.rescueDue, [], 'Malformed pending rescues');
same(malformed.save.hangar, ['b52', null], 'Hangar size, ids and duplicates');
same(malformed.save.flags.survShown, true, 'Valid flag');
if ('goldShown' in malformed.save.flags || 'rocketShown' in malformed.save.flags) throw new Error('Non-boolean flags survived');
for (const key of ['reached', 'held', 'best', 'start', 'towers', 'house']) {
  if (Object.prototype.hasOwnProperty.call(malformed.save, key)) throw new Error('Malformed legacy field survived: ' + key);
}

const resetCases = [];
for (const [name, value, raw] of [
  ['v1', {v: 1, scrap: 99, surv: 8, nodes: {root: 1}, reached: ['farm']}, false],
  ['corrupt JSON', '{"v":2,"scrap":', true],
  ['null', null, false],
  ['array', [], false],
  ['missing version', {}, false]
]) {
  const result = reload(value, raw);
  if (result.found) throw new Error(name + ' should not load as v2');
  same(result.save.v, 2, name + ' fresh version');
  for (const key of ['scrap', 'surv', 'gold', 'leg', 'legs', 'rescues', 'rescueDue', 'chest', 'hangar', 'nodes']) {
    same(result.save[key], fresh[key], name + ' reset ' + key);
  }
  resetCases.push(name);
}

// Keep this setup identical to t1_1_save_shot.js; render the preserved Depot with a v2 save.
__sr.reset();
__sr.give(10, 1, 5);
__sr.depot('tree');
__sr.frames(30);
QA_DONE({freshFields: Object.keys(fresh), give, roundTrip: true, sanitized: malformed.save, resetCases, mode: __sr.mode});
