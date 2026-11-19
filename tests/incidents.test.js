'use strict';

// Tests of sim/incidents.js and the PSI of sim/metrics.js (spec 02 §6, ADR-0005): the schedule and its ramp,
// price changes, a base rate shift that leaves recall and FPR alone and moves precision, drift that lowers the
// AUC, PSI on a hand-made example, at rest and after drift, the drift alert of C09 (after the drift, never
// before it) and Retrain, stale Platt scaling after a shift, the live incidents' events and the cheat I.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

// plays the live run to its end with a fixed threshold; onStep(run) runs after every step
function playLive(L, def, difficulty, seed, t, opts = {}, onStep) {
  const run = L.Contract.start(def, Object.assign({ difficulty, seed }, opts));
  let guard = 0;
  while (!L.Contract.update() && guard++ < 200000) {
    L.State.threshold = t;
    L.Stream.update(0.05);
    L.Review.update();
    L.Incidents.update(0.05);
    if (onStep) onStep(run);
  }
  return run;
}

test('the schedule: a base rate shift and drift ramp in over their ramp; rush hour multiplies the rate', () => {
  const { Incidents } = load();
  const list = [
    { at: 10, kind: 'baseRate', params: { prevalence: 0.5 }, ramp: 10 },
    { at: 30, kind: 'drift', params: { shift: 2 } },
    { at: 50, kind: 'rush', params: { rate: 2, items: 5 } }
  ];
  const s = Incidents.schedule(list, 0.1);
  assert.equal(s(9).prevalence, 0.1);
  assert.ok(Math.abs(s(14).prevalence - 0.3) < 1e-12, 'half way (5 of 10 items) at item 14');
  assert.equal(s(19).prevalence, 0.5);
  assert.equal(s(29).drift, 0);
  assert.ok(Math.abs(s(30).drift - 2 / 20) < 1e-12, 'INCIDENT_RAMP = 20 items by default');
  assert.equal(s(60).drift, 2);
  assert.equal(s(49).rate, 1);
  assert.equal(s(50).rate, 2);
  assert.equal(s(54).rate, 2);
  assert.equal(s(55).rate, 1);
  // after a retrain at item 40 the drift is gone
  assert.equal(Incidents.schedule(list, 0.1, 40)(60).drift, 0);
});

test('a price change: the prices in force follow the item index', () => {
  const { Incidents } = load();
  const def = { prices: { TP: 1, FP: -1, FN: -1, TN: 0 }, incidents: [
    { at: 5, kind: 'priceChange', params: { prices: { TP: 1, FP: -2, FN: -1, TN: 0 } } },
    { at: 9, kind: 'priceChange', params: { prices: { TP: 1, FP: -3, FN: -1, TN: 0 } } }] };
  assert.equal(Incidents.pricesAt(def, 4).FP, -1);
  assert.equal(Incidents.pricesAt(def, 5).FP, -2);
  assert.equal(Incidents.pricesAt(def, 100).FP, -3);
});

test('a base rate shift: at the same threshold recall and FPR stay, precision rises (02 §6.1)', () => {
  const { Stream, Model, Metrics, SCENARIOS } = load();
  const m = Model.of(SCENARIOS.fever, { prevalence: 0.04, dPrime: 2 });
  const before = Stream.generate({ seed: 5, count: 40000, rate: 1, model: m });
  const after = Stream.generate({ seed: 6, count: 40000, rate: 1, model: m, schedule: () => ({ prevalence: 0.2 }) });
  const t = 0.3;
  const a = Metrics.compute(Metrics.counts(before, t)), b = Metrics.compute(Metrics.counts(after, t));
  assert.ok(Math.abs(a.recall - b.recall) < 0.03, `recall ${a.recall.toFixed(3)} → ${b.recall.toFixed(3)}`);
  assert.ok(Math.abs(a.fpr - b.fpr) < 0.01, `FPR ${a.fpr.toFixed(3)} → ${b.fpr.toFixed(3)}`);
  assert.ok(b.precision > a.precision + 0.25, `precision ${a.precision.toFixed(2)} → ${b.precision.toFixed(2)}`);
  // and as predicted by Bayes: precision = π·TPR / (π·TPR + (1 − π)·FPR)
  const pred = (pi, r) => pi * r.recall / (pi * r.recall + (1 - pi) * r.fpr);
  assert.ok(Math.abs(b.precision - pred(0.2, b)) < 0.02);
});

