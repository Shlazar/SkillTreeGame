// Run mode: teach currencies once, keep hidden rewards, and open Cornfield's chest once.
function assertCurrency(expected, label) {
  const state = __sr.currencyState();
  for (const key of ['scrap', 'surv', 'gold']) {
    if (state.shown[key] !== expected[key]) throw new Error(label + ': visibility ' + key);
    if (expected[key] ? !Number.isFinite(state.x[key]) : state.x[key] !== null) {
      throw new Error(label + ': flying reward target ' + key + '=' + state.x[key]);
    }
  }
  const active = ['scrap', 'surv', 'gold'].filter(key => expected[key]);
  for (let i = 1; i < active.length; i++) {
    if (state.x[active[i]] <= state.x[active[i - 1]]) throw new Error(label + ': counter targets overlap');
  }
  return state;
}
function assertTip(key, label) {
  // Currency tips save their receipt when promoted to the visible tip; older tips may wait ahead.
  __sr.hold(true);
  for (let i = 0; i < 1200 && !__sr.seen().includes(key); i++) __sr.frames(1);
  __sr.hold(false);
  if (!__sr.seen().includes(key)) throw new Error(label + ': missing ' + key);
  const stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  if (stored.seen[key] !== true) throw new Error(label + ': tip receipt not persisted');
}
function assertMoney(expected, label) {
  const save = __sr.save(), stored = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
  for (const [key, value] of Object.entries(expected)) {
    if (save[key] !== value || stored[key] !== value) throw new Error(label + ': ' + key + '=' + save[key]);
  }
}
function arrive(leg) {
  __sr.leg(leg, false);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.win();
  for (let i = 0; i < 120 && __sr.G.result !== 'won'; i++) __sr.frames(1);
  if (__sr.G.result !== 'won') throw new Error('No arrival on leg ' + leg);
}
function killWalker() {
  const {W, H} = __sr.stats();
  const z = __sr.spawn(0, Math.floor(W * 0.3), Math.floor(H * 0.6));
  __sr.hit(z, 999, 'mg');
  if (!z.dead) throw new Error('Currency test walker survived');
}

__sr.reset();
__sr.start();
__sr.hp(9999);
const fresh = assertCurrency({scrap: true, surv: false, gold: false}, 'Fresh HUD');
__sr.frames(30);
killWalker();
assertTip('currency_scrap', 'First kill');
const scrapTips = __sr.tutState().tips;
killWalker();
if (__sr.tutState().tips !== scrapTips) throw new Error('Second kill repeated the scrap tip');
assertCurrency({scrap: true, surv: false, gold: false}, 'After kills');

arrive(1);
assertMoney({surv: 1, gold: 0, chest: 0}, 'Millbrook banks a hidden survivor');
assertCurrency({scrap: true, surv: false, gold: false}, 'Before first paid buy');
if (__sr.seen().includes('currency_surv')) throw new Error('Arrival taught survivors before the first scrap buy');
__sr.sim(6);
__sr.depot('tree');
__sr.give(80, 0, 0);
if (__sr.buy('root') !== true) throw new Error('Could not buy the free root');
assertCurrency({scrap: true, surv: false, gold: false}, 'Free root does not teach survivors');
if (__sr.seen().includes('currency_surv')) throw new Error('Free root queued a survivor tip');
if (__sr.buy('hdmg') !== true) throw new Error('Could not buy the first paid scrap upgrade');
assertTip('currency_surv', 'First paid scrap buy');
const afterBuy = assertCurrency({scrap: true, surv: true, gold: false}, 'Depot after paid buy');
if (__sr.save().flags.survShown !== true) throw new Error('Survivor reveal flag missing');
const survTips = __sr.tutState().tips;
if (__sr.buy('hdmg') !== true) throw new Error('Could not buy the second scrap level');
if (__sr.tutState().tips !== survTips) throw new Error('Second paid buy repeated the survivor tip');
__sr.frames(30);

