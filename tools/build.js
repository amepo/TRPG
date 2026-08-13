/* Copies the shippable app into www/.
   There is no bundler — this just gathers the files a host should serve,
   leaving tests and tooling behind.
   Usage: node tools/build.js */

import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'www');

const ENTRIES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css',
  'js',
  'icons',
];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of ENTRIES) {
  await cp(join(ROOT, entry), join(OUT, entry), { recursive: true });
}

// GitHub Pages runs Jekyll by default, which skips files starting with `_`
// and slows publishing down. This opts out.
await writeFile(join(OUT, '.nojekyll'), '');

// Bump the service worker cache name so returning visitors pick up this build.
const swPath = join(OUT, 'sw.js');
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const sw = await readFile(swPath, 'utf8');
await writeFile(swPath, sw.replace(/const VERSION = '[^']*'/, `const VERSION = 'tomoshibi-${stamp}'`));

console.log(`built → www/ (service worker cache: tomoshibi-${stamp})`);
