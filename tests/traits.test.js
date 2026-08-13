import test from 'node:test';
import assert from 'node:assert/strict';

import { TRAITS, traitList, traitPassives, hasTrait, normalizeTrait } from '../js/core/traits.js';
import { Combat, spawnMonster } from '../js/core/combat.js';
import { createCharacter, skillBudget } from '../js/core/character.js';
import { addCondition, applyDamage, check, savingThrow, hasCondition } from '../js/core/rules.js';
import { ANCESTRIES, CLASSES, ancestryById, monsterById } from '../js/core/content.js';
import { WORLDS, useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';
import { Rng } from '../js/core/rng.js';

test.beforeEach(() => useWorld(DEFAULT_WORLD));

const hero = (over = {}) => createCharacter({
  name: '試験体', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier',
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }, ...over,
});

/* 決まった目を返すサイコロ。特性が効いたかどうかを、運と切り離して見る。 */
const fixedRng = values => {
  const queue = [...values];
  const next = fallback => (queue.length ? queue.shift() : fallback);
  return {
    float: () => 0.5,
    die: faces => next(faces),
    int: (min, max) => next(max),
    pick: a => a[0],
    shuffle: a => a,
  };
};

/* ------------------------------------------------------------- 宣言と定義 */

test('世界が宣言する特性は、すべて定義を持っている', () => {
  const orphans = [];
  for (const world of Object.values(WORLDS)) {
    for (const group of ['ancestries', 'monsters']) {
      for (const entity of Object.values(world[group] || {})) {
        for (const trait of traitList(entity)) {
          if (!trait.id || !TRAITS[trait.id]) orphans.push(`${world.id}/${entity.name}: ${trait.text}`);
        }
      }
    }
  }
  assert.deepEqual(orphans, [], '定義のない特性が残っている');
});

test('素の文字列は描写として受け取られる', () => {
  const t = normalizeTrait('板挟み：十九年ぶんの何か');
  assert.equal(t.id, null);
  assert.equal(t.def, null);
  assert.equal(t.text, '板挟み：十九年ぶんの何か');
});

test('特性の表示名は世界ごとに違ってよい', () => {
  useWorld('neon');
  const trooper = monsterById('corpTrooper');
  const dog = monsterById('cyberdog');
  assert.ok(hasTrait(trooper, 'pack'));
  assert.ok(hasTrait(dog, 'pack'));
  assert.notEqual(traitList(trooper)[0].text, traitList(dog)[0].text);
});

/* ------------------------------------------------------------------ 受動 */

test('種族の特性が最大HPとイニシアチブに乗る', () => {
  useWorld('neon');
  const plain = createCharacter({ name: 'A', classId: 'solo', ancestryId: 'corp', abilities: { con: 14, dex: 12 } });
  const vet = createCharacter({ name: 'B', classId: 'solo', ancestryId: 'exmil', abilities: { con: 14, dex: 12 } });
  assert.ok(hasTrait(vet, 'combatDrilled'));
  assert.equal(vet.maxHp - plain.maxHp, 1, '戦闘訓練のレベル1ぶん');
  assert.equal(vet.initiative - plain.initiative, 2);
});

test('特性が技能を配る', () => {
  useWorld('neon');
  const runner = createCharacter({ name: 'C', classId: 'runner', ancestryId: 'street', skills: [] });
  assert.ok(runner.skills.includes('streetwise'));
});

test('多才は選べる技能の枠を1つ増やす', () => {
  const human = ancestryById('human');
  const elf = ancestryById('elf');
  const fighter = CLASSES.find(c => c.id === 'fighter');
  assert.equal(skillBudget(fighter, human) - skillBudget(fighter, elf), 1);
});

test('与信は初期資金を増やす', () => {
  useWorld('neon');
  const corp = createCharacter({ name: 'D', classId: 'solo', ancestryId: 'corp' });
  const street = createCharacter({ name: 'E', classId: 'solo', ancestryId: 'street' });
  assert.equal(corp.gold - street.gold, 250);
});

test('竜鱗は火ダメージを半分にする', () => {
  const dragon = createCharacter({ name: 'F', classId: 'fighter', ancestryId: 'dragonborn' });
  assert.ok(dragon.resistances.includes('火'));
  const applied = applyDamage(dragon, 10, '火');
  assert.equal(applied.dealt, 5);
});

test('非生物代謝は毒を通さない', () => {
  useWorld('neon');
  const synth = createCharacter({ name: 'G', classId: 'techie', ancestryId: 'synth' });
  assert.equal(applyDamage(synth, 12, '毒').dealt, 0);
  addCondition(synth, 'poisoned');
  assert.equal(hasCondition(synth, 'poisoned'), false, '毒状態にもならない');
});

