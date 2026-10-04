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
  for (const key of ['currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
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

hangarShot();

