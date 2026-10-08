/**
 * `npm run dev`: local server for the site and the API, no Netlify CLI needed.
 * Serves site/ statically and routes /api/* to the same handler Netlify runs.
 * Picks a free port unless --port N is given, so it never collides with other
 * servers on the machine. Rebuilds site/areapi.js + site/data on start.
 */
import { createServer as createNet } from 'node:net';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import handler from '../netlify/functions/find.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createNet();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const args = process.argv.slice(2);
const forced = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : null;
const port = forced || (await freePort());

execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'inherit' });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const r = await handler(new Request(url, { method: req.method }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = path.join('site', path.normalize(url.pathname));
    if (!file.startsWith('site')) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end(err.code === 'ENOENT' ? 'not found' : String(err));
    if (err.code !== 'ENOENT') console.error(err);
  }
});

server.listen(port, () => console.log(`\n  areapi dev server: http://localhost:${port}\n`));
