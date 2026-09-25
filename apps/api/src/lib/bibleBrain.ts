import type { Env } from '../types';

// Faith Comes By Hearing's "Bible Brain" API (Digital Bible Platform v4).
// This is our preferred text source for every translation it carries (API.Bible
// is the fallback for whichever ones it doesn't), and our only audio source —
// reading-plan narration is always the real, dramatized ESV recording, never
// synthesized.
//
// Fileset IDs below were confirmed against live /bibles?language_code=eng
// and =spa dumps, not guessed — Bible Brain splits OT and NT into separate
// filesets per translation (occasionally a single "complete" one), so each
// entry tracks both halves. NIV and CSB aren't listed here: NIV has no text
// or audio fileset on Bible Brain at all (only a video one), and CSB has
// audio but no text — both fall back to API.Bible entirely for text.
const DBP_API = 'https://b4.dbt.io/api';

// The reading-plan player's two independent audio choices. Both are style
// choices Bible Brain exposes as entirely separate filesets, not a
// transcode we'd do ourselves:
//   - style: "dramatized" (full voice cast + music) vs "narrator" (one
//     voice reading straight through) — a production difference, not a
//     quality one.
//   - quality: "standard" (mp3, ~65kbps) vs "dataSaver" (opus, ~18kbps) —
//     the exact same recording, just transcoded smaller. Opus's speech
//     mode makes that cut sound much less drastic than the bitrate ratio
//     suggests, except under "dramatized," where the low bitrate can
//     start to muddy the underscore/sound design that "narrator" doesn't have.
export type AudioStyle = 'dramatized' | 'narrator';
export type AudioQuality = 'standard' | 'dataSaver';

interface AudioFileset {
	filesetId: string;
	contentType: string;
}

// Keyed [style][quality]. Only ESV has any of these populated.
type AudioVariants = Record<AudioStyle, Record<AudioQuality, AudioFileset | undefined>>;

interface Filesets {
	textNT?: string;
	textOT?: string;
	textC?: string;
	audioNT?: AudioVariants;
	audioOT?: AudioVariants;
	audioC?: AudioVariants;
}

const BIBLE_BRAIN_FILESETS: Record<string, Filesets> = {
	ESV: {
		textNT: 'ENGESVN_ET',
		textOT: 'ENGESVO_ET',
		audioNT: {
			dramatized: {
				standard: { filesetId: 'ENGESVN2DA', contentType: 'audio/mpeg' },
				dataSaver: { filesetId: 'ENGESVN2DA-opus16', contentType: 'audio/webm' },
			},
			narrator: {
				standard: { filesetId: 'ENGESVN1DA', contentType: 'audio/mpeg' },
				dataSaver: { filesetId: 'ENGESVN1DA-opus16', contentType: 'audio/webm' },
			},
		},
		audioOT: {
			dramatized: {
				standard: { filesetId: 'ENGESVO2DA', contentType: 'audio/mpeg' },
				dataSaver: { filesetId: 'ENGESVO2DA-opus16', contentType: 'audio/webm' },
			},
			narrator: {
				standard: { filesetId: 'ENGESVO1DA', contentType: 'audio/mpeg' },
				dataSaver: { filesetId: 'ENGESVO1DA-opus16', contentType: 'audio/webm' },
			},
		},
	},
	ASV: { textC: 'ENGASV' },
	KJV: { textNT: 'ENGKJVN_ET', textOT: 'ENGKJVO_ET' },
	NLT: { textNT: 'ENGNLTN_ET', textOT: 'ENGNLTO_ET' },
	NKJV: { textNT: 'ENGNKJN_ET', textOT: 'ENGNKJO_ET' },
	// "1602 Reina-Valera Antigua" — not to be confused with SPARVC (Reina
	// Valera 1909), a later revision under the same abbr-adjacent code.
	RVA: { textC: 'SPNR02' },
	NVI: { textC: 'SPANVI' },
};

