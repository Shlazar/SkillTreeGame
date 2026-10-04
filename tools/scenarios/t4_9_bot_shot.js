function check(ok, message) { if (!ok) throw new Error(message); }
function freshPlanes(slots = ['a10', 'f4'], quiet = false) {
  __sr.hold(false); __sr.reset();
  for (const id of ['a10', 'f4', 'b52']) check(__sr.node(id, 1), 'Missing plane ' + id);
  __sr.SAVE.hangar = slots.slice();
  for (const key of ['p_auto', 't_attack', 'currency_scrap']) __sr.SAVE.seen[key] = true;
  __sr.start(); __sr.hp(9999); __sr.bot(false); __sr.rightUp(4, 70);
  check(JSON.stringify(__sr.planes().map(p => p.id)) === JSON.stringify(slots), 'Wrong equipped loadout');
  if (!quiet) return;
  const g = __sr.G, h = g.helis[0];
  g.zombies.length = g.rounds.length = g.timers.length = g.loot.length = g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000; g.station = null; g.walls.length = 0;
  h.cd = h.look = 1000000; h.tgt = null; h.order = {kind: 'move', x: h.x, y: h.y};
  __sr.sim(8); __sr.frames(240);
}
function botShot() {
  freshPlanes(); __sr.bot(true);
  let jet = null;
  for (let i = 0; i < 1800; i++) {
    __sr.frames(1);
    jet = __sr.planeShow().jets.find(j => j.bodyVisible && j.roared);
    if (__sr.G.run > 4 && jet) break;
  }
  check(jet && __sr.G.bot && __sr.planes().some(p => p.id === jet.id && p.strikes > 0),
    'Natural bot ride never showed a real automatic plane flight');
  __sr.hp(80); __sr.hold(true); __sr.frames(1);
  return {jet, planes: __sr.planes(), stats: __sr.stats(), heli: __sr.helis()[0]};
}
botShot();
