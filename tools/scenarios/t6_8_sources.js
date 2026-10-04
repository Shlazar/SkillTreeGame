// run mode: source accounting, fractional ordinary kills and fixed silver rewards.
function check(ok, why) { if (!ok) throw new Error(why); }
function fresh(salvage=0) {
  __sr.reset(); __sr.thermal(0); __sr.node('salvageCrew',salvage); __sr.leg(7); __sr.bot(false);
  const g=__sr.G; g.killPay=.25; g.zombies.length=0; g.spawnCd=g.railCd=1e6;
  g.eventIndex=__sr.line().legs[6].events.length; g.helis[0].cd=1e6; __sr.hp(9999);
}
function kill(kind,cause='mg') {
  const s=__sr.stats(),i=__sr.variantSpawn(kind,s.W*.7,s.VH*.55);
  check(i>=0,'Missing payout fixture actor'); __sr.hit(__sr.G.zombies[i],100,cause);
}
function balanced() {
  const s=__sr.incomeState();
  check(Object.values(s.sources).reduce((a,b)=>a+b,0)===s.scrap,'Source totals disagree with cash');
  check(__sr.G.pay.kills===s.sources.ordinary+s.sources.silver && __sr.G.pay.loot===s.sources.loot+s.sources.wall,'Summary sources disagree');
  return s;
}
fresh(); for(let i=0;i<3;i++)kill('normal');
check(__sr.G.cash===0 && Math.abs(__sr.G.killAcc-.75)<1e-9,'Fractional ordinary payout rounded too early');
kill('silver','ram');
check(__sr.G.cash===15 && Math.abs(__sr.G.killAcc-.75)<1e-9,'Silver inherited Ram bonus or consumed ordinary fraction');
kill('normal'); kill('normal','ram'); kill('normal','ram');
const plain=balanced();
check(plain.sources.ordinary===2 && plain.sources.silver===15 && plain.base.ordinary===8,'Ordinary Ram weighting or source calibration is wrong');
fresh(1);for(let i=0;i<4;i++)kill('normal');kill('silver','ram');
check(__sr.G.cash===17 && Math.abs(__sr.G.killAcc-.08)<1e-9 && Math.abs(__sr.G.silverAcc-.2)<1e-9,'Salvage was not applied once with independent fractions');
const pile=__sr.lootSpawn('pile');__sr.lootTake(pile);__sr.sim(.5);
check(__sr.incomeState().sources.loot===16 && Math.abs(__sr.G.lootAcc-.2)<1e-9,'Loot salvage or source accounting is wrong');
const wall=__sr.wallFixture({ahead:100,hp:1,id:'qa-income-wall'});check(wall,'Wall fixture failed');
__sr.hit(__sr.G.walls[0].target,100,'mg');
check(__sr.incomeState().sources.wall===0,'Wall scrap paid before collection');
const find=__sr.loot().find(f=>f.eventId==='qa-income-wall-scrap');check(find,'Wall pile missing');
__sr.lootGo(find.i);__sr.sim(.6);
check(__sr.incomeState().sources.wall===Math.floor(find.pay*1.08+1e-9),'Wall pickup failed its own source pot');
__sr.payGold('qa-repeat-gold',1,10);__sr.payGold('qa-repeat-gold',1,10);
const boosted=balanced();
check(boosted.sources.loot===27 && boosted.base.loot===25,'Gold retry scrap did not share the loot source exactly once');
QA_DONE({plain,boosted});
