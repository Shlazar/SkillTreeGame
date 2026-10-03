// Reference shot (docs/style/heli.png), taken at 3x zoom (window 1200 x 1080): the Viper firing -
// the star of light at its nose, hit sparks on the target, red pops on the ground, the rotor blur,
// its shadow, and the train below it. Run: node tools/qa.js shot tools/examples/ref_heli.js out.png 800 1200 1080
__sr.node('hdmg', 2);
__sr.start();
__sr.sim(2);
__sr.lose();
__sr.sim(6);
__sr.depot('tree');
__sr.start();
__sr.bot(true);
__sr.sim(4);
__sr.crowd(25, 310, 170, 25);
__sr.frames(15);
for (let i = 0; i < 200 && !(__sr.G.helis[0].flash > 0.06); i++) __sr.frames(1);
__sr.hold(true);
