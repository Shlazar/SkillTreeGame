// test_a.js - current armor/Hunt diagnostics and a controlled golden-zombie fixture.
// gold(sx, sy) converts a zombie through the production path; it does not assign a route reward id.
Object.assign(window.__sr, {
  skills: () => ({ cow: G.up.cow, armor: G.up.armor, goldHunt: G.up.goldHunt,
    silver: G.up.silver, boom: G.up.boom,
    golden: G.zombies.filter((z) => z.gold && !z.dead).length, goldSeen: !!G.goldSeen,
    kills: G.kills, cash: G.cash, hp: G.tr.hp, v: +G.tr.v.toFixed(1) }),
  gold: (sx, sy) => {
    const z = makeGold(makeZombie(G.camX + sx, G.camY + sy, 0));
    G.zombies.push(z);
    return z;
  }
});
