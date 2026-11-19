'use strict';

// ============================================================
// AI Precision Recall Lab — the shared state (spec 05 §4): plain globals in one place; every other file
// reads and changes it here. I01 holds only the screen and the difficulty; the run, the belt, the pile and
// the thresholds are filled in by I02 / I03. No drawing, no DOM, no sound.
// ============================================================

const State = {
  screen: 'start',              // 'start' | 'map' | 'sandbox' | 'glossary' | … (game.js changes it)
  difficulty: DIFFICULTY_DEFAULT,
  run: null,                    // the contract or sandbox run in progress (I02 / I03)
  belt: [],                     // items riding the belt
  pile: [],                     // the rolling window of decided items
  threshold: 0.5,               // the player's threshold t, 0.00–1.00 in steps of 0.01
  review: null                  // the review band and queue, once unlocked (I05)
};
