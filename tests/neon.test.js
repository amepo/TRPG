import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter, recalculate, reviveCharacter } from '../js/core/character.js';
import { install } from '../js/core/augment.js';
import { skillMod, savingThrow } from '../js/core/rules.js';
import { hasTrait } from '../js/core/traits.js';
import { useWorld, DEFAULT_WORLD, WORLDS } from '../js/worlds/index.js';
import { LORE } from '../js/core/lore.js';
import { Rng } from '../js/core/rng.js';

test.afterEach(() => useWorld(DEFAULT_WORLD));

/* 種族から来るものは、その項目が無かった頃のセーブを読んでも戻ってほしい。 */
const asOldSave = character => {
  const copy = JSON.parse(JSON.stringify(character));
  delete copy.traits;
  delete copy.saveAdvantageVs;
  return copy;
};

/* 信用スコアは設定であって、ルールではない。数値としては誰も読まない。 */
test('信用スコアは読み物としてだけ存在する', () => {
  useWorld('neon');
  const world = WORLDS.find(w => w.id === 'neon');
  assert.equal(world.standing, undefined, 'ルール側に立場が残っている');
  assert.ok(LORE.standing?.tiers?.length >= 5, '読み物としての段位が無い');
  for (const tier of LORE.standing.tiers) {
    assert.ok(tier.name && tier.note, '段位に説明がない');
    // 実装しないものを数字で約束しない。
    assert.equal(tier.priceScale, undefined, '効かない倍率が書かれている');
  }
  const pc = createCharacter({ name: '企', classId: 'solo', ancestryId: 'corp' });
  assert.equal(pc.standing, undefined, 'キャラクターに立場が生えている');
});

test('義体の値段は誰に対しても同じ', () => {
  useWorld('neon');
  const price = ancestryId => {
    const pc = createCharacter({ name: 'x', classId: 'techie', ancestryId });
    pc.gold = 99999;
    return install(pc, 'neuralPort').paid;
  };
  assert.equal(price('corp'), price('synth'));
});

test('街の品は安いが、必ず何かを引き換えにする', () => {
  useWorld('neon');
  const world = WORLDS.find(w => w.id === 'neon');
  const augs = Object.values(world.augments);
  const street = augs.filter(a => a.grade === 'street');
  const corp = augs.filter(a => a.grade === 'corp');
  assert.ok(street.length >= 4 && corp.length >= 4, '層になっていない');

  const avg = list => list.reduce((s, a) => s + a.cost, 0) / list.length;
  assert.ok(avg(street) < avg(corp), '街の品のほうが高くては層の意味がない');

  // 街の品には、少なくとも一つ「下がる数値」があるはずだ。
  const withDownside = street.filter(a =>
    Object.values(a.effect?.skillBonus || {}).some(v => v < 0));
  assert.ok(withDownside.length >= 3, `副作用のある街の品が足りない（${withDownside.length}件）`);
});

test('脚の改造は移動と潜入を同時に動かす', () => {
  useWorld('neon');
  const pc = createCharacter({ name: 'I', classId: 'runner', ancestryId: 'street' });
  pc.gold = 99999;
  const speedBefore = pc.speed;
  const stealthBefore = skillMod(pc, 'stealth');

  install(pc, 'scrapLegs');
  recalculate(pc);
  assert.ok(pc.speed > speedBefore, '速くなっていない');
  assert.ok(skillMod(pc, 'stealth') < stealthBefore, 'うるさくなっていない');
});

test('改造もセーヴの有利をくれる', () => {
  useWorld('neon');
  const pc = createCharacter({ name: 'J', classId: 'medtech', ancestryId: 'street' });
  pc.gold = 99999;
  const rng = new Rng(3);
  assert.equal(savingThrow(pc, 'con', 12, { rng, vs: 'poisoned' }).mode, null);
  install(pc, 'bloodScrub');
  recalculate(pc);
  assert.equal(savingThrow(pc, 'con', 12, { rng, vs: 'poisoned' }).mode, 'adv');
});

test('区画は上から下まで揃い、下ほど安く、入る条件が書いてある', () => {
  useWorld('neon');
  assert.ok(LORE.districts.length >= 4, '区画が足りない');
  for (const d of LORE.districts) {
    assert.ok(d.name && d.blurb && d.entry && d.air && d.turf, `${d.id}: 説明が欠けている`);
    assert.equal(typeof d.priceScale, 'number');
  }
  const spire = LORE.districts.find(d => d.id === 'spire');
  const abyss = LORE.districts.find(d => d.id === 'abyss');
  assert.ok(spire.priceScale > abyss.priceScale, '上層のほうが安くては街の形が逆だ');
  assert.ok(spire.standing > abyss.standing, '上層に入る条件が緩くては困る');
});

test('特性を持たないセーブを読んでも、種族特性が戻る', () => {
  useWorld(DEFAULT_WORLD);
  const elf = createCharacter({ name: '耳', classId: 'ranger', ancestryId: 'elf' });
  const loaded = reviveCharacter(asOldSave(elf));
  assert.equal(loaded.traits.length, elf.traits.length);
  assert.ok(hasTrait(loaded, 'feyBlood'), '妖精の血が失われている');
  assert.deepEqual(loaded.saveAdvantageVs, elf.saveAdvantageVs);
});
