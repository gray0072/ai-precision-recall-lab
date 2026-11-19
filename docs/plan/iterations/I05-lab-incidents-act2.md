# I05 — The Lab, incidents, review desk, Act 2

| | |
|---|---|
| **Status** | done |
| **Depends on** | I04 |
| **Parallel with** | — |
| **Spec** | [01 §5, §6](../../spec/01-gameplay.md), [02 §2.3, §5.2, §6.1, §6.2, §6.4](../../spec/02-model-and-metrics.md), [03 §2 (Act 2), §3](../../spec/03-content.md) |

## Goal
Money buys upgrades that visibly change the model; Act 2 (C06–C09) plays with the accuracy trap, a base rate shift, the review desk and drift.

## You will learn
What more data and features do to the score distributions and the ROC; calibration and how it goes stale; why precision moves with the base rate; triage with a human review band; PSI as a drift signal; retraining.

## Tasks
- [x] `data/upgrades.js`; `ui/lab.js` (model cards with mini ROC before → after, Buy); upgrades applied in `sim/model.js`.
- [x] Calibration: badges in `p`, the ghost line (`p*`), the reliability diagram (sandbox, results).
- [x] `sim/incidents.js`: base rate shift, drift, price change, rush hour; warnings and banners; the PSI chart, the drift alert, Retrain, the "recent" curve.
- [x] `sim/review.js`: the band, queue and capacity, manual sends by tap / click, "Desk full"; the hindsight search over band pairs; the second handle on the belt.
- [x] Contracts C06–C09 with lessons, quiz, coach marks; lending the desk (C08) and the monitor (C09).
- [x] Sandbox: review band toggle, calibration toggle.
- [x] Tests: incidents, PSI, review queue, Platt staleness after a shift.
- [x] Re-run `tools/balance-check.js` with the upgrades a normal campaign can afford by each contract.

## Out of scope
- Adversary and top-k (I06).

## Acceptance criteria
- [x] Buying More data I visibly separates the pile's humps and raises AUC by the amount of 02 §2.1.
- [x] In C07, holding the threshold still across the shift keeps recall (within noise) and raises precision; with Calibration the badges' `p` is visibly too low after the shift (reliability diagram on the results).
- [x] In C09 the drift alert fires within about one PSI window (~80 items) of the shift, never before it; Retrain restores the separation. (Was "~40 items": not reachable with PSI, see ADR-0005.)
- [x] Balance check: C06–C09 winnable at ★★★ on every level; "flag nothing" meets C06's goal but not ★★.

## Result
Done in session S06 (2026-11-19, Claude Code session `cb2b80f7-9d42-495c-8af0-2647be8b33b0`), in one session.

**What was done**
- **The Lab:** `data/upgrades.js` (11 upgrades, the scenario families; prices and d′ bonuses in `constants.js`), `Model.bonusOf` / `deskLevelOf` / `hasKind` (what owned upgrades do), `Campaign.labOpen` / `buy` / `buyAll` / `upgradeState` (the purchase event), `ui/lab.js`: a model card per family with each scenario's AUC and a mini binormal ROC that morphs to the new curve when the player points at an upgrade ("AUC 0.92 → 0.96"), the upgrade cards with Buy / Bought / Needs … first / Not enough money. Reached from the map and the results once C01 has a star. The briefing's model card shows the Lab's bonus, calibrated scores, the monitor and the desk.
- **Calibration in contracts:** with U-calib the run fits Platt on its validation set, the badges, the gate and the line are on p; the ghost line on Medium is p* on the p axis, so it goes stale with the base rate; on Easy it follows the true posterior of the moment (base rate and drift included: `Model.posterior` now handles unequal class means). The results show a reliability diagram, with two bars per bin (before / after) when the base rate shifted.
- **Incidents** (`sim/incidents.js`): the schedule (base rate, drift, rush hour, with the ramp) goes into `Stream.generate`; items keep their own noise draw `e`; a price change applies from its item on (`Contract.itemMoney`); warnings 10 s ahead (Easy, Medium), starts when the first item arrives; HUD countdown chip and banners. The results show precision / recall / FPR / share of positives / items before and after each base rate shift or drift; the sparkline marks the incidents. Cheat I moves the next incident to the next item (the stream to come is made again).
- **The drift monitor:** PSI after every decision (`Metrics.psiReference` / `psi`), a HUD chip with its value and a small chart, the alert after 10 decisions above 0.2, Retrain (15 s; the items to come are scored without drift, a new validation set, curves and Platt refitted, PSI restarts), the dashed "recent" ROC / PR curves of the rolling window. `Incidents.alertIndex` / `retrainedAtAlert` replay it headless.
- **The review desk** (`sim/review.js`): the band [low, t) with its own violet handle in a column at the left edge of the belt (absolute drag, Q / A), a queue of 3 drained at the level's rate to each item's exact gate time, people right at −$1, "Desk full" (event, red chip), a tap or click on an item sends it to the desk. The hindsight-best searches band pairs with a fast integer loop (agrees with `play()`, tested); the results say how many items people reviewed.
- **Act 2:** C06–C09 with messages, lessons, quick questions (already there), coach marks (accuracy, the flu season, the band and the desk, the PSI chip and the alert); lending (`lend: { review: 2 }`, `{ monitor: true }`); C06's extra metrics (balanced accuracy).
- **Sandbox:** the Review band knob (a desk of level II; its edge remembered) and a fourth chart tab, Calibration (the reliability diagram of the rolling window, raw or calibrated).
- **Tests:** `tests/incidents.test.js` (10), `tests/review.test.js` (7), 3 more in `tests/campaign.test.js`; 83 in all. `tools/balance-check.js`: two upgrade sets per Act 2 contract, the desk's band search, the bot retrains at the alert, the 10th percentile of the best money, the C06 "flag nothing" check.

