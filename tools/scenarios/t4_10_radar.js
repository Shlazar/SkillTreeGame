__sr.hold(false); __sr.reset(); __sr.start(); __sr.bot(false);
const zombies = __sr.G.zombies, before = JSON.stringify(__sr.fx()), result = __sr.testRadar();
if (!result || !result.ok || result.cases !== 32 || result.mismatchPixels !== 0 || result.maxChannelDelta !== 0) {
  throw new Error('Radar zombie batching differs from the legacy pixels: ' + JSON.stringify(result));
}
if (__sr.G.zombies !== zombies || JSON.stringify(__sr.fx()) !== before || __sr.late() > 1) {
  throw new Error('Radar comparison changed live arrays/effects or created late atlas pages');
}
__sr.frames(30);
QA_DONE({opaqueDotsExact: true, fractionalBoundaryAndOverlapCases: 32, result, liveStateRestored: true, late: __sr.late()});