test('妖精の血は魅了を弾く', () => {
  const elf = createCharacter({ name: 'H', classId: 'ranger', ancestryId: 'elf' });
  addCondition(elf, 'charmed');
  assert.equal(hasCondition(elf, 'charmed'), false);
  assert.ok(traitPassives(elf).saveAdvantageVs.includes('charmed'));
});

test('毒への抵抗はセーヴを有利にする（相手を選んで効く）', () => {
  const dwarf = createCharacter({ name: 'I', classId: 'fighter', ancestryId: 'dwarf' });
  const rng = new Rng(1);
  const versus = savingThrow(dwarf, 'con', 12, { rng, vs: 'poisoned' });
  const other = savingThrow(dwarf, 'con', 12, { rng, vs: 'charmed' });
  assert.equal(versus.mode, 'adv');
  assert.equal(other.mode, null, '毒以外のセーヴまで有利になってはいけない');
});

test('技能に効く特性は、その技能のときだけ有利になる', () => {
  useWorld('neon');
  const scholar = createCharacter({ name: 'J', classId: 'techie', ancestryId: 'academy', skills: [] });
  const rng = new Rng(2);
  assert.equal(check(scholar, 'tech', 12, { rng }).mode, 'adv');
  assert.equal(check(scholar, 'stealth', 12, { rng }).mode, null);
});

test('幸運は出目1を一度だけ振り直し、休憩で戻る', () => {
  const halfling = createCharacter({ name: 'K', classId: 'rogue', ancestryId: 'halfling' });
  // 1 を出させてから 15 を返すサイコロ。振り直しが起きれば結果は 15 側になる。
  const result = check(halfling, 'stealth', 5, { rng: fixedRng([1, 15]) });
  assert.notEqual(result.natural, 1, '出目1のまま確定してはいけない');
  assert.equal(halfling.luckUsed, true);

  const second = check(halfling, 'stealth', 5, { rng: fixedRng([1, 15]) });
  assert.equal(second.natural, 1, '2度目は振り直せない');
});

/* ------------------------------------------------------------------ 戦闘 */

const fight = (monsterIds, party, opts = {}) => {
  const rng = new Rng(opts.seed ?? 5);
  const enemies = monsterIds.map(id => spawnMonster(id, { rng }));
  return { combat: new Combat(party, enemies, { rng, ...opts }), enemies };
};

test('群れ戦術は仲間が生きているあいだだけ攻撃を有利にする', () => {
  const party = [hero()];
  const { combat, enemies } = fight(['wolf', 'wolf'], party);
  combat.start();
  const [a, b] = enemies;
  assert.equal(combat.alliesOf(a).length, 1);
  const modes = [];
  const original = combat.say.bind(combat);
  combat.say = (text, kind, extra) => { if (extra?.roll) modes.push(extra.roll.mode); return original(text, kind, extra); };

  combat.resolveAttack(a, party[0], a.attacks[0]);
  assert.equal(modes.at(-1), 'adv');

  b.hp = 0;                                    // 相棒が倒れたら群れではなくなる
  combat.resolveAttack(a, party[0], a.attacks[0]);
  assert.equal(modes.at(-1), null);
});

test('号令は頭目が立っているあいだ配下の攻撃を有利にする', () => {
  const party = [hero()];
  const { combat, enemies } = fight(['goblinBoss', 'goblin'], party);
  combat.start();
  const [leader, mook] = enemies;
  const modes = [];
  const original = combat.say.bind(combat);
  combat.say = (text, kind, extra) => { if (extra?.roll) modes.push(extra.roll.mode); return original(text, kind, extra); };

  combat.resolveAttack(mook, party[0], mook.attacks[0]);
  assert.equal(modes.at(-1), 'adv');

  leader.hp = 0;
  combat.resolveAttack(mook, party[0], mook.attacks[0]);
  assert.equal(modes.at(-1), null, '頭目を倒せば号令は途切れる');
});

test('光学迷彩は一度だけ攻撃を無効にする', () => {
  useWorld('neon');
  const party = [hero()];
  const { combat, enemies } = fight(['cleaner'], party);
  combat.start();
  const cleaner = enemies[0];
  const before = cleaner.hp;
  applyDamageThroughTraits(combat, party[0], cleaner, 10);
  assert.equal(cleaner.hp, before, '1度目は素通り');
  applyDamageThroughTraits(combat, party[0], cleaner, 10);
  assert.equal(cleaner.hp, before - 10, '2度目は通る');
});

