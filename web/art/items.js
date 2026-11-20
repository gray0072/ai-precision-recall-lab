'use strict';

// ============================================================
// AI Precision Recall Lab — the item drawings (spec 04 §5, 03 §1): per scenario a hidden look (the class is
// not known yet: a neutral grey drawing) and two revealed ones (positive in orange, negative in blue), drawn
// with Canvas 2D paths at any size, plus the score badge (a dark pill with the number). Flat and friendly:
// rounded shapes, thick dark outlines, no images. Abstract is a dot. Search Ranker's pages are drawn here
// too, for I06.
// Used by render/belt.js (the belt, the reveal at the gate, the flight to the pile).
// ============================================================

const ItemArt = (() => {
  const P = PALETTE;
  const PAPER = '#dfe7ef', PAPER_DARK = '#b8c4d0';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function outline(ctx, u, color) {
    ctx.lineWidth = Math.max(1, u * 0.09);
    ctx.strokeStyle = color || P.ink;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  const classColor = (look) => (look === 'pos' ? P.pos : P.neg);

  // ---------- one drawer per scenario: (ctx, u = the size, look = 'hidden' | 'pos' | 'neg', item) ----------

  function abstract(ctx, u, look) {
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = look === 'hidden' ? P.hidden : classColor(look);
    ctx.fill();
    outline(ctx, u);
  }

  // a letter: a closed envelope → open, with a skull seal (spam) or a plain letter
  function spam(ctx, u, look) {
    const w = u * 0.95, h = u * 0.62, x = -w / 2, y = -h / 2 + u * 0.06;
    if (look !== 'hidden') {
      // the opened flap behind, and the letter sticking out
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(0, y - h * 0.62); ctx.lineTo(x + w, y); ctx.closePath();
      ctx.fillStyle = PAPER_DARK; ctx.fill(); outline(ctx, u);
      rr(ctx, x + w * 0.14, y - h * 0.38, w * 0.72, h * 0.8, u * 0.04);
      ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, u);
      if (look === 'neg') {
        ctx.beginPath();
        for (let i = 0; i < 2; i++) { ctx.moveTo(x + w * 0.26, y - h * (0.2 - i * 0.18)); ctx.lineTo(x + w * 0.74, y - h * (0.2 - i * 0.18)); }
        ctx.lineWidth = Math.max(1, u * 0.05); ctx.strokeStyle = P.neg; ctx.stroke();
      }
    }
    rr(ctx, x, y, w, h, u * 0.07);
    ctx.fillStyle = look === 'hidden' ? PAPER : '#eef3f7';
    ctx.fill();
    outline(ctx, u, look === 'hidden' ? P.ink : classColor(look));
    // the folds of the front
    ctx.beginPath();
    if (look === 'hidden') { ctx.moveTo(x, y); ctx.lineTo(0, y + h * 0.55); ctx.lineTo(x + w, y); }
    else { ctx.moveTo(x, y + h); ctx.lineTo(0, y + h * 0.45); ctx.lineTo(x + w, y + h); }
    ctx.lineWidth = Math.max(1, u * 0.06); ctx.strokeStyle = P.hiddenDark; ctx.stroke();
    if (look === 'pos') {
      // the skull seal
      const r = u * 0.17, cy = y + h * 0.5;
      ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fillStyle = P.pos; ctx.fill(); outline(ctx, u);
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(-r * 0.38, cy - r * 0.1, r * 0.24, 0, Math.PI * 2); ctx.arc(r * 0.38, cy - r * 0.1, r * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-r * 0.3, cy + r * 0.4, r * 0.6, r * 0.18);
    }
  }

  // a passenger in a coat → with a thermometer: hot (fever) or normal
  function fever(ctx, u, look) {
    const coat = look === 'hidden' ? P.hidden : (look === 'pos' ? '#c9764a' : '#5d9bb8');
    ctx.beginPath();
    ctx.moveTo(-u * 0.3, u * 0.42); ctx.lineTo(-u * 0.24, -u * 0.02);
    ctx.quadraticCurveTo(0, -u * 0.14, u * 0.24, -u * 0.02); ctx.lineTo(u * 0.3, u * 0.42); ctx.closePath();
    ctx.fillStyle = coat; ctx.fill(); outline(ctx, u);
    ctx.beginPath(); ctx.arc(0, -u * 0.24, u * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#f2d2b6'; ctx.fill(); outline(ctx, u);
    if (look === 'hidden') return;
    // the thermometer
    const tx = u * 0.36, top = -u * 0.38, bot = u * 0.2;
    rr(ctx, tx - u * 0.06, top, u * 0.12, bot - top, u * 0.06);
    ctx.fillStyle = '#ffffff'; ctx.fill(); outline(ctx, u);
    const level = look === 'pos' ? top + u * 0.06 : bot - u * 0.22;
    ctx.fillStyle = classColor(look);
    ctx.fillRect(tx - u * 0.025, level, u * 0.05, bot - level);
    ctx.beginPath(); ctx.arc(tx, bot + u * 0.04, u * 0.1, 0, Math.PI * 2); ctx.fill(); outline(ctx, u);
  }

  // a bolt in a box → a bolt with a crack, or a shiny one
  function bolts(ctx, u, look) {
    if (look === 'hidden') {
      const s = u * 0.72;
      rr(ctx, -s / 2, -s / 2, s, s, u * 0.06);
      ctx.fillStyle = '#b08a5a'; ctx.fill(); outline(ctx, u);
      ctx.fillStyle = '#d8c39a'; ctx.fillRect(-u * 0.07, -s / 2, u * 0.14, s);
      return;
    }
    const c = classColor(look);
    // the hexagonal head
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      ctx.lineTo(Math.cos(a) * u * 0.26, -u * 0.22 + Math.sin(a) * u * 0.14);
    }
    ctx.closePath();
    ctx.fillStyle = look === 'pos' ? '#9aa6b2' : '#cfe3ee'; ctx.fill(); outline(ctx, u, c);
    // the shaft with its thread
    rr(ctx, -u * 0.1, -u * 0.12, u * 0.2, u * 0.56, u * 0.04);
    ctx.fill(); outline(ctx, u, c);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { ctx.moveTo(-u * 0.1, u * (0.0 + k * 0.1)); ctx.lineTo(u * 0.1, u * (0.05 + k * 0.1)); }
    ctx.lineWidth = Math.max(1, u * 0.04); ctx.strokeStyle = P.hiddenDark; ctx.stroke();
    if (look === 'pos') {
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, u * 0.02); ctx.lineTo(0, u * 0.12); ctx.lineTo(-u * 0.04, u * 0.2); ctx.lineTo(u * 0.14, u * 0.3);
      ctx.lineWidth = Math.max(1.5, u * 0.08); ctx.strokeStyle = P.pos; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-u * 0.04, -u * 0.08); ctx.lineTo(-u * 0.04, u * 0.36);
      ctx.lineWidth = Math.max(1, u * 0.04); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
  }

  // a payment card with the amount → with a red stamp (fraud) or a tick (genuine)
  function fraud(ctx, u, look, item) {
    const w = u * 0.95, h = u * 0.62;
    rr(ctx, -w / 2, -h / 2, w, h, u * 0.08);
    ctx.fillStyle = look === 'hidden' ? '#c3ccd6' : '#e8eef4'; ctx.fill();
    outline(ctx, u, look === 'hidden' ? P.ink : classColor(look));
    ctx.fillStyle = P.hiddenDark; ctx.fillRect(-w / 2, -h * 0.28, w, h * 0.16);
    ctx.fillStyle = '#d9b44a'; ctx.fillRect(-w * 0.38, h * 0.0, w * 0.18, h * 0.22);
    if (look === 'pos') {
      ctx.save(); ctx.rotate(-0.35);
      rr(ctx, -w * 0.42, -h * 0.17, w * 0.84, h * 0.34, u * 0.04);
      ctx.lineWidth = Math.max(1.5, u * 0.08); ctx.strokeStyle = P.pos; ctx.stroke();
      ctx.restore();
    } else if (look === 'neg') {
      ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.08); ctx.lineTo(w * 0.17, h * 0.2); ctx.lineTo(w * 0.38, -h * 0.06);
      ctx.lineWidth = Math.max(1.5, u * 0.08); ctx.strokeStyle = P.neg; ctx.stroke();
    }
    if (item && item.amount !== undefined) {
      ctx.font = '600 ' + Math.max(8, Math.round(u * 0.26)) + 'px Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = P.text;
      ctx.fillText('$' + item.amount.toLocaleString('en-US').replace(/,/g, ' '), 0, h / 2 + u * 0.04);
    }
  }

  // a comment: a grey speech bubble → spiky (toxic) or round (fine)
  function moderation(ctx, u, look) {
    if (look === 'pos') {
      ctx.beginPath();
      const n = 9;
      for (let k = 0; k < n * 2; k++) {
        const a = k * Math.PI / n, r = (k % 2 ? 0.24 : 0.42) * u;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.85);
      }
      ctx.closePath();
      ctx.fillStyle = P.pos; ctx.fill(); outline(ctx, u);
      return;
    }
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.04, u * 0.42, u * 0.3, 0, 0, Math.PI * 2);
    ctx.moveTo(-u * 0.18, u * 0.2); ctx.lineTo(-u * 0.3, u * 0.42); ctx.lineTo(-u * 0.02, u * 0.24);
    ctx.fillStyle = look === 'hidden' ? P.hidden : P.neg; ctx.fill(); outline(ctx, u);
    ctx.fillStyle = P.ink;
    for (const dx of [-0.16, 0, 0.16]) { ctx.beginPath(); ctx.arc(dx * u, -u * 0.04, u * 0.045, 0, Math.PI * 2); ctx.fill(); }
  }

  // a document: a page → with a star (relevant) or plain
  function retrieval(ctx, u, look) {
    const w = u * 0.6, h = u * 0.8, x = -w / 2, y = -h / 2, f = u * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w - f, y); ctx.lineTo(x + w, y + f); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.fillStyle = look === 'hidden' ? PAPER : '#ffffff'; ctx.fill();
    outline(ctx, u, look === 'hidden' ? P.ink : classColor(look));
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(x + w * 0.18, y + h * (0.35 + i * 0.18)); ctx.lineTo(x + w * 0.82, y + h * (0.35 + i * 0.18)); }
    ctx.lineWidth = Math.max(1, u * 0.05); ctx.strokeStyle = P.hiddenDark; ctx.stroke();
    if (look === 'pos') {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 0.08 : 0.19) * u;
        ctx.lineTo(Math.cos(a) * r, y + h * 0.2 + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fillStyle = P.pos; ctx.fill(); outline(ctx, u);
    }
  }

  const DRAW = { abstract, spam, fever, bolts, fraud, moderation, retrieval };

  // An item centred on x, y, `size` px tall. look: 'hidden' | 'pos' | 'neg'. opts: { tint ('pos' | 'neg':
  // the faint hint of the true class, Easy and the sandbox's "Show true class"), scaleX (the flip at the gate),
  // alpha, item (for the amount) }.
  function draw(ctx, scenario, x, y, size, look, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.tint) {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = opts.tint === 'pos' ? 'rgba(255, 138, 61, 0.38)' : 'rgba(79, 195, 247, 0.32)';
      ctx.fill();
    }
    if (opts.scaleX !== undefined) ctx.scale(Math.max(0.02, opts.scaleX), 1);
    (DRAW[scenario] || abstract)(ctx, size, look, opts.item);
    ctx.restore();
  }

  // The score badge: a dark rounded pill with the number above the item; the class colour as a thin outline
  // once revealed (outline = a colour, or null).
  function badge(ctx, text, x, y, fontPx, outlineColor) {
    ctx.font = '600 ' + fontPx + 'px Segoe UI, Arial, sans-serif';
    const w = ctx.measureText(text).width + fontPx * 0.8, h = fontPx * 1.35;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(8, 16, 26, 0.86)';
    ctx.fill();
    if (outlineColor) { ctx.lineWidth = 1.2; ctx.strokeStyle = outlineColor; ctx.stroke(); }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }

  return { draw, badge, rr };
})();
