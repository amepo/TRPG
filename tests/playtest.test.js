import test from 'node:test';
import assert from 'node:assert/strict';

import { playtest } from '../tools/playtest.js';
import { BUILT_IN } from '../js/scenarios/index.js';
import { useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';

/* プレイテストの計測そのものを回帰テストにする。
   「選択肢が尽きて進めなくなる」は明確なバグなので、ここで止める。
   回数は CI 用に控えめ。手元で詳しく見るときは npm run playtest。 */

test.afterEach(() => useWorld(DEFAULT_WORLD));

for (const scenario of BUILT_IN) {
  test(`${scenario.title}: 選択肢が尽きて詰む経路がない`, () => {
    const report = playtest(scenario, { runs: 25 });
    for (const bot of Object.values(report.bots)) {
      const where = Object.entries(bot.stallNodes).map(([n, c]) => `${n}×${c}`).join('、');
      assert.equal(bot.stallRate, 0, `${bot.name}ボットが詰んだ: ${where}`);
    }
  });
}

test('計測が必要な項目をすべて返している', () => {
  const report = playtest(BUILT_IN[0], { runs: 10 });
  for (const bot of Object.values(report.bots)) {
    assert.ok(bot.turns.mean > 0, '手数');
    assert.ok(bot.coverage > 0 && bot.coverage <= 1, '場面到達率');
    assert.ok(Object.keys(bot.endings).length >= 1, '結末の分布');
    assert.equal(typeof bot.stallRate, 'number');
    assert.equal(typeof bot.loopRate, 'number');
  }
  assert.ok(Array.isArray(report.problems));
});
