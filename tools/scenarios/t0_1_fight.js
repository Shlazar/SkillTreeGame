// Run mode: check the baseline fight screenshot setup and 30 rendered frames for errors.
__sr.give(3000, 30);
__sr.start();
__sr.bot(true);
__sr.sim(20);
__sr.frames(30);
QA_DONE(1);
