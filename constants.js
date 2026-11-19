'use strict';

// ============================================================
// AI Precision Recall Lab — gameplay tuning values, one place for all of them (AGENTS.md "Game constants").
// Read by sim/, campaign.js, the UI and the tests (tests/load.js). Purely visual constants stay in art/ and
// render/; content tables (scenarios, contracts, upgrades) live in data/.
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
const MAX_FPS = 60;            // frames per second the main loop is limited to (core/utils.js frameLimiter)

// ---------- Model and metrics (spec 02 §8) ----------
const BELT_TRAVEL_S = 6;       // seconds from entry to the gate at ×1
const PILE_WINDOW = 200;       // items in the pile and the rolling window (02 §3.4)
const GOAL_GRACE_ITEMS = 30;   // items before the goal chip shows a colour
const N_VAL = 4000;            // validation set size (02 §2.2)
const D_PRIME_MAX = 4.5;       // cap on the effective separation d'
const SCORE_MIN = 0.01;        // scores and calibrated p are clamped to [SCORE_MIN, SCORE_MAX] (02 §2.1)
const SCORE_MAX = 0.99;
const PLATT_MAX_ITER = 25;     // Platt scaling: at most this many Newton steps (02 §2.3)
const PLATT_TOL = 1e-9;        // … and stop when a step is smaller than this
const RELIABILITY_BINS = 10;   // bins of the reliability diagram (02 §2.3)
const INCIDENT_RAMP = 20;      // items over which an incident's change ramps in (02 §6)
const PSI_ALERT = 0.2;         // PSI level of the drift alert
const RETRAIN_S = 15;          // seconds a retrain takes
const ADV_SHARE = 0.4;         // adversary: share of positives that are crafted
const ADV_LAG_S = 8;           // adversary: seconds of lag of the threshold they aim at
const ADV_MARGIN = 0.08;       // adversary: the largest margin below that threshold
const REVIEW_FEE = 1;          // $ per human review
const REVIEW_RATE = [0.25, 0.4, 0.6];   // reviews per second at desk levels I / II / III
const QUIZ_BONUS = 50;         // $ for the right answer in a briefing
const STAR3_SHARE = 0.9;       // share of the hindsight-best profit for ★★★
const TOPK_DOCS = 30;          // documents per query (02 §7)
const DEMO_SWEEP_S = 20;       // attract demo: seconds per full threshold sweep

// ---------- Payment amounts and fraud prices (spec 02 §2.4, 03 §2) ----------
// ln(amount) ~ N(AMOUNT_LOG_MEAN, AMOUNT_LOG_SD) for genuine payments, + AMOUNT_FRAUD_SHIFT for fraud;
// whole dollars, clamped to AMOUNT_MIN … AMOUNT_MAX. The median genuine payment is e^AMOUNT_LOG_MEAN = $60.
const AMOUNT_LOG_MEAN = Math.log(60);
const AMOUNT_LOG_SD = 1.1;
const AMOUNT_FRAUD_SHIFT = 0.4;
const AMOUNT_MIN = 1;
const AMOUNT_MAX = 5000;
const FRAUD_TP = 0;            // $ for a blocked fraud (the loss is prevented)
const FRAUD_FP = -5;           // $ for a blocked genuine payment (an angry customer, the commission lost)
const FRAUD_COMMISSION = 0.02; // a passed genuine payment earns this share of its amount; a passed fraud costs the amount
