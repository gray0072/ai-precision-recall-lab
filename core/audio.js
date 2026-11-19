'use strict';

// ============================================================
// AI Precision Recall Lab — the Web Audio engine (spec 04 §7): one AudioContext, created on the first user
// gesture, and one master gain every sound goes through, set to 0 while the sound is off (never a flag
// checked in each sound). The Sound On / Off choice is remembered as prLab.sound and read here, before the
// first sound. tone() is the building block of the recipes; the recipes and the game events → sounds map
// come with ui/sounds.js (I07), the only file that plays sounds.
// Used by game.js (ensure on the first button press), ui/screens.js (the Sound toggle), ui/sounds.js.
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

  // a tone gliding from f0 to f1 Hz over dur seconds, fading out, `delay` seconds from now
  tone(f0, f1, dur, type, gain, delay) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
};
