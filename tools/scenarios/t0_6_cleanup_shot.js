// Shot mode: eight seconds into a fresh run, without a free Ram, gate crowd or PRESS E prompt.
__sr.reset();
__sr.start();
__sr.bot(true);
__sr.sim(8);
__sr.frames(30);
__sr.hold(true);
