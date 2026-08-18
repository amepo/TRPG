import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogue, thingById, slotFor, buy, sell, equip, unequip, owns, loadout, SLOTS, RESALE,
} from '../js/core/gear.js';
import { createCharacter, recalculate, attackOptions } from '../js/core/character.js';
import { readiness } from '../js/ui/sheet.js';
import { armorClass, carriedSaveAdvantage, savingThrow } from '../js/core/rules.js';
import { Rng } from '../js/core/rng.js';
import { useWorld, DEFAULT_WORLD, WORLDS } from '../js/worlds/index.js';

test.afterEach(() => useWorld(DEFAULT_WORLD));

const rich = (over = {}) => {
  const pc = createCharacter({
    name: '買い手', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier', ...over,
  });
  pc.gold = 5000;
  return pc;
};

/* ------------------------------------------------------------- 品ぞろえ */

test('売り物はどちらの世界でも揃っている', () => {
  for (const world of WORLDS) {
    useWorld(world.id);
    const stock = catalogue();
    assert.ok(stock.weapons.length >= 8, `${world.id}: 武器が少ない`);
    assert.ok(stock.armors.length >= 5, `${world.id}: 防具が少ない`);
    assert.ok(stock.items.length >= 8, `${world.id}: 道具が少ない`);
    for (const thing of [...stock.weapons, ...stock.armors, ...stock.items]) {
      assert.ok(thing.cost > 0, `${world.id}: ${thing.name} の値段が 0`);
    }
  }
});

test('品はそれぞれ入るスロットが決まっている', () => {
  useWorld(DEFAULT_WORLD);
  assert.equal(slotFor(thingById('longsword')), 'weapon');
  assert.equal(slotFor(thingById('shortbow')), 'ranged', '遠隔武器が近接の枠に入っている');
  assert.equal(slotFor(thingById('plate')), 'armor');
  assert.equal(slotFor(thingById('shield')), 'shield');
  assert.equal(slotFor(thingById('potion')), null, '道具は装備しない');
});

/* ---------------------------------------------------------------- 売買 */

test('買うと懐が減り、持ち物に入る', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const bow = thingById('shortbow');
  const before = pc.gold;
  const result = buy(pc, 'shortbow');
  assert.equal(result.ok, true);
  assert.equal(result.paid, bow.cost);
  assert.equal(pc.gold, before - bow.cost);
  assert.ok(owns(pc, 'shortbow'));
});

test('払えないものは買えない', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  pc.gold = 1;
  const result = buy(pc, 'plate');
  assert.equal(result.ok, false);
  assert.match(result.reason, /足りません/);
  assert.equal(owns(pc, 'plate'), false);
  assert.equal(pc.gold, 1, '失敗したのに金が減っている');
});

test('売ると定価の半分になり、持ち物から消える', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  buy(pc, 'longbow');
  const price = thingById('longbow').cost;
  const before = pc.gold;

  const result = sell(pc, 'longbow');
  assert.equal(result.ok, true);
  assert.equal(result.got, Math.floor(price * RESALE));
  assert.equal(pc.gold, before + Math.floor(price * RESALE));
  assert.equal(owns(pc, 'longbow'), false);
});

test('持っていないものは売れない', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  assert.equal(sell(pc, 'plate').ok, false);
});

/* -------------------------------------------------------------- 持ち替え */

test('持っていないものは装備できない', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const result = equip(pc, 'plate');
  assert.equal(result.ok, false);
  assert.match(result.reason, /持っていません/);
});

test('装備すると、今つけていたものは持ち物に戻る', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const worn = pc.equipped.armor.name;
  buy(pc, 'plate');

  const result = equip(pc, 'plate');
  assert.equal(result.ok, true);
  assert.equal(pc.equipped.armor.name, 'プレートアーマー');
  assert.ok((pc.inventory || []).some(i => i.name === worn), '外した防具が消えた');
  assert.equal(owns(pc, 'plate'), false, '着たものが持ち物にも残っている');
});

test('防具を着替えるとACが動く', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const before = armorClass(pc);
  buy(pc, 'plate');
  equip(pc, 'plate');
  recalculate(pc);
  assert.ok(armorClass(pc) > before, `AC が動いていない（${before} → ${armorClass(pc)}）`);
});

test('武器を持ち替えると攻撃の選択肢が変わる', () => {
  useWorld('neon');
  const pc = createCharacter({ name: '傭兵', classId: 'solo', ancestryId: 'street' });
  pc.gold = 5000;
  buy(pc, 'katana');
  equip(pc, 'katana');
  recalculate(pc);
  assert.ok(attackOptions(pc).some(a => a.name === 'カタナ'), '持ち替えた武器で殴れない');
});

