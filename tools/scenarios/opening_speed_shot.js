// Frozen real opening with the player's2X button visible; no enemy or health fixtures.
__sr.reset(); __sr.start(); __sr.bot(false); __sr.press('f'); __sr.frames(120);
__sr.hold(true); __sr.frames(1);
if (typeof QA_DONE === 'function') QA_DONE({speed: __sr.playSpeed(), stats: __sr.stats(), hud: __sr.uiBounds().hud});
