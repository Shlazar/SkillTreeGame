// test_f.js - small test helpers for the station-to-station game. Loaded after main creates __sr.
// QA-only plane injection is scoped to this G; it never writes saved ownership or slots.
let TEST_PLANE_FIXTURE = null;
function testVariantArt(sets) {
  const frames = [...new Set(sets.flatMap((S) => S.walk.flatMap((f) =>
    [f.n, f.nf, f.w, f.wf, f.h, f.hf, f.s, f.sf]).concat(
    [S.dead, S.deadH, S.tilt], S.spin, S.spinH, S.corpses, S.splats)))];
  return { sets: sets.length, frames: frames.length, atlas: frames.length > 0 && frames.every((f) => !!ATL.get(f)) };
}
function testWallView(w) {
  return w ? { id: w.id, eventId: w.eventId, leg: w.leg, s: w.s, km: w.km, x: w.x, y: w.y,
    sx: w.x - G.camX, sy: w.y - G.camY, hp: w.hp, max: w.max, state: w.state,
    spawnT: w.spawnT, stoppedAt: w.stoppedAt, brokenAt: w.brokenAt, stopS: w.stopS,
    broken: w.broken, rammed: w.rammed, hpIn: w.hpIn, hpOut: w.hpOut, lootId: w.lootId,
    hits: w.hits, damage: w.damage, lastHit: w.lastHit ? { ...w.lastHit } : null } : null;
}
function testClearPlaneFixture() {
  const before = TEST_PLANE_FIXTURE;
  if (!before) return false;
  PLANES.b2.available = before.b2Available;
  if (G === before.g && AIR.g === before.g) {
    G.up.planeOwned = before.owned;
    AIR.slots = before.slots;
    AIR.planes = before.planes;
    AIR.arm = AIR.aim = AIR.tap = null;
    syncViewHeight();
  }
  TEST_PLANE_FIXTURE = null;
  return true;
}
Object.assign(window.__sr, {
  incomeState: () => G ? { leg: G.leg, target: legDef(G.leg)?.scrapTarget || 0, ordinaryPay: G.killPay,
    scrap: Math.floor(G.cash), sources: { ...G.earnedSources }, base: { ...G.earnedBase }, counts: { ...G.earnedCounts },
    fractions: { ordinary: G.killAcc, silver: G.silverAcc, loot: G.lootAcc, wall: G.wallAcc } } : null,
  starState: () => {
    if (!G) return null;
    const record = SAVE.legs[G.leg], stars = record?.stars || [false, false, false];
    return { leg: G.leg, stars: stars.slice(), gold: [1, 2, 3].reduce((n, i) => n + (record?.paid['star-' + i] ? 3 : 0), 0),
      layout: starLayout(), atlas: !!ATL.get(ICON.star), popAt: G.starAt ? G.starAt.slice() : [] };
  },
  // Spawn counters and cached variant art, copied without exposing live sprite or target objects.
  variantState: () => {
    if (!G) return null;
    const s = variantStats();
    return { silverChance: legAllows('silver') ? G.up.silver : 0, boomChance: legAllows('boom') ? G.up.boom : 0,
      silverPay: SILVER_PAY, radius: G.up.boomR, damage: VARIANTC.damage, queued: BOOMS.length,
      silver: s.silver, boom: s.boom, blasts: s.blasts, hits: s.hits, kills: s.kills,
      lastBlast: s.lastBlast ? { ...s.lastBlast } : null,
      art: { silver: testVariantArt(ZS.flat().map((S) => S.silver)), boom: testVariantArt(BOOMSETS) },
      active: G.zombies.filter((z) => !z.dead && !z.gone && (z.silver || z.boom)).map((z) => ({
        x: z.x, y: z.y, sx: z.x - G.camX, sy: z.y - G.camY, type: z.type, hp: z.hp, max: z.max, st: z.st,
        silver: !!z.silver, boom: !!z.boom, dead: !!z.dead, gone: !!z.gone,
        streamEventId: z.streamEventId || null, streamIndex: z.streamIndex ?? null })) };
  },
  // QA-only controlled actors use the real converters, and respect their leg introductions.
  variantSpawn: (kind, sx, sy, type = 0) => {
    if (!G || G.demo || G.result || mode !== 'play' || !['normal', 'silver', 'boom'].includes(kind) ||
      !Number.isInteger(type) || type < 0 || type > 2 || ![sx, sy].every(Number.isFinite) ||
      sx < 0 || sx >= W || sy < 19 || sy >= VH || kind !== 'normal' && (type === 2 || !legAllows(kind))) return -1;
    const z = makeZombie(G.camX + sx, G.camY + sy, type);
    z.silver = z.boom = false; z.S = ZS[type][0]; z.value = CFG.types[type].value;
    if (kind === 'silver') makeSilver(z);
    if (kind === 'boom') makeExplosive(z);
    G.zombies.push(z); gridBuild();
    return G.zombies.length - 1;
  },
  // Golden event receipts and live chase positions, copied independently of actors and sprites.
  goldState: () => {
    if (!G) return null;
    const s = goldState(), sets = ZS.flat(), frames = sets.flatMap((S) => S.gold ? S.gold.flat() : []);
    return { events: s.events.map((e) => ({ ...e })), queue: s.queue.map((q) => ({ ...q })),
      active: G.zombies.filter((z) => z.gold && !z.dead && !z.gone).map((z) => ({
        itemId: z.goldItemId, primary: !!z.goldPrimary, x: z.x, y: z.y, sx: z.x - G.camX,
        sy: z.y - G.camY, hp: z.hp, dir: z.goldDir, lane: z.goldSY, type: z.type })),
      huntGoldPaid: Object.values(SAVE.legs).reduce((n, l) => n + Object.keys(l.paid || {}).filter((id) =>
        id.startsWith('golden-hunt-') && l.paid[id] === true).length, 0),
      art: { sets: sets.length, frames: frames.length, atlas: frames.length > 0 && frames.every((f) => !!ATL.get(f)) } };
  },
  // Actual wall state, with no live target or sprite references.
  wallState: () => G ? G.walls.map(testWallView) : [],
  // QA-only wall placement through the real event handler; does not change rewards or ownership.
  wallFixture: (params = {}) => {
    if (!G || G.demo || G.result || mode !== 'play' || !params || typeof params !== 'object') return false;
    const w = addDeadWall(params, typeof params.id === 'string' ? params.id : 'qa-wall-' + G.walls.length);
    return w ? testWallView(w) : false;
  },
  // Steam counters and the current curved train envelope; no mutable cloud state is exposed.
  steam: () => {
    if (!G) return null;
    const s = steamState(), reach = STEAMC.reachStep * G.up.steamReach;
    return { enabled: !!G.up.steamVent, damage: STEAMC.damage * G.up.steamDamage,
      interval: G.up.steamSpeed, reach, wallReach: STEAMC.wallReach, cloudReach: STEAMC.cloudBase + reach, hotCloud: G.up.hotCloud,
      cooldown: Math.max(0, s.next - heliWeaponTime()), bursts: s.bursts, hits: s.hits, kills: s.kills,
      cloudHits: s.cloudHits, cloudKills: s.cloudKills, lastBurst: s.lastBurst ? { ...s.lastBurst } : null,
      cloud: s.cloud ? { ...s.cloud } : null,
      envelope: { halfWidth: CAR.half, fore: FORE, segments: G.tr.cars.map((c) => ({
        ax: c.x1, ay: c.y1, bx: c.x0 + c.dx * 6, by: c.y0 + c.dy * 6 })) } };
  },
  // Seconds until the Ram can be used again; kills never change this clock.
  ramCd: () => G ? G.ram.cd : 0,
  // Copy the actual Ram state, card bounds and live shock rings without changing cooldowns.
  ramInfo: () => {
    if (!G) return null;
    const r = G.ram;
    return { state: ramState(), on: r.on, powered: ramPowered(), t: r.t,
      duration: r.dur, cooldown: r.cooldown, cd: r.cd, progress: ramProgress(),
      band: r.band, damage: r.damage, hits: r.hits, kills: r.kills, total: r.total, uses: r.uses,
      shocks: r.shocks, shockKills: r.shockKills, lastShock: r.lastShock ? { ...r.lastShock } : null,
      card: { ...RAMCARD }, rings: rings.filter((v) => v.source === 'ramShock').map((v) => ({ ...v })) };
  },
  // QA comparison of the ordinary and crowded pixel-effect drawing paths.
  fxPixels: (on) => { FXPIX.force = on == null ? null : !!on; return FXPIX.force; },
  // Compare only normal effects over a fixed opaque background; restore every live effect list.
  fxPixelCase: (kind = 'opaque', frame = 0, background = '#000000') => {
    if (!G || !['opaque', 'alpha', 'dense', 'real'].includes(kind)) return false;
    frame = Math.max(0, Math.floor(Number(frame) || 0));
    const keepParts = parts.slice(), keepBooms = booms.slice(), force = FXPIX.force, random = Math.random;
    const canvasBefore = ctx.getImageData(0, 0, W, H);
    const capture = (pixels) => {
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
        ctx.beginPath(); ctx.rect(0, 0, W, VH); ctx.clip();
        const [sx, sy] = shakeOff();
        ctx.translate(sx - G.camX, sy - G.camY); FXPIX.force = pixels; drawNormalFx(true);
        return ctx.getImageData(0, 0, W, H).data;
      } finally { ctx.restore(); }
    };
    try {
      if (kind !== 'real') {
        parts.length = booms.length = 0; Math.random = mulberry(0xF410);
        const opaque = kind === 'opaque', count = kind === 'dense' ? 500 : 48;
        const palette = opaque ? ['#ffffff', '#000000', '#4c4032', '#c2401a', '#ffd25a'] :
          ['rgba(196,38,28,0.6)', 'rgba(96,92,88,0.7)', 'rgba(124,120,114,0.6)', 'rgba(76,72,68,0.7)'];
        for (let i = 0; i < count; i++) {
          const edge = i < 12, x = edge ? [-0.5, 0.5, W - 0.5, W + 0.5][i % 4] : W * 0.48 + (i % 11 - 5) * 5.5;
          const y = edge ? [0.5, VH - 0.5, VH + 0.5][Math.floor(i / 4)] : VH * 0.5 + (i % 7 - 3) * 4.5;
          const smoke = i % 3 !== 0, size = smoke ? [5, 9, 48, 49][i % 4] : 1 + i % 8;
          parts.push({x: G.camX + x + frame * (i % 2 ? 0.7 : -0.45),
            y: G.camY + y + frame * 0.2, z: i % 4 + frame * 0.12,
            life: opaque ? 2 : Math.max(0.15, 1.7 - frame / 90), max: 2,
            s: size + (smoke ? frame * 0.05 : 0), c: palette[i % palette.length], smoke, add: false});
        }
        const n = kind === 'dense' ? 18 : 4;
        for (let i = 0; i < n; i++) {
          addBoom(G.camX + W * 0.53 + (i % 3 - 1) * 9 + frame * 0.3,
            G.camY + VH * 0.52 + (i % 4 - 1) * 6, i % 2 ? 44 : 18, 7, 1, i % 2 ? 20 : 8);
          booms[booms.length - 1].t = opaque ? (i % 2 ? 0.22 + frame / 2000 : frame / 1200) : 0.73 + frame / 300;
        }
      }
      Math.random = random;
      const original = capture(false), pixels = capture(true), repeated = capture(false);
      const histogram = new Array(256).fill(0), bounds = {x0: W, y0: H, x1: -1, y1: -1};
      let max = 0, sum = 0, changed = 0, changedPixels = 0, unstable = 0, worst = null;
      for (let i = 0; i < original.length; i += 4) {
        let pixelChanged = false;
        for (let c = 0; c < 4; c++) {
          const d = Math.abs(original[i + c] - pixels[i + c]); histogram[d]++; sum += d;
          if (d) { changed++; pixelChanged = true; }
          if (d > max) { max = d; worst = {x: (i / 4) % W, y: Math.floor(i / 4 / W),
            old: Array.from(original.slice(i, i + 4)), pixels: Array.from(pixels.slice(i, i + 4))}; }
          if (original[i + c] !== repeated[i + c]) unstable++;
        }
        if (pixelChanged) {
          changedPixels++; const x = (i / 4) % W, y = Math.floor(i / 4 / W);
          bounds.x0 = Math.min(bounds.x0, x); bounds.y0 = Math.min(bounds.y0, y);
          bounds.x1 = Math.max(bounds.x1, x); bounds.y1 = Math.max(bounds.y1, y);
        }
      }
      return {kind, frame, background, max, mean: sum / original.length, meanChanged: changed ? sum / changed : 0,
        changed, changedPixels, unstable, histogram: histogram.map((n, d) => [d, n]).filter(v => v[1]),
        bounds: changedPixels ? bounds : null, worst, parts: parts.length, booms: booms.length};
    } finally {
      Math.random = random; FXPIX.force = force;
      parts.length = booms.length = 0; parts.push(...keepParts); booms.push(...keepBooms);
      ctx.putImageData(canvasBefore, 0, 0);
    }
  },
  // Read the world-space railway centre for controlled moving-stream scenarios.
  railX: (worldY) => Number.isFinite(worldY) ? railX(worldY) : null,
  // Compare the same frozen picture with one effect group hidden, then restore every object.
  costFx: (n = 30) => {
    const groups = { parts, booms, burn: BURN, lights, rings, coins, embers: STRAF.embers,
      gibs: JUICE.gibs, debris: JUICE.debris, bodies: G.bodies };
    const out = { full: +window.__sr.bench(n).toFixed(2), without: {} };
    for (const [key, list] of Object.entries(groups)) {
      const keep = list.slice();
      list.length = 0;
      try { out.without[key] = +window.__sr.bench(n).toFixed(2); }
      finally { list.push(...keep); }
    }
    const saved = Object.values(groups).map((list) => [list, list.slice()]);
    for (const [list] of saved) list.length = 0;
    try { out.without.all = +window.__sr.bench(n).toFixed(2); }
    finally { for (const [list, keep] of saved) list.push(...keep); }
    return out;
  },
  // Copy Hangar state; the action helper goes through real pointer input and ordinary UI frames.
  hangar: () => hangarState(),
  hangarDrag: (id, slot) => {
    const state = hangarState(), card = state.layout.cards.find((c) => c.id === id);
    const target = state.layout.slots.find((s) => s.slot === slot);
    if (mode !== 'depot' || depotTab !== 'hangar' || !state.visible || !card || !target) return false;
    const emit = (type, x, y, buttons) => {
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent(type, { bubbles: true, button: type === 'pointermove' ? -1 : 0,
        buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + x / W * r.width, clientY: r.top + y / H * r.height }));
      oneFrame(STEP);
    };
    emit('pointerdown', card.x + card.w / 2, card.y + card.h / 2, 1);
    emit('pointermove', target.x + target.w / 2, target.y + target.h / 2, 1);
    emit('pointerup', target.x + target.w / 2, target.y + target.h / 2, 0);
    return hangarState().slots[slot] === id;
  },
  // The band's rectangle is in game px, including its full canvas and world heights.
  planeBand: () => ({ visible: planeBandVisible(), x: 0, y: VH, w: W, h: H - VH, worldHeight: VH, fullHeight: H, slots: airBandSlots() }),
  // Copy plane resources and aiming state; strikes use the same path as input.
  planes: () => airSnapshot(),
  planeAim: () => airAimSnapshot(),
  strike: (key, sx, sy, ang) => airStrike(key, sx, sy, ang),
  smart: (key) => airSmart(key),
  // QA-only ready slot, for real key/pointer previews and launches with the production AIR path.
  planeFixture: (id, slot = 0) => {
    if (!G || G.demo || mode !== 'play' || G.result || !['a10', 'f4', 'b52', 'b2'].includes(id) || !Number.isInteger(slot) || slot < 0 || slot > 1) return false;
    if (TEST_PLANE_FIXTURE && TEST_PLANE_FIXTURE.g !== G) testClearPlaneFixture();
    airSync();
    if (!TEST_PLANE_FIXTURE) {
      TEST_PLANE_FIXTURE = { g: G, owned: G.up.planeOwned.slice(), slots: AIR.slots.slice(), b2Available: PLANES.b2.available,
        planes: Object.fromEntries(Object.entries(AIR.planes).map(([key, p]) => [key, { ...p, lastStrike: p.lastStrike ? { ...p.lastStrike } : null }])) };
    }
    if (!G.up.planeOwned.includes(id)) G.up.planeOwned.push(id);
    const from = AIR.slots.indexOf(id), replaced = AIR.slots[slot];
    if (from >= 0 && from !== slot) AIR.slots[from] = replaced;
    AIR.slots[slot] = id;
    const desc = PLANES[id], cd = G.up.planeCooldown[id], charges = G.up.planeCharges[id];
    const maxCharges = Number.isFinite(charges) ? clamp(Math.floor(charges), 1, 2) : 1;
    AIR.planes[id] = { maxCd: Number.isFinite(cd) ? clamp(cd, desc.floor, desc.cooldown) : desc.cooldown,
      maxCharges, charges: maxCharges, cd: 0, strikes: 0, lastStrike: null, readyAt: realT - AIRCFG.returnTime };
    if (id === 'b2') PLANES.b2.available = true;
    AIR.arm = AIR.aim = AIR.tap = null;
    syncViewHeight();
    return true;
  },
  // Restore the pre-fixture AIR resources and descriptor; flights already launched keep flying.
  clearPlaneFixture: () => testClearPlaneFixture(),
  // Launch the real B-2 transport for strike checks; no ownership, slot or charge is changed.
  b2Strike: (sx, sy, ang) => {
    if (!G || G.demo || mode !== 'play' || G.result || ![sx, sy].every(Number.isFinite) || ang != null && !Number.isFinite(ang)) return false;
    if (sx < 0 || sx >= W || sy < 19 || sy >= VH) return false;
    const [ux, uy] = ang == null ? strafeDir(sx, sy, sx, sy) : [Math.cos(ang), Math.sin(ang)];
    return launchPlane('b2', G.camX + sx, G.camY + sy, ux, uy);
  },
  // Copy the actual B-2 core and shockwave effects while they are alive.
  b2Fx: () => ({
    cores: booms.filter((b) => b.source === 'b2').map((b) => ({ x: b.x, y: b.y, r: b.r, cap: b.cap, t: b.t, T: b.T })),
    rings: rings.filter((r) => r.source === 'b2').map((r) => ({ x: r.x, y: r.y, r0: r.r0, r1: r.r1, t: r.t, T: r.T }))
  }),
  // Copied strike-show geometry keeps the flight, marker and shadow testable after each step.
  planeShow: () => {
    if (!G) return null;
    srSync();
    return {
      marks: STRAF.marks.map((m) => ({ x: m.x, y: m.y, age: m.age, T: m.T, radius: m.radius })),
      jets: STRAF.jets.map((j) => {
        const [x, y] = jetGround(j), sprite = planeArt(j).n[jetIdx(j)];
        const shadowX = x + j.alt * SUNX, shadowY = y + j.alt * SUNY;
        return { id: j.id, len: j.len, x, y, screenX: x - G.camX, screenY: y - j.alt - G.camY,
          shadowX, shadowY, shadowScreenX: shadowX - G.camX, shadowScreenY: shadowY - G.camY,
          spriteW: sprite.width, spriteH: sprite.height, alt: j.alt, delay: j.delay, age: j.age,
          shadowSeen: j.shadowSeen, shadowAge: j.shadowAge, bodyReady: j.bodyReady,
          bodyVisible: j.bodyReady && jetBodyInView(j), shadowVisible: j.delay <= 0 && jetShadowInView(j),
          roared: j.roared, fired: j.fired, s: j.s, end: j.end, ux: j.ux, uy: j.uy, dmg: j.dmg, half: j.half,
          lines: j.lines, offsets: j.offsets ? j.offsets.slice() : [], bombCount: j.bombCount, dropped: j.dropped,
          fireDamage: j.fireDamage, fireDuration: j.fireDuration, fireWall: j.fireWall,
          patchRadius: j.patchRadius, patchStep: j.patchStep, patchCount: j.patchCount,
          patches: j.patches, patchNext: j.patchNext,
          bombsDropped: j.bombsDropped, bombNext: j.bombNext, bombStep: j.bombStep,
          bombRadius: j.bombRadius, bombDamage: j.bombDamage, burnTime: j.burnTime, burnDamage: j.burnDamage };
      }),
      bombs: STRAF.bombs.length, embers: STRAF.embers.length, roars: STRAF.roars,
      activeBombs: STRAF.bombs.map((b) => {
        const u = clamp(b.t / b.T, 0, 1);
        return { source: b.source, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, z0: b.z0,
          age: b.t, T: b.T, a: b.a, radius: b.radius, dmg: b.dmg, burnTime: b.burnTime, burnDamage: b.burnDamage,
          visible: b.t >= 0, position: [lerp(b.x0, b.x1, u), lerp(b.y0, b.y1, u), b.z0 * (1 - u * u)] };
      }),
      stats: { b52: { ...STRAF.stats.b52,
        lastDrop: STRAF.stats.b52.lastDrop ? { ...STRAF.stats.b52.lastDrop } : null,
        lastImpact: STRAF.stats.b52.lastImpact ? { ...STRAF.stats.b52.lastImpact } : null },
      b2: { ...STRAF.stats.b2,
        lastDrop: STRAF.stats.b2.lastDrop ? { ...STRAF.stats.b2.lastDrop } : null,
        lastImpact: STRAF.stats.b2.lastImpact ? { ...STRAF.stats.b2.lastImpact } : null } },
      art: { jet: { w: JET.n[0].width, h: JET.n[0].height, normal: JET.n.length, shadow: JET.sh.length, hot: JET.hot.length },
        f4: { w: F4.n[0].width, h: F4.n[0].height, normal: F4.n.length, shadow: F4.sh.length, hot: F4.hot.length },
        b52: { w: B52.n[0].width, h: B52.n[0].height, normal: B52.n.length, shadow: B52.sh.length, hot: B52.hot.length,
          engines: B52.engines.map((e) => ({ x: e.x, y: e.y })) },
        b2: { w: B2.n[0].width, h: B2.n[0].height, normal: B2.n.length, shadow: B2.sh.length, hot: B2.hot.length },
        heli: { w: HSPR.n[0].width, h: HSPR.n[0].height } }
    };
  },
  // Report only implemented unit systems; later weapons stay neutral until their own tasks.
  units: () => {
    if (!G) return null;
    const weapons = heliWeaponState(), p = weapons.pods, f = weapons.hellfire, clock = heliWeaponTime();
    const active = G.rounds.filter((r) => r.kind === 'rocket' && r.source === 'pods');
    const missiles = G.rounds.filter((r) => r.kind === 'hellfire');
    const mg = trainWeaponState().mg;
    const kat = trainWeaponState().katyusha, km = trainMount(KATC.car, 0, 0, KATC.deck);
    const copyKat = (v) => v ? { ...v } : null;
    const copyMGShot = (s) => s ? { ...s, muzzle: { ...s.muzzle }, target: { ...s.target },
      targets: s.targets.map((t) => ({ ...t })) } : null;
    return {
      heli: { count: G.helis.length, damage: G.up.dmg, rate: G.up.rate, range: hRange(), winch: !!G.up.winch },
      rockets: { chance: G.up.rocketChance || 0, enabled: !!G.up.rocketChance },
      pods: { enabled: !!G.up.pods, range: HWC.pod.range, damage: HWC.rocket.damage * G.up.podDamage,
        reload: G.up.podReload, salvo: G.up.podSalvo, napalmDuration: G.up.napalmDuration, salvos: p.salvos, shots: p.shots,
        queued: p.queue.length, inFlight: active.length, cooldown: Math.max(0, p.next - clock),
        ready: !!G.up.pods && clock >= p.next, impacts: p.impacts, kills: p.kills,
        lastTarget: p.lastTarget ? { ...p.lastTarget } : null,
        lastImpact: p.lastImpact ? { ...p.lastImpact } : null,
        active: active.map((r) => ({ sx: r.sx, sy: r.sy, sz: r.sz, bx: r.bx, by: r.by,
          age: r.age, T: r.T, dmg: r.dmg, R: r.R, burnTime: r.burnTime, burnDamage: r.burnDamage, position: rocketAt(r) })) },
      hellfire: { enabled: !!G.up.hellfire, range: HWC.hellfire.range,
        count: G.up.hellfireCount,
        damage: HWC.hellfire.damage * G.up.hellfireDamage, reload: G.up.hellfireReload,
        blastRadius: HWC.hellfire.radius * G.up.hellfireBlast, salvos: f.salvos, shots: f.shots,
        inFlight: missiles.length, cooldown: Math.max(0, f.next - clock), ready: !!G.up.hellfire && clock >= f.next,
        impacts: f.impacts, kills: f.kills,
        lastTargets: f.lastTargets.map((t) => ({ x: t.x, y: t.y, hp: t.hp, type: t.type, priority: t.priority, t: t.t })),
        lastImpact: f.lastImpact ? { ...f.lastImpact } : null,
        active: missiles.map((r) => ({ sx: r.sx, sy: r.sy, sz: r.sz, bx: r.bx, by: r.by,
          age: r.age, T: r.T, dmg: r.dmg, R: r.R, priority: r.priority, position: hellfireAt(r),
          targetSnapshot: { ...r.targetSnapshot } })) },
      mg: { enabled: !!G.up.mgCar, damage: MGC.damage * G.up.mgDamage, rate: G.up.mgRate,
        range: MGC.range * G.up.mgRange, wallRange: MGC.wallRange, count: G.up.mgTurrets, pierce: G.up.apRounds,
        shots: mg.shots, hits: mg.hits, kills: mg.kills, targetsHit: mg.targetsHit, lastShot: copyMGShot(mg.lastShot),
        turrets: mg.turrets.map((t) => ({ ...t, sx: t.x - G.camX, sy: t.y - t.z - G.camY,
          cooldown: t.cd, lastShot: copyMGShot(t.lastShot) })),
        art: { normal: MGART.n.length, hot: MGART.h.length, barrel: MGART.bn.length, hotBarrel: MGART.bh.length,
          w: MGART.n[0].width, h: MGART.n[0].height,
          atlas: [...MGART.n, ...MGART.h, ...MGART.bn, ...MGART.bh].every((s) => !!ATL.get(s)) } },
      katyusha: { enabled: !!G.up.katyusha, range: KATC.range, damage: KATC.damage,
        blastRadius: KATC.radius * G.up.katyushaBlast, reload: G.up.katyushaReload,
        salvo: G.up.katyushaRockets, clusterCount: G.up.clusterRockets, cooldown: Math.max(0, kat.next - clock),
        ready: !!G.up.katyusha && clock >= kat.next, salvos: kat.salvos, shots: kat.shots, hits: kat.hits, kills: kat.kills,
        impacts: kat.impacts, rocketImpacts: kat.rocketImpacts, clusterImpacts: kat.clusterImpacts,
        splits: kat.splits, clusterBombs: kat.clusterBombs, queued: kat.queue.length, inFlight: kat.rounds.length,
        flash: kat.flash.slice(), ang: kat.ang, lastTarget: copyKat(kat.lastTarget), lastSalvo: copyKat(kat.lastSalvo),
        lastLaunch: copyKat(kat.lastLaunch), lastImpact: copyKat(kat.lastImpact), recentImpacts: kat.recentImpacts.map(copyKat),
        active: kat.rounds.map((r) => ({ source: r.source, sx: r.sx, sy: r.sy, sz: r.sz, bx: r.bx, by: r.by,
          age: r.age, T: r.T, dmg: r.dmg, R: r.R, arc: r.arc, cluster: r.cluster, position: rocketAt(r) })),
        mount: { ...km, sx: km.x - G.camX, sy: km.y - km.z - G.camY },
        art: { normal: KATART.n.length, hot: KATART.h.length, w: KATART.n[0].width, h: KATART.n[0].height,
          atlas: [...KATART.n, ...KATART.h].every((s) => !!ATL.get(s)) } },
      planes: airSnapshot(), cars: [], gadgets: []
    };
  },
  // Copy the burning ground and its run counters without exposing mutable patches or G.
  fires: () => {
    if (!G) return [];
    burnState();
    return BURN.map((f) => ({ x: f.x, y: f.y, R: f.R, time: f.time, age: f.age,
      duration: f.duration, dps: f.dps, tick: f.tick, source: f.source, wall: !!f.wall }));
  },
  fireStats: () => {
    if (!G) return null;
    const s = burnState();
    return { kills: s.kills, ticks: s.ticks, hits: s.hits, created: s.created };
  },
  // A real bounded-list burn fixture for cap checks; gameplay tests use pod salvos.
  addBurn: (sx, sy, R = 16, duration = 3, dps = 2) => {
    if (!G || ![sx, sy, R, duration, dps].every(Number.isFinite) || R <= 0 || duration <= 0 || dps <= 0) return false;
    addBurn(G.camX + sx, G.camY + sy, R, duration, dps, 'test');
    return BURN.length;
  },
  // Copy firing diagnostics and projectiles without exposing mutable targets or heli objects.
  rockets: () => {
    if (!G) return null;
    const s = heliWeaponState();
    return { shots: s.shots, rockets: s.rockets, first: s.first, last: s.last, maxGap: s.maxGap, forced: s.forced,
      impacts: s.impacts, kills: s.kills, lastImpact: s.lastImpact ? { ...s.lastImpact } : null,
      active: G.rounds.filter((r) => r.kind === 'rocket' && r.source !== 'pods').map((r) => ({ sx: r.sx, sy: r.sy, sz: r.sz,
        bx: r.bx, by: r.by, age: r.age, T: r.T, dmg: r.dmg, R: r.R, position: rocketAt(r) })) };
  },
  // Real pointer events exercise the same held-state and order paths as the mouse.
  rightDown: (sx = W / 2, sy = H / 2) => {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, buttons: 2, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + sx / W * r.width, clientY: r.top + sy / H * r.height }));
    return M.right;
  },
  // Release the right button through the canvas input handler.
  rightUp: (sx = M.x, sy = M.y) => {
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 2, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + sx / W * r.width, clientY: r.top + sy / H * r.height }));
    return M.right;
  },
  // The live gun effects, without advancing or drawing a frame.
  gunVisual: () => ({ range: { radius: G ? hRange() : 0, visible: G ? heliRangeVisible() : false },
    hits: HITS.map((h) => ({ x: h.x, y: h.y, scale: h.scale, age: h.t })) }),
  // The exact stat segments that the node tooltip draws at its current level.
  treeStats: (id) => {
    const n = NODE[id];
    return n ? [n.stat, n.stat2].filter(Boolean).map((s) => statSegs(s, lv(id), lv(id) >= maxLv(n))) : [];
  },
  scrapPops: () => texts.filter((t) => t.c === U.blue && t.v?.startsWith('+'))
    .map((t) => ({ text: t.v, scale: t.s, x: t.x - G.camX, y: t.y - G.camY, color: t.c })),
  treeShown: () => NODES.filter((n) => shownAs(n) > 0).map((n) => n.id),
  treeArt: () => NODES.map((n) => ({ id: n.id, w: NICON[n.id]?.width || 0, h: NICON[n.id]?.height || 0 })),
  treeOverlap: () => {
    const pairs = [];
    for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i], b = NODES[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 1.2) pairs.push({ a: a.id, b: b.id, distance: +d.toFixed(3) });
    }
    return pairs;
  },
  summaryView: () => G.sum ? summaryLayout(G.sum, G.sum.plan || sumPlan(G.sum)) : null,
  depotRoute: () => depotRouteState(),
  currencyState: () => ({ shown: { scrap: true, surv: !!SAVE.flags.survShown, gold: !!SAVE.flags.goldShown },
    x: { scrap: currencyX('scrap'), surv: currencyX('surv'), gold: currencyX('gold') }, chest: SAVE.chest, gold: SAVE.gold }),
  line: () => ({
    stops: STOPS.map(({ id, name, kind, km, side }) => ({ id, name, kind, km, side })),
    legs: LEGS.map((l) => ({ n: l.n, from: l.from.id, to: l.to.id, len: l.len,
      scrapTarget: l.scrapTarget, ordinaryPay: l.ordinaryPay, wallPay: l.wallPay,
      stars: l.stars, rescue: l.rescue, finale: l.finale, base: { ...l.base },
      events: l.events.map(([at, kind, params]) => [at, kind, { ...params }]) }))
  }),
  leg: (n, replay) => { startGame(n, replay); return G.leg; },
  win: () => { window.__sr.jump(8); },
  payGold: (id, amount, scrapIfNot) => payGold(id, amount, scrapIfNot),
  setLeg: (n) => {
    n = clamp(Math.floor(Number(n) || 1), 1, 13);
    for (let i = 1; i < n; i++) legSave(i).won = true;
    SAVE.leg = n;
    saveSave();
    return SAVE.leg;
  },
  legState: () => ({ leg: G.leg, t: +G.run.toFixed(2), len: legDef(G.leg)?.len || 0,
    result: G.result, replay: G.replay, eventIndex: G.eventIndex,
    events: G.events.map((e) => ({ ...e })), base: { ...legDef(G.leg)?.base },
    stars: (SAVE.legs[G.leg]?.stars || [false, false, false]).slice(),
    gold: G.gold || 0, surv: G.surv, scrap: Math.floor(G.cash), wall: testWallView(blockingWall()) })
});

