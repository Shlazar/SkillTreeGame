// run mode: complete final-design route with earned purchases, all nine units, rescues, gold, stars and the gate hold.
// Every clean first-pass leg must meet its final-design scrap target within 15%.
const CHECK_TARGETS = true;
const TARGETS = [80, 95, 115, 135, 160, 190, 225, 265, 310, 365, 430, 500];
// Desired cumulative LEVEL increments after each Depot, capped by FINAL_DESIGN's likely-buy progression.
// No Salvage/Hunt income boosts; no free currencies, ownership, travel, damage or rewards.
const PLAN = [
  {hdmg: 1, hrate: 1, armor: 1, magnet: 1, a10: 1},
  {hdmg: 2, hrange: 1, a10Damage: 1},
  {f4: 1, rockets: 1, a10Cooldown: 1, hdmg: 3, hrate: 2, armor: 2},
  {rocketPods: 1, rockets: 2, podDamage: 1, podReload: 1, hrange: 2, hrate: 3},
  {ram: 1, ramPower: 1, ramCooldown: 1, a10Lines: 1, armor: 3, a10Damage: 2},
  {podSalvo: 1, podDamage: 2, podReload: 2, magnet: 2, a10Cooldown: 2, napalm: 1},
  {mgCar: 1, mgDamage: 1, mgRate: 1, mgRange: 1, mgTurrets: 1, a10Lines: 2, ramPower: 2, armor: 4, apRounds: 1},
  {steamVent: 1, steamDamage: 1, steamSpeed: 1, steamReach: 1, a10Damage: 3, a10Cooldown: 3, fireDamage: 1, f4Cooldown: 1, hotCloud: 1, a10Charge: 1},
  {b52: 1, b52Bombs: 1, b52Cooldown: 1, b52Blast: 1, fireDamage: 2, f4Cooldown: 2, fireLength: 1, mgDamage: 2},
  {hellfire: 1, hellfireDamage: 1, hellfireReload: 1, hellfireBlast: 1, ramCooldown: 2, ramDuration: 1, steamDamage: 2, steamSpeed: 2, mgDamage: 3},
  {katyusha: 1, hdmg: 4, mgRate: 3, b52Bombs: 2, b52Cooldown: 2, hellfireDamage: 2, fireLength: 2, katyushaRockets: 2, katyushaReload: 1, katyushaBlast: 1}
];
function check(ok, message) { if (!ok) throw new Error(message); }
function seeded(seed, run) {
  const before = Math.random;
  Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return run(); } finally { Math.random = before; }
}
const wallets = () => { const s = __sr.save(); return {scrap: s.scrap, surv: s.surv, gold: s.gold}; };
const ownedTree = () => Object.fromEntries(Object.entries(__sr.save().nodes).filter(([id, level]) => level > 0));
function steerCollector() {
  const g = __sr.G, h = g.helis[0];
  // The intro's rear ambush needs a real Viper order before collection/travel can resume.
  if (g.ambush?.phase === 'hold') {
    const target = g.zombies.find(z => z.ambushId && !z.dead && !z.gone);
    if (target) { if (h.order?.kind !== 'attack' || h.order.z !== target) __sr.order(0, 'attack', target); return; }
  }
  const golden = g.zombies.filter(z => z.goldItemId && !z.dead && !z.gone).sort((a, b) => Number(b.goldPrimary) - Number(a.goldPrimary))[0];
  if (golden) {
    if (h.order?.kind !== 'attack' || h.order.z !== golden) __sr.order(0, 'attack', golden);
    return;
  }
  const distance = f => Math.hypot(f.x - h.x, f.y - h.y);
  const finds = g.loot.filter(f => !f.gone && (f.kind !== 'sos' || !f.saved && f.stage === 'wait'));
  const priority = f => f.kind === 'sos' ? 0 : f.kind === 'gold' ? 1 : 2;
  finds.sort((a, b) => priority(a) - priority(b) || distance(a) - distance(b));
  const f = finds[0];
  if (f) {
    if (h.order?.kind !== 'move' || h.order.x !== f.x || h.order.y !== f.y) __sr.order(0, 'move', f.x, f.y);
  } else if (h.order) __sr.order(0, 'escort');
}
function rideNatural(n, priorRows) {
  for (let step = 0; step < 1800 && !__sr.G.result; step++) { steerCollector(); __sr.sim(0.1); }
  check(__sr.G.leg === n && __sr.G.result === 'won' && __sr.G.run <= 180.1,
    'Natural balance leg failed180s: ' + JSON.stringify({leg: n, state: __sr.legState(), income: __sr.incomeState(),
      remaining: __sr.G.tr.s - __sr.G.goalS, speed: __sr.G.tr.v, hp: __sr.G.tr.hp, priorRows}));
  __sr.sim(4); // Finish cosmetic pickups/ending and bank the actual summary; no economic-ride renders.
  check(__sr.mode === 'summary' && __sr.G.sum.result === 'won', 'Natural won leg did not finish its summary: ' + n);
}
function buyTypical(n, caps) {
  check(__sr.mode === 'summary', 'Purchases require a completed ride');
  __sr.depot(); __sr.hold(true); __sr.frames(30); // Real Depot UI; freeze its unrelated attract battle.
  Object.assign(caps, PLAN[n - 1] || {}); const purchases = [];
  for (let pass = 0; pass < 32; pass++) {
    let changed = false;
    for (const [id, cap] of Object.entries(caps)) {
      let node = __sr.treeNodes().find(x => x.id === id);
      check(node && cap <= node.max, 'Invalid typical-tree cap: ' + id);
      while (node.lv < cap) {
        const before = wallets(), price = node.cost[node.lv], currency = node.cur, level = node.lv;
        if (!__sr.buy(id)) break;
        const after = wallets();
        check(after[currency] === before[currency] - price && __sr.save().nodes[id] === level + 1,
          'Actual purchase did not spend the listed earned currency: ' + id);
        check(['scrap', 'surv', 'gold'].every(k => after[k] >= 0), 'Purchase overdrawn a wallet');
        purchases.push({id, level: level + 1, currency, price, before, after}); changed = true;
        node = __sr.treeNodes().find(x => x.id === id);
      }
    }
    if (!changed) break;
  }
  // After buying a third plane, actually drag B52+A10 into the two production slots.
  if (__sr.save().nodes.b52) {
    __sr.depot('hangar'); __sr.frames(2);
    for (const [id, slot] of [['b52', 0], ['a10', 1]]) {
      if (__sr.hangar().slots[slot] !== id) check(__sr.hangarDrag(id, slot), 'Actual typical Hangar drag failed: ' + id);
    }
    check(JSON.stringify(__sr.hangar().slots) === '["b52","a10"]', 'Typical late-leg planes were not equipped');
  }
  __sr.frames(30);
  const withheld = Object.entries(caps).filter(([id, cap]) => (__sr.save().nodes[id] || 0) < cap).map(([id, cap]) => {
    const node = __sr.treeNodes().find(x => x.id === id);
    return {id, desired: cap, actual: node.lv, state: node.st, currency: node.cur, nextCost: node.cost[node.lv], wallet: __sr.save()[node.cur]};
  });
  return {purchases, withheld, caps: {...caps}, wallet: wallets(), treeAfter: ownedTree(), slotsAfter: __sr.save().hangar.slice()};
}

