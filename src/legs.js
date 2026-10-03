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
  LEGS.push({ n, from, to, len: LEG_LENGTH, stars: n >= 3,
    rescue: [4, 8, 10].includes(n) ? 'rescue-' + n : null, finale: n === 12, events: [] });
}
const legDef = (n) => LEGS[n - 1] || null;
