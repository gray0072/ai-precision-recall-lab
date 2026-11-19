# I04 — Campaign Act 1 and the cheat sheet

| | |
|---|---|
| **Status** | done |
| **Depends on** | I03 |
| **Parallel with** | — |
| **Spec** | [01 §2–§4, §10, §13–§15](../../spec/01-gameplay.md), [03 §1, §2 (Act 1), §4, §5](../../spec/03-content.md), [04 §3, §5](../../spec/04-ui-design.md) |

## Goal
A player can play the campaign's Act 1 (C01–C05) from the map: briefing with the quick question, the contract with money and goal, results with stars and the hindsight-best comparison, progress saved; and read the cheat sheet. This is the MVP.

## You will learn
Precision vs recall as a business decision; F1 as the weakest link; cost-sensitive thresholds and why amounts break a single threshold; what "best in hindsight" means and why it is an upper bound.

## Tasks
- [x] `data/contracts.js` (C01–C05 with lessons), `data/quiz.js`, `data/glossary.js` (all cards of 03 §4), `data/coach.js`.
- [x] `campaign.js`: money, stars and bests per level, unlocks, save / load `prLab.campaign.v1`, New campaign with confirmation.
- [x] `sim/contract.js` (rest): contract run, goal chip states with the grace period, failure (outbreak, bankrupt), fee, stars.
- [x] `art/items.js` for spam, fever, bolts, fraud (with amounts); `art/clients.js`.
- [x] Screens: map, briefing, results (sparkline, profit curve, lesson), failure; `ui/coach.js` with the C01 tutorial and the first-time marks of C03–C05.
- [x] `ui/glossary.js`: the cheat sheet screen, card overlay from play (pauses), live pile pictures, search, "Which metric?".
- [x] Debug cheats of 01 §14 that apply so far; the cheated flag.
- [x] `tools/balance-check.js`; tune Act 1's targets and prices so ★★★ is reachable on every level.

## Out of scope
- The Lab and upgrades (I05): the money is earned and shown, the Lab button is there but says "Opens soon" until I05.

## Acceptance criteria
- [x] C01–C05 can be played through on Medium; stars, bests and money survive a reload; replay pays money and fee per the rules of 01 §4.
- [x] `tools/balance-check.js` reports every Act 1 contract as winnable at ★★★ on Easy, Medium and Hard, and t = 0.5 not winning ★★★ on C02, C03 and C05 (the point of those contracts).
- [x] The C01 tutorial runs end to end on a phone.
- [x] Every cheat sheet card renders on a phone and a desktop, all texts through `tr()` (the RU/SV terms of 03 §4 are added in I07).

## Result
Done in session S05 (2026-11-19, Claude Code session `d0c80e7a-ee6c-400f-aa7e-a95c2e353082`), in one session.

