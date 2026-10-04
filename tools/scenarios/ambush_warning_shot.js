// Run/shot mode, also with QA_REDUCED=1: a live brute warning in the naturally reached third encounter.
function check(ok, why) { if (!ok) throw new Error(why); }
const random = Math.random;
let seed = 0xA8B01;
Math.random = () => {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
try {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.leg(1, false); __sr.bot(false);
  const g = __sr.G, view = __sr.stats();
  check(g.tr.hp === g.up.hp && g.tr.hp === g.tr.max, 'Shot did not start with normal health');
  let nextCommand = 0, commands = 0, captured = false;
  for (let i = 0; i < 2400 && !g.result; i++) {
    if (g.run >= nextCommand) {
      const h = g.helis[0], visible = g.zombies.filter(z => !z.dead && !z.gone &&
        z.x - g.camX >= 0 && z.x - g.camX < view.W &&
        z.y - z.S.h * 0.5 - g.camY >= 19 && z.y - z.S.h * 0.5 - g.camY < view.VH);
      const score = z => (z.st === 2 ? -1000 : 0) + (z.type === 2 ? -600 : 0) + Math.hypot(z.x - h.x, (z.y - h.y) / 0.72);
      visible.sort((a, b) => score(a) - score(b));
      const z = visible[0];
      if (z && !(h.order?.kind === 'attack' && h.order.z === z)) {
        const x = z.x - g.camX, y = z.y - z.S.h * 0.5 - g.camY;
        __sr.rightDown(x, y); __sr.rightUp(x, y); commands++;
      }
      nextCommand = g.run + 0.5;
    }
    __sr.sim(0.05);
    const marker = __sr.uiBounds().ambushWarnings.find(r => r.label === 'BRUTE');
    if (g.ambush.index === 2 && marker && marker.seconds <= 1.6 && marker.seconds > 0.8) {
      __sr.frames(1); __sr.hold(true); __sr.frames(1); captured = true; break;
    }
  }
  const bounds = __sr.uiBounds(), warning = bounds.ambushWarnings.find(r => r.label === 'BRUTE');
  check(captured && !g.result && g.tr.hp > 0 && commands > 0 && warning && warning.seconds > 0,
    'Live third-encounter brute warning was not reached naturally');
  check(warning.y >= 19 && warning.x >= 0 && warning.x + warning.w <= bounds.viewport.W &&
    warning.y + warning.h <= bounds.viewport.VH && g.ambush.phase === 'hold' && g.tr.v === 0,
    'Warning shot leaves its play area or moving train');
  QA_DONE({warning, bounds, ambush: __sr.ambushState(), stats: __sr.stats(), commands,
    reduced: __sr.motionProbe(false).reduced, noForcedHealthKillsArrivals: true});
} finally { Math.random = random; }
