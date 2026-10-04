// Run mode: fresh title starts leg 1, Continue opens the Depot, and map clicks select replays.
function assertRemovedFields(label) {
  const save = __sr.save();
  for (const key of ['reached', 'held', 'best', 'start', 'towers', 'house']) {
    if (Object.prototype.hasOwnProperty.call(save, key)) throw new Error(label + ': obsolete ' + key);
  }
}
function routeFixture() {
  __sr.hold(false);
  __sr.reset();
  __sr.setLeg(5);
  __sr.SAVE.legs[3].stars = [true, false, true];
  __sr.SAVE.legs[4].stars = [true, true, false];
  __sr.SAVE.flags.survShown = true;
  __sr.SAVE.flags.goldShown = true;
  __sr.give(245, 2, 7);
  for (const [id, level] of [['hdmg', 2], ['armor', 1]]) {
    if (!__sr.node(id, level)) throw new Error('Unknown route shot upgrade: ' + id);
  }
  __sr.depot('tree');
  __sr.treeCam(0, 0, 0.75);
  __sr.frames(180);
}
function lossFixture() {
  __sr.hold(false);
  __sr.reset();
  __sr.setLeg(3);
  __sr.start();
  __sr.hp(9999);
  const {W, H} = __sr.stats();
  for (let i = 0; i < 1000 && Math.floor(__sr.G.cash) < 143; i++) {
    const z = __sr.spawn(0, Math.floor(W * 0.3), Math.floor(H * 0.6));
    __sr.hit(z, 999, 'mg');
    if (!z.dead) throw new Error('Loss fixture walker survived');
  }
  if (Math.floor(__sr.G.cash) !== 143) throw new Error('Loss fixture did not earn 143 scrap');
  __sr.lose();
  __sr.sim(6);
  if (__sr.mode !== 'summary') throw new Error('Loss did not reach summary');
  __sr.frames(45);
  __sr.press('Enter');
  if (__sr.mode === 'summary') __sr.press('Enter');
  if (__sr.mode !== 'depot') throw new Error('Loss summary Enter flow failed');
  __sr.frames(180);
}

__sr.reset();
assertRemovedFields('Fresh save');
__sr.press('Enter');
if (__sr.mode !== 'play' || __sr.G.leg !== 1 || __sr.G.replay) throw new Error('Fresh title did not start leg 1');
const freshTitle = {mode: __sr.mode, leg: __sr.G.leg};
__sr.title();
__sr.frames(30);
__sr.press('Enter');
if (__sr.mode !== 'depot') throw new Error('Continue did not open Depot');

// Same setup as t1_8_depot_shot.js, also rendered in run mode.
routeFixture();
const route = __sr.depotRoute(), {W, H} = __sr.stats();
if (route.selected !== 5 || route.replay || !route.startLabel.includes('OLD MILL')) throw new Error('Current leg START label is wrong');
if (route.legs.length !== 12) throw new Error('Line map must have all twelve legs');
for (const leg of route.legs) {
  if (!Number.isFinite(leg.x) || !Number.isFinite(leg.y) || leg.x < 0 || leg.x >= W || leg.y < 0 || leg.y >= H) {
    throw new Error('Line map leg ' + leg.n + ' is outside the view');
  }
  if (leg.won !== (leg.n < 5) || leg.selectable !== (leg.n <= 5)) throw new Error('Wrong map availability for leg ' + leg.n);
}
__sr.frames(30);
const leg2 = route.legs.find(leg => leg.n === 2);
__sr.click(leg2.x, leg2.y);
const selectedReplay = __sr.depotRoute();
if (selectedReplay.selected !== 2 || !selectedReplay.replay || !selectedReplay.startLabel.includes('REPLAY') || !selectedReplay.startLabel.includes('SCRAP ONLY')) {
  throw new Error('Leg-2 map click did not select a scrap-only replay');
}
const beforeReplay = __sr.save();
__sr.press('Enter');
if (__sr.mode !== 'play' || __sr.G.leg !== 2 || !__sr.G.replay) throw new Error('Replay START did not start leg 2');
__sr.hp(9999);
__sr.bot(true);
__sr.win();
for (let i = 0; i < 120 && __sr.G.result !== 'won'; i++) __sr.frames(1);
if (__sr.G.result !== 'won') throw new Error('Leg-2 replay did not finish');
__sr.sim(6);
const afterReplay = __sr.save();
if (afterReplay.leg !== 5 || afterReplay.surv !== beforeReplay.surv || afterReplay.gold !== beforeReplay.gold) throw new Error('Replay advanced progress or paid station currencies');
if (JSON.stringify(afterReplay.legs) !== JSON.stringify(beforeReplay.legs)) throw new Error('Replay changed won legs, stars, or receipts');
__sr.depot('tree');
__sr.frames(30);
const future = __sr.depotRoute().legs.find(leg => leg.n === 6);
__sr.click(future.x, future.y);
if (__sr.depotRoute().selected !== 5) throw new Error('Locked future leg could be selected');

// Same setup as t1_8_loss_shot.js: actual kills pay 143, loss banks it, summary Enter returns.
lossFixture();
const loss = __sr.depotRoute();
if (!loss.loss || !loss.loss.includes('THE TRAIN BROKE') || !loss.loss.includes('YOU KEEP 143 SCRAP')) throw new Error('Depot loss message does not show retained scrap');
if (loss.selected !== 3 || loss.replay || !loss.startLabel.includes('RED BARN')) throw new Error('Loss START does not retry Red Barn');
const savedLoss = __sr.save(), storedLoss = JSON.parse(localStorage.getItem('sky-reaper-save-1'));
if (savedLoss.scrap !== 143 || storedLoss.scrap !== 143 || savedLoss.leg !== 3) throw new Error('Loss did not bank 143 scrap or kept wrong next leg');
assertRemovedFields('Lost run save');
__sr.frames(30);
__sr.press('Enter');
if (__sr.mode !== 'play' || __sr.G.leg !== 3 || __sr.G.replay) throw new Error('Retry START did not start the lost leg');
if (__sr.save().scrap !== 143) throw new Error('Retry lost saved money');
QA_DONE({freshTitle, continueDepot: true, route: {selected: route.selected, startLabel: route.startLabel, legs: route.legs.length},
  selectedReplay: {selected: selectedReplay.selected, replay: selectedReplay.replay, startLabel: selectedReplay.startLabel},
  progressAfterReplay: afterReplay.leg, loss: loss.loss, retry: __sr.G.leg, legacyRemoved: true});
