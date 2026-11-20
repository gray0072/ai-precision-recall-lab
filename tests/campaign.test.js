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

test('the cloud merge: stars and bests grow from both, money and upgrades from the later copy, a later epoch wins', () => {
  const { Campaign } = load();
  const st = memory({
    money: 100, upgrades: ['U-data-1'], quiz: { C01: true }, coach: ['a'], opened: [], updatedAt: 1000, epoch: 0,
    contracts: { C01: { easy: { stars: 1, best: 30 }, medium: { stars: 2, best: 5 } } }
  });
  Campaign.init(st);
  let saves = 0;
  Campaign.onSave = () => saves++;
  const remote = {
    money: 250, upgrades: [], quiz: { C02: true }, coach: ['a', 'b'], opened: ['C04'], cheated: false, updatedAt: 2000, epoch: 0,
    contracts: { C01: { easy: { stars: 3, best: 20 }, medium: { stars: 1, best: null } }, C02: { hard: { stars: 2, best: 60 } } }
  };
  assert.equal(Campaign.merge(remote), true);
  const d = Campaign.data;
  assert.deepEqual({ ...d.contracts.C01.easy }, { stars: 3, best: 30 });
  assert.deepEqual({ ...d.contracts.C01.medium }, { stars: 2, best: 5 });
  assert.deepEqual({ ...d.contracts.C02.hard }, { stars: 2, best: 60 });
  assert.deepEqual(Object.keys(d.quiz).sort(), ['C01', 'C02']);
  assert.deepEqual(Array.from(d.coach), ['a', 'b']);
  assert.deepEqual(Array.from(d.opened), ['C04']);
  assert.equal(d.money, 250, 'the balance comes with the later copy');
  assert.deepEqual(Array.from(d.upgrades), [], '…and so do the upgrades it paid for');
  assert.equal(d.updatedAt, 2000);
  assert.equal(st.box.value.money, 250, 'written to storage');
  assert.equal(saves, 0, 'a merge is not a change to send back on its own');
  assert.equal(Campaign.merge(remote), false, 'merging the same copy again changes nothing');

  // an older copy brings its stars but not its balance
  assert.equal(Campaign.merge({ money: 1, upgrades: ['U-data-1'], updatedAt: 10, contracts: { C03: { easy: { stars: 1, best: 2 } } } }), true);
  assert.equal(Campaign.money, 250);
  assert.equal(Campaign.record('C03', 'easy').stars, 1);

  // New campaign elsewhere (a later epoch) erases this one; an older epoch is ignored
  assert.equal(Campaign.merge({ money: 7, epoch: 5000, updatedAt: 5000 }), true);
  assert.equal(Campaign.money, 7);
  assert.equal(Campaign.played('C01'), false);
  assert.equal(Campaign.merge({ money: 999, epoch: 0, updatedAt: 9000, contracts: { C01: { easy: { stars: 3, best: 1 } } } }), false);

  // a first campaign gets epoch 0 (a fresh device never erases the cloud's); erasing one starts a new epoch
  const fresh = load().Campaign;
  fresh.init(memory());
  fresh.reset();
  assert.equal(fresh.data.epoch, 0);
  fresh.reset();
  assert.ok(fresh.data.epoch > 0);
  assert.ok(fresh.data.updatedAt > 0);
});

test('the Lab: opens after C01, buys with money and prerequisites, keeps upgrades in the save', () => {
  const L = load();
  const store = memory();
  L.Campaign.init(store);
  assert.equal(L.Campaign.labOpen(), false);
  const events = [];
  L.GameEvents.on('purchase', (e) => events.push(e.upgrade));
  L.Campaign.data.contracts.C01 = { medium: { stars: 1, best: 10 } };
  assert.equal(L.Campaign.labOpen(), true);
  L.Campaign.data.money = 1000;
  assert.equal(L.Campaign.upgradeState('U-data-2'), 'locked', 'needs More data I');
  assert.equal(L.Campaign.buy('U-data-2'), false);
  assert.equal(L.Campaign.buy('U-data-1'), true);
  assert.equal(L.Campaign.money, 1000 - L.UPGRADE_PRICES['U-data-1']);
  assert.equal(L.Campaign.upgradeState('U-data-1'), 'bought');
  assert.equal(L.Campaign.buy('U-data-1'), false, 'once');
  assert.equal(L.Campaign.upgradeState('U-data-3'), 'locked');
  assert.equal(L.Campaign.upgradeState('U-review-1'), 'poor', '$700 left, the desk costs $800');
  assert.deepEqual(events, ['U-data-1']);
  // the save keeps it; unknown ids are dropped on load
  const saved = JSON.parse(JSON.stringify(store.box.value));
  saved.upgrades.push('U-nonsense');
  L.Campaign.init(memory(saved));
  assert.deepEqual(L.Campaign.upgrades(), ['U-data-1']);
  // the cheat U: everything, and a test save
  L.Campaign.buyAll();
  assert.equal(L.Campaign.upgrades().length, L.UPGRADES.length);
  assert.equal(L.Campaign.cheated, true);
});

