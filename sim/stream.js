'use strict';

// ============================================================
// AI Precision Recall Lab — streams of items (spec 02 §2.2, §2.4) and the gate (01 §1.2–1.3).
// A contract's whole stream is generated in advance from the attempt seed: arrival times (a Poisson process),
// classes, hidden logits, scores and, for value-weighted scenarios, payment amounts. Each of those comes from
// its own named sub-stream, so a change to one (e.g. a base rate schedule) never reshuffles the others; the
// validation set has its own stream too. The gate decides an item: flagged = score ≥ t on the 0.01 grid.
// I03 adds the arrivals onto the belt (Stream.update). No drawing, no DOM, no sound.
// Used by sim/contract.js, the sandbox, tools/balance-check.js and the tests.
// ============================================================

const Stream = (() => {
  // An item: { i, at (s from the start), y (1 = positive), z (hidden logit), s (raw score), amount? }.
  // opts: { seed, count, rate (items per second, difficulty included), model ({ dPrime, prevalence, gamma,
  // beta }), amounts (bool), schedule? (i → { prevalence?, drift? }, for incidents) }
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
      at += arrivals.exponential(opts.rate);
      const y = classes.bernoulli(prevalence);
      // z = class mean + a standard normal draw: the same draw for item i whatever the class or the d'
      const z = Model.logitMean(y, m.dPrime, drift) + noise.normal();
      const item = { i, at, y, z, s: Model.rawScore(z, m) };
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

  return { generate, validation, calibrate, outcome, decide };
})();
