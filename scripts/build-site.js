/** Bundle the library for the browser and copy the data files into site/. */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outfile: 'site/areapi.js',
  // load.js imports node:fs lazily inside a Node-only branch; keep it external.
  external: ['node:fs/promises', 'node:url'],
});

mkdirSync('site/data', { recursive: true });
for (const f of readdirSync('data').filter((f) => f.endsWith('.json'))) {
  cpSync(`data/${f}`, `site/data/${f}`);
}
console.log('site/areapi.js + site/data/ written');
