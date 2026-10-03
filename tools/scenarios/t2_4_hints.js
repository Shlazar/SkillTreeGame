// Run mode: new tree goals and Depot tags make sense fresh, partly owned and fully owned.
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

function plain(value) { return String(value).replace(/\s+/g, ' ').trim(); }
function goalText(stage) {
  const lines = __sr.goal();
  if (!Array.isArray(lines) || lines.length !== 1 || !Array.isArray(lines[0]) || typeof lines[0][0] !== 'string') throw new Error('Goal must be one concise line');
  const text = plain(lines[0][0]), nodes = __sr.treeNodes(), visible = new Set(__sr.treeShown());
  if (stage === 'fresh') {
    if (!text.includes('NEXT UPGRADE')) throw new Error('Fresh goal is not an upgrade: ' + text);
    const candidates = nodes.filter(n => n.id !== 'root' && n.cur === 'scrap' && n.k !== 'tease' && !n.lv && visible.has(n.id));
    if (!candidates.some(n => text.includes(n.name))) throw new Error('Fresh goal does not name a visible starter: ' + text);
    const expected = ['root', 'hdmg', 'hrate', 'armor', 'magnet'].sort();
    if (JSON.stringify([...visible].sort()) !== JSON.stringify(expected)) throw new Error('Fresh hints revealed extra nodes');
  } else if (stage === 'mid') {
    if (!text.includes('NEXT NEW UNIT')) throw new Error('Mid goal is not a new unit: ' + text);
    const candidates = nodes.filter(n => n.cur === 'surv' && !n.lv && visible.has(n.id));
    if (!candidates.some(n => text.includes(n.name))) throw new Error('Mid goal names an unavailable unit: ' + text);
  } else if (!text.includes('ALL DEMO UPGRADES OWNED')) throw new Error('All-owned goal is wrong: ' + text);
  if (/CLICK THE TRAIN|OPEN THE SKILL TREE|H_STAR|NEXT BIG UNLOCK|IT'S FREE/.test(text)) throw new Error('Old goal text survived: ' + text);
  return text;
}
const results = [];
for (const stage of ['fresh', 'mid', 'all']) {
  for (const screen of ['depot', 'summary']) {
    // Each of the six shot scripts calls this identical fixture and lets the same fade settle.
    hintSetup(stage, screen);
    if (__sr.mode !== screen) throw new Error('Hint fixture is not on ' + screen);
    const goal = goalText(stage), tutorial = __sr.tutState();
    const legacy = JSON.stringify({hint: tutorial.hint, tag: tutorial.tag});
    if (/CLICK THE TRAIN|OPEN THE SKILL TREE|H_STAR|IT'S FREE/.test(legacy)) throw new Error('Old Depot prompt survived: ' + legacy);
    if (screen === 'depot' && tutorial.tag) {
      const id = tutorial.tag[0];
      if (id !== 'start' && (!__sr.treeShown().includes(id) || !__sr.treeNodes().some(n => n.id === id))) throw new Error('Depot tag points to an unavailable node: ' + id);
    }
    let notes = null;
    if (screen === 'summary') {
      const view = __sr.summaryView();
      notes = plain(view.notes.map(note => note[0]).join(' '));
      if (!notes.includes(goal)) throw new Error('Actual summary omits its goal: ' + notes + ' / ' + goal);
      const {W, H} = __sr.stats();
      if (view.x < 0 || view.y < 0 || view.x + view.w > W || view.y + view.h > H) throw new Error('Hint summary does not fit the viewport');
    }
    __sr.frames(30);
    results.push({stage, screen, goal, hint: tutorial.hint, tag: tutorial.tag, notes});
  }
}
QA_DONE({results, shots: 6, oldPromptsRemoved: true, summaryGoalsVisible: true});

