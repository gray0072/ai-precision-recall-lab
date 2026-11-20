'use strict';

// ============================================================
// AI Precision Recall Lab — the Web Audio engine and the sound recipes (spec 04 §7), after ivan's
// city-builder/core/audio.js: one AudioContext, created on the first user gesture, and one master gain every
// sound goes through, set to 0 while the sound is off (never a flag checked in each sound). The Sound On / Off
// choice is remembered as prLab.sound and read here, before the first sound. tone() and noise() are the
// building blocks; Sfx holds the recipes; GameAudio.hum is the belt's low hum.
// Used by game.js (ensure on the first button press, the Sound switch), ui/screens.js (the Sound toggle) and
// ui/sounds.js, the only file that decides when a sound plays.
// ============================================================

const GameAudio = {
  ctx: null,
  master: null,
  on: Store.get('sound', 'on') !== 'off',

  // create (or wake) the context; call from a user gesture
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 1 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setOn(on) {
    this.on = !!on;
    if (this.master) this.master.gain.value = this.on ? 1 : 0;
    Store.set('sound', this.on ? 'on' : 'off');
  },

  // a tone gliding from f0 to f1 Hz over dur seconds, with a short attack and a fade out, `delay` s from now
  tone(f0, f1, dur, type, gain, delay) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },

  // two seconds of white noise, made once (decorative randomness: not the simulation's, so Math.random is fine)
  noiseBuffer() {
    if (!this.noiseBuf) {
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 2, sr);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  },

  // a burst of noise through a filter whose frequency glides from f0 to f1
  noise(dur, gain, type, f0, f1, delay, q) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  },

  notes(list, type, gain, step, len) {
    list.forEach((f, i) => this.tone(f, f, len || step * 1.6, type, gain, i * step));
  },

  // the belt's hum: filtered noise and a low sine on a loop, level 0..1 (0 = silent), glides to the level
  hum: {
    src: null, osc: null, gain: null,
    set(level) {
      const a = GameAudio, c = a.ctx;
      if (!c) return;
      if (!this.gain) {
        this.gain = c.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(a.master);
        this.src = c.createBufferSource();
        this.src.buffer = a.noiseBuffer();
        this.src.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 260;
        this.src.connect(f).connect(this.gain);
        this.src.start();
        this.osc = c.createOscillator();
        this.osc.frequency.value = 55;
        const og = c.createGain();
        og.gain.value = 0.25;
        this.osc.connect(og).connect(this.gain);
        this.osc.start();
      }
      this.gain.gain.setTargetAtTime(0.06 * Math.max(0, Math.min(1, level)), c.currentTime, 0.3);
    }
  }
};

// the recipes (04 §7): short, soft, and quiet for the frequent ones
const Sfx = {
  tp() { GameAudio.tone(660, 990, 0.16, 'sine', 0.09); GameAudio.tone(1320, 1320, 0.12, 'sine', 0.025, 0.05); },
  tn() { GameAudio.tone(1800, 1500, 0.025, 'sine', 0.012); },
  fp() { GameAudio.tone(150, 80, 0.16, 'sine', 0.22); GameAudio.noise(0.09, 0.06, 'lowpass', 700, 200); },
  fn() { GameAudio.tone(95, 90, 0.28, 'sawtooth', 0.05); GameAudio.tone(98, 92, 0.28, 'square', 0.025); },
  cough() { GameAudio.noise(0.12, 0.2, 'bandpass', 900, 500, 0, 1.5); GameAudio.noise(0.16, 0.16, 'bandpass', 800, 400, 0.17, 1.5); },
  // one search query decided at once (C11): a short "shuffle" of pages and a note, higher the better the share
  query(share) {
    GameAudio.noise(0.1, 0.05, 'highpass', 3000, 1800);
    GameAudio.tone(440 + 440 * share, 440 + 440 * share, 0.14, 'triangle', 0.06, 0.05);
  },
  coin() {
    for (let i = 0; i < 2; i++) { GameAudio.tone(1800, 1800, 0.08, 'square', 0.02, i * 0.08); GameAudio.tone(2400, 2400, 0.14, 'sine', 0.035, i * 0.08 + 0.03); }
  },
  goalMet() { GameAudio.notes([784, 1047, 1319], 'triangle', 0.06, 0.08); },
  warning() { GameAudio.tone(520, 520, 0.12, 'square', 0.04); GameAudio.tone(390, 390, 0.18, 'square', 0.04, 0.14); },
  blip() { GameAudio.tone(1400, 1400, 0.06, 'square', 0.035); GameAudio.tone(1400, 1400, 0.06, 'square', 0.035, 0.12); GameAudio.noise(0.25, 0.02, 'bandpass', 2000, 2000, 0, 3); },
  alarm() { for (let i = 0; i < 2; i++) { GameAudio.tone(880, 880, 0.16, 'square', 0.04, i * 0.36); GameAudio.tone(660, 660, 0.16, 'square', 0.04, i * 0.36 + 0.18); } },
  star(i) { const f = [659, 880, 1175][Math.min(2, i)]; GameAudio.tone(f, f, 0.35, 'triangle', 0.09); GameAudio.tone(f * 2, f * 2, 0.25, 'sine', 0.025, 0.02); },
  register() {
    GameAudio.noise(0.08, 0.1, 'highpass', 2500, 1500);
    GameAudio.tone(2600, 2600, 0.5, 'sine', 0.05, 0.08); GameAudio.tone(3300, 3300, 0.45, 'sine', 0.03, 0.08);
    GameAudio.noise(0.2, 0.08, 'lowpass', 900, 300, 0.12);
  },
  retrained() { GameAudio.notes([523, 659, 784, 1047], 'triangle', 0.06, 0.08); },
  deskFull() { GameAudio.tone(240, 220, 0.1, 'square', 0.03); },
  phase() { GameAudio.notes([523, 784], 'triangle', 0.07, 0.12); GameAudio.tone(1047, 1047, 0.3, 'sine', 0.04, 0.24); },
  pile() { GameAudio.noise(0.35, 0.06, 'bandpass', 1800, 600, 0, 0.7); },
  failed() { GameAudio.notes([392, 370, 349, 262], 'sawtooth', 0.05, 0.3, 0.45); },
  done() { GameAudio.notes([523, 659, 784, 1047], 'triangle', 0.07, 0.1, 0.25); },
  rocket() { GameAudio.tone(500 + Math.random() * 200, 1300 + Math.random() * 400, 0.45, 'sine', 0.025); },
  bang() { GameAudio.tone(80 + Math.random() * 30, 30, 0.7, 'triangle', 0.22); GameAudio.noise(0.4, 0.05, 'highpass', 3000, 1200); }
};