// Radar dot batching preserves the old one-pixel overwrite order and rounding exactly.
Object.assign(window.__sr, {
  testRadar: () => {
    if (!G) return false;
    const w = 128, h = 120, keep = G.zombies, backup = ctx.getImageData(0, 0, w, h);
    const [reference, expected] = mk(w, h, true), result = {ok: true, cases: 0, mismatchPixels: 0,
      maxChannelDelta: 0, firstDifferences: []};
    const started = performance.now();
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false; ctx.filter = 'none'; ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      for (let shift = 0; shift < 32; shift++) {
        const x0 = shift % 8 === 0 ? -4 : 8 + shift % 4 * 7, y0 = shift % 7 === 0 ? -3 : 9 + Math.floor(shift / 4) * 3;
        const cx = x0 + 36, cy = y0 + 36, hx = -137.5 + shift * 0.31, hy = 224.25 - shift * 0.37, k = 36 / 640;
        const zombies = [], add = (x, y, st, dead = false, gone = false) => zombies.push({
          x: hx + (x + x0 - cx) / k, y: hy + (y + y0 - cy) / k, st, dead, gone});
        const edges = [-1.51, -0.51, -0.5, -0.49, 0, 0.49, 0.5, 0.51, 35.49, 35.5, 36.49,
          70.49, 70.5, 71.49, 71.5, 71.51, 72, 73];
        for (let i = 0; i < edges.length; i++) {
          add(edges[i], 14 + i % 7, i % 3); add(23 + i % 9, edges[i], (i + 1) % 3);
        }
        for (let i = 0; i < 700; i++) add((i * 17 + shift * 5) % 76 - 2 + 0.37,
          (i * 29 + shift * 3) % 76 - 2 + 0.63, i % 3, i % 11 === 0, i % 13 === 0);
        // Last living dot wins. A later dead dot must leave that color intact.
        add(35.2, 35.2, 0); add(35.2, 35.2, 1); add(35.2, 35.2, 0, true);
        add(42.2, 42.2, 2); add(42.2, 42.2, 0);
        for (const g of [ctx, expected]) {
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          g.fillStyle = '#132531'; g.fillRect(0, 0, w, h);
        }
        G.zombies = zombies;
        drawRadarDead(x0, y0, cx, cy, hx, hy, k);
        for (const z of zombies) if (!z.dead) {
          const x = Math.round(cx + (z.x - hx) * k), y = Math.round(cy + (z.y - hy) * k);
          if (x < x0 || y < y0 || x > x0 + 71 || y > y0 + 71) continue;
          expected.fillStyle = z.st ? '#ff4a32' : '#7a2a22'; expected.fillRect(x, y, 1, 1);
        }
        const actual = ctx.getImageData(0, 0, w, h).data, old = expected.getImageData(0, 0, w, h).data;
        result.cases++;
        for (let i = 0; i < actual.length; i += 4) {
          let delta = 0;
          for (let channel = 0; channel < 4; channel++) delta = Math.max(delta, Math.abs(actual[i + channel] - old[i + channel]));
          if (!delta) continue;
          result.mismatchPixels++; result.maxChannelDelta = Math.max(result.maxChannelDelta, delta);
          if (result.firstDifferences.length < 8) result.firstDifferences.push({shift, x: i / 4 % w, y: Math.floor(i / 4 / w),
            actual: Array.from(actual.slice(i, i + 4)), old: Array.from(old.slice(i, i + 4))});
        }
      }
      result.ok = result.mismatchPixels === 0; result.elapsedMs = +(performance.now() - started).toFixed(3);
      result.buffer = {w: RADARDEAD.c.width, h: RADARDEAD.c.height};
      return result;
    } finally { G.zombies = keep; ctx.restore(); ctx.putImageData(backup, 0, 0); }
  }
});

