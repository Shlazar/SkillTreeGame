// air.js - plane slots, charges, aiming and the reserved band below the world.
// Ownership and upgrades are fixed when a leg starts; flight and damage stay in planes.js.
const AIRBAND = { height: 18 }; // Band height in game px.
// Starting cooldowns and floors are seconds; payloads enable at their own tasks.
const PLANES = {
  a10: { name: 'A-10', cooldown: 25, floor: 12, available: true },
  f4: { name: 'F-4', cooldown: 30, floor: 15, available: false },
  b52: { name: 'B-52', cooldown: 45, floor: 25, available: false },
  b2: { name: 'B-2', cooldown: 60, floor: 40, available: false }
};
// Double-tap seconds, slot width/gap/left px, return-animation seconds, and crowd radius px (proposal).
const AIRCFG = { doubleTap: 0.35, slotWidth: 78, slotGap: 4, left: 6, returnTime: 0.25, crowdRadius: 40 };
const AIRKEYS = ['q', 'w', 'e', 'r'];
const AIR = { g: null, slots: [], planes: {}, arm: null, aim: null, tap: null };
const planeBandVisible = () => !!G && !G.demo && (mode === 'play' || mode === 'ending') && G.up.planeOwned.length > 0;
function syncViewHeight() {
  VH = H - (planeBandVisible() ? AIRBAND.height : 0);
}
// Keep valid slot choices, then fill empty slots in a stable order. Title demos never edit saves.
function airSync() {
  if (!G || AIR.g === G) return;
  AIR.g = G;
  AIR.arm = AIR.aim = AIR.tap = null;
  AIR.planes = {};
  AIR.slots = [];
  if (G.demo) return;
  const owned = G.up.planeOwned.filter((id) => PLANES[id]), used = new Set();
  AIR.slots = SAVE.hangar.map((id) => {
    if (!owned.includes(id) || used.has(id)) return null;
    used.add(id);
    return id;
  });
  for (const id of owned) {
    if (used.has(id)) continue;
    const slot = AIR.slots.indexOf(null);
    if (slot < 0) break;
    AIR.slots[slot] = id;
    used.add(id);
  }
  if (AIR.slots.some((id, i) => id !== SAVE.hangar[i])) {
    SAVE.hangar = AIR.slots.slice();
    saveSave();
  }
  for (const id of owned) {
    const desc = PLANES[id], cd = G.up.planeCooldown[id], charges = G.up.planeCharges[id];
    AIR.planes[id] = { maxCd: Number.isFinite(cd) ? clamp(cd, desc.floor, desc.cooldown) : desc.cooldown,
      maxCharges: Number.isFinite(charges) ? clamp(Math.floor(charges), 1, 2) : 1,
      cd: 0, charges: 0, strikes: 0, lastStrike: null, readyAt: realT - AIRCFG.returnTime };
    AIR.planes[id].charges = AIR.planes[id].maxCharges;
  }
}
const airLive = () => !!G && !G.demo && !G.result && mode === 'play' && !paused;
function airSlot(key) {
  const i = AIRKEYS.indexOf(String(key).toLowerCase());
  return i >= 0 && i < AIR.slots.length ? AIR.slots[i] : null;
}
const airReady = (id) => !!id && !!PLANES[id]?.available && AIR.planes[id]?.charges > 0;
// Serial refill is a proposal: a second use keeps the first recharge's progress.
function updateAir(dt) {
  airSync();
  if (!airLive()) {
    if (G?.result) airCancel();
    return;
  }
  for (const [id, p] of Object.entries(AIR.planes)) {
    if (!PLANES[id].available || p.charges >= p.maxCharges) continue;
    p.cd -= dt;
    while (p.cd <= 1e-9 && p.charges < p.maxCharges) {
      const wasEmpty = p.charges === 0;
      p.charges++;
      if (wasEmpty) { p.readyAt = realT; SFX.planeReady(); }
      p.cd = p.charges < p.maxCharges ? p.cd + p.maxCd : 0;
    }
  }
}
function airCancel() {
  const active = !!AIR.arm;
  AIR.arm = AIR.aim = AIR.tap = null;
  if (active && airLive()) SFX.ui();
  return active;
}
function airArm(id) {
  if (!airReady(id)) { SFX.deny(); return false; }
  AIR.arm = id;
  AIR.aim = null;
  SFX.ui();
  return true;
}
function airKey(key) {
  airSync();
  if (!airLive()) return false;
  key = String(key).toLowerCase();
  const id = airSlot(key);
  if (!id || !PLANES[id].available) return false;
  if (AIR.arm === id && AIR.tap?.key === key && realT - AIR.tap.t <= AIRCFG.doubleTap) return airSmart(key);
  if (!airArm(id)) return false;
  AIR.tap = { key, t: realT };
  return true;
}
// Charges belong to the framework; a failed or unsupported transport never consumes one.
function airLaunch(id, x, y, ux, uy) {
  if (!airLive() || !airReady(id) || !launchPlane(id, x, y, ux, uy)) return false;
  const p = AIR.planes[id];
  p.charges--;
  if (p.cd <= 0) p.cd = p.maxCd;
  p.strikes++;
  p.lastStrike = { x, y, ux, uy, t: G.run };
  AIR.arm = AIR.aim = AIR.tap = null;
  return true;
}
function airStrike(key, sx, sy, ang) {
  airSync();
  if (![sx, sy].every(Number.isFinite) || ang != null && !Number.isFinite(ang)) return false;
  if (sx < 0 || sx >= W || sy < 19 || sy >= VH) return false;
  const [ux, uy] = ang == null ? strafeDir(sx, sy, sx, sy) : [Math.cos(ang), Math.sin(ang)];
  return airLaunch(airSlot(key), G.camX + sx, G.camY + sy, ux, uy);
}
function airSmart(key) {
  airSync();
  const id = airSlot(key);
  if (!airLive() || !airReady(id)) return false;
  const x = G.camX + W / 2, y = G.camY + VH / 2, R = Math.hypot(W / 2, VH / (2 * FORE));
  const target = bestCrowd(x, y, R, AIRCFG.crowdRadius,
    (z) => z.x >= G.camX && z.x < G.camX + W && z.y >= G.camY + 19 && z.y < G.camY + VH);
  if (!target) { AIR.tap = null; SFX.deny(); return false; }
  const c = G.tr.cars[0];
  return airLaunch(id, target.x, target.y, c.dx, c.dy);
}
function airDown(x, y) {
  airSync();
  if (!airLive()) return false;
  const slot = airBandSlots().find((r) => inR(x, y, r.x, r.y, r.w, r.h));
  if (slot) {
    AIR.tap = null;
    airArm(slot.id);
    return true;
  }
  if (!AIR.arm || x < 0 || x >= W || y < 19 || y >= VH) return false;
  AIR.aim = { x: G.camX + x, y: G.camY + y };
  return true;
}
function airUp(x, y) {
  const a = AIR.aim;
  if (!a) return false;
  if (!airLive() || x < 0 || x >= W || y < 19 || y >= VH) { airCancel(); return true; }
  const [ux, uy] = strafeDir(a.x - G.camX, a.y - G.camY, x, y), id = AIR.arm;
  if (!airLaunch(id, a.x, a.y, ux, uy)) airCancel();
  return true;
}
function airAimActive() {
  airSync();
  return airLive() && airReady(AIR.arm);
}
function airAimSnapshot() {
  const active = airAimActive(), id = AIR.arm;
  return { active, id, key: id ? AIRKEYS[AIR.slots.indexOf(id)] : null,
    x: active ? AIR.aim ? AIR.aim.x - G.camX : M.x : null,
    y: active ? AIR.aim ? AIR.aim.y - G.camY : M.y : null };
}
function airBandSlots() {
  airSync();
  if (!planeBandVisible()) return [];
  return AIR.slots.flatMap((id, i) => id && PLANES[id].available ? [{ id, key: AIRKEYS[i],
    x: AIRCFG.left + i * (AIRCFG.slotWidth + AIRCFG.slotGap), y: VH + 1,
    w: AIRCFG.slotWidth, h: AIRBAND.height - 1 }] : []);
}
function airSnapshot() {
  airSync();
  return AIR.slots.flatMap((id, slot) => {
    if (!id) return [];
    const p = AIR.planes[id];
    return [{ id, slot, key: AIRKEYS[slot], available: PLANES[id].available, ready: airReady(id),
      cd: Math.max(0, p.cd), maxCd: p.maxCd, charges: p.charges, maxCharges: p.maxCharges,
      aiming: AIR.arm === id, strikes: p.strikes, lastStrike: p.lastStrike ? { ...p.lastStrike } : null }];
  });
}
// Draw after the field's UI, before full-screen menus and fades.
function drawAirBand() {
  if (!planeBandVisible()) return;
  airSync();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, VH, W, H - VH);
  ctx.clip();
  ctx.fillStyle = 'rgba(6,7,9,0.88)';
  ctx.fillRect(0, VH, W, H - VH);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, VH, W, 1);
  for (const s of airBandSlots()) {
    const p = AIR.planes[s.id], ready = airReady(s.id), icon = NICON[s.id];
    if (AIR.arm === s.id) { ctx.fillStyle = 'rgba(184,134,47,0.16)'; ctx.fillRect(s.x, s.y, s.w, s.h); }
    const loop = G.t * 1.5 + AIR.slots.indexOf(s.id), enter = clamp((realT - p.readyAt) / AIRCFG.returnTime, 0, 1);
    const ix = Math.round(s.x + 6 + (ready ? Math.sin(loop) * 3 : 0));
    const iy = Math.round(VH + 2 + (ready ? Math.cos(loop) : 0) + (ready ? (1 - enter) * AIRBAND.height : 0));
    ctx.globalAlpha = ready ? 1 : 0.3;
    blit(icon, ix, iy);
    ctx.globalAlpha = 1;
    if (ready) text(s.key.toUpperCase(), s.x + 29, VH + 6, U.gold);
    if (p.maxCharges > 1 && p.charges > 0) text(String(p.charges), s.x + 40, VH + 6, U.ink);
    if (p.charges < p.maxCharges) {
      const f = clamp(1 - p.cd / p.maxCd, 0, 1), cx = s.x + 61, cy = VH + 9;
      ctx.fillStyle = '#3a3e48';
      ctx.fillRect(cx - 3, cy - 3, 7, 7);
      ctx.fillStyle = '#08090c';
      ctx.fillRect(cx - 2, cy - 2, 5, 5);
      ctx.fillStyle = '#e3b04b';
      for (let py = -2; py <= 2; py++) for (let px = -2; px <= 2; px++) {
        const a = mod(Math.atan2(py, px) + Math.PI / 2, TAU) / TAU;
        if (a <= f) ctx.fillRect(cx + px, cy + py, 1, 1);
      }
    }
    if (airLive() && inR(M.x, M.y, s.x, s.y, s.w, s.h)) cursor = 'pointer';
  }
  ctx.restore();
}
function drawAirAim() {
  if (!airAimActive() || !M.inside || M.y < 19 || M.y >= VH) return;
  const a = airAimSnapshot(), [ux, uy] = AIR.aim ? strafeDir(a.x, a.y, M.x, M.y) : strafeDir(a.x, a.y, a.x, a.y);
  cursor = 'crosshair';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 19, W, VH - 19);
  ctx.clip();
  drawStrafeLine(a.x, a.y, ux, uy);
  const hint = AIR.aim ? 'LET GO: STRIKE' : 'CLICK: STRIKE. DRAG: AIM. RIGHT CLICK: CANCEL.', w = tw(hint);
  text(hint, Math.round(clamp(M.x, w / 2 + 3, W - w / 2 - 3)), Math.round(Math.min(M.y + 12, VH - 44)), U.gold, { align: 'center' });
  ctx.restore();
}
