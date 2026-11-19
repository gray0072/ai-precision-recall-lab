'use strict';

// ============================================================
// AI Precision Recall Lab — the overlay screens (spec 04 §3): showing and hiding the panels of #overlay,
// moving the focus between a panel's buttons with the arrow keys and pressing its default button with
// Space / Enter (from fish-frenzy's core/input.js), the short banner, and the start screen (title,
// Continue / New campaign, Sandbox, Cheat sheet, the difficulty and sound rows, How to play), the pause
// dialog (01 §12) and a placeholder panel for the screens that come later (map, cheat sheet).
// Reads State and Store; game.js wires the buttons to the flow.
// ============================================================

const Screens = (() => {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const panels = { start: $('startPanel'), pause: $('pausePanel'), placeholder: $('placeholderPanel') };

  function show(name) {
    overlay.hidden = false;
    for (const key in panels) panels[key].hidden = key !== name;
    overlay.scrollTop = 0;
  }
  // also drops the focus a menu left on a button, so Space during play cannot press it
  function hide() {
    overlay.hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function visiblePanel() {
    if (overlay.hidden) return null;
    return Object.values(panels).find((p) => !p.hidden) || null;
  }

  let bannerTimer = 0;
  function banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('on'), BANNER_MS);
  }

  // ---------- keyboard: arrows move the focus, Space / Enter press the focused or the default button ----------
  // With nothing focused yet, the panel's default button counts as focused (where arrows start).
  const NAV_DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  // The nearest button in the arrow's direction. Buttons in the same row (for ← →) or column (for ↑ ↓) always
  // win; otherwise being off to the side counts double.
  function navTarget(buttons, from, [dx, dy]) {
    const f = from.getBoundingClientRect();
    const fx = f.left + f.width / 2, fy = f.top + f.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of buttons) {
      if (el === from) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - fx) * dx + (by - fy) * dy;
      if (along <= 1) continue;
      const inLine = dx ? b.top < f.bottom && b.bottom > f.top : b.left < f.right && b.right > f.left;
      const score = along + 2 * Math.abs((bx - fx) * dy - (by - fy) * dx) + (inLine ? 0 : 1e6);
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }
  window.addEventListener('keydown', (e) => {
    const panel = visiblePanel();
    if (!panel || e.altKey || e.ctrlKey || e.metaKey) return;
    const buttons = Array.from(panel.querySelectorAll('.btn')).filter((b) => b.offsetParent !== null);
    const focused = buttons.includes(document.activeElement) ? document.activeElement : null;
    const fallback = panel.querySelector('.btn.default:not([hidden])') || buttons[0];
    if (NAV_DIRS[e.key]) {
      e.preventDefault();
      const from = focused || fallback;
      const next = from && (navTarget(buttons, from, NAV_DIRS[e.key]) || from);
      if (next) next.focus();
      return;
    }
    if (e.code !== 'Space' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    const btn = focused || fallback;
    if (btn) btn.click();
  });

  // ---------- the start screen ----------
  const DIFFICULTY_NOTES = {
    easy: () => tr('A slower belt, a better model, a faint hint of the true class, the best line always shown, softer goals.'),
    medium: () => tr('The contracts as the clients wrote them.'),
    hard: () => tr('A faster belt, a weaker model, stricter goals and no warning before incidents.')
  };

  function renderStart() {
    const hasCampaign = Store.get('campaign.v1', null) !== null;
    $('continueBtn').hidden = !hasCampaign;
    $('continueBtn').classList.toggle('default', hasCampaign);
    $('newCampaignBtn').classList.toggle('default', !hasCampaign);
    $('newCampaignBtn').classList.toggle('secondary', hasCampaign);
    document.querySelectorAll('#difficultyRow [data-difficulty]').forEach((b) => {
      const on = b.dataset.difficulty === State.difficulty;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('difficultyNote').textContent = DIFFICULTY_NOTES[State.difficulty]();
    renderSound('#soundRow');
  }

  function renderSound(row) {
    document.querySelectorAll(row + ' [data-sound]').forEach((b) => {
      const on = (b.dataset.sound === 'on') === GameAudio.on;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function toggleHelp() {
    const help = $('help'), open = help.hidden;
    help.hidden = !open;
    $('helpToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) help.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showStart() {
    renderStart();
    show('start');
  }

  // ---------- the pause dialog (01 §12) ----------
  // In the sandbox "Restart" clears the belt and the pile and "Quit" leads to the start screen; a contract
  // (I04) restarts the contract and quits to the map.
  function showPause() {
    const sandbox = State.run && State.run.kind === 'sandbox';
    $('restartBtn').textContent = sandbox ? tr('Clear and restart') : tr('Restart contract');
    $('quitBtn').textContent = sandbox ? tr('Quit to menu') : tr('Quit to map');
    renderSound('#pauseSoundRow');
    show('pause');
  }

  // ---------- the placeholder for screens that come in later iterations ----------
  function showPlaceholder(title, text) {
    $('placeholderTitle').textContent = title;
    $('placeholderText').textContent = text;
    show('placeholder');
  }

  return { show, hide, visiblePanel, banner, showStart, renderStart, renderSound, toggleHelp, showPause, showPlaceholder };
})();
