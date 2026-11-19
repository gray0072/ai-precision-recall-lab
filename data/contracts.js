'use strict';

// ============================================================
// AI Precision Recall Lab — the campaign's contracts (spec 03 §2): three acts, twelve contracts. Each one: the
// scenario (03 §1), the idea it teaches, its stream (base rate π, separation d', items, arrival rate at ×1),
// the price list per outcome (TP / FP / FN / TN, or 'fraud': the prices that depend on the amount), the goal on
// a metric over the whole contract (null = none: ★ for completing it), the outbreak allowance, the fee, the
// ★★ profit target, the client's message for the briefing and the lesson of the results screen with its cheat
// sheet card. Contracts marked `soon` arrive with later iterations (I05: Act 2, I06: Act 3) and show as
// locked cards on the map. Money and targets are tuned by tools/balance-check.js.
// Plain data, no logic; the texts are the English source and go through tr() where they are shown.
// Used by campaign.js, sim/contract.js, the map, the briefing, the results, the tests and the balance check.
// ============================================================

const ACTS = [
  { id: 1, name: 'First clients', contracts: ['C01', 'C02', 'C03', 'C04', 'C05'] },
  { id: 2, name: 'The real world', contracts: ['C06', 'C07', 'C08', 'C09'] },
  { id: 3, name: 'Scale-up', contracts: ['C10', 'C11', 'C12'] }
];

const CONTRACT_ORDER = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12'];

const CONTRACTS = {
  // ---------- Act 1 — First clients ----------
  C01: {
    id: 'C01', act: 1, name: 'First day', scenario: 'spam', teaches: 'the confusion matrix',
    prevalence: 0.25, dPrime: 2.4, items: 100, rate: 0.8,
    prices: { TP: 3, FP: -4, FN: -1, TN: 0 }, goal: null, outbreak: null, fee: 100, target: 15,
    tutorial: true,
    message: 'Welcome aboard! We carry a lot of letters, and a lot of spam. Sort our first hundred: spam to the spam folder, real letters to the inbox. A real letter lost in spam annoys our customers more than a bit of spam in the inbox.',
    lesson: 'Every decision lands in one of four cells. The second word (Positive / Negative) is what the model said; the first (True / False) is whether it was right.',
    card: 'G-matrix'
  },
  C02: {
    id: 'C02', act: 1, name: 'Never lose an invoice', scenario: 'spam', teaches: 'precision',
    prevalence: 0.25, dPrime: 2.2, items: 300, rate: 1.2,
    prices: { TP: 3, FP: -10, FN: 0, TN: 0 }, goal: { metric: 'precision', min: 0.9 }, outbreak: null, fee: 200, target: 30,
    message: 'Our customers are furious when an invoice lands in spam. A bit of spam in the inbox they can live with.',
    lesson: 'Precision asks: of what I flagged, how much was right? To raise it, raise the threshold — and pay with recall.',
    card: 'G-precision'
  },
  C03: {
    id: 'C03', act: 1, name: 'Fever gate', scenario: 'fever', teaches: 'recall',
    prevalence: 0.06, dPrime: 2.0, items: 300, rate: 1.2,
    prices: { TP: 12, FP: -1, FN: -30, TN: 0 }, goal: { metric: 'recall', min: 0.85 }, outbreak: 4, fee: 250, target: 35,
    message: 'A fever is arriving on the ships. Stop the feverish passengers at the gate: a needless check costs us a minute, a missed case can start an outbreak in the town.',
    lesson: 'Recall asks: of all the real cases, how many did I catch? High recall on a rare class means many false alarms; that is the price.',
    card: 'G-recall'
  },
  C04: {
    id: 'C04', act: 1, name: 'Bolt inspector', scenario: 'bolts', teaches: 'F1 and the trade-off',
    prevalence: 0.12, dPrime: 2.4, items: 300, rate: 1.4,
    prices: { TP: 4, FP: -3, FN: -3, TN: 0 }, goal: { metric: 'f1', min: 0.6 }, outbreak: null, fee: 250, target: 20,
    message: 'A cracked bolt that leaves the factory costs us a customer; a good bolt we scrap costs us the same. Keep both kinds of mistake down.',
    lesson: 'F1 is high only when both precision and recall are: the harmonic mean is dragged towards the weaker one.',
    card: 'G-f1'
  },
  C05: {
    id: 'C05', act: 1, name: 'Big money', scenario: 'fraud', teaches: 'cost-sensitive thresholds, amounts',
    prevalence: 0.03, dPrime: 2.2, items: 400, rate: 1.5,
    prices: 'fraud', goal: null, outbreak: null, fee: 300, target: 75,
    message: 'A missed fraud costs us its whole amount; a blocked honest customer costs $5 and some goodwill. Every honest payment that goes through earns us 2 %. Watch the amounts.',
    lesson: 'The best threshold follows the prices, not the model: with big amounts at stake, flag on smaller suspicion.',
    card: 'G-cost'
  },

  // ---------- Act 2 — The real world (I05) ----------
  C06: { id: 'C06', act: 2, name: 'The accuracy trap', scenario: 'fraud', teaches: 'accuracy on rare classes', soon: true },
  C07: { id: 'C07', act: 2, name: 'Flu season', scenario: 'fever', teaches: 'precision depends on the base rate', soon: true },
  C08: { id: 'C08', act: 2, name: 'Comment patrol', scenario: 'moderation', teaches: 'triage: a human review band', soon: true },
  C09: { id: 'C09', act: 2, name: 'Spam wave', scenario: 'spam', teaches: 'drift, monitoring, retraining', soon: true },

  // ---------- Act 3 — Scale-up (I06) ----------
  C10: { id: 'C10', act: 3, name: 'Fraud ring', scenario: 'fraud', teaches: 'adversaries game a fixed threshold', soon: true },
  C11: { id: 'C11', act: 3, name: 'Search ranker', scenario: 'retrieval', teaches: 'precision@k and recall@k, RAG', soon: true },
  C12: { id: 'C12', act: 3, name: 'The big pitch', scenario: 'spam', teaches: 'everything', soon: true }
};
