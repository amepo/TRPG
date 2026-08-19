/* The d20 rules layer.

   Pure functions over character/monster objects — no DOM, no storage, no
   randomness except through the Rng handed in. Everything the UI shows about
   a roll (the die, the modifiers, why it hit) comes back in the result object
   so the log can explain itself. */

import { roll } from './dice.js';
import { onWorld } from '../worlds/index.js';
import { traitPassives, canRerollOnes } from './traits.js';

/* ---------------------------------------------- abilities and skills */

/* Both lists belong to the world, not to the rules: a setting may rename
   "魔法学" to "電脳理論" or swap a skill out entirely. The ids are the stable
   part — scenarios reference those. */

export let ABILITIES = [];
export let ABILITY_IDS = [];
export let SKILLS = [];

onWorld(world => {
  ABILITIES = world.abilities;
  ABILITY_IDS = world.abilities.map(a => a.id);
  SKILLS = world.skills;
});

export const abilityName = id => ABILITIES.find(a => a.id === id)?.name || id;

/** −5 … +10 for scores 1 … 30. */
export const abilityMod = score => Math.floor((Number(score) - 10) / 2);

/** Signed text for display: +3 / −1 / +0 */
export const signed = n => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** Levels 1–4 → +2, 5–8 → +3, and so on. */
export const proficiencyBonus = level => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export const skillById = id => SKILLS.find(s => s.id === id) || null;
export const skillName = id => skillById(id)?.name || id;

/* ------------------------------------------------------------ difficulties */

export const DIFFICULTY = [
  { dc: 5, name: 'ごく易しい' },
  { dc: 10, name: '易しい' },
  { dc: 12, name: 'やや易しい' },
  { dc: 15, name: '普通' },
  { dc: 18, name: '難しい' },
  { dc: 20, name: 'かなり難しい' },
  { dc: 25, name: '至難' },
  { dc: 30, name: 'ほぼ不可能' },
];

export const difficultyName = dc => {
  let best = DIFFICULTY[0];
  for (const d of DIFFICULTY) if (dc >= d.dc) best = d;
  return best.name;
};

/* ------------------------------------------------------------- conditions */

export const CONDITIONS = {
  prone: { name: '伏せ', desc: '近接攻撃は有利、遠隔攻撃は不利を受ける' },
  grappled: { name: '組みつかれ', desc: '移動できない' },
  frightened: { name: '恐怖', desc: '判定と攻撃に不利' },
  poisoned: { name: '毒', desc: '判定と攻撃に不利' },
  blinded: { name: '盲目', desc: '攻撃に不利、被攻撃は有利' },
  restrained: { name: '拘束', desc: '攻撃に不利、被攻撃は有利、移動不可' },
  stunned: { name: '朦朧', desc: '行動不能、被攻撃は有利' },
  unconscious: { name: '無力化', desc: '行動不能、被攻撃は有利で自動的に命中' },
  blessed: { name: '祝福', desc: '攻撃とセーヴに +1d4' },
  hasted: { name: '加速', desc: '追加の攻撃、AC +2' },
  guided: { name: '導き', desc: '次の能力判定に +1d4' },
};

/** Conditions that stop a creature acting at all. */
export const INCAPACITATING = ['stunned', 'unconscious'];
/** Conditions that impose disadvantage on the creature's own rolls. */
const SELF_DISADVANTAGE = ['frightened', 'poisoned', 'blinded', 'restrained'];
/** Conditions that give attackers advantage against the creature. */
const GRANTS_ADVANTAGE = ['stunned', 'unconscious', 'restrained'];

export const hasCondition = (c, id) => !!c?.conditions?.some(x => (x.id || x) === id);
export const isIncapacitated = c => INCAPACITATING.some(id => hasCondition(c, id)) || (c?.hp ?? 1) <= 0;

/** Combine advantage and disadvantage: one of each cancels out. */
export function resolveMode({ advantage = false, disadvantage = false } = {}) {
  if (advantage && disadvantage) return null;
  if (advantage) return 'adv';
  if (disadvantage) return 'dis';
  return null;
}

