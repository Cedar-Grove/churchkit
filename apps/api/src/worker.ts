/**
 * Cloudflare Workers entry point.
 *
 * Cloudflare is where ChurchKit is tuned to run — D1, R2, Access, smart
 * placement and the cron trigger all come from here — but it is not
 * required. See server.ts for the self-hosted equivalent, and
 * platform/types.ts for the seam the two share.
 */
import type { Env } from './types';
import { handleRequest, runScheduled } from './app';
import { resolveAdminAuth } from './platform/adminAuth';

/**
 * Workers supplies bindings as plain properties on `env`; the admin auth
 * scheme is assembled from them per request, since there is no startup
 * phase in which to do it once.
 */
function withPlatform(env: Env & { ADMIN_AUTH_MODE?: string }): Env {
	return {
		...env,
		ADMIN_AUTH: env.ADMIN_AUTH ?? resolveAdminAuth(env.ADMIN_AUTH_MODE ?? 'cloudflare-access', env),
	};
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		return handleRequest(request, withPlatform(env));
	},

	async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		await runScheduled(withPlatform(env));
	},
} satisfies ExportedHandler<Env>;
