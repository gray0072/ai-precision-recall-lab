# I06 — Act 3: adversary, top-k, finale, attract demo

| | |
|---|---|
| **Status** | done |
| **Depends on** | I05 |
| **Parallel with** | — |
| **Spec** | [01 §6, §9](../../spec/01-gameplay.md), [02 §6.3, §7](../../spec/02-model-and-metrics.md), [03 §2 (Act 3)](../../spec/03-content.md), [04 §3 (End card)](../../spec/04-ui-design.md) |

## Goal
The whole campaign can be finished: the fraud ring games a fixed threshold, the search ranker uses top-k, the big pitch combines everything and ends with fireworks; the start screen comes alive with the attract demo.

## You will learn
Adversarial behaviour against a known decision rule; top-k as a per-query threshold; precision@k / recall@k and how they map to the retriever of a RAG system.

## Tasks
- [x] Adversary in `sim/incidents.js` (lagged threshold, crafted items, Easy ✦ mark, results count).
- [x] `sim/topk.js`: queries, the per-query line on the belt, the k knob (keys, drag), P@k / R@k, the hindsight search over k; `art/items.js` for retrieval and moderation (already drawn in I03).
- [x] C10, C11, C12 (phases, price changes, rush hour, per-phase goals and hindsight); the end card with `ui/fireworks.js` (from `ivan`).
- [x] `sim/demo.js`: the attract demo behind the start screen (off with reduced motion, paused when hidden).
- [x] Sandbox: Top-k mode.
- [x] Tests: adversary placement, top-k metrics, C12 phases; balance check for Act 3.

## Acceptance criteria
- [x] In C10 a threshold left still for 30 s lets crafted items through just under it; moving it or a review band below it catches most of them (results count).
- [x] In C11 the line visibly jumps per query column; raising k raises mean R@k and lowers mean P@k.
- [x] The campaign can be completed on Medium with the cheats off; the end card shows.

## Result
Done in session S07 (2026-11-19, Claude Code; the session was restarted once mid-iteration and went on from the files on disk).

