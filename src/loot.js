// loot.js - timeline finds: scrap piles on wrecks and supply crates in burnt farms. Fly the Viper
// near a find to collect it; it flies up to the heli and pays. Golden crates bank at pickup.
// Field rescues bank after a two-second hover and carry forward until saved. G.loot resets per leg.

// pile: scrap paid. crate: its guards, how near the heli wakes them,
// how near the heli its edge arrow shows, how far along the rails ahead of the train its guards are
// placed. gold: first gold payment / retry scrap, arrow reach. sos: hover reach and arrow reach.
// sos.reach = px the heli must hover within for the Winch. fly = seconds a find takes to fly
// up to the heli. Leg events supply the position and can override scrap paid.
const LOOT = {
  pile: { pay: 15 },
  crate: { pay: 50, guards: 8, wake: 120, arrow: 450, place: 500 },
  gold: { pay: 5, scrap: 25, arrow: 700 },
  sos: { reach: 20, arrow: 700 },
  fly: 0.3
};
// Event placement distances/margins in world or screen px; widthFrac is a viewport fraction (proposal)
const LEGLOOTC = { ahead: 120, off: 100, maxAhead: 500, minOff: 24, maxOff: 180, widthFrac: 0.4,
  goalPad: 40, startPad: 24, viewX: 40, viewTop: 56, viewBottom: 42 };
const RESCUE_IDS = ['rescue-4', 'rescue-8', 'rescue-10'];
// Carry placements in world px; rope/lift/icon durations in seconds; ground hand/label height in px. (proposal)
const RESCUEC = { carryAhead: 80, carryStep: 60, carryOff: 70, rope: 0.45, lift: 1.6, icon: 0.8, hand: 9, label: 22 };
// Find art is created and packed once during script initialization, before the first frame.
const LART = {};
function lootArt() {
  if (LART.heap) return;
  // a small heap of scrap metal: plates, a pipe, a wheel rim, rust
  LART.heap = prop(outline(pix(13, 8, (r) => {
    r(1, 4, 11, 4, '#3b3f46'); r(0, 6, 13, 2, '#2d3038'); r(2, 2, 5, 3, '#626875'); r(2, 2, 5, 1, '#b4b9c1');
    r(7, 1, 4, 4, '#5a4a3a'); r(7, 1, 4, 1, '#a07040'); r(5, 0, 1, 4, '#d6cdb6'); r(9, 4, 3, 2, '#7a3a22');
    r(1, 5, 3, 1, '#8b919c'); r(11, 3, 1, 1, '#e8dfc8'); r(4, 6, 1, 1, '#1c1e23'); r(8, 6, 2, 1, '#1c1e23');
    r(3, 3, 2, 1, '#8b919c'); r(10, 6, 2, 1, '#626875');
  }), P.out), 0);
  // a supply crate: olive green, banded, a white stencil cross
  const crate = (c0, c1, c2, mark) => pix(12, 10, (r) => {
    r(0, 3, 12, 7, c1); r(0, 3, 2, 7, c2); r(11, 3, 1, 7, c0); r(0, 9, 12, 1, c0);
    r(0, 0, 12, 4, c2); r(0, 0, 12, 1, mark); r(0, 3, 12, 1, c0);
    r(3, 3, 1, 7, c0); r(8, 3, 1, 7, c0); r(5, 5, 2, 3, mark); r(4, 6, 4, 1, mark);
  });
  LART.crate = prop(outline(crate('#2a3320', '#46552f', '#63743f', '#d8dcc8'), P.out), 4);
  LART.gold = prop(outline(crate('#7a5a1c', '#c9952f', '#f0c85a', '#fff1c2'), P.out), 4);
  // a school bus seen from above and the side, rusty, its windows dark
  LART.bus = prop(pix(40, 16, (r) => {
    r(4, 12, 5, 4, '#101012'); r(30, 12, 5, 4, '#101012');
    r(0, 5, 40, 9, '#b88a22'); r(0, 5, 40, 1, '#e3b04b'); r(0, 13, 40, 1, '#5e4410'); r(0, 5, 1, 9, '#e3b04b');
    r(1, 0, 38, 6, '#d9a636'); r(1, 0, 38, 1, '#f0c85a'); r(38, 1, 1, 5, '#8a6418');
    for (let x = 3; x < 37; x += 5) r(x, 7, 3, 3, '#1a1c20');
    r(0, 10, 40, 1, '#2a2420'); r(37, 7, 2, 3, '#d8cfb6');
    r(12, 1, 6, 2, '#8a5a1c'); r(26, 3, 5, 2, '#6a3a18'); r(5, 11, 3, 2, '#6a3a18');
  }), 10);
}
lootArt();
for (const d of Object.values(LART)) { atl(d.spr); atl(d.sh); }
const RESCUEART = { n: SURV[2].n, h: SURV[2].h, sh: shadowSpr(7), ax: SURV[2].n.width >> 1, ay: SURV[2].n.height - 1 };
atl(RESCUEART.n); atl(RESCUEART.h); atl(RESCUEART.sh);