/* -------------------------------------------------------------- modifiers */

/* Gear and implants can push a single skill up, and a body carrying more
   hardware than it can take drags everything down. Both are plain numbers
   stored on the character by recalculate(), so the rules layer stays free of
   any world-specific notion of what an implant is. */
const strainPenalty = actor => actor.strainOver || 0;
const gearBonus = (actor, skillId) => actor.skillBonus?.[skillId] || 0;

/** Ability modifier plus proficiency if the creature is trained in `skill`. */
export function skillMod(actor, skillId) {
  const skill = skillById(skillId);
  const ability = skill ? skill.ability : skillId;      // allow a raw ability id
  let mod = abilityMod(actor.abilities?.[ability] ?? 10);
  const pb = proficiencyBonus(actor.level || 1);
  if (skill && actor.skills?.includes(skillId)) mod += pb;
  if (skill && actor.expertise?.includes(skillId)) mod += pb;   // doubled proficiency
  return mod + gearBonus(actor, skillId) - strainPenalty(actor);
}

export function saveMod(actor, ability) {
  let mod = abilityMod(actor.abilities?.[ability] ?? 10);
  if (actor.saves?.includes(ability)) mod += proficiencyBonus(actor.level || 1);
  return mod - strainPenalty(actor);
}

/** Passive score — used for "does the character notice it" without a roll. */
export function passive(actor, skillId) {
  let value = 10 + skillMod(actor, skillId);
  if (SELF_DISADVANTAGE.some(id => hasCondition(actor, id))) value -= 5;
  return value;
}

/* 出目1を一度だけ振り直せる特性（ハーフリングの幸運など）。使い切りは
   creature.luckUsed で持ち、休憩で戻る。振り直しは有利／不利の別を引き継ぐ。 */
function rerollOnes(actor, result, { rng, mode, extras } = {}) {
  if (result.natural !== 1 || actor?.luckUsed || !canRerollOnes(actor)) return result;
  actor.luckUsed = true;
  const again = roll(result.source, { rng, mode });
  extras?.push('幸運：振り直し');
  return again;
}

/* ------------------------------------------------------------------ rolls */

/**
 * Ability or skill check against a DC.
 * @returns {{kind:'check', total:number, natural:number, dc:number,
 *            success:boolean, crit:boolean, fumble:boolean, margin:number, text:string}}
 */
export function check(actor, skillId, dc, opts = {}) {
  const { rng, advantage = false, disadvantage = false, bonus = 0 } = opts;
  const passives = traitPassives(actor);
  const adv = advantage || passives.skillAdvantage.includes(skillId);
  // 代償の側も同じだけ数える。有利だけ効いて不利が効かないなら、代償ではない。
  const dis = disadvantage || passives.skillDisadvantage.includes(skillId)
    || SELF_DISADVANTAGE.some(id => hasCondition(actor, id));
  const mode = resolveMode({ advantage: adv, disadvantage: dis });

  let mod = skillMod(actor, skillId) + bonus;
  const extras = [];
  if (hasCondition(actor, 'guided')) {
    const guide = roll('1d4', { rng });
    mod += guide.total;
    extras.push(`導き +${guide.total}`);
  }

  let r = roll(`1d20${mod < 0 ? '-' : '+'}${Math.abs(mod)}`, { rng, mode });
  r = rerollOnes(actor, r, { rng, mode, extras });
  const natural = r.natural;
  const total = r.total;
  return {
    kind: 'check',
    actor: actor.name,
    skill: skillId,
    label: skillName(skillId),
    mod, dc, total, natural,
    success: total >= dc,
    crit: natural === 20,
    fumble: natural === 1,
    margin: total - dc,
    mode,
    extras,
    text: `${actor.name}の【${skillName(skillId)}】 ${r.text} vs DC${dc} → ${total >= dc ? '成功' : '失敗'}`,
  };
}

/** Saving throw — same maths, different label. */
/* 持ち物が与える有利。護符に「所持者は恐怖セーヴに有利」と書いてあるのに、
   セーヴは特性と装備しか見ていなかった——持っているだけで効くものが、
   一つも効いていなかった。持ち物は冒険中に増えるので、作成時に畳まずここで見る。 */
