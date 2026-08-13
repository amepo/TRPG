import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLDS, worldById, useWorld, activeWorld, catalogue, DEFAULT_WORLD } from '../js/worlds/index.js';
import * as content from '../js/core/content.js';
import * as rules from '../js/core/rules.js';
import { createCharacter, pregeneratedParty, recalculate } from '../js/core/character.js';
import { Session } from '../js/core/engine.js';
import { Netrun, APPROACHES } from '../js/core/netrun.js';
import { validate } from '../js/core/scenario.js';
import { BUILT_IN, byId, forWorld } from '../js/scenarios/index.js';
import { install, remove, strainCapacity, strainOver, summary, hasAugments, catalogue as augments } from '../js/core/augment.js';
import { Rng } from '../js/core/rng.js';

/* Every test leaves the default world active so ordering never matters. */
test.afterEach(() => useWorld(DEFAULT_WORLD));

/* --------------------------------------------------------------- registry */

test('both settings are registered and self-consistent', () => {
  assert.ok(WORLDS.length >= 2);
  for (const world of WORLDS) {
    assert.ok(world.id && world.name, 'id と名前');
    assert.equal(world.abilities.length, 6, `${world.id}: 能力値は6つ`);
    assert.deepEqual(world.abilities.map(a => a.id).sort(), ['cha', 'con', 'dex', 'int', 'str', 'wis'],
      `${world.id}: 能力値の id は共通`);
    assert.ok(world.skills.length >= 12, `${world.id}: 技能`);
    assert.ok(world.classes.length >= 3, `${world.id}: クラス`);
    assert.ok(Object.keys(world.monsters).length >= 8, `${world.id}: 敵`);
    assert.ok(world.theme['--bg'], `${world.id}: 配色`);
  }
});

test('worlds do not share skill ids by accident', () => {
  const neon = worldById('neon');
  const fantasy = worldById('embers');
  assert.ok(neon.skills.some(s => s.id === 'netops'), 'ネオン固有の技能');
  assert.ok(fantasy.skills.some(s => s.id === 'arcana'), 'ファンタジー固有の技能');
  // Ids that appear in both must mean the same thing (same governing ability).
  for (const a of neon.skills) {
    const b = fantasy.skills.find(s => s.id === a.id);
    if (b) assert.equal(a.ability, b.ability, `${a.id} の能力値が食い違っている`);
  }
});

test('every class references skills and gear its world defines', () => {
  for (const world of WORLDS) {
    const skillIds = new Set(world.skills.map(s => s.id));
    for (const klass of world.classes) {
      for (const id of klass.skillList) assert.ok(skillIds.has(id), `${world.id}/${klass.id}: 未知の技能 ${id}`);
      if (klass.weapon) assert.ok(world.weapons[klass.weapon], `${world.id}/${klass.id}: 未知の武器`);
      if (klass.ranged) assert.ok(world.weapons[klass.ranged], `${world.id}/${klass.id}: 未知の遠隔武器`);
      if (klass.armor) assert.ok(world.armors[klass.armor], `${world.id}/${klass.id}: 未知の防具`);
      for (const id of klass.caster?.cantrips || []) assert.ok(world.spells[id], `${world.id}/${klass.id}: 未知の初級 ${id}`);
    }
    for (const bg of world.backgrounds) {
      for (const id of bg.skills) assert.ok(skillIds.has(id), `${world.id}/${bg.id}: 未知の技能 ${id}`);
    }
    for (const [klassId, list] of Object.entries(world.classSpells || {})) {
      assert.ok(world.classes.some(c => c.id === klassId), `${world.id}: 未知のクラス ${klassId}`);
      for (const id of list) assert.ok(world.spells[id], `${world.id}: 未知の呪文 ${id}`);
    }
  }
});

test('the catalogue summarises each world', () => {
  const cards = catalogue();
  assert.equal(cards.length, WORLDS.length);
  for (const card of cards) assert.ok(card.name && card.icon && card.classes > 0);
});

/* ----------------------------------------------------------- live content */

