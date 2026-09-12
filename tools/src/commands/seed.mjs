import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readBrand, appDir, resourceNames, REPO_ROOT } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';
import { toSettingsSql } from '../../../packages/brand/src/seed.mjs';
import { run } from '../lib/run.mjs';

/**
 * Load a church's identity into its database.
 *
 * Writes only the settings derived from brand.json — name, contact details,
 * service times, URLs. Pages, staff and carousel content belong to the
 * church and are edited in the admin panel; nothing here overwrites them,
 * so this is safe to re-run after changing the brand file.
 *
 * `--example` additionally loads the fictional starter content, which is
 * what makes a brand-new deployment look like a website rather than an
 * empty shell. Only ever do that on a deployment with no real content yet.
 */
export async function seed({ slug, flags }) {
	const dryRun = flags.has('dry-run');
	const local = flags.has('local');

	const { brand, dir } = readBrand(slug);
	const problems = validate(brand);
	if (problems.length) {
		console.error(`\n✗ ${dir}/brand.json is not valid:`);
		for (const p of problems) console.error(`   - ${p}`);
		return 1;
	}

	const names = resourceNames(slug);
	const database = local ? `${slug}-db-local` : names.database;
	const api = appDir('api');

	console.log(`\nSeeding ${brand.identity.name} into ${database}${dryRun ? ' (dry run)' : ''}`);

	const target = ['--remote'];
	const localTarget = ['--local', `--persist-to=${resolve(REPO_ROOT, '.wrangler/state')}`];
	const where = local ? localTarget : target;

	// Schema first. Every statement is CREATE TABLE IF NOT EXISTS, so this is
	// a no-op on a database that already has one.
	console.log('\n1. Schema');
	run('npx', ['wrangler', 'd1', 'execute', database, ...where, '--file=schema.sql'], { dryRun, cwd: api });

	if (flags.has('example')) {
		console.log('\n2. Example starter content (pages, a carousel slide)');
		run('npx', ['wrangler', 'd1', 'execute', database, ...where, '--file=seed.example.sql'], { dryRun, cwd: api });
	}

	console.log(`\n${flags.has('example') ? '3' : '2'}. Church identity from brand.json`);
	const sqlPath = resolve(tmpdir(), `churchkit-${slug}-settings.sql`);
	if (!dryRun) {
		writeFileSync(sqlPath, toSettingsSql(brand));
		console.log(`   wrote ${sqlPath}`);
	}
	const result = run('npx', ['wrangler', 'd1', 'execute', database, ...where, `--file=${sqlPath}`], { dryRun, cwd: api });

	if (result.ok || result.dryRun) {
		console.log(`\nDone. Re-run this after editing brand.json — it updates identity`);
		console.log('and leaves pages, staff and carousel content alone.\n');
		return 0;
	}
	return 1;
}