export const carriedSaveAdvantage = actor => [
  ...(actor?.inventory || []).flatMap(i => (i.count > 0 ? i.saveAdvantageVs || [] : [])),
  ...Object.values(actor?.equipped || {}).flatMap(i => i?.saveAdvantageVs || []),
];

export function savingThrow(actor, ability, dc, opts = {}) {
  const { rng, advantage = false, disadvantage = false, bonus = 0, vs = null } = opts;
  // `vs` names what the save is against (毒、魅了…) so a trait can grant an
  // edge against that specific thing rather than against every save.
  // 有利の出どころは特性と装備の両方。作成時に畳んだ値があればそれを使う。
  const passives = traitPassives(actor);
  const adv = advantage || (vs && (
    actor.saveAdvantageVs?.includes(vs) || passives.saveAdvantageVs.includes(vs)
    || carriedSaveAdvantage(actor).includes(vs)
  ));
  const dis = disadvantage || (vs && passives.saveDisadvantageVs.includes(vs))
    || SELF_DISADVANTAGE.some(id => hasCondition(actor, id));
  const mode = resolveMode({ advantage: adv, disadvantage: dis });
  let mod = saveMod(actor, ability) + bonus;
  if (hasCondition(actor, 'blessed')) mod += roll('1d4', { rng }).total;

  let r = roll(`1d20${mod < 0 ? '-' : '+'}${Math.abs(mod)}`, { rng, mode });
  r = rerollOnes(actor, r, { rng, mode });
  return {
    kind: 'save',
    actor: actor.name,
    ability,
    label: `${abilityName(ability)}セーヴ`,
    mod, dc, total: r.total, natural: r.natural,
    success: r.total >= dc,
    crit: r.natural === 20,
    fumble: r.natural === 1,
    margin: r.total - dc,
    mode,
    text: `${actor.name}の《${abilityName(ability)}セーヴ》 ${r.text} vs DC${dc} → ${r.total >= dc ? '成功' : '失敗'}`,
  };
}

/**
 * Attack roll against a target's AC.
 * A natural 20 always hits and crits; a natural 1 always misses.
 */
export function attackRoll(attacker, target, attack, opts = {}) {
  const { rng, advantage = false, disadvantage = false } = opts;
  const adv = advantage || GRANTS_ADVANTAGE.some(id => hasCondition(target, id));
  // 重火器は反動を支える体格が要る。足りなければ狙いが逸れる。
  const tooLight = !!attack.heavy && (attacker.abilities?.str ?? 10) < 13;
  const dis = disadvantage || tooLight
    || SELF_DISADVANTAGE.some(id => hasCondition(attacker, id));
  const mode = resolveMode({ advantage: adv, disadvantage: dis });

  let mod = attackBonus(attacker, attack);
  if (hasCondition(attacker, 'blessed')) mod += roll('1d4', { rng }).total;

  let r = roll(`1d20${mod < 0 ? '-' : '+'}${Math.abs(mod)}`, { rng, mode });
  r = rerollOnes(attacker, r, { rng, mode });
  const ac = armorClass(target);
  const crit = r.natural === 20;
  const fumble = r.natural === 1;
  const hit = crit || (!fumble && r.total >= ac);
  return {
    kind: 'attack',
    actor: attacker.name,
    target: target.name,
    attack: attack.name,
    mod, ac, total: r.total, natural: r.natural,
    hit, crit, fumble, mode,
    text: `${attacker.name}の${attack.name} ${r.text} vs AC${ac} → ${crit ? 'クリティカル！' : hit ? '命中' : '外れ'}`,
  };
}

/** To-hit modifier: ability + proficiency (+ any weapon bonus). */
export function attackBonus(actor, attack) {
  if (typeof attack.bonus === 'number') return attack.bonus;          // monsters state it flat
  const ability = attack.ability || 'str';
  const pb = attack.proficient === false ? 0 : proficiencyBonus(actor.level || 1);
  const gear = attack.ranged ? (actor.attackMod || 0) : 0;            // e.g. a smartlink
  return abilityMod(actor.abilities?.[ability] ?? 10) + pb + (attack.magic || 0)
    + gear - strainPenalty(actor);
}

