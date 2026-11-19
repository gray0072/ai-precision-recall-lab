'use strict';

// Tests of top-k retrieval (sim/topk.js, spec 02 §7): queries, ranks, P@k and R@k on a known query, the means
// over queries, the curves over k, the per-query cut, the knob's mapping, the headless play and the hindsight
// search over k; the live C11 run and its results; the sandbox's Top-k mode.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

// a hand-made query: scores (highest first by z) and which are relevant
function query(L, q, rel, n = 10) {
  const docs = [];
  for (let d = 0; d < n; d++) docs.push({ i: q * n + d, q, d, y: rel.includes(d) ? 1 : 0, z: -d, s: L.round2(0.95 - d * 0.05), R: rel.length, rank: d });
  return docs;
}

test('queries: TOPK_DOCS documents, R relevant in 2–8, ranks 0 … 29 by the exact score', () => {
  const L = load();
  const m = L.Topk.modelOf(1.8);
  const docs = L.Topk.generate({ seed: 7, queries: 40, rate: 0.25, model: m });
  assert.equal(docs.length, 40 * L.TOPK_DOCS);
  for (let q = 0; q < 40; q++) {
    const qd = docs.filter((it) => it.q === q);
    const R = qd.filter((it) => it.y).length;
    assert.ok(R >= 2 && R <= 8, 'R ' + R);
    assert.ok(qd.every((it) => it.R === R && it.at === qd[0].at));
    assert.deepEqual(Array.from(qd.map((it) => it.rank)).sort((a, b) => a - b), Array.from({ length: L.TOPK_DOCS }, (_, k) => k));
    const byRank = qd.slice().sort((a, b) => a.rank - b.rank);
    for (let k = 1; k < byRank.length; k++) assert.ok(byRank[k - 1].z > byRank[k].z && byRank[k - 1].s >= byRank[k].s);
  }
  // one query every 1 / rate seconds; the same seed gives the same stream
  assert.ok(Math.abs(docs[L.TOPK_DOCS].at - docs[0].at - 4) < 1e-9);
  assert.deepEqual(L.Topk.generate({ seed: 7, queries: 40, rate: 0.25, model: m }).map((it) => it.s), docs.map((it) => it.s));
});

test('P@k and R@k on a known query (G-topk: 5 relevant, top-10 holds 4 → P@10 = 0.4, R@10 = 0.8)', () => {
  const L = load();
  const docs = query(L, 0, [0, 2, 5, 9, 14], 20);
  const g = L.Topk.perQuery(docs, 10)[0];
  assert.equal(g.hits, 4);
  assert.equal(g.pAtK, 0.4);
  assert.equal(g.rAtK, 0.8);
  const g3 = L.Topk.perQuery(docs, 3)[0];
  assert.equal(g3.pAtK, 2 / 3);
  assert.equal(g3.rAtK, 2 / 5);
  // the counts: TP = relevant shown, FP = irrelevant shown, FN = relevant left out
  assert.deepEqual({ ...L.Topk.counts(docs, 10) }, { TP: 4, FP: 6, FN: 1, TN: 9 });
});

test('the means over queries: mean P@k is the pooled precision, mean R@k is not the pooled recall', () => {
  const L = load();
  const docs = query(L, 0, [0, 1], 10).concat(query(L, 1, [0, 3, 4, 6, 7, 8], 10));
  const k = 4;
  const m = L.Topk.summary(docs, k);
  const c = L.Topk.counts(docs, k);
  const pooled = L.Metrics.compute(c);
  assert.equal(m.queries, 2);
  assert.ok(Math.abs(m.pAtK - pooled.precision) < 1e-12);           // (2/4 + 2/4) / 2 = 4 / 8
  assert.ok(Math.abs(m.rAtK - (2 / 2 + 2 / 6) / 2) < 1e-12);        // 0.667
  assert.ok(Math.abs(pooled.recall - 4 / 8) < 1e-12);               // pooled: 0.5
  // as decided: each document's own decision (k = null)
  docs.forEach((it) => { it.flagged = it.rank < 2; });
  assert.ok(Math.abs(L.Topk.summary(docs).pAtK - (1 + 0.5) / 2) < 1e-12);
});

test('a bigger k: mean R@k never falls, mean P@k falls on average; the curves over k and the operating point', () => {
  const L = load();
  const val = L.Topk.validation(3, L.Topk.modelOf(1.8));
  const cv = L.Topk.curves(val);
  assert.equal(cv.byK.length, L.TOPK_DOCS + 1);
  for (let k = 1; k <= L.TOPK_DOCS; k++) assert.ok(cv.byK[k].recall >= cv.byK[k - 1].recall - 1e-12 || k === 1);
  assert.ok(cv.byK[1].precision > cv.byK[10].precision && cv.byK[10].precision > cv.byK[30].precision);
  assert.deepEqual([cv.byK[0].fpr, cv.byK[0].tpr], [0, 0]);
  assert.deepEqual([cv.byK[30].fpr, cv.byK[30].tpr, cv.byK[30].recall], [1, 1, 1]);
  assert.ok(cv.auc > 0.8 && cv.auc < 1);
  const op = L.Topk.operatingPoint(cv, 7);
  assert.equal(op.recall, cv.byK[7].recall);
  assert.equal(op.precision, cv.byK[7].precision);
});

