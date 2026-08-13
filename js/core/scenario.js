/* Scenario format: data, conditions, effects and validation.

   A scenario is pure data so it can be written by hand, built in the editor,
   or exported to JSON and shared. Nothing in here mutates a character except
   through applyEffects(), which the engine calls with an explicit context.

   Node shape
   ----------
   {
     id, title, art,
     text: string | string[]                     // narration, "{name}" is filled in
     onEnter: Effect[]                           // runs once per visit
     choices: Choice[]
     combat: { title, enemies: string[], surprise, onVictory, onDefeat, onFlee }
     rest: 'short' | 'long'
     ending: { type: 'good'|'bad'|'neutral', title, text }
   }

   Choice shape
   ------------
   {
     text, to,                                   // plain branch
     if: Condition,                              // hidden unless it passes
     requires: Condition,                        // shown but locked, with `lockedText`
     once: boolean,                              // disappears after it is taken
     check: { skill, dc, advantage, success: Outcome, fail: Outcome },
     effects: Effect[]
   }
   Outcome = { text, to, effects }
*/

import { label } from './content.js';

/* ------------------------------------------------------------- conditions */

/**
 * Evaluate a condition against the run state.
 * @param {object|null|undefined} cond
 * @param {object} ctx {flags:Set|object, vars:object, party:object[], visited:Set}
 */
export function testCondition(cond, ctx) {
  if (!cond) return true;
  if (Array.isArray(cond)) return cond.every(c => testCondition(c, ctx));

  if (cond.all) return cond.all.every(c => testCondition(c, ctx));
  if (cond.any) return cond.any.some(c => testCondition(c, ctx));
  if (cond.not) return !testCondition(cond.not, ctx);

  if (cond.flag !== undefined) return hasFlag(ctx, cond.flag);
  if (cond.noFlag !== undefined) return !hasFlag(ctx, cond.noFlag);
  if (cond.visited !== undefined) return ctx.visited?.has?.(cond.visited) ?? false;

  if (cond.var !== undefined) {
    const value = Number(ctx.vars?.[cond.var] ?? 0);
    if (cond.gte !== undefined) return value >= cond.gte;
    if (cond.lte !== undefined) return value <= cond.lte;
    if (cond.gt !== undefined) return value > cond.gt;
    if (cond.lt !== undefined) return value < cond.lt;
    if (cond.eq !== undefined) return value === cond.eq;
    return !!value;
  }

  if (cond.has !== undefined) {
    return (ctx.party || []).some(pc => pc.inventory?.some(i => i.id === cond.has && i.count > 0));
  }
  if (cond.classIn) return (ctx.party || []).some(pc => cond.classIn.includes(pc.classId));
  if (cond.skillIn) return (ctx.party || []).some(pc => pc.skills?.some(s => cond.skillIn.includes(s)));
  if (cond.alive !== undefined) return (ctx.party || []).filter(pc => pc.hp > 0).length >= cond.alive;
  if (cond.levelAtLeast !== undefined) return (ctx.party || []).some(pc => pc.level >= cond.levelAtLeast);

  return true;
}

const hasFlag = (ctx, name) =>
  ctx.flags instanceof Set ? ctx.flags.has(name) : !!ctx.flags?.[name];

/** Human-readable reason a locked choice is locked. */
export function describeCondition(cond) {
  if (!cond) return '';
  if (cond.all) return cond.all.map(describeCondition).filter(Boolean).join('・');
  if (cond.any) return cond.any.map(describeCondition).filter(Boolean).join(' または ');
  if (cond.not) return `${describeCondition(cond.not)} でないこと`;
  if (cond.flag) return `「${cond.flag}」が必要`;
  if (cond.has) return `アイテム「${cond.has}」が必要`;
  if (cond.var) return `${cond.var} が条件を満たすこと`;
  if (cond.skillIn) return `技能（${cond.skillIn.join('/')}）が必要`;
  if (cond.classIn) return `${cond.classIn.join('/')} が必要`;
  return '条件を満たすこと';
}

