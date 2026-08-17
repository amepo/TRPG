/* Turn-based combat.

   Combat is a state machine the UI drives one action at a time:
     start()  → rolls initiative and builds the turn order
     act()    → resolves the player's chosen action, then advances
     enemyTurn() → the small AI picks and resolves one enemy action
   Every call returns log entries; the caller never has to guess what happened. */

import { roll } from './dice.js';
import { Rng } from './rng.js';
import {
  attackRoll, damageRoll, applyDamage, heal, savingThrow, check, armorClass,
  addCondition, removeCondition, tickConditions, hasCondition, isIncapacitated,
  deathSave, abilityMod, proficiencyBonus,
} from './rules.js';
import { monsterById, sneakAttackDice, spellById, SPELLS } from './content.js';
import {
  traitAttackMods, traitAbsorb, traitSurvive, traitTurnStart, traitActions, auraFrom,
} from './traits.js';
import { attackOptions, spellOptions, useSlot, removeItem } from './character.js';

let instanceCount = 0;

/** Build a live combatant from a monster template. */
export function spawnMonster(id, { rng = new Rng(), suffix = '', override = {} } = {}) {
  const template = typeof id === 'string' ? monsterById(id) : id;
  if (!template) throw new Error(`未知のモンスター: ${id}`);
  const maxHp = template.hp ? roll(template.hp, { rng }).total : (template.hpAvg || 10);
  return {
    ...structuredClone(template),
    ...override,
    uid: `m${++instanceCount}`,
    monster: true,
    name: suffix ? `${template.name}${suffix}` : template.name,
    level: Math.max(1, Math.round(template.cr || 1)),
    maxHp, hp: maxHp, tempHp: 0,
    conditions: [],
    side: 'enemy',
  };
}

/**
 * Turn a group spec into combatants: ['goblin', 'goblin', 'wolf'] → named A/B.
 * @param {string[]} ids
 * @param {object} [rng]
 * @param {(id:string)=>string|object} [resolve] id から雛形を引き当てる。
 *   シナリオが自前の敵を持っているとき、そちらを先に見るために渡す。
 */
export function spawnGroup(ids, rng = new Rng(), resolve = id => id) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  const seen = {};
  const letters = 'ＡＢＣＤＥＦＧＨ';
  return ids.map(id => {
    seen[id] = (seen[id] || 0) + 1;
    const suffix = counts[id] > 1 ? letters[seen[id] - 1] : '';
    return spawnMonster(resolve(id), { rng, suffix });
  });
}

export class Combat {
  /**
   * @param {object[]} party  player characters (mutated in place)
   * @param {object[]} enemies spawned monsters
   * @param {object} [opts] {rng, surprise: 'party'|'enemy'|null, title, onLog}
   */
  constructor(party, enemies, opts = {}) {
    this.rng = opts.rng || new Rng();
    this.party = party;
    this.enemies = enemies;
    this.title = opts.title || '戦闘';
    this.surprise = opts.surprise || null;
    this.round = 0;
    this.turnIndex = 0;
    this.order = [];
    this.log = [];
    this.over = false;
    this.result = null;
    this.onLog = opts.onLog || null;
    for (const pc of party) pc.side = 'party';
  }

  /* ------------------------------------------------------------ plumbing */

  say(text, kind = 'info', extra = {}) {
    const entry = { text, kind, round: this.round, at: Date.now(), ...extra };
    this.log.push(entry);
    this.onLog?.(entry);
    return entry;
  }

  get combatants() { return [...this.party, ...this.enemies]; }
  get current() { return this.order[this.turnIndex] || null; }
  get livingParty() { return this.party.filter(c => c.hp > 0 && !c.dead); }
  get livingEnemies() { return this.enemies.filter(c => c.hp > 0); }
  get isPlayerTurn() { return this.current?.side === 'party' && !this.over; }

  byUid(uid) { return this.combatants.find(c => (c.uid || c.id) === uid) || null; }

  /* 特性フックが陣営を尋ねるための小さな窓。「味方」は自分を除いた同じ側。 */
  sideOf(c) { return c?.side === 'party' ? this.party : this.enemies; }
  alliesOf(c) { return this.sideOf(c).filter(x => x !== c && x.hp > 0 && !x.dead && !x.fled); }
  foesOf(c) { return (c?.side === 'party' ? this.enemies : this.party).filter(x => x.hp > 0 && !x.dead); }