/** Damage; a critical hit rolls the dice twice and keeps the flat parts once. */
export function damageRoll(attacker, attack, { rng, crit = false } = {}) {
  const base = roll(attack.damage || '1d4', { rng });
  let total = base.total;
  const parts = [base.text];

  if (crit) {
    const extra = roll(stripFlat(attack.damage || '1d4'), { rng });
    total += extra.total;
    parts.push(`追加 ${extra.text}`);
  }
  const ability = attack.ability;
  if (ability && attack.bonus === undefined) {
    const mod = abilityMod(attacker.abilities?.[ability] ?? 10) + (attack.magic || 0);
    total += mod;
    if (mod) parts.push(signed(mod));
  }
  total = Math.max(0, total);
  return { total, type: attack.type || '物理', text: `${parts.join(' ')} → ${total} ダメージ` };
}

/** "1d8+3" → "1d8": the dice half of an expression, for crit extras. */
function stripFlat(expr) {
  const kept = String(expr).match(/[+-]?\s*\d*d\d+(?:k[hl]\d+)?!?/gi) || ['0'];
  return kept.join('').replace(/^\+/, '') || '0';
}

/* ---------------------------------------------------------- defence & hp */

export function armorClass(creature) {
  if (creature.acOverride !== undefined && creature.acOverride !== null) return creature.acOverride;
  let ac = 10 + abilityMod(creature.abilities?.dex ?? 10);
  const armor = creature.equipped?.armor;
  if (armor) {
    const dex = abilityMod(creature.abilities?.dex ?? 10);
    const capped = armor.maxDex === undefined ? dex : Math.min(dex, armor.maxDex);
    ac = armor.base + capped;
  }
  if (creature.equipped?.shield) ac += creature.equipped.shield.ac ?? 2;
  ac += creature.acBonus || 0;
  if (hasCondition(creature, 'hasted')) ac += 2;
  return ac;
}

/** Apply damage, honouring temporary hit points and resistances. */
export function applyDamage(creature, amount, type = '物理', { pierce = false } = {}) {
  let remaining = Math.max(0, Math.round(amount));
  const before = creature.hp;

  // `pierce` は抵抗・免疫を素通りする攻撃（電脳を焼く防壁など）。
  if (!pierce) {
    if (creature.resistances?.includes(type)) remaining = Math.floor(remaining / 2);
    if (creature.immunities?.includes(type)) remaining = 0;
  }
  if (creature.vulnerabilities?.includes(type)) remaining *= 2;

  // `dealt` is what got past resistances; `hpLost` is what actually came off
  // hit points once temporary ones soaked their share.
  const dealt = remaining;
  let absorbed = 0;
  if (creature.tempHp > 0) {
    absorbed = Math.min(creature.tempHp, remaining);
    creature.tempHp -= absorbed;
    remaining -= absorbed;
  }
  creature.hp = Math.max(0, creature.hp - remaining);

  const downed = before > 0 && creature.hp === 0;
  if (downed) {
    creature.deathSaves = { success: 0, fail: 0 };
    if (!creature.monster) addCondition(creature, 'unconscious');
    // Damage that exceeds the maximum outright kills.
    if (remaining - before >= creature.maxHp) creature.dead = true;
  }
  return { dealt, hpLost: remaining, absorbed, downed, hp: creature.hp, dead: !!creature.dead };
}

export function heal(creature, amount) {
  if (creature.dead) return { healed: 0, revived: false };
  const before = creature.hp;
  creature.hp = Math.min(creature.maxHp, creature.hp + Math.max(0, Math.round(amount)));
  const revived = before === 0 && creature.hp > 0;
  if (revived) {
    creature.deathSaves = { success: 0, fail: 0 };
    removeCondition(creature, 'unconscious');
  }
  return { healed: creature.hp - before, revived };
}

