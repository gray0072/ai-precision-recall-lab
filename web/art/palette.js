'use strict';

// ============================================================
// AI Precision Recall Lab — the colours of the canvas (spec 04 §1), the same values as the CSS tokens in
// styles.css. The outcome code: the colour is the true class (orange = positive, blue = negative), solid when
// the model was right, hatched on a dark ground when it was wrong. hatch() makes the hatching patterns once
// per canvas context. Used by art/items.js, render/ and ui/charts.js.
// ============================================================

const PALETTE = {
  bg: '#0d1b2a',
  bgPlay: '#13263a',
  beltA: '#1c3348',
  beltB: '#223d55',
  text: '#eef3f7',
  muted: '#9fb0c3',
  accent: '#ffb300',
  accentGlow: 'rgba(255, 179, 0, 0.35)',
  pos: '#ff8a3d',
  neg: '#4fc3f7',
  good: '#7bd88f',
  warn: '#ffd54f',
  bad: '#ff6b5e',
  review: '#b39ddb',
  hidden: '#8a9aac',        // an item whose class is still hidden
  hiddenDark: '#5d6d7e',
  ink: '#0d1b2a',           // outlines of the drawings
  hatchGround: '#1a2633',   // the dark ground under the hatching of a wrong outcome
  flagTint: 'rgba(255, 179, 0, 0.07)',   // the belt above the threshold ("flagged")
  grid: 'rgba(255, 255, 255, 0.08)'
};

// the colour and the fill of each outcome
const OUTCOME_STYLE = {
  TP: { color: PALETTE.pos, hatched: false, right: true },
  FN: { color: PALETTE.pos, hatched: true, right: false },
  TN: { color: PALETTE.neg, hatched: false, right: true },
  FP: { color: PALETTE.neg, hatched: true, right: false }
};

// Diagonal hatching on the dark ground, in a class colour: a CanvasPattern, made once per context and colour.
// `size` is the stripe period in canvas pixels.
const Hatch = (() => {
  const cache = new WeakMap();
  function pattern(ctx, color, size) {
    let byCtx = cache.get(ctx);
    if (!byCtx) { byCtx = {}; cache.set(ctx, byCtx); }
    const key = color + size;
    if (byCtx[key]) return byCtx[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = PALETTE.hatchGround;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, size * 0.28);
    g.beginPath();
    // one stripe through the tile and its two neighbours, so the tiles join without a seam
    for (const o of [-size, 0, size]) { g.moveTo(o, size); g.lineTo(o + size, 0); }
    g.stroke();
    byCtx[key] = ctx.createPattern(c, 'repeat');
    return byCtx[key];
  }
  // the fill style of an outcome: its colour, or its hatching
  function fill(ctx, outcome, size) {
    const st = OUTCOME_STYLE[outcome];
    return st.hatched ? pattern(ctx, st.color, size) : st.color;
  }
  return { pattern, fill };
})();
