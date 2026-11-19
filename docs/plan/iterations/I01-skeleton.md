# I01 — Skeleton: page, tools, i18n, start screen, PWA

| | |
|---|---|
| **Status** | done |
| **Depends on** | I00 |
| **Parallel with** | I02 |
| **Spec** | [04 §1–§3, §7–§10](../../spec/04-ui-design.md), [05 §1–§3, §5–§6](../../spec/05-architecture.md), [01 §10, §11.2, §15](../../spec/01-gameplay.md) |

## Goal
The page opens from `file://` and as static files, on a desktop and a phone, with the start screen (difficulty, sound, buttons that lead to placeholder screens), installable as a PWA, with the `ivan` tooling in place. English only; every text already goes through `tr()` (the translations and the switcher come in I07).

## You will learn
How the `ivan` conventions fit together without a build step: plain scripts in load order, versioned links, the Icons engine, the update watcher, the PWA manifest's absolute `id`.

## Tasks
- [x] Copy from `D:\Projects\my\ivan` and adapt to a game at the repo root: `tools/cdp.js`, `tools/pwa-icons.sh` (`.` = the repo root, writes the PNGs into the root), `tools/icons-build.js` + `tools/icons/`, `tools/i18n-check.js`; `core/i18n.js` (`tr()` only; the switcher and the flags come in I07), `core/cursor.js`, `core/icons.js`, `core/update.js`, `core/audio.js` (engine and master gain only), `core/storage.js`; `ui/fireworks.js` can wait for I06.
- [x] `index.html` (markup only, viewport and PWA metas, versioned links in the load order of 05 §3), `styles.css` with the palette tokens and the `ivan` components (04 §1), `constants.js` (the difficulty table), `game.js` (screen flow skeleton), `sim/state.js` stub, `ui/screens.js`.
- [x] Start screen (04 §3, without the language switcher): title, tagline, Continue / New campaign (placeholders), Sandbox, Cheat sheet (placeholders), difficulty row, Sound On / Off, How to play; Space / Enter and arrow-key focus; fullscreen on touch devices from the first button.
- [x] `icon.svg`, `icon-maskable.svg` (04 §9), PNGs via `bash tools/pwa-icons.sh .`, `manifest.webmanifest` (05 §6), `.nojekyll`. (`LICENSE`, MIT, is already there since I00.)
- [x] `tests/load.js` (vm loader) with one smoke test, so `node --test tests/*.test.js` runs.

## Out of scope
- Anything in `sim/` beyond the state stub (I02); the play screen (I03).
- Russian and Swedish, the language switcher (I07).

## Acceptance criteria
- [x] Opening `index.html` from `file://` shows the start screen with no console errors (cdp: desktop 1366×768, phone 390×844 portrait and 844×390 landscape).
- [x] Difficulty and sound are remembered (`prLab.difficulty`, `prLab.sound`); every visible text goes through `tr()`.
- [x] `node tools/icons-build.js . --check` is clean; the maskable PNG cropped to a circle of two thirds of its size shows the whole artwork.
- [x] Manifest validates in Chrome DevTools (Application → Manifest) when served over http.

## Result
Done in session S02 (2026-11-19, Claude Code session `4a8895f5-bcda-463f-adf6-be006a2cc389`).

**What was done**
- Tools from `ivan`, adapted to a game at the repo root: `tools/cdp.js` (`page()` opens the root's `index.html`), `tools/pwa-icons.sh` (`.` writes the PNGs into the root), `tools/icons-build.js` + `tools/icons/` (skips `docs/`, `tests/`, `tools/`; `--check` is accepted before or after the folder, as AGENTS.md writes it), `tools/i18n-check.js` (also reads the `[data-i18n]` texts of `index.html`, which the `ivan` version did not).
- `core/`: `i18n.js` (`tr()`, `I18N.set`, `applyDom` for `[data-i18n]`; English only), `storage.js` (`Store`, `prLab.` prefix, try/catch), `audio.js` (`GameAudio`: context on the first gesture, one master gain, `tone()`; `prLab.sound` read at load), `input.js` (fullscreen on touch devices only, see deviations), `cursor.js` and `update.js` (copied), `icons.js` + `data/icons.js` (generated).
- `index.html` (metas, versioned links in the 05 §3 order), `styles.css` (the 04 §1 tokens, the `ivan` buttons, chips, panels, overlay, banner, language pill), `constants.js` (the difficulty table of 01 §10, `CURSOR_HIDE_MS`, `BANNER_MS`), `game.js` (boot and the flow), `sim/state.js` (stub), `ui/screens.js` (overlay, arrow-key focus and Space / Enter from `fish-frenzy`, the start screen).
- Start screen: logo, title, tagline, New campaign (default; Continue appears instead once `prLab.campaign.v1` exists), Sandbox, Cheat sheet, difficulty row with a one-line note, Sound On / Off, collapsible How to play (mouse, keyboard and the relative touch drag). Campaign, Sandbox and Cheat sheet lead to a placeholder panel with Back (Esc also goes back).
- `icon.svg` (the pile from the side: blue negatives low left of the axis, orange positives high right, the amber threshold with its handle), `icon-maskable.svg` (same art scaled 0.8, full-bleed), the four PNGs, `manifest.webmanifest`, `.nojekyll`.
- `tests/load.js` (one vm context, the existing headless files in load order, returns their top-level declarations) and `tests/smoke.test.js` (3 tests).

**Checks**
- `node --test tests/*.test.js`: 3 pass. `node tools/icons-build.js . --check`: clean (2 mono: ↑ ↓). `node tools/i18n-check.js .`: no tables yet (tried with temporary tables: it lists all 27 texts).
- cdp, `file://`: desktop 1366×768, phone 390×844 and 844×390 — no page errors, no horizontal overflow; difficulty and sound survive a reload (`prLab.difficulty`, `prLab.sound`); ↓ moves the focus from New campaign to Sandbox, Enter opens it, Space presses Back. Phone landscape: the panel scrolls below the buttons (title and buttons are smaller under 500 px of height).
- Over http (`python -m http.server`): `Page.getAppManifest` has no errors, `Page.getInstallabilityErrors` is empty, app id `/ai-precision-recall-lab/`.
- The maskable PNG cropped to a circle of two thirds of its size shows the whole artwork.
- Manual (not possible headless): fullscreen on a real phone from New campaign / Sandbox; the cursor hiding in fullscreen.

**Deviations and decisions**
- `node --test tests/` does not run on Node 22+ (a folder is taken as a module path); the command is now `node --test tests/*.test.js` everywhere (AGENTS.md, spec 05, roadmap, plans).
- `core/input.js` was created now (not in the task list) to hold the fullscreen request; the drag and the keys come in I03.
- Static texts of `index.html` go through `tr()` as `[data-i18n]` elements (the `world-aviation` way) rather than being set from JS; spec 05 §6 says so, and `i18n-check.js` reads them.
- `og:image` is left out until there is a `screenshot.png` (I07 task updated; Open Graph needs an absolute URL there).
- `tools/icons/color/` holds the Twemoji files of 🔊 🔇 👥 ⭐ 💰 copied from `ivan`'s cache for later iterations; 🦠 is not cached and will be fetched by `icons-build.js` when first used.

**Follow-ups**
- I02 adds `core/utils.js`, `core/rng.js`, `core/events.js` and the `sim/` files to `index.html` and `tests/load.js` picks them up by itself.
- I07: the language tables, the switcher (`.langPick` CSS is in place), `og:image`.
