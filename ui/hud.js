'use strict';

// ============================================================
// AI Precision Recall Lab — the HUD over the play screen (spec 04 §4.1): chips on the left (what is being
// played; the items decided so far), round buttons on the right (the sandbox's knobs, sound 🔊 / 🔇, pause).
// Safe-area aware through styles.css. The contract chips (money, goal, meters) and incident banners come
// with the campaign (I04, I05). game.js passes the buttons' actions; update() runs every frame and touches
// the DOM only when a value changed.
// ============================================================

const Hud = (() => {
  const $ = (id) => document.getElementById(id);
  let shown = {};

  function init(actions) {
    $('knobsBtn').addEventListener('click', (e) => { actions.knobs(); e.currentTarget.blur(); });
    $('soundBtn').addEventListener('click', (e) => { actions.sound(); e.currentTarget.blur(); });
    $('pauseBtn').addEventListener('click', (e) => { actions.pause(); e.currentTarget.blur(); });
    $('knobsBtn').title = tr('Sandbox knobs');
    $('pauseBtn').title = tr('Pause (Esc)');
    $('tSlider').setAttribute('aria-label', tr('Threshold'));
  }

  function put(id, text) {
    if (shown[id] === text) return;
    shown[id] = text;
    $(id).textContent = text;
  }

  function update() {
    const run = State.run;
    if (!run) return;
    put('hudTitle', tr('Sandbox') + ' · ' + tr(run.scenario.name));
    put('hudCount', tr('{n} items', { n: run.count.toLocaleString('en-US').replace(/,/g, ' ') }));
    put('soundBtn', GameAudio.on ? '🔊' : '🔇');
    if (shown.soundTitle !== GameAudio.on) {
      shown.soundTitle = GameAudio.on;
      $('soundBtn').title = GameAudio.on ? tr('Sound on') : tr('Sound off');
    }
  }

  function reset() { shown = {}; }

  return { init, update, reset };
})();