test('drift lowers the AUC to about Φ((d′ − shift)/√2); the noise draw of each item is kept', () => {
  const { Stream, Model, Metrics, SCENARIOS } = load();
  const m = Model.of(SCENARIOS.spam, { prevalence: 0.25, dPrime: 2.4 });
  const clean = Stream.generate({ seed: 3, count: 20000, rate: 1, model: m });
  const drifted = Stream.generate({ seed: 3, count: 20000, rate: 1, model: m, schedule: () => ({ drift: 1.2 }) });
  assert.ok(Math.abs(Metrics.auc(clean) - Model.theoreticalAuc(2.4)) < 0.015);
  assert.ok(Math.abs(Metrics.auc(drifted) - Model.theoreticalAuc(1.2)) < 0.02, Metrics.auc(drifted).toFixed(3));
  for (let i = 0; i < 50; i++) assert.equal(clean[i].e, drifted[i].e);
});

test('PSI: the formula on a hand-made example; ≈ 0 at rest, > 0.2 after drift', () => {
  const { Metrics, Stream, Model, SCENARIOS, PSI_ALERT } = load();
  // reference cut into 5 quantile bins of 20 % each; the actual shares 10, 10, 20, 30, 30 %
  const ref = Metrics.psiReference([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95], 5);
  assert.deepEqual(Array.from(ref.e), [0.2, 0.2, 0.2, 0.2, 0.2]);
  const act = [0.1, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95, 0.99];
  const sh = [0.1, 0.1, 0.2, 0.3, 0.3];
  const want = sh.reduce((s, a) => s + (a - 0.2) * Math.log(a / 0.2), 0);
  assert.ok(Math.abs(Metrics.psi(ref, act) - want) < 1e-12);
  assert.equal(Metrics.psi(ref, []), null);
  const m = Model.of(SCENARIOS.spam, { prevalence: 0.25, dPrime: 2.4 });
  const val = Stream.validation(1, m);
  const r = Metrics.psiReference(val.map((it) => it.s));
  const same = Stream.generate({ seed: 9, count: 5000, rate: 1, model: m }).map((it) => it.s);
  const moved = Stream.generate({ seed: 9, count: 5000, rate: 1, model: m, schedule: () => ({ drift: 2 }) }).map((it) => it.s);
  assert.ok(Metrics.psi(r, same) < 0.02, 'same distribution: ' + Metrics.psi(r, same).toFixed(3));
  assert.ok(Metrics.psi(r, moved) > PSI_ALERT, 'after drift: ' + Metrics.psi(r, moved).toFixed(3));
});

test('C09: the drift alert fires after the drift (never before it), within about one PSI window; Retrain restores the separation', () => {
  const L = load();
  const { CONTRACTS, Incidents, Metrics, Model, Contract, PSI_WINDOW } = L;
  const def = CONTRACTS.C09, at = def.incidents[0].at;
  const delays = [];
  let early = 0, never = 0;
  for (let s = 0; s < 40; s++) {
    const rt = Incidents.retrainedAtAlert(def, 'medium', 500 + s * 7919);
    if (rt.alertAt === null) { never++; continue; }
    if (rt.alertAt < at) { early++; continue; }
    delays.push(rt.alertAt - at);
    // the items scored by the retrained model separate like the original model again
    if (s < 5 && rt.from < rt.items.length - 50) {
      const after = rt.items.slice(rt.from);
      const d = Contract.modelOf(def, 'medium').dPrime;
      assert.ok(Math.abs(Metrics.auc(after) - Model.theoreticalAuc(d)) < 0.08, 'retrained AUC ' + Metrics.auc(after).toFixed(2));
    }
  }
  delays.sort((a, b) => a - b);
  assert.equal(early, 0, 'no alert before the drift');
  assert.ok(never <= 2, never + ' streams without an alert');
  assert.ok(delays[Math.floor(delays.length / 2)] <= PSI_WINDOW + 20, 'median delay ' + delays[Math.floor(delays.length / 2)]);
});

test('Platt scaling goes stale after a base rate shift: the badges\' p is too low (02 §2.3)', () => {
  const { Stream, Model, Metrics, SCENARIOS } = load();
  const m = Model.of(SCENARIOS.fever, { prevalence: 0.04, dPrime: 2 });
  const val = Stream.validation(2, m);
  const platt = Model.fitPlatt(val.map((it) => it.s), val.map((it) => it.y));
  const before = Stream.calibrate(Stream.generate({ seed: 4, count: 30000, rate: 1, model: m }), platt);
  const after = Stream.calibrate(Stream.generate({ seed: 4, count: 30000, rate: 1, model: m, schedule: () => ({ prevalence: 0.2 }) }), platt);
  const gap = (items) => {
    const mp = items.reduce((a, it) => a + it.p, 0) / items.length, obs = items.reduce((a, it) => a + it.y, 0) / items.length;
    return obs - mp;
  };
  assert.ok(Math.abs(gap(before)) < 0.01, 'calibrated before: ' + gap(before).toFixed(3));
  assert.ok(gap(after) > 0.08, 'after the shift more items are positive than p says: ' + gap(after).toFixed(3));
  // bin by bin: the observed share stands above the mean p in the bins that matter
  const rel = Metrics.reliability(after, 'p').filter((b) => b.count > 300);
  assert.ok(rel.every((b) => b.observed > b.meanPredicted), 'every busy bin above the diagonal');
});

