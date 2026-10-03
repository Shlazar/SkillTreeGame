// Run mode: no station holds or old crowds; destination braking is part of the new leg route.
__sr.reset();
__sr.start();
__sr.hp(9999);
__sr.bot(true);
const stationStates = new Set();
let peopleArray = true;
let peopleEmpty = true;
for (let second = 1; second <= 60; second++) {
  __sr.sim(1);
  const state = __sr.G.station ? __sr.G.station.state : 'none';
  stationStates.add(state);
  if (state === 'hold') {
    throw new Error('Station entered ' + state + ' at second ' + second);
  }
  for (const station of __sr.G.stations) {
    if (station.state === 'hold') {
      throw new Error(station.id + ' entered ' + station.state + ' at second ' + second);
    }
  }
  peopleArray = peopleArray && Array.isArray(__sr.G.people);
  peopleEmpty = peopleEmpty && Array.isArray(__sr.G.people) && __sr.G.people.length === 0;
}
const ride = __sr.stats();
if (ride.km <= 1.05) throw new Error('Train did not reach Millbrook: ' + ride.km + ' km');
if (!peopleArray || !peopleEmpty) throw new Error('Station survivor array is missing or not empty');

// Keep this setup identical to t0_3_stations_shot.js so run mode catches its draw errors.
__sr.reset();
__sr.setLeg(2);
__sr.start(2);
__sr.hp(9999);
__sr.bot(true);
__sr.frames(30);
__sr.hold(true);
const station = __sr.G.stops.find((stop) => stop.id === 'millbrook');
if (!station) throw new Error('Millbrook scenery was not built');
if (!Array.isArray(__sr.G.people) || __sr.G.people.length !== 0) {
  throw new Error('Leg-2 start created station survivors');
}
QA_DONE({
  seconds: 60,
  km: ride.km,
  mode: ride.mode,
  stationStates: [...stationStates],
  peopleArray,
  peopleEmpty,
  stationShot: { station: station.id, state: station.state, statics: __sr.G.statics.length }
});