// A point px from the rails at km k, on side (1 east, -1 west): {x, y, s}
function lootBeside(k, px, side) {
  const s = sAtKm(k), y = yOfS(s), fp = trackSlope(y), c = 1 / Math.sqrt(1 + fp * fp);
  return { x: Math.round(trackX(y) + c * px * side), y: Math.round(y - fp * c * px * side), s };
}
// Tell the tutorial (when it is built in).
function lootTut(name, data) {
  if (typeof tutEvent === 'function') tutEvent(name, data || {});
}
// A find of kind 'pile', 'crate', 'gold' or 'sos' at km k: its props stand in G.statics.
function addFind(kind, k, px, side, pay) {
  const p = lootBeside(k, px, side), f = { kind, km: k, off: px, side, x: p.x, y: p.y, s: p.s, pay, gone: false, seen: false, t: Math.random() * 6, props: [] };
  const put = (d, x, y) => {
    const o = { d, x: Math.round(x), y: Math.round(y), k: Math.round(y) };
    G.statics.push(o);
    f.props.push(o);
    return o;
  };
  if (kind === 'pile') {
    put(Math.random() < 0.5 ? PROPS.wreck[(Math.random() * PROPS.wreck.length) | 0] : PROPS.burnt[0], f.x - 9 * side, f.y - 3);
    f.top = put(LART.heap, f.x, f.y);
  } else if (kind === 'crate') {
    // a burnt farm: broken walls, a burnt car, a barrel
    put(PROPS.wall[0], f.x - 24, f.y - 14);
    put(PROPS.wall[3], f.x + 20, f.y - 18);
    put(PROPS.wall[5], f.x - 30, f.y + 12);
    put(PROPS.burnt[1], f.x + 26, f.y + 8);
    put(PROPS.barrel[0], f.x + 12, f.y - 6);
    f.top = put(LART.crate, f.x, f.y);
    f.zs = [];
  } else if (kind === 'gold') {
    f.top = put(LART.gold, f.x, f.y);
    f.rewardId = 'gold-crate';
  } else {
    f.ground = true;
    f.stage = 'wait';
    f.w = f.u = 0;
    f.saved = false;
  }
  G.loot.push(f);
  return f;
}
// Reset finds for a new leg; its timeline creates the drops as events fire.
function rollLoot() {
  G.loot = [];
  G.lootFly = [];
  G.rescueCarryDone = false;
}
// A timeline drop starts beside the rails, then its whole prop group stays inside the usable view.
// Defaults for forward distance, side offset and viewport margins are placement proposals.
function addLegLoot(kind, params = {}, eventId = '') {
  if (kind === 'goldCrate') kind = 'gold';
  if (!G || G.demo || G.result || mode !== 'play' || !['pile', 'crate', 'gold', 'sos'].includes(kind)) return null;
  if (!params || typeof params !== 'object') params = {};
  const num = (key, fallback) => Number.isFinite(params[key]) ? params[key] : fallback;
  const id = typeof eventId === 'string' && eventId ? eventId : 'leg-' + G.leg + '-' + kind + '-' + G.loot.length;
  const old = G.loot.find((f) => f.eventId === id);
  if (old) return old;
  const c = LEGLOOTC, ahead = clamp(num('ahead', c.ahead), 0, c.maxAhead);
  const off = clamp(num('off', c.off), c.minOff, Math.min(c.maxOff, W * c.widthFrac));
  const side = num('side', 1) < 0 ? -1 : 1, s = clamp(G.tr.s - ahead, G.goalS + c.goalPad, G.tr.startS - c.startPad);
  const pay = kind === 'sos' ? 0 : kind === 'gold' ? LOOT.gold.pay : Math.max(0, Math.floor(num('pay', LOOT[kind].pay)));
  const f = addFind(kind, kmAt(s), off, side, pay);
  const x = Math.round(clamp(f.x, G.camX + c.viewX, G.camX + W - c.viewX));
  const y = Math.round(clamp(f.y, G.camY + c.viewTop, G.camY + VH - c.viewBottom)), dx = x - f.x, dy = y - f.y;
  for (const o of f.props) { o.x += dx; o.y += dy; o.k = o.y; }
  f.x = x; f.y = y; f.eventId = id;
  const local = trackLocal(x, y, {});
  f.s = local.a; f.km = kmAt(local.a); f.off = Math.abs(local.u); f.side = local.u < 0 ? -1 : 1;
  return f;
}
// Stable rescue receipts are global to the route, unlike per-leg gold receipts. Queue at spawn so
// a loss or a fast arrival cannot discard somebody; the next live leg positions them after camera setup.
function addLegRescue(params = {}, eventId = '') {
  if (!G || G.demo || G.replay || G.result || mode !== 'play') return null;
  if (!params || typeof params !== 'object') params = {};
  const id = params.id;
  if (!RESCUE_IDS.includes(id) || SAVE.rescues.includes(id)) return null;
  const old = G.loot.find((f) => f.rescueId === id);
  if (old) return old;
  const f = addLegLoot('sos', params, eventId);
  if (!f) return null;
  f.rescueId = id;
  f.carried = params.carried === true;
  if (!SAVE.rescueDue.includes(id)) { SAVE.rescueDue.push(id); saveSave(); }
  return f;
}
function carryRescues() {
  if (G.rescueCarryDone || G.demo || G.replay || G.result || mode !== 'play') return;
  G.rescueCarryDone = true;
  const due = SAVE.rescueDue.slice();
  let i = 0;
  for (const id of due) {
    if (!RESCUE_IDS.includes(id) || SAVE.rescues.includes(id)) continue;
    addLegRescue({ id, carried: true, ahead: RESCUEC.carryAhead + i * RESCUEC.carryStep,
      off: RESCUEC.carryOff + i * RESCUEC.carryStep / 2, side: i % 2 ? -1 : 1 }, 'leg-' + G.leg + '-carry-' + id);
    i++;
  }
}
function claimRescue(id) {
  if (!G || G.demo || G.replay || G.result || !RESCUE_IDS.includes(id) || SAVE.rescues.includes(id)) return false;
  SAVE.rescues.push(id);
  SAVE.rescueDue = SAVE.rescueDue.filter((due) => due !== id);
  SAVE.flags.sos = true;
  G.surv++;
  bankRun();
  return true;
}
// Called only by the actual Terminus arrival, before its won result. This also catches original
// rescue events skipped by a very fast ride, so all three designed survivors remain attainable.
function rescueCamp() {
  if (!G || G.demo || G.replay || G.result || G.leg !== 12 || mode !== 'play') return 0;
  let n = 0;
  for (const id of RESCUE_IDS) if (claimRescue(id)) n++;
  if (n) {
    const h = G.helis[0];
    floatText(h.x, h.y - h.alt, '+' + n + ' SURVIVOR' + (n === 1 ? '' : 'S'), U.amber);
    SFX.saved();
  }
  return n;
}
// The middle of the view (less the camera's lead): how far the edge arrows reach is counted from it
const LG = [0, 0];
function heliGround() {
  LG[0] = G.camX + W / 2 - G.lead[0];
  LG[1] = G.camY + VH / 2 - G.lead[1];
  return LG;
}
// The heli nearest find f, and how far its ground point is from it: [heli, px]
function lootHeli(f) {
  let best = null, bd = 1e9;
  for (const h of G.helis) {
    const d = Math.hypot(f.x - h.x, f.y - h.y);
    if (d < bd) { bd = d; best = h; }
  }
  return [best, bd];
}

