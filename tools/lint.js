/* 名前の点検 — import し忘れた関数を、押される前に見つける。

   ビルドもリンタも無い構成なので、`button(...)` を import せずに書いても
   何も言われない。そのコードが実際に走るまで——つまりプレイヤーがその
   ボタンを押すまで——ReferenceError は出てこない。実際にそれで一度、
   キャラクターシートが開かなくなった。

   ここでやるのは一つだけ。「呼ばれている名前が、どこかで定義されているか」。
   構文解析はしない。素朴な走査で、束縛されうる場所に一度でも現れた名前を
   すべて集め、それ以外を呼んでいたら報告する。取りこぼしはあるが、
   誤検知はほぼ出ない——この用途ではそのほうが役に立つ。

     node tools/lint.js */

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ブラウザと Node が最初から持っているもの。呼んでも定義は要らない。 */
const GLOBALS = new Set([
  'document', 'window', 'console', 'location', 'history', 'navigator', 'caches', 'fetch',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt', 'structuredClone',
  'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'JSON', 'Date', 'Set', 'Map',
  'Promise', 'Error', 'RegExp', 'Symbol', 'BigInt', 'Intl', 'URL', 'URLSearchParams',
  'Blob', 'File', 'FileReader', 'CustomEvent', 'EventTarget', 'Response', 'Request',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'process', 'Buffer', 'globalThis', 'self', 'queueMicrotask',
  'async', 'get', 'set', 'static',
  // 予約語のうち、後ろに ( が続いて呼び出しに見えるもの
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'await', 'function',
  'new', 'delete', 'void', 'in', 'of', 'do', 'else', 'yield', 'super', 'import',
]);

/** 束縛されうる場所に現れる名前を、片っ端から集める。 */
function boundNames(source) {
  const names = new Set();
  const add = text => {
    for (const raw of String(text).split(',')) {
      const name = raw.trim().split(/[:=]/)[0].replace(/^\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
      // `{ a as b }` は別名のほうが束縛される
      const alias = raw.includes(' as ') ? raw.split(' as ').pop().trim() : null;
      if (alias && /^[A-Za-z_$][\w$]*$/.test(alias)) names.add(alias);
    }
  };

  for (const m of source.matchAll(/import\s+\{([^}]*)\}/g)) add(m[1]);
  for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of source.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  /* 引数リスト。分割代入（`(root, { onReady, app })`）ごと中身を拾いたいので、
     括弧の中に波括弧が入るのを許す。多めに拾うぶんには困らない。 */
  for (const m of source.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) add(m[1].replace(/[{}[\]]/g, ','));
  for (const m of source.matchAll(/[({[]([^(){}[\]]*)[)}\]]\s*(?:=>|\{|=)/g)) add(m[1]);
  for (const m of source.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) add(m[1]);
  /* メソッドの宣言は呼び出しと同じ形をしている（`foo(a) {`）。
     static / async / get / set / * の飾りも剥がして名前を拾う。 */
  for (const m of source.matchAll(/^\s*(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) add(m[1]);
  // 括弧のない一引数アロー（`resolve => …`）
  for (const m of source.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) add(m[2]);
  for (const m of source.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  return names;
}

/** 呼び出されている名前。プロパティ呼び出し（`a.b()`）は除く。 */
function calledNames(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')                       // ブロックコメント
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')                   // 行コメント
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')                     // テンプレート文字列
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const out = new Map();
  for (const m of stripped.matchAll(/(^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2];
    if (!out.has(name)) out.set(name, m.index);
  }
  return out;
}

const files = globSync('js/**/*.js', { cwd: root });
const problems = [];

for (const file of files.sort()) {
  const source = readFileSync(join(root, file), 'utf8');
  const bound = boundNames(source);
  for (const [name, at] of calledNames(source)) {
    if (bound.has(name) || GLOBALS.has(name)) continue;
    const line = source.slice(0, at).split('\n').length;
    problems.push({ file: relative('.', file), line, name });
  }
}

console.log(`名前の点検 — ${files.length} ファイル`);

if (problems.length) {
  console.log(`\n✗ 定義の見つからない呼び出しが ${problems.length} 件`);
  for (const p of problems) console.log(`  ${p.file}:${p.line}  ${p.name}(...)`);
  console.log('\n  import し忘れか、綴りの間違いです。');
  process.exitCode = 1;
} else {
  console.log('✓ 呼ばれている名前はすべて、どこかで定義されています');
}
