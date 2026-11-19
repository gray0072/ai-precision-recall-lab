'use strict';

// ============================================================
// AI Precision Recall Lab — top-k retrieval (spec 02 §7): the stream comes in queries of TOPK_DOCS documents,
// R of them relevant (uniform in TOPK_RELEVANT), each scored by the binormal model (02 §2.1). The knob is k
// instead of t: the k best-scored documents of each query are shown to the user (flagged). A document's rank
// in its query is fixed when the query is made (by the model's exact score z, highest first: the rounded
// badges may tie, z never does), so "shown at k" is simply rank < k: the line between shown and not shown
// sits at a different height in every query — top-k is a threshold per query. Per query
// Precision@k = relevant shown / k and Recall@k = relevant shown / R; the panel shows their means over the
// last TOPK_WINDOW queries (re-evaluated at the current k, like the rolling window) and over the contract.
// Mean P@k equals the pooled precision TP / (TP + FP) (every query shows k documents); mean R@k is not the
// pooled recall (R differs per query). The model curves are over k (1 … TOPK_DOCS) on validation queries:
// ROC (pooled FPR, TPR at each k) and the P@k–R@k curve. A contract with top-k (C11) is played headless at a
// fixed k, and its hindsight-best is the search over k (02 §5.2). Queries arrive one every 1 / rate seconds.
// No drawing, no DOM, no sound. Used by sim/contract.js, sim/sandbox.js, the renderer, the live panel, the
// charts, the results, tools/balance-check.js and the tests.
// ============================================================

