# 01 — Gameplay

How the game plays. The math behind every number is in [02-model-and-metrics.md](02-model-and-metrics.md), the content tables (contracts, upgrades, cards) in [03-content.md](03-content.md), the look and layout in [04-ui-design.md](04-ui-design.md).

## 1. The core: belt, threshold, gate, pile

### 1.1 The belt

- Items enter at the left edge of the belt and ride to the right at a steady speed (`BELT_TRAVEL_S`, the time from entry to the gate: 6 s on Medium).
- The **vertical position of an item is its model score**: 0 at the bottom, 1 at the top. A score axis with ticks 0, 0.25, 0.5, 0.75, 1 runs along the left edge. Items keep their height for the whole ride; a small random horizontal spacing keeps them from overlapping.
- Each item carries a **score badge** (`0.73`, two decimals). The axis is titled "model score" and the handle reads `t = 0.62` until the calibration upgrade (§5); afterwards the axis says "calibrated p", the heights and the badges are calibrated probabilities (02 §2.3) and the handle reads `p ≥ 0.62`. (A word on every badge was too much clutter for a belt of 30 items, so the axis and the handle carry it.)
- **The true class is hidden while the item rides** (a neutral grey drawing: a closed envelope, a passenger in a coat, a bolt in a box), except on Easy, where a faint tint gives it away (§10).
- Items arrive as a Poisson stream with the contract's rate (items per second × the difficulty factor); a contract has a fixed number of items (`items` in the contract table) and ends when the last one has passed the gate.

### 1.2 The threshold

- One horizontal line across the belt and the pile, in the accent colour, with a large handle at the right edge showing its value (`t = 0.62`). Above the line the belt is tinted "flagged" (a faint warm stripe), below it "passed".
- The player moves it at any time (controls in §11). Its range is 0.00–1.00 in steps of 0.01; `t = 0` flags everything, `t = 1` (strictly `score ≥ 1`, which never happens) flags nothing.
- **The decision is made at the gate**, with the threshold at the moment the item crosses it: `flagged = score ≥ t`. So moving the line re-decides every item still on the belt, and the player sees in advance which items are going to be flagged: they sit above the line.

### 1.3 The gate and the reveal

- At the gate an item is decided and **revealed**: its drawing flips to the true class (the envelope opens to show spam with a skull seal or an ordinary letter; the passenger's thermometer shows a fever or not; the bolt shows a crack or not).
- The outcome is one of four: **TP** (flagged, really positive), **FP** (flagged, really negative), **FN** (passed, really positive), **TN** (passed, really negative). A short tag pops over the gate (`TP ✓`, `FP ✗`…), the money effect floats up (`+$2`, `−$10`), and the outcome's sound plays (04 §7).
- The **positive class** is always "the thing we are hunting" (spam, fever, defect, fraud, toxic comment, relevant document), never "the good thing". The cheat sheet says so explicitly, because it is the most common confusion.

### 1.4 The pile

- Right after the gate the item flies onto **the pile**: a sideways histogram on the same vertical score axis as the belt, with bins 0.05 wide (20 rows). Each item becomes a small square in its score row; **positives stack to the left of the pile's axis line, negatives to the right** (a "mirrored" histogram, in the order of the matrix's columns), so the two class distributions are visible as two humps. As rows fill up the squares shrink and stack in several lines per row, outwards from the axis; within a row the higher scores sit higher.
- The threshold line continues across the pile and splits it into four regions that **are** the confusion matrix, laid out like its cells: TP top left, FP top right, FN bottom left, TN bottom right (each region is labelled next to the line). Moving the line re-colours the regions at once, so the player sees what the same past items *would* have been at another threshold.
- The pile holds the last `PILE_WINDOW` items (200); older squares fade out. This is the **rolling window** that the live metrics are computed on (02 §3.4); the contract's final result uses all items with the decision actually made at their gate.

### 1.5 The live panel

Under or next to the belt (layout in 04 §4):

