// Mirrors the 2-Year Bible Reading Plan (Year 2) defined in the mobile app's
// BibleScreen.tsx (STREAMS/getReading/getDayOfYear) — kept in sync by hand so
// the audio-warming job caches the same chapters the app will ask for. If the
// plan ever changes in the app, update it here too.

export interface Book { name: string; usfm: string; chapters: number; startChapter?: number }
export interface Reading { name: string; chapter: number; usfm: string }

// Stream 1 — Old Testament (Year 2: Ezra → Malachi)
const OT_STREAM: Book[] = [
	{ name: 'Ezra', usfm: 'EZR', chapters: 10 },
	{ name: 'Nehemiah', usfm: 'NEH', chapters: 13 },
	{ name: 'Esther', usfm: 'EST', chapters: 10 },
	{ name: 'Job', usfm: 'JOB', chapters: 42 },
	{ name: 'Proverbs', usfm: 'PRO', chapters: 31 },
	{ name: 'Ecclesiastes', usfm: 'ECC', chapters: 12 },
	{ name: 'Song of Solomon', usfm: 'SNG', chapters: 5, startChapter: 4 },
	{ name: 'Isaiah', usfm: 'ISA', chapters: 66 },
	{ name: 'Jeremiah', usfm: 'JER', chapters: 52 },
	{ name: 'Lamentations', usfm: 'LAM', chapters: 5 },
	{ name: 'Ezekiel', usfm: 'EZK', chapters: 48 },
	{ name: 'Daniel', usfm: 'DAN', chapters: 12 },
	{ name: 'Hosea', usfm: 'HOS', chapters: 14 },
	{ name: 'Joel', usfm: 'JOL', chapters: 3 },
	{ name: 'Amos', usfm: 'AMO', chapters: 9 },
	{ name: 'Obadiah', usfm: 'OBA', chapters: 1 },
	{ name: 'Jonah', usfm: 'JON', chapters: 4 },
	{ name: 'Micah', usfm: 'MIC', chapters: 7 },
	{ name: 'Nahum', usfm: 'NAM', chapters: 3 },
	{ name: 'Habakkuk', usfm: 'HAB', chapters: 3 },
	{ name: 'Zephaniah', usfm: 'ZEP', chapters: 3 },
	{ name: 'Haggai', usfm: 'HAG', chapters: 2 },
	{ name: 'Zechariah', usfm: 'ZEC', chapters: 14 },
	{ name: 'Malachi', usfm: 'MAL', chapters: 4 },
];

// Stream 2 — NT Epistles + Psalms (Acts → Revelation → Psalms)
const NT_STREAM: Book[] = [
	{ name: 'Acts', usfm: 'ACT', chapters: 28 },
	{ name: 'Romans', usfm: 'ROM', chapters: 16 },
	{ name: '1 Corinthians', usfm: '1CO', chapters: 16 },
	{ name: '2 Corinthians', usfm: '2CO', chapters: 13 },
	{ name: 'Galatians', usfm: 'GAL', chapters: 6 },
	{ name: 'Ephesians', usfm: 'EPH', chapters: 6 },
	{ name: 'Philippians', usfm: 'PHP', chapters: 4 },
	{ name: 'Colossians', usfm: 'COL', chapters: 4 },
	{ name: '1 Thessalonians', usfm: '1TH', chapters: 5 },
	{ name: '2 Thessalonians', usfm: '2TH', chapters: 3 },
	{ name: '1 Timothy', usfm: '1TI', chapters: 6 },
	{ name: '2 Timothy', usfm: '2TI', chapters: 4 },
	{ name: 'Titus', usfm: 'TIT', chapters: 3 },
	{ name: 'Philemon', usfm: 'PHM', chapters: 1 },
	{ name: 'Hebrews', usfm: 'HEB', chapters: 13 },
	{ name: 'James', usfm: 'JAS', chapters: 5 },
	{ name: '1 Peter', usfm: '1PE', chapters: 5 },
	{ name: '2 Peter', usfm: '2PE', chapters: 3 },
	{ name: '1 John', usfm: '1JN', chapters: 5 },
	{ name: '2 John', usfm: '2JN', chapters: 1 },
	{ name: '3 John', usfm: '3JN', chapters: 1 },
	{ name: 'Jude', usfm: 'JUD', chapters: 1 },
	{ name: 'Revelation', usfm: 'REV', chapters: 22 },
	{ name: 'Psalms', usfm: 'PSA', chapters: 150 },
];

export const STREAMS: Book[][] = [OT_STREAM, NT_STREAM];

export function getReading(stream: Book[], dayOfYear: number): Reading {
	let remaining = (dayOfYear - 1) % 365;
	for (const book of stream) {
		if (remaining < book.chapters) {
			return {
				name: book.name,
				chapter: remaining + (book.startChapter ?? 1),
				usfm: book.usfm,
			};
		}
		remaining -= book.chapters;
	}
	return { name: stream[0].name, chapter: stream[0].startChapter ?? 1, usfm: stream[0].usfm };
}

// Day-of-year (1-indexed, Jan 1 = day 1) for a UTC calendar date — pass
// UTC-based y/m/d (e.g. from Intl.DateTimeFormat in a target time zone), not
// device/runtime-local fields, since Workers have no "local" time zone.
export function dayOfYearUTC(year: number, month: number, day: number): number {
	const target = Date.UTC(year, month - 1, day);
	const start = Date.UTC(year, 0, 0);
	return Math.floor((target - start) / 86400000);
}

export function readingsForDayOfYear(dayOfYear: number): Reading[] {
	return STREAMS.map(stream => getReading(stream, dayOfYear));
}
