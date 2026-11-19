# 00 — Overview

**Threshold Tycoon** (working title) is a browser game and an interactive demo that teaches the metrics of binary classification: the confusion matrix, precision, recall, F1, specificity, ROC and PR curves, calibration, cost-sensitive thresholds, and how base rates, drift and adversaries break a threshold that looked fine yesterday. It is a static site on GitHub Pages: no backend, no build step, installable as a PWA, playable on a phone.

The repo name is `ai-precision-recall-lab`; the live URL will be `https://gray0072.github.io/ai-precision-recall-lab/`.

## Spec files

| File | What |
|---|---|
| [00-overview.md](00-overview.md) | This file: idea, goals, audience, modes, scope |
| [01-gameplay.md](01-gameplay.md) | The play screen, the campaign, contracts, money, stars, upgrades, incidents, difficulty, controls, cheats, tutorial |
| [02-model-and-metrics.md](02-model-and-metrics.md) | The math: how scores are generated, calibration, every metric and curve, the hindsight-best threshold, drift, adversary, review desk, top-k |
| [03-content.md](03-content.md) | Content tables: scenarios, the 12 contracts, upgrades, the cheat sheet cards with mnemonics, briefing questions |
| [04-ui-design.md](04-ui-design.md) | Look and layout: palette, screens, the play screen on desktop and phones, charts, icons, sounds, languages, PWA |
| [05-architecture.md](05-architecture.md) | Tech stack, files and folders, load order, state and events, storage keys, testing, deployment |

Requirement ids: features are referred to by section, e.g. "spec 01 §3.2". Content ids (`C01`…`C12` contracts, `U-…` upgrades, `G-…` cheat sheet cards) are stable and used in code and tests.

## The idea in one paragraph

You run **Cutoff & Co.**, a tiny AI start-up that sells classifiers to clients: a mail service wants a spam filter, a harbor clinic wants a fever gate, a factory wants a defect inspector, a bank wants fraud detection. Every item that comes in (a letter, a passenger, a bolt, a card payment) rides a conveyor belt; the model has already given it a **score** from 0 to 1, and the item's height on the belt *is* its score. One glowing horizontal line, the **threshold**, cuts the belt: everything above it is flagged, everything below passes. At the gate the item's true nature is revealed and it drops onto **the pile**, a sideways histogram next to the belt where the threshold line keeps going and splits the pile into the four cells of the confusion matrix. You drag the line; the metrics, the ROC and PR dots and your money react at once. Each contract has its own price list for mistakes and its own demands ("never lose a real email", "miss no sick passenger"), and the world does not stand still: flu season changes the base rate, spammers change tactics, fraudsters probe your threshold. The money you earn buys model upgrades in the **Lab**: more data and features pull the two score distributions apart (the ROC curve bulges up), calibration turns scores into real probabilities, a human review desk takes the doubtful middle band.

## Goals

1. **Teach by seeing.** Every number on screen can be traced to items the player has watched fall. Hovering or tapping a metric lights up the cells and the part of the pile it is made of, and shows its formula with the live numbers.
2. **Make the trade-off felt, not told.** Precision and recall pull against each other through the player's own hand on the threshold; the right answer depends on the client's price list, and the game tells you afterwards how close you came to the best threshold in hindsight.
3. **Show real-world traps.** Accuracy on rare classes, precision's dependence on the base rate, drift, miscalibrated scores, adversaries gaming a fixed threshold, retrieval at top-k.
4. **Be a polished GitHub Pages demo.** Opens instantly, works offline as a PWA, looks good in a screenshot and a GIF, playable in English, Russian and Swedish.
5. **Be a useful cheat sheet.** The in-game cheat sheet (and a short version in the README) is good enough to come back to before an interview.

## Audience

- Developers growing into AI/ML engineering (the owner first) who know the words but want the intuition.
- Students and curious players; no math is required to play the campaign, the formulas are there for who wants them.
- Desktop and phone; mouse, keyboard and touch.

## Modes

| Mode | What | Spec |
|---|---|---|
| **Campaign** | 12 contracts in 3 acts, each teaching one idea; money, stars, the Lab with upgrades; saved in the browser | 01 §2–§6 |
| **Sandbox** | The same belt and pile with every knob exposed (base rate, separation, calibration, speed, threshold, top-k); no money, no pressure; "Generate 1 000 at once" | 01 §7 |
| **Cheat sheet** | Cards for every metric and idea: formula with coloured terms, meaning, mnemonic, watch-outs, an example; a "Which metric?" helper | 03 §4 |
| **Attract demo** | The belt keeps running behind the start screen with a bot sweeping the threshold, so the page is alive the moment it opens | 01 §9 |

## Scope

- **MVP** (I01–I04): menu, sandbox, play screen with belt, pile, matrix, metrics, ROC/PR; Act 1 (contracts C01–C05) with briefings, results and stars; cheat sheet; EN/RU/SV.
- **Full** (I05–I07): the Lab and upgrades, incidents, Acts 2 and 3 (C06–C12), review desk, top-k retrieval, attract demo, sounds, READMEs, icons, deploy.
- **Later (not planned):** an endless mode with a leaderboard; a "real data" contract with a small public dataset (e.g. SMS spam) scored by a logistic regression trained in the browser; multi-class (one-vs-rest) metrics; a shareable results card.

## Out of scope

- Any backend, accounts, cloud saves or analytics.
- Real ML training in the MVP (scores are synthetic and controlled, see [ADR-0002](../adr/0002-synthetic-binormal-scores.md)).
- Third-party chart or UI libraries ([ADR-0003](../adr/0003-hand-drawn-canvas-charts.md)).

## Open questions for the review

1. Title: **Threshold Tycoon** (with the subtitle "a precision & recall lab"), or something else?
2. Three languages (EN/RU/SV, as in `ivan`) from the first iteration, or English first and the translations at the end? This spec assumes all three from I01.
3. Is the scope of 12 contracts right, or should Act 3 (adversary, top-k, finale) be cut to "later"?
4. Licence: MIT, as in `ivan`?
5. The GitHub repo is not created yet: public repo `gray0072/ai-precision-recall-lab` with Pages from `main` / root (planned in I07, or earlier if you want a live preview)?