arrive(2);
assertMoney({surv: 1, gold: 0, chest: 1}, 'Cornfield chest stays locked');
assertCurrency({scrap: true, surv: true, gold: false}, 'Cornfield before gold');
if (__sr.seen().includes('currency_gold')) throw new Error('Locked chest taught gold prematurely');
__sr.sim(6);
__sr.leg(3, false);
__sr.hp(9999);
const paid = __sr.payGold('golden:0', 1, 10);
if (paid.gold !== 1 || paid.scrap !== 0) throw new Error('First golden receipt incorrect');
assertMoney({gold: 7, chest: 2}, 'Golden reward plus opened chest');
assertTip('currency_gold', 'First actual gold reward');
const afterGold = assertCurrency({scrap: true, surv: true, gold: true}, 'All counters');
if (__sr.save().flags.goldShown !== true) throw new Error('Gold reveal flag missing');
const goldTips = __sr.tutState().tips, scrapBeforeDuplicate = __sr.save().scrap;
const duplicate = __sr.payGold('golden:0', 1, 10);
if (duplicate.gold !== 0 || duplicate.scrap !== 10) throw new Error('Duplicate gold receipt failed scrap conversion');
assertMoney({gold: 7, chest: 2, scrap: scrapBeforeDuplicate + 10}, 'Chest cannot open twice');
if (__sr.tutState().tips !== goldTips) throw new Error('Duplicate gold repeated the gold tip');
__sr.frames(30);
if (__sr.load() !== true) throw new Error('Currency save failed reload');
__sr.title();
__sr.frames(30);
assertCurrency({scrap: true, surv: true, gold: true}, 'Currency visibility survives reload');
assertMoney({gold: 7, chest: 2, surv: 1}, 'Reload keeps currencies and opened chest');

// The approved reveal is the first actual gold source in leg 3+, including a fallback star.
__sr.reset();
__sr.setLeg(2);
arrive(2);
assertMoney({gold: 0, chest: 1}, 'Fallback setup');
__sr.sim(6);
__sr.leg(3, false);
const fallback = __sr.payGold('star:0', 1, 10);
if (fallback.gold !== 1 || fallback.scrap !== 0) throw new Error('Fallback star did not pay gold');
assertMoney({gold: 7, chest: 2}, 'Fallback star opens the chest');
assertCurrency({scrap: true, surv: false, gold: true}, 'Fallback gold visibility');
assertTip('currency_gold', 'Fallback star gold tip');
const fallbackTips = __sr.tutState().tips;
__sr.payGold('star:0', 1, 10);
assertMoney({gold: 7, chest: 2}, 'Fallback chest opens only once');
if (__sr.tutState().tips !== fallbackTips) throw new Error('Fallback duplicate repeated the gold tip');
__sr.frames(30);

// Keep these two setups identical to t1_7_hud_shot.js and t1_7_depot_shot.js.
function allCurrencyShot() {
  __sr.hold(false);
  __sr.reset();
  __sr.start();
  __sr.hp(9999);
  __sr.bot(true);
  __sr.win();
  __sr.frames(50);
  __sr.sim(6);
  __sr.depot('tree');
  __sr.give(80, 0, 0);
  if (!__sr.buy('root') || !__sr.buy('hdmg')) throw new Error('Shot currency unlock failed');
  __sr.leg(2, false);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.win();
  __sr.frames(50);
  __sr.sim(6);
  __sr.leg(3, false);
  __sr.hp(9999);
  __sr.bot(true);
  __sr.sim(10);
  __sr.frames(240);
  __sr.payGold('golden:0', 1, 10);
  __sr.frames(30);
  __sr.hold(true);
}
allCurrencyShot();
const hudShot = assertCurrency({scrap: true, surv: true, gold: true}, 'HUD shot');
if (__sr.mode !== 'play' || __sr.G.leg !== 3 || __sr.G.result) throw new Error('HUD shot is not a live leg-3 fight');
assertMoney({gold: 7, chest: 2, surv: 1}, 'HUD shot money');
__sr.frames(30);
allCurrencyShot();
__sr.depot('tree');
__sr.frames(180);
const depotShot = assertCurrency({scrap: true, surv: true, gold: true}, 'Depot shot');
if (__sr.mode !== 'depot') throw new Error('Depot shot is not the Depot');
__sr.frames(30);
QA_DONE({fresh, afterBuy, afterGold, fallback: true, hudShot, depotShot});