/* ---------------------------------------------------------------- effects */

/**
 * Apply a list of effects. Returns log lines describing what changed.
 * @param {object[]} effects
 * @param {object} ctx {flags, vars, party, rng, log(text, kind)}
 */
export function applyEffects(effects, ctx) {
  const lines = [];
  const say = (text, kind = 'system') => { lines.push({ text, kind }); ctx.log?.(text, kind); };

  for (const effect of [].concat(effects || [])) {
    if (!effect) continue;

    if (effect.setFlag) { setFlag(ctx, effect.setFlag, true); if (effect.note) say(effect.note); }
    if (effect.clearFlag) setFlag(ctx, effect.clearFlag, false);

    if (effect.var) {
      const before = Number(ctx.vars[effect.var] ?? 0);
      const after = effect.set !== undefined ? effect.set : before + (effect.add || 0);
      ctx.vars[effect.var] = after;
      if (effect.note) say(effect.note);
    }

    if (effect.giveItem) {
      const target = pickCarrier(ctx);
      const item = resolveItem(effect.giveItem, ctx);
      if (target && item) {
        addToInventory(target, item, effect.count || 1);
        say(`${target.name}は【${item.name}】を手に入れた。`, 'good');
      }
    }
    if (effect.takeItem) {
      for (const pc of ctx.party || []) {
        const entry = pc.inventory?.find(i => i.id === effect.takeItem);
        if (entry) {
          entry.count -= effect.count || 1;
          if (entry.count <= 0) pc.inventory = pc.inventory.filter(i => i.id !== effect.takeItem);
          say(`${pc.name}は【${entry.name}】を失った。`, 'bad');
          break;
        }
      }
    }

    if (effect.gold) {
      const target = pickCarrier(ctx);
      if (target) {
        target.gold = (target.gold || 0) + effect.gold;
        say(`${label('gold', '所持金')} ${effect.gold > 0 ? '+' : ''}${effect.gold} ${label('goldUnit', '枚')}`,
          effect.gold > 0 ? 'good' : 'bad');
      }
    }

    if (effect.xp) { ctx.awardXp?.(effect.xp); }

    if (effect.damage) ctx.damage?.(effect.damage, effect.target || 'party', effect.type || '物理', effect.save);
    if (effect.heal) ctx.heal?.(effect.heal, effect.target || 'party');

    if (effect.log) say(effect.log, effect.kind || 'system');
    if (effect.rest) ctx.rest?.(effect.rest);
  }
  return lines;
}

function setFlag(ctx, name, on) {
  if (ctx.flags instanceof Set) { on ? ctx.flags.add(name) : ctx.flags.delete(name); }
  else { if (on) ctx.flags[name] = true; else delete ctx.flags[name]; }
}

/** Items go to whoever is standing — the first living character. */
function pickCarrier(ctx) {
  return (ctx.party || []).find(pc => pc.hp > 0) || (ctx.party || [])[0] || null;
}

function resolveItem(ref, ctx) {
  if (typeof ref === 'object') return ref;
  return ctx.items?.[ref] || { id: ref, name: ref };
}

function addToInventory(pc, item, count) {
  pc.inventory = pc.inventory || [];
  const existing = pc.inventory.find(i => i.id === item.id);
  if (existing) existing.count += count;
  else pc.inventory.push({ ...item, count });
}

/* ------------------------------------------------------------------ text */

/** Fill "{name}" / "{party}" / "{var:trust}" placeholders in narration. */
export function interpolate(text, ctx) {
  const lead = (ctx.party || []).find(p => p.hp > 0) || (ctx.party || [])[0];
  return String(text).replace(/\{(\w+)(?::(\w+))?\}/g, (all, key, arg) => {
    if (key === 'name') return lead?.name ?? '君';
    if (key === 'party') return (ctx.party || []).map(p => p.name).join('、');
    if (key === 'var') return String(ctx.vars?.[arg] ?? 0);
    if (key === 'class') return lead?.classId ?? '';
    return all;
  });
}

