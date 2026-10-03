// Shot mode: first natural Millbrook arrival, survivor boarding and camp reward.
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

__sr.hold(false);
__sr.reset();
start(1);
ride(1);
__sr.frames(12);
__sr.hold(true);
