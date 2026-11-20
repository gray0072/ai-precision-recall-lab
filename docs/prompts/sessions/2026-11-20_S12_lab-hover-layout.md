# Session S12 — 2026-11-20 — Lab hover layout fix (after I07)

No iteration: a fix after the release, owner's request.

## Prompt 1

English:

```text
[screenshot of the Lab in Russian: on hover the "AUC 0.87 → 0" text runs out of the model cards]
On the computer, in the Lab, the layout shifts when the cursor hovers. Fix it and push.
```

Original (ru):

```text
на компе в лабе при наведении курсора плывет верстка. исправь и пуш
```

## Outcome

Pointing at an upgrade made the model cards' AUC line longer ("AUC 0.94 → 0.96"): it ran out of the card and changed the cards' height, so everything below moved. Now each AUC cell holds "AUC now" and "AUC now → next" stacked in one grid cell, only one visible, so the cell is always as wide as the longer text; a row wraps the AUC under the name when it does not fit, the same with and without a preview. Checked in headless Chrome (RU, desktop 1312 / 900 and phone): card sizes identical before and during the hover, nothing overflows.
