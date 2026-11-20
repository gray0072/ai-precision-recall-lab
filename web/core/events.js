'use strict';

// ============================================================
// AI Precision Recall Lab — a tiny event bus between the logic and what sits on top of it (spec 05 §4).
// sim/ and campaign.js emit what happened (itemDecided, goalChanged, outbreak, contractEnded…); ui/sounds.js,
// ui/hud.js and game.js listen and play sounds or show banners. With no listeners an event does nothing, so
// the logic runs silent and headless (tests, tools/balance-check.js).
// ============================================================

const GameEvents = (() => {
  const listeners = {};
  // subscribe; returns a function that unsubscribes
  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
    return () => off(type, fn);
  }
  function off(type, fn) {
    const list = listeners[type];
    if (list) listeners[type] = list.filter((f) => f !== fn);
  }
  function emit(type, data) {
    const list = listeners[type];
    if (list) for (const fn of list.slice()) fn(data || {});
  }
  return { on, off, emit };
})();
