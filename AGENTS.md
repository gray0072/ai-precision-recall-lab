# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository. Read this file fully at the start of every session.

## Project in one paragraph

**AI Precision Recall Lab** (repo `ai-precision-recall-lab`) is a browser game and interactive demo that teaches the metrics of binary classification: the confusion matrix, precision, recall, F1, specificity, ROC and PR curves, calibration, cost-sensitive thresholds, base rates, drift, adversaries and top-k retrieval. Items ride a conveyor belt at the height of their model score, the player drags one threshold line, items are revealed at the gate and fall onto a pile that *is* the confusion matrix; a campaign of 12 client contracts, a Lab of model upgrades, a sandbox and a cheat sheet. One game in `web/`, a static site on GitHub Pages: vanilla JS, Canvas 2D, Web Audio, no build step, an installable PWA, English / Russian / Swedish. The look and the code conventions come from the owner's games repo `ivan` (`D:\Projects\my\ivan`); the workflow and the prompt history from `ai-rag-film-search` (`D:\Projects\my\ai-rag-film-search`). The owner is growing from full-stack developer to AI engineer, so **explain ML-specific decisions** (a metric's definition, an edge case, a modelling choice) briefly when you make them.

## Where things are

| What | Where |
|---|---|
| Spec (source of truth for behavior) | [docs/spec/](docs/spec/00-overview.md) |
| The math: scores, metrics, curves, best thresholds | [docs/spec/02-model-and-metrics.md](docs/spec/02-model-and-metrics.md) |
| Content: scenarios, contracts, upgrades, cheat sheet cards | [docs/spec/03-content.md](docs/spec/03-content.md) |
| Code layout and load order | [docs/spec/05-architecture.md](docs/spec/05-architecture.md) |
| Roadmap, iteration status | [docs/plan/roadmap.md](docs/plan/roadmap.md) |
| Plan of each iteration | [docs/plan/iterations/](docs/plan/iterations/) |
| Architecture decisions | [docs/adr/](docs/adr/README.md) |
| Prompt history (one file per session) | [docs/prompts/](docs/prompts/README.md) |
| The game (everything the site serves) | `web/`: `index.html`, `styles.css`, `constants.js`, `game.js`, `campaign.js`, `core/`, `data/`, `sim/`, `art/`, `render/`, `ui/`, `lib/` (vendored supabase-js), icons, manifest, screenshot. Paths in this file are relative to `web/` unless they start with `tests/`, `tools/`, `docs/` or `supabase/` |
| The cloud save's table | `supabase/schema.sql` |
| Tests of the simulation | `tests/` (`node --test tests/*.test.js`, from I01/I02) |
| Tools (headless Chrome, icons, translations, balance) | `tools/` (from I01) |

## Session workflow

1. **Log the prompt first** (see "Prompt logging" below).
2. Find the iteration: the owner names it (e.g. "do I03"), or take the next `todo` iteration from the roadmap whose dependencies are `done`. Read its plan file and the spec sections it links.
3. Set the iteration status to `in progress` in [roadmap.md](docs/plan/roadmap.md) and in the plan file.
4. Work directly on `main`. No branches and no pull requests.
5. Work in small steps. Run the tests and look at the page often. Tick tasks in the plan file as they are done.
6. **Spec first.** The spec is the source of truth for the game. If the plan or the spec turns out wrong, **update the doc** in the same change and say so. Do not silently deviate. A real decision with alternatives gets an ADR. A change to the game's behavior updates the spec in the same change.
7. At the end of the iteration: fill in the "Result" section of the plan (what was done, deviations, decisions, follow-ups, session ids), set status `done`, update the READMEs if what the player sees changed.
8. Commit only when the owner asks. Commit message rules are below.
9. Before every commit run the checks of "Definition of done". Push only when the owner asks, and only when everything is green.

If a session ends before the iteration is finished, write the current state and next steps in the "Result" section under a "Progress" heading so the next session can continue.

## Prompt logging (required)

