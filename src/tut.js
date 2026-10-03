// tut.js - the teaching layer and the frame polish: the tutorial prompts, the pause menu, the fades
// between screens and the end-of-build card. Features call tutEvent(name, data) at their moments;
// the rest is found here by looking at the game each frame. Prompts show in five channels, one at a
// time each (the rest wait in a queue): TASKS (a box at the top left, up to 3 lines with a check
// box), RADIO (radio() in ui.js), TIP (one gold line over the weapon cards with a blinking arrow
// toward the thing), BANNER (banner()) and TAG (a label with an arrow in the Depot). Each prompt
// shows once per save (SAVE.seen).

// tasks / taskQ = the task lines shown and waiting; tip / tipQ = the tip shown and waiting; banQ =
// banners waiting; labels = words over a zombie (BRUTE!); mode = the screen last frame (for the
// fades and for what a new run resets); fade = the black over the screen (1 = all black); heR = the
// 105mm's reload last frame; heldFirst = this run held a station for the
// first time; cardAt / card = the end-of-build card (when it opens, and its numbers); after = Depot
// prompts to mark seen when the next run starts
const TUT = {
  tasks: [], taskQ: [], tip: null, tipQ: [], banQ: [], labels: [], mode: '', fade: 1, fadeK: 1,
  heR: 0, heldFirst: false, cardAt: 0, card: null, sum: [], after: new Set()
};
const seen = (k) => !!SAVE.seen[k];
// Mark prompt k as shown. True the first time.
function see(k) {
  if (SAVE.seen[k]) return false;
  SAVE.seen[k] = true;
  saveSave();
  return true;
}
// a real run is on (not the demo, not over)
const tutLive = () => G && !G.demo && mode === 'play' && !G.result;

// ---------- the channels
// A task: key (seen once done), the words, how many it needs (a count shows from 2 up), and what
// counts for it (tutCount(kind)).
function task(key, label, need, kind) {
  if (seen(key) || TUT.tasks.concat(TUT.taskQ).some((t) => t.key === key)) return;
  const t = { key, label, need: need || 1, kind, n: 0, t: 0, done: -1, bump: 0 };
  (TUT.tasks.length < 3 ? TUT.tasks : TUT.taskQ).push(t);
}
// n more of kind done: every task waiting for it counts up, and ticks off when full
function tutCount(kind, n) {
  for (const t of TUT.tasks.concat(TUT.taskQ)) {
    if (t.kind !== kind || t.done >= 0) continue;
    const was = Math.floor(t.n);
    t.n = Math.min(t.need, t.n + (n || 1));
    if (Math.floor(t.n) > was) t.bump = 0.25;
    if (t.n >= t.need) {
      t.done = 0;
      see(t.key);
      if (TUT.tasks.includes(t)) SFX.tick();
    }
  }
}
// A tip for 4 s: key (seen at once), the words, and where its arrow points (a function giving a
// point on the screen, or null for no arrow).
function tip(key, msg, at) {
  if (!see(key)) return;
  TUT.tipQ.push({ msg, at: at || null, t: 0 });
}
// A radio line, once per save.
function radioOnce(key, who, msg) {
  if (see(key)) radio(who, msg);
}
// A banner, once per save; it waits while one of ours still shows.
function bannerOnce(key, a, b, col) {
  if (see(key)) TUT.banQ.push([a, b, col || U.gold]);
}
// words over zombie z for 4 s
function label(z, s, col) {
  TUT.labels.push({ z, s, col, t: 0 });
}
// a zombie's place on the screen
const onScreen = (z) => [z.x - G.camX, z.y - G.camY];
const inView = (z) => {
  const [x, y] = onScreen(z);
  return x > 4 && x < W - 4 && y > 24 && y < H - 8;
};

