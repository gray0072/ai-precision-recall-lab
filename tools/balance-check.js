#!/usr/bin/env node
'use strict';

// The balance check (spec 05 §7): a headless bot plays every contract on many seeds, holding a fixed
// threshold t = 0.05, 0.10, …, 0.95, and the hindsight-best fixed threshold of each stream (02 §5.2; with a
// review desk the best fixed band too); it prints per contract and difficulty the mean money, how often the goal
// is met, how often each t earns ★★★, and how often ★★★ is reachable at all (the hindsight-best completes,
// meets the goal and reaches the ★★ target). Each contract is checked twice: with no upgrades (a player who
// never visits the Lab) and with the upgrades a normal campaign can afford by then (NORMAL below). The bot
// retrains at the drift alert (C09) and never taps items to the desk: what it reaches, a player can.
// Act 3: C10's fraud ring aims at every fixed threshold the bot holds (ADR-0006), so "holding t" is gamed;
// the hindsight-best (a fixed line and band, aimed at too) is what a player holding a band reaches. C11 is
// played at fixed k = 1 … 30 (the hindsight-best is the best k). C12 is played with one threshold for all
// three phases, and its hindsight-best is one threshold (and band) per phase.
// Checks (exit 1 when one fails):
//   - every contract is winnable at ★★★ on Easy, Medium and Hard (on ≥ REACH of the seeds), with either set;
//   - t = 0.5 does not win ★★★ on C02, C03 and C05 (on ≤ NAIVE of the seeds): the point of those contracts;
//   - C06: "flag nothing" (t = 1) meets the accuracy goal on most streams but never reaches ★★;
//   - C10: holding a threshold still without a review band never wins ★★★ (on ≤ NAIVE of the seeds, at any t);
//   - C11: a bigger k gives a higher mean R@k and a lower mean P@k (02 §7).
// Runs over sim/ in Node, never in a browser.
// Usage: node tools/balance-check.js [--contract C05] [--difficulty hard] [--seeds 60] [--quiet]

const load = require('../tests/load.js');
const L = load();
const { CONTRACTS, CONTRACT_ORDER, DIFFICULTY_ORDER, DIFFICULTIES, Contract, Model, Incidents, Topk, BELT_TRAVEL_S, TOPK_DOCS } = L;

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
const KS = []; for (let k = 1; k <= TOPK_DOCS; k++) KS.push(k);

// The upgrades a normal campaign has bought by each contract. Act 1 pays about $1 100 in fees, the quick
// questions up to $250 and the contracts' own money $200–$400, so by C06 More data I ($300) and one more
// upgrade are affordable; the d' bonus is what changes the balance (calibration ranks the same items).
const NORMAL = {
  C06: ['U-data-1'], C07: ['U-data-1', 'U-calib'], C08: ['U-data-1', 'U-calib'], C09: ['U-data-1', 'U-calib', 'U-drift'],
  // Act 2 pays about $1 400 in fees more: the review desk I and then More data II
  C10: ['U-data-1', 'U-calib', 'U-drift'], C11: ['U-data-1', 'U-calib', 'U-drift', 'U-review-1'],
  C12: ['U-data-1', 'U-calib', 'U-drift', 'U-review-1', 'U-data-2']
};

const pct = (x) => (Math.round(x * 100) + '%').padStart(4);
const f2 = (v) => (v >= 0.995 ? '1.00' : v.toFixed(2).slice(1));
const usd = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v));
const problems = [];