/** Rolled when a downed character starts its turn. Three of either ends it. */
export function deathSave(creature, { rng } = {}) {
  const r = roll('1d20', { rng });
  creature.deathSaves = creature.deathSaves || { success: 0, fail: 0 };
  const saves = creature.deathSaves;
  let text;

  if (r.natural === 20) {
    heal(creature, 1);
    saves.success = 0; saves.fail = 0;
    text = `${creature.name}は自力で意識を取り戻した！（ナチュラル20）`;
  } else if (r.natural === 1) {
    saves.fail += 2;
    text = `${creature.name}の死亡セーヴ 大失敗（失敗 ${Math.min(3, saves.fail)}/3）`;
  } else if (r.total >= 10) {
    saves.success += 1;
    text = `${creature.name}の死亡セーヴ 成功（成功 ${Math.min(3, saves.success)}/3）`;
  } else {
    saves.fail += 1;
    text = `${creature.name}の死亡セーヴ 失敗（失敗 ${Math.min(3, saves.fail)}/3）`;
  }

  if (saves.fail >= 3) { creature.dead = true; text += ' — 力尽きた…'; }
  if (saves.success >= 3) { creature.stable = true; text += ' — 容体は安定した'; }
  return { ...r, kind: 'death', text, dead: !!creature.dead, stable: !!creature.stable };
}

/* ----------------------------------------------------------- conditions */

export function addCondition(creature, id, { rounds = null, dc = null, save = null } = {}) {
  // 特性で免疫を持っているなら、そもそも付かない。
  const immune = creature.conditionImmunities?.includes(id)
    || traitPassives(creature).conditionImmunities.includes(id);
  if (immune) return null;
  creature.conditions = creature.conditions || [];
  const existing = creature.conditions.find(c => c.id === id);
  if (existing) {
    if (rounds !== null) existing.rounds = Math.max(existing.rounds ?? 0, rounds);
    return existing;
  }
  const entry = { id, rounds, dc, save };
  creature.conditions.push(entry);
  return entry;
}

export function removeCondition(creature, id) {
  if (!creature.conditions) return false;
  const before = creature.conditions.length;
  creature.conditions = creature.conditions.filter(c => c.id !== id);
  return creature.conditions.length !== before;
}

/** Tick durations at the end of a creature's turn; returns what expired. */
export function tickConditions(creature) {
  if (!creature.conditions?.length) return [];
  const expired = [];
  creature.conditions = creature.conditions.filter(c => {
    if (c.rounds === null || c.rounds === undefined) return true;
    c.rounds -= 1;
    if (c.rounds > 0) return true;
    expired.push(c.id);
    return false;
  });
  return expired;
}

/* ---------------------------------------------------------------- resting */

/** A breather: spend hit dice to recover, regain per-encounter resources. */
export function shortRest(creature, diceSpent = 1, { rng } = {}) {
  const available = Math.max(0, creature.hitDice ?? 0);
  const spend = Math.min(diceSpent, available);
  let healed = 0;
  for (let i = 0; i < spend; i++) {
    const r = roll(creature.hitDie || '1d8', { rng });
    healed += heal(creature, r.total + abilityMod(creature.abilities?.con ?? 10)).healed;
  }
  creature.hitDice = available - spend;
  return { healed, spent: spend };
}

/** A full night: hit points, half the hit dice, and all spell slots. */
export function longRest(creature) {
  const before = creature.hp;
  creature.hp = creature.maxHp;
  creature.tempHp = 0;
  creature.hitDice = Math.min(creature.level || 1, (creature.hitDice ?? 0) + Math.max(1, Math.floor((creature.level || 1) / 2)));
  creature.conditions = [];                       // a night's sleep clears everything
  creature.deathSaves = { success: 0, fail: 0 };
  creature.stable = false;
  if (creature.slots) for (const k of Object.keys(creature.slots)) creature.slots[k].used = 0;
  return { healed: creature.hp - before };
}

/* --------------------------------------------------------------- levelling */

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000];

export function levelForXp(xp) {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  return Math.min(level, 10);
}

export function xpToNext(xp) {
  const level = levelForXp(xp);
  if (level >= 10) return null;
  return XP_THRESHOLDS[level] - xp;
}
