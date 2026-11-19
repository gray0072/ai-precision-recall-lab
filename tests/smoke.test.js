'use strict';

// Smoke test: the headless scripts load in the vm context in load order, and the I01 skeleton is there
// (the shared state and the difficulty table of spec 01 §10).

const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load.js');

test('the headless scripts load and give the shared state', () => {
  const g = load();
  assert.equal(typeof g.State, 'object');
  assert.equal(g.State.screen, 'start');
  assert.equal(g.State.difficulty, g.DIFFICULTY_DEFAULT);
});

test('the difficulty table has the three levels of spec 01 §10', () => {
  const { DIFFICULTIES, DIFFICULTY_ORDER, DIFFICULTY_DEFAULT } = load();
  assert.deepEqual(Array.from(DIFFICULTY_ORDER), ['easy', 'medium', 'hard']);
  assert.deepEqual(Object.keys(DIFFICULTIES).sort(), ['easy', 'hard', 'medium']);
  assert.ok(DIFFICULTIES[DIFFICULTY_DEFAULT]);
  assert.deepEqual(Array.from(DIFFICULTY_ORDER, (k) => DIFFICULTIES[k].speed), [0.75, 1, 1.3]);
  assert.deepEqual(Array.from(DIFFICULTY_ORDER, (k) => DIFFICULTIES[k].dPrime), [0.2, 0, -0.2]);
});

test('every load is a fresh context', () => {
  const a = load(), b = load();
  a.State.threshold = 0.9;
  assert.equal(b.State.threshold, 0.5);
});
