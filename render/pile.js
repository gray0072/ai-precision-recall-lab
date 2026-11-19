'use strict';

// ============================================================
// AI Precision Recall Lab — the pile (spec 01 §1.4): a sideways, mirrored histogram on the belt's score axis.
// 20 rows 0.05 wide; in each row the positives stack to the left of the pile's axis and the negatives to the
// right, so the threshold line splits the pile into the four cells of the confusion matrix in the matrix's
// own layout: TP top left, FP top right, FN bottom left, TN bottom right. Each square is coloured by its
// outcome at the current threshold (the rolling window re-evaluated, 02 §3.4), so moving the line re-colours
// the pile at once. The squares shrink and stack in several lines per row as the rows fill up; the oldest
// fifth of the window fades. Pointing at a metric (State.highlight) dims what is not in its formula.
// The layout (where each square sits) depends only on the pile and the size, so it is cached by pileVersion.
// Used by render/render.js (frame) and render/belt.js (the slot an item flies to).
// ============================================================

const Pile = (() => {
  const ROWS = 20, BIN = 5;     // 20 rows of 0.05 = 5 hundredths
  const P = PALETTE;
  let cacheKey = '';
  let slots = new Map();        // item → { x, y } (top-left corner of its square)
  let cell = 4;                 // the square's side (CSS px)

  function invalidate() { cacheKey = ''; }

  function rowOf(v) { return Math.min(ROWS - 1, Math.floor(hundredths(v) / BIN)); }

  // where every square goes: rows by score, positives left / negatives right, the higher score on top in a row,
  // filled column by column outwards from the axis; the side is the largest that fits the fullest row
  function layout(G, run) {
    const key = State.pileVersion + '|' + G.W + 'x' + G.H + '|' + run.key;
    if (key === cacheKey) return;
    cacheKey = key;
    const k = run.key;
    const rows = [];
    for (let r = 0; r < ROWS; r++) rows.push({ pos: [], neg: [] });
    for (const it of State.pile) rows[rowOf(it[k])][it.y ? 'pos' : 'neg'].push(it);
    let most = 1;
    for (const row of rows) most = Math.max(most, row.pos.length, row.neg.length);
    const rowH = (G.bottom - G.top) / ROWS;
    const halfW = (G.pileX1 - G.pileX0) / 2 - 2;
    let s = Math.min(rowH * 0.92, 14);
    while (s > 1 && Math.floor(rowH / s) * Math.floor(halfW / s) < most) s -= 0.25;
    cell = Math.max(1, s);
    const lines = Math.max(1, Math.floor(rowH / cell));
    slots = new Map();
    for (let r = 0; r < ROWS; r++) {
      const rowTop = G.bottom - (r + 1) * rowH;
      const pad = (rowH - lines * cell) / 2;
      for (const side of ['pos', 'neg']) {
        const list = rows[r][side].slice().sort((a, b) => b[k] - a[k]);
        list.forEach((it, i) => {
          const col = Math.floor(i / lines), line = i % lines;
          const x = side === 'pos' ? G.pileMid - 2 - (col + 1) * cell : G.pileMid + 2 + col * cell;
          slots.set(it, { x, y: rowTop + pad + line * cell });
        });
      }
    }
  }

  // the square of an item (for the flight from the gate); null when it is not in the pile
  function slotOf(item) { return slots.get(item) || null; }
  function cellSize() { return cell; }

  function draw(ctx, G, run, time) {
    layout(G, run);
    const t = State.threshold, k = run.key;
    const hl = State.highlight;
    const pile = State.pile, n = pile.length;
    const fadeN = Math.floor(run.window * 0.2);   // the oldest fifth of a full window fades out
    const oldest = n - run.window;                // index the window would start at if it were full
    const gap = cell >= 4 ? 1 : cell >= 2.5 ? 0.5 : 0;
    const hatch = Math.max(3, Math.round(cell * 0.75 * G.scale)) / G.scale;

    // the axis of the mirrored histogram
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(G.pileMid, G.top - 6);
    ctx.lineTo(G.pileMid, G.bottom + 4);
    ctx.stroke();

    // the squares, grouped by outcome so the fill style changes four times, not once per square
    const groups = { TP: [], FP: [], FN: [], TN: [] };
    for (let i = 0; i < n; i++) {
      const it = pile[i];
      const since = Render.sinceGate(it);
      if (since !== null && since < Belt.LAND_S && !Render.reducedMotion()) continue;   // still flying
      const out = Stream.outcome(atOrAbove(it[k], t), it.y);
      let a = 1;
      const age = i - Math.max(0, oldest);
      if (n >= run.window * 0.8 && age < fadeN) a = 0.3 + 0.7 * age / fadeN;
      if (since !== null && Render.reducedMotion() && since < Belt.LAND_S) a *= since / Belt.LAND_S;   // fade in
      if (hl) a *= hl.num.includes(out) ? 1 : hl.den.includes(out) ? 0.5 : 0.12;
      groups[out].push(it, a);
    }
    for (const out of ['TN', 'FP', 'FN', 'TP']) {
      const g = groups[out];
      if (!g.length) continue;
      ctx.fillStyle = Hatch.fill(ctx, out, hatch);
      for (let j = 0; j < g.length; j += 2) {
        const sl = slots.get(g[j]);
        if (!sl) continue;
        ctx.globalAlpha = g[j + 1];
        ctx.fillRect(sl.x, sl.y, cell - gap, cell - gap);
      }
    }
    ctx.globalAlpha = 1;

    // the four regions' names, next to the line: the pile is the confusion matrix
    const y = Render.yOf(t);
    const fs = G.W < 600 ? 10 : 11;
    ctx.font = '700 ' + fs + 'px Segoe UI, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const label = (txt, x, yy, align, color, outs) => {
      ctx.globalAlpha = hl ? (outs.some((o) => hl.den.includes(o)) ? 0.95 : 0.25) : 0.7;
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.fillText(txt, x, yy);
    };
    const above = Math.max(G.top - 8, y - fs), below = Math.min(G.bottom + 6, y + fs);
    if (y > G.top + 4) { label('TP', G.pileX0 + 2, above, 'left', P.pos, ['TP']); label('FP', G.pileX1 - 2, above, 'right', P.neg, ['FP']); }
    if (y < G.bottom - 4) { label('FN', G.pileX0 + 2, below, 'left', P.pos, ['FN']); label('TN', G.pileX1 - 2, below, 'right', P.neg, ['TN']); }
    ctx.globalAlpha = 1;
  }

  return { invalidate, layout, slotOf, cellSize, draw, rowOf };
})();
