# 04 — UI and design

The look follows the games of the `ivan` repo (`D:\Projects\my\ivan`, the reference is `city-builder/styles.css` and `assets/gallery.css`): a dark navy page, translucent rounded panels and chips, an amber accent for the default action, Segoe UI, tabular numbers, everything readable on a phone. This game adds one thing of its own: a strict colour code for the two classes and the four outcomes, used the same way everywhere (belt, pile, matrix, formulas, charts, cheat sheet).

## 1. Palette

CSS custom properties on `:root` in `styles.css`; canvas code takes the same colours from `art/palette.js` (purely visual constants stay out of `constants.js`, as in `ivan`). Dark theme only, like the `ivan` games.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d1b2a` | page background, menu |
| `--bg-play` | `#13263a` | play area behind the belt |
| `--belt` | `#1c3348` / `#223d55` | belt stripes (scrolling) |
| `--panel` | `rgba(13, 27, 42, 0.95)` | panels, dialogs; border `rgba(255,255,255,0.12)`, radius 18 px, shadow `0 10px 40px rgba(0,0,0,0.5)` |
| `--chip` | `rgba(13, 27, 42, 0.82)` | HUD chips; border `rgba(255,255,255,0.1)`, radius 18 px, height 36 px |
| `--text` | `#eef3f7` | text |
| `--muted` | `#9fb0c3` | labels, secondary text |
| `--accent` | `#ffb300` (hover `#ffc233`) | the threshold line and handle, default buttons, "on" toggles, focus ring `rgba(255,213,79,0.6)` |
| `--pos` | `#ff8a3d` | the **positive** class (the hunted thing): spam, fever, crack, fraud, toxic, relevant |
| `--neg` | `#4fc3f7` | the **negative** class |
| `--good` | `#7bd88f` | goal met, money up |
| `--warn` | `#ffd54f` | goal close, desk full |
| `--bad` | `#ff6b5e` | goal broken, money down, outbreak |
| `--review` | `#b39ddb` | the review band and reviewed items |

**The outcome code:** the colour is the *true* class, the fill says whether the model was right.

| Outcome | Fill | Mark |
|---|---|---|
| TP | `--pos`, solid | ✓ |
| FN | `--pos`, diagonal hatching on a dark ground | ✗ |
| TN | `--neg`, solid | ✓ |
| FP | `--neg`, diagonal hatching on a dark ground | ✗ |

Orange/blue stays apart for the common colour-vision deficiencies, and hatching plus ✓/✗ carry the right/wrong meaning without colour. Red and green are never the only difference between two things.

Buttons, chips, the language switcher and panels are the `ivan` ones (`.btn`, `.btn.default`, `.btn.secondary`, `.btn.big`, `.btn.toggle`, `.chip`, `.round`, `.panel`, `#overlay`, `.langPick`), copied into `styles.css` and adapted.

## 2. Typography and numbers

- `font-family: 'Segoe UI', Arial, sans-serif`; `font-variant-numeric: tabular-nums` for every number that changes (metrics, counts, money, the threshold), so they do not jitter.
- Metrics show two decimals (`0.86`), money whole dollars with a sign (`+$412`, `−$30`), the threshold `t = 0.62` (or `p ≥ 0.62` when calibrated), percentages only for base rates ("4 %").
- Formulas are set in plain text with coloured terms (`<span class="tp">TP</span>`), not images, so they translate and scale.

## 3. Screens

All screens except the play area are panels in `#overlay` (as in `ivan`), centred, scrollable on small screens; Space / Enter press the default button, arrows move the focus (01 §11).