test('upgrades act on the run: the family bonus on d\', calibration, the monitor, the desk', () => {
  const L = load();
  const { Model, Contract, CONTRACTS } = L;
  assert.equal(Model.bonusOf(['U-data-1', 'U-data-2', 'U-feat-text'], 'text'), 0.9);
  assert.equal(Model.bonusOf(['U-data-1', 'U-feat-text'], 'sensor'), 0.25);
  assert.equal(Model.deskLevelOf(['U-review-1', 'U-review-2']), 2);
  const base = Contract.start(CONTRACTS.C02, { difficulty: 'medium', seed: 4 });
  assert.equal(base.key, 's');
  assert.equal(base.monitor, null);
  assert.equal(base.deskLevel, 0);
  const all = Contract.start(CONTRACTS.C02, { difficulty: 'medium', seed: 4, upgrades: L.UPGRADES.map((u) => u.id) });
  assert.ok(Math.abs(all.model.dPrime - (base.model.dPrime + 0.75 + 0.4)) < 1e-9);
  assert.ok(all.curves.auc > base.curves.auc + 0.03, 'More data separates the humps: AUC up');
  assert.equal(all.key, 'p');
  assert.ok(all.monitor);
  assert.equal(all.deskLevel, 3);
  assert.equal(all.ghostT, Math.ceil(Contract.ghostPStar(CONTRACTS.C02.prices) * 100 - 1e-9) / 100, 'Medium shows p* with Calibration');
  // the theoretical AUC moves by Φ(d'/√2): More data I on C02 (d' 2.2) is +0.02
  assert.ok(Math.abs(Model.theoreticalAuc(2.45) - Model.theoreticalAuc(2.2) - 0.022) < 0.005);
});

test('a ★★ target per level; Act 2 contracts are complete', () => {
  const { CONTRACTS, Contract } = load();
  assert.equal(Contract.targetOf(CONTRACTS.C02, 'hard'), CONTRACTS.C02.target);
  assert.equal(Contract.targetOf(CONTRACTS.C09, 'hard'), CONTRACTS.C09.target.hard);
  for (const id of ['C06', 'C07', 'C08', 'C09']) assert.ok(!CONTRACTS[id].soon, id);
  assert.equal(Contract.goalTarget(CONTRACTS.C06.goal, 'hard'), CONTRACTS.C06.goal.min, 'the KPI is fixed');
});

// ---------- Act 3 (I06) ----------

test('C12: three phases one after another, each with its own scenario, prices and goal; a gap between them', () => {
  const L = load();
  const def = L.CONTRACTS.C12;
  const items = L.Contract.streamOf(def, 'medium', 11);
  assert.equal(items.length, def.phases.reduce((a, ph) => a + ph.items, 0));
  items.forEach((it, k) => assert.equal(it.i, k));
  let start = 0;
  def.phases.forEach((ph, p) => {
    const mine = items.filter((it) => it.phase === p);
    assert.equal(mine.length, ph.items);
    assert.equal(mine[0].i, start);
    assert.equal(L.Contract.isFraud(ph.prices), mine.every((it) => it.amount !== undefined));
    if (p) {   // the belt is empty when a phase begins: its first item arrives after the last one of the phase before has passed the gate
      const prev = items[start - 1];
      assert.ok(mine[0].at >= prev.at + L.BELT_TRAVEL_S + L.PHASE_GAP_S - 1e-9);
    }
    start += ph.items;
  });
  // the prices of each phase, and the price changes within it
  const at = (i) => L.Incidents.pricesAt(def, i, def.incidents);
  assert.equal(at(0), def.phases[0].prices);
  assert.equal(at(60).FP, -20);
  assert.equal(at(120), def.phases[1].prices);
  assert.equal(at(180).FN, -60);
  assert.equal(at(240), def.phases[2].prices);
  assert.equal(L.Contract.values(at(300), { amount: 100 }).FP, -2.5);
  assert.equal(L.Contract.values(at(299), { amount: 100 }).FP, L.FRAUD_FP);
});

