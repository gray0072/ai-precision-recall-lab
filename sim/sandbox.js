'use strict';

// ============================================================
// AI Precision Recall Lab — the sandbox (spec 01 §7): the play screen without money, goals or an end. Its
// knobs (scenario, base rate, separation d', calibrated scores, the true class on the belt, speed, prices,
// formula view, the review band with its lower edge, the threshold) make the model (the review band: a desk of
// level REVIEW_SANDBOX_LEVEL, sim/review.js); the stream is endless (Stream.endless) and always made with
// the current model. A knob that changes the model regenerates the validation set from the same seed, so
// the curves morph smoothly as a slider moves, and refits Platt scaling; items already made keep their score.
// Generate 1 000 fills the pile at once (and widens the window to 1 000), Clear empties belt and pile, Step
// rides the belt until the next item has been decided. Top-k mode (02 §7) is the Search Ranker scenario: the
// stream comes in queries of TOPK_DOCS documents (SANDBOX_TOPK_RATE per second), the knob is State.k (kept
// as knobs.k), the window holds TOPK_WINDOW queries; base rate, calibration and the review band do not apply
// to it (a per-query line has no band under it, and calibration changes no ranking). Switching the mode
// starts the belt and the pile afresh. The attract demo (sim/demo.js) runs on a sandbox run too.
// No drawing, no DOM, no sound: ui/sandboxpanel.js shows and remembers the knobs (prLab.sandbox.v1), game.js
// runs it. Also used by the tests.
// ============================================================