// ---------- each step
function updateLoot(dt) {
  if (!G.loot) return;
  const live = mode === 'play' && !G.result;
  if (live) carryRescues();
  for (const f of G.loot) {
    if (f.gone && f.kind !== 'sos') continue;
    f.t += dt;
    const [h, d] = lootHeli(f);
    if (!f.seen && live && (!offView(f.x, f.y, -12) || (f.kind !== 'pile' && d < (LOOT[f.kind].arrow || 0)))) {
      f.seen = true;
      lootTut(f.kind === 'gold' ? 'gold_crate_seen' : f.kind + '_seen', { x: f.x, y: f.y, rescueId: f.rescueId });
    }
    if (f.kind === 'crate') crateStep(f, d, dt);
    if (f.kind === 'sos') {
      sosStep(f, d, dt, live, h);
      continue;
    }
    if (live && d <= G.up.pickup) takeLoot(f, h);
  }
  // Finds finish their pickup flight; golden crates already banked their reward at pickup.
  for (let i = G.lootFly.length - 1; i >= 0; i--) {
    const q = G.lootFly[i];
    q.t += dt;
    if (q.t >= q.T) {
      G.lootFly.splice(i, 1);
      if (q.f) lootPaid(q.f, q.h);
    }
  }
}
// A find is taken by heli h: it flies up to it (the pile's heap or the crate leaves the ground).
function takeLoot(f, h) {
  if (!f || f.gone || f.kind === 'sos') return;
  f.gone = true;
  // Bank once at real pickup; the following flight is cosmetic even if the run ends meanwhile.
  if (f.kind === 'gold') f.reward = payGold(f.rewardId, LOOT.gold.pay, LOOT.gold.scrap);
  const i = G.statics.indexOf(f.top);
  if (i >= 0) G.statics.splice(i, 1);
  G.lootFly.push({ f, h: h || G.helis[0], spr: f.top.d, x0: f.x, y0: f.y, t: 0, T: LOOT.fly });
  juicePop(f.x, f.y, f.kind !== 'pile');
  SFX.lootUp();
}
// It reached heli h: pay scrap or display the banked gold receipt, a chime and counter coins.
function lootPaid(f, h) {
  const gx = h.x, gy = h.y - h.alt + 14, big = f.kind !== 'pile';
  const reward = f.kind === 'gold' ? f.reward || { gold: 0, scrap: 0 } : null;
  const pay = reward ? reward.scrap : payLootScrap(f.pay);
  if (pay > 0) addTotal(gx, gy - 14, pay, U.blue, scrapPopScale(big));
  if (reward?.gold > 0) addTotal(gx, gy - 14, reward.gold, U.gold, 2);
  coinPop(gx, gy, f.kind === 'gold' ? 16 : big ? 8 : 4);
  const n = f.kind === 'gold' ? 14 : big ? 7 : 4;
  if (reward?.gold > 0) currencyCoins('gold', gx, gy, n);
  else if (pay > 0) currencyCoins('scrap', gx, gy, n);
  if (f.kind === 'gold') {
    SFX.golden();
    for (let k = 0; k < 26; k++) part({ x: gx, y: gy, z: 12, vx: rnd(-50, 50), vy: rnd(-30, 30), vz: rnd(30, 90), g: 160, life: rnd(0.6, 1.1), max: 1.1, s: 1,
      c: pick(['#ffd36a', '#fff1c2', '#e3b04b']), add: true, drag: 1 });
    rings.push({ x: gx, y: gy, r0: 4, r1: 40, t: 0, T: 0.45, c: '#ffd36a', w: 2 });
  } else if (f.kind === 'crate') SFX.crate();
  else SFX.coin();
  lootTut(f.kind === 'gold' ? 'gold_crate_taken' : f.kind + '_taken',
    reward ? { id: f.rewardId, eventId: f.eventId, gold: reward.gold, scrap: pay, pay } : { pay });
}
// The guards: placed when the train comes near, standing still until the heli is close (or one of
// them is shot).
function crateStep(f, d, dt) {
  const ds = G.tr.s - f.s;
  if (!f.placed && ds < LOOT.crate.place && ds > -300) {
    f.placed = true;
    for (let k = 0; k < LOOT.crate.guards; k++) {
      const a = k / LOOT.crate.guards * TAU + rnd(-0.3, 0.3), r = rnd(16, 32);
      const z = makeZombie(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * FORE, 0);
      z.still = true;
      z.sp = rnd(5, 7);
      z.guard = true;
      G.zombies.push(z);
      f.zs.push(z);
    }
  }
  if (f.placed && !f.awake && (d < LOOT.crate.wake || f.zs.some((z) => z.dead || z.flash > 0))) {
    f.awake = true;
    for (const z of f.zs) z.still = false;
  }
  // a column of green smoke while it is near the view
  if (!f.gone && Math.abs(f.x - G.camX - W / 2) < W && Math.abs(f.y - G.camY - VH / 2) < VH) {
    f.smoke = (f.smoke || 0) - dt;
    if (f.smoke <= 0) {
      f.smoke = 0.12;
      part({ x: f.x + rnd(-1, 1), y: f.y - 2, z: 7, vx: rnd(-1.5, 1.5) + 2, vy: 0, vz: rnd(20, 26), g: 0, life: rnd(1.8, 2.3), max: 2.3, s: 2,
        c: pick(['rgba(120,230,110,0.62)', 'rgba(90,190,90,0.55)']), grow: 3, drag: 0.45, smoke: true });
    }
  }
}
// The stranded survivor: a flare every 6 s. The built-in winch needs about 2 s of hovering
// (leaving starts it again). Bank +1 immediately, then let the rope and lift finish cosmetically.
function sosStep(f, d, dt, live, h) {
  if (f.stage === 'done') return;
  if (f.stage === 'wait') {
    if (f.t >= 6) {
      f.t = 0;
      if (Math.abs(f.x - G.camX - W / 2) < W * 1.5 && Math.abs(f.y - G.camY - VH / 2) < VH * 1.5) SFX.flare();
    }
    if (live && !G.replay && G.up.winch && h && d <= LOOT.sos.reach) {
      if (f.h && f.h !== h) f.w = 0;
      f.h = h;
      f.w += dt;
      if (f.w >= CFG.winch.hover - 1e-9 && claimRescue(f.rescueId)) {
        f.saved = true;
        f.stage = 'rope';
        f.u = 0;
        SFX.winch();
        SFX.saved();
        floatText(h.x, h.y - h.alt, '+1 SURVIVOR', U.amber);
        lootTut('sos_lifted', { id: f.rescueId, x: f.x, y: f.y });
      }
    } else f.w = 0;
    return;
  }
  f.u += dt;
  if (f.stage === 'rope' && f.u >= RESCUEC.rope) {
    f.stage = 'lift';
    f.u = 0;
  } else if (f.stage === 'lift' && f.u >= RESCUEC.lift) {
    f.stage = 'done';
    f.gone = true;
    const q = f.h;
    G.lootFly.push({ surv: true, x0: q.x - G.camX, y0: q.y - q.alt - G.camY + 8, t: 0, T: RESCUEC.icon });
  }
}

