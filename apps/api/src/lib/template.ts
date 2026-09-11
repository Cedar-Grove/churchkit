import type { Env } from '../types';
import { esc } from './email';

/**
 * Minimal `{{placeholder}}` rendering for church-authored email templates.
 *
 * The template itself comes from the `settings` table and is authored by an
 * admin behind Cloudflare Access, so it is trusted HTML. The *values* are
 * not — a visitor's own first name reaches these templates — so every
 * substituted value is HTML-escaped. An unknown placeholder renders as an
 * empty string rather than leaving `{{whatever}}` visible in a real email
 * sent to a real visitor.
 */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
	return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
		const value = vars[key.toLowerCase()];
		return value === undefined || value === null ? '' : esc(value);
	});
}

/**
 * The church's identity, for interpolation into any template. Read from
 * settings so staff can change the church's phone number without a deploy.
 */
export interface ChurchDetails {
	church_name: string;
	tagline: string;
	phone: string;
	email: string;
	address: string;
}

export async function getChurchDetails(env: Env): Promise<ChurchDetails> {
	const { results } = await env.DB.prepare(
		"SELECT key, value FROM settings WHERE key IN ('church_name', 'tagline', 'phone', 'email', 'address')"
	).all<{ key: string; value: string }>();

	const map = Object.fromEntries(results.map((r) => [r.key, r.value ?? '']));
	return {
		church_name: map.church_name || 'Our Church',
		tagline: map.tagline || '',
		phone: map.phone || '',
		email: map.email || '',
		address: map.address || '',
	};
}

/**
 * Fetch an admin-editable template, falling back to a generic default.
 *
 * The default deliberately says nothing a specific church would have to
 * correct — no denomination, no pastor's name, no address beyond what
 * settings supply. A church that never edits it still sends a correct,
 * if plain, email.
 */
export async function getTemplate(env: Env, key: string, fallback: string): Promise<string> {
	const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
		.bind(key)
		.first<{ value: string }>();
	const value = row?.value?.trim();
	return value || fallback;
}

/** Signature block shared by the default templates. */
export const DEFAULT_SIGNATURE = `
		<p>
			{{church_name}}<br>
			{{address}}<br>
			{{phone}}
		</p>`;

export const DEFAULT_WELCOME_EMAIL = `
		<p>Hi {{first_name}},</p>
		<p>Thank you for filling out a connect card at {{church_name}}. We're so glad you were with us.</p>
		<p>Someone from our team will be in touch soon. In the meantime, if you have any questions, feel free to reply to this email.</p>
		<p>We'd love to see you again!</p>
		<br>${DEFAULT_SIGNATURE}`;
