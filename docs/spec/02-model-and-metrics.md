# 02 — Model and metrics

The math behind the game. Everything here lives in `sim/` (05 §2), runs without a browser and is covered by Node tests (05 §7). Tuning numbers named in `CAPS` live in `constants.js`; the values here are starting points.

## 1. Notation

- An item has a true class `y ∈ {0, 1}`; `1` = **positive** = the thing being hunted (spam, fever, defect, fraud, toxic, relevant).
- `π` = prevalence (base rate), the share of positives in the stream.
- `z` = the model's hidden **logit**; `s` = the **score** shown on the badge, in [0, 1]; `p` = a calibrated probability.
- `t` = the threshold; an item is **flagged** when `s ≥ t` (or `p ≥ t` once calibrated).
- `σ(x) = 1 / (1 + e^(−x))`, `logit(p) = ln(p / (1 − p))`, `Φ` = the standard normal CDF.

## 2. Scores

### 2.1 The binormal model

Scores are synthetic ([ADR-0002](../adr/0002-synthetic-binormal-scores.md)): each class has a normal distribution of the logit, with the same spread:

```
z | y = 0  ~  N(−d'/2, 1)
z | y = 1  ~  N(+d'/2 − drift, 1)
s = σ(γ · z + β)
```

- `d'` (**separation**, "d-prime") is the distance between the class means in standard deviations. It is the one number that says how good the model is: **AUC = Φ(d' / √2)** (d' 1.0 → 0.76, 1.5 → 0.86, 2.0 → 0.92, 2.5 → 0.96, 3.0 → 0.98).
- Effective `d'` = the scenario's base (03 §1) + the Lab's bonus for that scenario family (03 §3) + the difficulty's offset (01 §10), clamped to [0, `D_PRIME_MAX` = 4.5].
- `γ`, `β` (the model's **temperament**, per scenario) make the raw score miscalibrated in a believable way: `γ > 1` is overconfident (scores pile up near 0 and 1), `β ≠ 0` is biased. They do not change the ranking, so they do not change AUC or the curves, only what a threshold number means.
- `drift` is 0 except during a drift incident (§6.2).
- **Quantization:** the score is rounded to 0.01 and clamped to [0.01, 0.99] when the item is made, and every computation uses the rounded value, so what the badge shows is exactly what is decided: `t = 0.00` flags everything, `t = 1.00` flags nothing, and an item at 0.62 is flagged at `t = 0.62`.

### 2.2 Streams and the validation set

- At the start of a contract the whole stream is generated in advance from a seeded PRNG (`mulberry32`, a new seed per attempt, shown in small print on the results screen): arrival times (Poisson with the contract's rate), `y` (Bernoulli `π`, following the base rate schedule of incidents), `z`, `s`, and for value-weighted scenarios the **amount** (§2.4). So the stream does not depend on what the player does, and the hindsight-best threshold (§5.2) is computed on the very same items. The one exception is adversarial items (§6.3), whose score is set when they spawn.
- Separate PRNG streams are used for the item stream, the validation set and incidents, so that changing one (e.g. adding an incident) does not reshuffle the others. Within the item stream, arrivals, classes, the score noise and the amounts have sub-streams of their own (`items.arrivals`, `items.classes`, `items.scores`, `items.amounts`), and an item's logit is its class mean plus its own standard normal draw: a base rate shift changes which items are positive but not when they arrive or how far each one sits from its class mean.
- A **validation set** of `N_VAL` = 4 000 items is generated at the start with the contract's initial `π` and `d'`. It stands for the data the team evaluated the model on before going live; it is used for the model curves (§4), the calibration fit (§2.3) and the drift reference (§6.2).

### 2.3 Calibration (Platt scaling)

With the Calibration upgrade, at the start of a contract the game fits **Platt scaling** on the validation set: `p = σ(a · logit(s) + b)`, with `a, b` found by maximum likelihood (Newton's method, at most 25 iterations, stop when the step is under 1e−9; scores are clamped to [0.01, 0.99] so `logit(s)` is finite).

- In the binormal model the true posterior is exactly logistic in `z`: `logit P(y = 1 | z) = logit(π) + d' · z` (equal variances). Since `logit(s) = γz + β`, Platt scaling recovers `a = d' / γ` and `b = logit(π) − d' · β / γ` up to sampling noise, the rounding of `s` and its clamping to [0.01, 0.99]. The clamping matters for overconfident models: Card Watch (`γ` 1.8, `β` +0.8) puts about 16 % of its frauds at 0.99, which biases the fitted `a` by 5–13 %; the fit is still calibrated (its reliability diagram sits on the diagonal). A test checks the recovery within 5 % on the scenarios whose scores rarely touch the clamps, and the reliability of all of them (05 §7).
- Calibrated `p` is also rounded to 0.01 and clamped to [0.01, 0.99]. It is a monotone non-decreasing function of `s`, so **calibration changes no ranking, no curve and no AUC**: it changes what a number on the threshold means. The cheat sheet card G-calibration says so. Rounding can merge neighbouring raw scores into one `p` (on a steep part of the Platt map), so the curves are always computed on the raw score and a threshold on `p` is mapped to the equivalent raw threshold (`Model.rawThreshold`, [ADR-0004](../adr/0004-curves-on-raw-scores.md)); computing ROC on the rounded `p` would lower Card Watch's AUC by about 0.02.
- **Stale calibration:** `a, b` are fitted once. When the base rate changes during a contract, the true posterior moves by `logit(π_new) − logit(π_old)` but the badges keep the old mapping, so "p = 0.30" no longer means 30 %. Retrain (§6.2) refits it.
- A **reliability diagram** (10 bins: mean predicted `p` against the observed share of positives, the diagonal as reference) is shown in the sandbox and on the results screen of calibrated contracts.

### 2.4 Amounts (value-weighted scenarios)

Fraud items carry a payment amount, log-normal: `ln(amount) ~ N(ln 60, 1.1)` for genuine payments and `N(ln 60 + 0.4, 1.1)` for fraud, rounded to whole dollars, clamped to $1–$5 000. The score does not depend on the amount (the model does not see it). The amount is shown on the item's drawing.

## 3. Metrics

### 3.1 Counts

`TP`, `FP`, `FN`, `TN` as defined in 01 §1.3; `P = TP + FN` (real positives), `N = FP + TN` (real negatives), `PP = TP + FP` (flagged), `PN = FN + TN` (passed), `total = P + N`.

### 3.2 Formulas

| Id | Metric | Formula | Also called |
|---|---|---|---|
| `precision` | Precision | TP / (TP + FP) | positive predictive value, PPV |
| `recall` | Recall | TP / (TP + FN) | sensitivity, true positive rate, TPR, hit rate |
| `specificity` | Specificity | TN / (TN + FP) | true negative rate, TNR, selectivity |
| `fpr` | False positive rate | FP / (FP + TN) = 1 − specificity | fall-out, false alarm rate |
| `fnr` | False negative rate | FN / (FN + TP) = 1 − recall | miss rate |
| `npv` | Negative predictive value | TN / (TN + FN) | |
| `accuracy` | Accuracy | (TP + TN) / total | |
| `balancedAccuracy` | Balanced accuracy | (recall + specificity) / 2 | |
| `f1` | F1 score | 2 · P · R / (P + R) = 2TP / (2TP + FP + FN) | harmonic mean of precision and recall |
| `fbeta` | F-beta | (1 + β²) TP / ((1 + β²) TP + β² FN + FP) | β > 1 weighs recall more (F2), β < 1 precision (F0.5) |
| `mcc` | Matthews correlation | (TP·TN − FP·FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN)) | phi coefficient |
| `prevalence` | Prevalence | P / total | base rate |
| `flagRate` | Flag rate | PP / total | queue size, alert volume |

**Empty denominators** return `null`, shown as "—" with the tooltip "not defined yet: no flagged items" (or the matching reason). F1 and F-beta are `null` only when TP + FP + FN = 0, otherwise 0 when TP = 0. MCC is `null` when any factor under the root is 0.

### 3.3 The contract's totals

The contract's result (goal check, stars, results screen) uses the **decisions actually made** at the gate. Items decided by the review desk count as correct decisions (TP or TN) of the system; the results show how many were reviewed.

### 3.4 The rolling window

The live panel, the pile and the live ring on the charts use the last `PILE_WINDOW` (200) items **re-evaluated at the current threshold**, not the decisions made at their time. So moving the line changes the numbers at once: "what would the last 200 items look like at this threshold?" The panel's tooltip says so ("last 200 items, at the current threshold"). Review-desk items are re-evaluated by their score like the rest.

## 4. Curves

All curves of the live panel are computed on the **validation set** (the model as the team knows it) and recomputed when it changes (start of a contract, Retrain, a Lab purchase in the sandbox). The operating point is the curve's point at the current threshold. The curves, ROC AUC and AP are computed on the raw score `s` even when calibrated; with Calibration the operating point of `p ≥ t` is the curve's point at the equivalent raw threshold ([ADR-0004](../adr/0004-curves-on-raw-scores.md)).

- **ROC**: for every threshold `t` in 0.00, 0.01, …, 1.00 the point (FPR(t), TPR(t)); drawn as a polyline from (1, 1) to (0, 0), with the chance diagonal. **ROC AUC** by the trapezoid rule over these points; it equals the Mann–Whitney statistic (the probability that a random positive scores higher than a random negative, ties counted half). The sandbox also shows the theoretical `Φ(d'/√2)`.
- **PR**: the point (recall(t), precision(t)) for every `t` with at least one flagged item; the baseline is a horizontal line at the prevalence `π` (a random model's precision). **Average precision** `AP = Σ (Rₙ − Rₙ₋₁) · Pₙ` over thresholds from high to low (the scikit-learn definition, no interpolation). Points are joined by straight lines for the drawing; the cheat sheet notes that linear interpolation in PR space is optimistic and AP does not use it.
- **Profit curve**: the money per 100 items at each threshold with the contract's prices, on the validation set (during play on Easy and in the sandbox) or on the contract's actual stream (results screen).
- **Live ring**: the rolling window's (FPR, TPR) and (recall, precision) at the current threshold. It jitters around the operating point; after drift it wanders off the curve, which is itself the warning. With the Drift monitor a second, faint "recent" curve from the rolling window is drawn as well.

## 5. Best thresholds

### 5.1 The cost-optimal threshold (the ghost line)

With money values per outcome `V_TP, V_FP, V_FN, V_TN` (signed: a fine is negative), flagging an item with posterior `p` is worth it when

```
p · V_TP + (1 − p) · V_FP  ≥  p · V_FN + (1 − p) · V_TN
⇔  p ≥ p* = (V_TN − V_FP) / ((V_TP − V_FN) + (V_TN − V_FP))
```

Example (C02): `V = +2 / −10 / −1 / 0` → `p* = 10 / (3 + 10) = 0.77`. This is the ghost line of 01 §5. It is correct only for calibrated scores (with Calibration, on the calibrated `p` axis; on Easy the game computes it from the true posterior of §2.3 and maps it to the raw score axis). It ignores the contract's goal (a goal may force a lower or higher threshold) and, for value-weighted items, uses the median amount; the C05 lesson is that with amounts the best threshold differs per item (with the fraud prices of 03 §2, `p* = (0.02·a + 5) / (1.02·a + 5)`: 0.34 for $10, 0.09 for $60, 0.02 for $1 000), so a single line is a compromise.

### 5.2 The hindsight-best fixed threshold

On the results screen, over the contract's actual items (scores, classes, amounts, arrival times as they happened): for every `t` in 0.00…1.00 the money the contract would have made with that threshold held fixed the whole time, keeping only thresholds that meet the goal and do not fail the contract (outbreak allowance). The best of them is the **hindsight-best threshold**, used for ★★★ (01 §4) and the results' comparison.

- With a review band, the search is over pairs (`t_review`, `t`) with `t_review ≤ t`, simulating the desk's queue and capacity on the arrival times (101 × 101 pairs × ≤ 400 items, fine).
- With top-k (§7), the search is over `k`.
- Adversarial items keep the scores they spawned with (a fixed threshold in hindsight would have been gamed differently; the results note this).
- If no threshold meets the goal, the results say *"No fixed threshold could meet the goal on this stream: the model is not good enough. Visit the Lab."* and ★★★ is out of reach for this attempt.

## 6. Incidents

Incidents are listed per contract in 03 §2 as `{ at: <item index>, kind, params }`. A change ramps in linearly over `ramp` items (default `INCIDENT_RAMP` = 20).

### 6.1 Base rate shift

`π` moves to `params.prevalence`. The class-conditional score distributions stay the same, so recall and FPR at a fixed threshold do not change, while precision moves (with more positives, more of the flagged items are positives). Calibration becomes stale (§2.3).

### 6.2 Drift and the drift monitor

- **Drift**: the positives' mean moves down by `params.shift` (in logit units): `drift` in §2.1 goes from 0 to `shift`, so the effective separation becomes `d' − shift`.
- **PSI** (population stability index, with the Drift monitor): 10 bins at the deciles of the validation set's scores; `PSI = Σ (aᵢ − eᵢ) · ln(aᵢ / eᵢ)` with `eᵢ` the validation share and `aᵢ` the rolling window's share of bin `i`, both floored at 1e−4. Read as < 0.1 stable, 0.1–0.2 moderate, > 0.2 (`PSI_ALERT`) shifted. PSI watches the **scores only**: it also fires on a base rate shift (more positives move the score distribution), which the alert says ("the inputs changed: base rate or drift?").
- **Retrain** (once per contract, with the Drift monitor): takes `RETRAIN_S` (15 s) during which the button shows progress; then `drift` returns to 0 (the model learns the new spam), a new validation set is generated with the current `π`, the curves and the calibration are refitted, and PSI is measured against the new reference.

### 6.3 Adversary

From the incident on, a share `ADV_SHARE` (0.4) of the positives are **crafted**: when such an item spawns, its score is set to `t_lag − u`, where `t_lag` is the threshold the player had `ADV_LAG_S` (8 s) earlier and `u` is uniform in [0.01, `ADV_MARGIN` = 0.08], rounded and clamped like any score. Crafted items look like any other on the belt (on Easy, a tiny ✦ gives them away after the reveal). They land just under a threshold that has stayed still, so a threshold that moves (or a review band below it, which humans check) defeats them. The results show how many crafted items got through.

### 6.4 Price change and rush hour

- **Price change**: from `at` on the contract uses `params.prices`; the ghost line moves with it.
- **Rush hour**: the arrival rate is multiplied by `params.rate` (2) for `params.items` items.

## 7. Top-k retrieval

Used by C11 and the sandbox's Top-k mode.

- The stream comes in **queries**. A query is a batch of `TOPK_DOCS` (30) documents, of which `R` (uniform 2–8) are relevant (positives); scores from the binormal model with the scenario's `d'`. A query rides the belt as one column (a "results page"), the documents at their score heights.
- The knob is **k** (1–30) instead of `t`: the top-k documents of each query are "shown to the user" (flagged). On the belt the threshold line becomes **per query**: it sits between the k-th and the (k+1)-th score of each column, so it jumps from column to column. That is the lesson: top-k is a threshold that adapts to each query.
- Per query: `Precision@k = relevant in top-k / k`, `Recall@k = relevant in top-k / R`; the panel shows their means over the rolling window of queries (the last 20) and over the contract. The pile shows documents by score as usual, coloured by whether they were in their query's top-k.
- The cheat sheet card G-topk ties it to RAG: the retriever's k trades recall (the answer misses facts) against precision (the LLM drowns in noise, and every extra chunk costs tokens).

## 8. Constants (starting values)

| Constant | Value | Meaning |
|---|---|---|
| `BELT_TRAVEL_S` | 6 | seconds from entry to the gate at ×1 |
| `PILE_WINDOW` | 200 | items in the pile and the rolling window |
| `GOAL_GRACE_ITEMS` | 30 | items before the goal chip shows a colour |
| `N_VAL` | 4 000 | validation set size |
| `D_PRIME_MAX` | 4.5 | cap on the effective separation |
| `INCIDENT_RAMP` | 20 | items over which an incident's change ramps in |
| `PSI_ALERT` | 0.2 | PSI level of the drift alert |
| `RETRAIN_S` | 15 | seconds a retrain takes |
| `ADV_SHARE` / `ADV_LAG_S` / `ADV_MARGIN` | 0.4 / 8 / 0.08 | adversary: share of crafted positives, lag of the threshold they aim at, margin below it |
| `REVIEW_FEE` | $1 | cost of one human review |
| `REVIEW_RATE` | 0.25 / 0.4 / 0.6 | reviews per second at desk levels I / II / III |
| `QUIZ_BONUS` | $50 | right answer in a briefing |
| `STAR3_SHARE` | 0.9 | share of the hindsight-best profit for ★★★ |
| `TOPK_DOCS` | 30 | documents per query |
| `DEMO_SWEEP_S` | 20 | attract demo: seconds per full threshold sweep |
| `SCORE_MIN` / `SCORE_MAX` | 0.01 / 0.99 | the clamps of scores and calibrated `p` (§2.1) |
| `PLATT_MAX_ITER` / `PLATT_TOL` | 25 / 1e−9 | Platt scaling's Newton steps and stopping step size (§2.3) |
| `RELIABILITY_BINS` | 10 | bins of the reliability diagram (§2.3) |
| `AMOUNT_LOG_MEAN` / `AMOUNT_LOG_SD` / `AMOUNT_FRAUD_SHIFT` | ln 60 / 1.1 / 0.4 | payment amounts (§2.4) |
| `AMOUNT_MIN` / `AMOUNT_MAX` | $1 / $5 000 | clamps of an amount |
| `FRAUD_TP` / `FRAUD_FP` / `FRAUD_COMMISSION` | $0 / −$5 / 0.02 | fraud prices (03 §2); a missed fraud costs its amount |
