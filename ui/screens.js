'use strict';

// ============================================================
// AI Precision Recall Lab — the overlay screens (spec 04 §3): showing and hiding the panels of #overlay,
// moving the focus between a panel's buttons with the arrow keys and pressing its default button with
// Space / Enter (from fish-frenzy's core/input.js), the short banner, and the start screen (title,
// Continue / New campaign, Sandbox, Cheat sheet, the difficulty and sound rows, the cloud save's account
// row, How to play), the pause
// dialog (01 §12), a confirmation dialog (New campaign) and a placeholder panel for what comes later.
// The map, the briefing, the results, the Lab, the cheat sheet and the end card have files of their own; their
// panels are listed here.
// Reads State, Campaign and Cloud; game.js wires the buttons to the flow.
// ============================================================

const Screens = (() => {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const panels = {
    start: $('startPanel'), pause: $('pausePanel'), placeholder: $('placeholderPanel'), confirm: $('confirmPanel'),
    map: $('mapPanel'), briefing: $('briefingPanel'), results: $('resultsPanel'), glossary: $('glossaryPanel'),
    lab: $('labPanel'), end: $('endPanel')
  };
  let shownName = null;

  function show(name) {
    shownName = name;
    overlay.hidden = false;
    for (const key in panels) panels[key].hidden = key !== name;
    overlay.scrollTop = 0;
  }
  // also drops the focus a menu left on a button, so Space during play cannot press it
  function hide() {
    shownName = null;
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
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;   // typing in the cheat sheet's search field
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
    const hasCampaign = Campaign.exists;
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
    renderAccount();
  }

  // ---------- the cloud save (core/cloud.js, 01 §15.1): Sign in with Google, or the sync's state and Sign out ----------
  const GOOGLE_G = [['#EA4335', 'M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z'],
    ['#4285F4', 'M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.5 5.8c4.4-4 6.8-10 6.8-17.3z'],
    ['#FBBC05', 'M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z'],
    ['#34A853', 'M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z']];
  // Google's "G", drawn as SVG on the sign-in button (the brand's own mark, not a font sign)
  function googleG() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gLogo');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    for (const [fill, d] of GOOGLE_G) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', fill);
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  }
  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function renderAccount() {
    const row = $('accountRow'), st = Cloud.status;
    row.hidden = st === 'unavailable';
    if (row.hidden) return;
    const keep = row.contains(document.activeElement) ? document.activeElement.dataset.cloud : null;
    row.textContent = '';
    const signIn = () => {
      const b = node('button', 'btn small cloudIn');
      b.dataset.cloud = 'in';
      b.append(googleG(), tr('Sign in with Google'));
      return b;
    };
    if (st === 'off') {
      row.append(signIn(), node('p', 'fine', tr('Keep the campaign in the cloud and play it on any device: money, upgrades, stars and bests.')));
    } else {
      const text = { syncing: tr('Syncing…'), synced: tr('Synced'), error: tr('Sync failed — it tries again later'),
        signedOut: tr('Signed out — sign in again to sync') }[st];
      row.append(node('span', 'cloudState ' + st, text));
      if (st === 'signedOut') row.append(signIn());
      else {
        const b = node('button', 'btn small secondary', tr('Sign out'));
        b.dataset.cloud = 'out';
        row.append(b);
      }
      if (Cloud.email) row.append(node('p', 'fine', Cloud.email));
    }
    // a redraw while a button of the row had the focus (keyboard) keeps it on the same button
    const again = keep && row.querySelector('[data-cloud="' + keep + '"]');
    if (again) again.focus();
  }
  $('accountRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cloud]');
    if (!b) return;
    if (b.dataset.cloud === 'in') Cloud.signIn();
    else { Cloud.signOut(); renderAccount(); }
  });

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

  // ---------- a yes / no question; No (the default) goes back to `back` ----------
  let onYes = null, onNo = null;
  function confirm(title, text, yesLabel, yes, no) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    $('confirmYes').textContent = yesLabel;
    onYes = yes; onNo = no;
    show('confirm');
  }
  $('confirmYes').addEventListener('click', () => { if (onYes) onYes(); });
  $('confirmNo').addEventListener('click', () => { if (onNo) onNo(); });

  // ---------- the placeholder for screens that come in later iterations ----------
  function showPlaceholder(title, text) {
    $('placeholderTitle').textContent = title;
    $('placeholderText').textContent = text;
    show('placeholder');
  }

  // the difficulty toggle rows (start, results): the current one pressed
  function renderDifficulty(row) {
    document.querySelectorAll(row + ' [data-difficulty]').forEach((b) => {
      const on = b.dataset.difficulty === State.difficulty;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  return {
    show, hide, visiblePanel, banner, showStart, renderStart, renderAccount, renderSound, renderDifficulty, toggleHelp, showPause,
    showPlaceholder, confirm, get shown() { return shownName; }
  };
})();
