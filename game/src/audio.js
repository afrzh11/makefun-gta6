// Synthesized sound effects only — WebAudio oscillators and noise, no audio files.
// The context is created lazily on the first user gesture (browsers block audio before it).
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave that alternates between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* sound is decoration, never fatal */ }
  }

  function thudNoise() {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.35;
    },
    isMuted() { return muted; },
    /** speed01: 0..1 of the car's top speed. engineOn false silences it. */
    engine(speed01, on) {
      if (!ctx || muted) return;
      if (engineGain) engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
      if (engineOsc) engineOsc.frequency.value = 55 + speed01 * 130;
    },
    /** Call every frame; heat>0 keeps the siren wailing. */
    siren(on, dt) {
      if (!ctx || muted) return;
      if (sirenGain) sirenGain.gain.value = on ? 0.035 : 0;
      if (!on || !sirenOsc) return;
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 950 : 700;
      }
    },
    chime() { blip(880, 0.12, 'sine', 0.25); setTimeout(() => blip(1318, 0.18, 'sine', 0.2), 90); },
    thud() { thudNoise(); blip(70, 0.18, 'sine', 0.5, 40); },
    honk() { blip(370, 0.16, 'square', 0.12); },
    click() { blip(660, 0.05, 'sine', 0.15); },
  };
}