| Screen | Content |
|---|---|
| **Start** | The language switcher (EN · RU · SV) at the top; the logo (the game icon, large) and the title **AI Precision Recall Lab**; a one-line tagline ("Draw the line between spam and mail, sick and healthy, fraud and honest — and learn why every line has a price"); **Continue** (default, when a campaign exists) / **New campaign**; **Sandbox**; **Cheat sheet**; Difficulty Easy · Medium · Hard (toggle row, with a one-line description of the selected one); Sound On · Off; **How to play** (collapsible). The attract demo runs behind it (01 §9). |
| **Map** | Three act rows of contract cards (client avatar, name, stars per level, lock); the balance; **Lab**; **Cheat sheet**; back to Start. A "test save" tag when cheated. |
| **Briefing** | 01 §3.1: avatar and message, the terms table (prices with the outcome colours), the goal, the model card, the quick question, Start / Back. |
| **Play** | §4. |
| **Pause** | 01 §12. |
| **Results** | 01 §3.4: stars (animated in one by one), money, goal, the final matrix and metrics table, the threshold sparkline with the hindsight-best line, the profit curve, the lesson card, buttons with the difficulty row for Retry. Failure ("Outbreak!" / "Bankrupt!") uses the same panel with a red header and no stars. |
| **Lab** | 01 §5: the balance; a model card per family (its scenarios with their AUC, a mini binormal ROC); the upgrade cards (price, effect, why it works in real ML, Buy / Bought / Needs … first / Not enough money). Pointing at an upgrade (hover or focus) shows "AUC 0.94 → 0.95" on the families it touches, and their mini ROC morphs to the new curve over the old one, faint. |
| **Sandbox** | The play screen with the knobs panel (01 §7) instead of the HUD's contract chips: docked at the right on desktops, a drawer from the right on phones (closed at first); the HUD's ☰ button opens and closes it. |
| **Cheat sheet** | A grid of cards (03 §4), two or three columns on desktop, one on phones; a card opens full-size with its live pile picture; a search field filters by name; the "Which metric?" flow as the first card. Opened from play, it is an overlay over the paused game with a Back button. |
| **End card** | After a won C12, from its results ("The end"): fireworks over the panel (`ui/fireworks.js`, from `ivan`'s city-builder, in the game's orange, blue and amber; none with `prefers-reduced-motion`), "Cutoff & Co. is now a unicorn", the total stars, the titles earned (03 §2), and the buttons **Play again on Hard** (default; it sets the difficulty and opens the map; hidden when already on Hard), **Map**, **Start screen** (`ui/endcard.js`). |

## 4. The play screen

### 4.1 Parts

- **HUD** (top, chips, `pointer-events: none` except buttons, safe-area aware): contract name; items left (`142 / 300`); contract money (`+$86`, green/red); the goal chip (`Precision 0.93 ≥ 0.90`); special meters (outbreak `🦠 2 / 4`, the review desk `👥 2 / 3` that flashes "Desk full" in red, the PSI chip with its value in the PSI colours and a small chart of the last values with the alert level dashed, the incident chip with its countdown and then its name in violet); on the right the Retrain button (when the monitor is there: "Retrain", red and pulsing after the alert, "Retraining… 9 s", "Retrained"), sound 🔊/🔇 and pause. On a phone held upright the chips wrap onto more rows; the buttons on the right keep their size.
- **Belt area** (a `<canvas>`, devicePixelRatio-aware, capped at 2.5): with a review desk a column for the band's violet handle at the left edge (`review 0.35`), the score axis, the belt with items, the gate (a vertical scanner arch with a light that flashes the outcome colour), the pile on the right, the threshold line across belt and pile with the handle, the review band (a violet stripe with its own handle) and the ghost line (dashed). Incident banners and coach marks appear over it.
- **Live panel** (DOM): the confusion matrix, the metric bars, the charts (each chart is a small `<canvas>`).

### 4.2 Layouts