const Sandbox = (() => {
  // the scenarios of the picker; Search Ranker is the Top-k mode
  const SCENARIO_IDS = ['abstract', 'spam', 'fever', 'bolts', 'fraud', 'moderation', 'retrieval'];
  const isTopk = (k) => k.scenario === 'retrieval';

  function defaults() {
    const sc = SCENARIOS.abstract;
    return {
      scenario: 'abstract', prevalence: sc.prevalence, dPrime: sc.dPrime, calibrated: false, showClass: false,
      speed: 1, prices: Object.assign({}, SANDBOX_PRICES), formulas: false, review: false, reviewLow: 0.35, threshold: 0.5,
      k: TOPK_K_DEFAULT
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
    const scenario = SCENARIO_IDS.includes(k.scenario) ? k.scenario : d.scenario;
    const topk = scenario === 'retrieval';
    return {
      scenario,
      prevalence: clamp(roundPrevalence(num(k.prevalence, d.prevalence)), SANDBOX_PREVALENCE_MIN, SANDBOX_PREVALENCE_MAX),
      dPrime: clamp(Math.round(num(k.dPrime, d.dPrime) * 10) / 10, 0, SANDBOX_DPRIME_MAX),
      calibrated: !topk && k.calibrated === true,
      showClass: k.showClass === true,
      speed: SANDBOX_SPEEDS.includes(k.speed) ? k.speed : d.speed,
      prices,
      formulas: k.formulas === true,
      review: !topk && k.review === true,
      reviewLow: clamp(round2(num(k.reviewLow, d.reviewLow)), 0, 1),
      threshold: clamp(round2(num(k.threshold, d.threshold)), 0, 1),
      k: clamp(Math.round(num(k.k, d.k)), 1, TOPK_DOCS)
    };
  }

  // The review band (01 §7): a desk of level REVIEW_SANDBOX_LEVEL whose band starts at the knobs' reviewLow
  // (never above the threshold); off, the desk goes and the items already sent are decided by the model again.
  function applyReview() {
    const run = State.run, k = run.knobs;
    if (k.review && !State.review) Review.attach(run, REVIEW_SANDBOX_LEVEL, Math.min(k.reviewLow, State.threshold));
    if (k.review && State.review) State.review.last = run.clock;
    if (!k.review && State.review) {
      Review.detach(run);
      for (const it of State.belt) it.sent = false;
      if (run.topk) run.decideAt = (item) => Topk.decide(item, State.k);
    }
  }

  // a base rate on the log slider, kept to two significant digits (0.5 %, 4.2 %, 25 %)
  function roundPrevalence(p) {
    if (!(p > 0)) return SANDBOX_PREVALENCE_MIN;
    const mag = Math.pow(10, Math.floor(Math.log10(p)) - 1);
    return Math.round(p / mag) * mag;
  }

  // the model of the knobs: the scenario's temperament (γ, β) with the knobs' base rate and separation (top-k:
  // the ranker's, sim/topk.js)
  function modelOf(k) {
    if (isTopk(k)) return Topk.modelOf(k.dPrime);
    return Model.of(SCENARIOS[k.scenario], { prevalence: k.prevalence, dPrime: k.dPrime });
  }

  // Where the run's items come from: one at a time (Stream.endless), or in Top-k mode one query of TOPK_DOCS
  // documents arriving together, every 1 / SANDBOX_TOPK_RATE seconds
  function makeSource(run) {
    if (isTopk(run.knobs)) {
      const gen = Topk.endless(run.seed ^ Rng.hashString('topk'));
      let buf = [];
      run.decideAt = (item) => Topk.decide(item, State.k);
      run.window = TOPK_WINDOW * TOPK_DOCS;
      return () => {
        if (!buf.length) {
          buf = gen(run.model);
          const gap = 1 / SANDBOX_TOPK_RATE;
          run.lastAt += gap;
          for (const it of buf) { it.at = run.lastAt; it.gap = gap; it.i = run.qDocs++; }
        }
        return buf.shift();
      };
    }
    if (run.decideAt && !State.review) run.decideAt = null;
    run.window = PILE_WINDOW;
    const gen = Stream.endless(run.seed);
    return () => {
      const it = gen(SANDBOX_RATE, run.model);
      run.lastAt += it.gap;
      it.at = run.lastAt;
      if (!run.scenario.amounts) delete it.amount;
      it.p = Model.calibrate(it.s, run.platt);
      return it;
    };
  }

  // ---------- the run ----------
  function start(knobs, seed) {
    const k = sanitize(knobs);
    const run = {
      kind: 'sandbox', knobs: k, seed, clock: 0, lastAt: 0, travelS: BELT_TRAVEL_S, window: PILE_WINDOW,
      totals: Metrics.emptyCounts(), count: 0, frozen: false, next: null, qDocs: 0
    };
    State.run = run;
    State.belt = [];
    State.pile = [];
    State.pileVersion++;
    State.threshold = k.threshold;
    State.k = k.k;
    Review.detach(run);
    rebuild();
    run.topk = isTopk(k);
    run.source = makeSource(run);
    run.next = run.source();
    applyReview();
    return run;
  }

  // The model changed (scenario, base rate, separation): the validation set from the same seed with the new
  // model, the Platt fit on it, the calibrated p of every item still around, the curves and the profit curve.
  function rebuild() {
    const run = State.run, k = run.knobs;
    run.scenario = SCENARIOS[k.scenario];
    run.model = modelOf(k);
    if (isTopk(k)) {
      run.val = Topk.validation(run.seed, run.model);
      run.platt = null;
      run.curves = Topk.curves(run.val);
      State.pileVersion++;
      reprice();
      return;
    }
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
    if (isTopk(k)) {   // a top-k run has no profit curve over thresholds and no ghost line
      run.profit = null; run.bestT = null; run.pStar = Contract.pStar(k.prices); run.ghostT = null;
      return;
    }
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
    const k = sanitize(Object.assign({}, old, { threshold: State.threshold, k: State.k, reviewLow: State.review ? State.review.low : old.reviewLow }, { [name]: value }));
    if (name === 'scenario' && k.scenario !== old.scenario) {
      const sc = SCENARIOS[k.scenario];
      if (sc.prevalence !== null) k.prevalence = sc.prevalence;
      k.dPrime = Math.min(sc.dPrime, SANDBOX_DPRIME_MAX);
    }
    run.knobs = k;
    if (k.scenario !== old.scenario || k.prevalence !== old.prevalence || k.dPrime !== old.dPrime) rebuild();
    if (isTopk(k) !== isTopk(old)) {   // the mode changed: a new source, an empty belt and pile
      run.topk = isTopk(k);
      if (!run.topk && run.decideAt) run.decideAt = null;
      run.source = makeSource(run);
      clear();
    }
    if (k.calibrated !== old.calibrated) {
      const t = State.threshold;
      const move = (v) => (v <= 0 || v >= 1 ? v : k.calibrated ? Model.calibrate(v, run.platt) : Model.rawThreshold(v, run.platt));
      State.threshold = move(t);
      k.threshold = State.threshold;
      k.reviewLow = Math.min(move(k.reviewLow), State.threshold);
      if (State.review) State.review.low = k.reviewLow;
      State.pileVersion++;
    }
    applyReview();
    reprice();
    return k;
  }

  // "Generate 1 000 at once": items decided at the current threshold straight onto the pile, no ride;
  // the window grows to SANDBOX_GENERATE so the humps and the live numbers are smooth.
  // widen: false keeps the window as it is (the attract demo's first items). In Top-k mode whole queries are
  // made (n / TOPK_DOCS of them), decided at the current k.
  function generate(n = SANDBOX_GENERATE, widen = true) {
    const run = State.run;
    if (widen) run.window = Math.max(run.window, run.topk ? Math.ceil(SANDBOX_GENERATE / TOPK_DOCS) * TOPK_DOCS : SANDBOX_GENERATE);
    if (run.topk) {
      const qgen = Topk.endless(Rng.hashString('generate') ^ run.seed ^ run.count);
      for (let q = 0; q < Math.ceil(n / TOPK_DOCS); q++) {
        for (const it of qgen(run.model)) {
          it.instant = true;
          it.i = run.qDocs++;
          it.q = -1 - run.count;   // a query of its own, apart from the belt's
          const d = Topk.decide(it, State.k);
          it.flagged = d.flagged;
          it.outcome = d.outcome;
          run.totals[d.outcome]++;
          Stream.toPile(it);
        }
        run.count += TOPK_DOCS;
      }
      GameEvents.emit('pileGenerated', { count: n });
      return;
    }
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
    run.window = run.topk ? TOPK_WINDOW * TOPK_DOCS : PILE_WINDOW;
    run.totals = Metrics.emptyCounts();
    run.count = 0;
    if (State.review) Object.assign(State.review, { busy: 0, progress: 0, last: run.clock, reviewed: 0, full: 0, sent: 0 });
    if (run.topk) {   // the next query from now on (a query's documents always arrive together)
      run.lastAt = run.clock - 1 / SANDBOX_TOPK_RATE + 0.5;
      run.source = makeSource(run);
      run.next = run.source();
    } else if (run.next) { run.next.at = run.clock + run.next.gap; run.lastAt = run.next.at; }
  }

  // Step: ride until the next item has been decided (the belt may be frozen)
  function step() {
    const dt = Stream.timeToGate();
    if (isFinite(dt)) Stream.update(dt + 1e-6);
  }

  return { SCENARIO_IDS, defaults, sanitize, modelOf, start, rebuild, set, rawThreshold, generate, clear, step };
})();
