import type { Env } from '../types';

/**
 * Which features this deployment can actually serve.
 *
 * ChurchKit requires no integration beyond a database. A church with no
 * YouTube channel, no push provider and no scripture key still gets a
 * working site — it just gets a smaller one. Rather than scattering
 * `if (!env.SOMETHING)` guards through the routes and hoping each client
 * guesses right, capability is derived in one place from what is actually
 * bound, and published at `GET /api/capabilities` so the website and the
 * mobile app can hide what this church does not use.
 *
 * The rule throughout: a feature whose credentials are absent is
 * *unavailable*, never *broken*. Endpoints answer 501 with a plain
 * explanation; list endpoints answer with an empty list; nothing throws.
 */
export interface Capabilities {
	/** Planning Center server-side calls: events, sermon plans, form filing. */
	planningCenter: boolean;
	/** Member login (PCO OAuth + PKCE): profile, giving history, schedules. */
	accounts: boolean;
	/** Sermon video listing. */
	sermons: boolean;
	/** "We are live right now" detection. */
	liveStream: boolean;
	/** Calendar events and registrations. */
	events: boolean;
	/** Child check-in. */
	checkIn: boolean;
	/** Push notifications. */
	push: boolean;
	/** Outbound email from form submissions. */
	email: boolean;
	/** Image uploads from the admin panel. */
	mediaUploads: boolean;
	/** Admin panel. */
	admin: boolean;
	/** Scripture text. */
	bible: boolean;
	/** Scripture audio. */
	bibleAudio: boolean;
	/** Turnstile challenge on public forms. */
	botProtection: boolean;
}

/** True when every named secret is bound and non-empty. */
function has(env: Env, ...keys: (keyof Env)[]): boolean {
	return keys.every((k) => {
		const v = env[k];
		return typeof v === 'string' ? v.trim().length > 0 : v != null;
	});
}

export function capabilities(env: Env): Capabilities {
	const planningCenter = has(env, 'PCO_API_ID', 'PCO_API_SECRET');
	const youtube = has(env, 'YOUTUBE_API_KEY', 'YOUTUBE_CHANNEL_ID');

	return {
		planningCenter,
		// Member login needs the OAuth app *and* the server credentials the
		// /api/me/* proxy calls PCO with.
		accounts: planningCenter && has(env, 'PCO_CLIENT_ID'),
		// Sermons come from YouTube; Planning Center only enriches them with
		// plan titles and notes, so YouTube alone is enough to list them.
		sermons: youtube,
		liveStream: youtube,
		events: planningCenter,
		checkIn: planningCenter && has(env, 'PCO_CLIENT_ID'),
		push: has(env, 'ONESIGNAL_APP_ID', 'ONESIGNAL_API_KEY'),
		email: has(env, 'RESEND_API_KEY'),
		mediaUploads: has(env, 'MEDIA', 'MEDIA_PUBLIC_URL'),
		admin: has(env, 'CF_ACCESS_AUD'),
		// Either provider can serve text; only Bible Brain serves audio.
		bible: has(env, 'BIBLE_BRAIN_API_KEY') || has(env, 'BIBLE_API_KEY'),
		bibleAudio: has(env, 'BIBLE_BRAIN_API_KEY'),
		botProtection: has(env, 'TURNSTILE_SECRET'),
	};
}

/**
 * Human-readable reason a capability is unavailable, for the 501 body and
 * for `churchkit doctor`. Keep these actionable: the reader is usually a
 * volunteer who needs to know which secret to go and set.
 */
export const CAPABILITY_REQUIREMENTS: Record<keyof Capabilities, string> = {
	planningCenter: 'Set PCO_API_ID and PCO_API_SECRET.',
	accounts: 'Set PCO_CLIENT_ID alongside PCO_API_ID and PCO_API_SECRET.',
	sermons: 'Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID.',
	liveStream: 'Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID.',
	events: 'Set PCO_API_ID and PCO_API_SECRET.',
	checkIn: 'Set PCO_CLIENT_ID alongside PCO_API_ID and PCO_API_SECRET.',
	push: 'Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY.',
	email: 'Set RESEND_API_KEY.',
	mediaUploads: 'Bind an R2 bucket as MEDIA and set MEDIA_PUBLIC_URL.',
	admin: 'Set CF_ACCESS_AUD from your Cloudflare Access application.',
	bible: 'Set BIBLE_BRAIN_API_KEY or BIBLE_API_KEY.',
	bibleAudio: 'Set BIBLE_BRAIN_API_KEY.',
	botProtection: 'Optional. Set TURNSTILE_SECRET to challenge form submissions.',
};
