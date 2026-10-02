/**
 * Build scripts/names.json (market number -> name, per area type) from the
 * FCC ULS "market-based services" public dump.
 *
 *   curl -o data/raw/l_market.zip https://data.fcc.gov/download/pub/uls/complete/l_market.zip
 *   unzip -p data/raw/l_market.zip MK.dat | awk -F'|' '{print $6 "|" $9}' | sort -u > data/raw/uls-markets.txt
 *   node scripts/extract-names.js
 *
 * MK.dat columns (pipe-delimited): record_type, usi, uls_file_number, ebf_number,
 * call_sign, market_code, channel_block, submarket_code, market_name, ...
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PREFIX = { CMA: 'cma', BTA: 'bta', MTA: 'mta', BEA: 'ea', MEA: 'mea', REA: 'reag', PEA: 'pea' };

const names = Object.fromEntries(Object.values(PREFIX).map((t) => [t, {}]));
for (const line of readFileSync('data/raw/uls-markets.txt', 'utf8').split('\n')) {
  const [code, name] = line.split('|');
  const m = code && code.match(/^([A-Z]+)0*(\d+)$/);
  if (!m || !PREFIX[m[1]] || !name) continue;
  const type = PREFIX[m[1]];
  const id = m[2];
  const clean = name.trim().replace(/\s+/g, ' ');
  if (names[type][id] && names[type][id] !== clean) {
    console.warn(`conflict ${type} ${id}: "${names[type][id]}" vs "${clean}"`);
  }
  names[type][id] = clean;
}

const out = {
  source: 'FCC Universal Licensing System public data, l_market.zip (MK.dat market_code/market_name)',
  url: 'https://data.fcc.gov/download/pub/uls/complete/l_market.zip',
  extracted: new Date().toISOString().slice(0, 10),
  counts: Object.fromEntries(Object.entries(names).map(([t, m]) => [t, Object.keys(m).length])),
  names,
};
writeFileSync('scripts/names.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.counts);
