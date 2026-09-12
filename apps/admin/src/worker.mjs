/**
 * Admin panel Worker: static assets, plus a same-origin proxy for /api/*.
 *
 * The admin SPA needs to call the API's /api/admin/* routes, which require
 * the CF-Access-Jwt-Assertion header Cloudflare's edge injects for Access-
 * protected requests. That header is only injected on requests to the
 * protected hostname itself — and the JWT it's derived from lives in a
 * cookie the browser marks HttpOnly, so client-side JS can never read it to
 * forward as a header to a *different* origin (the API's own workers.dev/
 * custom domain). Proxying /api/* through this same origin sidesteps both
 * problems: the browser's fetch stays same-origin (no header-forwarding
 * needed), and the incoming request already carries the header Cloudflare
 * injected, which we relay as-is over the service binding.
 *
 * The service binding (not a public fetch to the API's URL) also avoids
 * Cloudflare's loop-prevention error (1042), which blocks a *.workers.dev
 * Worker from fetching another *.workers.dev Worker over HTTP.
 */
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname.startsWith('/api/')) {
			return env.API.fetch(request);
		}
		return env.ASSETS.fetch(request);
	},
};
