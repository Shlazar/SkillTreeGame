// test_j.js - test calls for the effects and the scenery (juice.js, scenery.js).
Object.assign(window.__sr, {
  // the props and the station sprites, for a test sheet
  artJ: () => ({ PROPS, SCN }),
  // juice() = how much of each effect is alive now
  juice: () => ({ gibs: JUICE.gibs.length, debris: JUICE.debris.length, pools: JUICE.pools.length, coins: JUICE.coins.length,
    emit: JUICE.emit.length, birds: BIRDS.length, flying: BIRDS.filter((b) => !b.sit).length, parts: parts.length }),
  // boom(sx, sy): a 105 blast at screen pixel (sx, sy), as the player's shell would make it
  boom: (sx, sy) => explode(G.camX + sx, G.camY + sy, false),
  // flock(sx, sy): crows land at screen pixel (sx, sy)
  flock: (sx, sy) => addFlock(G.camX + sx, G.camY + sy),
  coins: (sx, sy, n) => coinPop(G.camX + sx, G.camY + sy, n || 12),
  // groundAt(sx, sy): the baked ground and the decal pixel under screen pixel (sx, sy)
  groundAt: (sx, sy) => {
    const x = Math.round(G.camX + sx), y = Math.round(G.camY + sy), ci = Math.floor(x / CH), cj = Math.floor(y / CH);
    const gc = GROUND.get(ckey(ci, cj)), dc = DECALS.get(ckey(ci, cj));
    const px = (c) => c ? Array.from((c.c || c).getContext('2d').getImageData(x - ci * CH, y - cj * CH, 1, 1).data) : null;
    return { g: px(gc), d: px(dc), statics: G.statics.filter((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 30).map((p) => [p.x - x, p.y - y, p.d.spr.width, p.d.spr.height]) };
  },
  // atlas() = how full the sprite atlas is
  atlas: () => ({ n: ATL.size, out: [...ATL.values()].filter((v) => !v).length, atY, atH }),
  // propsAt(sx, sy, r): the props of the chunk plans within r px of screen pixel (sx, sy): [kind, dx, dy, w, h]
  propsAt: (sx, sy, r) => {
    const x = G.camX + sx, y = G.camY + sy, out = [], kind = (d) => Object.keys(PROPS).find((k) => PROPS[k].includes(d)) || '?';
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const p of plan(Math.floor(x / CH) + i, Math.floor(y / CH) + j).props) {
      if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r) out.push([kind(p.d), p.x - x, p.y - y, p.d.spr.width, p.d.spr.height]);
    }
    return out;
  }
});
