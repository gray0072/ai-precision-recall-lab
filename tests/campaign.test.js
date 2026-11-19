'use strict';

// Tests of the live contract run (sim/contract.js: start, the gate's money, the goal chip, the outbreak,
// the end, the results and stars) and of campaign.js (unlocks, money, the fee on replays, the quiz bonus,
// cheated runs, the save's sanitizing). Spec 01 §2–§4, §14, 05 §5.

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

// a memory storage for Campaign.init
function memory(initial = null) {
  const box = { value: initial };
  return { box, load: () => box.value, save: (v) => { box.value = v; }, remove: () => { box.value = null; } };
}

// plays the live run to its end with the threshold held at t (moved by a function of the decided count)
function playLive(L, def, difficulty, seed, t) {
  const run = L.Contract.start(def, { difficulty, seed });
  const tAt = typeof t === 'function' ? t : () => t;
  let guard = 0;
  while (!L.Contract.update() && guard++ < 100000) {
    L.State.threshold = tAt(run.count);
    L.Stream.update(0.05);
  }
  return run;
}

test('the data: every contract, quiz and card is complete', () => {
  const { CONTRACTS, CONTRACT_ORDER, ACTS, QUIZ, GLOSSARY, WHICH_METRIC, COACH, SCENARIOS } = load();
  assert.equal(CONTRACT_ORDER.length, 12);
  assert.deepEqual(Array.from(ACTS.flatMap((a) => Array.from(a.contracts))), Array.from(CONTRACT_ORDER));
  for (const id of CONTRACT_ORDER) {
    const c = CONTRACTS[id];
    assert.ok(SCENARIOS[c.scenario], id);
    assert.ok(QUIZ[id] && QUIZ[id].options[QUIZ[id].answer], id + ' quiz');
    if (c.soon) continue;
    for (const k of ['name', 'teaches', 'prevalence', 'dPrime', 'items', 'rate', 'prices', 'fee', 'target', 'message', 'lesson', 'card']) {
      assert.ok(c[k] !== undefined, id + '.' + k);
    }
  }
  const cards = new Set(GLOSSARY.map((g) => g.id));
  assert.equal(cards.size, 20);
  for (const g of GLOSSARY) for (const l of g.links) assert.ok(cards.has(l), g.id + ' → ' + l);
  for (const id of CONTRACT_ORDER) if (!CONTRACTS[id].soon) assert.ok(cards.has(CONTRACTS[id].card), id + ' card');
  for (const w of WHICH_METRIC) for (const l of w.cards) assert.ok(cards.has(l), l);
  const marks = new Set(COACH.map((m) => m.id));
  for (const m of COACH) {
    assert.ok(CONTRACTS[m.contract], m.id);
    if (m.when.startsWith('after:')) assert.ok(marks.has(m.when.slice(6)), m.id);
  }
});

test('a live run: the gate prices every item, the totals match the stream, the end comes at the last item', () => {
  const L = load();
  const def = L.CONTRACTS.C02;
  const run = playLive(L, def, 'medium', 1234, 0.8);
  assert.equal(run.ended.failed, null);
  assert.equal(run.count, def.items);
  // the same as the headless play at the same fixed threshold
  const h = L.Contract.play(L.Contract.streamOf(def, 'medium', 1234), def, 0.8, 'medium');
  assert.deepEqual({ ...run.totals }, { ...h.counts });
  assert.equal(run.money, h.money);
  const r = L.Contract.results(run);
  assert.equal(r.completed, true);
  assert.equal(r.thresholds.length, def.items);
  assert.equal(r.avgT, 0.8);
  assert.equal(r.money, h.money);
  assert.ok(r.best.feasible);
  assert.ok(r.best.money >= r.money || !h.goalMet, 'the hindsight-best is at least as good as any feasible fixed threshold');
  assert.equal(r.profit[80].money, h.money, 'the profit curve at 0.80 is the money of 0.80');
});

