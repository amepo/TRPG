/* 特性の点検 — 「宣言されている特性が、実際に効くか」を一覧にする。

   世界データとシナリオが宣言した特性を全部拾い、定義の有無と種類を並べる。
   実装漏れ（id が TRAITS に無い）と、描写のみのものを見分けるための道具。

   シナリオ側も見る。ここを世界データだけにしていたあいだ、収録シナリオの
   敵が素の文字列で7件も特性を名乗っていた——「HPが半分を切ると降参する」
   「1度だけダメージを半減する」。どれも一度も効いていなかった。
   点検の穴は、穴のあるところにそのまま溜まる。

     node tools/traits-report.js */

import { WORLDS } from '../js/worlds/index.js';
import { BUILT_IN } from '../js/scenarios/index.js';
import { TRAITS, traitList } from '../js/core/traits.js';

const KIND_LABEL = {
  passive: '受動',
  combat: '戦闘',
  active: '能動',
  flavor: '描写',
};

const rows = [];
const collect = (world, group, owner, entity) => {
  for (const trait of traitList(entity)) {
    rows.push({ world, group, owner, id: trait.id, text: trait.text, kind: trait.def?.kind || null });
  }
};

for (const world of Object.values(WORLDS)) {
  for (const [group, label] of [['ancestries', '種族/出自'], ['monsters', '敵']]) {
    for (const entity of Object.values(world[group] || {})) collect(world.id, label, entity.name, entity);
  }
}

/* シナリオが自前で持っている敵。世界の敵と同じ土俵で見る。 */
for (const scenario of BUILT_IN) {
  for (const [id, monster] of Object.entries(scenario.monsters || {})) {
    collect(scenario.world || 'embers', `敵（${scenario.title}）`, monster.name || id, monster);
  }
}

const missing = rows.filter(r => !r.id || !TRAITS[r.id]);
const byKind = {};
for (const r of rows) byKind[r.kind || '未定義'] = (byKind[r.kind || '未定義'] || 0) + 1;

console.log(`特性 ${rows.length} 件\n`);

for (const world of Object.values(WORLDS)) {
  const mine = rows.filter(r => r.world === world.id);
  console.log(`■ ${world.icon || ''} ${world.name}  (${mine.length}件)`);
  let owner = null;
  for (const r of mine) {
    if (r.owner !== owner) { owner = r.owner; console.log(`  ${owner}${r.group.startsWith('敵（') ? ` ${r.group}` : ''}`); }
    const mark = !r.id || !TRAITS[r.id] ? '✗ 未実装' : `${KIND_LABEL[r.kind] || r.kind}`;
    console.log(`    [${String(mark).padEnd(4)}] ${r.text}`);
  }
  console.log('');
}

console.log('内訳: ' + Object.entries(byKind).map(([k, n]) => `${KIND_LABEL[k] || k} ${n}`).join(' / '));

/* 使われていない定義も知らせる。世界を削ったときの置き去りを拾う。 */
const used = new Set(rows.map(r => r.id));
const unused = Object.keys(TRAITS).filter(id => !used.has(id));
if (unused.length) console.log(`どの世界からも参照されていない定義: ${unused.join('、')}`);

if (missing.length) {
  console.log(`\n✗ 実装されていない特性が ${missing.length} 件あります`);
  for (const m of missing) console.log(`  ${m.world} ${m.owner}: ${m.text}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ 宣言されている特性はすべて実装されています');
}
