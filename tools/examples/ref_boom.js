// Current-build A-10 bomb effect fixture based on docs/style/boom.png.
// strafe.png = frame 44 (the jet mid-run: nose flash, a band of hits, puffs and blasts, glowing holes).
// boom.png = frame 111 (the bombs have landed: fireballs, the white ring, dust, chunks, scorch).
__sr.node('a10', 1);
__sr.node('bombRun', 1);
__sr.node('a10Lines', 2);
for (const key of ['p_move', 'p_plane', 'currency_scrap']) __sr.SAVE.seen[key] = true;
__sr.start();
__sr.sim(2);
__sr.lose();
__sr.sim(6);
__sr.depot('tree');
__sr.start();
__sr.bot(false); // Keep the automatic pilot from adding another strike to this effect fixture.
__sr.sim(6);
__sr.crowd(70, 470, 210, 55);
__sr.strafe(470, 210);
__sr.frames(111);
__sr.hold(true);
