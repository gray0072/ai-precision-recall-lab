# I03 — Play screen and sandbox

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I01, I02 |
| **Parallel with** | — |
| **Spec** | [01 §1, §7, §11, §12](../../spec/01-gameplay.md), [04 §4–§6](../../spec/04-ui-design.md), [02 §3.4, §4](../../spec/02-model-and-metrics.md) |

## Goal
The sandbox is playable: items ride the belt at their score heights, the threshold is dragged with mouse, keys and touch, items are revealed at the gate and land on the pile, the matrix, the metric bars and the ROC / PR charts react live, with hover explanations.

## You will learn
How the four cells of the confusion matrix are regions of the two score distributions; how moving one line trades precision for recall; why the live point jitters (sampling noise) around the curve.

## Tasks
- [ ] `render/render.js` (layouts of 04 §4.2, DPR, hit-testing), `render/belt.js`, `render/pile.js`; `art/palette.js`, `art/items.js` (the Abstract dots and at least `spam`; the other scenarios may be simple placeholders until I04).
- [ ] `core/input.js`: absolute drag on the handle, relative drag on the belt / pile, wheel, keys (01 §11), taps; `touch-action: none`.
- [ ] `ui/hud.js` (pause, sound), `ui/livepanel.js` (matrix, bars, hover / tap explanations with live formulas), `ui/charts.js` (ROC, PR, profit), chart tabs on phones.
- [ ] `sim/sandbox.js` + `ui/sandboxpanel.js`: the knobs of 01 §7 (review band and top-k come in I05 / I06), Generate 1 000, Clear, Formula view; remembered as `prLab.sandbox.v1`.
- [ ] Pause dialog (01 §12), auto-pause on leaving the tab, fullscreen restore on phones.
- [ ] Motion of 04 §4.3 incl. `prefers-reduced-motion`.

## Out of scope
- Money, goals, contracts, the campaign (I04).

## Acceptance criteria
- [ ] On desktop and on a phone (portrait and landscape) the threshold can be moved precisely, and the pile, matrix, bars and both charts update within a frame.
- [ ] At `d'` = 0 the ROC curve is the diagonal and the PR curve sits at the base rate; at `d'` = 4 both hug the corner (checked by screenshots).
- [ ] Hovering Precision highlights the flagged row and shows `TP / (TP + FP)` with live numbers matching the matrix.
- [ ] 60 fps on a mid phone with 30 items on the belt and a 1 000-item pile (cdp run shows no long frames on desktop).

## Result
_Filled in at the end of the iteration._
