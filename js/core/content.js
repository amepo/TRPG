/* A live view of the active world's content.

   The data itself lives in js/worlds/*. This module re-publishes it under
   stable names and adds the lookups and small calculations that are the same
   in every setting. The exports are `let` bindings kept in sync with the
   world, so importers automatically follow a world switch — ES modules hand
   out live references, not copies. */

import { onWorld } from '../worlds/index.js';

export let ANCESTRIES = [];
export let CLASSES = [];
export let BACKGROUNDS = [];
export let WEAPONS = {};
export let ARMORS = {};
export let SHIELD = {};
export let ITEMS = {};
export let SPELLS = {};
export let CLASS_SPELLS = {};
export let MONSTERS = {};
export let ENEMY_ICONS = {};
export let PORTRAITS = {};
export let LABELS = {};

onWorld(world => {
  ANCESTRIES = world.ancestries;
  CLASSES = world.classes;
  BACKGROUNDS = world.backgrounds;
  WEAPONS = world.weapons;
  ARMORS = world.armors;
  SHIELD = world.shield;
  ITEMS = world.items;
  SPELLS = world.spells;
  CLASS_SPELLS = world.classSpells;
  MONSTERS = world.monsters;
  ENEMY_ICONS = world.enemyIcons || {};
  PORTRAITS = world.portraits || {};
  LABELS = world.labels || {};
});

/* --------------------------------------------------------------- lookups */

export const ancestryById = id => ANCESTRIES.find(a => a.id === id) || ANCESTRIES[0];
export const classById = id => CLASSES.find(c => c.id === id) || CLASSES[0];
export const backgroundById = id => BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
export const monsterById = id => MONSTERS[id] || null;
export const spellById = id => SPELLS[id] || null;
export const weaponById = id => WEAPONS[id] || null;
export const armorById = id => ARMORS[id] || null;
export const itemById = id => ITEMS[id] || null;

/** What a word is called in this setting: label('spell') → 呪文 ／ プログラム */
export const label = (key, fallback = '') => LABELS[key] ?? fallback;

/* ------------------------------------------------------------ calculation */

/** Sneak attack scales with level: 1d6 at 1–2, 2d6 at 3–4, and so on. */
export const sneakAttackDice = level => `${Math.ceil(Math.max(1, level) / 2)}d6`;

/** Slots per spell level for a caster of the given class level. */
export function spellSlots(level, halfCaster = false) {
  const effective = halfCaster ? Math.ceil(level / 2) : level;
  const table = {
    1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 },
    5: { 1: 4, 2: 3, 3: 2 }, 6: { 1: 4, 2: 3, 3: 3 },
    7: { 1: 4, 2: 3, 3: 3, 4: 1 }, 8: { 1: 4, 2: 3, 3: 3, 4: 2 },
    9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  };
  return table[Math.min(10, Math.max(1, effective))] || { 1: 2 };
}

/* 手ごわさ（CR）と経験点の対応。工房で敵を作るとき、CR を選べば経験点が
   決まるようにするために置いてある。ここがずれると、想定難易度の表示も、
   倒したときに配る経験点も、まとめて狂う。 */
export const CR_XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
};

/** その手ごわさの敵は何点ぶんか。表にない値は近いほうへ寄せる。 */
export function xpForCr(cr) {
  if (CR_XP[cr] !== undefined) return CR_XP[cr];
  const steps = Object.keys(CR_XP).map(Number).sort((a, b) => a - b);
  const near = steps.reduce((best, c) => (Math.abs(c - cr) < Math.abs(best - cr) ? c : best), steps[0]);
  return CR_XP[near];
}

/**
 * Rough encounter budget: sum of XP scaled by party size.
 * @param {object} [extra] シナリオが自前で持っている敵。世界の敵より先に見る。
 */
export function encounterDifficulty(monsterIds, partyLevel = 1, partySize = 1, extra = {}) {
  const xp = monsterIds.reduce((s, id) => s + ((extra[id] || monsterById(id))?.xp || 0), 0);
  const multiplier = monsterIds.length >= 5 ? 2 : monsterIds.length >= 3 ? 1.5 : monsterIds.length === 2 ? 1.25 : 1;
  const adjusted = xp * multiplier;
  const budgetPerChar = { 1: 25, 2: 50, 3: 75, 4: 125, 5: 250 }[Math.min(5, partyLevel)] || 250;
  const easy = budgetPerChar * partySize;
  if (adjusted <= easy) return { level: 'easy', name: '楽勝', xp, adjusted };
  if (adjusted <= easy * 2) return { level: 'medium', name: '手応えあり', xp, adjusted };
  if (adjusted <= easy * 3) return { level: 'hard', name: '苦戦', xp, adjusted };
  return { level: 'deadly', name: '致命的', xp, adjusted };
}
