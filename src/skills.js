// skills.js - scheduled golden runners and their rewards, the dormant cow catcher, and armor.
// Also the 25mm's kill feel: a short hit-stop when one round kills 3 or more.

const SK = {
  // Gold payout/replay scrap, crossing speed/edge margin, screen lane, bounded tracking and Hunt gaps. (proposal)
  gold: { reward: 1, scrap: 10, speed: 60, edge: 18, lane: 0.2, laneTop: 48, laneBottom: 42,
    follow: 180, ahead: 80, huntGap: 8 }
};
// A tutorial moment for part D's prompts (nothing happens when they are not there).
function skillEvent(name, data) {
  if (typeof tutEvent === 'function') tutEvent(name, data || {});
}

// ---------- one 25mm round's kills
// After a player round lands: a short hit-stop when it killed 3 or more.
function roundKills(list) {
  if (G.demo || !list.length) return;
  if (list.length >= 3) hitStop(0.03);
}

// ---------- the COW CATCHER and the ARMOR plates
// The plow throws a walker or runner aside: it dies, and the train loses no health and no speed.
function plow(z) {
  kill(z, 'train', 0, 0, 0);
  for (let k = 0; k < 3; k++) part({ x: z.x, y: z.y, z: 2, vx: rnd(-40, 40), vy: rnd(-20, 10), vz: rnd(15, 45), g: 160,
    life: rnd(0.15, 0.3), max: 0.3, s: 1, c: pick(['#ffffff', '#ffe2a0']), add: true, drag: 2 });
  if (!G.demo) {
    addShake(0.04);
    SFX.clang();
  }
}
// Drawn on the engine (car c) after its sprite, at its heading: steel plates down both sides with
// rivets (from ARMOR 1; longer with more levels).
const KIT = (thermal) => (thermal ? ['#141414', '#3a3a3a', '#5a5a5a', '#3a3a3a'] : ['#16181c', '#5d636e', '#b8bec8', '#c8432e']);
const kpx = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
function drawEngineKit(c) {
  const up = G.up, k = kpx, st = KIT(thermal);
  if (up.armor) {
    const len = 4 + Math.min(5, up.armor) * 2;
    for (const s of [-1, 1]) for (let al = -len; al <= len; al++) {
      const x = c.cx + c.dx * al + c.nx * s * 8.5, y = c.cy + c.dy * al + c.ny * s * 8.5;
      k(x, y - 2, st[0]);
      k(x, y - 3, st[1]);
      k(x, y - 4, al % 5 === 0 ? st[2] : st[1]);
      k(x, y - 5, st[0]);
    }
  }
}

// The COW CATCHER: a steel plow round the engine's nose, a wedge of bars with its tip 10 px ahead
// and red on top at the point. (Drawn over the headlights' glow, so it always reads.)
function drawPlow() {
  if (!G.up.cow) return;
  const c = G.tr.cars[0], k = kpx, st = KIT(thermal);
  for (let u = -9; u <= 9; u += 0.5) {
    const f = 2 + (9 - Math.abs(u)) * 0.95, x = c.x0 + c.dx * f + c.nx * u, y = c.y0 + c.dy * f + c.ny * u;
    const bar = (Math.round(u * 2) & 3) < 2;
    k(x, y, st[0]);
    k(x, y - 1, bar ? st[2] : st[1]);
    k(x, y - 2, bar ? st[2] : st[1]);
    k(x, y - 3, Math.abs(u) < 3 ? st[3] : st[0]);
  }
}

