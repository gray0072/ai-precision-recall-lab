'use strict';

// ============================================================
// AI Precision Recall Lab — the main flow (spec 05 §4): wires the buttons and keys to the screens (start, map,
// briefing, contract, results, the Lab, sandbox, cheat sheet, pause, the New campaign confirmation) and runs the
// play screen. Each frame (limited to MAX_FPS) it moves the run (Stream.update and the review desk: in the
// sandbox scaled by its speed unless the belt is paused; in a contract unless a coach mark holds it, then the
// incidents and the retrain), checks the contract's end
// (Contract.update), draws the canvas (Render.frame) and lets the HUD, the live panel and the charts redraw
// what changed. Pause (01 §12): Esc / P / the HUD button, and by itself when the tab is left. In a top-k run
// the same controls set k (sim/topk.js: the handle's line value ↔ k, one key step = one document). The attract
// demo (01 §9, sim/demo.js) runs behind the start screen: dimmed, no input, not with prefers-reduced-motion,
// paused while the page is hidden or the start panel is scrolled on a phone. A won C12 leads from its results
// to the end card (ui/endcard.js). The debug cheats of 01 §14 are here too. The cloud save (core/cloud.js)
// starts here, after the campaign is loaded. Loaded last.
// ============================================================

const Game = (() => {
  const $ = (id) => document.getElementById(id);
  const CHART_MIN_PX = 200;        // the narrowest a chart may be in the desktop's row of three
  const END_DELAY_MS = 900;        // the last reveal plays before the results open
  let contractId = null;           // the contract being briefed, played or shown in the results
  let quizRight = false;           // its briefing's question was answered right
  let endAt = 0;                   // when the ended contract's results open (performance.now ms)

  const playing = () => State.screen === 'sandbox' || State.screen === 'contract';
  const demoOn = () => !!(State.run && State.run.kind === 'demo');
  const onBelt = () => playing() || demoOn();
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function showPlay(on) {
    $('play').hidden = !on;
    $('play').classList.remove('demo');
    if (!on) { SandboxPanel.setOpen(false); LivePanel.reset(); $('tip').hidden = true; Coach.stop(); }
  }

  // ---------- the attract demo (01 §9) ----------
  function startDemo() {
    if (reducedQuery && reducedQuery.matches) return;
    Demo.start(Rng.freshSeed());
    showPlay(true);
    $('play').classList.add('demo');
    Hud.reset();
    LivePanel.reset();
    Charts.showProfit(false);
    Charts.showCalib(false);
    lastLayout = null;
    applyLayout();
  }
  // the demo rests while the start panel is scrolled on a phone (battery) or another panel covers it
  function demoResting() {
    return Screens.shown !== 'start' || (Render.layoutName() !== 'desktop' && $('overlay').scrollTop > 0);
  }

  function leavePlay() {
    showPlay(false);
    Review.detach(State.run);
    State.run = null;
    State.paused = false;
    State.held = false;
  }

  function go(screen) {
    State.screen = screen;
    State.paused = false;
    if (screen === 'sandbox') { enterSandbox(); return; }
    leavePlay();
    if (screen === 'start') { Screens.showStart(); startDemo(); }
    else if (screen === 'map') MapScreen.show(briefing);
  }

  // a button that starts something: fullscreen on touch devices and the audio context need a user gesture
  function gesture() {
    Input.enterFullscreen();
    GameAudio.ensure();
  }

  function setDifficulty(key) {
    if (!DIFFICULTIES[key]) return;
    State.difficulty = key;
    Store.set('difficulty', key);
    Screens.renderStart();
    Screens.renderDifficulty('#resultsDifficulty');
  }

  function setSound(on) {
    GameAudio.setOn(on);
    if (GameAudio.on) GameAudio.ensure();
    Screens.renderStart();
    Screens.renderSound('#pauseSoundRow');
  }

  // the Lab (01 §5): from the map and the results, once C01 has a star; Back returns where it came from
  function openLab(back) {
    if (!Campaign.labOpen()) { Screens.banner(tr('The Lab opens after the first contract: earn a star on C01.')); return; }
    leavePlay();
    State.screen = 'lab';
    Lab.show(back);
  }

  // ---------- the campaign: New campaign, the briefing, a contract, its results ----------
  function newCampaign() {
    gesture();
    if (!Campaign.exists) { Campaign.reset(); go('map'); return; }
    Screens.confirm(tr('New campaign?'), Cloud.ready()
      ? tr('This erases the campaign: money, stars and bests, here and in the cloud. The settings stay.')
      : tr('This erases the campaign: money, stars and bests. The settings stay.'),
      tr('Erase and start'), () => { Campaign.reset(); go('map'); }, () => go('start'));
  }

  function briefing(id) {
    contractId = id;
    leavePlay();
    State.screen = 'briefing';
    Briefing.show(id, State.difficulty, { start: (right) => startContract(id, right), back: () => go('map') });
  }

  function startContract(id, right) {
    gesture();
    contractId = id;
    quizRight = right;
    State.screen = 'contract';
    State.paused = false;
    State.held = false;
    endAt = 0;
    const run = Contract.start(CONTRACTS[id], { difficulty: State.difficulty, seed: Rng.freshSeed(), upgrades: Campaign.upgrades() });
    Screens.hide();
    showPlay(true);
    Hud.reset();
    LivePanel.reset();
    Charts.showProfit(DIFFICULTIES[State.difficulty].profitCurve && !run.topk);
    Charts.showCalib(false);
    lastLayout = null;
    applyLayout();
    Coach.start(run);
  }

  function endContract() {
    const r = Contract.results(State.run);
    const paid = Campaign.finish(r, quizRight);
    leavePlay();
    State.screen = 'results';
    Results.show(r, paid, {
      next: (id) => briefing(id),
      retry: () => briefing(contractId),
      lab: () => openLab(() => { State.screen = 'results'; Screens.show('results'); }),
      map: () => go('map'),
      card: (card) => Glossary.show({ card }, () => { State.screen = 'results'; Screens.show('results'); }),
      finale: () => { State.screen = 'end'; EndCard.show({ hard: () => { setDifficulty('hard'); go('map'); }, map: () => go('map'), start: () => go('start') }); }
    });
  }

  // ---------- the cheat sheet ----------
  function openGlossary(opts, back) {
    if (demoOn()) leavePlay();
    if (!playing()) State.screen = 'glossary';
    Glossary.show(opts, back);
  }
  // from play (a second tap on a metric bar): the game pauses under the card; Back plays on
  function cardFromPlay(metric) {
    const card = metric.startsWith('G-') ? metric : Glossary.cardOfMetric(metric);
    if (!card || !playing()) return;
    State.paused = true;
    $('tip').hidden = true;
    Glossary.show({ card }, resume);
  }

  // ---------- the sandbox ----------
  let savedKnobs = '';
  function saveSandbox() {
    const run = State.run;
    if (!run || run.kind !== 'sandbox') return;
    const json = JSON.stringify(Object.assign({}, run.knobs, { threshold: State.threshold, k: State.k }, State.review ? { reviewLow: State.review.low } : {}));
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
    Charts.showProfit(!State.run.topk);
    Charts.showCalib(!State.run.topk);
    SandboxPanel.show(knobChanged);
    lastLayout = null;
    SandboxPanel.setOpen(Render.layoutName() === 'desktop');
    applyLayout();
  }

  function knobChanged(what) {
    if (what === 'scenario') { Charts.showProfit(!State.run.topk); Charts.showCalib(!State.run.topk); }
    if (what === 'panel' || what === 'review' || what === 'scenario') applyLayout();
    saveSandbox();
    LivePanel.update(true);
    Charts.update(true);
  }

  // ---------- layout: the class on #play picks the grid (styles.css); then the canvases take their sizes ----------
  let lastLayout = null;
  function applyLayout() {
    if (!onBelt() || !State.run) return;
    const name = Render.layoutName();
    const play = $('play');
    const sandbox = State.run.kind === 'sandbox';
    // turning a tablet or resizing into a phone layout makes the docked knobs a drawer: close it
    if (sandbox && lastLayout === 'desktop' && name !== 'desktop' && SandboxPanel.isOpen()) { lastLayout = name; SandboxPanel.setOpen(false); return; }
    lastLayout = name;
    play.classList.remove('desktop', 'landscape', 'portrait');
    play.classList.add(name);
    play.classList.toggle('docked', sandbox && name === 'desktop' && SandboxPanel.isOpen());
    play.classList.toggle('contract', !sandbox && !demoOn());
    // the charts sit in one row when each gets at least CHART_MIN_PX, otherwise one at a time under tabs
    play.classList.remove('tabbed');
    const count = document.querySelectorAll('#chartsBox .chart:not([hidden])').length;
    const room = $('live').clientWidth - $('matrixBox').offsetWidth - $('barsBox').offsetWidth - 40;
    play.classList.toggle('tabbed', name !== 'desktop' || room / count < CHART_MIN_PX);
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
    if (!playing() || State.paused || !State.run) return;
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
  function restart() {
    if (State.run && State.run.kind === 'contract') { startContract(contractId, quizRight); return; }
    Sandbox.clear();
    resume();
  }
  function quit() {
    if (State.run && State.run.kind === 'contract') { go('map'); return; }   // the contract is lost, no money
    saveSandbox();
    go('start');
  }

  // ---------- debug cheats (01 §14): keyboard only, never in the help; a banner says what each did ----------
  const MAP_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
  function cheat(e) {
    const run = State.run;
    const inContract = State.screen === 'contract' && run && !State.paused && !run.ended;
    const onMap = State.screen === 'map' && Screens.shown === 'map';
    if (onMap && MAP_KEYS.includes(e.code)) {
      const id = CONTRACT_ORDER[MAP_KEYS.indexOf(e.code)];
      if (CONTRACTS[id].soon) { Screens.banner(tr('Cheat: {id} arrives in a later version.', { id })); return true; }
      Campaign.open(id);
      Screens.banner(tr('Cheat: {id} opened.', { id }));
      MapScreen.show(briefing);
      return true;
    }
    if (!onMap && !inContract) return false;
    if (e.code === 'KeyM') {
      Campaign.addMoney(CHEAT_MONEY);
      if (inContract) run.cheated = true;
      Screens.banner(tr('Cheat: +{m}. This is a test save now.', { m: '$' + CHEAT_MONEY }));
      if (onMap) MapScreen.show(briefing);
      return true;
    }
    if (e.code === 'KeyU') {
      Campaign.buyAll();
      if (inContract) run.cheated = true;
      Screens.banner(tr('Cheat: every upgrade bought (from the next contract on). This is a test save now.'));
      if (onMap) MapScreen.show(briefing);
      return true;
    }
    if (!inContract) return false;
    if (e.code === 'KeyR') {
      run.tint = !run.tint;
      run.cheated = true;
      Screens.banner(run.tint ? tr('Cheat: the true class shows on the belt. This run does not count.') : tr('Cheat: the true class is hidden again.'));
      return true;
    }
    if (e.code === 'KeyF') { Contract.finishNow(run); Screens.banner(tr('Cheat: contract finished now. This run does not count.')); return true; }
    if (e.code === 'KeyI') {
      const inc = Incidents.startNow(run);
      if (inc) { run.cheated = true; Screens.banner(tr('Cheat: {name} starts with the next item. This run does not count.', { name: tr(inc.name) })); }
      else Screens.banner(tr('Cheat: no incident is left in this contract.'));
      return true;
    }
    return false;
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
    if (demoOn()) {   // the attract demo behind the start screen: no input, no saving
      if (!demoResting() && !document.hidden) { Demo.update(dt); Render.frame(dt); LivePanel.update(); Charts.update(); }
      return;
    }
    if (!playing() || !run) return;
    if (!State.paused) {
      if (run.kind === 'sandbox') { if (!run.frozen) { Stream.update(dt * run.knobs.speed); Review.update(); } }
      else {
        if (!State.held) { Stream.update(dt); Review.update(); Incidents.update(dt); }
        Coach.update();
        if (Contract.update()) {
          if (!endAt) endAt = now + END_DELAY_MS;
          else if (now >= endAt) { endContract(); return; }
        }
      }
      Render.frame(dt);
    }
    Hud.update();
    LivePanel.update();
    Charts.update();
    if (now > saveAt) { saveAt = now + 1000; saveSandbox(); }
  }

  function boot() {
    I18N.load();
    I18N.buildPickers();
    // a new language: rebuild the texts that the screens built in JS (the static ones follow by applyDom)
    I18N.onChange(() => {
      Screens.renderStart();
      if (Screens.shown === 'results') Results.refresh();
      else if (Screens.shown === 'end') EndCard.refresh();
    });
    const d = Store.get('difficulty', DIFFICULTY_DEFAULT);
    State.difficulty = DIFFICULTIES[d] ? d : DIFFICULTY_DEFAULT;
    Campaign.init({
      load: () => Store.getJSON('campaign.v1', null),
      save: (data) => Store.setJSON('campaign.v1', data),
      remove: () => Store.remove('campaign.v1')
    });
    // the cloud save (core/cloud.js, 01 §15.1): the account row follows the sync; a campaign changed by
    // another device's copy redraws the screen that shows it (the start screen, the map, the Lab)
    Cloud.onChange = (campaignChanged) => {
      const shown = Screens.shown;
      if (!campaignChanged) { if (shown === 'start') Screens.renderAccount(); return; }
      if (shown === 'start') Screens.renderStart();
      else if (shown === 'map') { const top = $('overlay').scrollTop; MapScreen.show(briefing); $('overlay').scrollTop = top; }
      else if (shown === 'lab') Lab.show();
    };
    Cloud.init();

    // the start screen
    $('continueBtn').addEventListener('click', () => { gesture(); go('map'); });
    $('newCampaignBtn').addEventListener('click', newCampaign);
    $('sandboxBtn').addEventListener('click', () => { gesture(); go('sandbox'); });
    $('cheatSheetBtn').addEventListener('click', () => openGlossary(null, () => go('start')));
    $('backBtn').addEventListener('click', () => go('start'));
    $('helpToggle').addEventListener('click', Screens.toggleHelp);
    document.querySelectorAll('#difficultyRow [data-difficulty], #resultsDifficulty [data-difficulty]').forEach((b) =>
      b.addEventListener('click', () => setDifficulty(b.dataset.difficulty)));
    document.querySelectorAll('#soundRow [data-sound], #pauseSoundRow [data-sound]').forEach((b) =>
      b.addEventListener('click', () => setSound(b.dataset.sound === 'on')));

    // the map
    $('mapLabBtn').addEventListener('click', () => openLab(() => go('map')));
    $('mapSheetBtn').addEventListener('click', () => openGlossary(null, () => go('map')));
    $('mapBackBtn').addEventListener('click', () => go('start'));

    // the pause dialog
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', restart);
    $('pauseSheetBtn').addEventListener('click', () => Glossary.show(null, () => Screens.showPause()));
    $('quitBtn').addEventListener('click', quit);

    // the play screen
    Hud.init({
      knobs: () => SandboxPanel.setOpen(!SandboxPanel.isOpen()),
      sound: () => setSound(!GameAudio.on),
      pause,
      retrain: () => { if (State.run && Incidents.retrain(State.run)) Screens.banner(tr('Retraining on the new data: {s} s.', { s: RETRAIN_S })); }
    });
    LivePanel.onCard = cardFromPlay;
    $('liveSwap').addEventListener('click', (e) => {
      $('live').classList.toggle('showCharts');
      e.currentTarget.blur();
      applyLayout();
    });
    Input.bindPlay($('beltCanvas'), {
      active: () => playing() && !State.paused && !!State.run,
      // in a top-k run the line value is k's (Topk.valueOfK / kOfValue): dragging up shows fewer documents
      threshold: () => (State.run && State.run.topk ? Topk.valueOfK(State.k) : State.threshold),
      // the review band can never sit above the threshold: lowering the line pushes its edge down too
      setThreshold: (t) => {
        if (State.run && State.run.topk) { State.k = Topk.kOfValue(t); return; }
        State.threshold = t;
        if (State.review && State.review.low > t) State.review.low = t;
      },
      unit: () => (State.run && State.run.topk ? Topk.STEP_UNIT : 1),
      onHandle: Render.onHandle,
      onPlayArea: Render.onPlayArea,
      valueAt: Render.valueAt,
      span: Render.span,
      // a tap on an item sends it to the review desk (a full desk flashes "Desk full")
      tap: (x, y) => { if (State.review) Review.send(Render.itemAt(x, y)); },
      tapTarget: (x, y) => !!State.review && !!Render.itemAt(x, y),
      onBandHandle: Render.onBandHandle,
      band: () => (State.review ? State.review.low : null),
      setBand: (v) => Review.setLow(v),
      pause,
      nextChart: () => { Charts.nextTab(); Charts.update(true); }
    });

    // Esc closes or goes back from the panels; the cheats
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;   // the Esc that just paused
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' && e.key !== 'Escape') return;
      if (cheat(e)) { e.preventDefault(); return; }
      const panel = Screens.shown;
      const esc = e.key === 'Escape';
      if (panel === 'pause' && (esc || e.code === 'KeyP')) { e.preventDefault(); resume(); return; }
      if (!esc) return;
      const backs = { placeholder: 'backBtn', confirm: 'confirmNo', map: 'mapBackBtn', briefing: 'briefBackBtn', results: 'resMapBtn', lab: 'labBackBtn', end: 'endMapBtn' };
      if (panel === 'glossary') { e.preventDefault(); Glossary.goBack(); }
      else if (backs[panel]) { e.preventDefault(); $(backs[panel]).click(); }
    });
    // leaving the tab or switching apps pauses (on phones the first tap after returning restores fullscreen)
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', saveSandbox);
    window.addEventListener('resize', queueLayout);
    // the stage can change size without the window (the docked knobs, the live panel's rows)
    if (window.ResizeObserver) new ResizeObserver(queueLayout).observe($('stage'));
    window.addEventListener('orientationchange', queueLayout);
    if (reducedQuery && reducedQuery.addEventListener) {
      reducedQuery.addEventListener('change', () => { if (State.screen === 'start') { if (reducedQuery.matches) leavePlay(); else startDemo(); } });
    }

    go('start');
    requestAnimationFrame(tick);
    // a new deploy reloads the page only where nothing is lost: the start screen and the map
    AppUpdate.watch(() => State.screen === 'start' || State.screen === 'map');
  }

  boot();
  return { go, pause, resume, applyLayout, briefing, startContract };
})();
