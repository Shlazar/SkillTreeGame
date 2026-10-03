// test_f.js - small test helpers for the station-to-station game. Loaded after main creates __sr.
Object.assign(window.__sr, {
  // Report only implemented unit systems; later weapons stay neutral until their own tasks.
  units: () => G ? {
    heli: { count: G.helis.length, damage: G.up.dmg, rate: G.up.rate, range: hRange(), winch: !!G.up.winch },
    rockets: { chance: G.up.rocketChance || 0, enabled: !!G.up.rocketChance },
    pods: null, hellfire: null, planes: [], cars: [], gadgets: []
  } : null,
  // Copy firing diagnostics and projectiles without exposing mutable targets or heli objects.
  rockets: () => {
    if (!G) return null;
    const s = heliWeaponState();
    return { shots: s.shots, rockets: s.rockets, first: s.first, last: s.last, maxGap: s.maxGap, forced: s.forced,
      impacts: s.impacts, kills: s.kills, lastImpact: s.lastImpact ? { ...s.lastImpact } : null,
      active: G.rounds.filter((r) => r.kind === 'rocket').map((r) => ({ sx: r.sx, sy: r.sy, sz: r.sz,
        bx: r.bx, by: r.by, age: r.age, T: r.T, dmg: r.dmg, R: r.R, position: rocketAt(r) })) };
  },
  // Real pointer events exercise the same held-state and order paths as the mouse.
  rightDown: (sx = W / 2, sy = H / 2) => {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, buttons: 2, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + sx / W * r.width, clientY: r.top + sy / H * r.height }));
    return M.right;
  },
  // Release the right button through the canvas input handler.
  rightUp: (sx = M.x, sy = M.y) => {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 2, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + sx / W * r.width, clientY: r.top + sy / H * r.height }));
    return M.right;
  },
  // The live gun effects, without advancing or drawing a frame.
  gunVisual: () => ({ range: { radius: G ? hRange() : 0, visible: G ? heliRangeVisible() : false },
    hits: HITS.map((h) => ({ x: h.x, y: h.y, scale: h.scale, age: h.t })) }),
  // The exact stat segments that the node tooltip draws at its current level.
  treeStats: (id) => {
    const n = NODE[id];
    return n ? [n.stat, n.stat2].filter(Boolean).map((s) => statSegs(s, lv(id), lv(id) >= maxLv(n))) : [];
  },
  scrapPops: () => texts.filter((t) => t.c === U.blue && t.v?.startsWith('+'))
    .map((t) => ({ text: t.v, scale: t.s, x: t.x - G.camX, y: t.y - G.camY, color: t.c })),
  treeShown: () => NODES.filter((n) => shownAs(n) > 0).map((n) => n.id),
  treeArt: () => NODES.map((n) => ({ id: n.id, w: NICON[n.id]?.width || 0, h: NICON[n.id]?.height || 0 })),
  treeOverlap: () => {
    const pairs = [];
    for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i], b = NODES[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 1.2) pairs.push({ a: a.id, b: b.id, distance: +d.toFixed(3) });
    }
    return pairs;
  },
  summaryView: () => G.sum ? summaryLayout(G.sum, G.sum.plan || sumPlan(G.sum)) : null,
  depotRoute: () => depotRouteState(),
  currencyState: () => ({ shown: { scrap: true, surv: !!SAVE.flags.survShown, gold: !!SAVE.flags.goldShown },
    x: { scrap: currencyX('scrap'), surv: currencyX('surv'), gold: currencyX('gold') }, chest: SAVE.chest, gold: SAVE.gold }),
  line: () => ({
    stops: STOPS.map(({ id, name, kind, km, side }) => ({ id, name, kind, km, side })),
    legs: LEGS.map((l) => ({ n: l.n, from: l.from.id, to: l.to.id, len: l.len,
      stars: l.stars, rescue: l.rescue, finale: l.finale, events: l.events.map((e) => ({ ...e })) }))
  }),
  leg: (n, replay) => { startGame(n, replay); return G.leg; },
  win: () => { window.__sr.jump(8); },
  payGold: (id, amount, scrapIfNot) => payGold(id, amount, scrapIfNot),
  setLeg: (n) => {
    n = clamp(Math.floor(Number(n) || 1), 1, 13);
    for (let i = 1; i < n; i++) legSave(i).won = true;
    SAVE.leg = n;
    saveSave();
    return SAVE.leg;
  },
  legState: () => ({ leg: G.leg, t: +G.run.toFixed(2), len: legDef(G.leg)?.len || 0,
    result: G.result, replay: G.replay, events: G.events.slice(),
    stars: (SAVE.legs[G.leg]?.stars || [false, false, false]).slice(),
    gold: G.gold || 0, surv: G.surv, scrap: Math.floor(G.cash), wall: null })
});
