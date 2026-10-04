// legs.js - the Farmlands route: one short ride between each pair of stops. This table is the
// source for the route map, station rewards and timed events. Leg numbers shown to players are 1..12.

// Rail px between stations: about 60 s at the train's 40 px/s cruise. (proposal)
const LEG_LENGTH = 2400;
// First-pass scrap targets from the final design; ordinary kill shares are tuned with real rides.
const LEG_SCRAP_TARGETS = [80, 95, 115, 135, 160, 190, 225, 265, 310, 365, 430, 500];
// Ordinary kill multipliers preserve the large hordes; wall drops remain collectible. (proposal)
const LEG_ORDINARY_PAY = [0.30377, 0.35372, 0.38152, 0.40152, 0.11, 0.47, 0.74115, 0.54759, 0.80347, 0.60226, 0.56248, 0.14645];
const LEG_WALL_PAY = { 5: 40, 9: 40 };
// The closed-gate hold lasts 30 play seconds. Standoff/rear spread px and peak-gift seconds are proposals.
const FINALEC = { hold: 30,
  stop: 20, giftAt: 15, rearOff: 40 // (proposal)
};
// Hold-relative wave clocks and sizes; every wave enters through all four viewport edges. (proposal)
const FINALE_EVENTS = [
  [0, 'wave', { n: 24, edges: [-1, 1, 0, 2] }],
  [8, 'wave', { n: 30, edges: [-1, 1, 0, 2] }],
  [15, 'wave', { n: 38, edges: [-1, 1, 0, 2] }],
  [23, 'wave', { n: 30, edges: [-1, 1, 0, 2] }]
];
const STOPS = [
  Object.assign(DEPOT, { kind: 'big', side: 1 }),
  { id: 'millbrook', name: 'MILLBROOK', kind: 'big' },
  { id: 'cornfield', name: 'CORNFIELD HALT', kind: 'small' },
  { id: 'redbarn', name: 'RED BARN', kind: 'big' },
  { id: 'silo', name: 'SILO JUNCTION', kind: 'small' },
  { id: 'oldmill', name: 'OLD MILL', kind: 'big' },
  { id: 'pumpkin', name: 'PUMPKIN HALT', kind: 'small' },
  { id: 'crossroads', name: 'CROSSROADS', kind: 'big' },
  { id: 'water', name: 'WATER TOWER', kind: 'small' },
  { id: 'haybale', name: 'HAYBALE CAMP', kind: 'big' },
  { id: 'windmill', name: 'WINDMILL HALT', kind: 'small' },
  { id: 'grain', name: 'GRAIN ELEVATOR', kind: 'big' },
  { id: 'terminus', name: 'FARMLANDS TERMINUS', kind: 'end' }
];
// Actual run eligibility also applies to old-leg replays after buying Hunt upgrades.
const LEG_INTRO = { runner: 2, gold: 3, silver: 4, brute: 6, boom: 7 };
const legAllows = (kind) => !G.demo && G.leg >= LEG_INTRO[kind];

