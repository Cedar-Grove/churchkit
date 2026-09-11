import type { Env } from '../types';

interface PushOptions {
	title: string;
	body: string;
	segment?: string;
	externalIds?: string[];
	sendAfter?: string;
}

/**
 * Send a push notification, or do nothing if this deployment has no push
 * provider configured. Returns null in that case so callers can report
 * "not sent" without special-casing the absence.
 */
export async function sendPush(env: Env, opts: PushOptions): Promise<any | null> {
	if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY) return null;

	const payload: any = {
		app_id: env.ONESIGNAL_APP_ID,
		headings: { en: opts.title },
		contents: { en: opts.body },
	};

	// No `url`/`data.route` is ever set here — that field makes OneSignal
	// open a webpage directly on tap, bypassing the app's own
	// notification-click handler entirely. Every push should open the in-app
	// notification screen, so nothing here should ever set a tap destination
	// other than that.
	if (opts.sendAfter) payload.send_after = opts.sendAfter;

	if (opts.externalIds?.length) {
		payload.include_external_user_ids = opts.externalIds;
	} else {
		payload.included_segments = [opts.segment || 'All'];
	}

	const res = await fetch('https://onesignal.com/api/v1/notifications', {
		method: 'POST',
		headers: {
			'Authorization': `Basic ${env.ONESIGNAL_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		console.error('OneSignal error:', await res.text());
		return null;
	}
	return res.json();
}
