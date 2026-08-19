/* Character creation, derived stats and progression.

   A character is a plain serialisable object. Anything computed from it
   (AC, attack list, spell slots) is derived on demand rather than stored, so
   a save file from an older build still works after the rules change. */

import { roll } from './dice.js';
import { Rng } from './rng.js';
import {
  ABILITY_IDS, abilityMod, proficiencyBonus, armorClass, skillMod, saveMod,
  SKILLS, passive, longRest, levelForXp,
} from './rules.js';
import {
  ANCESTRIES, CLASSES, BACKGROUNDS, WEAPONS, ARMORS, SHIELD, ITEMS,
  ancestryById, classById, backgroundById, spellSlots, sneakAttackDice,
  CLASS_SPELLS, spellById, PORTRAITS,
} from './content.js';
import { aggregate, strainUsed, strainCapacity, hasAugments } from './augment.js';
import { traitPassives } from './traits.js';
import { activeWorld, useWorld, worldById } from '../worlds/index.js';

export const POINT_BUY_BUDGET = 27;
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const pointCost = score => POINT_COST[score] ?? Infinity;
export const pointsSpent = abilities =>
  ABILITY_IDS.reduce((sum, id) => sum + (POINT_COST[abilities[id]] ?? 0), 0);

/** The standard spread, before ancestry bonuses. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Roll 4d6, drop the lowest, six times. */
export function rollAbilities(rng = new Rng()) {
  return Array.from({ length: 6 }, () => roll('4d6kh3', { rng }).total)
    .sort((a, b) => b - a);
}

/* --------------------------------------------------------------- creation */

/**
 * Build a complete character from a draft.
 * @param {object} draft {name, ancestryId, classId, backgroundId, abilities,
 *                        skills, expertise, spells, portrait, notes}
 */
