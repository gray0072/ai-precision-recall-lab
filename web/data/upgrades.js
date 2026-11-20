'use strict';

// ============================================================
// AI Precision Recall Lab — the Lab's upgrades (spec 01 §5, 03 §3), in the order the Lab lists them. Each one:
// its id, name, what it does (effect), a line on why it works in real ML (why), what it needs first, and its
// kind (the price is UPGRADE_PRICES[id]): 'dprime' (adds to the separation d' of a family's model: family null = every family), 'calibration'
// (Platt scaling: calibrated p on the badges), 'monitor' (the drift monitor: PSI, the alert, Retrain, the
// "recent" curve) or 'review' (the review desk at a level). Prices and d' bonuses live in constants.js
// (UPGRADE_PRICES, UPGRADE_DATA_DPRIME, UPGRADE_FEATURE_DPRIME). FAMILIES names the scenario families the
// Lab's model cards show. Plain data, no logic; the texts are the English source and go through tr() where
// they are shown. Used by sim/model.js (the bonus of the owned upgrades), campaign.js, ui/lab.js, the briefing.
// ============================================================

const UPGRADES = [
  { id: 'U-data-1', name: 'More data I', kind: 'dprime', family: null, dPrime: UPGRADE_DATA_DPRIME, needs: null,
    effect: "d' +0.25 for every model",
    why: 'More labelled examples let the model learn finer patterns: the two humps move apart.' },
  { id: 'U-data-2', name: 'More data II', kind: 'dprime', family: null, dPrime: UPGRADE_DATA_DPRIME, needs: 'U-data-1',
    effect: "d' +0.25 for every model",
    why: 'Each new batch of labels helps a bit less than the one before, and costs more to collect.' },
  { id: 'U-data-3', name: 'More data III', kind: 'dprime', family: null, dPrime: UPGRADE_DATA_DPRIME, needs: 'U-data-2',
    effect: "d' +0.25 for every model",
    why: 'Rare cases finally get enough examples: the overlap in the middle shrinks.' },
  { id: 'U-feat-text', name: 'Text features', kind: 'dprime', family: 'text', dPrime: UPGRADE_FEATURE_DPRIME, needs: null,
    effect: "d' +0.4 for the text models (Inbox Guard, Comment Patrol, Search Ranker)",
    why: 'Word patterns and sender reputation carry signal the old model never saw.' },
  { id: 'U-feat-sensor', name: 'Sensor features', kind: 'dprime', family: 'sensor', dPrime: UPGRADE_FEATURE_DPRIME, needs: null,
    effect: "d' +0.4 for the sensor models (Fever Gate, Bolt Inspector)",
    why: 'A thermal camera and ultrasound measure what a quick look cannot.' },
  { id: 'U-feat-behaviour', name: 'Behaviour features', kind: 'dprime', family: 'behaviour', dPrime: UPGRADE_FEATURE_DPRIME, needs: null,
    effect: "d' +0.4 for the behaviour model (Card Watch)",
    why: 'The device, the payment speed and the merchant history give a fraud away.' },
  { id: 'U-calib', name: 'Calibration (Platt scaling)', kind: 'calibration', needs: null,
    effect: 'Badges show calibrated probabilities p; the best line for the prices on Easy and Medium; a reliability diagram on the results',
    why: 'A logistic fit on the validation set turns a raw score into "how often items like this are positive". The ranking does not change.' },
  { id: 'U-drift', name: 'Drift monitor', kind: 'monitor', needs: null,
    effect: 'A PSI chart and an alert when the scores stop looking like the validation set; Retrain once per contract; the "recent" curve',
    why: 'A model is measured on old data. Watching the score distribution tells you when the world has moved.' },
  { id: 'U-review-1', name: 'Review desk I', kind: 'review', level: 1, needs: null,
    effect: 'A review band under the threshold: people decide those items, always right, $1 each, 0.25 items per second',
    why: 'Let the model decide where it is sure and send the doubtful middle to people.' },
  { id: 'U-review-2', name: 'Review desk II', kind: 'review', level: 2, needs: 'U-review-1',
    effect: 'More reviewers: 0.4 items per second',
    why: 'A bigger desk keeps up with a wider band.' },
  { id: 'U-review-3', name: 'Review desk III', kind: 'review', level: 3, needs: 'U-review-2',
    effect: 'A full team: 0.6 items per second',
    why: 'With enough people the band can be wide without the desk running full.' }
];

const FAMILIES = [
  { id: 'text', name: 'Text models', scenarios: ['spam', 'moderation', 'retrieval'] },
  { id: 'sensor', name: 'Sensor models', scenarios: ['fever', 'bolts'] },
  { id: 'behaviour', name: 'Behaviour models', scenarios: ['fraud'] }
];
