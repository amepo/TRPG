import test from 'node:test';
import assert from 'node:assert/strict';

import {
  testCondition, applyEffects, validate, blankScenario, normalize, describe,
  interpolate, nodeText, describeCondition,
} from '../js/core/scenario.js';
import { Session } from '../js/core/engine.js';
import { BUILT_IN, byId, catalogue } from '../js/scenarios/index.js';
import { MONSTERS, ITEMS } from '../js/core/content.js';
import { Rng } from '../js/core/rng.js';
import { pregeneratedParty, createCharacter } from '../js/core/character.js';
import { useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';

/* A scenario is only meaningful inside its own setting — monster ids and skill
   ids resolve against the active world. */
const inWorld = scenario => useWorld(scenario.world || DEFAULT_WORLD);

const ctx = (over = {}) => ({ flags: new Set(), vars: {}, party: [], visited: new Set(), ...over });

test.beforeEach(() => useWorld(DEFAULT_WORLD));

/* ------------------------------------------------------------- conditions */

test('flag conditions', () => {
  const c = ctx({ flags: new Set(['hasKey']) });
  assert.equal(testCondition({ flag: 'hasKey' }, c), true);
  assert.equal(testCondition({ flag: 'missing' }, c), false);
  assert.equal(testCondition({ noFlag: 'missing' }, c), true);
});

test('an absent condition passes', () => {
  assert.equal(testCondition(null, ctx()), true);
  assert.equal(testCondition(undefined, ctx()), true);
});

test('numeric comparisons on variables', () => {
  const c = ctx({ vars: { trust: 3 } });
  assert.equal(testCondition({ var: 'trust', gte: 3 }, c), true);
  assert.equal(testCondition({ var: 'trust', gt: 3 }, c), false);
  assert.equal(testCondition({ var: 'trust', lte: 0 }, c), false);
  assert.equal(testCondition({ var: 'trust', eq: 3 }, c), true);
  assert.equal(testCondition({ var: 'unset', lte: 0 }, c), true);
});

test('all / any / not compose', () => {
  const c = ctx({ flags: new Set(['a']), vars: { n: 5 } });
  assert.equal(testCondition({ all: [{ flag: 'a' }, { var: 'n', gte: 5 }] }, c), true);
  assert.equal(testCondition({ all: [{ flag: 'a' }, { flag: 'b' }] }, c), false);
  assert.equal(testCondition({ any: [{ flag: 'b' }, { flag: 'a' }] }, c), true);
  assert.equal(testCondition({ not: { flag: 'b' } }, c), true);
});

test('inventory conditions look across the whole party', () => {
  const party = [{ name: 'A', inventory: [] }, { name: 'B', inventory: [{ id: 'rope', count: 1 }] }];
  assert.equal(testCondition({ has: 'rope' }, ctx({ party })), true);
  assert.equal(testCondition({ has: 'ladder' }, ctx({ party })), false);
});

test('party-shape conditions', () => {
  const party = [{ classId: 'mage', skills: ['arcana'], hp: 4, level: 3 }];
  const c = ctx({ party });
  assert.equal(testCondition({ classIn: ['mage', 'cleric'] }, c), true);
  assert.equal(testCondition({ skillIn: ['arcana'] }, c), true);
  assert.equal(testCondition({ alive: 1 }, c), true);
  assert.equal(testCondition({ alive: 2 }, c), false);
  assert.equal(testCondition({ levelAtLeast: 3 }, c), true);
});

/* ---------------------------------------------------------------- effects */

test('effects set flags and adjust variables', () => {
  const c = ctx({ vars: { trust: 1 } });
  applyEffects([{ setFlag: 'met' }, { var: 'trust', add: 2 }], c);
  assert.equal(c.flags.has('met'), true);
  assert.equal(c.vars.trust, 3);
  applyEffects([{ var: 'trust', set: 0 }, { clearFlag: 'met' }], c);
  assert.equal(c.vars.trust, 0);
  assert.equal(c.flags.has('met'), false);
});

test('giveItem and takeItem move things in and out of the party', () => {
  const party = [{ name: '拾い手', hp: 5, inventory: [] }];
  const c = ctx({ party, items: ITEMS });
  applyEffects([{ giveItem: 'potion', count: 2 }], c);
  assert.equal(party[0].inventory[0].count, 2);
  applyEffects([{ takeItem: 'potion', count: 2 }], c);
  assert.equal(party[0].inventory.length, 0);
});

test('gold and log effects run through the context hooks', () => {
  const lines = [];
  const party = [{ name: '会計', hp: 5, gold: 10, inventory: [] }];
  applyEffects([{ gold: -4 }, { log: 'テスト' }], ctx({ party, log: t => lines.push(t) }));
  assert.equal(party[0].gold, 6);
  assert.ok(lines.includes('テスト'));
});

/* ------------------------------------------------------------------ text */

test('interpolation fills in names and variables', () => {
  const c = ctx({ party: [{ name: 'ニケ', hp: 4 }], vars: { pay: 8 } });
  assert.equal(interpolate('{name} は銀貨{var:pay}枚を受け取った', c), 'ニケ は銀貨8枚を受け取った');
});

test('nodeText accepts strings, arrays and functions', () => {
  const c = ctx({ party: [{ name: 'A', hp: 1 }] });
  assert.deepEqual(nodeText({ text: '一行' }, c), ['一行']);
  assert.deepEqual(nodeText({ text: ['一', '二'] }, c), ['一', '二']);
  assert.deepEqual(nodeText({ text: () => ['動的'] }, c), ['動的']);
});

test('locked choices can explain themselves', () => {
  assert.match(describeCondition({ has: 'ironKey' }), /ironKey/);
  assert.match(describeCondition({ flag: 'knowsRitual' }), /knowsRitual/);
});

/* ------------------------------------------------------------- validation */

test('the blank scenario validates cleanly', () => {
  const result = validate(blankScenario(), { monsters: MONSTERS });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('validation catches dangling links', () => {
  const broken = blankScenario();
  broken.nodes.start.choices[0].to = 'nowhere';
  const result = validate(broken, { monsters: MONSTERS });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('nowhere')));
});

test('validation catches a missing start node and unknown monsters', () => {
  const broken = blankScenario();
  broken.start = 'ghost';
  broken.nodes.end.combat = { enemies: ['tarrasque'] };
  const result = validate(broken, { monsters: MONSTERS });
  assert.ok(result.errors.some(e => e.includes('ghost')));
  assert.ok(result.errors.some(e => e.includes('tarrasque')));
});

test('validation warns about unreachable nodes', () => {
  const scenario = blankScenario();
  scenario.nodes.orphan = { id: 'orphan', text: ['誰も来ない'], ending: { type: 'neutral', title: 'x', text: 'y' } };
  const result = validate(scenario, { monsters: MONSTERS });
  assert.ok(result.warnings.some(w => w.includes('orphan')));
});

test('every shipped scenario is valid', () => {
  for (const scenario of BUILT_IN) {
    inWorld(scenario);
    const result = validate(scenario, { monsters: MONSTERS });
    assert.equal(result.ok, true, `${scenario.id}:\n${result.errors.join('\n')}`);
  }
  useWorld(DEFAULT_WORLD);
});

test('shipped scenarios have no dead-end warnings that matter', () => {
  for (const scenario of BUILT_IN) {
    inWorld(scenario);
    const { warnings } = validate(scenario, { monsters: MONSTERS });
    const deadEnds = warnings.filter(w => w.includes('行き止まり'));
    assert.deepEqual(deadEnds, [], `${scenario.id}: ${deadEnds.join(', ')}`);
  }
  useWorld(DEFAULT_WORLD);
});

test('the catalogue describes each scenario', () => {
  const cards = catalogue();
  assert.equal(cards.length, BUILT_IN.length);
  for (const card of cards) {
    assert.ok(card.title && card.nodeCount > 0);
    assert.ok(card.endingCount >= 1, `${card.id}: エンディングがない`);
  }
  assert.ok(byId('silent-bell'));
  assert.equal(byId('nope'), null);
});

test('normalize stamps node ids and fills the optional maps', () => {
  const scenario = normalize({ id: 'x', start: 'a', nodes: { a: { text: ['hi'] } } });
  assert.equal(scenario.nodes.a.id, 'a');
  assert.deepEqual(scenario.vars, {});
  assert.deepEqual(scenario.monsters, {});
});

/* ------------------------------------------------------------- the engine */

const tinyScenario = {
  id: 'test-scn', title: 'テスト', start: 'a', vars: { n: 0 },
  nodes: {
    a: {
      id: 'a', title: '入口', text: ['始まり'],
      onEnter: [{ var: 'n', add: 1 }],
      choices: [
        { text: '進む', to: 'b' },
        { text: '鍵が要る扉', requires: { flag: 'key' }, lockedText: '鍵がない', to: 'b' },
        { text: '判定する', check: { skill: 'athletics', dc: 5, success: { to: 'b' }, fail: { to: 'b' } } },
        { text: '一度きり', once: true, to: 'a' },
      ],
    },
    b: { id: 'b', title: '終点', text: ['終わり'], ending: { type: 'good', title: '完', text: 'おしまい' } },
  },
};

test('a session narrates the start node and offers its choices', () => {
  const session = new Session({ scenario: tinyScenario, party: [createCharacter({ name: 'テス' })], seed: 1 });
  const view = session.start();
  assert.equal(view.nodeId, 'a');
  assert.ok(view.log.some(e => e.text === '始まり'));
  assert.equal(session.vars.n, 1);
});

test('locked choices are shown but refuse to be taken', () => {
  const session = new Session({ scenario: tinyScenario, party: [createCharacter({ name: 'テス' })], seed: 1 });
  session.start();
  const locked = session.availableChoices().find(c => c.locked);
  assert.equal(locked.lockedText, '鍵がない');
  assert.ok(session.choose(locked.index).error);
  assert.equal(session.nodeId, 'a');
});

test('once-only choices disappear after use', () => {
  const session = new Session({ scenario: tinyScenario, party: [createCharacter({ name: 'テス' })], seed: 1 });
  session.start();
  const once = session.availableChoices().find(c => c.text === '一度きり');
  session.choose(once.index);
  assert.equal(session.availableChoices().some(c => c.text === '一度きり'), false);
});

test('a check logs its roll and follows a branch', () => {
  const session = new Session({ scenario: tinyScenario, party: [createCharacter({ name: 'テス' })], seed: 3 });
  session.start();
  const checkChoice = session.availableChoices().find(c => c.check);
  assert.equal(checkChoice.check.dc, 5);
  assert.ok(checkChoice.check.candidates.length >= 1);
  session.choose(checkChoice.index);
  assert.ok(session.log.some(e => e.kind === 'roll-good' || e.kind === 'roll-bad'));
  assert.equal(session.nodeId, 'b');
});

test('reaching an ending finishes the session', () => {
  const session = new Session({ scenario: tinyScenario, party: [createCharacter({ name: 'テス' })], seed: 1 });
  session.start();
  session.choose(0);
  assert.equal(session.finished, true);
  assert.equal(session.ending.type, 'good');
  assert.equal(session.view().choices.length, 0);
});

test('the session save round-trips through JSON', () => {
  const session = new Session({ scenario: byId('silent-bell'), party: pregeneratedParty(), seed: 42 });
  session.start();
  session.choose(0);
  const saved = JSON.parse(JSON.stringify(session.save()));

  const restored = Session.load(saved);
  assert.equal(restored.nodeId, session.nodeId);
  assert.deepEqual([...restored.flags], [...session.flags]);
  assert.deepEqual(restored.vars, session.vars);
  assert.equal(restored.party.length, session.party.length);
  assert.equal(restored.party[0].hp, session.party[0].hp);
  // The restored generator must continue the same stream.
  assert.equal(restored.rng.save().count, session.rng.save().count);
});

test('a seeded playthrough is reproducible', () => {
  const play = () => {
    const session = new Session({ scenario: byId('first-job'), party: pregeneratedParty(), seed: 'たね' });
    session.start();
    let guard = 0;
    while (!session.finished && guard++ < 60) {
      if (session.combat) {
        const options = session.view().combat.options;
        const attack = options.find(o => o.kind === 'attack') || options[0];
        session.act({ ...attack, targetUid: session.view().combat.targets[0]?.uid });
      } else {
        const choices = session.availableChoices().filter(c => !c.locked);
        if (!choices.length) break;
        session.choose(choices[0].index);
      }
    }
    return session.log.map(e => e.text).join('\n');
  };
  assert.equal(play(), play());
});

test('the tutorial can be played to an ending', () => {
  const session = new Session({ scenario: byId('first-job'), party: pregeneratedParty(), seed: 5 });
  session.start();
  let guard = 0;
  while (!session.finished && guard++ < 120) {
    if (session.combat) {
      const view = session.view();
      const attack = view.combat.options.find(o => o.kind === 'attack') || view.combat.options[0];
      session.act({ ...attack, targetUid: view.combat.targets[0]?.uid });
    } else {
      const choices = session.availableChoices().filter(c => !c.locked);
      if (!choices.length) break;
      session.choose(choices[0].index);
    }
  }
  assert.equal(session.finished, true, '結末に到達しなかった');
  assert.ok(session.ending.title);
});

/* The village is a hub the player can circle indefinitely on purpose, so the
   walker picks at random rather than always taking the same index — a fixed
   choice just paces between the inn and the square forever. */
test('a random walker always reaches some ending in the main scenario', () => {
  for (let seed = 0; seed < 12; seed++) {
    const picker = new Rng(seed * 977 + 13);
    const session = new Session({ scenario: byId('silent-bell'), party: pregeneratedParty(), seed });
    session.start();
    let guard = 0;
    while (!session.finished && guard++ < 600) {
      if (session.combat) {
        const view = session.view();
        const option = view.combat.options.find(o => o.kind === 'attack') || view.combat.options[0];
        if (!option) break;
        session.act({ ...option, targetUid: view.combat.targets[0]?.uid });
      } else {
        const choices = session.availableChoices().filter(c => !c.locked);
        assert.ok(choices.length, `seed ${seed}: ノード "${session.nodeId}" で進めなくなった`);
        session.choose(picker.pick(choices).index);
      }
    }
    assert.equal(session.finished, true, `seed ${seed}: ${guard} 手で結末に届かなかった（現在地 ${session.nodeId}）`);
    assert.ok(session.ending?.title);
  }
});

test('a scripted route reaches the good ending of the main scenario', () => {
  // 街道で足跡を見つける → 村で信頼を稼ぐ → 森 → 納骨堂 → 儀式を止める → 村に報告
  const session = new Session({ scenario: byId('silent-bell'), party: pregeneratedParty(), seed: 4 });
  session.start();

  const take = label => {
    const choice = session.availableChoices().find(c => c.text.includes(label) && !c.locked);
    assert.ok(choice, `"${label}" を含む選択肢が ${session.nodeId} に無い`);
    session.choose(choice.index);
  };
  const fight = () => {
    let guard = 0;
    while (session.combat && guard++ < 200) {
      const view = session.view();
      const option = view.combat.options.find(o => o.kind === 'attack') || view.combat.options[0];
      if (!option) break;
      session.act({ ...option, targetUid: view.combat.targets[0]?.uid });
    }
  };

  // 判定の成否は乱数任せなので、経路の存在だけを追う。
  take('荷車');                       // → ambush（戦闘）
  fight();
  assert.ok(['gate', 'rescued'].includes(session.nodeId), `想定外の遷移: ${session.nodeId}`);
  if (session.nodeId === 'gate') take('鐘のことを');
  else take('礼を言って');
  assert.equal(session.nodeId, 'square');

  // 村を回って手がかりを集める。
  take('礼拝堂へ行き');
  assert.equal(session.nodeId, 'chapel');
  take('倒れた二人');
  assert.equal(session.nodeId, 'chapelTalk');
  take('礼を言って外に出る');
  assert.equal(session.nodeId, 'square');
  session.rest('long');               // 傷を癒してから森へ

  // 手がかりが揃っていれば森へ抜けられる。
  const toForest = session.availableChoices().find(c => c.text.includes('森') && !c.locked);
  assert.ok(toForest, `村から森へ出られない（flags: ${[...session.flags].join(',')}）`);
  session.choose(toForest.index);
  assert.equal(session.nodeId, 'forest');
});

test('a wiped party ends the story rather than hanging', () => {
  const doomed = [createCharacter({ name: '不運', classId: 'mage', ancestryId: 'human', backgroundId: 'scholar', abilities: { con: 8 } })];
  const session = new Session({
    scenario: {
      id: 'doom', title: '死地', start: 'fight',
      nodes: {
        fight: { id: 'fight', title: '死地', combat: { enemies: ['ogre', 'ogre', 'ogre'], onVictory: { to: 'win' } } },
        win: { id: 'win', title: '勝利', ending: { type: 'good', title: '生還', text: '生きて帰った' } },
      },
    },
    party: doomed, seed: 2,
  });
  session.start();
  let guard = 0;
  while (!session.finished && session.combat && guard++ < 200) {
    const view = session.view();
    const option = view.combat.options?.[0];
    if (!option) break;
    session.act({ ...option, targetUid: view.combat.targets[0]?.uid });
  }
  assert.equal(session.finished, true);
  assert.equal(session.ending.type, 'bad');
});

test('resting restores the party mid-scenario', () => {
  const party = pregeneratedParty();
  party[0].hp = 1;
  const session = new Session({ scenario: tinyScenario, party, seed: 1 });
  session.start();
  session.rest('long');
  assert.equal(party[0].hp, party[0].maxHp);
});

test('describe summarises a scenario for the picker', () => {
  const summary = describe(byId('silent-bell'));
  assert.ok(summary.nodeCount > 10);
  assert.ok(summary.combatCount >= 2);
  assert.ok(summary.checkCount >= 8);
  assert.ok(summary.endingCount >= 3);
});
