// air.js - the reserved plane band below the world and its shared view height.
// Plane ownership is fixed when a leg starts, so the field never reads the skill tree.
const AIRBAND = { height: 18 }; // Band height in game px.
const planeBandVisible = () => !!G && !G.demo && (mode === 'play' || mode === 'ending') && G.up.planeOwned.length > 0;
function syncViewHeight() {
  VH = H - (planeBandVisible() ? AIRBAND.height : 0);
}
// Draw after the field's UI, before full-screen menus and fades.
function drawAirBand() {
  if (!planeBandVisible()) return;
  ctx.fillStyle = 'rgba(6,7,9,0.88)';
  ctx.fillRect(0, VH, W, H - VH);
  ctx.fillStyle = '#24272e';
  ctx.fillRect(0, VH, W, 1);
}
