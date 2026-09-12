import { resolve, dirname } from 'node:path';
import { mkdirSync, copyFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { wordmarkSvg } from '../../../packages/brand/src/logo.mjs';
import { readBrand, REPO_ROOT, appDir } from '../lib/paths.mjs';
import { validate } from '../../../packages/brand/src/validate.mjs';
import { run } from '../lib/run.mjs';

/**
 * Regenerate a church's design tokens.
 *
 * Writes the website's tokens.css and installs its images. `churchkit
 * deploy` runs this first, so a colour or logo changed in brand.json is
 * always reflected in what ships.
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

	if (!result.ok && !result.dryRun) return 1;
	if (!dryRun) {
		installImages(data, dir);
		installMobileIcon(data, dir);
	}
	return 0;
}

/**
 * Put this church's images where the site loads them from.
 *
 * The header and footer request /images/logo-dark and /images/logo-white.
 * Nothing previously wrote them, so a freshly seeded deployment rendered
 * broken images — a church's first impression of its own site, caused by a
 * gap in tooling rather than anything it had done.
 *
 * A church's own files win. Where it has none yet, a wordmark is generated
 * from its name and colours, so the site is presentable immediately and
 * obviously still a placeholder.
 */
function installImages(brand, dir) {
	const images = resolve(appDir('web'), 'public/images');
	mkdirSync(images, { recursive: true });

	const supplied = [
		['logoDark', 'logo-dark'],
		['logoWhite', 'logo-white'],
		['logoIcon', 'logo-icon'],
	];

	for (const [key, name] of supplied) {
		const configured = brand.assets?.[key];
		const source = configured ? resolve(dir, configured) : null;

		if (source && existsSync(source)) {
			const ext = source.slice(source.lastIndexOf('.'));
			copyFileSync(source, resolve(images, `${name}${ext}`));
			// A real file supersedes any generated placeholder left over
			// from before the church supplied one.
			const placeholder = resolve(images, `${name}.svg`);
			if (ext !== '.svg' && existsSync(placeholder)) rmSync(placeholder);
			console.log(`  ${name}${ext} (from brand.json)`);
			continue;
		}

		if (name === 'logo-icon') continue;
		const variant = name === 'logo-white' ? 'white' : 'dark';
		writeFileSync(resolve(images, `${name}.svg`), wordmarkSvg(brand, { variant }));
		console.log(`  ${name}.svg (placeholder — add your own to brands/${brand.slug}/assets)`);
	}
}

/**
 * Put this church's app icon where the mobile app's home screen loads it
 * from.
 *
 * `app.config.ts` reads brand.json's appIcon directly by path, since Expo
 * config runs at build-config time and can bake any file location into the
 * native icon. `HomeScreen.tsx`'s in-app logo is different: Metro bundles a
 * literal `require()` path at JS-bundle time, so it needs a real file at a
 * fixed location rather than one that varies per church. Nothing wrote that
 * file before this — the very first local mobile build attempted against a
 * real church's brand.json failed at this exact line.
 */
function installMobileIcon(brand, dir) {
	const configured = brand.assets?.appIcon ?? 'assets/icon.png';
	const source = resolve(dir, configured);
	if (!existsSync(source)) {
		console.log(`  (skipping mobile icon — no ${configured} in brands/${brand.slug})`);
		return;
	}
	const dest = resolve(appDir('mobile'), 'assets/icon.png');
	mkdirSync(dirname(dest), { recursive: true });
	copyFileSync(source, dest);
	console.log(`  apps/mobile/assets/icon.png (from brand.json)`);
}
