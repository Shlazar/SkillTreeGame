// audio.js - all sound, made live with the Web Audio API (no sound files). The engine follows
// Ball x Archers: audioInit builds the graph (master -> compressor, plus a light reverb), voice and
// gap limit how often a sound can play, tone and nz make one synth note or one noise burst.
// SFX holds every game sound; drone() is the helicopter's rotor under everything.

const Au = { ctx: null, master: null, noise: null, muted: false, last: {}, hum: null, roar: null };
// Audio voice/gap limits use wall time. Their random draws must never advance combat's RNG.
const audioRandom = mulberry(0xa0d10);
const audioRnd = (a, b) => b === undefined ? audioRandom() * a : a + audioRandom() * (b - a);
// Ready swoosh: gate ms, burst/note seconds, volumes and rising filter/note frequencies (proposal)
const PLANE_READY_SFX = { gap: 90, life: 0.22, volume: 0.065, from: 500, to: 2300,
  q: 0.7, note: 380, noteEnd: 740, noteLife: 0.16, noteVolume: 0.012 };
// Flyover roar: simultaneous voices, seconds, volumes and falling filter/note frequencies (proposal)
const PLANE_ROAR_SFX = { voices: 2, life: 1.2, volume: 0.12, from: 2200, to: 160,
  q: 0.8, note: 180, noteEnd: 50, noteVolume: 0.03 };

function audioInit() {
  if (Au.ctx) {
    if (Au.ctx.state === 'suspended') Au.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const a = new AC();
    Au.ctx = a;
    Au.master = a.createGain();
    Au.master.gain.value = 0.5;
    const comp = a.createDynamicsCompressor();
    Au.master.connect(comp);
    comp.connect(a.destination);
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    // reverb: 1.3 s of fading noise as the impulse response
    const ir = a.createBuffer(2, a.sampleRate * 1.3 | 0, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (audioRandom() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    }
    const rv = a.createConvolver();
    rv.buffer = ir;
    const wet = a.createGain();
    wet.gain.value = 0.15;
    Au.master.connect(rv);
    rv.connect(wet);
    wet.connect(comp);
    // 1 second of white noise, shared by all noise sounds
    const b = a.createBuffer(1, a.sampleRate, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = audioRandom() * 2 - 1;
    Au.noise = b;
  } catch (e) {
    Au.ctx = null;
  }
}

// voice: at most max copies of sound id at once (each copy lasts dur seconds).
const VO = {};
function voice(id, max, dur) {
  const t = Au.ctx ? Au.ctx.currentTime : 0, a = (VO[id] || []).filter((x) => x > t);
  VO[id] = a;
  if (a.length >= max) return false;
  a.push(t + dur);
  return true;
}
// gap: sound id again only after ms milliseconds.
function gap(id, ms) {
  const t = performance.now();
  if (Au.last[id] && t - Au.last[id] < ms) return false;
  Au.last[id] = t;
  return true;
}

// One synth note: frequency f, duration d (s), wave type, volume v, optional slide to f2, delay (s).
function tone(f, d, type, v, f2, delay) {
  const a = Au.ctx;
  if (!a || Au.muted) return;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g);
  g.connect(Au.master);
  o.start(t);
  o.stop(t + d + 0.03);
}
// One noise burst: duration d, volume v, filter type ft at frequency f with Q q, optional filter
// sweep to f2, delay (s).
function nz(d, v, ft, f, q, f2, delay) {
  const a = Au.ctx;
  if (!a || Au.muted || !Au.noise) return;
  const t = a.currentTime + (delay || 0);
  const s = a.createBufferSource();
  s.buffer = Au.noise;
  const fl = a.createBiquadFilter();
  fl.type = ft || 'lowpass';
  fl.frequency.setValueAtTime(f || 1000, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + d);
  fl.Q.value = q || 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl);
  fl.connect(g);
  g.connect(Au.master);
  s.start(t, audioRandom() * 0.4, d + 0.05);
}

