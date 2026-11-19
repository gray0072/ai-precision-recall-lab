'use strict';

// ============================================================
// AI Precision Recall Lab — input plumbing (spec 01 §11): fullscreen on touch devices (from fish-frenzy's
// core/input.js: the first Start-like button asks for it, the first tap after coming back restores it) and
// the play controls of the threshold:
//   - pointer: a press in the handle's column drags the line absolutely (it follows the pointer's height);
//     a mouse press on the belt or the pile does the same; a finger on the belt or the pile drags it
//     relatively (by the finger's movement, so the thumb does not cover the items); a touch that moved less
//     than TAP_SLOP_PX is a tap, and so is a mouse click on an item (with a review desk: it sends the item to
//     people); a press in the band's column at the left edge drags the review band's lower edge;
//   - the wheel: ±THRESHOLD_STEP per notch, ±THRESHOLD_STEP_SHIFT with Shift;
//   - keys: ↑ / ↓ or W / S ±0.01 (Shift ±0.05), Page Up / Page Down ±0.10, Home / End 1.00 / 0.00,
//     Q / A the review band's edge ±0.01 (Shift ±0.05), Esc or P pause, Tab switches the chart tab.
// No game rules: game.js binds it with callbacks (Input.bindPlay) that read and set the threshold.
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

  // ---------- the threshold ----------
  // h: { active() → bool, threshold() → t, setThreshold(t), onHandle(x), onPlayArea(x, y), valueAt(y),
  //      span() → px per 1.0 of score, tap(x, y), pause(), nextChart(),
  //      onBandHandle(x), band() → the band's edge or null, setBand(v), tapTarget(x, y) → is there an item to click }
  let h = null;
  let drag = null;   // { id, mode: 'abs' | 'rel', x0, y0, t0, moved }
  let wheelAcc = 0;

  const set = (t) => h.setThreshold(clamp(round2(t), 0, 1));

  function local(el, e) {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function bindPlay(el, handlers) {
    h = handlers;
    el.addEventListener('pointerdown', (e) => {
      if (!h.active() || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const { x, y } = local(el, e);
      let mode;
      if (h.onHandle(x)) mode = 'abs';
      else if (h.onBandHandle && h.onBandHandle(x)) mode = 'band';
      // a mouse press on an item (with a review desk) is a click until it moves: then it drags the line
      else if (h.onPlayArea(x, y)) mode = e.pointerType === 'mouse' ? (h.tapTarget && h.tapTarget(x, y) ? 'click' : 'abs') : 'rel';
      else return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      drag = { id: e.pointerId, mode, x0: x, y0: y, t0: h.threshold(), moved: false };
      if (mode === 'abs') set(h.valueAt(y));
      if (mode === 'band') h.setBand(clamp(round2(h.valueAt(y)), 0, 1));
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const { x, y } = local(el, e);
      if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > TAP_SLOP_PX) drag.moved = true;
      if (!h.active()) return;
      if (drag.mode === 'click' && drag.moved) drag.mode = 'abs';
      if (drag.mode === 'abs') set(h.valueAt(y));
      else if (drag.mode === 'band') h.setBand(clamp(round2(h.valueAt(y)), 0, 1));
      else if (drag.mode === 'rel' && drag.moved) set(drag.t0 - (y - drag.y0) / h.span());
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (e.type === 'pointerup' && !d.moved && (d.mode === 'rel' || d.mode === 'click') && h.active()) {
        const { x, y } = local(el, e);
        h.tap(x, y);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('wheel', (e) => {
      if (!h.active()) return;
      e.preventDefault();
      const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      const step = e.shiftKey ? THRESHOLD_STEP_SHIFT : THRESHOLD_STEP;
      // a mouse notch is one step at once; a trackpad's small deltas add up to notches
      if (Math.abs(px) >= WHEEL_NOTCH_PX) { wheelAcc = 0; set(h.threshold() - Math.sign(px) * step); return; }
      wheelAcc += px;
      while (Math.abs(wheelAcc) >= WHEEL_NOTCH_PX) {
        set(h.threshold() - Math.sign(wheelAcc) * step);
        wheelAcc -= Math.sign(wheelAcc) * WHEEL_NOTCH_PX;
      }
    }, { passive: false });
  }

  const STEPS = { ArrowUp: 1, KeyW: 1, ArrowDown: -1, KeyS: -1 };
  window.addEventListener('keydown', (e) => {
    if (!h || !h.active() || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) h.pause(); return; }
    if (e.key === 'Tab') { e.preventDefault(); h.nextChart(); return; }
    // during play Space and Enter do nothing (no accidental presses of a focused HUD button)
    if (e.code === 'Space' || e.key === 'Enter') { if (!typing) e.preventDefault(); return; }
    if (typing) return;
    // Q / A: the review band's lower edge (with a desk)
    if ((e.code === 'KeyQ' || e.code === 'KeyA') && h.band && h.band() !== null) {
      e.preventDefault();
      h.setBand(clamp(round2(h.band() + (e.code === 'KeyQ' ? 1 : -1) * (e.shiftKey ? THRESHOLD_STEP_SHIFT : THRESHOLD_STEP)), 0, 1));
      return;
    }
    const t = h.threshold();
    if (STEPS[e.code]) set(t + STEPS[e.code] * (e.shiftKey ? THRESHOLD_STEP_SHIFT : THRESHOLD_STEP));
    else if (e.key === 'PageUp') set(t + THRESHOLD_STEP_PAGE);
    else if (e.key === 'PageDown') set(t - THRESHOLD_STEP_PAGE);
    else if (e.key === 'Home') set(1);
    else if (e.key === 'End') set(0);
    else return;
    e.preventDefault();
  });

  return {
    coarse,
    enterFullscreen() { wanted = true; enterFullscreen(); },
    bindPlay,
    dragging() { return !!drag; }
  };
})();