test('外すと持ち物に戻り、スロットが空く', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const shield = pc.equipped.shield.name;
  const result = unequip(pc, 'shield');
  assert.equal(result.ok, true);
  assert.equal(pc.equipped.shield, undefined);
  assert.ok((pc.inventory || []).some(i => i.name === shield));
  assert.equal(unequip(pc, 'shield').ok, false, '空のスロットを外せてしまう');
});

test('持ち替えても品物は増えも減りもしない', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  const count = () => (pc.inventory || []).reduce((sum, i) => sum + i.count, 0)
    + loadout(pc).filter(s => s.item).length;

  buy(pc, 'greataxe');
  const before = count();
  equip(pc, 'greataxe');
  assert.equal(count(), before, '装備で品物が増減した');
  unequip(pc, 'weapon');
  assert.equal(count(), before, '取り外しで品物が増減した');
});

test('スロットは4つとも埋められる', () => {
  useWorld(DEFAULT_WORLD);
  const pc = rich();
  buy(pc, 'shortbow');
  equip(pc, 'shortbow');
  const filled = loadout(pc).filter(s => s.item).map(s => s.id);
  assert.deepEqual(filled.sort(), SLOTS.map(s => s.id).sort());
});

/* ------------------------------------------------- 物語のための品 */

/* 護符に「所持者は恐怖セーヴに有利」と書いてあったのに、セーヴは特性と装備しか
   見ていなかった。持っているだけで効くものが、一つも効いていなかった。 */
test('持ち物が与えるセーヴの有利が、実際に効く', () => {
  useWorld('embers');
  const bare = createCharacter({ name: '素手', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  assert.deepEqual(carriedSaveAdvantage(bare), []);

  const withCharm = createCharacter({ name: '護符持ち', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  withCharm.inventory = [{ id: 'charm', name: '護符', count: 1, saveAdvantageVs: ['frightened'] }];
  assert.deepEqual(carriedSaveAdvantage(withCharm), ['frightened']);

  // 実際の振り方まで見る。有利なら2個振って高いほうになる。
  const low = savingThrow(withCharm, 'wis', 10, { rng: new Rng(3), vs: 'frightened' });
  assert.equal(low.mode, 'adv', '護符を持っているのに有利になっていない');
  const plain = savingThrow(bare, 'wis', 10, { rng: new Rng(3), vs: 'frightened' });
  assert.equal(plain.mode, null);

  // 使い切って0個になったら効かない。
  withCharm.inventory[0].count = 0;
  assert.deepEqual(carriedSaveAdvantage(withCharm), []);
});

/* keep はどこにも読まれていない印だった。売れてしまうと先へ進めなくなる。 */
test('手放せない品は売れない', () => {
  useWorld('embers');
  const pc = createCharacter({ name: '売り手', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  pc.gold = 0;
  pc.inventory = [{ id: 'letter', name: '預かった手紙', count: 1, cost: 40, keep: true }];

  const result = sell(pc, 'letter', 1);
  assert.equal(result.ok, false, '物語のための品が売れてしまう');
  assert.equal(pc.gold, 0);
  assert.equal(pc.inventory.length, 1);
});

/* ------------------------------------------------ 出発の支度 */

/* 持ち越しが入って、稼いだ金で次の装備を買う往復が意味を持つようになった。
   買い物はシートの奥にあるので、開かなくても足りないものが分かるようにする。 */
test('支度の点検は、足りないものを名指しする', () => {
  useWorld('embers');
  const fighter = createCharacter({ name: '戦', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  assert.deepEqual(readiness(fighter).warnings, [], `最初から揃っているはず: ${readiness(fighter).warnings}`);

  // 武器も防具も外し、回復も捨てる。
  const bare = createCharacter({ name: '裸', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  bare.equipped = {};
  bare.inventory = [];
  const warned = readiness(bare).warnings;
  assert.ok(warned.some(w => w.includes('武器')), warned.join('／'));
  assert.ok(warned.some(w => w.includes('防具')), warned.join('／'));
  assert.ok(warned.some(w => w.includes('回復')), warned.join('／'));
});

/* 直しようのない注意は出さない。秘術師はそもそも防具を着られない。 */
test('防具を着られないクラスに、防具の注意は出ない', () => {
  useWorld('embers');
  const mage = createCharacter({ name: '術', classId: 'mage', ancestryId: 'human', backgroundId: 'sage' });
  assert.equal(readiness(mage).warnings.some(w => w.includes('防具')), false);
});

test('回復の数は、持っている数だけ数える', () => {
  useWorld('embers');
  const pc = createCharacter({ name: '薬', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  const before = readiness(pc).heals;
  pc.gold = 9999;
  buy(pc, 'potion', 3);
  assert.equal(readiness(pc).heals, before + 3);
});
