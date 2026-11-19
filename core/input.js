'use strict';

// ============================================================
// AI Precision Recall Lab — input plumbing (spec 01 §11). I01 has only fullscreen on touch devices, from
// fish-frenzy's core/input.js: the first Start-like button calls Input.enterFullscreen(), and the first tap
// after coming back to the app restores it. The threshold drag (absolute on the handle, relative on the
// belt), the wheel and the play keys come with the play screen (I03).
// Used by game.js.
// ============================================================

const Input = (() => {
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // must run inside a user gesture; iPhone Safari has no fullscreen and stays windowed
  function enterFullscreen() {
    if (!coarse) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* unsupported: the game works windowed */ }
  }

  // switching apps drops fullscreen, and the browser allows it again only from a user gesture: once the
  // player has asked for it, the first tap after coming back (touchend counts as one) restores it
  let wanted = false;
  window.addEventListener('touchend', () => { if (wanted) enterFullscreen(); });

  return {
    coarse,
    enterFullscreen() { wanted = true; enterFullscreen(); }
  };
})();
