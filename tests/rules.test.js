import test from 'node:test';
import assert from 'node:assert/strict';

import {
  abilityMod, proficiencyBonus, skillMod, saveMod, passive, armorClass,
  check, savingThrow, attackRoll, damageRoll, applyDamage, heal, deathSave,
  addCondition, removeCondition, tickConditions, hasCondition, isIncapacitated,
  shortRest, longRest, levelForXp, xpToNext, resolveMode, difficultyName, signed,
} from '../js/core/rules.js';
import { Rng } from '../js/core/rng.js';
import { createCharacter, recalculate, awardXp, levelUp, addItem, removeItem, useSlot, pregeneratedParty } from '../js/core/character.js';
import { ARMORS, SHIELD } from '../js/core/content.js';

/** Rolls the supplied faces in order, so a test can force a result. */
const fixed = values => { let i = 0; return { die: () => values[i++ % values.length], float: () => 0.5, pick: a => a[0] }; };

const dummy = (over = {}) => ({
  name: 'テスト', level: 1, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  skills: [], saves: [], conditions: [], hp: 12, maxHp: 12, tempHp: 0, ...over,
});

test('ability modifiers follow the standard curve', () => {
  assert.equal(abilityMod(1), -5);
  assert.equal(abilityMod(10), 0);
  assert.equal(abilityMod(11), 0);
  assert.equal(abilityMod(16), 3);
  assert.equal(abilityMod(20), 5);
});

test('proficiency bonus steps every four levels', () => {
  assert.deepEqual([1, 4, 5, 8, 9].map(proficiencyBonus), [2, 2, 3, 3, 4]);
});

test('skill modifier adds proficiency only when trained', () => {
  const untrained = dummy();
  const trained = dummy({ skills: ['athletics'] });
  assert.equal(skillMod(untrained, 'athletics'), 3);
  assert.equal(skillMod(trained, 'athletics'), 5);
});

test('expertise doubles proficiency', () => {
  const rogue = dummy({ skills: ['stealth'], expertise: ['stealth'], level: 5 });
  assert.equal(skillMod(rogue, 'stealth'), 2 + 3 + 3);      // dex +2, pb +3 twice
});

test('saving throws use class proficiency', () => {
  const c = dummy({ saves: ['con'] });
  assert.equal(saveMod(c, 'con'), 4);
  assert.equal(saveMod(c, 'cha'), -1);
});

test('passive score is 10 plus the modifier, minus 5 while impaired', () => {
  const c = dummy({ skills: ['perception'] });
  assert.equal(passive(c, 'perception'), 13);
  addCondition(c, 'poisoned');
  assert.equal(passive(c, 'perception'), 8);
});

test('armour class combines armour, dex cap and shield', () => {
  const light = dummy({ equipped: { armor: { ...ARMORS.leather } } });
  assert.equal(armorClass(light), 13);                       // 11 + dex 2

  const heavy = dummy({ equipped: { armor: { ...ARMORS.chain }, shield: { ...SHIELD } } });
  assert.equal(armorClass(heavy), 17);                       // 13 + min(dex 2, cap 2) + 2

  const capped = dummy({ abilities: { ...dummy().abilities, dex: 20 }, equipped: { armor: { ...ARMORS.plate } } });
  assert.equal(armorClass(capped), 18);                      // SRD のプレート。dex は一切乗らない
});

test('a check succeeds when the total meets the DC', () => {
  const c = dummy({ skills: ['athletics'] });
  const result = check(c, 'athletics', 15, { rng: fixed([10]) });
  assert.equal(result.total, 15);
  assert.equal(result.success, true);
  assert.equal(result.margin, 0);
});

test('natural 1 and 20 are flagged on checks', () => {
  const c = dummy();
  assert.equal(check(c, 'athletics', 30, { rng: fixed([20]) }).crit, true);
  assert.equal(check(c, 'athletics', 5, { rng: fixed([1]) }).fumble, true);
});

test('advantage and disadvantage cancel out', () => {
  assert.equal(resolveMode({ advantage: true, disadvantage: true }), null);
  assert.equal(resolveMode({ advantage: true }), 'adv');
  assert.equal(resolveMode({ disadvantage: true }), 'dis');
});

test('impairing conditions force disadvantage on the creature', () => {
  const c = dummy({ skills: [] });
  addCondition(c, 'frightened');
  const result = check(c, 'athletics', 10, { rng: fixed([18, 4]) });
  assert.equal(result.mode, 'dis');
  assert.equal(result.natural, 4);
});

