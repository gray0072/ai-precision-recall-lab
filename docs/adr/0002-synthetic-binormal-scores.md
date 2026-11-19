# ADR-0002 — Synthetic scores from a binormal model instead of a trained model

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I00

## Context
Every item needs a model score and a true class. The game's lessons need control over them: a base rate that changes on cue, a model that gets better by a known amount when an upgrade is bought, drift of a set size, calibration that is wrong in a known way, and exact answers for tests (AUC, the best threshold).

## Options
1. **Binormal synthetic scores**: each class's logit is normal; separation `d'` sets AUC = Φ(d'/√2); a monotone "temperament" makes raw scores miscalibrated. Pros: every knob is one number, closed-form truths for tests, tiny code, any base rate or drift on demand. Cons: not "real" data; the two humps are always bell-shaped.
2. **A real dataset with a model trained in the browser** (e.g. SMS spam with logistic regression): authentic. Cons: a dataset per scenario, licence and size questions, no control over the base rate or the separation, upgrades would need real feature engineering, tests lose exact answers.
3. **Pre-computed scores of a real model shipped as JSON**: authentic and fast. Cons: the same lack of control, and files per scenario.

## Decision
Option 1 for the whole game. Equal variances keep the true posterior logistic in the logit, so Platt scaling has a known right answer (02 §2.3). A "real data" contract (option 2) stays on the "later" list.

## Consequences
- Scores look plausible, but the cheat sheet must not claim they come from a real model; the "How it works" text says they are simulated.
- Unequal-variance or skewed distributions (ROC curves that cross) are not shown; they can be added later as a scenario parameter.
