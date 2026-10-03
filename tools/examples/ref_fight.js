// Reference shot (docs/style/fight.png): the heli over the horde early in a run, with the red
// carpet of splats the kills leave on the clean ground. frames() runs whole frames (game + drawing),
// so banners and tips age out before the picture is taken.
__sr.node('hdmg', 4);
__sr.node('hrate', 4);
__sr.start();
__sr.bot(true);
__sr.sim(8);
__sr.crowd(60, 440, 170, 60);
__sr.crowd(50, 200, 220, 50);
__sr.frames(170);
__sr.crowd(40, 330, 120, 40);
__sr.frames(70);