export function isBibleBrainTranslation(translation: string): boolean {
	return translation in BIBLE_BRAIN_FILESETS;
}

// The 27 NT books; everything else in our reading plan is OT. Bible Brain
// keys its filesets by testament, so a chapter fetch has to know which half
// of the Bible its book belongs to.
const NT_BOOKS = new Set([
	'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL',
	'1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
]);

function pickTextFileset(filesets: Filesets, usfm: string): string | undefined {
	const isNT = NT_BOOKS.has(usfm.toUpperCase());
	return (isNT ? filesets.textNT : filesets.textOT) ?? filesets.textC;
}

function pickAudioFileset(filesets: Filesets, usfm: string, style: AudioStyle, quality: AudioQuality): AudioFileset | undefined {
	const isNT = NT_BOOKS.has(usfm.toUpperCase());
	const variants = (isNT ? filesets.audioNT : filesets.audioOT) ?? filesets.audioC;
	return variants?.[style]?.[quality];
}

async function fetchChapter(filesetId: string, usfm: string, chapter: number, env: Env): Promise<any> {
	const res = await fetch(`${DBP_API}/bibles/filesets/${filesetId}/${usfm}/${chapter}?v=4&key=${env.BIBLE_BRAIN_API_KEY}`);
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Bible Brain ${filesetId} ${res.status}: ${body}`);
	}
	return res.json();
}

interface AudioLocation {
	url: string;
	contentType: string;
}

async function fetchBibleBrainChapterAudioUrl(
	translation: string,
	usfm: string,
	chapter: number,
	env: Env,
	style: AudioStyle,
	quality: AudioQuality
): Promise<AudioLocation> {
	const filesets = BIBLE_BRAIN_FILESETS[translation];
	const fileset = filesets && pickAudioFileset(filesets, usfm, style, quality);
	if (!fileset) throw new Error(`Bible Brain: no ${style}/${quality} audio fileset for ${translation} ${usfm}`);

	const json = await fetchChapter(fileset.filesetId, usfm, chapter, env);
	const path: string | undefined = json?.data?.[0]?.path;
	if (!path) throw new Error(`Bible Brain: no audio path in chapter response: ${JSON.stringify(json)}`);
	return { url: path, contentType: fileset.contentType };
}

// Reading-plan narration is always the real ESV recording — never any other
// translation, and never TTS. style/quality choose which of Bible Brain's
// ESV audio filesets to use; see the AudioStyle/AudioQuality comment above.
export function fetchEsvChapterAudioUrl(
	usfm: string,
	chapter: number,
	env: Env,
	style: AudioStyle,
	quality: AudioQuality
): Promise<AudioLocation> {
	return fetchBibleBrainChapterAudioUrl('ESV', usfm, chapter, env, style, quality);
}

// startVerse/endVerse restrict the chapter to a verse range (either bound
// may be omitted to mean "from the start" / "to the end" of the chapter) —
// used for reading-plan days that split a chapter across two days.
export async function fetchBibleBrainPassageText(
	translation: string,
	usfm: string,
	chapter: number,
	env: Env,
	startVerse?: number,
	endVerse?: number
): Promise<string> {
	const filesets = BIBLE_BRAIN_FILESETS[translation];
	const filesetId = filesets && pickTextFileset(filesets, usfm);
	if (!filesetId) throw new Error(`Bible Brain: no text fileset for ${translation} ${usfm}`);

	const json = await fetchChapter(filesetId, usfm, chapter, env);
	let verses: any[] = json?.data ?? [];
	if (startVerse !== undefined || endVerse !== undefined) {
		const lo = startVerse ?? -Infinity;
		const hi = endVerse ?? Infinity;
		verses = verses.filter(v => (v.verse_end ?? v.verse_start) >= lo && v.verse_start <= hi);
	}
	const text = verses.map(v => v.verse_text ?? '').join(' ').trim().replace(/\s+/g, ' ');
	if (!text) throw new Error(`Bible Brain: empty passage text in response: ${JSON.stringify(json)}`);
	return text;
}
