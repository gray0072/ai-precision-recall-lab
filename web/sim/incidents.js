'use strict';

// ============================================================
// AI Precision Recall Lab — incidents and the drift monitor (spec 01 §5–§6, 02 §6). A contract lists its
// incidents in data/contracts.js as { at (item index), kind, params, ramp?, name, note }:
//   baseRate    { prevalence }   the share of positives moves to `prevalence`; the scores per class stay
//   drift       { shift }        the positives' mean logit slides down by `shift` (d' falls to d' − shift)
//   priceChange { prices }       from `at` on the contract pays this price list (the ghost line moves)
//   rush        { rate, items }  the arrival rate × `rate` for `items` items
//   adversary   { share?, prevalence? }  a share (ADV_SHARE) of the positives is crafted: each one's score is set
//                                as it arrives, just under the threshold of ADV_LAG_S seconds earlier (02 §6.3);
//                                with `prevalence` the ring also brings more positives (a base rate shift)
// baseRate and drift ramp in linearly over `ramp` items (INCIDENT_RAMP). The stream is made in advance, so
// the schedule (item index → base rate, drift, rate factor) goes into Stream.generate; an incident starts
// when its first item arrives on the belt (incidentStarted), with a warning warnS seconds ahead on Easy and
// Medium (incidentWarning). The drift monitor (the Lab's U-drift, or lent by C09) measures after every
// decision the PSI of the last PSI_WINDOW scores against the validation set (ADR-0005) and raises the drift
// alert after PSI_PERSIST decisions in a row above PSI_ALERT (driftAlert). Retrain (once per contract) takes
// RETRAIN_S: then the items still to come are scored by a model that knows the new data (no drift), a new
// validation set with the current base rate replaces the old one, the curves and the calibration are refitted
// and the PSI starts again against the new reference (retrainDone). The adversary: which positives are
// crafted (and their margins) is decided in advance from the attempt seed (markCrafted, in Contract.streamOf);
// the run keeps a log of its threshold, and a crafted item's score is set when it arrives (onArrive): the
// threshold of ADV_LAG_S earlier minus its margin. The debug cheat I starts the next incident now. No drawing, no DOM, no sound. Used by sim/contract.js, game.js, the HUD, the tests.
// ============================================================

