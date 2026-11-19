'use strict';

// ============================================================
// AI Precision Recall Lab — localStorage under the prLab. prefix (spec 05 §5). The Pages origin is shared
// with other apps: only our own keys are read, written or removed, never localStorage.clear(). Every call
// is in try/catch (storage can be blocked); a missing or broken value gives the default.
// Used by game.js, core/audio.js, ui/ and later campaign.js.
// ============================================================

const Store = {
  PREFIX: 'prLab.',
  get(key, def) {
    try {
      const v = localStorage.getItem(this.PREFIX + key);
      return v === null ? def : v;
    } catch (e) { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(this.PREFIX + key, String(value)); } catch (e) { /* storage blocked or full */ }
  },
  getJSON(key, def) {
    const v = this.get(key, null);
    if (v === null) return def;
    try { return JSON.parse(v); } catch (e) { return def; }
  },
  setJSON(key, value) { this.set(key, JSON.stringify(value)); },
  remove(key) {
    try { localStorage.removeItem(this.PREFIX + key); } catch (e) { /* storage blocked */ }
  }
};
