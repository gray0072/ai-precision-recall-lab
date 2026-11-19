# I07 — Release: sounds, icons, READMEs, GitHub Pages

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I04 (MVP release) or I06 (full release) |
| **Parallel with** | — |
| **Spec** | [04 §7–§9](../../spec/04-ui-design.md), [05 §6, §8](../../spec/05-architecture.md) |

## Goal
The game is live on GitHub Pages, installable on a phone, with sound, polished icons and three READMEs that sell it and double as a cheat sheet.

## Tasks
- [ ] `ui/sounds.js` with every event of 04 §7; the master gain and the switch checked end to end.
- [ ] Final `icon.svg` / `icon-maskable.svg`, PNGs, `?v=N` bumps.
- [ ] `README.md`, `README_RU.md`, `README_SV.md` (linked to each other at the top): play badge and link, screenshot, what it teaches, how to play (incl. touch controls and difficulty levels), a short metrics cheat sheet (precision, recall, F1, ROC/PR with the mnemonics), how to run locally, tech notes, licence.
- [ ] `screenshot.png` and `docs/showcase.gif` (English UI, 800 × 450) made with `tools/cdp.js`.
- [ ] Ask the owner, then: `gh repo create gray0072/ai-precision-recall-lab --public`, push, enable Pages from `main` / root, set the repo description, topics and the social preview.
- [ ] Check on a real phone: install to the home screen, offline start, fullscreen, update pick-up after a second deploy.

## Acceptance criteria
- [ ] `https://gray0072.github.io/ai-precision-recall-lab/` opens the game; the manifest installs it as its own app (not clashing with other `gray0072.github.io` apps).
- [ ] The three READMEs say the same; links are relative; the screenshot shows the English UI.

## Result
_Filled in at the end of the iteration._
