import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readBrand, appDir } from '../lib/paths.mjs';
import { run } from '../lib/run.mjs';

/**
 * Build and deploy a church's API, website and admin panel.
 *
 * Brand tokens are regenerated first, so a colour changed in brand.json is
 * always reflected in what ships — a deploy that quietly used stale tokens
 * would be worse than one that failed.
 */
export async function deploy({ slug, flags }) {
	const dryRun = flags.has('dry-run');
	const only = flags.get('only');
	const targets = only ? only.split(',') : ['api', 'web', 'admin'];

	const { dir } = readBrand(slug);

	console.log(`\nDeploying ${slug}: ${targets.join(', ')}${dryRun ? ' (dry run)' : ''}`);

	console.log('\nBrand tokens');
	const generate = resolve(appDir('..'), '..', 'packages/brand/src/generate.mjs');
	run('node', [
		resolve(dir, '../../packages/brand/src/generate.mjs').includes('packages')
			? resolve(dir, '..', '..', 'packages/brand/src/generate.mjs')
			: generate,
		'--brand', resolve(dir, 'brand.json'),
		'--out', resolve(appDir('web'), 'src/styles'),
	], { dryRun });

	for (const target of targets) {
		const cwd = appDir(target);
		if (!existsSync(cwd)) {
			console.error(`\n✗ unknown target "${target}"`);
			return 1;
		}
		if (target !== 'admin' && !existsSync(resolve(cwd, 'wrangler.jsonc'))) {
			console.error(`\n✗ apps/${target} has no wrangler.jsonc — run: churchkit provision ${slug}`);
			return 1;
		}

		console.log(`\napps/${target}`);
		const result = run('npm', ['run', 'deploy'], { dryRun, cwd });
		if (!result.ok && !result.dryRun) {
			console.error(`\n✗ apps/${target} failed to deploy. Nothing after this ran.`);
			return 1;
		}
	}

	console.log('\nDeployed.\n');
	return 0;
}
