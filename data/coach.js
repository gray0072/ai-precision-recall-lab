'use strict';

// ============================================================
// AI Precision Recall Lab — the coach marks (spec 01 §13): small bubbles with an arrow that explain the thing
// they point at, with the stream paused until the player does what they ask. C01 is the tutorial; later
// contracts get one or two marks the first time they bring something new (the goal chip C02, the outbreak
// meter C03, F1 C04, amounts C05). Seen marks are remembered in the campaign; C01 always shows its own.
//   when:   'start' (the contract begins), 'arrive' (the first item is on the belt), 'after:<id>' (right after
//           that mark), 'outcome:FP' (the first item decided that way), 'count:<n>' (n items decided)
//   target: { item: 'first' } (the oldest item on the belt), { handle: true } (the threshold's handle),
//           { cell: 'FP' } (a matrix cell), { bar: 'f1' } (a metric bar), { el: '#id' } (any element)
//   until:  'tap' (the bubble's button, Space or Enter), 'drag' (the threshold moves)
//   params: names of live values filled into the text ({allowance}, {target})
// Plain data, no logic; the texts are the English source and go through tr() where they are shown.
// Used by ui/coach.js.
// ============================================================

const COACH = [
  // ---------- C01: the tutorial ----------
  { id: 'c01-item', contract: 'C01', when: 'arrive', target: { item: 'first' }, until: 'tap',
    text: 'This is a letter. Its height is the model\'s score: how spammy the model thinks it is.' },
  { id: 'c01-line', contract: 'C01', when: 'after:c01-item', target: { handle: true }, until: 'drag',
    text: 'This line is your threshold. Everything above it goes to the spam folder. Drag it.' },
  { id: 'c01-fp', contract: 'C01', when: 'outcome:FP', target: { cell: 'FP' }, until: 'tap',
    text: 'Oops: an ordinary letter landed in spam. That is a **false positive**: the model said *positive* (spam), and it was *false*.' },
  { id: 'c01-fn', contract: 'C01', when: 'outcome:FN', target: { cell: 'FN' }, until: 'tap',
    text: 'And this spam slipped into the inbox: a **false negative**.' },
  { id: 'c01-bars', contract: 'C01', when: 'count:40', target: { bar: 'precision' }, until: 'tap',
    text: 'Precision: of everything you flagged, how much was really spam. Recall: of all the spam, how much you caught. Move the line and watch them pull against each other.' },
  { id: 'c01-pile', contract: 'C01', when: 'after:c01-bars', target: { bar: 'recall' }, until: 'tap',
    text: 'Both live in the pile: tap a bar to see which part of it. Tap it again for its cheat sheet card.' },

  // ---------- first-time marks of the rest of Act 1 ----------
  { id: 'c02-goal', contract: 'C02', when: 'start', target: { el: '#hudGoal' }, until: 'tap',
    text: 'The client\'s goal, checked over the whole contract. After the first 30 items the chip turns green when you meet it, amber when you are close and red when you are below.' },
  { id: 'c03-outbreak', contract: 'C03', when: 'start', target: { el: '#hudMeter' }, until: 'tap', params: ['allowance'],
    text: 'The outbreak meter: every feverish passenger you let through (a false negative) adds one. At {allowance} the outbreak starts and the contract fails.' },
  { id: 'c03-recall', contract: 'C03', when: 'after:c03-outbreak', target: { bar: 'recall' }, until: 'tap', params: ['target'],
    text: 'This client wants Recall ≥ {target}: of all the feverish passengers, the share you stopped. The tick on the bar marks the target.' },
  { id: 'c04-f1', contract: 'C04', when: 'start', target: { bar: 'f1' }, until: 'tap',
    text: 'F1 is the harmonic mean of precision and recall: it is high only when both are. Push one up at the cost of the other and F1 sinks.' },
  { id: 'c05-amounts', contract: 'C05', when: 'arrive', target: { item: 'first' }, until: 'tap',
    text: 'Each payment shows its amount. A missed fraud costs the whole amount, so a big payment deserves a lower bar than a small one — but you have only one line.' }
];
