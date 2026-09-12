import type { Env } from '../types';
import type { Capabilities } from './capabilities';
import { CAPABILITY_REQUIREMENTS } from './capabilities';

export const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-Jwt-Assertion',
};

/**
 * Admin routes run behind Cloudflare Access, which injects the
 * CF-Access-Jwt-Assertion header at the edge for anyone holding a valid
 * Access cookie. Reflecting whatever Origin asked, together with
 * Allow-Credentials, would mean any site a signed-in admin visited could
 * issue admin requests in their name and read the responses. So only
 * origins this deployment names are echoed.
 *
 * ADMIN_ALLOWED_ORIGINS is a comma-separated list, each entry either:
 *
 *   https://admin.example.org   an exact origin
 *   .example.org                a domain and all of its subdomains
 *
 * An origin matching nothing gets no Allow-Origin header at all, which is
 * what makes the browser refuse the response. With the variable unset, no
 * cross-origin admin request is permitted — same-origin still works, so a
 * deployment serving its admin panel from the API's own domain needs no
 * configuration here.
 */
function isLoopback(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

export function isAllowedAdminOrigin(origin: string, env?: Pick<Env, 'ADMIN_ALLOWED_ORIGINS'>): boolean {
	if (!origin) return false;
	const allowed = env?.ADMIN_ALLOWED_ORIGINS;
	if (!allowed) return false;

	let host: string;
	try {
		const url = new URL(origin);
		host = url.hostname.toLowerCase();
		// Never allow an http:// origin to hold credentials, however it is
		// listed — a suffix rule must not silently permit one.
		//
		// Loopback is the one exception, and only when listed explicitly.
		// Browsers already treat localhost as a secure context, and the
		// local Docker stack has no TLS; without this the admin panel could
		// not be tried out at all before a church owns a domain. It is still
		// opt-in: an origin nobody listed is refused either way.
		if (url.protocol !== 'https:' && !isLoopback(host)) return false;
	} catch {
		return false;
	}

	return allowed.split(',').map((o) => o.trim()).filter(Boolean).some((entry) => {
		if (entry.startsWith('.')) {
			const domain = entry.slice(1).toLowerCase();
			return host === domain || host.endsWith(`.${domain}`);
		}
		return entry === origin;
	});
}

// Admin routes require credentials:include, so a wildcard origin is not allowed.
export function adminCorsHeaders(origin: string, env?: Pick<Env, 'ADMIN_ALLOWED_ORIGINS'>): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, CF-Access-Jwt-Assertion',
		'Access-Control-Allow-Credentials': 'true',
		'Vary': 'Origin',
	};
	if (isAllowedAdminOrigin(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
	return headers;
}

export function json(data: unknown, status = 200, cacheSeconds = 0): Response {
	const headers: Record<string, string> = {
		...CORS_HEADERS,
		'Content-Type': 'application/json',
	};
	if (cacheSeconds > 0) {
		headers['Cache-Control'] = `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`;
	}
	return new Response(JSON.stringify(data), { status, headers });
}

export function err(message: string, status = 400): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
	});
}

/**
 * Answer for an endpoint whose integration this church has not configured.
 *
 * 501 rather than 404 or 500: the route exists and the request was fine,
 * the server just has no implementation available. Clients read
 * `capability` to know what to hide, and a human reading the response gets
 * told which secret to set.
 */
export function notConfigured(capability: keyof Capabilities, remedy?: string): Response {
	return new Response(
		JSON.stringify({
			error: `This deployment has no ${capability} configured.`,
			capability,
			// A host-specific remedy where the caller knows one — the fix for
			// a missing admin differs between Cloudflare and a self-hosted
			// deployment, and naming the wrong setting wastes someone's
			// afternoon.
			remedy: remedy ?? CAPABILITY_REQUIREMENTS[capability],
		}),
		{ status: 501, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
	);
}
