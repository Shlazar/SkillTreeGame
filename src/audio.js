// audio.js - all sound, made live with the Web Audio API (no sound files). The engine follows
// Ball x Archers: audioInit builds the graph (master -> compressor, plus a light reverb), voice and
// gap limit how often a sound can play, tone and nz make one synth note or one noise burst.
// SFX holds every game sound; drone() is the helicopter's rotor under everything.

const Au = { ctx: null, master: null, noise: null, muted: false, last: {}, hum: null };

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
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
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
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
  s.start(t, Math.random() * 0.4, d + 0.05);
}

// The helicopter: rotor noise through a low-pass filter, chopped by the blades (an LFO on its
// loudness), and a faint turbine whine. v = loudness 0..1 (0 = silent); it glides to the new level.
function drone(v) {
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
    } catch (e) {
      return;
    }
  }
  Au.hum.gain.setTargetAtTime(Au.muted ? 0 : v * 0.18, a.currentTime, 0.5);
}

// Every game sound, built from tone() and nz().
const SFX = {
  mg() {
    // the 25mm: a hard, short thump
    if (!gap('mg', 55)) return;
    nz(0.09, 0.075, 'lowpass', 1900, 0.9, 260);
    tone(118, 0.07, 'square', 0.022, 52);
  },
  pop() {
    // a 25mm round bursts on the ground
    if (!gap('pop', 32)) return;
    nz(0.13, 0.04, 'bandpass', rnd(480, 900), 1.1, 150);
    tone(rnd(160, 220), 0.06, 'triangle', 0.016, 70);
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
    const p = rnd(0.85, 1.15);
    nz(1.1, 0.27, 'lowpass', 1000 * p, 0.7, 45);
    tone(50 * p, 0.8, 'sine', 0.24, 24);
    nz(0.6, 0.05, 'highpass', 2600, 0.7, 900, 0.06);
  },
  splat() {
    if (!gap('splat', 28)) return;
    nz(0.06, 0.035, 'bandpass', rnd(260, 520), 1.6, 140);
  },
  hit() {
    if (!gap('hit', 45)) return;
    nz(0.04, 0.045, 'bandpass', rnd(650, 1100), 2, 260);
  },
  coin() {
    if (!gap('coin', 70)) return;
    const f = rnd(2500, 2900);
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
  upgrade() {
    // the wallet can pay for a new upgrade
    tone(523, 0.1, 'triangle', 0.04);
    tone(659, 0.1, 'triangle', 0.04, null, 0.08);
    tone(784, 0.22, 'triangle', 0.045, null, 0.16);
  },
  buy() {
    // an upgrade bought: a till and a rising chime
    nz(0.05, 0.05, 'bandpass', 3200, 2);
    tone(784, 0.06, 'square', 0.02);
    tone(1175, 0.12, 'triangle', 0.04, null, 0.05);
    tone(1568, 0.16, 'triangle', 0.03, null, 0.1);
  },
  tick() {
    // a summary row comes up
    tone(1500, 0.025, 'square', 0.012);
  },
  warn() {
    // the train is nearly lost: two low, urgent notes
    if (!gap('warn', 250)) return;
    tone(196, 0.16, 'square', 0.03, 185);
    tone(196, 0.2, 'square', 0.03, 165, 0.2);
  },
  horn() {
    // the train's horn: three sawtooth notes of a chord, a little flat at first, through a low-pass filter
    const a = Au.ctx;
    if (!a || Au.muted) return;
    const t = a.currentTime, f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.setValueAtTime(0.05, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    for (const fr of [311, 370, 466]) {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * 0.97, t);
      o.frequency.linearRampToValueAtTime(fr, t + 0.12);
      o.connect(f);
      o.start(t);
      o.stop(t + 1.15);
    }
    f.connect(g);
    g.connect(Au.master);
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
    nz(0.06, 0.04, 'bandpass', rnd(400, 700), 1.5);
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
  }
};