test('attack rolls hit on a natural 20 and miss on a natural 1', () => {
  const attacker = dummy();
  const target = dummy({ acOverride: 30 });
  const crit = attackRoll(attacker, target, { name: '剣', damage: '1d8', ability: 'str' }, { rng: fixed([20]) });
  assert.equal(crit.hit, true);
  assert.equal(crit.crit, true);

  const weak = dummy({ acOverride: 2 });
  const fumble = attackRoll(attacker, weak, { name: '剣', damage: '1d8', ability: 'str' }, { rng: fixed([1]) });
  assert.equal(fumble.hit, false);
});

test('monsters use their flat attack bonus', () => {
  const monster = dummy({ abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 } });
  const target = dummy({ acOverride: 14 });
  const result = attackRoll(monster, target, { name: '短刀', bonus: 4, damage: '1d6+2' }, { rng: fixed([10]) });
  assert.equal(result.total, 14);
  assert.equal(result.hit, true);
});

test('a critical hit doubles the dice but not the flat modifier', () => {
  const attacker = dummy();                                   // str 16 → +3
  const normal = damageRoll(attacker, { damage: '1d8', ability: 'str' }, { rng: fixed([5]) });
  assert.equal(normal.total, 8);
  const crit = damageRoll(attacker, { damage: '1d8', ability: 'str' }, { rng: fixed([5]), crit: true });
  assert.equal(crit.total, 13);                               // 5 + 5 + 3
});

test('damage respects temporary hit points, resistance and immunity', () => {
  const c = dummy({ hp: 20, maxHp: 20, tempHp: 5 });
  assert.equal(applyDamage(c, 8).dealt, 8);
  assert.equal(c.tempHp, 0);
  assert.equal(c.hp, 17);

  const resistant = dummy({ hp: 20, maxHp: 20, resistances: ['火'] });
  applyDamage(resistant, 9, '火');
  assert.equal(resistant.hp, 16);                             // 9 halved to 4

  const immune = dummy({ hp: 20, maxHp: 20, immunities: ['毒'] });
  applyDamage(immune, 30, '毒');
  assert.equal(immune.hp, 20);
});

test('dropping to zero knocks a character out rather than killing them', () => {
  const c = dummy({ hp: 6, maxHp: 12 });
  const result = applyDamage(c, 10);
  assert.equal(c.hp, 0);
  assert.equal(result.downed, true);
  assert.equal(c.dead, undefined);
  assert.equal(hasCondition(c, 'unconscious'), true);
});

test('massive damage kills outright', () => {
  const c = dummy({ hp: 6, maxHp: 12 });
  applyDamage(c, 30);                                          // 6 to drop, 24 over a max of 12
  assert.equal(c.dead, true);
});

test('healing revives a downed character', () => {
  const c = dummy({ hp: 0, maxHp: 12 });
  addCondition(c, 'unconscious');
  const result = heal(c, 5);
  assert.equal(result.revived, true);
  assert.equal(hasCondition(c, 'unconscious'), false);
  assert.equal(c.hp, 5);
});

test('healing never exceeds the maximum and never revives the dead', () => {
  const c = dummy({ hp: 10, maxHp: 12 });
  assert.equal(heal(c, 99).healed, 2);
  const corpse = dummy({ hp: 0, maxHp: 12, dead: true });
  assert.equal(heal(corpse, 10).healed, 0);
});

test('three failed death saves kill, three successes stabilise', () => {
  const dying = dummy({ hp: 0, maxHp: 12 });
  for (let i = 0; i < 3; i++) deathSave(dying, { rng: fixed([2]) });
  assert.equal(dying.dead, true);

  const lucky = dummy({ hp: 0, maxHp: 12 });
  for (let i = 0; i < 3; i++) deathSave(lucky, { rng: fixed([15]) });
  assert.equal(lucky.stable, true);
  assert.equal(lucky.dead, undefined);
});

test('a natural 20 on a death save brings you back at 1 hp', () => {
  const dying = dummy({ hp: 0, maxHp: 12 });
  deathSave(dying, { rng: fixed([20]) });
  assert.equal(dying.hp, 1);
});

test('conditions tick down and expire', () => {
  const c = dummy();
  addCondition(c, 'poisoned', { rounds: 2 });
  assert.deepEqual(tickConditions(c), []);
  assert.equal(hasCondition(c, 'poisoned'), true);
  assert.deepEqual(tickConditions(c), ['poisoned']);
  assert.equal(hasCondition(c, 'poisoned'), false);
});

