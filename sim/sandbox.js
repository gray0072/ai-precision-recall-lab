'use strict';

// ============================================================
// AI Precision Recall Lab — the sandbox (spec 01 §7): the play screen without money, goals or an end. Its
// knobs (scenario, base rate, separation d', calibrated scores, the true class on the belt, speed, prices,
// formula view, the threshold) make the model; the stream is endless (Stream.endless) and always made with
// the current model. A knob that changes the model regenerates the validation set from the same seed, so
// the curves morph smoothly as a slider moves, and refits Platt scaling; items already made keep their score.
// Generate 1 000 fills the pile at once (and widens the window to 1 000), Clear empties belt and pile, Step
// rides the belt until the next item has been decided. No drawing, no DOM, no sound: ui/sandboxpanel.js
// shows and remembers the knobs (prLab.sandbox.v1), game.js runs it. Also used by the tests.
// ============================================================

const Sandbox = (() => {
  // the scenarios of the picker; Search Ranker comes with the top-k mode (I06)
  const SCENARIO_IDS = ['abstract', 'spam', 'fever', 'bolts', 'fraud', 'moderation'];

  function defaults() {
    const sc = SCENARIOS.abstract;
    return {
      scenario: 'abstract', prevalence: sc.prevalence, dPrime: sc.dPrime, calibrated: false, showClass: false,
      speed: 1, prices: Object.assign({}, SANDBOX_PRICES), formulas: false, threshold: 0.5
    };
  }

  const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
  // Knobs read from storage or a slider, checked field by field: a missing or broken value takes the default.
  function sanitize(k) {
    const d = defaults();
    k = k && typeof k === 'object' ? k : {};
    const prices = {};
    for (const o of ['TP', 'FP', 'FN', 'TN']) {
      prices[o] = clamp(Math.round(num(k.prices && k.prices[o], d.prices[o])), -SANDBOX_PRICE_MAX, SANDBOX_PRICE_MAX);
    }
    return {
      scenario: SCENARIO_IDS.includes(k.scenario) ? k.scenario : d.scenario,
      prevalence: clamp(roundPrevalence(num(k.prevalence, d.prevalence)), SANDBOX_PREVALENCE_MIN, SANDBOX_PREVALENCE_MAX),
      dPrime: clamp(Math.round(num(k.dPrime, d.dPrime) * 10) / 10, 0, SANDBOX_DPRIME_MAX),
      calibrated: k.calibrated === true,
      showClass: k.showClass === true,
      speed: SANDBOX_SPEEDS.includes(k.speed) ? k.speed : d.speed,
      prices,
      formulas: k.formulas === true,
      threshold: clamp(round2(num(k.threshold, d.threshold)), 0, 1)
    };
  }

  // a base rate on the log slider, kept to two significant digits (0.5 %, 4.2 %, 25 %)
  function roundPrevalence(p) {
    if (!(p > 0)) return SANDBOX_PREVALENCE_MIN;
    const mag = Math.pow(10, Math.floor(Math.log10(p)) - 1);
    return Math.round(p / mag) * mag;
  }

  // the model of the knobs: the scenario's temperament (γ, β) with the knobs' base rate and separation
  function modelOf(k) { return Model.of(SCENARIOS[k.scenario], { prevalence: k.prevalence, dPrime: k.dPrime }); }

  // ---------- the run ----------
  function start(knobs, seed) {
    const k = sanitize(knobs);
    const run = {
      kind: 'sandbox', knobs: k, seed, clock: 0, lastAt: 0, travelS: BELT_TRAVEL_S, window: PILE_WINDOW,
      totals: Metrics.emptyCounts(), count: 0, frozen: false, next: null
    };
    const gen = Stream.endless(seed);
    run.source = () => {
      const it = gen(SANDBOX_RATE, run.model);
      run.lastAt += it.gap;
      it.at = run.lastAt;
      if (!run.scenario.amounts) delete it.amount;
      it.p = Model.calibrate(it.s, run.platt);
      return it;
    };
    State.run = run;
    State.belt = [];
    State.pile = [];
    State.pileVersion++;
    State.threshold = k.threshold;
    rebuild();
    run.next = run.source();
    return run;
  }

  // The model changed (scenario, base rate, separation): the validation set from the same seed with the new
  // model, the Platt fit on it, the calibrated p of every item still around, the curves and the profit curve.
  function rebuild() {
    const run = State.run, k = run.knobs;
    run.scenario = SCENARIOS[k.scenario];
    run.model = modelOf(k);
    run.val = Stream.validation(run.seed, run.model);
    run.platt = Model.fitPlatt(run.val.map((it) => it.s), run.val.map((it) => it.y));
    Stream.calibrate(run.val, run.platt);
    for (const it of State.belt) it.p = Model.calibrate(it.s, run.platt);
    for (const it of State.pile) it.p = Model.calibrate(it.s, run.platt);
    if (run.next) run.next.p = Model.calibrate(run.next.s, run.platt);
    run.curves = Metrics.modelCurves(run.val);
    State.pileVersion++;
    reprice();
  }

  // what is compared with the threshold: the raw score, or the calibrated p (02 §2.3); and the profit curve
  // on that axis with the sandbox's prices, its best threshold, and the cost-optimal p* (the ghost line)
  function reprice() {
    const run = State.run, k = run.knobs;
    run.key = k.calibrated ? 'p' : 's';
    run.prices = k.prices;
    run.profit = Metrics.profitCurve(run.val, (it, o) => k.prices[o], run.key);
    let best = 0;
    for (let i = 1; i < run.profit.length; i++) if (run.profit[i].per100 > run.profit[best].per100) best = i;
    run.bestT = run.profit[best].t;
    run.pStar = Contract.pStar(k.prices);
    // the ghost line: only a calibrated p can be compared with p* (a raw score is not a probability)
    run.ghostT = run.key === 'p' && run.pStar !== null ? Math.ceil(run.pStar * 100 - 1e-9) / 100 : null;
  }

  // The raw-score threshold the curves' operating point is read at (ADR-0004): t itself on raw scores,
  // the smallest raw score whose calibrated p reaches t when calibrated.
  function rawThreshold(t) {
    const run = State.run;
    return run.key === 'p' ? Model.rawThreshold(t, run.platt) : t;
  }

  // Changes one knob; returns the sanitized knobs. Switching calibration keeps the line at the same items:
  // the threshold's number moves to the other axis (calibration changes what a number means, not the ranking).
  function set(name, value) {
    const run = State.run, old = run.knobs;
    const k = sanitize(Object.assign({}, old, { [name]: value, threshold: State.threshold }));
    if (name === 'scenario' && k.scenario !== old.scenario) {
      const sc = SCENARIOS[k.scenario];
      k.prevalence = sc.prevalence;
      k.dPrime = Math.min(sc.dPrime, SANDBOX_DPRIME_MAX);
    }
    run.knobs = k;
    if (k.scenario !== old.scenario || k.prevalence !== old.prevalence || k.dPrime !== old.dPrime) rebuild();
    if (k.calibrated !== old.calibrated) {
      const t = State.threshold;
      State.threshold = t <= 0 || t >= 1 ? t : k.calibrated ? Model.calibrate(t, run.platt) : Model.rawThreshold(t, run.platt);
      k.threshold = State.threshold;
      State.pileVersion++;
    }
    reprice();
    return k;
  }

  // "Generate 1 000 at once": items decided at the current threshold straight onto the pile, no ride;
  // the window grows to SANDBOX_GENERATE so the humps and the live numbers are smooth.
  function generate(n = SANDBOX_GENERATE) {
    const run = State.run;
    run.window = Math.max(run.window, SANDBOX_GENERATE);
    const gen = Stream.endless(Rng.hashString('generate') ^ run.seed ^ run.count);
    for (let i = 0; i < n; i++) {
      const it = gen(SANDBOX_RATE, run.model);
      if (!run.scenario.amounts) delete it.amount;
      it.p = Model.calibrate(it.s, run.platt);
      it.instant = true;   // no ride, no reveal animation
      const d = Stream.decide(it, State.threshold, run.key);
      it.flagged = d.flagged;
      it.outcome = d.outcome;
      run.totals[d.outcome]++;
      run.count++;
      Stream.toPile(it);
    }
    GameEvents.emit('pileGenerated', { count: n });
  }

  // Clear: an empty belt and pile, the counts from zero, the window back to PILE_WINDOW
  function clear() {
    const run = State.run;
    State.belt = [];
    State.pile = [];
    State.pileVersion++;
    run.window = PILE_WINDOW;
    run.totals = Metrics.emptyCounts();
    run.count = 0;
    if (run.next) { run.next.at = run.clock + run.next.gap; run.lastAt = run.next.at; }
  }

  // Step: ride until the next item has been decided (the belt may be frozen)
  function step() {
    const dt = Stream.timeToGate();
    if (isFinite(dt)) Stream.update(dt + 1e-6);
  }

  return { SCENARIO_IDS, defaults, sanitize, modelOf, start, rebuild, set, rawThreshold, generate, clear, step };
})();
