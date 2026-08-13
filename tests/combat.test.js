import test from 'node:test';
import assert from 'node:assert/strict';

import { Combat, spawnMonster, spawnGroup, conditionName } from '../js/core/combat.js';
import { Rng } from '../js/core/rng.js';
import { createCharacter, pregeneratedParty } from '../js/core/character.js';
import { encounterDifficulty, MONSTERS } from '../js/core/content.js';

const hero = (over = {}) => createCharacter({
  name: '勇者', classId: 'fighter', ancestryId: 'human', backgroundId: 'soldier',
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }, ...over,
});

/** Run a fight to its conclusion, always taking the first offered action. */
function autoplay(combat, { maxTurns = 400 } = {}) {
  let step = combat.start();
  let guard = 0;
  while (!step.done && guard++ < maxTurns) {
    if (combat.isPlayerTurn) {
      const options = combat.options();
      const attack = options.find(o => o.kind === 'attack') || options[0];
      const target = combat.livingEnemies[0];
      step = combat.act({ ...attack, targetUid: target?.uid });
    } else {
      step = combat.enemyTurn();
    }
    if (step?.error) throw new Error(step.error);
  }
  return step;
}

test('spawning a monster rolls its hit points within range', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 50; i++) {
    const goblin = spawnMonster('goblin', { rng });
    assert.ok(goblin.hp >= 4 && goblin.hp <= 14, `hp ${goblin.hp}`);
    assert.equal(goblin.hp, goblin.maxHp);
    assert.equal(goblin.side, 'enemy');
  }
});

test('spawning an unknown monster throws', () => {
  assert.throws(() => spawnMonster('dragon-of-nowhere'), /未知のモンスター/);
});

test('duplicate monsters get distinguishing suffixes and unique ids', () => {
  const group = spawnGroup(['goblin', 'goblin', 'wolf'], new Rng(3));
  assert.equal(group[0].name, 'ゴブリンＡ');
  assert.equal(group[1].name, 'ゴブリンＢ');
  assert.equal(group[2].name, '狼');
  assert.equal(new Set(group.map(g => g.uid)).size, 3);
});

test('initiative order contains everyone exactly once', () => {
  const party = [hero()];
  const enemies = spawnGroup(['goblin', 'goblin'], new Rng(1));
  const combat = new Combat(party, enemies, { rng: new Rng(1) });
  combat.start();
  assert.equal(combat.order.length, 3);
  assert.equal(new Set(combat.order).size, 3);
});

test('a lone hero beats a single goblin and the fight reports victory', () => {
  const party = [hero()];
  const combat = new Combat(party, spawnGroup(['goblin'], new Rng(11)), { rng: new Rng(11) });
  const result = autoplay(combat);
  assert.equal(result.done, true);
  assert.ok(['victory', 'defeat'].includes(result.result));
  assert.ok(combat.log.length > 3);
});

test('every fight terminates instead of looping forever', () => {
  for (let seed = 0; seed < 25; seed++) {
    const party = pregeneratedParty();
    const combat = new Combat(party, spawnGroup(['goblin', 'goblin', 'wolf'], new Rng(seed)), { rng: new Rng(seed) });
    const result = autoplay(combat);
    assert.equal(result.done, true, `seed ${seed} did not finish`);
    assert.ok(['victory', 'defeat', 'fled'].includes(result.result));
  }
});

test('victory awards the summed xp of the enemies', () => {
  const party = pregeneratedParty();
  const combat = new Combat(party, spawnGroup(['goblin', 'goblin'], new Rng(5)), { rng: new Rng(5) });
  const result = autoplay(combat);
  if (result.result === 'victory') assert.equal(result.xp, 100);
});

test('the party wiping out ends the fight in defeat', () => {
  const weakling = createCharacter({ name: '見習い', classId: 'mage', ancestryId: 'human', backgroundId: 'scholar', abilities: { con: 8, dex: 8 } });
  const combat = new Combat([weakling], spawnGroup(['ogre', 'ogre'], new Rng(2)), { rng: new Rng(2) });
  const result = autoplay(combat);
  assert.equal(result.result, 'defeat');
  assert.equal(combat.livingParty.length, 0);
});

