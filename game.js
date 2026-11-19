'use strict';

// ============================================================
// AI Precision Recall Lab — the main flow (spec 05 §4): wires the buttons and keys to the screens and runs
// the play screen. Each frame (limited to MAX_FPS) it moves the run (Stream.update, scaled by the sandbox's
// speed, unless the belt is paused), draws the canvas (Render.frame) and lets the HUD, the live panel and the
// charts redraw what changed. The sandbox (01 §7) is the play screen of I03; the campaign's screens are still
// placeholders (I04). Pause (01 §12): Esc / P / the HUD button, and by itself when the tab is left.
// Loaded last.
// ============================================================

const Game = (() => {
  const $ = (id) => document.getElementById(id);

  // the screens that exist only as placeholders in this version: title and text
  const PLACEHOLDERS = {
    map: () => [tr('Campaign'), tr('The campaign is not built yet: twelve client contracts arrive in a later version.')],
    glossary: () => [tr('Cheat sheet'), tr('The cheat sheet is not built yet: it arrives together with the campaign.')]
  };
  let placeholderBack = 'start';   // where Back on a placeholder leads: 'start' or 'pause'
  const CHART_MIN_PX = 200;        // the narrowest a chart may be in the desktop's row of three

  function showPlay(on) {
    $('play').hidden = !on;
    if (!on) { SandboxPanel.setOpen(false); LivePanel.reset(); $('tip').hidden = true; }
  }

  function go(screen) {
    State.screen = screen;
    State.paused = false;
    if (screen === 'sandbox') { enterSandbox(); return; }
    showPlay(false);
    State.run = null;
    if (screen === 'start') { Screens.showStart(); return; }
    const [title, text] = PLACEHOLDERS[screen]();
    placeholderBack = 'start';
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

  function setSound(on) {
    GameAudio.setOn(on);
    if (GameAudio.on) GameAudio.ensure();
    Screens.renderStart();
    Screens.renderSound('#pauseSoundRow');
  }

  // ---------- the sandbox ----------
  let savedKnobs = '';
  function saveSandbox() {
    const run = State.run;
    if (!run || run.kind !== 'sandbox') return;
    const json = JSON.stringify(Object.assign({}, run.knobs, { threshold: State.threshold }));
    if (json === savedKnobs) return;
    savedKnobs = json;
    Store.set('sandbox.v1', json);
  }

  function enterSandbox() {
    Sandbox.start(Store.getJSON('sandbox.v1', null), Rng.freshSeed());
    Screens.hide();
    showPlay(true);
    Hud.reset();
    LivePanel.reset();
    SandboxPanel.show(knobChanged);
    lastLayout = null;
    SandboxPanel.setOpen(Render.layoutName() === 'desktop');
    applyLayout();
  }

  function knobChanged(what) {
    if (what === 'panel') applyLayout();
    saveSandbox();
    LivePanel.update(true);
    Charts.update(true);
  }

  // ---------- layout: the class on #play picks the grid (styles.css); then the canvases take their sizes ----------
  let lastLayout = null;
  function applyLayout() {
    if (State.screen !== 'sandbox') return;
    const name = Render.layoutName();
    const play = $('play');
    // turning a tablet or resizing into a phone layout makes the docked knobs a drawer: close it
    if (lastLayout === 'desktop' && name !== 'desktop' && SandboxPanel.isOpen()) { lastLayout = name; SandboxPanel.setOpen(false); return; }
    lastLayout = name;
    play.classList.remove('desktop', 'landscape', 'portrait');
    play.classList.add(name);
    play.classList.toggle('docked', name === 'desktop' && SandboxPanel.isOpen());
    // the charts sit in one row when each gets at least CHART_MIN_PX, otherwise one at a time under tabs
    play.classList.remove('tabbed');
    const room = $('live').clientWidth - $('matrixBox').offsetWidth - $('barsBox').offsetWidth - 40;
    play.classList.toggle('tabbed', name !== 'desktop' || room / 3 < CHART_MIN_PX);
    $('liveSwap').textContent = $('live').classList.contains('showCharts') ? tr('Numbers') : tr('Charts');
    Render.resize();
    Charts.setTab(Charts.tab);
    Render.frame(0);
    LivePanel.update(true);
    Charts.update(true);
  }
  let layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; applyLayout(); });
  }

  // ---------- pause (01 §12) ----------
  function pause() {
    if (State.screen !== 'sandbox' || State.paused) return;
    State.paused = true;
    saveSandbox();
    $('tip').hidden = true;
    Screens.showPause();
  }
  function resume() {
    State.paused = false;
    Screens.hide();
    LivePanel.update(true);
  }

  // ---------- the frame ----------
  const limiter = frameLimiter();
  let last = 0, saveAt = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (!limiter(now)) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const run = State.run;
    if (State.screen !== 'sandbox' || !run) return;
    if (!State.paused) {
      if (!run.frozen) Stream.update(dt * run.knobs.speed);
      Render.frame(dt);
    }
    Hud.update();
    LivePanel.update();
    Charts.update();
    if (now > saveAt) { saveAt = now + 1000; saveSandbox(); }
  }

  function boot() {
    I18N.set('en');   // English only until I07
    const d = Store.get('difficulty', DIFFICULTY_DEFAULT);
    State.difficulty = DIFFICULTIES[d] ? d : DIFFICULTY_DEFAULT;

    $('continueBtn').addEventListener('click', () => startLike('map'));
    $('newCampaignBtn').addEventListener('click', () => startLike('map'));
    $('sandboxBtn').addEventListener('click', () => startLike('sandbox'));
    $('cheatSheetBtn').addEventListener('click', () => go('glossary'));
    $('backBtn').addEventListener('click', () => {
      if (placeholderBack === 'pause') Screens.showPause();
      else go('start');
    });
    $('helpToggle').addEventListener('click', Screens.toggleHelp);
    document.querySelectorAll('#difficultyRow [data-difficulty]').forEach((b) =>
      b.addEventListener('click', () => setDifficulty(b.dataset.difficulty)));
    document.querySelectorAll('#soundRow [data-sound], #pauseSoundRow [data-sound]').forEach((b) =>
      b.addEventListener('click', () => setSound(b.dataset.sound === 'on')));

    // the pause dialog
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', () => { Sandbox.clear(); resume(); });
    $('pauseSheetBtn').addEventListener('click', () => {
      const [title, text] = PLACEHOLDERS.glossary();
      placeholderBack = 'pause';
      Screens.showPlaceholder(title, text);
    });
    $('quitBtn').addEventListener('click', () => { saveSandbox(); go('start'); });

    // the play screen
    Hud.init({
      knobs: () => SandboxPanel.setOpen(!SandboxPanel.isOpen()),
      sound: () => setSound(!GameAudio.on),
      pause
    });
    $('liveSwap').addEventListener('click', (e) => {
      $('live').classList.toggle('showCharts');
      e.currentTarget.blur();
      applyLayout();
    });
    Input.bindPlay($('beltCanvas'), {
      active: () => State.screen === 'sandbox' && !State.paused && !!State.run,
      threshold: () => State.threshold,
      setThreshold: (t) => { State.threshold = t; },
      onHandle: Render.onHandle,
      onPlayArea: Render.onPlayArea,
      valueAt: Render.valueAt,
      span: Render.span,
      tap: () => {},             // sends an item to the review desk from I05
      pause,
      nextChart: () => { Charts.nextTab(); Charts.update(true); }
    });

    // Esc / P close the pause dialog; Esc on a placeholder goes back
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;   // the Esc that just paused
      const panel = Screens.visiblePanel();
      const esc = e.key === 'Escape';
      if (panel === $('pausePanel') && (esc || e.code === 'KeyP')) { e.preventDefault(); resume(); return; }
      if (panel === $('placeholderPanel') && esc) { e.preventDefault(); $('backBtn').click(); }
    });
    // leaving the tab or switching apps pauses (on phones the first tap after returning restores fullscreen)
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', saveSandbox);
    window.addEventListener('resize', queueLayout);
    // the stage can change size without the window (the docked knobs, the live panel's rows)
    if (window.ResizeObserver) new ResizeObserver(queueLayout).observe($('stage'));
    window.addEventListener('orientationchange', queueLayout);

    go('start');
    requestAnimationFrame(tick);
    // a new deploy reloads the page only where nothing is lost: the start screen and the map
    AppUpdate.watch(() => State.screen === 'start' || State.screen === 'map');
  }

  boot();
  return { go, pause, resume, applyLayout };
})();
