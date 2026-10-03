// Reference shot (docs/style/train.png), taken at 3x zoom (window 1200 x 1080): the train in a fight -
// the stacked-slice cars with rim light, the dead climbing on, the red carpet beside the rails,
// the heli above it. Run: node tools/qa.js shot tools/examples/ref_train.js out.png 800 1200 1080
__sr.node('hdmg', 2);
__sr.start();
__sr.sim(2);
__sr.lose();
__sr.sim(6);
__sr.depot('tree');
__sr.start();
__sr.bot(true);
__sr.sim(4);
__sr.crowd(30, 150, 120, 30);
__sr.frames(40);
for (let i = 0; i < 200 && !(__sr.G.helis[0].flash > 0.06); i++) __sr.frames(1);
__sr.hold(true);
