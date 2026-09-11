import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readBrand, appDir, resourceNames } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';
import { SECRETS, ADMIN_CRITICAL } from '../lib/secrets.mjs';
import { has } from '../lib/run.mjs';

/**
 * Report what a deployment has and what it is missing, without changing
 * anything and without needing network access.
 *
 * Most of what it reports is not a problem: ChurchKit requires no
 * integration, so an unset credential means a feature this church does not
 * use. The output says which feature, so an absence can be recognised as
 * deliberate rather than investigated as a fault.
 */
export async function doctor({ slug, args }) {
	const problems = [];
	const notes = [];

	console.log(`\nChecking ${slug}\n${'─'.repeat(40)}`);

	// ── Brand ────────────────────────────────────────────────────
	let brand;
	try {
		({ brand } = readBrand(slug));
	} catch (e) {
		console.error(`✗ ${e.message}`);
		return 1;
	}

	const brandProblems = validate(brand);
	if (brandProblems.length) {
		console.log('✗ brand.json');
		for (const p of brandProblems) console.log(`    ${p}`);
		problems.push(...brandProblems);
	} else {
		console.log(`✓ brand.json — ${brand.identity.name}`);
	}

	// ── Tooling ──────────────────────────────────────────────────
	if (has('wrangler') || has('npx')) {
		console.log('✓ wrangler reachable');
	} else {
		console.log('✗ wrangler not found — install it with: npm i -g wrangler');
		problems.push('wrangler missing');
	}

	// ── Per-app config ───────────────────────────────────────────
	for (const app of ['api', 'web']) {
		const config = resolve(appDir(app), 'wrangler.jsonc');
		if (existsSync(config)) {
			console.log(`✓ apps/${app}/wrangler.jsonc`);
			const text = readFileSync(config, 'utf8');
			if (text.includes('<') && text.includes('>')) {
				console.log(`    still contains <PLACEHOLDER> values`);
				problems.push(`apps/${app}/wrangler.jsonc has unreplaced placeholders`);
			}
		} else {
			console.log(`✗ apps/${app}/wrangler.jsonc — run: churchkit provision ${slug}`);
			problems.push(`apps/${app} not configured`);
		}
	}

	// ── Secrets ──────────────────────────────────────────────────
	// Read from the environment, which is where a church's own secret file
	// puts them. This never reads a deployed Worker's secrets: Cloudflare
	// does not expose their values, by design.
	console.log('\nCredentials (from the current environment)');
	const missing = SECRETS.filter((s) => !process.env[s.name]);
	const present = SECRETS.length - missing.length;
	console.log(`  ${present}/${SECRETS.length} set`);

	for (const secret of missing) {
		const critical = ADMIN_CRITICAL.includes(secret.name);
		const marker = critical ? '✗' : '·';
		// Phrased as what is switched off, not as a fault: for most churches
		// most of these are deliberate.
		console.log(`  ${marker} ${secret.name} — unset; disables ${secret.feature}`);
		if (critical) problems.push(`${secret.name} is unset, so the admin panel cannot be used`);
		else notes.push(secret.name);
	}

	// A bypass left set outside local development is worth shouting about,
	// even though it cannot actually authorise anything on a real hostname.
	if (process.env.ADMIN_DEV_BYPASS) {
		console.log('\n  ✗ ADMIN_DEV_BYPASS is set in this environment.');
		console.log('    It only ever applies to loopback requests, so a deployed Worker ignores');
		console.log('    it — but it should not be anywhere near a deployment. Remove it.');
		problems.push('ADMIN_DEV_BYPASS is set');
	}

	// ── Verdict ──────────────────────────────────────────────────
	const names = resourceNames(slug);
	console.log(`\nCloudflare resources this deployment expects`);
	for (const [label, value] of Object.entries(names)) console.log(`  ${label}: ${value}`);

	console.log('');
	if (problems.length) {
		console.log(`${problems.length} problem(s) to fix:`);
		for (const p of problems) console.log(`  - ${p}`);
		return 1;
	}
	console.log('No problems found.');
	if (notes.length) {
		console.log(`${notes.length} optional credential(s) unset — those features stay off, which is fine.`);
	}
	return 0;
}
