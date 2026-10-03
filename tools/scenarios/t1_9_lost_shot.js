// Shot mode: a Red Barn loss 380 m from its station, with earned scrap and gold kept.
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
