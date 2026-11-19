'use strict';

// ============================================================
// AI Precision Recall Lab — the scenarios (spec 03 §1): who the client is, what the positive (hunted) class
// is, the base rate π, the base separation d', the model's temperament (γ, β: how miscalibrated the raw score
// is, 02 §2.1) and the family the Lab's feature upgrades act on. Plain data, no logic; texts are the English
// source and go through tr() where they are shown. Used by sim/model.js, sim/stream.js, the screens, the tests.
// ============================================================

const SCENARIOS = {
  spam: {
    id: 'spam', name: 'Inbox Guard', client: 'Pigeon Post', clientNote: 'a mail service',
    positive: 'spam letter', negative: 'ordinary letter',
    prevalence: 0.25, dPrime: 2.2, gamma: 1.5, beta: 0.3, family: 'text'      // overconfident, a bit high
  },
  fever: {
    id: 'fever', name: 'Fever Gate', client: 'Harbor Clinic', clientNote: "a port's health service",
    positive: 'feverish passenger', negative: 'healthy passenger',
    prevalence: 0.05, dPrime: 2.0, gamma: 0.8, beta: -0.6, family: 'sensor'   // timid, low
  },
  bolts: {
    id: 'bolts', name: 'Bolt Inspector', client: 'Boltworks', clientNote: 'a factory',
    positive: 'cracked bolt', negative: 'good bolt',
    prevalence: 0.12, dPrime: 2.4, gamma: 1.2, beta: -0.2, family: 'sensor'
  },
  fraud: {
    id: 'fraud', name: 'Card Watch', client: 'Coinpurse Bank', clientNote: 'a bank',
    positive: 'fraudulent payment', negative: 'genuine payment',
    prevalence: 0.03, dPrime: 2.2, gamma: 1.8, beta: 0.8, family: 'behaviour', // overconfident, very high
    amounts: true                                                              // items carry a payment amount (02 §2.4)
  },
  moderation: {
    id: 'moderation', name: 'Comment Patrol', client: 'Chatterbox', clientNote: 'a social network',
    positive: 'toxic comment', negative: 'fine comment',
    prevalence: 0.15, dPrime: 1.6, gamma: 1.0, beta: 0, family: 'text'
  },
  retrieval: {
    id: 'retrieval', name: 'Search Ranker', client: 'Seekwell Search', clientNote: 'a search engine',
    positive: 'relevant document', negative: 'irrelevant document',
    prevalence: null, relevant: [2, 8],                                        // 2–8 relevant of TOPK_DOCS per query (02 §7)
    dPrime: 1.8, gamma: 1.0, beta: 0, family: 'text'
  },
  // the sandbox and the attract demo: dots instead of drawings, a neutral temperament (s = σ(z))
  abstract: {
    id: 'abstract', name: 'Abstract', client: null, clientNote: null,
    positive: 'positive', negative: 'negative',
    prevalence: 0.3, dPrime: 2.0, gamma: 1.0, beta: 0, family: null
  }
};
