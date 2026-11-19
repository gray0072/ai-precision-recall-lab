# AI Precision Recall Lab

A browser game that teaches the metrics of binary classification by letting you draw the line yourself. Letters, passengers, bolts and card payments ride a conveyor belt at the height of their model score; you drag one threshold line, every item is revealed at the gate and falls onto a pile that *is* the confusion matrix, and precision, recall, F1, the ROC and the PR curves react as you move. Twelve client contracts with their own prices for mistakes, a lab of model upgrades, a sandbox and a cheat sheet. Runs on GitHub Pages and on a phone; English first, Russian and Swedish later.

> **Status:** design and spec stage, no code yet. The game is built iteration by iteration, see the [roadmap](docs/plan/roadmap.md).

## The four numbers in one minute

| | Formula | Ask yourself | Remember it as |
|---|---|---|---|
| **Precision** | TP / (TP + FP) | When the model says "yes", how often is it right? | Purity of the Predicted pile |
| **Recall** | TP / (TP + FN) | Of all the real "yes" cases, how many did it catch? | How much of the Real thing you Rounded up |
| **F1** | 2PR / (P + R) | Are both good? | The weakest link: dragged towards the smaller one |
| **Accuracy** | (TP + TN) / all | How many decisions were right? | A smoke detector that never beeps is 99.9 % accurate |

Raise the threshold: fewer alarms, precision usually up, recall always down. The full cheat sheet with mnemonics is in [docs/spec/03-content.md §4](docs/spec/03-content.md#4-cheat-sheet).

## Docs

- [Spec](docs/spec/00-overview.md): idea, gameplay, the math, content, UI, architecture.
- [Roadmap](docs/plan/roadmap.md) and [iteration plans](docs/plan/iterations/).
- [Architecture decisions](docs/adr/README.md).
- [Prompt history](docs/prompts/README.md): every prompt that built this project.
- [AGENTS.md](AGENTS.md): instructions for AI coding agents.