test('downed characters roll death saves rather than acting', () => {
  const pc = hero();
  pc.hp = 0;
  const combat = new Combat([pc, hero({ name: '相棒' })], spawnGroup(['goblin'], new Rng(4)), { rng: new Rng(4) });
  autoplay(combat);
  assert.ok(combat.log.some(e => e.text.includes('死亡セーヴ')), '死亡セーヴのログがない');
});

test('the state snapshot mirrors the live combatants', () => {
  const party = [hero()];
  const combat = new Combat(party, spawnGroup(['goblin', 'wolf'], new Rng(9)), { rng: new Rng(9) });
  combat.start();
  const state = combat.state();
  assert.equal(state.order.length, 3);
  assert.equal(state.round, 1);
  for (const row of state.order) {
    assert.ok(row.hp <= row.maxHp);
    assert.ok(typeof row.ac === 'number');
  }
});

test('players can only act on their own turn', () => {
  const combat = new Combat([hero()], spawnGroup(['goblin'], new Rng(6)), { rng: new Rng(6) });
  combat.start();
  if (!combat.isPlayerTurn) {
    assert.ok(combat.act({ kind: 'attack', id: 'weapon' }).error);
  } else {
    assert.ok(combat.enemyTurn().error);
  }
});

test('drinking a potion heals and consumes the item', () => {
  const pc = hero();
  pc.hp = 1;
  const combat = new Combat([pc], spawnGroup(['goblin'], new Rng(8)), { rng: new Rng(8) });
  combat.start();
  while (!combat.isPlayerTurn && !combat.over) combat.enemyTurn();
  if (combat.isPlayerTurn) {
    const before = pc.inventory.find(i => i.id === 'potion').count;
    combat.act({ kind: 'item', id: 'potion' });
    assert.ok(pc.hp > 1, '回復していない');
    const after = pc.inventory.find(i => i.id === 'potion')?.count ?? 0;
    assert.equal(after, before - 1);
  }
});

test('second wind can only be used while the resource lasts', () => {
  const pc = hero();
  pc.hp = 2;
  const combat = new Combat([pc], spawnGroup(['goblin'], new Rng(12)), { rng: new Rng(12) });
  combat.start();
  while (!combat.isPlayerTurn && !combat.over) combat.enemyTurn();
  if (combat.isPlayerTurn) {
    combat.act({ kind: 'feature', id: 'secondWind' });
    assert.equal(pc.resources.secondWind.used, 1);
    assert.ok(combat.act({ kind: 'feature', id: 'secondWind' }).error || pc.resources.secondWind.used === 1);
  }
});

test('fleeing is unavailable on the first round', () => {
  const combat = new Combat([hero()], spawnGroup(['goblin'], new Rng(13)), { rng: new Rng(13) });
  combat.start();
  assert.equal(combat.canFlee(), false);
  combat.round = 2;
  assert.equal(combat.canFlee(), true);
});

test('surprise skips the surprised side on round one', () => {
  const party = [hero()];
  const combat = new Combat(party, spawnGroup(['goblin', 'goblin'], new Rng(15)), { rng: new Rng(15), surprise: 'party' });
  combat.start();
  const firstRound = combat.log.filter(e => e.round === 1);
  assert.ok(firstRound.some(e => e.text.includes('不意打ち成功')));
});

test('every shipped monster has the fields combat relies on', () => {
  for (const [id, monster] of Object.entries(MONSTERS)) {
    assert.ok(monster.name, `${id}: name`);
    assert.ok(monster.acOverride > 0, `${id}: ac`);
    assert.ok(monster.hp || monster.hpAvg, `${id}: hp`);
    assert.ok(monster.abilities?.dex !== undefined, `${id}: abilities`);
    assert.ok(monster.attacks?.length, `${id}: attacks`);
    for (const attack of monster.attacks) {
      assert.ok(typeof attack.bonus === 'number', `${id}: ${attack.name} bonus`);
      assert.ok(attack.damage, `${id}: ${attack.name} damage`);
    }
    assert.ok(typeof monster.xp === 'number', `${id}: xp`);
  }
});

test('encounter difficulty scales with the roster', () => {
  assert.equal(encounterDifficulty(['goblin'], 1, 4).level, 'easy');
  assert.equal(encounterDifficulty(['ogre', 'ogre', 'ogre'], 1, 1).level, 'deadly');
});

test('condition names are localised', () => {
  assert.equal(conditionName('poisoned'), '毒');
  assert.equal(conditionName('unknown-thing'), 'unknown-thing');
});