// ---------- drawing (world layer, after everything on the ground)
function drawLoot() {
  if (!G.loot) return;
  const [gx, gy] = heliGround(), x0 = G.camX - 60, x1 = G.camX + W + 60, y0 = G.camY - 40, y1 = G.camY + VH + 120;
  for (const f of G.loot) {
    if (f.x < x0 || f.x > x1 || f.y < y0 || f.y > y1) continue;
    if (f.kind === 'pile' && !f.gone) {
      // a white glint every 1.2 s
      const u = (realT + f.km * 7) % 1.2;
      if (u < 0.24) {
        const a = u < 0.08 || u > 0.16 ? 2 : 3, x = f.x + 1, y = f.y - 7;
        ctx.globalCompositeOperation = 'lighter';
        light(x, y, 7, '#fff1c2', 0.5);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - a, y, a * 2 + 1, 1);
        ctx.fillRect(x, y - a, 1, a * 2 + 1);
      }
    } else if (f.kind === 'gold' && !f.gone) {
      // a beam of gold light up from the crate
      const p = 0.75 + Math.sin(realT * 3) * 0.25;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffd36a';
      for (let z = 0; z < 120; z += 2) {
        const k = 1 - z / 120;
        ctx.globalAlpha = 0.22 * k * p;
        ctx.fillRect(f.x - 3, f.y - 8 - z, 7, 2);
        ctx.globalAlpha = 0.45 * k * p;
        ctx.fillRect(f.x - 1, f.y - 8 - z, 3, 2);
      }
      light(f.x, f.y - 5, 20, '#ffd36a', 0.55 * p);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if ((realT * 2 | 0) % 2 === 0) text('GOLD', f.x, f.y - 26, '#ffd36a', { align: 'center' });
    } else if (f.kind === 'sos' && f.stage !== 'done') drawSOS(f, gx, gy);
  }
  // finds flying up to the heli that took them
  for (const q of G.lootFly) {
    if (q.surv) continue;
    const u = q.t / q.T, e = u * u, x = lerp(q.x0, q.h.x, e), y = lerp(q.y0, q.h.y - q.h.alt + 6, e);
    ctx.globalAlpha = 1 - u * 0.6;
    blit(q.spr.spr, Math.round(x - q.spr.ax), Math.round(y - q.spr.ay));
    ctx.globalAlpha = 1;
  }
}
// A ground survivor waving in a field, their flare, Winch circle and rope. Art is already cached.
function drawSOS(f, gx, gy) {
  const sv = RESCUEART, wave = (realT * 4 | 0) % 2;
  // the flare: up fast, then it hangs and falls slowly, red and bright
  if (f.stage === 'wait' && f.t < 3.2) {
    const t = f.t, z = t < 0.6 ? t / 0.6 * 80 : 80 - (t - 0.6) * 9, a = t < 2.6 ? 1 : (3.2 - t) / 0.6;
    ctx.globalCompositeOperation = 'lighter';
    light(f.x + 2, f.y - RESCUEC.hand - z, 26, '#ff4a32', 0.8 * a);
    light(f.x + 2, f.y - RESCUEC.hand - z, 5, '#fff1c2', 0.9 * a);
    ctx.fillStyle = '#ff6a4a';
    for (let k = 4; k < Math.min(z, 40); k += 3) {
      ctx.globalAlpha = 0.35 * a * (1 - k / 40);
      ctx.fillRect(Math.round(f.x + 2), Math.round(f.y - RESCUEC.hand - z + k), 1, 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (t < 0.6 && Math.random() < 0.5) part({ x: f.x + 2, y: f.y, z: RESCUEC.hand + z, vx: rnd(-3, 3), vy: 0, vz: 0, g: 0, life: 0.8, max: 0.8, s: 1,
      c: 'rgba(200,190,180,0.5)', grow: 2, drag: 1, smoke: true });
  }
  // the Winch circle on the ground round the survivor: it fills while a heli hovers in it
  const [hh, near] = lootHeli(f);
  if (f.stage === 'wait' && G.up.winch && near < 90) {
    const R = LOOT.sos.reach, n = 40, fill = f.w / CFG.winch.hover;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU - Math.PI / 2;
      ctx.fillStyle = i / n < fill ? '#ffffff' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(Math.round(f.x + Math.cos(a) * R), Math.round(f.y + Math.sin(a) * R * FORE), 1, 1);
    }
    if (fill > 0) text(Math.round(fill * 100) + '%', f.x, f.y + 12, '#ffffff', { align: 'center' });
  }
  // Their feet stand on the ground until they grab the rope from the heli's belly.
  let sx = f.x + 2, sy = f.y;
  const lh = f.h || hh, ax = Math.round(lh.x), ay = Math.round(lh.y - lh.alt + 2);
  if (f.stage === 'lift') {
    const u = ease(f.u / RESCUEC.lift);
    sx = lerp(f.x + 2, ax, u) + Math.sin(f.u * 5) * 10 * (1 - u);
    sy = lerp(f.y, ay + sv.ay, u);
  }
  ctx.globalAlpha = (thermal ? 0.2 : 0.32) * (f.stage === 'lift' ? 1 - clamp(f.u / RESCUEC.lift, 0, 1) : 1);
  blit(sv.sh, Math.round(f.x + 2 - sv.sh.width / 2), Math.round(f.y - sv.sh.height / 2));
  ctx.globalAlpha = 1;
  if (f.stage === 'rope' || f.stage === 'lift') {
    const e = f.stage === 'rope' ? Math.min(1, f.u / RESCUEC.rope) : 1;
    pl(ctx, ax, ay, Math.round(lerp(ax, sx, e)), Math.round(lerp(ay, sy - sv.ay, e)), '#d6cdb6');
    ctx.fillStyle = '#8b919c';
    ctx.fillRect(ax - 1, ay - 1, 3, 2);
  }
  blit(thermal ? sv.h : sv.n, Math.round(sx - sv.ax), Math.round(sy - sv.ay));
  // an arm waving (or holding the rope)
  ctx.fillStyle = '#d8cfb6';
  if (f.stage === 'wait') ctx.fillRect(Math.round(sx - 3), Math.round(sy - RESCUEC.hand + wave), 1, 3);
  else ctx.fillRect(Math.round(sx), Math.round(sy - RESCUEC.hand), 1, 2);
  if (f.stage === 'wait') {
    const blink = (realT * 2 | 0) % 2 === 0;
    text('SOS', f.x + 2, f.y - RESCUEC.label, blink ? '#ffffff' : U.red, { align: 'center' });
    if (near < 90 && f.w <= 0) text('HOVER HERE', f.x + 2, f.y + 14, '#ffffff', { align: 'center' });
  }
}

// ---------- the HUD: radar dots, edge arrows, the survivor icon flying to the counter
function lootRadar(dot) {
  if (!G.loot) return;
  const blink = (realT * 3 | 0) % 2 === 0;
  for (const f of G.loot) {
    if (f.gone || f.saved) continue;
    if (f.kind === 'pile') dot(f.x, f.y, '#7a6330', 1);
    else if (f.kind === 'crate') dot(f.x - 1, f.y - 1, '#5fd16a', 2);
    else if (f.kind === 'gold') { if (blink) dot(f.x - 1, f.y - 1, '#ffd84a', 2); }
    else if (!blink) dot(f.x - 1, f.y - 1, '#ffffff', 2);
  }
}
function drawLootUI() {
  if (!G.loot) return;
  const [gx, gy] = heliGround();
  if (!G.result) for (const f of G.loot) {
    if (f.gone || f.saved) continue;
    const d = Math.hypot(f.x - gx, f.y - gy);
    if (f.kind === 'crate' && d < LOOT.crate.arrow) edgeArrow(f.x, f.y - 4, '#7fe07f', 'CRATE ' + Math.round(d / 2 / 10) * 10 + 'M');
    else if (f.kind === 'gold' && d < LOOT.gold.arrow) edgeArrow(f.x, f.y - 4, '#ffd36a', 'GOLD');
    else if (f.kind === 'sos' && d < LOOT.sos.arrow) edgeArrow(f.x, f.y - 10, (realT * 2 | 0) % 2 ? '#ffffff' : U.red, 'SOS');
  }
  // the lifted survivor's icon flies to the survivor counter (top left)
  for (const q of G.lootFly) {
    if (!q.surv) continue;
    const u = ease(q.t / q.T);
    const target = currencyX('surv');
    if (target !== null) blit(ICON.surv, Math.round(lerp(q.x0, target - ICON.surv.width / 2, u)), Math.round(lerp(q.y0, 5, u) - Math.sin(u * Math.PI) * 24));
  }
}

// ---------- sounds
Object.assign(SFX, {
  lootUp() {
    // a find whooshes up to the heli
    tone(420, 0.22, 'sine', 0.03, 1250);
    nz(0.2, 0.02, 'bandpass', 900, 1.2, 3000);
  },
  crate() {
    // a supply crate: a wooden thump and two bright notes
    nz(0.12, 0.07, 'lowpass', 500, 0.8, 120);
    tone(784, 0.12, 'triangle', 0.035);
    tone(1175, 0.22, 'triangle', 0.035, null, 0.08);
  },
  golden() {
    // the golden crate: a rising run of chimes
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.04, null, i * 0.07));
    nz(0.5, 0.02, 'highpass', 6000, 0.7, null, 0.1);
  },
  winch() {
    // the winch motor whirs as the rope drops
    tone(160, 0.5, 'sawtooth', 0.018, 320);
    nz(0.5, 0.025, 'bandpass', 700, 2, 1400);
  },
  flare() {
    // a flare goes up: a pop and a hiss
    if (!gap('flare', 500)) return;
    tone(300, 0.06, 'square', 0.02, 90);
    nz(0.7, 0.02, 'highpass', 3500, 0.7, 1800);
  }
});

