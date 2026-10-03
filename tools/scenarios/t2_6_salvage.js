// Run mode: Armor, Magnet and Salvage Crew change real run stats, pickups and fractional scrap pay.
function check(ok, message) { if (!ok) throw new Error(message); }
function close(actual, expected, label) {
  check(Math.abs(actual - expected) < 1e-7, label + ': ' + actual + ' != ' + expected);
}
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
function fresh(armor, magnet, crew, leg) {
  __sr.hold(false);
  __sr.reset();
  for (const [id, level] of [['armor', armor], ['magnet', magnet], ['salvageCrew', crew]]) {
    check(__sr.node(id, level), 'Unknown upgrade ' + id);
  }
  if (leg) __sr.setLeg(leg);
  __sr.start();
  isolate();
}
function tenWalkers() {
  const {W, H} = __sr.stats();
  for (let i = 0; i < 10; i++) {
    const z = __sr.spawn(0, W * 0.2 + i * 3, H * 0.65);
    __sr.hit(z, 999, 'mg');
    check(z.dead, 'Isolated walker survived');
  }
  return {kills: __sr.G.kills, scrap: __sr.G.cash, pay: __sr.G.pay.kills, carry: +__sr.G.killAcc.toFixed(6)};
}
function collect(kind) {
  const i = __sr.lootSpawn(kind), before = __sr.G.cash;
  const f = __sr.G.loot[i], h = __sr.G.helis[0];
  close(Math.hypot(f.x - h.x, f.y - h.y), 30, 'Fixture pickup distance');
  __sr.sim(1 / 60);
  check(f.gone && __sr.G.lootFly.some(q => q.f === f), kind + ' did not fly inside upgraded radius');
  __sr.sim(0.35);
  check(!__sr.G.lootFly.some(q => q.f === f), kind + ' flight did not complete');
  return __sr.G.cash - before;
}
function pop(scale, text, label) {
  const pops = __sr.scrapPops();
  check(pops.some(p => p.scale === scale && (!text || p.text === text)), label + ': ' + JSON.stringify(pops));
}
function popsShot() {
  // Keep this setup identical to t2_6_pops_shot.js: real pickup flights produce both blue sizes.
  fresh(6, 5, 3);
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
  check(g.loot[pile].gone && g.pay.loot === 18, 'Shot pile did not automatically collect +24%');
  h.x += 100;
  h.vx = h.vy = 0;
  h.order = {kind: 'move', x: h.x, y: h.y};
  const crate = __sr.lootSpawn('crate');
  __sr.sim(0.35);
  check(g.loot[crate].gone && g.pay.loot === 80, 'Shot crate did not automatically collect +24%');
  __sr.frames(1);
  __sr.hold(true);
}

fresh(0, 0, 0);
const zero = __sr.stats().up;
close(zero.hp, 80, 'Base HP');
close(zero.pickup, 14, 'Base pickup');
close(zero.salvage, 0, 'Base salvage');
close(__sr.G.tr.max, 80, 'Base actual train health');
const baseKills = tenWalkers();
check(baseKills.kills === 10 && baseKills.scrap === 10 && baseKills.pay === 10, 'Base ten-kill payout');
close(baseKills.carry, 0, 'Base kill carry');
const outside = __sr.lootSpawn('pile');
__sr.sim(0.15);
check(!__sr.G.loot[outside].gone && !__sr.G.lootFly.length && __sr.G.cash === 10, 'Base Magnet reached a pile 30 px away');
__sr.lootGo(outside);
__sr.sim(0.4);
check(__sr.G.loot[outside].gone && __sr.G.pay.loot === 15 && __sr.G.cash === 25, 'Base pile did not pay 15');
pop(1, '+15', 'Base small blue pile pop');

fresh(6, 5, 4);
const maximum = __sr.stats().up;
close(maximum.hp, 152, 'Max Armor HP');
close(maximum.pickup, 31.5, 'Max Magnet pickup');
close(maximum.salvage, 0.32, 'Max Salvage Crew');
close(__sr.G.tr.hp, 152, 'Actual upgraded train health');
close(__sr.G.tr.max, 152, 'Actual upgraded health capacity');

