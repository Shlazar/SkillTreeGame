// Run mode: compact leg summaries copy their rewards/stars and return to the Depot by key/click.
function summarySnapshot() {
  const s = __sr.G.sum;
  return JSON.parse(JSON.stringify({leg: s.leg, destination: s.destination, replay: s.replay,
    stars: s.stars, hasStars: s.hasStars, result: s.result, kills: s.kills,
    pay: s.pay, scrap: s.scrap, surv: s.surv, gold: s.gold, near: s.near, wall: s.wall}));
}
function assertSummary(label) {
  if (__sr.mode !== 'summary' || !__sr.G.sum) throw new Error(label + ': no summary');
  const s = __sr.G.sum;
  for (const key of ['km', 'ride', 'stops', 'goal']) {
    if (Object.prototype.hasOwnProperty.call(s, key)) throw new Error(label + ': old summary field ' + key);
  }
  if (s.leg !== 3 || s.destination !== 'RED BARN' || s.replay !== false || s.hasStars !== true) throw new Error(label + ': wrong leg identity');
  if (!Array.isArray(s.stars) || s.stars.length !== 3 || s.stars.some(v => typeof v !== 'boolean')) throw new Error(label + ': malformed stars');
  const view = __sr.summaryView(), {W, H} = __sr.stats();
  for (const rect of [view, view.button]) {
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0 || rect.x < 0 || rect.y < 0 || rect.x + rect.w > W || rect.y + rect.h > H) {
      throw new Error(label + ': summary/button outside view ' + JSON.stringify(rect));
    }
  }
  return view;
}
function wonSetup() {
  __sr.hold(false);
  __sr.reset();
  __sr.setLeg(3);
  if (!__sr.node('root', 1) || !__sr.node('bonus', 1)) throw new Error('Won summary bonus setup failed');
  __sr.start();
  __sr.hp(9999);
  __sr.bot(true);
  __sr.sim(8);
  __sr.payGold('golden:0', 1, 10);
  __sr.payGold('golden:0', 1, 10);
  // The star evaluator arrives in T6.7; this fixture verifies the saved-star summary now.
  __sr.SAVE.legs[3].stars = [true, false, true];
  __sr.give(0, 0, 0);
  __sr.win();
  __sr.frames(50);
  __sr.sim(6);
  __sr.frames(240);
  __sr.hold(true);
}
function lostSetup() {
  __sr.hold(false);
  __sr.reset();
  __sr.setLeg(3);
  __sr.start();
  __sr.hp(9999);
  __sr.bot(true);
  __sr.sim(8);
  __sr.payGold('golden:0', 1, 10);
  __sr.payGold('golden:0', 1, 10);
  // Rail units are 2 px/m; one step records the new position before loss freezes progress.
  __sr.jump(760);
  __sr.sim(1 / 60);
  __sr.lose();
  __sr.sim(6);
  __sr.frames(240);
  __sr.hold(true);
}

// Keep this setup identical to t1_9_won_shot.js, including the frames that reveal all rows.
wonSetup();
const wonView = assertSummary('Won shot'), won = summarySnapshot();
if (won.result !== 'won' || won.near || won.surv !== 1 || won.gold !== 1 || won.kills <= 0 || won.pay.kills <= 0 || won.pay.loot !== 10 || won.pay.bonus !== 10) {
  throw new Error('Won summary omitted earned sources/rewards: ' + JSON.stringify(won));
}
if (JSON.stringify(won.stars) !== '[true,false,true]') throw new Error('Won summary lost its fixture stars');
if (won.scrap !== Math.floor(won.pay.kills + won.pay.loot + won.pay.bonus)) throw new Error('Won scrap total does not match source rows');
const bankedWon = __sr.save();
if (bankedWon.leg !== 4 || bankedWon.scrap !== won.scrap || bankedWon.surv !== 1 || bankedWon.gold !== 1) throw new Error('Won summary rewards were not banked');
const sourceStars = __sr.SAVE.legs[3].stars.slice(), sourceLoot = __sr.G.pay.loot;
__sr.SAVE.legs[3].stars = [false, true, false];
__sr.G.pay.loot += 999;
__sr.frames(30);
if (JSON.stringify(summarySnapshot()) !== JSON.stringify(won)) throw new Error('Summary changed when live star/pay sources changed');
__sr.SAVE.legs[3].stars = sourceStars;
__sr.G.pay.loot = sourceLoot;
__sr.press('Enter');
if (__sr.mode === 'summary') __sr.press('Enter');
if (__sr.mode !== 'depot' || __sr.depotRoute().selected !== 4) throw new Error('Won summary Enter did not open next-leg Depot');

// Keep this setup identical to t1_9_lost_shot.js and render it before using its real button.
lostSetup();
const lostView = assertSummary('Lost shot'), lost = summarySnapshot();
if (lost.result !== 'lost' || lost.near !== 'RED BARN WAS 380 M AWAY!' || lost.surv !== 0 || lost.gold !== 1 || lost.pay.loot !== 10 || lost.kills <= 0) {
  throw new Error('Lost summary data is wrong: ' + JSON.stringify(lost));
}
if (JSON.stringify(lost.stars) !== '[false,false,false]') throw new Error('Lost summary invented stars');
const bankedLost = __sr.save();
if (bankedLost.leg !== 3 || bankedLost.scrap !== lost.scrap || bankedLost.gold !== 1 || bankedLost.legs[3].won) throw new Error('Loss lost rewards or advanced the route');
__sr.frames(30);
if (JSON.stringify(summarySnapshot()) !== JSON.stringify(lost)) throw new Error('Lost summary changed while displayed');
const button = lostView.button;
__sr.click(Math.floor(button.x + button.w / 2), Math.floor(button.y + button.h / 2));
if (__sr.mode !== 'depot' || __sr.depotRoute().selected !== 3 || __sr.depotRoute().replay) throw new Error('Actual summary button did not open retry Depot');
QA_DONE({won, lost, wonView, lostView, enterDepot: true, clickDepot: true, snapshotStable: true});
