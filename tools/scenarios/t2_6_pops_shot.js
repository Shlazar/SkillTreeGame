// Shot mode: Armor plates, upgraded Magnet pickup and larger blue Salvage Crew pile/crate rewards.
__sr.hold(false);
__sr.reset();
for (const [id, level] of [['armor', 6], ['magnet', 5], ['salvageCrew', 3]]) {
  if (!__sr.node(id, level)) throw new Error('Unknown upgrade ' + id);
}
__sr.start();
function isolate() {
  const g = __sr.G, h = g.helis[0];
  __sr.bot(false);
  g.zombies.length = 0;
  g.rounds.length = 0;
  g.timers.length = 0;
  g.loot.length = 0;
  g.lootFly.length = 0;
  g.spawnCd = g.railCd = g.waveCd = 1000000;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  h.tgt = null;
  h.cd = h.look = 1000000;
}
isolate();
__sr.sim(8);
__sr.frames(240);
isolate();
const g = __sr.G, h = g.helis[0], {W, H} = __sr.stats();
h.x = g.camX + W * 0.5;
h.y = g.camY + H * 0.62;
h.vx = h.vy = 0;
h.order = {kind: 'move', x: h.x, y: h.y};
const pile = __sr.lootSpawn('pile');
__sr.sim(0.35);
if (!g.loot[pile].gone || g.pay.loot !== 18) throw new Error('Shot pile did not automatically collect +24%');
h.x += 100;
h.vx = h.vy = 0;
h.order = {kind: 'move', x: h.x, y: h.y};
const crate = __sr.lootSpawn('crate');
__sr.sim(0.35);
if (!g.loot[crate].gone || g.pay.loot !== 80) throw new Error('Shot crate did not automatically collect +24%');
__sr.frames(1);
__sr.hold(true);
