'use strict';

// ============================================================
// AI Precision Recall Lab — the HUD over the play screen (spec 04 §4.1, 01 §3.2): chips on the left (what is
// being played; items decided; in a contract also its money, the goal chip, the outbreak meter, the incident
// countdown and the drift monitor's PSI with a small chart; the review desk's queue with its "Desk full" flash),
// buttons on the right (Retrain with its progress, the sandbox's knobs, sound 🔊 / 🔇, pause), and the
// banners of incidents, the drift alert and the retrain. The goal chip shows the cumulative value
// of the goal's metric against the target: no colour for the first GOAL_GRACE_ITEMS items, then green when it
// is met, amber within GOAL_CLOSE, red below. A top-k contract counts queries and its goal is the mean R@k;
// a contract of phases (C12) names the phase in its title chip, its goal chip shows the phase's goal (hidden in
// a phase without one) and a banner announces each new phase. Safe-area aware through styles.css. game.js passes the buttons'
// actions; update() runs every frame and touches the DOM only when a value changed.
// ============================================================

const Hud = (() => {
  const $ = (id) => document.getElementById(id);
  let shown = {};

  function init(actions) {
    $('knobsBtn').addEventListener('click', (e) => { actions.knobs(); e.currentTarget.blur(); });
    $('soundBtn').addEventListener('click', (e) => { actions.sound(); e.currentTarget.blur(); });
    $('pauseBtn').addEventListener('click', (e) => { actions.pause(); e.currentTarget.blur(); });
    $('retrainBtn').addEventListener('click', (e) => { actions.retrain(); e.currentTarget.blur(); });
    $('knobsBtn').title = tr('Sandbox knobs');
    $('pauseBtn').title = tr('Pause (Esc)');
    $('tSlider').setAttribute('aria-label', tr('Threshold'));
  }

  function put(id, text) {
    if (shown[id] === text) return;
    shown[id] = text;
    $(id).textContent = text;
  }
  function flag(id, prop, value, apply) {
    const k = id + '.' + prop;
    if (shown[k] === value) return;
    shown[k] = value;
    apply(value);
  }

  // whole dollars with a sign (04 §2): +$86, −$30, $0
  function money(v) {
    const r = Math.round(v);
    return (r < 0 ? '−$' : r > 0 ? '+$' : '$') + Math.abs(r).toLocaleString('en-US').replace(/,/g, ' ');
  }

  const GOAL_TITLE = {
    none: '', grace: () => tr('The goal shows its colour after the first {n} items.', { n: GOAL_GRACE_ITEMS }),
    met: () => tr('Goal met so far, over all the decisions made.'),
    close: () => tr('Close to the goal: less than {d} below the target.', { d: GOAL_CLOSE.toFixed(2) }),
    broken: () => tr('Below the goal, over all the decisions made.')
  };

  function update() {
    const run = State.run;
    if (!run) return;
    const contract = run.kind === 'contract';
    if (contract) {
      put('hudTitle', run.def.id + ' · ' + tr(run.def.name) + (run.def.phases
        ? ' · ' + tr('phase {n} / {all}: {name}', { n: run.phase + 1, all: run.def.phases.length, name: tr(run.scenario.name) }) : ''));
      put('hudCount', run.topk
        ? tr('query {n} / {all}', { n: Math.floor(run.count / TOPK_DOCS), all: run.def.items })
        : tr('{n} / {all}', { n: run.count, all: run.total }));
      put('hudMoney', money(run.money));
      flag('hudMoney', 'sign', Math.sign(Math.round(run.money)), (s) => {
        $('hudMoney').classList.toggle('good', s > 0);
        $('hudMoney').classList.toggle('bad', s < 0);
      });
      flag('hudGoal', 'shown', !!run.goal, (on) => { $('hudGoal').hidden = !on; });
      if (run.goal) {
        const v = Contract.liveGoalValue(run);
        put('hudGoal', tr(METRIC_NAMES[run.goal.metric]) + ' ' + (v === null ? '—' : v.toFixed(2)) + ' ≥ ' + run.goalTarget.toFixed(2));
        flag('hudGoal', 'state', run.goalState, (s) => {
          const el = $('hudGoal');
          el.classList.remove('grace', 'met', 'close', 'broken');
          el.classList.add(s);
          el.title = GOAL_TITLE[s] ? GOAL_TITLE[s]() : '';
        });
      }
      if (run.allowance !== null) {
        put('hudMeter', '🦠 ' + run.totals.FN + ' / ' + run.allowance);
        flag('hudMeter', 'level', run.totals.FN >= run.allowance - 1 ? 'bad' : run.totals.FN > 0 ? 'warn' : '', (l) => {
          $('hudMeter').classList.toggle('bad', l === 'bad');
          $('hudMeter').classList.toggle('warn', l === 'warn');
        });
      }
      incident(run);
      monitor(run);
    } else {
      put('hudTitle', tr('Sandbox') + ' · ' + tr(run.scenario.name));
      put('hudCount', tr('{n} items', { n: run.count.toLocaleString('en-US').replace(/,/g, ' ') }));
    }
    desk();
    flag('mode', 'contract', contract, (c) => {
      $('hudMoney').hidden = !c;
      if (!c) $('hudGoal').hidden = true;
      $('hudMeter').hidden = !c || run.allowance === null;
      $('knobsBtn').hidden = c;
      if (!c) { $('hudPsi').hidden = true; $('retrainBtn').hidden = true; $('hudIncident').hidden = true; }
      $('hudMeter').title = c && run.allowance !== null ? tr('Outbreak meter: every missed positive adds one; at {n} the contract fails.', { n: run.allowance }) : '';
      $('hudMoney').title = c ? tr("This contract's money so far; the fee is paid at the end.") : '';
    });
    put('soundBtn', GameAudio.on ? '🔊' : '🔇');
    if (shown.soundTitle !== GameAudio.on) {
      shown.soundTitle = GameAudio.on;
      $('soundBtn').title = GameAudio.on ? tr('Sound on') : tr('Sound off');
    }
  }

  // ---------- the review desk (01 §5): items in the desk / its room; "Desk full" flashes ----------
  let fullUntil = 0;
  GameEvents.on('deskFull', () => { fullUntil = performance.now() + 1200; });
  const ROMAN = ['', 'I', 'II', 'III'];
  function desk() {
    const d = State.review;
    flag('hudDesk', 'on', !!d, (on) => { $('hudDesk').hidden = !on; });
    if (!d) return;
    const full = performance.now() < fullUntil;
    put('hudDesk', full ? '👥 ' + tr('Desk full') : '👥 ' + d.busy + ' / ' + d.max);
    flag('hudDesk', 'full', full ? 'bad' : d.busy >= d.max ? 'warn' : '', (l) => {
      $('hudDesk').classList.toggle('bad', l === 'bad');
      $('hudDesk').classList.toggle('warn', l === 'warn');
    });
    flag('hudDesk', 'title', d.level, (lvl) => {
      $('hudDesk').title = tr('Review desk {lvl}: items with people now / the most they can hold. They finish one every {s} s, always right, $1 each.',
        { lvl: ROMAN[lvl], s: (1 / REVIEW_RATE[lvl - 1]).toFixed(1) });
    });
  }

  // ---------- incidents (01 §6): the countdown of a warned one, then its name for a few seconds ----------
  function incident(run) {
    const up = Incidents.upcoming(run);
    let text = '';
    if (up && up.inc.warned) text = tr('{name} in {s} s', { name: tr(up.inc.name), s: Math.ceil(up.inS) });
    else {
      const last = run.incidents.filter((x) => x.started).pop();
      if (last && run.clock - last.startedAt < 6) text = tr(last.name);
    }
    put('hudIncident', text);
    flag('hudIncident', 'shown', !!text, (on) => { $('hudIncident').hidden = !on; });
  }

  // ---------- the drift monitor (02 §6.2): PSI with a small chart; Retrain ----------
  function monitor(run) {
    const mon = run.monitor;
    flag('hudPsi', 'on', !!mon, (on) => { $('hudPsi').hidden = !on; });
    const canRetrain = Incidents.canRetrain(run);
    const btn = run.retrain ? tr('Retraining… {s} s', { s: Math.ceil(run.retrain.left) }) : run.retrained ? tr('Retrained') : tr('Retrain');
    flag('retrainBtn', 'on', !!mon, (on) => { $('retrainBtn').hidden = !on; });
    if (!mon) return;
    put('retrainBtn', btn);
    flag('retrainBtn', 'state', canRetrain ? (mon.alert ? 'alert' : 'ready') : 'off', (s) => {
      $('retrainBtn').disabled = s === 'off';
      $('retrainBtn').classList.toggle('alert', s === 'alert');
      $('retrainBtn').title = tr('Retrain the model on the new data (once per contract, takes {s} s).', { s: RETRAIN_S });
    });
    const v = mon.psi;
    put('hudPsiText', v === null ? tr('PSI …') : 'PSI ' + v.toFixed(2));
    flag('hudPsi', 'level', v === null ? '' : v > PSI_ALERT ? 'bad' : v > PSI_CALM ? 'warn' : 'good', (l) => {
      const c = $('hudPsi');
      c.classList.remove('good', 'warn', 'bad');
      if (l) c.classList.add(l);
      c.title = v === null
        ? tr('Drift monitor: PSI needs the first {n} items scored by this model.', { n: PSI_WINDOW })
        : tr('Drift monitor: PSI of the last {n} scores against the validation set. Below {calm} stable, above {alert} shifted.',
          { n: PSI_WINDOW, calm: PSI_CALM.toFixed(1), alert: PSI_ALERT.toFixed(1) });
    });
    flag('hudPsi', 'chart', mon.history.length + '|' + (mon.retrainedAt || 0), () => psiChart(mon));
  }

  // the PSI over the last decisions: a line with the alert level dashed
  function psiChart(mon) {
    const c = $('hudPsiChart'), w = 56, h = 20, s = Math.min(window.devicePixelRatio || 1, 2.5);
    if (c.width !== Math.round(w * s)) { c.width = Math.round(w * s); c.height = Math.round(h * s); c.style.width = w + 'px'; c.style.height = h + 'px'; }
    const ctx = c.getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const top = Math.max(0.4, ...mon.history.slice(-80).map((q) => q.v));
    const Y = (v) => h - 1 - (v / top) * (h - 2);
    ctx.strokeStyle = 'rgba(255, 107, 94, 0.7)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(0, Y(PSI_ALERT)); ctx.lineTo(w, Y(PSI_ALERT)); ctx.stroke();
    ctx.setLineDash([]);
    const pts = mon.history.slice(-80);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((q, i) => { const x = (i / 79) * w; if (i) ctx.lineTo(x, Y(q.v)); else ctx.moveTo(x, Y(q.v)); });
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ---------- banners for the logic's events (05 §4) ----------
  GameEvents.on('incidentWarning', (e) => Screens.banner(tr('Heads up: {name} in {s} s.', { name: tr(e.incident.name), s: Math.round(e.inS) })));
  GameEvents.on('incidentStarted', (e) => Screens.banner(tr(e.incident.name) + ' ' + tr(e.incident.note)));
  GameEvents.on('driftAlert', (e) => Screens.banner(tr('Drift alert: PSI {v}. The inputs changed: base rate or drift? Retrain when the model is out of date.', { v: e.psi.toFixed(2) })));
  GameEvents.on('phaseStarted', (e) => Screens.banner(tr('Phase {n}: {name}. New client, new model, new prices — and the pile starts afresh.',
    { n: e.phase + 1, name: tr(SCENARIOS[e.scenario].name) })));
  GameEvents.on('retrainDone', () => Screens.banner(tr('Retrained: the model knows the new data. New validation set, new curves, PSI starts again.')));

  function reset() { shown = {}; fullUntil = 0; }

  return { init, update, reset, money };
})();

// the names of the metrics a goal can be on; they stay English in every language (04 §8)
const METRIC_NAMES = {
  precision: 'Precision', recall: 'Recall', f1: 'F1', fbeta: 'F-beta', accuracy: 'Accuracy', fpr: 'FPR',
  specificity: 'Specificity', mcc: 'MCC', balancedAccuracy: 'Balanced accuracy',
  recallAtK: 'Recall@k (mean)', precisionAtK: 'Precision@k (mean)'
};