/** Narration can be a string, an array of paragraphs, or a function. */
export function nodeText(node, ctx) {
  const raw = typeof node.text === 'function' ? node.text(ctx) : node.text;
  return [].concat(raw || []).map(p => interpolate(p, ctx));
}

/* ------------------------------------------------------------- validation */

/**
 * Check a scenario for broken links and obvious mistakes.
 * The editor shows these; the loader refuses to start on errors.
 * @returns {{errors:string[], warnings:string[], ok:boolean}}
 */
export function validate(scenario, { monsters = {} } = {}) {
  const errors = [];
  const warnings = [];
  const nodes = scenario?.nodes || {};
  const ids = new Set(Object.keys(nodes));

  if (!scenario?.id) errors.push('シナリオIDがありません');
  if (!scenario?.title) warnings.push('タイトルが未設定です');
  if (!scenario?.start) errors.push('開始ノード（start）が未設定です');
  else if (!ids.has(scenario.start)) errors.push(`開始ノード "${scenario.start}" が存在しません`);
  if (!ids.size) errors.push('ノードが1つもありません');

  const linkTo = (target, where) => {
    if (!target) return;
    if (!ids.has(target)) errors.push(`${where}: リンク先 "${target}" が存在しません`);
  };

  const reachable = new Set();
  const walk = id => {
    if (!id || reachable.has(id) || !nodes[id]) return;
    reachable.add(id);
    const node = nodes[id];
    for (const choice of node.choices || []) {
      walk(choice.to);
      walk(choice.check?.success?.to);
      walk(choice.check?.fail?.to);
    }
    walk(node.combat?.onVictory?.to);
    walk(node.combat?.onDefeat?.to);
    walk(node.combat?.onFlee?.to);
    walk(node.netrun?.onSuccess?.to);
    walk(node.netrun?.onTraced?.to);
    walk(node.next);
  };
  walk(scenario?.start);

  let endings = 0;
  for (const [id, node] of Object.entries(nodes)) {
    const where = `ノード "${id}"`;
    if (!node.text && !node.combat && !node.netrun && !node.ending) warnings.push(`${where}: 本文が空です`);
    if (node.ending) endings++;

    for (const [i, choice] of (node.choices || []).entries()) {
      const at = `${where} の選択肢${i + 1}`;
      if (!choice.text) errors.push(`${at}: 表示テキストがありません`);
      if (!choice.to && !choice.check && !choice.effects) errors.push(`${at}: 行き先も判定もありません`);
      linkTo(choice.to, at);
      if (choice.check) {
        if (!choice.check.skill) errors.push(`${at}: 判定の技能が未指定です`);
        if (!Number.isFinite(Number(choice.check.dc))) errors.push(`${at}: 判定のDCが不正です`);
        linkTo(choice.check.success?.to, `${at}（成功）`);
        linkTo(choice.check.fail?.to, `${at}（失敗）`);
        if (!choice.check.success?.to && !choice.check.fail?.to && !choice.to) {
          warnings.push(`${at}: 判定の後どこへも進みません`);
        }
      }
    }

    if (node.combat) {
      const list = node.combat.enemies || [];
      if (!list.length) errors.push(`${where}: 戦闘に敵がいません`);
      for (const enemy of list) {
        const known = monsters[enemy] || scenario.monsters?.[enemy];
        if (!known) errors.push(`${where}: 未知のモンスター "${enemy}"`);
      }
      linkTo(node.combat.onVictory?.to, `${where}（勝利）`);
      linkTo(node.combat.onDefeat?.to, `${where}（敗北）`);
      linkTo(node.combat.onFlee?.to, `${where}（逃走）`);
      if (!node.combat.onVictory?.to) warnings.push(`${where}: 勝利後の行き先が未設定です`);
      // 選択肢のない戦闘場面で敗北・逃走の行き先を欠くと、プレイヤーが
      // 進めない場面に取り残される。
      if (!node.choices?.length && !node.combat.onFlee?.to) {
        warnings.push(`${where}: 逃走後の行き先が未設定で、この場面には選択肢もありません`);
      }
    }

    if (node.netrun) {
      const layers = node.netrun.layers || [];
      if (!layers.length) errors.push(`${where}: 侵入に層がありません`);
      for (const [i, layer] of layers.entries()) {
        const at = `${where} の第${i + 1}層`;
        if (!layer.skill) errors.push(`${at}: 判定の技能が未指定です`);
        if (!Number.isFinite(Number(layer.dc))) errors.push(`${at}: DCが不正です`);
      }
      for (const enemy of node.netrun.ice || []) {
        if (!monsters[enemy] && !scenario.monsters?.[enemy]) errors.push(`${where}: 未知の ICE "${enemy}"`);
      }
      linkTo(node.netrun.onSuccess?.to, `${where}（突破）`);
      linkTo(node.netrun.onTraced?.to, `${where}（逆探知）`);
      if (!node.netrun.onSuccess?.to) warnings.push(`${where}: 突破後の行き先が未設定です`);
      if (!node.choices?.length && !node.netrun.onTraced?.to) {
        warnings.push(`${where}: 逆探知後の行き先が未設定で、この場面には選択肢もありません`);
      }
    }

    if (!node.choices?.length && !node.combat && !node.netrun && !node.ending && !node.next) {
      warnings.push(`${where}: 行き止まりです（選択肢・戦闘・侵入・エンディングのいずれも無し）`);
    }
    if (!reachable.has(id)) warnings.push(`${where}: 開始地点から到達できません`);
  }

  if (!endings) warnings.push('エンディングノードが1つもありません');

  return { errors, warnings, ok: errors.length === 0 };
}