**What was done**
- Data: `data/contracts.js` (the three acts; C01–C05 complete with messages, lessons and cards; C06–C12 as "coming soon" entries for the map), `data/quiz.js` (all 12 questions, options shuffled with the right index), `data/glossary.js` (all 20 cards of 03 §4 with pictures and links, plus the "Which metric?" flow), `data/coach.js` (the C01 tutorial and the first-time marks of C02–C05); `data/scenarios.js` got the items' names and the base rate in words for the briefing.
- `sim/contract.js`: the live run (`Contract.start` over the pre-generated stream, the gate prices each item and checks the rules: goal chip `grace / met / close / broken`, outbreak, bankruptcy, the end; events `goalChanged`, `outbreak`, `contractEnded`), `Contract.results` (totals, goal, the hindsight-best, the share of it, threshold over time, the stream's profit curve, average threshold), `Contract.stars`, the ghost line on Easy, `finishNow` (cheat F). `sim/stream.js`: the gate keeps the threshold on the item and calls the run's price and rules hooks; nothing moves after the end.
- `campaign.js`: balance (never below $0), stars and bests per level, unlocks, the fee only for more stars than the level's record, the quiz bonus once, cheated runs, the cheats' `opened` list and test-save flag, `sanitize` field by field; persistence through a storage object (headless in the tests).
- `art/clients.js`: six client avatars. Screens: `ui/map.js` (new file: acts, cards with avatar, stars per level, locks), `ui/briefing.js` (prices in the outcome colours, terms, model card, quick question), `ui/results.js` (stars lit one by one, money breakdown, goal, hindsight comparison, final matrix and metrics, threshold over time, profit curve, lesson with its card, seed; the failure variant), `ui/glossary.js` (grid with search, full cards, live pile / ROC / PR / reliability / review band pictures, "Which metric?"), `ui/coach.js` (bubbles with an arrow; the stream holds until Got it / a drag). HUD: money, goal and outbreak chips. Live panel: the goal's target tick, red bar while below it, a second tap opens the card (pausing the game). Charts: the profit tab only on Easy in a contract; the results' sparkline and profit curve. `ui/screens.js`: the new panels, a confirmation dialog, typing in the search field is not a shortcut.
- `game.js`: the whole flow (start → map → briefing → contract → results → next / retry with the difficulty row / map), New campaign with confirmation, pause with Restart contract / Quit to map, the cheat sheet from everywhere, the debug cheats of 01 §14 (1–9, 0, -, = on the map; M; U and I say there is nothing yet; R; F).
- `tools/balance-check.js`; `tests/campaign.test.js` (10 tests, 63 in all); `data/icons.js` rebuilt (★, 🦠).

**Checks**
- `node --test tests/*.test.js`: 63 pass. `node tools/icons-build.js . --check` clean. No `Math.random` in `sim/` or `campaign.js`. The game is English only until I07 (no language tables yet), every new text goes through `tr()`.
- `node tools/balance-check.js` (60 streams per contract and level): ★★★ reachable on 90–100 % of the streams on every level of C01–C05; t = 0.5 wins ★★★ on 0 % of the streams of C02, C03 and C05 (C05 at 0.5 loses money on Medium and Hard: the overconfident Card Watch flags far too much).
- cdp, desktop 1366×800: C01–C05 played through on Medium by a bot holding each stream's hindsight-best threshold: ★★★ on every contract, the next one opens each time; after a reload the balance ($1 763), the stars and the bests are on the map and Continue shows. The C01 tutorial (Got it with Enter, the drag mark released by moving the line), results with the matrix card, the cheat sheet grid and "Which metric?". Easy C05: tint, the ghost line (0.85: the true posterior's p* for the median $60), the profit curve; a second click on Recall opens its card over the paused game and Back plays on; cheat F → results marked as not counting; New campaign asks and erases only the campaign.
- cdp, phone 390×844 (touch): the C01 tutorial end to end with real taps — the six marks in order, a 60 px finger drag moved the line 0.50 → 0.68 and released the drag mark; results; all 20 cards open without horizontal overflow. Phone 844×390: C03's goal and outbreak chips fit the HUD, the outbreak mark points at the meter, an outbreak ends the contract with the red "Outbreak!" panel; Retry with Easy picked there opens the Easy briefing; Esc → pause with Restart contract / Quit to map. No page errors in any run.

**Deviations and decisions**
- **Act 1 re-tuned** (03 §2 updated, with the old values and why): with the starting prices the hindsight-best profit was often negative on Hard, so ★★★ was reachable on 2–40 % of the streams. Now C01 +3 / −4 / −1 / 0, ★★ $15; C02 300 items, +3 / −10 / **0** / 0 (a missed spam costs nothing — "a bit of spam in the inbox they can live with"; p* stays 0.77), ★★ $30; C03 TP +12, ★★ $35; C04 300 items, +4 / −3 / −3 / 0, **F1 ≥ 0.60**, ★★ $20; C05 400 items, ★★ $75. The ★★ target sits near the 10th percentile of the hindsight-best on Hard, so on Easy ★★ is easy; a per-level target would fix that but adds a rule (not done). 02 §5.1's C02 example updated.
- **The fee** (01 §4 clarified): the first completion on a level pays it, a replay only for more stars than that level's record; a failed contract keeps its own money (fines) but no fee; Quit loses the contract and its money. A cheated run pays only its own money (01 §14 clarified), no fee, no quiz bonus.
- C02 got a coach mark for the goal chip (the first contract with a goal); 01 §13 updated.
- `contractEnded {failed}` instead of `{result}` (the logic only knows how it ended; `Contract.results` builds the result); `goalChanged` states listed; 05 §4 updated. The save has a new `opened` field (contracts opened by the map cheats); 05 §5 updated.
- The map is its own file `ui/map.js` (one screen, one file); 05 §2 updated with it and `tests/campaign.test.js`.
- Contracts of Acts 2 and 3 are listed in `data/contracts.js` with `soon: true`, so the map shows all three acts; I05 / I06 fill them in.
- The model card's AUC is the theoretical Φ(d′/√2) of the effective d′ (with the difficulty's offset; the Lab's bonus from I05).
- After the last item the results open 0.9 s later, so the last reveal is seen.

**Follow-ups**
- I05: the Lab behind the "Opens soon" buttons, `U` and `I` cheats for real, the reliability diagram on the results of calibrated contracts, Act 2 contracts with their coach marks; re-run the balance check with the upgrades.
- Maybe a per-level ★★ target (★★ is easy on Easy with one target for all levels).
- I07: sounds for the new events (goal broken, outbreak, stars), translations of all the new texts (data tables included), the RU G-accuracy note of 03 §4.
- A check on a real phone (fullscreen, coach bubble placement under a thumb).
