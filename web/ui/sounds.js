'use strict';

// ============================================================
// AI Precision Recall Lab — game events turned into sounds (spec 04 §7, 05 §4): the only file that decides
// when a sound plays (core/audio.js has the engine and the recipes). It subscribes to GameEvents and, a few
// times a second, looks at the state for the belt's hum and the money milestones. Rules:
//   - the attract demo (State.run.kind === 'demo') emits the item events too: it stays silent;
//   - a top-k query (C11) decides all its documents at once: one sound per query, not one per document;
//   - frequent sounds are throttled (one per outcome per THROTTLE_S), the goal warning to one per WARN_GAP_S.
// Every sound goes through GameAudio's master gain, so Sound Off silences all of it at once.
// Loaded after the other ui/ files; reads State, GameEvents, GameAudio, Sfx.
// ============================================================

(() => {
  const THROTTLE_S = 0.06;        // at most one sound of a kind per this many seconds (fast belts, Generate)
  const WARN_GAP_S = 5;           // the goal-broken warning at most once per this many seconds (04 §7)
  const MILESTONE = 100;          // a coin chime each time a contract's money passes a multiple of $100
  const TICK_MS = 200;            // how often the hum and the milestones look at the state

  const quiet = () => !State.run || State.run.kind === 'demo';
  const lastAt = {};
  const once = (name, fn, gap) => {
    const now = performance.now() / 1000;
    if (now - (lastAt[name] || -1e9) < (gap || THROTTLE_S)) return;
    lastAt[name] = now;
    fn();
  };

  // ---------- the items ----------
  const queries = new Map();      // q → { hits, R } of the documents decided in this task
  GameEvents.on('itemDecided', (e) => {
    if (quiet()) return;
    const it = e.item;
    if (it.q !== undefined) {     // a top-k document: gather the query, sound it once after this task
      let g = queries.get(it.q);
      if (!g) {
        g = { hits: 0, R: 0 };
        queries.set(it.q, g);
        queueMicrotask(() => { queries.delete(it.q); once('query', () => Sfx.query(g.R ? g.hits / g.R : 0)); });
      }
      if (it.y) { g.R++; if (e.outcome === 'TP') g.hits++; }
      return;
    }
    if (e.outcome === 'TP') once('TP', Sfx.tp);
    else if (e.outcome === 'TN') once('TN', Sfx.tn, 0.12);
    else if (e.outcome === 'FP') once('FP', Sfx.fp);
    else if (e.outcome === 'FN') once('FN', State.run.allowance ? Sfx.cough : Sfx.fn);
  });
  GameEvents.on('pileGenerated', () => { if (!quiet()) once('pile', Sfx.pile, 0.3); });

  // ---------- the contract ----------
  GameEvents.on('goalChanged', (e) => {
    if (quiet()) return;
    if (e.state === 'met') once('goal', Sfx.goalMet, 1);
    else if (e.state === 'broken') once('warn', Sfx.warning, WARN_GAP_S);
  });
  GameEvents.on('incidentWarning', () => once('blip', Sfx.blip, 1));
  GameEvents.on('incidentStarted', () => once('blip', Sfx.blip, 1));
  GameEvents.on('driftAlert', () => once('alarm', Sfx.alarm, 2));
  GameEvents.on('retrainDone', () => Sfx.retrained());
  GameEvents.on('deskFull', () => once('desk', Sfx.deskFull, 1));
  GameEvents.on('phaseStarted', () => Sfx.phase());
  GameEvents.on('contractEnded', (e) => { if (e.failed) Sfx.failed(); });

  // ---------- the screens ----------
  // the results light the stars one by one (ui/results.js): one rising note per star, at the same moments
  GameEvents.on('starsShown', (e) => {
    for (let i = 0; i < e.stars; i++) setTimeout(() => Sfx.star(i), (e.delays[i] || 0) * 1000);
  });
  GameEvents.on('purchase', () => Sfx.register());
  GameEvents.on('fireworkLaunch', () => once('rocket', Sfx.rocket, 0.05));
  GameEvents.on('fireworkBang', () => once('bang', Sfx.bang, 0.05));

  // ---------- the hum and the money milestones ----------
  let milestoneRun = null, milestone = 0;
  setInterval(() => {
    if (!GameAudio.ctx) return;
    const run = State.run;
    const onBelt = !quiet() && (State.screen === 'contract' || State.screen === 'sandbox') && !run.ended;
    let level = 0;
    if (onBelt && !document.hidden) level = State.paused || State.held || run.frozen ? 0.3 : 1;   // ducked while still
    GameAudio.hum.set(level);

    if (onBelt && run.kind === 'contract') {
      if (milestoneRun !== run) { milestoneRun = run; milestone = Math.max(0, Math.floor(run.money / MILESTONE)); }
      const m = Math.floor(run.money / MILESTONE);
      if (m > milestone) { milestone = m; Sfx.coin(); }
      else if (m < milestone) milestone = Math.max(0, m);   // fell back: the next pass of the mark chimes again
    }
  }, TICK_MS);
})();
