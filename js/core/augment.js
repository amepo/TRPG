/* サイバーウェア — 体に入れるほど強くなるが、体は無限には受け付けない。

   改造ごとに strain（負荷）があり、合計が適合値を超えたぶんだけ、すべての
   判定・セーヴ・攻撃にペナルティがつく（rules.js の strainPenalty）。
   「入れるか、抑えるか」を毎回選ばせるのがこの仕組みの目的。

   世界観が augments を持たない場合（ファンタジーなど）、この層は何もしない。 */

import { activeWorld } from '../worlds/index.js';
import { abilityMod } from './rules.js';

/** この世界に用意されている改造の一覧。無い世界では空。 */
export const catalogue = () => Object.values(activeWorld().augments || {});

export const augmentById = id => (activeWorld().augments || {})[id] || null;

/** この世界に改造の概念があるか。UI の出し分けに使う。 */
export const hasAugments = () => Object.keys(activeWorld().augments || {}).length > 0;

/**
 * 耐えられる負荷の上限。耐性（con）と経験（レベル）で伸びる。
 * 3 + 耐性修正 + floor(レベル / 2)
 */
export function strainCapacity(character) {
  return Math.max(1, 3 + abilityMod(character.abilities?.con ?? 10) + Math.floor((character.level || 1) / 2));
}

/** 現在の合計負荷。 */
export const strainUsed = character =>
  (character.augments || []).reduce((sum, id) => sum + (augmentById(id)?.strain || 0), 0);

/** 超過ぶん。0 なら健全。 */
export const strainOver = character =>
  Math.max(0, strainUsed(character) - strainCapacity(character));

/**
 * 改造を入れる。上限を超えても入れられるが、超過ぶんのペナルティを負う。
 * @returns {{ok:boolean, reason?:string, over?:number}}
 */
export function install(character, id) {
  const augment = augmentById(id);
  if (!augment) return { ok: false, reason: 'その改造は存在しません' };
  character.augments = character.augments || [];
  if (character.augments.includes(id)) return { ok: false, reason: 'すでに入っています' };

  character.augments.push(id);
  return { ok: true, over: strainOver(character) };
}

/** 摘出する。負荷は戻るが、費用はふつう戻らない。 */
export function remove(character, id) {
  if (!character.augments?.includes(id)) return { ok: false, reason: '入っていません' };
  character.augments = character.augments.filter(a => a !== id);
  return { ok: true, over: strainOver(character) };
}

/**
 * 装着中の改造がキャラクターに与えるものを一つにまとめる。
 * recalculate() から呼ばれ、AC・技能・攻撃などに反映される。
 */
export function aggregate(character) {
  const out = {
    acBonus: 0,
    initiativeBonus: 0,
    attackBonus: 0,
    hpPerLevel: 0,
    skillBonus: {},
    resistances: [],
    immunities: [],
    keywords: [],
    attacks: [],
  };
  for (const id of character.augments || []) {
    const effect = augmentById(id)?.effect;
    if (!effect) continue;
    out.acBonus += effect.acBonus || 0;
    out.initiativeBonus += effect.initiativeBonus || 0;
    out.attackBonus += effect.attackBonus || 0;
    out.hpPerLevel += effect.hpPerLevel || 0;
    for (const [skill, value] of Object.entries(effect.skillBonus || {})) {
      out.skillBonus[skill] = (out.skillBonus[skill] || 0) + value;
    }
    out.resistances.push(...(effect.resistances || []));
    out.immunities.push(...(effect.immunities || []));
    out.keywords.push(...(effect.keywords || []));
    if (effect.attack) out.attacks.push(effect.attack);
  }
  return out;
}

/** シートに出す一行サマリ。 */
export function summary(character) {
  const used = strainUsed(character);
  const capacity = strainCapacity(character);
  const over = Math.max(0, used - capacity);
  return {
    used, capacity, over,
    installed: (character.augments || []).map(augmentById).filter(Boolean),
    state: over > 0 ? 'over' : used >= capacity ? 'full' : 'ok',
    note: over > 0
      ? `適合度を ${over} 超過 — すべての判定と攻撃に −${over}`
      : `残り ${capacity - used}`,
  };
}
