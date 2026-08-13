import test from 'node:test';
import assert from 'node:assert/strict';

import { parse, roll, range, average, isValid, DiceError, format } from '../js/core/dice.js';
import { Rng, hashSeed } from '../js/core/rng.js';

/** A stubbed generator that returns the given faces in order. */
function fixed(values) {
  let i = 0;
  return { die: () => values[i++ % values.length], float: () => 0.5 };
}

test('parse reads counts, faces and modifiers', () => {
  const { terms } = parse('2d6+3');
  assert.equal(terms.length, 2);
  assert.deepEqual({ count: terms[0].count, faces: terms[0].faces }, { count: 2, faces: 6 });
  assert.equal(terms[1].value, 3);
});

test('parse defaults a bare d20 to one die', () => {
  assert.equal(parse('d20').terms[0].count, 1);
});

test('parse rejects nonsense', () => {
  assert.throws(() => parse('banana'), DiceError);
  assert.throws(() => parse(''), DiceError);
  assert.throws(() => parse('0d6'), DiceError);
  assert.throws(() => parse('2d6kh5'), DiceError);
  assert.equal(isValid('2d6+1d4-2'), true);
});

test('roll sums dice and modifiers', () => {
  const r = roll('2d6+3', { rng: fixed([4, 5]) });
  assert.equal(r.total, 12);
  assert.match(r.text, /2d6\[4,5\]\+3 = 12/);
});

test('negative terms subtract', () => {
  const r = roll('1d8-2', { rng: fixed([6]) });
  assert.equal(r.total, 4);
});

test('keep-highest drops the rest', () => {
  const r = roll('4d6kh3', { rng: fixed([1, 6, 4, 3]) });
  assert.equal(r.total, 13);                      // 6+4+3, the 1 is dropped
  assert.deepEqual(r.detail[0].dropped, [1]);
});

test('advantage turns a d20 into 2d20 keep-highest', () => {
  const r = roll('1d20+5', { rng: fixed([3, 17]), mode: 'adv' });
  assert.equal(r.natural, 17);
  assert.equal(r.total, 22);
});

test('disadvantage keeps the lower die', () => {
  const r = roll('1d20+5', { rng: fixed([3, 17]), mode: 'dis' });
  assert.equal(r.natural, 3);
  assert.equal(r.total, 8);
});

test('advantage only applies to the first d20 term', () => {
  const r = roll('1d20+1d20', { rng: fixed([2, 9, 15]), mode: 'adv' });
  // first term rolls 2 and 9 (keeps 9), second term rolls 15
  assert.equal(r.total, 24);
});

test('exploding dice re-roll a maximum face', () => {
  const r = roll('1d6!', { rng: fixed([6, 6, 2]) });
  assert.equal(r.total, 14);
});

test('range reports the extremes', () => {
  assert.deepEqual(range('2d6+3'), { min: 5, max: 15 });
  assert.deepEqual(range('4d6kh3'), { min: 3, max: 18 });
  assert.deepEqual(range('1d8-2'), { min: -1, max: 6 });
});

test('average matches the arithmetic mean', () => {
  assert.equal(average('2d6+3'), 10);
  assert.equal(average('1d20'), 10.5);
  assert.equal(average('2d20kh1'), 13.83);        // advantage on a d20
});

test('format renders dropped dice', () => {
  const r = roll('2d20kh1', { rng: fixed([4, 18]) });
  assert.match(r.text, /落:4/);
});

test('the same seed replays the same rolls', () => {
  const a = new Rng('ヴェルナ');
  const b = new Rng('ヴェルナ');
  const first = Array.from({ length: 20 }, () => roll('1d20', { rng: a }).total);
  const second = Array.from({ length: 20 }, () => roll('1d20', { rng: b }).total);
  assert.deepEqual(first, second);
});

test('a restored Rng continues the same stream', () => {
  const rng = new Rng(1234);
  for (let i = 0; i < 7; i++) rng.die(20);
  const state = rng.save();
  const expected = Array.from({ length: 5 }, () => rng.die(20));

  const restored = Rng.restore(state);
  const actual = Array.from({ length: 5 }, () => restored.die(20));
  assert.deepEqual(actual, expected);
});

test('hashSeed is stable and differs per string', () => {
  assert.equal(hashSeed('abc'), hashSeed('abc'));
  assert.notEqual(hashSeed('abc'), hashSeed('abd'));
});

test('rolls stay inside their bounds over many samples', () => {
  const rng = new Rng(99);
  for (let i = 0; i < 2000; i++) {
    const value = roll('3d8+2', { rng }).total;
    assert.ok(value >= 5 && value <= 26, `out of range: ${value}`);
  }
});
