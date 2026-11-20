'use strict';

// ============================================================
// AI Precision Recall Lab — the cheat sheet (spec 01 §8, 03 §4, 04 §3): a grid of cards ("Which metric?" first)
// with a search field that filters by name and text; a card opens full-size: the formula with the cell names in
// the outcome colours, in one line, how to remember it, watch out, an example, its picture and the cards it
// links to. The picture is drawn live from a fixed sample: the pile (a mirrored histogram split by a threshold,
// the card's cells bright, the rest of its denominator dimmer, everything else faint), or the ROC / PR curve,
// or the reliability diagram of a timid model, or the review band. "Which metric?" is a small flow of questions.
// Opened from the start screen, the map, the pause dialog, the results' lesson and a second tap on a metric bar;
// Back returns where it came from (game.js passes it). Reads GLOSSARY, WHICH_METRIC.
// ============================================================

const Glossary = (() => {
  const $ = (id) => document.getElementById(id);
  const P = PALETTE;
  const byId = {};
  GLOSSARY.forEach((g) => { byId[g.id] = g; });
  let back = () => {};
  let fromGrid = false;   // the open card was picked in the grid (Back returns to it)

  // ---------- text markup: **bold**, *italic*, the cell names in their colours ----------
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function marked(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  }
  function formulaHtml(s) {
    return esc(s).replace(/\b(TP|FP|FN|TN)\b/g, '<span class="o$1">$1</span>');
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- the fixed sample of the pictures ----------
  let sample = null;
  function getSample() {
    if (!sample) {
      const m = Model.of(SCENARIOS.abstract, { prevalence: 0.3, dPrime: 2 });
      const all = Stream.validation(20261119, m, 2000);
      sample = { pile: all.slice(0, 120), curve: all, roc: Metrics.roc(all), pr: Metrics.pr(all), prevalence: 0.3 };
      const timid = Stream.validation(20261120, Model.of(SCENARIOS.fever, { prevalence: 0.3 }), 2000);
      sample.reliability = Metrics.reliability(timid, 's');
    }
    return sample;
  }

  function fitCanvas(c, w, h) {
    const s = Math.min(window.devicePixelRatio || 1, 2.5);
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    return ctx;
  }

  // the pile of the sample at t = 0.5: positives left, negatives right, like the play screen's pile
  function drawPile(ctx, w, h, pic) {
    const s = getSample();
    const t = 0.5, top = 10, bottom = h - 10, mid = w / 2, rows = 20, rowH = (bottom - top) / rows;
    const counts = [];
    for (let r = 0; r < rows; r++) counts.push({ pos: [], neg: [] });
    for (const it of s.pile) counts[Math.min(rows - 1, Math.floor(hundredths(it.s) / 5))][it.y ? 'pos' : 'neg'].push(it);
    // the largest square that fits the fullest row (as the play screen's pile does)
    let most = 1;
    for (const c of counts) most = Math.max(most, c.pos.length, c.neg.length);
    const halfW = w / 2 - 30;
    let cell = Math.min(rowH, 12);
    while (cell > 2 && Math.floor(rowH / cell) * Math.floor(halfW / cell) < most) cell -= 0.25;
    const lines = Math.max(1, Math.floor(rowH / cell));
    const lit = (o) => (!pic.num.length && !pic.den.length) || pic.num.includes(o) || pic.den.includes(o);
    const alpha = (o) => (pic.num.includes(o) ? 1 : pic.den.includes(o) ? 0.45 : !pic.num.length ? 1 : 0.1);
    const hatch = Math.max(3, Math.round(cell * 0.8 * 2)) / 2;
    if (pic.band) {
      ctx.fillStyle = 'rgba(179, 157, 219, 0.22)';
      const y0 = bottom - pic.band[1] * (bottom - top), y1 = bottom - pic.band[0] * (bottom - top);
      ctx.fillRect(8, y0, w - 16, y1 - y0);
    }
    for (let r = 0; r < rows; r++) {
      const rowTop = bottom - (r + 1) * rowH;
      for (const side of ['pos', 'neg']) {
        counts[r][side].sort((a, b) => b.s - a.s).forEach((it, i) => {
          const col = Math.floor(i / lines), line = i % lines;
          const x = side === 'pos' ? mid - 2 - (col + 1) * cell : mid + 2 + col * cell;
          const o = Stream.outcome(atOrAbove(it.s, t), it.y);
          const inBand = pic.band && it.s >= pic.band[0] && it.s < pic.band[1];
          ctx.globalAlpha = pic.band ? (inBand ? 1 : 0.35) : alpha(o);
          ctx.fillStyle = Hatch.fill(ctx, o, hatch);
          ctx.fillRect(x, rowTop + line * cell, cell - 0.5, cell - 0.5);
        });
      }
    }
    ctx.globalAlpha = 1;
    const y = bottom - t * (bottom - top);
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w - 6, y); ctx.stroke();
    ctx.font = '700 11px Segoe UI, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const label = (txt, x, yy, align, color, o) => {
      ctx.globalAlpha = lit(o) ? 0.95 : 0.3;
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.fillText(txt, x, yy);
    };
    label('TP', 8, y - 10, 'left', P.pos, 'TP');
    label('FP', w - 8, y - 10, 'right', P.neg, 'FP');
    label('FN', 8, y + 10, 'left', P.pos, 'FN');
    label('TN', w - 8, y + 10, 'right', P.neg, 'TN');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mid, top); ctx.lineTo(mid, bottom); ctx.stroke();
  }

  // a square plot 0–1 with a curve (ROC, PR) or bars (reliability) and a reference line
  function drawPlot(ctx, w, h, kind) {
    const s = getSample();
    const side = Math.min(w - 40, h - 30), x0 = (w - side) / 2 + 10, y0 = 8;
    const X = (v) => x0 + v * side, Y = (v) => y0 + side - v * side;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    if (kind === 'pr') { ctx.moveTo(X(0), Y(s.prevalence)); ctx.lineTo(X(1), Y(s.prevalence)); }
    else { ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = P.muted;
    ctx.font = '10px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const names = { roc: [tr('FPR'), tr('TPR')], pr: [tr('Recall'), tr('Precision')], reliability: [tr('predicted'), tr('observed')] }[kind];
    ctx.fillText(names[0], x0 + side / 2, y0 + side + 3);
    ctx.save();
    ctx.translate(x0 - 10, y0 + side / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(names[1], 0, 0);
    ctx.restore();
    if (kind === 'reliability') {
      for (const b of s.reliability) {
        if (b.observed === null) continue;
        ctx.fillStyle = 'rgba(79, 195, 247, 0.75)';
        ctx.fillRect(X(b.lo) + 1, Y(b.observed), side / s.reliability.length - 2, Y(0) - Y(b.observed));
      }
      return;
    }
    const pts = kind === 'roc' ? s.roc : s.pr;
    ctx.beginPath();
    pts.forEach((q, i) => {
      const x = X(kind === 'roc' ? q.fpr : q.recall), y = Y(kind === 'roc' ? q.tpr : q.precision);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = P.text;
    ctx.lineWidth = 2;
    ctx.stroke();
    // the operating point at t = 0.5
    const c = Metrics.compute(Metrics.counts(s.curve, 0.5));
    ctx.beginPath();
    ctx.arc(X(kind === 'roc' ? c.fpr : c.recall), Y(kind === 'roc' ? c.recall : c.precision), 5, 0, Math.PI * 2);
    ctx.fillStyle = P.accent;
    ctx.fill();
  }

  function picture(card) {
    if (!card.pic) return null;
    const c = el('canvas', 'glPic');
    const w = 280, h = 190;
    const ctx = fitCanvas(c, w, h);
    const k = card.pic.kind;
    if (k === 'pile') drawPile(ctx, w, h, card.pic);
    else if (k === 'band') drawPile(ctx, w, h, { num: [], den: [], band: [0.35, 0.65] });
    else drawPlot(ctx, w, h, k);
    const cap = {
      pile: tr('A sample of 120 items at t = 0.50; the card\'s cells are bright.'),
      band: tr('The review band 0.35–0.65: people decide the items inside it.'),
      roc: tr('The ROC curve of a model with d′ = 2; the dot is t = 0.50.'),
      pr: tr('The PR curve of the same model; the dashed line is the base rate 0.30.'),
      reliability: tr('A timid model: the observed share of positives (bars) is far above its scores (the diagonal).')
    }[k];
    const fig = el('figure', 'glFig');
    fig.appendChild(c);
    fig.appendChild(el('figcaption', 'fine', cap));
    return fig;
  }

  // ---------- the grid ----------
  function renderGrid() {
    const q = $('glSearch').value.trim().toLowerCase();
    const grid = $('glGrid');
    grid.textContent = '';
    let n = 0;
    for (const g of GLOSSARY) {
      const hay = [g.id, g.name, g.line, g.formula, tr(g.name), tr(g.line)].join(' ').toLowerCase();
      if (q && !hay.includes(q)) continue;
      n++;
      const b = el('button', 'btn glItem' + (g.id === 'G-which' ? ' which' : ''));
      b.appendChild(el('span', 'glName', tr(g.name)));
      b.appendChild(el('span', 'glLine', tr(g.line).replace(/\*\*/g, '')));
      b.addEventListener('click', () => openCard(g.id, true));
      grid.appendChild(b);
    }
    if (!n) grid.appendChild(el('p', 'fine', tr('No card matches "{q}".', { q })));
  }

  // ---------- one card ----------
  function section(box, title, html) {
    if (!html) return;
    const s = el('div', 'glSec');
    s.appendChild(el('h3', '', title));
    const p = el('p');
    p.innerHTML = html;
    s.appendChild(p);
    box.appendChild(s);
  }

  function openCard(id, picked) {
    const g = byId[id];
    if (!g) return;
    fromGrid = !!picked;
    const box = $('glCard');
    box.textContent = '';
    box.appendChild(el('h2', 'glTitle', tr(g.name)));
    if (g.formula) {
      const f = el('div', 'glFormula');
      f.innerHTML = formulaHtml(tr(g.formula));
      box.appendChild(f);
    }
    const body = el('div', 'glBody');
    const text = el('div', 'glText');
    section(text, tr('In one line'), marked(tr(g.line)));
    if (g.id === 'G-which') text.appendChild(whichFlow());
    section(text, tr('How to remember it'), g.remember ? marked(tr(g.remember)) : '');
    section(text, tr('Watch out'), g.watch ? marked(tr(g.watch)) : '');
    section(text, tr('Example'), g.example ? marked(tr(g.example)) : '');
    body.appendChild(text);
    const pic = picture(g);
    if (pic) body.appendChild(pic);
    box.appendChild(body);
    if (g.links.length) {
      const links = el('div', 'glLinks');
      links.appendChild(el('span', 'label', tr('See also')));
      for (const l of g.links) {
        const b = el('button', 'btn toggle', tr(byId[l].name));
        b.addEventListener('click', () => openCard(l, fromGrid));
        links.appendChild(b);
      }
      box.appendChild(links);
    }
    $('glGrid').hidden = true;
    $('glSearch').hidden = true;
    box.hidden = false;
    $('glossaryPanel').scrollTop = 0;
    document.getElementById('overlay').scrollTop = 0;
  }

  function whichFlow() {
    const list = el('div', 'whichFlow');
    for (const w of WHICH_METRIC) {
      const row = el('div', 'whichRow');
      row.appendChild(el('span', 'whichQ', tr(w.q)));
      row.appendChild(el('span', 'whichArrow', '→'));
      const a = el('span', 'whichA');
      a.appendChild(el('b', '', tr(w.a)));
      for (const c of w.cards) {
        const b = el('button', 'btn toggle', tr(byId[c].name));
        b.addEventListener('click', () => openCard(c, fromGrid));
        a.appendChild(b);
      }
      row.appendChild(a);
      list.appendChild(row);
    }
    return list;
  }

  function showGrid() {
    $('glCard').hidden = true;
    $('glGrid').hidden = false;
    $('glSearch').hidden = false;
    renderGrid();
  }

  // Opens the cheat sheet: the grid, or one card (opts.card). onBack: what Back does when there is nowhere
  // inside the cheat sheet to go back to.
  function show(opts, onBack) {
    back = onBack;
    $('glSearch').placeholder = tr('Search the cards');
    $('glSearch').setAttribute('aria-label', tr('Search the cards'));
    Screens.show('glossary');
    if (opts && opts.card) { showGrid(); openCard(opts.card, false); } else showGrid();
  }

  // Back: from a card picked in the grid to the grid, otherwise out
  function goBack() {
    if (!$('glCard').hidden && fromGrid) { showGrid(); return; }
    back();
  }

  $('glSearch').addEventListener('input', renderGrid);
  $('glBackBtn').addEventListener('click', goBack);

  // the card of a metric bar of the live panel
  function cardOfMetric(metric) {
    const g = GLOSSARY.find((x) => x.metric === metric);
    return g ? g.id : null;
  }

  return { show, goBack, openCard, cardOfMetric, marked };
})();