const Topk = (() => {
  // the sub-streams of a query stream; prefix 'items' (a contract, the sandbox) or 'validation'
  function streams(seed, prefix) {
    return {
      classes: Rng.stream(seed, prefix + '.classes'),
      scores: Rng.stream(seed, prefix + '.scores')
    };
  }

  // One query q: TOPK_DOCS documents arriving together at `at`; the first R are the relevant ones (the order
  // does not matter: ranks come from the scores). i0: the global index of its first document.
  function makeQuery(rng, q, at, m, i0) {
    const R = rng.classes.int(TOPK_RELEVANT[0], TOPK_RELEVANT[1]);
    const docs = [];
    for (let d = 0; d < TOPK_DOCS; d++) {
      const y = d < R ? 1 : 0;
      const e = rng.scores.normal();
      const z = Model.logitMean(y, m.dPrime) + e;
      docs.push({ i: i0 + d, q, d, at, y, z, e, drift: 0, s: Model.rawScore(z, m), R });
    }
    const order = docs.slice().sort((a, b) => b.z - a.z);
    order.forEach((it, r) => { it.rank = r; });
    return docs;
  }

  // The model of the retrieval scenario: its temperament with the separation; the "prevalence" is the mean
  // share of relevant documents (the PR chart's random line).
  function modelOf(dPrime) {
    return Model.of(SCENARIOS.retrieval, { dPrime, prevalence: (TOPK_RELEVANT[0] + TOPK_RELEVANT[1]) / 2 / TOPK_DOCS });
  }

  // A contract's whole stream of queries, made in advance (02 §2.2): one query every 1 / rate seconds.
  // opts: { seed, queries, rate (queries per second), model }
  function generate(opts) {
    const rng = streams(opts.seed, 'items');
    const docs = [];
    for (let q = 0; q < opts.queries; q++) {
      for (const it of makeQuery(rng, q, (q + 0.5) / opts.rate, opts.model, q * TOPK_DOCS)) docs.push(it);
    }
    return docs;
  }

  // the validation queries (02 §2.2): about N_VAL documents, the data the team evaluated the ranker on
  function validation(seed, m, n = N_VAL) {
    const rng = streams(seed, 'validation');
    const docs = [];
    const nq = Math.ceil(n / TOPK_DOCS);
    for (let q = 0; q < nq; q++) for (const it of makeQuery(rng, q, 0, m, q * TOPK_DOCS)) docs.push(it);
    return docs;
  }

  // An endless source of queries (the sandbox): next(model) → the next query's documents
  function endless(seed) {
    const rng = streams(seed, 'items');
    let q = 0;
    return (m) => { const docs = makeQuery(rng, q, 0, m, q * TOPK_DOCS); q++; return docs; };
  }

  // shown at k: among the k best of its query
  function shown(item, k) { return item.rank < k; }

  // the gate (01 §1.3 with top-k): shown or not at the k of this moment
  function decide(item, k) {
    const flagged = shown(item, k);
    return { flagged, outcome: Stream.outcome(flagged, item.y) };
  }

  // the counts of documents re-evaluated at k (the pile, the window)
  function counts(items, k) {
    const c = Metrics.emptyCounts();
    for (const it of items) c[Stream.outcome(shown(it, k), it.y)]++;
    return c;
  }

  // Per query at k (or with each document's decision made, k = null): { q, R, hits (relevant shown), shown,
  // pAtK, rAtK }; only queries with at least one document in `items`. R is the query's own count of relevant
  // documents (Recall@k needs to know all of them, G-topk).
  function perQuery(items, k = null) {
    const map = new Map();
    for (const it of items) {
      let g = map.get(it.q);
      if (!g) { g = { q: it.q, R: it.R, hits: 0, shown: 0 }; map.set(it.q, g); }
      const f = k === null ? !!it.flagged : shown(it, k);
      if (f) { g.shown++; if (it.y) g.hits++; }
    }
    const out = Array.from(map.values());
    for (const g of out) {
      g.pAtK = g.shown ? g.hits / g.shown : null;
      g.rAtK = g.R ? g.hits / g.R : null;
    }
    return out;
  }

  // the means of P@k and R@k over the queries (null when there is none; a query with nothing shown has no P@k)
  function means(list) {
    const mean = (vals) => { const v = vals.filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    return { pAtK: mean(list.map((g) => g.pAtK)), rAtK: mean(list.map((g) => g.rAtK)), queries: list.length };
  }

  // P@k and R@k means of documents at k (or as decided, k = null)
  function summary(items, k = null) { return means(perQuery(items, k)); }

  // The model's curves over k (02 §7) on validation queries: for k = 0 … TOPK_DOCS the pooled counts, the
  // ROC point (FPR, TPR) and the P@k–R@k point; the area under the drawn ROC (trapezoids from (0, 0) to (1, 1))
  // and the share of relevant documents (the PR chart's random line). curves.byK[k] is the operating point.
  function curves(val) {
    const byK = [];
    for (let k = 0; k <= TOPK_DOCS; k++) {
      const c = counts(val, k);
      const m = Metrics.compute(c);
      const mq = summary(val, k);
      byK.push({ k, c, fpr: m.fpr, tpr: m.recall, recall: mq.rAtK, precision: k ? mq.pAtK : null });
    }
    const roc = byK.map((p) => ({ fpr: p.fpr, tpr: p.tpr, k: p.k }));
    let auc = 0;
    for (let k = 1; k < roc.length; k++) auc += (roc[k].fpr - roc[k - 1].fpr) * (roc[k].tpr + roc[k - 1].tpr) / 2;
    const pr = byK.filter((p) => p.k > 0).map((p) => ({ recall: p.recall, precision: p.precision, k: p.k }));
    const P = val.filter((it) => it.y).length;
    return { topk: true, byK, roc, auc, pr, ap: null, prevalence: val.length ? P / val.length : null };
  }

  // the operating point at k: the curves' point (the dot slides along them as k changes)
  function operatingPoint(cv, k) {
    const p = cv.byK[clamp(k, 0, TOPK_DOCS)];
    return { k, fpr: p.fpr, tpr: p.tpr, recall: p.recall, precision: p.precision };
  }

  // the y-value between shown and not shown in one query at k: halfway between the k-th and the (k+1)-th
  // score (on `key`); under the lowest document when every one is shown. docs: the query's documents.
  function cutOf(docs, k, key = 's') {
    let above = null, below = null;
    for (const it of docs) {
      if (it.rank === k - 1) above = it[key];
      if (it.rank === k) below = it[key];
    }
    if (above === null) return 1;
    if (below === null) return Math.max(0, above - 0.03);
    return (above + below) / 2;
  }

  // ---------- a contract with top-k (C11) ----------

  // The goal's value: the mean Recall@k (or P@k) over the queries decided
  function goalValueOf(items, goal, k = null) {
    if (!goal) return null;
    const m = summary(items, k);
    return goal.metric === 'precisionAtK' ? m.pAtK : m.rAtK;
  }

  // A top-k contract played headless at k (a number, or a function q → k). Same rules as Contract.play: the
  // price of each document's outcome, bankruptcy below −fee, the goal on the mean R@k of the whole contract.
  // Returns { counts, money, decided, queries, failed, completed, goalValue, goalMet, pAtK, rAtK }.
  function play(items, terms, k, difficulty) {
    const kAt = typeof k === 'function' ? k : () => k;
    const limit = terms.fee !== undefined ? -terms.fee : -Infinity;
    const c = Metrics.emptyCounts();
    const done = [];
    let cash = 0, failed = null;
    for (const it of items) {
      const out = decide(it, kAt(it.q)).outcome;
      c[out]++;
      cash = Math.round((cash + Contract.itemMoney(terms, it, out, false)) * 100) / 100;
      done.push({ q: it.q, R: it.R, y: it.y, flagged: out === 'TP' || out === 'FP' });
      if (cash < limit) { failed = 'bankrupt'; break; }
    }
    const m = summary(done);
    const gv = terms.goal ? (terms.goal.metric === 'precisionAtK' ? m.pAtK : m.rAtK) : null;
    const target = Contract.goalTarget(terms.goal, difficulty);
    return {
      counts: c, money: cash, decided: done.length, queries: m.queries, failed, completed: failed === null,
      goalValue: gv, goalMet: !terms.goal || (gv !== null && gv >= target - 1e-12), pAtK: m.pAtK, rAtK: m.rAtK
    };
  }

  // The hindsight-best fixed k (02 §5.2): every k in 1 … TOPK_DOCS held for the whole stream; only those that
  // complete the contract and meet the goal count; the most money wins (ties: the smaller k, the shorter page).
  // Returns { k, money, result, feasible, runs (by k; runs[0] is unused) }.
  function hindsightBest(items, terms, difficulty) {
    const runs = [null];
    for (let k = 1; k <= TOPK_DOCS; k++) runs.push(play(items, terms, k, difficulty));
    let best = 0;
    for (let k = 1; k <= TOPK_DOCS; k++) {
      const r = runs[k];
      if (r.completed && r.goalMet && (!best || r.money > runs[best].money)) best = k;
    }
    if (!best) return { k: null, money: null, result: null, feasible: false, runs };
    return { k: best, money: runs[best].money, result: runs[best], feasible: true, runs };
  }

  // the money of the stream at every fixed k (the results' profit chart): [{ k, money }] for k = 1 … TOPK_DOCS
  function profitByK(items, terms) {
    const out = [];
    for (let k = 1; k <= TOPK_DOCS; k++) {
      let cash = 0;
      for (const it of items) cash += Contract.itemMoney(terms, it, decide(it, k).outcome, false);
      out.push({ k, money: Math.round(cash * 100) / 100 });
    }
    return out;
  }

  // ---------- the live knob ----------
  // The handle and the input work on a line value v in [0, 1] (a press, a drag, the wheel, the keys):
  // k = round((1 − v) · TOPK_DOCS), 1 … TOPK_DOCS, so dragging up shows fewer documents. The input's steps
  // are scaled by STEP_UNIT, so one step of the keys or the wheel is one document (01 §11.1: ↑ / ↓ change k
  // by 1, Shift by 5).
  const STEP_UNIT = 100 / TOPK_DOCS / 100 / THRESHOLD_STEP;
  function kOfValue(v) { return clamp(Math.round((1 - v) * TOPK_DOCS), 1, TOPK_DOCS); }
  function valueOfK(k) { return 1 - k / TOPK_DOCS; }

  return {
    makeQuery, modelOf, generate, validation, endless, shown, decide, counts, perQuery, means, summary, curves,
    operatingPoint, cutOf, goalValueOf, play, hindsightBest, profitByK, kOfValue, valueOfK, STEP_UNIT
  };
})();
