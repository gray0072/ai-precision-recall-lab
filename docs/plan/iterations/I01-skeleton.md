# I01 — Skeleton: page, tools, i18n, start screen, PWA

| | |
|---|---|
| **Status** | todo |
| **Depends on** | I00 |
| **Parallel with** | I02 |
| **Spec** | [04 §1–§3, §7–§10](../../spec/04-ui-design.md), [05 §1–§3, §5–§6](../../spec/05-architecture.md), [01 §10, §11.2, §15](../../spec/01-gameplay.md) |

## Goal
The page opens from `file://` and as static files, on a desktop and a phone, with the start screen (language switcher, difficulty, sound, buttons that lead to placeholder screens), installable as a PWA, with the `ivan` tooling in place.

## You will learn
How the `ivan` conventions fit together without a build step: plain scripts in load order, versioned links, the Icons engine, the update watcher, the PWA manifest's absolute `id`.

## Tasks
- [ ] Copy from `D:\Projects\my\ivan` and adapt to a game at the repo root: `tools/cdp.js`, `tools/pwa-icons.sh` (`.` = the repo root, writes the PNGs into the root), `tools/icons-build.js` + `tools/icons/`, `tools/i18n-check.js`; `core/i18n.js`, `core/cursor.js`, `core/icons.js`, `core/update.js`, `core/audio.js` (engine and master gain only), `core/storage.js`; `art/flag-*.svg`; `ui/fireworks.js` can wait for I06.
- [ ] `index.html` (markup only, viewport and PWA metas, versioned links in the load order of 05 §3), `styles.css` with the palette tokens and the `ivan` components (04 §1), `constants.js` (the difficulty table), `game.js` (screen flow skeleton), `sim/state.js` stub, `ui/screens.js`.
- [ ] Start screen (04 §3): switcher EN · RU · SV, title, tagline, Continue / New campaign (placeholders), Sandbox, Cheat sheet (placeholders), difficulty row, Sound On / Off, How to play; Space / Enter and arrow-key focus; fullscreen on touch devices from the first button.
- [ ] `data/lang-ru.js`, `data/lang-sv.js` with every text of this iteration.
- [ ] `icon.svg`, `icon-maskable.svg` (04 §9), PNGs via `bash tools/pwa-icons.sh .`, `manifest.webmanifest` (05 §6), `.nojekyll`, `LICENSE` (if the owner confirms MIT).
- [ ] `tests/load.js` (vm loader) with one smoke test, so `node --test tests/` runs.

## Out of scope
- Anything in `sim/` beyond the state stub (I02); the play screen (I03).

## Acceptance criteria
- [ ] Opening `index.html` from `file://` shows the start screen with no console errors (cdp: desktop 1366×768, phone 390×844 portrait and 844×390 landscape).
- [ ] The language switches at once and is remembered as `prLab.lang`; difficulty and sound are remembered (`prLab.difficulty`, `prLab.sound`).
- [ ] `node tools/i18n-check.js .` and `node tools/icons-build.js . --check` are clean; the maskable PNG cropped to a circle of two thirds of its size shows the whole artwork.
- [ ] Manifest validates in Chrome DevTools (Application → Manifest) when served over http.

## Result
_Filled in at the end of the iteration._
