'use strict';

// ============================================================
// AI Precision Recall Lab — the campaign's progress (spec 01 §2, §4, §14, §15; 05 §5): the balance, the
// upgrades bought in the Lab (which opens after C01; buy emits purchase), the stars and bests per contract and difficulty, the quiz bonuses paid, the coach
// marks seen, the contracts opened by a cheat and the cheated flag of the save. Unlocks: C01 is always open,
// contract N+1 opens when contract N has at least one star on any level (Act 2 after C05, Act 3 after C09).
// Money (01 §4): a contract's own money always counts (it can be negative, the balance never falls below $0);
// the fee is paid on completion, and on a replay only for more stars on that level than before; the quiz
// bonus once per contract. A cheated run pays only its own money and never updates stars or bests.
// Persistence goes through a storage object given to init() ({ load() → object | null, save(object),
// remove() }; game.js passes prLab.campaign.v1 in localStorage), so this file runs headless in the tests.
// No drawing, no DOM, no sound.
// ============================================================

const Campaign = (() => {
  let storage = { load: () => null, save: () => {}, remove: () => {} };
  let data = defaults();
  let exists = false;

  function defaults() {
    return { money: 0, upgrades: [], contracts: {}, quiz: {}, coach: [], lent: [], opened: [], cheated: false };
  }

  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const ids = (list, known) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string' && (!known || known(x))) : []);

  // A save read from storage, checked field by field: anything broken or unknown takes the default.
  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    d.money = isNum(raw.money) ? Math.max(0, Math.round(raw.money * 100) / 100) : 0;
    d.upgrades = ids(raw.upgrades, (id) => UPGRADES.some((u) => u.id === id));
    d.coach = ids(raw.coach);
    d.lent = ids(raw.lent);
    d.opened = ids(raw.opened, (id) => !!CONTRACTS[id]);
    d.cheated = raw.cheated === true;
    if (raw.quiz && typeof raw.quiz === 'object') for (const id in raw.quiz) if (CONTRACTS[id] && raw.quiz[id] === true) d.quiz[id] = true;
    if (raw.contracts && typeof raw.contracts === 'object') {
      for (const id in raw.contracts) {
        if (!CONTRACTS[id] || !raw.contracts[id] || typeof raw.contracts[id] !== 'object') continue;
        for (const lvl of DIFFICULTY_ORDER) {
          const r = raw.contracts[id][lvl];
          if (!r || !isNum(r.stars)) continue;
          (d.contracts[id] = d.contracts[id] || {})[lvl] = {
            stars: clamp(Math.round(r.stars), 0, 3), best: isNum(r.best) ? r.best : null
          };
        }
      }
    }
    return d;
  }

  function init(store) {
    storage = store;
    const raw = storage.load();
    exists = raw !== null && raw !== undefined;
    data = sanitize(raw);
  }
  function save() { exists = true; storage.save(JSON.parse(JSON.stringify(data))); }

  // New campaign: a fresh save (only the campaign key; the settings stay)
  function reset() {
    storage.remove();
    data = defaults();
    save();
  }

  // ---------- reading ----------
  function record(id, difficulty) {
    const c = data.contracts[id];
    return (c && c[difficulty]) || null;
  }
  // the most stars on any level (the map's unlocks)
  function bestStars(id) {
    const c = data.contracts[id];
    if (!c) return 0;
    return Math.max(0, ...DIFFICULTY_ORDER.map((l) => (c[l] ? c[l].stars : 0)));
  }
  function played(id) { return !!data.contracts[id]; }
  function unlocked(id) {
    const def = CONTRACTS[id];
    if (!def || def.soon) return false;
    const i = CONTRACT_ORDER.indexOf(id);
    return i === 0 || data.opened.includes(id) || bestStars(CONTRACT_ORDER[i - 1]) >= 1;
  }
  // the next contract after this one, if it is open (the results' "Next contract")
  function nextOpen(id) {
    const n = CONTRACT_ORDER[CONTRACT_ORDER.indexOf(id) + 1];
    return n && unlocked(n) ? n : null;
  }
  function totalStars() {
    let n = 0;
    for (const id in data.contracts) for (const l of DIFFICULTY_ORDER) if (data.contracts[id][l]) n += data.contracts[id][l].stars;
    return n;
  }

  // ---------- a finished contract ----------
  // r = Contract.results(run); quizRight = the briefing's question was answered right in this attempt.
  // Returns what was paid and what changed: { contract, fee, quiz, total, balance, stars, prevStars,
  // newBest, recorded }.
  function finish(r, quizRight) {
    const prev = record(r.id, r.difficulty);
    const out = { contract: r.money, fee: 0, quiz: 0, total: 0, balance: 0, stars: r.stars, prevStars: prev ? prev.stars : null, newBest: false, recorded: false };
    if (r.completed && !r.cheated) {
      if (!prev || r.stars > prev.stars) out.fee = CONTRACTS[r.id].fee;
      if (quizRight && !data.quiz[r.id]) { out.quiz = QUIZ_BONUS; data.quiz[r.id] = true; }
    }
    if (!r.cheated && r.completed) {
      const rec = (data.contracts[r.id] = data.contracts[r.id] || {});
      out.newBest = !prev || prev.best === null || r.money > prev.best;
      rec[r.difficulty] = {
        stars: Math.max(r.stars, prev ? prev.stars : 0),
        best: out.newBest ? r.money : prev.best
      };
      out.recorded = true;
    }
    out.total = Math.round((out.contract + out.fee + out.quiz) * 100) / 100;
    data.money = Math.max(0, Math.round((data.money + out.total) * 100) / 100);
    out.balance = data.money;
    save();
    return out;
  }

  // ---------- the Lab (01 §5, 03 §3) ----------
  // the Lab opens after C01 (a star on it on any level), or once the save has an upgrade (the cheat U)
  function labOpen() { return bestStars('C01') >= 1 || data.upgrades.length > 0; }
  function owns(id) { return data.upgrades.includes(id); }
  // an upgrade's state in the Lab: 'bought', 'locked' (needs another one first), 'poor' (not enough money), 'buy'
  function upgradeState(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return 'locked';
    if (owns(id)) return 'bought';
    if (u.needs && !owns(u.needs)) return 'locked';
    return data.money >= UPGRADE_PRICES[id] ? 'buy' : 'poor';
  }
  // buys an upgrade for its price; kept for the whole campaign; emits purchase. false when it cannot be bought.
  function buy(id) {
    if (upgradeState(id) !== 'buy') return false;
    data.money = Math.round((data.money - UPGRADE_PRICES[id]) * 100) / 100;
    data.upgrades.push(id);
    save();
    GameEvents.emit('purchase', { upgrade: id });
    return true;
  }
  // the cheat U: every upgrade, free; the save becomes a "test save"
  function buyAll() {
    for (const u of UPGRADES) if (!owns(u.id)) data.upgrades.push(u.id);
    data.cheated = true;
    save();
  }
  // the owned upgrade ids (a copy, for Contract.start and the briefing)
  function upgrades() { return data.upgrades.slice(); }

  // ---------- coach marks, cheats ----------
  function coachSeen(id) { return data.coach.includes(id); }
  function markCoach(id) { if (!coachSeen(id)) { data.coach.push(id); save(); } }
  // the cheat M: money, and the whole save becomes a "test save"
  function addMoney(n) { data.money = Math.round((data.money + n) * 100) / 100; data.cheated = true; save(); }
  // the cheats 1–9, 0, -, = on the map: open a contract directly
  function open(id) { if (CONTRACTS[id] && !data.opened.includes(id)) { data.opened.push(id); save(); } }
  function markCheated() { data.cheated = true; save(); }

  return {
    defaults, sanitize, init, save, reset, record, bestStars, played, unlocked, nextOpen, totalStars, finish,
    labOpen, owns, upgradeState, buy, buyAll, upgrades,
    coachSeen, markCoach, addMoney, open, markCheated,
    get exists() { return exists; }, get money() { return data.money; }, get cheated() { return data.cheated; },
    get data() { return data; }
  };
})();