  /* --------------------------------------------------------------- setup */

  start() {
    this.round = 1;
    this.order = this.combatants
      .map(c => {
        const init = roll(`1d20${initiativeMod(c) < 0 ? '-' : '+'}${Math.abs(initiativeMod(c))}`, { rng: this.rng });
        return { c, init: init.total, tie: this.rng.float() };
      })
      .sort((a, b) => b.init - a.init || b.tie - a.tie)
      .map(e => e.c);

    this.say(`— ${this.title} 開始 —`, 'header');
    this.say(`行動順: ${this.order.map(c => c.name).join(' → ')}`, 'muted');

    if (this.surprise === 'party') this.say('不意打ち成功！敵は最初のラウンド行動できない。', 'good');
    if (this.surprise === 'enemy') this.say('不意を突かれた！こちらは最初のラウンド行動できない。', 'bad');

    this.turnIndex = -1;
    return this.advance();
  }

  /* -------------------------------------------------------------- flow */

  /** Move to the next combatant, skipping the dead and running upkeep. */
  advance() {
    if (this.over) return this.finish();

    for (let guard = 0; guard < 200; guard++) {
      this.turnIndex += 1;
      if (this.turnIndex >= this.order.length) {
        this.turnIndex = 0;
        this.round += 1;
        this.say(`— ラウンド ${this.round} —`, 'header');
      }
      const actor = this.current;
      if (!actor) break;
      if (actor.dead || actor.fled || (actor.monster && actor.hp <= 0)) continue;

      // A surprised side loses its first turn.
      if (this.round === 1 && this.surprise === 'enemy' && actor.side === 'party') continue;
      if (this.round === 1 && this.surprise === 'party' && actor.side === 'enemy') continue;

      this.startTurn(actor);
      if (this.checkEnd()) return this.finish();
      if (actor.hp <= 0 || isIncapacitated(actor)) continue;     // downed or stunned: skip
      return { done: false, actor, playerTurn: actor.side === 'party' };
    }
    return this.finish();
  }

  startTurn(actor) {
    actor.actedThisTurn = false;
    actor.usedSurge = false;
    if (actor.side === 'party' && actor.hp <= 0 && !actor.dead && !actor.stable) {
      const save = deathSave(actor, { rng: this.rng });
      this.say(save.text, save.dead ? 'bad' : save.total >= 10 ? 'good' : 'bad');
      return;
    }
    if (isIncapacitated(actor) && actor.hp > 0) {
      const blocked = actor.conditions.find(c => ['stunned', 'unconscious'].includes(c.id));
      this.say(`${actor.name}は${blocked ? conditionName(blocked.id) : '行動不能'}で動けない。`, 'muted');
    }
    this.runTurnStartTraits(actor);
    // Marks and buffs tick down at the top of the owner's turn.
    const expired = tickConditions(actor);
    for (const id of expired) this.say(`${actor.name}の${conditionName(id)}が解けた。`, 'muted');
  }

  checkEnd() {
    if (!this.livingEnemies.length) { this.over = true; this.result = 'victory'; return true; }
    if (!this.livingParty.length) { this.over = true; this.result = 'defeat'; return true; }
    return false;
  }

  finish() {
    if (!this.result) this.result = this.livingEnemies.length ? 'fled' : 'victory';
    const xp = this.enemies.reduce((s, e) => s + (e.xp || 0), 0);
    if (this.result === 'victory') this.say(`— 勝利！ 経験点 ${xp} —`, 'good');
    else if (this.result === 'defeat') this.say('— 全滅… —', 'bad');
    else this.say('— 戦闘終了 —', 'header');
    return { done: true, result: this.result, xp, log: this.log };
  }

  /* ------------------------------------------------------- player actions */

