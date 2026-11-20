'use strict';

// ============================================================
// AI Precision Recall Lab — streams of items (spec 02 §2.2, §2.4) and the gate (01 §1.2–1.3).
// A contract's whole stream is generated in advance from the attempt seed: arrival times (a Poisson process),
// classes, hidden logits, scores and, for value-weighted scenarios, payment amounts. Each of those comes from
// its own named sub-stream, so a change to one (e.g. a base rate schedule) never reshuffles the others; the
// validation set has its own stream too. The gate decides an item: flagged = score ≥ t on the 0.01 grid.
// The sandbox's endless source draws items one at a time from the same sub-streams. Stream.update moves the
// run's clock: items arrive onto the belt, ride for travelS seconds, and at the gate they are decided with the
// threshold of that moment and land on the pile (emitting itemArrived / itemDecided). No drawing, no DOM,
// no sound. Used by sim/contract.js, sim/sandbox.js, game.js, tools/balance-check.js and the tests.
// ============================================================

const Stream = (() => {
  // An item: { i, at (s from the start), y (1 = positive), z (hidden logit), e (its own standard normal draw:
  // z = class mean + e), drift (of its moment), s (raw score), amount? }.
  // opts: { seed, count, rate (items per second, difficulty included), model ({ dPrime, prevalence, gamma,
  // beta }), amounts (bool), schedule? (i → { prevalence?, drift?, rate? (a factor) }, for incidents) }
  function generate(opts) {
    const arrivals = Rng.stream(opts.seed, 'items.arrivals');
    const classes = Rng.stream(opts.seed, 'items.classes');
    const noise = Rng.stream(opts.seed, 'items.scores');
    const money = Rng.stream(opts.seed, 'items.amounts');
    const m = opts.model;
    const items = [];
    let at = 0;
    for (let i = 0; i < opts.count; i++) {
      const now = opts.schedule ? opts.schedule(i) : null;
      const prevalence = now && now.prevalence !== undefined ? now.prevalence : m.prevalence;
      const drift = now && now.drift !== undefined ? now.drift : 0;
      // the exponential gap of a Poisson process: one uniform draw per item, scaled by the rate of the moment
      at += arrivals.exponential(opts.rate * (now && now.rate !== undefined ? now.rate : 1));
      const y = classes.bernoulli(prevalence);
      // z = class mean + a standard normal draw: the same draw for item i whatever the class or the d'
      const e = noise.normal();
      const z = Model.logitMean(y, m.dPrime, drift) + e;
      const item = { i, at, y, z, e, drift, s: Model.rawScore(z, m) };
      if (opts.amounts) item.amount = amount(money, y);
      items.push(item);
    }
    return items;
  }

  // a payment amount: log-normal, fraud a bit larger on average; whole dollars in [AMOUNT_MIN, AMOUNT_MAX].
  // The model does not see it: it does not change the score.
  function amount(rng, y) {
    const v = rng.lognormal(AMOUNT_LOG_MEAN + (y ? AMOUNT_FRAUD_SHIFT : 0), AMOUNT_LOG_SD);
    return clamp(Math.round(v), AMOUNT_MIN, AMOUNT_MAX);
  }

  // The validation set: N_VAL items with the contract's initial π and d' — the data the team evaluated the model
  // on before going live. The model curves, the calibration fit and the drift reference use it.
  function validation(seed, m, n = N_VAL) {
    const rng = Rng.stream(seed, 'validation');
    const items = [];
    for (let i = 0; i < n; i++) {
      const y = rng.bernoulli(m.prevalence);
      const z = Model.logitMean(y, m.dPrime) + rng.normal();
      items.push({ i, y, z, s: Model.rawScore(z, m) });
    }
    return items;
  }

  // adds the calibrated p to every item (the badge after the Calibration upgrade); returns the same array
  function calibrate(items, platt) {
    for (const it of items) it.p = Model.calibrate(it.s, platt);
    return items;
  }

  // the four outcomes: the first letter is whether the model was right, the second what it said (G-matrix)
  function outcome(flagged, y) { return flagged ? (y ? 'TP' : 'FP') : (y ? 'FN' : 'TN'); }

  // The gate: flagged when the item's value (the raw score s, or the calibrated p) is ≥ t on the 0.01 grid.
  // t = 0 flags everything (no score is below 0.01), t = 1 nothing (no score is above 0.99).
  function decide(item, t, key = 's') {
    const flagged = atOrAbove(item[key], t);
    return { flagged, outcome: outcome(flagged, item.y) };
  }

  // An endless source (the sandbox): the same four sub-streams as generate(), one item per call, made with the
  // model current at that moment. Returns next(rate, model) → { i, gap (s since the previous arrival), y, z, s,
  // amount }. The amount is always drawn (the sub-streams stay aligned) and used only by value-weighted scenarios.
  function endless(seed) {
    const arrivals = Rng.stream(seed, 'items.arrivals');
    const classes = Rng.stream(seed, 'items.classes');
    const noise = Rng.stream(seed, 'items.scores');
    const money = Rng.stream(seed, 'items.amounts');
    let i = 0;
    return function next(rate, m) {
      const gap = arrivals.exponential(rate);
      const y = classes.bernoulli(m.prevalence);
      const z = Model.logitMean(y, m.dPrime) + noise.normal();
      return { i: i++, gap, y, z, s: Model.rawScore(z, m), amount: amount(money, y) };
    };
  }

  // ---------- the belt (01 §1.1–1.4): State.run's clock, arrivals, the gate, the pile ----------

  // how far an item has ridden: 0 at entry, 1 at the gate
  function progress(item) { return (State.run.clock - item.enter) / State.run.travelS; }

  // run time until the next item reaches the gate (the one in front, or the one still to arrive); Infinity if none
  function timeToGate() {
    const run = State.run;
    if (!run) return Infinity;
    if (State.belt.length) return Math.max(0, State.belt[0].enter + run.travelS - run.clock);
    return run.next ? Math.max(0, run.next.at - run.clock) + run.travelS : Infinity;
  }

  // a decided item joins the pile; the pile keeps the last run.window items (the rolling window, 02 §3.4)
  function toPile(item) {
    const pile = State.pile;
    pile.push(item);
    if (pile.length > State.run.window) pile.splice(0, pile.length - State.run.window);
    State.pileVersion++;
  }

  // The gate: the item is decided with the threshold of this moment and revealed (01 §1.3). The threshold is
  // kept on the item (the results' sparkline). With a review desk (sim/review.js) the run's decideAt sends the
  // items of the band (and those tapped) to people instead. A contract prices the outcome (run.moneyOf) and
  // checks its rules right after (run.afterGate: the outbreak, bankruptcy, the goal chip, the drift monitor,
  // the end); the sandbox has neither.
  function gate(item) {
    const run = State.run;
    const d = run.decideAt ? run.decideAt(item) : decide(item, State.threshold, run.key);
    item.flagged = d.flagged;
    item.outcome = d.outcome;
    item.t = State.threshold;
    item.reviewed = !!d.reviewed;
    item.money = run.moneyOf ? run.moneyOf(item, d.outcome) : 0;
    run.totals[d.outcome]++;
    run.count++;
    toPile(item);
    GameEvents.emit('itemDecided', { item, outcome: d.outcome, money: item.money });
    if (run.afterGate) run.afterGate(item);
  }

  // Advances the run by dt seconds of run time: arrivals enter the belt at their own arrival time (so the
  // spacing does not depend on the frame rate), and every item that has ridden travelS seconds is decided.
  // The belt is first in, first out: every item rides the same time. Nothing moves once a contract has ended.
  function update(dt) {
    const run = State.run;
    if (!run || run.ended) return;
    run.clock += dt;
    while (run.next && run.next.at <= run.clock) {
      const item = run.next;
      item.enter = item.at;
      if (run.onArrive) run.onArrive(item);   // a crafted item gets its score now; a new phase begins (C12)
      State.belt.push(item);
      GameEvents.emit('itemArrived', { item });
      run.next = run.source();
    }
    while (!run.ended && State.belt.length && run.clock - State.belt[0].enter >= run.travelS - 1e-9) gate(State.belt.shift());
  }

  // what the pile and the live panel show for an item now (the rolling window re-evaluated, 02 §3.4): flagged
  // at the current threshold, or shown at the current k in a top-k run
  function flaggedNow(run, it) { return run.topk ? Topk.shown(it, State.k) : atOrAbove(it[run.key], State.threshold); }
  // the counts of the pile now
  function windowCounts(run) { return run.topk ? Topk.counts(State.pile, State.k) : Metrics.counts(State.pile, State.threshold, run.key); }

  return { generate, amount, validation, calibrate, outcome, decide, endless, progress, timeToGate, toPile, gate, update, flaggedNow, windowCounts };
})();
