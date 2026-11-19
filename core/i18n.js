'use strict';

// ============================================================
// AI Precision Recall Lab — the game's language (spec 04 §8), from ivan's world-aviation/core/i18n.js.
// The English text stays in the code and is the key; tr() looks it up in the language tables
// (data/lang-ru.js → TEXT_RU, data/lang-sv.js → TEXT_SV) and fills in {name} params. A text with no
// translation is shown in English. The static texts of index.html are [data-i18n] elements whose English
// inner HTML is the key (applyDom). Until I07 the game is English only: the tables do not exist yet and
// there is no switcher; I07 adds them, the prLab.lang setting and the first-visit guess.
// Used by every screen, the HUD and the messages; tools/i18n-check.js checks the tables.
// ============================================================

const LANGS = { en: 'English', ru: 'Русский', sv: 'Svenska' };

const I18N = {
  lang: 'en',
  tables() {
    return {
      ru: typeof TEXT_RU !== 'undefined' ? TEXT_RU : null,
      sv: typeof TEXT_SV !== 'undefined' ? TEXT_SV : null
    };
  },
  set(lang) {
    this.lang = LANGS[lang] ? lang : 'en';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.lang;
      this.applyDom();
    }
  },
  // the static text in index.html: every [data-i18n] element keeps its English inner HTML as the key
  applyDom() {
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      if (n.dataset.i18nKey === undefined) n.dataset.i18nKey = n.innerHTML.trim();
      n.innerHTML = tr(n.dataset.i18nKey);
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