// The helicopter: rotor noise through a low-pass filter, chopped by the blades (an LFO on its
// loudness), and a faint turbine whine. v = loudness 0..1 (0 = silent); it glides to the new level.
// k = 0..1: how much higher it all plays (the Turbo Ram).
function drone(v, k) {
  const a = Au.ctx;
  if (!a || !Au.noise) return;
  if (!Au.hum) {
    try {
      const out = a.createGain(), chop = a.createGain(), f = a.createBiquadFilter(), src = a.createBufferSource();
      out.gain.value = 0;
      src.buffer = Au.noise;
      src.loop = true;
      f.type = 'lowpass';
      f.frequency.value = 340;
      f.Q.value = 0.9;
      chop.gain.value = 0.55;
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = 6.4;
      lg.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(chop.gain);
      src.connect(f);
      f.connect(chop);
      chop.connect(out);
      const whine = a.createOscillator(), wg = a.createGain();
      whine.frequency.value = 1850;
      wg.gain.value = 0.01;
      whine.connect(wg);
      wg.connect(out);
      out.connect(Au.master);
      src.start();
      lfo.start();
      whine.start();
      Au.hum = out;
      Au.humP = [f.frequency, lfo.frequency, whine.frequency];
    } catch (e) {
      return;
    }
  }
  const t = a.currentTime;
  k = k || 0;
  Au.hum.gain.setTargetAtTime(Au.muted ? 0 : v * 0.18, t, 0.5);
  Au.humP[0].setTargetAtTime(340 * (1 + 0.7 * k), t, 0.25);
  Au.humP[1].setTargetAtTime(6.4 + 3.6 * k, t, 0.25);
  Au.humP[2].setTargetAtTime(1850 * (1 + 0.3 * k), t, 0.25);
}

