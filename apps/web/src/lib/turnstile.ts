/**
 * Client-side helpers for the Turnstile widget rendered by
 * components/TurnstileWidget.astro.
 *
 * Turnstile's script injects a hidden input named `cf-turnstile-response`
 * into the surrounding form once the visitor is cleared, so forms that
 * serialize the whole FormData pick the token up on their own. These
 * helpers exist for the two things that don't happen automatically: forms
 * that build their payload field by field, and resetting a spent token.
 */

/** Matches TURNSTILE_TOKEN_FIELD in the API's src/lib/turnstile.ts. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

/**
 * The token for a form, or '' when there's nothing to send — either because
 * no sitekey is configured (the widget didn't render) or because Turnstile
 * hasn't cleared this visitor yet.
 */
export function turnstileToken(form: HTMLFormElement): string {
	const input = form.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`);
	return input?.value ?? '';
}

/**
 * Wait for Turnstile to hand over a token, up to `timeoutMs`.
 *
 * On a normal visit the token is present within a moment of page load, well
 * before anyone finishes typing, so this returns immediately. It matters
 * only for someone who fills the form very fast or is on a slow connection:
 * without the wait their submission would go out tokenless and come back a
 * 403 they did nothing to deserve.
 *
 * Returns '' if no widget is on the page (no sitekey configured) or the
 * wait ran out.
 */
export async function awaitTurnstileToken(form: HTMLFormElement, timeoutMs = 5000): Promise<string> {
	if (!form.querySelector('.cf-turnstile')) return '';

	const deadline = Date.now() + timeoutMs;
	let token = turnstileToken(form);
	while (!token && Date.now() < deadline) {
		await new Promise(resolve => setTimeout(resolve, 150));
		token = turnstileToken(form);
	}
	return token;
}

/**
 * Discard the current token and get a fresh one.
 *
 * A Turnstile token is single-use and expires after a few minutes, so a
 * form that failed for any reason — a validation error, a 500, a lost
 * connection — must not resubmit the same one; the second attempt would be
 * rejected even though nothing was wrong with it. Call this on every path
 * that leaves the form open for another try.
 */
export function resetTurnstile(form: HTMLFormElement): void {
	const widget = form.querySelector<HTMLElement>('.cf-turnstile');
	const turnstile = (window as any).turnstile;
	if (widget && turnstile?.reset) {
		try {
			turnstile.reset(widget);
		} catch {
			// A widget that never finished rendering has nothing to reset.
		}
	}
}
