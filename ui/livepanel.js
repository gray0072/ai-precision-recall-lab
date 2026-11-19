'use strict';

// ============================================================
// AI Precision Recall Lab — the live panel's numbers (spec 01 §1.5, 04 §4.1): the confusion matrix (rows =
// what the model said, columns = the truth; the big number is the rolling window at the current threshold,
// the small one all the decisions made), the metric bars (Precision, Recall, F1, Accuracy, FPR on the window;
// "—" for an empty denominator, 02 §3.2) and the explanations: pointing at a bar (hover, or a tap / click
// that pins it) highlights the matrix cells and the pile regions it is made of — numerator bright, the rest
// of the denominator outlined — and shows its formula filled with the live numbers. Formula view (sandbox)
// shows the filled formula under every bar all the time. In a contract the goal's bar carries a tick at the
// target and turns red while the window is below it; a second tap / click on a pinned bar opens its cheat sheet
// card (onCard, set by game.js). Every number here can be traced to the pile.
// Reads State, sets State.highlight; updated by game.js each frame (it redraws only when something changed).
// ============================================================

const LivePanel = (() => {
  const $ = (id) => document.getElementById(id);
  const barsBox = $('barsBox'), tip = $('tip');
  // each cell: its name with ✓ / ✗, the window count, the count of decisions made; built once
  const cells = {}, cellNums = {};
  document.querySelectorAll('#matrix [data-cell]').forEach((td) => {
    const o = td.dataset.cell;
    cells[o] = td;
    td.innerHTML = '<span class="cName">' + o + ' ' + (OUTCOME_STYLE[o].right ? '✓' : '✗') + '</span>' +
      '<b class="num"></b><small class="num"></small>';
    cellNums[o] = { win: td.querySelector('b'), all: td.querySelector('small') };
  });

  // what each cell means, for its tooltip
  const CELL_TEXT = {
    TP: () => tr('True positive: flagged, and really positive.'),
    FP: () => tr('False positive: flagged, but really negative (a false alarm).'),
    FN: () => tr('False negative: passed, but really positive (a miss).'),
    TN: () => tr('True negative: passed, and really negative.')
  };

  // The metrics of the bars: the formula in the matrix' terms (the cells are coloured and filled in with
  // numbers), what is in the numerator and the denominator, the question it answers, why it can be empty.
  const METRICS = [
    { id: 'precision', name: 'Precision', formula: 'TP / (TP + FP)', num: ['TP'], den: ['TP', 'FP'],
      ask: () => tr('Of everything flagged, how much was really positive?'),
      empty: () => tr('not defined yet: no flagged items') },
    { id: 'recall', name: 'Recall', formula: 'TP / (TP + FN)', num: ['TP'], den: ['TP', 'FN'],
      ask: () => tr('Of all the real positives, how many were caught?'),
      empty: () => tr('not defined yet: no positives') },
    { id: 'f1', name: 'F1', formula: '2·TP / (2·TP + FP + FN)', num: ['TP'], den: ['TP', 'FP', 'FN'],
      ask: () => tr('The harmonic mean of precision and recall: high only when both are.'),
      empty: () => tr('not defined yet: no positives and nothing flagged') },
    { id: 'accuracy', name: 'Accuracy', formula: '(TP + TN) / (TP + FP + FN + TN)', num: ['TP', 'TN'], den: ['TP', 'FP', 'FN', 'TN'],
      ask: () => tr('How many decisions were right? Misleading when positives are rare.'),
      empty: () => tr('not defined yet: no items') },
    { id: 'fpr', name: 'FPR', formula: 'FP / (FP + TN)', num: ['FP'], den: ['FP', 'TN'],
      ask: () => tr('False positive rate: of all the real negatives, how many raised a false alarm?'),
      empty: () => tr('not defined yet: no negatives') }
  ];
  const byId = {};
  METRICS.forEach((m) => { byId[m.id] = m; });

  // ---------- the bars ----------
  const rows = {};
  for (const m of METRICS) {
    const row = document.createElement('div');
    row.className = 'bar';
    row.dataset.metric = m.id;
    row.tabIndex = -1;
    row.innerHTML = '<span class="bName"></span><span class="bTrack"><span class="bFill"></span><span class="bTick" hidden></span></span>' +
      '<span class="bVal num"></span><div class="bFormula"></div>';
    row.querySelector('.bName').textContent = m.name;   // metric names stay English in every language (04 §8)
    barsBox.appendChild(row);
    rows[m.id] = {
      row, fill: row.querySelector('.bFill'), tick: row.querySelector('.bTick'), val: row.querySelector('.bVal'), formula: row.querySelector('.bFormula')
    };
    row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !pinned) point(m.id); });
    row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) point(null); });
    row.addEventListener('click', () => {
      // a second click / tap on the same bar lets go of it and opens the metric's cheat sheet card
      if (pinned === m.id) { pinned = null; point(null); api.onCard(m.id); return; }
      pinned = m.id;
      point(m.id);
    });
  }

  let pinned = null;
  let pointed = null;
  let last = null;      // { c, totals, metrics, n }: the numbers on screen

  function fmt(v) { return v === null ? '—' : v.toFixed(2); }

  // the formula as HTML: each cell name in its outcome's colour; with `c`, the numbers instead of the names
  function formulaHtml(m, c) {
    return m.formula.replace(/2·(TP)|\b(TP|FP|FN|TN)\b/g, (all, two, cell) => {
      const name = two || cell;
      const inner = c ? String(c[name]) : name;
      return (two ? '2·' : '') + '<span class="o' + name + '">' + inner + '</span>';
    });
  }
  function filledHtml(m, c, v) {
    return '<b>' + m.name + '</b> = ' + formulaHtml(m) + ' = ' + formulaHtml(m, c) + ' = <b class="num">' +
      (v === null ? '—' : v.toFixed(2)) + '</b>';
  }

  // point at a metric (or null): highlight its cells in the matrix and the pile, show its formula
  function point(id) {
    pointed = id;
    const m = id ? byId[id] : null;
    State.highlight = m ? { id, num: m.num, den: m.den } : null;
    for (const o in cells) {
      cells[o].classList.toggle('hlNum', !!m && m.num.includes(o));
      cells[o].classList.toggle('hlDen', !!m && !m.num.includes(o) && m.den.includes(o));
      cells[o].classList.toggle('hlDim', !!m && !m.den.includes(o));
    }
    for (const k in rows) rows[k].row.classList.toggle('on', k === id);
    if (!m) { tip.hidden = true; return; }
    fillTip();
    tip.hidden = false;
    placeTip(rows[id].row);
  }

  function fillTip() {
    if (!pointed || !last) return;
    const m = byId[pointed], v = last.metrics[m.id];
    tip.innerHTML = '<div class="tipF">' + filledHtml(m, last.c, v) + '</div>' +
      '<div class="tipAsk"></div><div class="tipNote fine"></div>';
    tip.querySelector('.tipAsk').textContent = v === null ? m.empty() : m.ask();
    tip.querySelector('.tipNote').textContent = tr('Last {n} items, at the current threshold.', { n: last.n });
  }

  // the tooltip next to the bar, kept on screen
  function placeTip(anchor) {
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = clamp(x, 8, window.innerWidth - tw - 8);
    let y = r.top - th - 8;
    if (y < 8) y = Math.min(r.bottom + 8, window.innerHeight - th - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  // a cell pulses once when an item lands in it (the decision actually made at the gate)
  GameEvents.on('itemDecided', (e) => {
    const td = cells[e.outcome];
    if (!td) return;
    td.classList.remove('pulse');
    void td.offsetWidth;   // restart the animation
    td.classList.add('pulse');
  });

  let key = '';
  function update(force) {
    const run = State.run;
    if (!run) return;
    const goal = run.kind === 'contract' && run.goal ? run.goal : null;
    const k = State.threshold + '|' + State.pileVersion + '|' + run.key + '|' + run.count + '|' + !!(run.knobs && run.knobs.formulas) + '|' + (goal ? goal.metric : '');
    if (k === key && !force) return;
    key = k;
    const c = Metrics.counts(State.pile, State.threshold, run.key);
    const metrics = Metrics.compute(c);
    last = { c, totals: run.totals, metrics, n: State.pile.length };
    for (const o in cells) {
      cellNums[o].win.textContent = c[o];
      cellNums[o].all.textContent = tr('all {n}', { n: run.totals[o] });
      cells[o].title = CELL_TEXT[o]() + ' ' + tr('{w} in the last {n} items at the current threshold; {a} decided this way since the start.',
        { w: c[o], n: last.n, a: run.totals[o] });
    }
    $('matrixNote').textContent = tr('last {n}', { n: last.n });
    const formulas = !!(run.knobs && run.knobs.formulas);
    barsBox.classList.toggle('formulas', formulas);
    for (const m of METRICS) {
      const v = metrics[m.id], r = rows[m.id];
      r.fill.style.width = v === null ? '0%' : (v * 100).toFixed(1) + '%';
      r.val.textContent = fmt(v);
      r.row.title = v === null ? m.empty() : '';
      const target = goal && goal.metric === m.id ? run.goalTarget : null;
      r.tick.hidden = target === null;
      if (target !== null) {
        r.tick.style.left = (target * 100).toFixed(1) + '%';
        r.tick.title = tr('Target {v}', { v: target.toFixed(2) });
      }
      r.row.classList.toggle('goal', target !== null);
      r.row.classList.toggle('broken', target !== null && v !== null && v < target - 1e-12);
      if (formulas) r.formula.innerHTML = formulaHtml(m, c) + ' = ' + fmt(v);
    }
    if (pointed) fillTip();
  }

  function reset() { pinned = null; point(null); key = ''; }

  const api = { update, reset, point, METRICS, onCard: () => {} };
  return api;
})();