**Checks**
- `node --test tests/*.test.js`: 83 pass. `node tools/icons-build.js . --check` clean (👥 added). No `Math.random` in `sim/`. English only until I07; every new text goes through `tr()`.
- `node tools/balance-check.js` (60 streams per contract and level): OK — ★★★ reachable on ≥ 90 % on every level for C01–C09, with no upgrades and with a normal campaign's (C06 More data I; C07, C08 + Calibration; C09 + the monitor); C06: "flag nothing" meets the goal on 97 %, never ★★; C09's alert median 79–82 items after the drift.
- cdp, desktop 1366×800: map → Lab (balance, families, hover preview "Fever Gate 0.92 → 0.96", Buy), C08 with the band (handle, stripe, desk chip, a click on an item sends it), its results (best fixed threshold and band), C09 to the alert (PSI 0.32 red, Retrain pulsing, the coach mark on it, dashed recent curves) and Retrain; C07 with Calibration to its results (the flu-season table, the two-coloured reliability diagram); the sandbox with the review band and the Calibration tab. Phone 390×844 and 844×390: C09's HUD (chips wrap in portrait, pause stays on screen), C08's band handle dragged with a finger (0.35 → 0.23) and a tap that sends an item without moving the line, the Lab without horizontal overflow, C07's results. No page errors in any run.

**Deviations and decisions**
- **PSI redesigned** ([ADR-0005](../../adr/0005-psi-short-window.md)): 5 quantile bins, the last 80 decided items, the alert after 10 decisions in a row above 0.2. The textbook 10 bins on the 200-item window alerted about 150 items late or not at all, and short windows mostly measured noise. The acceptance now says "about one PSI window (~80 items)". C09's drift is 2.0 at item 80 in a 400-item contract.
- **Act 2 re-tuned** (03 §2 has the old values and why): C06 pays a bounty (+$30 / −$2 / 0 / 0, no amounts) with accuracy ≥ 0.97 fixed on every level (`goal.fixed`). Fraud amounts made bankruptcy unavoidable on ≥ 10 % of streams, and Hard's +0.02 would make the KPI 1.00. C07 TP +$8, ★★ $120; C08 TN +$1 (a fine comment earns ad money), so the band pays; C09 +5 / −10 / −1 / 0, Precision ≥ 0.85.
- **Per-level ★★ targets** (the I04 follow-up): `target` may be `{ easy, medium, hard }`, used by C08 and C09 (`Contract.targetOf`).
- **Amounts follow the price list**, not the scenario: only contracts with the fraud prices draw amounts (02 §2.4).
- The review handle sits in a column at the **left edge of the belt area** (01 §11.2 said "left edge of the pile"; 04 §4.2 said the belt area's left edge). A mouse press on an item is a click until it moves, then a drag of the line.
- A reviewed item costs `REVIEW_FEE` instead of its outcome's price (01 §4, literal), and counts as TP / TN.
- Balance-check bot: with the monitor it retrains at the alert (what a competent player does); without, Act 2 is checked as the streams come.

**Follow-ups**
- I06: the adversary (`Incidents` has the schedule and the hooks; crafted items need the lagged threshold), C12's price changes and rush hour are implemented but not yet used by a contract.
- I07: sounds for the new events (incident, drift alert, desk full, purchase), translations of all the new texts (`data/upgrades.js`, contracts, coach marks), the README in RU / SV.
- The Lab's preview is on hover and keyboard focus; a phone has neither until a card is tapped (the Buy button focuses on tap in most browsers). Check on a real phone.