for (const id of CONTRACT_ORDER) {
  const def = CONTRACTS[id];
  if (only && only !== id) continue;
  const sets = NORMAL[id] ? [[], NORMAL[id]] : [[]];
  const grid = def.topk ? KS : TS;
  for (const owned of sets) {
    const bonus = Contract.bonusesOf(def, owned);
    console.log(`\n${id} ${def.name} (${def.scenario}, π ${def.prevalence}, d′ ${def.dPrime}${[].concat(bonus).some(Boolean) ? ' + ' + [].concat(bonus).join('/') : ''}, ${def.items} items, ` +
      `goal ${def.goal ? def.goal.metric + ' ≥ ' + def.goal.min : '—'}, fee $${def.fee}, ★★ target ${typeof def.target === 'number' ? '$' + def.target : JSON.stringify(def.target)}; ` +
      `upgrades: ${owned.length ? owned.join(', ') : 'none'}${def.lend ? '; lent: ' + JSON.stringify(def.lend) : ''})`);
    for (const diff of DIFFICULTY_ORDER) {
      if (onlyDiff && onlyDiff !== diff) continue;
      const level = def.topk ? 0 : Contract.deskLevel(def, diff, Model.deskLevelOf(owned));
      const desk = level ? { level, travelS: BELT_TRAVEL_S / DIFFICULTIES[diff].speed } : null;
      const perT = grid.map(() => ({ money: 0, goal: 0, done: 0, s3: 0, p: 0, r: 0 }));
      let reach = 0, bestMoney = 0, bestT = 0, bestBand = 0, feasible = 0, noneGoal = 0, noneS2 = 0;
      const bests = [], delays = [];
      const drift = (def.incidents || []).find((inc) => inc.kind === 'drift');
      const retrains = drift && ((def.lend && def.lend.monitor) || Model.hasKind(owned, 'monitor'));
      for (let s = 0; s < SEEDS; s++) {
        const seed = 1000 + s * 7919;
        let items;
        if (retrains) {   // the bot presses Retrain the moment the drift alert fires
          const rt = Incidents.retrainedAtAlert(def, diff, seed, bonus);
          items = rt.items;
          delays.push(rt.alertAt === null ? Infinity : rt.alertAt - drift.at);
        } else items = Contract.streamOf(def, diff, seed, bonus);
        const best = def.topk ? Topk.hindsightBest(items, def, diff)
          : def.phases ? Contract.hindsightPhases(items, def, diff, 's', desk) : Contract.hindsightBest(items, def, diff, 's', desk);
        // the runs at the fixed grid: by k (top-k), one t for all phases, or the hindsight's own runs at each t
        const runAt = (g) => (def.topk ? best.runs[g] : def.phases ? Contract.playPhases(items, def, g, diff) : best.runs[Math.round(g * 100)]);
        const b = { feasible: best.feasible, money: best.money };
        bests.push(best.feasible ? best.money : -Infinity);
        if (best.feasible) {
          feasible++;
          bestMoney += best.money;
          bestT += def.topk ? best.k : def.phases ? best.t.reduce((a, b) => a + b, 0) / best.t.length : best.t;
          bestBand += def.phases ? best.t.reduce((a, t, p) => a + (best.low[p] === null ? 0 : t - best.low[p]), 0) / best.t.length
            : best.low === null || best.low === undefined ? 0 : best.t - best.low;
          if (Contract.stars(best.result, Contract.targetOf(def, diff), b) === 3) reach++;
        }
        grid.forEach((g, i) => {
          const r = runAt(g);
          const q = perT[i];
          q.money += r.money; q.goal += r.goalMet ? 1 : 0; q.done += r.completed ? 1 : 0;
          if (def.topk) { q.p += r.pAtK || 0; q.r += r.rAtK || 0; }
          if (Contract.stars(r, Contract.targetOf(def, diff), b) === 3) q.s3++;
        });
        if (id === 'C06') {
          const none = best.runs[100];
          if (none.completed && none.goalMet) noneGoal++;
          if (Contract.stars(none, Contract.targetOf(def, diff), b) >= 2) noneS2++;
        }
      }
      const half = def.topk ? perT[4] : perT[TS.indexOf(0.5)];
      const q10 = (list) => { const s = list.slice().sort((a, b) => a - b); return s[Math.floor(0.1 * (s.length - 1))]; };
      const med = (list) => { const s = list.slice().sort((a, b) => a - b); return s[Math.floor(0.5 * (s.length - 1))]; };
      console.log(`  ${diff.padEnd(6)} ★★★ reachable ${pct(reach / SEEDS)}   hindsight-best: mean ${def.topk ? 'k' : 't'} ${feasible ? (bestT / feasible).toFixed(def.topk ? 1 : 2) : '—'}` +
        `, 10th pct ${isFinite(q10(bests)) ? usd(q10(bests)) : '—'}` +
        (retrains ? `, drift alert ${med(delays)} items after the drift (median), retrained at it` : '') +
        (desk ? `, band ${(bestBand / Math.max(1, feasible)).toFixed(2)} (desk ${'I'.repeat(level)})` : '') +
        `, mean ${feasible ? usd(bestMoney / feasible) : '—'}   ${def.topk ? 'k = 5' : 't = 0.50'}: ${usd(half.money / SEEDS)}, ★★★ ${pct(half.s3 / SEEDS)}` +
        (id === 'C06' ? `   flag nothing: goal ${pct(noneGoal / SEEDS)}, ★★ ${pct(noneS2 / SEEDS)}` : ''));
      if (!quiet) {
        console.log('         ' + (def.topk ? 'k    ' : 't    ') + '  ' + grid.map((g) => (def.topk ? String(g) : g.toFixed(2).slice(1)).padStart(5)).join(''));
        console.log('         money  ' + perT.map((q) => usd(q.money / SEEDS).padStart(5)).join(''));
        console.log('         done   ' + perT.map((q) => pct(q.done / SEEDS).padStart(5)).join(''));
        console.log('         goal   ' + perT.map((q) => pct(q.goal / SEEDS).padStart(5)).join(''));
        console.log('         ★★★    ' + perT.map((q) => pct(q.s3 / SEEDS).padStart(5)).join(''));
        if (def.topk) {
          console.log('         P@k    ' + perT.map((q) => f2(q.p / SEEDS).padStart(5)).join(''));
          console.log('         R@k    ' + perT.map((q) => f2(q.r / SEEDS).padStart(5)).join(''));
        }
      }
      const tag = `${id} ${diff}${owned.length ? ' (normal upgrades)' : ''}`;
      if (reach / SEEDS < REACH) problems.push(`${tag}: ★★★ reachable on only ${pct(reach / SEEDS).trim()} of the seeds`);
      if (NAIVE_CONTRACTS.includes(id) && half.s3 / SEEDS > NAIVE) problems.push(`${tag}: t = 0.5 wins ★★★ on ${pct(half.s3 / SEEDS).trim()} of the seeds`);
      if (id === 'C06' && noneS2 > 0) problems.push(`${tag}: flagging nothing reaches ★★ on ${pct(noneS2 / SEEDS).trim()} of the seeds`);
      if (id === 'C06' && noneGoal / SEEDS < 0.5) problems.push(`${tag}: flagging nothing meets the accuracy goal on only ${pct(noneGoal / SEEDS).trim()} of the seeds`);
      if (id === 'C10') {
        const still = Math.max(...perT.map((q) => q.s3 / SEEDS));
        if (still > NAIVE) problems.push(`${tag}: holding a threshold still (no band) wins ★★★ on ${pct(still).trim()} of the seeds`);
      }
      if (def.topk) {
        for (let i = 1; i < perT.length; i++) {
          if (perT[i].r < perT[i - 1].r - 1e-9 || perT[i].p > perT[i - 1].p + 1e-9) { problems.push(`${tag}: mean R@k / P@k not monotone in k at k = ${grid[i]}`); break; }
        }
      }
    }
  }
}

console.log('');
if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`OK: every contract is winnable at ★★★ on every level (≥ ${REACH * 100} % of ${SEEDS} seeds, with no upgrades and with a normal campaign's); ` +
  `t = 0.5 does not win ★★★ on ${NAIVE_CONTRACTS.join(', ')}; flagging nothing meets C06's goal but never reaches ★★; ` +
  `holding still without a band never wins ★★★ on C10; on C11 a bigger k raises R@k and lowers P@k.`);
