// hangar.js - the Depot's saved plane choices. Each leg takes its own snapshot in airSync().
// This panel uses baked icons; drawing and dragging never create sprites.
const HANGAR = { selected: null, drag: null };
const HANGAR_IDS = ['a10', 'f4', 'b52'];
const hangarOwned = () => HANGAR_IDS.filter((id) => lv(id) > 0);
const hangarVisible = () => hangarOwned().length > 2;
// Preserve valid choices and automatically fill empty slots, without duplicating planes.
function hangarSync() {
  const owned = hangarOwned(), used = new Set(), old = SAVE.hangar;
  const slots = [0, 1].map((i) => {
    const id = old[i];
    if (!owned.includes(id) || used.has(id)) return null;
    used.add(id);
    return id;
  });
  for (const id of owned) {
    if (used.has(id)) continue;
    const i = slots.indexOf(null);
    if (i < 0) break;
    slots[i] = id;
    used.add(id);
  }
  if (old.length !== slots.length || slots.some((id, i) => id !== old[i])) {
    SAVE.hangar = slots;
    saveSave();
  }
  if (!owned.includes(HANGAR.selected)) HANGAR.selected = null;
}
// An equipped plane swaps slots; a reserve replaces the plane in the target slot.
function hangarSet(slot, id) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 1 || !hangarOwned().includes(id)) return false;
  hangarSync();
  if (SAVE.hangar[slot] === id) return false;
  const from = SAVE.hangar.indexOf(id), replaced = SAVE.hangar[slot];
  if (from >= 0) SAVE.hangar[from] = replaced;
  SAVE.hangar[slot] = id;
  saveSave();
  return true;
}
function hangarCancel() {
  const active = !!HANGAR.drag || !!HANGAR.selected;
  HANGAR.drag = HANGAR.selected = null;
  return active;
}
// Rectangles are in game pixels, between the shared route and ride button.
function hangarLayout(y0 = 63, y1 = H - 45) {
  const owned = hangarOwned(), width = Math.min(W - 24, 480), left = Math.round((W - width) / 2);
  const lines = wrap(owned.length + ' PLANES, 2 SLOTS: PICK WHICH TO BRING.', width);
  const compact = y1 - y0 < 190, sh = compact ? 36 : 50, ch = compact ? 38 : 54, gap = compact ? 18 : 25;
  const height = lines.length * 10 + 12 + sh + gap + ch;
  const y = y0 + Math.max(6, Math.floor((y1 - y0 - height) / 3));
  const sw = Math.min(156, Math.floor((width - 12) / 2)), sx = Math.round((W - sw * 2 - 12) / 2);
  const sy = y + lines.length * 10 + 12, cy = sy + sh + gap;
  const cw = Math.min(140, Math.floor((width - 16) / 3)), cx = Math.round((W - cw * owned.length - 8 * (owned.length - 1)) / 2);
  return { x: left, y, w: width, lines,
    slots: SAVE.hangar.map((id, slot) => ({ slot, key: AIRKEYS[slot], id, x: sx + slot * (sw + 12), y: sy, w: sw, h: sh })),
    cards: owned.map((id, i) => ({ id, x: cx + i * (cw + 8), y: cy, w: cw, h: ch })) };
}
function hangarState() {
  return { visible: hangarVisible(), owned: hangarOwned(), slots: SAVE.hangar.slice(), selected: HANGAR.selected,
    drag: HANGAR.drag ? { ...HANGAR.drag } : null, layout: hangarLayout(), tabs: depotTabRects() };
}
function hangarDown(x, y) {
  if (mode !== 'depot' || depotTab !== 'hangar' || !hangarVisible()) return false;
  const layout = hangarLayout(), slot = layout.slots.find((r) => inR(x, y, r.x, r.y, r.w, r.h));
  const card = layout.cards.find((r) => inR(x, y, r.x, r.y, r.w, r.h));
  if (!slot && !card) return false;
  HANGAR.drag = { id: card ? card.id : slot.id, kind: card ? 'card' : 'slot', slot: slot ? slot.slot : null,
    selected: HANGAR.selected, x, y, moved: false };
  return true;
}
function hangarMove(x, y) {
  const d = HANGAR.drag;
  if (d && Math.abs(x - d.x) + Math.abs(y - d.y) > 4) d.moved = true;
}
function hangarUp(x, y) {
  const d = HANGAR.drag;
  if (!d) return false;
  hangarMove(x, y);
  HANGAR.drag = null;
  if (mode !== 'depot' || depotTab !== 'hangar' || x < 0 || x >= W || y < 63 || y >= H - 45) return true;
  const layout = hangarLayout(), slot = layout.slots.find((r) => inR(x, y, r.x, r.y, r.w, r.h));
  if (d.moved) {
    if (slot && d.id) {
      if (hangarSet(slot.slot, d.id)) SFX.ui();
      HANGAR.selected = null;
    }
    return true;
  }
  if (d.kind === 'slot' && slot && slot.slot === d.slot) {
    if (d.selected) {
      if (hangarSet(slot.slot, d.selected)) SFX.ui();
      HANGAR.selected = null;
    } else HANGAR.selected = d.id;
  } else if (d.kind === 'card' && layout.cards.some((r) => r.id === d.id && inR(x, y, r.x, r.y, r.w, r.h))) {
    HANGAR.selected = HANGAR.selected === d.id ? null : d.id;
    SFX.ui();
  }
  return true;
}
function drawHangarTab(y0, y1) {
  hangarSync();
  // Synthetic UI clicks use the same selection/drop path as physical pointer input.
  if (!M.used && M.pressed) hangarDown(M.px, M.py);
  if (HANGAR.drag && M.down) hangarMove(M.x, M.y);
  if (HANGAR.drag && M.released) { hangarUp(M.x, M.y); M.used = true; }
  const layout = hangarLayout(y0, y1);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, y0, W, y1 - y0);
  layout.lines.forEach((line, i) => text(line, W / 2, layout.y + i * 10, U.ink, { align: 'center' }));
  for (const r of layout.slots) {
    const hover = M.inside && inR(M.x, M.y, r.x, r.y, r.w, r.h), target = hover && !!(HANGAR.drag || HANGAR.selected);
    panel(r.x, r.y, r.w, r.h);
    frame(r.x, r.y, r.w, r.h, target ? U.green : '#b8862f');
    text(r.key.toUpperCase(), r.x + 9, r.y + 6, U.gold);
    const iy = Math.round(r.y + r.h / 2 - 5);
    if (r.id) {
      blit(NICON[r.id], r.x + 10, iy);
      text(PLANES[r.id].name, r.x + 33, iy + 4, U.ink);
    } else text('DROP A PLANE', r.x + 31, iy + 4, U.faint);
    if (hover) cursor = HANGAR.drag?.moved ? 'grabbing' : HANGAR.selected ? 'pointer' : 'grab';
  }
  text('DRAG A PLANE INTO Q OR W.', W / 2, layout.cards[0].y - 12, U.dim, { align: 'center' });
  for (const r of layout.cards) {
    const hover = M.inside && inR(M.x, M.y, r.x, r.y, r.w, r.h), selected = HANGAR.selected === r.id;
    panel(r.x, r.y, r.w, r.h);
    frame(r.x, r.y, r.w, r.h, selected ? U.green : hover ? '#6a6f7b' : '#2e3139');
    text(PLANES[r.id].name, r.x + r.w / 2, r.y + 6, U.ink, { align: 'center' });
    const iy = Math.round(r.y + r.h / 2 - 2), i = SAVE.hangar.indexOf(r.id);
    blit(NICON[r.id], r.x + 10, iy);
    text(i < 0 ? 'RESERVE' : 'IN ' + AIRKEYS[i].toUpperCase(), r.x + 31, iy + 4, i < 0 ? U.faint : U.gold);
    if (hover) cursor = HANGAR.drag?.moved ? 'grabbing' : 'grab';
  }
  if (HANGAR.drag?.moved && HANGAR.drag.id) {
    cursor = 'grabbing';
    blit(NICON[HANGAR.drag.id], Math.round(M.x - 7), Math.round(M.y - 7));
  }
}