| Viewport | Layout |
|---|---|
| Desktop / tablet landscape (width ≥ 1000 px, height ≥ 500 px) | Belt area across the top ~60 % of the height (belt ~65 % of its width, pile ~35 %); the live panel below in one row: matrix · metric bars · ROC · PR (· profit on Easy and in the sandbox). When the charts would get less than 200 px each (a narrower window, or the sandbox's knobs docked), they go under tabs, one at a time. |
| Phone landscape (height < 500 px) | Belt area on the left ~62 % of the width, full height under the HUD; a right column with the matrix and the metric bars; the charts behind a "Charts" tab button that swaps the column's content (ROC / PR / profit). |
| Phone portrait | Belt area on top ~45 % of the height; under it the matrix and the bars side by side; under them one chart at a time with tabs ROC · PR · Profit. The handle is at the right edge of the belt area, the review handle at its left edge. |

The canvas and the panels resize with the window (`window.innerWidth/innerHeight`, `resize` and `orientationchange`), no fixed pixel sizes. The belt's travel time stays the same at every size (speed in "belt widths per second").

### 4.3 Motion

- The belt stripes scroll; items bob very slightly; at the gate an item flips (scale X to 0 and back with the revealed drawing), then flies on a short arc to its pile row and shrinks into a square.
- Matrix cells pulse once when an item lands; metric bars ease to new values (150 ms); the operating point slides along the curve as the line moves.
- Money floats up from the gate and fades.
- `prefers-reduced-motion`: no bobbing, no flips (instant reveal), no arcs (items fade into the pile), no attract demo.

## 5. Drawings

All drawings are procedural (Canvas 2D paths), no image files, in `art/`:

- **Items** (`art/items.js`): per scenario a hidden and two revealed versions (03 §1), drawn at any size, with the score badge as a rounded pill above the item (dark pill, white tabular number; the class colour as a thin outline once revealed). Fraud items show the amount (`$1 240`).
- **Clients** (`art/clients.js`): six simple avatars in the same flat style (a pigeon with a mailbag, a nurse with a mask, a factory foreman with a helmet, a banker with a coin, a chat bubble mascot, a magnifying-glass mascot).
- **The gate**: a scanner arch with the scenario's look (a mail slot, a thermal camera, an X-ray, a card terminal, a moderator's desk, a search box).
- The look is flat and friendly (rounded shapes, thick outlines, no gradients except subtle highlights), matching the `ivan` games, original artwork only.

## 6. Charts

Hand-drawn on Canvas 2D ([ADR-0003](../adr/0003-hand-drawn-canvas-charts.md)), in `ui/charts.js`:

- Square plot areas with axes 0–1, three grid lines, axis labels in `--muted` 11 px ("FPR", "TPR", "Recall", "Precision").
- ROC: the model curve in `--text` 2 px, the chance diagonal dashed, the area under it filled with 8 % white; the operating point a filled `--accent` dot 6 px with the threshold value next to it; the live ring hollow 1.5 px; AUC printed in the corner.
- PR: the curve, the base rate line dashed and labelled ("random: 0.04"), the dot and the ring, AP in the corner.
- Profit: money against the threshold, zero line, the current threshold as a vertical accent line, the best threshold as a dashed one with its value.
- Results sparkline: the threshold against the item number, the hindsight-best as a dashed horizontal line, incident moments as small marks.
- Reliability diagram (sandbox, results of calibrated contracts): bars of the observed share per bin against the diagonal. In the sandbox it is a fourth chart tab ("Calibration") on the rolling window, of the raw score or of p. On the results of a contract with a base rate shift two bars per bin: before the shift (grey) and after it (violet).
- "Recent" curves (with the drift monitor): ROC and PR of the rolling window, dashed violet, next to the model's; the ROC corner also prints the recent AUC.
- Results with incidents: a small table per base rate shift or drift with precision, recall, FPR and the share of positives before it and after it ramped in.
- Charts redraw only when something changed (the threshold, new items, a new validation set), not every frame.

## 7. Sound

Synthesized with Web Audio (no audio files), in `core/audio.js` (the engine and the recipes) and `ui/sounds.js` (game events → sounds; the only file that plays them), as in `ivan`:

