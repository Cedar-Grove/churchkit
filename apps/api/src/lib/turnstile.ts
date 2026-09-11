import type { Env } from '../types';

/**
 * Cloudflare Turnstile verification for the four public form endpoints.
 *
 * These endpoints are shared by two very different clients: the website,
 * which runs in a browser and can render a Turnstile widget, and the mobile
 * app (which submits connect cards and prayer requests), which can't and submits with no token at all. So a token is
 * demanded only from callers that are actually browsers — see
 * `looksLikeBrowser` for how that's decided and what it does and doesn't
 * buy us.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The field name Turnstile's own widget script gives its hidden input. */
export const TURNSTILE_TOKEN_FIELD = 'cf-turnstile-response';

export type TurnstileOutcome =
	| { ok: true }
	| { ok: false; reason: string };

/**
 * A browser doing a cross-origin POST always sends `Origin`, and modern
 * browsers also send `Sec-Fetch-Site`; React Native's fetch sends neither.
 * That's what separates the website from the app here.
 *
 * This is a client hint, not proof: a script written to omit `Origin` skips
 * the challenge. It still faces the honeypots, the body and field caps, and
 * the per-IP and global rate limits in formGuard.ts/rateLimit.ts, which is
 * the same protection every submission got before Turnstile existed. What
 * this closes is the gap those don't cover — a headless browser driving the
 * real form at human pace — and that's the case that can't hide its Origin
 * without giving up being a browser.
 */
function looksLikeBrowser(request: Request): boolean {
	return request.headers.has('Origin') || request.headers.has('Sec-Fetch-Site');
}

/**
 * Verify a submission's Turnstile token, if one is required of it.
 *
 * Unconfigured is not enforced: with no TURNSTILE_SECRET bound, every
 * submission passes through untouched. That keeps the website working
 * for a deployment that has not set the secret, and means a staging
 * environment without the secret behaves as it did before.
 */
export async function verifyFormTurnstile(
	request: Request,
	body: any,
	env: Env
): Promise<TurnstileOutcome> {
	const secret = env.TURNSTILE_SECRET;
	if (!secret) return { ok: true };

	const token = typeof body?.[TURNSTILE_TOKEN_FIELD] === 'string'
		? body[TURNSTILE_TOKEN_FIELD].trim()
		: '';

	if (!token) {
		// The app, and anything else that isn't a browser, is let through to
		// the honeypot and rate-limit checks as before.
		if (!looksLikeBrowser(request)) return { ok: true };
		return { ok: false, reason: 'missing-token' };
	}

	const form = new FormData();
	form.append('secret', secret);
	form.append('response', token);
	// Turnstile binds a token to the IP that solved it when given one.
	const ip = request.headers.get('CF-Connecting-IP');
	if (ip) form.append('remoteip', ip);

	let outcome: { success?: boolean; 'error-codes'?: string[] };
	try {
		const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
		if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
		outcome = await res.json();
	} catch (e) {
		// Fail open. If Cloudflare's verification endpoint is unreachable, the
		// choice is between letting a little spam through and taking the
		// prayer request form offline; a visitor who can't reach us is the
		// worse outcome. Everything else in the guard still applies.
		console.error('Turnstile siteverify unreachable, allowing submission:', e);
		return { ok: true };
	}

	if (outcome.success) return { ok: true };

	const codes = outcome['error-codes'] ?? [];
	console.log('Turnstile rejected submission:', codes.join(', ') || 'no error code');
	return { ok: false, reason: codes.join(',') || 'invalid-token' };
}
