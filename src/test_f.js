// test_f.js - small test helpers for the station-to-station game. Loaded after main creates __sr.
Object.assign(window.__sr, {
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
