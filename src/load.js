/**
 * Loads a market-area dataset by type. Works in Node (reads from the package's
 * data/ directory) and in the browser (fetches from `dataUrl`, default "data/").
 * Results are cached per type for the life of the process/page.
 */

const cache = new Map();
const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function';

let dataUrl = 'data/';

/** Browser only: where the <type>.json files live, relative or absolute. */
export function setDataUrl(url) {
  dataUrl = url.endsWith('/') ? url : url + '/';
  cache.clear();
}

let nodeDataDir = null;

/**
 * Locate the data directory. Normally it sits next to src/ in the package, but
 * bundlers (e.g. Netlify's esbuild) move this module, so fall back to the data/
 * directory of the working directory or the Lambda task root.
 */
async function findDataDir() {
  if (nodeDataDir) return nodeDataDir;
  const { access } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const candidates = [
    fileURLToPath(new URL('../data/', import.meta.url)),
    path.join(process.cwd(), 'data'),
    process.env.LAMBDA_TASK_ROOT && path.join(process.env.LAMBDA_TASK_ROOT, 'data'),
    process.env.AREAPI_DATA_DIR,
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      await access(path.join(dir, 'manifest.json'));
      nodeDataDir = dir;
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error(`areapi: data directory not found (tried ${candidates.join(', ')})`);
}

async function readNode(name) {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = await findDataDir();
  return JSON.parse(await readFile(path.join(dir, `${name}.json`), 'utf8'));
}

async function readBrowser(name) {
  const res = await fetch(`${dataUrl}${name}.json`);
  if (!res.ok) throw new Error(`areapi: failed to load ${name}.json (${res.status})`);
  return res.json();
}

export function load(name) {
  if (!cache.has(name)) {
    const p = (isBrowser ? readBrowser(name) : readNode(name)).catch((err) => {
      cache.delete(name);
      throw err;
    });
    cache.set(name, p);
  }
  return cache.get(name);
}

export function loadManifest() {
  return load('manifest');
}
