import type { Env } from '../types';
import { err } from './response';
import { checkFormRateLimit } from './rateLimit';
import { verifyFormTurnstile, TURNSTILE_TOKEN_FIELD } from './turnstile';

/**
 * Shared front door for the four public form endpoints. They're open POSTs
 * that create real Planning Center people records and send staff email, so
 * everything that shouldn't reach that machinery gets turned away here:
 * oversized bodies, bots that filled the honeypot, browser submissions that
 * can't pass a Turnstile challenge, and anyone over the rate limit.
 */

/** Generous for a connect card with several children; far below anything abusive. */
const MAX_BODY_BYTES = 32 * 1024;

/**
 * Fields no human ever fills — they're hidden from view on the website
 * forms, but a bot parsing the HTML sees ordinary inputs and completes
 * them. `website` is the one the forms render; the others are common names
 * that scripted spam fills in by default.
 */
const HONEYPOT_FIELDS = ['website', 'url', 'company', 'fax'];

/** Per-field ceilings, applied before anything is stored or sent onward. */
const MAX_FIELD_LENGTHS: Record<string, number> = {
	first_name: 100, firstName: 100,
	last_name: 100, lastName: 100,
	name: 200,
	email: 254,
	phone: 40,
	subject: 200,
	street: 200, city: 100, state: 50, zip: 20,
	spouse_name: 200, spouseName: 200,
	how_found: 200, howFound: 200, how_did_you_hear: 200, howHeard: 200,
	interested_in: 500,
	message: 5000,
	notes: 5000,
	request: 5000,
	prayer_request: 5000, prayerRequest: 5000,
};
const DEFAULT_MAX_FIELD_LENGTH = 1000;

export type GuardOutcome =
	| { ok: true; body: any }
	/** Something to return to the caller instead of processing the form. */
	| { ok: false; response: Response };

/**
 * A honeypot hit gets a normal-looking success response rather than an
 * error. A bot that's told it was blocked retries with the field removed;
 * one that's told it succeeded moves on.
 */
function fakeSuccess(): Response {
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

function truncateStrings(value: any, key = '', depth = 0): any {
	if (depth > 6) return null;
	if (typeof value === 'string') {
		const max = MAX_FIELD_LENGTHS[key] ?? DEFAULT_MAX_FIELD_LENGTH;
		return value.length > max ? value.slice(0, max) : value;
	}
	// Cap array length too — `children` is the only legitimate array here and
	// a household has nowhere near this many.
	if (Array.isArray(value)) return value.slice(0, 25).map(v => truncateStrings(v, key, depth + 1));
	if (value && typeof value === 'object') {
		const out: Record<string, any> = {};
		for (const [k, v] of Object.entries(value)) out[k] = truncateStrings(v, k, depth + 1);
		return out;
	}
	return value;
}

export async function guardFormRequest(request: Request, env: Env): Promise<GuardOutcome> {
	const declaredLength = Number(request.headers.get('Content-Length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
		return { ok: false, response: err('Submission too large', 413) };
	}

	// Content-Length can be absent or wrong, so measure what actually arrived
	// rather than trusting the header alone.
	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return { ok: false, response: err('Submission too large', 413) };
	}

	let body: any;
	try {
		body = JSON.parse(raw);
	} catch {
		return { ok: false, response: err('Invalid request body', 400) };
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, response: err('Invalid request body', 400) };
	}

	for (const field of HONEYPOT_FIELDS) {
		if (typeof body[field] === 'string' && body[field].trim()) {
			console.log('Form honeypot tripped:', field);
			return { ok: false, response: fakeSuccess() };
		}
	}

	const limit = await checkFormRateLimit(request, env);
	if (!limit.allowed) {
		const response = err('Too many submissions. Please try again shortly.', 429);
		response.headers.set('Retry-After', String(Math.max(1, limit.retryAfter)));
		return { ok: false, response };
	}

	// After the rate limit, so a flood can't drive an outbound siteverify
	// call per request.
	const turnstile = await verifyFormTurnstile(request, body, env);
	if (!turnstile.ok) {
		// A real error, unlike the honeypot's fake success: this is the one
		// rejection a legitimate visitor can hit (an expired token on a form
		// left open a while), and they need to be told to retry. The website
		// resets its widget and shows the message on a 403.
		return {
			ok: false,
			response: err('Could not verify that you are human. Please reload the page and try again.', 403),
		};
	}

	// Drop the honeypots and the challenge token so they never reach
	// Planning Center or the DB.
	for (const field of HONEYPOT_FIELDS) delete body[field];
	delete body[TURNSTILE_TOKEN_FIELD];

	return { ok: true, body: truncateStrings(body) };
}

/**
 * Planning Center only accepts YYYY-MM-DD for a Person's birthdate. The
 * website sends that already (it uses <input type="date">), but the mobile
 * connect card collects free text, so normalize the common US formats and
 * return null for anything else — a birthdate that can't be parsed is worth
 * skipping, never worth failing the whole submission over.
 */
export function normalizeBirthdate(input: unknown): string | null {
	if (typeof input !== 'string') return null;
	const value = input.trim();
	if (!value) return null;

	let year: number, month: number, day: number;

	const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	const us = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);

	if (iso) {
		[, year, month, day] = iso.map(Number) as unknown as [string, number, number, number];
	} else if (us) {
		[, month, day, year] = us.map(Number) as unknown as [string, number, number, number];
	} else {
		return null;
	}

	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	if (year < 1900 || year > new Date().getUTCFullYear()) return null;

	// Rejects a day that doesn't exist in that month (e.g. 02/30/1990), which
	// the range check above lets through.
	const asDate = new Date(Date.UTC(year, month - 1, day));
	if (asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) return null;

	const pad = (n: number) => String(n).padStart(2, '0');
	return `${year}-${pad(month)}-${pad(day)}`;
}
