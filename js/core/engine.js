/* The solo-play session: walks a scenario, resolves checks, runs combat.

   The UI only ever calls a handful of methods — start / choose / act / rest —
   and re-reads view() afterwards. Everything else (flags, log, rng position)
   lives in state that serialises straight to JSON for the save file. */

import { Rng } from './rng.js';
import { roll } from './dice.js';
import {
  check as abilityCheck, savingThrow, applyDamage, heal as healCreature,
  shortRest, longRest, skillMod, skillName, levelForXp, abilityName,
} from './rules.js';
import { Combat, spawnGroup, spawnMonster } from './combat.js';
import { Netrun } from './netrun.js';
import { useWorld, DEFAULT_WORLD } from '../worlds/index.js';
import { recalculate, awardXp, levelUp, reviveCharacter } from './character.js';
import { MONSTERS, ITEMS, classById } from './content.js';
import {
  testCondition, applyEffects, nodeText, interpolate, describeCondition, normalize,
} from './scenario.js';

export class Session extends EventTarget {
  /**
   * @param {object} opts {scenario, party, seed, autoRoll}
   */
  constructor({ scenario, party, seed, autoRoll = false } = {}) {
    super();
    this.scenario = normalize(scenario);
    // The world must be active before anything reads classes, skills or
    // monsters — the whole content layer is a view onto it.
    this.world = useWorld(this.scenario.world || DEFAULT_WORLD).id;
    this.party = party.map(recalculate);
    this.rng = new Rng(seed);
    this.autoRoll = autoRoll;

    this.flags = new Set();
    this.vars = { ...(this.scenario.vars || {}) };
    this.visited = new Set();
    this.takenChoices = new Set();
    this.log = [];
    this.nodeId = null;
    this.combat = null;
    this.netrun = null;
    this.finished = false;
    this.ending = null;
    this.pending = null;              // a check waiting for the player to pick who rolls
    this.startedAt = Date.now();
    this.turnCount = 0;
  }

  /* ------------------------------------------------------------ plumbing */

