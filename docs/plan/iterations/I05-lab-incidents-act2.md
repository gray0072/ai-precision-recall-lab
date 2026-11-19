# I05 — The Lab, incidents, review desk, Act 2

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I04 |
| **Parallel with** | — |
| **Spec** | [01 §5, §6](../../spec/01-gameplay.md), [02 §2.3, §5.2, §6.1, §6.2, §6.4](../../spec/02-model-and-metrics.md), [03 §2 (Act 2), §3](../../spec/03-content.md) |

## Goal
Money buys upgrades that visibly change the model; Act 2 (C06–C09) plays with the accuracy trap, a base rate shift, the review desk and drift.

## You will learn
What more data and features do to the score distributions and the ROC; calibration and how it goes stale; why precision moves with the base rate; triage with a human review band; PSI as a drift signal; retraining.

## Tasks
- [ ] `data/upgrades.js`; `ui/lab.js` (model cards with mini ROC before → after, Buy); upgrades applied in `sim/model.js`.
- [ ] Calibration: badges in `p`, the ghost line (`p*`), the reliability diagram (sandbox, results).
- [ ] `sim/incidents.js`: base rate shift, drift, price change, rush hour; warnings and banners; the PSI chart, the drift alert, Retrain, the "recent" curve.
- [ ] `sim/review.js`: the band, queue and capacity, manual sends by tap / click, "Desk full"; the hindsight search over band pairs; the second handle on the belt.
- [ ] Contracts C06–C09 with lessons, quiz, coach marks; lending the desk (C08) and the monitor (C09).
- [ ] Sandbox: review band toggle, calibration toggle.
- [ ] Tests: incidents, PSI, review queue, Platt staleness after a shift.
- [ ] Re-run `tools/balance-check.js` with the upgrades a normal campaign can afford by each contract.

## Out of scope
- Adversary and top-k (I06).

## Acceptance criteria
- [ ] Buying More data I visibly separates the pile's humps and raises AUC by the amount of 02 §2.1.
- [ ] In C07, holding the threshold still across the shift keeps recall (within noise) and raises precision; with Calibration the badges' `p` is visibly too low after the shift (reliability diagram on the results).
- [ ] In C09 the drift alert fires within ~40 items of the shift; Retrain restores the separation.
- [ ] Balance check: C06–C09 winnable at ★★★ on every level; "flag nothing" meets C06's goal but not ★★.

## Result
_Filled in at the end of the iteration._
