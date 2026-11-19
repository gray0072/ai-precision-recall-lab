# ADR-0005 — The drift monitor: PSI over 5 quantile bins of the last 80 scores, alert after 10 decisions in a row

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I05

## Context
Spec 02 §6.2 described the drift monitor with the textbook PSI: 10 bins at the deciles of the validation set, the rolling window (the last 200 decided items), an alert at PSI > 0.2. The I05 plan asked for the alert "within ~40 items" of C09's drift (shift 1.2 at item 120).

A simulation over 200 streams per setting (spam, π 0.25, d′ 2.4, quantized scores) showed that this cannot work in a contract of a few hundred items:
- PSI is quadratic in the share of changed items. Drift moves only the positives (25 % of the stream), so even a fully drifted window gives PSI ≈ 0.2 at shift 1.2. A window that is 40 items into the drift (20 % of 200) stays far below the alert.
- On small windows PSI is mostly sampling noise: about (bins − 1) / n. At 10 bins the median at rest is 0.16 on 60 items and 0.09 on 100. A short window alerts on half the clean streams.
- Whatever the window, the alert came about one window after the drift began.

## Options
1. **Textbook PSI on the 200-item window**: honest, but it alerts on only ~80 % of drifted streams, about 150 items late. By then the contract is nearly over and Retrain pays for nothing.
2. **A statistic other than PSI** (a KS test, CUSUM on the mean score): faster, but PSI is what the industry uses and what the cheat sheet teaches.
3. **PSI with fewer bins, a shorter window and a persistence rule**: 5 quantile bins halve the noise; a window of 80 decided items; the alert after 10 decisions in a row above 0.2 removes the noisy spikes. Plus a drift strong enough to see (C09: shift 2.0 at item 80, a 400-item contract).

## Decision
Option 3: `PSI_BINS` = 5, `PSI_WINDOW` = 80, `PSI_PERSIST` = 10, `PSI_ALERT` stays 0.2. The bins are cut at the quantiles of the validation set's raw scores; a cut on a tie counts the real share. Measured: no alert before the drift on 99.5 % of streams, an alert on a clean 320-item stream 2.5 % of the time, and after a shift of 2.0 the median alert comes 80 items after the drift starts (90th percentile about 100). C09's drift was made stronger (2.0) and earlier (item 80), and the contract longer (400 items), so that a player who retrains at the alert has about 150 items of a working model left.

## Consequences
- The acceptance criterion of I05 reads "within about one PSI window (~80 items)" instead of "~40 items". Spec 02 §6.2, 03 §2 and the cheat sheet card G-drift are updated.
- The lesson stays true: a monitor that watches only the scores reacts late, and the live ring and the dashed "recent" curves drift off the model curve before PSI crosses 0.2. That is the C09 quick question ("the live dot drifts away from the ROC curve").
- Retuning is constants only (`constants.js`). `Incidents.alertIndex` lets the balance check and the tests replay the monitor headless.
