'use strict';

// Tests of sim/contract.js (spec 01 §3.3, §4; 02 §5; 03 §2): prices and fraud money, the cost-optimal
// threshold p*, goals with the difficulty's shift, the outbreak and bankruptcy, the hindsight-best search on
// a crafted stream, and C02's terms played at t = 0.5 against the hindsight-best (the I02 acceptance check).

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

const { Contract, Metrics, Model, Stream, SCENARIOS } = load();
const near = (a, b, tol, msg) => assert.ok(a !== null && Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

test('p* for the contracts’ prices (02 §5.1)', () => {
  near(Contract.pStar({ TP: 2, FP: -10, FN: -1, TN: 0 }), 10 / 13, 1e-12, 'C02 0.77');
  near(Contract.pStar({ TP: 5, FP: -1, FN: -30, TN: 0 }), 1 / 36, 1e-12, 'C03');
  near(Contract.pStar({ TP: 3, FP: -3, FN: -3, TN: 0 }), 1 / 3, 1e-12, 'C04');
  near(Contract.pStar({ TP: 2, FP: -4, FN: -1, TN: 0 }), 4 / 7, 1e-12, 'C01');
  // fraud: p* = (0.02·a + 5) / (1.02·a + 5): 0.34 for $10, 0.09 for $60, 0.02 for $1 000
  near(Contract.pStar(Contract.values('fraud', { amount: 10 })), 0.34, 0.005, '$10');
  near(Contract.pStar(Contract.values('fraud', { amount: 60 })), 0.09, 0.005, '$60');
  near(Contract.pStar(Contract.values('fraud', { amount: 1000 })), 0.02, 0.005, '$1 000');
  near(Contract.ghostPStar('fraud'), 6.2 / 66.2, 1e-12, 'the ghost line uses the median $60');
  assert.equal(Contract.pStar({ TP: 0, FP: 0, FN: 0, TN: 0 }), null);
});

test('fraud money depends on the amount; sums are in whole cents', () => {
  const it = { amount: 60 };
  assert.equal(Contract.money(it, 'TP', 'fraud'), 0);
  assert.equal(Contract.money(it, 'FP', 'fraud'), -5);
  assert.equal(Contract.money(it, 'FN', 'fraud'), -60);
  assert.equal(Contract.money(it, 'TN', 'fraud'), 1.2);
  assert.equal(Contract.money({ amount: 33 }, 'TN', 'fraud'), 0.66);
  assert.equal(Contract.money({}, 'FP', { TP: 2, FP: -10, FN: -1, TN: 0 }), -10);
});

test('goals: the difficulty shifts the target; an undefined value is not met', () => {
  const goal = { metric: 'precision', min: 0.9 };
  near(Contract.goalTarget(goal, 'easy'), 0.85, 1e-12);
  near(Contract.goalTarget(goal, 'medium'), 0.9, 1e-12);
  near(Contract.goalTarget(goal, 'hard'), 0.92, 1e-12);
  const c = { TP: 87, FP: 13, FN: 30, TN: 100 };   // precision 0.87
  assert.equal(Contract.goalMet(c, goal, 'easy'), true);
  assert.equal(Contract.goalMet(c, goal, 'medium'), false);
  assert.equal(Contract.goalMet({ TP: 9, FP: 1, FN: 0, TN: 0 }, goal, 'medium'), true);   // exactly 0.90
  assert.equal(Contract.goalMet({ TP: 0, FP: 0, FN: 4, TN: 50 }, goal, 'easy'), false);   // nothing flagged
  assert.equal(Contract.goalMet(c, null, 'hard'), true);
  near(Contract.goalValue({ TP: 2, FP: 0, FN: 2, TN: 5 }, { metric: 'fbeta', beta: 2, min: 0.5 }), 10 / 18, 1e-12, 'F2');
});

test('the outbreak allowance by difficulty, and a contract that fails on it', () => {
  const terms = { prices: { TP: 5, FP: -1, FN: -30, TN: 0 }, goal: null, outbreak: 4, fee: 1000 };
  assert.equal(Contract.outbreakAllowance(terms, 'easy'), 6);
  assert.equal(Contract.outbreakAllowance(terms, 'medium'), 4);
  assert.equal(Contract.outbreakAllowance(terms, 'hard'), 3);
  assert.equal(Contract.outbreakAllowance({ outbreak: 1 }, 'hard'), 1);
  assert.equal(Contract.outbreakAllowance({ outbreak: null }, 'hard'), null);
  // five positives, all below t = 0.5: the 4th FN starts the outbreak
  const items = [0.1, 0.2, 0.3, 0.4, 0.45].map((s, i) => ({ i, y: 1, s }));
  const r = Contract.play(items, terms, 0.5, 'medium');
  assert.equal(r.failed, 'outbreak');
  assert.equal(r.decided, 4);
  assert.equal(r.completed, false);
  assert.equal(Contract.play(items, terms, 0.5, 'easy').failed, null);
});

test('bankruptcy: the money falls below −fee', () => {
  const terms = { prices: { TP: 2, FP: -10, FN: -1, TN: 0 }, goal: null, fee: 25 };
  const items = Array.from({ length: 5 }, (_, i) => ({ i, y: 0, s: 0.9 }));
  const r = Contract.play(items, terms, 0.5, 'medium');
  assert.equal(r.failed, 'bankrupt');
  assert.equal(r.decided, 3);         // −10, −20, −30 < −25
  assert.equal(r.money, -30);
});

test('a threshold that moves: play takes a function of the item index', () => {
  const terms = { prices: { TP: 1, FP: -1, FN: -1, TN: 1 }, goal: null };
  const items = [0.6, 0.6, 0.6, 0.6].map((s, i) => ({ i, y: 0, s }));
  const r = Contract.play(items, terms, (i) => (i < 2 ? 0.5 : 0.7), 'medium');
  assert.deepEqual({ ...r.counts }, { TP: 0, FP: 2, FN: 0, TN: 2 });
});

// A crafted stream: positives at 0.90, 0.80, 0.70, 0.40; negatives at 0.85, 0.60, 0.30, 0.20, 0.10.
// With +2 / −10 / −1 / 0 the money at a fixed threshold is: t > 0.90: −4; 0.86–0.90: −1 (best); 0.81–0.85: −11;
// 0.71–0.80: −8; 0.61–0.70: −5; lower: worse.
const crafted = [[1, 0.9], [0, 0.85], [1, 0.8], [1, 0.7], [0, 0.6], [1, 0.4], [0, 0.3], [0, 0.2], [0, 0.1]]
  .map(([y, s], i) => ({ i, y, s }));
const prices = { TP: 2, FP: -10, FN: -1, TN: 0 };

test('hindsight-best: the known optimum, the middle of its tied run', () => {
  const hb = Contract.hindsightBest(crafted, { prices, goal: null, fee: 100 }, 'medium');
  assert.equal(hb.feasible, true);
  assert.equal(hb.t, 0.88);           // 0.86 … 0.90 tie at −1
  assert.equal(hb.money, -1);
  assert.equal(hb.runs.length, 101);
  assert.equal(hb.runs[95].money, -4);
  assert.equal(hb.runs[65].money, -5);
});

test('hindsight-best respects the goal', () => {
  const hb = Contract.hindsightBest(crafted, { prices, goal: { metric: 'recall', min: 0.75 }, fee: 100 }, 'medium');
  assert.equal(hb.t, 0.65);           // recall 3/4 needs t ≤ 0.70; 0.61 … 0.70 tie at −5
  assert.equal(hb.money, -5);
  assert.equal(hb.result.goalMet, true);
});

test('hindsight-best respects the outbreak allowance, which depends on the difficulty', () => {
  const terms = { prices, goal: null, outbreak: 3, fee: 100 };
  assert.equal(Contract.hindsightBest(crafted, terms, 'medium').t, 0.65);   // t ≥ 0.81 leaves 3 FN: outbreak
  assert.equal(Contract.hindsightBest(crafted, terms, 'easy').t, 0.88);     // allowance 5
  assert.equal(Contract.hindsightBest(crafted, { ...terms, outbreak: 4 }, 'medium').t, 0.88);
});

test('hindsight-best: no fixed threshold meets an impossible goal', () => {
  const hb = Contract.hindsightBest(crafted, { prices, goal: { metric: 'f1', min: 0.99 }, fee: 100 }, 'medium');
  assert.equal(hb.feasible, false);
  assert.equal(hb.t, null);
  assert.equal(hb.money, null);
});

test('hindsight-best agrees with the profit curve when nothing can fail', () => {
  const v = Stream.generate({ seed: 5, count: 400, rate: 1.5, model: Model.of(SCENARIOS.fraud, { prevalence: 0.05 }), amounts: true });
  const hb = Contract.hindsightBest(v, { prices: 'fraud', goal: null }, 'medium');
  const curve = Metrics.profitCurve(v, (it, o) => Contract.money(it, o, 'fraud'));
  const best = Math.max(...curve.map((p) => p.money));
  near(hb.money, best, 0.01);
});

// The I02 acceptance check: C02 "Never lose an invoice" (spam, π 0.25, d' 2.2, 240 items at 1.2/s,
// +2 / −10 / −1 / 0, Precision ≥ 0.90, fee $200), played at the naive t = 0.5 and at the hindsight-best.
test('C02 at t = 0.5 against the hindsight-best fixed threshold', () => {
  const terms = { prices, goal: { metric: 'precision', min: 0.9 }, outbreak: null, fee: 200 };
  const model = Model.of(SCENARIOS.spam, { prevalence: 0.25, dPrime: 2.2 });
  const lines = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const items = Stream.generate({ seed, count: 240, rate: 1.2, model });
    const naive = Contract.play(items, terms, 0.5, 'medium');
    const hb = Contract.hindsightBest(items, terms, 'medium');
    const p = (r) => Metrics.compute(r.counts).precision.toFixed(2);
    lines.push(`seed ${seed}: t 0.50 → $${naive.money} precision ${p(naive)}${naive.failed ? ' (' + naive.failed + ')' : ''}` +
      ` | best t ${hb.t.toFixed(2)} → $${hb.money} precision ${p(hb.result)}`);
    assert.equal(hb.feasible, true);
    assert.ok(hb.money > naive.money, `seed ${seed}`);
    assert.equal(hb.result.goalMet, true);
    assert.equal(hb.result.completed, true);
    assert.ok(hb.t > 0.5);
  }
  console.log('C02 (Medium):\n  ' + lines.join('\n  '));
});
