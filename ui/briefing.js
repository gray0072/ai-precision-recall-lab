'use strict';

// ============================================================
// AI Precision Recall Lab — the briefing before a contract (spec 01 §3.1, 04 §3): the client's avatar and
// message; the terms (the price of each outcome in the outcome colours, the number of items and the speed, the
// goal with the difficulty's shift, the outbreak allowance, the stars' rules, the fee); the model card (AUC of
// the effective d', raw scores, the base rate in words); the quick question (03 §5): one answer, then the
// explanation; a right answer earns QUIZ_BONUS once per contract, paid on completion. Start / Back to the map.
// Reads Campaign, CONTRACTS, QUIZ; game.js passes what Start and Back do.
// ============================================================

const Briefing = (() => {
  const $ = (id) => document.getElementById(id);
  let answer = null;     // the index the player picked in this briefing, or null

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // the price of each outcome, as the cells of the matrix: TP FP / FN TN
  function pricesTable(def) {
    const t = el('table', 'priceTable');
    const fraud = def.prices === 'fraud';
    const label = (o) => {
      if (!fraud) return Hud.money(def.prices[o]);
      return { TP: '$0', FP: Hud.money(FRAUD_FP), FN: tr('− amount'), TN: tr('+{p} % of amount', { p: Math.round(FRAUD_COMMISSION * 100) }) }[o];
    };
    const head = el('tr');
    head.appendChild(el('th', 'corner', tr('price per item')));
    head.appendChild(el('th', 'pos', tr('Positive')));
    head.appendChild(el('th', 'neg', tr('Negative')));
    t.appendChild(head);
    for (const [row, outs] of [[tr('Flagged'), ['TP', 'FP']], [tr('Passed'), ['FN', 'TN']]]) {
      const tr_ = el('tr');
      tr_.appendChild(el('th', '', row));
      for (const o of outs) {
        const td = el('td', 'cell' + o);
        td.appendChild(el('span', 'cName', o + ' ' + (OUTCOME_STYLE[o].right ? '✓' : '✗')));
        td.appendChild(el('b', 'num', label(o)));
        tr_.appendChild(td);
      }
      t.appendChild(tr_);
    }
    return t;
  }

  function row(list, name, value) {
    const r = el('div', 'termRow');
    r.appendChild(el('span', 'termName', name));
    const v = el('span', 'termVal');
    if (value instanceof Node) v.appendChild(value); else v.textContent = value;
    r.appendChild(v);
    list.appendChild(r);
  }

  // the goal in words: "Precision ≥ 0.90" with the difficulty's target
  function goalText(def, difficulty) {
    if (!def.goal) return tr('No metric goal: complete the contract for ★');
    return tr(METRIC_NAMES[def.goal.metric]) + ' ≥ ' + Contract.goalTarget(def.goal, difficulty).toFixed(2) + ' ' + tr('(over the whole contract)');
  }

  function show(id, difficulty, actions) {
    const def = CONTRACTS[id], sc = SCENARIOS[def.scenario], diff = DIFFICULTIES[difficulty];
    answer = null;
    const box = $('briefing');
    box.textContent = '';

    // the client and the message
    const head = el('div', 'brHead');
    head.appendChild(ClientArt.canvas(def.scenario, 64));
    const who = el('div', 'brWho');
    who.appendChild(el('div', 'brId', id + ' · ' + tr(DIFFICULTY_NAMES[difficulty])));
    who.appendChild(el('h1', '', tr(def.name)));
    who.appendChild(el('div', 'brClient', tr(sc.client) + ', ' + tr(sc.clientNote)));
    head.appendChild(who);
    box.appendChild(head);
    box.appendChild(el('blockquote', 'brMsg', tr(def.message)));

    const cols = el('div', 'brCols');
    // the terms
    const terms = el('div', 'brBox');
    terms.appendChild(el('h2', '', tr('Terms')));
    terms.appendChild(pricesTable(def));
    const list = el('div', 'termList');
    const minutes = Math.max(1, Math.round(def.items / (def.rate * diff.speed) / 60));
    row(list, tr('Items'), tr('{n} {items}, about {m} min', { n: def.items, items: tr(sc.items), m: minutes }));
    row(list, tr('Goal'), goalText(def, difficulty));
    if (def.outbreak) {
      row(list, tr('Outbreak'), tr('the contract fails at {n} missed positives (FN)', { n: Contract.outbreakAllowance(def, difficulty) }));
    }
    if (sc.amounts) row(list, tr('Amounts'), tr('every payment shows its amount; a missed fraud costs all of it'));
    row(list, tr('Bankrupt'), tr("the contract fails if its money falls below {m}", { m: Hud.money(-def.fee) }));
    const stars = el('span', 'starRules');
    stars.appendChild(el('span', '', '★ ' + (def.goal ? tr('goal met') : tr('completed'))));
    stars.appendChild(el('span', '', '★★ ' + tr('profit ≥ {m}', { m: Hud.money(def.target) })));
    stars.appendChild(el('span', '', '★★★ ' + tr('profit ≥ {p} % of the best fixed threshold in hindsight', { p: Math.round(STAR3_SHARE * 100) })));
    row(list, tr('Stars'), stars);
    const rec = Campaign.record(id, difficulty);
    row(list, tr('Fee'), rec ? tr('{m} again only for more stars than your {n} ★ on this level', { m: Hud.money(def.fee), n: rec.stars })
      : tr('{m} on completion', { m: Hud.money(def.fee) }));
    terms.appendChild(list);
    cols.appendChild(terms);

    // the model card and the quick question
    const right = el('div', 'brBox');
    right.appendChild(el('h2', '', tr('Model card')));
    const model = Contract.modelOf(def, difficulty);
    const mc = el('div', 'termList');
    row(mc, tr('Model'), tr(sc.name));
    row(mc, 'AUC', Model.theoreticalAuc(model.dPrime).toFixed(2) + (diff.dPrime ? ' ' + tr('({d} on this level)', { d: (diff.dPrime > 0 ? '+' : '−') + Math.abs(diff.dPrime).toFixed(1) + ' d′' }) : ''));
    row(mc, tr('Scores'), tr('raw model scores, not calibrated probabilities'));
    row(mc, tr('Base rate'), tr(sc.baseRate, { n: Math.round(1 / def.prevalence) }));
    if (diff.tint) row(mc, tr('Easy'), tr('a faint tint gives away the true class; a dashed line shows the best threshold for the prices'));
    right.appendChild(mc);
    const q = QUIZ[id];
    if (q) right.appendChild(quiz(id, q));
    cols.appendChild(right);
    box.appendChild(cols);

    $('briefStartBtn').onclick = () => actions.start(answer !== null && answer === q.answer);
    $('briefBackBtn').onclick = actions.back;
    Screens.show('briefing');
  }

  function quiz(id, q) {
    const box = el('div', 'quiz');
    box.appendChild(el('h2', '', tr('Quick question')));
    box.appendChild(el('p', 'quizQ', tr(q.question)));
    const opts = el('div', 'quizOpts');
    const note = el('p', 'fine quizNote', Campaign.data.quiz[id] ? tr('Bonus already earned on this contract.')
      : tr('A right answer earns {m} on completion. You can skip it.', { m: Hud.money(QUIZ_BONUS) }));
    q.options.forEach((o, i) => {
      const b = el('button', 'btn toggle quizOpt', tr(o));
      b.addEventListener('click', () => {
        if (answer !== null) return;
        answer = i;
        opts.querySelectorAll('button').forEach((x, j) => {
          x.disabled = true;
          if (j === q.answer) x.classList.add('right');
          else if (j === i) x.classList.add('wrong');
        });
        note.textContent = (i === q.answer ? tr('Right!') + ' ' : tr('Not quite.') + ' ') + tr(q.explain);
        note.classList.add(i === q.answer ? 'good' : 'bad');
        $('briefStartBtn').focus();
      });
      opts.appendChild(b);
    });
    box.appendChild(opts);
    box.appendChild(note);
    return box;
  }

  return { show };
})();

const DIFFICULTY_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
