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

import { settingsFromBrand, toSettingsSql } from '../../packages/brand/src/seed.mjs';

const BRAND = {
	slug: 'riverside',
	identity: { name: 'Riverside Fellowship', tagline: "Grace on the River" },
	contact: {
		phone: '(555) 222-3344',
		email: 'office@riverside.example',
		address: { street: '88 River Road', city: 'Ashford', region: 'OR', postalCode: '97001' },
	},
	serviceTimes: { saturday: ['5:00 PM — Evening Worship'], sunday: [] },
	urls: { web: 'https://riverside.example' },
	timezone: 'America/Los_Angeles',
};

test('settingsFromBrand writes a US address with no comma before the postcode', () => {
	assert.equal(settingsFromBrand(BRAND).address, '88 River Road, Ashford, OR 97001');
});

test('settingsFromBrand carries a Saturday-only schedule through', () => {
	// The shape the original stack could not represent at all.
	const times = JSON.parse(settingsFromBrand(BRAND).service_times);
	assert.deepEqual(times, { saturday: ['5:00 PM — Evening Worship'] });
});

test('settingsFromBrand drops days with no services rather than storing empties', () => {
	assert.ok(!('sunday' in JSON.parse(settingsFromBrand(BRAND).service_times)));
});

test('toSettingsSql escapes an apostrophe in a church name', () => {
	const sql = toSettingsSql({ ...BRAND, identity: { name: "St Brigid's", tagline: '' } });
	assert.ok(sql.includes("'St Brigid''s'"), 'apostrophe must be doubled for SQLite');
});

test('toSettingsSql writes settings only, never content tables', () => {
	// Comments mention the content tables to explain what is left alone, so
	// check the statements rather than the whole file.
	const statements = toSettingsSql(BRAND)
		.split('\n')
		.filter((l) => !l.trim().startsWith('--'))
		.join('\n');
	assert.ok(statements.includes('INSERT OR REPLACE INTO settings'));
	for (const table of ['pages', 'staff', 'carousel_slides', 'sermon_notes']) {
		assert.ok(!statements.includes(table), `${table} must not be written by a brand seed`);
	}
});

test('toSettingsSql tolerates a brand with no optional sections', () => {
	const bare = { slug: 'x', identity: { name: 'X' }, contact: {}, urls: {} };
	assert.doesNotThrow(() => toSettingsSql(bare));
});
