import type { Env } from '../types';
import { isBibleBrainTranslation, fetchBibleBrainPassageText } from './bibleBrain';

const BIBLE_API = 'https://rest.api.bible/v1';

// Read from a Worker secret, never hardcoded. The previous key was a literal
// in this file *and* in the app's app.json, so it shipped inside every
// installed bundle and sat in two repos' history — which is exactly why it
// had to be rotated. Set it with:
//   wrangler secret put BIBLE_API_KEY
function bibleApiKey(env: Env): string {
	if (!env.BIBLE_API_KEY) {
		throw new Error('BIBLE_API_KEY is not configured on the Worker');
	}
	return env.BIBLE_API_KEY;
}

// API.Bible-backed translations whose bibleId we already know. ESV isn't
// licensed on API.Bible — it's served from Bible Brain instead (see
// bibleBrain.ts).
export const TRANSLATIONS: Record<string, string> = {
	NIV: '78a9f6124f344018-01',
	CSB: 'a556c5305ee15c3f-01',
	NLT: 'd6e14a625393b4da-01',
};

// Also on API.Bible, but we don't have their bibleId hardcoded — resolved
// by abbreviation on first use and cached for the life of the Worker isolate.
const DYNAMIC_TRANSLATIONS: Record<string, { language: string; abbreviation: string }> = {
	ASV: { language: 'eng', abbreviation: 'ASV' },
	KJV: { language: 'eng', abbreviation: 'KJV' },
	NKJV: { language: 'eng', abbreviation: 'NKJV' },
	RVA: { language: 'spa', abbreviation: 'RVA' },
	NVI: { language: 'spa', abbreviation: 'NVI' },
};

const resolvedBibleIds = new Map<string, string>();

async function resolveDynamicBibleId(translation: string, env: Env): Promise<string> {
	const cached = resolvedBibleIds.get(translation);
	if (cached) return cached;

	const config = DYNAMIC_TRANSLATIONS[translation];
	if (!config) throw new Error(`Unknown translation: ${translation}`);

	const res = await fetch(`${BIBLE_API}/bibles?language=${config.language}`, {
		headers: { 'api-key': bibleApiKey(env) },
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API.Bible bibles lookup ${res.status}: ${body}`);
	}

	const json: any = await res.json();
	const bibles: any[] = json?.data ?? [];
	const match = bibles.find(
		(b) => b.abbreviation?.toUpperCase() === config.abbreviation || b.abbreviationLocal?.toUpperCase() === config.abbreviation
	);
	if (!match?.id) {
		throw new Error(`API.Bible: no bible found for ${translation} (${config.abbreviation}/${config.language}): ${JSON.stringify(json)}`);
	}

	resolvedBibleIds.set(translation, match.id);
	return match.id;
}

export function isValidTranslation(translation: string): boolean {
	return translation in TRANSLATIONS || translation in DYNAMIC_TRANSLATIONS || isBibleBrainTranslation(translation);
}

async function fetchByBibleId(bibleId: string, usfm: string, chapter: number, env: Env): Promise<string> {
	const res = await fetch(
		`${BIBLE_API}/bibles/${bibleId}/chapters/${usfm}.${chapter}?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=false`,
		{ headers: { 'api-key': bibleApiKey(env) } }
	);
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API.Bible ${res.status}: ${body}`);
	}

	const json: any = await res.json();
	const text: string = json?.data?.content?.trim().replace(/\s+/g, ' ') ?? '';
	if (!text) throw new Error('Empty passage from API.Bible');
	return text;
}

// Bible Brain is the preferred text source for every translation. ESV has
// no other source, so its failures propagate; everything else falls back to
// API.Bible if Bible Brain doesn't carry it (or the lookup fails).
//
// startVerse/endVerse restrict the result to a verse range within the
// chapter (reading-plan days that split a chapter across two days). Bible
// Brain returns verse-level data so it can honor this exactly; NIV and CSB
// have no Bible Brain text and API.Bible is only queried per whole chapter
// here, so for those two translations a verse range still returns the full
// chapter.
export async function fetchPassageText(
	translation: string,
	usfm: string,
	chapter: number,
	env: Env,
	startVerse?: number,
	endVerse?: number
): Promise<string> {
	if (isBibleBrainTranslation(translation)) {
		try {
			return await fetchBibleBrainPassageText(translation, usfm, chapter, env, startVerse, endVerse);
		} catch (e: any) {
			if (translation === 'ESV') throw e;
			console.error(`Bible Brain text failed for ${translation}, falling back to API.Bible:`, e?.message);
		}
	}

	const bibleId = TRANSLATIONS[translation] ?? (translation in DYNAMIC_TRANSLATIONS ? await resolveDynamicBibleId(translation, env) : undefined);
	if (!bibleId) throw new Error(`Unknown translation: ${translation}`);

	return fetchByBibleId(bibleId, usfm, chapter, env);
}