// Living caps, base stream sizes/cadence and type shares; final scrap tuning is separate. (proposal)
// [want, size, gap, runner share, brute share, rail brute share]
const LEG_BASE_ROWS = [
  [160, 4, 4, 0, 0, 0], [180, 4, 3.9, 0.08, 0, 0], [210, 5, 3.8, 0.12, 0, 0],
  [240, 5, 3.7, 0.14, 0, 0], [280, 6, 3.6, 0.16, 0, 0], [340, 7, 3.5, 0.18, 0.02, 0.05],
  [400, 8, 3.4, 0.20, 0.03, 0.06], [470, 9, 3.3, 0.22, 0.04, 0.07], [540, 10, 3.2, 0.23, 0.05, 0.08],
  [620, 11, 3.1, 0.25, 0.07, 0.10], [700, 12, 3, 0.27, 0.09, 0.12], [800, 14, 2.9, 0.30, 0.12, 0.15]
];
// Event clocks, crowd sizes and scrap placements/value; special tuples stay deferred until their
// real handlers exist. Leg 9's two events at 27 s deliberately overlap. (proposal)
const legPile = (pay) => ({ ahead: 120, off: 100, side: 1, pay });
const LEG_EVENT_ROWS = [
  [[3, 'railCrowd', { n: 6 }], [12, 'stream', { edge: -1, n: 12 }], [22, 'pile', legPile(24)],
    [32, 'stream', { edge: 1, n: 14 }], [42, 'railCrowd', { n: 8 }], [52, 'wave', { n: 10 }]],
  [[3, 'railCrowd', { n: 10 }], [12, 'stream', { edge: -1, n: 18, type: 1 }], [22, 'pile', legPile(29)],
    [32, 'stream', { edge: 1, n: 20 }], [42, 'railCrowd', { n: 12 }], [52, 'wave', { n: 12 }]],
  [[3, 'railCrowd', { n: 12 }], [11, 'stream', { edge: -1, n: 22 }], [19, 'golden', { edge: -1 }],
    [27, 'pile', legPile(35)], [35, 'stream', { edge: 1, n: 24 }], [43, 'railCrowd', { n: 16 }], [51, 'wave', { n: 14 }]],
  [[3, 'railCrowd', { n: 14 }], [11, 'stream', { edge: -1, n: 24 }], [19, 'golden', { edge: 1 }],
    [27, 'rescue', { id: 'rescue-4' }], [35, 'pile', legPile(41)], [43, 'silverGroup', { n: 3, edge: 1 }], [51, 'wave', { n: 16 }]],
  [[3, 'railCrowd', { n: 18 }], [11, 'stream', { edge: -1, n: 26 }], [19, 'golden', { edge: -1 }],
    [27, 'deadWall', {}], [35, 'pile', legPile(48)], [43, 'stream', { edge: 1, n: 28 }], [51, 'wave', { n: 18 }]],
  [[3, 'railCrowd', { n: 20, leaders: 1, leadType: 2 }], [11, 'stream', { edge: -1, n: 30 }], [19, 'golden', { edge: 1 }],
    [27, 'goldCrate', {}], [35, 'pile', legPile(57)], [43, 'stream', { edge: 1, n: 32 }], [51, 'wave', { n: 20 }]],
  [[3, 'explosiveStream', { edge: -1, n: 8 }], [11, 'stream', { edge: 1, n: 34 }], [19, 'golden', { edge: -1 }],
    [27, 'crate', legPile(38)], [35, 'pile', legPile(30)], [43, 'railCrowd', { n: 24 }], [51, 'wave', { n: 24 }]],
  [[3, 'railCrowd', { n: 26 }], [11, 'golden', { edge: 1 }], [19, 'rescue', { id: 'rescue-8' }],
    [27, 'pile', legPile(80)], [35, 'goldCrate', {}], [43, 'silverGroup', { n: 4, edge: 1 }], [51, 'wave', { n: 40, big: true }]],
  [[3, 'railCrowd', { n: 30 }], [11, 'stream', { edge: -1, n: 40 }], [19, 'golden', { edge: -1 }],
    [27, 'stream', { edge: 1, n: 40 }], [27, 'deadWall', {}], [35, 'pile', legPile(93)], [43, 'goldCrate', {}], [51, 'wave', { n: 44, big: true }]],
  [[3, 'stream', { edge: 0, n: 26, leaders: 2, leadType: 2, type: 1 }], [11, 'railCrowd', { n: 34 }], [19, 'golden', { edge: 1 }],
    [27, 'rescue', { id: 'rescue-10' }], [35, 'pile', legPile(110)],
    [43, 'stream', { edge: 0, n: 30, leaders: 3, leadType: 2, type: 1 }], [51, 'wave', { n: 48, big: true }]],
  [[3, 'railCrowd', { n: 40 }], [11, 'stream', { edge: -1, n: 50 }], [19, 'golden', { edge: -1 }],
    [27, 'goldCrate', {}], [35, 'pile', legPile(129)],
    [43, 'stream', { edge: 0, n: 50, leaders: 4, leadType: 2, type: 1 }], [51, 'wave', { n: 65, big: true }]],
  [[3, 'wave', { n: 65, big: true }], [11, 'stream', { edge: -1, n: 60 }], [19, 'golden', { edge: 1 }],
    [27, 'goldCrate', {}], [35, 'pile', legPile(150)], [43, 'railCrowd', { n: 50 }], [51, 'wave', { n: 75, big: true }]]
];
const LEGS = [];
for (let n = 1; n < STOPS.length; n++) {
  const from = STOPS[n - 1], to = STOPS[n];
  to.km = from.km + LEG_LENGTH / CFG.line.km;
  to.side = n % 2 ? 1 : -1;
  const b = LEG_BASE_ROWS[n - 1], base = HORDE[n - 1];
  Object.assign(base, { want: b[0], size: b[1], gap: b[2], run: b[3], brute: b[4], railBrute: b[5] });
  LEGS.push({ n, from, to, len: LEG_LENGTH, stars: n >= 3, base: HORDE[n - 1],
    scrapTarget: LEG_SCRAP_TARGETS[n - 1], ordinaryPay: LEG_ORDINARY_PAY[n - 1], wallPay: LEG_WALL_PAY[n] ?? CFG.wall.loot,
    rescue: [4, 8, 10].includes(n) ? 'rescue-' + n : null, finale: n === 12, events: LEG_EVENT_ROWS[n - 1] });
}
const legDef = (n) => LEGS[n - 1] || null;
// Scenery uses the same complete line on every retry, so cached ground stays consistent.
const STATIONS = STOPS.slice(1);

