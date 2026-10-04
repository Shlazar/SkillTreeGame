// test_z.js - test calls for the horde (horde.js).
Object.assign(window.__sr, {
  // horde() = the spawner now: streams coming in, waves so far, the horde's numbers here
  horde: () => ({ streams: STREAMS.length, waves: G.waves || 0, alive: G.zombies.length, layer: CROWD.list.length,
    booms: BOOMS.length, hd: G.demo ? null : Object.assign({}, horde()) }),
  // stream(n, edge): a stream of n now (edge -1 left, 1 right, 0 top); wave(): a wave now
  stream: (n, edge) => addStream(n || 20, edge || 0, false),
  wave: () => dispatchLegEvent('wave', { n: Math.round(horde().size * 1.5) }, 'qa-wave'),
  // crowd(n, sx, sy, r, type): n walking zombies round screen pixel (sx, sy) within r px
  crowd: (n, sx, sy, r, type) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * (r || 40);
      G.zombies.push(newDead(G.camX + sx + Math.cos(a) * d, G.camY + sy + Math.sin(a) * d * FORE, type == null ? (Math.random() < 0.06 ? 2 : Math.random() < 0.15 ? 1 : 0) : type));
    }
    return G.zombies.length;
  },
  // up(k, v): set a skill tree number of this run (G.up.boom, G.up.silver...)
  up: (k, v) => { G.up[k] = v; return G.up[k]; },
  // cost(n): ms per call of the crowd layer's parts (after one whole frame is drawn): sorting the
  // dead into the layer, and drawing it; layer = how many were in it
  cost: (n) => {
    n = n || 30;
    render();
    const x0 = G.camX - 8, x1 = G.camX + W + 8, y0 = G.camY - 8, y1 = G.camY + VH + 8;
    let t = performance.now();
    for (let i = 0; i < n; i++) { DL.length = 0; VZ.length = 0; gatherHorde(x0, x1, y0, y1); }
    const g = (performance.now() - t) / n;
    t = performance.now();
    for (let i = 0; i < n; i++) drawHorde(0, 0);
    const d = (performance.now() - t) / n;
    t = performance.now();
    for (let i = 0; i < n; i++) render();
    const r = (performance.now() - t) / n, layer = CROWD.list.length, single = VZ.length, keep = G.zombies;
    // the same frame with no dead at all (what the rest of the picture costs)
    G.zombies = [];
    render();
    t = performance.now();
    for (let i = 0; i < n; i++) render();
    const r0 = (performance.now() - t) / n;
    G.zombies = keep;
    const rf = (f) => { CROWD.force = f; render(); const t0 = performance.now(); for (let i = 0; i < n; i++) render(); CROWD.force = null; return +((performance.now() - t0) / n).toFixed(2); };
    const allA = rf('a'), allOne = rf('one');
    return { gather: +g.toFixed(2), draw: +d.toFixed(2), render: +r.toFixed(2), renderNoDead: +r0.toFixed(2), layer, single, onTrain: G.onTrain, allA, allOne };
  },
  // blast(sx, sy): an explosive zombie blows up at screen pixel (sx, sy)
  blast: (sx, sy) => zombieBlast(G.camX + sx, G.camY + sy)
});
