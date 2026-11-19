'use strict';

// Tests of core/rng.js and sim/stream.js (spec 02 §2.1, §2.2, §2.4): the samplers, named sub-streams,
// determinism of a contract's stream, quantized scores, amounts, the gate decision.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

const { Rng, Stream, Model, SCENARIOS } = load();
const copy = (items) => Array.from(items, (it) => ({ ...it }));

test('the samplers have the right means and spreads', () => {
  const r = Rng.create(12345);
  const n = 50000;
  let s = 0, s2 = 0, e = 0, po = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const x = r.normal(1, 2); s += x; s2 += x * x;
    e += r.exponential(4);
    po += r.poisson(3);
    b += r.bernoulli(0.3);
  }
  const mean = s / n, sd = Math.sqrt(s2 / n - mean * mean);
  assert.ok(Math.abs(mean - 1) < 0.05, `normal mean ${mean}`);
  assert.ok(Math.abs(sd - 2) < 0.05, `normal sd ${sd}`);
  assert.ok(Math.abs(e / n - 0.25) < 0.01, `exponential mean ${e / n}`);
  assert.ok(Math.abs(po / n - 3) < 0.05, `poisson mean ${po / n}`);
  assert.ok(Math.abs(b / n - 0.3) < 0.01, `bernoulli mean ${b / n}`);
  for (let i = 0; i < 1000; i++) { const k = r.int(2, 8); assert.ok(k >= 2 && k <= 8 && Number.isInteger(k)); }
});

test('named sub-streams are repeatable and independent of each other', () => {
  const a1 = Rng.stream(7, 'items'), a2 = Rng.stream(7, 'items'), v = Rng.stream(7, 'validation'), o = Rng.stream(8, 'items');
  const take = (g) => Array.from({ length: 5 }, () => g.next());
  const x = take(a1);
  assert.deepEqual(take(a2), x);
  assert.notDeepEqual(take(v), x);
  assert.notDeepEqual(take(o), x);
});

const spam = Model.of(SCENARIOS.spam);
const opts = (over = {}) => ({ seed: 42, count: 300, rate: 1.2, model: spam, ...over });

test('the same seed gives the same stream, another seed another one', () => {
  const a = copy(Stream.generate(opts())), b = copy(Stream.generate(opts()));
  assert.deepEqual(a, b);
  assert.notDeepEqual(copy(Stream.generate(opts({ seed: 43 }))), a);
  assert.deepEqual(copy(Stream.validation(42, spam)), copy(Stream.validation(42, spam)));
});

test('a base rate change reshuffles only the classes: arrivals and the score noise stay', () => {
  const a = Stream.generate(opts());
  const b = Stream.generate(opts({ schedule: (i) => (i >= 100 ? { prevalence: 0.6 } : null) }));
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].at, b[i].at);
    const noiseA = a[i].z - Model.logitMean(a[i].y, spam.dPrime), noiseB = b[i].z - Model.logitMean(b[i].y, spam.dPrime);
    assert.ok(Math.abs(noiseA - noiseB) < 1e-12);
    if (i < 100) assert.equal(a[i].y, b[i].y);
  }
  const share = (items) => items.reduce((n, it) => n + it.y, 0) / items.length;
  assert.ok(share(b.slice(100)) > share(a.slice(100)) + 0.2);
});

test('items: Poisson arrivals at the rate, classes at the base rate, quantized scores', () => {
  const items = Stream.generate(opts({ count: 20000, rate: 2 }));
  const last = items[items.length - 1].at;
  assert.ok(Math.abs(last / items.length - 0.5) < 0.01, `mean gap ${last / items.length}`);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].at > items[i - 1].at);
  const pos = items.reduce((n, it) => n + it.y, 0) / items.length;
  assert.ok(Math.abs(pos - 0.25) < 0.01, `prevalence ${pos}`);
  for (const it of items) {
    assert.ok(it.s >= 0.01 && it.s <= 0.99);
    assert.equal(Math.round(it.s * 100) / 100, it.s);
    assert.equal(it.amount, undefined);
  }
});

test('fraud amounts: whole dollars in $1–$5 000, fraud larger on average, median of genuine about $60', () => {
  const items = Stream.generate(opts({ count: 20000, model: Model.of(SCENARIOS.fraud, { prevalence: 0.3 }), amounts: true }));
  const genuine = [], fraud = [];
  for (const it of items) {
    assert.ok(Number.isInteger(it.amount) && it.amount >= 1 && it.amount <= 5000);
    (it.y ? fraud : genuine).push(it.amount);
  }
  const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  assert.ok(Math.abs(median(genuine) - 60) <= 4, `genuine median ${median(genuine)}`);
  assert.ok(median(fraud) > median(genuine) * 1.3);
});

test('the gate: score ≥ t on the 0.01 grid; t = 0 flags all, t = 1 nothing', () => {
  const it = { y: 1, s: 0.62 };
  assert.deepEqual({ ...Stream.decide(it, 0.62) }, { flagged: true, outcome: 'TP' });
  assert.deepEqual({ ...Stream.decide(it, 0.1 + 0.52) }, { flagged: true, outcome: 'TP' });   // 0.6200000000000001
  assert.equal(Stream.decide(it, 0.63).outcome, 'FN');
  assert.equal(Stream.decide({ y: 0, s: 0.62 }, 0.62).outcome, 'FP');
  assert.equal(Stream.decide({ y: 0, s: 0.62 }, 0.7).outcome, 'TN');
  for (const s of [0.01, 0.5, 0.99]) {
    assert.equal(Stream.decide({ y: 0, s }, 0).flagged, true);
    assert.equal(Stream.decide({ y: 0, s }, 1).flagged, false);
  }
});
