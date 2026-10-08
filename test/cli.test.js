import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const cli = (...args) => execFileSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });

test('cli: json output', () => {
  const out = JSON.parse(cli('38.9907', '-77.0261', '--types', 'cma', '--format', 'json'));
  assert.equal(out.areas[0].id, '8');
});

test('cli: table output', () => {
  const out = cli('38.9907', '-77.0261', '-t', 'bta', '-f', 'table');
  assert.match(out, /BTA\s+461\s+Washington, DC/);
});

test('cli: xml output', () => {
  const out = cli('38.9907', '-77.0261', '-t', 'bta', '-f', 'xml');
  assert.match(out, /^<\?xml/);
  assert.match(out, /<areas><area><type>bta<\/type><id>461<\/id>/);
});

test('cli: exit codes', () => {
  assert.equal(spawnSync(process.execPath, ['src/cli.js', '30', '-45', '-f', 'json']).status, 3);
  assert.equal(spawnSync(process.execPath, ['src/cli.js', '95', '0']).status, 2);
  assert.equal(spawnSync(process.execPath, ['src/cli.js']).status, 2);
});

test('cli: --list', () => {
  assert.match(cli('--list'), /cma\s+734\s+as of \d{4}-\d{2}-\d{2}\s+\(defined 1990\)\s+Cellular Market Area/);
});
