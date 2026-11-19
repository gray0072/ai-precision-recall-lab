'use strict';

// Tests of the belt (Stream.update: arrivals, the gate, the pile window; spec 01 §1, 02 §3.4) and of the
// sandbox (sim/sandbox.js, 01 §7): knobs, the curves at d' = 0 and d' = 4, calibration keeps the line at
// the same items, Generate 1 000, Clear, Step, determinism of the endless source.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

function fresh(knobs, seed = 7) {
  const g = load();
  g.Sandbox.start(Object.assign(g.Sandbox.defaults(), knobs || {}), seed);
  return g;
}

test('items arrive, ride travelS seconds, and are decided at the gate with the threshold of that moment', () => {
  const g = fresh();
  const { State, Stream, Metrics, GameEvents } = g;
  const decided = [];
  GameEvents.on('itemDecided', (e) => decided.push(e));
  State.threshold = 0.5;
  for (let i = 0; i < 600; i++) Stream.update(0.05);   // 30 s
  const run = State.run;
  assert.ok(decided.length > 30, `decided ${decided.length}`);
  // every decided item rode exactly travelS: its arrival + travelS is not after the clock
  for (const e of decided) {
    assert.ok(e.item.enter + run.travelS <= run.clock + 1e-9);
    assert.equal(e.outcome, Stream.decide(e.item, 0.5, 's').outcome);
  }
  // nothing on the belt has ridden its whole way; the belt is first in, first out
  for (const it of State.belt) assert.ok(run.clock - it.enter < run.travelS);
  for (let i = 1; i < State.belt.length; i++) assert.ok(State.belt[i].enter >= State.belt[i - 1].enter);
  // the totals are the decisions made
  const tally = Metrics.tally(decided.map((e) => e.outcome));
  assert.deepEqual({ ...run.totals }, { ...tally });
  assert.equal(run.count, decided.length);
  // about SANDBOX_RATE · travelS items ride at once
  assert.ok(State.belt.length > 4 && State.belt.length < 25, `on the belt ${State.belt.length}`);
});

test('the decision uses the threshold at the gate, not at arrival', () => {
  const g = fresh();
  const { State, Stream } = g;
  State.threshold = 1;             // nothing flagged while the items ride
  Stream.update(3);
  State.threshold = 0;             // everything flagged when they reach the gate
  Stream.update(20);
  assert.ok(State.pile.length > 0);
  assert.ok(State.pile.every((it) => it.flagged));
});

test('the pile keeps the last PILE_WINDOW items; frame size does not change the stream', () => {
  const a = fresh(), b = fresh();
  for (let i = 0; i < 2000; i++) a.Stream.update(0.25);           // 500 s in big steps
  for (let i = 0; i < 30000; i++) b.Stream.update(1 / 60);        // 500 s in frames
  assert.equal(a.State.pile.length, a.PILE_WINDOW);
  const last = (g) => g.State.pile.slice(-50).map((it) => it.s + ':' + it.y).join(',');
  assert.equal(last(a), last(b));
});

test("at d' = 0 ROC is the diagonal and PR sits at the base rate; at d' = 4 both hug the corner", () => {
  const g = fresh({ dPrime: 0, prevalence: 0.2 });
  const { State, Sandbox, Metrics } = g;
  let c = State.run.curves;
  assert.ok(Math.abs(c.auc - 0.5) < 0.03, `AUC at d'=0: ${c.auc}`);
  assert.ok(Math.abs(c.ap - c.prevalence) < 0.03, `AP at d'=0: ${c.ap} vs ${c.prevalence}`);
  for (const p of c.pr) if (p.recall > 0.2) assert.ok(Math.abs(p.precision - c.prevalence) < 0.08, `precision ${p.precision}`);
  Sandbox.set('dPrime', 4);
  c = State.run.curves;
  assert.ok(c.auc > 0.99, `AUC at d'=4: ${c.auc}`);
  assert.ok(c.ap > 0.95, `AP at d'=4: ${c.ap}`);
  const op = Metrics.operatingPoint(c, 0.5);
  assert.ok(op.tpr > 0.9 && op.fpr < 0.1 && op.precision > 0.8, JSON.stringify(op));
});

test('the operating point is the validation matrix at the threshold', () => {
  const g = fresh({ scenario: 'spam' });
  const { State, Metrics } = g;
  const run = State.run;
  for (const t of [0.1, 0.42, 0.77]) {
    const op = Metrics.operatingPoint(run.curves, t);
    const m = Metrics.compute(Metrics.counts(run.val, t, 's'));
    assert.equal(op.tpr, m.recall);
    assert.equal(op.fpr, m.fpr);
    assert.equal(op.precision, m.precision);
  }
});

