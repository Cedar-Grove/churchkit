import { resetTurnstile } from './turnstile';

/**
 * Put a form back in a submittable state after a failed attempt.
 *
 * Every failure path has to do the same three things, and one of them is
 * easy to forget: a Turnstile token is single-use, so leaving the spent one
 * in place would make the visitor's second attempt fail for a reason that
 * has nothing to do with why the first one did.
 *
 * `message` empty leaves whatever the page already has in its #form-error
 * element — each form ships its own generic wording there — so only the
 * cases that need to say something specific pass text.
 */
export function showFormError(
	form: HTMLFormElement,
	btn: HTMLButtonElement,
	message: string,
	buttonLabel: string,
): void {
	resetTurnstile(form);

	const errorEl = document.getElementById('form-error');
	if (errorEl) {
		if (message) errorEl.textContent = message;
		errorEl.style.display = 'block';
	}

	btn.textContent = buttonLabel;
	btn.disabled = false;
}
