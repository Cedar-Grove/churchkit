import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readBrand, appDir, resourceNames, REPO_ROOT } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';
import { run } from '../lib/run.mjs';
import { renderTemplate, writeConfig, parseDatabaseId, hostOf, zoneOf } from '../lib/render.mjs';
import { seed } from './seed.mjs';

/** A flags map with extra switches on, for delegating to another command. */
function withFlags(flags, extra) {
	const next = new Map(flags);
	for (const key of extra) next.set(key, true);
	next.has = Map.prototype.has.bind(next);
	return next;
}

/**
 * Stand up the Cloudflare resources one church's deployment needs.
 *
 * Safe to re-run: every step checks whether its resource already exists and
 * skips it rather than failing or duplicating. What it cannot do is undo
 * itself, so `--dry-run` prints the whole plan without touching anything
 * and is the recommended first run.
 *
 * Two things are deliberately left to a human at the end: attaching custom
 * domains, and creating the Cloudflare Access application that protects the
 * admin panel. Both need decisions — which identity provider, which staff
 * email addresses — that a script should not be making on a church's behalf.
 */
export async function provision({ slug, flags }) {
	const dryRun = flags.has('dry-run');
	const wrangler = ['wrangler'];

	console.log(`\nProvisioning ${slug}${dryRun ? ' (dry run — nothing will be created)' : ''}`);
	console.log('─'.repeat(56));

	// ── 1. Brand ─────────────────────────────────────────────────
	const { brand, dir } = readBrand(slug);
	const problems = validate(brand);
	if (problems.length) {
		console.error(`\n✗ ${dir}/brand.json is not valid:`);
		for (const p of problems) console.error(`   - ${p}`);
		console.error('\nFix the brand file first — everything below is derived from it.');
		return 1;
	}
	console.log(`\n1. Brand\n   ✓ ${brand.identity.name}`);

	const names = resourceNames(slug);
	const apiHost = hostOf(brand.urls.api);
	const webHost = hostOf(brand.urls.web);
	if (!apiHost || !webHost) {
		console.error('\n✗ urls.api and urls.web must both be absolute URLs.');
		return 1;
	}

	// ── 2. Database ──────────────────────────────────────────────
	console.log(`\n2. D1 database (${names.database})`);
	let databaseId = flags.get('database-id');
	if (!databaseId) {
		const created = run('npx', [...wrangler, 'd1', 'create', names.database], { dryRun, capture: true });
		if (created.dryRun) {
			// Not angle-bracketed: the renderer refuses any remaining
			// placeholder, and a dry run should still exercise that check.
			databaseId = '00000000-0000-0000-0000-dryrun0000000';
		} else if (created.ok) {
			databaseId = parseDatabaseId(created.stdout);
			if (!databaseId) {
				console.error('   ✗ Could not read the database id from wrangler\'s output.');
				console.error('     Re-run with --database-id=<id> once you have it.');
				return 1;
			}
			console.log(`   ✓ created ${databaseId}`);
		} else {
			// Almost always "already exists", which on a re-run is fine —
			// but the id still has to come from somewhere.
			console.error('   ! wrangler could not create it (it may already exist).');
			console.error('     Re-run with --database-id=<id> to continue with the existing one.');
			return 1;
		}
	} else {
		console.log(`   using existing ${databaseId}`);
	}

	// ── 3. Media bucket ──────────────────────────────────────────
	const wantsMedia = !flags.has('no-media');
	if (wantsMedia) {
		console.log(`\n3. R2 bucket (${names.bucket})`);
		run('npx', [...wrangler, 'r2', 'bucket', 'create', names.bucket], { dryRun });
	} else {
		console.log('\n3. R2 bucket — skipped (--no-media); image uploads stay unavailable');
	}

	// ── 4. Worker configuration ──────────────────────────────────
	console.log('\n4. Worker configuration');
	const force = flags.has('force');

	const apiConfig = renderTemplate(resolve(appDir('api'), 'wrangler.jsonc.example'), {
		SLUG: slug,
		D1_DATABASE_ID: databaseId,
		YOUR_DOMAIN: zoneOf(apiHost),
	});
	const apiResult = writeConfig(resolve(appDir('api'), 'wrangler.jsonc'), apiConfig, { force, dryRun });
	if (apiResult.reason === 'exists') console.log('   apps/api/wrangler.jsonc exists — left alone (--force to overwrite)');

	const webConfig = renderTemplate(resolve(appDir('web'), 'wrangler.jsonc.example'), {
		SLUG: slug,
		YOUR_DOMAIN: zoneOf(webHost),
	});
	const webResult = writeConfig(resolve(appDir('web'), 'wrangler.jsonc'), webConfig, { force, dryRun });
	if (webResult.reason === 'exists') console.log('   apps/web/wrangler.jsonc exists — left alone (--force to overwrite)');

	// ── 5. Schema and seed ───────────────────────────────────────
	// Delegated to `seed`, which applies the schema and then this church's
	// identity from brand.json. Identity always; the fictional starter pages
	// only with --seed. A database that knows the church's name is useful
	// immediately; one full of invented pages is only useful if you wanted
	// them.
	console.log('\n5. Schema and church identity');
	const seeded = await seed({ slug, flags: withFlags(flags, flags.has('seed') ? ['example'] : []) });
	if (seeded !== 0) return seeded;

	// ── 6. What a person still has to do ─────────────────────────
	console.log(`\n${'─'.repeat(56)}\nProvisioned. Four things still need a human:\n`);
	console.log(`  1. Secrets — churchkit secrets ${slug}`);
	console.log(`     Credentials decide which features exist. None are required.`);
	console.log(`\n  2. Custom domains — attach in the Cloudflare dashboard:`);
	console.log(`       ${apiHost}  →  ${names.apiWorker}`);
	console.log(`       ${webHost}  →  ${names.webWorker}`);
	console.log(`\n  3. Cloudflare Access — create an application covering the admin`);
	console.log(`     panel's hostname, then set its audience tag:`);
	console.log(`       wrangler secret put CF_ACCESS_AUD`);
	console.log(`     Without it the admin API refuses every request, by design.`);
	console.log(`\n  4. Deploy — churchkit deploy ${slug}`);
	console.log(`\nCheck the result with: churchkit doctor ${slug}\n`);
	return 0;
}
