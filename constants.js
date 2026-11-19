'use strict';

// ============================================================
// AI Precision Recall Lab — gameplay tuning values, one place for all of them (AGENTS.md "Game constants").
// Read by sim/, campaign.js, the UI and the tests (tests/load.js). Purely visual constants stay in art/ and
// render/; content tables (scenarios, contracts, upgrades) live in data/. The model and metrics block of
// spec 02 §8 is added by I02.
// ============================================================

// ---------- Difficulty (spec 01 §10) ----------
// speed           factor on the arrival rate and the belt speed
// tint            the true class shows as a faint tint on the belt
// dPrime          added to the model separation d' of every scenario
// ghost           when the cost-optimal ghost line shows: 'always' (true posterior), 'calibration' (after the
//                 Calibration upgrade), 'never'
// goalShift       added to every goal target (−0.05 = easier)
// outbreakExtra   added to the outbreak allowance (items)
// warnS           seconds of warning before an incident (0 = none)
// deskShift       review desk capacity in levels relative to what was bought (min level I)
// profitCurve     the profit curve is shown during play
const DIFFICULTIES = {
  easy:   { speed: 0.75, tint: true,  dPrime: 0.2,  ghost: 'always',      goalShift: -0.05, outbreakExtra: 2,  warnS: 10, deskShift: 1,  profitCurve: true },
  medium: { speed: 1,    tint: false, dPrime: 0,    ghost: 'calibration', goalShift: 0,     outbreakExtra: 0,  warnS: 10, deskShift: 0,  profitCurve: false },
  hard:   { speed: 1.3,  tint: false, dPrime: -0.2, ghost: 'never',       goalShift: 0.02,  outbreakExtra: -1, warnS: 0,  deskShift: -1, profitCurve: false }
};
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];   // the order of the toggle row
const DIFFICULTY_DEFAULT = 'medium';                   // a first visit

// ---------- Page ----------
const CURSOR_HIDE_MS = 2000;   // ms the mouse must stay still in fullscreen before the cursor hides (core/cursor.js)
const BANNER_MS = 2200;        // ms a short banner message stays on screen
