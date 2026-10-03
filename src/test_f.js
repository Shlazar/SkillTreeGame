// test_f.js - small test helpers for the station-to-station game. Loaded after main creates __sr.
Object.assign(window.__sr, {
  line: () => ({
    stops: STOPS.map(({ id, name, kind, km, side }) => ({ id, name, kind, km, side })),
    legs: LEGS.map((l) => ({ n: l.n, from: l.from.id, to: l.to.id, len: l.len,
      stars: l.stars, rescue: l.rescue, finale: l.finale, events: l.events.map((e) => ({ ...e })) }))
  }),
  leg: (n, replay) => { startGame(n, replay); return G.leg; },
  legState: () => ({ leg: G.leg, t: +G.run.toFixed(2), len: legDef(G.leg)?.len || 0,
    result: G.result, replay: G.replay, events: G.events.slice(),
    stars: (SAVE.legs[G.leg]?.stars || [false, false, false]).slice(),
    gold: G.gold || 0, surv: G.surv, scrap: Math.floor(G.cash), wall: null })
});
