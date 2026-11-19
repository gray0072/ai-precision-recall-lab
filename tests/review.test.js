'use strict';

// Tests of sim/review.js and the review band in sim/contract.js (spec 01 §5, 02 §5.2): the desk's capacity
// and rate, the band's decisions and money, the hindsight search over band pairs (its fast path agrees with
// play), the live run with a desk, manual sends and "Desk full".

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

test('the desk level: bought or lent, moved by the difficulty within I–III', () => {
  const { Review } = load();
  assert.equal(Review.levelFor(0, 0, 1), 0, 'no desk stays no desk');
  assert.equal(Review.levelFor(0, 2, 0), 2);
  assert.equal(Review.levelFor(1, 2, 1), 3);
  assert.equal(Review.levelFor(3, 0, 1), 3);
  assert.equal(Review.levelFor(1, 0, -1), 1);
});

test('the queue never holds more than REVIEW_QUEUE; one item is done every 1 / rate seconds', () => {
  const { Review, REVIEW_QUEUE, REVIEW_RATE } = load();
  const d = Review.make(1, 0.3);
  for (let i = 0; i < REVIEW_QUEUE; i++) assert.equal(Review.admit(d, 0), true);
  assert.equal(Review.admit(d, 0), false, 'full');
  assert.equal(d.busy, REVIEW_QUEUE);
  const T = 1 / REVIEW_RATE[0];
  assert.equal(Review.admit(d, T * 0.99), false, 'not done yet');
  assert.equal(Review.admit(d, T * 1.01), true, 'one done, one in');
  Review.drainTo(d, 100);
  assert.equal(d.busy, 0);
  assert.equal(d.progress, 0, 'an idle desk saves no time up');
  Review.admit(d, 100);
  Review.drainTo(d, 100 + T * 0.5);
  assert.equal(d.busy, 1);
});

test('the band [low, t): people decide right and cost the fee; outside it the threshold decides', () => {
  const { Review, Contract, REVIEW_FEE } = load();
  const terms = { prices: { TP: 3, FP: -6, FN: -6, TN: 1 }, goal: null, fee: 100 };
  const items = [
    { i: 0, at: 0, y: 1, s: 0.45 }, { i: 1, at: 10, y: 0, s: 0.5 }, { i: 2, at: 20, y: 1, s: 0.7 },
    { i: 3, at: 30, y: 0, s: 0.2 }, { i: 4, at: 40, y: 0, s: 0.6 }
  ];
  const r = Contract.play(items, terms, 0.6, 'medium', 's', { level: 3, low: 0.4, travelS: 6 });
  // 0.45 and 0.5 in the band: TP and TN by people; 0.7 TP, 0.2 TN, 0.6 FP (at the threshold: flagged)
  assert.deepEqual({ ...r.counts }, { TP: 2, FP: 1, FN: 0, TN: 2 });
  assert.equal(r.reviewed, 2);
  assert.equal(r.money, -2 * REVIEW_FEE + 3 - 6 + 1);
  assert.equal(Review.inBand(0.4, 0.4, 0.6), true);
  assert.equal(Review.inBand(0.6, 0.4, 0.6), false);
});

test('a full desk: band items at the gate fall back on the threshold', () => {
  const { Contract, REVIEW_QUEUE } = load();
  const terms = { prices: { TP: 1, FP: -1, FN: -1, TN: 0 }, goal: null };
  const items = [];
  for (let i = 0; i < 10; i++) items.push({ i, at: i * 0.01, y: i % 2, s: 0.5 });   // ten at once, all in the band
  const r = Contract.play(items, terms, 0.6, 'medium', 's', { level: 1, low: 0.3, travelS: 6 });
  assert.equal(r.reviewed, REVIEW_QUEUE);
  const reviewedPos = items.slice(0, REVIEW_QUEUE).filter((it) => it.y).length;
  assert.equal(r.counts.FN, 5 - reviewedPos, 'the rest passed by the threshold');
});

