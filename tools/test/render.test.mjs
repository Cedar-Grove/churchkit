import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabaseId, hostOf, zoneOf } from '../src/lib/render.mjs';

test('parseDatabaseId reads wrangler JSON output', () => {
	const out = `{ "d1_databases": [{ "binding": "DB", "database_id": "acfbf587-46b0-4bb1-a067-c9533f29c856" }] }`;
	assert.equal(parseDatabaseId(out), 'acfbf587-46b0-4bb1-a067-c9533f29c856');
});

test('parseDatabaseId reads the TOML shape older wrangler printed', () => {
	const out = `[[d1_databases]]\nbinding = "DB"\ndatabase_id = "ff666327-825d-41de-bba7-689b3fb991d4"`;
	assert.equal(parseDatabaseId(out), 'ff666327-825d-41de-bba7-689b3fb991d4');
});

test('parseDatabaseId returns null rather than guessing', () => {
	assert.equal(parseDatabaseId('Created database my-db'), null);
});

test('hostOf and zoneOf split an api subdomain from its zone', () => {
	assert.equal(hostOf('https://api.example.org'), 'api.example.org');
	assert.equal(zoneOf('api.example.org'), 'example.org');
	assert.equal(zoneOf('example.org'), 'example.org');
});

test('zoneOf keeps a deeper subdomain attached to the registrable domain', () => {
	assert.equal(zoneOf('api.staging.example.org'), 'example.org');
});

test('hostOf returns null for something that is not a URL', () => {
	assert.equal(hostOf('not a url'), null);
});

import { parseEnvFile } from '../src/commands/secrets.mjs';

test('parseEnvFile reads keys, skipping comments and blanks', () => {
	const parsed = parseEnvFile('# a comment\n\nA=1\nB = two \n');
	assert.deepEqual(parsed, { A: '1', B: 'two' });
});

test('parseEnvFile strips matching surrounding quotes', () => {
	assert.deepEqual(parseEnvFile(`A="quoted"\nB='single'`), { A: 'quoted', B: 'single' });
});

test('parseEnvFile keeps = inside a value', () => {
	assert.deepEqual(parseEnvFile('KEY=a=b=c'), { KEY: 'a=b=c' });
});

test('parseEnvFile keeps a blank value distinguishable from an absent one', () => {
	const parsed = parseEnvFile('SET=x\nBLANK=');
	assert.equal(parsed.BLANK, '');
	assert.ok(!('MISSING' in parsed));
});
