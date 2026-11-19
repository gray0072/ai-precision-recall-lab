# 03 — Content

Content tables. In code each table is a file in `data/` (05 §2) with plain declarations; ids are stable. Money and targets are tuned by `tools/balance-check.js` (05 §7; Act 1 in I04, the rest in I05–I06): ★★★ must be reachable on at least 90 % of the streams on every level (the hindsight-best meets the goal and the ★★ target), so the ★★ target sits near the 10th percentile of the hindsight-best profit on Hard; and t = 0.5 must not win ★★★ on C02, C03 and C05. All texts below are the English source; the translations live in `data/lang-ru.js` / `data/lang-sv.js` (04 §8).

## 1. Scenarios

| Id | Name | Client | Positive (hunted) | Negative | Item drawing (hidden → revealed) | Base `π` | Base `d'` | Temperament `γ`, `β` | Family |
|---|---|---|---|---|---|---|---|---|---|
| `spam` | Inbox Guard | Pigeon Post (a mail service) | spam letter | ordinary letter | closed envelope → open with a skull seal / with a plain letter | 0.25 | 2.2 | 1.5, +0.3 (overconfident, a bit high) | text |
| `fever` | Fever Gate | Harbor Clinic (a port's health service) | feverish passenger | healthy passenger | passenger in a coat → thermometer red / green | 0.05 | 2.0 | 0.8, −0.6 (timid, low) | sensor |
| `bolts` | Bolt Inspector | Boltworks (a factory) | cracked bolt | good bolt | bolt in a box → bolt with a crack / shiny bolt | 0.12 | 2.4 | 1.2, −0.2 | sensor |
| `fraud` | Card Watch | Coinpurse Bank | fraudulent payment | genuine payment | card with the amount → card with a red stamp / green tick | 0.03 | 2.2 | 1.8, +0.8 (overconfident, very high: 0.5 flags far too much) | behaviour |
| `moderation` | Comment Patrol | Chatterbox (a social network) | toxic comment | fine comment | grey speech bubble → spiky red / round blue | 0.15 | 1.6 | 1.0, 0 | text |
| `retrieval` | Search Ranker | Seekwell Search | relevant document | irrelevant document | page → page with a star / plain | 2–8 of 30 per query | 1.8 | 1.0, 0 | text |

Families get the Lab's feature upgrades (§3). "Abstract" (sandbox, attract demo) draws dots: orange for positives, blue for negatives.

## 2. Contracts

Prices are per item outcome: `TP / FP / FN / TN`. Fraud prices: TP $0 (prevented), FP −$5 (a blocked customer, and the commission is lost), FN −amount (chargeback), TN +2 % of the amount (commission). Rates are items per second at ×1. Goals are on the whole contract (01 §3.3); "—" = no metric goal (★ for completing). Incidents use item indexes (02 §6).

### Act 1 — First clients

| Id | Name | Scenario | Teaches | `π` | `d'` | Items | Rate | Prices | Goal | Special | Fee | ★★ target |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | First day | spam | the confusion matrix (tutorial) | 0.25 | 2.4 | 100 | 0.8 | +3 / −4 / −1 / 0 | — | coach marks (01 §13) | $100 | $15 |
| C02 | Never lose an invoice | spam | precision | 0.25 | 2.2 | 300 | 1.2 | +3 / −10 / 0 / 0 | Precision ≥ 0.90 | | $200 | $30 |
| C03 | Fever gate | fever | recall | 0.06 | 2.0 | 300 | 1.2 | +12 / −1 / −30 / 0 | Recall ≥ 0.85 | outbreak meter, allowance 4 FN | $250 | $35 |
| C04 | Bolt inspector | bolts | F1 and the trade-off | 0.12 | 2.4 | 300 | 1.4 | +4 / −3 / −3 / 0 | F1 ≥ 0.60 | | $250 | $20 |
| C05 | Big money | fraud | cost-sensitive thresholds, amounts | 0.03 | 2.2 | 400 | 1.5 | fraud prices | — | amounts on items | $300 | $75 |

Act 1 as tuned in I04 (the starting values were +2 / −4 / −1 / 0, ★★ $30; 240 items, +2 / −10 / −1 / 0, $40; +5 / −1 / −30 / 0, $20; 250 items, +3 / −3 / −3 / 0, F1 ≥ 0.65, $50; 300 items, $250): on 100–300 items the hindsight-best profit varies a lot from stream to stream, and with the old prices it was often negative on Hard. C02 now prices a missed spam at $0 ("a bit of spam in the inbox they can live with"), which keeps its p* at 10 / 13 = 0.77; C03 pays more for a caught fever, so recall ≥ 0.85 can also earn money; C04 and C05 got longer streams (less luck) and C04 a softer goal (on Hard F1 ≥ 0.67 was out of reach on a quarter of the streams). `node tools/balance-check.js` prints the table per level.

### Act 2 — The real world

| Id | Name | Scenario | Teaches | `π` | `d'` | Items | Rate | Prices | Goal | Special | Fee | ★★ target |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C06 | The accuracy trap | fraud | accuracy on rare classes | 0.02 | 2.0 | 300 | 1.5 | fraud prices | Accuracy ≥ 0.98 (the client's KPI) | the results also show MCC and balanced accuracy | $300 | $200 |
| C07 | Flu season | fever | precision depends on the base rate | 0.04 → 0.20 | 2.0 | 320 | 1.4 | +5 / −1 / −30 / 0 | Recall ≥ 0.85 | base rate shift at item 120; outbreak allowance 6 | $350 | $60 |
| C08 | Comment patrol | moderation | triage: a human review band | 0.15 | 1.6 | 300 | 1.5 | +3 / −6 / −6 / 0, review −$1 | — | review desk II lent for free | $350 | $150 |
| C09 | Spam wave | spam | drift, monitoring, retraining | 0.25 | 2.4 | 320 | 1.4 | +2 / −10 / −1 / 0 | Precision ≥ 0.90 | drift `shift` 1.2 at item 120; Drift monitor lent for free | $400 | $40 |

### Act 3 — Scale-up

| Id | Name | Scenario | Teaches | `π` | `d'` | Items | Rate | Prices | Goal | Special | Fee | ★★ target |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C10 | Fraud ring | fraud | adversaries game a fixed threshold | 0.04 | 2.4 | 350 | 1.6 | fraud prices | — | adversary from item 100 | $450 | $300 |
| C11 | Search ranker | retrieval | precision@k and recall@k, RAG | 2–8 of 30 | 1.8 | 25 queries | 1 query / 4 s | +3 per relevant shown, −1 per irrelevant shown, −2 per relevant missed | mean Recall@k ≥ 0.80 | the knob is k (02 §7) | $450 | $150 |
| C12 | The big pitch | spam → fever → fraud | everything | per phase | per phase | 3 × 120 | 1.6 | per phase | per phase: Precision ≥ 0.90 / Recall ≥ 0.85 / — | a price change in each phase (FP ×2, FN ×2, FP ×0.5); rush hour in phase 3 | $800 | $300 |

C12's star rules: ★ needs every phase's goal met; the hindsight-best is computed per phase (one threshold per phase). Completing C12 shows the fireworks and the campaign's end card ("Cutoff & Co. is now a unicorn"), with the total stars.

### Lesson cards (results screen, "What you learned")

| Contract | Lesson | Card |
|---|---|---|
| C01 | Every decision lands in one of four cells. The second word (Positive / Negative) is what the model said; the first (True / False) is whether it was right. | G-matrix |
| C02 | Precision asks: of what I flagged, how much was right? To raise it, raise the threshold — and pay with recall. | G-precision |
| C03 | Recall asks: of all the real cases, how many did I catch? High recall on a rare class means many false alarms; that is the price. | G-recall |
| C04 | F1 is high only when both precision and recall are: the harmonic mean is dragged towards the weaker one. | G-f1 |
| C05 | The best threshold follows the prices, not the model: with big amounts at stake, flag on smaller suspicion. | G-cost |
| C06 | With 2 % fraud, flagging nothing is 98 % accurate and catches nothing. On rare classes, look at precision, recall, MCC or PR AUC. | G-accuracy |
| C07 | The base rate went up, recall stayed, precision jumped. Precision depends on how common the positive class is; recall and FPR do not. | G-prevalence |
| C08 | Let the model decide where it is sure and send the doubtful middle to people. A review band buys precision and recall at once — for a fee. | G-review |
| C09 | The world changed under the model: the scores drifted, the curve sagged. Watch the inputs, and retrain when they move. | G-drift |
| C10 | A fixed, predictable threshold is a target. Attackers land just under it; moving it, or checking the zone below it, breaks the trick. | G-threshold |
| C11 | Top-k is a threshold per query. Bigger k: better recall, worse precision — in RAG, more facts for the LLM and more noise and tokens. | G-topk |
| C12 | There is no "best metric", only the best metric for this client's costs. | G-which |

## 3. Upgrades

The Lab opens after C01. Effects add up; `d'` bonuses apply to every contract of the family, including replays.

| Id | Name | Effect | Price | Needs |
|---|---|---|---|---|
| U-data-1 | More data I | `d'` +0.25, every family | $300 | |
| U-data-2 | More data II | `d'` +0.25, every family | $700 | U-data-1 |
| U-data-3 | More data III | `d'` +0.25, every family | $1 500 | U-data-2 |
| U-feat-text | Text features (word patterns, sender reputation) | `d'` +0.4, text family | $900 | |
| U-feat-sensor | Sensor features (thermal camera, ultrasound) | `d'` +0.4, sensor family | $900 | |
| U-feat-behaviour | Behaviour features (device, payment speed, merchant history) | `d'` +0.4, behaviour family | $900 | |
| U-calib | Calibration (Platt scaling) | calibrated `p` on badges; ghost line on Easy/Medium; reliability diagram | $600 | |
| U-drift | Drift monitor | PSI chart and alert; Retrain once per contract; "recent" curve | $500 | |
| U-review-1 | Review desk I | review band, `REVIEW_RATE` level I | $800 | |
| U-review-2 | Review desk II | level II | $1 000 | U-review-1 |
| U-review-3 | Review desk III | level III | $1 400 | U-review-2 |

Each upgrade card shows the "before → after" AUC of the families it touches (02 §2.1) and a one-line explanation of why it works in real ML (e.g. "More labelled examples let the model learn finer patterns: the two humps move apart").

## 4. Cheat sheet

The cheat sheet screen (04 §3) shows these cards. Every card has: **name** (with the local term in RU/SV, below), **formula** with its terms coloured like the matrix cells (TP orange solid, FP blue hatched, FN orange hatched, TN blue solid), **in one line**, **how to remember it**, **watch out**, **example** (from a scenario, with numbers), and a small **picture**: the pile with the card's regions highlighted (drawn live from a fixed seed). Cards link to each other.

| Id | Name | Formula | In one line | How to remember it | Watch out | Example |
|---|---|---|---|---|---|---|
| G-matrix | Confusion matrix | rows: what the model said; columns: what was true | Every decision is one of four: TP, FP, FN, TN. | **Read it backwards:** the second word is what the model *said* (Positive / Negative), the first is whether that was *right* (True / False). FP = "said Positive, and that was False". | Libraries differ: scikit-learn puts the *true* class in rows. Always read the labels. "Positive" means "the thing we hunt", not "good". | Spam filter: a real invoice sent to spam is an FP. |
| G-threshold | Threshold | flag if score ≥ t | The line that turns a score into a decision. The model ranks; the threshold decides. | **The seesaw:** raise the bar → fewer alarms → precision usually ↑, recall always ↓. | 0.5 is not special: it is only right for calibrated scores and equal costs. A fixed, known threshold can be gamed. | Card Watch: at 0.5 the overconfident model flags far too many payments. |
| G-precision | Precision (PPV) | TP / (TP + FP) | When the model says "yes", how often is it right? | **Precision = Purity of the Predicted pile.** The boy who cries "wolf!": how often is there really a wolf? | Ignores what was missed: flag one sure item and precision is 100 %. Depends on the base rate (G-prevalence). | 42 spam flagged rightly, 7 invoices flagged wrongly: 42 / 49 = 0.86. |
| G-recall | Recall (sensitivity, TPR) | TP / (TP + FN) | Of all the real positives, how many did the model catch? | **Recall = how much of the Real thing you Rounded up.** A fishing net: recall is the share of the lake's fish that ended up in your net. | Flag everything and recall is 100 %. It says nothing about false alarms. | 15 feverish passengers, 13 stopped: 13 / 15 = 0.87. |
| G-specificity | Specificity (TNR) | TN / (TN + FP) | Of all the real negatives, how many were left alone? | **Specificity Spares the healthy.** Doctors: **SpPIn** — a very Specific test, when Positive, rules IN; **SnNOut** — a very Sensitive test, when Negative, rules OUT. | Like recall, but for the negative class. On rare positives it is high almost by default. | 285 healthy, 260 let through: 0.91. |
| G-fpr | False positive rate (fall-out) | FP / (FP + TN) = 1 − specificity | The false alarm rate: of the real negatives, how many got flagged? | **The x-axis of ROC:** "how often do I cry wolf when there is no wolf?" | Not the same as 1 − precision (that is the false discovery rate, over the *flagged*). | 25 of 285 healthy passengers stopped: 0.09. |
| G-accuracy | Accuracy | (TP + TN) / all | Share of all decisions that were right. | **The accuracy paradox:** a smoke detector that never beeps is 99.9 % accurate. | Useless on rare classes. Better: balanced accuracy = (recall + specificity) / 2, MCC, or precision + recall. | 2 % fraud: flagging nothing gives 0.98 and catches nothing. |
| G-f1 | F1 score | 2PR / (P + R) = 2TP / (2TP + FP + FN) | One number that is high only when precision **and** recall are. | **The weakest-link score:** the harmonic mean drags towards the smaller one. P = 1.0, R = 0.1 → F1 = 0.18, not 0.55. | Ignores TN, and weighs FP and FN the same; when they cost differently, use costs or F-beta. | P 0.80, R 0.60 → F1 0.69. |
| G-fbeta | F-beta | (1 + β²) TP / ((1 + β²) TP + β² FN + FP) | F1 with a dial: β says how many times more you care about recall. | **β is the "recall weight":** F2 — recall counts double (screening); F0.5 — precision counts double (spam). | β is a choice, not a law; say which one you used. | Fever gate: F2 fits better than F1. |
| G-mcc | MCC (Matthews correlation) | (TP·TN − FP·FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN)) | A correlation between the decisions and the truth: −1 … 0 (coin) … +1. | **The fair judge:** uses all four cells, so it cannot be fooled by a rare class. | Undefined when a whole row or column is empty. Harder to explain to a client. | C06: flagging nothing → MCC undefined/0, while accuracy says 0.98. |
| G-roc | ROC curve and AUC | TPR against FPR over all thresholds; AUC = area under it | How well the model **ranks**, at every threshold at once. | **AUC = a duel:** pick a random positive and a random negative — AUC is the chance the positive scores higher. 0.5 = a coin, 1.0 = perfect. | Ignores the base rate and the costs, and looks rosy on rare classes (lots of TN hide FPs). The threshold is a point on the curve, not the curve. | `d'` 2.0 → AUC 0.92. |
| G-pr | PR curve and average precision | precision against recall over all thresholds; AP = Σ (Rₙ − Rₙ₋₁) Pₙ | The ROC's honest sibling for rare positives. | **Its floor is the base rate:** with 1 % fraud a random model has precision 0.01, not 0.5. | Do not interpolate it linearly; AP is the area the standard way. Comparable only at the same base rate. | Card Watch: AP 0.45 at 3 % fraud is good; ROC AUC 0.93 says less. |
| G-prevalence | Prevalence (base rate) | real positives / all | How common the positive class is. | **Precision lives in the predicted row** and feels the base rate; **recall and FPR live in the true columns** and do not. | The base-rate fallacy: a 99 %-accurate test for a 1-in-1 000 disease is wrong most of the time it says "sick". | Flu season: 4 % → 20 %, same threshold, precision 0.17 → 0.56. |
| G-calibration | Calibration | a calibrated 0.7 means 7 in 10 such items are positive | Whether scores are real probabilities. | **A weather forecast:** of all the days it said "70 % rain", it should rain on 70 %. | Calibration changes no ranking and no AUC, only what a number means. It goes stale when the base rate changes. Platt scaling and isotonic regression are the usual fixes. | Fever Gate's timid model says 0.30 where the truth is 0.60. |
| G-cost | Cost-sensitive threshold | flag if p ≥ (V_TN − V_FP) / ((V_TP − V_FN) + (V_TN − V_FP)) | The best threshold comes from the prices of mistakes. | **Expensive misses → low bar; expensive false alarms → high bar.** With FP = $10, FN = $1, TP = +$2: p* = 0.77. | Needs calibrated scores. With amounts, the best bar differs per item. | Card Watch: p* ≈ 0.09 for a $60 payment, 0.02 for $1 000. |
| G-errors | Type I and Type II errors | Type I = FP, Type II = FN | The statisticians' names for the two mistakes. | **The boy who cried wolf:** the villagers make both — first they believe a false alarm (Type I), then ignore a real one (Type II). | α (the Type I rate) is the FPR; power = 1 − β is the recall. | |
| G-review | Review band (abstain, triage) | model decides outside [t_review, t); people decide inside | Let the model act only where it is sure. | **Traffic light:** green — pass, red — block, amber — ask a human. | People cost money and time; a full queue falls back on the model. | Comment Patrol: the band 0.35–0.65 takes 18 % of comments. |
| G-drift | Data drift | PSI = Σ (a − e) ln(a / e) over score bins | The data the model sees no longer looks like the data it learned from. | **The map is not the territory any more:** the live dot leaves the curve. PSI < 0.1 calm, > 0.2 act. | Score drift can be a base rate change or a real concept change; look before you retrain. | Spam wave: PSI 0.31 two minutes after the new tactic. |
| G-topk | Precision@k and recall@k | P@k = relevant in top-k / k; R@k = relevant in top-k / all relevant | Ranking metrics for search and RAG retrieval. | **k is a threshold per query.** Bigger k: recall ↑, precision ↓. | Recall@k needs to know all relevant documents — the hard part of evaluating search. | 5 relevant, top-10 holds 4: P@10 = 0.4, R@10 = 0.8. |
| G-which | Which metric? | — | A decision helper. | A small flow: "False alarms expensive? → precision (or F0.5). Misses expensive? → recall (or F2). Both, equally? → F1. Rare positives? → PR AUC, not accuracy. Ranking quality, no threshold yet? → ROC AUC. Search / RAG? → precision@k, recall@k. Real prices known? → profit and the cost-optimal threshold." | | |

### Local terms

| Card | Russian | Swedish |
|---|---|---|
| G-matrix | матрица ошибок | förväxlingsmatris |
| G-precision | точность (precision) | precision |
| G-recall | полнота (recall), чувствительность | täckning (recall), sensitivitet |
| G-specificity | специфичность | specificitet |
| G-fpr | доля ложных срабатываний | andel falsklarm |
| G-accuracy | доля верных ответов (accuracy) | träffsäkerhet (accuracy) |
| G-f1 | F1-мера | F1-mått |
| G-roc | ROC-кривая, AUC | ROC-kurva, AUC |
| G-pr | PR-кривая | PR-kurva |
| G-prevalence | доля положительного класса | prevalens, basfrekvens |
| G-calibration | калибровка | kalibrering |
| G-errors | ошибки I и II рода | typ I- och typ II-fel |
| G-drift | дрейф данных | datadrift |

Russian has a trap worth a line on the RU G-accuracy card: both *precision* and *accuracy* are often translated as «точность»; the game uses «точность» only for precision and «доля верных ответов» for accuracy, and always shows the English term next to it. Swedish terms are checked during the translation in I07.

## 5. Briefing questions

One per contract (01 §3.1). The right answer is marked ✓; the explanation is shown after any answer.

| Contract | Question | Options | Explanation |
|---|---|---|---|
| C01 | An ordinary letter lands in the spam folder. What is it? | False positive ✓ · False negative · True negative | The model said "positive" (spam), and that was false. |
| C02 | The client hates losing real letters. Which metric guards against that? | Precision ✓ · Recall · Accuracy | Precision falls with every real letter you flag as spam. |
| C03 | A missed sick passenger costs 30 times a needless check. Where should the threshold go? | Low ✓ · High · Exactly 0.5 | Cheap false alarms, expensive misses: flag on small suspicion. |
| C04 | Precision is 1.0 and recall 0.2. What is F1 about? | 0.33 ✓ · 0.6 · 1.0 | The harmonic mean sticks to the weaker number. |
| C05 | Which payment deserves a lower threshold? | A $2 000 payment ✓ · A $5 payment · Neither | Letting a big fraud through costs more, so smaller suspicion is enough. |
| C06 | 2 % of payments are fraud. What accuracy does "flag nothing" get? | About 98 % ✓ · About 50 % · 0 % | Every genuine payment counts as right; every fraud gets through. |
| C07 | The flu season doubles the sick passengers. At the same threshold, what happens to precision? | It goes up ✓ · It goes down · It stays the same | More of the flagged passengers are really sick; recall does not move. |
| C08 | Where is the model least sure? | Scores near the middle ✓ · Scores near 0 · Scores near 1 | The two classes overlap most in the middle: send those to people. |
| C09 | The live dot drifts away from the ROC curve. What does it mean? | The data changed ✓ · The threshold is wrong · Nothing | The curve was measured on old data; the stream no longer matches it. |
| C10 | Fraudsters learned your threshold. What helps most? | Check the zone just below it ✓ · Keep it fixed · Raise it to 0.99 | Crafted payments sit just under the line; a review band there catches them. |
| C11 | You raise k from 5 to 20. What happens? | Recall up, precision down ✓ · Both up · Both down | More documents shown: more of the relevant ones, and more noise. |
| C12 | Which metric is best? | It depends on the costs ✓ · F1 · Accuracy | Every client prices mistakes differently. |
