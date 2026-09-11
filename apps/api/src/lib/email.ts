import type { Env } from '../types';

/**
 * Escapes a value for interpolation into an email's HTML body. Every field
 * in these emails is attacker-controlled — the form endpoints are public —
 * so anything not escaped lets a submitter inject their own markup and
 * links into mail that arrives looking like it came from the church.
 */
export function esc(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Escapes, then renders newlines as <br> for free-text fields. */
export function escMultiline(value: unknown): string {
	return esc(value).replace(/\r?\n/g, '<br>');
}

interface EmailOptions {
	to: string | string[];
	from?: string;
	subject: string;
	html: string;
}

/**
 * Send one transactional email.
 *
 * Returns false without sending when this deployment has no email provider
 * configured, or when the caller has no recipient address for this kind of
 * message. Callers treat that as normal: a form submission is still stored
 * in the database and still filed to Planning Center, it just does not also
 * land in an inbox. A church that never sets RESEND_API_KEY gets working
 * forms, not broken ones.
 */
export async function sendEmail(env: Env, opts: EmailOptions): Promise<boolean> {
	if (!env.RESEND_API_KEY) return false;

	const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
	if (!to.length) return false;

	const from = opts.from || env.EMAIL_FROM;
	if (!from) {
		console.error('sendEmail: no EMAIL_FROM configured; not sending.');
		return false;
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html }),
	});

	if (!res.ok) {
		console.error('Resend error:', await res.text());
		return false;
	}
	return true;
}
