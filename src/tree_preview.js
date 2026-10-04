// tree_preview.js - two decorative skill-tree scenes using the game's already baked sprites.
// Hook: drawTreePreview(id, x, y, w, h, phase), with phase0..1 supplied by the tooltip.
// These scenes only paint: no game clocks, targets, rewards, sound, random draws or atlas writes.

// A three-second loop shows six MG shots or one A-10 pass; plane scale fits the short panel.
// Shot fractions, preview altitude and sprite scale are decorative values. (proposal)
const TREE_PREVIEWC = { targets: 3, shot1: 0.12, shot2: 0.62, flash: 0.07,
  planeStart: 0.1, planeEnd: 0.85, planeScale: 0.75, planeAlt: 16, planeLead: 24 };

function treePreviewGround(w, h) {
  ctx.fillStyle = '#689b3e'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5e8f38';
  for (let i = 0; i < 18; i++) {
    const x = 5 + (i * 37) % Math.max(1, w - 10), y = 5 + (i * 19) % Math.max(1, h - 10);
    ctx.fillRect(x, y, 2, 1);
  }
}

// Sprite feet and corpse centres retain their real game anchors.
function treePreviewWalker(i, x, y, frame, dead, flash) {
  const S = ZS[0][i % ZS[0].length];
  if (dead) ctx.drawImage(S.corpses[0], Math.round(x - S.cax), Math.round(y - S.cay));
  else {
    const f = S.walk[frame & 3];
    ctx.drawImage(f.s, Math.round(x - S.ax), Math.round(y - S.shp));
    ctx.drawImage(flash ? f.w : f.n, Math.round(x - S.ax), Math.round(y - S.ay));
  }
}

function treePreviewFlash(x, y, size) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(x - size, y, size * 2 + 1, 1);
  ctx.fillRect(x, y - size, 1, size * 2 + 1);
  ctx.fillStyle = '#fff1c2'; ctx.fillRect(x - 1, y - 1, 2, 2);
}

function treePreviewMG(w, h, phase) {
  const C = TREE_PREVIEWC, cx = Math.round(w * 0.23), cy = Math.round(h * 0.68);
  const car = TRAIN[MGC.car], heading = angIdx(0), body = car.n[heading];
  ctx.fillStyle = '#353a43';
  for (let y = 2; y < h; y += 6) ctx.fillRect(cx - 9, y, 19, 2);
  ctx.fillStyle = '#7b8390'; ctx.fillRect(cx - 5, 0, 1, h); ctx.fillRect(cx + 5, 0, 1, h);
  ctx.drawImage(car.foot[heading], cx - 18, cy - 18);
  ctx.drawImage(body, cx - body.ox, cy - body.oy);
  const run = phase * C.targets, target = Math.min(C.targets - 1, Math.floor(run)), local = run - target;
  const flashing = local >= C.shot1 && local < C.shot1 + C.flash || local >= C.shot2 && local < C.shot2 + C.flash;
  const tx = Math.round(w * 0.61) + target * 23, ty = Math.round(h * 0.61) + (target % 2) * 6;
  const angle = Math.atan2(tx - cx, -(ty - cy)), k = mod(Math.round(angle / TAU * MGC.headings), MGC.headings);
  const turret = MGART.n[k], barrel = MGART.bn[k], z = car.tall - 1, recoil = flashing ? 1 : 0;
  const bx = Math.round(cx - Math.sin(angle) * recoil), by = Math.round(cy - z - MGC.barrelZ + Math.cos(angle) * recoil);
  if (Math.cos(angle) > 0.15) ctx.drawImage(barrel, bx - barrel.ox, by - barrel.oy);
  ctx.drawImage(turret, cx - turret.ox, cy - z - turret.oy);
  if (Math.cos(angle) <= 0.15) ctx.drawImage(barrel, bx - barrel.ox, by - barrel.oy);
  for (let i = 0; i < C.targets; i++) {
    const x = Math.round(w * 0.61) + i * 23, y = Math.round(h * 0.61) + (i % 2) * 6;
    const dead = i < target || i === target && local >= C.shot2 + C.flash;
    treePreviewWalker(i, x, y, Math.floor(phase * 12 + i), dead, i === target && flashing);
  }
  if (flashing) {
    const reach = MGC.barrel - recoil;
    treePreviewFlash(cx + Math.sin(angle) * reach, cy - Math.cos(angle) * reach - z - MGC.barrelZ - 1, 3);
    treePreviewFlash(tx, ty - ZS[0][target % ZS[0].length].h * 0.6, 2);
  }
}

function treePreviewA10(w, h, phase) {
  const C = TREE_PREVIEWC, k = JETC.N / 4, plane = JET.n[k], shadow = JET.sh[k];
  const pw = Math.round(plane.width * C.planeScale), ph = Math.round(plane.height * C.planeScale);
  const laneY = Math.round(h * 0.76), progress = (phase - C.planeStart) / (C.planeEnd - C.planeStart);
  const px = Math.round(-pw + progress * (w + pw * 2)), py = laneY - C.planeAlt, front = px + C.planeLead;
  const flying = phase >= C.planeStart && phase <= C.planeEnd;
  if (flying) {
    ctx.globalAlpha = 0.28;
    ctx.drawImage(shadow, px + 4 - (pw >> 1), laneY + 5 - (ph >> 1), pw, ph);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.round(w * 0.2 + i * w * 0.12), y = laneY + (i % 2) * 3;
    const passed = phase >= C.planeStart && front >= x, justHit = passed && front - x < 9 && flying;
    treePreviewWalker(i, x, y, Math.floor(phase * 12 + i), passed && !justHit, justHit);
    if (justHit) treePreviewFlash(x, y - 5, 3);
    if (passed) {
      ctx.fillStyle = '#8e1510'; ctx.fillRect(x - 7, y + 1, 2, 1); ctx.fillRect(x + 6, y - 2, 1, 1);
    }
  }
  if (phase < C.planeStart) {
    ctx.fillStyle = '#c9862f';
    for (let x = Math.round(w * 0.18); x < w * 0.86; x += 7) ctx.fillRect(x, laneY + 6, 3, 1);
  }
  if (flying) {
    ctx.drawImage(plane, px - (pw >> 1), py - (ph >> 1), pw, ph);
    if (front > w * 0.18 && front < w * 0.88) treePreviewFlash(px + Math.round(pw * 0.48), py, 4);
  }
}

function drawTreePreview(id, x, y, w, h, phase) {
  if (id !== 'mgCar' && id !== 'a10' || w <= 0 || h <= 0) return false;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  phase = Number.isFinite(phase) ? mod(phase, 1) : 0;
  ctx.save();
  ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  treePreviewGround(w, h);
  if (id === 'mgCar') treePreviewMG(w, h, phase);
  else treePreviewA10(w, h, phase);
  ctx.restore();
  return true;
}
