import type { Env } from '../types';
import { err, json, CORS_HEADERS } from '../lib/response';
import { fetchPassageText, isValidTranslation } from '../lib/bible';
import { fetchEsvChapterAudio } from '../lib/bibleAudioSource';

// Reading-plan narration only — always the real, dramatized ESV recording
// from Bible Brain, regardless of which translation's text the app has
// displayed. This is a live pass-through, not cached on our side: Bible
// Brain's license restricts archiving/duplicating DBP Content beyond normal
// on-demand playback, so we never persist it to R2 or pre-warm it.
export async function handleBibleAudio(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const usfm = url.searchParams.get('usfm') ?? '';
	const chapter = Number(url.searchParams.get('chapter'));

	if (!usfm) return err('Missing usfm', 400);
	if (!Number.isInteger(chapter) || chapter < 1) return err('Missing or invalid chapter', 400);

	let upstream: Response;
	try {
		upstream = await fetchEsvChapterAudio(usfm, chapter, env);
	} catch (e: any) {
		console.error('Bible audio: fetch failed:', e?.message);
		return err(`Could not load audio: ${e?.message ?? 'unknown error'}`, 502);
	}

	return new Response(upstream.body, {
		headers: {
			...CORS_HEADERS,
			'Content-Type': 'audio/mpeg',
			// Ordinary short-lived HTTP caching only, so a quick pause/resume or
			// scrub doesn't re-fetch — not the indefinite archival copy this
			// route used to keep in R2.
			'Cache-Control': 'public, max-age=3600',
		},
	});
}

// Text proxy for translations the app can't fetch directly from a
// client-side API (e.g. ESV, which is only available via Bible Brain,
// a key that must stay server-side).
export async function handleBibleText(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const translation = url.searchParams.get('translation') ?? '';
	const usfm = url.searchParams.get('usfm') ?? '';
	const chapter = Number(url.searchParams.get('chapter'));
	const startVerseParam = url.searchParams.get('startVerse');
	const endVerseParam = url.searchParams.get('endVerse');

	if (!isValidTranslation(translation)) return err(`Unknown translation: ${translation}`, 400);
	if (!usfm) return err('Missing usfm', 400);
	if (!Number.isInteger(chapter) || chapter < 1) return err('Missing or invalid chapter', 400);

	let startVerse: number | undefined;
	if (startVerseParam !== null) {
		startVerse = Number(startVerseParam);
		if (!Number.isInteger(startVerse) || startVerse < 1) return err('Invalid startVerse', 400);
	}
	let endVerse: number | undefined;
	if (endVerseParam !== null) {
		endVerse = Number(endVerseParam);
		if (!Number.isInteger(endVerse) || endVerse < 1) return err('Invalid endVerse', 400);
	}
	if (startVerse !== undefined && endVerse !== undefined && endVerse < startVerse) {
		return err('endVerse must be >= startVerse', 400);
	}

	try {
		const text = await fetchPassageText(translation, usfm, chapter, env, startVerse, endVerse);
		return json({ text });
	} catch (e: any) {
		console.error('Bible text: fetch failed:', e?.message);
		return err(`Could not load passage: ${e?.message ?? 'unknown error'}`, 502);
	}
}
