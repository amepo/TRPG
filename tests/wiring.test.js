import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../js/core/scenario.js';
import { useWorld, DEFAULT_WORLD } from '../js/worlds/index.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BUILT_IN } from '../js/scenarios/index.js';

/* 配線の抜けを止める。とくに sw.js の漏れは「オフラインのときだけ壊れる」ので、
   ユニットテストにもブラウザ検証にも映らない。ここでしか捕まらない。
   ずれていたら `npm run sync` を実行する。 */

const ROOT = new URL('..', import.meta.url).pathname;

async function walkJs(dir, base = '') {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walkJs(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.js')) out.push(`js/${rel}`);
  }
  return out;
}

test('サービスワーカーが js/ の全ファイルを先読みしている', async () => {
  const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/(js\/[^']+)'/g)].map(m => m[1]));
  const missing = (await walkJs('js')).filter(f => !listed.has(f));
  assert.deepEqual(missing, [], `sw.js に無い（オフラインで壊れる）— npm run sync を実行: ${missing.join(', ')}`);
});

test('js/scenarios/ の全ファイルが収録一覧に載っている', async () => {
  const files = (await readdir(join(ROOT, 'js/scenarios')))
    .filter(f => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'));
  assert.equal(BUILT_IN.length, files.length,
    `ファイル ${files.length}本に対し収録は ${BUILT_IN.length}本 — npm run sync を実行`);
});

test('シナリオの id とタイトルが重複していない', () => {
  const ids = BUILT_IN.map(s => s.id);
  const titles = BUILT_IN.map(s => s.title);
  assert.equal(new Set(ids).size, ids.length, `id の重複: ${ids.join(', ')}`);
  assert.equal(new Set(titles).size, titles.length, `タイトルの重複: ${titles.join(', ')}`);
});

test('すべてのシナリオが必要な項目を備えている', () => {
  for (const s of BUILT_IN) {
    assert.ok(s.id && s.title && s.blurb, `${s.id}: 基本項目`);
    assert.ok(s.world, `${s.id}: world`);
    assert.ok(s.start && s.nodes[s.start], `${s.id}: 開始ノード`);
    assert.ok(s.length, `${s.id}: 長さの表示`);
    const endings = Object.values(s.nodes).filter(n => n.ending);
    assert.ok(endings.length >= 2, `${s.id}: 結末が ${endings.length} 個しかない`);
  }
});

/* テンプレートは工房の「JSONを読み込む」に投げるもの。壊れていたら意味がない。 */
test('JSON テンプレートはそのまま読み込める', async () => {
  const dir = new URL('../templates/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 5, `テンプレートが ${files.length} 個しかない`);

  for (const file of files) {
    const data = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
    useWorld(data.world || DEFAULT_WORLD);
    const { MONSTERS } = await import('../js/core/content.js');
    const result = validate(data, { monsters: MONSTERS });
    assert.equal(result.ok, true, `${file}:\n${(result.errors || []).join('\n')}`);
  }
  useWorld(DEFAULT_WORLD);
});
