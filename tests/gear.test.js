import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogue, thingById, slotFor, buy, sell, equip, unequip, owns, loadout, SLOTS, RESALE,
} from '../js/core/gear.js';
import { createCharacter, recalculate, attackOptions } from '../js/core/character.js';
import { armorClass } from '../js/core/rules.js';
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
