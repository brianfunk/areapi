# AGENTS.md

Guidance for coding agents (and humans) working in this repo.

## What this is

`@brianfunk/areapi` answers "which FCC market area is this point in?" from a latitude/longitude. One zero-dependency ES module (`src/`) powers three surfaces: the npm library + CLI, a static MapLibre map site (`site/`), and one Netlify Function (`netlify/functions/find.js`). There is no database and no server-side state; the polygons are simplified GeoJSON committed under `data/`.

## Layout

| path | role |
| --- | --- |
| `src/pip.js` | ray-casting point-in-polygon with bbox prefilter; pure, tested |
| `src/index.js` | `find`, `feature`, `types`, validation, `TYPES`/`TYPE_NAMES` |
| `src/load.js` | loads `data/<type>.json`; Node via fs (several candidate dirs), browser via fetch |
| `src/format.js` | json / xml / jsonp / table serializers shared by CLI and function |
| `src/cli.js` | `areapi <lat> <lon>`; numeric args are lifted out before `parseArgs` so negatives work |
| `src/index.d.ts` | hand-written types; keep `AreaType` in sync with `TYPES` |
| `data/*.json` | one FeatureCollection per type, features sorted by numeric id, each with `bbox` and `properties: {id, name}` |
| `data/manifest.json` | generated: sources, counts, missing ids, sizes |
| `scripts/build-data.js` | the only way `data/` changes; see "Data" below |
| `scripts/extract-names.js` + `names.json` | market number -> name, from the FCC ULS market table |
| `netlify/functions/find.js` | routes `/api/find`, `/api/:type/find`, legacy `/api/:type/:year/find`, `/api/types` |
| `site/` | `index.html`, `style.css`, `app.js`; `areapi.js` and `site/data/` are build outputs (gitignored) |
| `test/` | `node:test`, no framework. `npm test` |

## Rules of the road

- **Zero runtime dependencies.** Dev deps are `mapshaper` and `esbuild` only. Do not add a geometry library; `src/pip.js` is the whole point.
- **Never hand-edit `data/*.json` or `data/manifest.json`.** Change `scripts/build-data.js` and run `npm run build:data`. Raw inputs live in `data/raw/` (gitignored); the README section "How the data is built" has every download command.
- **Adding an area type** touches: `TYPES` in `scripts/build-data.js` (plus a names source), `TYPES`/`TYPE_NAMES` in `src/index.js`, `AreaType` in `src/index.d.ts`, the table in `README.md`, and a known-point assertion in `test/find.test.js`.
- **fcc.gov blocks scripted requests** (403 for curl, fetch, etc.). Use `transition.fcc.gov` or `data.fcc.gov` where the file exists there; otherwise the file has to be downloaded in a browser into `data/raw/` (the two CGSA GeoJSON files are the only such case; refresh them when the FCC posts a new as-of date).
- **Vintages**: the FCC market schemes (1990s `defined` years) are still in force; `asOf` is the build date. `county`, `state`, `cbsa` track the newest Census cartographic release (2025 now); bump the file names in `scripts/build-data.js` and the README when a new year appears at www2.census.gov/geo/tiger/GENZ<year>/shp/.
- **Size budget**: keep each `data/<type>.json` under ~2 MB (cgsa is the 4 MB exception) and the total around 10 MB. Tune `SIMPLIFY` (default `5%`) and `PRECISION` (4 decimals, ~11 m) in the build script rather than hand-trimming.
- **IDs are strings** in the API (`"8"`, not `8`) because market numbers are codes, not quantities. County and CBSA ids are FIPS/GEOID codes with leading zeros.
- **Browser bundle**: `node:*` imports in `src/load.js` are Node-only branches and must stay listed as `external` in `scripts/build-site.js`.
- Commits and PRs are authored by humans; no AI attribution lines.

## Workflow

```sh
npm install
npm test                 # unit + CLI + function tests, ~1 s
npm run build:site       # esbuild bundle + copy data into site/
npm run dev              # netlify dev on http://localhost:8888 (site + /api/*)
npm run build:data       # rebuild data/ from data/raw/ (slow, ~1 min)
```

Branch from `dev`, open PRs against `dev`. CI runs `npm test` and `npm run build:site`. Netlify production is deployed from `dev`. Publishing: bump `version` in `package.json`, tag `vX.Y.Z`, `npm publish --access public`.

## Verifying a change end to end

1. `npm test` green.
2. `node src/cli.js 38.9907 -77.0261` returns every type for Washington, DC.
3. `npm run dev`, then `curl 'localhost:8888/api/find?lat=38.9907&lon=-77.0261'` and open the site; click the map.