/* ------------------------------------------------------------ construction */

/** An empty scenario, used by the editor's "new" button. */
export function blankScenario(title = '新しいシナリオ', world = 'embers') {
  return {
    id: `sc_${Date.now().toString(36)}`,
    title,
    world,
    author: '',
    blurb: '',
    level: 1,
    length: '短編',
    start: 'start',
    vars: {},
    items: {},
    monsters: {},
    nodes: {
      start: {
        id: 'start',
        title: '導入',
        text: ['ここに情景を書く。'],
        choices: [{ text: '進む', to: 'end' }],
      },
      end: {
        id: 'end',
        title: '結末',
        text: ['ここで物語が終わる。'],
        ending: { type: 'neutral', title: '終わり', text: 'また会おう。' },
      },
    },
  };
}

/** Deep copy with the node ids normalised to their keys. */
export function normalize(scenario) {
  const copy = structuredClone(scenario);
  for (const [id, node] of Object.entries(copy.nodes || {})) node.id = id;
  copy.world = copy.world || 'embers';
  copy.vars = copy.vars || {};
  copy.items = copy.items || {};
  copy.monsters = copy.monsters || {};
  return copy;
}

/** Summary shown on the scenario picker. */
export function describe(scenario) {
  const nodes = Object.values(scenario.nodes || {});
  return {
    id: scenario.id,
    title: scenario.title,
    blurb: scenario.blurb,
    world: scenario.world || 'embers',
    level: scenario.level || 1,
    nodeCount: nodes.length,
    combatCount: nodes.filter(n => n.combat).length,
    netrunCount: nodes.filter(n => n.netrun).length,
    endingCount: nodes.filter(n => n.ending).length,
    checkCount: nodes.reduce((s, n) => s + (n.choices || []).filter(c => c.check).length, 0),
  };
}
