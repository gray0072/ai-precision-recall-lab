# ADR-0003 — Charts drawn by hand on Canvas 2D, no chart library

- **Status:** Accepted
- **Date:** 2026-11-19
- **Iteration:** I00

## Context
The game needs a handful of small charts (ROC, PR, profit curve, sparkline, reliability diagram, mini ROC, PSI) that update many times a second while the threshold moves, styled in the game's colour code, working offline as a PWA, from `file://`, without a build.

## Options
1. **Canvas 2D by hand**: full control of the look and of the animation (the sliding operating point, the jittering live ring), no dependency, small. Cons: axes, labels and DPR scaling written by us.
2. **Chart.js / uPlot vendored into `lib/`**: ready-made axes and tooltips. Cons: their animation model fights a point that moves every frame; styling to the colour code is work anyway; a large file for a few lines.
3. **SVG by hand**: crisp, styleable with CSS. Cons: many DOM updates per frame for curves of 101 points and the pile.

## Decision
Option 1, all in `ui/charts.js` with shared helpers (plot area, axes, DPR). Charts redraw only when their inputs change.

## Consequences
- Accessibility of values comes from the numbers in the live panel, not from the charts.
- If charts grow (zoom, tooltips on curves), revisit with a vendored library in `lib/`.
