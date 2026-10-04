// shot mode: actual first move tip and live Viper arrow; also rendered in t7_1_tips.js.
function check(ok, why) { if (!ok) throw new Error(why); }
function tipShot() {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.press('Enter'); __sr.hp(9999); __sr.bot(false);
  // A genuine first-leg instruction with its live Viper arrow, no manufactured tutorial event.
  for (let i = 0; i < 30 && __sr.tutState().tipKey !== 'p_move'; i++) {
    __sr.sim(0.1); __sr.hold(true); __sr.frames(6); __sr.hold(false);
  }
  const state = __sr.tutState();
  check(state.tipKey === 'p_move' && state.tip === 'RIGHT-CLICK TO MOVE YOUR HELI.' &&
    state.layout?.target?.length === 2 && state.layout.target.every(Number.isFinite), 'Shot missed the actual first move instruction/arrow');
  __sr.hp(__sr.stats().max); __sr.hold(true); __sr.frames(1);
  return {tutorial: __sr.tutState(), heli: __sr.helis()[0], stats: __sr.stats()};
}
tipShot();
