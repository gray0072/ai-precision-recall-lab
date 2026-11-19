'use strict';

// ============================================================
// AI Precision Recall Lab — the play canvas (spec 04 §4): its size (devicePixelRatio-aware, capped by
// canvasScale), the geometry of its parts (score axis, belt, gate, pile, the threshold handle at the right
// edge, the review band's handle at the left edge while there is a desk), the mapping between a score and a
// height, hit-testing for drags and for taps on items, the animation clock of the reveals
// and the frame: render/belt.js and render/pile.js draw the parts. In a top-k run (02 §7) the documents of a
// query ride as one column (spread over a few lanes by rank) and the handle sets k: its height is k's line
// value (Topk.valueOfK), so dragging up shows fewer documents. The screen layouts (desktop, phone
// landscape, phone portrait, 04 §4.2) are chosen here and applied as a class on #play; styles.css does the rest.
// Reads State; never changes it. Used by game.js (resize, frame), core/input.js through game.js (hit-testing)
// and ui/coach.js (where an item or a handle is on the page).
// ============================================================

const Render = (() => {
  const canvas = document.getElementById('beltCanvas');
  const ctx = canvas.getContext('2d');
  const slider = document.getElementById('tSlider');
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // the geometry, in CSS pixels; filled by resize()
  const G = {
    W: 0, H: 0, scale: 1, axisX: 0, beltX0: 0, gateX: 0, gateW: 0, pileX0: 0, pileX1: 0, pileMid: 0,
    handleX: 0, handleW: 0, top: 0, bottom: 0, itemSize: 20
  };
  let time = 0;                        // the animation clock (s): runs with the frames, stops in the pause dialog
  const anims = new WeakMap();         // a decided item → the animation time of its gate
  let lastGate = null;                 // { outcome, at }: the gate's lamp flashes the last outcome

  GameEvents.on('itemDecided', (e) => {
    anims.set(e.item, time);
    lastGate = { outcome: e.outcome, at: time };
  });

  // the layout of the whole play screen (04 §4.2): 'desktop' (width ≥ 1000 px and height ≥ 500 px),
  // 'landscape' (a phone held sideways: height < 500 px, wider than tall), 'portrait' (everything else)
  function layoutName() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w >= 1000 && h >= 500) return 'desktop';
    if (h < 500 && w > h) return 'landscape';
    return 'portrait';
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const W = Math.max(50, r.width), H = Math.max(50, r.height);
    const s = canvasScale(W, H);
    canvas.width = Math.round(W * s);
    canvas.height = Math.round(H * s);
    G.W = W; G.H = H; G.scale = s;
    const small = W < 600;
    G.handleW = small ? 54 : 64;                 // at least 44 CSS px (04 §10)
    G.handleX = W - G.handleW;
    // with a review desk the band's handle has a column of its own at the left edge (01 §11.2), so the two
    // handles never overlap and the thumb on one never covers the other
    G.bandW = State.review ? (small ? 46 : 52) : 0;
    G.axisX = G.bandW + (small ? 28 : 34);
    G.top = small ? 20 : 24;                     // room for the badge of an item at score 1
    G.bottom = H - (small ? 12 : 16);
    G.beltX0 = G.axisX + 4;
    const usable = G.handleX - 6 - G.beltX0;
    G.gateX = G.beltX0 + usable * 0.64;          // belt ≈ 65 %, pile ≈ 35 % (04 §4.2)
    G.gateW = small ? 8 : 10;
    G.pileX0 = G.gateX + G.gateW / 2 + 6;
    G.pileX1 = G.handleX - 6;
    G.pileMid = (G.pileX0 + G.pileX1) / 2;
    G.itemSize = clamp((G.bottom - G.top) / 12, 14, 30);
    Pile.invalidate();
  }

  // a score (or calibrated p) ↔ a height on the canvas: 0 at the bottom, 1 at the top
  function yOf(v) { return G.bottom - v * (G.bottom - G.top); }
  function valueAt(y) { return (G.bottom - y) / (G.bottom - G.top); }

  // the handle's column at the right edge: a press there drags the line absolutely (it jumps to the pointer)
  function onHandle(x) { return x >= G.handleX - 6; }
  // the review band's handle: the column at the left edge, while there is a desk
  function onBandHandle(x) { return !!State.review && G.bandW > 0 && x < G.bandW; }
  // the belt and the pile (between the band's column and the handle's)
  function onPlayArea(x, y) { return x >= G.bandW && x < G.handleX - 6 && y >= 0 && y <= G.H; }
  // the item riding the belt under a point (a tap sends it to the desk); the nearest one within reach, or null
  function itemAt(x, y) {
    const run = State.run;
    if (!run || x > G.gateX) return null;
    const reach = Math.max(G.itemSize * 0.75, 18);
    let best = null, bestD = reach;
    for (const it of State.belt) {
      const ix = xOf(it), iy = yOf(it[run.key]);
      const d = Math.hypot(ix - x, iy - y);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }
  // where an item riding the belt is drawn: by its ride; in a top-k run a query's documents spread over five
  // lanes by rank around their column, so the ones at nearly the same height do not hide each other
  function xOf(it) {
    const x = G.beltX0 + clamp(Stream.progress(it), 0, 1) * (G.gateX - G.beltX0);
    return State.run && State.run.topk && it.rank !== undefined ? x + ((it.rank % 5) - 2) * G.itemSize * TOPK_SPREAD / 2 : x;
  }
  // the size of an item's drawing (a top-k column holds many documents: they are drawn smaller)
  function sizeOf() { return State.run && State.run.topk ? G.itemSize * 0.62 : G.itemSize; }
  // the line value the handle sits at: the threshold, or k's value in a top-k run
  function lineValue() { return State.run && State.run.topk ? Topk.valueOfK(State.k) : State.threshold; }

  // a score's worth of pixels: a relative drag moves the line by Δy / span
  function span() { return G.bottom - G.top; }

  function reducedMotion() { return !!(reducedQuery && reducedQuery.matches); }

  // the time since an item was decided (s), or null for an item that never rode (Generate 1 000)
  function sinceGate(item) {
    const t0 = anims.get(item);
    return t0 === undefined ? null : time - t0;
  }

  // One frame. dt = real seconds since the last frame (0 while the pause dialog is open).
  function frame(dt) {
    time += dt;
    const run = State.run;
    if (!run) return;
    ctx.setTransform(G.scale, 0, 0, G.scale, 0, 0);
    Belt.drawBackground(ctx, G, run);
    Pile.draw(ctx, G, run, time);
    Belt.drawGate(ctx, G, lastGate, time);
    Belt.drawItems(ctx, G, run, time);
    Belt.drawFlights(ctx, G, run, time);
    Belt.drawBand(ctx, G, run);
    if (run.topk) Belt.drawCuts(ctx, G, run);
    Belt.drawThreshold(ctx, G, run);
    Belt.drawTags(ctx, G, run, time);
    placeSlider();
  }

  // the screen reader's slider sits over the handle (04 §10)
  let sliderT = null;
  function placeSlider() {
    const topk = !!(State.run && State.run.topk);
    const t = lineValue(), key = (topk ? 'k' : 't') + t;
    if (key === sliderT) return;
    sliderT = key;
    slider.style.top = (yOf(t) - 18) + 'px';
    slider.setAttribute('aria-valuemin', topk ? '1' : '0');
    slider.setAttribute('aria-valuemax', topk ? String(TOPK_DOCS) : '1');
    slider.setAttribute('aria-valuenow', topk ? String(State.k) : t.toFixed(2));
    slider.setAttribute('aria-valuetext', topk ? 'k = ' + State.k : (State.run && State.run.key === 'p' ? 'p ≥ ' : 't = ') + t.toFixed(2));
  }

  // where things are on the page (CSS px, for the coach marks): an item riding the belt, the threshold's handle
  function pagePoint(x, y) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  }
  function itemPoint(item) { return pagePoint(xOf(item), yOf(item[State.run.key])); }
  function handlePoint() { return pagePoint(G.handleX + (G.W - G.handleX) / 2, yOf(lineValue())); }
  function bandPoint() {
    const d = State.review;
    return pagePoint(G.bandW / 2, yOf(d ? Review.lowOf(d, State.threshold) : 0));
  }

  return {
    G, ctx, layoutName, resize, yOf, valueAt, xOf, sizeOf, lineValue, onHandle, onBandHandle, onPlayArea, itemAt, span, reducedMotion, sinceGate, frame,
    itemPoint, handlePoint, bandPoint, get time() { return time; }
  };
})();
