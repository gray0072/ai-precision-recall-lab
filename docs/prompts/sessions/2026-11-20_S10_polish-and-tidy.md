# Session S10 — 2026-11-20 — Polish and tidy (after I07)

No iteration: fixes and additions after the release, owner's request.

## Prompt 1

English:

```text
The Lab: when scrolling, the AUC texts turn green for a moment. Apparently it's the down event on the card firing. Let's do it some other way, maybe first a click to try it on, then buy, or with a separate button. Plus on the phone I can't see the result when I hold a tap on the bottom cards, it's scrolled up at the top. Maybe we can sacrifice that, the main thing is to remove the flickering bug.
In the game, tapping Recall shows a popup with a description, and then there's no way to get rid of it. But if you click Recall again, a big description appears. Make the popup hide on a tap elsewhere or on it. Or some other logical way.
Can we add double speed?
Tidy up the repo root, put the front-end files and images in a folder.
push
```

Original (ru):

```text
Лаборатория, при скролле на мгновение тексты AUC становятся зелёными. Видимо это событие down по карточке отрабатывает. Давай сделаем как-то по другому, может сначала клик примерить, потом купить, или отдельной кнопкой. Плюс на телефоне я не вижу результат когда держу тап на нижних карточках, он проскроллен вверху. может этим можно пожертвовать, главное багу с миганием убрать.
В игре при тапе на Recall появляется попап с описанием, потом его никак не убрать. Но если кликнуть recall ещё раз появляется большое описание. Сделай скрытие попапа по тапу в стороне или по нему. или как-то еще логично.
Можно добавить двойную скорость?
приберись в корне репо, файлы фронта и картинки сложи в папку.
пуш
```

## Outcome

The Lab no longer previews on a touch (a scroll that starts on a card flashed the AUCs green): the mouse hover and the keyboard focus preview, a tap / click on a card tries the upgrade on until tapped again, and the tried card lists its AUC changes itself, so a phone sees them without scrolling up; the button buys. A pinned metric tooltip closes on a tap on it or anywhere outside the bars and says so; pausing clears it. A ×2 button in the contract HUD runs the sim at FAST_SPEED (2), remembered as prLab.fast. The game moved into web/ (index.html, scripts, code folders, lib/, icons, manifest, screenshot); Pages now deploys web/ through .github/workflows/pages.yml after the tests, the i18n check and the icons check (ADR-0008, .nojekyll removed); tests/load.js, tools/cdp.js and the tools' folder argument (web) follow; spec 01 / 04 / 05, AGENTS.md and the READMEs updated.
