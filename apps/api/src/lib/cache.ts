import type { Env } from '../types';

// One budget shared by every call to the YouTube API, charged each
// endpoint's real cost, because the per-endpoint call caps this replaced
// could not bound the total — two endpoints each under their own cap can
// still exhaust a quota they share.
//
// Google meters this project with two independent quotas (Cloud Console ->
// YouTube Data API v3 -> Quotas), and the distinction matters:
//
//   Queries per day          10,000   <- what everything here draws on
//   Search Queries per day      100   <- search.list only, and nothing else
//
// Both endpoints used here (playlistItems.list, videos.list) cost one query
// against the 10,000 and nothing against the 100.
//
// search.list is deliberately not used anywhere. Its dedicated 100/day
// ceiling cannot sustain a warm cache: a 20 min TTL needs 72 refreshes a
// day before any traffic, so exhausting it mid-afternoon was arithmetic,
// not a sizing mistake. Do not reintroduce it because the 10,000 quota
// looks roomy — that is not the quota it spends.
//
// 8,000 leaves a fifth of the day's queries spare for anything else on the
// same API key, and for the fact that a refused reservation still
// increments (see reserveCost) — so the counter runs slightly ahead of real
// usage and this stops early rather than late. Expected steady-state draw
// is ~1,440 queries/day, so the cap is a backstop, not a ration.
export const YOUTUBE_DAILY_CAP = 8000;
const YOUTUBE_BUDGET_KEY = 'youtube_units';

// Every YouTube call routes through this so the cap covers all of them.
// `cost` is what that endpoint spends against the metered quota.
export function youtubeBudget(cost: number): Budget {
	return { key: YOUTUBE_BUDGET_KEY, cost, dailyCap: YOUTUBE_DAILY_CAP };
}

export interface Budget {
	key: string;
	cost: number;
	dailyCap: number;
}

// How long to sit on a stale entry after the budget refuses a refresh.
// Without this, a denial left expires_at in the past, so every subsequent
// cron tick and page load re-attempted, re-incremented the counter, and was
// refused again — which is how a 95/day cap reached 187 and climbing, and
// why nothing refreshed for the rest of the day once it tripped.
const BUDGET_DENIED_BACKOFF_SECONDS = 60;

// Matches the reset time of YouTube's daily quota, which is midnight
// Pacific Time (not UTC).
function currentQuotaDay(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

// Atomically reserves `cost` against a shared per-day budget. The
// increment always happens (so a burst of calls right at the cap can't all
// slip through via a check-then-increment race) — this just decides
// whether the call this reservation was for should actually go out.
async function reserveCost(env: Env, budget: Budget): Promise<boolean> {
	const day = currentQuotaDay();
	const row = await env.DB.prepare(
		`INSERT INTO api_call_budget (budget_key, day, count) VALUES (?, ?, ?)
		 ON CONFLICT(budget_key, day) DO UPDATE SET count = count + excluded.count
		 RETURNING count`
	).bind(budget.key, day, budget.cost).first<{ count: number }>();
	return (row?.count ?? Infinity) <= budget.dailyCap;
}

// Two callers wanting the same key in the same request/cron tick used to
// each read the cache, each see it expired, and each fetch — scheduled()
// runs getMergedSermons and getLiveStream concurrently over the identical
// YouTube key, so every expiry cost two upstream calls and two budget
// reservations. Coalesce concurrent work onto one promise per key. The map
// is per-isolate, which is all that's needed: it only has to cover the
// window where one isolate has several callers in flight at once.
const inFlight = new Map<string, Promise<any>>();

// Cache for expensive/rate-limited upstream JSON responses, backed by D1
// rather than Cloudflare's per-edge Cache API — the data is identical for
// every visitor, so one shared cache row serves every user from every edge
// location instead of each one independently missing and re-fetching.
// `fetcher` does the actual request (so callers needing auth headers, e.g.
// PCO's Basic auth, aren't limited to a bare `fetch(url)`); `cacheKey`
// identifies the cached row and would normally just be the request URL.
// When `budget` is set, a shared counter (keyed by `budget.key`) hard-caps
// how many times the upstream call actually goes out per day, regardless
// of how often callers ask — once that's exhausted, whatever's cached
// (even if stale) is served instead of nothing, rather than ever risking a
// quota-limited upstream tipping into a 429.
export function cachedJson(
	env: Env,
	cacheKey: string,
	ttlSeconds: number,
	fetcher: () => Promise<Response>,
	budget?: Budget
): Promise<any> {
	const existing = inFlight.get(cacheKey);
	if (existing) return existing;
	const work = cachedJsonUncoalesced(env, cacheKey, ttlSeconds, fetcher, budget)
		.finally(() => inFlight.delete(cacheKey));
	inFlight.set(cacheKey, work);
	return work;
}

async function cachedJsonUncoalesced(
	env: Env,
	cacheKey: string,
	ttlSeconds: number,
	fetcher: () => Promise<Response>,
	budget?: Budget
): Promise<any> {
	const now = Math.floor(Date.now() / 1000);
	const row = await env.DB.prepare(
		'SELECT value, expires_at FROM api_cache WHERE cache_key = ?'
	).bind(cacheKey).first<{ value: string; expires_at: number }>();

	if (row && row.expires_at > now) {
		return JSON.parse(row.value);
	}

	if (budget && !(await reserveCost(env, budget))) {
		if (!row) return null;
		// Park the stale entry so callers stop stampeding the budget.
		await env.DB.prepare('UPDATE api_cache SET expires_at = ? WHERE cache_key = ?')
			.bind(now + BUDGET_DENIED_BACKOFF_SECONDS, cacheKey).run();
		return JSON.parse(row.value);
	}

	try {
		const res = await fetcher();
		if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
		const data = await res.json();

		await env.DB.prepare(
			`INSERT INTO api_cache (cache_key, value, expires_at) VALUES (?, ?, ?)
			 ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
		).bind(cacheKey, JSON.stringify(data), now + ttlSeconds).run();

		return data;
	} catch (e) {
		// Serve stale data over an upstream failure (e.g. a quota 429) rather
		// than surfacing nothing at all — better a slightly-old sermon video
		// or live status than none.
		if (row) return JSON.parse(row.value);
		throw e;
	}
}

