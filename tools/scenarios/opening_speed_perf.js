// Natural opening at both player speeds: include simulation and drawing in the frame cost.
function check(ok, why) { if (!ok) throw new Error(why); }
const originalRandom = Math.random, rows = [];
try {
  for (const speed of [1, 2]) {
    let seed = 0x0F40;
    Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.start(); __sr.bot(false);
    if (speed === 2) __sr.press('f');
    const frames = 1200 / speed, before = performance.now();
    __sr.frames(frames);
    const frameMs = (performance.now() - before) / frames, g = __sr.G;
    const bench = __sr.bench(60), late = __sr.late();
    check(!g.result && g.tr.hp > 0 && g.kills > 20, 'Natural opening stopped or had no fight');
    check(frameMs < 16.7 && bench < 8 && late <= 1, 'Opening exceeds frame/atlas budget: ' + JSON.stringify({speed, frameMs, bench, late}));
    rows.push({speed, frames, gameSeconds: +g.run.toFixed(2), kills: g.kills, hp: +g.tr.hp.toFixed(2),
      frameMs: +frameMs.toFixed(2), drawMs: +bench.toFixed(2), late});
  }
} finally { Math.random = originalRandom; }
QA_DONE({rows, method: 'Normal-health leg1, natural enemies and1200/speed complete frames. Timing includes game steps and drawing; headless average, not real display FPS.'});
