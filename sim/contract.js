'use strict';

// ============================================================
// AI Precision Recall Lab — a contract's rules (spec 01 §3.3, §4; 02 §5; 03 §2), first part (I02): prices and
// money per outcome (incl. the fraud prices that depend on the amount), goal checks with the difficulty's
// shift, the outbreak allowance and bankruptcy, the cost-optimal threshold p* (the ghost line), a headless run
// of a contract at a given threshold, and the hindsight-best fixed threshold of the results screen.
// I04 adds the live run (Contract.update, events), stars and the fee; I05 the review band; I06 top-k.
// Terms are plain objects (data/contracts.js from I04): { scenario, prevalence, dPrime, items, rate,
// prices: { TP, FP, FN, TN } | 'fraud', goal: { metric, min, beta? } | null, outbreak: n | null, fee, target }.
// No drawing, no DOM, no sound. Used by game.js (I04), the results, tools/balance-check.js and the tests.
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

  return { MEDIAN_AMOUNT, values, money, pStar, ghostPStar, goalTarget, goalValue, goalMet, outbreakAllowance, play, hindsightBest };
})();