// ---------- GOLDEN ZOMBIES
// Turn zombie z golden. Returns z.
function makeGold(z) {
  z.gold = true;
  z.silver = z.boom = false;
  z.type = 1; z.S = pick(ZS[1]); z.big = false; z.st = 0; z.still = false;
  z.value = 0;
  z.run = true;
  z.hp = z.max = 1;
  z.sp = SK.gold.speed;
  return z;
}
// One run's scheduled Hunt extras and actual spawn/catch/escape receipts, without saved counters.
function goldState() {
  return G.golden || (G.golden = { queue: [], events: [] });
}
function addGolden(params = {}, eventId = '', primary = true, itemId = 'golden-primary') {
  if (!legAllows('gold') || G.result || mode !== 'play') return null;
  const state = goldState(), old = state.events.find((e) => e.itemId === itemId);
  if (old) return null;
  const c = SK.gold, edge = params.edge === 1 ? 1 : -1;
  const sy = clamp(VH * c.lane, c.laneTop, VH - c.laneBottom), x = G.camX + (edge < 0 ? -c.edge : W + c.edge), y = G.camY + sy;
  const z = makeGold(makeZombie(x, y, 1));
  const record = { itemId, primary, eventId, edge, spawnT: G.run, caughtAt: null, escapedAt: null,
    gold: 0, scrap: 0, starGold: 0 };
  z.goldItemId = itemId; z.goldPrimary = primary; z.goldDir = -edge; z.goldSY = sy; z.goldRecord = record;
  z.left = edge > 0;
  state.events.push(record); G.zombies.push(z);
  // Teach the crossing at its actual spawn, before a quick first shot can remove the runner.
  skillEvent('golden_seen', { z, value: SK.gold.reward });
  if (primary) {
    const n = clamp(Math.floor(G.up.goldHunt || 0), 0, 3);
    for (let i = 1; i <= n; i++) state.queue.push({ at: G.run + i * c.huntGap,
      edge: i & 1 ? -edge : edge, itemId: 'golden-hunt-' + i });
  }
  return z;
}
function updateGoldenEvents() {
  if (!legAllows('gold') || G.result || mode !== 'play') return;
  const state = goldState();
  while (state.queue.length && state.queue[0].at <= G.run + 1e-9) {
    const q = state.queue.shift(), id = 'leg-' + G.leg + '-' + q.itemId;
    if (addGolden(q, id, false, q.itemId)) G.events.push({ id, kind: 'golden', at: q.at, t: G.run, n: 1 });
  }
}
// A straight crossing tracks a visible lane; horde.js applies bounded movement toward it.
const GF = [0, 0];
function goldFlee(z) {
  GF[0] = z.x + (z.goldDir || (z.left ? -1 : 1)) * SK.gold.ahead;
  GF[1] = G.camY + (z.goldSY ?? VH * SK.gold.lane);
  return GF;
}
// A golden zombie dies: a gold ring, a burst of gold, a shower of coins to the counter and a chime.
function goldKill(z, sc) {
  juiceGold(z);
  rings.push({ x: z.x, y: z.y, r0: 3, r1: 26, t: 0, T: 0.4, c: '#ffd24a', w: 2 });
  lights.push({ x: z.x, y: z.y, z: 6, r: 30, c: '#ffd24a', life: 0.3, max: 0.3, a: 0.9 });
  for (let k = 0; k < 16; k++) {
    const a = rnd(TAU), s = rnd(25, 80);
    part({ x: z.x, y: z.y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(30, 90), g: 200, life: rnd(0.4, 0.8),
      max: 0.8, s: 1, c: pick(['#fff6c0', '#ffd24a', '#e3b04b']), add: true, drag: 1.5 });
  }
  if (!sc) return;
  if (z.goldItemId) {
    const paid = payGold(z.goldItemId, SK.gold.reward, SK.gold.scrap, { hunt: !z.goldPrimary });
    const starGold = z.goldPrimary ? earnLegStar(2) : 0;
    if (z.goldRecord) Object.assign(z.goldRecord, { caughtAt: G.run, gold: paid.gold, scrap: paid.scrap, starGold });
    if (z.goldPrimary) G.goldenCaught = true;
    z.paid += paid.scrap;
    if (paid.gold) { floatText(z.x, z.y - z.S.h - 4, '+1 GOLD', U.gold); currencyCoins('gold', z.x, z.y, 1); }
    if (paid.scrap) addTotal(z.x, z.y - z.S.h, paid.scrap, U.blue, scrapPopScale(false));
  }
  for (let k = 0; k < 10 && coins.length < 60; k++) coins.push({ x0: z.x - G.camX + rnd(-5, 5), y0: z.y - G.camY - 8 + rnd(-4, 4), t: -k * 0.04, T: rnd(0.55, 0.8) });
  SFX.gold();
}
// A gold statue copy of sprite src: each pixel's brightness picks a shade of gold; the dark
// outline stays dark.
const GOLDS = [[42, 26, 6], [122, 84, 24], [184, 134, 42], [232, 184, 74], [255, 224, 138]];
function goldSpr(src) {
  const [c, g] = mk(src.width, src.height, true);
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const L = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15, col = GOLDS[L < 34 ? 0 : L < 70 ? 1 : L < 110 ? 2 : L < 160 ? 3 : 4];
    d[i] = col[0];
    d[i + 1] = col[1];
    d[i + 2] = col[2];
  }
  g.putImageData(im, 0, 0);
  return c;
}
// The gold look: a golden copy of its frame (made once per clothes), and sparkles round it.
// Returns false when the plain frame must show (the white hit flash, the thermal camera).
function drawGold(z) {
  if (z.flash > 0 || thermal) return false;
  const S = z.S, f = (z.anim | 0) & 3;
  if (!S.gold) return false;
  blit(S.gold[f][z.left ? 1 : 0], Math.round(z.x - S.ax), Math.round(z.y - S.ay));
  // two sparkles that blink round it
  for (let i = 0; i < 2; i++) {
    const p = (realT * 3 + i * 0.5 + (z.wob % 1)) % 1;
    if (p > 0.45) continue;
    const sx = Math.round(z.x + (hrnd(i, (realT * 3) | 0, z.sp * 100) - 0.5) * 12), sy = Math.round(z.y - S.h * hrnd(i + 7, (realT * 3) | 0, 3));
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(sx, sy, 1, 1);
    if (p < 0.25) {
      ctx.fillRect(sx - 1, sy, 3, 1);
      ctx.fillRect(sx, sy - 1, 1, 3);
    }
  }
  return true;
}

// ---------- each step
function updateSkills(dt) {
  for (const z of G.zombies) {
    if (!z.gold || z.dead) continue;
    const sx = z.x - G.camX;
    if (z.goldItemId && (z.gone || z.goldDir > 0 && sx > W + SK.gold.edge || z.goldDir < 0 && sx < -SK.gold.edge)) {
      z.gone = true;
      if (z.goldRecord && z.goldRecord.escapedAt == null) z.goldRecord.escapedAt = G.run;
      continue;
    }
    if (offView(z.x, z.y, 0)) continue;
    // a soft gold glow
    lights.push({ x: z.x, y: z.y, z: 6, r: 12, c: '#ffd24a', life: 0.03, max: 0.03, a: 0.35 });
    if (!G.goldSeen && !offView(z.x, z.y, -24)) {
      G.goldSeen = true;
      SFX.coin();
      skillEvent('golden_seen', { z, value: SK.gold.reward });
    }
  }
}

