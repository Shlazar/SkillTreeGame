// run mode: real leg events/buy/input hooks teach one persistent tip at a time.
function check(ok, why) { if (!ok) throw new Error(why); }
const KEYS = ['p_move', 'currency_scrap', 'currency_surv', 'currency_gold', 'p_plane', 'p_plane_double',
  'p_ram', 'p_charge', 'p_golden', 'p_sos', 'p_wall', 'p_brute_focus', 'p_boom', 'p_hangar', 'p_b2'];
const promotions = [], samples = [], counts = {};
let lastTip = null, sampleTime = 0;
function sample() {
  // One held UI frame per half-second sample avoids re-rendering every fixed physics step.
  __sr.hold(true); __sr.frames(1, 0.5); __sr.hold(false); sampleTime += 0.5;
  const s = __sr.tutState(), queued = s.queuedKeys || [];
  check(!s.tip || typeof s.tip === 'string' && typeof s.tipKey === 'string' && KEYS.includes(s.tipKey),
    'Tip is unkeyed, unsupported or contains multiple active messages: ' + JSON.stringify(s));
  check(new Set(queued).size === queued.length && !queued.includes(s.tipKey), 'A queued tip duplicated itself/the active tip');
  check(queued.every(key => !__sr.SAVE.seen[key] && __sr.SAVE.flags['tipDue:' + key] === true),
    'Queued lesson was marked seen before its eligible promotion');
  check(s.tasks.length === 0 && s.queued === 0, 'Obsolete tutorial tasks remain');
  if (s.tip) {
    const box = s.layout, width = __sr.stats().W;
    check(box && box.lines.join(' ') === s.tip && box.x - 5 >= 0 && box.x + box.w + 5 <= width && box.y >= 19,
      'Visible tip text/layout does not fit the actual font surface: ' + JSON.stringify(s));
  }
  if (s.tipKey && s.tipKey !== lastTip) {
    counts[s.tipKey] = (counts[s.tipKey] || 0) + 1;
    check(counts[s.tipKey] === 1, 'A lesson promoted twice: ' + s.tipKey);
    const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
    check(__sr.SAVE.seen[s.tipKey] === true && stored.seen[s.tipKey] === true && !stored.flags['tipDue:' + s.tipKey],
      'Actual promotion failed its persistent seen receipt: ' + s.tipKey);
    promotions.push({key: s.tipKey, text: s.tip, leg: __sr.G.leg, mode: __sr.mode, at: sampleTime});
  }
  if (s.tipKey || queued.length) samples.push({at: sampleTime, leg: __sr.G.leg, mode: __sr.mode, tip: s.tipKey, queued});
  lastTip = s.tipKey; return s;
}
function drain(key, max = 40) {
  for (let i = 0; i < max * 2 && (!__sr.seen().includes(key) || __sr.tutState().tip || __sr.tutState().tips); i++) sample();
  check(__sr.seen().includes(key), 'Actual lesson was never shown: ' + key);
}
function buy(ids) {
  for (const id of ids) check(__sr.buy(id), 'Actual lesson purchase failed: ' + id + ' ' + JSON.stringify(__sr.treeNodes().find(n => n.id === id)));
}
function pointer(type, x, y) {
  const canvas = document.getElementById('c'), r = canvas.getBoundingClientRect(), s = __sr.stats();
  canvas.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerType: 'mouse', pointerId: 1, isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
    clientX: r.left + x / s.W * r.width, clientY: r.top + y / s.H * r.height}));
}
function firstStrike() {
  const s = __sr.stats(); __sr.press('q'); check(__sr.planeAim().active, 'Actual Q did not arm the owned plane');
  pointer('pointerdown', s.W * 0.7, s.VH * 0.45); pointer('pointerup', s.W * 0.7, s.VH * 0.45);
  check(__sr.planes().find(p => p.key === 'q').strikes === 1, 'Real Q/left-click did not strike');
}
function collect() {
  const g = __sr.G, h = g.helis[0];
  const z = g.zombies.find(z => z.goldPrimary && !z.dead && !z.gone);
  if (z) { if (h.order?.kind !== 'attack' || h.order.z !== z) __sr.order(0, 'attack', z); return; }
  const f = g.loot.filter(f => !f.gone && (f.kind !== 'sos' || !f.saved && f.stage === 'wait')).sort((a, b) =>
    (a.kind === 'sos' ? 0 : 1) - (b.kind === 'sos' ? 0 : 1) || Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  if (f) __sr.order(0, 'move', f.x, f.y); else if (h.order) __sr.order(0, 'escort');
}
function tipShot() {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.press('Enter'); __sr.hp(9999); __sr.bot(false);
  // A genuine first-leg instruction with its live Viper arrow, no manufactured tutorial event.
  for (let i = 0; i < 30 && __sr.tutState().tipKey !== 'p_move'; i++) {
    __sr.sim(0.1); __sr.hold(true); __sr.frames(6); __sr.hold(false);
  }
  const state = __sr.tutState();
  check(state.tipKey === 'p_move' && state.tip === 'RIGHT-CLICK TO MOVE YOUR HELI.' &&
    state.layout?.target?.length === 2 && state.layout.target.every(Number.isFinite), 'Shot missed the actual first move instruction/arrow');
  __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
  return {tutorial: __sr.tutState(), heli: __sr.helis()[0], stats: __sr.stats()};
}

__sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
const lessonText = __sr.tutState().lessonText;
// Exact glyph inventory in src/art.js GL; every actual lesson is checked, including the Ram wall variant.
const glyphs = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:!?+-/%'()><=#*[]&$×";
const fontBad = lessonText.flatMap(l => [...l.text].filter(c => !glyphs.includes(c)).map(char => ({key: l.key, char})));
check(fontBad.length === 0 && lessonText.length === KEYS.length + 1, 'Unsupported lesson/font inventory: ' + JSON.stringify(fontBad));
const legs = [], purchased = []; let secondStrike = false, usedRam = false;
for (let leg = 1; leg <= 7; leg++) {
  __sr.press('Enter'); check(__sr.mode === 'play' && __sr.G.leg === leg, 'Real route START failed at leg' + leg);
  __sr.hp(9999); __sr.bot(false); sample();
  for (let i = 0; i < 360 && !__sr.G.result; i++) {
    collect();
    if (leg === 2) {
      const p = __sr.planes().find(p => p.key === 'q');
      if (__sr.G.run >= 3 && p.ready && p.strikes === 0) firstStrike();
      else if (__sr.G.run >= 28 && p.ready && p.strikes === 1) {
        __sr.press('q'); __sr.press('q'); check(__sr.planes().find(p => p.key === 'q').strikes === 2, 'Real second smart strike failed'); secondStrike = true;
      }
    }
    if (__sr.G.up.ram && __sr.G.run >= 3 && __sr.ramInfo().state === 'ready') {
      const before = __sr.ramInfo().uses; __sr.press(' '); check(__sr.ramInfo().uses === before + 1, 'Real Space did not activate the bought Ram'); usedRam = true;
    }
    __sr.sim(0.5); sample();
  }
  check(__sr.G.result === 'won', 'Natural lesson ride did not arrive within180s: ' + JSON.stringify(__sr.legState()));
  __sr.sim(4); sample(); check(__sr.mode === 'summary', 'Lesson ride did not reach its real summary');
  for (let i = 0; i < 6; i++) sample(); __sr.press('Enter'); sample();
  check(__sr.mode === 'depot', 'Completed lesson ride did not return to Depot');
  if (leg === 1) { __sr.give(5000, 20, 200); buy(['hdmg', 'hdmg', 'hrate', 'armor', 'magnet', 'a10']); purchased.push({leg, ids: ['hdmg2', 'hrate1', 'armor1', 'magnet1', 'a10']}); drain('currency_surv'); }
  if (leg === 2) buy(['hrange']);
  if (leg === 3) { drain('currency_gold'); buy(['a10Damage', 'a10Cooldown', 'a10Charge', 'f4', 'fireDamage', 'f4Cooldown']); purchased.push({leg, ids: ['a10Damage', 'a10Cooldown', 'a10Charge', 'f4', 'fireDamage', 'f4Cooldown']}); drain('p_charge'); }
  if (leg === 4) { buy(['ram']); purchased.push({leg, ids: ['ram']}); }
  if (leg === 5) { buy(['mgCar', 'steamVent', 'rockets', 'rocketPods', 'hellfire']); purchased.push({leg, ids: ['mgCar', 'steamVent', 'rockets', 'rocketPods', 'hellfire']}); }
  if (leg === 6) { buy(['b52']); __sr.depot('hangar'); sample(); drain('p_hangar'); __sr.depot('tree'); sample(); }
  legs.push({leg, seen: __sr.seen(), order: promotions.map(p => p.key), pending: __sr.tutState().pendingKeys});
}
check(secondStrike && usedRam, 'Bought plane/Ram inputs were not actually used');
const required = KEYS.filter(key => key !== 'p_b2');
check(required.every(key => __sr.seen().includes(key)), 'Leg1–7 lesson coverage missing: ' + required.filter(k => !__sr.seen().includes(k)));
check(promotions.find(p=>p.key==='p_golden')?.leg===3,'Golden introduction missed leg3');
const index = key => promotions.findIndex(p => p.key === key);
check(index('p_move') >= 0 && index('p_move') < index('currency_scrap') && index('currency_scrap') < index('currency_surv') &&
  index('p_golden') < index('p_sos') && index('p_sos') < index('p_wall') && index('p_wall') < index('p_brute_focus') &&
  index('p_brute_focus') < index('p_boom'), 'Natural lesson chronology differs from introduction order: ' + JSON.stringify(promotions));
check(__sr.seen().every(k => KEYS.includes(k)), 'An obsolete or automatic-weapon lesson was saved');
const priorSeen = JSON.stringify(__sr.save().seen); check(__sr.load(), 'Lesson receipts failed save reload'); __sr.title(); sample();
check(JSON.stringify(__sr.save().seen) === priorSeen && !__sr.tutState().tip, 'Reload/title lost receipts or showed a combat lesson');

// Pending lesson survives a screen/reload before promotion. The B2 event comes from the real finale gift.
__sr.setLeg(12); __sr.leg(12); __sr.hp(9999); __sr.bot(false); sample(); __sr.win();
for (let i = 0; i < 1100 && !__sr.finaleState().gifted; i++) __sr.sim(1 / 60);
check(__sr.finaleState().gifted && !__sr.seen().includes('p_b2') && __sr.save().flags['tipDue:p_b2'] === true,
  'Actual B-2 gift did not persist its pending lesson before promotion');
check(__sr.load(), 'Pending B-2 lesson failed reload'); __sr.title(); sample();
check(!__sr.seen().includes('p_b2') && __sr.save().flags['tipDue:p_b2'], 'Title consumed/marked a queued combat lesson');
__sr.leg(12); __sr.hp(9999); __sr.bot(false); sample(); __sr.win();
for (let i = 0; i < 1100 && !__sr.finaleState().gifted; i++) __sr.sim(1 / 60);
check(__sr.finaleState().gifted, 'Reloaded pending B-2 fixture did not receive its real E again'); drain('p_b2');
check(promotions.find(p => p.key === 'p_b2').text === 'A B-2 JOINS YOU, ONCE! PRESS E TWICE TO STRIKE.', 'B-2 lesson text differs from design');
const sequence = promotions.slice(), observations = samples.slice(), receipts = __sr.save().seen;
const shot = tipShot(); __sr.frames(30); check(__sr.late() <= 1, 'Held tip/arrow rendering added late atlas pages');
QA_DONE({legs, promotions: sequence, samples: observations, purchased, lessonText, fontBad, actualSecondStrike: secondStrike, actualRam: usedRam,
  fixtureFunds: {scrap: 5000, surv: 20, gold: 200, note: 'Ownership uses actual paid buy hooks; grants only fund lesson fixtures.'},
  receipts, pendingReload: true, shot, exactShotRendered30Frames: true, late: __sr.late()});