test('the difficulty: belt speed, d′ and goal shift', () => {
  const L = load();
  const def = L.CONTRACTS.C02;
  const easy = L.Contract.start(def, { difficulty: 'easy', seed: 7 });
  assert.equal(easy.travelS, L.BELT_TRAVEL_S / 0.75);
  assert.ok(Math.abs(easy.model.dPrime - 2.4) < 1e-12);
  assert.ok(Math.abs(easy.goalTarget - 0.85) < 1e-12);
  assert.equal(easy.tint, true);
  assert.ok(easy.ghostT !== null, 'Easy shows the ghost line');
  const hard = L.Contract.start(def, { difficulty: 'hard', seed: 7 });
  assert.ok(Math.abs(hard.model.dPrime - 2.0) < 1e-12);
  assert.equal(hard.ghostT, null);
  assert.equal(L.Contract.start(def, { difficulty: 'medium', seed: 7 }).ghostT, null, 'Medium: only with Calibration');
});

test('the goal chip: grace, then met / close / broken; events', () => {
  const L = load();
  const states = [];
  L.GameEvents.on('goalChanged', (e) => states.push(e.state));
  const run = L.Contract.start(L.CONTRACTS.C02, { difficulty: 'medium', seed: 99 });
  assert.equal(run.goalState, 'grace');
  run.count = 40;
  run.totals = { TP: 30, FP: 2, FN: 5, TN: 3 };   // precision 0.94
  assert.equal(L.Contract.goalStateOf(run), 'met');
  run.totals = { TP: 30, FP: 4, FN: 5, TN: 1 };   // 0.88
  assert.equal(L.Contract.goalStateOf(run), 'close');
  run.totals = { TP: 20, FP: 10, FN: 5, TN: 5 };  // 0.67
  assert.equal(L.Contract.goalStateOf(run), 'broken');
  run.count = 10;
  assert.equal(L.Contract.goalStateOf(run), 'grace');
  const run2 = playLive(L, L.CONTRACTS.C02, 'medium', 99, 0.9);
  assert.ok(states.length >= 1 && states[0] !== 'grace');
  assert.equal(L.Contract.goalStateOf(Object.assign(run2, { goal: null })), 'none');
});

test('the outbreak ends C03 early at the allowance; no stars; the event fires', () => {
  const L = load();
  let outbreaks = 0, ended = 0;
  L.GameEvents.on('outbreak', () => outbreaks++);
  L.GameEvents.on('contractEnded', () => ended++);
  const run = playLive(L, L.CONTRACTS.C03, 'medium', 5, 0.99);   // flags nothing: every fever is missed
  assert.equal(run.ended.failed, 'outbreak');
  assert.equal(run.totals.FN, 4);
  assert.ok(run.count < L.CONTRACTS.C03.items);
  assert.equal(outbreaks, 1);
  assert.equal(ended, 1);
  const r = L.Contract.results(run);
  assert.equal(r.completed, false);
  assert.equal(r.stars, 0);
});

test('stars: ★ goal, ★★ target, ★★★ 90 % of the hindsight-best', () => {
  const { Contract } = load();
  const best = { feasible: true, money: 100 };
  const r = (money, extra = {}) => Object.assign({ completed: true, goalMet: true, money }, extra);
  assert.equal(Contract.stars(r(95), 40, best), 3);
  assert.equal(Contract.stars(r(90), 40, best), 3);
  assert.equal(Contract.stars(r(89), 40, best), 2);
  assert.equal(Contract.stars(r(39), 40, best), 1);
  assert.equal(Contract.stars(r(95, { goalMet: false }), 40, best), 0);
  assert.equal(Contract.stars(r(95, { completed: false }), 40, best), 0);
  assert.equal(Contract.stars(r(95), 40, { feasible: false, money: null }), 2);
  assert.equal(Contract.stars(r(-10.8), -20, { feasible: true, money: -10 }), 3, 'a negative best: within 10 % of it');
});

test('the cheat F ends the run now with the results so far; the run is cheated', () => {
  const L = load();
  const run = L.Contract.start(L.CONTRACTS.C04, { difficulty: 'medium', seed: 3 });
  L.State.threshold = 0.5;
  for (let i = 0; i < 400; i++) L.Stream.update(0.05);
  const n = run.count;
  assert.ok(n > 5 && n < run.def.items);
  L.Contract.finishNow(run);
  assert.equal(L.Contract.update().failed, null);
  L.Stream.update(10);
  assert.equal(run.count, n, 'nothing moves after the end');
  const r = L.Contract.results(run);
  assert.equal(r.cheated, true);
  assert.equal(r.decided, n);
  assert.equal(r.thresholds.length, n);
});

