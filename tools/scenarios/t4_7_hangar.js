// Hangar assignments use real canvas pointer drags and the saved two-slot layout.
function check(ok, message) { if (!ok) throw new Error(message); }
function expectSlots(ids, label) {
  const h = __sr.hangar();
  check(JSON.stringify(h.slots) === JSON.stringify(ids) && JSON.stringify(__sr.save().hangar) === JSON.stringify(ids),
    label + ': ' + JSON.stringify(h));
  return h;
}
function freshOwned(ids, tab = 'tree') {
  __sr.hold(false); __sr.reset();
  for (const id of ids) check(__sr.node(id, 1), 'Missing plane node ' + id);
  for (const key of ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double', 'p_ram', 'p_charge', 'p_hangar', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_b2']) __sr.SAVE.seen[key] = true;
  __sr.SAVE.flags.survShown = __sr.SAVE.flags.goldShown = true;
  __sr.depot(tab); __sr.frames(90);
}
function pointer(type, x, y, buttons = 1) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, button: type === 'pointermove' ? -1 : 0, buttons,
    pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
  __sr.frames(1);
}
function beginDrag(id) {
  const c = __sr.hangar().layout.cards.find(c => c.id === id);
  check(c, 'Missing rendered Hangar card ' + id);
  pointer('pointerdown', c.x + c.w / 2, c.y + c.h / 2);
  pointer('pointermove', c.x + c.w / 2 + 24, c.y + c.h / 2 + 12);
  check(__sr.hangar().drag, 'Real held pointer did not begin Hangar drag');
}
function hangarShot() {
  freshOwned(['a10', 'f4', 'b52'], 'hangar');
  check(__sr.hangarDrag('b52', 0), 'Shot B-52→Q real drag failed');
  check(__sr.hangarDrag('a10', 1), 'Shot A-10→W real drag failed');
  const state = expectSlots(['b52', 'a10'], 'Shot slots');
  check(state.visible && state.layout.cards.length === 3 && state.layout.slots.length === 2 &&
    __sr.treeState().tab === 'hangar', 'Hangar shot did not show the three owned planes and two slots');
  __sr.hover(4, 70); __sr.frames(1);
  return state;
}

const automatic = [];
for (const ids of [[], ['a10'], ['a10', 'f4']]) {
  freshOwned(ids);
  const expected = [ids[0] || null, ids[1] || null], h = expectSlots(expected, 'Automatic slots');
  check(!h.visible && h.owned.length === ids.length, 'Hangar appeared with at most two planes');
  automatic.push({owned: h.owned, slots: h.slots, visible: h.visible});
}
const shot = hangarShot(); __sr.frames(30);
__sr.press('Tab'); __sr.frames(1);
check(__sr.treeState().tab === 'tree', 'Tab did not return from Hangar to the skill tree');
__sr.press('Tab'); __sr.frames(1);
check(__sr.treeState().tab === 'hangar', 'Tab did not open Hangar with three planes owned');
expectSlots(['b52', 'a10'], 'Tab toggle preserves assignments');
check(__sr.hangarDrag('a10', 0), 'Equipped A-10→Q swap failed');
expectSlots(['a10', 'b52'], 'Duplicate assignment swaps');
check(__sr.hangarDrag('a10', 1), 'Swap back failed');
expectSlots(['b52', 'a10'], 'Restored assignments');
check(!__sr.hangarDrag('unknown', 0) && !__sr.hangarDrag('b52', 2), 'Invalid helper target was accepted');

const rejected = [];
for (const kind of ['outside', 'cancel', 'blur']) {
  const before = JSON.stringify(__sr.save().hangar);
  beginDrag('f4');
  if (kind === 'outside') pointer('pointerup', -20, -20, 0);
  if (kind === 'cancel') pointer('pointercancel', 4, 70, 0);
  if (kind === 'blur') { window.dispatchEvent(new Event('blur')); __sr.frames(1); }
  check(JSON.stringify(__sr.save().hangar) === before && !__sr.hangar().drag,
    'Rejected ' + kind + ' drop changed assignment or left drag held');
  pointer('pointerup', 4, 70, 0);
  rejected.push(kind);
}
check(__sr.load(), 'Saved Hangar did not reload');
__sr.depot('hangar'); __sr.frames(90);
const reloaded = expectSlots(['b52', 'a10'], 'Loaded slots');
__sr.leg(2, false);
const equipped = __sr.planes();
check(equipped.length === 2 && equipped.some(p => p.id === 'b52' && p.slot === 0 && p.key === 'q') &&
  equipped.some(p => p.id === 'a10' && p.slot === 1 && p.key === 'w') && !equipped.some(p => p.id === 'f4'),
  'Next leg did not use saved B-52/Q and A-10/W assignments: ' + JSON.stringify(equipped));
check(new Set(__sr.save().hangar).size === 2 && __sr.late() <= 1, 'Hangar duplicated a plane or created late atlas pages');
__sr.bot(true); __sr.hp(9999); __sr.sim(30); __sr.frames(10);
const performance = {bench: +__sr.bench(60).toFixed(2), cost: __sr.cost(20), late: __sr.late(), stats: __sr.stats()};
check(performance.stats.kills > 0 && performance.stats.zombies > 0 && performance.stats.hp > 0 && performance.late <= 1,
  'Saved Hangar thirty-second busy drawing check failed');
QA_DONE({automatic, threeOwned: {visible: shot.visible, owned: shot.owned, slots: shot.slots},
  actualDrags: ['b52→Q', 'a10→W'], tabToggle: ['hangar', 'tree', 'hangar'], duplicateSwaps: true, rejected,
  persisted: reloaded.slots, nextLeg: equipped, matchingShotRendered: true, performance,
  baseline: {bench: 3.27, render: 2.97, late: 1}, benchIncrease: +(performance.bench - 3.27).toFixed(2)});
