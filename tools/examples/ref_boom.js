// Reference shot (docs/style/boom.png). A second run (the first one is lost at once, so the first-run
// tips and the Ram taste are gone), a crowd in the open, the Strafing Run with BOMB RUN through it.
// strafe.png = frame 44 (the jet mid-run: nose flash, a band of hits, puffs and blasts, glowing holes).
// boom.png = frame 111 (the bombs have landed: fireballs, the white ring, dust, chunks, scorch).
__sr.node('strafe', 1);
__sr.node('strafeB', 1);
__sr.node('strafeW', 2);
__sr.start();
__sr.sim(2);
__sr.lose();
__sr.sim(6);
__sr.depot('tree');
__sr.start();
__sr.bot(true);
__sr.sim(6);
__sr.crowd(70, 470, 210, 55);
__sr.strafe(470, 210);
__sr.frames(111);
__sr.hold(true);
