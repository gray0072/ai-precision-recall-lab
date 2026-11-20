'use strict';

// ============================================================
// AI Precision Recall Lab — the metrics (spec 02 §3, §4). Counts of the confusion matrix, every metric of
// 02 §3.2 with its empty-denominator rule (null = "not defined yet", shown as "—"), the rolling window
// re-evaluated at the current threshold, and the curves over the 101 thresholds 0.00 … 1.00: ROC with its
// AUC, PR with average precision, the profit curve, the reliability diagram, and the PSI of the drift monitor.
// Items are { y, s, p?, … }; `key` says which value the threshold is compared with ('s' raw, 'p' calibrated).
// Scores sit on the 0.01 grid, so one pass into a 101-bin histogram gives every threshold at once.
// The curves and AUC / AP are computed on the raw score even when calibrated (ADR-0004): the operating point
// of "p ≥ t" is the curve's point at Model.rawThreshold(t, platt).
// No drawing, no DOM, no sound. Used by sim/contract.js, the live panel, the charts, the results, the tests.
// ============================================================

const Metrics = (() => {
  const GRID = 101;   // thresholds 0.00, 0.01, …, 1.00

  function emptyCounts() { return { TP: 0, FP: 0, FN: 0, TN: 0 }; }

  // counts of items re-evaluated at threshold t (flagged = value ≥ t)
  function counts(items, t, key = 's') {
    const c = emptyCounts();
    for (const it of items) {
      if (atOrAbove(it[key], t)) { if (it.y) c.TP++; else c.FP++; }
      else if (it.y) c.FN++; else c.TN++;
    }
    return c;
  }

  // counts of decisions already made: a list of outcomes ('TP', …) or of objects with an .outcome
  function tally(list) {
    const c = emptyCounts();
    for (const o of list) c[typeof o === 'string' ? o : o.outcome]++;
    return c;
  }

  // the rolling window (02 §3.4): the last n items, re-evaluated at the current threshold
  function window(items, t, key = 's', n = PILE_WINDOW) {
    return counts(items.length > n ? items.slice(items.length - n) : items, t, key);
  }

  // P (real positives), N (real negatives), PP (flagged), PN (passed), total
  function sums(c) {
    return { P: c.TP + c.FN, N: c.FP + c.TN, PP: c.TP + c.FP, PN: c.FN + c.TN, total: c.TP + c.FP + c.FN + c.TN };
  }

  function ratio(a, b) { return b > 0 ? a / b : null; }

  // Every metric of 02 §3.2. An empty denominator gives null. F1 and F-beta are null only when TP + FP + FN = 0
  // (nothing flagged and nothing missed), otherwise 0 when TP = 0. MCC is null when any factor under the root is 0.
  function compute(c, beta = 1) {
    const { P, N, PP, PN, total } = sums(c);
    const recall = ratio(c.TP, P), specificity = ratio(c.TN, N);
    const b2 = beta * beta;
    const mccDen = PP * P * N * PN;
    return {
      precision: ratio(c.TP, PP),
      recall,
      specificity,
      fpr: ratio(c.FP, N),
      fnr: ratio(c.FN, P),
      npv: ratio(c.TN, PN),
      accuracy: ratio(c.TP + c.TN, total),
      balancedAccuracy: recall === null || specificity === null ? null : (recall + specificity) / 2,
      f1: ratio(2 * c.TP, 2 * c.TP + c.FP + c.FN),
      fbeta: ratio((1 + b2) * c.TP, (1 + b2) * c.TP + b2 * c.FN + c.FP),
      mcc: mccDen > 0 ? (c.TP * c.TN - c.FP * c.FN) / Math.sqrt(mccDen) : null,
      prevalence: ratio(P, total),
      flagRate: ratio(PP, total)
    };
  }

  // the value of one metric by its id (goals name metrics this way: { metric: 'precision', min: 0.9 })
  function value(c, id, beta = 1) { return compute(c, beta)[id]; }

  // The counts at every threshold 0.00 … 1.00 in one pass: a histogram of the values in hundredths, summed
  // from the top. sweep[k] is the matrix at t = k / 100.
  function sweep(items, key = 's') {
    const pos = new Array(GRID).fill(0), neg = new Array(GRID).fill(0);
    for (const it of items) {
      const h = clamp(hundredths(it[key]), 0, GRID - 1);
      if (it.y) pos[h]++; else neg[h]++;
    }
    let P = 0, N = 0;
    for (let k = 0; k < GRID; k++) { P += pos[k]; N += neg[k]; }
    const out = new Array(GRID);
    let tp = 0, fp = 0;
    for (let k = GRID - 1; k >= 0; k--) {
      tp += pos[k]; fp += neg[k];
      out[k] = { t: k / 100, TP: tp, FP: fp, FN: P - tp, TN: N - fp };
    }
    // t = 1.00 flags only values ≥ 1.00; scores never get there, so the top row is "nothing flagged"
    return out;
  }

  // ROC: (FPR, TPR) at every threshold, from t = 0 (1, 1) to t = 1 (0, 0). null without both classes.
  function roc(items, key = 's') {
    const sw = sweep(items, key);
    const s0 = sums(sw[0]);
    if (s0.P === 0 || s0.N === 0) return null;
    return sw.map((c) => ({ t: c.t, fpr: c.FP / s0.N, tpr: c.TP / s0.P }));
  }

  // ROC AUC by the trapezoid rule over the ROC points. Items with the same score share a grid step, which the
  // trapezoid crosses diagonally, so this is exactly the Mann–Whitney statistic with ties counted half.
  function rocAuc(points) {
    if (!points) return null;
    let a = 0;
    for (let k = 0; k + 1 < points.length; k++) {
      a += (points[k].fpr - points[k + 1].fpr) * (points[k].tpr + points[k + 1].tpr) / 2;
    }
    return a;
  }
  function auc(items, key = 's') { return rocAuc(roc(items, key)); }

  // PR: (recall, precision) at every threshold with at least one flagged item. null without positives.
  // The baseline of a random model is the prevalence.
  function pr(items, key = 's') {
    const sw = sweep(items, key);
    const P = sums(sw[0]).P;
    if (P === 0) return null;
    const pts = [];
    for (const c of sw) if (c.TP + c.FP > 0) pts.push({ t: c.t, recall: c.TP / P, precision: c.TP / (c.TP + c.FP) });
    return pts;
  }

  // Average precision, the scikit-learn definition: AP = Σ (Rₙ − Rₙ₋₁)·Pₙ over thresholds from high to low,
  // starting from R₀ = 0, with no interpolation. A threshold where recall does not move adds nothing, so the
  // grid thresholds give the same sum as sklearn's distinct scores. null without positives.
  function averagePrecision(items, key = 's') {
    const sw = sweep(items, key);
    const P = sums(sw[0]).P;
    if (P === 0) return null;
    let ap = 0, prevR = 0;
    for (let k = GRID - 1; k >= 0; k--) {
      const c = sw[k];
      const R = c.TP / P;
      if (R > prevR) { ap += (R - prevR) * c.TP / (c.TP + c.FP); prevR = R; }
    }
    return ap;
  }

  // The profit curve: money at every threshold if it had been held fixed for all the items. moneyFn(item,
  // outcome) gives an item's $, so amounts and any price list work. An item with value h (in hundredths) is
  // flagged for every k ≤ h: a difference array makes it one pass. per100 = money per 100 items.
  function profitCurve(items, moneyFn, key = 's') {
    const delta = new Array(GRID + 1).fill(0);
    let base = 0;   // nothing flagged
    for (const it of items) {
      const pass = moneyFn(it, it.y ? 'FN' : 'TN'), flag = moneyFn(it, it.y ? 'TP' : 'FP');
      base += pass;
      delta[clamp(hundredths(it[key]), 0, GRID - 1)] += flag - pass;
    }
    const out = new Array(GRID);
    let run = base;
    for (let k = GRID - 1; k >= 0; k--) {
      run += delta[k];
      out[k] = { t: k / 100, money: run, per100: items.length ? run * 100 / items.length : 0 };
    }
    return out;
  }

  // The reliability diagram (02 §2.3): equal-width bins of the predicted value; per bin its count, the mean
  // prediction and the observed share of positives (null for an empty bin). A calibrated model sits on the diagonal.
  function reliability(items, key = 'p', bins = RELIABILITY_BINS) {
    const out = [];
    for (let b = 0; b < bins; b++) out.push({ lo: b / bins, hi: (b + 1) / bins, count: 0, sumPred: 0, pos: 0 });
    for (const it of items) {
      const b = Math.min(bins - 1, Math.floor(hundredths(it[key]) * bins / 100));
      out[b].count++; out[b].sumPred += it[key]; out[b].pos += it.y ? 1 : 0;
    }
    return out.map((r) => ({
      lo: r.lo, hi: r.hi, count: r.count,
      meanPredicted: r.count ? r.sumPred / r.count : null,
      observed: r.count ? r.pos / r.count : null
    }));
  }

  // The model's curves for the live panel (02 §4), on the validation set and the raw score (ADR-0004):
  // the sweep (the matrix at every raw threshold, for the operating point), ROC with its AUC, PR with AP and
  // the validation set's prevalence (the PR chart's "random" line). null parts when a class is missing.
  function modelCurves(val) {
    const sw = sweep(val, 's');
    const rocPts = roc(val, 's');
    return {
      sweep: sw, roc: rocPts, auc: rocAuc(rocPts), pr: pr(val, 's'), ap: averagePrecision(val, 's'),
      prevalence: val.length ? sums(sw[0]).P / val.length : null
    };
  }

  // The operating point at a raw threshold: the model curve's point there (the filled dot on ROC and PR).
  // precision is null when nothing is flagged; fpr / tpr are null without negatives / positives.
  function operatingPoint(curves, rawT) {
    const c = curves.sweep[clamp(hundredths(rawT), 0, GRID - 1)];
    const m = compute(c);
    return { t: rawT, fpr: m.fpr, tpr: m.recall, recall: m.recall, precision: m.precision };
  }

  // ---------- PSI, the population stability index (02 §6.2, ADR-0005) ----------
  // The reference: PSI_BINS bins cut at the quantiles of the validation set's raw scores, with the share eᵢ of
  // the validation set in each. Scores sit on the 0.01 grid, so a cut can fall on a tie: bin i holds the scores
  // ≥ cut[i − 1] and < cut[i], and its share is the real share (not exactly 1 / bins); two equal cuts make an
  // empty bin, which adds nothing (both shares are floored to the same 1e−4).
  function psiReference(scores, bins = PSI_BINS) {
    const sorted = Array.from(scores).sort((a, b) => a - b);
    const cuts = [];
    for (let k = 1; k < bins; k++) cuts.push(sorted[Math.floor(k * sorted.length / bins)]);
    const ref = { cuts, bins, e: new Array(bins).fill(0) };
    for (const s of scores) ref.e[psiBin(ref, s)]++;
    for (let i = 0; i < bins; i++) ref.e[i] /= Math.max(1, scores.length);
    return ref;
  }
  function psiBin(ref, s) {
    let b = 0;
    while (b < ref.bins - 1 && hundredths(s) >= hundredths(ref.cuts[b])) b++;
    return b;
  }
  // PSI = Σ (aᵢ − eᵢ) · ln(aᵢ / eᵢ), aᵢ the share of the given scores in bin i; both shares floored at 1e−4.
  // Every term is ≥ 0 (a − e and ln(a / e) have the same sign). < 0.1 stable, 0.1–0.2 moderate, > 0.2 shifted.
  // null without scores.
  function psi(ref, scores) {
    if (!scores.length) return null;
    const a = new Array(ref.bins).fill(0);
    for (const s of scores) a[psiBin(ref, s)]++;
    let sum = 0;
    for (let i = 0; i < ref.bins; i++) {
      const ai = Math.max(1e-4, a[i] / scores.length), ei = Math.max(1e-4, ref.e[i]);
      sum += (ai - ei) * Math.log(ai / ei);
    }
    return sum;
  }

  return {
    emptyCounts, counts, tally, window, sums, compute, value, sweep, roc, rocAuc, auc, pr, averagePrecision,
    profitCurve, reliability, modelCurves, operatingPoint, psiReference, psiBin, psi
  };
})();
