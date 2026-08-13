/* Zero-dependency static server for local development.
   ES modules need a real HTTP origin, so open the app through this
   rather than double-clicking index.html. */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

// SERVE_DIR/BASE_PATH let the same server stand in for a GitHub Pages project
// site, which is published under /<repo>/ rather than at the domain root.
const ROOT = resolve(process.env.SERVE_DIR || new URL('..', import.meta.url).pathname) + '/';
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');

    if (BASE) {
      if (path === BASE) { res.writeHead(302, { Location: `${BASE}/` }).end(); return; }
      if (!path.startsWith(`${BASE}/`)) throw new Error('outside base path');
      path = path.slice(BASE.length);
    }
    if (path === '/' || path.endsWith('/')) path += 'index.html';

    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`WEBtesu Studio → http://localhost:${PORT}${BASE}/`);
});
