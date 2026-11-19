# Architecture Decision Records

Short records of important decisions: context, decision, consequences. A new decision gets the next number. A changed decision gets a new ADR that supersedes the old one (the old one is kept, with status `Superseded by ADR-XXXX`).

Template: [0000-template.md](0000-template.md).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-static-vanilla-js.md) | A static site in vanilla JS, no build step (the `ivan` conventions) | Accepted |
| [0002](0002-synthetic-binormal-scores.md) | Synthetic scores from a binormal model instead of a trained model | Accepted |
| [0003](0003-hand-drawn-canvas-charts.md) | Charts drawn by hand on Canvas 2D, no chart library | Accepted |
| [0004](0004-curves-on-raw-scores.md) | Curves and AUC on the raw score; a threshold on calibrated p maps to a raw threshold | Accepted |
| [0005](0005-psi-short-window.md) | The drift monitor: PSI over 5 quantile bins of the last 80 scores, alert after 10 decisions in a row | Accepted |
| [0006](0006-adversary-aims-at-the-hindsight.md) | Against the fraud ring, the hindsight-best threshold is aimed at too | Accepted |
