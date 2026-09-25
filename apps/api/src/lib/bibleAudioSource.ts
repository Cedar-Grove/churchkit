import type { Env } from '../types';
import { fetchEsvChapterAudioUrl, type AudioStyle, type AudioQuality } from './bibleBrain';

export interface AudioResult {
	response: Response;
	contentType: string;
}

// Reading-plan narration is a live pass-through from Bible Brain — always
// the real ESV recording, regardless of which translation's text is
// displayed. Returns the upstream response as-is (not buffered) so the
// caller can stream its body straight through without us persisting a copy
// anywhere. contentType tracks the codec of whichever fileset style/quality
// picked (mp3 for "standard", opus/webm for "dataSaver" — see bibleBrain.ts).
export async function fetchEsvChapterAudio(
	usfm: string,
	chapter: number,
	env: Env,
	style: AudioStyle,
	quality: AudioQuality
): Promise<AudioResult> {
	const { url, contentType } = await fetchEsvChapterAudioUrl(usfm, chapter, env, style, quality);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Bible Brain audio download ${res.status}`);
	return { response: res, contentType };
}