- **Confusion matrix**: a 2×2 grid of counts. Rows = what the model said (Flagged / Passed), columns = what was true (Positive / Negative), matching the pile's layout (flagged above). Each cell pulses when an item lands in it. Two numbers per cell: the rolling window count, and in small print the contract total.
- **Metric bars**: Precision, Recall, F1, Accuracy, FPR (plus the contract's own metric if it is another one, e.g. F2) as horizontal bars 0–1 with the value, a tick for the contract's target and colour when the target is broken. Values are on the rolling window. A metric with an empty denominator shows "—" (02 §3.2).
- **Charts** (tabs on small screens): ROC curve, PR curve, and (Easy, Sandbox, results) the profit curve. Each shows the model's curve (from the validation set, 02 §4), the **operating point** at the current threshold as a filled dot that slides along the curve as the line moves, and the live rolling-window point as a hollow ring that jitters around it (sampling noise, made visible).
- **Explain on hover/tap**: pointing at a metric bar highlights the matrix cells and the pile regions it is made of (numerator bright, denominator outlined) and shows a tooltip with the formula filled with the live numbers: `Precision = TP / (TP + FP) = 42 / (42 + 7) = 0.86`. A second tap or click opens its cheat sheet card (03 §4) as an overlay; during a contract this pauses the game.

## 2. Campaign

- **Cutoff & Co.** takes contracts from six fictional clients (03 §1). There are **12 contracts in 3 acts** (03 §2): Act 1 "First clients" (C01–C05: the matrix, precision, recall, F1, costs), Act 2 "The real world" (C06–C09: accuracy paradox, base rate shift, review desk, drift), Act 3 "Scale-up" (C10–C12: adversary, top-k retrieval, the finale).
- **The campaign map**: a screen with the three acts as rows of contract cards. A card shows the client, the contract's name, the idea it teaches (after it has been played), its best stars per difficulty and a lock. Contract N+1 opens when contract N is completed with at least 1 star. Act 2 opens after C05, Act 3 after C09. Completed contracts can be replayed at any time (for more stars and money).
- **Money** is the campaign's currency; it is spent in the Lab (§5). The balance is shown on the map and in the HUD. A contract's own money can go negative (fines); the campaign balance never falls below $0 (`balance = max(0, balance + contract result)`), so the player can never get stuck.
- The campaign is saved after every contract (05 §5). **New campaign** asks for confirmation and erases the save (only the campaign key, never the settings).

## 3. A contract

### 3.1 Briefing

Before every contract a briefing panel shows:

- The client (a procedural avatar, 04 §5) and their message in plain words, e.g. *"Our customers are furious when an invoice lands in spam. A bit of spam in the inbox they can live with."*
- **Terms**: the price list per outcome (TP / FP / FN / TN, e.g. `+$2 / −$10 / −$1 / $0`), the number of items, the speed, the **goal** (a target on a metric, e.g. "Precision ≥ 0.95", checked on the whole contract), and special rules (outbreak meter, review desk, top-k).
- **Model card**: the scenario's model quality (AUC, e.g. `AUC 0.89`, with the Lab's bonus), whether scores are calibrated, the base rate ("about 1 in 4 letters is spam").
- **Quick question** (optional, one multiple-choice question about the contract, 03 §5): "Which metric does this client really care about?" A right answer gives a small bonus (`QUIZ_BONUS`, $50) and a one-line explanation is shown either way. It can be skipped.
- Buttons: **Start** (default), Back to the map.

### 3.2 During the contract

- The HUD (04 §4) shows the contract, items left, money for this contract, the goal chip (green while the cumulative value meets the target, amber while it is within 0.05, red below; hidden for the first `GOAL_GRACE_ITEMS` = 30 items, when the numbers are too noisy to mean anything), special meters, pause and sound.
- **Incidents** (§6) may happen at set points of the contract, announced by a banner (on Easy and Medium 10 s ahead with a countdown; on Hard when they start).
- With the review desk (§5) the player can also send single items to human review by tapping them on the belt.

### 3.3 The end

A contract ends when its last item has passed the gate, or early when it **fails**:

- **Outbreak** (contracts with an outbreak meter, e.g. C03): every FN adds 1 to the meter; when it reaches the contract's allowance the outbreak starts and the contract fails.
- **Bankrupt**: the contract's money falls below `−BANKRUPT_LIMIT` (the contract's fee; listed in the terms).

### 3.4 Results

The results screen shows:

