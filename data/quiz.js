'use strict';

// ============================================================
// AI Precision Recall Lab — the briefing's quick question (spec 03 §5, 01 §3.1): one multiple-choice question
// per contract. `options` are in the order they are shown, `answer` is the index of the right one, and the
// explanation is shown after any answer. A right answer pays QUIZ_BONUS once per contract.
// Plain data, no logic; the texts are the English source and go through tr() where they are shown.
// Used by ui/briefing.js and campaign.js.
// ============================================================

const QUIZ = {
  C01: { question: 'An ordinary letter lands in the spam folder. What is it?',
    options: ['False negative', 'False positive', 'True negative'], answer: 1,
    explain: 'The model said "positive" (spam), and that was false.' },
  C02: { question: 'The client hates losing real letters. Which metric guards against that?',
    options: ['Recall', 'Accuracy', 'Precision'], answer: 2,
    explain: 'Precision falls with every real letter you flag as spam.' },
  C03: { question: 'A missed sick passenger costs 30 times a needless check. Where should the threshold go?',
    options: ['Low', 'High', 'Exactly 0.5'], answer: 0,
    explain: 'Cheap false alarms, expensive misses: flag on small suspicion.' },
  C04: { question: 'Precision is 1.0 and recall 0.2. What is F1 about?',
    options: ['0.6', '0.33', '1.0'], answer: 1,
    explain: 'The harmonic mean sticks to the weaker number.' },
  C05: { question: 'Which payment deserves a lower threshold?',
    options: ['A $5 payment', 'Neither', 'A $2 000 payment'], answer: 2,
    explain: 'Letting a big fraud through costs more, so smaller suspicion is enough.' },
  C06: { question: '2 % of payments are fraud. What accuracy does "flag nothing" get?',
    options: ['About 50 %', 'About 98 %', '0 %'], answer: 1,
    explain: 'Every genuine payment counts as right; every fraud gets through.' },
  C07: { question: 'The flu season doubles the sick passengers. At the same threshold, what happens to precision?',
    options: ['It goes up', 'It goes down', 'It stays the same'], answer: 0,
    explain: 'More of the flagged passengers are really sick; recall does not move.' },
  C08: { question: 'Where is the model least sure?',
    options: ['Scores near 0', 'Scores near the middle', 'Scores near 1'], answer: 1,
    explain: 'The two classes overlap most in the middle: send those to people.' },
  C09: { question: 'The live dot drifts away from the ROC curve. What does it mean?',
    options: ['The threshold is wrong', 'Nothing', 'The data changed'], answer: 2,
    explain: 'The curve was measured on old data; the stream no longer matches it.' },
  C10: { question: 'Fraudsters learned your threshold. What helps most?',
    options: ['Check the zone just below it', 'Keep it fixed', 'Raise it to 0.99'], answer: 0,
    explain: 'Crafted payments sit just under the line; a review band there catches them.' },
  C11: { question: 'You raise k from 5 to 20. What happens?',
    options: ['Both up', 'Recall up, precision down', 'Both down'], answer: 1,
    explain: 'More documents shown: more of the relevant ones, and more noise.' },
  C12: { question: 'Which metric is best?',
    options: ['F1', 'Accuracy', 'It depends on the costs'], answer: 2,
    explain: 'Every client prices mistakes differently.' }
};
