import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasStanding, standingSpec, tierOf, priceScale, adjustStanding,
  startingStanding, maxStanding, standingLabel,
} from '../js/core/standing.js';
import { createCharacter, recalculate } from '../js/core/character.js';
import { install } from '../js/core/augment.js';
import { testCondition, applyEffects, describeCondition } from '../js/core/scenario.js';
import { skillMod, savingThrow } from '../js/core/rules.js';
import { useWorld, DEFAULT_WORLD, WORLDS } from '../js/worlds/index.js';
import { LORE } from '../js/core/lore.js';
import { Rng } from '../js/core/rng.js';

test.afterEach(() => useWorld(DEFAULT_WORLD));

/* ------------------------------------------------------------- 立場の枠 */

test('立場は世界のもの。宣言しない世界では働かない', () => {
  useWorld('embers');
  assert.equal(hasStanding(), false);
  const knight = createCharacter({ name: '騎', classId: 'fighter', ancestryId: 'human' });
  assert.equal(knight.standing, 0, '無い世界で段位を持ってはいけない');
  assert.equal(priceScale(knight), 1, '無い世界で物価が動いてはいけない');
});

test('信用スコアの段位は、下ほど物価が高い', () => {
  useWorld('neon');
  assert.equal(hasStanding(), true);
  const scales = standingSpec().tiers.map(t => t.priceScale);
  for (let i = 1; i < scales.length; i++) {
    assert.ok(scales[i] < scales[i - 1], '段位が上がるほど安くならなければ意味がない');
  }
  assert.equal(tierOf(0).name, '存在しない');
  assert.equal(tierOf(4).name, '企業級');
  assert.equal(tierOf(99).name, '企業級', '範囲外は上限に丸める');
});

test('出自ごとに出発点が違う', () => {
  useWorld('neon');
  const corp = createCharacter({ name: 'A', classId: 'solo', ancestryId: 'corp' });
  const street = createCharacter({ name: 'B', classId: 'solo', ancestryId: 'street' });
  const synth = createCharacter({ name: 'C', classId: 'solo', ancestryId: 'synth' });
  assert.equal(corp.standing, 4);
  assert.equal(street.standing, startingStanding());
  assert.equal(synth.standing, 0, '規格外の体は登録の様式に当てはまらない');
  assert.match(standingLabel(corp), /企業級/);
});

test('立場は範囲の外に出ない', () => {
  useWorld('neon');
  const pc = createCharacter({ name: 'D', classId: 'solo', ancestryId: 'street' });
  adjustStanding(pc, -99);
  assert.equal(pc.standing, 0);
  adjustStanding(pc, +99);
  assert.equal(pc.standing, maxStanding());
});

/* ----------------------------------------------------------- 遊びへの影響 */

test('同じ義体でも、信用がないほど高く売られる', () => {
  useWorld('neon');
  const make = ancestryId => {
    const pc = createCharacter({ name: 'E', classId: 'techie', ancestryId });
    pc.gold = 99999;
    return pc;
  };
  const rich = make('corp');
  const poor = make('synth');
  const paidByRich = install(rich, 'neuralPort').paid;
  const paidByPoor = install(poor, 'neuralPort').paid;
  assert.ok(paidByPoor > paidByRich, `足元を見られていない（${paidByPoor} vs ${paidByRich}）`);
});

test('シナリオは立場で扉を開け閉めできる', () => {
  useWorld('neon');
  const low = createCharacter({ name: 'F', classId: 'solo', ancestryId: 'nomad' });
  const high = createCharacter({ name: 'G', classId: 'solo', ancestryId: 'corp' });

  assert.equal(testCondition({ standing: { gte: 3 } }, { party: [low] }), false);
  assert.equal(testCondition({ standing: { gte: 3 } }, { party: [high] }), true);
  // 一行のうち一人が通れば話は通る。
  assert.equal(testCondition({ standing: { gte: 3 } }, { party: [low, high] }), true);
  assert.match(describeCondition({ standing: { gte: 4 } }), /企業級/);
});

test('効果で立場が動き、段位が変わったときだけ知らせる', () => {
  useWorld('neon');
  const pc = createCharacter({ name: 'H', classId: 'solo', ancestryId: 'street' });
  const lines = [];
  const ctx = { flags: new Set(), vars: {}, party: [pc], log: t => lines.push(t) };

  applyEffects([{ standing: -1 }], ctx);
  assert.equal(pc.standing, 1);
  assert.ok(lines.some(l => l.includes('底')), '段位が変わったのに黙っている');

  lines.length = 0;
  applyEffects([{ standing: 0 }], ctx);
  assert.equal(lines.length, 0, '動いていないのに喋ってはいけない');
});

/* -------------------------------------------------------------- 改造の層 */

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

/* ---------------------------------------------------------------- 地理 */

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
