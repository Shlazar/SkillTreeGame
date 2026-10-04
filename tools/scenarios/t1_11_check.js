// Run mode: naturally ride legs 1-3, reconcile banked currencies, and render the early-route shots.
// Natural rides use small game steps and a few full frames to age banners and tips.
function ride(leg) {
  for (let i = 0; i < 480 && __sr.G.run < 120 && !__sr.G.result; i++) {
    __sr.sim(0.25);
    if (!__sr.G.result) __sr.frames(2);
  }
  if (__sr.G.leg !== leg || __sr.G.result !== 'won' || __sr.mode !== 'ending' || __sr.G.run > 120.3) {
    const g = __sr.G;
    throw new Error('Natural leg ' + leg + ' failed within 120 seconds: ' + JSON.stringify({
      ...__sr.legState(), train: {remaining: +(g.tr.s - g.goalS).toFixed(2),
        speed: +g.tr.v.toFixed(2), hp: +g.tr.hp.toFixed(2), blocked: !!g.blocked, onTrain: g.onTrain}
    }));
  }
}
function finish(leg) {
  __sr.sim(4);
  __sr.frames(120);
  if (__sr.mode !== 'summary' || __sr.G.sum.result !== 'won') throw new Error('No won summary for leg ' + leg);
  const save = __sr.save();
  if (save.leg !== leg + 1 || !save.legs[leg].won) throw new Error('Wrong saved progression after leg ' + leg);
  return save;
}
function depot() {
  __sr.press('Enter');
  if (__sr.mode === 'summary') __sr.press('Enter');
  if (__sr.mode !== 'depot') throw new Error('Summary did not open Depot');
}
function start(leg) {
  __sr.press('Enter');
  if (__sr.mode !== 'play' || __sr.G.leg !== leg || __sr.G.replay) throw new Error('START did not ride leg ' + leg);
  __sr.hp(9999);
  __sr.bot(true);
}

function currencies(expected, label) {
  const state = __sr.currencyState();
  for (const key of ['scrap', 'surv', 'gold']) {
    if (state.shown[key] !== expected[key]) throw new Error(label + ': visibility ' + key);
    if (expected[key] ? !Number.isFinite(state.x[key]) : state.x[key] !== null) throw new Error(label + ': coin target ' + key);
  }
  const targets = ['scrap', 'surv', 'gold'].filter(key => expected[key]).map(key => state.x[key]);
  if (targets.some((x, i) => i && x <= targets[i - 1])) throw new Error(label + ': overlapping coin targets');
  return state;
}
function savedMoney(save, expected, label) {
  const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  for (const [key, amount] of Object.entries(expected)) {
    if (save[key] !== amount || stored[key] !== amount) throw new Error(label + ': ' + key + '=' + save[key]);
  }
}
const saves = [], rides = [];
// Identical prefix to t1_11_reward_shot.js.
__sr.hold(false);
__sr.reset();
start(1);
ride(1);
__sr.frames(12);
__sr.hold(true);

