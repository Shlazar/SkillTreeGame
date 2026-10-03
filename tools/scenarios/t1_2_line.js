// Check all twelve legs against the final route, including reward kinds and rescue locations.
const line = __sr.line();
const names = ['DEPOT', 'MILLBROOK', 'CORNFIELD HALT', 'RED BARN', 'SILO JUNCTION', 'OLD MILL',
  'PUMPKIN HALT', 'CROSSROADS', 'WATER TOWER', 'HAYBALE CAMP', 'WINDMILL HALT', 'GRAIN ELEVATOR', 'FARMLANDS TERMINUS'];
if (line.stops.length !== 13 || line.legs.length !== 12) throw new Error('Wrong route length');
line.stops.forEach((s, n) => {
  if (s.name !== names[n]) throw new Error('Wrong station at ' + n);
  const kind = n === 12 ? 'end' : n === 0 || n % 2 ? 'big' : 'small';
  if (s.kind !== kind || Math.abs(s.km - n * 1.2) > 1e-8) throw new Error('Wrong station kind or km');
});
line.legs.forEach((l, i) => {
  if (l.n !== i + 1 || l.from !== line.stops[i].id || l.to !== line.stops[i + 1].id) throw new Error('Broken connection');
  if (l.len !== 2400 || l.stars !== (i >= 2) || l.finale !== (i === 11)) throw new Error('Wrong leg metadata');
  if (!!l.rescue !== [4, 8, 10].includes(l.n)) throw new Error('Wrong rescue leg');
});
__sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(12); __sr.frames(150); __sr.hold(true);
QA_DONE({ stops: line.stops.map((s) => s.name + ' ' + s.kind), legs: line.legs.length, routeKm: line.stops[12].km });