// Brief title-only event notice; streams already have their own edge marks. (proposal)
const LEG_EVENT_NOTICE = 1.8;
function legEventNotice(title, color) {
  const previous = banners[0];
  banner(title, '', color);
  if (banners[0] && banners[0] !== previous) banners[0].T = LEG_EVENT_NOTICE;
}

// Supported events use the existing spawners. Future variant events are left to
// their real feature handlers; they never masquerade as another event or earn a fired receipt.
function dispatchLegEvent(kind, params, id) {
  const p = params || {}, n = Math.max(0, Math.floor(Number(p.n) || 0));
  if (kind === 'railCrowd') {
    const before = G.zombies.length;
    if (n && !wallAhead(CFG.wall.warn)) railGroup(n, p);
    legEventNotice('RAIL CROWD', U.red);
    return G.zombies.length - before;
  }
  if (kind === 'stream') {
    const edge = [-1, 1, 0, 2].includes(p.edge) ? p.edge : 0;
    if (n) addStream(n, edge, false, { ...p, eventId: id });
    return n;
  }
  if (kind === 'silverGroup' || kind === 'explosiveStream') {
    const silver = kind === 'silverGroup';
    if (!legAllows(silver ? 'silver' : 'boom')) return null;
    const edge = p.edge === -1 ? -1 : p.edge === 1 ? 1 : 0;
    if (n) addStream(n, edge, false, { ...p, type: 0, variant: silver ? 'silver' : 'boom', eventId: id });
    return n;
  }
  if (kind === 'wave') {
    const edges = p.edges || [-1, 1];
    if (n) for (const edge of edges) addStream(n, edge, true, { ...p, eventId: id });
    G.waves++;
    return n * edges.length;
  }
  if (kind === 'pile' || kind === 'crate') {
    if (!addLegLoot(kind, p, id)) return null;
    legEventNotice(kind === 'pile' ? 'SCRAP PILE' : 'SUPPLY CRATE', U.blue);
    return 1;
  }
  if (kind === 'deadWall') return addDeadWall(p, id) ? 1 : null;
  if (kind === 'golden') return addGolden(p, id) ? 1 : null;
  if (kind === 'goldCrate') return addLegLoot('goldCrate', p, id) ? 1 : null;
  if (kind === 'rescue') return addLegRescue(p, id) ? 1 : null;
  return null;
}

