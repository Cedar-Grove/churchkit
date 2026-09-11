import type { Env } from '../types';
import { fetchEsvChapterAudioUrl } from './bibleBrain';

// Reading-plan narration is a live pass-through from Bible Brain — always
// the real, dramatized ESV recording, regardless of which translation's
// text is displayed. Returns the upstream response as-is (not buffered) so
// the caller can stream its body straight through without us persisting a
// copy anywhere.
export async function fetchEsvChapterAudio(usfm: string, chapter: number, env: Env): Promise<Response> {
	const url = await fetchEsvChapterAudioUrl(usfm, chapter, env);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Bible Brain audio download ${res.status}`);
	return res;
}