// ---------- the events features send
// tutEvent(name, data): see the shared list (station, loot and shooting moments).
function tutEvent(name, d) {
  d = d || {};
  if (!G || G.demo || !(mode === 'play' || mode === 'ending')) return;
  const P = (o) => () => (o && o.x != null ? [o.x - G.camX, o.y - G.camY] : null);
  const ev = {
    pile_seen: () => {
      task('t_piles', 'GRAB 3 SCRAP PILES', 3, 'pile');
      tip('p_pile', 'RIGHT CLICK A SCRAP PILE TO SEND A HELI.', P(d));
    },
    pile_taken: () => tutCount('pile'),
    crate_seen: () => task('t_crate', 'GRAB THE SUPPLY CRATE', 1, 'crate'),
    crate_taken: () => tutCount('crate'),
    sos_seen: () => { if (!d.winch) tip('p_sos', 'A SURVIVOR! YOU NEED THE WINCH.', P(d)); },
    sos_near: () => tip('p_lift', 'KEEP A HELI OVER THEM TO LIFT THEM UP.', P(d)),
    golden_seen: () => tip('p_golden', 'GOLDEN ZOMBIE! CATCH IT FOR ' + goldenPay(d) + ' SCRAP.', P(d.z || d)),
    chain_first: () => tip('p_chain', 'CHAIN SHOT! A KILL JUMPS TO MORE ZOMBIES.', null),
    // (station.js shows the AHEAD and HOLD banners itself)
    hold_start: () => { if (d.first) tip('p_nest', 'YOUR MG NEST SHOOTS BY ITSELF.', null); },
    survivor_grabbed: () => tip('p_grab', 'RIGHT CLICK THE ZOMBIE TO SAVE THEM.', P(d.x != null ? d : G.people.find((p) => p.st === 'grab'))),
    station_held: () => {
      if (d.first && d.id === STATIONS[0].id) TUT.heldFirst = true;
      if (d.first && d.id === 'mill' && !seen('endcard')) TUT.cardAt = realT + 1.6;
    }
  }[name];
  if (ev) ev();
}
// how many survivors wait at station d (the first hold's crowd, else what is left in its house)
function waiting(d) {
  if (!SAVE.held.includes(d.id)) return d.first.people;
  const h = SAVE.house[d.id];
  return typeof h === 'number' ? h : HOLD_LATER.people;
}
// what a golden zombie pays (from the event, else from the game's numbers)
function goldenPay(d) {
  const g = CFG.golden || (CFG.types && CFG.types.find((t) => t.golden));
  return d.value || d.pay || (g && (g.value || g.pay)) || 25;
}
// A zombie dies (called from kill()): the tasks that count shots.
function tutKill(z, cause, free) {
  if (!scoring() || free) return;
  if (z.st === 1) tutCount('track');
  if (z.st === 2) tutCount('climber');
  // (only your own shots count: not the flatcar gun, the MG nests, the ram or the train)
  if (cause !== 'gun' && cause !== 'nest' && cause !== 'ram' && cause !== 'train') tutCount('shoot');
}