  /** What the current character can do this turn. */
  options(actor = this.current) {
    if (!actor || actor.side !== 'party') return [];
    const out = [];
    for (const atk of attackOptions(actor)) {
      out.push({ kind: 'attack', id: atk.id, name: `${atk.name}で攻撃`, attack: atk });
    }
    for (const spell of spellOptions(actor)) {
      out.push({
        kind: 'spell', id: spell.id,
        name: `《${spell.name}》${spell.level ? `（${spell.level}レベル枠）` : '（初級）'}`,
        spell, disabled: !spell.available, target: spell.target,
      });
    }
    for (const item of actor.inventory || []) {
      if (item.use) out.push({ kind: 'item', id: item.id, name: `${item.name}を使う（×${item.count}）`, item });
    }
    for (const feature of actor.features || []) {
      const res = actor.resources?.[feature.id];
      if (feature.id === 'secondWind' && res && res.used < res.max) {
        out.push({ kind: 'feature', id: 'secondWind', name: '再起（自己回復）' });
      }
      if (feature.id === 'channelHeal' && res && res.used < res.max) {
        out.push({ kind: 'feature', id: 'channelHeal', name: '癒しの手（味方を回復）', target: 'ally' });
      }
    }
    for (const t of traitActions(actor)) {
      const used = actor.resources?.[t.id]?.used ?? 0;
      if (used < (t.action.uses || 1)) out.push({ kind: 'trait', id: t.id, name: t.action.name });
    }
    out.push({ kind: 'dodge', id: 'dodge', name: '回避に専念（次の被攻撃に不利）' });
    out.push({ kind: 'help', id: 'help', name: '味方を援護（次の攻撃に有利）', target: 'ally' });
    if (this.canFlee()) out.push({ kind: 'flee', id: 'flee', name: '逃走を試みる' });
    return out;
  }

  canFlee() { return this.round >= 2; }

  /**
   * Resolve one player action.
   * @param {object} action {kind, id, targetUid}
   */
  act(action) {
    const actor = this.current;
    if (!actor || actor.side !== 'party' || this.over) return { error: '今は行動できません' };
    const target = action.targetUid ? this.byUid(action.targetUid) : null;

    switch (action.kind) {
      case 'attack': return this.doAttack(actor, target, action);
      case 'spell': return this.doSpell(actor, target, action);
      case 'item': return this.doItem(actor, target, action);
      case 'feature': return this.doFeature(actor, target, action);
      case 'trait': return this.doTrait(actor, action);
      case 'dodge':
        addCondition(actor, 'dodging', { rounds: 1 });
        this.say(`${actor.name}は身構えた。次に受ける攻撃は不利になる。`, 'info');
        return this.endTurn();
      case 'help':
        if (target) { addCondition(target, 'helped', { rounds: 1 }); this.say(`${actor.name}は${target.name}を援護した。`, 'info'); }
        return this.endTurn();
      case 'flee': return this.doFlee(actor);
      default: return { error: '不明な行動です' };
    }
  }

  doAttack(actor, target, action) {
    if (!target || target.hp <= 0) return { error: '対象を選んでください' };
    const attack = action.attack || attackOptions(actor).find(a => a.id === action.id) || attackOptions(actor)[0];
    const swings = 1 + (actor.features?.some(f => f.id === 'extraAttack') ? 1 : 0)
      + (!actor.usedSurge && actor.features?.some(f => f.id === 'surge') && actor.resources?.surge?.used === 0 ? 1 : 0);
    if (swings > 2) { actor.usedSurge = true; actor.resources.surge.used = 1; }

    for (let i = 0; i < swings; i++) {
      const alive = target.hp > 0 ? target : this.livingEnemies[0];
      if (!alive) break;
      this.resolveAttack(actor, alive, attack);
      if (this.checkEnd()) return this.finish();
    }
    return this.endTurn();
  }