| Event | Sound |
|---|---|
| TP | a soft rising "ding" |
| TN | a very quiet tick (most items are TN: it must not tire) |
| FP | a dull "thunk" |
| FN | a low buzz; with the outbreak meter a cough-like noise burst |
| money milestone, goal reached | a coin chime |
| goal broken (chip turns red) | a short two-tone warning, at most once per 5 s |
| incident banner | a radio "blip-blip" |
| stars on the results screen | one note per star, rising |
| purchase in the Lab | a cash register |
| belt | a faint low hum while the belt runs, ducked when paused |
| a top-k query (C11) | one "shuffle" of pages and a note, higher the larger the query's recall@k — one sound per query, not per document |
| a new phase (C12) | a two-note "next client" chime |
| drift alert | a two-tone alarm; Retrain done: a rising arpeggio |
| desk full | a short low beep, at most once a second |
| contract failed (outbreak, bankruptcy) | a falling four-note phrase |
| sandbox Generate | a short rustle |
| end card fireworks | a rising whistle per rocket, a bang per burst (from `ivan`'s city builder) |

The attract demo (01 §9) is silent: it emits the item events too, and `ui/sounds.js` ignores every event while `State.run.kind === 'demo'`. Frequent sounds are throttled (one of a kind per 60 ms; TN per 120 ms), so a fast belt or the sandbox never turns into noise.

The **Sound** switch (On / Off, on the start screen and in the pause dialog) is remembered as `prLab.sound` (`on` / `off`, default `on`) and read before the first sound; every sound goes through one master gain set to 0 or 1 at once.

## 8. Languages

- **English is the source and the default**; the game is also playable in **Russian** and **Swedish** (added in I07; owner's decision: English first). Every text goes through `tr('English text', { params })` (`core/i18n.js`, copied from `ivan`'s `world-aviation`), the translations live in `data/lang-ru.js` / `data/lang-sv.js`, keyed by the English text, with an entry for every key. Texts from `data/` tables (contracts, cards, upgrades, questions) go through `tr()` as well, by variable.
- **The switcher** is `ivan`'s: a pill of buttons **EN · RU · SV** in this order, a flag (`art/flag-gb.svg`, `flag-ru.svg`, `flag-se.svg`, copied from `ivan/assets/`) and the two-letter code each, the language's own name as the tooltip, the active one `aria-pressed="true"`. It sits at the top of the start screen (and the results / end card), never over the play area. The choice applies at once without a reload and is remembered as `prLab.lang`; on a first visit: the browser's language, then English.
- Metric names stay English in every language, with the local term next to them where it helps (03 §4 "Local terms"): the English names are what the player will meet in papers and libraries.
- Screenshots and the GIF for the READMEs show the English UI.

## 9. Icons

- **Arrows, symbols and emoji are drawn, never taken from a font** (`ivan` rule): the Icons engine (`data/icons.js`, `core/icons.js`, built by `node tools/icons-build.js .`) turns every such character in the page's text into an SVG; canvas code uses `Icons.draw` / `Icons.drawText`. Characters used: ✓ ✗ ▶ ⏸ 🔊 🔇 🦠 👥 ⭐ 💰 ✦ ↑ ↓ ← →.
- **The game icon** (`icon.svg`, 512 × 512, rounded tile `rx="112"`): on the dark navy tile, a few orange and blue dots rising in two overlapping humps, cut by one bold amber horizontal line with a handle at the right end. `icon-maskable.svg`: the same full-bleed, the art inside the central circle of radius ≈ 170; PNGs from `bash tools/pwa-icons.sh .`.

## 10. Accessibility

- Colour code with hatching and ✓/✗ (§1); every chart value is also a number in the panel.
- Full keyboard play (01 §11), visible focus ring on buttons; the threshold handle is a `role="slider"` element with `aria-valuenow` mirrored over the canvas, so screen readers announce the threshold.
- Text at least 12 px on phones; touch targets at least 44 px.
- `prefers-reduced-motion` (§4.3).
- **The mouse cursor hides in fullscreen** after `CURSOR_HIDE_MS` (2 s) still and shows on any movement (`core/cursor.js` from `ivan`).
