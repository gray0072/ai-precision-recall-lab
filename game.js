'use strict';

// ============================================================
// AI Precision Recall Lab — the main flow (spec 05 §4): wires the buttons and keys to the screens and,
// from I03 on, runs sim/ and the renderer each frame. Loaded last. In I01 it boots the page (language,
// settings, start screen, update watcher) and leads the start screen's buttons to placeholder screens.
// ============================================================

const Game = (() => {
  const $ = (id) => document.getElementById(id);

  // the screens that exist only as placeholders in this version: title and text
  const PLACEHOLDERS = {
    map: () => [tr('Campaign'), tr('The campaign is not built yet: twelve client contracts arrive in a later version.')],
    sandbox: () => [tr('Sandbox'), tr('The sandbox is not built yet: the belt, the threshold and the pile arrive in the next version.')],
    glossary: () => [tr('Cheat sheet'), tr('The cheat sheet is not built yet: it arrives together with the campaign.')]
  };

  function go(screen) {
    State.screen = screen;
    if (screen === 'start') { Screens.showStart(); return; }
    const [title, text] = PLACEHOLDERS[screen]();
    Screens.showPlaceholder(title, text);
  }

  // a button that starts something: fullscreen on touch devices and the audio context need a user gesture
  function startLike(screen) {
    Input.enterFullscreen();
    GameAudio.ensure();
    go(screen);
  }

  function setDifficulty(key) {
    if (!DIFFICULTIES[key]) return;
    State.difficulty = key;
    Store.set('difficulty', key);
    Screens.renderStart();
  }

  function boot() {
    I18N.set('en');   // English only until I07
    const d = Store.get('difficulty', DIFFICULTY_DEFAULT);
    State.difficulty = DIFFICULTIES[d] ? d : DIFFICULTY_DEFAULT;

    $('continueBtn').addEventListener('click', () => startLike('map'));
    $('newCampaignBtn').addEventListener('click', () => startLike('map'));
    $('sandboxBtn').addEventListener('click', () => startLike('sandbox'));
    $('cheatSheetBtn').addEventListener('click', () => go('glossary'));
    $('backBtn').addEventListener('click', () => go('start'));
    $('helpToggle').addEventListener('click', Screens.toggleHelp);
    document.querySelectorAll('#difficultyRow [data-difficulty]').forEach((b) =>
      b.addEventListener('click', () => setDifficulty(b.dataset.difficulty)));
    document.querySelectorAll('#soundRow [data-sound]').forEach((b) =>
      b.addEventListener('click', () => {
        GameAudio.setOn(b.dataset.sound === 'on');
        if (GameAudio.on) GameAudio.ensure();
        Screens.renderStart();
      }));
    // Esc on a placeholder screen goes back
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && State.screen !== 'start') go('start');
    });

    go('start');
    // a new deploy reloads the page only where nothing is lost: the start screen and the map
    AppUpdate.watch(() => State.screen === 'start' || State.screen === 'map');
  }

  boot();
  return { go };
})();