  say(text, kind = 'narration', extra = {}) {
    const entry = { id: this.log.length, text, kind, at: Date.now(), ...extra };
    this.log.push(entry);
    this.emit('log', entry);
    return entry;
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  get node() { return this.scenario.nodes[this.nodeId] || null; }
  get living() { return this.party.filter(p => p.hp > 0 && !p.dead); }
  get wiped() { return this.living.length === 0; }

  /** Context object handed to the scenario's condition/effect helpers. */
  ctx() {
    return {
      flags: this.flags,
      vars: this.vars,
      party: this.party,
      visited: this.visited,
      rng: this.rng,
      items: { ...ITEMS, ...(this.scenario.items || {}) },
      log: (text, kind) => this.say(text, kind),
      awardXp: amount => this.grantXp(amount),
      damage: (expr, target, type, save) => this.damageParty(expr, target, type, save),
      heal: (expr, target) => this.healParty(expr, target),
      rest: kind => this.rest(kind),
    };
  }

  /* --------------------------------------------------------------- start */

  start() {
    this.say(`【${this.scenario.title}】`, 'title');
    if (this.scenario.blurb) this.say(this.scenario.blurb, 'blurb');
    this.say(`一行: ${this.party.map(p => `${p.name}（${classById(p.classId).name}／Lv${p.level}）`).join('、')}`, 'muted');
    this.goto(this.scenario.start);
    return this.view();
  }

  /* ---------------------------------------------------------- checkpoints */

  /* Combat state is not serialisable on its own (live monsters, an open turn
     order), so a save taken mid-fight rewinds to the top of the scene instead.
     Snapshotting on every node entry keeps that rewind exact: the same rng
     position replays the same initiative and the same monster hit points. */
  checkpoint() {
    this._checkpoint = {
      nodeId: this.nodeId,
      rng: this.rng.save(),
      party: structuredClone(this.party),
      flags: [...this.flags],
      vars: { ...this.vars },
      visited: [...this.visited],
      takenChoices: [...this.takenChoices],
      logLength: this.log.length,
    };
  }

  /* ------------------------------------------------------------ movement */

  /** Enter a node: narrate it, run its effects, and open whatever it starts. */
  goto(nodeId) {
    const node = this.scenario.nodes[nodeId];
    if (!node) { this.say(`（シナリオの綻び: ノード "${nodeId}" が見つからない）`, 'error'); return this.view(); }

    this.nodeId = nodeId;
    const firstVisit = !this.visited.has(nodeId);
    this.visited.add(nodeId);
    this.turnCount += 1;

    if (node.title) this.say(node.title, 'scene', { art: node.art });
    for (const paragraph of nodeText(node, this.ctx())) this.say(paragraph, 'narration');

    if (node.onEnter && (firstVisit || node.repeatEffects)) applyEffects(node.onEnter, this.ctx());
    if (node.rest) this.rest(node.rest);

    if (node.combat) return this.beginCombat(node.combat);
    if (node.netrun) return this.beginNetrun(node.netrun);
    if (node.ending) return this.finish(node.ending);
    if (node.next && !node.choices?.length) return this.goto(node.next);

    this.emit('change');
    return this.view();
  }

  /* ------------------------------------------------------------- choices */

  /** Choices with their visibility and lock state resolved for display. */
  availableChoices() {
    const node = this.node;
    if (!node?.choices) return [];
    const ctx = this.ctx();
    return node.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice, index }) => {
        if (choice.once && this.takenChoices.has(`${this.nodeId}:${index}`)) return false;
        if (choice.if && !testCondition(choice.if, ctx)) return false;
        return true;
      })
      .map(({ choice, index }) => {
        const locked = choice.requires ? !testCondition(choice.requires, ctx) : false;
        return {
          index,
          text: interpolate(choice.text, ctx),
          locked,
          lockedText: locked ? (choice.lockedText || describeCondition(choice.requires)) : null,
          check: choice.check
            ? {
              skill: choice.check.skill,
              label: skillName(choice.check.skill),
              dc: choice.check.dc,
              candidates: this.candidatesFor(choice.check.skill),
            }
            : null,
        };
      });
  }

  /** Who could make this check, best modifier first. */
  candidatesFor(skillId) {
    return this.living
      .map(pc => ({ id: pc.id, name: pc.name, mod: skillMod(pc, skillId) }))
      .sort((a, b) => b.mod - a.mod);
  }

  /**
   * Take a choice.
   * @param {number} index into node.choices
   * @param {object} [opts] {actorId} — who makes the check, if there is one
   */
  choose(index, opts = {}) {
    const node = this.node;
    const choice = node?.choices?.[index];
    if (!choice) return { error: 'その選択肢は選べません' };
    if (this.combat && !this.combat.over) return { error: '戦闘中です' };
    if (this.netrun && !this.netrun.over) return { error: '接続中です' };

    const ctx = this.ctx();
    if (choice.requires && !testCondition(choice.requires, ctx)) {
      return { error: choice.lockedText || describeCondition(choice.requires) };
    }
    this.takenChoices.add(`${this.nodeId}:${index}`);
    this.say(`▶ ${interpolate(choice.text, ctx)}`, 'choice');

    if (choice.effects) applyEffects(choice.effects, ctx);

    if (choice.check) return this.resolveCheck(choice, opts.actorId);
    if (choice.to) return this.goto(choice.to);
    this.emit('change');
    return this.view();
  }

  /** Roll a choice's check and follow the matching branch. */
  resolveCheck(choice, actorId) {
    const spec = choice.check;
    const actor = this.party.find(p => p.id === actorId && p.hp > 0)
      || this.candidatesFor(spec.skill).map(c => this.party.find(p => p.id === c.id))[0]
      || this.living[0];
    if (!actor) return { error: '判定できる仲間がいません' };

    const result = abilityCheck(actor, spec.skill, spec.dc, {
      rng: this.rng,
      advantage: spec.advantage || (spec.advantageIf && testCondition(spec.advantageIf, this.ctx())),
      disadvantage: spec.disadvantage,
      bonus: spec.bonus || 0,
    });
    this.say(result.text, result.success ? 'roll-good' : 'roll-bad', { roll: result });

    const branch = result.success ? spec.success : spec.fail;
    const critBranch = result.crit && spec.crit ? spec.crit : (result.fumble && spec.fumble ? spec.fumble : null);
    const outcome = critBranch || branch || {};

    if (outcome.text) for (const p of [].concat(outcome.text)) this.say(interpolate(p, this.ctx()), 'narration');
    if (outcome.effects) applyEffects(outcome.effects, this.ctx());
    if (outcome.to) return this.goto(outcome.to);
    if (choice.to) return this.goto(choice.to);

    this.emit('change');
    return this.view();
  }

  /* -------------------------------------------------------------- combat */

  beginCombat(spec) {
    this.checkpoint();                 // the exact point a mid-fight save rewinds to
    const roster = (spec.enemies || []).map(id => {
      const custom = this.scenario.monsters?.[id];
      return custom ? spawnMonster({ ...custom, id }, { rng: this.rng }) : id;
    });
    const enemies = roster.every(e => typeof e === 'string')
      ? spawnGroup(roster, this.rng)
      : roster.map(e => (typeof e === 'string' ? spawnMonster(e, { rng: this.rng }) : e));

    this.combat = new Combat(this.living, enemies, {
      rng: this.rng,
      title: spec.title || '戦闘',
      surprise: spec.surprise || null,
      onLog: entry => this.say(entry.text, `combat-${entry.kind}`, { roll: entry.roll }),
    });
    this.combatSpec = spec;
    // Enemies may win initiative, so hand control straight to the AI until it
    // is actually the player's move — otherwise the screen offers no actions.
    return this.pumpCombat(this.combat.start());
  }

  /** Player action inside combat; runs enemy turns until it is our move again. */
  act(action) {
    if (!this.combat || this.combat.over) return { error: '戦闘中ではありません' };
    const result = this.combat.act(action);
    if (result?.error) return result;
    return this.pumpCombat(result);
  }

  /** Let the AI take every enemy turn up to the next player decision. */
  pumpCombat(step) {
    let guard = 0;
    while (step && !step.done && !this.combat.isPlayerTurn && guard++ < 100) {
      step = this.combat.enemyTurn();
    }
    if (step?.done) return this.endCombat(step);
    this.emit('change');
    return this.view();
  }

  /** Called when neither side has anyone left standing, or the party fled. */
  endCombat(step) {
    const spec = this.combatSpec || {};
    const result = step.result;
    this.combat = null;

    if (result === 'victory') {
      const xp = step.xp || 0;
      if (xp) this.grantXp(xp);
      if (spec.onVictory?.effects) applyEffects(spec.onVictory.effects, this.ctx());
      if (spec.onVictory?.text) for (const p of [].concat(spec.onVictory.text)) this.say(interpolate(p, this.ctx()), 'narration');
      if (spec.onVictory?.to) return this.goto(spec.onVictory.to);
    } else if (result === 'defeat') {
      if (spec.onDefeat?.effects) applyEffects(spec.onDefeat.effects, this.ctx());
      if (spec.onDefeat?.text) for (const p of [].concat(spec.onDefeat.text)) this.say(interpolate(p, this.ctx()), 'narration');
      if (spec.onDefeat?.to) return this.goto(spec.onDefeat.to);
      return this.finish({ type: 'bad', title: '全滅', text: '一行はここで倒れた。物語は誰にも語られない。' });
    } else if (result === 'fled') {
      if (spec.onFlee?.effects) applyEffects(spec.onFlee.effects, this.ctx());
      if (spec.onFlee?.to) return this.goto(spec.onFlee.to);
    }
    this.emit('change');
    return this.view();
  }

  /* -------------------------------------------------------------- netrun */

  beginNetrun(spec) {
    this.checkpoint();
    this.netrun = new Netrun(spec, this.living, {
      rng: this.rng,
      onLog: entry => this.say(entry.text, entry.kind === 'info' ? 'system' : entry.kind),
    });
    this.netrunSpec = spec;
    const step = this.netrun.start();
    if (step.done) return this.endNetrun(step);
    this.emit('change');
    return this.view();
  }

  /** One move inside a netrun: pick how to get through the current layer. */
  hack(action) {
    if (!this.netrun || this.netrun.over) return { error: '接続していません' };
    const step = this.netrun.act(action);
    if (step?.error) return step;
    if (step.done) return this.endNetrun(step);
    this.emit('change');
    return this.view();
  }

  endNetrun(step) {
    const spec = this.netrunSpec || {};
    const traced = step.result !== 'success';
    this.netrun = null;

    if (!traced) {
      const layerEffects = (spec.layers || []).flatMap(l => l.effects || []);
      if (layerEffects.length) applyEffects(layerEffects, this.ctx());
      if (spec.onSuccess?.effects) applyEffects(spec.onSuccess.effects, this.ctx());
      if (spec.onSuccess?.text) for (const p of [].concat(spec.onSuccess.text)) this.say(interpolate(p, this.ctx()), 'narration');
      if (spec.onSuccess?.to) return this.goto(spec.onSuccess.to);
    } else {
      if (spec.onTraced?.effects) applyEffects(spec.onTraced.effects, this.ctx());
      if (spec.onTraced?.text) for (const p of [].concat(spec.onTraced.text)) this.say(interpolate(p, this.ctx()), 'narration');
      // Being traced can hand the job straight to whatever was watching.
      if (spec.ice?.length) return this.beginCombat({ title: '逆探知', enemies: spec.ice, onVictory: spec.onTraced?.to ? { to: spec.onTraced.to } : undefined });
      if (spec.onTraced?.to) return this.goto(spec.onTraced.to);
    }
    this.emit('change');
    return this.view();
  }

  /* ---------------------------------------------------- party maintenance */

  grantXp(amount) {
    const share = Math.max(1, Math.floor(amount / Math.max(1, this.party.length)));
    this.say(`経験点 +${share}（各員）`, 'system');
    for (const pc of this.party) {
      const result = awardXp(pc, share);
      if (result.levelUp) {
        while (pc.level < levelForXp(pc.xp)) {
          const up = levelUp(pc, { abilityBumps: bestBumps(pc) });
          if (!up.ok) break;
          this.say(`${pc.name} はレベル ${up.level} になった！ ${up.gained.join('・') || ''}`, 'good');
        }
      }
    }
  }

  damageParty(expr, target = 'party', type = '物理', save = null) {
    const victims = target === 'party' ? this.living : [this.living[0]].filter(Boolean);
    for (const pc of victims) {
      let amount = roll(String(expr), { rng: this.rng }).total;
      if (save) {
        const st = savingThrow(pc, save.ability, save.dc, { rng: this.rng });
        this.say(st.text, st.success ? 'roll-good' : 'roll-bad');
        if (st.success) amount = save.half ? Math.floor(amount / 2) : 0;
      }
      if (amount <= 0) continue;
      const applied = applyDamage(pc, amount, type);
      this.say(`${pc.name} は ${applied.dealt} ダメージを受けた（${pc.hp}/${pc.maxHp}）`, 'bad');
      if (applied.downed) this.say(`${pc.name} は倒れた！`, 'bad');
    }
    if (this.wiped) this.finish({ type: 'bad', title: '力尽きる', text: '誰も立ち上がれなかった。' });
  }

  healParty(expr, target = 'party') {
    const targets = target === 'party' ? this.party : [this.party[0]].filter(Boolean);
    for (const pc of targets) {
      const amount = roll(String(expr), { rng: this.rng }).total;
      const done = healCreature(pc, amount);
      if (done.healed) this.say(`${pc.name} のHPが ${done.healed} 回復（${pc.hp}/${pc.maxHp}）`, 'good');
    }
  }

  /** A breather or a full night. Both are also offered from the UI. */
  rest(kind = 'short') {
    if (kind === 'long') {
      for (const pc of this.party) { longRest(pc); recalculate(pc); }
      this.say('一行は夜を明かした。傷は塞がり、呪文も戻っている。', 'system');
    } else {
      for (const pc of this.party) {
        if (pc.dead) continue;
        const result = shortRest(pc, 1, { rng: this.rng });
        for (const feature of ['secondWind', 'channelHeal', 'surge']) {
          if (pc.resources?.[feature]) pc.resources[feature].used = 0;
        }
        if (result.healed) this.say(`${pc.name} は手当てで ${result.healed} 回復（${pc.hp}/${pc.maxHp}）`, 'good');
      }
      this.say('短い休憩をとった。', 'system');
    }
    this.emit('change');
    return this.view();
  }

  /* -------------------------------------------------------------- ending */

  finish(ending) {
    this.finished = true;
    this.ending = ending;
    this.say(ending.title || '結末', 'scene');
    for (const p of [].concat(ending.text || [])) this.say(interpolate(p, this.ctx()), 'narration');
    this.say(`— 物語は終わった（${{ good: '良い結末', bad: '苦い結末', neutral: 'ひとつの結末' }[ending.type] || '結末'}） —`,
      ending.type === 'bad' ? 'bad' : 'good');
    this.emit('finish', ending);
    this.emit('change');
    return this.view();
  }

  /* ---------------------------------------------------------------- view */

  /** Everything the screen needs, recomputed on demand. */
  view() {
    return {
      scenario: { id: this.scenario.id, title: this.scenario.title },
      nodeId: this.nodeId,
      node: this.node ? { title: this.node.title, art: this.node.art } : null,
      log: this.log,
      choices: (this.combat || this.netrun) ? [] : this.availableChoices(),
      combat: this.combat ? {
        ...this.combat.state(),
        options: this.combat.isPlayerTurn ? this.combat.options() : [],
        targets: this.combat.livingEnemies.map(e => ({ uid: e.uid, name: e.name, hp: e.hp, maxHp: e.maxHp, kind: e.kind })),
        allies: this.combat.livingParty.map(p => ({ uid: p.id, name: p.name, hp: p.hp, maxHp: p.maxHp })),
      } : null,
      netrun: this.netrun ? {
        ...this.netrun.state(),
        options: this.netrun.options(),
      } : null,
      party: this.party.map(p => ({
        id: p.id, name: p.name, portrait: p.portrait, classId: p.classId, level: p.level,
        hp: p.hp, maxHp: p.maxHp, ac: p.ac, xp: p.xp,
        conditions: (p.conditions || []).map(c => c.id),
        down: p.hp <= 0, dead: !!p.dead,
      })),
      vars: { ...this.vars },
      flags: [...this.flags],
      finished: this.finished,
      ending: this.ending,
      canRest: !this.combat && !this.netrun && !this.finished,
      world: this.world,
    };
  }

  /* ------------------------------------------------------------- persistence */

  save() {
    // Mid-combat, fall back to the checkpoint taken when the scene opened.
    const point = this.combat && this._checkpoint ? this._checkpoint : null;
    return {
      version: 2,
      world: this.world,
      scenarioId: this.scenario.id,
      scenario: this.scenario,
      party: point ? point.party : this.party,
      nodeId: point ? point.nodeId : this.nodeId,
      flags: point ? point.flags : [...this.flags],
      vars: point ? point.vars : { ...this.vars },
      visited: point ? point.visited : [...this.visited],
      takenChoices: point ? point.takenChoices : [...this.takenChoices],
      log: (point ? this.log.slice(0, point.logLength) : this.log).slice(-400),
      rng: point ? point.rng : this.rng.save(),
      finished: this.finished,
      ending: this.ending,
      startedAt: this.startedAt,
      savedAt: Date.now(),
      // Set when the save rewound: loading replays the fight from its start.
      inCombat: !!point,
    };
  }

  static load(data) {
    const session = new Session({
      scenario: data.scenario,
      party: (data.party || []).map(reviveCharacter),
      seed: data.rng?.seed,
    });
    session.rng = Rng.restore(data.rng);
    session.flags = new Set(data.flags || []);
    session.vars = data.vars || {};
    session.visited = new Set(data.visited || []);
    session.takenChoices = new Set(data.takenChoices || []);
    session.log = data.log || [];
    session.nodeId = data.nodeId;
    session.finished = !!data.finished;
    session.ending = data.ending || null;
    session.startedAt = data.startedAt || Date.now();

    if (data.inCombat && session.node?.combat) {
      session.say('（戦闘は場面の最初からやり直しになる）', 'system');
      session.beginCombat(session.node.combat);
    }
    return session;
  }
}

/** Pick the two ability bumps that help this character most. */
function bestBumps(pc) {
  const order = { fighter: ['str', 'con'], rogue: ['dex', 'con'], mage: ['int', 'con'], cleric: ['wis', 'con'], ranger: ['dex', 'wis'] };
  return order[pc.classId] || ['con', 'con'];
}

export { MONSTERS };
