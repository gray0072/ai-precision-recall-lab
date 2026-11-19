'use strict';

// ============================================================
// AI Precision Recall Lab — the shared state (spec 05 §4): plain globals in one place; every other file
// reads and changes it here. The run (a sandbox from I03, a contract from I04), the items riding the belt,
// the pile (the rolling window of decided items), the threshold, the pause and the live panel's highlight.
// No drawing, no DOM, no sound.
// ============================================================

const State = {
  screen: 'start',              // 'start' | 'map' | 'briefing' | 'contract' | 'results' | 'sandbox' | 'glossary' (game.js)
  difficulty: DIFFICULTY_DEFAULT,
  // The run in progress (sim/sandbox.js or sim/contract.js builds it):
  //   { kind, scenario, model, platt, key ('s' raw | 'p' calibrated), val (validation set), curves,
  //     source () → the next item or null, next (the item waiting to arrive), clock (s of run time),
  //     travelS (s from entry to the gate), window (pile size), totals (counts of the decisions made),
  //     count (items decided), frozen (the belt stands still), prices }
  run: null,
  belt: [],                     // items riding the belt, oldest first: { …item, enter (clock at entry) }
  pile: [],                     // the rolling window of decided items, oldest first: { …item, flagged, outcome }
  pileVersion: 0,               // bumped whenever the pile's contents change (the renderer caches its layout)
  threshold: 0.5,               // the player's threshold t, 0.00–1.00 in steps of 0.01
  paused: false,                // the pause dialog is open (01 §12): the belt, the stream and the timers stop
  held: false,                  // a coach mark is waiting for the player (01 §13): the stream stops, the line still moves
  highlight: null,              // the live panel points at a metric: { id, num: ['TP'], den: ['TP', 'FP'] }
  review: null                  // the review desk of the run (sim/review.js): band edge, queue, level; null without one
};