// ---------- each frame
function tutFrame(dt) {
  // a new screen: fade in from black (lighter over the run that just ended); a new run starts clean
  const m = mode === 'ending' ? 'play' : mode;
  if (m !== TUT.mode) {
    TUT.fade = TUT.fadeK = m === 'summary' ? 0.5 : 1;
    if (m === 'play') tutNewRun();
    if (m === 'summary') tutSumOpen();
    if (TUT.mode === 'play') TUT.tasks.length = TUT.taskQ.length = TUT.tipQ.length = TUT.banQ.length = 0;
    TUT.mode = m;
  }
  TUT.fade = Math.max(0, TUT.fade - dt / 0.25 * TUT.fadeK);
  // the end-of-build card opens a moment after Mill Town is held
  if (TUT.cardAt && realT >= TUT.cardAt) {
    TUT.cardAt = 0;
    if (tutLive() && see('endcard')) {
      TUT.card = { t: realT, km: km2(G.maxKm), kills: G.kills, scrap: Math.floor(G.cash), surv: G.surv, time: G.run };
      setPaused(true);
      SFX.total();
    }
  }
  if (TUT.card && !paused) TUT.card = null;
  tutChannels(dt);
  if (tutLive() && !paused) tutLook(dt);
}
// a new run: the channels empty, the counters from zero; Depot prompts shown are now done
function tutNewRun() {
  TUT.tasks.length = TUT.taskQ.length = TUT.tipQ.length = TUT.banQ.length = TUT.labels.length = 0;
  TUT.tip = null;
  TUT.heldFirst = false;
  TUT.card = null;
  TUT.cardAt = 0;
  if (G) TUT.heR = G.heReload;
  for (const k of TUT.after) see(k);
  TUT.after.clear();
}
// the timers of the tasks, the tip, the banners and the labels
function tutChannels(dt) {
  const T = TUT;
  for (let i = T.tasks.length - 1; i >= 0; i--) {
    const t = T.tasks[i];
    t.t += dt;
    t.bump = Math.max(0, t.bump - dt);
    if (t.done >= 0) t.done += dt;
    if (t.done > 1.35) T.tasks.splice(i, 1);
  }
  while (T.tasks.length < 3 && T.taskQ.length) T.tasks.push(T.taskQ.shift());
  if (T.tip) {
    T.tip.t += dt;
    if (T.tip.t >= 4) T.tip = null;
  }
  if (!T.tip && T.tipQ.length) T.tip = T.tipQ.shift();
  if (T.banQ.length && !banners.some((b) => b.tut)) {
    const [a, b, c] = T.banQ.shift();
    banner(a, b, c, 2);
    if (banners[0] && banners[0].a === a) banners[0].tut = true;
  }
  for (let i = T.labels.length - 1; i >= 0; i--) {
    const l = T.labels[i];
    l.t += dt;
    if (l.t >= 4 || l.z.dead || l.z.gone) T.labels.splice(i, 1);
  }
}
// What the run shows now that has a prompt (the ones no feature sends an event for).
function tutLook(dt) {
  const k = DK(), runs = SAVE.runs;
  // a 105mm shell fired
  if (G.heReload > TUT.heR + 0.01) tutCount('he');
  TUT.heR = G.heReload;
  // the first things to learn, right after the first run's Ram taste (or a moment into a run)
  // (the helis: select, send, select all)
  if (G.taste ? G.ram.crack > 0 && realT - G.ram.crack > 0.6 : G.run > 1.5) {
    task('t_sel', 'CLICK YOUR HELI', 1, 'select');
    task('t_attack', 'RIGHT CLICK A ZOMBIE TO ATTACK IT', 1, 'attack');
    if (G.helis.length > 1) task('t_all', 'DRAG A BOX OR PRESS A TO SELECT ALL HELIS', 1, 'selall');
    const h = G.helis[0];
    if (h) tip('p_auto', 'YOUR HELI FIGHTS BY ITSELF. RIGHT CLICK TO SEND IT.', () => [h.x - G.camX, h.y - h.alt - G.camY]);
  }
  if (G.overheat) tip('p_hot', 'TOO HOT! THE GUN COOLS DOWN BY ITSELF.', () => [40, cardsTop() + 13]);
  if (G.up.gun && G.run > 3) tip('p_gun', 'YOUR RAIL CANNON GUARDS THE TRAIN. SEND A HELI FOR LOOT!', () => {
    const [x, y] = gunXY();
    return [x - G.camX, y - G.camY];
  });
  // scrap piles: from 11 s into run 2 (once there is loot on the line)
  if (runs >= 2 && G.run > 11 && G.loot) task('t_piles', 'GRAB 3 SCRAP PILES', 3, 'pile');
  const F = STATIONS[0], M = STATIONS[1];
  if (k >= 0.55 && waiting(F)) radioOnce('r_farm', F.name, 'WE SEE YOUR SMOKE! ' + waiting(F) + ' OF US ARE WAITING.');
  if (k >= 1.5 && M && waiting(M)) radioOnce('r_mill', M.name, waiting(M) + ' OF US HERE. PLEASE HURRY!');
  // the dead in view: a crowd on the rails, one on the train, a runner, a brute
  let rail = 0, climb = null, runner = null, brute = null, railBrute = null;
  for (const z of G.zombies) {
    if (z.dead || !inView(z)) continue;
    if (z.st === 1) rail++;
    if (z.st === 2) climb = z;
    if (z.type === 1) runner = z;
    if (z.type === 2) {
      brute = brute || z;
      if (z.st === 1) railBrute = z;
    }
  }
  if (rail >= 3) {
    task('t_track', 'SHOOT THE DEAD ON THE TRACK', 5, 'track');
    if (G.up.he) task('t_he', 'SPACE: 105MM AT THE MOUSE', 1, 'he');
  }
  if (climb && runs >= 2) task('t_climb', 'SHOOT THE DEAD OFF THE TRAIN', 1, 'climber');
  if (runner && runs >= 2) bannerOnce('b_run', 'RUNNERS', 'FAST, BUT ONLY ' + CFG.types[1].hp + ' HP', U.amber);
  const at = (z) => () => onScreen(z);
  if (brute && !seen('p_brute')) {
    label(brute, 'BRUTE!', U.red);
    tip('p_brute', 'BRUTES HAVE ' + CFG.types[2].hp + " HP. THE TRAIN CAN'T PUSH THEM.", at(brute));
  }
  if (railBrute) tip('p_railbrute', 'BRUTE ON THE TRACK! USE THE 105MM OR THE RAM.', at(railBrute));
}