  /** One swing: to-hit, damage, riders. Shared by players and monsters. */
  resolveAttack(actor, target, attack, opts = {}) {
    /* 有利・不利は三つの源から来る: 行動（援護・回避）、特性（群れ戦術・
       光への弱さ）、そして味方のオーラ（号令）。特性の分は traits.js が持つ。 */
    const traitMods = traitAttackMods({ self: actor, target, combat: this });
    const rallied = auraFrom(this.alliesOf(actor), 'rally');
    const advantage = opts.advantage || hasCondition(actor, 'helped') || traitMods.advantage || rallied;
    const disadvantage = opts.disadvantage || hasCondition(target, 'dodging') || traitMods.disadvantage;
    removeCondition(actor, 'helped');
    for (const note of traitMods.notes) this.say(`（${note}）`, 'muted');
    if (rallied) this.say('（号令）', 'muted');

    const result = attackRoll(actor, target, attack, { rng: this.rng, advantage, disadvantage });
    this.say(result.text, result.hit ? (actor.side === 'party' ? 'good' : 'bad') : 'muted', { roll: result });
    if (!result.hit) return result;

    const dmg = damageRoll(actor, attack, { rng: this.rng, crit: result.crit });
    let total = dmg.total;
    const notes = [];

    // Rogue: a sneak attack lands when the strike had the edge.
    if (actor.features?.some(f => f.id === 'sneakAttack') && (advantage || this.livingParty.length > 1) && !actor.sneakUsed) {
      const extra = roll(sneakAttackDice(actor.level) + (result.crit ? `+${sneakAttackDice(actor.level)}` : ''), { rng: this.rng });
      total += extra.total;
      actor.sneakUsed = true;
      notes.push(`急所突き ${extra.total}`);
    }
    if (actor.features?.some(f => f.id === 'divineStrike') && !attack.ranged) {
      const extra = roll('1d8', { rng: this.rng });
      total += extra.total;
      notes.push(`神威 ${extra.total}`);
    }
    if (target.marked && actor.side === 'party') {
      const extra = roll('1d6', { rng: this.rng });
      total += extra.total;
      notes.push(`狩人の印 ${extra.total}`);
    }

    // 被弾側の特性（光学迷彩・加護）がここでダメージを書き換える。
    const soak = traitAbsorb({ self: target, attacker: actor, amount: total, type: dmg.type, combat: this });
    for (const note of soak.notes) this.say(note, 'muted');
    total = soak.amount;

    // 貫通する攻撃（致死設定）は、抵抗も免疫も間に入らない。
    const applied = applyDamage(target, total, dmg.type, { pierce: traitMods.pierce });
    this.say(`→ ${target.name}に ${damageText(applied)}${notes.length ? `（${notes.join('・')}）` : ''}｜残りHP ${target.hp}/${target.maxHp}`,
      actor.side === 'party' ? 'good' : 'bad');

    // Riders (knocked prone, poisoned…) mean nothing to someone already down.
    if (attack.onHit && applied.dealt > 0 && target.hp > 0) this.applyRider(actor, target, attack.onHit);
    if (applied.downed && !this.standFast(target)) this.announceDown(target);
    return result;
  }

  applyRider(actor, target, rider) {
    const save = savingThrow(target, rider.save, rider.dc, { rng: this.rng });
    this.say(save.text, save.success ? 'muted' : 'bad');
    if (!save.success) {
      addCondition(target, rider.condition, { rounds: rider.rounds ?? null });
      this.say(`${target.name}は【${conditionName(rider.condition)}】になった。`, 'bad');
    }
  }

  /* 倒れた瞬間に踏みとどまる特性（不死の頑健さ）。踏みとどまったら HP 1 で
     立ったままにする。セーヴはルール層のものを閉じ込めて渡す。 */
  standFast(target) {
    const saved = traitSurvive({
      self: target,
      combat: this,
      save: (ability, dc) => {
        const st = savingThrow(target, ability, dc, { rng: this.rng });
        this.say(st.text, st.success ? 'bad' : 'good');
        return st;
      },
    });
    if (!saved) return false;
    target.hp = 1;
    removeCondition(target, 'unconscious');
    this.say(saved.text, target.side === 'party' ? 'good' : 'bad');
    return true;
  }

  /* 手番の頭で動く特性（臆病の士気、監視ドローンの通報）。 */
  runTurnStartTraits(actor) {
    for (const event of traitTurnStart({ self: actor, combat: this })) {
      if (event.text) this.say(event.text, actor.side === 'party' ? 'bad' : 'good');
      if (event.flee) { actor.hp = 0; actor.fled = true; }
      if (event.reinforce) {
        const help = spawnMonster(event.reinforce, { rng: this.rng, suffix: '（増援）' });
        help.side = actor.side;
        this.sideOf(actor).push(help);
        this.combatants.push(help);
        this.order.push(help);
        this.say(`${help.name}が現れた。`, actor.side === 'party' ? 'good' : 'bad');
      }
    }
    return !actor.fled;
  }

