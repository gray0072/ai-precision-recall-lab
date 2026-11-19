'use strict';

// Tests of sim/metrics.js (spec 02 §3, §4): every metric on hand-computed matrices, the empty-denominator
// rules, the rolling window, ROC (monotone, AUC = Mann–Whitney with ties), PR and average precision against
// scikit-learn, the profit curve.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

const { Metrics, Model, Stream, SCENARIOS } = load();
const near = (a, b, tol, msg) => assert.ok(a !== null && Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

test('every metric of 02 §3.2 on a hand-computed matrix', () => {
  // 42 spam flagged rightly, 7 invoices flagged wrongly, 8 spam missed, 143 invoices passed (200 letters)
  const m = Metrics.compute({ TP: 42, FP: 7, FN: 8, TN: 143 }, 2);
  const e = 1e-12;
  near(m.precision, 42 / 49, e, 'precision');
  near(m.recall, 42 / 50, e, 'recall');
  near(m.specificity, 143 / 150, e, 'specificity');
  near(m.fpr, 7 / 150, e, 'fpr');
  near(m.fnr, 8 / 50, e, 'fnr');
  near(m.npv, 143 / 151, e, 'npv');
  near(m.accuracy, 185 / 200, e, 'accuracy');
  near(m.balancedAccuracy, (42 / 50 + 143 / 150) / 2, e, 'balanced accuracy');
  near(m.f1, 84 / 99, e, 'f1');
  near(m.f1, 2 * (42 / 49) * (42 / 50) / (42 / 49 + 42 / 50), e, 'f1 as the harmonic mean');
  near(m.fbeta, 210 / 249, e, 'f2');
  near(m.mcc, (42 * 143 - 7 * 8) / Math.sqrt(49 * 50 * 150 * 151), e, 'mcc');
  near(m.prevalence, 0.25, e, 'prevalence');
  near(m.flagRate, 49 / 200, e, 'flag rate');
  near(Metrics.compute({ TP: 42, FP: 7, FN: 8, TN: 143 }, 0.5).fbeta, 1.25 * 42 / (1.25 * 42 + 0.25 * 8 + 7), e, 'f0.5');
});

test('the cheat sheet examples', () => {
  near(Metrics.compute({ TP: 1, FP: 0, FN: 9, TN: 90 }).f1, 0.18, 0.005, 'P 1.0, R 0.1 → F1 0.18');
  near(Metrics.compute({ TP: 13, FP: 25, FN: 2, TN: 260 }).recall, 0.87, 0.005, 'fever recall');
  near(Metrics.compute({ TP: 13, FP: 25, FN: 2, TN: 260 }).fpr, 0.09, 0.005, 'fever fpr');
});

test('empty denominators give null; F1 is 0 rather than null once something was missed', () => {
  const all = Metrics.compute({ TP: 0, FP: 0, FN: 0, TN: 0 });
  for (const [k, v] of Object.entries(all)) assert.equal(v, null, k);

  const noFlags = Metrics.compute({ TP: 0, FP: 0, FN: 5, TN: 10 });
  assert.equal(noFlags.precision, null);
  assert.equal(noFlags.recall, 0);
  assert.equal(noFlags.f1, 0);
  assert.equal(noFlags.fbeta, 0);
  assert.equal(noFlags.mcc, null);
  assert.equal(noFlags.flagRate, 0);

  const noPositives = Metrics.compute({ TP: 0, FP: 0, FN: 0, TN: 10 });
  assert.equal(noPositives.recall, null);
  assert.equal(noPositives.f1, null);
  assert.equal(noPositives.balancedAccuracy, null);
  assert.equal(noPositives.specificity, 1);
  assert.equal(noPositives.accuracy, 1);

  const wrongOnly = Metrics.compute({ TP: 0, FP: 3, FN: 2, TN: 10 });
  assert.equal(wrongOnly.precision, 0);
  assert.equal(wrongOnly.f1, 0);
});

test('the accuracy paradox (C06): flag nothing at 2 % fraud', () => {
  const m = Metrics.compute({ TP: 0, FP: 0, FN: 6, TN: 294 });
  near(m.accuracy, 0.98, 1e-12);
  assert.equal(m.recall, 0);
  assert.equal(m.mcc, null);
  near(m.balancedAccuracy, 0.5, 1e-12);
});

test('counts, tally and the rolling window at the current threshold', () => {
  const items = [{ y: 1, s: 0.9 }, { y: 0, s: 0.8 }, { y: 1, s: 0.3 }, { y: 0, s: 0.2 }, { y: 1, s: 0.7 }];
  assert.deepEqual({ ...Metrics.counts(items, 0.5) }, { TP: 2, FP: 1, FN: 1, TN: 1 });
  assert.deepEqual({ ...Metrics.counts(items, 0.8) }, { TP: 1, FP: 1, FN: 2, TN: 1 });
  assert.deepEqual({ ...Metrics.tally(['TP', 'TP', 'FN', { outcome: 'TN' }]) }, { TP: 2, FP: 0, FN: 1, TN: 1 });
  // the window keeps the last n items and re-decides them at today's threshold
  assert.deepEqual({ ...Metrics.window(items, 0.75, 's', 3) }, { TP: 0, FP: 0, FN: 2, TN: 1 });
  assert.deepEqual({ ...Metrics.window(items, 0.25, 's', 3) }, { TP: 2, FP: 0, FN: 0, TN: 1 });
});

test('the sweep agrees with counting at every threshold', () => {
  const v = Stream.validation(3, Model.of(SCENARIOS.moderation), 1500);
  const sw = Metrics.sweep(v);
  assert.equal(sw.length, 101);
  for (let k = 0; k <= 100; k++) assert.deepEqual({ ...sw[k], t: 0 }, { ...Metrics.counts(v, k / 100), t: 0 }, `t ${k / 100}`);
  assert.equal(sw[0].FN + sw[0].TN, 0);       // t = 0 flags everything
  assert.equal(sw[100].TP + sw[100].FP, 0);   // t = 1 flags nothing
});

test('ROC runs from (1, 1) to (0, 0), is monotone; recall never rises with the threshold', () => {
  const v = Stream.validation(4, Model.of(SCENARIOS.spam), 2000);
  const roc = Metrics.roc(v);
  assert.deepEqual({ fpr: roc[0].fpr, tpr: roc[0].tpr }, { fpr: 1, tpr: 1 });
  assert.deepEqual({ fpr: roc[100].fpr, tpr: roc[100].tpr }, { fpr: 0, tpr: 0 });
  for (let k = 1; k <= 100; k++) {
    assert.ok(roc[k].fpr <= roc[k - 1].fpr && roc[k].tpr <= roc[k - 1].tpr, `t ${k / 100}`);
  }
  assert.equal(Metrics.roc([{ y: 1, s: 0.4 }]), null);   // one class: no curve
});

// the probability that a random positive scores higher than a random negative, ties counted half
function mannWhitney(items) {
  const pos = items.filter((i) => i.y), neg = items.filter((i) => !i.y);
  let w = 0;
  for (const p of pos) for (const n of neg) w += p.s > n.s ? 1 : p.s === n.s ? 0.5 : 0;
  return w / (pos.length * neg.length);
}

test('ROC AUC by the trapezoid equals the Mann–Whitney statistic, ties included', () => {
  for (const [id, seed] of [['spam', 1], ['fever', 2], ['fraud', 3], ['abstract', 4]]) {
    const v = Stream.validation(seed, Model.of(SCENARIOS[id]), 1200);
    near(Metrics.auc(v), mannWhitney(v), 1e-12, id);
  }
  const ties = [{ y: 1, s: 0.5 }, { y: 0, s: 0.5 }, { y: 1, s: 0.7 }, { y: 0, s: 0.2 }];
  near(Metrics.auc(ties), 0.875, 1e-12, 'small tie example');
  near(Metrics.auc([{ y: 1, s: 0.5 }, { y: 0, s: 0.5 }]), 0.5, 1e-12, 'all tied: a coin');
});

test('average precision matches scikit-learn', () => {
  // sklearn.metrics.average_precision_score([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]) == 0.8333…
  const items = [{ y: 0, s: 0.1 }, { y: 0, s: 0.4 }, { y: 1, s: 0.35 }, { y: 1, s: 0.8 }];
  near(Metrics.averagePrecision(items), 5 / 6, 1e-12, 'docstring example');
  // average_precision_score([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5]) == 0.5 (one threshold, every item tied)
  near(Metrics.averagePrecision([{ y: 1, s: 0.5 }, { y: 0, s: 0.5 }, { y: 1, s: 0.5 }, { y: 0, s: 0.5 }]), 0.5, 1e-12, 'ties');
  // average_precision_score([1, 0, 1, 1, 0, 0], [0.9, 0.8, 0.7, 0.6, 0.55, 0.3]) == (1 + 2/3 + 3/4) / 3
  const ex = [[1, 0.9], [0, 0.8], [1, 0.7], [1, 0.6], [0, 0.55], [0, 0.3]].map(([y, s]) => ({ y, s }));
  near(Metrics.averagePrecision(ex), (1 + 2 / 3 + 3 / 4) / 3, 1e-12, 'ranked list');
  assert.equal(Metrics.averagePrecision([{ y: 0, s: 0.4 }]), null);
});

test('PR points have something flagged; on a rare class AP is far below ROC AUC', () => {
  const v = Stream.validation(6, Model.of(SCENARIOS.fraud));
  const pr = Metrics.pr(v);
  for (const p of pr) assert.ok(p.precision >= 0 && p.precision <= 1 && p.recall >= 0 && p.recall <= 1);
  assert.equal(pr[0].recall, 1);
  const ap = Metrics.averagePrecision(v), auc = Metrics.auc(v);
  assert.ok(ap < auc - 0.25, `AP ${ap} vs AUC ${auc}`);
  assert.ok(ap > 0.03 * 3, 'still far above the random baseline (the prevalence)');
});

test('the profit curve is the money of a fixed threshold at every t', () => {
  const v = Stream.validation(8, Model.of(SCENARIOS.spam), 600);
  const prices = { TP: 2, FP: -10, FN: -1, TN: 0 };
  const curve = Metrics.profitCurve(v, (it, o) => prices[o]);
  for (const k of [0, 13, 50, 77, 100]) {
    const c = Metrics.counts(v, k / 100);
    near(curve[k].money, 2 * c.TP - 10 * c.FP - c.FN, 1e-9, `t ${k / 100}`);
    near(curve[k].per100, curve[k].money * 100 / v.length, 1e-9);
  }
});
