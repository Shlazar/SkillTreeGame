// test_e.js - test calls for the look of the land (land.js), added to window.__sr after start-up.
Object.assign(window.__sr, {
  // landBench(n): paint n new ground chunks far away; the average ms for one (the painting only,
  // and with its plan and shadows)
  landBench: (n) => {
    n = n || 10;
    const [c, g] = mk(CH, CH);
    let t = performance.now();
    for (let i = 0; i < n; i++) paintLand(g, 900 + i, -900);
    const paint = (performance.now() - t) / n;
    t = performance.now();
    for (let i = 0; i < n; i++) bakeChunk(950 + i, -950);
    const full = (performance.now() - t) / n;
    c.width = 1;
    return { paint: +paint.toFixed(2), full: +full.toFixed(2) };
  },
  // late() = how many sprites went into the late atlas pages (made after the first frame)
  late: () => LATE.length
});