  announceDown(target) {
    if (target.monster) this.say(`${target.name}は倒れた。`, 'good');
    else this.say(`${target.name}は倒れた！ death save が始まる…`, 'bad');
  }

  doSpell(actor, target, action) {
    const spell = spellById(action.id) || action.spell;
    if (!spell) return { error: '不明な呪文です' };
    if (!useSlot(actor, spell.level)) return { error: '呪文スロットが残っていません' };
    this.say(`${actor.name}は《${spell.name}》を唱えた。`, 'info');

    const targets = this.spellTargets(actor, target, spell);
    if (!targets.length) return { error: '対象を選んでください' };
    const effect = spell.effect || {};

    for (const t of targets) {
      if (effect.kind === 'damage') this.spellDamage(actor, t, spell, effect);
      else if (effect.kind === 'heal') {
        const amount = roll(String(effect.amount), { rng: this.rng });
        if (effect.temp) { t.tempHp = Math.max(t.tempHp || 0, amount.total); this.say(`${t.name}は一時HP ${amount.total} を得た。`, 'good'); }
        else { const h = heal(t, amount.total); this.say(`${t.name}のHPが ${h.healed} 回復（${t.hp}/${t.maxHp}）${h.revived ? ' — 意識を取り戻した！' : ''}`, 'good'); }
      } else if (effect.kind === 'condition') {
        const dc = actor.spellDC || 13;
        const save = savingThrow(t, effect.save, dc, { rng: this.rng });
        this.say(save.text, save.success ? 'muted' : 'good');
        if (!save.success) { addCondition(t, effect.condition, { rounds: effect.rounds }); this.say(`${t.name}は【${conditionName(effect.condition)}】になった。`, 'good'); }
      } else if (effect.kind === 'buff') {
        if (effect.condition) addCondition(t, effect.condition, { rounds: effect.rounds });
        if (effect.acBonus) { t.acBonus = (t.acBonus || 0) + effect.acBonus; addCondition(t, 'warded', { rounds: effect.rounds }); }
        this.say(`${t.name}に加護がかかった。`, 'good');
      } else if (effect.kind === 'mark') {
        t.marked = true;
        this.say(`${t.name}に狩人の印がついた。`, 'good');
      } else {
        this.say(`${spell.name}の効果が発動した。`, 'info');
      }
    }
    if (this.checkEnd()) return this.finish();
    return this.endTurn();
  }

  spellDamage(actor, target, spell, effect) {
    const expr = typeof spell.scale === 'function' ? spell.scale(actor.level) : effect.damage;
    if (effect.attack) {
      const hit = attackRoll(actor, target, { name: spell.name, bonus: actor.spellAttack ?? 4, damage: expr, type: effect.type }, { rng: this.rng });
      this.say(hit.text, hit.hit ? 'good' : 'muted');
      if (!hit.hit) return;
      const dmg = roll(hit.crit ? `${expr}+${expr}` : expr, { rng: this.rng });
      const applied = applyDamage(target, dmg.total, effect.type);
      this.say(`→ ${target.name}に ${effect.type}属性で ${damageText(applied)}（残り ${target.hp}/${target.maxHp}）`, 'good');
      if (applied.downed) this.announceDown(target);
      return;
    }
    const dmg = roll(expr, { rng: this.rng });
    let amount = dmg.total;
    if (effect.save) {
      const save = savingThrow(target, effect.save, actor.spellDC || 13, { rng: this.rng });
      this.say(save.text, save.success ? 'muted' : 'good');
      if (save.success) amount = effect.halfOnSave ? Math.floor(amount / 2) : 0;
    }
    if (amount <= 0) { this.say(`${target.name}は無傷で切り抜けた。`, 'muted'); return; }
    const applied = applyDamage(target, amount, effect.type);
    this.say(`→ ${target.name}に ${effect.type}属性で ${damageText(applied)}（残り ${target.hp}/${target.maxHp}）`, 'good');
    if (applied.downed) this.announceDown(target);
  }

  spellTargets(actor, target, spell) {
    switch (spell.target) {
      case 'self': return [actor];
      case 'ally': return [target || actor];
      case 'party': return this.livingParty;
      case 'area': return this.livingEnemies;
      case 'enemy': default: return target ? [target] : this.livingEnemies.slice(0, 1);
    }
  }

