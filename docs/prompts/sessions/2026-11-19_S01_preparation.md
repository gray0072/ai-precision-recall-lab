# Session S01 — 2026-11-19 — Project preparation

- **Iteration:** I00 (preparation: game design, spec, plan, repo conventions)
- **Agent:** Claude Code (VS Code)
- **Outcome:** game designed ("Threshold Tycoon"); spec in `docs/spec/`, roadmap with iterations I01–I07, three ADRs, AGENTS.md / CLAUDE.md, prompt history. No code; implementation starts in the next session after the owner's review.

---

## Prompt 1

English:

```text
Initially I wanted:
Write the main parameters such as recall, their meaning and how to remember them. Suggest a cool, interesting project for GitHub on this topic, it can be in a game form or a cool demo for Pages
here was the answer:
Idea for GitHub + GitHub Pages: "Threshold Tycoon" (Border Guard Simulator / Anti-fraud Dispatcher)
For GitHub Pages an ideal fit is an interactive browser simulator game in pure JS (or React + Canvas/Chart.js) without a backend, which visually and clearly teaches the Precision/Recall trade-off.
Game concept
The player acts as an AI architect or a scanner operator in one of three locations (difficulty modes with a different class balance):
Spam filter (high Precision needed): A stream of emails (90% ordinary, 10% spam). For every ordinary email sent to spam (FP), the boss fines you.
Medical screening / Virus control (high Recall needed): A stream of passengers (98% healthy, 2% infected). If you let an infected one through (FN), an epidemic starts and it is Game Over.
Bank anti-fraud (an F1 balance needed): A stream of transactions of different amounts, where every error has its own monetary price.

Gameplay and mechanics
The main control is the Threshold slider (confidence threshold from 0.0 to 1.0). A conveyor with objects moves across the screen, above each one the neural network's probability glows (e.g. 0.73). The player moves the slider in real time, watching how the cut-off line divides the stream into "Pass" and "Block".
Live Confusion Matrix: Four baskets on the screen, into which cards/balls physically fall (TP, FP, TN, FN).
Dynamic charts: On the right, the ROC curve and the PR curve are drawn in real time with a running dot of the current threshold.
Upgrades (leveling up the model): With the points earned the player can "fine-tune the model" (move the class distributions apart, shrinking the overlap zone) or add new features.

fantasize on this topic and make a spec for the application. we will code in the next session after the review. commit.
save the prompts as described in D:\Projects\my\ai-rag-film-search, set up the agents in the same way.
take the web app's look and rules from D:\Projects\my\ivan. the code structuring rules too. there will be one game
```

Original (ru):

```text
изначально я хотел:
Напиши основные параметры такие как recall их смысл и как их запомнить. Предложи классный интересный проект для гитхаба на эту тему, можно в игровой форме или крутую демку для pages
вот был ответ:
Идея для GitHub + GitHub Pages: «Threshold Tycoon» (Симулятор пограничника / Антифрод-диспетчера)
Для GitHub Pages идеально подойдет интерактивная браузерная игра-симулятор на чистом JS (или React + Canvas/Chart.js) без бэкенда, которая визуально и наглядно учит компромиссу Precision/Recall.
Концепция игры
Игрок выступает в роли AI-архитектора или оператора сканера в одной из трех локаций (режимов сложности с разным балансом классов):
Спам-фильтр (нужен высокий Precision): Поток писем (90% обычных, 10% спам). За каждое обычное письмо, отправленное в спам (FP), босс штрафует.
Мед-скрининг / Вирусный контроль (нужен высокий Recall): Поток пассажиров (98% здоровы, 2% заражены). Если пропустить зараженного (FN) — начинается эпидемия и Game Over.
Банковский Антифрод (нужен баланс F1): Поток транзакций разного номинала, где у каждой ошибки своя денежная цена.

Геймплей и механики
Главный контроллер — ползунок Threshold (Порог уверенности от 0.0 до 1.0). По экрану едет конвейер с объектами, над каждым светится вероятность от нейросети (например, 0.73). Игрок двигает ползунок в реальном времени, наблюдая, как линия отсечения делит поток на «Пропустить» и «Заблокировать».
Живая матрица ошибок (Confusion Matrix): Четыре корзины на экране, куда физически падают карточки/шарики (TP, FP, TN, FN).
Динамические графики: Справа в реальном времени рисуется ROC-кривая и PR-кривая с бегающей точкой текущего порога.
Апгрейды (прокачка модели): За заработанные очки игрок может «дообучить модель» (раздвинуть распределения классов, уменьшив зону пересечения) или добавить новые фичи.

пофантазируй на эту тему и сделай спеку для приложения. кодить будем в следующей сессии после ревью. коммит.
промпты сохраняй как описано в D:\Projects\my\ai-rag-film-search настрой agents ааналогично.
оформление web-приложения и правила возьми из D:\Projects\my\ivan. правила структурирования кода тоже. игра будет одна
```