- **Stars** (§4), money earned and the new balance, "Goal met / not met" with the value, a "New best!" badge per difficulty.
- **Final metrics** over the whole contract: the confusion matrix and the metric table, with the decisions actually made.
- **Your threshold over time** (a sparkline of `t` against the item number) with a dashed line at the **hindsight-best threshold**: the single fixed threshold that would have earned the most on this very stream while meeting the goal (02 §5). Its profit is shown next to yours: *"Best fixed threshold in hindsight: 0.71 → $412. You: $386 (94 %)."* If the player beat it (possible when incidents changed the stream mid-way and the player re-tuned), a badge says *"You beat the best fixed threshold!"*
- **The profit curve** of the contract: money against threshold on the whole stream, with the player's average threshold and the best one marked.
- **What you learned**: the contract's lesson card (03 §2), one or two sentences and a link to the related cheat sheet card.
- Buttons: **Next contract** (default, if one is open), **Retry** (with the difficulty picker pre-set to the current level), **Lab**, **Map**.

## 4. Money and stars

- Money per item = the price of its outcome (TP / FP / FN / TN), or for value-weighted contracts (fraud) a function of the item's amount (03 §2). Review desk items cost the review fee instead (§5).
- **Fee**: on completion (not on failure) the client pays the contract's fee, plus `QUIZ_BONUS` for a right quiz answer (once per contract).
- **Stars**, per contract and difficulty:
  - ★ — completed (not failed) **and** the goal met;
  - ★★ — also profit ≥ the contract's `target` (03 §2);
  - ★★★ — also profit ≥ `STAR3_SHARE` (90 %) of the hindsight-best profit.
  - A contract with no metric goal (C01, C05, C08, C10) gives ★ for completing it.
- Replaying a contract pays its money again (so the Lab can always be reached), but the fee only for more stars than that level's record (the first completion on a level always pays it). A failed contract keeps its own money (usually fines) but pays no fee; quitting from the pause dialog loses the contract and its money. A run with a debug cheat pays only its own money (§14).

## 5. The Lab (upgrades)

The Lab is a screen reached from the map and the results. It shows the **model card** of each scenario family (AUC now and after the selected upgrade, with a mini ROC that animates from the old curve to the new one when the player points at an upgrade) and the list of upgrades (03 §3) with their price, effect and state (locked / can buy / bought).

Upgrades are bought with money and kept for the whole campaign. Kinds:

- **Better model** (more data I–III, features per scenario family): add to the separation `d'` of the scenario's model (02 §2.1), so the two humps of the pile move apart and the curves bulge towards the corner. This is the "move the distributions apart, shrink the overlap" idea from the start.
- **Calibration** (Platt scaling): from now on the badges show calibrated probabilities `p`, the threshold handle reads "p ≥ 0.62", and on Easy/Medium the **cost-optimal threshold** for the contract's prices (02 §5.1) is shown as a dashed ghost line on the belt. Calibration is fitted at the start of a contract on the validation set, so a base rate shift during the contract makes it **stale** (02 §2.3), which is one of Act 2's lessons.
- **Drift monitor**: a small chart in the HUD with the population stability index (PSI) of the score distribution against the validation set (02 §6.2), and an alert banner when it crosses `PSI_ALERT` (0.2). It also unlocks **Retrain** (once per contract: after `RETRAIN_S` 15 s the model gets back its original `d'` for the new data). C09 lends the monitor for free.
- **Review desk** (levels I–III): unlocks a second handle on the threshold line, the **review band** `[t_review, t)`: items with a score in the band go to human reviewers instead of being decided by the model. Reviewers are always right but cost `REVIEW_FEE` per item and have a capacity (items per second, by level); an item that reaches the gate while the desk is full is decided by the model's threshold as usual, and a "Desk full" chip flashes. The player can also tap a single item on the belt to send it to review (it goes into the queue first). C08 lends the desk for free.

## 6. Incidents

Incidents change the stream during a contract. Each contract lists its incidents in 03 §2 (when, what); the math is in 02 §6.

| Incident | What happens | What it teaches |
|---|---|---|
| **Base rate shift** ("Flu season!") | The prevalence changes, e.g. 4 % → 20 %. The model and the scores per class stay the same. | At the same threshold recall and FPR stay put, **precision jumps**; a calibrated model becomes stale. |
| **Drift** ("Spam wave!") | Positives start to look more like negatives: their score distribution slides down, `d'` falls. | The ROC curve sags; the old threshold now misses a lot; monitor and retrain. |
| **Adversary** ("Fraud ring!") | A share of positives is *crafted* to land just below the threshold the player used `ADV_LAG_S` seconds ago. | A fixed, known threshold gets gamed; the review band and moving the line break the pattern. |
| **Price change** ("New SLA from the client") | The price list changes mid-contract (e.g. FN cost × 3). | The best threshold depends on costs, not on the model. |
| **Rush hour** | The arrival rate doubles for a while. | Review capacity runs out; decisions fall back on the threshold. |