  doItem(actor, target, action) {
    const item = actor.inventory?.find(i => i.id === action.id);
    if (!item) return { error: 'その道具は持っていません' };
    const on = target || actor;

    if (item.use === 'heal') {
      const amount = roll(String(item.amount), { rng: this.rng });
      const h = heal(on, amount.total);
      this.say(`${actor.name}は${item.name}を使った → ${on.name}のHPが ${h.healed} 回復（${on.hp}/${on.maxHp}）`, 'good');
    } else if (item.use === 'cure') {
      for (const id of item.cures || []) removeCondition(on, id);
      this.say(`${actor.name}は${item.name}を使った → ${on.name}の状態が回復した。`, 'good');
    } else if (item.use === 'damage') {
      const dmg = roll(String(item.amount), { rng: this.rng });
      const targets = item.area ? this.livingEnemies : [target].filter(Boolean);
      this.say(`${actor.name}は${item.name}を投げた！`, 'info');
      for (const t of targets) {
        const applied = applyDamage(t, dmg.total, item.type || '火');
        this.say(`→ ${t.name}に ${damageText(applied)}（残り ${t.hp}/${t.maxHp}）`, 'good');
        if (applied.downed) this.announceDown(t);
      }
    }
    if (item.consumable !== false) removeItem(actor, item.id, 1);
    if (this.checkEnd()) return this.finish();
    return this.endTurn();
  }

  doFeature(actor, target, action) {
    const res = actor.resources?.[action.id];
    if (!res || res.used >= res.max) return { error: 'その能力はもう使えません' };
    res.used += 1;

    if (action.id === 'secondWind') {
      const amount = roll(`1d10+${actor.level}`, { rng: this.rng });
      const h = heal(actor, amount.total);
      this.say(`${actor.name}は【再起】で ${h.healed} 回復した（${actor.hp}/${actor.maxHp}）`, 'good');
    } else if (action.id === 'channelHeal') {
      const on = target || actor;
      const amount = roll(`2d8+${actor.level}`, { rng: this.rng });
      const h = heal(on, amount.total);
      this.say(`${actor.name}は【癒しの手】を${on.name}に→ ${h.healed} 回復（${on.hp}/${on.maxHp}）${h.revived ? ' — 立ち上がった！' : ''}`, 'good');
    }
    return this.endTurn();
  }

  /* 特性の能動効果。今のところ範囲ダメージ（竜の吐息）だけだが、
     traits.js の action がそのまま増やせる形にしてある。 */
  doTrait(actor, action) {
    const spec = traitActions(actor).find(t => t.id === action.id);
    if (!spec) return { error: '使えません' };
    const use = spec.action;
    actor.resources = actor.resources || {};
    const slot = actor.resources[spec.id] || (actor.resources[spec.id] = { max: use.uses || 1, used: 0 });
    if (slot.used >= slot.max) return { error: 'もう使えません' };
    slot.used += 1;

    this.say((use.text || '{name}は特性を使った。').replace('{name}', actor.name), 'info');
    const dc = 8 + proficiencyBonus(actor.level || 1) + abilityMod(actor.abilities?.con ?? 10);
    const targets = use.area ? this.livingEnemies : this.livingEnemies.slice(0, 1);
    for (const foe of targets) {
      const dmg = roll(use.damage || '1d6', { rng: this.rng });
      let amount = dmg.total;
      if (use.save) {
        const st = savingThrow(foe, use.save, dc, { rng: this.rng });
        this.say(st.text, st.success ? 'muted' : 'good');
        if (st.success) amount = Math.floor(amount / 2);
      }
      const applied = applyDamage(foe, amount, use.type || '火');
      this.say(`→ ${foe.name}に ${damageText(applied)}｜残りHP ${foe.hp}/${foe.maxHp}`, 'good');
      if (applied.downed && !this.standFast(foe)) this.announceDown(foe);
    }
    if (this.checkEnd()) return this.finish();
    return this.endTurn();
  }

