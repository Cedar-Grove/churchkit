import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../../..');

/**
 * A church's own directory, which is never committed to this repository.
 * `examples/example-church` is the one exception, and exists so the whole
 * provisioning path can be exercised without inventing a real church.
 */
export function brandDir(slug) {
	const candidates = [
		resolve(REPO_ROOT, 'brands', slug),
		resolve(REPO_ROOT, 'examples', slug),
	];
	const found = candidates.find((c) => existsSync(resolve(c, 'brand.json')));
	if (!found) {
		throw new Error(
			`No brand.json for "${slug}". Looked in:\n` +
			candidates.map((c) => `  ${c}`).join('\n') +
			`\n\nCopy examples/example-church to brands/${slug} and edit it.`
		);
	}
	return found;
}

export function readBrand(slug) {
	const dir = brandDir(slug);
	const path = resolve(dir, 'brand.json');
	try {
		return { dir, path, brand: JSON.parse(readFileSync(path, 'utf8')) };
	} catch (e) {
		throw new Error(`${path} is not valid JSON: ${e.message}`);
	}
}

export const appDir = (name) => resolve(REPO_ROOT, 'apps', name);

/** Names Cloudflare resources consistently, so nothing collides between churches. */
export const resourceNames = (slug) => ({
	apiWorker: `${slug}-api`,
	webWorker: `${slug}-web`,
	adminProject: `${slug}-admin`,
	database: `${slug}-db`,
	bucket: `${slug}-media`,
});
