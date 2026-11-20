'use strict';

// ============================================================
// AI Precision Recall Lab — a contract's rules (spec 01 §3.3, §4; 02 §5; 03 §2): prices and money per outcome
// (incl. the fraud prices that depend on the amount, and price changes during a contract), goal checks with the
// difficulty's shift, the outbreak allowance and bankruptcy, the cost-optimal threshold p* (the ghost line), a
// headless run of a contract at a given threshold (and review band), the hindsight-best fixed threshold of the
// results screen — over band pairs when the contract has a review desk — and the stars. The live run:
// Contract.start makes State.run from a contract of data/contracts.js with the Lab's upgrades (the d' bonus,
// calibration, the drift monitor, the review desk; C08 and C09 lend theirs); the gate prices each item and
// checks the rules (the goal chip, the drift monitor, the outbreak, bankruptcy, the end; emits goalChanged /
// outbreak / contractEnded); Contract.results sums it up. A top-k contract (C11, def.topk) runs on queries
// (sim/topk.js): the knob is State.k, the goal is the mean Recall@k, the hindsight-best a search over k. A
// contract made of phases (C12, def.phases) concatenates one stream per phase (each with its own scenario,
// model, validation set, prices and goal), with PHASE_GAP_S of empty belt between them; the run switches to the
// next phase when its first item arrives (phaseStarted), the pile starts afresh, the goal chip shows the
// phase's goal, and the results have one hindsight-best threshold per phase. The adversary (C10) is set up
// here too: its crafted items get their scores as they arrive (sim/incidents.js). Terms are plain objects:
// { scenario, prevalence, dPrime, items, rate, prices: { TP, FP, FN, TN } | 'fraud' | { fraud: true, FP? },
//   goal: { metric, min, beta?, fixed? } | null, outbreak: n | null, fee, target, incidents?, lend?, topk?, phases? }.
// No drawing, no DOM, no sound. Used by game.js, the results, campaign.js, tools/balance-check.js, the tests.
// ============================================================

