// Isolated old/new renderer comparisons, including movement and age changes between captures.
function check(ok, message) { if (!ok) throw new Error(message); }
__sr.hold(false); __sr.reset(); __sr.node('a10', 1); __sr.start(); __sr.bot(false); __sr.hp(9999); __sr.thermal(0);
const before = JSON.stringify(__sr.fx()), random = Math.random, results = [];
try {
  for (const kind of ['opaque', 'alpha', 'dense']) for (const background of ['#000000', '#ffffff']) {
    for (const frame of [0, 1, 7, 20]) {
      const r = __sr.fxPixelCase(kind, frame, background);
      check(r && r.unstable === 0, 'Repeated original renderer changed without advancing: ' + JSON.stringify(r));
      check(kind === 'opaque' ? r.max === 0 : r.max <= 4 && r.mean <= 0.2,
        'Pixel FX comparison exceeded ' + (kind === 'opaque' ? 'exact opaque' : 'four-level alpha') + ' tolerance: ' + JSON.stringify(r));
      check(JSON.stringify(__sr.fx()) === before && Math.random === random, 'Comparison altered live effect lists or RNG');
      results.push(r);
    }
  }
  // Compare actual evolving production effects as well as the controlled painter cases.
  __sr.b2Strike(__sr.stats().W * 0.7, __sr.stats().VH * 0.55, Math.PI / 4);
  for (let i = 0; i < 400 && !__sr.planeShow().stats.b2.impacts; i++) __sr.frames(1);
  for (let i = 0; i < 5; i++) {
    const effects = JSON.stringify(__sr.fx()), r = __sr.fxPixelCase('real', i, '#ffffff');
    check(r.unstable === 0 && r.max <= 4 && r.mean <= 0.2, 'Actual moving effects exceed rounding tolerance: ' + JSON.stringify(r));
    check(JSON.stringify(__sr.fx()) === effects, 'Actual effect comparison changed live list counts');
    results.push(r); __sr.frames(4);
  }
  check(__sr.late() <= 1, 'Pixel FX comparison created late sprite pages');
  QA_DONE({opaqueExact: true, translucentChannelTolerance: 4, multipleMovingFrames: true,
    originalStable: true, liveListsAndRandomRestored: true, results, late: __sr.late()});
} finally { __sr.fxPixels(null); }