test('a scenario resets base rate and separation; knobs are sanitized', () => {
  const g = fresh();
  const { Sandbox, SCENARIOS, State } = g;
  let k = Sandbox.set('scenario', 'fever');
  assert.equal(k.prevalence, SCENARIOS.fever.prevalence);
  assert.equal(k.dPrime, SCENARIOS.fever.dPrime);
  assert.equal(State.run.model.gamma, SCENARIOS.fever.gamma);
  k = Sandbox.set('prevalence', 0.0412345);
  assert.equal(k.prevalence, 0.041);
  k = Sandbox.sanitize({ scenario: 'nope', prevalence: 7, dPrime: -3, speed: 3, prices: { TP: 99, FP: 'x' }, threshold: 0.123 });
  assert.equal(k.scenario, 'abstract');
  assert.equal(k.prevalence, g.SANDBOX_PREVALENCE_MAX);
  assert.equal(k.dPrime, 0);
  assert.equal(k.speed, 1);
  assert.equal(k.prices.TP, g.SANDBOX_PRICE_MAX);
  assert.equal(k.prices.FP, g.SANDBOX_PRICES.FP);
  assert.equal(k.threshold, 0.12);
  assert.equal(JSON.stringify(Sandbox.sanitize(null)), JSON.stringify(Sandbox.defaults()));
});

test('switching calibration moves the number, not the line: the pile keeps (nearly) the same matrix', () => {
  const g = fresh({ scenario: 'spam' });
  const { State, Sandbox, Metrics } = g;
  Sandbox.generate();
  State.threshold = 0.8;
  const before = Metrics.counts(State.pile, State.threshold, 's');
  Sandbox.set('calibrated', true);
  assert.equal(State.run.key, 'p');
  assert.notEqual(State.threshold, 0.8);
  const after = Metrics.counts(State.pile, State.threshold, 'p');
  // rounding p can merge neighbouring raw scores: at most a handful of items change side
  assert.ok(Math.abs(after.TP + after.FP - before.TP - before.FP) <= 20, JSON.stringify([before, after]));
  Sandbox.set('calibrated', false);
  assert.equal(State.run.key, 's');
  const back = Metrics.counts(State.pile, State.threshold, 's');
  assert.ok(Math.abs(back.TP + back.FP - before.TP - before.FP) <= 20, JSON.stringify([before, back]));
});

test('Generate 1 000 fills the pile and widens the window; Clear empties everything; Step decides one item', () => {
  const g = fresh();
  const { State, Sandbox, Stream, Metrics } = g;
  Stream.update(10);
  Sandbox.generate();
  assert.equal(State.run.window, g.SANDBOX_GENERATE);
  assert.ok(State.pile.length >= g.SANDBOX_GENERATE);
  assert.equal(State.pile.length, Math.min(State.run.count, g.SANDBOX_GENERATE));
  const c = Metrics.counts(State.pile, State.threshold, 's');
  assert.equal(c.TP + c.FP + c.FN + c.TN, State.pile.length);
  Sandbox.clear();
  assert.equal(State.pile.length, 0);
  assert.equal(State.belt.length, 0);
  assert.equal(State.run.count, 0);
  assert.equal(State.run.window, g.PILE_WINDOW);
  assert.ok(State.run.next.at > State.run.clock);
  Sandbox.step();
  assert.equal(State.run.count, 1);
  Sandbox.step();
  assert.equal(State.run.count, 2);
});

test('the profit curve, its best threshold and p* follow the prices', () => {
  const g = fresh({ scenario: 'spam', calibrated: true });
  const { State, Sandbox } = g;
  let run = State.run;
  // +1 / −1 / −1 / 0: a catch gains 2 over a miss, a false alarm loses 1 against a pass → flag when p ≥ 1/3
  assert.ok(Math.abs(run.pStar - 1 / 3) < 1e-12);
  Sandbox.set('prices', { TP: 1, FP: -9, FN: -1, TN: 0 });
  run = State.run;
  assert.ok(Math.abs(run.pStar - 9 / 11) < 1e-12);
  // on calibrated p the best threshold sits near p* (sampling noise and the 0.01 grid aside)
  assert.ok(Math.abs(run.bestT - run.pStar) < 0.12, `best ${run.bestT} p* ${run.pStar}`);
});