test('the campaign: unlocks, the fee only for more stars, the quiz bonus once, a balance never below 0', () => {
  const { Campaign } = load();
  const st = memory();
  Campaign.init(st);
  assert.equal(Campaign.exists, false);
  assert.equal(Campaign.unlocked('C01'), true);
  assert.equal(Campaign.unlocked('C02'), false);
  assert.equal(Campaign.unlocked('C06'), false, 'Act 2 arrives in I05');
  const res = (o) => Object.assign({ id: 'C01', difficulty: 'medium', completed: true, cheated: false, money: 40, stars: 2 }, o);

  let out = Campaign.finish(res(), true);
  assert.deepEqual([out.contract, out.fee, out.quiz, out.total, out.balance], [40, 100, 50, 190, 190]);
  assert.equal(out.newBest, true);
  assert.equal(Campaign.unlocked('C02'), true);
  assert.equal(Campaign.exists, true);
  assert.equal(st.box.value.money, 190, 'saved');

  out = Campaign.finish(res({ money: 30, stars: 2 }), true);   // a replay: same stars, no fee, no second bonus
  assert.deepEqual([out.fee, out.quiz, out.total, out.newBest], [0, 0, 30, false]);
  out = Campaign.finish(res({ money: 50, stars: 3 }), false);   // more stars: the fee again
  assert.deepEqual([out.fee, out.total, out.newBest], [100, 150, true]);
  assert.deepEqual({ ...Campaign.record('C01', 'medium') }, { stars: 3, best: 50 });
  out = Campaign.finish(res({ money: 20, stars: 1 }), false);   // fewer stars: the record keeps the best
  assert.deepEqual({ ...Campaign.record('C01', 'medium') }, { stars: 3, best: 50 });
  out = Campaign.finish(res({ difficulty: 'hard', money: 10, stars: 1 }), false);   // per level
  assert.equal(out.fee, 100);

  const before = Campaign.money;
  out = Campaign.finish(res({ id: 'C02', completed: false, money: -5000, stars: 0 }), true);   // a failure
  assert.deepEqual([out.fee, out.quiz, out.balance, out.recorded], [0, 0, 0, false]);
  assert.ok(before > 0);
  assert.equal(Campaign.record('C02', 'medium'), null);
});

test('the campaign: a cheated run pays its own money only and records nothing; cheats mark the save', () => {
  const { Campaign } = load();
  Campaign.init(memory());
  const out = Campaign.finish({ id: 'C01', difficulty: 'easy', completed: true, cheated: true, money: 25, stars: 3 }, true);
  assert.deepEqual([out.fee, out.quiz, out.total, out.recorded], [0, 0, 25, false]);
  assert.equal(Campaign.record('C01', 'easy'), null);
  assert.equal(Campaign.unlocked('C02'), false);
  assert.equal(Campaign.cheated, false);
  Campaign.open('C04');
  assert.equal(Campaign.unlocked('C04'), true);
  Campaign.addMoney(1000);
  assert.equal(Campaign.money, 1025);
  assert.equal(Campaign.cheated, true);
});

test('the campaign: a broken save is sanitized field by field; New campaign erases it', () => {
  const { Campaign } = load();
  const st = memory({
    money: -40, upgrades: ['U-data-1', 7], coach: 'x', opened: ['C03', 'C99'], cheated: 'yes',
    quiz: { C01: true, C02: 'no', Z: true },
    contracts: { C01: { easy: { stars: 7, best: 12 }, medium: { stars: 'a' } }, C77: { easy: { stars: 1 } } }
  });
  Campaign.init(st);
  const d = Campaign.data;
  assert.equal(d.money, 0);
  assert.deepEqual(Array.from(d.upgrades), ['U-data-1']);
  assert.deepEqual(Array.from(d.coach), []);
  assert.deepEqual(Array.from(d.opened), ['C03']);
  assert.equal(d.cheated, false);
  assert.deepEqual(Object.keys(d.quiz), ['C01']);
  assert.deepEqual(Object.keys(d.contracts), ['C01']);
  assert.deepEqual({ ...d.contracts.C01.easy }, { stars: 3, best: 12 });
  assert.equal(d.contracts.C01.medium, undefined);
  Campaign.markCoach('c01-item');
  Campaign.markCoach('c01-item');
  assert.deepEqual(Array.from(Campaign.data.coach), ['c01-item']);
  Campaign.reset();
  assert.equal(Campaign.money, 0);
  assert.equal(Campaign.played('C01'), false);
  assert.equal(Campaign.exists, true);
});
