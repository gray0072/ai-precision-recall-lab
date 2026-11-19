# AI Precision Recall Lab

A browser game that teaches the metrics of binary classification by letting you draw the line yourself. Letters, passengers, bolts and card payments ride a conveyor belt at the height of their model score; you drag one threshold line, every item is revealed at the gate and falls onto a pile that *is* the confusion matrix, and precision, recall, F1, the ROC and the PR curves react as you move. Twelve client contracts with their own prices for mistakes, a lab of model upgrades, a sandbox and a cheat sheet. Runs on GitHub Pages and on a phone; English first, Russian and Swedish later.

> **Status:** early skeleton: the start screen (difficulty, sound, how to play), installable as an app; the belt, the campaign, the sandbox and the cheat sheet are still placeholders. The game is built iteration by iteration, see the [roadmap](docs/plan/roadmap.md).

## The four numbers in one minute

| | Formula | Ask yourself | Remember it as |
|---|---|---|---|
| **Precision** | TP / (TP + FP) | When the model says "yes", how often is it right? | Purity of the Predicted pile |
| **Recall** | TP / (TP + FN) | Of all the real "yes" cases, how many did it catch? | How much of the Real thing you Rounded up |
| **F1** | 2PR / (P + R) | Are both good? | The weakest link: dragged towards the smaller one |
| **Accuracy** | (TP + TN) / all | How many decisions were right? | A smoke detector that never beeps is 99.9 % accurate |

Raise the threshold: fewer alarms, precision usually up, recall always down. The full cheat sheet with mnemonics is in [docs/spec/03-content.md §4](docs/spec/03-content.md#4-cheat-sheet).

## How to play

- **Mouse and keyboard:** drag the threshold handle, or press anywhere on the belt or the pile and drag; the wheel moves the line by 0.01. ↑ / ↓ or W / S move it by 0.01 (Shift: 0.05), Page Up / Page Down by 0.10. Esc or P pauses. In menus the arrow keys move between buttons and Space / Enter press the highlighted one.
- **Touch:** put a finger anywhere on the belt or the pile and slide it up or down: the line follows the movement, not the finger, so your thumb never covers the items it is judging. The large handle on the right edge can be dragged directly. On phones the game goes fullscreen (iPhone Safari stays windowed and still works).
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
