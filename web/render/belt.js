'use strict';

// ============================================================
// AI Precision Recall Lab — the belt half of the play canvas (spec 01 §1.1–1.3, 04 §4.1, §4.3): the score
// axis, the scrolling belt with the "flagged" tint above the line, the items at the height of their score
// with their badges (hidden class, or a faint hint of it), the gate whose lamp flashes the outcome, the reveal
// (the item flips to its true class) and the flight onto its square in the pile, the outcome tag over the
// gate (👥 for the review desk's decisions), the threshold line across belt and pile with its handle, the
// review band with its handle at the left edge and the ring on items sent to people, and the cost-optimal ghost line.
// A top-k run (02 §7): each query's column has its own short cut line between the k-th and the next document,
// joined by a faint dashed line, so the line visibly jumps from query to query; the handle reads "k = 5" and no
// line crosses the pile; documents carry no badges (thirty of them would hide the column) and only the relevant
// ones get a tag at the gate. On Easy a crafted item of the fraud ring (02 §6.3) shows a ✦ after its reveal.
// prefers-reduced-motion: no bobbing, no flip, no arc (the pile fades the item in). Reads State.
// Used by render/render.js; LAND_S is read by render/pile.js.
// ============================================================

const Belt = (() => {
  const P = PALETTE;
  const FLIP_S = 0.22;          // the reveal at the gate
  const FLY_S = 0.45;           // the arc from the gate to the pile
  const LAND_S = FLIP_S + FLY_S;
  const TAG_S = 1.0;            // the outcome tag over the gate
  const STRIPE = 22;            // px, the belt's stripes
  const FONT = 'Segoe UI, Arial, sans-serif';

  const valueOf = (run, it) => it[run.key];
  const look = (it) => (it.y ? 'pos' : 'neg');

  function drawBackground(ctx, G, run) {
    ctx.fillStyle = P.bgPlay;
    ctx.fillRect(0, 0, G.W, G.H);
    const y0 = G.top - 12, y1 = G.bottom + 8;
    // the belt: stripes that scroll with the run's clock (they stop when the belt stands still)
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.beltX0, y0, G.gateX - G.beltX0, y1 - y0);
    ctx.clip();
    ctx.fillStyle = P.beltA;
    ctx.fillRect(G.beltX0, y0, G.gateX - G.beltX0, y1 - y0);
    const off = ((run.clock / run.travelS) * (G.gateX - G.beltX0)) % (STRIPE * 2);
    ctx.fillStyle = P.beltB;
    for (let x = G.beltX0 - STRIPE * 2 + off; x < G.gateX; x += STRIPE * 2) ctx.fillRect(x, y0, STRIPE, y1 - y0);
    ctx.restore();
    // the pile's ground
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(G.pileX0, y0, G.pileX1 - G.pileX0, y1 - y0);
    // above the line everything is flagged: a faint warm stripe over belt and pile (not in top-k: no one line)
    const yt = Render.yOf(State.threshold);
    if (yt > y0 && !run.topk) {
      ctx.fillStyle = P.flagTint;
      ctx.fillRect(G.beltX0, y0, G.pileX1 - G.beltX0, Math.min(yt, y1) - y0);
    }
    // the score axis: ticks 0, 0.25, 0.5, 0.75, 1 and faint grid lines
    const small = G.W < 600;
    ctx.font = (small ? 10 : 11) + 'px ' + FONT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const y = Math.round(Render.yOf(v)) + 0.5;
      ctx.strokeStyle = P.grid;
      ctx.beginPath(); ctx.moveTo(G.beltX0, y); ctx.lineTo(G.pileX1, y); ctx.stroke();
      ctx.strokeStyle = P.muted;
      ctx.beginPath(); ctx.moveTo(G.axisX - 3, y); ctx.lineTo(G.axisX + 2, y); ctx.stroke();
      ctx.fillStyle = P.muted;
      ctx.fillText(v === 0 || v === 1 ? String(v) : String(v).replace(/^0/, ''), G.axisX - 5, y);
    }
    ctx.strokeStyle = P.muted;
    ctx.beginPath(); ctx.moveTo(G.axisX + 0.5, G.top); ctx.lineTo(G.axisX + 0.5, G.bottom); ctx.stroke();
    // the axis' name: what the height means
    ctx.textAlign = 'left';
    ctx.font = '600 ' + (small ? 10 : 11) + 'px ' + FONT;
    ctx.fillText(run.key === 'p' ? tr('calibrated p') : tr('model score'), G.beltX0 + 4, Math.max(8, G.top - 14));
  }

  // the gate: a scanner arch; its lamp flashes the colour of the last outcome
  function drawGate(ctx, G, last, time) {
    const x = G.gateX - G.gateW / 2, y0 = G.top - 14, h = G.bottom + 10 - y0;
    ItemArt.rr(ctx, x, y0, G.gateW, h, G.gateW / 2);
    ctx.fillStyle = '#2b4a66';
    ctx.fill();
    if (last && time - last.at < 0.45) {
      ctx.globalAlpha = 0.6 * (1 - (time - last.at) / 0.45);
      ctx.fillStyle = OUTCOME_STYLE[last.outcome].color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#45698a';
    ctx.stroke();
  }

  function badgeFont(G) { return Math.round(clamp(G.itemSize * 0.42, 9, 12)); }

  function drawItems(ctx, G, run, time) {
    const k = run.knobs || {};
    const tint = k.showClass || run.tint;
    const bob = !Render.reducedMotion();
    const fs = badgeFont(G);
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.beltX0, 0, G.gateX - G.beltX0, G.H);
    ctx.clip();
    const size = Render.sizeOf();
    for (const it of State.belt) {
      const x = Render.xOf(it);
      const v = valueOf(run, it);
      const y = Render.yOf(v) + (bob ? Math.sin(time * 3 + it.i * 1.7) * 1.2 : 0);
      ItemArt.draw(ctx, run.scenario.id, x, y, size, 'hidden', { tint: tint ? look(it) : null, item: it });
      if (!run.topk) ItemArt.badge(ctx, v.toFixed(2), x, y - G.itemSize * 0.62 - fs * 0.4, fs, null);
      if (it.sent) {   // sent to the review desk: a violet ring until people decide it at the gate
        ctx.beginPath();
        ctx.arc(x, y, G.itemSize * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = P.review;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // the reveal at the gate and the flight onto the pile (the newest items are at the end of the pile)
  // a crafted item of the fraud ring gives itself away on Easy, after its reveal (02 §6.3)
  function marked(run, it) { return !!it.crafted && run.kind === 'contract' && DIFFICULTIES[run.difficulty].tint; }

  function drawFlights(ctx, G, run) {
    if (Render.reducedMotion()) return;
    const pile = State.pile, fs = badgeFont(G), size0 = Render.sizeOf();
    for (let i = pile.length - 1; i >= 0; i--) {
      const it = pile[i];
      const since = Render.sinceGate(it);
      if (since === null || since >= LAND_S) break;
      const v = valueOf(run, it);
      const y0 = Render.yOf(v);
      if (since < FLIP_S) {
        const f = since / FLIP_S;
        const revealed = f >= 0.5;
        ItemArt.draw(ctx, run.scenario.id, G.gateX, y0, size0, revealed ? look(it) : 'hidden',
          { scaleX: Math.abs(Math.cos(Math.PI * f)), item: it });
        if (!run.topk) {
          ItemArt.badge(ctx, v.toFixed(2), G.gateX, y0 - G.itemSize * 0.62 - fs * 0.4, fs,
            revealed ? OUTCOME_STYLE[it.outcome].color : null);
        }
        if (revealed && marked(run, it)) Icons.draw(ctx, '✦', G.gateX + G.itemSize * 0.55, y0 - G.itemSize * 0.4, Math.round(G.itemSize * 0.5), P.warn);
        continue;
      }
      const sl = Pile.slotOf(it);
      if (!sl) continue;
      const u = (since - FLIP_S) / FLY_S, e = u * u * (3 - 2 * u);
      const c = Pile.cellSize();
      const x = lerp(G.gateX, sl.x + c / 2, e);
      const y = lerp(y0, sl.y + c / 2, e) - Math.sin(Math.PI * u) * Math.min(24, G.itemSize);
      const size = lerp(size0, Math.max(c * 1.4, 4), e);
      ItemArt.draw(ctx, run.scenario.id, x, y, size, look(it), { item: it, alpha: 1 - 0.3 * e });
    }
  }

  // the outcome tag over the gate: "TP ✓", "FP ✗"… in the outcome's colour, rising and fading
  function drawTags(ctx, G, run, time) {
    const pile = State.pile;
    const fs = G.W < 600 ? 11 : 13;
    ctx.font = '800 ' + fs + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = pile.length - 1; i >= 0; i--) {
      const it = pile[i];
      const since = Render.sinceGate(it);
      if (since === null || since >= TAG_S) break;
      if (run.topk && !it.y) continue;   // a query decides thirty documents at once: only the relevant ones get a tag
      const st = OUTCOME_STYLE[it.outcome];
      const y = Render.yOf(valueOf(run, it)) - G.itemSize * 1.25 - since * 18;
      ctx.globalAlpha = since < 0.15 ? since / 0.15 : 1 - Math.max(0, since - 0.5) / (TAG_S - 0.5);
      // people's decisions (the review desk) carry 👥 and the desk's violet
      const color = it.reviewed ? P.review : st.color;
      ctx.fillStyle = color;
      Icons.drawText(ctx, (it.reviewed ? '👥 ' : '') + it.outcome + ' ' + (st.right ? '✓' : '✗') + (marked(run, it) ? ' ✦' : ''), G.gateX, Math.max(fs, y), color,
        (s, x) => ctx.fillText(s, x, Math.max(fs, y)));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // The review band [low, t) (01 §5): a violet stripe under the threshold across belt and pile, its lower edge
  // dashed, and its handle in the column at the left edge with the edge's value. Items in it go to people.
  function drawBand(ctx, G, run) {
    const d = State.review;
    if (!d || !G.bandW) return;
    const t = State.threshold, low = Review.lowOf(d, t);
    const yt = Render.yOf(t), yl = Math.round(Render.yOf(low)) + 0.5;
    const small = G.W < 600;
    ctx.fillStyle = 'rgba(14, 28, 42, 0.9)';
    ctx.fillRect(0, 0, G.bandW, G.H);
    if (yl > yt + 0.5) {
      ctx.fillStyle = 'rgba(179, 157, 219, 0.16)';
      ctx.fillRect(G.beltX0, yt, G.pileX1 - G.beltX0, yl - yt);
    }
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = P.review;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(G.bandW, yl); ctx.lineTo(G.pileX1, yl); ctx.stroke();
    ctx.restore();
    // the handle: a violet pill with the lower edge's value, pointing right at the band
    const hh = small ? 30 : 32, hx = 3, hw = G.bandW - 10;
    const hy = clamp(yl - hh / 2, 1, G.H - hh - 1);
    ctx.beginPath();
    ctx.moveTo(hx + hw + 7, yl);
    ctx.lineTo(hx + hw - 2, clamp(yl - 7, hy, hy + hh));
    ctx.lineTo(hx + hw - 2, clamp(yl + 7, hy, hy + hh));
    ctx.closePath();
    ctx.fillStyle = P.review;
    ctx.fill();
    ItemArt.rr(ctx, hx, hy, hw, hh, 9);
    ctx.fill();
    ctx.fillStyle = '#1b2733';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + (small ? 9 : 10) + 'px ' + FONT;
    ctx.fillText(tr('review'), hx + hw / 2, hy + hh * 0.3);
    ctx.font = '800 ' + (small ? 12 : 13) + 'px ' + FONT;
    ctx.fillText(low.toFixed(2), hx + hw / 2, hy + hh * 0.68);
    ctx.textAlign = 'left';
  }

  // Top-k (02 §7): the cut of each query on the belt, between its k-th and (k+1)-th document, as a short
  // accent line across its column; the cuts are joined by a faint dashed line that jumps from query to query
  function drawCuts(ctx, G, run) {
    const cols = new Map();
    for (const it of State.belt) {
      let c = cols.get(it.q);
      if (!c) { c = { docs: [], x: G.beltX0 + clamp(Stream.progress(it), 0, 1) * (G.gateX - G.beltX0) }; cols.set(it.q, c); }
      c.docs.push(it);
    }
    const half = G.itemSize * (TOPK_SPREAD + 0.5);
    const pts = [];
    for (const c of cols.values()) pts.push({ x: c.x, y: Math.round(Render.yOf(Topk.cutOf(c.docs, State.k, run.key))) + 0.5 });
    pts.sort((a, b) => a.x - b.x);
    ctx.save();
    ctx.beginPath();
    ctx.rect(G.beltX0, 0, G.gateX - G.beltX0, G.H);
    ctx.clip();
    if (pts.length > 1) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(255, 179, 0, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      pts.forEach((p, i) => { if (i) ctx.lineTo(p.x - half, p.y); else ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x + half, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of pts) {
      ctx.strokeStyle = P.accentGlow;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x + half, p.y); ctx.stroke();
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x + half, p.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawThreshold(ctx, G, run) {
    const t = Render.lineValue();
    const y = Math.round(Render.yOf(t)) + 0.5;
    const small = G.W < 600;
    // the cost-optimal ghost line (02 §5.1): dashed, with its value
    if (run.ghostT !== undefined && run.ghostT !== null) {
      const yg = Math.round(Render.yOf(run.ghostT)) + 0.5;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(G.beltX0, yg); ctx.lineTo(G.pileX1, yg); ctx.stroke();
      ctx.restore();
      ctx.font = '600 ' + (small ? 10 : 11) + 'px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255, 213, 79, 0.9)';
      ctx.fillText(tr('best for the prices {v}', { v: run.ghostT.toFixed(2) }), G.beltX0 + 4, yg - 2);
    }
    // the line, with a soft glow (top-k: the cuts are per query, drawCuts; only the handle here)
    if (!run.topk) {
      ctx.strokeStyle = P.accentGlow;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(G.beltX0, y); ctx.lineTo(G.handleX, y); ctx.stroke();
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(G.beltX0, y); ctx.lineTo(G.handleX, y); ctx.stroke();
    }
    // the handle at the right edge, with its value
    const hh = small ? 30 : 32, hx = G.handleX + 2, hw = G.W - hx - 3;
    const hy = clamp(y - hh / 2, 1, G.H - hh - 1);
    ctx.beginPath();
    ctx.moveTo(hx - 7, y);
    ctx.lineTo(hx + 2, clamp(y - 7, hy, hy + hh));
    ctx.lineTo(hx + 2, clamp(y + 7, hy, hy + hh));
    ctx.closePath();
    ctx.fillStyle = P.accent;
    ctx.fill();
    ItemArt.rr(ctx, hx, hy, hw, hh, 9);
    ctx.fill();
    ctx.fillStyle = '#1b2733';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + (small ? 9 : 10) + 'px ' + FONT;
    ctx.fillText(run.topk ? 'k =' : run.key === 'p' ? 'p ≥' : 't =', hx + hw / 2, hy + hh * 0.3);
    ctx.font = '800 ' + (small ? 13 : 14) + 'px ' + FONT;
    ctx.fillText(run.topk ? String(State.k) : t.toFixed(2), hx + hw / 2, hy + hh * 0.68);
  }

  return { LAND_S, drawBackground, drawGate, drawItems, drawFlights, drawTags, drawBand, drawCuts, drawThreshold };
})();
