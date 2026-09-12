import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
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
/**
 * Where a d1 command should act, and against which config.
 *
 * Naming the config is not optional for the local case: wrangler looks for
 * a wrangler.jsonc that a local checkout does not have, and reports only
 * that it cannot find the database — which has sent two debugging sessions
 * in the wrong direction.
 */
export function wranglerTarget(local) {
	return local
		? ['--local', '--persist-to=/repo/.wrangler/state', '--config=wrangler.local.jsonc']
		: ['--remote'];
}

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

	/**
	 * Local seeding runs inside the API container, not on the host.
	 *
	 * The container is what serves this database, and running there means one
	 * wrangler version and one view of .wrangler/state rather than two that
	 * have to agree. It also means the host needs nothing installed.
	 *
	 * Either way the config has to be named explicitly: the local one is
	 * wrangler.local.jsonc, and wrangler looking for a wrangler.jsonc that
	 * does not exist reports only that it cannot find the database.
	 */
	const where = wranglerTarget(local);

	const compose = ['compose', '-f', resolve(REPO_ROOT, 'docker/docker-compose.yml')];
	const execute = (file) => local
		? run('docker', [...compose, 'exec', '-T', 'api', 'npx', 'wrangler', 'd1', 'execute', database, ...where, `--file=${file}`], { dryRun })
		: run('npx', ['wrangler', 'd1', 'execute', database, ...where, `--file=${file}`], { dryRun, cwd: api });

	// Schema first. Every statement is CREATE TABLE IF NOT EXISTS, so this is
	// a no-op on a database that already has one.
	console.log('\n1. Schema');
	const schemaResult = execute('schema.sql');
	if (!schemaResult.ok && !schemaResult.dryRun) {
		console.error(local
			? '\n✗ Could not reach the API container. Is the stack running? `churchkit dev ' + slug + '`'
			: '\n✗ Could not apply the schema.');
		return 1;
	}

	if (flags.has('example')) {
		console.log('\n2. Example starter content (pages, a carousel slide)');
		execute('seed.example.sql');
	}

	console.log(`\n${flags.has('example') ? '3' : '2'}. Church identity from brand.json`);
	// Written inside the repository rather than the system temp directory,
	// because the container can only see what is bind-mounted into it.
	const sqlName = `churchkit-${slug}-settings.sql`;
	const hostPath = resolve(REPO_ROOT, '.wrangler', sqlName);
	if (!dryRun) {
		mkdirSync(resolve(REPO_ROOT, '.wrangler'), { recursive: true });
		writeFileSync(hostPath, toSettingsSql(brand));
	}
	const result = execute(local ? `/repo/.wrangler/${sqlName}` : hostPath);

	if (result.ok || result.dryRun) {
		console.log(`\nDone. Re-run this after editing brand.json — it updates identity`);
		console.log('and leaves pages, staff and carousel content alone.\n');
		return 0;
	}
	return 1;
}
