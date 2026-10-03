// Run mode: each run contains one leg, wins unlock one next leg, and losses keep the collected scrap.
function geometry(number, fromId, toId) {
  const game = __sr.G;
  if (game.leg !== number) throw new Error('Expected leg ' + number + ', got ' + game.leg);
  if (game.stops.length !== 2) throw new Error('A leg must build exactly two stops');
  const from = game.stops.find((stop) => stop.id === fromId);
  const to = game.stops.find((stop) => stop.id === toId);
  if (!from || !to) throw new Error('Wrong stops in leg ' + number);
  if (game.goalS !== to.stopS) throw new Error('Leg goal is not the next station stopping point');
  if (Math.abs(game.tr.startS - from.stopS) > 60.01) throw new Error('Train starts away from its departure station');
  if (!game.station || game.station.id !== toId) throw new Error('The current target is not the arrival station');
  return {leg: number, stops: game.stops.map((stop) => stop.id), start: game.tr.startS, goal: game.goalS};
}

__sr.reset();
__sr.start();
const firstGeometry = geometry(1, 'depot', 'millbrook');
__sr.hp(9999);
__sr.bot(true);
__sr.sim(90);
const won = __sr.legState();
if (won.result !== 'won' || __sr.SAVE.leg !== 2) throw new Error('Leg 1 did not win and unlock leg 2');
if (__sr.mode !== 'summary') throw new Error('A completed leg did not reach its summary');
const stoppedAt = __sr.G.tr.s;
__sr.sim(15);
__sr.frames(30);
if (__sr.SAVE.leg !== 2 || __sr.G.leg !== 1 || Math.abs(__sr.G.tr.s - stoppedAt) > 0.01) {
  throw new Error('The won run kept riding or advanced more than one leg');
}
__sr.start();
const secondGeometry = geometry(2, 'millbrook', 'cornfield');

__sr.leg(5, false);
const fifthGeometry = geometry(5, 'silo', 'oldmill');
if (fifthGeometry.goal >= firstGeometry.goal) throw new Error('Late legs reused an earlier goal');

__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.sim(10);
const collected = __sr.stats().cash;
if (collected <= 0 || __sr.stats().kills <= 0) throw new Error('Loss test collected no scrap');
__sr.lose();
__sr.sim(6);
__sr.frames(30);
const lost = __sr.legState();
const finalCash = __sr.stats().cash;
if (lost.result !== 'lost' || __sr.mode !== 'summary') throw new Error('Loss did not reach the summary');
if (__sr.SAVE.leg !== 1 || (__sr.SAVE.legs['1'] && __sr.SAVE.legs['1'].won)) {
  throw new Error('A loss unlocked the next leg');
}
if (__sr.SAVE.scrap < collected || __sr.SAVE.scrap !== finalCash) throw new Error('Collected scrap was not banked on loss');
const loss = {collected, finalCash, banked: __sr.SAVE.scrap, leg: __sr.SAVE.leg, result: lost.result};

// Keep this setup identical to t1_3_leg_shot.js and render it before taking the screenshot.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
__sr.jump(8);
__sr.sim(1);
__sr.frames(30);
__sr.hold(true);
const arrival = __sr.legState();
if (arrival.result !== 'won') throw new Error('Arrival screenshot setup did not win the leg');
QA_DONE({firstGeometry, won, secondGeometry, fifthGeometry, stoppedAt, loss, arrival});
