'use strict';

// ============================================================
// AI Precision Recall Lab — the campaign map (spec 01 §2, 04 §3): the three acts as rows of contract cards.
// A card shows the client's avatar, the contract's id and name, the idea it teaches (once it has been played),
// its best stars on Easy / Medium / Hard and a lock; the contracts of later iterations show as "coming soon".
// Above them the balance and a "test save" tag when the save is cheated; under them Lab (open after C01), Cheat
// sheet, Back. Cards are buttons, so the arrows move between them and Space / Enter open the briefing.
// Reads Campaign; game.js passes what a card does.
// ============================================================

const MapScreen = (() => {
  const $ = (id) => document.getElementById(id);
  const LEVEL_LETTER = { easy: 'E', medium: 'M', hard: 'H' };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // three ★ of one level: the earned ones lit
  function starsRow(n, title) {
    const row = el('span', 'stars');
    row.title = title;
    for (let i = 0; i < 3; i++) row.appendChild(el('span', i < n ? 'starOn' : 'starOff', '★'));
    return row;
  }

  function card(id, onPick) {
    const def = CONTRACTS[id];
    const open = Campaign.unlocked(id);
    const b = el('button', 'btn mapCard' + (open ? '' : ' locked'));
    b.disabled = !open;
    b.dataset.contract = id;
    const head = el('span', 'mcHead');
    head.appendChild(ClientArt.canvas(def.scenario, 40));
    const names = el('span', 'mcNames');
    names.appendChild(el('span', 'mcId', id));
    names.appendChild(el('span', 'mcName', tr(def.name)));
    names.appendChild(el('span', 'mcClient', tr(SCENARIOS[def.scenario].client)));
    head.appendChild(names);
    b.appendChild(head);
    if (def.soon) b.appendChild(el('span', 'mcIdea', tr('Coming soon')));
    else if (!open) b.appendChild(el('span', 'mcIdea', tr('Locked: earn a star on the contract before')));
    else b.appendChild(el('span', 'mcIdea', Campaign.played(id) ? tr('Teaches: {idea}', { idea: tr(def.teaches) }) : tr('New contract')));
    if (!def.soon) {
      const levels = el('span', 'mcLevels');
      for (const lvl of DIFFICULTY_ORDER) {
        const rec = Campaign.record(id, lvl);
        const cell = el('span', 'mcLevel');
        cell.appendChild(el('span', 'mcLetter', LEVEL_LETTER[lvl]));
        cell.appendChild(starsRow(rec ? rec.stars : 0, tr(lvl === 'easy' ? 'Easy' : lvl === 'medium' ? 'Medium' : 'Hard')));
        levels.appendChild(cell);
      }
      b.appendChild(levels);
    }
    if (open) b.addEventListener('click', () => onPick(id));
    return b;
  }

  function show(onPick) {
    $('mapBalance').textContent = '💰 ' + tr('Balance {m}', { m: '$' + Math.round(Campaign.money).toLocaleString('en-US').replace(/,/g, ' ') });
    $('mapTestSave').hidden = !Campaign.cheated;
    $('mapTestSave').title = tr('Debug cheats were used in this campaign.');
    $('mapNote').textContent = tr('Pick a contract. Each one opens the next once it has at least one star. Stars: {n} of {all}.',
      { n: Campaign.totalStars(), all: 3 * DIFFICULTY_ORDER.length * CONTRACT_ORDER.length });
    const acts = $('mapActs');
    acts.textContent = '';
    for (const act of ACTS) {
      const sec = el('section', 'mapAct');
      sec.appendChild(el('h2', '', tr('Act {n} — {name}', { n: act.id, name: tr(act.name) })));
      const row = el('div', 'mapRow');
      for (const id of act.contracts) row.appendChild(card(id, onPick));
      sec.appendChild(row);
      acts.appendChild(sec);
    }
    $('mapLabBtn').title = Campaign.labOpen() ? tr('Spend money on upgrades of the models') : tr('The Lab opens after the first contract');
    $('mapLabBtn').classList.toggle('secondary', !Campaign.labOpen());
    Screens.show('map');
    // the default card (Enter plays on): the first open contract with no star yet, else the first one without
    // ★★★ on the current level
    const stars = (id) => { const r = Campaign.record(id, State.difficulty); return r ? r.stars : 0; };
    const next = CONTRACT_ORDER.find((id) => Campaign.unlocked(id) && Campaign.bestStars(id) === 0) ||
      CONTRACT_ORDER.find((id) => Campaign.unlocked(id) && stars(id) < 3) || 'C01';
    const btn = acts.querySelector('[data-contract="' + next + '"]');
    if (btn && !btn.disabled) btn.classList.add('default');
  }

  return { show, starsRow };
})();
