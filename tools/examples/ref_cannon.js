// Reference shot (docs/style/cannon.png): the rail cannon a few frames after a shot - the white beam,
// the row of blasts along the line, bodies thrown off it, the muzzle blast and the burnt groove.
// (The rail cannon moves to the full game, but its shot is the gold standard of a juicy effect.)
__sr.node('gun', 1);
__sr.start();
__sr.sim(2);
__sr.lose();
__sr.sim(6);
__sr.depot('tree');
__sr.start();
__sr.bot(true);
__sr.sim(6);
__sr.crowd(60, 430, 160, 45);
__sr.cannonReady();
const n0 = __sr.cannon().shots;
for (let i = 0; i < 200 && __sr.cannon().shots === n0; i++) __sr.frames(1);
__sr.frames(4);
__sr.hold(true);
