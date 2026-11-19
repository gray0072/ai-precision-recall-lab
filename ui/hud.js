'use strict';

// ============================================================
// AI Precision Recall Lab — the HUD over the play screen (spec 04 §4.1, 01 §3.2): chips on the left (what is
// being played; items decided; in a contract also its money, the goal chip and the outbreak meter), round
// buttons on the right (the sandbox's knobs, sound 🔊 / 🔇, pause). The goal chip shows the cumulative value
// of the goal's metric against the target: no colour for the first GOAL_GRACE_ITEMS items, then green when it
// is met, amber within GOAL_CLOSE, red below. Safe-area aware through styles.css. game.js passes the buttons'
// actions; update() runs every frame and touches the DOM only when a value changed.
// ============================================================

const Hud = (() => {
  const $ = (id) => document.getElementById(id);
  let shown = {};

  function init(actions) {
    $('knobsBtn').addEventListener('click', (e) => { actions.knobs(); e.currentTarget.blur(); });
    $('soundBtn').addEventListener('click', (e) => { actions.sound(); e.currentTarget.blur(); });
    $('pauseBtn').addEventListener('click', (e) => { actions.pause(); e.currentTarget.blur(); });
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
      put('hudTitle', run.def.id + ' · ' + tr(run.def.name));
      put('hudCount', tr('{n} / {all}', { n: run.count, all: run.def.items }));
      put('hudMoney', money(run.money));
      flag('hudMoney', 'sign', Math.sign(Math.round(run.money)), (s) => {
        $('hudMoney').classList.toggle('good', s > 0);
        $('hudMoney').classList.toggle('bad', s < 0);
      });
      if (run.goal) {
        const v = Contract.goalValue(run.totals, run.goal);
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
    } else {
      put('hudTitle', tr('Sandbox') + ' · ' + tr(run.scenario.name));
      put('hudCount', tr('{n} items', { n: run.count.toLocaleString('en-US').replace(/,/g, ' ') }));
    }
    flag('mode', 'contract', contract, (c) => {
      $('hudMoney').hidden = !c;
      $('hudGoal').hidden = !c || !run.goal;
      $('hudMeter').hidden = !c || run.allowance === null;
      $('knobsBtn').hidden = c;
      $('hudMeter').title = c && run.allowance !== null ? tr('Outbreak meter: every missed positive adds one; at {n} the contract fails.', { n: run.allowance }) : '';
      $('hudMoney').title = c ? tr("This contract's money so far; the fee is paid at the end.") : '';
    });
    put('soundBtn', GameAudio.on ? '🔊' : '🔇');
    if (shown.soundTitle !== GameAudio.on) {
      shown.soundTitle = GameAudio.on;
      $('soundBtn').title = GameAudio.on ? tr('Sound on') : tr('Sound off');
    }
  }

  function reset() { shown = {}; }

  return { init, update, reset, money };
})();

// the names of the metrics a goal can be on; they stay English in every language (04 §8)
const METRIC_NAMES = {
  precision: 'Precision', recall: 'Recall', f1: 'F1', fbeta: 'F-beta', accuracy: 'Accuracy', fpr: 'FPR',
  specificity: 'Specificity', mcc: 'MCC', balancedAccuracy: 'Balanced accuracy'
};