// Game time pauses and slows with play. Consume every due tuple once, including unsupported
// future kinds, so a deferred feature cannot block the rest of the leg's actual events.
function updateLegEvents() {
  if (G.demo || G.result || mode !== 'play') return;
  const leg = legDef(G.leg);
  if (!leg) return;
  while (G.eventIndex < leg.events.length) {
    const index = G.eventIndex, [at, kind, params] = leg.events[index];
    if (G.run < at - 1e-9) break;
    G.eventIndex++;
    const id = 'leg-' + G.leg + '-event-' + index, n = dispatchLegEvent(kind, params, id);
    if (n !== null) G.events.push({ id, kind, at, t: G.run, n });
  }
  updateGoldenEvents();
}
// Hold events and the gift run on play time; loss, pause and menus cannot advance the gate.
function updateFinale() {
  const f = G.finale;
  if (!f || G.demo || G.result || mode !== 'play' || paused || f.phase !== 'hold') return;
  f.elapsed = Math.min(FINALEC.hold, Math.max(0, G.run - f.holdAt));
  while (f.eventIndex < FINALE_EVENTS.length) {
    const index = f.eventIndex, [at, kind, params] = FINALE_EVENTS[index];
    if (f.elapsed < at - 1e-9) break;
    f.eventIndex++;
    const id = 'leg-12-finale-' + index, n = dispatchLegEvent(kind, params, id);
    if (n !== null) G.events.push({ id, kind, at: f.holdAt + at, t: G.run, n });
  }
  if (!f.gifted && f.elapsed >= FINALEC.giftAt - 1e-9) airGift();
  if (f.elapsed >= FINALEC.hold - 1e-9) openFinaleGate();
}
// A leg record is made only when progress needs to be stored.
function legSave(n) {
  return SAVE.legs[n] || (SAVE.legs[n] = { won: false, stars: [false, false, false], paid: {} });
}

// Every gold source has a stable id within its leg. Retries keep the receipt; replays pay only
// the supplied scrap alternative. Paying immediately protects rewards even if the train is lost.
function payGold(itemId, amount, scrapIfNot, options = {}) {
  const out = { gold: 0, scrap: 0 };
  if (!G || G.demo || G.result || typeof itemId !== 'string' || !itemId) return out;
  amount = Number(amount);
  scrapIfNot = Number(scrapIfNot);
  if (!Number.isFinite(amount) || !Number.isFinite(scrapIfNot)) return out;
  amount = Math.max(0, Math.floor(amount));
  scrapIfNot = Math.max(0, Math.floor(scrapIfNot));
  const record = legSave(G.leg);
  if (G.replay || record.won || Object.prototype.hasOwnProperty.call(record.paid, itemId) || options.hunt && goldHuntPaid() >= 5) {
    out.scrap = payLootScrap(scrapIfNot);
  } else if (amount) {
    Object.defineProperty(record.paid, itemId, { value: true, enumerable: true, writable: true, configurable: true });
    out.gold = amount;
    G.gold += amount;
    if (G.leg >= 3 && !SAVE.flags.goldShown) {
      SAVE.flags.goldShown = true;
      if (SAVE.chest === 1) {
        SAVE.chest = 2;
        G.gold += 6;
        const h = G.helis[0];
        floatText(h.x, h.y - h.alt - 12, '+6 GOLD: CHEST OPENED', U.gold);
        currencyCoins('gold', h.x, h.y - h.alt, 8);
        SFX.golden();
      }
    }
  }
  bankRun();
  return out;
}
// Only receipts that actually paid extra Hunt gold count toward the approved five-gold demo cap.
function goldHuntPaid() {
  let n = 0;
  for (const record of Object.values(SAVE.legs)) for (const id of Object.keys(record?.paid || {})) if (id.startsWith('golden-hunt-') && record.paid[id] === true) n++;
  return n;
}
// Seconds for a newly earned star's small pixel pop. (proposal)
const STAR_POP = 0.35;
// Zero-based star index. Arrival awards stars1/2 before marking the leg won; a catch awards star3.
function earnLegStar(index) {
  if (G.demo || G.leg < 3 || G.replay || G.result || index < 0 || index > 2 || !Number.isInteger(index)) return 0;
  const record = legSave(G.leg);
  if (record.won || record.stars[index]) return 0;
  record.stars[index] = true;
  const paid = payGold('star-' + (index + 1), 3, 0);
  if (!G.starAt) G.starAt = [null, null, null];
  G.starAt[index] = realT;
  SFX.tick();
  if (paid.gold) floatText(G.helis[0].x, G.helis[0].y - G.helis[0].alt - 20, 'STAR ' + (index + 1) + ': +3 GOLD', U.gold);
  return paid.gold;
}
