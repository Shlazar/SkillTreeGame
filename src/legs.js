// legs.js - the Farmlands route: one short ride between each pair of stops. This table is the
// source for the route map, station rewards and timed events. Leg numbers shown to players are 1..12.

// Rail px between stations: about 60 s at the train's 40 px/s cruise. (proposal)
const LEG_LENGTH = 2400;
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
const LEGS = [];
for (let n = 1; n < STOPS.length; n++) {
  const from = STOPS[n - 1], to = STOPS[n];
  to.km = from.km + LEG_LENGTH / CFG.line.km;
  to.side = n % 2 ? 1 : -1;
  // A supported starting timeline, replaced with each leg's introductions by the next task.
  // Event seconds, crowd sizes and pile placement/value (proposal)
  LEGS.push({ n, from, to, len: LEG_LENGTH, stars: n >= 3, base: HORDE[n - 1],
    rescue: [4, 8, 10].includes(n) ? 'rescue-' + n : null, finale: n === 12, events: [
      [3, 'railCrowd', { n: 6 }], [12, 'stream', { edge: -1, n: 12 }],
      [22, 'pile', { ahead: 120, off: 100, side: 1, pay: 15 }],
      [32, 'stream', { edge: 1, n: 14 }], [42, 'railCrowd', { n: 8 }], [52, 'wave', { n: 10 }]
    ] });
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

// Supported events use the existing spawners. Future gold, wall and rescue events are left to
// their real feature handlers; they never masquerade as another event or earn a fired receipt.
function dispatchLegEvent(kind, params, id) {
  const p = params || {}, n = Math.max(0, Math.floor(Number(p.n) || 0));
  if (kind === 'railCrowd') {
    const before = G.zombies.length;
    if (n && !wallAhead(CFG.wall.warn)) railGroup(n);
    legEventNotice('RAIL CROWD', U.red);
    return G.zombies.length - before;
  }
  if (kind === 'stream') {
    const edge = p.edge === -1 ? -1 : p.edge === 1 ? 1 : 0;
    if (n) addStream(n, edge, false);
    return n;
  }
  if (kind === 'wave') {
    if (n) { addStream(n, -1, true); addStream(n, 1, true); }
    G.waves++;
    return n * 2;
  }
  if (kind === 'pile' || kind === 'crate') {
    if (!addLegLoot(kind, p, id)) return null;
    legEventNotice(kind === 'pile' ? 'SCRAP PILE' : 'SUPPLY CRATE', U.blue);
    return 1;
  }
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
}
// A leg record is made only when progress needs to be stored.
function legSave(n) {
  return SAVE.legs[n] || (SAVE.legs[n] = { won: false, stars: [false, false, false], paid: {} });
}

// Every gold source has a stable id within its leg. Retries keep the receipt; replays pay only
// the supplied scrap alternative. Paying immediately protects rewards even if the train is lost.
function payGold(itemId, amount, scrapIfNot) {
  const out = { gold: 0, scrap: 0 };
  if (!G || G.demo || G.result || typeof itemId !== 'string' || !itemId) return out;
  amount = Number(amount);
  scrapIfNot = Number(scrapIfNot);
  if (!Number.isFinite(amount) || !Number.isFinite(scrapIfNot)) return out;
  amount = Math.max(0, Math.floor(amount));
  scrapIfNot = Math.max(0, Math.floor(scrapIfNot));
  const record = legSave(G.leg);
  if (G.replay || record.won || Object.prototype.hasOwnProperty.call(record.paid, itemId)) {
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
