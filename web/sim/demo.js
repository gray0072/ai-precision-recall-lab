'use strict';

// ============================================================
// AI Precision Recall Lab — the attract demo (spec 01 §9): behind the start screen the belt and the pile run
// in the Abstract scenario (a sandbox run with its default knobs and a seed of its own), with a bot that sweeps
// the threshold slowly up and down between DEMO_T_LOW and DEMO_T_HIGH, a full sweep every DEMO_SWEEP_S
// seconds, so the matrix, the bars and the ROC and PR dots move by themselves. The pile starts with
// DEMO_PREFILL items so it looks alive at once. Pure decoration: nothing is saved, and the sounds must stay
// quiet for it (ui/sounds.js, I07: no sound while State.run.kind is 'demo'). game.js starts it on the start screen (not with
// prefers-reduced-motion), pauses it while the page is hidden or the menu is scrolled on a phone, and stops
// it when the start screen closes. No drawing, no DOM, no sound. Also used by the tests.
// ============================================================

const Demo = (() => {
  // the bot's threshold at a moment of the run's clock: a cosine sweep, low → high → low, on the 0.01 grid
  function thresholdAt(clock) {
    const phase = (clock % DEMO_SWEEP_S) / DEMO_SWEEP_S;
    return round2(lerp(DEMO_T_LOW, DEMO_T_HIGH, 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)));
  }

  // a new demo run (State.run, kind 'demo'): the sandbox's defaults in Abstract, the first items on the pile
  function start(seed) {
    const run = Sandbox.start(Object.assign(Sandbox.defaults(), { threshold: thresholdAt(0) }), seed);
    run.kind = 'demo';
    Sandbox.generate(DEMO_PREFILL, false);
    return run;
  }

  // every frame while it runs: the belt moves, the bot moves the line
  function update(dt) {
    const run = State.run;
    if (!run || run.kind !== 'demo') return;
    Stream.update(dt);
    State.threshold = thresholdAt(run.clock);
  }

  return { thresholdAt, start, update };
})();
