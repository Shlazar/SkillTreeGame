// shot mode: capture a real A-10 attract pass beside the natural MG/rocket battle.
function check(ok, message) { if (!ok) throw new Error(message); }
const previous = Math.random; let seed = 0x822;
Math.random = () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let shot;
try {
  __sr.hold(false); __sr.pause(false); __sr.reset(); __sr.thermal(0); __sr.title();
  const saved = JSON.stringify(__sr.save());
  let flight = null;
  for (let i = 0; i < 30 * 60 && !flight; i++) {
    __sr.sim(1 / 60);
    flight = __sr.planeShow().jets.find(j => j.bodyVisible);
  }
  check(flight && __sr.units().mg.enabled && __sr.units().mg.shots > 0 && __sr.rockets().rockets > 0,
    'Title capture lacks a real plane pass and the new attract weapons');
  __sr.hold(true); __sr.frames(30);
  check(JSON.stringify(__sr.save()) === saved && !__sr.tutState().tip, 'Title capture changed saved progress');
  shot = { mode: __sr.mode, flight, rockets: __sr.rockets(), mgShots: __sr.units().mg.shots,
    stats: __sr.stats(), saveUnchanged: true };
} finally { Math.random = previous; }
QA_DONE(shot);
