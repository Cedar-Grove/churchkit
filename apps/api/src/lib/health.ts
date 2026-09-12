import type { Env } from '../types';
import { pcoFetch } from './pco';
import { ytFetch } from './youtube';

/**
 * Whether a configured credential actually works, not just whether it's
 * present. `capabilities()` answers "is PCO_API_ID set" — a typo'd secret
 * still passes that check and only shows up as a mysterious 501 later, from
 * a route that assumed a set secret was a good one. This makes an actual
 * call to each provider so a bad key surfaces here instead.
 *
 * `ok: null` means there's nothing to verify — either the credential isn't
 * set, or (media uploads, admin access) there's no read-only way to check
 * it without a side effect or a real incoming request.
 */
export interface HealthCheck {
	name: string;
	configured: boolean;
	ok: boolean | null;
	detail: string;
}

function skip(name: string, requirement: string): HealthCheck {
	return { name, configured: false, ok: null, detail: requirement };
}

async function checkPlanningCenter(env: Env): Promise<HealthCheck> {
	const name = 'Planning Center';
	if (!env.PCO_API_ID || !env.PCO_API_SECRET) return skip(name, 'Set PCO_API_ID and PCO_API_SECRET.');
	try {
		await pcoFetch('/people/v2/people?per_page=1', env);
		return { name, configured: true, ok: true, detail: 'Authenticated — events, sermon plans and form filing can reach Planning Center.' };
	} catch (e) {
		return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
	}
}

async function checkYouTube(env: Env): Promise<HealthCheck> {
	const name = 'YouTube';
	if (!env.YOUTUBE_API_KEY || !env.YOUTUBE_CHANNEL_ID) return skip(name, 'Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID.');
	try {
		const result = await ytFetch(env, 1);
		if (result === null) return { name, configured: true, ok: false, detail: 'Configured, but the API returned nothing — check the channel ID.' };
		return { name, configured: true, ok: true, detail: `Reached the channel's uploads — ${result.items.length ? 'at least one video found.' : 'no videos yet.'}` };
	} catch (e) {
		return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
	}
}

async function checkOneSignal(env: Env): Promise<HealthCheck> {
	const name = 'OneSignal (push)';
	if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY) return skip(name, 'Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY.');
	try {
		const res = await fetch(`https://onesignal.com/api/v1/apps/${env.ONESIGNAL_APP_ID}`, {
			headers: { Authorization: `Basic ${env.ONESIGNAL_API_KEY}` },
		});
		if (!res.ok) return { name, configured: true, ok: false, detail: `OneSignal returned ${res.status} — check the app ID and API key.` };
		const data = await res.json<{ name?: string }>();
		return { name, configured: true, ok: true, detail: `Authenticated against "${data.name ?? env.ONESIGNAL_APP_ID}".` };
	} catch (e) {
		return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
	}
}

async function checkEmail(env: Env): Promise<HealthCheck> {
	const name = 'Resend (email)';
	if (!env.RESEND_API_KEY) return skip(name, 'Set RESEND_API_KEY.');
	try {
		const res = await fetch('https://api.resend.com/domains', {
			headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
		});
		if (!res.ok) return { name, configured: true, ok: false, detail: `Resend returned ${res.status} — the API key is likely wrong or revoked.` };
		return { name, configured: true, ok: true, detail: 'Authenticated with Resend.' };
	} catch (e) {
		return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
	}
}

async function checkTurnstile(env: Env): Promise<HealthCheck> {
	const name = 'Turnstile (bot protection)';
	if (!env.TURNSTILE_SECRET) return skip(name, 'Optional. Set TURNSTILE_SECRET to challenge form submissions.');
	try {
		// There's no "is this secret valid" endpoint on its own — only
		// verifying an actual widget response. Sending a deliberately fake
		// response still distinguishes a bad secret (error-codes includes
		// invalid-input-secret) from a good one rejecting a fake token
		// (invalid-input-response instead) — the secret is what this checks.
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: 'health-check-probe' }),
		});
		const data = await res.json<{ success: boolean; 'error-codes'?: string[] }>();
		const badSecret = data['error-codes']?.includes('invalid-input-secret');
		if (badSecret) return { name, configured: true, ok: false, detail: 'Cloudflare rejected TURNSTILE_SECRET as invalid.' };
		return { name, configured: true, ok: true, detail: 'Cloudflare accepted the secret (a fake token was correctly rejected).' };
	} catch (e) {
		return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
	}
}

async function checkBible(env: Env): Promise<HealthCheck> {
	const name = 'Scripture (Bible Brain / API.Bible)';
	if (env.BIBLE_BRAIN_API_KEY) {
		try {
			const res = await fetch(`https://4.dbt.io/api/bibles?v=4&key=${encodeURIComponent(env.BIBLE_BRAIN_API_KEY)}&limit=1`);
			if (!res.ok) return { name, configured: true, ok: false, detail: `Bible Brain returned ${res.status} — check BIBLE_BRAIN_API_KEY.` };
			return { name, configured: true, ok: true, detail: 'Authenticated with Bible Brain (text and audio).' };
		} catch (e) {
			return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
		}
	}
	if (env.BIBLE_API_KEY) {
		try {
			const res = await fetch('https://api.scripture.api.bible/v1/bibles', {
				headers: { 'api-key': env.BIBLE_API_KEY },
			});
			if (!res.ok) return { name, configured: true, ok: false, detail: `API.Bible returned ${res.status} — check BIBLE_API_KEY.` };
			return { name, configured: true, ok: true, detail: 'Authenticated with API.Bible (text only — no audio).' };
		} catch (e) {
			return { name, configured: true, ok: false, detail: (e as Error).message.slice(0, 200) };
		}
	}
	return skip(name, 'Set BIBLE_BRAIN_API_KEY (text + audio) or BIBLE_API_KEY (text only).');
}

function checkMediaUploads(env: Env): HealthCheck {
	const name = 'Media uploads (R2)';
	if (!env.MEDIA || !env.MEDIA_PUBLIC_URL) return skip(name, 'Bind an R2 bucket as MEDIA and set MEDIA_PUBLIC_URL.');
	// Storage only exposes put() (see platform/types.ts) — there's no
	// read-only way to confirm the bucket is reachable without writing to
	// it, which a passive health check shouldn't do on every refresh.
	return { name, configured: true, ok: null, detail: 'Bound. Not independently verified — try an image upload on a page to confirm.' };
}

function checkAdminAccess(): HealthCheck {
	// Reaching this handler at all already went through adminAuth's
	// verification of a real Cloudflare Access JWT — if CF_ACCESS_AUD were
	// wrong, that check would have failed before this code ever ran.
	return { name: 'Admin access (Cloudflare Access)', configured: true, ok: true, detail: 'Verified — you reached this page through it.' };
}

export async function runHealthChecks(env: Env): Promise<HealthCheck[]> {
	const [planningCenter, youtube, push, email, botProtection, bible] = await Promise.all([
		checkPlanningCenter(env),
		checkYouTube(env),
		checkOneSignal(env),
		checkEmail(env),
		checkTurnstile(env),
		checkBible(env),
	]);
	return [planningCenter, youtube, push, email, botProtection, bible, checkMediaUploads(env), checkAdminAccess()];
}
