'use strict';

// Loads the game's plain scripts (no modules, no DOM) into one Node vm context, in the load order of
// spec 05 §3, and returns their top-level declarations (const / let / function / class) as an object:
//   const { State, DIFFICULTIES } = require('./load.js')();
// Only the headless parts are loaded: constants.js, data/, core/utils.js, core/rng.js, core/events.js,
// sim/, campaign.js. A file that does not exist yet is skipped, so later iterations only add files.
// Every call gives a fresh context (tests do not share state). Arrays and objects made inside it belong to
// another realm: copy them (Array.from, {...o}) before assert.deepStrictEqual against literals.

const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'constants.js',
  'data/scenarios.js', 'data/contracts.js', 'data/upgrades.js', 'data/glossary.js', 'data/quiz.js', 'data/coach.js',
  'core/utils.js', 'core/rng.js', 'core/events.js',
  'sim/state.js', 'sim/model.js', 'sim/stream.js', 'sim/metrics.js', 'sim/contract.js', 'sim/incidents.js',
  'sim/review.js', 'sim/topk.js', 'sim/sandbox.js', 'sim/demo.js',
  'campaign.js'
];
const DECL = /^(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;

module.exports = function load(extra) {
  const names = [];
  let code = '';
  for (const f of FILES.concat(extra || [])) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8').replace(/^'use strict';/, '');
    for (const m of src.matchAll(DECL)) names.push(m[1]);
    code += '\n// ---- ' + f + '\n' + src;
  }
  // one script, so top-level const / let of one file are visible to the next, as in the browser
  code = "'use strict';\n" + code + '\n;({ ' + [...new Set(names)].join(', ') + ' });';
  const ctx = vm.createContext({ console, Math, Date, JSON });
  return vm.runInContext(code, ctx, { filename: 'game-scripts.js' });
};
