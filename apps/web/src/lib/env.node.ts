/**
 * Node: configuration arrives as ordinary environment variables.
 *
 * The same names either way — API_BASE, TURNSTILE_SITE_KEY — so no page has
 * to know which host it is running on.
 */
export const env = process.env as Record<string, string | undefined>;
