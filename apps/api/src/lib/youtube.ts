import type { Env } from '../types';
import { cachedJson, youtubeBudget } from './cache';

// Every channel has an auto-maintained "uploads" playlist listing all of its
// public videos — its ID is the channel ID with the UC prefix swapped for UU.
// Nobody has to curate a playlist for this to work.
//
// Do not replace this with search.list, which is wrong in two independent
// ways:
//
//  * Cost. search.list draws on its own dedicated quota — "Search Queries
//    per day", 100 calls/day — separate from the 10,000/day "Queries per
//    day" pool everything else uses. Keeping a cache warm needs more than
//    that ceiling allows (a 20 min TTL is 72 refreshes/day before any
//    traffic), so it runs out mid-afternoon and the sermon list freezes.
//    playlistItems.list spends nothing against that 100 and one query
//    against the 10,000.
//
//  * Completeness. search.list queries a search index, not a listing. On the
//    channel this was first measured against it reported 214 results where
//    the uploads playlist reported 439, and 26 of the 50 most recent uploads
//    were missing outright — whole months of services. It is also
//    region-sensitive (regionCode was observed flipping between JP and ZZ on
//    consecutive calls from the same worker), so which videos come back
//    varies by which edge served the request.
//
// Cost per call: one query each against the 10,000/day pool, and zero
// against the search-only quota. Both route through the shared budget in
// cache.ts, so total consumption is bounded no matter how much traffic
// arrives.
const UPLOADS_COST = 1;
const VIDEO_DETAILS_COST = 1;

// TTLs sit just under the cache-warming cron cadence (see wrangler.jsonc)
// so every cron tick reliably finds the entry expired and refreshes it,
// which makes cached freshness track the cron rather than drifting a whole
// extra TTL behind it. A new upload is therefore visible within ~2 minutes.
// Steady state on a 2-minute cron: 720 uploads calls + 720 detail calls =
// ~1,440 queries/day against the 10,000/day quota, well under the cap.
const UPLOADS_TTL_SECONDS = 100;
const VIDEO_DETAILS_TTL_SECONDS = 100;

function uploadsPlaylistId(channelId: string): string {
	return channelId.startsWith('UC') ? `UU${channelId.slice(2)}` : channelId;
}

// The normalized video shape every caller works with, so no caller has to
// know which upstream endpoint (or response shape) produced it.
export interface YtVideo {
	id: string;
	title: string;
	publishedAt: string | null;
	thumbnail: string | null;
}

/** True when this deployment has a YouTube channel configured. */
export function youtubeConfigured(env: Env): boolean {
	return !!(env.YOUTUBE_API_KEY && env.YOUTUBE_CHANNEL_ID);
}

export async function ytFetch(env: Env, maxResults = 50): Promise<{ items: YtVideo[] } | null> {
	// A church with no channel is not an error state — it simply has no
	// videos, and every caller already handles an empty result.
	if (!youtubeConfigured(env)) return null;

	const playlistId = uploadsPlaylistId(env.YOUTUBE_CHANNEL_ID!);
	const params = new URLSearchParams({
		playlistId,
		part: 'snippet,contentDetails',
		maxResults: String(maxResults),
		key: env.YOUTUBE_API_KEY!,
	});
	const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;

	// The cache key deliberately omits the API key. Using the request URL as
	// the key would write YOUTUBE_API_KEY into api_cache in plaintext, where
	// anything with read access to D1 could recover it.
	const cacheKey = `youtube:uploads:${playlistId}:${maxResults}`;

	const data = await cachedJson(env, cacheKey, UPLOADS_TTL_SECONDS, () => fetch(url), youtubeBudget(UPLOADS_COST));
	if (!data) return null;

	const items: YtVideo[] = (data.items || [])
		.map((item: any) => ({
			id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || null,
			title: item.snippet?.title || '',
			// A playlistItem's own snippet.publishedAt is when the video was
			// added to the playlist; contentDetails.videoPublishedAt is when
			// the video itself went public, which is what callers mean.
			publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
			thumbnail: item.snippet?.thumbnails?.high?.url
				|| item.snippet?.thumbnails?.medium?.url
				|| item.snippet?.thumbnails?.default?.url
				|| null,
		}))
		.filter((v: YtVideo) => !!v.id);

	// A private or deleted video stays in the uploads playlist as an item
	// with no usable snippet — drop anything with no title to show.
	return { items: items.filter((v) => v.title && v.title !== 'Private video' && v.title !== 'Deleted video') };
}

// liveStreamingDetails for a batch of video IDs, routed through cachedJson
// so it is bounded like every other YouTube call. A bare fetch() here would
// be the one YouTube consumer that scales directly with visitor traffic and
// could exhaust the quota on a traffic spike.
//
// videos.list costs one query regardless of how many IDs are passed (up to
// 50), so there is nothing to gain by asking for fewer.
//
// The cache key is fixed rather than derived from the ID list, which keeps
// this to a single row: a brand-new upload can therefore be missing from
// the cached details for up to one TTL, delaying "we are live" by at most
// ~100s. Keying on the ID set instead would refresh instantly but leave a
// new orphaned row behind on every upload.
export async function ytVideoDetails(env: Env, videoIds: string[]): Promise<any> {
	if (!youtubeConfigured(env) || !videoIds.length) return null;
	const params = new URLSearchParams({
		id: videoIds.slice(0, 50).join(','),
		part: 'liveStreamingDetails,snippet',
		key: env.YOUTUBE_API_KEY!,
	});
	const url = `https://www.googleapis.com/youtube/v3/videos?${params}`;
	return cachedJson(
		env,
		'youtube:video-details',
		VIDEO_DETAILS_TTL_SECONDS,
		() => fetch(url),
		youtubeBudget(VIDEO_DETAILS_COST)
	);
}
