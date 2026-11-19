'use strict';

// Tests of sim/model.js (spec 02 §2.1, §2.3, §5.1): effective d', quantization, the true posterior and its
// mapping to the raw axis, the binormal AUC, Platt scaling, calibration keeps the ranking (ADR-0004).

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

const { Model, Stream, Metrics, SCENARIOS, normCdf, sigmoid, logit } = load();
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);

test('Φ and the helpers', () => {
  near(normCdf(0), 0.5, 1e-9);
  near(normCdf(1.96), 0.975, 1e-4);
  near(normCdf(-1), 0.158655, 1e-6);
  near(sigmoid(logit(0.3)), 0.3, 1e-12);
  assert.equal(sigmoid(-1000), 0);
  assert.equal(sigmoid(1000), 1);
});

test('effective d′ adds the bonus and the difficulty, clamped to [0, 4.5]', () => {
  near(Model.effectiveDPrime(2.2, 0.5, -0.2), 2.5, 1e-12);
  assert.equal(Model.effectiveDPrime(4.4, 0.4, 0.2), 4.5);
  assert.equal(Model.effectiveDPrime(0.1, 0, -0.2), 0);
});

test('quantization: two decimals in [0.01, 0.99]', () => {
  assert.equal(Model.quantize(0.6249), 0.62);
  assert.equal(Model.quantize(0.625), 0.63);
  assert.equal(Model.quantize(0.001), 0.01);
  assert.equal(Model.quantize(0.999), 0.99);
});

test('AUC = Φ(d′/√2): the table of spec 02 §2.1', () => {
  const table = { 1.0: 0.76, 1.5: 0.86, 2.0: 0.92, 2.5: 0.96, 3.0: 0.98 };
  for (const [d, auc] of Object.entries(table)) near(Model.theoreticalAuc(+d), auc, 0.005, `d' ${d}`);
});

test('20 000 samples at d′ = 2: the measured AUC is within 0.01 of Φ(√2) = 0.921', () => {
  const m = Model.of(SCENARIOS.abstract, { dPrime: 2, prevalence: 0.5 });
  near(Model.theoreticalAuc(2), 0.9214, 1e-4);
  for (const seed of [1, 2, 3]) near(Metrics.auc(Stream.validation(seed, m, 20000)), 0.9214, 0.01, `seed ${seed}`);
});

test('the true posterior is Bayes’ rule on the two normal humps', () => {
  const m = { dPrime: 2.2, prevalence: 0.1, gamma: 1.5, beta: 0.3 };
  const pdf = (z, mu) => Math.exp(-((z - mu) ** 2) / 2);
  for (const z of [-2, -0.5, 0, 0.7, 2.5]) {
    const bayes = m.prevalence * pdf(z, 1.1) / (m.prevalence * pdf(z, 1.1) + (1 - m.prevalence) * pdf(z, -1.1));
    near(Model.posterior(z, m), bayes, 1e-12, `z ${z}`);
    near(Model.posteriorOfScore(sigmoid(m.gamma * z + m.beta), m), bayes, 1e-9, `z ${z}`);
  }
});

test('the posterior threshold on the raw axis splits the grid exactly (the Easy ghost line)', () => {
  for (const id of ['spam', 'fever', 'fraud']) {
    const m = Model.of(SCENARIOS[id]);
    for (const p of [0.03, 0.09, 0.34, 0.5, 0.77]) {
      const t = Model.scoreForPosterior(p, m);
      for (let k = 1; k <= 99; k++) {
        const s = k / 100;
        if (Math.round(s * 100) >= Math.round(t * 100)) assert.ok(Model.posteriorOfScore(s, m) >= p - 1e-12, `${id} p ${p} s ${s}`);
        else assert.ok(Model.posteriorOfScore(s, m) < p, `${id} p ${p} s ${s}`);
      }
    }
  }
  assert.equal(Model.scoreForPosterior(0.2, { dPrime: 0, prevalence: 0.3, gamma: 1, beta: 0 }), 0);
  assert.equal(Model.scoreForPosterior(0.4, { dPrime: 0, prevalence: 0.3, gamma: 1, beta: 0 }), 1);
});

// Platt scaling should find a = d'/γ, b = logit(π) − d'β/γ. Checked on the scenarios whose scores rarely touch
// the clamps of 0.01 / 0.99; Card Watch (γ 1.8, β +0.8) piles about 16 % of its frauds at 0.99, and the
// clamped feature biases the fit there (spec 02 §2.3), so it is checked by its reliability instead (below).
test('Platt scaling recovers a and b within 5 %', () => {
  for (const id of ['spam', 'bolts', 'moderation', 'abstract']) {
    const m = Model.of(SCENARIOS[id]);
    const e = Model.plattExpected(m);
    for (const seed of [1, 2, 3]) {
      const v = Stream.validation(seed, m, 20000);
      const f = Model.fitPlatt(v.map((i) => i.s), v.map((i) => i.y));
      assert.ok(f.ok && f.iterations <= 25);
      near(f.a, e.a, 0.05 * Math.abs(e.a), `${id} seed ${seed} a`);
      near(f.b, e.b, 0.05 * Math.abs(e.b), `${id} seed ${seed} b`);
    }
  }
});

test('Platt with one class only falls back to the identity', () => {
  const f = Model.fitPlatt([0.2, 0.4, 0.9], [0, 0, 0]);
  assert.equal(f.ok, false);
  assert.equal(Model.calibrate(0.37, f), 0.37);
});

test('after Platt the reliability diagram sits on the diagonal, the raw scores do not', () => {
  for (const id of ['spam', 'fever', 'fraud', 'moderation']) {
    const m = Model.of(SCENARIOS[id]);
    const v = Stream.validation(5, m);
    Stream.calibrate(v, Model.fitPlatt(v.map((i) => i.s), v.map((i) => i.y)));
    const ece = (key) => {   // expected calibration error: the count-weighted gap between the bins and the diagonal
      let e = 0;
      for (const b of Metrics.reliability(v, key)) if (b.count) e += b.count * Math.abs(b.observed - b.meanPredicted);
      return e / v.length;
    };
    assert.ok(ece('p') < 0.02, `${id} calibrated ECE ${ece('p')}`);
    assert.ok(ece('s') > 0.1, `${id} raw ECE ${ece('s')}`);
  }
});

test('a threshold on calibrated p is a threshold on the raw score: same matrix (ADR-0004)', () => {
  for (const id of ['fever', 'fraud', 'spam']) {
    const m = Model.of(SCENARIOS[id]);
    const v = Stream.validation(9, m);
    const platt = Model.fitPlatt(v.map((i) => i.s), v.map((i) => i.y));
    Stream.calibrate(v, platt);
    for (let k = 0; k <= 100; k++) {
      const t = k / 100;
      assert.deepEqual({ ...Metrics.counts(v, t, 'p') }, { ...Metrics.counts(v, Model.rawThreshold(t, platt), 's') }, `${id} t ${t}`);
    }
  }
});