export function createCharacter(draft = {}) {
  const ancestry = ancestryById(draft.ancestryId);
  const klass = classById(draft.classId);
  const background = backgroundById(draft.backgroundId);
  const level = Math.max(1, Math.min(10, draft.level || 1));

  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...(draft.abilities || {}) };
  const abilities = {};
  for (const id of ABILITY_IDS) abilities[id] = (base[id] || 10) + (ancestry.bonus?.[id] || 0);

  // Background skills are free; class picks come from the draft.
  const traitGrants = traitPassives(ancestry);
  const skills = [...new Set([
    ...(background.skills || []),
    ...(ancestry.grantSkills || []),
    ...traitGrants.grantSkills,
    ...(draft.skills || []),
  ])];

  const character = {
    id: draft.id || `pc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: draft.name?.trim() || '名もなき冒険者',
    world: activeWorld().id,
    ancestryId: ancestry.id,
    classId: klass.id,
    backgroundId: background.id,
    level,
    xp: draft.xp || 0,
    abilities,
    skills,
    expertise: (draft.expertise || []).slice(0, klass.expertiseChoices || 0),
    saves: [...klass.saves],
    traits: [...(ancestry.traits || [])],
    speed: ancestry.speed,
    hitDie: klass.hitDie,
    conditions: [],
    tempHp: 0,
    deathSaves: { success: 0, fail: 0 },
    inventory: [],
    equipped: {},
    augments: [...(draft.augments || [])],
    spells: [...(draft.spells || [])],
    cantrips: [...(klass.caster?.cantrips || [])],
    slots: {},
    resources: {},
    resistances: [...(ancestry.resistances || [])],
    notes: draft.notes || '',
    portrait: draft.portrait || pickPortrait(klass.id),
    createdAt: Date.now(),
  };

  equipStartingGear(character, klass, background);
  recalculate(character);
  character.hp = character.maxHp;
  character.hitDice = level;
  return character;
}

const pickPortrait = classId => PORTRAITS[classId] || '🎲';

/** 選べる技能の数。クラスの枠に、種族の特性が足す分を乗せる。 */
export function skillBudget(klass, ancestry) {
  return (klass?.skillChoices || 0) + traitPassives(ancestry).extraSkills;
}

function equipStartingGear(character, klass, background) {
  if (klass.armor && ARMORS[klass.armor]) character.equipped.armor = { ...ARMORS[klass.armor] };
  if (klass.offhand === 'shield') character.equipped.shield = { ...SHIELD };
  if (klass.weapon && WEAPONS[klass.weapon]) character.equipped.weapon = { ...WEAPONS[klass.weapon] };
  if (klass.ranged && WEAPONS[klass.ranged]) character.equipped.ranged = { ...WEAPONS[klass.ranged] };

  addItem(character, ITEMS.potion, 2);
  addItem(character, ITEMS.rations, 1);
  addItem(character, ITEMS.torch, 3);
  if (klass.id === 'rogue') addItem(character, ITEMS.lockpicks, 1);
  if (klass.id === 'cleric') addItem(character, ITEMS.holySymbol, 1);
  if (klass.id === 'mage') addItem(character, ITEMS.spellbook, 1);
  for (const name of background.gear || []) addItem(character, { id: `bg_${name}`, name, desc: '経歴の持ち物' }, 1);
  // 初期資金は世界のもの。銀貨25枚と €$25 は、まったく違う額だ。
  character.gold = (activeWorld().startingGold ?? 25) + (traitPassives(character).gold || 0);
}

/* -------------------------------------------------------------- derived */

/** Recompute everything that depends on level, ability scores and gear. */
export function recalculate(character) {
  const klass = classById(character.classId);
  const ancestry = ancestryById(character.ancestryId);
  const conMod = abilityMod(character.abilities.con);

  /* 種族から来るものは、作成時に書き込んだきりにしない。書いたきりだと、
     その項目が無かった頃のセーブを読んだときに黙って消える（実際に消えた——
     エルフが妖精の血と夜目を失った）。 */
  if (!character.traits) character.traits = [...(ancestry.traits || [])];

  // 特性の受動効果は、装備と同じく平の数値へ畳み込んでからルール層に渡す。
  const traits = traitPassives(character);
  // Implants first: their totals feed hit points, AC and every skill below.
  applyAugments(character, ancestry, traits);

  // Level 1 takes the full hit die; later levels take its average, rounded up.
  const perLevel = Math.ceil((Number(klass.hitDie.split('d')[1]) + 1) / 2);
  character.maxHp = klass.hpBase + conMod
    + (character.level - 1) * (perLevel + conMod)
    + (ancestry.hpPerLevel || 0) * character.level
    + (traits.hpPerLevel || 0) * character.level
    + (character.augmentHpPerLevel || 0) * character.level
    // 代償で目減りするぶん。強い品ほど、体を削っていることがある。
    - (traits.maxHpPenalty || 0);
  character.maxHp = Math.max(1, character.maxHp);
  if (character.hp === undefined) character.hp = character.maxHp;
  character.hp = Math.min(character.hp, character.maxHp);

  // 脚の改造は移動そのものを変える。素の値は種族が持っている。
  character.speed = Math.max(1.5,
    (ancestry.speed || 9) + (character.augmentSpeed || 0) - (traits.speedPenalty || 0));
  // セーヴの有利は、特性と改造の両方から来る。
  character.saveAdvantageVs = [...new Set([
    ...traits.saveAdvantageVs, ...(character.augmentSaveAdvantageVs || []),
  ])];
  /* 抵抗と脆弱。applyAugments が積んだものの上に重ねる（上書きしない——
     改造の抵抗が消える）。炎の力を借りると、そのぶん火が通るようになるので、
     同じ種別に両方が立ったときは脆弱を勝たせる。 */
  character.vulnerabilities = [...new Set(traits.vulnerabilities)];
  character.resistances = (character.resistances || [])
    .filter(type => !character.vulnerabilities.includes(type));
  character.acBonus = (character.acBonus || 0) + (traits.acBonus || 0);

  character.proficiency = proficiencyBonus(character.level);
  character.ac = armorClass(character);
  character.initiative = abilityMod(character.abilities.dex)
    + (ancestry.initiativeBonus || 0) + (traits.initiativeBonus || 0)
    + (character.initiativeBonus || 0);
  character.features = klass.features.filter(f => f.level <= character.level);
  character.hitDie = klass.hitDie;

  if (klass.caster) {
    character.slots = mergeSlots(character.slots, spellSlots(character.level, !!klass.caster.halfCaster));
    character.spellAbility = klass.caster.ability;
    character.spellDC = 8 + character.proficiency + abilityMod(character.abilities[klass.caster.ability]);
    character.spellAttack = character.proficiency + abilityMod(character.abilities[klass.caster.ability]);
  }
  // Per-rest features, tracked as spendable resources.
  character.resources = character.resources || {};
  for (const feature of character.features) {
    if (['secondWind', 'channelHeal', 'surge', 'arcaneRecovery'].includes(feature.id)) {
      character.resources[feature.id] = character.resources[feature.id] ?? { max: 1, used: 0 };
    }
  }
  return character;
}

/* Fold every installed implant into the plain fields the rules layer reads.
   A world without implants leaves all of these at zero, so nothing changes. */
function applyAugments(character, ancestry, traits = traitPassives(character)) {
  character.skillBonus = {};
  character.acBonus = 0;
  character.initiativeBonus = 0;
  character.attackMod = 0;
  character.augmentHpPerLevel = 0;
  character.augmentAttacks = [];
  character.augmentSpeed = 0;
  character.augmentSaveAdvantageVs = [];
  character.resistances = [...new Set([...(ancestry.resistances || []), ...traits.resistances])];
  character.immunities = [...new Set([...(ancestry.immunities || []), ...traits.immunities])];
  character.conditionImmunities = [...traits.conditionImmunities];
  character.strainUsed = 0;
  character.strainCapacity = 0;
  character.strainOver = 0;

  if (!hasAugments()) return character;

  const bonuses = aggregate(character);
  character.skillBonus = bonuses.skillBonus;
  character.acBonus = bonuses.acBonus;
  character.initiativeBonus = bonuses.initiativeBonus;
  character.attackMod = bonuses.attackBonus;
  character.augmentHpPerLevel = bonuses.hpPerLevel;
  character.augmentAttacks = bonuses.attacks;
  character.augmentSpeed = bonuses.speed;
  character.augmentSaveAdvantageVs = [...bonuses.saveAdvantageVs];
  character.resistances = [...new Set([...character.resistances, ...bonuses.resistances])];
  character.immunities = [...new Set([...character.immunities, ...bonuses.immunities])];

  character.strainUsed = strainUsed(character);
  character.strainCapacity = strainCapacity(character);
  character.strainOver = Math.max(0, character.strainUsed - character.strainCapacity);
  return character;
}

/** Keep how many slots are already spent when the table grows. */
function mergeSlots(current = {}, table) {
  const out = {};
  for (const [level, max] of Object.entries(table)) {
    out[level] = { max, used: Math.min(current[level]?.used || 0, max) };
  }
  return out;
}

/** Every attack the character can make right now. */
export function attackOptions(character) {
  const out = [];
  const push = (weapon, slot) => {
    if (!weapon) return;
    out.push({
      id: slot, name: weapon.name, damage: weapon.damage, type: weapon.type,
      ability: weapon.ability, magic: weapon.magic || 0, ranged: !!weapon.ranged,
      heavy: !!weapon.heavy, tags: weapon.tags || [],
      kind: 'weapon',
    });
  };
  push(character.equipped?.weapon, 'weapon');
  push(character.equipped?.ranged, 'ranged');
  for (const attack of character.augmentAttacks || []) push(attack, attack.id);
  if (!out.length) push({ ...WEAPONS.unarmed }, 'unarmed');
  return out;
}

/** Cantrips plus any prepared spell with a slot left. */
export function spellOptions(character) {
  const out = [];
  for (const id of character.cantrips || []) {
    const spell = spellById(id);
    if (spell) out.push({ ...spell, slotLevel: 0, available: true });
  }
  for (const id of character.spells || []) {
    const spell = spellById(id);
    if (!spell) continue;
    const slot = character.slots?.[spell.level];
    out.push({ ...spell, slotLevel: spell.level, available: !!slot && slot.used < slot.max });
  }
  return out;
}

/** Spend a slot; returns false when none are left. */
export function useSlot(character, level) {
  if (!level) return true;                              // cantrips are free
  const slot = character.slots?.[level];
  if (!slot || slot.used >= slot.max) return false;
  slot.used += 1;
  return true;
}

export function slotsLeft(character, level) {
  const slot = character.slots?.[level];
  return slot ? slot.max - slot.used : 0;
}

/* ------------------------------------------------------------- inventory */

export function addItem(character, item, count = 1) {
  character.inventory = character.inventory || [];
  const existing = character.inventory.find(i => i.id === item.id);
  if (existing) existing.count += count;
  else character.inventory.push({ ...item, count });
  return character.inventory;
}

export function removeItem(character, itemId, count = 1) {
  const entry = character.inventory?.find(i => i.id === itemId);
  if (!entry) return false;
  entry.count -= count;
  if (entry.count <= 0) character.inventory = character.inventory.filter(i => i.id !== itemId);
  return true;
}

export const hasItem = (character, itemId) =>
  !!character.inventory?.some(i => i.id === itemId && i.count > 0);

/* ------------------------------------------------------------ progression */

/** Award XP and report whether it crossed a level boundary. */
export function awardXp(character, amount) {
  const before = character.level;
  character.xp = (character.xp || 0) + amount;
  const after = levelForXp(character.xp);
  if (after > before) return { gained: amount, levelUp: true, from: before, to: after };
  return { gained: amount, levelUp: false };
}

/** Apply a level-up. Ability bumps come at 4, 6 and 8. */
export function levelUp(character, { abilityBumps = [] } = {}) {
  if (character.level >= 10) return { ok: false, reason: '最大レベルです' };
  character.level += 1;
  const gained = [];

  if ([4, 6, 8].includes(character.level)) {
    for (const id of abilityBumps.slice(0, 2)) {
      if (character.abilities[id] < 20) { character.abilities[id] += 1; gained.push(`${id} +1`); }
    }
  }
  const klass = classById(character.classId);
  const fresh = klass.features.filter(f => f.level === character.level);
  gained.push(...fresh.map(f => f.name));

  const beforeMax = character.maxHp;
  recalculate(character);
  character.hp += character.maxHp - beforeMax;
  character.hitDice = character.level;

  // Casters learn one new spell each level.
  const learnable = (CLASS_SPELLS[klass.id] || []).filter(id => !character.spells.includes(id));
  const affordable = learnable.filter(id => (spellById(id)?.level || 1) <= Math.ceil(character.level / 2));
  if (klass.caster && affordable.length) {
    character.spells.push(affordable[0]);
    gained.push(`呪文《${spellById(affordable[0]).name}》`);
  }
  return { ok: true, level: character.level, gained, features: fresh };
}

/* ------------------------------------------------------------ presentation */

/** Everything the sheet UI needs, in one call. */
export function sheet(character) {
  recalculate(character);
  return {
    ...character,
    ancestry: ancestryById(character.ancestryId),
    klass: classById(character.classId),
    background: backgroundById(character.backgroundId),
    mods: Object.fromEntries(ABILITY_IDS.map(id => [id, abilityMod(character.abilities[id])])),
    skillMods: Object.fromEntries(SKILLS.map(s => [s.id, skillMod(character, s.id)])),
    saveMods: Object.fromEntries(ABILITY_IDS.map(id => [id, saveMod(character, id)])),
    passivePerception: passive(character, 'perception'),
    attacks: attackOptions(character),
    spellList: spellOptions(character),
    sneakDice: character.classId === 'rogue' ? sneakAttackDice(character.level) : null,
  };
}

/** A ready-made party for players who want to skip creation. */
export function pregeneratedParty() {
  // Each world ships its own crew; fall back to building from whatever the
  // active world offers so a new setting works before anyone writes one.
  const world = activeWorld();
  if (world.pregenerated) return world.pregenerated().map(createCharacter);
  if (world.id !== 'embers') return genericParty();
  return [
    createCharacter({
      name: 'ガレス', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier',
      abilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
      skills: ['athletics', 'intimidation'],
      notes: '砦から逃げてきた男。誰かを守る仕事だけは続けている。',
    }),
    createCharacter({
      name: 'ニケ', classId: 'rogue', ancestryId: 'halfling', backgroundId: 'thief',
      abilities: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 14 },
      skills: ['stealth', 'sleight', 'perception', 'investigation'],
      expertise: ['stealth', 'sleight'],
      notes: '軽い足と軽い口。借金だけが重い。',
    }),
    createCharacter({
      name: 'イレーヌ', classId: 'mage', ancestryId: 'elf', backgroundId: 'scholar',
      abilities: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
      skills: ['arcana', 'history'], spells: ['magicMissile', 'burningHands', 'sleep'],
      notes: '学院を追われた理由を、まだ誰にも話していない。',
    }),
    createCharacter({
      name: 'ボルド', classId: 'cleric', ancestryId: 'dwarf', backgroundId: 'acolyte',
      abilities: { str: 13, dex: 10, con: 14, int: 10, wis: 15, cha: 12 },
      skills: ['religion', 'medicine'], spells: ['cureWounds', 'bless', 'shieldOfFaith'],
      notes: '神は沈黙している。それでも祈りは効く。',
    }),
  ];
}

/* Four characters covering the four jobs any party needs, built from
   whatever classes the active world happens to define. */
function genericParty() {
  const spread = [
    { abilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
    { abilities: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 14 } },
    { abilities: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 } },
    { abilities: { str: 13, dex: 10, con: 14, int: 10, wis: 15, cha: 12 } },
  ];
  return CLASSES.slice(0, 4).map((klass, i) => createCharacter({
    name: DEFAULT_NAMES[i] || `隊員${i + 1}`,
    classId: klass.id,
    ancestryId: ANCESTRIES[i % ANCESTRIES.length].id,
    backgroundId: BACKGROUNDS[i % BACKGROUNDS.length].id,
    abilities: spread[i].abilities,
    skills: klass.skillList.slice(0, klass.skillChoices),
    expertise: klass.expertiseChoices ? klass.skillList.slice(0, klass.expertiseChoices) : [],
    spells: (CLASS_SPELLS[klass.id] || []).slice(0, 3),
  }));
}

const DEFAULT_NAMES = ['ヴェル', 'キド', 'サーシャ', 'マオ'];

/** Restore a character loaded from JSON: fills in anything a new build added. */
export function reviveCharacter(data) {
  const character = { conditions: [], inventory: [], spells: [], cantrips: [], augments: [], resources: {}, ...data };
  character.world = character.world || activeWorld().id;
  character.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...(data.abilities || {}) };
  character.level = Math.max(1, Math.min(10, character.level || 1));

  /* 組み直しは、その人物の世界の目で行う。別の世界が有効なまま計算すると、
     種族もクラスも引けずに先頭の項目へ落ち、エルフの追跡者が「ソロ」になり、
     ファンタジーの人物に信用スコアが書き込まれる（実際にそうなっていた）。 */
  inWorldOf(character, () => recalculate(character));

  if (character.hp === undefined || character.hp === null) character.hp = character.maxHp;
  return character;
}

/** `fn` をその人物の世界で実行し、終わったら元の世界へ戻す。 */
function inWorldOf(character, fn) {
  const before = activeWorld().id;
  const mine = character.world;
  const switched = mine && mine !== before && worldById(mine);
  if (switched) useWorld(mine);
  try { return fn(); } finally { if (switched) useWorld(before); }
}

/** Full recovery, used between chapters and by the session tool. */
export function restParty(party) {
  for (const c of party) { longRest(c); recalculate(c); }
  return party;
}
