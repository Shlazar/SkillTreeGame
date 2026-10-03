// Run mode: free picking follows owned parents, currency reveals and the three hunt flags.
function shown() {
  const ids = __sr.treeShown();
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error('treeShown is not a unique id list');
  const old = __sr.treeNodes().filter(node => ['hidden', 'soon', 'locked', 'later'].includes(node.st));
  if (old.length) throw new Error('Old visibility states remain: ' + old.map(node => node.id).join(','));
  return ids;
}
function exact(expected, label) {
  const actual = shown().slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected.slice().sort())) throw new Error(label + ': ' + JSON.stringify(actual));
}
function visible(id, expected, label) {
  if (shown().includes(id) !== expected) throw new Error(label + ': ' + id + ' visibility');
}
function flag(key, value) {
  __sr.SAVE.flags[key] = value;
  __sr.give(0, 0, 0);
}
function startTree() {
  __sr.hold(false);
  __sr.reset();
  __sr.depot('tree');
  __sr.treeCam(0, 0, 1);
  __sr.frames(120);
}
function midTree() {
  __sr.hold(false);
  __sr.reset();
  __sr.SAVE.flags.goldShown = true;
  __sr.give(300, 6, 30);
  __sr.depot('tree');
  __sr.frames(30);
  for (const id of ['hdmg', 'hrate', 'hrange', 'armor', 'magnet', 'a10', 'rockets', 'rocketPods', 'mgCar', 'ram', 'steamVent']) {
    if (!__sr.buy(id)) throw new Error('Mid-tree purchase failed: ' + id);
    __sr.frames(24);
  }
  __sr.treeCam(1, -0.75, 0.5);
  __sr.frames(180);
}

// Keep this setup identical to t2_3_start_shot.js.
startTree();
const fresh = ['root', 'hdmg', 'hrate', 'armor', 'magnet'];
exact(fresh, 'Fresh five nodes');
if (__sr.save().flags.survShown || __sr.save().flags.goldShown) throw new Error('Fresh currencies already revealed');
__sr.frames(30);
__sr.give(100, 0, 0);
if (!__sr.buy('hdmg')) throw new Error('Gun Damage could not be freely picked');
visible('hrange', false, 'Gun Range belongs to Fire Rate');
visible('a10', true, 'First paid buy reveals survivor choices');
for (const id of ['mgCar', 'ram', 'steamVent']) visible(id, false, 'Unowned Armor gates gadgets');
if (!__sr.buy('hrate')) throw new Error('Fire Rate could not be freely picked');
visible('hrange', true, 'Owned Fire Rate reveals Gun Range');
visible('rockets', false, 'Rockets still require owned range and revealed gold');
if (!__sr.buy('armor')) throw new Error('Armor could not be freely picked');
for (const id of ['mgCar', 'ram', 'steamVent', 'a10']) visible(id, true, 'Owned Armor and survivor reveal');
__sr.give(0, 3, 20);
// Let the existing line-grow effect finish before using the actual click path.
__sr.frames(30);
if (!__sr.clickNode('mgCar')) throw new Error('MG Car had no clickable screen position');
if (__sr.save().nodes.mgCar !== 1) throw new Error('Visible MG Car click did not buy it');
visible('mgDamage', true, 'Owned unit reveals its first upgrade');
visible('mgRate', false, 'A shown upgrade is not an owned parent');
__sr.frames(30);

if (!__sr.buy('hrange')) throw new Error('Could not buy visible Gun Range');
visible('rockets', false, 'Wallet gold does not reveal gold nodes');
flag('goldShown', true);
visible('rockets', true, 'Gold reveal with owned range');
visible('rocketPods', false, 'A shown special is not an owned parent');
visible('a10Charge', false, 'Revealed gold still needs its own parent');
if (!__sr.buy('rockets')) throw new Error('Shown Rockets could not be freely bought');
visible('rocketPods', true, 'Owned Rockets reveal the next unlock');

// Hunt flags add only the special discovery gate; owned-parent gating still applies.
for (const id of ['magnet', 'salvageCrew']) if (!__sr.node(id, 1)) throw new Error('Hunt parent setup failed: ' + id);
visible('silverHunt', false, 'Silver unseen');
visible('boomHunt', false, 'Boom unseen');
visible('goldHunt', false, 'Gold Hunt still requires owned Silver Hunt');
flag('silverSeen', true);
visible('silverHunt', true, 'First silver discovered');
visible('boomHunt', false, 'Silver does not reveal Boom Hunt');
if (!__sr.node('silverHunt', 1)) throw new Error('Could not own Silver Hunt parent');
visible('goldHunt', true, 'Gold reveal and owned Silver Hunt');
flag('goldShown', false);
visible('goldHunt', false, 'Gold Hunt obeys gold reveal');
flag('goldShown', true);
flag('boomSeen', true);
visible('boomHunt', true, 'First explosive discovered');
const staged = shown();

// Every full-game tease is visible beside its owned parent, and stays unavailable with any money.
__sr.reset();
for (const key of ['survShown', 'goldShown', 'silverSeen', 'boomSeen']) __sr.SAVE.flags[key] = true;
__sr.give(20000, 30, 500);
const all = __sr.treeNodes();
for (const node of all) if (node.k !== 'tease' && !__sr.node(node.id, node.max)) throw new Error('Max-parent setup failed: ' + node.id);
__sr.depot('tree');
__sr.treeCam(1.5, 0.75, 0.25);
__sr.frames(30);
const full = shown(), teases = __sr.treeNodes().filter(node => node.k === 'tease');
if (full.length !== 73 || teases.length !== 13) throw new Error('Full visible table/tease count is wrong');
for (const node of teases) {
  visible(node.id, true, 'Owned tease parent');
  if (__sr.buy(node.id) !== false || __sr.node(node.id, 1) !== false || __sr.save().nodes[node.id]) throw new Error('Visible full-game tease became purchasable: ' + node.id);
}
const obsolete = __sr.treeNodes().filter(node => ['hidden', 'soon', 'locked', 'later'].includes(node.st));
if (obsolete.length) throw new Error('Old visibility states remain: ' + obsolete.map(n => n.id).join(','));

// Keep this setup identical to t2_3_mid_shot.js; the actual buys grow the new lines naturally.
midTree();
const midShown = shown();
for (const id of ['root', 'hdmg', 'hrate', 'hrange', 'armor', 'magnet', 'a10', 'rockets', 'rocketPods', 'mgCar', 'ram', 'steamVent']) {
  visible(id, true, 'Mid shot');
  if (!__sr.save().nodes[id]) throw new Error('Mid shot lost owned node ' + id);
}
if (__sr.infoFit().bad.length) throw new Error('Visibility changes broke tooltip fit');
__sr.frames(30);
QA_DONE({fresh, staged, allVisible: full.length, teaseCount: teases.length, teasePurchasesBlocked: true,
  actualClick: 'mgCar', startShot: true, midShot: {shown: midShown, currencies: __sr.currencyState().shown}});
