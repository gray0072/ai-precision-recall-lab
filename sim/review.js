'use strict';

// ============================================================
// AI Precision Recall Lab — the review desk (spec 01 §5, 02 §5.2): a band [low, t) under the threshold whose
// items go to people instead of being decided by the model. People are always right (a positive becomes a TP,
// a negative a TN) and cost REVIEW_FEE each instead of the outcome's price (a contract's moneyOf); they have a
// capacity: the desk holds REVIEW_QUEUE items at once and finishes one every 1 / rate seconds (REVIEW_RATE by
// level). An item of the band that reaches the gate while the desk is full is decided by the model's threshold
// as usual ("Desk full", the deskFull event). A single item tapped on the belt is sent to the desk at once (it
// takes a place in the queue then) and is decided by people at the gate. The desk's clock is the run's: it is
// drained to the exact gate time of each item (the arrival time + the ride), so the live run and the headless
// search over band pairs of the hindsight-best (sim/contract.js) see the same queue.
// The live desk is State.review: { level, rate, max, busy (items in the desk), progress (0–1 of the current
// one), last (clock it was drained to), low (the band's lower edge), on (the band is in use), reviewed, full,
// sent }. No drawing, no DOM, no sound. Used by sim/contract.js, sim/sandbox.js, game.js, the renderer, the tests.
// ============================================================

const Review = (() => {
  // The desk level a contract gets: what was bought or lent (the better one), moved by the difficulty
  // (Easy +1 level, Hard −1, 01 §10) within I–III; 0 = no desk.
  function levelFor(owned, lent, shift = 0) {
    const base = Math.max(owned || 0, lent || 0);
    return base ? clamp(base + shift, 1, REVIEW_RATE.length) : 0;
  }

  // a desk of a level (1–3); a run's or a headless search's own
  function make(level, low) {
    return {
      level, rate: REVIEW_RATE[level - 1], max: REVIEW_QUEUE, busy: 0, progress: 0, last: 0,
      low: low === undefined ? 0 : low, on: true, reviewed: 0, full: 0, sent: 0
    };
  }

  // the desk works until `clock`: every 1 / rate seconds one item is done (an idle desk saves no time up)
  function drainTo(desk, clock) {
    const dt = Math.max(0, clock - desk.last);
    desk.last = Math.max(desk.last, clock);
    if (!desk.busy) { desk.progress = 0; return; }
    desk.progress += dt * desk.rate;
    while (desk.progress >= 1 && desk.busy > 0) { desk.busy--; desk.progress -= 1; }
    if (!desk.busy) desk.progress = 0;
  }

  // the desk takes an item at `clock` if it has room; false = full
  function admit(desk, clock) {
    drainTo(desk, clock);
    if (desk.busy >= desk.max) return false;
    desk.busy++;
    return true;
  }

  // in the band [low, t) on the 0.01 grid: at or above its lower edge and below the threshold
  function inBand(v, low, t) { return atOrAbove(v, low) && !atOrAbove(v, t); }
  // the band's lower edge as it applies: it can never be above the threshold
  function lowOf(desk, t) { return Math.min(desk.low, t); }

  // people decide right: a positive is caught, a negative is let through
  function right(item) { return { flagged: !!item.y, outcome: item.y ? 'TP' : 'TN', reviewed: true }; }

  // The decision at the gate with a desk, at the exact gate time `clock`. Returns { flagged, outcome,
  // reviewed, full } (full: the item was in the band, but the desk had no room).
  function decide(desk, item, t, key, clock) {
    if (item.sent) { drainTo(desk, clock); desk.reviewed++; return right(item); }
    if (desk.on && inBand(item[key], lowOf(desk, t), t)) {
      if (admit(desk, clock)) { desk.reviewed++; return right(item); }
      desk.full++;
      return Object.assign(Stream.decide(item, t, key), { reviewed: false, full: true });
    }
    return Object.assign(Stream.decide(item, t, key), { reviewed: false, full: false });
  }

  // ---------- the live desk (State.review) ----------

  // a run gets its desk: State.review, and the gate's decideAt that uses it (the gate time is the arrival
  // time + the ride: exact, whatever the frame rate)
  function attach(run, level, low) {
    State.review = make(level, low);
    run.decideAt = (item) => {
      const d = decide(State.review, item, State.threshold, run.key, item.enter + run.travelS);
      if (d.full) GameEvents.emit('deskFull', { item });
      return d;
    };
    return State.review;
  }
  function detach(run) {
    State.review = null;
    if (run) run.decideAt = null;
  }

  // a tap or a click on an item riding the belt: it goes to the desk now. Returns 'sent', 'full' (no room:
  // deskFull), 'already' (sent before) or 'none' (no desk).
  function send(item) {
    const desk = State.review, run = State.run;
    if (!desk || !run || !item) return 'none';
    if (item.sent) return 'already';
    if (!admit(desk, run.clock)) { desk.full++; GameEvents.emit('deskFull', { item }); return 'full'; }
    item.sent = true;
    desk.sent++;
    return 'sent';
  }

  // moves the band's lower edge (the second handle, Q / A): on the 0.01 grid, never above the threshold
  function setLow(v) {
    const desk = State.review;
    if (!desk) return;
    desk.low = clamp(round2(v), 0, State.threshold);
  }

  // every frame (05 §4, after Stream.update): the desk works on with the run's clock (the queue chip)
  function update() {
    if (State.review && State.run) drainTo(State.review, State.run.clock);
  }

  return { levelFor, make, drainTo, admit, inBand, lowOf, right, decide, attach, detach, send, setLow, update };
})();
