#!/usr/bin/env node
/**
 * areapi CLI
 *
 *   npx @brianfunk/areapi 38.9907 -77.0261
 *   npx @brianfunk/areapi 38.9907 -77.0261 --types cma,bta --format json
 *   npx @brianfunk/areapi --types            # list area types
 */
import { parseArgs } from 'node:util';
import { find, types, TYPES, TYPE_NAMES, AreapiError } from './index.js';
import { format } from './format.js';

const HELP = `areapi - which FCC market area is this point in?

Usage:
  areapi <lat> <lon> [--types cma,bta,...] [--format table|json|xml]
  areapi --list

Options:
  -t, --types   comma-separated area types (default: all of ${TYPES.join(',')})
  -f, --format  table (default on a terminal), json (default when piped), xml
  -l, --list    list area types with counts and as-of dates
  -h, --help    show this help
`;

// Negative coordinates look like flags to parseArgs; lift numeric args out first.
const argv = process.argv.slice(2);
const numeric = argv.filter((a) => /^-?\d+(\.\d+)?$/.test(a));
const rest = argv.filter((a) => !numeric.includes(a));

let args;
try {
  args = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      types: { type: 'string', short: 't' },
      format: { type: 'string', short: 'f' },
      list: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (err) {
  fail(err.message);
}

const { values } = args;
const positionals = [...numeric, ...args.positionals];

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (values.list) {
  const m = await types();
  const rows = Object.entries(m.types).map(([k, t]) => `${k.padEnd(6)} ${String(t.count).padStart(4)}  as of ${t.asOf}  (defined ${t.defined})  ${TYPE_NAMES[k]}`);
  process.stdout.write(rows.join('\n') + '\n');
  process.exit(0);
}

if (positionals.length !== 2) fail('Expected <lat> <lon>.\n\n' + HELP);

try {
  const result = await find({ lat: positionals[0], lon: positionals[1] }, { types: values.types });
  const fmt = values.format || (process.stdout.isTTY ? 'table' : 'json');
  const { body } = format(result, fmt);
  process.stdout.write(body + '\n');
  process.exit(result.status === 'OK' ? 0 : 3);
} catch (err) {
  fail(err instanceof AreapiError ? err.message : err.stack);
}

function fail(msg) {
  process.stderr.write(`areapi: ${msg}\n`);
  process.exit(2);
}