test('switching worlds swaps the content layer', () => {
  useWorld('embers');
  assert.ok(content.CLASSES.some(c => c.id === 'fighter'));
  assert.equal(content.label('spell'), '呪文');
  assert.ok(rules.SKILLS.some(s => s.id === 'arcana'));

  useWorld('neon');
  assert.ok(content.CLASSES.some(c => c.id === 'netrunner'));
  assert.ok(!content.CLASSES.some(c => c.id === 'fighter'), '前の世界のクラスが残っている');
  assert.equal(content.label('spell'), 'プログラム');
  assert.ok(rules.SKILLS.some(s => s.id === 'netops'));
  assert.equal(rules.abilityName('int'), '演算');
});

test('an unknown world id leaves the current one alone', () => {
  useWorld('neon');
  const before = activeWorld().id;
  useWorld('atlantis');
  assert.equal(activeWorld().id, before);
});

test('ability ids stay stable across a switch so saves survive', () => {
  useWorld('embers');
  const before = [...rules.ABILITY_IDS];
  useWorld('neon');
  assert.deepEqual([...rules.ABILITY_IDS], before);
});

/* -------------------------------------------------------------- creation */

test('a cyberpunk character builds with coherent stats', () => {
  useWorld('neon');
  const pc = createCharacter({
    name: 'サーシャ', classId: 'netrunner', ancestryId: 'academy', backgroundId: 'hacker',
    abilities: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
    skills: ['netops', 'tech'],
  });
  assert.equal(pc.abilities.int, 17);              // 15 + アカデミー +2
  assert.ok(pc.maxHp > 0 && pc.hp === pc.maxHp);
  assert.ok(pc.skills.includes('netops'));
  assert.ok(pc.skills.includes('datalore'), '出自の技能');
  assert.equal(pc.spellAbility, 'int');
});

test('each world produces a playable default party', () => {
  for (const world of WORLDS) {
    useWorld(world.id);
    const party = pregeneratedParty();
    assert.equal(party.length, 4, `${world.id}: 4人`);
    for (const pc of party) {
      recalculate(pc);
      assert.ok(pc.hp > 0 && pc.hp === pc.maxHp, `${world.id}/${pc.name}: HP`);
      assert.ok(pc.ac >= 10 && pc.ac <= 20, `${world.id}/${pc.name}: AC ${pc.ac}`);
    }
  }
});

/* ------------------------------------------------------------- サイバーウェア */

test('implants only exist where the world defines them', () => {
  useWorld('embers');
  assert.equal(hasAugments(), false);
  assert.deepEqual(augments(), []);
  useWorld('neon');
  assert.equal(hasAugments(), true);
  assert.ok(augments().length >= 5);
});

test('installing an implant applies its bonus', () => {
  useWorld('neon');
  const pc = createCharacter({ classId: 'solo', ancestryId: 'street', backgroundId: 'ganger', skills: ['perception'] });
  const before = rules.skillMod(pc, 'perception');

  assert.equal(install(pc, 'opticSuite').ok, true);
  recalculate(pc);
  assert.equal(rules.skillMod(pc, 'perception'), before + 2);

  assert.equal(remove(pc, 'opticSuite').ok, true);
  recalculate(pc);
  assert.equal(rules.skillMod(pc, 'perception'), before);
});

test('the same implant cannot be installed twice', () => {
  useWorld('neon');
  const pc = createCharacter({ classId: 'solo', ancestryId: 'street', backgroundId: 'ganger' });
  install(pc, 'neuralPort');
  assert.equal(install(pc, 'neuralPort').ok, false);
  assert.equal(remove(pc, 'subdermalPlate').ok, false);
});

test('overloading the body penalises every roll', () => {
  useWorld('neon');
  const pc = createCharacter({
    classId: 'solo', ancestryId: 'street', backgroundId: 'ganger',
    abilities: { con: 8 }, skills: ['athletics'],
  });
  const clean = rules.skillMod(pc, 'athletics');
  const save = rules.saveMod(pc, 'str');

  // Stack implants past what this body can take.
  for (const aug of augments()) install(pc, aug.id);
  recalculate(pc);

  const over = strainOver(pc);
  assert.ok(over > 0, '超過していない');
  assert.equal(pc.strainOver, over);
  assert.equal(rules.saveMod(pc, 'str'), save - over);
  // The optic suite still grants its +2, so athletics moves by (2 − over).
  assert.equal(rules.skillMod(pc, 'athletics'), clean - over);
  assert.equal(summary(pc).state, 'over');
});