**What was done**
- **The fraud ring (C10)** — `sim/incidents.js`: which positives are crafted, and each one's margin, is drawn in advance from the attempt seed (`markCrafted`, its own stream); the run logs its threshold over time and a crafted item gets its score as it arrives, just under the threshold of 8 s before (on the calibrated axis with calibration: an aim table per Platt fit). The incident can also raise the base rate (C10: 4 % → 12 %). On Easy a ✦ marks a crafted item after its reveal (the tag and the flight; ✦ added to the Icons engine). The results count the crafted payments: through, caught by the line, caught by people. C10 lends a review desk I.
- **Top-k (C11 and the sandbox)** — `sim/topk.js`: queries of 30 documents (2–8 relevant), one every 1 / rate s; each document's rank fixed by its exact score `z`, so "shown at k" is `rank < k` everywhere; the gate decides a whole query with the k of the moment. P@k / R@k per query and their means; the matrix counts documents at the current k; the curves over k (ROC by pooled FPR / TPR, mean P@k against mean R@k) with the dot at the current k and the window's ring; the hindsight search over k; the money at every k. On the belt each column has its own cut line between the k-th and the next document, joined by a dashed line that jumps from query to query; the handle reads "k = 5"; the input steps are scaled so that ↑ / ↓ change k by one (Shift: five) and dragging up shows fewer pages. Live panel: P@k and R@k bars (R@k's tooltip shows the mean and the pooled value). The sandbox's Top-k mode is the Search Ranker scenario (a toggle and the picker button); base rate, calibration and the band are disabled there.
- **The big pitch (C12)** — a contract of phases: one stream per phase (own seed, model, amounts, incidents), concatenated with 3 s of empty belt between phases; the run switches scenario, model, validation set, calibration, curves, prices and goal when a phase's first item arrives (`phaseStarted`, a banner, the pile starts afresh); price changes stay within their phase; fraud prices can be changed (`{ fraud: true, FP: −2.5 }`). The results have a table per phase (goal, money, best fixed threshold) and a sparkline with the best threshold per phase; `Contract.playPhases` / `hindsightPhases` play it headless.
- **The end card** — `ui/endcard.js` and `ui/fireworks.js` (from `ivan`'s city-builder, in the game's colours, events for the I07 sounds, none with reduced motion): "Cutoff & Co. is now a unicorn", total stars, the titles earned (`END_TITLES`), Play again on Hard / Map / Start screen; reached by "The end" on the results of a won C12.
- **The attract demo** — `sim/demo.js`: a sandbox run in Abstract with 160 items on the pile at once and a cosine sweep of the threshold between 0.15 and 0.85 every 20 s; behind the dimmed start panel, no HUD and no input; paused while the page is hidden, another panel covers the start screen, or the start panel is scrolled on a phone; off with `prefers-reduced-motion` (headless Chrome on this machine reports it, so the check emulates no-preference).
- Coach marks for C10 (the ring), C11 (the k knob and the jumping line) and C12 (three clients); the briefing explains queries and k (C11) and lists every phase's prices, goal and model (C12); the How to play text and the README describe Act 3, top-k and the end card.
- **Tests**: `tests/topk.test.js` (8), 4 adversary tests in `tests/incidents.test.js`, 4 Act 3 tests in `tests/campaign.test.js` (C12's stream and prices, the live phase switch and per-phase results, the data and the end, the demo): 99 in all. `tools/balance-check.js` plays C11 at k = 1 … 30 (and checks that R@k rises and P@k falls with k), C12 with one threshold for all phases against the per-phase hindsight, and checks that holding still without a band never wins ★★★ on C10; NORMAL upgrades for Act 3.

**Checks**
- `node --test tests/*.test.js`: 99 pass. `node tools/icons-build.js . --check` clean. No `Math.random` in `sim/`. English only until I07; every new text goes through `tr()`.
- `node tools/balance-check.js` (60 streams per contract and level, no upgrades and a normal campaign's): OK for all twelve contracts. Act 3, ★★★ reachable (no upgrades / normal): C10 93–98 %, holding still without a band never ★★★ (best fixed with a band 0.09–0.12 wide); C11 92–100 %, best k 8–11, mean R@k rises and P@k falls with k; C12 92–100 %, t = 0.5 for all phases never ★★★.
- cdp, desktop 1366×800: the start screen with the demo running behind it; the map with Act 3 open; the briefings of C10, C11, C12; C11 played (columns, cut lines, the k handle, ↓ twice → k = 7, P@k / R@k bars, curves over k), its results (k per query, money at every k); C10 with the ring started; C12 played through all three phases to its results (the per-phase table, the best line per phase) and "The end" → the end card with fireworks. Phone 390×844: the demo, C11, C12's second phase; phone 844×390: C11, C12's second phase (the HUD's phase title fits), the sandbox's Top-k mode with the cut line jumping across three columns. No page errors in any run.

**Deviations and decisions**
- **The hindsight-best against an adversary is aimed at too** ([ADR-0006](../../adr/0006-adversary-aims-at-the-hindsight.md)): on the spawned scores the search was an oracle (it saw where the ring aimed) and ★★★ was unreachable whatever the player did. Spec 02 §5.2 said the opposite and is updated.
- **C10 re-tuned** (03 §2): bounty prices +25 / −3 / −25 / 0 instead of the amount-based fraud prices (one crafted big payment decided the contract; the best was negative on > 10 % of streams), a lent review desk I, the ring raises the base rate to 12 % (with 4 % there were about four crafted payments in a contract), ★★ per level $270 / $220 / $150.
- **C11** ★★ per level $130 / $100 / $45 (was $150): 25 queries leave a lot to luck. Queries arrive at a steady pace, not as a Poisson process (columns must not overlap); ranks by `z` (no ties).
- **C12**: the fever phase's base rate 10 % (was 8 %), ★★ per level $240 / $200 / $120 (was $300); the price changes are at items 60, 180, 300 and the rush hour at 280 (40 items, ×2).
- **Top-k charts** are over k (the area under the drawn ROC is printed, not the threshold AUC), and a top-k run has no profit / calibration chart, ghost line, desk or monitor.
- The end card has its own file (`ui/endcard.js`) instead of `ui/screens.js`; spec 05 §2 updated.

**Follow-ups (I07)**
- `ui/sounds.js`: no sound for a demo run; one sound per top-k query, not 30; the fireworks events; `phaseStarted`. Written into the I07 plan.
- Translations of every new text (contracts, coach marks, titles, the briefing's top-k and phase rows).
