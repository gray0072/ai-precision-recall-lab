'use strict';

// ============================================================
// AI Precision Recall Lab — the coach marks (spec 01 §13): a bubble with an arrow pointing at what it
// explains (an item on the belt, the threshold's handle, a matrix cell, a metric bar, a HUD chip). While one is
// shown the stream holds (State.held: the belt stops, the line can still be moved) until the player does what
// it asks: presses Got it (or Space / Enter), or drags the threshold. Marks come from data/coach.js in order,
// each when its trigger fires; seen ones are remembered in the campaign, and C01 always shows its own.
// Reads State and the run; game.js starts it with a contract and calls update() every frame.
// ============================================================

const Coach = (() => {
  const $ = (id) => document.getElementById(id);
  const bubble = $('coach'), textEl = bubble.querySelector('.coachText'), arrow = bubble.querySelector('.coachArrow');
  const DRAG_MIN = 0.03;     // the threshold must move at least this much to count as "dragged"
  let pending = [];          // the marks still to show, in order
  let done = new Set();
  let current = null;        // { mark, t0 }

  function start(run) {
    stop();
    if (!run || run.kind !== 'contract') return;
    const id = run.def.id;
    pending = COACH.filter((m) => m.contract === id && (id === 'C01' || !Campaign.coachSeen(m.id)));
  }

  function stop() {
    pending = [];
    done = new Set();
    current = null;
    State.held = false;
    bubble.hidden = true;
  }

  function fires(m, run) {
    const w = m.when;
    if (w === 'start') return true;
    if (w === 'arrive') return State.belt.length > 0 && Stream.progress(State.belt[0]) > 0.18;
    if (w.startsWith('after:')) return done.has(w.slice(6));
    if (w.startsWith('outcome:')) return run.totals[w.slice(8)] > 0;
    if (w.startsWith('count:')) return run.count >= +w.slice(6);
    return false;
  }

  function fill(m, run) {
    const params = {};
    if (m.params) {
      if (m.params.includes('allowance')) params.allowance = run.allowance;
      if (m.params.includes('target')) params.target = run.goalTarget !== null ? run.goalTarget.toFixed(2) : '';
    }
    return Glossary.marked(tr(m.text, params));
  }

  // the page rectangle (or point) the bubble points at; null when it is not on screen
  function targetRect(m) {
    const t = m.target;
    if (t.item) {
      if (!State.belt.length) return null;
      const p = Render.itemPoint(State.belt[0]);
      return { left: p.x - 14, right: p.x + 14, top: p.y - 14, bottom: p.y + 14 };
    }
    if (t.handle) {
      const p = Render.handlePoint();
      return { left: p.x - 24, right: p.x + 24, top: p.y - 18, bottom: p.y + 18 };
    }
    const el = t.cell ? document.querySelector('#matrix [data-cell="' + t.cell + '"]')
      : t.bar ? document.querySelector('#barsBox .bar[data-metric="' + t.bar + '"]')
        : document.querySelector(t.el);
    if (!el || el.offsetParent === null) return null;
    return el.getBoundingClientRect();
  }

  function place() {
    const r = targetRect(current.mark);
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight, W = window.innerWidth, H = window.innerHeight;
    if (!r) {   // the target is hidden (another chart tab, a scrolled panel): the bubble waits in the middle
      bubble.style.left = Math.round((W - bw) / 2) + 'px';
      bubble.style.top = Math.round((H - bh) / 2) + 'px';
      arrow.hidden = true;
      return;
    }
    arrow.hidden = false;
    const cx = (r.left + r.right) / 2;
    const below = r.top - bh - 14 < 8;   // no room above: under the target
    let y = below ? r.bottom + 14 : r.top - bh - 14;
    y = clamp(y, 8, Math.max(8, H - bh - 8));
    const x = clamp(cx - bw / 2, 8, Math.max(8, W - bw - 8));
    bubble.style.left = Math.round(x) + 'px';
    bubble.style.top = Math.round(y) + 'px';
    bubble.classList.toggle('below', below);
    arrow.style.left = Math.round(clamp(cx - x, 16, bw - 16)) + 'px';
  }

  function show(m, run) {
    current = { mark: m, t0: State.threshold };
    pending = pending.filter((x) => x !== m);
    State.held = true;
    textEl.innerHTML = fill(m, run);
    $('coachBtn').hidden = m.until !== 'tap';
    bubble.hidden = false;
    place();
  }

  function finish() {
    if (!current) return;
    done.add(current.mark.id);
    Campaign.markCoach(current.mark.id);
    current = null;
    State.held = false;
    bubble.hidden = true;
  }

  // every frame of a contract (not while paused): the waiting mark, or the next one whose trigger fired
  function update() {
    const run = State.run;
    if (!run || run.kind !== 'contract' || run.ended) { if (current) finish(); return; }
    if (current) {
      if (current.mark.until === 'drag' && Math.abs(State.threshold - current.t0) >= DRAG_MIN - 1e-9) finish();
      else place();
      return;
    }
    const m = pending.find((x) => fires(x, run));
    if (m) show(m, run);
  }

  $('coachBtn').addEventListener('click', (e) => { e.currentTarget.blur(); finish(); });
  // Space / Enter press Got it while no overlay panel is open
  window.addEventListener('keydown', (e) => {
    if (!current || current.mark.until !== 'tap' || Screens.visiblePanel()) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) finish(); }
  });

  return { start, stop, update, get active() { return !!current; } };
})();
