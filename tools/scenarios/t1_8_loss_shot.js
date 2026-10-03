// Shot mode: a lost Red Barn run keeps its earned 143 scrap and offers the same leg again.
__sr.hold(false);
__sr.reset();
__sr.setLeg(3);
__sr.start();
__sr.hp(9999);
const {W, H} = __sr.stats();
for (let i = 0; i < 1000 && Math.floor(__sr.G.cash) < 143; i++) {
  const z = __sr.spawn(0, Math.floor(W * 0.3), Math.floor(H * 0.6));
  __sr.hit(z, 999, 'mg');
  if (!z.dead) throw new Error('Loss fixture walker survived');
}
if (Math.floor(__sr.G.cash) !== 143) throw new Error('Loss fixture did not earn 143 scrap');
__sr.lose();
__sr.sim(6);
if (__sr.mode !== 'summary') throw new Error('Loss did not reach summary');
__sr.frames(45);
__sr.press('Enter');
if (__sr.mode === 'summary') __sr.press('Enter');
if (__sr.mode !== 'depot') throw new Error('Loss summary Enter flow failed');
__sr.frames(180);
