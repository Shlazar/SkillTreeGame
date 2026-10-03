// Shot mode: mid tree ownership on the summary, with the new goal and no currency lesson strip.
function hintSetup(stage, screen) {
  __sr.hold(false);
  __sr.reset();
  // Keep the lesson strip clear so these shots show the new goal/tag text.
  for (const key of ['currency_scrap', 'currency_surv', 'currency_gold']) __sr.SAVE.seen[key] = true;
  if (stage === 'fresh') {
    __sr.give(80, 0, 0);
  } else if (stage === 'mid') {
    __sr.SAVE.flags.survShown = true;
    __sr.SAVE.flags.goldShown = true;
    __sr.give(200, 2, 12);
    for (const id of ['hdmg', 'hrate', 'armor']) if (!__sr.node(id, 1)) throw new Error('Mid hint setup failed: ' + id);
  } else if (stage === 'all') {
    for (const key of ['survShown', 'goldShown', 'silverSeen', 'boomSeen']) __sr.SAVE.flags[key] = true;
    __sr.give(20000, 30, 500);
    for (const node of __sr.treeNodes()) {
      if (node.k !== 'tease' && !__sr.node(node.id, node.max)) throw new Error('All-owned hint setup failed: ' + node.id);
    }
  } else throw new Error('Unknown hint stage ' + stage);
  __sr.hover(4, 70);
  if (screen === 'depot') {
    __sr.depot('tree');
    if (stage === 'all') __sr.treeCam(1.5, 0.75, 0.25);
    else if (stage === 'mid') __sr.treeCam(0.75, 0.75, 0.75);
    else __sr.treeCam(0, 0, 1);
    __sr.frames(120);
  } else if (screen === 'summary') {
    __sr.start();
    __sr.lose();
    __sr.sim(6);
    __sr.frames(120);
    __sr.hold(true);
  } else throw new Error('Unknown hint screen ' + screen);
}

hintSetup('mid', 'summary');

