import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { appDir } from '../lib/paths.mjs';
import { run } from '../lib/run.mjs';
import { brand } from './brand.mjs';

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

	console.log(`\nDeploying ${slug}: ${targets.join(', ')}${dryRun ? ' (dry run)' : ''}`);

	console.log('\nBrand tokens');
	// Delegates to the full `brand` command rather than calling
	// generate.mjs directly: a bare call here regenerated tokens.css but
	// skipped installImages(), so apps/web/public/images/logo-* was never
	// written — every deploy shipped the header/footer's text-wordmark
	// fallback even for a church whose brand.json names a real logo file.
	const brandResult = await brand({ slug, flags });
	if (brandResult !== 0 && !dryRun) return brandResult;

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
