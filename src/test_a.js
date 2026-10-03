// test_a.js - test calls for part A (skills.js), added to window.__sr once the game has booted.
// skills() = what the first ring does in this run; gold(sx, sy) = a golden zombie at screen pixel (sx, sy).
Object.assign(window.__sr, {
  skills: () => ({ cow: G.up.cow, gold: G.up.gold, armor: G.up.armor,
    golden: G.zombies.filter((z) => z.gold && !z.dead).length, goldSeen: !!G.goldSeen,
    lockWait: G.lockWait, kills: G.kills, cash: G.cash, hp: G.tr.hp, v: +G.tr.v.toFixed(1) }),
  gold: (sx, sy) => {
    const z = makeGold(makeZombie(G.camX + sx, G.camY + sy, 0));
    G.zombies.push(z);
    return z;
  }
});
