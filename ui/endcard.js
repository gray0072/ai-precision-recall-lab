'use strict';

// ============================================================
// AI Precision Recall Lab — the campaign's end card (spec 04 §3, 03 §2 "C12's star rules"): after the big
// pitch is won, fireworks (ui/fireworks.js), "Cutoff & Co. is now a unicorn", the total stars, the titles
// earned (END_TITLES in data/contracts.js: the campaign finished, ★★★ on every contract on one level, C12 won
// on Hard) and the way on: Play again on Hard (default; it sets the difficulty), the map, the start screen.
// Reads Campaign; game.js passes what the buttons do.
// ============================================================

const EndCard = (() => {
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // the titles earned now
  function titles() {
    const lastId = CONTRACT_ORDER[CONTRACT_ORDER.length - 1];
    const has = {
      done: Campaign.bestStars(lastId) >= 1,
      allStars: DIFFICULTY_ORDER.some((lvl) => CONTRACT_ORDER.every((id) => { const r = Campaign.record(id, lvl); return r && r.stars >= 3; })),
      hard: (() => { const r = Campaign.record(lastId, 'hard'); return !!(r && r.stars >= 1); })()
    };
    return END_TITLES.filter((t) => has[t.id]);
  }

  function show(actions) {
    const box = $('endCard');
    box.textContent = '';
    box.appendChild(el('h1', 'logo', tr('Cutoff & Co. is now a unicorn')));
    box.appendChild(el('p', 'tagline', tr('Twelve clients, one line each. You moved it for precision and for recall, for prices and base rates, against drift and a fraud ring, and per query.')));
    const all = 3 * DIFFICULTY_ORDER.length * CONTRACT_ORDER.length;
    box.appendChild(el('p', 'endStars', '★ ' + tr('{n} of {all} stars', { n: Campaign.totalStars(), all })));
    const list = el('div', 'endTitles');
    for (const t of titles()) {
      const card = el('div', 'endTitle');
      card.appendChild(el('b', '', tr(t.name)));
      card.appendChild(el('span', 'fine', tr(t.text)));
      list.appendChild(card);
    }
    box.appendChild(list);
    box.appendChild(el('p', 'fine', State.difficulty === 'hard'
      ? tr('Every contract can be replayed for more stars.')
      : tr('Play again on Hard? A faster belt, a weaker model, stricter goals — and no warning before incidents.')));
    $('endHardBtn').hidden = State.difficulty === 'hard';
    $('endHardBtn').classList.toggle('default', State.difficulty !== 'hard');
    $('endMapBtn').classList.toggle('default', State.difficulty === 'hard');
    $('endHardBtn').onclick = () => { Fireworks.stop(); actions.hard(); };
    $('endMapBtn').onclick = () => { Fireworks.stop(); actions.map(); };
    $('endStartBtn').onclick = () => { Fireworks.stop(); actions.start(); };
    Screens.show('end');
    Fireworks.start();
  }

  return { show, titles };
})();
