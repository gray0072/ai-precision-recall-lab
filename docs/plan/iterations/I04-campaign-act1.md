# I04 — Campaign Act 1 and the cheat sheet

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I03 |
| **Parallel with** | — |
| **Spec** | [01 §2–§4, §10, §13–§15](../../spec/01-gameplay.md), [03 §1, §2 (Act 1), §4, §5](../../spec/03-content.md), [04 §3, §5](../../spec/04-ui-design.md) |

## Goal
A player can play the campaign's Act 1 (C01–C05) from the map: briefing with the quick question, the contract with money and goal, results with stars and the hindsight-best comparison, progress saved; and read the cheat sheet. This is the MVP.

## You will learn
Precision vs recall as a business decision; F1 as the weakest link; cost-sensitive thresholds and why amounts break a single threshold; what "best in hindsight" means and why it is an upper bound.

## Tasks
- [ ] `data/contracts.js` (C01–C05 with lessons), `data/quiz.js`, `data/glossary.js` (all cards of 03 §4), `data/coach.js`.
- [ ] `campaign.js`: money, stars and bests per level, unlocks, save / load `prLab.campaign.v1`, New campaign with confirmation.
- [ ] `sim/contract.js` (rest): contract run, goal chip states with the grace period, failure (outbreak, bankrupt), fee, stars.
- [ ] `art/items.js` for spam, fever, bolts, fraud (with amounts); `art/clients.js`.
- [ ] Screens: map, briefing, results (sparkline, profit curve, lesson), failure; `ui/coach.js` with the C01 tutorial and the first-time marks of C03–C05.
- [ ] `ui/glossary.js`: the cheat sheet screen, card overlay from play (pauses), live pile pictures, search, "Which metric?".
- [ ] Debug cheats of 01 §14 that apply so far; the cheated flag.
- [ ] `tools/balance-check.js`; tune Act 1's targets and prices so ★★★ is reachable on every level.

## Out of scope
- The Lab and upgrades (I05): the money is earned and shown, the Lab button is there but says "Opens soon" until I05.

## Acceptance criteria
- [ ] C01–C05 can be played through on Medium; stars, bests and money survive a reload; replay pays money and fee per the rules of 01 §4.
- [ ] `tools/balance-check.js` reports every Act 1 contract as winnable at ★★★ on Easy, Medium and Hard, and t = 0.5 not winning ★★★ on C02, C03 and C05 (the point of those contracts).
- [ ] The C01 tutorial runs end to end on a phone.
- [ ] Every cheat sheet card renders on a phone and a desktop, all texts through `tr()` (the RU/SV terms of 03 §4 are added in I07).

## Result
_Filled in at the end of the iteration._
