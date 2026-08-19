import test from 'node:test';
import assert from 'node:assert/strict';

import { TRAITS, traitList, traitPassives, traitBonusDamage, traitOnRest } from '../js/core/traits.js';
import { createCharacter } from '../js/core/character.js';
import { check, savingThrow, applyDamage, armorClass, carriedSaveAdvantage } from '../js/core/rules.js';
import { equip, unequip, buy, sell } from '../js/core/gear.js';
import { itemById } from '../js/core/content.js';
import { WORLDS, useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';
import { Rng } from '../js/core/rng.js';

test.afterEach(() => useWorld(DEFAULT_WORLD));

/* 秘蔵の品の決まりごと。
   「単純に強い力なんてものはない」——力を書いたら代償も書く。そして
   代償は実際に効く。効かない代償は代償ではなく、ただの飾りになる。 */

const magicItems = worldId => {
  useWorld(worldId);
  return Object.values(WORLDS.find(w => w.id === worldId).items).filter(i => i.magic);
};

test('どの世界にも秘蔵の品があり、すべて力と代償の両方を持つ', () => {
  for (const world of WORLDS) {
    const items = magicItems(world.id);
    assert.ok(items.length >= 4, `${world.id}: 秘蔵の品が少なすぎる`);

    for (const item of items) {
      const traits = traitList(item);
      assert.equal(traits.length, 1, `${world.id}/${item.name}: 特性がちょうど1つでない`);
      const [trait] = traits;
      assert.ok(trait.def, `${world.id}/${item.name}: 特性 ${trait.id} が実装されていない`);
      // 表示文は「力／代償」の形で書く。読んだ人が代償を見落とさないように。
      assert.ok(trait.text.includes('／'), `${world.id}/${item.name}: 力と代償が書き分けられていない`);
      assert.ok(item.desc?.length > 20, `${world.id}/${item.name}: 説明が短すぎる`);
      assert.ok(item.cost > 0, `${world.id}/${item.name}: 値段がない`);
    }
  }
});

/* ここからが本題。宣言ではなく、実際に効くかどうかを見る。 */

const wielder = (worldId, itemId, over = {}) => {
  useWorld(worldId);
  const klass = worldId === 'embers' ? 'fighter' : 'solo';
  const ancestry = worldId === 'embers' ? 'human' : 'street';
  const background = worldId === 'embers' ? 'soldier' : 'ganger';
  const pc = createCharacter({ name: '担い手', classId: klass, ancestryId: ancestry, backgroundId: background, ...over });
  pc.gold = 99999;
  buy(pc, itemId, 1);
  const result = equip(pc, itemId);
  return { pc, equipped: result.ok };
};

test('燠の牙は炎を上乗せし、そのぶん持ち主が火に焼かれる', () => {
  const { pc, equipped } = wielder('embers', 'emberFang');
  assert.equal(equipped, true, '装備できない');

  // 力：命中に火が乗る。
  const bonus = traitBonusDamage({ self: pc, target: {}, attack: {}, combat: null });
  assert.equal(bonus.length, 1);
  assert.equal(bonus[0].type, '火');

  // 代償：火が2倍で通る。HPは0で止まるので、通った量そのものを見る。
  assert.ok(pc.vulnerabilities.includes('火'), '火に脆くなっていない');
  assert.equal(applyDamage(pc, 10, '火').dealt, 20, '火が2倍になっていない');

  const bare = createCharacter({ name: '素', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  assert.equal(applyDamage(bare, 10, '火').dealt, 10, '持っていない側まで焼けている');
});

test('竜血が燠の牙を持つと、火の耐性は打ち消される', () => {
  useWorld('embers');
  const pc = createCharacter({ name: '竜', classId: 'fighter', ancestryId: 'dragonborn', backgroundId: 'soldier' });
  assert.ok(pc.resistances.includes('火'), '竜鱗が効いていない');

  pc.gold = 99999;
  buy(pc, 'emberFang', 1);
  equip(pc, 'emberFang');
  assert.equal(pc.resistances.includes('火'), false, '耐性と脆弱が同時に立っている');
  assert.ok(pc.vulnerabilities.includes('火'));
});

test('鉄の誓いは AC を上げ、そのぶん足を止める', () => {
  const { pc } = wielder('embers', 'ironVow');
  const bare = createCharacter({ name: '素', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });

  assert.equal(pc.acBonus, 2, 'AC が上がっていない');
  assert.ok(armorClass(pc) > 10);
  assert.ok(pc.speed < bare.speed, '移動が落ちていない');

  // 代償：隠密に不利。判定の振り方まで見る。
  const sneak = check(pc, 'stealth', 10, { rng: new Rng(3) });
  assert.equal(sneak.mode, 'dis', '隠密に不利がついていない');
  assert.equal(check(bare, 'stealth', 10, { rng: new Rng(3) }).mode, null);
});

test('囁きの環は見せる代わりに、意志を削る', () => {
  const { pc } = wielder('embers', 'whisperCrown');
  assert.equal(check(pc, 'perception', 10, { rng: new Rng(5) }).mode, 'adv', '知覚に有利がついていない');
  assert.equal(savingThrow(pc, 'wis', 12, { rng: new Rng(5), vs: 'charmed' }).mode, 'dis', '魅了セーヴに不利がついていない');
});

test('血の刃は深く斬る代わりに、持ち主の体力を削ったまま返さない', () => {
  useWorld('embers');
  const bare = createCharacter({ name: '素', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  const { pc } = wielder('embers', 'bloodedge');
  assert.equal(pc.maxHp, bare.maxHp - 5, '最大HPが減っていない');
  assert.equal(traitBonusDamage({ self: pc, target: {}, attack: {}, combat: null })[0].dice, '1d8');
});

test('数える金貨は運を貸し、休むたびに取り立てる', () => {
  useWorld('embers');
  const pc = createCharacter({ name: '欲', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  pc.gold = 500;
  pc.inventory.push({ ...itemById('cursedCoin'), count: 1 });

  // 力：鞄の中でも効く（alwaysOn）。
  assert.ok(traitList(pc).some(t => t.id === 'cursedCoin'), '持っているだけでは効いていない');

  // 代償：休むと減る。
  const [toll] = traitOnRest({ self: pc, kind: 'long' });
  assert.ok(toll?.gold > 0, '休んでも取り立てられない');
  assert.ok(toll.text.includes('金貨'));
});

test('手放せない品は、売ることも外すこともできない', () => {
  useWorld('embers');
  const pc = createCharacter({ name: '売', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier' });
  pc.gold = 99999;
  buy(pc, 'cursedCoin', 1);
  const purse = pc.gold;
  assert.equal(sell(pc, 'cursedCoin', 1).ok, false, '呪いが換金できてしまう');
  assert.equal(pc.gold, purse, '売れていないのに金が増えた');

  // 装備するほうも同じ。血の刃は握ったら離せない。
  buy(pc, 'bloodedge', 1);
  equip(pc, 'bloodedge');
  assert.equal(unequip(pc, 'weapon').ok, false, '呪われた武器が外せてしまう');
});

/* 代償が本当に釣り合っているか、数字で見る。強いだけの品を置かないための歯止め。 */
test('秘蔵の品は、ただ足すだけの効果を持たない', () => {
  for (const world of WORLDS) {
    for (const item of magicItems(world.id)) {
      const [trait] = traitList(item);
      const def = TRAITS[trait.id];
      const passive = def.passive || {};
      const hasUpside = !!(def.bonusDamage || def.rerollNatural1
        || passive.acBonus > 0 || passive.skillAdvantage?.length || passive.saveAdvantageVs?.length);
      const hasCost = !!(def.rest || item.keep
        || passive.vulnerabilities?.length || passive.maxHpPenalty || passive.speedPenalty
        || passive.skillDisadvantage?.length || passive.saveDisadvantageVs?.length);
      assert.ok(hasUpside, `${world.id}/${item.name}: 力が無い`);
      assert.ok(hasCost, `${world.id}/${item.name}: 代償が無い`);
    }
  }
});
