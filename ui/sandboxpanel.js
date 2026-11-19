'use strict';

// ============================================================
// AI Precision Recall Lab — the sandbox's knobs (spec 01 §7): a docked side panel on desktops, a drawer on
// phones. Scenario (with its drawings), base rate (a logarithmic slider), separation d' with the AUC it gives,
// calibrated scores, the true class on the belt, formula view, speed, pause the belt / step one item, the
// prices of the four outcomes (the profit curve and, with calibration, the cost-optimal ghost line),
// Generate 1 000 and Clear. Every change goes through Sandbox.set and is remembered as prLab.sandbox.v1.
// Used by game.js (build, open / close, save).
// ============================================================

const SandboxPanel = (() => {
  const $ = (id) => document.getElementById(id);
  const panel = $('sandboxPanel');
  const LOG_STEPS = 1000;   // the base rate slider's resolution
  let built = false;
  let onChange = () => {};

  // a base rate as a percentage (04 §2): "0.5 %", "4.2 %", "25 %"
  function pct(p) {
    const v = p * 100;
    const txt = v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
    return txt + ' %';
  }
  const toSlider = (p) => Math.round(Math.log(p / SANDBOX_PREVALENCE_MIN) / Math.log(SANDBOX_PREVALENCE_MAX / SANDBOX_PREVALENCE_MIN) * LOG_STEPS);
  const fromSlider = (v) => SANDBOX_PREVALENCE_MIN * Math.pow(SANDBOX_PREVALENCE_MAX / SANDBOX_PREVALENCE_MIN, v / LOG_STEPS);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function label(text) { return el('p', 'label', text); }
  function slider(id, name, min, max, step) {
    const wrap = el('label', 'sbSlider');
    const head = el('span', 'sbHead2');
    head.appendChild(el('span', '', name));
    head.appendChild(el('b', 'num', ''));
    head.lastChild.id = id + 'Val';
    const input = el('input');
    input.type = 'range'; input.id = id; input.min = min; input.max = max; input.step = step;
    wrap.appendChild(head);
    wrap.appendChild(input);
    return wrap;
  }
  function toggle(id, text) {
    const b = el('button', 'btn toggle', text);
    b.id = id;
    b.setAttribute('aria-pressed', 'false');
    return b;
  }

  function build() {
    if (built) return;
    built = true;
    const head = el('div', 'sbTop');
    head.appendChild(el('h2', '', tr('Sandbox')));
    const close = el('button', 'round', '✕');
    close.id = 'sbClose';
    close.title = tr('Close');
    head.appendChild(close);
    panel.appendChild(head);

    panel.appendChild(label(tr('Scenario')));
    const scen = el('div', 'sbScen');
    for (const id of Sandbox.SCENARIO_IDS) {
      const b = el('button', 'btn toggle sbScenBtn');
      b.dataset.scenario = id;
      const c = el('canvas');
      b.appendChild(c);
      b.appendChild(el('span', '', tr(SCENARIOS[id].name)));
      scen.appendChild(b);
    }
    panel.appendChild(scen);
    panel.appendChild(el('p', 'fine sbNote', ''));
    panel.lastChild.id = 'sbScenNote';

    panel.appendChild(slider('sbPrev', tr('Base rate (prevalence)'), 0, LOG_STEPS, 1));
    panel.appendChild(slider('sbD', tr("Separation d'"), 0, SANDBOX_DPRIME_MAX * 10, 1));

    const toggles = el('div', 'sbToggles');
    toggles.appendChild(toggle('sbCal', tr('Calibrated scores')));
    toggles.appendChild(toggle('sbShow', tr('Show true class')));
    toggles.appendChild(toggle('sbFormulas', tr('Formula view')));
    panel.appendChild(toggles);

    panel.appendChild(slider('sbSpeed', tr('Speed'), 0, SANDBOX_SPEEDS.length - 1, 1));
    const run = el('div', 'btnRow');
    run.appendChild(toggle('sbFreeze', tr('Pause belt')));
    const step = el('button', 'btn', tr('Step'));
    step.id = 'sbStep';
    step.title = tr('One item to the gate');
    run.appendChild(step);
    panel.appendChild(run);

    panel.appendChild(label(tr('Prices per item ($)')));
    const prices = el('div', 'sbPrices');
    for (const o of ['TP', 'FP', 'FN', 'TN']) {
      const l = el('label', 'sbPrice');
      l.appendChild(el('span', 'o' + o, o));
      const input = el('input', 'num');
      input.type = 'number'; input.min = -SANDBOX_PRICE_MAX; input.max = SANDBOX_PRICE_MAX; input.step = 1;
      input.dataset.price = o;
      l.appendChild(input);
      prices.appendChild(l);
    }
    panel.appendChild(prices);
    panel.appendChild(el('p', 'fine sbNote', ''));
    panel.lastChild.id = 'sbPriceNote';

    const gen = el('div', 'btnRow');
    const g = el('button', 'btn', tr('Generate 1 000'));
    g.id = 'sbGenerate';
    const clr = el('button', 'btn secondary', tr('Clear'));
    clr.id = 'sbClear';
    gen.appendChild(g);
    gen.appendChild(clr);
    panel.appendChild(gen);

    // ---------- wiring ----------
    const change = (name, value) => { Sandbox.set(name, value); onChange(name); render(); };
    scen.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => change('scenario', b.dataset.scenario)));
    $('sbPrev').addEventListener('input', (e) => change('prevalence', fromSlider(+e.target.value)));
    $('sbD').addEventListener('input', (e) => change('dPrime', +e.target.value / 10));
    $('sbSpeed').addEventListener('input', (e) => change('speed', SANDBOX_SPEEDS[+e.target.value]));
    $('sbCal').addEventListener('click', () => change('calibrated', !State.run.knobs.calibrated));
    $('sbShow').addEventListener('click', () => change('showClass', !State.run.knobs.showClass));
    $('sbFormulas').addEventListener('click', () => change('formulas', !State.run.knobs.formulas));
    $('sbFreeze').addEventListener('click', () => { State.run.frozen = !State.run.frozen; render(); });
    $('sbStep').addEventListener('click', () => { Sandbox.step(); });
    prices.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
      const p = Object.assign({}, State.run.knobs.prices, { [input.dataset.price]: +input.value });
      change('prices', p);
    }));
    $('sbGenerate').addEventListener('click', () => { Sandbox.generate(); onChange('generate'); render(); });
    $('sbClear').addEventListener('click', () => { Sandbox.clear(); onChange('clear'); render(); });
    close.addEventListener('click', () => setOpen(false));
  }

  // the scenario buttons' drawings: a negative and a positive, revealed
  function drawIcons() {
    panel.querySelectorAll('.sbScenBtn').forEach((b) => {
      const c = b.querySelector('canvas');
      const w = 44, h = 26, s = Math.min(window.devicePixelRatio || 1, 2.5);
      c.width = w * s; c.height = h * s;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ItemArt.draw(ctx, b.dataset.scenario, 12, 14, 20, 'neg', {});
      ItemArt.draw(ctx, b.dataset.scenario, 32, 14, 20, 'pos', {});
    });
  }

  function press(id, on) {
    const b = $(id);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // shows the knobs as they are
  function render() {
    if (!built || !State.run) return;
    const run = State.run, k = run.knobs, sc = SCENARIOS[k.scenario];
    panel.querySelectorAll('.sbScenBtn').forEach((b) => {
      const on = b.dataset.scenario === k.scenario;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('sbScenNote').textContent = sc.id === 'abstract'
      ? tr('Dots: orange are the positives (the hunted class), blue the negatives.')
      : tr('Positive (the hunted class): {pos}. Negative: {neg}.', { pos: tr(sc.positive), neg: tr(sc.negative) });
    $('sbPrev').value = toSlider(k.prevalence);
    $('sbPrevVal').textContent = pct(k.prevalence);
    $('sbD').value = Math.round(k.dPrime * 10);
    $('sbDVal').textContent = k.dPrime.toFixed(1) + ' · AUC ' + Model.theoreticalAuc(k.dPrime).toFixed(2);
    $('sbSpeed').value = SANDBOX_SPEEDS.indexOf(k.speed);
    $('sbSpeedVal').textContent = k.speed + '×';
    press('sbCal', k.calibrated);
    press('sbShow', k.showClass);
    press('sbFormulas', k.formulas);
    press('sbFreeze', !!run.frozen);
    panel.querySelectorAll('[data-price]').forEach((input) => {
      if (document.activeElement !== input) input.value = k.prices[input.dataset.price];
    });
    $('sbPriceNote').textContent = run.pStar === null
      ? tr('With these prices flagging never pays more than passing (or always does).')
      : k.calibrated
        ? tr('Cost-optimal: flag when p ≥ {p} (the dashed line).', { p: run.ghostT.toFixed(2) })
        : tr('Cost-optimal: flag when the probability ≥ {p}. Turn on calibrated scores to see it on the belt.', { p: run.pStar.toFixed(2) });
  }

  // on desktops the panel is docked beside the play screen; on phones it is a drawer over it
  function setOpen(open) {
    panel.hidden = !open;
    $('knobsBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('knobsBtn').classList.toggle('on', open);
    onChange('panel');
  }
  function isOpen() { return !panel.hidden; }

  function show(handler) {
    onChange = handler || onChange;
    build();
    drawIcons();
    render();
  }

  return { show, render, setOpen, isOpen, pct };
})();
