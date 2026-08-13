/* 経済の点検 — 設定に書いた物価と、実際に動く金額が噛み合っているか。

   設定は書いただけでは固まらない。「駆け出しの依頼は銀貨5枚」と書いた横で
   シナリオが200枚払っていたら、その世界は嘘をついている。ここでは
   世界の宣言（lore.economy と装備の値段）と、収録シナリオが実際に動かす
   金額を並べて、噛み合っていない箇所を出す。

     node tools/economy.js */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WORLDS, useWorld } from '../js/worlds/index.js';
import { LORE } from '../js/core/lore.js';
import { BUILT_IN } from '../js/scenarios/index.js';
import { Session } from '../js/core/engine.js';
import { pregeneratedParty } from '../js/core/character.js';
import { Rng } from '../js/core/rng.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenarioDir = join(here, '..', 'js', 'scenarios');

/* シナリオが動かす金額を、ソースから素で拾う。エンジンを回すより確実で速い。 */
function goldMoves(scenario) {
  const file = readdirSync(scenarioDir).find(f => readFileSync(join(scenarioDir, f), 'utf8').includes(`id: '${scenario.id}'`));
  if (!file) return [];
  const src = readFileSync(join(scenarioDir, file), 'utf8');
  return [...src.matchAll(/gold:\s*(-?\d+)/g)].map(m => Number(m[1]));
}

const problems = [];

/* 実際に遊んで、結末ごとに一行の懐がどう動いたかを測る。
   「報酬は満額」と書いた結末が1枚も払わないのを、目で見つけるのは無理だ。 */
function payoutsByEnding(scenario, runs = 90) {
  const out = {};
  for (let seed = 1; seed <= runs; seed++) {
    useWorld(scenario.world);
    const party = pregeneratedParty();
    const before = party.reduce((sum, pc) => sum + pc.gold, 0);
    const session = new Session({ scenario, party, seed });
    session.start();
    const rng = new Rng(seed * 31 + 7);
    for (let guard = 0; !session.finished && guard < 600; guard++) {
      if (session.combat) {
        const view = session.view();
        const options = view.combat.options.filter(o => !o.disabled && o.kind !== 'flee');
        const action = rng.pick(options) || view.combat.options[0];
        if (!action) break;
        session.act({ ...action, targetUid: view.combat.targets[0]?.uid });
        continue;
      }
      if (session.netrun) { session.hack({ id: 'careful' }); continue; }
      const open = session.view().choices.filter(c => !c.locked);
      if (!open.length) break;
      session.choose(rng.pick(open).index);
    }
    if (!session.ending) continue;
    const after = session.party.reduce((sum, pc) => sum + pc.gold, 0);
    const key = session.ending.title;
    (out[key] = out[key] || { type: session.ending.type, deltas: [] }).deltas.push(after - before);
  }
  return out;
}

/** その結末は、払わないことに意味があるか（endings に noPay: true と書いてある）。 */
const declaredUnpaid = scenario => new Set(
  Object.values(scenario.nodes).filter(n => n.ending?.noPay).map(n => n.ending.title),
);

for (const world of WORLDS) {
  useWorld(world.id);
  const eco = LORE.economy;
  const unit = eco?.unit || '';
  const scenarios = BUILT_IN.filter(s => s.world === world.id);

  const gains = [];
  const spends = [];
  for (const scenario of scenarios) {
    for (const amount of goldMoves(scenario)) (amount > 0 ? gains : spends).push({ scenario: scenario.id, amount });
  }

  console.log(`■ ${world.icon || ''} ${world.name}  単位 ${unit}｜初期資金 ${world.startingGold}`);

  if (!eco) { problems.push(`${world.id}: 物価が書かれていない`); console.log('  ✗ 物価なし\n'); continue; }

  const anchor = name => eco.anchors.find(a => a.what.includes(name))?.cost ?? null;
  const night = anchor('一泊');
  const smallJob = eco.anchors.find(a => /依頼|一件/.test(a.what))?.cost ?? null;

  console.log(`  物価の基準 ${eco.anchors.length}件｜一泊 ${night}｜小さな仕事 ${smallJob}`);
  if (gains.length) {
    const amounts = gains.map(g => g.amount).sort((a, b) => a - b);
    console.log(`  シナリオの収入 ${gains.length}件: ${amounts[0]} 〜 ${amounts.at(-1)}`);
  }
  if (spends.length) {
    const amounts = spends.map(g => -g.amount).sort((a, b) => a - b);
    console.log(`  シナリオの支出 ${spends.length}件: ${amounts[0]} 〜 ${amounts.at(-1)}`);
  }

  /* 検査1: 買えるものに値段があるか。 */
  for (const [group, bag] of [['武器', world.weapons], ['防具', world.armors], ['道具', world.items], ['改造', world.augments || {}]]) {
    for (const thing of Object.values(bag)) {
      if (thing.cost === undefined) problems.push(`${world.id}: ${group}「${thing.name}」に値段がない`);
    }
  }

  /* 検査2: 初期資金で、いちばん安い防具くらいは買えるか。 */
  const cheapestArmor = Math.min(...Object.values(world.armors).map(a => a.cost ?? Infinity));
  if (world.startingGold < cheapestArmor) {
    problems.push(`${world.id}: 初期資金 ${world.startingGold} では最安の防具 ${cheapestArmor} も買えない`);
  }

  /* 検査3: シナリオの報酬が、宣言した尺度の内側にあるか。
     一泊ぶんを下回る報酬や、一年ぶんの暮らしを超える報酬は、設定と噛み合わない。 */
  const ceiling = eco.anchors.reduce((max, a) => Math.max(max, a.cost), 0);
  for (const { scenario, amount } of gains) {
    if (night && amount < night) problems.push(`${world.id}/${scenario}: 報酬 ${amount} が一泊 ${night} より安い`);
    if (amount > ceiling * 2) problems.push(`${world.id}/${scenario}: 報酬 ${amount} が物価の上限 ${ceiling} の2倍を超える`);
  }

  /* 検査4: 報酬を約束した結末が、実際に払っているか。
     悪い結末は免除。払わないことに意味がある結末は ending.noPay で宣言する。 */
  for (const scenario of scenarios) {
    const unpaid = declaredUnpaid(scenario);
    for (const [title, { type, deltas }] of Object.entries(payoutsByEnding(scenario))) {
      const average = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      if (type === 'bad' || unpaid.has(title)) continue;
      if (average <= 0) {
        problems.push(`${world.id}/${scenario.id}: 結末「${title}」（${type}）で懐が ${average}。報酬が届いていない`);
      }
    }
  }

  /* 検査5: 装備の値段が、この世界の尺度に収まっているか。 */
  const priciest = Math.max(...Object.values({ ...world.weapons, ...world.armors, ...world.items, ...(world.augments || {}) })
    .map(t => t.cost ?? 0));
  console.log(`  いちばん高い装備 ${priciest}｜物価表の上限 ${ceiling}`);
  if (priciest > ceiling * 3) {
    problems.push(`${world.id}: 最高価格 ${priciest} が物価表の上限 ${ceiling} から離れすぎている`);
  }
  console.log('');
}

if (problems.length) {
  console.log(`✗ ${problems.length} 件の食い違い`);
  for (const p of problems) console.log(`  ${p}`);
  process.exitCode = 1;
} else {
  console.log('✓ 設定の物価と、シナリオが動かす金額は噛み合っています');
}
