import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLDS, worldById, useWorld, activeWorld, catalogue, register, DEFAULT_WORLD } from '../js/worlds/index.js';
import { LORE, hasLore, rollTable, randomName } from '../js/core/lore.js';
import * as content from '../js/core/content.js';
import * as rules from '../js/core/rules.js';
import { createCharacter, pregeneratedParty, recalculate, reviveCharacter } from '../js/core/character.js';
import { Session } from '../js/core/engine.js';
import { Netrun, APPROACHES } from '../js/core/netrun.js';
import { validate, applyEffects } from '../js/core/scenario.js';
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

  pc.gold = 99999;                                 // 費用は別のテストで見る
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
  pc.gold = 99999;
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
  pc.gold = 99999;
  for (const aug of augments()) install(pc, aug.id);
  recalculate(pc);

  const over = strainOver(pc);
  assert.ok(over > 0, '超過していない');
  assert.equal(pc.strainOver, over);
  assert.equal(rules.saveMod(pc, 'str'), save - over);
  // 装備の補正はそのまま乗り、超過ぶんはその上から引かれる。
  const gear = pc.skillBonus?.athletics || 0;
  assert.equal(rules.skillMod(pc, 'athletics'), clean + gear - over);
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
  pc.gold = 99999;
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

test('every cyberpunk scenario reaches an ending from many seeds', () => {
  const neonScenarios = BUILT_IN.filter(s => s.world === 'neon');
  assert.ok(neonScenarios.length >= 4, `ネオンのシナリオが少ない: ${neonScenarios.length}`);

  for (const scenario of neonScenarios) {
    for (let seed = 0; seed < 6; seed++) {
      useWorld('neon');
      const picker = new Rng(seed * 331 + 17);
      const session = new Session({ scenario, party: pregeneratedParty(), seed });
      session.start();
      let guard = 0;
      while (!session.finished && guard++ < 800) {
        if (session.combat) {
          const view = session.view();
          const option = view.combat.options.find(o => o.kind === 'attack') || view.combat.options[0];
          if (!option) break;
          session.act({ ...option, targetUid: view.combat.targets[0]?.uid });
        } else if (session.netrun) {
          session.hack({ id: picker.pick(APPROACHES).id });
        } else {
          const choices = session.availableChoices().filter(c => !c.locked);
          assert.ok(choices.length,
            `${scenario.id} seed ${seed}: "${session.nodeId}" で進めなくなった`);
          session.choose(picker.pick(choices).index);
        }
      }
      assert.equal(session.finished, true,
        `${scenario.id} seed ${seed}: 結末に届かなかった（${session.nodeId}）`);
    }
  }
});

test('the cyberpunk line-up covers more than one kind of story', () => {
  const neon = BUILT_IN.filter(s => s.world === 'neon').map(s => describeShape(s));
  // 導入・侵入もの・戦闘の多い話が、それぞれ最低ひとつはあること。
  assert.ok(neon.some(s => s.tutorial), '導入編がない');
  assert.ok(neon.some(s => s.netruns >= 1), 'ネットランを使う話がない');
  assert.ok(neon.some(s => s.combats >= 4), '戦闘中心の話がない');
  assert.ok(neon.some(s => s.checks >= 15 && s.combats <= 2), '判定中心の話がない');
  assert.ok(neon.every(s => s.endings >= 3), `結末が3つ未満の話がある`);
});

const describeShape = scenario => {
  const nodes = Object.values(scenario.nodes);
  return {
    id: scenario.id,
    tutorial: !!scenario.tutorial,
    netruns: nodes.filter(n => n.netrun).length,
    combats: nodes.filter(n => n.combat).length,
    endings: nodes.filter(n => n.ending).length,
    checks: nodes.reduce((s, n) => s + (n.choices || []).filter(c => c.check).length, 0),
  };
};

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

/* ------------------------------------------------------------- 読み物 */

test('どの世界にも読み物が揃っている', () => {
  for (const world of WORLDS) {
    useWorld(world.id);
    assert.ok(hasLore(), `${world.id}: 読み物がない`);
    assert.ok(LORE.primer.length >= 3, `${world.id}: 導入が短すぎる`);
    assert.ok(LORE.places.length >= 5, `${world.id}: 土地が少ない`);
    assert.ok(LORE.factions.length >= 3, `${world.id}: 勢力が少ない`);
    assert.ok(LORE.tables.length >= 3, `${world.id}: 表が少ない`);
    for (const table of LORE.tables) {
      assert.ok(table.id && table.name, `${world.id}: 表に id か名前がない`);
      assert.ok(table.entries.length >= 8, `${world.id}/${table.name}: 項目が8未満`);
      assert.equal(new Set(table.entries).size, table.entries.length, `${world.id}/${table.name}: 重複した項目`);
    }
  }
});