test('a live contract: incidents warn, start, the drift monitor alerts, Retrain re-scores the items to come', () => {
  const L = load();
  const events = [];
  for (const name of ['incidentWarning', 'incidentStarted', 'driftAlert', 'retrainDone']) L.GameEvents.on(name, (e) => events.push(name));
  let retrainAsked = false;
  const run = playLive(L, L.CONTRACTS.C09, 'medium', 77, 0.85, {}, (r) => {
    if (r.monitor.alert && !retrainAsked) { retrainAsked = true; assert.equal(L.Incidents.retrain(r), true); assert.equal(L.Incidents.retrain(r), false, 'once'); }
  });
  assert.deepEqual(events.slice(0, 2), ['incidentWarning', 'incidentStarted']);
  assert.ok(events.includes('driftAlert'));
  assert.ok(events.includes('retrainDone'));
  assert.equal(run.retrained, true);
  const from = run.noDriftFrom;
  assert.ok(from > run.def.incidents[0].at && from < run.items.length);
  assert.ok(run.items.slice(from).every((it) => it.drift === 0 && it.gen === 1));
  assert.ok(run.items.slice(run.def.incidents[0].at + 20, from).every((it) => it.drift === 2));
  const r = L.Contract.results(run);
  assert.deepEqual({ alerts: r.monitor.alerts, retrained: r.monitor.retrained }, { alerts: 1, retrained: true });
  assert.ok(r.incidents[0].after.recall < r.incidents[0].before.recall, 'drift lowers recall at a fixed threshold');
});

test('C07 with Calibration: the badges are on p, the results\' reliability shows the stale fit after the shift', () => {
  const L = load();
  const run = playLive(L, L.CONTRACTS.C07, 'medium', 21, 0.15, { upgrades: ['U-calib'] });
  assert.equal(run.key, 'p');
  assert.ok(run.items.every((it) => it.p !== undefined));
  const r = L.Contract.results(run);
  assert.ok(r.reliability && r.reliability.after, 'before and after the shift');
  const share = (bins) => { let n = 0, pos = 0, pred = 0; for (const b of bins) if (b.count) { n += b.count; pos += b.observed * b.count; pred += b.meanPredicted * b.count; } return (pos - pred) / n; };
  assert.ok(share(r.reliability.after) > share(r.reliability.before) + 0.05, 'p too low after the shift');
  const around = r.incidents[0];
  assert.ok(around.after.precision > around.before.precision, 'precision rose with the base rate');
});

test('the cheat I starts the next incident with the next item; the arrivals before it stay', () => {
  const L = load();
  const run = L.Contract.start(L.CONTRACTS.C07, { difficulty: 'medium', seed: 8 });
  L.State.threshold = 0.2;
  for (let k = 0; k < 400 && run.count < 30; k++) L.Stream.update(0.05);
  const arrived = L.Incidents.nextIndex(run);
  const before = run.items.slice(0, arrived).map((it) => it.at);
  const inc = L.Incidents.startNow(run);
  assert.equal(inc.at, arrived);
  assert.deepEqual(run.items.slice(0, arrived).map((it) => it.at), before);
  const tail = run.items.slice(arrived + 20);
  const share = tail.reduce((a, it) => a + it.y, 0) / tail.length;
  assert.ok(share > 0.12, 'the new base rate from the next items on: ' + share.toFixed(2));
  assert.equal(L.Incidents.startNow(run), null, 'C07 has one incident');
});

// ---------- the adversary (02 §6.3, ADR-0006) ----------

test('the adversary: a share of the positives from the incident on is crafted, decided in advance from the seed', () => {
  const L = load();
  const def = L.CONTRACTS.C10;
  const at = def.incidents[0].at;
  const items = L.Contract.streamOf(def, 'medium', 41);
  const again = L.Contract.streamOf(def, 'medium', 41);
  assert.deepEqual(Array.from(items.map((it) => !!it.crafted)), Array.from(again.map((it) => !!it.crafted)));
  assert.ok(items.slice(0, at).every((it) => !it.crafted));
  assert.ok(items.every((it) => !it.crafted || (it.y === 1 && it.craftU >= 0.01 && it.craftU <= L.ADV_MARGIN)));
  // over many streams about ADV_SHARE of the positives after the ramp are crafted; the ring brings more fraud
  let pos = 0, crafted = 0, before = 0, nBefore = 0, after = 0, nAfter = 0;
  for (let s = 0; s < 40; s++) {
    for (const it of L.Contract.streamOf(def, 'medium', 1000 + s)) {
      if (it.i < at) { before += it.y; nBefore++; }
      if (it.i >= at + L.INCIDENT_RAMP) { after += it.y; nAfter++; if (it.y) { pos++; crafted += it.crafted ? 1 : 0; } }
    }
  }
  assert.ok(Math.abs(crafted / pos - L.ADV_SHARE) < 0.05, 'share ' + crafted / pos);
  assert.ok(Math.abs(before / nBefore - def.prevalence) < 0.015);
  assert.ok(Math.abs(after / nAfter - def.incidents[0].params.prevalence) < 0.02);
});