test('the hindsight search over band pairs: the fast path agrees with play, and a band never hurts', () => {
  const { CONTRACTS, Contract, DIFFICULTIES, BELT_TRAVEL_S } = load();
  const def = CONTRACTS.C08;
  for (const seed of [3, 11]) {
    const items = Contract.streamOf(def, 'medium', seed);
    const desk = { level: Contract.deskLevel(def, 'medium'), travelS: BELT_TRAVEL_S / DIFFICULTIES.medium.speed };
    const plain = Contract.hindsightBest(items, def, 'medium');
    const best = Contract.hindsightBest(items, def, 'medium', 's', desk);
    assert.ok(best.feasible && best.money >= plain.money, `band ${best.money} vs none ${plain.money}`);
    assert.ok(best.low === null || best.low < best.t);
    const again = Contract.play(items, def, best.t, 'medium', 's', Object.assign({}, desk, { low: best.low }));
    assert.equal(again.money, best.money);
    // brute force on a coarse grid with play itself: nothing beats the search
    for (let k = 40; k <= 90; k += 10) for (let j = 20; j < k; j += 10) {
      const r = Contract.play(items, def, k / 100, 'medium', 's', Object.assign({}, desk, { low: j / 100 }));
      if (r.completed && r.goalMet) assert.ok(r.money <= best.money + 1e-9, `(${j}, ${k}) ${r.money} > ${best.money}`);
    }
  }
});

test('a live run with the desk: band items reviewed, a tap sends an item, a full desk emits deskFull', () => {
  const L = load();
  const full = [];
  L.GameEvents.on('deskFull', () => full.push(1));
  const run = L.Contract.start(L.CONTRACTS.C08, { difficulty: 'medium', seed: 5 });
  assert.equal(run.deskLevel, 2, 'C08 lends desk II');
  assert.ok(L.State.review && L.State.review.low === 0.35);
  let sent = null, guard = 0;
  while (!L.Contract.update() && guard++ < 100000) {
    L.State.threshold = 0.7;
    L.Review.setLow(0.45);
    if (!sent && L.State.belt.length > 3) {
      sent = L.State.belt.find((it) => it.s < 0.3);
      if (sent) assert.equal(L.Review.send(sent), 'sent');
      if (sent) assert.equal(L.Review.send(sent), 'already');
    }
    L.Stream.update(0.05);
    L.Review.update();
  }
  assert.ok(sent && sent.reviewed, 'the tapped item was decided by people');
  assert.equal(sent.outcome, sent.y ? 'TP' : 'TN');
  const reviewed = run.items.filter((it) => it.reviewed);
  assert.ok(reviewed.length > 20);
  assert.ok(reviewed.every((it) => it.money === -L.REVIEW_FEE && (it.outcome === 'TP' || it.outcome === 'TN')));
  assert.ok(reviewed.filter((it) => !it.sent).every((it) => it.s >= 0.45 && it.s < 0.7));
  assert.ok(full.length > 0, 'the band is wide enough to fill desk II sometimes');
  const r = L.Contract.results(run);
  assert.equal(r.reviewed, reviewed.length);
  assert.ok(r.best.feasible);
  // the band can never sit above the threshold
  L.State.threshold = 0.3;
  L.Review.setLow(0.5);
  assert.equal(L.State.review.low, 0.3);
});

test('the sandbox: the review band knob attaches a desk and keeps its edge', () => {
  const L = load();
  L.Sandbox.start({ review: true, reviewLow: 0.3, threshold: 0.6 }, 1);
  assert.ok(L.State.review && L.State.review.level === L.REVIEW_SANDBOX_LEVEL && L.State.review.low === 0.3);
  L.Sandbox.set('review', false);
  assert.equal(L.State.review, null);
  L.Sandbox.set('review', true);
  assert.ok(L.State.review);
  for (let k = 0; k < 400; k++) { L.Stream.update(0.05); L.Review.update(); }
  assert.ok(L.State.pile.some((it) => it.reviewed));
});
