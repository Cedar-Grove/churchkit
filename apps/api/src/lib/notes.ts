import type { Env } from '../types';
import { pcoFetch, pcoCreate } from './pco';

/**
 * PCO rejects a Note that isn't filed under a category, so "post the note
 * and only add a category if the secret happens to be set" silently drops
 * the note whenever the secret is missing or points at a category that no
 * longer exists — which is exactly how connect card notes went missing
 * while the workflow card was created fine.
 *
 * So the category is resolved against the org's real categories before the
 * note is written: the configured ID wins when it's genuinely there, then a
 * category matched by name, then PCO's built-in "General", which every
 * organization has. A note filed under the wrong category is recoverable;
 * one PCO never accepted isn't.
 */

const CATEGORY_TTL_MS = 5 * 60 * 1000;
const FALLBACK_CATEGORY_NAME = 'General';

type Category = { id: string; name: string };
let cache: { at: number; categories: Category[] } | null = null;

async function loadCategories(env: Env): Promise<Category[]> {
	if (cache && Date.now() - cache.at < CATEGORY_TTL_MS) return cache.categories;

	const res = await pcoFetch('/people/v2/note_categories?per_page=100', env);
	const categories: Category[] = (res.data || []).map((c: any) => ({
		id: String(c.id),
		name: String(c.attributes?.name ?? ''),
	}));
	cache = { at: Date.now(), categories };
	return categories;
}

/** Test seam — the module-level cache outlives a single request in a warm isolate. */
export function resetNoteCategoryCache(): void {
	cache = null;
}

/**
 * @param configuredId the form's category secret, if it's set
 * @param preferredNames category names to look for, best match first
 */
export async function resolveNoteCategoryId(
	env: Env,
	configuredId: string | undefined,
	preferredNames: string[]
): Promise<string | null> {
	let categories: Category[];
	try {
		categories = await loadCategories(env);
	} catch (e) {
		// Can't check the configured ID against anything — better to try it
		// than to skip the note outright.
		console.error('Note category lookup failed:', e);
		return configuredId?.trim() || null;
	}

	const configured = configuredId?.trim();
	if (configured && categories.some(c => c.id === configured)) return configured;
	if (configured) {
		console.error(`Configured note category ${configured} not found in PCO; falling back by name`);
	}

	for (const name of [...preferredNames, FALLBACK_CATEGORY_NAME]) {
		const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
		if (match) return match.id;
	}

	return categories[0]?.id ?? null;
}

/**
 * Creates a note under a resolved category. Throws on failure so callers can
 * record it — a note that didn't make it into PCO is worth surfacing to
 * staff, who otherwise have only the workflow card and no idea the visitor's
 * answers went missing.
 */
export async function createNote(
	personId: string,
	note: string,
	env: Env,
	options: { configuredCategoryId?: string; preferredCategoryNames: string[] }
): Promise<void> {
	const categoryId = await resolveNoteCategoryId(
		env,
		options.configuredCategoryId,
		options.preferredCategoryNames
	);
	if (!categoryId) throw new Error('No PCO note category available to file the note under');

	await pcoCreate(`/people/v2/people/${personId}/notes`, 'Note', {
		note,
		note_category_id: categoryId,
	}, env);
}
