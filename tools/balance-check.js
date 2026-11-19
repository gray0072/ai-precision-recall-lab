#!/usr/bin/env node
'use strict';

// The balance check (spec 05 §7): a headless bot plays every ready contract on many seeds, holding a fixed
// threshold t = 0.05, 0.10, …, 0.95, and the hindsight-best fixed threshold of each stream (02 §5.2); it prints
// per contract and difficulty the mean money, how often the goal is met, how often each t earns ★★★, and how
// often ★★★ is reachable at all (the hindsight-best completes, meets the goal and reaches the ★★ target).
// The upgrades a normal campaign has by each contract are listed with it (none in Act 1: the Lab opens in I05).
// Checks (exit 1 when one fails):
//   - every contract is winnable at ★★★ on Easy, Medium and Hard (on ≥ REACH of the seeds);
//   - t = 0.5 does not win ★★★ on C02, C03 and C05 (on ≤ NAIVE of the seeds): the point of those contracts.
// Runs over sim/ in Node, never in a browser.
// Usage: node tools/balance-check.js [--contract C05] [--difficulty hard] [--seeds 60] [--quiet]

const load = require('../tests/load.js');
const L = load();
const { CONTRACTS, CONTRACT_ORDER, DIFFICULTY_ORDER, Contract } = L;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args[i + 1]; };
const only = opt('--contract', null);
const onlyDiff = opt('--difficulty', null);
const SEEDS = +opt('--seeds', 60);
const quiet = args.includes('--quiet');
const REACH = 0.9;        // ★★★ must be reachable on at least this share of the seeds
const NAIVE = 0.1;        // t = 0.5 may win ★★★ on at most this share where it must not
const NAIVE_CONTRACTS = ['C02', 'C03', 'C05'];
const TS = []; for (let k = 5; k <= 95; k += 5) TS.push(k / 100);

const pct = (x) => (Math.round(x * 100) + '%').padStart(4);
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v));
const problems = [];

for (const id of CONTRACT_ORDER) {
  const def = CONTRACTS[id];
  if (def.soon || (only && only !== id)) continue;
  console.log(`\n${id} ${def.name} (${def.scenario}, π ${def.prevalence}, d′ ${def.dPrime}, ${def.items} items, ` +
    `goal ${def.goal ? def.goal.metric + ' ≥ ' + def.goal.min : '—'}, fee $${def.fee}, ★★ target $${def.target}; upgrades by then: none)`);
  for (const diff of DIFFICULTY_ORDER) {
    if (onlyDiff && onlyDiff !== diff) continue;
    const perT = TS.map(() => ({ money: 0, goal: 0, done: 0, s3: 0 }));
    let reach = 0, bestMoney = 0, bestT = 0, feasible = 0;
    for (let s = 0; s < SEEDS; s++) {
      const seed = 1000 + s * 7919;
      const items = Contract.streamOf(def, diff, seed);
      const best = Contract.hindsightBest(items, def, diff);
      const b = { feasible: best.feasible, money: best.money };
      if (best.feasible) {
        feasible++;
        bestMoney += best.money;
        bestT += best.t;
        if (Contract.stars(best.result, def.target, b) === 3) reach++;
      }
      TS.forEach((t, i) => {
        const r = best.runs[Math.round(t * 100)];
        const q = perT[i];
        q.money += r.money; q.goal += r.goalMet ? 1 : 0; q.done += r.completed ? 1 : 0;
        if (Contract.stars(r, def.target, b) === 3) q.s3++;
      });
    }
    const half = perT[TS.indexOf(0.5)];
    console.log(`  ${diff.padEnd(6)} ★★★ reachable ${pct(reach / SEEDS)}   hindsight-best: mean t ${feasible ? (bestT / feasible).toFixed(2) : '—'}, ` +
      `mean ${feasible ? usd(bestMoney / feasible) : '—'}   t = 0.50: ${usd(half.money / SEEDS)}, ★★★ ${pct(half.s3 / SEEDS)}`);
    if (!quiet) {
      console.log('         t      ' + TS.map((t) => t.toFixed(2).slice(1).padStart(5)).join(''));
      console.log('         money  ' + perT.map((q) => usd(q.money / SEEDS).padStart(5)).join(''));
      console.log('         done   ' + perT.map((q) => pct(q.done / SEEDS).padStart(5)).join(''));
      console.log('         goal   ' + perT.map((q) => pct(q.goal / SEEDS).padStart(5)).join(''));
      console.log('         ★★★    ' + perT.map((q) => pct(q.s3 / SEEDS).padStart(5)).join(''));
    }
    if (reach / SEEDS < REACH) problems.push(`${id} ${diff}: ★★★ reachable on only ${pct(reach / SEEDS).trim()} of the seeds`);
    if (NAIVE_CONTRACTS.includes(id) && half.s3 / SEEDS > NAIVE) problems.push(`${id} ${diff}: t = 0.5 wins ★★★ on ${pct(half.s3 / SEEDS).trim()} of the seeds`);
  }
}

console.log('');
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`OK: every contract is winnable at ★★★ on every level (≥ ${REACH * 100} % of ${SEEDS} seeds); t = 0.5 does not win ★★★ on ${NAIVE_CONTRACTS.join(', ')}.`);
