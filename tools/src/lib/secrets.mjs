/**
 * The credentials a ChurchKit API deployment can hold.
 *
 * Kept in step with apps/api/src/types.ts and the root .dev.vars.example.
 * Nothing here is required — `capabilities` in the API derives what a
 * deployment can serve from which of these are actually set, so a church
 * provides only the ones for features it wants.
 *
 * `feature` is what a church loses by leaving it unset, stated plainly, so
 * `doctor` can explain an absence rather than just reporting one.
 * `where` is where the value itself comes from — a person gathering these
 * for the first time is switching between four or five unrelated provider
 * dashboards, and "set PCO_API_ID" doesn't say which one.
 */
export const SECRETS = [
	{ name: 'PCO_CLIENT_ID', feature: 'member login', group: 'Planning Center',
		where: 'Planning Center → My Developer Account → OAuth Applications → create one. No client secret needed (the app uses PKCE).' },
	{ name: 'PCO_API_ID', feature: 'events, sermon plans, form filing', group: 'Planning Center',
		where: 'Planning Center → My Developer Account → Personal Access Tokens → create one. This is the "Application ID" half.' },
	{ name: 'PCO_API_SECRET', feature: 'events, sermon plans, form filing', group: 'Planning Center',
		where: 'Same Personal Access Token as PCO_API_ID — this is the "Secret" half, shown once at creation.' },
	{ name: 'PCO_SERVICE_TYPE_ID', feature: 'sermon titles and series', group: 'Planning Center',
		where: 'Planning Center Services → the service type\'s own page → the number in its URL (…/service_types/<this>).' },
	{ name: 'PCO_CONNECT_CARD_NOTE_CATEGORY_ID', feature: 'filing connect cards as notes', group: 'Planning Center',
		where: 'Planning Center People → Lists → Note Categories → the category to file connect cards under → its URL.' },
	{ name: 'PCO_PRAYER_REQUEST_NOTE_CATEGORY_ID', feature: 'filing prayer requests as notes', group: 'Planning Center',
		where: 'Same place as above — a (probably different) note category for prayer requests.' },
	{ name: 'PCO_IM_NEW_NOTE_CATEGORY_ID', feature: 'filing "I\'m New" as notes', group: 'Planning Center',
		where: 'Same place again — a note category for first-time visitor submissions.' },
	{ name: 'PCO_CONNECT_CARD_FORM_ID', feature: 'connect card workflow cards', group: 'Planning Center',
		where: 'Planning Center Publishing → Forms → the form whose "on submission" automation should fire → its URL.' },
	{ name: 'PCO_PRAYER_REQUEST_FORM_ID', feature: 'prayer request workflow cards', group: 'Planning Center',
		where: 'Same place — the form for prayer requests.' },
	{ name: 'PCO_IM_NEW_FORM_ID', feature: '"I\'m New" workflow cards', group: 'Planning Center',
		where: 'Same place — the form for "I\'m New" submissions.' },

	{ name: 'RESEND_API_KEY', feature: 'all outbound email', group: 'Email',
		where: 'resend.com → API Keys → create one. The sending domain must be verified there first.' },
	{ name: 'EMAIL_FROM', feature: 'all outbound email', group: 'Email',
		where: 'Not a lookup — decide it. Must be an address on a domain verified in Resend, e.g. "Cedar Grove <noreply@example.org>".' },
	{ name: 'EMAIL_STAFF_CONNECT_CARD', feature: 'connect card notifications', group: 'Email',
		where: 'Not a lookup — the address that should receive connect card notifications.' },
	{ name: 'EMAIL_STAFF_IM_NEW', feature: '"I\'m New" notifications', group: 'Email',
		where: 'Not a lookup — the address that should receive "I\'m New" notifications.' },
	{ name: 'EMAIL_STAFF_CONTACT', feature: 'contact form notifications', group: 'Email',
		where: 'Not a lookup — the address that should receive contact form notifications.' },
	{ name: 'EMAIL_FROM_PASTOR', feature: 'a separate sender on the welcome email', group: 'Email',
		where: 'Not a lookup — optional. Falls back to EMAIL_FROM if left unset.' },

	{ name: 'ONESIGNAL_APP_ID', feature: 'push notifications', group: 'Push',
		where: 'onesignal.com → the app → Settings → Keys & IDs. If a mobile app is already published, this MUST be its existing app — a new one orphans every device already registered.' },
	{ name: 'ONESIGNAL_API_KEY', feature: 'push notifications', group: 'Push',
		where: 'Same OneSignal app → Settings → Keys & IDs → REST API Key.' },

	{ name: 'YOUTUBE_API_KEY', feature: 'sermon video and live stream', group: 'Video',
		where: 'console.cloud.google.com → APIs & Services → Credentials → API key, with the YouTube Data API v3 enabled on that project.' },
	{ name: 'YOUTUBE_CHANNEL_ID', feature: 'sermon video and live stream', group: 'Video',
		where: "YouTube Studio → Settings → Channel → Advanced settings — or the channel's own page URL if it isn't a custom handle." },

	{ name: 'CF_ACCESS_AUD', feature: 'the admin panel', group: 'Admin',
		where: 'Cloudflare Zero Trust → Access → Applications → the application protecting the admin panel → its Application Audience (AUD) Tag.' },
	{ name: 'TURNSTILE_SECRET', feature: 'bot challenge on public forms', group: 'Admin',
		where: 'Cloudflare dashboard → Turnstile → the widget → Secret Key.' },

	{ name: 'BIBLE_BRAIN_API_KEY', feature: 'scripture audio and text', group: 'Scripture',
		where: 'faithcomesbyhearing.com/bible-brain → request API access.' },
	{ name: 'BIBLE_API_KEY', feature: 'additional scripture translations', group: 'Scripture',
		where: 'scripture.api.bible → sign up → create an API key.' },
];

/** Secrets that, if absent, leave the deployment with no admin panel at all. */
export const ADMIN_CRITICAL = ['CF_ACCESS_AUD'];

export function secretNames() {
	return SECRETS.map((s) => s.name);
}

export function groupedSecrets() {
	const groups = new Map();
	for (const secret of SECRETS) {
		if (!groups.has(secret.group)) groups.set(secret.group, []);
		groups.get(secret.group).push(secret);
	}
	return groups;
}
