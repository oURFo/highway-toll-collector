// ===== Web Audio 合成音效（無外部音檔） =====
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let siren = null;
  let noiseBuf = null;

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
  }

  function env(g, t0, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone(freq, dur, { type = 'sine', vol = 0.25, when = 0, slide = null, attack = 0.01, filter = null } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, vol, attack, dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, when = 0, freq = 1200, type = 'bandpass', q = 1, attack = 0.005 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t0, vol, attack, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.05);
  }

  return {
    init,
    setMuted,
    get muted() { return muted; },
    engineIn() {
      tone(140, 1.0, { type: 'sawtooth', vol: 0.12, slide: 50, filter: 380, attack: 0.05 });
      noise(0.9, { vol: 0.05, freq: 300, type: 'lowpass' });
    },
    engineOut() {
      tone(55, 1.1, { type: 'sawtooth', vol: 0.14, slide: 190, filter: 500, attack: 0.05 });
    },
    honk(long = false) {
      const d = long ? 0.6 : 0.16;
      [0, long ? 0 : 0.22].forEach((w) => {
        tone(392, d, { type: 'square', vol: 0.09, when: w, filter: 1600 });
        tone(494, d, { type: 'square', vol: 0.07, when: w, filter: 1600 });
      });
    },
    farHonk() {
      const f = rand(330, 460);
      tone(f, 0.22, { type: 'square', vol: 0.035, filter: 900 });
    },
    tear() {
      noise(0.09, { vol: 0.35, freq: 3500, type: 'highpass' });
      noise(0.07, { vol: 0.3, freq: 2800, type: 'highpass', when: 0.08 });
    },
    coin() {
      tone(2300, 0.18, { vol: 0.12 });
      tone(3400, 0.14, { vol: 0.07, when: 0.03 });
    },
    bill() {
      noise(0.16, { vol: 0.2, freq: 1500, q: 0.7 });
    },
    give() {
      [0, 0.06, 0.12].forEach((w) => tone(2100 + w * 3000, 0.12, { vol: 0.08, when: w }));
      noise(0.12, { vol: 0.15, freq: 1400, when: 0.05 });
    },
    gate() {
      tone(85, 0.5, { type: 'square', vol: 0.06, filter: 400, attack: 0.03 });
      noise(0.04, { vol: 0.25, freq: 2000, when: 0.48 });
    },
    shutter() {
      noise(0.03, { vol: 0.5, freq: 4000, type: 'highpass' });
      noise(0.05, { vol: 0.4, freq: 2500, type: 'highpass', when: 0.07 });
    },
    crash() {
      noise(0.9, { vol: 0.8, freq: 900, type: 'lowpass' });
      tone(70, 0.6, { vol: 0.5, slide: 30 });
      noise(0.4, { vol: 0.35, freq: 3500, type: 'highpass', when: 0.1 });
    },
    alarm() {
      [0, 0.18, 0.36].forEach((w) => tone(1150, 0.12, { type: 'square', vol: 0.07, when: w, filter: 3000 }));
    },
    good() {
      tone(880, 0.12, { vol: 0.12 });
      tone(1320, 0.18, { vol: 0.1, when: 0.08 });
    },
    error() {
      tone(150, 0.25, { type: 'square', vol: 0.09, filter: 700 });
    },
    tick() {
      tone(1800, 0.05, { vol: 0.08 });
    },
    stamp() {
      tone(90, 0.3, { vol: 0.5, slide: 45 });
      noise(0.15, { vol: 0.4, freq: 500, type: 'lowpass' });
    },
    sirenStart(loud = false) {
      if (!ctx) return;
      if (siren) { siren.g.gain.setTargetAtTime(loud ? 0.16 : 0.07, ctx.currentTime, 0.05); return; }
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 800;
      lfo.type = 'square';
      lfo.frequency.value = 1.25;
      lg.gain.value = 160;
      lfo.connect(lg).connect(o.frequency);
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(loud ? 0.16 : 0.07, ctx.currentTime, 0.1);
      o.connect(g).connect(master);
      o.start();
      lfo.start();
      siren = { o, lfo, g };
    },
    sirenStop() {
      if (!siren || !ctx) return;
      const s = siren;
      siren = null;
      s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      s.o.stop(ctx.currentTime + 0.8);
      s.lfo.stop(ctx.currentTime + 0.8);
    },
  };
})();