Every prompt from the owner is saved to the prompt history, **in English first, then verbatim in the original language**:
- File: `docs/prompts/sessions/YYYY-MM-DD_SNN_<topic>.md`. `SNN` continues the numbering across the project (look at the existing files to find the next number). One file per session; parallel sessions each get their own file.
- Add each new prompt of the session as `## Prompt N` with two ```` ```text ```` blocks: `English:` (a faithful, complete translation) and `Original (ru):` / `Original (sv):` / … (verbatim: do not shorten or fix typos). A prompt written in English gets only the `English:` block. Text the owner pasted into the prompt is part of it. Messages sent mid-turn are separate prompts. Format example: [docs/prompts/README.md](docs/prompts/README.md).
- Replace secrets with `<redacted>`.
- Add the session to the index table in [docs/prompts/README.md](docs/prompts/README.md) and fill in the "Outcome" line at the end.

## Languages

- **English** for code, comments, docs, commit messages and the game's source texts.
- **The game is playable in English, Russian and Swedish.** English is the default and the source text in the code: every text goes through `tr('English text', { params })` (`core/i18n.js`) from the first line of UI code; the translations live in `data/lang-ru.js` / `data/lang-sv.js`, keyed by the English text, with a matching entry for every key.
- **Translations are maintained, never left behind.** Every change that adds or rewords a text the player sees (a message, a label, a button, a card, a contract, a coach mark) adds or updates its entry in both tables in the same change; a text that shows up in English in the RU or SV game is a bug. Drop entries whose key is no longer used. Run `node tools/i18n-check.js web` before committing; it also reads the text fields of the `data/` tables (a new text field of a table goes into its `DATA_TEXT_FIELDS`), and a text passed to `tr()` some other way is checked by hand. Metric names stay English in every language, with the local term next to them (spec 03 §4).
- The READMEs: `README.md` (English), `README_RU.md`, `README_SV.md`, linked to each other at the top; a change described in one is described in all three.
- The owner may write prompts in Russian. Answer the owner in the language of the prompt; write project files in English.

## Game rules (from `ivan`)

- **No build step.** No bundler, framework, package manager or `package.json` unless the owner asks for one. The game works by opening `index.html` from `file://` or serving the folder as static files. Node is used only for tests and tools.
- **No third-party libraries** in the game ([ADR-0001](docs/adr/0001-static-vanilla-js.md), [ADR-0003](docs/adr/0003-hand-drawn-canvas-charts.md)); if one is ever needed it is vendored into `lib/`, never loaded from a CDN. The one exception so far: supabase-js for the optional cloud save ([ADR-0007](docs/adr/0007-cloud-save-supabase.md), spec 01 §15.1).
- **Relative links only** (the site is served from `https://gray0072.github.io/ai-precision-recall-lab/`).
- **Mobile adaptation is required.** Layout and canvas resize to the window, devicePixelRatio-aware (capped at 2.5); the three layouts of spec 04 §4.2. On touch devices (`matchMedia('(pointer: coarse)')`) the first Start-like button requests fullscreen (`requestFullscreen` with the webkit fallback, `{ navigationUI: 'hide' }`, in try/catch — iPhone Safari stays windowed and must still work). Viewport meta `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`, the `mobile-web-app-capable` / `apple-mobile-web-app-capable` metas, safe-area insets for the HUD, `touch-action: none` and `preventDefault` on the play area. The touch scheme of this game is spec 01 §11.2 (a relative vertical drag, not `ivan`'s split-screen joystick, which does not fit one vertical control); describe it in the READMEs and the in-game help.
- **The mouse cursor hides in fullscreen** after `CURSOR_HIDE_MS` (2 s) still and shows on any movement (`core/cursor.js`, copied from `ivan/world-aviation/core/cursor.js`).
- **An installable PWA with a crisp Android icon.** `manifest.webmanifest` with `id` = `"/ai-precision-recall-lab/"` (absolute on purpose: a relative `id` resolves against the origin and clashes with every other app on `gray0072.github.io`), `start_url` / `scope` `"./"`, `display: fullscreen`, three PNG icons rendered from `icon.svg` / `icon-maskable.svg` by `bash tools/pwa-icons.sh web` — never drawn by hand. The maskable icon keeps the artwork inside the central circle of radius ≈ 170 of the 512 viewBox; check the PNG cropped to two thirds before committing. Re-render and bump `?v=N` when an icon changes.
- **A new deploy reaches an open app but never interrupts it**: `core/update.js`, `AppUpdate.watch(() => idle)`, idle only on the start screen and the map — never during a contract, a pause, a dialog or the results.
- **Storage is shared with every app on the origin.** Every `localStorage` key starts with `prLab.` (spec 05 §5). Never call `localStorage.clear()`; remove only own keys.
- **The cloud save's Supabase project is shared** with `ivan`'s games and other apps (spec 01 §15.1). Every table and policy this game adds starts with its prefix, the `localStorage` one in lower case (`prlab_progress`, policies `prlab: …`), never a bare `saves`; the schema lives in `supabase/schema.sql`, safe to run again. The session is kept under `prLab.auth`, never the library's default `sb-<project>-auth-token`. The URL and the publishable key in `core/cloud.js` are not secrets (row-level security guards the rows).
- **Three difficulty levels** — Easy, Medium, Hard — selectable on the start screen and in every retry / failure dialog (pre-selected to the current level), remembered (`prLab.difficulty`). What each level changes is spec 01 §10; describe it in the READMEs.
- **Sound can be switched off**: Sound On / Off on the start screen and in the pause dialog, remembered as `prLab.sound`, on by default, read before the first sound; every sound goes through one master gain set to 0 (never a flag checked in each sound).
- **Debug cheats** (spec 01 §14): keyboard only, a banner says what each did, never mentioned in the in-game help, a run with a cheat never updates stars or bests.
- **Arrows and icons are drawn, never shown from a font.** Any arrow, symbol or emoji (`✓ ✗ ▶ ⏸ 🔊 🦠 ⭐ ↑ ↓`) goes through the Icons engine (`data/icons.js`, `core/icons.js`); after adding a character run `node tools/icons-build.js web` and bump what it says changed; canvas text with such a sign uses `Icons.draw` / `Icons.drawText`; a CSS `content` sign is a mask. Punctuation and maths every font has (`× − — ≈ ≥ ≤ √ Σ Φ`) stay text. Never read the `innerHTML` of a text with a sign in it; read `textContent`.
- **Screenshots are in English** (they are used by all three READMEs).
- **Overlay buttons work everywhere**: plain `<button>`s, never covered by touch handlers, and Space / Enter press the visible panel's default button through one global `keydown` listener; arrow keys move the focus between the panel's buttons.

## Code rules (from `ivan`)

- **JS and CSS live in separate files — always.** No inline `<script>` / `<style>` blocks, no `style=` / `onclick=` attributes in `index.html`.
- **Game constants live in `constants.js`**: every gameplay tuning value (speeds, windows, rates, difficulty tables, prices of upgrades, incident parameters) as a top-level `const` with a short comment on units or meaning. Logic files do not declare their own gameplay constants; purely visual constants (palette, sizes of drawings) may stay in their `art/` / `render/` module. Content tables go to `data/`.
- **Code is organised into folders by meaning** (the tree is spec 05 §2). Everything the site serves lives in `web/`; its root keeps only the entry points (`index.html`, `styles.css`, `constants.js`, `game.js`, `campaign.js`) plus icons, manifest and screenshot. The repo root keeps only `web/`, docs, `tests/`, `tools/`, `supabase/` and the dot files. Inside `web/`:
  - `lib/` — vendored third-party code, never edited (`supabase.min.js`, the cloud save's library, copied from `ivan`);
  - `core/` — plumbing with no game rules: i18n, utils, the PRNG, the event bus, audio, input, storage, cursor, icons, update;
  - `data/` — static content as plain declarations, no logic: scenarios, contracts, upgrades, cheat sheet cards, questions, coach marks, translations;
  - `art/` — procedural drawings and the palette;
  - `sim/` — the rules and the math, one file per kind of thing — no drawing, no DOM, no sound;
  - `render/` — drawing the play area (belt, items, pile);
  - `ui/` — HUD, the live panel, charts, the screens, coach marks, and the sounds (game events → sounds, in one file).
- **Data is separate from code**: adding a contract, a card or an upgrade never means touching logic.
- **Every screen and every self-contained feature gets its own file**; one file, one concern; split a file that passes about 1 000 lines.
- **Logic doesn't draw, play sounds or show messages.** `sim/` and `campaign.js` only change state and **emit game events** through `GameEvents` (`core/events.js`, `on` / `emit`); `ui/sounds.js` subscribes and plays, the screens subscribe for banners. With nothing subscribed the logic runs headless (tests, `tools/balance-check.js`).
- **Shared state lives in one place**: `sim/state.js`, plain globals; other files read and change it there.
- **The main loop stays thin**: `game.js` wires buttons and keys to the flow and each frame reads the input and calls the `sim/` updates in a fixed order, then renders.
- **Determinism**: all randomness in `sim/` comes from the seeded streams of `core/rng.js`; no `Math.random` there.
- **Every file starts with a short header comment** saying what it is and what uses it.
- **Plain scripts, not ES modules**; `index.html` loads them in the order of spec 05 §3.
- **Version query strings on asset links**: every local `<link>` / `<script src>` has `?v=N`, bumped whenever that file changes.
- When files move, update the tree in spec 05 §2 and the READMEs in the same change.

## Teaching rules (this project)

- **The math is the product.** Every formula follows spec 02 exactly, including the edge cases (empty denominators, ties, quantized scores, the rolling window at the current threshold). A metric change comes with a test in `tests/` and, if the behaviour changes, a spec update.
- **One vocabulary everywhere**: "positive" is the hunted class (spam, fever, defect, fraud, toxic, relevant), never "the good thing"; the matrix has the model's answer in rows and the truth in columns; the outcome colour code of spec 04 §1 (orange = positive, blue = negative, solid = right, hatched = wrong) is used by the belt, the pile, the matrix, the formulas, the charts and the cheat sheet alike.
- **Every number is traceable**: a metric on screen can always be explained by items the player has seen; do not show a number the panel cannot explain on hover.
- **Do not claim more than the simulation does**: scores are synthetic ([ADR-0002](docs/adr/0002-synthetic-binormal-scores.md)); texts never say they come from a trained model.

## Definition of done

An iteration (or task) is done when:
- [ ] `node --test tests/*.test.js` passes.
- [ ] Every new player-facing text goes through `tr()` and has its RU and SV entries; `node tools/i18n-check.js web` is clean.
- [ ] `node tools/icons-build.js web --check` passes.
- [ ] `?v=N` is bumped for every changed CSS/JS file.
- [ ] A short headless-Chrome run (`tools/cdp.js`) on a phone (portrait and landscape) and a desktop viewport shows no page errors; screenshots look right.
- [ ] Acceptance criteria in the iteration plan are checked; manual checks are described in the Result.
- [ ] Docs are updated (spec, ADR, READMEs, roadmap status, prompt history).

## Commands

```bash
node --test tests/*.test.js                               # simulation unit tests (no browser)
node tools/balance-check.js [--contract C05] [--difficulty hard]   # headless bot over the contracts (from I04)
node tools/i18n-check.js web [--dump]                     # texts missing from data/lang-ru.js / lang-sv.js (--dump: every key)
node tools/png-gif.js <out.gif> <ms> [--scale N] <png…>   # screenshots → animated GIF (docs/showcase.gif)
node tools/icons-build.js web [--check]                   # rebuild data/icons.js (or only check it)
bash tools/pwa-icons.sh web                               # render the PWA PNGs from icon.svg / icon-maskable.svg
node --experimental-websocket tools/cdp.js <steps.js> [out-dir]   # drive the page in headless Chrome
```

Open the game: `web/index.html` from `file://`, or `python -m http.server` in `web/` for a PWA check over http.

## Testing the game

- No Playwright/Puppeteer. Drive the page in headless Chrome over raw CDP with `tools/cdp.js` (copied from `ivan`; see its header): a small steps file (an exported async function) gets `phone(w, h)` / `desktop(w, h)`, `ev(js)`, `shot(name)`, `tap`, `click`, `key`; the tool prints the page's uncaught errors and kills Chrome with all its children (`taskkill /T /F`), also when its wall-clock limit (`--limit`, 120 s) runs out. Keep steps files in a temp folder, not in the repo. Keep runs short and never run several in parallel.
- Headless Chrome takes its language from the system: switch the game to English first (`I18N.set('en')`) before screenshots meant for the repo.
- Long or statistical checks (balance, many contracts, thousands of items) run in Node over `sim/`, never in the browser.

## Pitfalls

- **Line endings are LF** (`.gitattributes`: `* text=auto eol=lf`). Write LF; never commit CRLF.
- **Edit with the editing tools, not `sed -i` or `python -c` one-liners.** Shell quoting mangles escapes (in `ivan` a `'\00d7'` meant for CSS once reached `styles.css` as a NUL byte). For a scripted change put the script in a file and run it.
- **Bump `?v=N`** in `index.html` for every CSS/JS file a change touches — forgetting it leaves players on the old file, and it is also how `update.js` notices a new deploy.
- **Quantized scores**: compare the rounded score with the threshold (`s ≥ t` on values rounded to 0.01, spec 02 §2.1); compare with a small epsilon or on integers (`Math.round(s * 100) >= Math.round(t * 100)`) to avoid floating-point misses at equal values.
- **Pages deploys `web/` only** (`.github/workflows/pages.yml`, Settings → Pages → Source: GitHub Actions): a file the game loads must be inside `web/`. Nothing outside it is served, so the READMEs link to `web/screenshot.png`.

## Git

- Only one branch: `main`. No feature branches, no pull requests.
- Commit message: **one subject line only**, imperative, English, may start with the iteration id: `I03: add the pile and the live confusion matrix`. No body, no trailers, no `Co-Authored-By`, no mention of AI tools.
- Commit or push only when the owner asks.

## Local environment notes

- OS of the owner: Windows 11; shells: PowerShell and Git Bash.
- Node 24 is installed (`node --test` and the tools need 20+; since Node 22 `node --test` takes files or globs, not a folder, hence `tests/*.test.js` — Node expands the glob itself, so it works in PowerShell too; the `--experimental-websocket` flag of `tools/cdp.js` is only needed on Node 20 and is harmless later).
- Headless Chrome: the installed Google Chrome, found by `tools/cdp.js` under `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- `gh` CLI is installed and logged in as `gray0072`. The repo is `gray0072/ai-precision-recall-lab` (public), Pages from the `pages.yml` workflow: a push to `main` deploys to https://gray0072.github.io/ai-precision-recall-lab/.

## Docs to keep in sync

- `README.md` / `README_RU.md` / `README_SV.md` — player-facing.
- `docs/spec/` — the source of truth for the game; update together with the code.
- `docs/plan/` — status and results of iterations.
- `CLAUDE.md` — do not duplicate instructions there; it only points here.