const firstReward = __sr.G.stationReward;
if (!firstReward || firstReward.kind !== 'surv' || firstReward.amount !== 1 || __sr.G.t - firstReward.t > 0.6) {
  throw new Error('Natural Millbrook arrival has no live survivor boarding reward');
}
if (__sr.save().surv !== 1 || __sr.save().leg !== 2 || !__sr.save().legs[1].paid.station) throw new Error('Arrival reward was not persisted immediately');
currencies({scrap: true, surv: false, gold: false}, 'First camp before paid buy');
if (!Array.isArray(__sr.G.people) || __sr.G.people.length) throw new Error('Old station survivor crowd returned');
__sr.frames(30);
__sr.hold(false);
const save1 = finish(1);
saves.push(save1);
rides.push({leg: 1, seconds: +__sr.G.run.toFixed(2), kills: __sr.G.kills, scrap: __sr.G.sum.scrap});
savedMoney(save1, {scrap: __sr.G.sum.scrap, surv: 1, gold: 0, chest: 0}, 'Leg 1');
depot();
// Spend only earned first-leg scrap on the first gun and health upgrades.
for (const id of ['hdmg', 'armor']) {
  if (!__sr.buy(id)) throw new Error('Natural first-leg scrap could not buy ' + id);
}
__sr.frames(120);
currencies({scrap: true, surv: true, gold: false}, 'First paid scrap buy');
const scrapAfterBuy = __sr.save().scrap;
start(2);
ride(2);
if (__sr.G.stationReward?.kind !== 'chest') throw new Error('Natural Cornfield arrival did not give locked chest');
const save2 = finish(2);
saves.push(save2);
rides.push({leg: 2, seconds: +__sr.G.run.toFixed(2), kills: __sr.G.kills, scrap: __sr.G.sum.scrap});
savedMoney(save2, {scrap: scrapAfterBuy + __sr.G.sum.scrap, surv: 1, gold: 0, chest: 1}, 'Leg 2');
currencies({scrap: true, surv: true, gold: false}, 'Locked Cornfield chest');
depot();
start(3);
__sr.sim(8);
// Explicit one-gold fixture isolates counter reveal and chest opening from golden-chase mechanics.
const fixture = __sr.payGold('t1_11:gold', 1, 10);
if (fixture.gold !== 1 || fixture.scrap !== 0) throw new Error('Explicit gold fixture failed');
savedMoney(__sr.save(), {surv: 1, gold: 7, chest: 2}, 'Gold fixture opens the chest');
__sr.frames(240);
__sr.frames(30);
__sr.hold(true);
// This entire natural prefix is identical to t1_11_hud_shot.js.
const hud = currencies({scrap: true, surv: true, gold: true}, 'Live leg-3 HUD');
if (__sr.mode !== 'play' || __sr.G.leg !== 3 || __sr.G.result) throw new Error('HUD shot is not a live third leg');
const perf = {bench: +__sr.bench(60).toFixed(2), late: __sr.late()};
if (perf.late > 1) throw new Error('Late atlas pages exceeded the baseline: ' + perf.late);
__sr.frames(30);
__sr.hold(false);
ride(3);
if (__sr.G.stationReward?.kind !== 'surv') throw new Error('Natural Red Barn arrival did not give a survivor');
const save3 = finish(3);
saves.push(save3);
rides.push({leg: 3, seconds: +__sr.G.run.toFixed(2), kills: __sr.G.kills, scrap: __sr.G.sum.scrap});
const leg3 = save3.legs[3], primaryGold = leg3.paid['golden-primary'] === true ? 1 : 0;
const catchStarGold = leg3.paid['star-3'] === true ? 3 : 0;
if (!leg3.stars[0] || !leg3.stars[1] || leg3.stars[2] !== (catchStarGold === 3) ||
    !!primaryGold !== !!catchStarGold) throw new Error('Natural leg-3 star/catch receipts do not reconcile');
// Fixture1 + opened chest6 + two arrival stars6; a natural primary catch adds1 and star3 adds3.
savedMoney(save3, {scrap: save2.scrap + __sr.G.sum.scrap, surv: 2,
  gold: 13 + primaryGold + catchStarGold, chest: 2}, 'Leg 3 fixture/chest/stars and actual primary catch');
if (!save3.legs[3].paid['t1_11:gold']) throw new Error('Gold fixture receipt missing');
if (rides.some(r => r.kills <= 0 || r.scrap <= 0)) throw new Error('A natural ride had no earned scrap');
depot();
__sr.frames(180);
// This complete prefix is identical to t1_11_depot_shot.js.
const map = __sr.depotRoute();
if (map.selected !== 4 || map.replay || !map.startLabel.includes('SILO JUNCTION')) throw new Error('Depot map did not offer leg 4');
if (map.legs.filter(l => l.won).length !== 3 || map.legs.filter(l => l.selectable).length !== 4) throw new Error('Depot map progression is wrong');
currencies({scrap: true, surv: true, gold: true}, 'Early-route Depot');
for (const save of saves) {
  for (const key of ['reached', 'held', 'best', 'start', 'towers', 'house']) {
    if (Object.prototype.hasOwnProperty.call(save, key)) throw new Error('Old save field returned: ' + key);
  }
}
__sr.frames(30);
QA_DONE({rides, saves, goldFixture: {id: 't1_11:gold', purpose: 'counter and chest only; actual chase tested separately', paid: fixture},
  hud, depot: {selected: map.selected, startLabel: map.startLabel}, rewardShot: true, hudShot: true, depotShot: true, perf});