test('闇の加護は一度だけダメージを半減する', () => {
  const party = [hero()];
  const { combat, enemies } = fight(['cultLeader'], party);
  combat.start();
  const cultist = enemies[0];
  const before = cultist.hp;
  applyDamageThroughTraits(combat, party[0], cultist, 10);
  assert.equal(cultist.hp, before - 5);
  applyDamageThroughTraits(combat, party[0], cultist, 10);
  assert.equal(cultist.hp, before - 15);
});

/* 特性フックを通ったダメージだけを見たい。出目1は自動で外れるので、
   当たるまで振り直して「命中した一撃」を必ず一回作る。 */
function applyDamageThroughTraits(combat, attacker, target, amount) {
  const stub = { name: '検査', bonus: 99, damage: String(amount), type: '物理' };
  for (let guard = 0; guard < 50; guard++) {
    if (combat.resolveAttack(attacker, target, stub).hit) return;
  }
  throw new Error('検査の一撃が当たらなかった');
}

test('不死の頑健さは0HPで踏みとどまる', () => {
  const party = [hero()];
  const { combat, enemies } = fight(['zombie'], party);
  combat.start();
  const bones = enemies[0];
  assert.ok(hasTrait(bones, 'undeadFortitude'));
  // セーヴが必ず通るように耐久を上げてから、致死量に足りない一撃を入れる。
  bones.abilities.con = 30;
  applyDamageThroughTraits(combat, party[0], bones, bones.hp);
  assert.equal(bones.hp, 1, '踏みとどまったらHP1で立つ');
  assert.equal(bones.fortitudeUsed, true);
});

test('通報は3ラウンド目に増援を呼ぶ', () => {
  useWorld('neon');
  const party = [hero()];
  const { combat, enemies } = fight(['surveillanceDrone'], party);
  combat.start();
  const drone = enemies[0];
  const before = combat.enemies.length;
  combat.round = 1;
  combat.runTurnStartTraits(drone);
  assert.equal(combat.enemies.length, before, '早すぎる増援は来ない');
  combat.round = 3;
  combat.runTurnStartTraits(drone);
  assert.equal(combat.enemies.length, before + 1);
});

test('致死設定は抵抗を貫く', () => {
  useWorld('neon');
  const tough = hero();
  tough.resistances = ['精神'];
  const { combat, enemies } = fight(['blackIce'], [tough]);
  combat.start();
  const before = tough.hp;
  const ice = enemies[0];
  combat.resolveAttack(ice, tough, { name: '灼き', bonus: 99, damage: '10', type: '精神' });
  assert.equal(before - tough.hp, 10, '抵抗で半分になってはいけない');
});

test('光への弱さは、灯りを持った相手にだけ効く', () => {
  const dark = hero();
  dark.inventory = [];
  const { combat, enemies } = fight(['shadow'], [dark]);
  combat.start();
  const shade = enemies[0];
  const modes = [];
  const original = combat.say.bind(combat);
  combat.say = (text, kind, extra) => { if (extra?.roll) modes.push(extra.roll.mode); return original(text, kind, extra); };

  combat.resolveAttack(shade, dark, shade.attacks[0]);
  assert.equal(modes.at(-1), null);

  dark.inventory = [{ id: 'torch', name: '松明', count: 1, light: true }];
  combat.resolveAttack(shade, dark, shade.attacks[0]);
  assert.equal(modes.at(-1), 'dis', '松明を掲げれば影は狙いを外す');
});

test('痛覚遮断は恐怖を受けつけない', () => {
  useWorld('neon');
  const ripper = spawnMonster('ripper', { rng: new Rng(1) });
  addCondition(ripper, 'frightened');
  assert.equal(hasCondition(ripper, 'frightened'), false);
});

test('竜の吐息は戦闘の行動として選べ、使い切ると消える', () => {
  const dragon = createCharacter({ name: 'L', classId: 'fighter', ancestryId: 'dragonborn' });
  const { combat } = fight(['goblin', 'goblin'], [dragon]);
  combat.start();
  const has = () => combat.options(dragon).some(o => o.kind === 'trait' && o.id === 'dragonBreath');
  assert.ok(has(), '吐息が行動に出ていない');

  const totalBefore = combat.enemies.reduce((s, e) => s + e.hp, 0);
  combat.doTrait(dragon, { id: 'dragonBreath' });
  assert.ok(combat.enemies.reduce((s, e) => s + e.hp, 0) < totalBefore, '範囲攻撃が当たっていない');
  assert.equal(has(), false, '使い切ったら選べない');
});
