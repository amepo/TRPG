/* 特性の点検 — 「宣言されている特性が、実際に効くか」を一覧にする。

   世界データが宣言した特性を全部拾い、定義の有無と種類を並べる。
   実装漏れ（id が TRAITS に無い）と、描写のみのものを見分けるための道具。

     node tools/traits-report.js */

import { WORLDS } from '../js/worlds/index.js';
import { TRAITS, traitList } from '../js/core/traits.js';

const KIND_LABEL = {
  passive: '受動',
  combat: '戦闘',
  active: '能動',
  flavor: '描写',
};

const rows = [];
for (const world of Object.values(WORLDS)) {
  for (const [group, label] of [['ancestries', '種族/出自'], ['monsters', '敵']]) {
    for (const entity of Object.values(world[group] || {})) {
      for (const trait of traitList(entity)) {
        rows.push({
          world: world.id,
          group: label,
          owner: entity.name,
          id: trait.id,
          text: trait.text,
          kind: trait.def?.kind || null,
        });
      }
    }
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
    if (r.owner !== owner) { owner = r.owner; console.log(`  ${owner}`); }
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