const Incidents = (() => {
  // how far an incident has ramped in at item i: 0 before it, then up to 1 over its ramp
  function rampAt(inc, i) {
    if (i < inc.at) return 0;
    const r = inc.ramp !== undefined ? inc.ramp : INCIDENT_RAMP;
    return r <= 0 ? 1 : Math.min(1, (i - inc.at + 1) / r);
  }

  // The schedule of a list of incidents: item i → { prevalence, drift, rate (a factor) }. base: the contract's
  // starting base rate. noDriftFrom: from this index on the model has been retrained (drift 0).
  function schedule(list, base, noDriftFrom = Infinity) {
    const incs = (list || []).slice().sort((a, b) => a.at - b.at);
    return (i) => {
      let prevalence = base, drift = 0, rate = 1;
      for (const inc of incs) {
        const f = rampAt(inc, i);
        if (inc.kind === 'baseRate' || (inc.kind === 'adversary' && inc.params && inc.params.prevalence !== undefined)) {
          prevalence = lerp(prevalence, inc.params.prevalence, f);
        }
        else if (inc.kind === 'drift' && i < noDriftFrom) drift += inc.params.shift * f;
        else if (inc.kind === 'rush' && i >= inc.at && i < inc.at + inc.params.items) rate *= inc.params.rate;
      }
      return { prevalence, drift, rate };
    };
  }

  // the phase of item i in a contract made of phases (C12): { p, start, end, phase }; null without phases
  function phaseAt(def, i) {
    if (!def.phases) return null;
    let start = 0;
    for (let p = 0; p < def.phases.length; p++) {
      const end = start + def.phases[p].items;
      if (i < end || p === def.phases.length - 1) return { p, start, end, phase: def.phases[p] };
      start = end;
    }
    return null;
  }

  // the price list in force for item i: the latest price change at or before it (within its phase), else the
  // contract's own (or its phase's)
  function pricesAt(def, i, list) {
    const ph = phaseAt(def, i);
    let prices = ph ? ph.phase.prices : def.prices, at = ph ? ph.start - 1 : -1;
    for (const inc of list || def.incidents || []) {
      if (inc.kind === 'priceChange' && inc.at <= i && inc.at > at) { prices = inc.params.prices; at = inc.at; }
    }
    return prices;
  }

  // ---------- the adversary (02 §6.3) ----------

  // Which positives are crafted, decided in advance from the attempt seed on a stream of its own (two draws
  // per item, so the marks never shift): from the incident on, a share ADV_SHARE of the positives (ramping in
  // over the incident's ramp), each with its margin u, uniform in [0.01, ADV_MARGIN]. Returns the same array.
  function markCrafted(items, list, seed) {
    const adv = (list || []).filter((inc) => inc.kind === 'adversary');
    if (!adv.length) return items;
    const rng = Rng.stream(seed, 'incidents.adversary');
    for (const it of items) {
      const a = rng.uniform(), b = rng.uniform();
      it.crafted = false;
      if (!it.y) continue;
      let share = 0;
      for (const inc of adv) {
        const s = inc.params && inc.params.share !== undefined ? inc.params.share : ADV_SHARE;
        share = Math.max(share, s * rampAt(inc, it.i));
      }
      if (a < share) { it.crafted = true; it.craftU = 0.01 + b * (ADV_MARGIN - 0.01); }
    }
    return items;
  }

  // where a crafted item aims (in hundredths): just under the threshold t by its margin u, rounded and clamped
  // like any score
  function aimH(t, u) { return clamp(Math.round((t - u) * 100), hundredths(SCORE_MIN), hundredths(SCORE_MAX)); }

  // The crafted item's raw score and calibrated p (in hundredths) for each aim 0 … 100 on the threshold's axis:
  // on the raw axis the aim itself; with calibration the highest raw score whose p is still under the aim (so
  // it passes). Cached per Platt fit.
  const tables = new WeakMap();
  const RAW_TABLE = (() => {
    const t = new Int16Array(101);
    for (let a = 0; a <= 100; a++) t[a] = clamp(a, hundredths(SCORE_MIN), hundredths(SCORE_MAX));
    return { s: t, p: t };
  })();
  function aimTable(platt) {
    if (!platt) return RAW_TABLE;
    let tab = tables.get(platt);
    if (tab) return tab;
    tab = { s: new Int16Array(101), p: new Int16Array(101) };
    for (let a = 0; a <= 100; a++) {
      let best = hundredths(SCORE_MIN);
      for (let h = hundredths(SCORE_MAX); h >= hundredths(SCORE_MIN); h--) {
        if (hundredths(Model.calibrate(h / 100, platt)) <= a) { best = h; break; }
      }
      tab.s[a] = best;
      tab.p[a] = hundredths(Model.calibrate(best / 100, platt));
    }
    tables.set(platt, tab);
    return tab;
  }

  // the value (on `key`) a crafted item would have had if the ring had aimed at threshold t
  function craftedValue(item, t, key, platt) {
    const tab = aimTable(key === 'p' ? platt : null);
    return (key === 'p' ? tab.p : tab.s)[aimH(t, item.craftU)] / 100;
  }

  // A crafted item's score as it arrives: aimed just under `tLag` (the threshold of ADV_LAG_S earlier), on the
  // axis the threshold is on. The item keeps the aim (the results count them).
  function craft(item, tLag, key, platt) {
    const tab = aimTable(key === 'p' ? platt : null), a = aimH(tLag, item.craftU);
    item.s = tab.s[a] / 100;
    if (key === 'p' && platt) item.p = tab.p[a] / 100;
    item.aim = tLag;
    return item;
  }

  // the threshold the run had at `time` (its log, one entry per change)
  function thresholdAt(run, time) {
    const log = run.tLog;
    if (!log || !log.length) return State.threshold;
    for (let k = log.length - 1; k >= 0; k--) if (log[k].at <= time) return log[k].t;
    return log[0].t;
  }

  // the live run: an item arrives on the belt; a crafted one gets its score now
  function onArrive(run, item) {
    if (item.crafted) craft(item, thresholdAt(run, item.at - ADV_LAG_S), run.key, run.platt);
  }

  // Headless (the balance check, the tests): the stream as a player with this threshold over time (tOf(time),
  // on the raw score) would see it — copies of the items, the crafted ones scored against tOf(arrival − lag).
  function craftedAgainst(items, tOf) {
    return items.map((it) => {
      const c = Object.assign({}, it);
      if (c.crafted) craft(c, tOf(c.at - ADV_LAG_S), 's', null);
      return c;
    });
  }

  // what the crafted items did: how many there were, how many got through (passed: a missed fraud), how many
  // were caught by the line and how many by people
  function craftedSummary(decided) {
    const list = decided.filter((it) => it.crafted);
    return {
      total: list.length,
      through: list.filter((it) => it.outcome === 'FN').length,
      caught: list.filter((it) => it.outcome === 'TP' && !it.reviewed).length,
      reviewed: list.filter((it) => it.reviewed).length
    };
  }

  // ---------- the live run ----------

  // run.incidents: the contract's incidents with their state; the drift monitor when the run has one
  function setup(run, monitor) {
    run.incidents = (run.def.incidents || []).filter((inc) => inc.at < run.items.length)
      .map((inc) => Object.assign({}, inc, { warned: false, started: false }));
    run.retrain = null;                // { left (s), total (s) } while it runs
    run.retrained = false;
    run.noDriftFrom = Infinity;
    run.gen = 0;                       // which model scored the items (1 after Retrain)
    run.tLog = [{ at: 0, t: State.threshold }];   // the threshold over time (the adversary aims at it)
    run.monitor = monitor ? {
      ref: Metrics.psiReference(run.val.map((it) => it.s)), window: [], psi: null, history: [], over: 0, alert: false, alerts: 0
    } : null;
  }

  // the index of the next item to arrive (all have arrived: the stream's length)
  function nextIndex(run) { return run.next ? run.next.i : run.items.length; }

  // the time the incident's first item arrives
  function startTime(run, inc) { return run.items[inc.at].at; }

  // the next incident not started yet, with the seconds until it starts (the HUD's countdown)
  function upcoming(run) {
    const inc = run.incidents && run.incidents.find((x) => !x.started);
    return inc ? { inc, inS: Math.max(0, startTime(run, inc) - run.clock) } : null;
  }

  // every frame, after Stream.update and Review.update (05 §4): warnings, starts, the retrain's progress
  function update(dt) {
    const run = State.run;
    if (!run || run.kind !== 'contract' || run.ended) return;
    const last = run.tLog[run.tLog.length - 1];
    if (last.t !== State.threshold) run.tLog.push({ at: run.clock, t: State.threshold });
    const warnS = DIFFICULTIES[run.difficulty].warnS;
    for (const inc of run.incidents) {
      if (inc.started) continue;
      const T = startTime(run, inc);
      if (!inc.warned && warnS > 0 && run.clock >= T - warnS && run.clock < T) {
        inc.warned = true;
        GameEvents.emit('incidentWarning', { kind: inc.kind, inS: T - run.clock, incident: inc });
      }
      if (run.clock >= T) {
        inc.started = true;
        inc.startedAt = run.clock;
        GameEvents.emit('incidentStarted', { kind: inc.kind, incident: inc });
      }
    }
    if (run.retrain) {
      run.retrain.left -= dt;
      if (run.retrain.left <= 0) finishRetrain(run);
    }
  }

  // After every decision of a run with the drift monitor: the PSI of the last PSI_WINDOW scores made by the
  // current model against its validation set; the alert after PSI_PERSIST decisions in a row above PSI_ALERT.
  function afterGate(run, item) {
    const mon = run.monitor;
    if (!mon || (item.gen || 0) !== run.gen) return;
    mon.window.push(item.s);
    if (mon.window.length > PSI_WINDOW) mon.window.shift();
    if (mon.window.length < PSI_WINDOW) return;
    const v = Metrics.psi(mon.ref, mon.window);
    mon.psi = v;
    mon.history.push({ n: run.count, v });
    mon.over = v > PSI_ALERT ? mon.over + 1 : 0;
    if (mon.over >= PSI_PERSIST && !mon.alert) {
      mon.alert = true;
      mon.alerts++;
      GameEvents.emit('driftAlert', { psi: v });
    }
  }

  // Retrain can start once per contract, with the drift monitor, while the contract runs
  function canRetrain(run) { return !!(run && run.monitor && !run.retrain && !run.retrained && !run.ended); }
  function retrain(run) {
    if (!canRetrain(run)) return false;
    run.retrain = { left: RETRAIN_S, total: RETRAIN_S };
    return true;
  }

  // The retrained model: the items still to come are scored without drift (the model learned the new data),
  // a new validation set with the current base rate, the calibration and the curves refitted, the PSI against
  // the new reference. Items already on the belt keep their scores.
  function finishRetrain(run) {
    run.retrain = null;
    run.retrained = true;
    run.gen = 1;
    const from = nextIndex(run);
    run.noDriftFrom = from;
    const m = run.model;
    for (let i = from; i < run.items.length; i++) {
      const it = run.items[i];
      it.drift = 0;
      it.z = Model.logitMean(it.y, m.dPrime) + it.e;
      it.s = Model.rawScore(it.z, m);
      it.gen = 1;
    }
    const sched = schedule(run.incidents, run.basePrevalence, from);
    run.model = Object.assign({}, m, { prevalence: sched(Math.min(from, run.items.length - 1)).prevalence });
    Contract.validate(run, (run.seed ^ Rng.hashString('retrain')) >>> 0);
    for (let i = from; i < run.items.length; i++) if (run.platt) run.items[i].p = Model.calibrate(run.items[i].s, run.platt);
    if (run.monitor) Object.assign(run.monitor, { ref: Metrics.psiReference(run.val.map((it) => it.s)), window: [], psi: null, over: 0, alert: false, retrainedAt: run.count });
    State.pileVersion++;
    GameEvents.emit('retrainDone', {});
  }

  // The debug cheat I (01 §14): the next incident starts with the next item to arrive. The items still to
  // come are made again from the attempt seed with the moved schedule (their arrival gaps are kept, unless the
  // incident is a rush hour); the items on the belt keep theirs. Returns the incident, or null.
  function startNow(run) {
    const inc = run.incidents && run.incidents.find((x) => !x.started && !x.forced);
    const from = nextIndex(run);
    if (!inc || from >= run.items.length) return null;
    inc.at = from;
    inc.warned = true;
    inc.forced = true;
    const fresh = Contract.streamOf(run.def, run.difficulty, run.seed, run.bonus, run.incidents);
    const shift = run.items[from].at - fresh[from].at;
    for (let i = from; i < run.items.length; i++) {
      const it = run.items[i], f = fresh[i];
      Object.assign(it, { y: f.y, z: f.z, e: f.e, drift: i >= run.noDriftFrom ? 0 : f.drift, at: f.at + shift, crafted: !!f.crafted, craftU: f.craftU });
      if (i >= run.noDriftFrom) it.z = Model.logitMean(it.y, run.model.dPrime) + it.e;
      it.s = Model.rawScore(it.z, run.model);
      if (f.amount !== undefined) it.amount = f.amount;
      if (run.platt) it.p = Model.calibrate(it.s, run.platt);
    }
    return inc;
  }

  // ---------- headless: the drift monitor and a retrain at its alert (the balance check, the tests) ----------

  // The decision (index into items, in gate order) at which the drift monitor would raise its alert on this
  // stream: the PSI depends only on the scores, not on the threshold. null when it never would.
  function alertIndex(items, val) {
    const ref = Metrics.psiReference(val.map((it) => it.s));
    const win = [];
    let over = 0;
    for (let k = 0; k < items.length; k++) {
      win.push(items[k].s);
      if (win.length > PSI_WINDOW) win.shift();
      if (win.length < PSI_WINDOW) continue;
      over = Metrics.psi(ref, win) > PSI_ALERT ? over + 1 : 0;
      if (over >= PSI_PERSIST) return k;
    }
    return null;
  }

  // The stream as a player sees it who presses Retrain the moment the alert fires: from the first item that
  // arrives after the retrain is done (the alert's gate time + RETRAIN_S) the items are scored without drift.
  // Returns { items (copies), alertAt (decision index or null), from (first retrained item or null) }.
  function retrainedAtAlert(def, difficulty, seed, bonus = 0) {
    const items = Contract.streamOf(def, difficulty, seed, bonus).map((it) => Object.assign({}, it));
    const model = Contract.modelOf(def, difficulty, bonus);
    const k = alertIndex(items, Stream.validation(seed, model));
    if (k === null) return { items, alertAt: null, from: null };
    const done = items[k].at + BELT_TRAVEL_S / DIFFICULTIES[difficulty].speed + RETRAIN_S;
    let from = items.findIndex((it) => it.at > done);
    if (from < 0) from = items.length;
    for (let i = from; i < items.length; i++) {
      const it = items[i];
      it.drift = 0;
      it.z = Model.logitMean(it.y, model.dPrime) + it.e;
      it.s = Model.rawScore(it.z, model);
    }
    return { items, alertAt: k, from };
  }

  return {
    rampAt, schedule, phaseAt, pricesAt, markCrafted, aimH, aimTable, craftedValue, craft, thresholdAt, onArrive, craftedAgainst, craftedSummary, setup, nextIndex, upcoming, update, afterGate, canRetrain, retrain, startNow,
    alertIndex, retrainedAtAlert
  };
})();
