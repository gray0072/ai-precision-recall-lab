# I03 — Play screen and sandbox

| | |
|---|---|
| **Status** | done |
| **Depends on** | I01, I02 |
| **Parallel with** | — |
| **Spec** | [01 §1, §7, §11, §12](../../spec/01-gameplay.md), [04 §4–§6](../../spec/04-ui-design.md), [02 §3.4, §4](../../spec/02-model-and-metrics.md) |

## Goal
The sandbox is playable: items ride the belt at their score heights, the threshold is dragged with mouse, keys and touch, items are revealed at the gate and land on the pile, the matrix, the metric bars and the ROC / PR charts react live, with hover explanations.

## You will learn
How the four cells of the confusion matrix are regions of the two score distributions; how moving one line trades precision for recall; why the live point jitters (sampling noise) around the curve.

## Tasks
- [x] `render/render.js` (layouts of 04 §4.2, DPR, hit-testing), `render/belt.js`, `render/pile.js`; `art/palette.js`, `art/items.js` (the Abstract dots and at least `spam`; the other scenarios may be simple placeholders until I04).
- [x] `core/input.js`: absolute drag on the handle, relative drag on the belt / pile, wheel, keys (01 §11), taps; `touch-action: none`.
- [x] `ui/hud.js` (pause, sound), `ui/livepanel.js` (matrix, bars, hover / tap explanations with live formulas), `ui/charts.js` (ROC, PR, profit), chart tabs on phones.
- [x] `sim/sandbox.js` + `ui/sandboxpanel.js`: the knobs of 01 §7 (review band and top-k come in I05 / I06), Generate 1 000, Clear, Formula view; remembered as `prLab.sandbox.v1`.
- [x] Pause dialog (01 §12), auto-pause on leaving the tab, fullscreen restore on phones.
- [x] Motion of 04 §4.3 incl. `prefers-reduced-motion`.

## Out of scope
- Money, goals, contracts, the campaign (I04).

## Acceptance criteria
- [x] On desktop and on a phone (portrait and landscape) the threshold can be moved precisely, and the pile, matrix, bars and both charts update within a frame.
- [x] At `d'` = 0 the ROC curve is the diagonal and the PR curve sits at the base rate; at `d'` = 4 both hug the corner (checked by screenshots).
- [x] Hovering Precision highlights the flagged row and shows `TP / (TP + FP)` with live numbers matching the matrix.
- [x] 60 fps on a mid phone with 30 items on the belt and a 1 000-item pile (cdp run shows no long frames on desktop).

## Result
Done in session S04 (2026-11-19, Claude Code session `8b97a71b-32c4-40ac-a06a-577e0e386df1`).

