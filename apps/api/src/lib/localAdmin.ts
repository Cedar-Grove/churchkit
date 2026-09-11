import type { Env } from '../types';

/**
 * Local-only admin access, for trying the panel out before a church owns a
 * domain or a Cloudflare Access application.
 *
 * Cloudflare Access is what authenticates admins in a real deployment, and
 * it cannot exist on a laptop: there is no edge injecting a signed JWT. So
 * without something here, the admin panel is untestable until a church has
 * bought a domain and configured Zero Trust — which is a bad first
 * experience and pushes people toward worse workarounds.
 *
 * The danger with any such escape hatch is that it survives into
 * production. This one cannot, and not because of a flag someone has to
 * remember:
 *
 *   1. The request's own hostname must be loopback. On a deployed Worker
 *      the URL carries the church's real domain, never localhost — so the
 *      bypass cannot activate there even if the variable were somehow set.
 *   2. ADMIN_DEV_BYPASS must be set, and is never written by
 *      `churchkit secrets`, which refuses the name outright.
 *   3. `churchkit doctor` reports it as a problem if it finds it set.
 *
 * Condition 1 is the one that matters: it is structural, not procedural.
 */
export function isLocalDevRequest(request: Request, env: Env): boolean {
	if (!env.ADMIN_DEV_BYPASS) return false;

	let hostname: string;
	try {
		hostname = new URL(request.url).hostname.toLowerCase();
	} catch {
		return false;
	}

	const loopback =
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '::1' ||
		hostname === '[::1]';

	if (!loopback) {
		// Reaching here means the variable is set on something that is not a
		// laptop. Say so loudly rather than silently ignoring it.
		console.error(
			'ADMIN_DEV_BYPASS is set on a non-local deployment and is being ignored. ' +
			'Remove it: wrangler secret delete ADMIN_DEV_BYPASS'
		);
		return false;
	}

	console.warn('⚠ admin request authorised by ADMIN_DEV_BYPASS (local development only)');
	return true;
}
