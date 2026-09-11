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
 */
export const SECRETS = [
	{ name: 'PCO_CLIENT_ID', feature: 'member login', group: 'Planning Center' },
	{ name: 'PCO_API_ID', feature: 'events, sermon plans, form filing', group: 'Planning Center' },
	{ name: 'PCO_API_SECRET', feature: 'events, sermon plans, form filing', group: 'Planning Center' },
	{ name: 'PCO_SERVICE_TYPE_ID', feature: 'sermon titles and series', group: 'Planning Center' },
	{ name: 'PCO_CONNECT_CARD_NOTE_CATEGORY_ID', feature: 'filing connect cards as notes', group: 'Planning Center' },
	{ name: 'PCO_PRAYER_REQUEST_NOTE_CATEGORY_ID', feature: 'filing prayer requests as notes', group: 'Planning Center' },
	{ name: 'PCO_IM_NEW_NOTE_CATEGORY_ID', feature: 'filing "I\'m New" as notes', group: 'Planning Center' },
	{ name: 'PCO_CONNECT_CARD_FORM_ID', feature: 'connect card workflow cards', group: 'Planning Center' },
	{ name: 'PCO_PRAYER_REQUEST_FORM_ID', feature: 'prayer request workflow cards', group: 'Planning Center' },
	{ name: 'PCO_IM_NEW_FORM_ID', feature: '"I\'m New" workflow cards', group: 'Planning Center' },

	{ name: 'RESEND_API_KEY', feature: 'all outbound email', group: 'Email' },
	{ name: 'EMAIL_FROM', feature: 'all outbound email', group: 'Email' },
	{ name: 'EMAIL_STAFF_CONNECT_CARD', feature: 'connect card notifications', group: 'Email' },
	{ name: 'EMAIL_STAFF_IM_NEW', feature: '"I\'m New" notifications', group: 'Email' },
	{ name: 'EMAIL_STAFF_CONTACT', feature: 'contact form notifications', group: 'Email' },
	{ name: 'EMAIL_FROM_PASTOR', feature: 'a separate sender on the welcome email', group: 'Email' },

	{ name: 'ONESIGNAL_APP_ID', feature: 'push notifications', group: 'Push' },
	{ name: 'ONESIGNAL_API_KEY', feature: 'push notifications', group: 'Push' },

	{ name: 'YOUTUBE_API_KEY', feature: 'sermon video and live stream', group: 'Video' },
	{ name: 'YOUTUBE_CHANNEL_ID', feature: 'sermon video and live stream', group: 'Video' },

	{ name: 'CF_ACCESS_AUD', feature: 'the admin panel', group: 'Admin' },
	{ name: 'TURNSTILE_SECRET', feature: 'bot challenge on public forms', group: 'Admin' },

	{ name: 'BIBLE_BRAIN_API_KEY', feature: 'scripture audio and text', group: 'Scripture' },
	{ name: 'BIBLE_API_KEY', feature: 'additional scripture translations', group: 'Scripture' },
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