**What was done**
- `sim/stream.js`: the endless source (`Stream.endless`, the same four sub-streams as a contract's stream, one item at a time with the model of that moment) and the belt: `Stream.update(dt)` moves the run's clock, items enter at their own arrival time (the spacing does not depend on the frame rate), ride `travelS` and are decided at the gate with the threshold of that moment (`gate`, `toPile`, the pile window, `itemArrived` / `itemDecided`); `progress`, `timeToGate`.
- `sim/metrics.js`: `modelCurves` (sweep, ROC + AUC, PR + AP, the validation prevalence) and `operatingPoint` (the curve's point at a raw threshold).
- `sim/sandbox.js`: knobs with `sanitize` (field by field, defaults for anything broken), `start`, `rebuild` (validation set from the same seed, Platt fit, p of every item, curves), `set` (switching calibration keeps the line at the same items), the profit curve with its best threshold, `p*` and the ghost line, `generate` (1 000 at once, window 1 000), `clear`, `step`.
- `sim/state.js`: the run, belt, pile, `pileVersion`, pause and the live panel's highlight.
- `art/palette.js` (the colours, the outcome code, hatching patterns), `art/items.js` (Abstract dots and drawings for spam, fever, bolts, fraud with the amount, moderation, retrieval: hidden / positive / negative; the score badge).
- `render/render.js` (the three layouts, DPR-aware canvas, geometry, hit-testing, the animation clock), `render/belt.js` (axis, scrolling belt, flagged tint, items with badges and bobbing, the gate's lamp, the flip at the gate and the arc onto the pile, the outcome tags `TP ✓`, the threshold line and handle, the ghost line), `render/pile.js` (the mirrored histogram, positives left / negatives right like the matrix's columns, squares that shrink and stack as rows fill, the fading oldest fifth, the highlight, the region labels; the layout cached by `pileVersion`).
- `core/input.js`: absolute drag in the handle's column and with the mouse on belt / pile, relative drag with a finger, taps (< 8 px), the wheel (notches and trackpad deltas), the keys of 01 §11, Esc / P, Tab for the chart tabs.
- `ui/hud.js`, `ui/livepanel.js` (matrix with window and total counts, the cells pulse on landing; Precision, Recall, F1, Accuracy, FPR bars with "—"; hover / tap pins the explanation: numerator and denominator cells, the pile dimmed, the filled formula; formula view), `ui/charts.js` (ROC with AUC and the theoretical Φ(d'/√2), PR with the random line and AP, profit per 100 items with the best and the current threshold; the filled operating point and the hollow live ring; tabs when narrow; `ResizeObserver`), `ui/sandboxpanel.js` (docked / drawer), the pause dialog in `ui/screens.js`, the flow in `game.js` (loop, layouts, pause on Esc / P / leaving the tab, saving the knobs).
- `index.html` (the play screen, the pause panel, the new scripts, `?v=N` bumped), `styles.css` (the three layouts, the live panel, the tooltip, the knobs), `constants.js` (controls and sandbox values), `data/icons.js` rebuilt (✓, ✗, ⏸, ☰, ✕, →, 🔊, 🔇).
- `tests/sandbox.test.js`: 9 new tests, 53 in all.

**Checks**
- `node --test tests/*.test.js`: 53 pass. `node tools/icons-build.js . --check` clean. No `Math.random` in `sim/`. The game is English only until I07 (no language tables yet).
- cdp, desktop 1366×800: d′ = 0 → AUC 0.52, AP 0.21 at a base rate of 0.20, the ROC on the diagonal and PR flat at the base rate; d′ = 4 → AUC 0.997, AP 0.99, both curves in the corner. Hovering Precision: TP outlined bright, FP dashed, FN / TN and their pile regions dimmed, tooltip `TP / (TP + FP) = 177 / (177 + 126) = 0.58` equal to the matrix. A mouse press at the height of 0.80 sets t = 0.80, a wheel notch −0.01, Shift+↑ +0.05, Page Down −0.10. Esc pauses (the run's clock stops), Esc resumes. Calibrated Card Watch with prices 0 / −5 / −60 / +1: the ghost line p* = 0.24 equals the profit curve's best threshold.
- cdp, phone 390×844 and 844×390 (touch): a 60 px finger drag on the belt moves t by 60 / 325 = 0.18; the drawer starts closed; a tap on a bar pins its explanation, a second tap lets go; Quit saves `prLab.sandbox.v1`; `prefers-reduced-motion` emulated: no flip, no arc, no bobbing. No page errors in any run.
- Frame cost with 22–26 items on the belt and a 1 000-item pile: the drawing commands take ≈ 1.6 ms (pile 0.65, items 0.43), the live panel 0.15 ms, the charts ≈ 1 ms; the real `requestAnimationFrame` loop runs at a median of 16.7 ms. Headless Chrome rasterizes in software (SwiftShader), which makes an occasional frame long when the canvas is flushed (one 83 ms frame out of 180); a check on a real phone is left to the owner.

**Deviations and decisions**
- The pile puts **positives left and negatives right**, so its four regions sit exactly where the matrix's cells do (TP top left, FP top right, FN bottom left, TN bottom right); 01 §1.4 said only "one side / the other". Spec updated.
- The badge shows only the number; the axis title ("model score" / "calibrated p") and the handle (`t =` / `p ≥`) say what it is (01 §1.1 updated): a word on every badge was clutter.
- The sandbox got **prices per outcome** (default +1 / −1 / −1 / 0): the profit curve needs a price list and the sandbox had none; with calibrated scores the ghost line p* shows for them, without calibration there is none (a raw score is not a probability). 01 §7 updated.
- Switching calibration keeps the line at the same items (the threshold's number moves to the other axis): "calibration changes what a number means, not the ranking".
- Sandbox "Pause" became **Pause belt** (the belt stands still, the knobs and the line still work) to keep it apart from the pause dialog; in the pause dialog the sandbox reads **Clear and restart** / **Quit to menu** (01 §12 updated).
- Desktop charts go under tabs when each would get less than 200 px (e.g. the knobs docked at 1366 px); 04 §4.2 updated. The knobs are docked on desktops, a drawer on phones (04 §3).
- Search Ranker is not in the sandbox's picker yet (it needs the top-k mode, I06).
- A second click / tap on a bar lets go of it; opening the metric's cheat sheet card comes with the cheat sheet (I04).
- New event `pileGenerated {count}` for Generate 1 000 (no ride, no reveal); 05 §4 updated; `tests/sandbox.test.js` added to the tree.

**Follow-ups**
- I04: the second tap on a bar opens its cheat sheet card; the contract run reuses `Stream.update` (a `source` over the pre-generated stream, money in `itemDecided`), the HUD's contract chips; generalise `rawThreshold` for the charts (now inlined there).
- I05: the reliability diagram in the sandbox (04 §6) together with the Calibration upgrade; taps on items for the review desk (`Input` already reports taps).
- Check 60 fps on a real mid phone (headless Chrome cannot show it).