// Every game sound, built from tone() and nz().
const SFX = {
  mg() {
    // the 25mm: a hard, punchy thump with a crack on top
    if (!gap('mg', 55)) return;
    nz(0.12, 0.1, 'lowpass', 2400, 0.9, 220);
    tone(150, 0.09, 'square', 0.032, 46);
    nz(0.025, 0.035, 'highpass', 3200);
  },
  rocket() {
    // A brief launch whoosh and a falling pitch keep the rocket distinct from the gun.
    if (!gap('rocket', 70)) return;
    nz(0.2, 0.09, 'bandpass', 1700, 0.8, 320);
    tone(360, 0.18, 'sawtooth', 0.025, 90);
  },
  pop() {
    // a 25mm round bursts on the ground
    if (!gap('pop', 32)) return;
    nz(0.13, 0.04, 'bandpass', audioRnd(480, 900), 1.1, 150);
    tone(audioRnd(160, 220), 0.06, 'triangle', 0.016, 70);
  },
  cannon() {
    // the 105 fires: a deep blast
    tone(64, 0.55, 'sine', 0.24, 28);
    nz(0.4, 0.17, 'lowpass', 750, 0.7, 90);
    nz(0.08, 0.06, 'highpass', 2600);
  },
  whistle(d) {
    // the shell falling
    tone(1700, d, 'sine', 0.009, 520);
  },
  boom() {
    if (!voice('boom', 3, 1)) return;
    const p = audioRnd(0.85, 1.15);
    nz(1.1, 0.27, 'lowpass', 1000 * p, 0.7, 45);
    tone(50 * p, 0.8, 'sine', 0.24, 24);
    nz(0.6, 0.05, 'highpass', 2600, 0.7, 900, 0.06);
  },
  splat() {
    // a kill: a wet smack and a short knock
    if (!gap('splat', 28)) return;
    nz(0.07, 0.05, 'bandpass', audioRnd(260, 520), 1.6, 140);
    tone(audioRnd(300, 360), 0.05, 'triangle', 0.02, 110);
  },
  hit() {
    if (!gap('hit', 45)) return;
    nz(0.04, 0.045, 'bandpass', audioRnd(650, 1100), 2, 260);
  },
  coin() {
    if (!gap('coin', 70)) return;
    const f = audioRnd(2500, 2900);
    tone(f, 0.05, 'sine', 0.012);
    tone(f * 1.49, 0.035, 'sine', 0.007, null, 0.012);
    nz(0.02, 0.01, 'highpass', 6500);
  },
  lock() {
    if (!gap('lock', 120)) return;
    tone(2300, 0.03, 'square', 0.007);
  },
  ready() {
    // the 105 is loaded again
    tone(1250, 0.04, 'square', 0.014);
    tone(1650, 0.05, 'square', 0.014, null, 0.05);
  },
  planeReady() {
    const c = PLANE_READY_SFX;
    if (!gap('planeReady', c.gap)) return;
    nz(c.life, c.volume, 'bandpass', c.from, c.q, c.to);
    tone(c.note, c.noteLife, 'triangle', c.noteVolume, c.noteEnd);
  },
  planeRoar() {
    const c = PLANE_ROAR_SFX;
    if (!voice('planeRoar', c.voices, c.life)) return;
    nz(c.life, c.volume, 'lowpass', c.from, c.q, c.to);
    tone(c.note, c.life, 'sawtooth', c.noteVolume, c.noteEnd);
  },
  overheat() {
    tone(900, 0.35, 'square', 0.02, 300);
    nz(0.45, 0.04, 'highpass', 4000, 0.7, 1500);
  },
  ui() {
    tone(620, 0.035, 'square', 0.022);
  },
  banner() {
    tone(392, 0.14, 'triangle', 0.045);
    tone(587, 0.22, 'triangle', 0.045, null, 0.1);
  },
  fanfare() {
    tone(523, 0.1, 'triangle', 0.04);
    tone(659, 0.1, 'triangle', 0.04, null, 0.08);
    tone(784, 0.22, 'triangle', 0.045, null, 0.16);
  },
  warn() {
    // the train is nearly lost: two low, urgent notes
    if (!gap('warn', 250)) return;
    tone(196, 0.16, 'square', 0.03, 185);
    tone(196, 0.2, 'square', 0.03, 165, 0.2);
  },
  horn(k, delay, len) {
    // the train's horn: three sawtooth notes of a chord, a little flat at first, through a low-pass
    // filter. k = pitch (1 = normal), delay (s), len = how long it blows (s)
    const a = Au.ctx;
    if (!a || Au.muted) return;
    k = k || 1;
    len = len || 1.1;
    const t = a.currentTime + (delay || 0), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass';
    f.frequency.value = 1400 * k;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.setValueAtTime(0.05, t + len - 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    for (const fr of [311, 370, 466]) {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * k * 0.97, t);
      o.frequency.linearRampToValueAtTime(fr * k, t + 0.12);
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    f.connect(g);
    g.connect(Au.master);
  },
  ramGo(d) {
    // TURBO RAM: the horn twice (the second higher), a burst, and the roar for d s
    SFX.horn(1, 0, 0.45);
    SFX.horn(1.26, 0.42, 0.8);
    nz(0.7, 0.14, 'lowpass', 2400, 0.7, 160);
    SFX.roar(d, true);
  },
  roar(d, fresh) {
    // the Ram's roar for d s: it rises from low (fresh), or comes straight back at full pitch (after a
    // pause), holds, and dies away over its last second. Au.roar keeps it, so ramStop can cut it.
    SFX.ramStop(0.05);
    const a = Au.ctx;
    if (!a || Au.muted || d < 0.1) return;
    const t = a.currentTime, f = a.createBiquadFilter(), g = a.createGain(), os = [];
    const rise = fresh ? Math.min(1.4, d * 0.5) : 0.1, fall = Math.min(1, d * 0.5), hold = Math.max(rise, d - fall);
    f.type = 'lowpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(fresh ? 260 : 1300, t);
    f.frequency.exponentialRampToValueAtTime(1300, t + rise);
    f.frequency.setValueAtTime(1300, t + hold);
    f.frequency.exponentialRampToValueAtTime(300, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + Math.min(0.25, rise));
    g.gain.setValueAtTime(0.055, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const [fr, type] of [[46, 'sawtooth'], [69.5, 'square'], [92.5, 'sawtooth']]) {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(fresh ? fr : fr * 2.2, t);
      o.frequency.exponentialRampToValueAtTime(fr * 2.2, t + rise);
      o.frequency.setValueAtTime(fr * 2.2, t + hold);
      o.frequency.exponentialRampToValueAtTime(fr * 1.2, t + d);
      o.connect(f);
      o.start(t);
      o.stop(t + d + 0.05);
      os.push(o);
    }
    f.connect(g);
    g.connect(Au.master);
    Au.roar = { g, os };
  },
  ramStop(fade) {
    // the roar fades out over fade s (the Ram was cut short, the game paused, the train was lost)
    const a = Au.ctx, R = Au.roar;
    if (!a || !R) return;
    Au.roar = null;
    const t = a.currentTime, p = R.g.gain, e = fade || 0.25;
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(0.0001, p.value), t);
    p.exponentialRampToValueAtTime(0.0001, t + e);
    for (const o of R.os) {
      try { o.stop(t + e + 0.05); } catch (err) { /* it has stopped already */ }
    }
  },
  crunch(n) {
    // the Ram smashes one: a crunch that climbs with the count
    if (!gap('crunch', 34)) return;
    const p = Math.min(2.4, 1 + n * 0.045);
    nz(0.12, 0.1, 'lowpass', 900 * p, 0.8, 150);
    tone(84 * p, 0.09, 'triangle', 0.06, 44 * p);
    nz(0.05, 0.05, 'bandpass', 620 * p, 1.6);
  },
  hiss() {
    // a long hiss of steam
    nz(1.6, 0.075, 'highpass', 4200, 0.7, 1800);
    nz(1.3, 0.04, 'bandpass', 2600, 0.6, 1400, 0.05);
  },
  ramReady() {
    // the Ram is full again: a rising beep and a chime
    tone(784, 0.07, 'square', 0.02);
    tone(1175, 0.1, 'square', 0.02, null, 0.08);
    tone(2349, 0.16, 'sine', 0.018, null, 0.17);
  },
  crack() {
    // the boiler cracks: a clank of metal, then steam
    tone(196, 0.3, 'square', 0.04, 82);
    nz(0.35, 0.09, 'bandpass', 1400, 3, 380);
    tone(1480, 0.12, 'triangle', 0.02, 1100, 0.04);
    nz(1.2, 0.05, 'highpass', 3600, 0.7, 1500, 0.15);
  },
  slow() {
    // time slows down (PRESS E!)
    tone(330, 0.7, 'sine', 0.06, 82);
    nz(0.6, 0.05, 'lowpass', 900, 0.7, 110);
  },
  rank(n) {
    // the Ram's rank: SMASH, RAMPAGE, UNSTOPPABLE (one more note for each)
    const notes = n >= 30 ? [523, 659, 784, 1047] : n >= 15 ? [523, 659, 784] : [523, 784];
    notes.forEach((f, i) => tone(f, 0.12 + (i === notes.length - 1 ? 0.18 : 0), 'triangle', 0.045, null, i * 0.08));
    tone(98, 0.35, 'sine', 0.07, 55);
  },
  gun() {
    // the flatcar gun: a light, dry knock
    if (!gap('gun', 60)) return;
    nz(0.05, 0.035, 'bandpass', 1500, 1.2, 600);
    tone(230, 0.04, 'square', 0.011, 120);
  },
  clack() {
    // the wheels over a rail joint
    nz(0.03, 0.02, 'bandpass', 2200, 3);
    nz(0.03, 0.016, 'bandpass', 1800, 3, null, 0.09);
  },
  crush(big) {
    // the engine runs one down
    if (!gap('crush', 40)) return;
    nz(0.14, big ? 0.12 : 0.07, 'lowpass', 600, 0.8, 120);
    tone(big ? 70 : 110, 0.1, 'triangle', 0.05, 50);
    nz(0.06, 0.04, 'bandpass', audioRnd(400, 700), 1.5);
  },
  saved() {
    // a survivor made it aboard: a bright double chime
    tone(988, 0.08, 'triangle', 0.035);
    tone(1319, 0.14, 'triangle', 0.035, null, 0.07);
  },
  radio() {
    // a burst of radio static and a beep
    nz(0.22, 0.03, 'bandpass', 1900, 2.5);
    tone(1000, 0.07, 'square', 0.012, null, 0.03);
  },
  tick() {
    // a row of the summary counts up
    if (!gap('tick', 40)) return;
    tone(1500, 0.025, 'square', 0.016);
    nz(0.015, 0.012, 'highpass', 5000);
  },
  total() {
    // the summary's total: a coin chime on a rising chord
    tone(659, 0.12, 'triangle', 0.04);
    tone(988, 0.16, 'triangle', 0.04, null, 0.07);
    tone(2637, 0.08, 'sine', 0.016, null, 0.14);
    tone(3520, 0.1, 'sine', 0.01, null, 0.17);
  },
  buy(big) {
    // a skill tree node bought: two rising notes and a coin (a big unlock adds a low thump and a
    // third note)
    tone(523, 0.09, 'triangle', 0.04);
    tone(784, 0.14, 'triangle', 0.045, null, 0.07);
    if (big) {
      tone(1047, 0.22, 'triangle', 0.04, null, 0.15);
      tone(98, 0.3, 'sine', 0.08, 55);
    }
    tone(2637, 0.06, 'sine', 0.016, null, 0.15);
    tone(3520, 0.09, 'sine', 0.011, null, 0.18);
    nz(0.03, 0.012, 'highpass', 6500, null, null, 0.15);
  },
  deny() {
    // that can't be done yet: a short low buzz
    if (!gap('deny', 150)) return;
    tone(150, 0.12, 'square', 0.025, 110);
  }
};
