import type { Env } from '../types';

// Fixed-window request counters in D1, using the same atomic
// INSERT ... ON CONFLICT ... RETURNING pattern as lib/cache.ts's daily
// budget: the increment always happens, so a burst arriving at once can't
// all slip through a check-then-increment race — the returned count is what
// decides whether the request this reservation was for is allowed.
//
// D1 rather than an in-memory map or the Cache API because a Worker isolate
// is per-edge and short-lived: a counter kept there would reset constantly
// and let an attacker rotate around it by hitting different edges. One
// shared table is the only place a limit can actually hold globally.

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the current window rolls over — sent as Retry-After. */
	retryAfter: number;
}

async function hit(
	env: Env,
	bucketKey: string,
	limit: number,
	windowSeconds: number
): Promise<RateLimitResult> {
	const now = Math.floor(Date.now() / 1000);
	const windowStart = now - (now % windowSeconds);

	const row = await env.DB.prepare(
		`INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
		 ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
		 RETURNING count`
	).bind(bucketKey, windowStart).first<{ count: number }>();

	const count = row?.count ?? 0;
	return {
		allowed: count <= limit,
		retryAfter: windowStart + windowSeconds - now,
	};
}

/**
 * The client's real IP. Cloudflare sets CF-Connecting-IP on every request
 * that reaches a Worker and it can't be spoofed by the client (Cloudflare
 * overwrites any inbound value), unlike X-Forwarded-For.
 */
export function clientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * Two limits, both of which must pass:
 *
 *  - per-IP, so one person or script can't hammer the forms;
 *  - a global ceiling across every IP, so a distributed burst still can't
 *    flood Planning Center with junk people records or drain the Resend
 *    quota. Real submissions run a handful a day, so a ceiling this far
 *    above normal only ever trips on abuse.
 *
 * Deliberately shared across all four form endpoints rather than scoped per
 * endpoint — otherwise the same script just rotates between them.
 */
export const FORM_IP_LIMIT = 8;
export const FORM_IP_WINDOW_SECONDS = 10 * 60;
export const FORM_GLOBAL_LIMIT = 120;
export const FORM_GLOBAL_WINDOW_SECONDS = 60 * 60;

export async function checkFormRateLimit(request: Request, env: Env): Promise<RateLimitResult> {
	const ip = clientIp(request);

	const perIp = await hit(env, `form:ip:${ip}`, FORM_IP_LIMIT, FORM_IP_WINDOW_SECONDS);
	if (!perIp.allowed) return perIp;

	return hit(env, 'form:global', FORM_GLOBAL_LIMIT, FORM_GLOBAL_WINDOW_SECONDS);
}

/**
 * Drops windows that have already rolled over. Called from the scheduled
 * handler so the table doesn't grow without bound — nothing reads a window
 * once it's past, so there's no reason to keep it.
 */
export async function purgeExpiredRateLimits(env: Env): Promise<void> {
	const cutoff = Math.floor(Date.now() / 1000) - FORM_GLOBAL_WINDOW_SECONDS * 2;
	await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(cutoff).run();
}