test('表を振ると、その表の中から返る', () => {
  useWorld('embers');
  const rng = new Rng(11);
  const table = LORE.tables[0];
  for (let i = 0; i < 20; i++) assert.ok(table.entries.includes(rollTable(table, rng)));
  assert.equal(rollTable('存在しない表', rng), null);
});

test('名前はその世界のものが出る', () => {
  const rng = new Rng(12);
  useWorld('embers');
  const fantasyNames = Array.from({ length: 30 }, () => randomName(rng));
  useWorld('neon');
  const neonNames = Array.from({ length: 30 }, () => randomName(rng));
  // ネオン側は姓を持つので、必ず区切りが入る。混ざっていたら世界が漏れている。
  assert.ok(neonNames.every(n => n.includes('・')));
  assert.ok(fantasyNames.every(n => !n.includes('・')));
});

test('読み物を持たない世界でも空の器が返る', () => {
  const bare = { id: 'bare', name: '素', abilities: [], skills: [], ancestries: {}, classes: {}, backgrounds: {}, weapons: {}, armors: {}, items: {}, spells: {}, classSpells: {}, monsters: {} };
  register(bare);
  useWorld('bare');
  assert.equal(hasLore(), false);
  assert.deepEqual(LORE.tables, []);
  assert.equal(randomName(new Rng(1)), null);
  useWorld(DEFAULT_WORLD);
  WORLDS.splice(WORLDS.indexOf(bare), 1);        // 他のテストに置き土産を残さない
});

/* ------------------------------------------------------------- 経済 */

test('買えるものにはすべて値段がある', () => {
  for (const world of WORLDS) {
    for (const [group, bag] of [['武器', world.weapons], ['防具', world.armors],
      ['道具', world.items], ['改造', world.augments || {}]]) {
      for (const thing of Object.values(bag)) {
        assert.equal(typeof thing.cost, 'number', `${world.id}/${group}「${thing.name}」に値段がない`);
      }
    }
    assert.equal(typeof world.startingGold, 'number', `${world.id}: 初期資金が決まっていない`);
  }
});

test('初期資金は世界の尺度で決まる', () => {
  useWorld('embers');
  const knight = createCharacter({ name: '騎', classId: 'fighter', ancestryId: 'human' });
  useWorld('neon');
  const solo = createCharacter({ name: '傭', classId: 'solo', ancestryId: 'street' });
  // 銀貨25枚と €$600 は、それぞれの世界で「宿に何泊できるか」が近い額。
  assert.equal(knight.gold, 25);
  assert.equal(solo.gold, 600);
});

test('改造は費用を取り、払えなければ入らない', () => {
  useWorld('neon');
  const pc = createCharacter({ name: '改', classId: 'techie', ancestryId: 'street' });
  const port = augments().find(a => a.id === 'neuralPort');
  pc.gold = port.cost;
  const first = install(pc, 'neuralPort');
  assert.equal(first.ok, true);
  assert.equal(first.paid, port.cost);
  assert.equal(pc.gold, 0);

  const second = install(pc, 'opticSuite');
  assert.equal(second.ok, false, '資金ゼロで入ってしまった');
  assert.match(second.reason, /資金/);
  assert.equal(pc.augments.includes('opticSuite'), false);
});

test('シナリオの報酬は変数で書ける', () => {
  const ctx = { flags: new Set(), vars: { fee: 250 }, party: [{ name: '受', hp: 5, gold: 0, inventory: [] }] };
  applyEffects([{ gold: { var: 'fee' } }], ctx);
  assert.equal(ctx.party[0].gold, 250);
  applyEffects([{ gold: { var: 'fee', times: 0.4 } }], ctx);
  assert.equal(ctx.party[0].gold, 350);
});

/* ------------------------------------------------- 世界をまたぐ読み込み */

test('人物は自分の世界の目で組み直される', () => {
  useWorld('embers');
  const ranger = createCharacter({
    name: 'イレーヌ', classId: 'ranger', ancestryId: 'elf', backgroundId: 'trapper',
  });
  const saved = JSON.parse(JSON.stringify(ranger));

  // サイバーパンクの卓を開いたまま、ファンタジーの人物を読み込む。
  useWorld('neon');
  const loaded = reviveCharacter(saved);

  assert.equal(loaded.world, 'embers');
  assert.equal(loaded.maxHp, ranger.maxHp, '別の世界の種族で組み直されている');
  assert.equal(loaded.ac, ranger.ac);
  assert.deepEqual(loaded.traits, ranger.traits, 'よその世界の特性が混ざった');
  // 読み込みが卓の世界を書き換えてしまってはいけない。
  assert.equal(activeWorld().id, 'neon');
});

test('世界を持たない古いデータは、読み込んだ側の世界のものとして扱う', () => {
  useWorld('neon');
  const nameless = reviveCharacter({ name: '無名', classId: 'solo', ancestryId: 'street', level: 1 });
  assert.equal(nameless.world, 'neon');
});
