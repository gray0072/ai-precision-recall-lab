# I02 — Simulation core: scores, metrics, curves, tests

| | |
|---|---|
| **Status** | done |
| **Depends on** | I00 |
| **Parallel with** | I01 |
| **Spec** | [02 §1–§5, §8](../../spec/02-model-and-metrics.md), [05 §4, §7](../../spec/05-architecture.md), [03 §1](../../spec/03-content.md) |

## Goal
Everything the game computes works headless and is tested: the score model, streams and the validation set, every metric, the curves, calibration, the cost-optimal and the hindsight-best thresholds.

## You will learn
The binormal model and why AUC = Φ(d'/√2); ROC AUC as the Mann–Whitney statistic; average precision vs ROC AUC on rare classes; Platt scaling as a logistic regression on one feature; why calibration does not change ranking; the expected-cost threshold.

## Tasks
- [x] `core/utils.js` (clamp, lerp, erf / Φ, logit, sigmoid), `core/rng.js` (mulberry32, named sub-streams, normal / Poisson / log-normal), `core/events.js`.
- [x] `sim/model.js`: effective `d'`, raw scores with temperament, quantization, the true posterior, Platt scaling by Newton's method.
- [x] `sim/stream.js`: pre-generated contract streams (arrivals, classes, scores, amounts), the validation set, the gate decision.
- [x] `sim/metrics.js`: counts, every metric of 02 §3.2 with the empty-denominator rules, the rolling window at the current threshold, ROC / PR / profit curves, ROC AUC, AP.
- [x] `sim/contract.js` (first part): prices and money (incl. fraud prices), goal checks, the outbreak meter, `p*`, the hindsight-best search (without review band and top-k).
- [x] `data/scenarios.js`; the 02 §8 constants in `constants.js`.
- [x] Tests of 05 §7 for all of the above.

## Out of scope
- Incidents, review desk, top-k (I05, I06); anything drawn.

## Acceptance criteria
- [x] `node --test tests/*.test.js` passes, including: AUC of 20 000 samples at `d'` = 2 within 0.01 of 0.921; Platt recovers `a`, `b` within 5 %; metrics match hand-computed matrices; AP matches a known scikit-learn example; the same seed gives the same stream.
- [x] A small script (in the test suite) plays C02's terms at t = 0.5 and at the hindsight-best and prints money and precision; the best is better and meets the goal.

## Result
Done in session S03 (2026-11-19, Claude Code session `149fadd0-df7e-40c4-a0bf-a2a884c1b3f5`).

**What was done**
- `core/utils.js` (clamp, lerp, sigmoid, logit, erf, `normCdf` Φ, the 0.01 grid helpers `round2` / `hundredths` / `atOrAbove`, `canvasScale`, `frameLimiter`), `core/rng.js` (`Rng`: mulberry32, named sub-streams by a hashed name, uniform / int / Bernoulli / normal / exponential / Poisson / log-normal, `freshSeed`), `core/events.js` (`GameEvents.on / off / emit`).
- `sim/model.js` (`Model`): effective d′, quantization, the true posterior and `scoreForPosterior` (the Easy ghost line on the raw axis), `theoreticalAuc`, `plattExpected`, `fitPlatt` (Newton with step halving), `calibrate`, `rawThreshold` (ADR-0004).
- `sim/stream.js` (`Stream`): a contract's pre-generated stream (arrivals, classes, logits, scores, amounts, an optional per-item schedule for incidents), the validation set, `calibrate`, the gate (`decide`, `outcome`).
- `sim/metrics.js` (`Metrics`): counts, tally, the rolling window, every metric of 02 §3.2 with the null rules, the one-pass 101-threshold sweep, ROC + AUC, PR + AP, the profit curve, the reliability diagram.
- `sim/contract.js` (`Contract`, first part): values and money (fraud by amount, whole cents), `pStar` / `ghostPStar`, goal target / value / met with the difficulty shift, the outbreak allowance, `play` (headless run at a fixed or moving threshold, outbreak and bankruptcy), `hindsightBest`.
- `data/scenarios.js` (the six scenarios + Abstract), the 02 §8 constants plus amounts, fraud prices, Platt and clamps in `constants.js`; the new scripts in `index.html` in the 05 §3 order.
- Tests: `stream.test.js`, `model.test.js`, `metrics.test.js`, `contract.test.js` — 41 new tests, 44 in all.

**Checks**
- `node --test tests/*.test.js`: 44 pass. AUC of 20 000 samples at d′ = 2 within 0.01 of 0.921 (three seeds); trapezoid AUC = Mann–Whitney to 1e−12; AP = scikit-learn on three examples; Platt within 5 % on spam, bolts, moderation, abstract.
- C02 on Medium (seeds 1–5): t = 0.50 goes bankrupt every time (≈ −$205, precision 0.52–0.61); the hindsight-best (t 0.84–0.93) completes with precision 0.94–0.97 and −$5 … $43.
- `node tools/icons-build.js . --check` clean; `i18n-check` has no tables yet (no new player-facing texts). No `Math.random` in `sim/`.
- cdp, `file://`: desktop 1366×768, phone 390×844 and 844×390 — no page errors; in the page `Metrics.auc` of the spam validation set is 0.941 against Φ(2.2/√2) = 0.940.

**Deviations and decisions**
- [ADR-0004](../../adr/0004-curves-on-raw-scores.md): curves and AUC on the raw score; a threshold on calibrated p maps to a raw threshold. Computing ROC on the rounded p lowered AUC after calibration (Card Watch 0.927 → 0.905), against the lesson "calibration changes no AUC". Spec 02 §2.3 and §4 updated.
- Platt recovery is biased by the clamping of scores at 0.99 for overconfident models (Card Watch: a off by 5–13 %); spec 02 §2.3 now says so, and the test checks the 5 % recovery on the scenarios that rarely touch the clamps and the reliability (ECE < 0.02 after Platt, > 0.1 before) on all of them.
- The item stream has four sub-streams (arrivals, classes, score noise, amounts) so a base rate schedule moves only the classes; spec 02 §2.2 updated.
- The hindsight-best returns the middle of a run of tied thresholds (they make the same decisions; the middle has the most room on both sides).
- An outbreak starts when the FN count *reaches* the allowance (01 §3.3 read literally); bankruptcy when the money falls *below* −fee.
- New test file `tests/stream.test.js` (spec 05 §2 tree updated). PSI (spec 05 lists it in `metrics.js`) is left for I05 with the drift incident; `Stream.update` (arrivals onto the belt) for I03.

**Follow-ups**
- I04 balance: C02's hindsight-best on Medium is −$5 … $43 on seeds 1–5, so the ★★ target of $40 is mostly out of reach and ★★★ (90 % of a negative best) is odd; tune prices / targets with `tools/balance-check.js`.
- I03: `Stream.update` (arrivals onto the belt), the operating point via `Model.rawThreshold` when calibrated.
- I05: PSI in `sim/metrics.js`, the incident schedule through `Stream.generate({ schedule })`.