## 7. Sandbox

The sandbox is the play screen without money, goals or a fixed length. A side panel (a drawer on phones) has:

- **Scenario** picker (the drawings and names of the scenarios) — or "Abstract" (dots instead of drawings). A scenario sets the base rate and `d'` to its own (03 §1) and brings its temperament `γ`, `β`. Search Ranker joins with the Top-k mode (I06).
- **Base rate** (prevalence) 0.5 %–50 %, logarithmic slider.
- **Separation** `d'` 0–4 (with the AUC it gives shown next to it).
- **Calibrated scores** on/off: the heights, the badges and the threshold become the calibrated `p` (Platt scaling fitted on the validation set, 02 §2.3), and the cost-optimal **ghost line** `p*` for the sandbox's prices appears (02 §5.1; a raw score is not a probability, so without calibration there is no ghost line, only the profit curve's best). Switching it keeps the line at the same items: the threshold's number moves to the other axis. **Show true class on the belt** on/off.
- **Speed** 0.25× / 0.5× / 1× / 2× / 4× (scales the run's time), **Pause belt** and **Step** (ride until the next item has been decided).
- **Prices per item** for TP / FP / FN / TN (whole dollars, −20 … +20, default +1 / −1 / −1 / 0): the profit curve and the ghost line use them; the panel names the cost-optimal `p*`.
- **Review band** on/off; **Top-k mode** on/off (02 §7).
- **Generate 1 000 at once**: fills the pile instantly (the pile window grows to 1 000 for this), so the humps and the curves are smooth; **Clear**.
- **Formula view** toggle: every metric bar shows its formula with the live numbers all the time, not only on hover.

A knob that changes the model (scenario, base rate, separation) regenerates the validation set from the same seed, so the curves morph smoothly as a slider moves; items already made keep their scores (Clear starts afresh). Everything in the sandbox, the threshold included, is remembered between visits (05 §5).

## 8. Cheat sheet

Reachable from the start screen, the map, the pause dialog and by tapping/clicking a metric twice during play. Content in 03 §4, layout in 04 §3.

## 9. Attract demo

Behind the start screen (dimmed, under the menu panel) the belt and the pile run in the Abstract scenario with a bot that sweeps the threshold slowly up and down (`DEMO_SWEEP_S`, a full sweep every 20 s), with the ROC and PR dots sliding. It is pure decoration: no sound, no saving, paused while the menu panel is scrolled on a phone to save battery, off with `prefers-reduced-motion`.

## 10. Difficulty

Three levels, picked on the start screen and in the results / failure dialog (pre-selected to the current level), remembered (05 §5). Stars and bests are kept per level.

| | Easy | Medium | Hard |
|---|---|---|---|
| Speed (arrival rate and belt) | ×0.75 | ×1 | ×1.3 |
| True class on the belt | faint tint | hidden | hidden |
| Model separation `d'` | +0.2 | ±0 | −0.2 |
| Cost-optimal ghost line | always (computed on the true posterior) | with Calibration | never |
| Goal targets | −0.05 | as listed | +0.02 |
| Outbreak allowance | +2 | as listed | −1 |
| Incident warning | 10 s ahead | 10 s ahead | none |
| Review desk capacity | +1 level | as bought | −1 level (min I) |
| Profit curve during play | yes | no | no |

## 11. Controls

### 11.1 Mouse and keyboard

- **Drag the threshold**: drag the handle, or press anywhere on the belt or the pile and drag up/down (the line follows the pointer's height). **Mouse wheel** over the play area: ±0.01 per notch (±0.05 with Shift).
- **Keys**: ↑ / ↓ or W / S = ±0.01; with Shift ±0.05; Page Up / Page Down ±0.10; Home / End = 1.00 / 0.00.
- **Review band** (when unlocked): drag its handle; Q / A move it ±0.01 (Shift ±0.05). The band cannot go above the threshold.
- **Send to review**: click an item on the belt.
- **Top-k** (C11, sandbox): ↑ / ↓ change k by 1, Shift by 5.
- **Charts**: Tab switches the chart tab where charts are tabbed.
- **Pause**: Esc or P (and the pause button). **Space / Enter** press the default button of whatever overlay panel is visible (start, briefing, results, pause); during play Space does nothing (no accidental pauses). Arrow keys move the focus between the buttons of a visible panel (as in `fish-frenzy`).

### 11.2 Touch

The split-screen joystick of the `ivan` games does not fit a game with one vertical control, so the touch scheme is:

- **One finger on the belt or the pile drags the threshold relatively**: the line moves by the finger's vertical movement from where it touched down (no jump to the finger), so the thumb does not cover the items it is judging. Dragging the handle itself is absolute.
- A **large handle** (at least 44 × 44 CSS px) at the right edge; when the review desk is unlocked a second handle sits on the left edge of the pile for the review band, so the two never overlap.
- **Tap an item** = send it to review (with the review desk); a tap is a touch that moved less than 8 px.
- On phones the Start button requests fullscreen (`requestFullscreen` with `{ navigationUI: 'hide' }` and the webkit fallback, in try/catch; iPhone Safari stays windowed and still works). Page scroll and zoom are blocked on the play area (`touch-action: none`).
- The pause button is in the HUD, top right. Leaving the tab or switching apps pauses the game; on phones the first tap after returning restores fullscreen.

## 12. Pause

The pause dialog: **Continue** (default; Esc / P also resume), **Restart contract**, **Cheat sheet**, **Sound** On / Off, **Quit to map** (the contract is lost, no money). While paused the belt, the stream and incident timers stop. In the sandbox the two read **Clear and restart** (empties belt and pile) and **Quit to menu**.

## 13. Tutorial

C01 is guided by **coach marks**: a small bubble with an arrow pointing at the thing it explains, and the stream paused until the player does what it asks.

1. "This is a letter. Its height is the model's score: how spammy the model thinks it is." (points at the first item; continue on tap)
2. "This line is your threshold. Everything above it goes to the spam folder. Drag it." (waits for a drag)
3. At the first FP: "Oops: an ordinary letter landed in spam. That is a **false positive**: the model said *positive* (spam), and it was *false*." (points at the FP cell)
4. At the first FN: "And this spam slipped into the inbox: a **false negative**."
5. After 40 items: "Precision: of everything you flagged, how much was really spam. Recall: of all the spam, how much you caught. Move the line and watch them pull against each other." (points at the bars)
6. "Both live in the pile: tap a bar to see which part of it." (end)

Every later contract that introduces a new element (the goal chip C02, outbreak meter C03, F1 C04, amounts C05, review band C08, drift monitor C09, top-k C11) has one or two coach marks the first time. Coach marks seen are remembered (05 §5); the pause dialog has no "replay tutorial", but replaying C01 always shows them.

## 14. Debug cheats

Keyboard only, during play or on the map, never mentioned in the in-game help, each showing a short banner of what it did:

- `1`–`9`, `0`, `-`, `=` on the map: open contract C01–C12 directly (unlock it).
- `M`: +$1 000. `U`: buy every upgrade. `R` (during play): toggle showing the true class on the belt. `F` (during play): finish the contract now with the current results (the hindsight-best is then computed on the items decided so far). `I` (during play): start the contract's next incident now. Until the Lab (I05) and incidents exist, `U` and `I` only say so.

Once any cheat is used in a contract run, that run is marked as cheated: it never updates stars or bests and pays only its own money, no fee and no quiz bonus (the cheats are for testing). `M` and `U` mark the whole campaign save as `cheated: true`, shown as a small "test save" tag on the map.

## 15. Saving, records, sound

- The campaign (money, upgrades, stars and bests per contract and level, coach marks seen, quiz answers) is saved after every contract and every purchase; the settings (language, sound, difficulty, sandbox knobs) when they change. Keys and shapes: 05 §5.
- **Sound** On / Off on the start screen and in the pause dialog, on by default, applied at once through one master gain (04 §7).
- **Updates**: a page left open picks up a new deploy only on the start screen or the map, never during a contract, a pause or a dialog (`core/update.js`, 05 §6).