test('conditions without a duration persist until removed', () => {
  const c = dummy();
  addCondition(c, 'blinded');
  tickConditions(c); tickConditions(c);
  assert.equal(hasCondition(c, 'blinded'), true);
  assert.equal(removeCondition(c, 'blinded'), true);
});

test('stunned and unconscious count as incapacitated', () => {
  const c = dummy();
  assert.equal(isIncapacitated(c), false);
  addCondition(c, 'stunned');
  assert.equal(isIncapacitated(c), true);
});

test('a short rest spends hit dice, a long rest restores everything', () => {
  const c = dummy({ hp: 4, maxHp: 20, hitDice: 2, hitDie: '1d8', level: 3 });
  const rested = shortRest(c, 1, { rng: fixed([6]) });
  assert.equal(rested.healed, 8);                              // 6 + con 2
  assert.equal(c.hitDice, 1);

  c.hp = 3;
  c.slots = { 1: { max: 2, used: 2 } };
  longRest(c);
  assert.equal(c.hp, 20);
  assert.equal(c.slots[1].used, 0);
});

test('xp thresholds map to levels', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(299), 1);
  assert.equal(levelForXp(300), 2);
  assert.equal(levelForXp(2700), 4);
  assert.equal(xpToNext(0), 300);
});

test('difficulty labels and signed formatting', () => {
  assert.equal(difficultyName(15), '普通');
  assert.equal(difficultyName(30), 'ほぼ不可能');
  assert.equal(signed(3), '+3');
  assert.equal(signed(-2), '−2');
});

/* ---------------------------------------------------------- characters */

test('a created character has coherent derived stats', () => {
  const pc = createCharacter({
    name: 'ガレス', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier',
    abilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    skills: ['athletics'],
  });
  assert.equal(pc.abilities.str, 16);                          // 15 + human +1
  assert.equal(pc.maxHp, 10 + abilityMod(pc.abilities.con));
  assert.equal(pc.hp, pc.maxHp);
  assert.equal(pc.ac, 17);                                     // chain 13 + dex 2 + shield 2
  assert.ok(pc.skills.includes('athletics'));
  assert.ok(pc.skills.includes('intimidation'));               // from the background
});

test('ancestry bonuses and granted skills apply', () => {
  const elf = createCharacter({ classId: 'rogue', ancestryId: 'elf', backgroundId: 'thief', abilities: { dex: 15 } });
  assert.equal(elf.abilities.dex, 17);
  assert.ok(elf.skills.includes('perception'));
});

test('levelling up raises hit points and grants features', () => {
  const pc = createCharacter({ classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier', abilities: { con: 14 } });
  const before = pc.maxHp;
  const result = levelUp(pc);
  assert.equal(result.ok, true);
  assert.equal(pc.level, 2);
  assert.ok(pc.maxHp > before);
  assert.ok(pc.features.some(f => f.id === 'surge'));
});

test('awarding xp reports when a level is crossed', () => {
  const pc = createCharacter({ classId: 'rogue', ancestryId: 'human', backgroundId: 'thief' });
  assert.equal(awardXp(pc, 100).levelUp, false);
  assert.equal(awardXp(pc, 250).levelUp, true);
});

test('inventory adds, stacks and removes', () => {
  const pc = createCharacter({ classId: 'mage', ancestryId: 'human', backgroundId: 'scholar' });
  const potions = pc.inventory.find(i => i.id === 'potion');
  assert.equal(potions.count, 2);
  addItem(pc, { id: 'potion', name: '治癒の薬' }, 1);
  assert.equal(pc.inventory.find(i => i.id === 'potion').count, 3);
  removeItem(pc, 'potion', 3);
  assert.equal(pc.inventory.find(i => i.id === 'potion'), undefined);
});

test('spell slots are spent and run out', () => {
  const mage = createCharacter({ classId: 'mage', ancestryId: 'human', backgroundId: 'scholar', spells: ['magicMissile'] });
  assert.equal(useSlot(mage, 1), true);
  assert.equal(useSlot(mage, 1), true);
  assert.equal(useSlot(mage, 1), false);
  assert.equal(useSlot(mage, 0), true);                        // cantrips are free
});

test('the pregenerated party is internally consistent', () => {
  const party = pregeneratedParty();
  assert.equal(party.length, 4);
  for (const pc of party) {
    recalculate(pc);
    assert.ok(pc.hp > 0 && pc.hp === pc.maxHp, `${pc.name} hp`);
    assert.ok(pc.ac >= 10 && pc.ac <= 20, `${pc.name} ac=${pc.ac}`);
    assert.ok(pc.name.length > 0);
  }
});