// Pixel comparisons use the actual main drawing context, then restore its pixels and state.
// The reference renders recreate the old primitives independently of their new caches.
Object.assign(window.__sr, (() => {
  function pixelTest(drawCases) {
    const w = 255, h = 179;
    if (cv.width < w || cv.height < h) throw new Error('Pixel tests need a canvas of at least 255x179');
    const reference = document.createElement('canvas');
    reference.width = w; reference.height = h;
    const expected = reference.getContext('2d', { alpha: false, willReadFrequently: true });
    expected.imageSmoothingEnabled = false;
    const backup = ctx.getImageData(0, 0, w, h), started = performance.now();
    const result = { ok: true, cases: 0, mismatchPixels: 0, maxChannelDelta: 0, firstDifferences: [],
      diagnostics: { cases: 0, mismatchPixels: 0, maxChannelDelta: 0, firstDifferences: [] } };
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = false;
      ctx.filter = 'none'; ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.shadowColor = 'rgba(0,0,0,0)';
      drawCases((meta, actual, legacy, diagnostic = false) => {
        for (const g of [ctx, expected]) {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          g.fillStyle = '#132531'; g.fillRect(0, 0, w, h);
          g.translate(meta.translate[0], meta.translate[1]);
          g.globalAlpha = meta.alpha; g.globalCompositeOperation = meta.blend;
        }
        actual(); legacy(expected);
        const a = ctx.getImageData(0, 0, w, h).data, b = expected.getImageData(0, 0, w, h).data;
        const bucket = diagnostic ? result.diagnostics : result;
        bucket.cases++;
        let first = null;
        for (let i = 0; i < a.length; i += 4) {
          let delta = 0;
          for (let ch = 0; ch < 4; ch++) delta = Math.max(delta, Math.abs(a[i + ch] - b[i + ch]));
          if (!delta) continue;
          bucket.mismatchPixels++; bucket.maxChannelDelta = Math.max(bucket.maxChannelDelta, delta);
          if (!first) first = { x: i / 4 % w, y: Math.floor(i / 4 / w),
            actual: Array.from(a.slice(i, i + 4)), expected: Array.from(b.slice(i, i + 4)) };
        }
        if (first && bucket.firstDifferences.length < 8) bucket.firstDifferences.push({ ...meta, ...first });
      });
      result.ok = result.mismatchPixels === 0;
      result.elapsedMs = +(performance.now() - started).toFixed(3);
      return result;
    } finally {
      ctx.restore();
      ctx.putImageData(backup, 0, 0);
    }
  }
  return {
    testRings: () => {
      const pairs = [[1, 1], [2, 1], [3, 2], [4.4, 3.2], [8, 6], [13, 9],
        [24, 17], [40, 29], [65, 47], [100, 72]];
      const result = pixelTest((compare) => {
        for (const [rx, ry] of pairs) for (const color of ['#fff1c2', 'rgba(143,209,138,0.4)']) {
          const RX = Math.max(1, Math.round(rx)), RY = Math.max(1, Math.round(ry));
          const bitmap = document.createElement('canvas');
          bitmap.width = RX * 2 + 1; bitmap.height = RY * 2 + 1;
          const old = bitmap.getContext('2d');
          old.fillStyle = color;
          const n = Math.max(16, Math.ceil((RX + RY) * 1.7));
          for (let i = 0; i < n; i++) {
            const a = i / n * (Math.PI * 2);
            old.fillRect(Math.round(RX + Math.cos(a) * RX), Math.round(RY + Math.sin(a) * RY), 1, 1);
          }
          for (const alpha of [1, 0.4]) for (const blend of ['source-over', 'lighter'])
            for (const repeats of [1, 3]) for (const translate of [[0, 0], [7, -3]]) {
              const x = 121.25, y = 89.6;
              compare({ rx, ry, color, alpha, blend, repeats, translate },
                () => { for (let i = 0; i < repeats; i++) pell(x, y, rx, ry, color); },
                (g) => { for (let i = 0; i < repeats; i++) g.drawImage(bitmap, Math.round(x) - RX, Math.round(y) - RY); });
            }
        }
      });
      result.caches = { shapes: PELL_SHAPES.size, bitmaps: PELL.size };
      return result;
    }
  };
})());
