// Run mode: start a run, let the autopilot play 30 s, print the stats. Use it after every change.
__sr.start();
__sr.bot(true);
__sr.sim(30);
QA_DONE(__sr.stats());
