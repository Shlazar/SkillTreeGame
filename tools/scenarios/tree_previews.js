// Run mode: the MG/A-10 cards fit three viewports, stay pure while animated, and use real survivor purchases.
function check(ok, why) { if (!ok) throw new Error(why); }
function snapshot(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, item) => {
    if (typeof item === 'function') return '[function]';
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[reference]';
      seen.add(item);
    }
    return item;
  });
}
function weapons() { return JSON.stringify([__sr.units(), __sr.rockets(), __sr.planes()]); }
function card(id) {
  const b = __sr.uiBounds(), t = b.depot?.tooltip, p = t?.preview, area = b.depot?.treeArea;
  check(t?.id === id && p?.id === id && p.w > 0 && p.h > 0, 'Actual preview missing: ' + id);
  check(t.x >= 0 && t.x + t.w <= b.viewport.W && t.y >= area.y && t.y + t.h <= area.y + area.h,
    'Card leaves its tree panel: ' + JSON.stringify({t, area, viewport: b.viewport}));
  check(p.x >= t.x && p.y >= t.y && p.x + p.w <= t.x + t.w && p.y + p.h <= t.y + t.h,
    'Preview leaves card: ' + id);
  check(__sr.infoFit().bad.length === 0, 'Preview text overflows: ' + id);
  return {viewport: b.viewport, card: t};
}
const sizes = [[640, 360], [700, 1000], [640, 266]], keys = ['innerWidth', 'innerHeight', 'devicePixelRatio'];
const original = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(window, k)])), rows = [];
try {
  for (const [width, height] of sizes) {
    for (const [key, value] of [['innerWidth', width], ['innerHeight', height], ['devicePixelRatio', 1]])
      Object.defineProperty(window, key, {configurable: true, value});
    window.dispatchEvent(new Event('resize'));
    for (const id of ['mgCar', 'a10']) {
      __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
      check(__sr.node('armor', 1), 'Armor fixture unavailable');
      __sr.SAVE.flags.survShown = true;
      for (const lesson of __sr.tutState().lessonText) __sr.SAVE.seen[lesson.key] = true;
      __sr.give(0, 1, 0); __sr.depot('tree'); __sr.hold(true); __sr.frames(120);
      const node = __sr.treeNodes().find(n => n.id === id);
      check(node && node.lv === 0 && node.cur === 'surv' && node.cost[0] === 1, 'First unlock cost changed: ' + id);
      __sr.treeCam(node.x, node.y, 1); check(__sr.hoverNode(id), 'Hover failed: ' + id); __sr.frames(30);
      const before = card(id);
      check(before.card.footer === 'CLICK TO BUY' && before.card.priceText === '1 SURVIVOR', 'Unowned footer missing: ' + id);
      const beforeWeapons = weapons(), beforeGame = snapshot(__sr.G), beforeSave = JSON.stringify(__sr.save());
      const random = Math.random; let randomCalls = 0;
      Math.random = () => { randomCalls++; return random(); };
      try { __sr.frames(60); } finally { Math.random = random; }
      const after = card(id), reduced = __sr.motionProbe(false).reduced;
      check(JSON.stringify(__sr.save()) === beforeSave && snapshot(__sr.G) === beforeGame && weapons() === beforeWeapons,
        'Rendering changed save/game/weapons: ' + id);
      check(randomCalls === 0, 'Preview consumed gameplay randomness: ' + id + ' calls=' + randomCalls);
      check(after.card.preview.animated === !reduced && after.card.preview.reduced === reduced,
        'Motion preference missing from actual preview');
      check(reduced ? after.card.preview.phase === before.card.preview.phase :
        Math.abs(after.card.preview.phase - before.card.preview.phase) > 0.1, 'Preview phase did not follow motion preference');
      const wallet = __sr.save(); check(__sr.clickNode(id), 'Purchase click unavailable: ' + id); __sr.frames(120);
      const bought = __sr.save();
      check(bought.nodes[id] === 1 && bought.surv === wallet.surv - 1 && bought.scrap === wallet.scrap && bought.gold === wallet.gold,
        'Actual node purchase did not charge exactly one survivor: ' + id);
      __sr.hoverNode(id); __sr.frames(30); const owned = card(id);
      check(owned.card.footer === 'OWNED' && owned.card.priceText === '', 'Owned preview footer missing: ' + id);
      rows.push({window: {width, height}, id, before, after, owned, randomCalls, gameAndSaveUnchanged: true, paidSurvivors: 1});
    }
  }
} finally {
  for (const key of keys) if (original[key]) Object.defineProperty(window, key, original[key]); else delete window[key];
  window.dispatchEvent(new Event('resize')); __sr.hold(false);
}
QA_DONE({reduced: __sr.motionProbe(false).reduced, previews: rows, viewportRestored: true});
