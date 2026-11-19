# I07 — Release: sounds, translations, icons, READMEs, GitHub Pages

| | |
|---|---|
| **Status** | done |
| **Depends on** | I06 |
| **Parallel with** | — |
| **Spec** | [04 §7–§9](../../spec/04-ui-design.md), [05 §6, §8](../../spec/05-architecture.md), [03 §4 "Local terms"](../../spec/03-content.md) |

## Goal
The game is live on GitHub Pages, installable on a phone, playable in English, Russian and Swedish, with sound, polished icons and three READMEs that sell it and double as a cheat sheet.

## Tasks
- [x] `ui/sounds.js` with every event of 04 §7; the master gain and the switch checked end to end. From I06: no sound while `State.run.kind === 'demo'` (the attract demo emits the item events too); a top-k query decides 30 documents at once (one sound per query, not 30); the end card's `fireworkLaunch` / `fireworkBang` (as in `ivan`'s city-builder); a sound for `phaseStarted` (C12).
- [x] Russian and Swedish: `data/lang-ru.js`, `data/lang-sv.js` with every key (incl. the `data/` tables: contracts, cards with the local terms of 03 §4, upgrades, questions, coach marks); the language switcher of 04 §8 with `art/flag-gb/ru/se.svg` from `ivan`, remembered as `prLab.lang`; `node tools/i18n-check.js .` clean; the `data/` texts checked by hand; long Russian texts checked on a phone layout. May take its own session.
- [x] Final `icon.svg` / `icon-maskable.svg`, PNGs, `?v=N` bumps.
- [x] `README.md`, `README_RU.md`, `README_SV.md` (linked to each other at the top): play badge and link, screenshot, what it teaches, how to play (incl. touch controls and difficulty levels), a short metrics cheat sheet (precision, recall, F1, ROC/PR with the mnemonics), how to run locally, tech notes, licence.
- [x] `screenshot.png` and `docs/showcase.gif` (English UI, 800 × 450) made with `tools/cdp.js`; then the `og:image` meta in `index.html` (an absolute URL: `https://gray0072.github.io/ai-precision-recall-lab/screenshot.png`, Open Graph needs one), left out in I01 while there was no screenshot.
- [x] Confirm with the owner right before (the decision to publish at the end is made), then: `gh repo create gray0072/ai-precision-recall-lab --public`, push, enable Pages from `main` / root, set the repo description, topics and the social preview.
- [ ] Check on a real phone: install to the home screen, offline start, fullscreen, update pick-up after a second deploy. (Owner, on a real device.)

## Acceptance criteria
- [x] `https://gray0072.github.io/ai-precision-recall-lab/` opens the game; the manifest installs it as its own app (not clashing with other `gray0072.github.io` apps).
- [x] The three READMEs say the same; links are relative; the screenshot shows the English UI.
- [x] The whole game (every screen, contract and card) shows no English text in RU or SV except the metric names, which stay English by design.

## Result

**Done** in session S08 (2026-11-19).

What was done:
- **Sounds** (`ui/sounds.js`, recipes in `core/audio.js`): TP ding, quiet TN tick, FP thunk, FN buzz (a cough with the outbreak meter), coin chimes at every $100 of contract money, a chime when the goal is met and a two-tone warning when it breaks (at most once per 5 s), a radio blip for incident warnings and starts, a drift alarm, Retrain done, desk full, a "next client" chime for C12's phases, a falling phrase for a failed contract, one rising note per star on the results (the results emit a new UI event `starsShown`), a cash register in the Lab, a rustle for the sandbox's Generate, the fireworks' whistles and bangs, and the belt's low hum (ducked while paused, held by a coach mark or frozen). The attract demo is silent; a top-k query sounds once, its pitch following the query's recall@k; frequent sounds are throttled. Checked in Chrome: the context starts on a real click, every recipe runs, Sound Off sets the master gain to 0 and is remembered.
- **Translations**: `data/lang-ru.js` and `data/lang-sv.js` with all 694 texts (written by two translation sub-agents in parallel from `node tools/i18n-check.js . --dump`, then reviewed). Metric names stay English with the local term next to them (03 §4); the RU accuracy card warns about «точность»; mnemonics keep the English phrase with a local gloss. Scenario and client names are translated (RU: «Страж почты», «Термопост», «Голубиная почта», the firm «Порог и Ко»; SV: Inkorgsvakten, Febergrinden, Duvposten, the firm stays Cutoff & Co.).
- **`tools/i18n-check.js`** now also reads the text fields of the `data/` tables and the `METRIC_NAMES` / `DIFFICULTY_NAMES` tables, so the "check the data texts by hand" step is automated; `--dump` prints every key with where it is used.
- **The language switcher** (`core/i18n.js`, from `ivan`'s city builder): EN · RU · SV with flags at the top of the start screen, the results and the end card; applies at once (the results and the end card rebuild their text), remembered as `prLab.lang`, first visit from the browser's language.
- **Icons**: the I01 icon was already final (the maskable art stays within a radius of about 155 of the 170 allowed); no re-render needed.
- **READMEs** in three languages with the play badge, the GIF, what it teaches, a metrics table with the mnemonics, how to play, run locally, tech notes, licence.
- **`screenshot.png`** (C02 in play, 1600 × 900, shown at 800 wide; also the `og:image`) and **`docs/showcase.gif`** (the sandbox in Inbox Guard with a full pile while the line sweeps, 800 × 450, 60 frames, about 1 MB), made with `tools/cdp.js` and a new dependency-free **`tools/png-gif.js`** (PNG decoder, 2× box downscale, a 255-colour palette, frame differencing).
- **GitHub**: the repo already existed (public, created by the owner with I01–I04 pushed); I05–I07 pushed, Pages enabled from `main` / root, description, homepage and topics set.

Checks: `node --test tests/*.test.js` (99 pass), `node tools/i18n-check.js .` (694 texts, ru + sv all translated), `node tools/icons-build.js . --check`. Headless Chrome on a phone (390 × 844 portrait, 844 × 390 landscape) and a desktop (1366 × 800, 1600 × 900) in RU and SV: every screen visited (start with the help, map, briefing, play, results, Lab, cheat sheet grid, a card, "Which metric?", end card, sandbox drawer, pause), a script listed visible texts still equal to an English key — none, except the card names that carry the English metric name by design; switching the language on the results and the start screen rebuilds their texts; no page errors.

Deviations and decisions:
- `screenshot.png` is 1600 × 900 (crisp on high-DPI screens and as a social card), not 800 × 450; the READMEs show it 800 wide. The GIF is 800 × 450 as planned.
- The sandbox's scenario list became one column: the Swedish and Russian names did not fit two columns in the 270 px drawer.
- The RU matrix headers are «Позитив / Негатив» (short enough for a phone); sentences use «положительный / отрицательный».
- The social preview image cannot be set through the GitHub API: upload `screenshot.png` by hand in the repo's Settings → Social preview.

Follow-ups:
- The real-phone check (install, offline start, fullscreen, update pick-up after a second deploy) is for the owner on a device.
- A native speaker's look at the Swedish texts (e.g. «driftvakt», the invented client names) and the Russian ones.
- Optional: a CI workflow running the tests and the two checks on push (05 §8).

Session ids: S08.
