# I07 — Release: sounds, translations, icons, READMEs, GitHub Pages

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I06 |
| **Parallel with** | — |
| **Spec** | [04 §7–§9](../../spec/04-ui-design.md), [05 §6, §8](../../spec/05-architecture.md), [03 §4 "Local terms"](../../spec/03-content.md) |

## Goal
The game is live on GitHub Pages, installable on a phone, playable in English, Russian and Swedish, with sound, polished icons and three READMEs that sell it and double as a cheat sheet.

## Tasks
- [ ] `ui/sounds.js` with every event of 04 §7; the master gain and the switch checked end to end.
- [ ] Russian and Swedish: `data/lang-ru.js`, `data/lang-sv.js` with every key (incl. the `data/` tables: contracts, cards with the local terms of 03 §4, upgrades, questions, coach marks); the language switcher of 04 §8 with `art/flag-gb/ru/se.svg` from `ivan`, remembered as `prLab.lang`; `node tools/i18n-check.js .` clean; the `data/` texts checked by hand; long Russian texts checked on a phone layout. May take its own session.
- [ ] Final `icon.svg` / `icon-maskable.svg`, PNGs, `?v=N` bumps.
- [ ] `README.md`, `README_RU.md`, `README_SV.md` (linked to each other at the top): play badge and link, screenshot, what it teaches, how to play (incl. touch controls and difficulty levels), a short metrics cheat sheet (precision, recall, F1, ROC/PR with the mnemonics), how to run locally, tech notes, licence.
- [ ] `screenshot.png` and `docs/showcase.gif` (English UI, 800 × 450) made with `tools/cdp.js`.
- [ ] Confirm with the owner right before (the decision to publish at the end is made), then: `gh repo create gray0072/ai-precision-recall-lab --public`, push, enable Pages from `main` / root, set the repo description, topics and the social preview.
- [ ] Check on a real phone: install to the home screen, offline start, fullscreen, update pick-up after a second deploy.

## Acceptance criteria
- [ ] `https://gray0072.github.io/ai-precision-recall-lab/` opens the game; the manifest installs it as its own app (not clashing with other `gray0072.github.io` apps).
- [ ] The three READMEs say the same; links are relative; the screenshot shows the English UI.
- [ ] The whole game (every screen, contract and card) shows no English text in RU or SV except the metric names, which stay English by design.

## Result
_Filled in at the end of the iteration._
