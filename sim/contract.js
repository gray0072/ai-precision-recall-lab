'use strict';

// ============================================================
// AI Precision Recall Lab — a contract's rules (spec 01 §3.3, §4; 02 §5; 03 §2): prices and money per outcome
// (incl. the fraud prices that depend on the amount), goal checks with the difficulty's shift, the outbreak
// allowance and bankruptcy, the cost-optimal threshold p* (the ghost line), a headless run of a contract at a
// given threshold, the hindsight-best fixed threshold of the results screen and the stars. The live run
// (I04): Contract.start makes State.run from a contract of data/contracts.js; the gate prices each item and
// checks the rules (the goal chip, the outbreak, bankruptcy, the end; emits goalChanged / outbreak /
// contractEnded); Contract.results sums it up. I05 adds the review band, I06 top-k. Terms are plain objects:
// { scenario, prevalence, dPrime, items, rate, prices: { TP, FP, FN, TN } | 'fraud',
//   goal: { metric, min, beta? } | null, outbreak: n | null, fee, target }.
// No drawing, no DOM, no sound. Used by game.js, the results, campaign.js, tools/balance-check.js, the tests.
// ============================================================

const Contract = (() => {
  // the median genuine payment: the amount the single ghost line of a fraud contract is computed for (02 §5.1)
  const MEDIAN_AMOUNT = Math.round(Math.exp(AMOUNT_LOG_MEAN));

  // The money value of each outcome for this item, signed (a fine is negative). Fraud (03 §2): a blocked fraud
  // earns 0 (the loss is prevented), a blocked customer costs FRAUD_FP, a missed fraud costs its amount,
  // a passed genuine payment earns the commission.
  function values(prices, item) {
    if (prices === 'fraud') {
      const a = item && item.amount !== undefined ? item.amount : MEDIAN_AMOUNT;
      return { TP: FRAUD_TP, FP: FRAUD_FP, FN: -a, TN: FRAUD_COMMISSION * a };
    }
    return prices;
  }

  // the $ of one decided item, in whole cents so that sums do not drift
  function money(item, outcome, prices) { return Math.round(values(prices, item)[outcome] * 100) / 100; }

  // The cost-optimal threshold on the posterior p (02 §5.1). Flag when the expected value of flagging beats
  // passing: p·V_TP + (1 − p)·V_FP ≥ p·V_FN + (1 − p)·V_TN  ⇔  p ≥ p* = (V_TN − V_FP) / ((V_TP − V_FN) + (V_TN − V_FP)).
  // The numerator is what a false alarm costs compared with a right pass, the denominator adds what a miss costs
  // compared with a catch. null when the prices make no trade-off (one action is never worse).
  function pStar(v) {
    const gainCatch = v.TP - v.FN, gainPass = v.TN - v.FP;
    if (gainCatch + gainPass <= 0) return null;
    return clamp(gainPass / (gainCatch + gainPass), 0, 1);
  }
  // the ghost line's p* for a price list (fraud: for the median amount; with amounts a single line is a compromise)
  function ghostPStar(prices) { return pStar(values(prices, { amount: MEDIAN_AMOUNT })); }

  // the goal's target on this difficulty (01 §10): Easy −0.05, Hard +0.02
  function goalTarget(goal, difficulty) {
    return goal ? clamp(goal.min + DIFFICULTIES[difficulty].goalShift, 0, 1) : null;
  }
  // the goal metric's value on these counts (null while it is not defined)
  function goalValue(c, goal) { return goal ? Metrics.value(c, goal.metric, goal.beta || 1) : null; }
  // met: no goal, or a defined value at or above the target (an undefined value is not met)
  function goalMet(c, goal, difficulty) {
    if (!goal) return true;
    const v = goalValue(c, goal);
    return v !== null && v >= goalTarget(goal, difficulty) - 1e-12;
  }

  // the outbreak allowance on this difficulty (Easy +2, Hard −1, at least 1); null when the contract has none
  function outbreakAllowance(terms, difficulty) {
    return terms.outbreak ? Math.max(1, terms.outbreak + DIFFICULTIES[difficulty].outbreakExtra) : null;
  }

  // A contract played headless over a pre-generated stream. threshold: a number, or a function (item index →
  // t) for a threshold that moved. Stops early on a failure (01 §3.3): the outbreak starts when the FN count
  // reaches the allowance; bankruptcy when the contract's money falls below −fee.
  // Returns { counts, money, decided, failed: null | 'outbreak' | 'bankrupt', completed, goalValue, goalMet }.
  function play(items, terms, threshold, difficulty, key = 's') {
    const tAt = typeof threshold === 'function' ? threshold : () => threshold;
    const allowance = outbreakAllowance(terms, difficulty);
    const limit = terms.fee !== undefined ? -terms.fee : -Infinity;
    const c = Metrics.emptyCounts();
    let cash = 0, decided = 0, failed = null;
    for (const it of items) {
      const out = Stream.decide(it, tAt(it.i), key).outcome;
      c[out]++;
      cash = Math.round((cash + money(it, out, terms.prices)) * 100) / 100;
      decided++;
      if (allowance !== null && c.FN >= allowance) { failed = 'outbreak'; break; }
      if (cash < limit) { failed = 'bankrupt'; break; }
    }
    return {
      counts: c, money: cash, decided, failed, completed: failed === null,
      goalValue: goalValue(c, terms.goal), goalMet: goalMet(c, terms.goal, difficulty)
    };
  }

  // The hindsight-best fixed threshold (02 §5.2): over the contract's actual items, every t in 0.00 … 1.00 held
  // fixed the whole time; only thresholds that complete the contract and meet the goal count; the one with the
  // most money wins. Neighbouring thresholds with no item between them make the same decisions and tie: the
  // middle of the tied run is returned (it has the most room on both sides).
  // Returns { t, money, result, feasible, runs } — t and money null when no fixed threshold could make it.
  function hindsightBest(items, terms, difficulty, key = 's') {
    const runs = [];
    for (let k = 0; k <= 100; k++) runs.push(play(items, terms, k / 100, difficulty, key));
    const ok = (r) => r.completed && r.goalMet;
    let best = -1;
    for (let k = 0; k <= 100; k++) if (ok(runs[k]) && (best < 0 || runs[k].money > runs[best].money)) best = k;
    if (best < 0) return { t: null, money: null, result: null, feasible: false, runs };
    let end = best;
    while (end + 1 <= 100 && ok(runs[end + 1]) && runs[end + 1].money === runs[best].money) end++;
    const k = Math.floor((best + end) / 2);
    return { t: k / 100, money: runs[k].money, result: runs[k], feasible: true, runs };
  }

  // ---------- stars (01 §4) ----------
  // ★ completed and the goal met (no goal: completed); ★★ also profit ≥ the contract's target; ★★★ also profit
  // ≥ STAR3_SHARE of the hindsight-best profit (written so that it also works for a best below zero).
  // Out of reach when no fixed threshold could make the contract (best.feasible false).
  function stars(r, target, best) {
    if (!r.completed || !r.goalMet) return 0;
    if (r.money < target - 1e-9) return 1;
    if (!best || !best.feasible) return 2;
    return r.money >= best.money - (1 - STAR3_SHARE) * Math.abs(best.money) - 1e-9 ? 3 : 2;
  }

  // ---------- the live run of a contract (01 §3) ----------

  // The model of a contract on a difficulty: the scenario's temperament with the contract's base rate and its
  // d' + the Lab's bonus + the difficulty's offset (02 §2.1).
  function modelOf(def, difficulty, bonus = 0) {
    const d = Model.effectiveDPrime(def.dPrime, bonus, DIFFICULTIES[difficulty].dPrime);
    return Model.of(SCENARIOS[def.scenario], { prevalence: def.prevalence, dPrime: d });
  }

  // The contract's whole stream, made in advance from the attempt seed (02 §2.2); the same function the live
  // run, the balance check and the tests use, so they all see the same items for a seed.
  function streamOf(def, difficulty, seed, bonus = 0) {
    const diff = DIFFICULTIES[difficulty];
    return Stream.generate({
      seed, count: def.items, rate: def.rate * diff.speed, model: modelOf(def, difficulty, bonus),
      amounts: !!SCENARIOS[def.scenario].amounts
    });
  }

  // Starts a contract as State.run. opts: { difficulty, seed, bonus (the Lab's d', 0 until I05) }.
  // The stream is pre-generated; the belt takes the items in order (source). The validation set (with amounts
  // for value-weighted scenarios, from a sub-stream of its own) gives the curves and, on Easy, the profit curve.
  // The ghost line (01 §10): on Easy the cost-optimal p* mapped from the true posterior to the raw score axis;
  // on Medium only with Calibration (I05); never on Hard.
  function start(def, opts) {
    const difficulty = opts.difficulty, diff = DIFFICULTIES[difficulty];
    const scenario = SCENARIOS[def.scenario];
    const model = modelOf(def, difficulty, opts.bonus || 0);
    const items = streamOf(def, difficulty, opts.seed, opts.bonus || 0);
    const val = Stream.validation(opts.seed, model);
    if (scenario.amounts) {
      const rng = Rng.stream(opts.seed, 'validation.amounts');
      for (const it of val) it.amount = Stream.amount(rng, it.y);
    }
    const run = {
      kind: 'contract', def, difficulty, seed: opts.seed, scenario, model, val, curves: Metrics.modelCurves(val),
      key: 's', platt: null, items, clock: 0, travelS: BELT_TRAVEL_S / diff.speed, window: PILE_WINDOW,
      totals: Metrics.emptyCounts(), count: 0, frozen: false, next: null, prices: def.prices, money: 0,
      tint: diff.tint, goal: def.goal, goalTarget: goalTarget(def.goal, difficulty),
      allowance: outbreakAllowance(def, difficulty), limit: -def.fee, goalState: 'grace', ended: null, cheated: false
    };
    let at = 0;
    run.source = () => (at < items.length ? items[at++] : null);
    run.moneyOf = (it, outcome) => money(it, outcome, def.prices);
    run.afterGate = () => check(run);
    run.profit = Metrics.profitCurve(val, run.moneyOf, 's');
    let best = 0;
    for (let k = 1; k < run.profit.length; k++) if (run.profit[k].per100 > run.profit[best].per100) best = k;
    run.bestT = run.profit[best].t;
    const p = ghostPStar(def.prices);
    run.ghostT = diff.ghost === 'always' && p !== null ? Model.scoreForPosterior(p, model) : null;
    State.run = run;
    State.belt = [];
    State.pile = [];
    State.pileVersion++;
    State.highlight = null;
    run.next = run.source();
    return run;
  }

  // the goal chip (01 §3.2): 'grace' for the first GOAL_GRACE_ITEMS, then 'met' / 'close' (within GOAL_CLOSE) /
  // 'broken' on the cumulative value; 'none' without a goal
  function goalStateOf(run) {
    if (!run.goal) return 'none';
    if (run.count < GOAL_GRACE_ITEMS) return 'grace';
    const v = goalValue(run.totals, run.goal);
    if (v !== null && v >= run.goalTarget - 1e-12) return 'met';
    if (v !== null && v >= run.goalTarget - GOAL_CLOSE) return 'close';
    return 'broken';
  }

  // the rules after every decision: the money, the outbreak, bankruptcy, the goal chip, the last item
  function check(run) {
    const it = State.pile[State.pile.length - 1];
    run.money = Math.round((run.money + (it ? it.money : 0)) * 100) / 100;
    const g = goalStateOf(run);
    if (g !== run.goalState) { run.goalState = g; GameEvents.emit('goalChanged', { state: g }); }
    if (run.allowance !== null && run.totals.FN >= run.allowance) end(run, 'outbreak');
    else if (run.money < run.limit) end(run, 'bankrupt');
    else if (run.count >= run.def.items) end(run, null);
  }

  function end(run, failed) {
    if (run.ended) return;
    run.ended = { failed };
    if (failed === 'outbreak') GameEvents.emit('outbreak', {});
    GameEvents.emit('contractEnded', { failed });
  }

  // the debug cheat F (01 §14): end the contract now with the results so far
  function finishNow(run) {
    if (run.ended) return;
    run.cheated = true;
    run.finishedEarly = true;
    end(run, null);
  }

  // Called by the main loop after Stream.update: the end of the contract, once it has come (null before).
  function update() {
    const run = State.run;
    return run && run.kind === 'contract' ? run.ended : null;
  }

  // The results of an ended run (01 §3.4): the totals of the decisions actually made, the goal, the
  // hindsight-best fixed threshold over the contract's stream (only the items decided when it was cut short
  // by the cheat), the share of it the player made, the stars, the threshold over time, the profit curve of
  // the stream (money at every fixed threshold) and the player's average threshold.
  function results(run) {
    const decided = run.items.filter((it) => it.outcome !== undefined);
    const failed = run.ended ? run.ended.failed : null;
    const completed = !!run.ended && failed === null;
    const pool = run.finishedEarly ? decided : run.items;
    const best = hindsightBest(pool, run.def, run.difficulty, run.key);
    const r = {
      id: run.def.id, difficulty: run.difficulty, seed: run.seed, failed, completed, cheated: run.cheated,
      counts: Object.assign({}, run.totals), decided: run.count, items: run.def.items, money: run.money,
      goal: run.goal, goalTarget: run.goalTarget, goalValue: goalValue(run.totals, run.goal),
      goalMet: goalMet(run.totals, run.goal, run.difficulty),
      best: { t: best.t, money: best.money, feasible: best.feasible },
      thresholds: decided.map((it) => it.t),
      profit: Metrics.profitCurve(pool, run.moneyOf, run.key).map((q) => ({ t: q.t, money: Math.round(q.money * 100) / 100 }))
    };
    r.avgT = r.thresholds.length ? round2(r.thresholds.reduce((a, b) => a + b, 0) / r.thresholds.length) : null;
    r.share = best.feasible && best.money > 0 ? r.money / best.money : null;
    r.beatBest = completed && best.feasible && r.money > best.money + 1e-9;
    r.stars = stars(r, run.def.target, r.best);
    return r;
  }

  return {
    MEDIAN_AMOUNT, values, money, pStar, ghostPStar, goalTarget, goalValue, goalMet, outbreakAllowance, play, hindsightBest,
    stars, modelOf, streamOf, start, goalStateOf, finishNow, update, results
  };
})();