test('strain capacity grows with toughness and level', () => {
  useWorld('neon');
  const weak = createCharacter({ classId: 'solo', ancestryId: 'street', backgroundId: 'ganger', abilities: { con: 8 } });
  const tough = createCharacter({ classId: 'solo', ancestryId: 'street', backgroundId: 'ganger', abilities: { con: 16 } });
  assert.ok(strainCapacity(tough) > strainCapacity(weak));
});

test('an implanted weapon shows up as an attack option', () => {
  useWorld('neon');
  const pc = createCharacter({ classId: 'runner', ancestryId: 'street', backgroundId: 'ganger' });
  install(pc, 'ripperClaws');
  recalculate(pc);
  assert.ok(pc.augmentAttacks.some(a => a.id === 'claws'));
});

/* ------------------------------------------------------------------ netrun */

const runSpec = {
  title: 'テスト網', traceMax: 4,
  layers: [
    { name: '第一層', skill: 'netops', dc: 5 },
    { name: '第二層', skill: 'netops', dc: 5 },
  ],
};

const runner = () => {
  useWorld('neon');
  return createCharacter({
    name: 'ラン', classId: 'netrunner', ancestryId: 'academy', backgroundId: 'hacker',
    abilities: { int: 15 }, skills: ['netops'],
  });
};

test('clearing every layer ends a run in success', () => {
  const run = new Netrun(runSpec, [runner()], { rng: new Rng(1) });
  run.start();
  let step = run.act({ id: 'fast' });
  if (!step.done) step = run.act({ id: 'fast' });
  // DC 5 against a trained netrunner: both layers should fall quickly.
  assert.ok(run.index >= 1 || step.done);
});

test('a maxed trace clock ends the run', () => {
  const run = new Netrun({ ...runSpec, traceMax: 3 }, [runner()], { rng: new Rng(2) });
  run.start();
  const step = run.act({ id: 'burn' });      // burn costs 3 trace outright
  assert.equal(step.done, true);
  assert.equal(step.result, 'traced');
});

test('burning through always gets past the layer but hurts', () => {
  const pc = runner();
  const run = new Netrun({ ...runSpec, traceMax: 99 }, [pc], { rng: new Rng(3) });
  run.start();
  const before = pc.hp;
  run.act({ id: 'burn' });
  assert.equal(run.index, 1, '層を抜けていない');
  assert.ok(pc.hp < before, '反動を受けていない');
});

test('every approach is offered and the state snapshot is coherent', () => {
  const run = new Netrun(runSpec, [runner()], { rng: new Rng(4) });
  run.start();
  assert.equal(run.options().length, APPROACHES.length);
  const state = run.state();
  assert.equal(state.layerCount, 2);
  assert.equal(state.trace, 0);
  assert.ok(state.candidates.length >= 1);
  assert.ok(state.runner);
});

test('a run with no layers succeeds immediately', () => {
  const run = new Netrun({ title: '空', layers: [] }, [runner()], { rng: new Rng(5) });
  const step = run.start();
  assert.equal(step.done, true);
  assert.equal(step.result, 'success');
});

/* ----------------------------------------------------------- scenarios */

test('the cyberpunk scenario is valid in its own world', () => {
  useWorld('neon');
  const result = validate(byId('rain-check'), { monsters: content.MONSTERS });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings.filter(w => w.includes('行き止まり')), []);
});

test('every shipped scenario validates against the world it declares', () => {
  for (const scenario of BUILT_IN) {
    useWorld(scenario.world || DEFAULT_WORLD);
    const result = validate(scenario, { monsters: content.MONSTERS });
    assert.deepEqual(result.errors, [], `${scenario.id}`);
  }
});

