# AI Precision Recall Lab

A browser game that teaches the metrics of binary classification by letting you draw the line yourself. Letters, passengers, bolts and card payments ride a conveyor belt at the height of their model score; you drag one threshold line, every item is revealed at the gate and falls onto a pile that *is* the confusion matrix, and precision, recall, F1, the ROC and the PR curves react as you move. Twelve client contracts with their own prices for mistakes, a lab of model upgrades, a sandbox and a cheat sheet. Runs on GitHub Pages and on a phone; English first, Russian and Swedish later.

> **Status:** the campaign's first two acts (nine client contracts, with a guided first day), the Lab of model upgrades, incidents (a flu season, a spam wave), the review desk, the drift monitor, the cheat sheet (20 cards) and the sandbox are playable on desktops and phones; installable as an app. Act 3 (an adversary, top-k search, the finale) is next. The game is built iteration by iteration, see the [roadmap](docs/plan/roadmap.md).

## The four numbers in one minute

| | Formula | Ask yourself | Remember it as |
|---|---|---|---|
| **Precision** | TP / (TP + FP) | When the model says "yes", how often is it right? | Purity of the Predicted pile |
| **Recall** | TP / (TP + FN) | Of all the real "yes" cases, how many did it catch? | How much of the Real thing you Rounded up |
| **F1** | 2PR / (P + R) | Are both good? | The weakest link: dragged towards the smaller one |
| **Accuracy** | (TP + TN) / all | How many decisions were right? | A smoke detector that never beeps is 99.9 % accurate |

Raise the threshold: fewer alarms, precision usually up, recall always down. The full cheat sheet with mnemonics is in [docs/spec/03-content.md §4](docs/spec/03-content.md#4-cheat-sheet).

## How to play

- **Mouse and keyboard:** drag the threshold handle, or press anywhere on the belt or the pile and drag; the wheel moves the line by 0.01. ↑ / ↓ or W / S move it by 0.01 (Shift: 0.05), Page Up / Page Down by 0.10. With the review desk, drag the violet handle on the left or press Q / A to move the band's lower edge, and click an item to send it to people. Esc or P pauses. In menus the arrow keys move between buttons and Space / Enter press the highlighted one.
- **Touch:** put a finger anywhere on the belt or the pile and slide it up or down: the line follows the movement, not the finger, so your thumb never covers the items it is judging. The large handle on the right edge can be dragged directly; the review band has its own violet handle on the left edge, and a tap on an item sends it to the review desk. On phones the game goes fullscreen (iPhone Safari stays windowed and still works).
- **Campaign:** you run Cutoff & Co. and take contracts from clients. The map shows them by act; a contract with at least one star opens the next. The **briefing** gives the client's prices for each of the four outcomes, the goal (e.g. Precision ≥ 0.90 over the whole contract), the model card and a quick question (a right answer earns a bonus). During the contract the HUD shows its money, the goal chip (green, amber or red after the first 30 items) and, at the fever gate, the outbreak meter: too many misses and the contract fails, as it does when its money falls below the fee. **Stars:** ★ goal met (or completed, when there is no goal), ★★ also the profit target, ★★★ also 90 % of what the best fixed threshold would have earned on the very same stream, in hindsight. The results show that best threshold, your threshold over time, the profit at every threshold and the lesson. The first contract is a guided tutorial; later ones explain what is new the first time. **Act 2** brings the real world: an accuracy KPI that a model which flags nothing already meets, a flu season that changes the base rate in the middle of a contract (watch precision jump while recall stays), a human **review desk** for the doubtful middle of the scores (people are always right, cost $1 each and can only take a few at a time), and a spam wave that the model has never seen: the **drift monitor** compares the latest scores with the data the model was tested on (PSI) and raises an alert, and **Retrain** brings the model back (once per contract). Incidents are announced 10 s ahead (on Hard when they start).
- **The Lab** (from the map or the results, after the first contract): spend the money on more data and better features (the two humps of the pile move apart and the AUC goes up: point at an upgrade to see its curve), calibration (the badges become probabilities and the best line for the prices appears on Easy and Medium), the drift monitor and the review desk. Upgrades stay for the whole campaign. Money, stars and bests are saved in the browser; **New campaign** asks before it erases them.
- **Cheat sheet:** every metric and idea on a card — the formula in the colours of the matrix, a mnemonic, what to watch out for, an example and a live picture of the pile — plus a "Which metric?" helper. Open it from the start screen, the map, the pause dialog, the results, or by tapping a metric bar twice during play (the game pauses).
- **Sandbox:** the play screen without money or goals. Its knobs (the ☰ button; docked on the right on a desktop) pick the scenario, the base rate, the model's separation d′ (with the AUC it gives), calibrated scores, showing the true class on the belt, the speed, the prices of the four outcomes (the profit curve and, with calibrated scores, the cost-optimal line); **Generate 1 000** fills the pile at once, **Formula view** writes every metric's formula with the live numbers, **Review band** adds a review desk, and the **Calibration** chart tab shows whether the scores (raw or calibrated) are real probabilities. Point at a metric bar (or tap it) to see which cells of the matrix and which part of the pile it is made of. Everything is remembered.
- **Difficulty** (on the start screen, remembered): **Easy** — a slower belt, a better model, a faint hint of the true class, the cost-optimal line always shown, softer goals; **Medium** — the contracts as written; **Hard** — a faster belt, a weaker model, stricter goals, no warning before incidents.
- **Sound** On / Off on the start screen (and in the pause dialog), remembered.

## Run locally

Open `index.html` in a browser (it works from `file://`), or serve the folder: `python -m http.server` and open http://localhost:8000/ (needed to install it as an app). No build step, no dependencies.

Development (Node 20+): `node --test tests/*.test.js` runs the tests; the tools in `tools/` are listed in [AGENTS.md](AGENTS.md#commands).

## Docs

- [Spec](docs/spec/00-overview.md): idea, gameplay, the math, content, UI, architecture.
- [Roadmap](docs/plan/roadmap.md) and [iteration plans](docs/plan/iterations/).
- [Architecture decisions](docs/adr/README.md).
- [Prompt history](docs/prompts/README.md): every prompt that built this project.
- [AGENTS.md](AGENTS.md): instructions for AI coding agents.