// ---------- test calls
Object.assign(window.__sr, {
  // loot(): this run's finds. lootGo(i): put the heli's ground point over find i (the radio range
  // still holds it back on the next step). lootTake(i): take find i at once. lootSpawn(kind): a find
  // of that kind (pile, crate, gold, sos) right under the heli.
  loot: () => (G.loot || []).map((f, i) => ({ i, kind: f.kind, eventId: f.eventId || null, km: f.km, s: f.s,
    off: f.off * f.side, x: f.x, y: f.y, pay: f.pay, rewardId: f.rewardId || null,
    reward: f.reward ? { ...f.reward } : null, gone: f.gone, seen: f.seen,
    stage: f.stage, w: f.w, u: f.u, rescueId: f.rescueId || null, saved: f.saved === true, carried: f.carried === true, ground: f.ground === true,
    placed: f.placed, awake: f.awake, guards: f.zs ? f.zs.filter((z) => !z.dead).length : 0 })),
  lootGo: (i) => {
    const f = G.loot[i], h = G.helis[0];
    h.x = f.x;
    h.y = f.y;
    h.vx = h.vy = 0;
    h.order = { kind: 'move', x: f.x, y: f.y };
  },
  lootTake: (i) => takeLoot(G.loot[i]),
  lootSpawn: (kind) => {
    const gx = G.helis[0].x, gy = G.helis[0].y;
    const f = kind === 'sos' ? addLegRescue({ id: RESCUE_IDS.find((id) => !SAVE.rescues.includes(id)) }, 'debug-rescue-' + G.loot.length) :
      addFind(kind, 0, 0, 1, kind === 'gold' ? LOOT.gold.pay : kind === 'crate' ? LOOT.crate.pay : LOOT.pile.pay);
    if (!f) return -1;
    const dx = gx + 30 - f.x, dy = gy - f.y;
    for (const o of f.props) { o.x += dx; o.y += dy; o.k = o.y; }
    f.x += dx;
    f.y += dy;
    f.s = G.tr.s;
    f.km = DK();
    return G.loot.indexOf(f);
  },
  lootStats: () => ({ loot: G.pay.loot, cash: Math.floor(G.cash), surv: G.surv, pickup: G.up.pickup, fly: G.up.fly, winch: G.up.winch,
    rescues: SAVE.rescues.slice(), due: SAVE.rescueDue.slice() })
});