test('a crafted item lands just under the threshold of ADV_LAG_S earlier, on the raw or the calibrated axis', () => {
  const L = load();
  const it = { y: 1, crafted: true, craftU: 0.05, s: 0.97 };
  L.Incidents.craft(it, 0.62, 's', null);
  assert.equal(it.s, 0.57);
  assert.ok(!L.atOrAbove(it.s, 0.62));
  L.Incidents.craft(it, 0.03, 's', null);
  assert.equal(it.s, L.SCORE_MIN);   // clamped like any score
  // calibrated: the highest raw score whose p is still under the aim
  const platt = { a: 1.4, b: -0.7 };
  const c = { y: 1, crafted: true, craftU: 0.04 };
  L.Incidents.craft(c, 0.5, 'p', platt);
  assert.ok(c.p <= 0.46 + 1e-9 && L.Model.calibrate(c.s, platt) === c.p);
  assert.ok(L.Model.calibrate(L.round2(c.s + 0.01), platt) > 0.46);
  assert.equal(L.Incidents.craftedValue({ craftU: 0.04 }, 0.5, 'p', platt), c.p);
  // the threshold log: what the line was at a moment
  const run = { tLog: [{ at: 0, t: 0.5 }, { at: 10, t: 0.7 }, { at: 20, t: 0.4 }] };
  assert.equal(L.Incidents.thresholdAt(run, 9.9), 0.5);
  assert.equal(L.Incidents.thresholdAt(run, 15), 0.7);
  assert.equal(L.Incidents.thresholdAt(run, 25), 0.4);
});

test('C10 live: a line held still lets the crafted payments through just under it; a review band below it catches them', () => {
  const L = load();
  const def = L.CONTRACTS.C10;
  // held still at 0.75, the band closed (low = t): every crafted payment that arrived after the first lag is just under the line
  const still = playLive(L, def, 'medium', 77, 0.75, {}, (run) => { if (L.State.review) L.State.review.low = 0.75; });
  const sc = still.items.filter((it) => it.crafted && it.outcome);
  assert.ok(sc.length >= 5, 'crafted ' + sc.length);
  for (const it of sc) {
    assert.ok(it.s < 0.75 && it.s >= L.round2(0.75 - L.ADV_MARGIN) - 1e-9, 'score ' + it.s);
    assert.equal(it.outcome, 'FN');
  }
  const r1 = L.Contract.results(still);
  assert.equal(r1.crafted.total, sc.length);
  assert.equal(r1.crafted.through, sc.length);
  // the same stream with the lent desk's band 0.12 under the line: people catch the crafted ones
  const band = playLive(L, def, 'medium', 77, 0.75, {}, () => { if (L.State.review) L.State.review.low = 0.63; });
  const r2 = L.Contract.results(band);
  assert.ok(r2.crafted.reviewed >= r2.crafted.total * 0.7, JSON.stringify(r2.crafted));
  assert.ok(r2.money > r1.money);
  // the hindsight-best is aimed at too (ADR-0006): holding still is far from it, the band close to it
  assert.ok(r1.money < 0.9 * r1.best.money);
});

test('the hindsight-best against an adversary scores every candidate as if the ring had aimed at it', () => {
  const L = load();
  const def = Object.assign({}, L.CONTRACTS.C10, { lend: null });
  const items = L.Contract.streamOf(def, 'medium', 5);
  const best = L.Contract.hindsightBest(items, def, 'medium');
  for (const t of [0.5, 0.7, 0.85]) {
    const aimed = L.Incidents.craftedAgainst(items, () => t);
    const r = L.Contract.play(aimed, def, t, 'medium');
    assert.equal(best.runs[Math.round(t * 100)].money, r.money, 't ' + t);
  }
  // with a desk the fast band search agrees with play on the winning pair
  const desk = { level: 1, travelS: L.BELT_TRAVEL_S };
  const b2 = L.Contract.hindsightBest(items, def, 'medium', 's', desk);
  const aimed = L.Incidents.craftedAgainst(items, () => b2.t);
  const r2 = L.Contract.play(aimed, def, b2.t, 'medium', 's', Object.assign({ low: b2.low }, desk));
  assert.ok(Math.abs(r2.money - b2.money) < 1e-9);
  assert.ok(b2.money >= best.money);
});