const result = seeded(0x688, () => {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0);
  const rows = [], caps = {};
  for (let n = 1; n <= 12; n++) {
    const row = seeded(0x680 + n, () => {
    const before = wallets(), tree = ownedTree(), slots = __sr.save().hangar.slice();
    __sr.hold(false); __sr.press('Enter');
    check(__sr.mode === 'play' && __sr.G.leg === n && !__sr.G.replay, 'Actual START did not continue the first pass: ' + n);
    __sr.hp(9999); __sr.bot(true); rideNatural(n, rows);
    const income = __sr.incomeState(), saved = __sr.save(), after = wallets(), finds = __sr.loot(), gold = __sr.goldState();
    const row = {leg: n, target: TARGETS[n - 1], scrap: income.scrap, sources: income.sources, base: income.base,
      ordinaryPay: income.ordinaryPay, counts: income.counts, fractions: income.fractions,
      duration: +__sr.G.run.toFixed(2), kills: __sr.G.kills, goldEarned: after.gold - before.gold, survEarned: after.surv - before.surv,
      stars: saved.legs[n].stars.slice(), before, after, tree, slots,
      collected: finds.filter(f => f.kind === 'sos' ? f.saved : f.gone),
      missed: finds.filter(f => f.kind === 'sos' ? !f.saved : !f.gone), golden: gold.events,
      pendingRescues: saved.rescueDue.slice(), events: __sr.legState().events,
      skippedEvents: __sr.line().legs[n - 1].events.filter(([at]) => at > __sr.G.run).map(([at, kind, params]) => ({at, kind, params}))};
    row.deltaPercent = +((row.scrap / row.target - 1) * 100).toFixed(2); row.inTarget = Math.abs(row.scrap - row.target) <= row.target * 0.15;
    check(Object.values(row.sources).reduce((a, b) => a + b, 0) === row.scrap && after.scrap - before.scrap === row.scrap,
      'First-pass source/save reconciliation failed: ' + JSON.stringify(row));
    check(saved.leg === n + 1 && saved.legs[n].won, 'Natural first-pass progression did not persist: ' + n);
    return row;
    });
    rows.push(row);
    if (n < 12) Object.assign(row, buyTypical(n, caps));
    else Object.assign(row, {purchases: [], withheld: [], wallet: wallets()});
  }
  const totals = rows.reduce((out, row) => {
    out.scrap += row.scrap; out.gold += row.goldEarned; out.surv += row.survEarned;
    for (const key of Object.keys(row.sources)) out.sources[key] = (out.sources[key] || 0) + row.sources[key]; return out;
  }, {scrap: 0, gold: 0, surv: 0, sources: {}});
  return {enforceTargets: CHECK_TARGETS, targets: TARGETS, rows, totals, saved: __sr.save(), outOfTarget: rows.filter(r => !r.inTarget).map(r => r.leg),
    seeds: 'Each real ride uses0x680+leg; one cumulative save remains intact between rides.',
    method: 'One cumulative first pass; actual bought caps, bot weapons and real Viper collection. No ride renders, free rewards or forced arrivals.'};
});
if (CHECK_TARGETS) check(result.outOfTarget.length === 0, 'Balance is outside ±15%: ' + JSON.stringify(result.rows.map(r => ({leg: r.leg, scrap: r.scrap, target: r.target, deltaPercent: r.deltaPercent}))));
check(result.totals.surv===9,'Full route did not yield nine survivors');
check(result.totals.gold===155,'Perfect first pass without Hunt did not yield155gold');
check(result.saved.leg===13 && Object.values(result.saved.legs).every(l=>l.won),'Route did not finish all twelve legs');
const unlocks=['rocketPods','hellfire','mgCar','katyusha','ram','steamVent','a10','f4','b52'];
check(unlocks.every(id=>result.saved.nodes[id]===1),'Earned wallets did not purchase all nine unit unlocks');
check(result.rows.every(r=>!r.missed.length),'Full collector missed a find or rescue');
QA_DONE({...result,table:result.rows.map(r=>({leg:r.leg,scrap:r.scrap,gold:r.goldEarned,survivors:r.survEarned,stars:r.stars.filter(Boolean).length,time:r.duration})),allNineUnits:true});
