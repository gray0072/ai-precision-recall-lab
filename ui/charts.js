'use strict';

// ============================================================
// AI Precision Recall Lab — the live panel's charts (spec 01 §1.5, 02 §4, 04 §6), hand-drawn on Canvas 2D
// (ADR-0003): ROC (with the chance diagonal, the area under the curve and AUC), PR (with the base rate as the
// "random" line and AP) and the profit curve (money per 100 items against the threshold, with the best one).
// The curves come from the validation set (the model as the team knows it), on the raw score (ADR-0004);
// the filled dot is the operating point at the current threshold and slides along the curve as the line
// moves; the hollow ring is the rolling window at the same threshold and jitters around it (sampling noise).
// On narrow panels one chart shows at a time, under tabs. Charts redraw only when something changed.
// Reads State; used by game.js (update, resize, tabs).
// ============================================================

const Charts = (() => {
  const P = PALETTE;
  const FONT = 'Segoe UI, Arial, sans-serif';
  const IDS = ['roc', 'pr', 'profit'];
  const charts = {};
  document.querySelectorAll('#chartsBox .chart').forEach((el) => {
    const canvas = el.querySelector('canvas');
    charts[el.dataset.chart] = { el, canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, s: 1 };
  });
  let tab = 'roc';
  let key = '';

  function resize() {
    for (const id of IDS) {
      const c = charts[id];
      const r = c.el.getBoundingClientRect();
      c.w = Math.max(10, r.width); c.h = Math.max(10, r.height);
      c.s = canvasScale(c.w, c.h);
      c.canvas.width = Math.round(c.w * c.s);
      c.canvas.height = Math.round(c.h * c.s);
    }
    key = '';
  }

  function visible(id) { return charts[id].el.offsetParent !== null; }

  function setTab(id) {
    tab = IDS.includes(id) ? id : 'roc';
    document.querySelectorAll('#chartsBox .chart').forEach((el) => el.classList.toggle('on', el.dataset.chart === tab));
    document.querySelectorAll('#chartsBox [data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    resize();
  }
  function nextTab() { setTab(IDS[(IDS.indexOf(tab) + 1) % IDS.length]); }

  // ---------- drawing helpers ----------
  // a square plot area inside the chart, with room for the title and the axis labels
  function frame(c, title) {
    const ctx = c.ctx;
    ctx.setTransform(c.s, 0, 0, c.s, 0, 0);
    ctx.clearRect(0, 0, c.w, c.h);
    const padL = 30, padR = 10, padT = 22, padB = 26;
    const side = Math.max(20, Math.min(c.w - padL - padR, c.h - padT - padB));
    const x0 = padL + Math.max(0, (c.w - padL - padR - side) / 2), y0 = padT;
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = P.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, x0 - padL + 4, 15);
    return { ctx, x0, y0, side, X: (v) => x0 + v * side, Y: (v) => y0 + side - v * side };
  }
  // the axes 0–1, three grid lines, the axis names
  function axes(p, xName, yName) {
    const { ctx, x0, y0, side } = p;
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const v of [0.25, 0.5, 0.75]) {
      ctx.moveTo(p.X(v), y0); ctx.lineTo(p.X(v), y0 + side);
      ctx.moveTo(x0, p.Y(v)); ctx.lineTo(x0 + side, p.Y(v));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
    ctx.fillStyle = P.muted;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xName, x0 + side / 2, y0 + side + 12);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText('0', x0 - 3, y0 + side + 1);
    ctx.textAlign = 'left';
    ctx.fillText('1', x0 + side - 6, y0 + side + 1);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', x0 - 4, y0 + 5);
    ctx.save();
    ctx.translate(x0 - 14, y0 + side / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yName, 0, 0);
    ctx.restore();
  }
  function polyline(p, pts, fx, fy) {
    const ctx = p.ctx;
    ctx.beginPath();
    pts.forEach((q, i) => { const x = p.X(fx(q)), y = p.Y(fy(q)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  }
  function dot(p, x, y, label) {
    const ctx = p.ctx;
    ctx.beginPath();
    ctx.arc(p.X(x), p.Y(y), 6, 0, Math.PI * 2);
    ctx.fillStyle = P.accent;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    if (label) {
      ctx.font = '600 11px ' + FONT;
      ctx.fillStyle = P.accent;
      const right = p.X(x) < p.x0 + p.side * 0.7;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, p.X(x) + (right ? 10 : -10), clamp(p.Y(y) + (y > 0.85 ? 12 : -10), p.y0 + 6, p.y0 + p.side - 6));
    }
  }
  function ring(p, x, y) {
    if (x === null || y === null) return;
    const ctx = p.ctx;
    ctx.beginPath();
    ctx.arc(p.X(x), p.Y(y), 6, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = P.text;
    ctx.stroke();
  }
  function corner(p, lines) {
    const ctx = p.ctx;
    ctx.font = '600 11px ' + FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((txt, i) => {
      ctx.fillStyle = i ? P.muted : P.text;
      ctx.fillText(txt, p.x0 + p.side - 6, p.y0 + p.side - 8 - (lines.length - 1 - i) * 14);
    });
  }
  function nothing(p, text) {
    p.ctx.fillStyle = P.muted;
    p.ctx.font = '12px ' + FONT;
    p.ctx.textAlign = 'center';
    p.ctx.textBaseline = 'middle';
    p.ctx.fillText(text, p.x0 + p.side / 2, p.y0 + p.side / 2);
  }

  // ---------- the charts ----------
  function drawRoc(c, run, op, live, tLabel) {
    const p = frame(c, tr('ROC curve'));
    axes(p, tr('FPR (false alarms)'), tr('TPR = recall'));
    const ctx = p.ctx;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.X(0), p.Y(0)); ctx.lineTo(p.X(1), p.Y(1)); ctx.stroke();
    ctx.restore();
    const pts = run.curves.roc;
    if (!pts) { nothing(p, tr('needs both classes')); return; }
    polyline(p, pts, (q) => q.fpr, (q) => q.tpr);
    ctx.lineTo(p.X(1), p.Y(0));
    ctx.lineTo(p.X(0), p.Y(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    polyline(p, pts, (q) => q.fpr, (q) => q.tpr);
    ctx.strokeStyle = P.text;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const lines = ['AUC ' + run.curves.auc.toFixed(2)];
    if (run.kind === 'sandbox') lines.push(tr('theory {v}', { v: Model.theoreticalAuc(run.model.dPrime).toFixed(2) }));
    corner(p, lines);
    if (live) ring(p, live.fpr, live.recall);
    if (op.fpr !== null && op.tpr !== null) dot(p, op.fpr, op.tpr, tLabel);
  }

  function drawPr(c, run, op, live, tLabel) {
    const p = frame(c, tr('Precision–recall curve'));
    axes(p, tr('Recall'), tr('Precision'));
    const ctx = p.ctx;
    const base = run.curves.prevalence;
    if (base !== null) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.X(0), p.Y(base)); ctx.lineTo(p.X(1), p.Y(base)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = P.muted;
      ctx.font = '10px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = base > 0.85 ? 'top' : 'bottom';
      ctx.fillText(tr('random: {v}', { v: base.toFixed(2) }), p.X(0) + 4, p.Y(base) + (base > 0.85 ? 3 : -2));
    }
    const pts = run.curves.pr;
    if (!pts || !pts.length) { nothing(p, tr('needs positives')); return; }
    polyline(p, pts, (q) => q.recall, (q) => q.precision);
    ctx.strokeStyle = P.text;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    corner(p, ['AP ' + run.curves.ap.toFixed(2)]);
    if (live) ring(p, live.recall, live.precision);
    if (op.recall !== null && op.precision !== null) dot(p, op.recall, op.precision, tLabel);
  }

  function drawProfit(c, run, tLabel) {
    const ctx = c.ctx;
    ctx.setTransform(c.s, 0, 0, c.s, 0, 0);
    ctx.clearRect(0, 0, c.w, c.h);
    const padL = 36, padR = 10, padT = 36, padB = 26;
    const x0 = padL, y0 = padT, w = Math.max(20, c.w - padL - padR), h = Math.max(20, c.h - padT - padB);
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = P.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(tr('Profit per 100 items'), 8, 15);
    const pts = run.profit;
    let lo = 0, hi = 0;
    for (const q of pts) { lo = Math.min(lo, q.per100); hi = Math.max(hi, q.per100); }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const padV = (hi - lo) * 0.08;
    lo -= padV; hi += padV;
    const X = (t) => x0 + t * w, Y = (v) => y0 + h - (v - lo) / (hi - lo) * h;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    // the zero line, and the money scale at the top and the bottom
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x0 + w, Y(0)); ctx.stroke();
    ctx.fillStyle = P.muted;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(money(hi - padV), x0 - 4, Y(hi - padV));
    ctx.fillText('0', x0 - 4, Y(0));
    if (lo + padV < -0.5) ctx.fillText(money(lo + padV), x0 - 4, Y(lo + padV));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '11px ' + FONT;
    ctx.fillText(run.key === 'p' ? tr('threshold on p') : tr('threshold'), x0 + w / 2, y0 + h + 12);
    ctx.fillText('0', x0, y0 + h + 1);
    ctx.fillText('1', x0 + w, y0 + h + 1);
    // the curve
    ctx.beginPath();
    pts.forEach((q, i) => { if (i) ctx.lineTo(X(q.t), Y(q.per100)); else ctx.moveTo(X(q.t), Y(q.per100)); });
    ctx.strokeStyle = P.text;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // the best threshold (dashed) and the current one (the accent)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = P.good;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(run.bestT), y0); ctx.lineTo(X(run.bestT), y0 + h); ctx.stroke();
    ctx.restore();
    const t = State.threshold;
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(t), y0); ctx.lineTo(X(t), y0 + h); ctx.stroke();
    const here = pts[hundredths(t)];
    ctx.beginPath();
    ctx.arc(X(t), Y(here.per100), 5, 0, Math.PI * 2);
    ctx.fillStyle = P.accent;
    ctx.fill();
    ctx.font = '600 11px ' + FONT;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    // under the title: the best threshold and the current one, with their money
    ctx.font = '600 10px ' + FONT;
    ctx.textAlign = 'left';
    const say = (text, color, x) => {
      ctx.fillStyle = color;
      Icons.drawText(ctx, text, x, 29, color, (s, xx) => ctx.fillText(s, xx, 29));
      return x + ctx.measureText(text).width + 14;
    };
    const next = say(tr('best {t} → {m}', { t: run.bestT.toFixed(2), m: money(pts[hundredths(run.bestT)].per100) }), P.good, 8);
    say(tLabel + ' → ' + money(here.per100), P.accent, next);
  }

  // whole dollars with a sign (04 §2); the profit per 100 items keeps one decimal when it is small
  function money(v) {
    const a = Math.abs(v), txt = a < 10 && Math.round(a) !== a ? a.toFixed(1) : String(Math.round(a));
    return (v < -0.05 ? '−$' : v > 0.05 ? '+$' : '$') + txt;
  }

  // redraws the visible charts when the threshold, the pile, the model or the size changed
  function update(force) {
    const run = State.run;
    if (!run || !run.curves) return;
    const k = State.threshold + '|' + State.pileVersion + '|' + run.key + '|' + tab + '|' + run.curves.auc + '|' + run.bestT;
    if (k === key && !force) return;
    key = k;
    const t = State.threshold;
    // the curves are on the raw score: a threshold on calibrated p is read at its raw equivalent (ADR-0004)
    const op = Metrics.operatingPoint(run.curves, run.key === 'p' ? Model.rawThreshold(t, run.platt) : t);
    const live = State.pile.length ? Metrics.compute(Metrics.counts(State.pile, t, run.key)) : null;
    const tLabel = (run.key === 'p' ? 'p ≥ ' : 't = ') + t.toFixed(2);
    if (visible('roc')) drawRoc(charts.roc, run, op, live, tLabel);
    if (visible('pr')) drawPr(charts.pr, run, op, live, tLabel);
    if (visible('profit')) drawProfit(charts.profit, run, tLabel);
  }

  document.querySelectorAll('#chartsBox [data-tab]').forEach((b) => b.addEventListener('click', () => { setTab(b.dataset.tab); update(true); }));
  // a chart's box changes size with the panel around it (formula view, a tab, the window): match the canvas
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => { resize(); update(true); });
    IDS.forEach((id) => ro.observe(charts[id].el));
  }

  return { resize, update, setTab, nextTab, get tab() { return tab; } };
})();
