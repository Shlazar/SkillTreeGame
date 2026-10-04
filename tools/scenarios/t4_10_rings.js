// Compare production ellipse draws with the original sampled-point bitmap, including cache hits.
const first = __sr.testRings(), second = __sr.testRings();
for (const [label, result] of [['first', first], ['cached', second]]) {
  if (!result.ok || result.cases !== 320) throw new Error(label + ' ring pixels differ: ' + JSON.stringify(result));
  if (result.caches.shapes > 512 || result.caches.bitmaps > 512) throw new Error('Ring cache exceeded its bound');
}
if (JSON.stringify(first.caches) !== JSON.stringify(second.caches)) throw new Error('Repeated ring draws grew the cache');
QA_DONE({ exact: true, first, cached: second });
