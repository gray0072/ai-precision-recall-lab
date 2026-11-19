# I02 — Simulation core: scores, metrics, curves, tests

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I00 |
| **Parallel with** | I01 |
| **Spec** | [02 §1–§5, §8](../../spec/02-model-and-metrics.md), [05 §4, §7](../../spec/05-architecture.md), [03 §1](../../spec/03-content.md) |

## Goal
Everything the game computes works headless and is tested: the score model, streams and the validation set, every metric, the curves, calibration, the cost-optimal and the hindsight-best thresholds.

## You will learn
The binormal model and why AUC = Φ(d'/√2); ROC AUC as the Mann–Whitney statistic; average precision vs ROC AUC on rare classes; Platt scaling as a logistic regression on one feature; why calibration does not change ranking; the expected-cost threshold.

## Tasks
- [ ] `core/utils.js` (clamp, lerp, erf / Φ, logit, sigmoid), `core/rng.js` (mulberry32, named sub-streams, normal / Poisson / log-normal), `core/events.js`.
- [ ] `sim/model.js`: effective `d'`, raw scores with temperament, quantization, the true posterior, Platt scaling by Newton's method.
- [ ] `sim/stream.js`: pre-generated contract streams (arrivals, classes, scores, amounts), the validation set, the gate decision.
- [ ] `sim/metrics.js`: counts, every metric of 02 §3.2 with the empty-denominator rules, the rolling window at the current threshold, ROC / PR / profit curves, ROC AUC, AP.
- [ ] `sim/contract.js` (first part): prices and money (incl. fraud prices), goal checks, the outbreak meter, `p*`, the hindsight-best search (without review band and top-k).
- [ ] `data/scenarios.js`; the 02 §8 constants in `constants.js`.
- [ ] Tests of 05 §7 for all of the above.

## Out of scope
- Incidents, review desk, top-k (I05, I06); anything drawn.

## Acceptance criteria
- [ ] `node --test tests/*.test.js` passes, including: AUC of 20 000 samples at `d'` = 2 within 0.01 of 0.921; Platt recovers `a`, `b` within 5 %; metrics match hand-computed matrices; AP matches a known scikit-learn example; the same seed gives the same stream.
- [ ] A small script (in the test suite) plays C02's terms at t = 0.5 and at the hindsight-best and prints money and precision; the best is better and meets the goal.

## Result
_Filled in at the end of the iteration._