const Contract = (() => {
  // the median genuine payment: the amount the single ghost line of a fraud contract is computed for (02 §5.1)
  const MEDIAN_AMOUNT = Math.round(Math.exp(AMOUNT_LOG_MEAN));

  // The money value of each outcome for this item, signed (a fine is negative). Fraud (03 §2): a blocked fraud
  // earns 0 (the loss is prevented), a blocked customer costs FRAUD_FP, a missed fraud costs its amount,
  // a passed genuine payment earns the commission.
  // A price change can move one of the fraud prices: { fraud: true, FP: −2.5 } (C12).
  function values(prices, item) {
    if (isFraud(prices)) {
      const a = item && item.amount !== undefined ? item.amount : MEDIAN_AMOUNT;
      return { TP: FRAUD_TP, FP: prices.FP !== undefined ? prices.FP : FRAUD_FP, FN: -a, TN: FRAUD_COMMISSION * a };
    }
    return prices;
  }
  // the fraud prices (they depend on the item's amount), as 'fraud' or { fraud: true, … }
  function isFraud(prices) { return prices === 'fraud' || !!(prices && prices.fraud); }

  // the $ of one decided item, in whole cents so that sums do not drift
  function money(item, outcome, prices) { return Math.round(values(prices, item)[outcome] * 100) / 100; }

  // The $ of a decided item in a contract: people's review costs REVIEW_FEE instead of the outcome's price
  // (01 §4); otherwise the price list in force for this item (a price change, 02 §6.4).
  function itemMoney(terms, item, outcome, reviewed, incidents) {
    if (reviewed) return -REVIEW_FEE;
    return money(item, outcome, Incidents.pricesAt(terms, item.i === undefined ? 0 : item.i, incidents));
  }

  // The cost-optimal threshold on the posterior p (02 §5.1). Flag when the expected value of flagging beats
  // passing: p·V_TP + (1 − p)·V_FP ≥ p·V_FN + (1 − p)·V_TN  ⇔  p ≥ p* = (V_TN − V_FP) / ((V_TP − V_FN) + (V_TN − V_FP)).
  // The numerator is what a false alarm costs compared with a right pass, the denominator adds what a miss costs
  // compared with a catch. null when the prices make no trade-off (one action is never worse).
  function pStar(v) {
    const gainCatch = v.TP - v.FN, gainPass = v.TN - v.FP;
    if (gainCatch + gainPass <= 0) return null;
    return clamp(gainPass / (gainCatch + gainPass), 0, 1);
  }
  // the ghost line's p* for a price list (fraud: for the median amount; with amounts a single line is a compromise)
  function ghostPStar(prices) { return pStar(values(prices, { amount: MEDIAN_AMOUNT })); }

  // The goal's target on this difficulty (01 §10): Easy −0.05, Hard +0.02 — unless the goal is fixed (the
  // client's own KPI, C06: accuracy ≥ 0.98 would become 1.00 on Hard).
  function goalTarget(goal, difficulty) {
    if (!goal) return null;
    return goal.fixed ? goal.min : clamp(goal.min + DIFFICULTIES[difficulty].goalShift, 0, 1);
  }
  // the goal metric's value on these counts (null while it is not defined)
  function goalValue(c, goal) { return goal ? Metrics.value(c, goal.metric, goal.beta || 1) : null; }
  // met: no goal, or a defined value at or above the target (an undefined value is not met)
  function goalMet(c, goal, difficulty) {
    if (!goal) return true;
    const v = goalValue(c, goal);
    return v !== null && v >= goalTarget(goal, difficulty) - 1e-12;
  }

  // the outbreak allowance on this difficulty (Easy +2, Hard −1, at least 1); null when the contract has none
  function outbreakAllowance(terms, difficulty) {
    return terms.outbreak ? Math.max(1, terms.outbreak + DIFFICULTIES[difficulty].outbreakExtra) : null;
  }

  // A contract played headless over a pre-generated stream. threshold: a number, or a function (item index →
  // t) for a threshold that moved. opts (a review desk, 02 §5.2): { low (the band's lower edge, a number),
  // level (the desk level), travelS (the ride: gate time = arrival + travelS) } — the desk's queue is simulated
  // on the gate times with sim/review.js. Stops early on a failure (01 §3.3): the outbreak starts when the FN
  // count reaches the allowance; bankruptcy when the contract's money falls below −fee.
  // opts.aimAt (the adversary, 02 §6.3, ADR-0006): the crafted items are scored as if the ring had aimed at
  // this threshold (it must be a number; opts.platt for the calibrated axis).
  // Returns { counts, money, decided, reviewed, failed: null | 'outbreak' | 'bankrupt', completed, goalValue, goalMet }.
  function play(items, terms, threshold, difficulty, key = 's', opts = null) {
    const tAt = typeof threshold === 'function' ? threshold : () => threshold;
    const allowance = outbreakAllowance(terms, difficulty);
    const limit = terms.fee !== undefined ? -terms.fee : -Infinity;
    const desk = opts && opts.level && opts.low !== undefined && opts.low !== null ? Review.make(opts.level, opts.low) : null;
    const aim = !!(opts && opts.aimAt);
    const c = Metrics.emptyCounts();
    let cash = 0, decided = 0, reviewed = 0, failed = null;
    for (const it of items) {
      const t = tAt(it.i);
      const v = aim && it.crafted ? Incidents.craftedValue(it, t, key, opts.platt) : it[key];
      let out, rev = false;
      if (desk && Review.inBand(v, Review.lowOf(desk, t), t) && Review.admit(desk, it.at + opts.travelS)) {
        out = it.y ? 'TP' : 'TN';
        rev = true;
        reviewed++;
      } else out = Stream.outcome(atOrAbove(v, t), it.y);
      c[out]++;
      cash = Math.round((cash + itemMoney(terms, it, out, rev)) * 100) / 100;
      decided++;
      if (allowance !== null && c.FN >= allowance) { failed = 'outbreak'; break; }
      if (cash < limit) { failed = 'bankrupt'; break; }
    }
    return {
      counts: c, money: cash, decided, reviewed, failed, completed: failed === null,
      goalValue: goalValue(c, terms.goal), goalMet: goalMet(c, terms.goal, difficulty)
    };
  }

  // The hindsight-best fixed threshold (02 §5.2): over the contract's actual items, every t in 0.00 … 1.00 held
  // fixed the whole time; only thresholds that complete the contract and meet the goal count; the one with the
  // most money wins. Neighbouring thresholds with no item between them make the same decisions and tie: the
  // middle of the tied run is returned (it has the most room on both sides). With a review desk (opts as in
  // play) the search is over the pairs low ≤ t (low = t: no band); among pairs that tie, the narrowest band.
  // With an adversary (crafted items in the stream) every candidate is played as if the ring had aimed at it
  // (ADR-0006): a fixed, known threshold would have been gamed too (opts.platt for the calibrated axis).
  // Returns { t, low, money, result, feasible, runs (by t, no band) } — t and money null when no fixed
  // threshold could make it.
  function hindsightBest(items, terms, difficulty, key = 's', opts = null) {
    const aim = items.some((it) => it.crafted);
    const aimOpts = aim ? { aimAt: true, platt: opts && opts.platt } : null;
    const runs = [];
    for (let k = 0; k <= 100; k++) runs.push(play(items, terms, k / 100, difficulty, key, aimOpts));
    const ok = (r) => r.completed && r.goalMet;
    let best = -1;
    for (let k = 0; k <= 100; k++) if (ok(runs[k]) && (best < 0 || runs[k].money > runs[best].money)) best = k;
    let out;
    if (best < 0) out = { t: null, low: null, money: null, result: null, feasible: false, runs };
    else {
      let end = best;
      while (end + 1 <= 100 && ok(runs[end + 1]) && runs[end + 1].money === runs[best].money) end++;
      const k = Math.floor((best + end) / 2);
      out = { t: k / 100, low: null, money: runs[k].money, result: runs[k], feasible: true, runs };
    }
    if (!opts || !opts.level) return out;
    const pre = prepare(items, terms, key, opts.travelS, aim ? (opts.platt || null) : undefined);
    let pick = null;
    for (let k = 1; k <= 100; k++) {
      for (let j = k - 1; j >= 0; j--) {
        const r = playBand(pre, terms, k, j, difficulty, opts.level);
        if (r && (!out.feasible || r.cents / 100 > out.money) && (!pick || r.cents > pick.cents)) pick = { k, j, cents: r.cents };
      }
    }
    if (pick && (!out.feasible || pick.cents / 100 > out.money)) {
      const r = play(items, terms, pick.k / 100, difficulty, key, Object.assign({}, opts, { low: pick.j / 100 }, aimOpts || {}));
      out = { t: pick.k / 100, low: pick.j / 100, money: r.money, result: r, feasible: true, runs };
    }
    return out;
  }

  // The band-pair search's fast path: each item once as integers (its value in hundredths, its class, its
  // gate time, the cents of each outcome at the prices in force), then a plain loop per pair with the same
  // rules as play() (the desk of sim/review.js, the outbreak, bankruptcy, the goal). play() makes the winner's
  // full result, so the two must agree (a test checks it).
  // With the adversary (platt given, null on the raw axis) a crafted item's value depends on the candidate
  // threshold: its margin is kept (u, −1 for the others) with the aim table of the axis.
  function prepare(items, terms, key, travelS, platt) {
    const n = items.length;
    const pre = { n, h: new Int16Array(n), y: new Uint8Array(n), gate: new Float64Array(n), cents: new Int32Array(n * 4) };
    if (platt !== undefined) {
      pre.u = new Float64Array(n).fill(-1);
      const tab = Incidents.aimTable(key === 'p' ? platt : null);
      pre.tab = key === 'p' ? tab.p : tab.s;
    }
    items.forEach((it, i) => {
      if (pre.u && it.crafted) pre.u[i] = it.craftU;
      pre.h[i] = hundredths(it[key]);
      pre.y[i] = it.y ? 1 : 0;
      pre.gate[i] = it.at + travelS;
      ['TP', 'FP', 'FN', 'TN'].forEach((o, q) => { pre.cents[i * 4 + q] = Math.round(itemMoney(terms, it, o, false) * 100); });
    });
    return pre;
  }
  // one pair: threshold k / 100, band from j / 100; null when the run fails or misses the goal, else { cents }
  function playBand(pre, terms, k, j, difficulty, level) {
    const allowance = outbreakAllowance(terms, difficulty);
    const limit = terms.fee !== undefined ? -terms.fee * 100 : -Infinity;
    const rate = REVIEW_RATE[level - 1], fee = Math.round(REVIEW_FEE * 100);
    let busy = 0, progress = 0, last = 0, cash = 0, TP = 0, FP = 0, FN = 0, TN = 0;
    for (let i = 0; i < pre.n; i++) {
      const h = pre.u && pre.u[i] >= 0 ? pre.tab[Incidents.aimH(k / 100, pre.u[i])] : pre.h[i], y = pre.y[i];
      let q;
      if (h >= j && h < k) {
        // the desk at this item's gate time (Review.admit)
        const clock = pre.gate[i];
        const dt = Math.max(0, clock - last);
        last = Math.max(last, clock);
        if (busy) {
          progress += dt * rate;
          while (progress >= 1 && busy > 0) { busy--; progress -= 1; }
          if (!busy) progress = 0;
        } else progress = 0;
        if (busy < REVIEW_QUEUE) {
          busy++;
          if (y) TP++; else TN++;
          cash -= fee;
          if (cash < limit) return null;
          continue;
        }
      }
      q = h >= k ? (y ? 0 : 1) : (y ? 2 : 3);
      if (q === 0) TP++; else if (q === 1) FP++; else if (q === 2) FN++; else TN++;
      cash += pre.cents[i * 4 + q];
      if (allowance !== null && FN >= allowance) return null;
      if (cash < limit) return null;
    }
    return goalMet({ TP, FP, FN, TN }, terms.goal, difficulty) ? { cents: cash } : null;
  }

  // ---------- headless: a contract of phases (C12; the balance check, the tests) ----------
  // played with one threshold per phase (thresholds: an array, or one number for all): each phase by its own
  // terms; completed and the goal met when every phase is. Returns { money, completed, goalMet, phases }.
  function playPhases(items, def, thresholds, difficulty, key = 's', opts = null) {
    const phases = def.phases.map((ph, p) => {
      const t = Array.isArray(thresholds) ? thresholds[p] : thresholds;
      return play(items.filter((it) => it.phase === p), phaseTerms(def, p), t, difficulty, key, opts);
    });
    return {
      phases, money: Math.round(phases.reduce((a, r) => a + r.money, 0) * 100) / 100,
      completed: phases.every((r) => r.completed), goalMet: phases.every((r) => r.goalMet)
    };
  }
  // the hindsight-best of a contract of phases: one fixed threshold (and band) per phase (03 §2); feasible when
  // every phase has one. Returns { t (per phase), low (per phase), money, feasible, result, phases }.
  function hindsightPhases(items, def, difficulty, key = 's', opts = null) {
    const phases = def.phases.map((ph, p) => hindsightBest(items.filter((it) => it.phase === p), phaseTerms(def, p), difficulty, key, opts));
    const feasible = phases.every((b) => b.feasible);
    const money = feasible ? Math.round(phases.reduce((a, b) => a + b.money, 0) * 100) / 100 : null;
    return {
      t: phases.map((b) => b.t), low: phases.map((b) => b.low), money, feasible, phases,
      result: feasible ? { money, completed: true, goalMet: true } : null
    };
  }

  // the ★★ profit target on a difficulty: one number for every level, or { easy, medium, hard }
  function targetOf(def, difficulty) {
    return typeof def.target === 'number' ? def.target : def.target[difficulty];
  }

  // ---------- stars (01 §4) ----------
  // ★ completed and the goal met (no goal: completed); ★★ also profit ≥ the contract's target; ★★★ also profit
  // ≥ STAR3_SHARE of the hindsight-best profit (written so that it also works for a best below zero).
  // Out of reach when no fixed threshold could make the contract (best.feasible false).
  function stars(r, target, best) {
    if (!r.completed || !r.goalMet) return 0;
    if (r.money < target - 1e-9) return 1;
    if (!best || !best.feasible) return 2;
    return r.money >= best.money - (1 - STAR3_SHARE) * Math.abs(best.money) - 1e-9 ? 3 : 2;
  }

  // ---------- the live run of a contract (01 §3) ----------

  // The model of a contract on a difficulty: the scenario's temperament with the contract's base rate and its
  // d' + the Lab's bonus + the difficulty's offset (02 §2.1).
  // A top-k contract's model is the ranker's (sim/topk.js); a phase passes its own terms as def.
  function modelOf(def, difficulty, bonus = 0) {
    const d = Model.effectiveDPrime(def.dPrime, bonus, DIFFICULTIES[difficulty].dPrime);
    if (def.topk) return Topk.modelOf(d);
    return Model.of(SCENARIOS[def.scenario], { prevalence: def.prevalence, dPrime: d });
  }

  // ---------- contracts made of phases (C12) ----------
  // the terms of phase p as a contract of its own: its scenario, base rate, d', items, prices and goal, the
  // contract's fee (the bankruptcy limit) and its incidents (with the contract's item indexes)
  function phaseTerms(def, p) {
    const ph = def.phases[p];
    let start = 0;
    for (let q = 0; q < p; q++) start += def.phases[q].items;
    const end = start + ph.items;
    return Object.assign({}, ph, {
      id: def.id, phase: p, start, end, fee: def.fee, outbreak: ph.outbreak || null, goal: ph.goal || null,
      incidents: (def.incidents || []).filter((inc) => inc.at >= start && inc.at < end), rate: def.rate
    });
  }
  // the d' bonus of a contract: one number, or one per phase (bonusOf with the owned upgrades)
  function bonusesOf(def, owned) {
    if (!def.phases) return Model.bonusOf(owned, SCENARIOS[def.scenario].family);
    return def.phases.map((ph) => Model.bonusOf(owned, SCENARIOS[ph.scenario].family));
  }
  const bonusAt = (bonus, p) => (Array.isArray(bonus) ? bonus[p] || 0 : bonus || 0);
  // the seed of a phase's own streams: the phases do not share their draws
  const phaseSeed = (seed, p) => (seed ^ Rng.hashString('phase.' + p)) >>> 0;

  // The contract's whole stream, made in advance from the attempt seed (02 §2.2) with the schedule of its
  // incidents (the base rate, the drift, the rush hour per item); the same function the live run, the balance
  // check and the tests use, so they all see the same items for a seed. `incidents` overrides the contract's
  // list (the cheat I moves one).
  // A top-k contract's stream is its queries (def.items queries, def.rate queries per second); a contract of
  // phases is the phases' streams one after another (each from a seed of its own, with the phase's scenario,
  // model and incidents), the next phase arriving PHASE_GAP_S after the last item of the one before has passed
  // the gate; every item knows its phase. The adversary's crafted items are marked here (02 §6.3).
  // bonus: a number, or one per phase.
  function streamOf(def, difficulty, seed, bonus = 0, incidents) {
    const diff = DIFFICULTIES[difficulty];
    const list = incidents || def.incidents || [];
    if (def.topk) {
      return Topk.generate({ seed, queries: def.items, rate: def.rate * diff.speed, model: modelOf(def, difficulty, bonusAt(bonus, 0)) });
    }
    if (def.phases) {
      const out = [];
      let offset = 0;
      const travelS = BELT_TRAVEL_S / diff.speed;
      def.phases.forEach((ph, p) => {
        const terms = phaseTerms(def, p);
        const local = list.filter((inc) => inc.at >= terms.start && inc.at < terms.end)
          .map((inc) => Object.assign({}, inc, { at: inc.at - terms.start }));
        const items = Stream.generate({
          seed: phaseSeed(seed, p), count: ph.items, rate: def.rate * diff.speed, model: modelOf(terms, difficulty, bonusAt(bonus, p)),
          amounts: isFraud(ph.prices), schedule: local.length ? Incidents.schedule(local, ph.prevalence) : null
        });
        for (const it of items) { it.i += terms.start; it.at += offset; it.phase = p; out.push(it); }
        offset = out[out.length - 1].at + travelS + PHASE_GAP_S;
      });
      return out;
    }
    const items = Stream.generate({
      seed, count: def.items, rate: def.rate * diff.speed, model: modelOf(def, difficulty, bonus),
      amounts: isFraud(def.prices),
      schedule: list.length ? Incidents.schedule(list, def.prevalence) : null
    });
    return Incidents.markCrafted(items, list, seed);
  }

  // the review desk level of a contract: bought or lent by the client (C08), moved by the difficulty
  function deskLevel(def, difficulty, owned = 0) {
    return Review.levelFor(owned, def.lend && def.lend.review, DIFFICULTIES[difficulty].deskShift);
  }

  // The validation set of a run (02 §2.2) with amounts for value-weighted scenarios, the Platt fit when the
  // run is calibrated (02 §2.3), the model curves and the profit curve at the prices in force. Also Retrain's
  // refit (sim/incidents.js), with another seed and the base rate of that moment.
  // A top-k run's validation set is made of queries, its curves are over k (sim/topk.js), and it has no profit
  // curve or ghost line during play. A run of phases validates the phase it is in (each phase's set is made at
  // the start, validationOf).
  function validate(run, seed) {
    if (run.topk) {
      run.val = Topk.validation(seed, run.model);
      run.platt = null;
      run.curves = Topk.curves(run.val);
      run.profit = null; run.bestT = null; run.ghostT = null;
      return;
    }
    Object.assign(run, validationOf(run.model, seed, run.phaseDef ? run.phaseDef.prices : run.def.prices, run.calibrated));
    reprice(run);
  }
  // the validation set of a model ({ val, platt, curves }): with amounts for the fraud prices, Platt fitted when calibrated
  function validationOf(model, seed, prices, calibrated) {
    const val = Stream.validation(seed, model);
    if (isFraud(prices)) {
      const rng = Rng.stream(seed, 'validation.amounts');
      for (const it of val) it.amount = Stream.amount(rng, it.y);
    }
    let platt = null;
    if (calibrated) {
      platt = Model.fitPlatt(val.map((it) => it.s), val.map((it) => it.y));
      Stream.calibrate(val, platt);
    }
    return { val, platt, curves: Metrics.modelCurves(val) };
  }

  // the profit curve on the validation set at the prices in force, and its best threshold (Easy, 01 §10)
  function reprice(run) {
    run.profit = Metrics.profitCurve(run.val, (it, o) => money(it, o, run.prices), run.key);
    let best = 0;
    for (let k = 1; k < run.profit.length; k++) if (run.profit[k].per100 > run.profit[best].per100) best = k;
    run.bestT = run.profit[best].t;
    ghost(run);
  }

  // The ghost line (01 §10, 02 §5.1): the cost-optimal threshold for the prices in force. On Easy from the true
  // posterior of the model as it is now (the base rate and the drift of the items arriving), mapped to the axis
  // on screen; on Medium only with Calibration, at p* on the calibrated axis — which goes stale with the base
  // rate (the badges keep the old mapping); never on Hard.
  function ghost(run) {
    const diff = DIFFICULTIES[run.difficulty];
    const p = ghostPStar(run.prices);
    run.ghostT = null;
    if (p === null) return;
    if (diff.ghost === 'always') {
      const i = Math.min(Incidents.nextIndex(run), run.items.length - 1);
      const now = Incidents.schedule(run.incidents, run.basePrevalence, run.noDriftFrom)(i);
      const raw = Model.scoreForPosterior(p, Object.assign({}, run.model, { prevalence: now.prevalence, drift: now.drift }));
      run.ghostT = run.key === 'p' && raw > 0 && raw < 1 ? Model.calibrate(raw, run.platt) : raw;
    } else if (diff.ghost === 'calibration' && run.key === 'p') run.ghostT = Math.ceil(p * 100 - 1e-9) / 100;
  }

  // Starts a contract as State.run. opts: { difficulty, seed, upgrades (the owned upgrade ids) }. The stream is
  // pre-generated; the belt takes the items in order (source). The Lab's upgrades: the d' bonus of the
  // scenario's family, Calibration (the badges and the threshold on p, fitted on the validation set), the drift
  // monitor (bought, or lent by the contract), the review desk (bought or lent, moved by the difficulty).
  // A top-k contract has no calibration, desk or monitor (the ranking is all that matters; there is no band
  // under a per-query line). A contract of phases starts in phase 0 with every phase's model and validation
  // set made at once (run.phaseData), the items of each phase calibrated with that phase's fit.
  function start(def, opts) {
    const difficulty = opts.difficulty, diff = DIFFICULTIES[difficulty];
    const owned = opts.upgrades || [];
    const topk = !!def.topk;
    const bonus = bonusesOf(def, owned);
    const first = def.phases ? phaseTerms(def, 0) : def;
    const scenario = SCENARIOS[first.scenario];
    const model = modelOf(first, difficulty, bonusAt(bonus, 0));
    const items = streamOf(def, difficulty, opts.seed, bonus);
    const calibrated = !topk && Model.hasKind(owned, 'calibration');
    const monitor = !topk && (Model.hasKind(owned, 'monitor') || !!(def.lend && def.lend.monitor));
    const level = topk ? 0 : deskLevel(def, difficulty, Model.deskLevelOf(owned));
    const run = {
      kind: 'contract', def, difficulty, seed: opts.seed, scenario, model, bonus: bonusAt(bonus, 0), items, calibrated,
      key: calibrated ? 'p' : 's', platt: null, clock: 0, travelS: BELT_TRAVEL_S / diff.speed,
      window: topk ? TOPK_WINDOW * TOPK_DOCS : PILE_WINDOW, total: items.length,
      totals: Metrics.emptyCounts(), count: 0, frozen: false, next: null, prices: first.prices, money: 0,
      tint: diff.tint, goal: first.goal, goalTarget: goalTarget(first.goal, difficulty), basePrevalence: first.prevalence,
      allowance: outbreakAllowance(def, difficulty), limit: -def.fee, goalState: 'grace', ended: null, cheated: false,
      deskLevel: level, lent: def.lend || {}, upgrades: owned.slice(), topk,
      adversary: (def.incidents || []).some((inc) => inc.kind === 'adversary')
    };
    State.run = run;
    State.belt = [];
    State.pile = [];
    State.pileVersion++;
    State.highlight = null;
    State.threshold = 0.5;
    State.k = TOPK_K_DEFAULT;
    let at = 0;
    run.source = () => (at < items.length ? items[at++] : null);
    run.next = run.source();
    Incidents.setup(run, false);             // the incidents' state first: the ghost line reads their schedule
    if (def.phases) {
      run.phase = 0;
      run.phaseDef = first;
      run.phaseTotals = def.phases.map(() => Metrics.emptyCounts());
      run.phaseData = def.phases.map((ph, p) => {
        const terms = phaseTerms(def, p);
        const m = modelOf(terms, difficulty, bonusAt(bonus, p));
        return Object.assign({ model: m, bonus: bonusAt(bonus, p) }, validationOf(m, phaseSeed(opts.seed, p), terms.prices, calibrated));
      });
      const pd = run.phaseData[0];
      Object.assign(run, { val: pd.val, platt: pd.platt, curves: pd.curves });
      reprice(run);
      if (calibrated) for (const it of items) it.p = Model.calibrate(it.s, run.phaseData[it.phase].platt);
    } else {
      validate(run, opts.seed);
      if (calibrated) Stream.calibrate(items, run.platt);
    }
    Incidents.setup(run, monitor);           // the monitor's reference is the validation set
    if (level) Review.attach(run, level, Math.max(0, round2(State.threshold - REVIEW_BAND_DEFAULT)));
    else Review.detach(run);
    if (topk) run.decideAt = (item) => Topk.decide(item, State.k);
    run.moneyOf = (it, outcome) => itemMoney(def, it, outcome, it.reviewed, run.incidents);
    run.onArrive = (it) => {
      if (def.phases && it.phase !== run.phase) enterPhase(run, it.phase);
      Incidents.onArrive(run, it);
    };
    run.afterGate = (it) => check(run, it);
    return run;
  }

  // The next phase of a contract of phases begins with its first item (the belt is empty then): its scenario,
  // model, validation set, calibration, curves, prices and goal; the pile and the window start afresh; the
  // drift monitor (when bought) measures against the new validation set.
  function enterPhase(run, p) {
    const pd = run.phaseData[p];
    run.phase = p;
    run.phaseDef = phaseTerms(run.def, p);
    run.scenario = SCENARIOS[run.phaseDef.scenario];
    Object.assign(run, { model: pd.model, bonus: pd.bonus, val: pd.val, platt: pd.platt, curves: pd.curves });
    run.basePrevalence = run.phaseDef.prevalence;
    run.goal = run.phaseDef.goal;
    run.goalTarget = goalTarget(run.goal, run.difficulty);
    run.goalState = 'grace';
    run.prices = Incidents.pricesAt(run.def, run.phaseDef.start, run.incidents);
    reprice(run);
    State.pile = [];
    State.pileVersion++;
    if (run.monitor) Object.assign(run.monitor, { ref: Metrics.psiReference(run.val.map((it) => it.s)), window: [], psi: null, over: 0, alert: false });
    GameEvents.emit('phaseStarted', { phase: p, scenario: run.scenario.id });
  }

  // the goal chip (01 §3.2): 'grace' for the first GOAL_GRACE_ITEMS, then 'met' / 'close' (within GOAL_CLOSE) /
  // 'broken' on the cumulative value; 'none' without a goal
  // A run of phases checks the phase's goal on the phase's decisions; a top-k run the mean R@k of its queries
  // (graced for the first TOPK_GOAL_GRACE queries).
  function goalStateOf(run) {
    if (!run.goal) return 'none';
    const n = run.phaseTotals ? Metrics.sums(run.phaseTotals[run.phase]).total : run.count;
    if (run.topk ? n < TOPK_GOAL_GRACE * TOPK_DOCS : n < GOAL_GRACE_ITEMS) return 'grace';
    const v = liveGoalValue(run);
    if (v !== null && v >= run.goalTarget - 1e-12) return 'met';
    if (v !== null && v >= run.goalTarget - GOAL_CLOSE) return 'close';
    return 'broken';
  }

  // the goal's value of a live run: the mean R@k of the queries decided (top-k), the phase's decisions (phases),
  // or all the decisions made
  function liveGoalValue(run) {
    if (!run.goal) return null;
    if (run.topk) return Topk.goalValueOf(run.items.slice(0, run.count), run.goal);
    return goalValue(run.phaseTotals ? run.phaseTotals[run.phase] : run.totals, run.goal);
  }

  // the rules after every decision: the money, the drift monitor, the prices in force and the ghost line, the
  // goal chip, the outbreak, bankruptcy, the last item
  function check(run, it) {
    run.money = Math.round((run.money + (it ? it.money : 0)) * 100) / 100;
    if (it && run.phaseTotals) run.phaseTotals[it.phase][it.outcome]++;
    if (it && run.topk) it.k = State.k;
    if (it) Incidents.afterGate(run, it);
    if (!run.topk) {
      // the prices of the items to come (a price change, 02 §6.4); a run of phases changes them only within
      // its phase (the next phase's prices come with the phase)
      const i = Math.min(Incidents.nextIndex(run), run.items.length - 1);
      const prices = Incidents.pricesAt(run.def, i, run.incidents);
      const same = !run.phaseDef || run.items[i].phase === run.phase;
      if (prices !== run.prices && same) { run.prices = prices; reprice(run); }
      else ghost(run);
    }
    const g = goalStateOf(run);
    if (g !== run.goalState) { run.goalState = g; GameEvents.emit('goalChanged', { state: g }); }
    if (run.allowance !== null && run.totals.FN >= run.allowance) end(run, 'outbreak');
    else if (run.money < run.limit) end(run, 'bankrupt');
    else if (run.count >= run.total) end(run, null);
  }

  function end(run, failed) {
    if (run.ended) return;
    run.ended = { failed };
    if (failed === 'outbreak') GameEvents.emit('outbreak', {});
    GameEvents.emit('contractEnded', { failed });
  }

  // the debug cheat F (01 §14): end the contract now with the results so far
  function finishNow(run) {
    if (run.ended) return;
    run.cheated = true;
    run.finishedEarly = true;
    end(run, null);
  }

  // Called by the main loop after Stream.update: the end of the contract, once it has come (null before).
  function update() {
    const run = State.run;
    return run && run.kind === 'contract' ? run.ended : null;
  }

  // what the decisions before an incident and after it had ramped in looked like (precision moves with the
  // base rate, recall and FPR do not; drift lowers recall): { before, after } metrics, null when a side is empty
  function aroundIncident(decided, inc) {
    const ramp = inc.ramp !== undefined ? inc.ramp : INCIDENT_RAMP;
    const side = (list) => (list.length ? Object.assign(Metrics.compute(Metrics.tally(list)), { n: list.length }) : null);
    return {
      before: side(decided.filter((it) => it.i < inc.at)),
      after: side(decided.filter((it) => it.i >= inc.at + ramp))
    };
  }

  // The results of an ended run (01 §3.4): the totals of the decisions actually made, the goal, the
  // hindsight-best fixed threshold over the contract's stream (only the items decided when it was cut short
  // by the cheat) — with the desk, the best fixed band too —, the share of it the player made, the stars, the
  // threshold over time, the profit curve of the stream, the player's average threshold, how many items people
  // reviewed, the incidents (where they started, the metrics around them), the reliability diagram of a
  // calibrated run (before and after a base rate shift) and the drift monitor's alerts.
  // A run of phases: its results per phase (the decisions, the money, the goal, the hindsight-best fixed
  // threshold of the phase's own items, 03 §2 "C12's star rules"), and their sum: ★ needs every phase's goal,
  // ★★★ 90 % of the sum of the phases' best.
  function phaseResults(run, pool, decided, deskOpts) {
    return run.def.phases.map((ph, p) => {
      const terms = phaseTerms(run.def, p);
      const mine = decided.filter((it) => it.phase === p);
      const c = Metrics.tally(mine);
      const b = hindsightBest(pool.filter((it) => it.phase === p), terms, run.difficulty, run.key, deskOpts);
      const done = mine.length === ph.items;
      return {
        p, scenario: ph.scenario, items: ph.items, decided: mine.length, counts: c, start: terms.start, end: terms.end,
        money: Math.round(mine.reduce((a, it) => a + (it.money || 0), 0) * 100) / 100,
        goal: terms.goal, goalTarget: goalTarget(terms.goal, run.difficulty), goalValue: goalValue(c, terms.goal),
        goalMet: done && goalMet(c, terms.goal, run.difficulty),
        best: { t: b.t, low: b.low, money: b.money, feasible: b.feasible }
      };
    });
  }

  function results(run) {
    if (run.topk) return topkResults(run);
    const decided = run.items.filter((it) => it.outcome !== undefined);
    const failed = run.ended ? run.ended.failed : null;
    const completed = !!run.ended && failed === null;
    const pool = run.finishedEarly ? decided : run.items;
    const deskOpts = run.deskLevel ? { level: run.deskLevel, travelS: run.travelS, platt: run.platt } : (run.adversary ? { platt: run.platt } : null);
    const phases = run.def.phases ? phaseResults(run, pool, decided, deskOpts) : null;
    const best = phases
      ? { t: null, low: null, feasible: phases.every((q) => q.best.feasible),
        money: Math.round(phases.reduce((a, q) => a + (q.best.money || 0), 0) * 100) / 100 }
      : hindsightBest(pool, run.def, run.difficulty, run.key, deskOpts);
    const r = {
      id: run.def.id, difficulty: run.difficulty, seed: run.seed, failed, completed, cheated: run.cheated,
      counts: Object.assign({}, run.totals), decided: run.count, items: run.total, money: run.money,
      goal: phases ? null : run.goal, goalTarget: phases ? null : run.goalTarget, goalValue: phases ? null : goalValue(run.totals, run.goal),
      goalMet: phases ? phases.every((q) => q.goalMet) : goalMet(run.totals, run.goal, run.difficulty),
      best: { t: best.t, low: best.low, money: best.money, feasible: best.feasible },
      phases,
      thresholds: decided.map((it) => it.t),
      profit: phases ? null : run.adversary ? best.runs.map((q, k) => ({ t: k / 100, money: q.money }))
        : Metrics.profitCurve(pool, (it, o) => itemMoney(run.def, it, o, false, run.incidents), run.key)
          .map((q) => ({ t: q.t, money: Math.round(q.money * 100) / 100 })),
      crafted: run.adversary ? Incidents.craftedSummary(decided) : null,
      key: run.key, reviewed: decided.filter((it) => it.reviewed).length, deskLevel: run.deskLevel,
      incidents: (run.incidents || []).map((inc) => Object.assign({ at: inc.at, kind: inc.kind, name: inc.name, started: inc.started },
        inc.kind === 'baseRate' || inc.kind === 'drift' ? aroundIncident(decided, inc) : {})),
      monitor: run.monitor ? { alerts: run.monitor.alerts, retrained: run.retrained } : null
    };
    if (run.key === 'p') {
      const shift = (run.incidents || []).find((inc) => inc.kind === 'baseRate' && inc.started);
      const ramp = shift ? (shift.ramp !== undefined ? shift.ramp : INCIDENT_RAMP) : 0;
      r.reliability = shift ? {
        before: Metrics.reliability(decided.filter((it) => it.i < shift.at), 'p'),
        after: Metrics.reliability(decided.filter((it) => it.i >= shift.at + ramp), 'p')
      } : { before: Metrics.reliability(decided, 'p'), after: null };
    }
    r.avgT = r.thresholds.length ? round2(r.thresholds.reduce((a, b) => a + b, 0) / r.thresholds.length) : null;
    r.share = best.feasible && best.money > 0 ? r.money / best.money : null;
    r.beatBest = completed && best.feasible && r.money > best.money + 1e-9;
    r.target = targetOf(run.def, run.difficulty);
    r.stars = stars(r, r.target, r.best);
    return r;
  }

  // The results of a top-k contract (C11): the decisions per document and per query (the k of the moment of
  // each query), the mean P@k and R@k, the hindsight-best fixed k, the money at every fixed k, the stars.
  function topkResults(run) {
    const decided = run.items.filter((it) => it.outcome !== undefined);
    const failed = run.ended ? run.ended.failed : null;
    const completed = !!run.ended && failed === null;
    const pool = run.finishedEarly ? decided : run.items;
    const best = Topk.hindsightBest(pool, run.def, run.difficulty);
    const m = Topk.summary(decided);
    const ks = decided.filter((it) => it.d === 0).map((it) => it.k);
    const gv = Topk.goalValueOf(decided, run.goal);
    const r = {
      id: run.def.id, difficulty: run.difficulty, seed: run.seed, failed, completed, cheated: run.cheated, topk: true,
      counts: Object.assign({}, run.totals), decided: run.count, items: run.def.items, queries: m.queries, money: run.money,
      goal: run.goal, goalTarget: run.goalTarget, goalValue: gv,
      goalMet: !run.goal || (gv !== null && gv >= run.goalTarget - 1e-12),
      pAtK: m.pAtK, rAtK: m.rAtK,
      best: { t: best.k, k: best.k, low: null, money: best.money, feasible: best.feasible },
      thresholds: ks,
      profit: Topk.profitByK(pool, run.def).map((q) => ({ t: q.k, money: q.money })),
      key: 's', reviewed: 0, deskLevel: 0, incidents: [], monitor: null, phases: null, crafted: null
    };
    r.avgT = ks.length ? Math.round(ks.reduce((a, b) => a + b, 0) / ks.length * 10) / 10 : null;
    r.share = best.feasible && best.money > 0 ? r.money / best.money : null;
    r.beatBest = completed && best.feasible && r.money > best.money + 1e-9;
    r.target = targetOf(run.def, run.difficulty);
    r.stars = stars(r, r.target, r.best);
    return r;
  }

  return {
    MEDIAN_AMOUNT, values, isFraud, money, itemMoney, pStar, ghostPStar, goalTarget, goalValue, goalMet, outbreakAllowance, play,
    hindsightBest, playPhases, hindsightPhases, targetOf, stars, modelOf, phaseTerms, bonusesOf, streamOf, deskLevel, validate, reprice, start, enterPhase,
    goalStateOf, liveGoalValue, finishNow, update, results
  };
})();
