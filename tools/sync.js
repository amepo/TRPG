/* シナリオを置いただけで登録されるようにする。

   ブラウザはディレクトリを走査できないので、収録一覧は静的なファイルとして
   持つしかない。それを手で書き続けると必ず漏れる——とくに sw.js の漏れは
   「オフラインのときだけ壊れる」ので、テストにもブラウザ検証にも映らない。
   だからここで生成する。

   使い方: node tools/sync.js   （npm run sync） */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** ファイル名 first-job.js → 変数名 firstJob */
const varName = file => file.replace(/\.js$/, '')
  .replace(/-(\w)/g, (_, c) => c.toUpperCase());

const files = (await readdir(join(ROOT, 'js/scenarios')))
  .filter(f => f.endsWith('.js') && f !== 'index.js' && !f.startsWith('_'))
  .sort();

/* --------------------------------------------------- js/scenarios/index.js */

/* 並び順は「導入が先、あとは世界ごと」。読み込んで order を見る。 */
const metas = [];
for (const file of files) {
  const mod = await import(new URL(`../js/scenarios/${file}`, import.meta.url));
  const scenario = mod.default || Object.values(mod)[0];
  metas.push({ file, name: varName(file), world: scenario.world || 'embers', tutorial: !!scenario.tutorial });
}
metas.sort((a, b) => a.world.localeCompare(b.world) || (b.tutorial - a.tutorial) || a.file.localeCompare(b.file));

const indexSource = `/* Scenarios shipped with the app, plus whatever the player has saved locally.

   このファイルは tools/sync.js が生成します。手で編集しないでください。
   シナリオを足すときは js/scenarios/ に置いて \`npm run sync\` を実行します。 */

${metas.map(m => `import { ${m.name} } from './${m.file}';`).join('\n')}
import { describe } from '../core/scenario.js';
import { worldById, DEFAULT_WORLD } from '../worlds/index.js';

export const BUILT_IN = [${metas.map(m => m.name).join(', ')}];

export const byId = id => BUILT_IN.find(s => s.id === id) || null;

/** Everything shipped for one setting. */
export const forWorld = worldId => BUILT_IN.filter(s => (s.world || DEFAULT_WORLD) === worldId);

/** Cards for the scenario picker, tagged with the world they belong to. */
export const catalogue = () => BUILT_IN.map(s => {
  const world = worldById(s.world || DEFAULT_WORLD);
  return {
    ...describe(s),
    length: s.length || '',
    author: s.author || '',
    tutorial: !!s.tutorial,
    builtIn: true,
    worldName: world?.name || '',
    worldIcon: world?.icon || '',
  };
});
`;
await writeFile(join(ROOT, 'js/scenarios/index.js'), indexSource);

/* ------------------------------------------------------- js/templates.js */

/* templates/*.json をそのまま JS に埋め込む。工房から落とせるようにするのに、
   通信を挟みたくない——このアプリはオフラインで動くのが前提なので。 */
const templateFiles = (await readdir(join(ROOT, 'templates')))
  .filter(f => f.endsWith('.json')).sort();

const ORDER = ['annotated', 'linear', 'hub', 'clock', 'route'];
const rank = f => {
  const at = ORDER.indexOf(f.replace('.json', ''));
  return at === -1 ? ORDER.length : at;
};
templateFiles.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

const NOTES = {
  annotated: '使える書き方の全部入り。まずこれを開くのがいちばん早い',
  linear: '一本道。判定と戦闘を一度ずつ',
  hub: '拠点から複数の調査先へ。手がかりが揃うと次へ',
  clock: '変数が上限に達すると場面が強制的に変わる',
  route: '複数の道のうち二区間を通って目的地へ',
};

const templates = [];
for (const file of templateFiles) {
  const data = JSON.parse(await readFile(join(ROOT, 'templates', file), 'utf8'));
  const key = file.replace('.json', '');
  templates.push({ file, key, data, note: NOTES[key] || '' });
}

const templateSource = `/* 自動生成 — \`npm run sync\` が templates/*.json から作ります。手で編集しない。

   工房から見本を落とせるようにするためのもの。通信を挟まずに済むよう、
   中身をそのまま埋め込んである（このアプリはオフラインで動くのが前提）。 */

export const TEMPLATES = ${JSON.stringify(templates, null, 2)};

export const templateByKey = key => TEMPLATES.find(t => t.key === key) || null;
`;
await writeFile(join(ROOT, 'js/templates.js'), templateSource);

/* --------------------------------------------------------------- sw.js */

/* js/ の下にある全ファイルを列挙し、プリキャッシュ一覧を作り直す。 */
async function walk(dir, base = '') {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.js')) out.push(`js/${rel}`);
  }
  return out;
}
const scripts = (await walk('js')).sort();

const swPath = join(ROOT, 'sw.js');
let sw = await readFile(swPath, 'utf8');
const block = [
  "  './',",
  "  './index.html',",
  "  './manifest.webmanifest',",
  "  './css/trpg.css',",
  ...scripts.map(f => `  './${f}',`),
  "  './icons/icon-192.png',",
  "  './icons/icon-512.png',",
  "  './icons/apple-touch-icon.png',",
].join('\n');
sw = sw.replace(/const SHELL = \[[\s\S]*?\n\];/, `const SHELL = [\n${block}\n];`);
await writeFile(swPath, sw);

console.log(`同期しました — シナリオ ${metas.length}本、プリキャッシュ ${scripts.length}ファイル`);
for (const m of metas) console.log(`  ${m.world.padEnd(7)} ${m.file}`);