// ---------- drawing in the run
// the top of the weapon cards (the Ram's card can sit over the 25mm's on a narrow window)
const cardsTop = () => Math.min(H - 30, RAMCARD.on ? RAMCARD.y : H - 30);
// the task box: [right edge, bottom], or null while it is empty
function taskBox() {
  if (!TUT.tasks.length || mode !== 'play') return null;
  const w = Math.max(...TUT.tasks.map((t) => tw(taskText(t)))) + 19;
  return [4 + w, 22 + 5 + TUT.tasks.length * 10];
}
const taskText = (t) => t.label + (t.need > 1 ? ' (' + Math.floor(t.n) + '/' + t.need + ')' : '');
// Where the warnings under the top bar go (L = their lines): in the middle, or moved right of the
// task box, or under it when there is no room beside it. Returns [x of the middle, y].
function warnAt(L) {
  const b = taskBox();
  if (!b || !L.length) return [W / 2, 24];
  const ww = Math.max(...L.map(([t]) => tw(t)));
  const x = Math.max(W / 2, b[0] + 8 + ww / 2);
  return x + ww / 2 <= W - 4 ? [Math.round(x), 24] : [W / 2, b[1] + 4];
}
// room the tip takes over the weapon cards (the radio box goes above it)
const tipRoom = () => (TUT.tip && mode === 'play' ? 14 : 0);
// A small blinking triangle at (x, y), its tip toward (ux, uy).
function triangle(x, y, ux, uy, col) {
  for (const [c, g] of [['#07080a', 1], [col, 0]]) {
    ctx.fillStyle = c;
    for (let py = -5; py <= 5; py++) for (let px = -5; px <= 5; px++) {
      const a = px * ux + py * uy, b = -px * uy + py * ux;
      if (a <= 3 + g && a >= -2 - g && Math.abs(b) <= (3 - a) * 0.62 + g * 0.9) ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}
function drawTut() {
  if (mode !== 'play') return;
  drawTasks();
  if (!G.prompt) drawTipLine();     // (the PRESS E moment keeps the screen clear)
  for (const l of TUT.labels) {
    const [x, y] = onScreen(l.z), u = l.t;
    ctx.globalAlpha = u > 3.6 ? (4 - u) / 0.4 : 1;
    text(l.s, x, y - l.z.S.ay - 10 - (Math.floor(realT * 4) % 2), l.col, { align: 'center' });
    ctx.globalAlpha = 1;
  }
}
function drawTasks() {
  const b = taskBox();
  if (!b) return;
  const x = 4, y = 22, w = b[0] - x, h = b[1] - y;
  panel(x, y, w, h, 'rgba(10,11,14,0.86)');
  ctx.fillStyle = '#8a6a2a';
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  TUT.tasks.forEach((t, i) => {
    const ry = y + 5 + i * 10, d = t.done;
    // done: green, then it fades after 1 s; a new one fades in
    ctx.globalAlpha = d > 1 ? Math.max(0, 1 - (d - 1) / 0.35) : Math.min(1, t.t / 0.2);
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x + 4, ry, 7, 7);
    ctx.fillStyle = d >= 0 ? U.green : '#6a6f7b';
    ctx.fillRect(x + 5, ry + 1, 5, 5);
    if (d < 0) {
      ctx.fillStyle = '#16171c';
      ctx.fillRect(x + 6, ry + 2, 3, 3);
    }
    text(taskText(t), x + 14, ry, d >= 0 ? U.green : t.bump > 0 ? '#ffffff' : U.ink);
    ctx.globalAlpha = 1;
  });
}
function drawTipLine() {
  const t = TUT.tip;
  if (!t) return;
  const y = cardsTop() - 22, w = tw(t.msg), p = t.at && t.at();
  const aw = p ? 12 : 0, x = Math.round(W / 2 - (w + aw) / 2);
  ctx.globalAlpha = t.t < 0.15 ? t.t / 0.15 : t.t > 3.6 ? (4 - t.t) / 0.4 : 1;
  ctx.fillStyle = 'rgba(5,6,8,0.7)';
  ctx.fillRect(x - 5, y - 3, w + aw + 10, 13);
  text(t.msg, x + aw, y, U.gold);
  // the arrow toward the thing it means, blinking
  if (p && Math.floor(realT * 4) % 2 === 0) {
    const cx = x + 4, cy = y + 3, dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    triangle(cx, cy, dx / l, dy / l, U.gold);
  }
  ctx.globalAlpha = 1;
}

// ---------- the Depot: the hint bar and the tags
// The bottom bar's line for a lesson here, or null.
function tutHint() {
  const stars = NODES.filter((n) => n.star && !n.given && lv(n.id)).length;
  if (!seen('h_star')) {
    // * NODES: from the first time one can be bought, until one more is bought
    if (SAVE.seen.h_starAt == null && NODES.some((n) => n.star && nodeState(n) === 'buy')) {
      SAVE.seen.h_starAt = stars;
      saveSave();
    }
    if (SAVE.seen.h_starAt != null) {
      if (stars > SAVE.seen.h_starAt) see('h_star');
      else return ['ORANGE NODES ARE BIG UNLOCKS.', U.gold];
    }
  }
  if (lv('ram') && !seen('h_ram')) {
    TUT.after.add('h_ram');
    return ['E: TURBO RAM. SAVE IT FOR THE DEAD WALL.', U.gold];
  }
  if (startsOpen().length > 1 && !seen('h_start')) {
    if (SAVE.start !== 'depot') see('h_start');
    else {
      TUT.after.add('h_start');
      return ['START AT ' + STATIONS[0].name + ': YOUR TOWERS FIGHT FIRST.', U.gold];
    }
  }
  return null;
}
// a node by its name (other parts own the ids)
const nodeNamed = (name) => NODES.find((n) => n.name === name);
// The tag that shows now: [node id or 'start', words], or null.
function tutTag() {
  const tree = depotTab === 'tree';
  if (!lv('root')) return tree ? ['root', "CLICK THE TRAIN. IT'S FREE."] : null;
  if (!SAVE.runs) return ['start', 'PRESS START RUN.'];
  const wm = NODE.wingman;
  if (wm && !seen('g_wing')) {
    TUT.after.add('g_wing');
    if (!lv(wm.id)) return tree && shownAs(wm) === 2 ? [wm.id, 'BUY WINGMAN: A SECOND HELI JOINS YOU! THEN PRESS START RUN.'] : null;
    return ['start', 'PRESS START RUN.'];
  }
  const he = NODE.he;
  if (tree && he && !lv('he') && stationOpen() && nodeState(he) === 'buy') return ['he', 'BUY THE 105MM WITH ' + he.cost[0] + ' SURVIVORS.'];
  const wi = NODE.winch;
  if (tree && wi && !lv('winch') && nodeState(wi) === 'buy') return ['winch', 'WINCH: SAVE SURVIVORS IN THE FIELD.'];
  return null;
}
function drawTutTags() {
  const g = tutTag();
  if (!g) return;
  const [id, msg] = g, L = tw(msg) > 190 ? wrap(msg, 190) : [msg];
  const w = Math.max(...L.map((l) => tw(l))) + 12, h = L.length * 10 + 6, bob = Math.round(Math.sin(realT * 6) * 1.5);
  let x, y, ux, uy, ax, ay;
  if (id === 'start') {
    // over START RUN, which pulses
    const bx = W - 106, by = H - 24;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(realT * 8);
    frame(bx - 2, by - 2, 104, 24, '#ffd36a');
    ctx.globalAlpha = 1;
    x = clamp(bx + 50 - w / 2, 4, W - w - 4);
    y = by - 12 - h + bob;
    [ax, ay, ux, uy] = [bx + 50, y + h + 4, 0, 1];
  } else {
    // beside the node: right, left, over or under it, on the side that covers the fewest other
    // nodes (and stays on the screen)
    const p = nodeXY(id), r = halfOf(NODE[id]) + 10, sides = [
      [p.x + r, p.y - h / 2, -1, 0], [p.x - r - w, p.y - h / 2, 1, 0], [p.x - w / 2, p.y - r - h, 0, 1], [p.x - w / 2, p.y + r + 12, 0, -1]];
    let best = 1e9;
    for (const [sx, sy, dx, dy] of sides) {
      let n = sx < 4 || sy < 22 || sx + w > W - 4 || sy + h > H - 32 ? 100 : 0;
      for (const o of NODES) {
        if (o.id === id || !shownAs(o)) continue;
        const q = nodeXY(o.id), a = halfOf(o) + 2;
        if (q.x + a > sx && q.x - a < sx + w && q.y + a + 12 > sy && q.y - a < sy + h) n++;
      }
      if (n < best) [best, x, y, ux, uy] = [n, sx, sy, dx, dy];
    }
    x += -ux * bob;
    y = clamp(Math.round(y - uy * bob), 22, H - 32 - h);
    ax = ux ? (ux < 0 ? x - 4 : x + w + 3) : p.x;
    ay = uy ? (uy < 0 ? y - 4 : y + h + 3) : p.y;
  }
  x = Math.round(x);
  panel(x, y, w, h, 'rgba(14,12,8,0.95)');
  frame(x, y, w, h, '#b8862f');
  L.forEach((l, i) => text(l, x + 6, y + 4 + i * 10, U.gold));
  triangle(Math.round(ax), Math.round(ay), ux, uy, U.gold);
}

// ---------- the pause menu
// PAUSE = the menu's box (a click outside it goes on with the run)
const PAUSE = { x: 0, y: 0, w: 0, h: 0 };
// true when a click at (x, y) is on the pause menu or the end card (it does not go on)
const pauseHit = (x, y) => !!TUT.card || inR(x, y, PAUSE.x, PAUSE.y, PAUSE.w, PAUSE.h);
function drawPause() {
  ctx.fillStyle = 'rgba(5,6,8,0.6)';
  ctx.fillRect(0, 19, W, H - 19);
  if (TUT.card) {
    drawEndCard();
    return;
  }
  const L = ['YOUR HELIS FIGHT BY THEMSELVES.', 'CLICK OR DRAG: SELECT.  A: ALL.  1 2 3: ONE.', 'RIGHT CLICK: ATTACK, MOVE OR ESCORT.'];
  if (G.up.he) L.push('SPACE: 105MM AT THE MOUSE.');
  if (G.up.ram) L.push('E: TURBO RAM.');
  if (G.up.strafe) L.push('Q: STRAFING RUN, THEN CLICK THE MAP.');
  L.push('T: CAMERA.  M: SOUND.  WHEEL: ZOOM.');
  const w = 280, h = 112 + L.length * 10, x = Math.round(W / 2 - w / 2), y = Math.max(22, Math.round((H + 19) / 2 - h / 2)), cx = x + w / 2;
  Object.assign(PAUSE, { x, y, w, h });
  panel(x, y, w, h, '#0f1014');
  text('PAUSED', cx, y + 9, U.ink, { align: 'center', scale: 2, drop: true });
  if (button(cx - 70, y + 30, 140, 20, 'RESUME', { primary: true })) setPaused(false);
  if (button(cx - 70, y + 55, 140, 20, 'BACK TO DEPOT', { danger: true })) quitRun();
  text('YOU KEEP ALL YOUR SCRAP.', cx, y + 80, U.dim, { align: 'center' });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, y + 93, w - 28, 1);
  L.forEach((l, i) => text(l, cx, y + 100 + i * 10, U.faint, { align: 'center' }));
  text('ESC OR CLICK OUTSIDE: RESUME', cx, y + h + 6, U.dim, { align: 'center' });
}
// BACK TO DEPOT: the run ends here (no blast); what it earned is kept, and the summary shows it.
function quitRun() {
  if (mode !== 'play' || !G || G.demo || G.result) return;
  paused = false;
  G.result = 'quit';
  G.prompt = null;
  G.lock = null;
  banners.length = 0;
  SFX.ramStop(0.1);
  endGame();
}