test('C12 live: the phase switches with its first item (scenario, model, goal, a fresh pile); per-phase results and stars', () => {
  const L = load();
  const def = L.CONTRACTS.C12;
  const started = [];
  L.GameEvents.on('phaseStarted', (e) => started.push(e.phase));
  const run = L.Contract.start(def, { difficulty: 'medium', seed: 21, upgrades: ['U-calib'] });
  const ts = [0.8, 0.3, 0.85];
  let g = 0, pileAtSwitch = null;
  while (!L.Contract.update() && g++ < 200000) {
    const before = run.phase;
    L.State.threshold = ts[run.phase];
    L.Stream.update(0.05);
    L.Incidents.update(0.05);
    if (run.phase !== before && pileAtSwitch === null) pileAtSwitch = L.State.pile.length;
  }
  assert.deepEqual(started, [1, 2]);
  assert.equal(run.scenario.id, 'fraud');
  assert.ok(pileAtSwitch <= 1);
  assert.equal(run.goal, null);
  // each phase's items are calibrated with that phase's own Platt fit
  for (const it of run.items) assert.equal(it.p, L.Model.calibrate(it.s, run.phaseData[it.phase].platt));
  const r = L.Contract.results(run);
  assert.equal(r.phases.length, 3);
  assert.equal(r.goal, null);
  assert.equal(r.goalMet, r.phases.every((q) => q.goalMet));
  assert.ok(Math.abs(r.phases.reduce((a, q) => a + q.money, 0) - r.money) < 0.02);
  assert.equal(r.best.feasible, r.phases.every((q) => q.best.feasible));
  if (r.best.feasible) assert.ok(Math.abs(r.best.money - r.phases.reduce((a, q) => a + q.best.money, 0)) < 0.02);
  assert.equal(r.profit, null);
  assert.equal(r.stars, L.Contract.stars(r, L.Contract.targetOf(def, 'medium'), r.best));
  // headless: the per-phase hindsight agrees with the results' phases
  const h = L.Contract.hindsightPhases(run.items, def, 'medium', 'p');
  assert.deepEqual(Array.from(h.t), Array.from(r.phases.map((q) => q.best.t)));
});

test('Act 3 data: C10 lends a desk and has the fraud ring; C11 is top-k with a mean R@k goal; the end titles', () => {
  const L = load();
  const { CONTRACTS, END_TITLES } = L;
  assert.ok(CONTRACT_ORDER_ALL(L).every((id) => !CONTRACTS[id].soon));
  assert.equal(CONTRACTS.C10.lend.review, 1);
  assert.equal(CONTRACTS.C10.incidents[0].kind, 'adversary');
  assert.equal(CONTRACTS.C11.topk, true);
  assert.equal(CONTRACTS.C11.goal.metric, 'recallAtK');
  assert.equal(CONTRACTS.C12.phases.length, 3);
  assert.deepEqual(Array.from(END_TITLES.map((t) => t.id)), ['done', 'allStars', 'hard']);
  // a won C12 is the end of the campaign: no next contract
  const mem = memory();
  L.Campaign.init(mem);
  L.Campaign.open('C12');
  assert.equal(L.Campaign.unlocked('C12'), true);
  assert.equal(L.Campaign.nextOpen('C12'), null);
});
function CONTRACT_ORDER_ALL(L) { return Array.from(L.CONTRACT_ORDER); }

test('the attract demo: Abstract, the pile pre-filled, a slow sweep of the threshold between its two ends', () => {
  const L = load();
  const run = L.Demo.start(3);
  assert.equal(run.kind, 'demo');
  assert.equal(run.scenario.id, 'abstract');
  assert.equal(L.State.pile.length, L.DEMO_PREFILL);
  assert.equal(run.window, L.PILE_WINDOW);
  const seen = new Set();
  for (let s = 0; s < 20 * 30; s++) { L.Demo.update(1 / 30); seen.add(L.State.threshold); }
  assert.ok(Math.min(...seen) <= L.DEMO_T_LOW + 0.01 && Math.max(...seen) >= L.DEMO_T_HIGH - 0.01);
  assert.equal(L.Demo.thresholdAt(0), L.Demo.thresholdAt(L.DEMO_SWEEP_S));
  assert.equal(L.Demo.thresholdAt(L.DEMO_SWEEP_S / 2), L.DEMO_T_HIGH);
  assert.ok(L.State.pile.length > L.DEMO_PREFILL || L.State.pile.length === L.PILE_WINDOW);
});
