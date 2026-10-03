// test_f.js - small test helpers for the station-to-station game. Loaded after main creates __sr.
Object.assign(window.__sr, {
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
