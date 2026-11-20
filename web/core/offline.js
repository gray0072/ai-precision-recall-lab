// AI Precision Recall Lab — registers the service worker (sw.js) that lets the game start and play
// without a network (spec 05 §6, ADR-0009). Only over http(s): from file:// there is no service worker
// and nothing to cache. A failed registration only means no offline play. Used by the main loop:
//   AppOffline.register();

const AppOffline = (() => {
  function register() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    // after the page has loaded, so the first visit's own downloads come first
    const go = () => navigator.serviceWorker.register('sw.js').catch(() => { /* no offline play */ });
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go);
  }

  return { register };
})();