  doFlee(actor) {
    const dc = 10 + Math.max(...this.livingEnemies.map(e => Math.round((e.cr || 1) * 2)), 0);
    const result = check(actor, 'athletics', dc, { rng: this.rng });
    this.say(result.text, result.success ? 'good' : 'bad');
    if (result.success) {
      this.over = true; this.result = 'fled';
      this.say('パーティは戦闘から離脱した。', 'header');
      return this.finish();
    }
    this.say('逃げ切れなかった！', 'bad');
    return this.endTurn();
  }

  /** Wrap up the actor's turn and hand control to whoever is next. */
  endTurn() {
    const actor = this.current;
    if (actor) { actor.sneakUsed = false; removeCondition(actor, 'dodging'); }
    if (this.checkEnd()) return this.finish();
    return this.advance();
  }

  /* ---------------------------------------------------------- enemy turn */

  /** Resolve the current enemy's whole turn. */
  enemyTurn() {
    const actor = this.current;
    if (!actor || actor.side !== 'enemy' || this.over) return { error: '敵の手番ではありません' };
    const targets = this.livingParty;
    if (!targets.length) { this.over = true; this.result = 'defeat'; return this.finish(); }

    // Morale: skirmishers break when most of the group is down.
    if (actor.tactics === 'skirmish' && actor.hp <= actor.maxHp * 0.25 && this.livingEnemies.length === 1) {
      const nerve = savingThrow(actor, 'wis', 12, { rng: this.rng });
      if (!nerve.success) {
        this.say(`${actor.name}は悲鳴をあげて逃げ出した！`, 'good');
        actor.hp = 0; actor.fled = true;
        if (this.checkEnd()) return this.finish();
        return this.advance();
      }
    }

    const target = this.pickTarget(actor, targets);
    const attack = this.pickAttack(actor);
    if (attack) {
      for (const atk of attack) {
        if (!this.livingParty.length) break;
        const t = target.hp > 0 ? target : this.pickTarget(actor, this.livingParty);
        if (!t) break;
        this.resolveAttack(actor, t, atk);
      }
    } else {
      this.say(`${actor.name}は様子をうかがっている。`, 'muted');
    }
    if (this.checkEnd()) return this.finish();
    return this.advance();
  }

  pickTarget(actor, targets) {
    if (!targets.length) return null;
    switch (actor.tactics) {
      case 'skirmish':          // go for whoever is easiest to drop
        return [...targets].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || armorClass(a) - armorClass(b))[0];
      case 'caster':            // punish the squishy back line
        return [...targets].sort((a, b) => armorClass(a) - armorClass(b))[0];
      case 'brute': default:
        return this.rng.pick(targets);
    }
  }

  /** Monsters with two listed attacks make both. */
  pickAttack(actor) {
    const list = actor.attacks || [];
    if (!list.length) return null;
    if (list.length > 1 && actor.cr >= 1) return list;
    const ranged = list.filter(a => a.ranged);
    if (actor.tactics === 'caster' && ranged.length) return [this.rng.pick(ranged)];
    return [this.rng.pick(list)];
  }

  /** A compact snapshot for the UI. */
  state() {
    return {
      round: this.round,
      over: this.over,
      result: this.result,
      current: this.current ? (this.current.uid || this.current.id) : null,
      playerTurn: this.isPlayerTurn,
      order: this.order.map(c => ({
        uid: c.uid || c.id, name: c.name, side: c.side,
        hp: c.hp, maxHp: c.maxHp, ac: armorClass(c),
        conditions: (c.conditions || []).map(x => x.id),
        down: c.hp <= 0, dead: !!c.dead,
      })),
    };
  }
}

/** "8 ダメージ（うち一時HPが5吸収）" — keeps the log honest about temp hp. */
function damageText(applied) {
  return `${applied.dealt} ダメージ${applied.absorbed ? `（うち一時HPが${applied.absorbed}吸収）` : ''}`;
}

function initiativeMod(c) {
  return abilityMod(c.abilities?.dex ?? 10) + (c.initiativeBonus || 0);
}

const CONDITION_LABELS = {
  prone: '伏せ', grappled: '組みつかれ', frightened: '恐怖', poisoned: '毒',
  blinded: '盲目', restrained: '拘束', stunned: '朦朧', unconscious: '無力化',
  blessed: '祝福', hasted: '加速', guided: '導き', dodging: '回避態勢',
  helped: '援護', warded: '守護',
};
export const conditionName = id => CONDITION_LABELS[id] || id;
