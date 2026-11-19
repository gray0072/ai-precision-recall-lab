# ADR-0006 — Against the fraud ring, the hindsight-best threshold is aimed at too

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I06

## Context
Spec 02 §6.3 makes a share of the positives *crafted*: when such an item arrives, its score is set just under the threshold the player had `ADV_LAG_S` seconds earlier (margin u uniform in [0.01, 0.08]). Spec 02 §5.2 said that for the hindsight-best fixed threshold "adversarial items keep the scores they spawned with".

A simulation of C10 (12 streams per level, a bot holding t, a bot switching between t and t − 0.1, a bot with a review band of 0.1 under t) showed that this makes ★★★ unreachable:
- The crafted scores sit in a narrow band just under the player's own line. The hindsight search sees them and picks a fixed threshold 0.05–0.08 lower, which catches them all for the price of a few false alarms. Whatever the player did, the best fixed threshold *on that very stream* was 1.4–3 times their money.
- So the comparison rewarded no behaviour at all: it is an oracle that knows where the attacker aimed, which no fixed line could have known.

## Options
1. **Keep the spawned scores** and drop ★★★ on C10 (or the 90 % rule): the star rules stop being uniform, and the results' "best fixed threshold" teaches the wrong thing ("you should have held 0.68" — but at 0.68 the ring would have aimed at 0.68).
2. **Score every candidate as if the ring had aimed at it**: for each fixed threshold t (and each band pair) of the search, the crafted items get t − u instead of their spawned score. This is the honest counterfactual: a fixed, known line would have been gamed too.
3. Make the adversary weaker (smaller share, wider margin) so that the oracle matters less: blurs the lesson.

## Decision
Option 2. `Contract.hindsightBest` re-scores the crafted items per candidate (`play(…, { aimAt: true })`; the band-pair fast path keeps each crafted item's margin and an aim table per axis). The profit chart of the results is the same runs. C10 also changes so that the lesson is playable:
- The client **lends a review desk I** (like C08): "checking the zone below the line" is the quiz answer and the lesson. The best fixed line *with a band below it* (also aimed at) is the target; a player who holds the line still without a band reaches about 25–40 % of it, a player with a band of about 0.1 under the line about 95 %.
- **Bounty prices** +$25 / −$3 / −$25 / $0 instead of the amount-based fraud prices: with amounts, one crafted $2 000 payment decides the contract, and the hindsight-best was negative on more than 10 % of the streams (the same problem I05 met in C06).
- The ring also **brings more fraud**: the base rate goes from 4 % to 12 % at the incident (`adversary` takes `prevalence`), so there are about a dozen crafted payments in a contract instead of four.

## Consequences
- A player who holds the threshold still and never uses the band gets ★ (the contract has no metric goal) but not ★★ or ★★★; the balance check asserts it.
- "You beat the best fixed threshold!" becomes reachable on C10 by moving the line well, which is exactly the lesson ("a fixed, predictable threshold is a target").
- The results say that the best fixed line was scored as if the ring had aimed at it, and count the crafted payments: how many got through, were caught by the line, were caught by people.
- Spec 02 §5.2 and §6.3 and 03 §2 are updated.
