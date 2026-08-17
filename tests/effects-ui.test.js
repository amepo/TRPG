import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EFFECT_KINDS, CONDITION_KINDS, kindOf, describeEffect, describeConditionShort,
} from '../js/ui/effects.js';
import { applyEffects, testCondition } from '../js/core/scenario.js';
import { useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';
import { BUILT_IN } from '../js/scenarios/index.js';
import { EDITABLE } from '../js/ui/editor.js';

test.beforeEach(() => useWorld(DEFAULT_WORLD));

/* 工房が作る形は、エンジンがそのまま食える形でなければ意味がない。
   ここがずれると「書けたのに効かない」になる。 */
test('工房が作る効果は、そのままエンジンで動く', () => {
  const ctx = {
    flags: new Set(), vars: { count: 0 },
    party: [{ name: '試', hp: 10, maxHp: 10, gold: 100, inventory: [] }],
    items: { rope: { id: 'rope', name: '縄' } },
    log: () => {}, damage: () => {}, heal: () => {}, rest: () => {}, awardXp: () => {},
  };
  for (const kind of EFFECT_KINDS) {
    const effect = kind.make();
    // 名前を要するものは埋める。空のまま作られるのが既定なので。
    if (effect.var !== undefined) effect.var = 'count';
    if (effect.setFlag !== undefined) effect.setFlag = 'met';
    if (effect.clearFlag !== undefined) effect.clearFlag = 'met';
    if (effect.giveItem !== undefined) effect.giveItem = 'rope';
    if (effect.takeItem !== undefined) effect.takeItem = 'rope';
    assert.doesNotThrow(() => applyEffects([effect], ctx), `${kind.name} が動かない`);
    assert.equal(kindOf(effect)?.id, kind.id, `${kind.name} が自分の種類を名乗れない`);
    assert.ok(describeEffect(effect), `${kind.name} の要約が空`);
  }
});

test('工房が作る条件は、そのままエンジンで判定できる', () => {
  const ctx = {
    flags: new Set(['met']), vars: { count: 3 },
    party: [{ name: '試', hp: 10, skills: ['athletics'], inventory: [{ id: 'rope', count: 1 }] }],
  };
  for (const kind of CONDITION_KINDS) {
    const cond = kind.make();
    assert.doesNotThrow(() => testCondition(cond, ctx), `${kind.name} が判定できない`);
    assert.ok(describeConditionShort(cond), `${kind.name} の要約が空`);
  }
  // 実際に効くこと。
  assert.equal(testCondition({ flag: 'met' }, ctx), true);
  assert.equal(testCondition({ noFlag: 'met' }, ctx), false);
  assert.equal(testCondition({ var: 'count', gte: 3 }, ctx), true);
  assert.equal(testCondition({ has: 'rope' }, ctx), true);
  assert.equal(testCondition({ all: [{ flag: 'met' }, { var: 'count', lte: 1 }] }, ctx), false);
  assert.equal(testCondition({ any: [{ flag: 'nope' }, { has: 'rope' }] }, ctx), true);
});

/* 収録シナリオが使っている効果と条件は、工房でも扱えてほしい。
   扱えないものが増えたら、それは工房が置いていかれた合図。 */
test('収録シナリオの効果は、ほぼ工房で書ける', () => {
  const known = new Set(EFFECT_KINDS.map(k => k.id));
  const unsupported = new Map();
  let total = 0;

  for (const scenario of BUILT_IN) {
    for (const node of Object.values(scenario.nodes)) {
      const lists = [
        node.onEnter,
        ...(node.choices || []).flatMap(c => [
          c.effects, c.check?.success?.effects, c.check?.fail?.effects,
        ]),
        node.combat?.onVictory?.effects, node.combat?.onDefeat?.effects, node.combat?.onFlee?.effects,
      ];
      for (const effect of lists.flat().filter(Boolean)) {
        total += 1;
        if (!kindOf(effect)) {
          const key = Object.keys(effect).find(k => !['note', 'kind', 'if', 'count', 'target', 'type', 'save', 'add', 'set'].includes(k)) || '?';
          unsupported.set(key, (unsupported.get(key) || 0) + 1);
        }
      }
    }
  }

  assert.ok(total > 100, `効果が ${total} 件しか見つからない — 数え方が壊れている`);
  assert.deepEqual([...unsupported.keys()], [], `工房で書けない効果が残っている: ${[...unsupported]}`);
});

/* ---------------------------------------------------- 工房の網羅 */

/* 「自分で無限にシナリオを作れるように」が目標なら、収録シナリオにできて
   工房にできないことがあってはいけない。JSON でしか書けない書き方が
   増えた瞬間に、ここが落ちる。 */
test('収録シナリオが使っている書き方は、すべて工房で書ける', () => {
  const seen = {};
  const note = (group, obj) => {
    if (!obj) return;
    seen[group] = seen[group] || new Set();
    for (const key of Object.keys(obj)) seen[group].add(key);
  };

  for (const scenario of BUILT_IN) {
    note('scenario', scenario);
    for (const monster of Object.values(scenario.monsters || {})) note('monster', monster);
    for (const item of Object.values(scenario.items || {})) note('item', item);
    for (const node of Object.values(scenario.nodes)) {
      note('node', node);
      note('combat', node.combat);
      note('ending', node.ending);
      note('netrun', node.netrun);
      for (const layer of node.netrun?.layers || []) note('layer', layer);
      for (const choice of node.choices || []) {
        note('choice', choice);
        note('check', choice.check);
        note('outcome', choice.check?.success);
        note('outcome', choice.check?.fail);
      }
    }
  }

  for (const [group, keys] of Object.entries(seen)) {
    const editable = new Set(EDITABLE[group] || []);
    const missing = [...keys].filter(k => !editable.has(k) && !k.startsWith('_'));
    assert.deepEqual(missing, [],
      `${group}: 収録シナリオが使っているのに工房で書けない — ${missing.join('、')}`);
  }
});

/* 逆向き。工房が書けると言っているのに、エンジンが知らない書き方は無いか。 */
test('工房が書けると言っている条件は、すべてエンジンが判定できる', () => {
  const ctx = { flags: new Set(), vars: {}, party: [], visited: new Set(['a']) };
  for (const kind of CONDITION_KINDS) {
    assert.doesNotThrow(() => testCondition(kind.make(), ctx), `${kind.name} が判定できない`);
  }
  // 「あの場面を通った」は visited を見る。ここが繋がっていないと常に偽になる。
  assert.equal(testCondition({ visited: 'a' }, ctx), true);
  assert.equal(testCondition({ visited: 'b' }, ctx), false);
});
