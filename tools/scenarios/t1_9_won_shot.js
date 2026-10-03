// Shot mode: Red Barn won, scrap from three sources, survivor, gold and saved-star fixture.
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
