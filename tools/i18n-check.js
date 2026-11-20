#!/usr/bin/env node
'use strict';

// Copied from the ivan repo; here: node tools/i18n-check.js web (the game is in web/).
// Checks a translated game's texts: every literal tr('English text') in its JS must have an entry
// in each of its language tables (data/lang-<xx>.js, a `const TEXT_<XX> = { ... }`), and the tables
// must have the same keys; so must the [data-i18n] texts of the folder's .html files (added here: the ivan
// version reads only the JS), and so must the texts of the data/ tables, which tr() gets through a variable
// (added here too: the text fields of DATA_TEXT_FIELDS in constants.js + data/*.js, and the name tables of
// UI_NAME_TABLES in ui/). Texts built at run time are not seen.
// Usage: node tools/i18n-check.js <folder> [--dump]   — prints the missing keys, exits 1 if there are any;
// --dump prints every key with where it is used as a JSON object instead (input for a translation).

const fs = require('fs'), path = require('path'), vm = require('vm');

const root = process.argv[2], dump = process.argv.includes('--dump');
if (!root) { console.error('usage: node tools/i18n-check.js <folder> [--dump]'); process.exit(2); }
const dataDir = path.join(root, 'data');
const langFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => /^lang-\w+\.js$/.test(f)) : [];
if (!langFiles.length && !dump) { console.log('no data/lang-*.js in ' + root); process.exit(0); }

// the fields of the data/ tables that hold player-facing text (strings, or arrays of strings: quiz options)
const DATA_TABLES = ['SCENARIOS', 'ACTS', 'CONTRACTS', 'END_TITLES', 'UPGRADES', 'FAMILIES', 'GLOSSARY', 'WHICH_METRIC', 'QUIZ', 'COACH'];
const DATA_TEXT_FIELDS = new Set(['name', 'client', 'clientNote', 'positive', 'negative', 'items', 'baseRate', 'teaches',
  'message', 'lesson', 'note', 'text', 'effect', 'why', 'formula', 'line', 'remember', 'watch', 'example', 'q', 'a',
  'question', 'options', 'explain']);
// name tables declared in ui/ files whose values are passed to tr() by key
const UI_NAME_TABLES = ['METRIC_NAMES', 'DIFFICULTY_NAMES'];

// the tables
const tables = {};
for (const f of dump ? [] : langFiles) {
  const lang = f.slice(5, -3), name = 'TEXT_' + lang.toUpperCase();
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dataDir, f), 'utf8') + `;this.__t = typeof ${name} !== 'undefined' ? ${name} : null;`, ctx);
  if (!ctx.__t) { console.error(f + ': no ' + name); process.exit(2); }
  tables[lang] = ctx.__t;
}

// the literal tr('...') texts in the code (not in lib/, not in the tables themselves)
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!['lib', 'node_modules', 'tools', 'tests', 'docs', '.git'].includes(f)) walk(p); }
    else if (p.endsWith('.js') && !/^lang-\w+\.js$/.test(f)) files.push(p);
  }
})(root);
const keys = new Map();
const re = /\btr\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    if (m[1] === '`' && m[2].includes('${')) continue;
    const key = vm.runInNewContext(m[1] + m[2] + m[1]);
    if (!keys.has(key)) keys.set(key, path.relative(root, f) + ':' + src.slice(0, m.index).split('\n').length);
  }
}

// the static texts of the folder's .html files: a [data-i18n] element's inner HTML is its key (core/i18n.js)
const reDom = /<(\w+)\b[^>]*\bdata-i18n\b[^>]*>([\s\S]*?)<\/\1>/g;
for (const f of fs.readdirSync(root).filter((n) => n.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  let m;
  while ((m = reDom.exec(src))) {
    const key = m[2].trim();
    if (!keys.has(key)) keys.set(key, f + ':' + src.slice(0, m.index).split('\n').length);
  }
}

// the data/ tables: constants.js and data/*.js (not the language tables) run in one context
{
  const srcs = [path.join(root, 'constants.js')].concat(fs.readdirSync(dataDir)
    .filter((f) => f.endsWith('.js') && !/^lang-\w+\.js$/.test(f) && f !== 'icons.js').map((f) => path.join(dataDir, f)));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(srcs.map((f) => fs.readFileSync(f, 'utf8')).join('\n;\n') +
    ';this.__d = {' + DATA_TABLES.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : null`).join(', ') + '};', ctx);
  const add = (v, where) => { if (typeof v === 'string' && v.trim() && !keys.has(v)) keys.set(v, where); };
  const walk = (o, where) => {
    if (Array.isArray(o)) { o.forEach((x) => walk(x, where)); return; }
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (DATA_TEXT_FIELDS.has(k) && typeof v === 'string') add(v, where + '.' + k);
      else if (DATA_TEXT_FIELDS.has(k) && Array.isArray(v) && v.every((x) => typeof x === 'string')) v.forEach((x) => add(x, where + '.' + k));
      else if (v && typeof v === 'object') walk(v, where);
    }
  };
  for (const n of DATA_TABLES) if (ctx.__d[n]) walk(ctx.__d[n], n);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const n of UI_NAME_TABLES) {
      const m = new RegExp('const ' + n + ' = (\\{[\\s\\S]*?\\});').exec(src);
      if (m) for (const v of Object.values(vm.runInNewContext('(' + m[1] + ')'))) add(v, n);
    }
  }
}
if (dump) { console.log(JSON.stringify(Object.fromEntries(keys), null, 1)); process.exit(0); }

let missing = 0;
for (const [key, where] of keys) {
  const langs = Object.keys(tables).filter((l) => !Object.prototype.hasOwnProperty.call(tables[l], key));
  if (langs.length) { missing++; console.log(`missing in ${langs.join(', ')}: ${JSON.stringify(key)}  (${where})`); }
}
const langs = Object.keys(tables);
for (const a of langs) for (const b of langs) {
  if (a === b) continue;
  for (const key in tables[a]) if (!Object.prototype.hasOwnProperty.call(tables[b], key)) { missing++; console.log(`in ${a}, not in ${b}: ${JSON.stringify(key)}`); }
}
console.log(`${keys.size} texts in the code, ${langs.join(' + ')}: ${missing ? missing + ' missing' : 'all translated'}`);
process.exit(missing ? 1 : 0);
