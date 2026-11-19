# I06 — Act 3: adversary, top-k, finale, attract demo

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I05 |
| **Parallel with** | — |
| **Spec** | [01 §6, §9](../../spec/01-gameplay.md), [02 §6.3, §7](../../spec/02-model-and-metrics.md), [03 §2 (Act 3)](../../spec/03-content.md), [04 §3 (End card)](../../spec/04-ui-design.md) |

## Goal
The whole campaign can be finished: the fraud ring games a fixed threshold, the search ranker uses top-k, the big pitch combines everything and ends with fireworks; the start screen comes alive with the attract demo.

## You will learn
Adversarial behaviour against a known decision rule; top-k as a per-query threshold; precision@k / recall@k and how they map to the retriever of a RAG system.

## Tasks
- [ ] Adversary in `sim/incidents.js` (lagged threshold, crafted items, Easy ✦ mark, results count).
- [ ] `sim/topk.js`: queries, the per-query line on the belt, the k knob (keys, drag), P@k / R@k, the hindsight search over k; `art/items.js` for retrieval and moderation.
- [ ] C10, C11, C12 (phases, price changes, rush hour, per-phase goals and hindsight); the end card with `ui/fireworks.js` (from `ivan`).
- [ ] `sim/demo.js`: the attract demo behind the start screen (off with reduced motion, paused when hidden).
- [ ] Sandbox: Top-k mode.
- [ ] Tests: adversary placement, top-k metrics, C12 phases; balance check for Act 3.

## Acceptance criteria
- [ ] In C10 a threshold left still for 30 s lets crafted items through just under it; moving it or a review band below it catches most of them (results count).
- [ ] In C11 the line visibly jumps per query column; raising k raises mean R@k and lowers mean P@k.
- [ ] The campaign can be completed on Medium with the cheats off; the end card shows.

## Result
_Filled in at the end of the iteration._
