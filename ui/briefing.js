'use strict';

// ============================================================
// AI Precision Recall Lab — the briefing before a contract (spec 01 §3.1, 04 §3): the client's avatar and
// message; the terms (the price of each outcome in the outcome colours, the number of items and the speed, the
// goal with the difficulty's shift, the outbreak allowance, the incidents to expect, the review desk, the stars'
// rules with the level's ★★ target, the fee); the model card (AUC of the effective d' with the Lab's bonus, raw or
// calibrated scores, the drift monitor, the base rate in words); the quick question (03 §5): one answer, then the
// explanation; a right answer earns QUIZ_BONUS once per contract, paid on completion. Start / Back to the map.
// A top-k contract (C11) explains its queries and the k knob; a contract of phases (C12) lists each phase's
// client, prices, goal and model.
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
  function pricesTable(prices) {
    const t = el('table', 'priceTable');
    const fraud = Contract.isFraud(prices);
    const label = (o) => {
      if (!fraud) return Hud.money(prices[o]);
      return { TP: '$0', FP: Hud.money(Contract.values(prices, null).FP), FN: tr('− amount'), TN: tr('+{p} % of amount', { p: Math.round(FRAUD_COMMISSION * 100) }) }[o];
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
    if (def.phases) {
      return def.phases.map((ph, p) => tr('phase {n}: {goal}', { n: p + 1, goal: ph.goal
        ? tr(METRIC_NAMES[ph.goal.metric]) + ' ≥ ' + Contract.goalTarget(ph.goal, difficulty).toFixed(2) : tr('none') })).join('; ') +
        ' ' + tr('(each over its phase; ★ needs them all)');
    }
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
    if (def.phases) {
      def.phases.forEach((ph, p) => {
        const psc = SCENARIOS[ph.scenario];
        terms.appendChild(el('p', 'label', tr('Phase {n}: {name} ({client}), {items} {what}', { n: p + 1, name: tr(psc.name), client: tr(psc.client), items: ph.items, what: tr(psc.items) })));
        terms.appendChild(pricesTable(ph.prices));
      });
    } else terms.appendChild(pricesTable(def.prices));
    const list = el('div', 'termList');
    const minutes = Math.max(1, Math.round(def.items / (def.rate * diff.speed) / 60));
    if (def.topk) {
      row(list, tr('Queries'), tr('{n} search queries of {d} pages each, one every {s} s, about {m} min',
        { n: def.items, d: TOPK_DOCS, s: Math.round(1 / (def.rate * diff.speed)), m: minutes }));
      row(list, tr('Top-k'), tr('the knob is k: the k best-scored pages of every query go to the language model (TP: a relevant page shown, FP: an irrelevant one shown, FN: a relevant one left out)'));
    } else row(list, tr('Items'), tr('{n} {items}, about {m} min', { n: def.items, items: def.phases ? tr('items') : tr(sc.items), m: minutes }));
    row(list, tr('Goal'), goalText(def, difficulty));
    if (def.outbreak) {
      row(list, tr('Outbreak'), tr('the contract fails at {n} missed positives (FN)', { n: Contract.outbreakAllowance(def, difficulty) }));
    }
    if (Contract.isFraud(def.prices) || (def.phases && def.phases.some((ph) => Contract.isFraud(ph.prices)))) {
      row(list, tr('Amounts'), tr('every payment shows its amount; a missed fraud costs all of it'));
    }
    for (const inc of def.incidents || []) {
      row(list, tr('Incident'), tr('{name} around item {at}: {note}', { name: tr(inc.name), at: inc.at, note: tr(inc.note) }) +
        (diff.warnS ? ' ' + tr('(a warning {s} s ahead)', { s: diff.warnS }) : ' ' + tr('(no warning on Hard)')));
    }
    const owned = Campaign.upgrades();
    const level = def.topk ? 0 : Contract.deskLevel(def, difficulty, Model.deskLevelOf(owned));
    if (level) {
      const lent = def.lend && def.lend.review;
      row(list, tr('Review desk'), tr('level {lvl}{lent}: people decide the items in the band under the threshold, always right, {fee} each, one every {s} s',
        { lvl: ['', 'I', 'II', 'III'][level], lent: lent ? ' ' + tr('(lent by the client)') : '', fee: Hud.money(-REVIEW_FEE), s: (1 / REVIEW_RATE[level - 1]).toFixed(1) }));
    }
    row(list, tr('Bankrupt'), tr("the contract fails if its money falls below {m}", { m: Hud.money(-def.fee) }));
    const stars = el('span', 'starRules');
    stars.appendChild(el('span', '', '★ ' + (def.goal ? tr('goal met') : tr('completed'))));
    stars.appendChild(el('span', '', '★★ ' + tr('profit ≥ {m}', { m: Hud.money(Contract.targetOf(def, difficulty)) })));
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
    const mc = el('div', 'termList');
    const auc = (terms, bonus) => {
      const model = Contract.modelOf(terms, difficulty, bonus);
      const notes = [];
      if (bonus) notes.push(tr('Lab +{d}', { d: bonus.toFixed(2) + ' d′' }));
      if (diff.dPrime) notes.push(tr('{d} on this level', { d: (diff.dPrime > 0 ? '+' : '−') + Math.abs(diff.dPrime).toFixed(1) + ' d′' }));
      return Model.theoreticalAuc(model.dPrime).toFixed(2) + (notes.length ? ' (' + notes.join(', ') + ')' : '');
    };
    if (def.phases) {
      def.phases.forEach((ph, p) => {
        const psc = SCENARIOS[ph.scenario];
        row(mc, tr('Phase {n}', { n: p + 1 }), tr(psc.name) + ': AUC ' + auc(ph, Model.bonusOf(owned, psc.family)) + '; ' + tr(psc.baseRate, { n: Math.round(1 / ph.prevalence) }));
      });
    } else {
      row(mc, tr('Model'), tr(sc.name));
      row(mc, 'AUC', auc(def, Model.bonusOf(owned, sc.family)));
    }
    row(mc, tr('Scores'), def.topk
      ? tr('only the ranking within each query matters: calibration would change no top-k')
      : Model.hasKind(owned, 'calibration')
        ? tr('calibrated probabilities p (Platt scaling, fitted on the validation set at the start)')
        : tr('raw model scores, not calibrated probabilities'));
    const monitor = !def.topk && (Model.hasKind(owned, 'monitor') || (def.lend && def.lend.monitor));
    if (monitor) row(mc, tr('Drift monitor'), tr('PSI of the scores against the validation set, an alert above {a}, Retrain once{lent}', { a: PSI_ALERT.toFixed(1), lent: def.lend && def.lend.monitor ? ' ' + tr('(lent by the client)') : '' }));
    if (def.topk) row(mc, tr('Relevant'), tr('{a} to {b} of the {n} pages of a query are relevant', { a: TOPK_RELEVANT[0], b: TOPK_RELEVANT[1], n: TOPK_DOCS }));
    else if (!def.phases) row(mc, tr('Base rate'), tr(sc.baseRate, { n: Math.round(1 / def.prevalence) }));
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
