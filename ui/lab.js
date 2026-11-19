'use strict';

// ============================================================
// AI Precision Recall Lab — the Lab screen (spec 01 §5, 03 §3, 04 §3): the balance; a model card per scenario
// family (its scenarios with the AUC of their base d' plus the Lab's bonus, 02 §2.1, and a mini ROC of the
// binormal model) and the upgrade cards (price, effect, why it works, the state: bought / needs … / not enough
// money / Buy). Pointing at an upgrade (hover or focus) previews it: the families it touches show "before →
// after" AUC and their mini ROC morphs from the old curve to the new one. Buying goes through Campaign.buy.
// Reads Campaign, UPGRADES, FAMILIES, SCENARIOS; game.js opens it from the map and the results with a Back action.
// ============================================================

const Lab = (() => {
  const $ = (id) => document.getElementById(id);
  const P = PALETTE;
  const MORPH_MS = 450;
  let back = () => {};
  let preview = null;          // the upgrade id pointed at
  const cards = {};            // family id → { canvas, rows: { scenario: el }, from, to, t0 }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const usd = (v) => '$' + Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');

  // the d' bonus of a family with these upgrades, and with one more
  const bonus = (family, extra) => Model.bonusOf(extra ? Campaign.upgrades().concat([extra]) : Campaign.upgrades(), family);
  // the scenario's AUC with a bonus (base d' of the scenario, on Medium)
  const aucOf = (sc, b) => Model.theoreticalAuc(Model.effectiveDPrime(SCENARIOS[sc].dPrime, b));

  // The binormal ROC: a cut c on the logit gives FPR = 1 − Φ(c + d'/2), TPR = 1 − Φ(c − d'/2)
  function rocPoints(d) {
    const pts = [];
    for (let c = 6; c >= -6; c -= 0.25) pts.push([1 - normCdf(c + d / 2), 1 - normCdf(c - d / 2)]);
    return pts;
  }

  function drawRoc(card, now) {
    const c = card.canvas, w = 96, h = 96, s = Math.min(window.devicePixelRatio || 1, 2.5);
    if (c.width !== Math.round(w * s)) { c.width = Math.round(w * s); c.height = Math.round(h * s); c.style.width = w + 'px'; c.style.height = h + 'px'; }
    const ctx = c.getContext('2d');
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const x0 = 6, y0 = 6, side = 84, X = (v) => x0 + v * side, Y = (v) => y0 + side - v * side;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
    ctx.restore();
    const f = clamp((now - card.t0) / MORPH_MS, 0, 1), e = f * f * (3 - 2 * f);
    const d = lerp(card.from, card.to, e);
    if (card.to !== card.base) {   // the old curve stays as a faint line while the new one is previewed
      ctx.beginPath();
      rocPoints(card.base).forEach(([fx, ty], i) => (i ? ctx.lineTo(X(fx), Y(ty)) : ctx.moveTo(X(fx), Y(ty))));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    rocPoints(d).forEach(([fx, ty], i) => (i ? ctx.lineTo(X(fx), Y(ty)) : ctx.moveTo(X(fx), Y(ty))));
    ctx.strokeStyle = card.to !== card.base ? P.accent : P.text;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (f < 1) requestAnimationFrame((t) => drawRoc(card, t));
  }

  // the family cards: each scenario's AUC, "→ new" when the pointed upgrade changes it
  function renderFamilies() {
    for (const fam of FAMILIES) {
      const card = cards[fam.id];
      const b = bonus(fam.id), nb = preview ? bonus(fam.id, preview) : b;
      for (const sc of fam.scenarios) {
        const v = card.rows[sc];
        const now = aucOf(sc, b).toFixed(2), next = aucOf(sc, nb).toFixed(2);
        v.textContent = 'AUC ' + now + (nb !== b ? ' → ' + next : '');
        v.classList.toggle('good', nb !== b);
      }
      card.bonusEl.textContent = b ? tr("Lab bonus: d' +{b}", { b: b.toFixed(2) }) : tr('No upgrades yet');
      const base = Model.effectiveDPrime(SCENARIOS[fam.scenarios[0]].dPrime, b);
      const to = Model.effectiveDPrime(SCENARIOS[fam.scenarios[0]].dPrime, nb);
      if (card.to !== to || card.base !== base) {
        card.from = card.t0 ? lerp(card.from, card.to, clamp((performance.now() - card.t0) / MORPH_MS, 0, 1)) : base;
        card.base = base;
        card.to = to;
        card.t0 = performance.now();
        requestAnimationFrame((t) => drawRoc(card, t));
      }
    }
  }

  function buildFamilies() {
    const box = $('labFamilies');
    box.textContent = '';
    for (const fam of FAMILIES) {
      const c = el('div', 'labFamily');
      const canvas = el('canvas', 'labRoc');
      c.appendChild(canvas);
      const info = el('div', 'labFamInfo');
      info.appendChild(el('h2', '', tr(fam.name)));
      const rows = {};
      for (const sc of fam.scenarios) {
        const r = el('div', 'labScen');
        r.appendChild(el('span', '', tr(SCENARIOS[sc].name)));
        rows[sc] = el('b', 'num', '');
        r.appendChild(rows[sc]);
        info.appendChild(r);
      }
      const bonusEl = el('p', 'fine', '');
      info.appendChild(bonusEl);
      c.appendChild(info);
      box.appendChild(c);
      cards[fam.id] = { canvas, rows, bonusEl, from: 0, to: null, base: null, t0: 0 };
    }
  }

  const STATE_TEXT = {
    bought: () => tr('Bought'),
    poor: () => tr('Not enough money'),
    locked: (u) => tr('Needs {name} first', { name: tr(UPGRADES.find((x) => x.id === u.needs).name) })
  };

  function buildUpgrades() {
    const box = $('labUpgrades');
    box.textContent = '';
    for (const u of UPGRADES) {
      const st = Campaign.upgradeState(u.id);
      const c = el('div', 'labUpgrade ' + st);
      const head = el('div', 'labUpHead');
      head.appendChild(el('b', '', tr(u.name)));
      head.appendChild(el('span', 'num labPrice', usd(UPGRADE_PRICES[u.id])));
      c.appendChild(head);
      c.appendChild(el('p', 'labEffect', tr(u.effect)));
      c.appendChild(el('p', 'fine labWhy', tr(u.why)));
      const b = el('button', 'btn' + (st === 'buy' ? '' : ' secondary'), st === 'buy' ? tr('Buy for {m}', { m: usd(UPGRADE_PRICES[u.id]) }) : STATE_TEXT[st](u));
      b.disabled = st !== 'buy';
      b.dataset.upgrade = u.id;
      b.addEventListener('click', () => {
        if (!Campaign.buy(u.id)) return;
        Screens.banner(tr('Bought: {name}.', { name: tr(u.name) }));
        preview = null;
        render();
        const next = $('labUpgrades').querySelector('.btn:not([disabled])') || $('labBackBtn');
        next.focus();
      });
      const point = () => { preview = Campaign.owns(u.id) ? null : u.id; renderFamilies(); };
      const leave = () => { if (preview === u.id) { preview = null; renderFamilies(); } };
      c.addEventListener('pointerenter', point);
      c.addEventListener('pointerleave', leave);
      b.addEventListener('focus', point);
      b.addEventListener('blur', leave);
      c.appendChild(b);
      box.appendChild(c);
    }
  }

  function render() {
    $('labBalance').textContent = '💰 ' + tr('Balance {m}', { m: usd(Campaign.money) });
    $('labNote').textContent = tr('Upgrades are kept for the whole campaign and work on replays too. Point at one to see what it changes.');
    buildUpgrades();
    renderFamilies();
  }

  function show(onBack) {
    back = onBack || back;
    preview = null;
    buildFamilies();
    render();
    Screens.show('lab');
  }

  $('labBackBtn').addEventListener('click', () => back());

  return { show, rocPoints };
})();
