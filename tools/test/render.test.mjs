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

import { classifyDockerError } from '../src/lib/docker.mjs';

// A stopped daemon and a user outside the docker group both make
// `docker info` fail. Telling someone to start a daemon that is already
// running sends them the wrong way, so the two must stay distinguishable.
test('classifyDockerError separates a permission problem from a stopped daemon', () => {
	assert.equal(
		classifyDockerError(
			'permission denied while trying to connect to the Docker daemon socket at ' +
			'unix:///var/run/docker.sock: dial unix /var/run/docker.sock: connect: permission denied'
		),
		'permission'
	);
	assert.equal(
		classifyDockerError('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?'),
		'stopped'
	);
});

test('classifyDockerError treats a missing rootless socket as stopped', () => {
	assert.equal(
		classifyDockerError('dial unix /run/user/1000/docker.sock: connect: no such file or directory'),
		'stopped'
	);
});

test('classifyDockerError does not guess at an unfamiliar failure', () => {
	assert.equal(classifyDockerError('context deadline exceeded'), 'unknown');
	assert.equal(classifyDockerError(''), 'unknown');
	assert.equal(classifyDockerError(undefined), 'unknown');
});

import { parseJsonc } from '../src/lib/render.mjs';

test('parseJsonc keeps a URL that contains //', () => {
	// The case a naive comment-stripper breaks: "https://x" becomes "https:".
	const parsed = parseJsonc('{ "url": "https://example.org/a" } // trailing');
	assert.equal(parsed.url, 'https://example.org/a');
});

test('parseJsonc strips line and block comments', () => {
	const parsed = parseJsonc(`{
		// a line comment
		"a": 1, /* inline */ "b": 2
		/* multi
		   line */
	}`);
	assert.deepEqual(parsed, { a: 1, b: 2 });
});

test('parseJsonc allows a trailing comma', () => {
	assert.deepEqual(parseJsonc('{ "a": [1, 2,], }'), { a: [1, 2] });
});

test('parseJsonc does not treat an escaped quote as ending a string', () => {
	// The JSON text here is:  { "a": "say \"hi\" // not a comment" }
	const jsonc = String.raw`{ "a": "say \"hi\" // not a comment" }`;
	assert.equal(parseJsonc(jsonc).a, 'say "hi" // not a comment');
});

test('the deployment template names an entry point that exists', async () => {
	// This drifted once: the Worker entry moved and the local config kept
	// pointing at the old path, so every container start failed.
	const { readFileSync, existsSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { REPO_ROOT } = await import('../src/lib/paths.mjs');
	const api = resolve(REPO_ROOT, 'apps/api');
	const template = parseJsonc(readFileSync(resolve(api, 'wrangler.jsonc.example'), 'utf8'));
	assert.ok(existsSync(resolve(api, template.main)), `${template.main} does not exist`);
});

import { localWranglerConfig } from '../src/commands/dev.mjs';

test('the local wrangler config points at the real entry point and a local database', async () => {
	const { readFileSync, existsSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const { REPO_ROOT } = await import('../src/lib/paths.mjs');

	const api = resolve(REPO_ROOT, 'apps/api');
	const template = parseJsonc(readFileSync(resolve(api, 'wrangler.jsonc.example'), 'utf8'));
	const config = parseJsonc(localWranglerConfig({ slug: 'my-church', adminPort: '4322', template }));

	assert.equal(config.main, template.main);
	assert.ok(existsSync(resolve(api, config.main)), `${config.main} must exist`);

	// It must never be able to reach a real deployment.
	assert.equal(config.d1_databases[0].database_id, 'local');
	assert.equal(config.d1_databases[0].database_name, 'my-church-db-local');
	assert.ok(!('routes' in config), 'a local config must declare no routes');

	// Admin CORS has to allow the browser origin the panel is served from.
	assert.ok(config.vars.ADMIN_ALLOWED_ORIGINS.includes('http://localhost:4322'));
});

import { wranglerTarget } from '../src/commands/seed.mjs';

test('a local d1 command names the local config, and a remote one does not', () => {
	const local = wranglerTarget(true);
	assert.ok(local.includes('--local'));
	assert.ok(
		local.some((a) => a === '--config=wrangler.local.jsonc'),
		'without --config wrangler looks for a wrangler.jsonc that is not there, and only reports a missing database'
	);
	assert.ok(local.some((a) => a.startsWith('--persist-to=')));

	const remote = wranglerTarget(false);
	assert.deepEqual(remote, ['--remote']);
	assert.ok(!remote.some((a) => a.includes('local')), 'a remote command must never target local state');
});
