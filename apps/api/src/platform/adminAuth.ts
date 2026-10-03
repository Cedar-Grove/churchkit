import type { Env } from '../types';
import type { AdminAuth, AdminAuthResult } from './types';
import { verifyAccessJWT } from '../lib/access-jwt';
import { localAuth } from './localAuth';

/**
 * Who is allowed to edit a church's website.
 *
 * This is the one part of the platform seam with no portable answer, and
 * the one where getting it wrong is worst: the admin API can rewrite every
 * page, read every form submission, and send push notifications to the
 * whole congregation.
 *
 * `local` (username/password, stored in this deployment's own database) is
 * the default on both hosts — it needs no external account, no DNS, and no
 * identity provider, so a freshly provisioned deployment can log in
 * immediately. `cloudflare-access` ("SSO") is available by explicitly
 * setting ADMIN_AUTH_MODE=cloudflare-access and CF_ACCESS_AUD — a
 * deployment opts into it, rather than it being required just to get in the
 * door. An unrecognised mode still leaves the admin API refusing
 * everything, since silently falling back to an *unintended* scheme would
 * be worse than refusing.
 */

/** Cloudflare Access: a signed JWT injected at the edge. The default on Workers. */
export function cloudflareAccessAuth(env: Env): AdminAuth {
	return {
		name: 'cloudflare-access',
		verify: (request) => verifyAccessJWT(request, env),
	};
}

/**
 * Authentication performed by a reverse proxy in front of this API, which
 * passes the authenticated user's identity in a header.
 *
 * This is the standard self-hosting pattern — oauth2-proxy, Authelia,
 * Authentik, Tailscale Serve — and it is only as strong as the proxy's
 * exclusivity. If the API is reachable without going through the proxy,
 * anyone can simply send the header themselves. A deployment using this
 * MUST bind the API to localhost, or firewall it, so the proxy is the only
 * route in. That warning is repeated in the self-hosting docs because it is
 * the whole security model.
 *
 * ADMIN_PROXY_SHARED_SECRET, when set, requires the proxy to also send a
 * matching secret header. That does not fix a reachable API, but it does
 * stop a request that merely guesses the identity header's name.
 */
export function proxyHeaderAuth(env: {
	ADMIN_PROXY_HEADER?: string;
	ADMIN_PROXY_SHARED_SECRET?: string;
}): AdminAuth {
	const header = env.ADMIN_PROXY_HEADER || 'x-forwarded-email';
	const shared = env.ADMIN_PROXY_SHARED_SECRET;

	return {
		name: 'proxy-header',
		async verify(request): Promise<AdminAuthResult> {
			if (shared) {
				const presented = request.headers.get('x-churchkit-proxy-secret') ?? '';
				if (!timingSafeEqual(presented, shared)) {
					return { ok: false, reason: 'proxy_secret_mismatch' };
				}
			}
			const email = request.headers.get(header);
			if (!email) return { ok: false, reason: `no ${header} header` };
			return { ok: true, email };
		},
	};
}

/**
 * Constant-time string comparison.
 *
 * A plain === leaks how much of the secret matched through how long the
 * comparison took. The difference is small, but the cost of avoiding it is
 * smaller.
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Refuses everything, and says why. The state a misconfigured deployment lands in. */
export function noAuth(reason: string): AdminAuth {
	return {
		name: 'none',
		async verify(): Promise<AdminAuthResult> {
			return { ok: false, reason };
		},
	};
}

export type AdminAuthMode = 'local' | 'cloudflare-access' | 'proxy-header';

/**
 * Pick a scheme from configuration.
 *
 * `mode` is explicit rather than inferred from which credentials happen to
 * be present: inferring it means a deployment that loses a secret silently
 * changes how it authenticates, which is exactly the kind of surprise this
 * code should not contain. The one inference this does make is the default
 * itself — `undefined`/`''` resolves to `local` rather than refusing
 * everything, because `local` is always safe to fall back to: it still
 * requires a real credential, stored in this deployment's own database,
 * rather than trusting a header or a cookie nothing has configured yet.
 */
export function resolveAdminAuth(
	mode: string | undefined,
	env: Env & { ADMIN_PROXY_HEADER?: string; ADMIN_PROXY_SHARED_SECRET?: string }
): AdminAuth {
	switch (mode) {
		case 'local':
		case undefined:
		case '':
			return localAuth(env);
		case 'cloudflare-access':
			// An Access application that was never created leaves nothing to
			// verify against. Reported as unconfigured rather than as a
			// failed check, so the response names the secret to set instead
			// of just saying no.
			if (!env.CF_ACCESS_AUD?.trim()) return noAuth('CF_ACCESS_AUD is not set');
			return cloudflareAccessAuth(env);
		case 'proxy-header':
			return proxyHeaderAuth(env);
		default:
			return noAuth(`unknown ADMIN_AUTH_MODE "${mode}"`);
	}
}