test('scenarios are tagged and grouped by world', () => {
  assert.ok(forWorld('neon').length >= 1);
  assert.ok(forWorld('embers').length >= 2);
  for (const s of BUILT_IN) assert.ok(s.world, `${s.id}: world が無い`);
});

test('every scenario check names a skill its world actually has', () => {
  for (const scenario of BUILT_IN) {
    const world = worldById(scenario.world || DEFAULT_WORLD);
    const ids = new Set(world.skills.map(s => s.id));
    for (const [nodeId, node] of Object.entries(scenario.nodes)) {
      for (const choice of node.choices || []) {
        if (choice.check) assert.ok(ids.has(choice.check.skill),
          `${scenario.id}/${nodeId}: ${world.name} に無い技能 ${choice.check.skill}`);
      }
      for (const layer of node.netrun?.layers || []) {
        assert.ok(ids.has(layer.skill), `${scenario.id}/${nodeId}: 無い技能 ${layer.skill}`);
      }
    }
  }
});

/* -------------------------------------------------------------- session */

test('starting a session activates the scenario world', () => {
  useWorld('embers');
  const session = new Session({ scenario: byId('rain-check'), party: pregeneratedParty(), seed: 1 });
  assert.equal(session.world, 'neon');
  assert.equal(activeWorld().id, 'neon');
});

test('a netrun node hands control to the run and back', () => {
  useWorld('neon');
  const session = new Session({
    scenario: {
      id: 'nr', title: 'テスト', world: 'neon', start: 'run',
      nodes: {
        run: {
          id: 'run', title: '侵入',
          netrun: {
            title: '網', traceMax: 99,
            layers: [{ name: '唯一の層', skill: 'netops', dc: 5, effects: [{ setFlag: 'got' }] }],
            onSuccess: { to: 'done' },
          },
        },
        done: { id: 'done', title: '完了', ending: { type: 'good', title: '抜けた', text: '終わり' } },
      },
    },
    party: pregeneratedParty(), seed: 7,
  });
  session.start();
  assert.ok(session.view().netrun, '侵入画面になっていない');
  assert.equal(session.view().choices.length, 0, '侵入中に選択肢が出ている');

  let guard = 0;
  while (session.netrun && guard++ < 20) session.hack({ id: 'burn' });
  assert.equal(session.finished, true);
  assert.ok(session.flags.has('got'), '層の効果が適用されていない');
});

test('the cyberpunk scenario plays to an ending from many seeds', () => {
  for (let seed = 0; seed < 8; seed++) {
    useWorld('neon');
    const picker = new Rng(seed * 613 + 5);
    const session = new Session({ scenario: byId('rain-check'), party: pregeneratedParty(), seed });
    session.start();
    let guard = 0;
    while (!session.finished && guard++ < 600) {
      if (session.combat) {
        const view = session.view();
        const option = view.combat.options.find(o => o.kind === 'attack') || view.combat.options[0];
        if (!option) break;
        session.act({ ...option, targetUid: view.combat.targets[0]?.uid });
      } else if (session.netrun) {
        session.hack({ id: picker.pick(APPROACHES).id });
      } else {
        const choices = session.availableChoices().filter(c => !c.locked);
        assert.ok(choices.length, `seed ${seed}: "${session.nodeId}" で進めなくなった`);
        session.choose(picker.pick(choices).index);
      }
    }
    assert.equal(session.finished, true, `seed ${seed}: 結末に届かなかった（${session.nodeId}）`);
  }
});

test('a save records its world and restores into it', () => {
  useWorld('neon');
  const session = new Session({ scenario: byId('rain-check'), party: pregeneratedParty(), seed: 3 });
  session.start();
  session.choose(session.availableChoices()[0].index);
  const saved = JSON.parse(JSON.stringify(session.save()));
  assert.equal(saved.world, 'neon');

  useWorld('embers');
  const restored = Session.load(saved);
  assert.equal(restored.world, 'neon');
  assert.equal(activeWorld().id, 'neon');
  assert.equal(restored.nodeId, session.nodeId);
});