// ---------- the end-of-build card
function drawEndCard() {
  const c = TUT.card, u = clamp((realT - c.t) / 0.3, 0, 1), m = Math.floor(c.time / 60), s = Math.floor(c.time % 60);
  const rows = [['DISTANCE', c.km.toFixed(2) + ' KM', U.ink], ['ZOMBIES', fmt(c.kills), U.ink], ['SCRAP', '+' + fmt(c.scrap), U.gold],
    ['SURVIVORS', '+' + c.surv, U.green], ['TIME', m + ':' + String(s).padStart(2, '0'), U.ink]];
  const w = 300, h = 96 + rows.length * 11 + 34, x = Math.round(W / 2 - w / 2), y = Math.max(20, Math.round((H + 19) / 2 - h / 2)), cx = x + w / 2;
  ctx.globalAlpha = u;
  panel(x, y + Math.round((1 - u) * 8), w, h, '#0f1014');
  frame(x, y, w, h, '#b8862f');
  ctx.globalAlpha = 1;
  if (u < 1) return;
  text(STATIONS[1].name + ' REACHED!', cx, y + 10, U.gold, { align: 'center', scale: 2, drop: true });
  text('THIS IS THE END OF THE FIRST 10 MINUTES.', cx, y + 32, U.ink, { align: 'center' });
  text('THANKS FOR PLAYING!', cx, y + 44, U.gold, { align: 'center' });
  ctx.fillStyle = '#2e3139';
  ctx.fillRect(x + 14, y + 58, w - 28, 1);
  text('THIS RUN', cx, y + 64, U.dim, { align: 'center' });
  rows.forEach(([a, b, col], i) => {
    text(a, x + 40, y + 78 + i * 11, U.dim);
    text(b, x + w - 40, y + 78 + i * 11, col, { align: 'right' });
  });
  const by = y + 96 + rows.length * 11;
  if (button(cx - 128, by, 124, 20, 'KEEP PLAYING', { primary: true })) setPaused(false);
  if (button(cx + 4, by, 124, 20, 'TITLE')) {
    bankRun();
    TUT.card = null;
    toTitle();
  }
}
// The summary's lines for a lesson from this run (after the first station held), worked out as
// the summary opens.
function tutSumLines() {
  return TUT.sum;
}
function tutSumOpen() {
  TUT.sum = TUT.heldFirst && see('s_held') ? [['NEW: SURVIVORS. THEY BUY THE BIGGEST UNLOCKS.', U.green],
    [STATIONS[0].name + ' IS YOURS. SEE THE STATION TAB.', U.green]] : [];
}

// ---------- the fade between screens
function drawFade() {
  if (TUT.fade <= 0) return;
  ctx.globalAlpha = Math.min(1, TUT.fade);
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ---------- tests
Object.assign(window.__sr, {
  // tut(name, data): send a tutorial event; seen() = the prompts shown so far (SAVE.seen)
  tut: (name, d) => tutEvent(name, d),
  seen: () => Object.keys(SAVE.seen).filter((k) => SAVE.seen[k] === true),
  // tutState() = what each channel shows now
  tutState: () => ({
    tasks: TUT.tasks.map((t) => taskText(t) + (t.done >= 0 ? ' DONE' : '')), queued: TUT.taskQ.length, tip: TUT.tip && TUT.tip.msg,
    tips: TUT.tipQ.length, radio: RADIO.cur && RADIO.cur.msg, banner: banners[0] && banners[0].a, tag: mode === 'depot' ? tutTag() : null,
    hint: mode === 'depot' ? tutHint() : null, card: !!TUT.card, fade: +TUT.fade.toFixed(2), paused
  }),
  quit: () => quitRun()
});
