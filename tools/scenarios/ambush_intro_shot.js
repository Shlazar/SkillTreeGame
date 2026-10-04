// Run/shot mode: the real third ambush after the player responds to the runner flank.
__sr.reset(); __sr.start(); __sr.bot(false);
for (let i = 0; i < 800 && !__sr.G.result && !(__sr.G.ambush.index === 2 && __sr.G.ambush.phase === 'hold'); i++) {
  const g = __sr.G;
  if (i % 6 === 0) {
    const z = g.zombies.filter(z => !z.dead && !z.gone).sort((a, b) =>
      (b.st === 2) - (a.st === 2) || Number(b.run) - Number(a.run))[0];
    if (z) { const x = z.x - g.camX, y = z.y - z.S.h / 2 - g.camY;
      __sr.rightDown(x, y); __sr.rightUp(x, y); }
  }
  __sr.sim(0.1);
}
if (__sr.G.result || __sr.G.ambush.index !== 2) throw new Error('Third ambush was not reached');
__sr.frames(36); __sr.hold(true); __sr.frames(1);
QA_DONE({ambush: __sr.ambushState(), stats: __sr.stats()});
