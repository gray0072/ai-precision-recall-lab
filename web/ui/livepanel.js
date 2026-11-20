'use strict';

// ============================================================
// AI Precision Recall Lab — the live panel's numbers (spec 01 §1.5, 04 §4.1): the confusion matrix (rows =
// what the model said, columns = the truth; the big number is the rolling window at the current threshold,
// the small one all the decisions made), the metric bars (Precision, Recall, F1, Accuracy, FPR on the window;
// "—" for an empty denominator, 02 §3.2) and the explanations: pointing at a bar (hover, or a tap / click
// that pins it) highlights the matrix cells and the pile regions it is made of — numerator bright, the rest
// of the denominator outlined — and shows its formula filled with the live numbers; a pinned tooltip closes on a
// tap / click on it or anywhere outside the bars (a touch screen has no "pointer leaves"). Formula view (sandbox)
// shows the filled formula under every bar all the time. In a contract the goal's bar carries a tick at the
// target and turns red while the window is below it; a second tap / click on a pinned bar opens its cheat sheet
// card (onCard, set by game.js). A top-k run (02 §7) shows two bars instead: P@k (the mean over the window's
// queries, which equals the pooled TP / (TP + FP) since every query shows k) and R@k (the mean of each
// query's TP / (TP + FN), next to the pooled value in its tooltip); the matrix counts the documents at the
// current k. Every number here can be traced to the pile.
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
      empty: () => tr('not defined yet: no negatives') },
    // top-k (02 §7): the means over the queries of the window
    { id: 'patk', name: 'P@k', formula: 'TP / (TP + FP)', num: ['TP'], den: ['TP', 'FP'], topk: true, card: 'G-topk',
      ask: () => tr('Precision@k: of the k pages shown for a query, how many were relevant — the mean over the queries. Every query shows k pages, so it equals the pooled TP / (TP + FP).'),
      empty: () => tr('not defined yet: no queries') },
    { id: 'ratk', name: 'R@k', formula: 'TP / (TP + FN)', num: ['TP'], den: ['TP', 'FN'], topk: true, card: 'G-topk', perQuery: true,
      ask: () => tr('Recall@k: of the relevant pages of a query, how many made it into the k shown — the mean over the queries.'),
      empty: () => tr('not defined yet: no queries') }
  ];
  // the goal metric of a contract → its bar
  const GOAL_BAR = { recallAtK: 'ratk', precisionAtK: 'patk' };
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
      if (pinned === m.id) { pinned = null; point(null); api.onCard(m.card || m.id); return; }
      pinned = m.id;
      point(m.id);
    });
  }

  let pinned = null;
  let pointed = null;
  // a pinned tooltip lets go on a press anywhere but the bars (on the tooltip itself too)
  window.addEventListener('pointerdown', (e) => {
    if (!pinned || (e.target.closest && e.target.closest('#barsBox .bar'))) return;
    pinned = null;
    point(null);
  }, true);
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
    if (m.perQuery) {   // R@k: a mean of per-query ratios; the pooled ratio of the window for comparison
      const pooled = Metrics.compute(c).recall;
      return '<b>' + m.name + '</b> = ' + tr('mean over {n} queries of', { n: last ? last.queries : 0 }) + ' ' + formulaHtml(m) +
        ' = <b class="num">' + (v === null ? '—' : v.toFixed(2)) + '</b> <span class="fine">(' + tr('pooled') + ' ' + formulaHtml(m, c) +
        ' = ' + (pooled === null ? '—' : pooled.toFixed(2)) + ')</span>';
    }
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
    tip.classList.toggle('pinned', !!m && pinned === id);
    if (!m) { tip.hidden = true; return; }
    fillTip();
    tip.hidden = false;
    placeTip(rows[id].row);
  }

  function fillTip() {
    if (!pointed || !last) return;
    const m = byId[pointed], v = last.metrics[m.id];
    tip.innerHTML = '<div class="tipF">' + filledHtml(m, last.c, v) + '</div>' +
      '<div class="tipAsk"></div><div class="tipNote fine"></div><div class="tipHint fine"></div>';
    tip.querySelector('.tipHint').textContent = pinned === pointed ? tr('Tap the bar again for its cheat sheet card, anywhere else to close this.') : '';
    tip.querySelector('.tipAsk').textContent = v === null ? m.empty() : m.ask();
    tip.querySelector('.tipNote').textContent = last.topk
      ? tr('Last {q} queries ({n} documents), at the current k.', { q: last.queries, n: last.n })
      : tr('Last {n} items, at the current threshold.', { n: last.n });
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
    const topk = !!run.topk;
    const k = State.threshold + '|' + State.k + '|' + topk + '|' + State.pileVersion + '|' + run.key + '|' + run.count + '|' + !!(run.knobs && run.knobs.formulas) + '|' + (goal ? goal.metric : '');
    if (k === key && !force) return;
    key = k;
    const c = Stream.windowCounts(run);
    const metrics = Metrics.compute(c);
    let queries = 0;
    if (topk) {
      const q = Topk.summary(State.pile, State.k);
      metrics.patk = q.pAtK;
      metrics.ratk = q.rAtK;
      queries = q.queries;
    }
    last = { c, totals: run.totals, metrics, n: State.pile.length, topk, queries };
    for (const o in cells) {
      cellNums[o].win.textContent = c[o];
      cellNums[o].all.textContent = tr('all {n}', { n: run.totals[o] });
      cells[o].title = CELL_TEXT[o]() + ' ' + (topk
        ? tr('{w} in the last {n} documents at the current k; {a} decided this way since the start.', { w: c[o], n: last.n, a: run.totals[o] })
        : tr('{w} in the last {n} items at the current threshold; {a} decided this way since the start.', { w: c[o], n: last.n, a: run.totals[o] }));
    }
    $('matrixNote').textContent = topk ? tr('last {q} queries', { q: queries }) : tr('last {n}', { n: last.n });
    const formulas = !!(run.knobs && run.knobs.formulas);
    barsBox.classList.toggle('formulas', formulas);
    const goalBar = goal ? GOAL_BAR[goal.metric] || goal.metric : null;
    for (const m of METRICS) {
      const r = rows[m.id];
      r.row.hidden = !!m.topk !== topk;
      if (r.row.hidden) continue;
      const v = metrics[m.id];
      r.fill.style.width = v === null ? '0%' : (v * 100).toFixed(1) + '%';
      r.val.textContent = fmt(v);
      r.row.title = v === null ? m.empty() : '';
      const target = goalBar === m.id ? run.goalTarget : null;
      r.tick.hidden = target === null;
      if (target !== null) {
        r.tick.style.left = (target * 100).toFixed(1) + '%';
        r.tick.title = tr('Target {v}', { v: target.toFixed(2) });
      }
      r.row.classList.toggle('goal', target !== null);
      r.row.classList.toggle('broken', target !== null && v !== null && v < target - 1e-12);
      if (formulas) r.formula.innerHTML = (m.perQuery ? tr('mean per query') + ' ' + formulaHtml(m) : formulaHtml(m, c)) + ' = ' + fmt(v);
    }
    if (pointed) fillTip();
  }

  function reset() { pinned = null; point(null); key = ''; }

  const api = { update, reset, point, METRICS, onCard: () => {} };
  return api;
})();
