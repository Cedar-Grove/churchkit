import { resolve } from 'node:path';
import { readBrand, REPO_ROOT, appDir } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';
import { run } from '../lib/run.mjs';

/**
 * Regenerate a church's design tokens.
 *
 * Writes the website's tokens.css and, with --mobile, the app's theme
 * module. `churchkit deploy` runs this first, so a colour changed in
 * brand.json is always reflected in what ships.
 */
export async function brand({ slug, flags }) {
	const dryRun = flags.has('dry-run');
	const { brand: data, dir } = readBrand(slug);

	const problems = validate(data);
	if (problems.length) {
		console.error(`\n✗ ${dir}/brand.json is not valid:`);
		for (const p of problems) console.error(`   - ${p}`);
		return 1;
	}

	const out = flags.get('out') ?? resolve(appDir('web'), 'src/styles');
	const result = run('node', [
		resolve(REPO_ROOT, 'packages/brand/src/generate.mjs'),
		'--brand', resolve(dir, 'brand.json'),
		'--out', out,
	], { dryRun });

	return result.ok || result.dryRun ? 0 : 1;
}
