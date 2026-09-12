import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';

/**
 * Start a new church from the example.
 *
 * This replaces `cp -r examples/example-church brands/my-church`, which had
 * two problems: brands/ does not exist in a fresh clone (its contents are
 * gitignored, so nothing creates it), and the copied brand.json keeps
 * `"slug": "example-church"` — a value app.config.ts uses to find the
 * church's assets, so the mismatch surfaces much later as a missing icon.
 */
export async function newChurch({ slug, flags }) {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
		console.error(`\n✗ "${slug}" is not a usable slug — lowercase letters, numbers and hyphens only.`);
		console.error('  It becomes directory names, Cloudflare resource names and the Expo project name.\n');
		return 1;
	}

	const source = resolve(REPO_ROOT, 'examples/example-church');
	const target = resolve(REPO_ROOT, 'brands', slug);

	if (existsSync(target) && !flags.has('force')) {
		console.error(`\n✗ brands/${slug} already exists. Pass --force to overwrite it.\n`);
		return 1;
	}

	mkdirSync(resolve(REPO_ROOT, 'brands'), { recursive: true });
	cpSync(source, target, { recursive: true });

	// The slug has to match the directory, or the mobile build looks for
	// assets somewhere that does not exist.
	const brandPath = resolve(target, 'brand.json');
	const brand = JSON.parse(readFileSync(brandPath, 'utf8'));
	brand.slug = slug;
	writeFileSync(brandPath, JSON.stringify(brand, null, 2) + '\n');

	const problems = validate(brand);
	console.log(`\nCreated brands/${slug}`);
	console.log(`  brand.json   ${problems.length ? `${problems.length} field(s) still to fill in` : 'valid, with the example\'s values'}`);
	console.log(`  assets/      your logo, app icon and splash go here`);

	console.log(`\nIt is still the example church's details. Edit them:`);
	console.log(`  $EDITOR brands/${slug}/brand.json`);
	console.log(`\nThen see it running, with no accounts anywhere:`);
	console.log(`  npx churchkit dev ${slug} --example\n`);
	return 0;
}
