'use strict';

// ============================================================
// AI Precision Recall Lab — the game's language (spec 04 §8), from ivan's city-builder/core/i18n.js: English,
// Russian or Swedish. The English text stays in the code and is the key; tr() looks it up in the language
// tables (data/lang-ru.js → TEXT_RU, data/lang-sv.js → TEXT_SV) and fills in {name} params. A text with no
// translation is shown in English. The static texts of index.html are [data-i18n] elements whose English
// inner HTML is the key (applyDom). The choice is remembered as prLab.lang; on a first visit the browser's
// language, then English. The switcher is a pill of EN · RU · SV buttons with flags in every .langPick element
// (the start screen, the results, the end card); a change applies at once, without a reload: the screens
// that build their text in JS listen with I18N.onChange.
// Used by every screen, the HUD and the messages; tools/i18n-check.js checks the tables.
// ============================================================

const LANGS = { en: 'English', ru: 'Русский', sv: 'Svenska' };
const LANG_FLAGS = { en: 'gb', ru: 'ru', sv: 'se' };

const I18N = {
  lang: 'en',
  listeners: [],
  tables() {
    return {
      ru: typeof TEXT_RU !== 'undefined' ? TEXT_RU : null,
      sv: typeof TEXT_SV !== 'undefined' ? TEXT_SV : null
    };
  },
  // the remembered language, else the browser's, else English
  load() {
    let l = Store.get('lang', null);
    if (!LANGS[l]) {
      const b = (typeof navigator !== 'undefined' && (navigator.language || '')).slice(0, 2).toLowerCase();
      l = LANGS[b] ? b : 'en';
    }
    this.set(l, false);
  },
  set(lang, remember) {
    const changed = this.lang !== lang;
    this.lang = LANGS[lang] ? lang : 'en';
    if (remember) Store.set('lang', this.lang);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.lang;
      this.applyDom();
    }
    if (changed) for (const fn of this.listeners) fn(this.lang);
  },
  onChange(fn) { this.listeners.push(fn); },
  // the static text in index.html: every [data-i18n] element keeps its English inner HTML as the key
  applyDom() {
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      if (n.dataset.i18nKey === undefined) n.dataset.i18nKey = n.innerHTML.trim();
      n.innerHTML = tr(n.dataset.i18nKey);
    });
    document.querySelectorAll('.langPick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === this.lang)));
  },
  // fills every .langPick in the page with the EN · RU · SV buttons (each language's own name as its tooltip)
  buildPickers() {
    document.querySelectorAll('.langPick').forEach((box) => {
      box.innerHTML = Object.keys(LANGS).map((l) =>
        '<button type="button" data-lang="' + l + '" aria-pressed="' + (this.lang === l) + '" title="' + LANGS[l] + '" lang="' + l + '">' +
        '<img src="art/flag-' + LANG_FLAGS[l] + '.svg?v=1" alt="">' + l.toUpperCase() + '</button>').join('');
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-lang]');
        if (b) this.set(b.dataset.lang, true);
      });
    });
  }
};

// the text in the current language, with {name} filled in from params
function tr(s, params) {
  if (s === null || s === undefined) return '';
  let out = String(s);
  if (I18N.lang !== 'en') {
    const t = I18N.tables()[I18N.lang];
    if (t && Object.prototype.hasOwnProperty.call(t, out)) out = t[out];
  }
  if (params) out = out.replace(/\{(\w+)\}/g, (all, k) => (params[k] !== undefined ? params[k] : all));
  return out;
}
