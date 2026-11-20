'use strict';

// ============================================================
// AI Precision Recall Lab — the results of a contract (spec 01 §3.4, §4; 04 §3): the stars (lit one by one),
// "New best!", the money (the contract's own, the fee, the quiz bonus, the new balance), the goal with its
// value, the comparison with the hindsight-best fixed threshold, the final confusion matrix and metrics of the
// decisions actually made, the threshold over time with the best line, the profit curve of the stream, the
// lesson with a link to its cheat sheet card, the attempt's seed; with a review desk the best fixed band and how
// many items people reviewed, with incidents the numbers before and after each, with the drift monitor its alert
// and the retrain, with Calibration the reliability diagram (before / after a base rate shift). A failure ("Outbreak!" / "Bankrupt!") uses the
// same panel with a red header and no stars. Buttons: Next contract, Retry (with the difficulty row), Lab, Map.
// Act 3: C10 says what the fraud ring's crafted payments did (and that the best fixed line was aimed at too,
// ADR-0006); C11 shows the mean P@k and R@k, k per query and the money at every k; C12 has a table per phase
// (its goal, money and best threshold) and, once won, "The end" leads to the end card.
// Reads the results of Contract.results and what Campaign.finish paid; game.js passes the buttons' actions.
// ============================================================

const Results = (() => {
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const fmt = (v) => (v === null || v === undefined ? '—' : v.toFixed(2));

  function moneyRows(paid) {
    const t = el('div', 'termList resMoney');
    const add = (name, v, cls) => {
      const r = el('div', 'termRow' + (cls ? ' ' + cls : ''));
      r.appendChild(el('span', 'termName', name));
      const b = el('b', 'termVal num', Hud.money(v));
      b.classList.add(v > 0 ? 'good' : v < 0 ? 'bad' : 'zero');
      r.appendChild(b);
      t.appendChild(r);
    };
    add(tr('This contract'), paid.contract);
    if (paid.fee) add(tr('Fee'), paid.fee);
    if (paid.quiz) add(tr('Quick question'), paid.quiz);
    add(tr('Total'), paid.total, 'total');
    const bal = el('div', 'termRow');
    bal.appendChild(el('span', 'termName', tr('Balance')));
    bal.appendChild(el('b', 'termVal num', '$' + Math.round(paid.balance).toLocaleString('en-US').replace(/,/g, ' ')));
    t.appendChild(bal);
    return t;
  }

  function matrix(c) {
    const t = el('table', 'priceTable resMatrix');
    const head = el('tr');
    head.appendChild(el('th', 'corner', tr('model ↓ truth →')));
    head.appendChild(el('th', 'pos', tr('Positive')));
    head.appendChild(el('th', 'neg', tr('Negative')));
    t.appendChild(head);
    for (const [name, outs] of [[tr('Flagged'), ['TP', 'FP']], [tr('Passed'), ['FN', 'TN']]]) {
      const row = el('tr');
      row.appendChild(el('th', '', name));
      for (const o of outs) {
        const td = el('td', 'cell' + o);
        td.appendChild(el('span', 'cName', o + ' ' + (OUTCOME_STYLE[o].right ? '✓' : '✗')));
        td.appendChild(el('b', 'num', String(c[o])));
        row.appendChild(td);
      }
      t.appendChild(row);
    }
    return t;
  }

  function metricsTable(c, extra) {
    const m = Metrics.compute(c);
    const t = el('div', 'termList resMetrics');
    const list = [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['accuracy', 'Accuracy'],
      ['specificity', 'Specificity'], ['fpr', 'FPR'], ['mcc', 'MCC']];
    if (extra) list.push(['balancedAccuracy', 'Balanced accuracy']);
    for (const [id, name] of list) {
      const r = el('div', 'termRow');
      r.appendChild(el('span', 'termName', name));
      r.appendChild(el('b', 'termVal num', fmt(m[id])));
      t.appendChild(r);
    }
    return t;
  }

  // "Best fixed threshold in hindsight: 0.71 → $412. You: $386 (94 %)."
  function hindsight(r) {
    if (!r.best.feasible) {
      return el('p', 'resBest bad', r.topk ? tr('No fixed k could meet the goal on this stream: the ranker is not good enough. Visit the Lab.')
        : r.phases ? tr('In at least one phase no fixed threshold could meet the goal: the model is not good enough. Visit the Lab.')
          : tr('No fixed threshold could meet the goal on this stream: the model is not good enough. Visit the Lab.'));
    }
    const p = el('p', 'resBest');
    const what = r.topk ? tr('Best fixed k in hindsight: k = {k} → {m}.', { k: r.best.k, m: Hud.money(r.best.money) })
      : r.phases ? tr('Best fixed threshold of each phase in hindsight: {ts} → {m} in all.',
        { ts: r.phases.map((q) => q.best.t.toFixed(2)).join(' / '), m: Hud.money(r.best.money) })
        : r.best.low !== null && r.best.low !== undefined
      ? tr('Best fixed threshold and review band in hindsight: {t}, people from {low} → {m}.', { t: r.best.t.toFixed(2), low: r.best.low.toFixed(2), m: Hud.money(r.best.money) })
      : tr('Best fixed threshold in hindsight: {t} → {m}.', { t: r.best.t.toFixed(2), m: Hud.money(r.best.money) });
    p.textContent = what + ' ' +
      tr('You: {m}', { m: Hud.money(r.money) }) + (r.share !== null && r.completed ? ' (' + Math.round(r.share * 100) + ' %).' : '.');
    if (r.beatBest) p.appendChild(el('span', 'badge good', tr('You beat the best fixed threshold!')));
    return p;
  }

  // What changed around an incident (02 §6.1–6.2): the decisions before it and after it had ramped in
  function incidentBlock(inc) {
    const box = el('div', 'resIncident');
    box.appendChild(el('h2', '', tr(inc.name)));
    const t = el('table', 'priceTable resAround');
    const head = el('tr');
    head.appendChild(el('th', 'corner', ''));
    for (const n of ['Precision', 'Recall', 'FPR', tr('positives'), tr('items')]) head.appendChild(el('th', '', n));
    t.appendChild(head);
    for (const [name, m] of [[tr('before'), inc.before], [tr('after'), inc.after]]) {
      if (!m) continue;
      const row = el('tr');
      row.appendChild(el('th', '', name));
      for (const v of [m.precision, m.recall, m.fpr]) row.appendChild(el('td', 'num', fmt(v)));
      row.appendChild(el('td', 'num', Math.round(m.prevalence * 100) + ' %'));
      row.appendChild(el('td', 'num', String(m.n)));
      t.appendChild(row);
    }
    box.appendChild(t);
    box.appendChild(el('p', 'fine', inc.kind === 'baseRate'
      ? tr('Your decisions before the shift and after it had ramped in. Recall and FPR live in the true columns and barely move; precision lives in the flagged row and follows the base rate.')
      : tr('Your decisions before the drift and after it had ramped in: the positives score lower, so at the same threshold recall falls.')));
    return box;
  }

  // C12: one row per phase — the client, the goal with its value, the money, the best fixed threshold
  function phasesTable(r) {
    const t = el('table', 'priceTable resAround');
    const head = el('tr');
    for (const n of ['', tr('Goal'), tr('Money'), tr('Best fixed')]) head.appendChild(el('th', n ? '' : 'corner', n));
    t.appendChild(head);
    for (const q of r.phases) {
      const row = el('tr');
      row.appendChild(el('th', '', tr('Phase {n}', { n: q.p + 1 }) + ': ' + tr(SCENARIOS[q.scenario].name)));
      row.appendChild(el('td', 'num ' + (q.goalMet ? 'good' : 'bad'), q.goal
        ? tr(METRIC_NAMES[q.goal.metric]) + ' ' + fmt(q.goalValue) + (q.goalMet ? ' ≥ ' : ' < ') + q.goalTarget.toFixed(2)
        : (q.decided === q.items ? tr('none') : tr('not reached'))));
      row.appendChild(el('td', 'num', Hud.money(q.money)));
      row.appendChild(el('td', 'num', q.best.feasible ? q.best.t.toFixed(2) + ' → ' + Hud.money(q.best.money) : '—'));
      t.appendChild(row);
    }
    return t;
  }

  const FAIL = {
    outbreak: () => [tr('Outbreak!'), tr('Too many feverish passengers got through: the outbreak meter reached its limit. A lower threshold catches more of them.')],
    bankrupt: () => [tr('Bankrupt!'), tr("The contract's money fell below the limit: the mistakes cost more than the client would cover.")]
  };

  let last = null;              // the last show()'s arguments: refresh() rebuilds the panel in a new language

  function show(r, paid, actions, again) {
    last = [r, paid, actions];
    const def = CONTRACTS[r.id];
    const box = $('results');
    box.textContent = '';
    const head = el('div', 'resHead' + (r.failed ? ' failed' : ''));
    head.appendChild(ClientArt.canvas(def.scenario, 48));
    const titles = el('div', 'brWho');
    titles.appendChild(el('div', 'brId', r.id + ' · ' + tr(def.name) + ' · ' + tr(DIFFICULTY_NAMES[r.difficulty])));
    if (r.failed) {
      const [title, why] = FAIL[r.failed]();
      titles.appendChild(el('h1', '', title));
      titles.appendChild(el('div', 'brClient', why));
    } else {
      titles.appendChild(el('h1', '', tr('Contract complete')));
      const stars = el('div', 'resStars'), delays = [];
      for (let i = 0; i < 3; i++) {
        const s = el('span', i < r.stars ? 'starOn' : 'starOff', '★');
        delays.push(0.25 + i * 0.35);
        s.style.animationDelay = delays[i] + 's';
        stars.appendChild(s);
      }
      titles.appendChild(stars);
      if (!again) GameEvents.emit('starsShown', { stars: r.stars, delays });   // ui/sounds.js: one note per star
    }
    head.appendChild(titles);
    box.appendChild(head);
    if (r.cheated) box.appendChild(el('p', 'fine bad', tr('A debug cheat was used: this run does not count for stars or bests.')));
    else if (paid.newBest && paid.recorded) box.appendChild(el('span', 'badge good', tr('New best on {level}!', { level: tr(DIFFICULTY_NAMES[r.difficulty]) })));

    const cols = el('div', 'brCols');
    const left = el('div', 'brBox');
    left.appendChild(el('h2', '', tr('Money')));
    left.appendChild(moneyRows(paid));
    if (r.phases) left.appendChild(phasesTable(r));
    if (r.goal) {
      const met = r.goalMet;
      left.appendChild(el('p', 'resGoal ' + (met ? 'good' : 'bad'), (met ? tr('Goal met') : tr('Goal not met')) + ': ' +
        tr(METRIC_NAMES[r.goal.metric]) + ' ' + fmt(r.goalValue) + ' ' + (met ? '≥' : '<') + ' ' + r.goalTarget.toFixed(2)));
    }
    left.appendChild(hindsight(r));
    if (r.topk) left.appendChild(el('p', 'fine', tr('Your queries: mean Precision@k {p}, mean Recall@k {r}.', { p: fmt(r.pAtK), r: fmt(r.rAtK) })));
    if (r.crafted) {
      left.appendChild(el('p', 'resRing ' + (r.crafted.through ? 'bad' : 'good'), tr('The fraud ring crafted {n} payments: {through} got through, {caught} caught by your line, {reviewed} by people.',
        { n: r.crafted.total, through: r.crafted.through, caught: r.crafted.caught, reviewed: r.crafted.reviewed })));
      left.appendChild(el('p', 'fine', tr('The best fixed line in hindsight is scored as if the ring had aimed at it too: a line that never moves gets gamed.')));
    }
    if (r.deskLevel) left.appendChild(el('p', 'fine', tr('People reviewed {n} items ({fee} each, always right).', { n: r.reviewed, fee: Hud.money(-REVIEW_FEE) })));
    if (r.monitor) left.appendChild(el('p', 'fine', (r.monitor.alerts ? tr('The drift monitor raised its alert.') : tr('The drift monitor stayed calm.')) + ' ' +
      (r.monitor.retrained ? tr('You retrained the model.') : tr('You did not retrain.'))));
    left.appendChild(el('h2', '', tr('Final numbers')));
    const nums = el('div', 'resNums');
    nums.appendChild(matrix(r.counts));
    nums.appendChild(metricsTable(r.counts, def.extraMetrics));
    left.appendChild(nums);
    left.appendChild(el('p', 'fine', tr('All {n} decisions made, with the threshold of the moment each item passed the gate.', { n: r.decided })));
    cols.appendChild(left);

    const right = el('div', 'brBox');
    right.appendChild(el('h2', '', r.topk ? tr('Your k over time') : tr('Your threshold over time')));
    const spark = el('canvas', 'resChart');
    right.appendChild(spark);
    right.appendChild(legend(r));
    let prof = null;
    if (r.profit) {
      right.appendChild(el('h2', '', r.topk ? tr('Profit at every fixed k') : tr('Profit at every fixed threshold')));
      prof = el('canvas', 'resChart');
      right.appendChild(prof);
      right.appendChild(el('p', 'fine', r.topk
        ? tr('What these very queries would have paid with one k held all the time. The best one must also meet the goal.')
        : tr('What this very stream would have paid with one threshold held all the time. The best one must also meet the goal and not fail the contract.')));
    }
    for (const inc of r.incidents || []) if (inc.before || inc.after) right.appendChild(incidentBlock(inc));
    let rel = null;
    if (r.reliability) {
      right.appendChild(el('h2', '', tr('Calibration: were the badges right?')));
      rel = el('canvas', 'resChart resSquare');
      right.appendChild(rel);
      right.appendChild(el('p', 'fine', r.reliability.after
        ? tr('Grey: before the shift, violet: after it. The badges kept the old Platt fit, so after the shift more items were positive than their p said: the calibration went stale.')
        : tr('The share of positives in each bin of the calibrated p: on the diagonal, the badges told the truth.')));
    }
    const lesson = el('div', 'lesson');
    lesson.appendChild(el('h2', '', tr('What you learned')));
    lesson.appendChild(el('p', '', tr(def.lesson)));
    const card = GLOSSARY.find((g) => g.id === def.card);
    const link = el('button', 'btn secondary', tr('Cheat sheet: {name}', { name: tr(card.name) }));
    link.addEventListener('click', () => actions.card(def.card));
    lesson.appendChild(link);
    right.appendChild(lesson);
    cols.appendChild(right);
    box.appendChild(cols);
    box.appendChild(el('p', 'fine seed', tr('Attempt seed {s}', { s: r.seed })));

    // the buttons: Next contract when it is open and this was not a failure (after a won C12: The end, the end
    // card), otherwise Retry is the default
    const finale = r.id === CONTRACT_ORDER[CONTRACT_ORDER.length - 1] && !r.failed && r.stars >= 1;
    const next = !r.failed ? Campaign.nextOpen(r.id) : null;
    const forward = finale || !!next;
    $('resNextBtn').hidden = !forward;
    $('resNextBtn').textContent = finale ? tr('The end') : tr('Next contract');
    $('resNextBtn').classList.toggle('default', forward);
    $('resRetryBtn').classList.toggle('default', !forward);
    $('resRetryBtn').classList.toggle('big', !forward);
    $('resNextBtn').onclick = () => (finale ? actions.finale() : actions.next(next));
    $('resRetryBtn').onclick = actions.retry;
    $('resLabBtn').onclick = actions.lab;
    $('resMapBtn').onclick = actions.map;
    Screens.renderDifficulty('#resultsDifficulty');
    Screens.show('results');
    requestAnimationFrame(() => { Charts.sparkline(spark, r); if (prof) Charts.resultProfit(prof, r); if (rel) Charts.resultReliability(rel, r.reliability); });
  }

  function legend(r) {
    const p = el('p', 'fine legend');
    if (r.topk) {
      p.appendChild(el('span', 'lgYou', tr('your k (average {k})', { k: r.avgT === null ? '—' : String(r.avgT) })));
      if (r.best.k !== null) p.appendChild(el('span', 'lgBest', tr('best fixed k = {k}', { k: r.best.k })));
      return p;
    }
    const you = el('span', 'lgYou', tr('your threshold (average {t})', { t: fmt(r.avgT) }));
    p.appendChild(you);
    if (r.phases) p.appendChild(el('span', 'lgBest', tr('best fixed per phase')));
    else if (r.best.t !== null) p.appendChild(el('span', 'lgBest', tr('best fixed {t}', { t: r.best.t.toFixed(2) })));
    return p;
  }

  // the language changed while the results are open
  function refresh() { if (last) show(last[0], last[1], last[2], true); }

  return { show, refresh };
})();