test('the cut of a query sits between the k-th and the (k+1)-th score; the knob maps one key step to one document', () => {
  const L = load();
  const docs = query(L, 0, [1], 10);
  assert.ok(Math.abs(L.Topk.cutOf(docs, 3) - (0.85 + 0.8) / 2) < 1e-9);
  assert.ok(L.Topk.cutOf(docs, 10) < 0.5);
  for (let k = 1; k <= L.TOPK_DOCS; k++) assert.equal(L.Topk.kOfValue(L.Topk.valueOfK(k)), k);
  // ↑ shows one fewer, ↓ one more (Input rounds the value to 0.01 after each step)
  const step = L.THRESHOLD_STEP * L.Topk.STEP_UNIT;
  for (let k = 2; k < L.TOPK_DOCS; k++) {
    assert.equal(L.Topk.kOfValue(L.round2(L.Topk.valueOfK(k) + step)), k - 1);
    assert.equal(L.Topk.kOfValue(L.round2(L.Topk.valueOfK(k) - step)), k + 1);
  }
});

test('C11 headless: play at a fixed k, the hindsight-best is the best k that meets the mean-R@k goal', () => {
  const L = load();
  const def = L.CONTRACTS.C11;
  const items = L.Contract.streamOf(def, 'medium', 123);
  assert.equal(items.length, def.items * L.TOPK_DOCS);
  const best = L.Topk.hindsightBest(items, def, 'medium');
  assert.ok(best.feasible);
  for (let k = 1; k <= L.TOPK_DOCS; k++) {
    const r = best.runs[k];
    if (r.completed && r.goalMet) assert.ok(r.money <= best.money + 1e-9, 'k ' + k);
  }
  const r = best.runs[best.k];
  assert.ok(r.rAtK >= L.Contract.goalTarget(def.goal, 'medium') - 1e-12);
  // the money of a fixed k: +3 per relevant shown, −1 per irrelevant shown, −2 per relevant left out
  const c = r.counts;
  assert.ok(Math.abs(r.money - (3 * c.TP - c.FP - 2 * c.FN)) < 1e-9);
  // the profit by k agrees with play
  const prof = L.Topk.profitByK(items, def);
  assert.ok(Math.abs(prof[best.k - 1].money - best.money) < 1e-9);
});

test('C11 live: the gate shows each query\'s top k of the moment; results by query; stars against the best k', () => {
  const L = load();
  const run = L.Contract.start(L.CONTRACTS.C11, { difficulty: 'medium', seed: 99 });
  assert.equal(run.topk, true);
  assert.equal(run.key, 's');
  assert.equal(L.State.review, null);
  let g = 0;
  while (!L.Contract.update() && g++ < 100000) {
    L.State.k = run.count < 10 * L.TOPK_DOCS ? 4 : 9;
    L.Stream.update(0.05);
  }
  assert.equal(run.count, run.items.length);
  for (const it of run.items) {
    assert.equal(it.flagged, it.rank < it.k);
    assert.equal(it.k, run.items.find((x) => x.q === it.q && x.d === 0).k);   // one k per query
  }
  const r = L.Contract.results(run);
  assert.equal(r.topk, true);
  assert.equal(r.thresholds.length, L.CONTRACTS.C11.items);
  assert.ok(r.thresholds.slice(0, 9).every((k) => k === 4) && r.thresholds.slice(-5).every((k) => k === 9));
  assert.ok(Math.abs(r.goalValue - L.Topk.summary(run.items).rAtK) < 1e-12);
  assert.equal(r.best.k !== null, r.best.feasible);
  assert.equal(r.profit.length, L.TOPK_DOCS);
  assert.equal(r.stars, L.Contract.stars(r, L.Contract.targetOf(L.CONTRACTS.C11, 'medium'), r.best));
});

test('the sandbox Top-k mode: Search Ranker streams queries, the window holds TOPK_WINDOW queries, Generate makes whole queries', () => {
  const L = load();
  L.Sandbox.start({ scenario: 'retrieval', k: 6, calibrated: true, review: true }, 5);
  const run = L.State.run;
  assert.equal(run.topk, true);
  assert.equal(L.State.k, 6);
  assert.equal(run.knobs.calibrated, false);
  assert.equal(run.knobs.review, false);
  assert.equal(run.window, L.TOPK_WINDOW * L.TOPK_DOCS);
  for (let s = 0; s < 400; s++) L.Stream.update(0.1);
  assert.ok(L.State.pile.length > 0 && L.State.pile.length % L.TOPK_DOCS === 0);
  assert.ok(L.State.pile.every((it) => it.flagged === it.rank < 6));
  L.Sandbox.generate();
  assert.ok(L.State.pile.length % L.TOPK_DOCS === 0);
  // back to Abstract: the threshold decides again, belt and pile start afresh
  L.Sandbox.set('scenario', 'abstract');
  assert.equal(run.topk, false);
  assert.equal(L.State.pile.length, 0);
  assert.equal(run.decideAt, null);
  assert.equal(run.window, L.PILE_WINDOW);
});
