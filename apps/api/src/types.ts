import type { Database, Storage, AdminAuth } from './platform/types';

/**
 * ChurchKit API environment.
 *
 * Only `DB` is required. Every integration below is optional: a church that
 * has no YouTube channel, sends no push notifications, or has not signed up
 * for a scripture provider still gets a working deployment — the features
 * backed by the missing credentials simply report themselves as unavailable
 * rather than erroring.
 *
 * See lib/capabilities.ts for how absence is turned into a capability set,
 * and `.dev.vars.example` at the repository root for where each credential
 * comes from.
 */
export interface Env {
	// ── Required ────────────────────────────────────────────────────
	/**
	 * The database. Content, caches, budgets and rate limits live here.
	 *
	 * Typed as the platform interface rather than D1Database directly:
	 * Cloudflare's D1 satisfies it structurally, and so does the SQLite
	 * driver a self-hosted deployment uses. See platform/types.ts.
	 */
	DB: Database;

	// ── Optional: media uploads ─────────────────────────────────────
	/** Object storage for admin image uploads. Without it, uploads are refused. */
	MEDIA?: Storage;
	/** Public base URL serving MEDIA, e.g. https://media.example.org */
	MEDIA_PUBLIC_URL?: string;

	// ── Optional: Planning Center ───────────────────────────────────
	// Server-side calls (sermons, events, forms) need API_ID + API_SECRET.
	// Member login additionally needs CLIENT_ID; the OAuth flow is PKCE and
	// deliberately has no client secret.
	PCO_CLIENT_ID?: string;
	PCO_API_ID?: string;
	PCO_API_SECRET?: string;
	/** Service type whose plans supply sermon titles and notes. */
	PCO_SERVICE_TYPE_ID?: string;
	// Note categories that form submissions are filed under. Each is
	// independent — configure only the forms you use.
	PCO_CONNECT_CARD_NOTE_CATEGORY_ID?: string;
	PCO_PRAYER_REQUEST_NOTE_CATEGORY_ID?: string;
	PCO_IM_NEW_NOTE_CATEGORY_ID?: string;
	// PCO Forms whose "on submission, add to workflow" automation files a
	// workflow card. Creating a WorkflowCard directly is refused by PCO for
	// API-credential auth, so submitting to a form is how a card gets made.
	// A form with no ID set simply files no card.
	PCO_CONNECT_CARD_FORM_ID?: string;
	PCO_PRAYER_REQUEST_FORM_ID?: string;
	PCO_IM_NEW_FORM_ID?: string;

	// ── Optional: sermon video (YouTube Data API v3) ────────────────
	YOUTUBE_API_KEY?: string;
	YOUTUBE_CHANNEL_ID?: string;

	// ── Optional: transactional email (Resend) ──────────────────────
	RESEND_API_KEY?: string;
	/** Envelope sender, e.g. "Example Church <noreply@example.org>". */
	EMAIL_FROM?: string;
	// Where each form's notification goes. A form with no address set is
	// still recorded in the database; only the notification is skipped.
	EMAIL_STAFF_CONNECT_CARD?: string;
	EMAIL_STAFF_IM_NEW?: string;
	EMAIL_STAFF_CONTACT?: string;
	/** "From" on the welcome email sent to a visitor. Falls back to EMAIL_FROM. */
	EMAIL_FROM_PASTOR?: string;

	// ── Optional: push notifications (OneSignal) ────────────────────
	ONESIGNAL_APP_ID?: string;
	ONESIGNAL_API_KEY?: string;

	// ── Optional: admin panel (Cloudflare Access) ───────────────────
	/**
	 * Access application audience tag. Without it every /api/admin/* request
	 * is refused — the admin panel is unavailable rather than unprotected.
	 */
	CF_ACCESS_AUD?: string;
	/**
	 * Origins allowed to call /api/admin/* with credentials, comma-separated.
	 * Also accepts a leading-dot wildcard to allow a domain and its
	 * subdomains, e.g. ".example.org". See lib/response.ts.
	 */
	ADMIN_ALLOWED_ORIGINS?: string;

	/**
	 * Local development only. Skips Cloudflare Access verification for
	 * requests whose own hostname is loopback — which a deployed Worker's
	 * never is, so this cannot weaken a real deployment. Set it in
	 * .dev.vars, never with `wrangler secret put`. See lib/localAdmin.ts.
	 */
	ADMIN_DEV_BYPASS?: string;

	// ── Optional: bot protection (Cloudflare Turnstile) ─────────────
	/** Unset means no challenge; the other form guards still apply. */
	TURNSTILE_SECRET?: string;

	// ── Optional: scripture ─────────────────────────────────────────
	/**
	 * How admin requests are authenticated. Supplied by the host adapter:
	 * Cloudflare Access on Workers, or whichever scheme a self-hosted
	 * deployment configured. See platform/adminAuth.ts.
	 */
	ADMIN_AUTH?: AdminAuth;

	/** Bible Brain / Faith Comes By Hearing — audio and text. */
	BIBLE_BRAIN_API_KEY?: string;
	/** API.Bible (scripture.api.bible) — additional translations. */
	BIBLE_API_KEY?: string;
}