fresh(0, 5, 3);
const boostedKills = tenWalkers();
check(boostedKills.kills === 10 && boostedKills.scrap === 12 && boostedKills.pay === 12, 'Crew 3 ten-kill payout: ' + JSON.stringify(boostedKills));
close(__sr.G.killAcc, 0.4, 'Boosted kill carry');
close(__sr.G.lootAcc, 0, 'Kills must not consume loot carry');
const pile1 = collect('pile');
check(pile1 === 18 && __sr.G.pay.loot === 18, 'First boosted pile');
close(__sr.G.lootAcc, 0.6, 'First pile fractional carry');
close(__sr.G.killAcc, 0.4, 'Loot must not consume kill carry');
pop(2, '+18', 'Boosted regular pile size');
const pile2 = collect('pile');
check(pile2 === 19 && __sr.G.pay.loot === 37, 'Second boosted pile did not retain fractional scrap');
close(__sr.G.lootAcc, 0.2, 'Second pile carry');

// Gold quantities are not scrap. Duplicate receipts use the same boosted loot pot as replay rewards.
fresh(0, 0, 3, 3);
let paid = __sr.payGold('t2_6:gold', 1, 10);
check(paid.gold === 1 && paid.scrap === 0 && __sr.G.gold === 1 && __sr.save().gold === 1, 'Salvage multiplied actual gold');
const duplicatePay = [];
for (const expected of [12, 12, 13]) {
  paid = __sr.payGold('t2_6:gold', 1, 10);
  check(paid.gold === 0 && paid.scrap === expected, 'Duplicate gold scrap alternative: ' + JSON.stringify(paid));
  duplicatePay.push(paid.scrap);
}
close(__sr.G.lootAcc, 0.2, 'Duplicate gold fractional carry');
close(__sr.G.killAcc, 0, 'Gold alternatives must not consume kill carry');
check(__sr.G.cash === 37 && __sr.save().scrap === 37 && __sr.save().gold === 1, 'Duplicate alternative banked totals');
__sr.leg(3, true);
isolate();
paid = __sr.payGold('t2_6:replay', 2, 10);
check(__sr.G.replay && paid.gold === 0 && paid.scrap === 12 && __sr.save().gold === 1, 'Replay reward did not pay boosted scrap only');
close(__sr.G.lootAcc, 0.4, 'Replay alternative carry');

// Brutes historically have a small scrap pop: Crew makes that size 2; large crates become 3.
fresh(0, 0, 3);
const {W, H} = __sr.stats(), brute = __sr.spawn(2, W * 0.3, H * 0.65);
__sr.hit(brute, 999, 'mg');
check(brute.dead, 'Brute survived');
pop(2, null, 'Boosted brute retains baseline size plus one');

popsShot();
pop(2, '+18', 'Shot boosted pile');
pop(3, '+62', 'Shot boosted crate');
close(__sr.stats().up.hp, 152, 'Shot armor');
close(__sr.stats().up.pickup, 31.5, 'Shot magnet');
close(__sr.stats().up.salvage, 0.24, 'Shot crew');
const shotPops = __sr.scrapPops();
__sr.frames(30);
check(__sr.late() <= 1, 'Boosted text/armor created extra late atlas pages');
QA_DONE({zero: {hp: zero.hp, pickup: zero.pickup, salvage: zero.salvage},
  maximum: {hp: maximum.hp, pickup: maximum.pickup, salvage: maximum.salvage},
  baseKills, boostedKills, pickup: {distance: 30, baseRejected: true, maximumCollected: true},
  piles: [pile1, pile2], duplicateGoldScrap: duplicatePay, replayScrap: paid.scrap,
  goldUnchanged: true, separateFractionalPots: true, shotPops, shotRendered: true, late: __sr.late()});
