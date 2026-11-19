# ADR-0004 — Curves and AUC on the raw score; a threshold on calibrated p maps to a raw threshold

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I02

## Context
Spec 02 §2.1 rounds every score to 0.01 so that the badge is exactly what the gate decides, and 02 §2.3 rounds the calibrated `p` the same way. The cheat sheet teaches that calibration is a monotone map and "changes no ranking, no curve and no AUC".

Rounding breaks that promise if the curves are computed on `p`: a steep part of the Platt map squeezes several raw scores into one `p` (with Card Watch's Platt fit every raw score up to about 0.2 becomes `p = 0.01`), the merged items become ties, and the trapezoid over the tied ROC points cuts corners. Measured on a 4 000-item validation set: ROC AUC 0.927 on `s` but 0.905 on `p` for Card Watch, 0.916 → 0.905 for Fever Gate.

## Options
1. **Curves on `p` when calibrated**: simple. Cons: the AUC drops when the player buys Calibration, which teaches the opposite of the lesson.
2. **Keep `p` unrounded**: the curve is unchanged. Cons: the badge (two decimals) and the decision differ near the line, the very thing the 0.01 grid was introduced to prevent.
3. **Curves on the raw score, the threshold on `p` mapped to a raw threshold**: the rounded `p` is a monotone non-decreasing function of `s`, so the items with `p ≥ t` are exactly the items with `s ≥ s_t` for the smallest grid score `s_t` whose `p` is ≥ `t`. Every operating point on the `p` axis is therefore a vertex of the raw ROC / PR curve. Cons: a lookup (`Model.rawThreshold`) between the two axes; at the low end of `p` several raw thresholds are not reachable any more (the player cannot separate items that all show `p = 0.01`).

## Decision
Option 3. The ROC, PR and profit curves, ROC AUC and AP are always computed on the raw score `s` (the model's ranking). With Calibration the gate and the rolling window compare the rounded `p` with `t`, and the operating point is drawn at the curve's point for `Model.rawThreshold(t, platt)`; a test checks that both give the same matrix.

## Consequences
- Calibration changes no curve and no AUC, as the cheat sheet says; the badge still shows exactly what is decided.
- With Calibration the operating point moves in coarser steps where the Platt map is steep; the sandbox may show that as a teaching moment ("these items all have p = 0.01: no threshold can separate them").
- Reversal: computing the curves on `p` is a one-argument change (`key = 'p'`) in `sim/metrics.js`.
